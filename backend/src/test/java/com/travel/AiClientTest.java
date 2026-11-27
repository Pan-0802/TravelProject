package com.travel;

import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.sun.net.httpserver.HttpServer;
import com.travel.common.BusinessException;
import com.travel.dto.AiRequests.Generate;
import com.travel.integration.ChatCompletionAiClient;
import org.junit.jupiter.api.*;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.atomic.AtomicReference;
import static org.assertj.core.api.Assertions.*;

/** Real HTTP round trips against a local fake provider; no billable external calls. */
class AiClientTest {
    HttpServer server;
    ExecutorService executor;
    AtomicReference<Reply> reply = new AtomicReference<>();
    AtomicReference<String> received = new AtomicReference<>();
    record Reply(int status, String body, int delayMillis) {}
    @BeforeEach void start() throws Exception {
        server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        executor=Executors.newCachedThreadPool(); server.setExecutor(executor);
        server.createContext("/chat/completions", exchange -> {
            try {
                received.set(new String(exchange.getRequestBody().readAllBytes(),StandardCharsets.UTF_8));
                Reply value=reply.get();
                if(value.delayMillis()>0) Thread.sleep(value.delayMillis());
                byte[] bytes=value.body().getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type","application/json");
                exchange.sendResponseHeaders(value.status(),bytes.length);
                exchange.getResponseBody().write(bytes);
            } catch(InterruptedException e) { Thread.currentThread().interrupt(); }
            finally { exchange.close(); }
        });
        server.start();
    }
    @AfterEach void stop() { server.stop(0); executor.shutdownNow(); }
    ChatCompletionAiClient client(String key,int timeout) {
        var json=JsonMapper.builder().addModule(new JavaTimeModule()).build();
        return new ChatCompletionAiClient(json,key,"http://127.0.0.1:"+server.getAddress().getPort(),"test-model",timeout);
    }
    Generate request() {
        return new Generate(null,"重庆",LocalDate.parse("2026-12-01"),LocalDate.parse("2026-12-01"),1,
            new BigDecimal("500"),null,List.of("美食"),null);
    }
    @Test void parsesStructuredDraftAndUsesConfiguredModel() throws Exception {
        String content="""
            {"estimatedTotal":100,"days":[{"date":"2026-12-01","dayNumber":1,"description":null,"items":[]}]}
            """;
        String envelope=new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(
            java.util.Map.of("choices",List.of(java.util.Map.of("message",java.util.Map.of("content",content)))));
        reply.set(new Reply(200,envelope,0));
        var draft=client("test-key",2).generate(request());
        assertThat(draft.days().get(0).date()).isEqualTo(LocalDate.parse("2026-12-01"));
        assertThat(received.get()).contains("test-model","json_object");
    }
    @Test void missingKeyDoesNotSendARequest() {
        assertThatThrownBy(() -> client("",1).generate(request())).isInstanceOfSatisfying(BusinessException.class,e -> assertThat(e.status).isEqualTo(503));
        assertThat(received.get()).isNull();
    }
    @Test void invalidJsonMapsToBadGateway() {
        reply.set(new Reply(200,"{\"choices\":[{\"message\":{\"content\":\"not-json\"}}]}",0));
        assertThatThrownBy(() -> client("test-key",1).generate(request())).isInstanceOfSatisfying(BusinessException.class,e -> assertThat(e.status).isEqualTo(502));
    }
    @Test void providerRateLimitDoesNotExposeProviderBody() {
        reply.set(new Reply(429,"{\"error\":\"sensitive-provider-detail\"}",0));
        assertThatThrownBy(() -> client("test-key",1).generate(request())).isInstanceOfSatisfying(BusinessException.class,e -> {
            assertThat(e.status).isEqualTo(429); assertThat(e.getMessage()).doesNotContain("sensitive-provider-detail","test-key");
        });
    }
    @Test void slowProviderMapsToGatewayTimeout() {
        reply.set(new Reply(200,"{}",2500));
        assertThatThrownBy(() -> client("test-key",1).generate(request())).isInstanceOfSatisfying(BusinessException.class,e -> assertThat(e.status).isEqualTo(504));
    }
    @Test void chatSendsRoleHistoryAndCurrentEditedPlan() throws Exception {
        String content="{\"reply\":\"保留原方案，这样安排可以少走路\",\"memory\":\"带老人，少走路\",\"plan\":null}";
        String envelope=new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(java.util.Map.of("choices",List.of(java.util.Map.of("message",java.util.Map.of("content",content)))));
        reply.set(new Reply(200,envelope,0));
        var context=new com.travel.dto.ChatRequests.Context(request(),null,"带老人","ASK",List.of(
            new com.travel.dto.ChatRequests.Message("user","想少走路"),
            new com.travel.dto.ChatRequests.Message("assistant","我会减少转场"),
            new com.travel.dto.ChatRequests.Message("user","为什么这样安排？")));
        var answer=client("test-key",2).reply(context);
        assertThat(answer.plan()).isNull();
        var sent=new com.fasterxml.jackson.databind.ObjectMapper().readTree(received.get());
        assertThat(sent.path("messages").size()).isEqualTo(4);
        assertThat(sent.path("messages").get(2).path("role").asText()).isEqualTo("assistant");
        assertThat(sent.path("messages").get(0).path("content").asText()).contains("带老人","ASK");
    }
    @Test void chatBlankContentIsReportedWithoutAutomaticRetry() {
        reply.set(new Reply(200,"{\"choices\":[{\"message\":{\"content\":\"   \"}}]}",0));
        var context=new com.travel.dto.ChatRequests.Context(request(),null,"","ASK",List.of(new com.travel.dto.ChatRequests.Message("user","解释一下")));
        assertThatThrownBy(()->client("test-key",2).reply(context)).isInstanceOfSatisfying(BusinessException.class,e->assertThat(e.status).isEqualTo(502));
    }
    @Test void fourDayRevisionHasEnoughOutputBudgetAndKeepsProviderReasoningDefault() throws Exception {
        String content="{\"reply\":\"合成验收回复\",\"memory\":\"\",\"plan\":null}";
        reply.set(new Reply(200,new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(java.util.Map.of("choices",List.of(java.util.Map.of("finish_reason","stop","message",java.util.Map.of("content",content))))),0));
        var conditions=new Generate(null,"北京",LocalDate.parse("2026-12-10"),LocalDate.parse("2026-12-13"),4,new BigDecimal("2000"),null,List.of(),null);
        client("test-key",2).reply(new com.travel.dto.ChatRequests.Context(conditions,null,"","REVISE",List.of(new com.travel.dto.ChatRequests.Message("user","增加具体餐饮地点"))));
        var sent=new com.fasterxml.jackson.databind.ObjectMapper().readTree(received.get());
        assertThat(sent.path("max_tokens").asInt()).isEqualTo(10848);
        assertThat(sent.has("reasoning_effort")).isFalse();
    }
}
