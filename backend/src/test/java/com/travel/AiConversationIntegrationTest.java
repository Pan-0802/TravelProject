package com.travel;

import com.fasterxml.jackson.databind.*;
import com.travel.common.BusinessException;
import com.travel.dto.AiRequests.*;
import com.travel.dto.ChatRequests.*;
import com.travel.dto.Requests.ItemWrite;
import com.travel.integration.AiChatClient;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AiConversationIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean AiChatClient client;
    String token,other,id;
    @BeforeEach void setup() throws Exception {
        token=account();other=account();
        id=call("POST","/api/ai/conversations",token,Map.of("conditions",conditions()),200).path("data").path("conversationId").asText();
    }
    @AfterEach void cleanup() {jdbc.update("DELETE FROM `user` WHERE username LIKE 'chat_test_%'");}
    Map<String,Object> conditions() {return Map.of("destination","北京","startDate","2026-12-01","endDate","2026-12-01","travelDays",1,"totalBudget",500,"requirements","带老人，少走路");}
    String account() throws Exception {
        String name="chat_test_"+UUID.randomUUID().toString().replace("-","").substring(0,12);
        call("POST","/api/auth/register",null,Map.of("username",name,"password","ChatTest@123","confirmPassword","ChatTest@123"),201);
        return call("POST","/api/auth/login",null,Map.of("username",name,"password","ChatTest@123"),200).path("data").path("accessToken").asText();
    }
    JsonNode call(String method,String path,String auth,Object body,int expected) throws Exception {
        var builder=switch(method) {case "POST"->post(path);case "PUT"->put(path);case "DELETE"->delete(path);default->get(path);};
        if(auth!=null) builder.header("Authorization","Bearer "+auth);
        if(body!=null) builder.contentType("application/json").content(json.writeValueAsString(body));
        return json.readTree(mvc.perform(builder).andExpect(status().is(expected)).andReturn().getResponse().getContentAsString());
    }
    Draft draft(String name) {
        ItemWrite item=new ItemWrite();item.setItemName(name);item.setSortOrder(1);item.setEstimatedCost(BigDecimal.TEN);
        return new Draft(BigDecimal.TEN,List.of(new Day(LocalDate.parse("2026-12-01"),1,null,List.of(item))));
    }
    Map<String,Object> message(String key,long version,String text,String intent) {return Map.of("requestId",key,"expectedVersion",version,"content",text,"intent",intent);}
    JsonNode send(String key,long version,String text,String intent,int expected) throws Exception {return call("POST","/api/ai/conversations/"+id+"/messages",token,message(key,version,text,intent),expected).path("data");}
    @Test void acceptedMessageReturnsBeforeModelAndCanBeRestoredByPolling() throws Exception {
        CountDownLatch entered=new CountDownLatch(1),release=new CountDownLatch(1);
        when(client.reply(any())).thenAnswer(inv -> {
            entered.countDown();
            if(!release.await(5,TimeUnit.SECONDS)) throw new IllegalStateException("test release timed out");
            return new Reply("后台完成","少走路",draft("故宫博物院"));
        });
        String path="/api/ai/conversations/"+id;
        try {
            long start=System.nanoTime();
            var receipt=call("POST",path+"/messages/submit",token,message("background-request",0,"生成方案","REVISE"),202).path("data");
            assertThat(TimeUnit.NANOSECONDS.toMillis(System.nanoTime()-start)).isLessThan(2500);
            assertThat(receipt.path("processing").asBoolean()).isTrue();
            assertThat(entered.await(2,TimeUnit.SECONDS)).isTrue();
            call("POST",path+"/messages/submit",other,message("other-owner",0,"生成方案","REVISE"),404);
            call("POST",path+"/messages/submit",token,message("background-request",0,"生成方案","REVISE"),409);
        } finally { release.countDown(); }
        JsonNode restored=null;
        for(int i=0;i<100;i++) {
            restored=call("GET",path,token,null,200).path("data");
            if(!restored.path("processing").asBoolean())break;
            Thread.sleep(25);
        }
        assertThat(restored.path("processing").asBoolean()).isFalse();
        assertThat(restored.path("currentPlan").path("status").asText()).isEqualTo("DRAFT");
        assertThat(restored.path("messages").size()).isEqualTo(2);
        call("POST",path+"/messages/submit",token,message("background-request",0,"生成方案","REVISE"),202);
        verify(client,times(1)).reply(any());
    }
    @Test void answersKeepPlanAndSubsequentTurnsReceiveHistoryAndMemory() throws Exception {
        when(client.reply(any())).thenReturn(new Reply("安排好了","带老人，少走路",draft("故宫博物院")));
        var first=send("first-request",0,"生成方案","REVISE",200);
        String planId=first.path("currentPlan").path("aiPlanId").asText();
        AtomicReference<Context> captured=new AtomicReference<>();
        when(client.reply(any())).thenAnswer(inv->{captured.set(inv.getArgument(0));return new Reply("因为景点相邻，便于休息","带老人，少走路",null);});
        var second=send("second-request",first.path("version").asLong(),"为什么这样安排？","ASK",200);
        assertThat(second.path("currentPlan").path("aiPlanId").asText()).isEqualTo(planId);
        assertThat(second.path("messages").size()).isEqualTo(4);
        assertThat(captured.get().messages()).extracting(Message::role).containsExactly("user","assistant","user");
        assertThat(captured.get().memory()).contains("老人");
        var restored=call("GET","/api/ai/conversations/"+id,token,null,200).path("data");
        assertThat(restored.path("messages")).isEqualTo(second.path("messages"));
    }
    @Test void repeatedCompletedRequestIsIdempotentAndStaleVersionCannotBillAgain() throws Exception {
        when(client.reply(any())).thenReturn(new Reply("回复","记住偏好",null));
        send("stable-request",0,"帮我解释","ASK",200);
        send("stable-request",0,"帮我解释","ASK",200);
        send("another-request",0,"下一问","ASK",409);
        send("stable-request",0,"不同内容","ASK",409);
        verify(client,times(1)).reply(any());
    }
    @Test void failuresArePersistedAndExplicitRetryKeepsPreviousPlan() throws Exception {
        when(client.reply(any())).thenThrow(new BusinessException(503,"AI 暂不可用"));
        send("failed-request",0,"生成方案","REVISE",503);
        var detail=call("GET","/api/ai/conversations/"+id,token,null,200).path("data");
        assertThat(detail.path("processing").asBoolean()).isFalse();assertThat(detail.path("messages").get(0).path("status").asText()).isEqualTo("FAILED");
        doReturn(new Reply("重试成功","少走路",draft("故宫博物院"))).when(client).reply(any());
        var result=send("retry-request",detail.path("version").asLong(),"生成方案","REVISE",200);
        assertThat(result.path("currentPlan").path("status").asText()).isEqualTo("DRAFT");assertThat(result.path("messages").size()).isEqualTo(3);
    }
    @Test void askingNeverMutatesPlanEvenIfProviderIgnoresIntent() throws Exception {
        when(client.reply(any())).thenReturn(new Reply("改了","",draft("故宫博物院")));
        send("question-request",0,"为什么安排故宫","ASK",502);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM ai_plan_record",Long.class)).isZero();
    }
    @Test void foreignSessionsAndPlansAreNotAccessible() throws Exception {
        String path="/api/ai/conversations/"+id;
        call("GET",path,other,null,404);call("DELETE",path,other,null,404);
        call("POST",path+"/messages",other,message("foreign-request",0,"读取历史","ASK"),404);
        assertThat(call("GET","/api/ai/conversations",other,null,200).path("data").path("list").size()).isZero();
        call("POST",path+"/messages",null,message("no-auth-request",0,"读取历史","ASK"),401);
        verifyNoInteractions(client);
    }
    @Test void invalidDraftDoesNotPersistAnAiPlan() throws Exception {
        Draft wrong=new Draft(BigDecimal.ZERO,List.of(new Day(LocalDate.parse("2026-12-02"),1,null,List.of())));
        when(client.reply(any())).thenReturn(new Reply("新方案","",wrong));
        send("invalid-request",0,"生成方案","REVISE",502);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM ai_plan_record",Long.class)).isZero();
    }
    @Test void editsPersistAndAreFedIntoNextAnswer() throws Exception {
        when(client.reply(any())).thenReturn(new Reply("方案","",draft("故宫博物院")));
        var initial=send("draft-request",0,"生成方案","REVISE",200);
        var edited=call("PUT","/api/ai/conversations/"+id+"/draft",token,Map.of("expectedVersion",initial.path("version").asLong(),"days",draft("用户修改后的活动").days()),200).path("data");
        when(client.reply(any())).thenAnswer(inv->{Context c=inv.getArgument(0);assertThat(c.currentPlan().days().get(0).items().get(0).getItemName()).isEqualTo("用户修改后的活动");return new Reply("参考了你的编辑","",null);});
        var result=send("edited-question",edited.path("version").asLong(),"如何少走路","ASK",200);
        assertThat(result.path("currentDays").get(0).path("items").get(0).path("itemName").asText()).isEqualTo("用户修改后的活动");
    }
    @Test void onlyOneConcurrentRequestCanCallTheModel() throws Exception {
        CountDownLatch entered=new CountDownLatch(1),release=new CountDownLatch(1);
        when(client.reply(any())).thenAnswer(inv->{entered.countDown();if(!release.await(10,TimeUnit.SECONDS))throw new IllegalStateException("test wait timed out");return new Reply("已回复","",null);});
        ExecutorService pool=Executors.newSingleThreadExecutor();
        try {
            Future<JsonNode> first=pool.submit(()->send("concurrent-first",0,"第一问","ASK",200));
            assertThat(entered.await(5,TimeUnit.SECONDS)).isTrue();
            send("concurrent-second",0,"另一窗口提问","ASK",409);
            call("DELETE","/api/ai/conversations/"+id,token,null,409);
            release.countDown();assertThat(first.get(10,TimeUnit.SECONDS).path("processing").asBoolean()).isFalse();
            verify(client,times(1)).reply(any());
        } finally {release.countDown();pool.shutdownNow();}
    }
    @Test void contextIsBoundedButDurableTranscriptIsRetained() throws Exception {
        when(client.reply(any())).thenAnswer(inv->{Context c=inv.getArgument(0);assertThat(c.messages().size()).isLessThanOrEqualTo(25);return new Reply("回复","长期偏好：带老人，少走路",null);});
        long version=0;
        for(int i=0;i<15;i++) version=send("history-request-"+i,version,"第"+i+"轮","ASK",200).path("version").asLong();
        var detail=call("GET","/api/ai/conversations/"+id,token,null,200).path("data");
        assertThat(detail.path("messages").size()).isEqualTo(30);assertThat(detail.path("memory").asText()).contains("老人");
    }
    @Test void stalePendingRequestRecoversWithoutCallingModelAgain() throws Exception {
        jdbc.update("INSERT INTO ai_chat_message(conversation_id,request_id,role,content,status) VALUES(?,?,'user','未完成的问题','PENDING')",Long.valueOf(id),"lost-request");
        jdbc.update("UPDATE ai_conversation SET active_request_id='lost-request',started_at=?,version=1 WHERE conversation_id=?",java.time.LocalDateTime.now().minusMinutes(5),Long.valueOf(id));
        var detail=call("GET","/api/ai/conversations/"+id,token,null,200).path("data");
        assertThat(detail.path("processing").asBoolean()).isFalse();assertThat(detail.path("messages").get(0).path("status").asText()).isEqualTo("FAILED");
        verifyNoInteractions(client);
    }
    @Test void deletingChatKeepsGeneratedPlanAndBlocksForeignPlanImport() throws Exception {
        when(client.reply(any())).thenReturn(new Reply("方案","",draft("故宫博物院")));
        var result=send("kept-plan-request",0,"生成方案","REVISE",200);
        String plan=result.path("currentPlan").path("aiPlanId").asText();
        call("POST","/api/ai/conversations",other,Map.of("aiPlanId",plan),404);
        call("DELETE","/api/ai/conversations/"+id,token,null,200);
        call("GET","/api/ai/conversations/"+id,token,null,404);
        call("GET","/api/ai/plans/"+plan,token,null,200);
    }
}
