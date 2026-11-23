package com.travel.integration;

import com.fasterxml.jackson.databind.*;
import com.travel.common.BusinessException;
import com.travel.dto.AiRequests.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.*;
import java.util.*;

@Component
public class ChatCompletionAiClient implements AiClient {
    private final RestClient http;
    private final ObjectMapper json;
    private final String key,model;
    public ChatCompletionAiClient(ObjectMapper json,@Value("${app.external.ai-key}") String key,
        @Value("${app.external.ai-base-url}") String baseUrl,@Value("${app.external.ai-model}") String model,
        @Value("${app.external.timeout-seconds}") int timeout) {
        this.json=json; this.key=key; this.model=model;
        var factory=new SimpleClientHttpRequestFactory(); factory.setConnectTimeout(10000); factory.setReadTimeout(timeout*1000);
        http=RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();
    }
    @Override public Draft generate(Generate request) {
        if(key.isBlank()) throw new BusinessException(503,"AI 服务未配置 API Key");
        String prompt="""
            你是旅行规划助手。仅输出 JSON 对象：{"estimatedTotal":0,"days":[{"date":"yyyy-MM-dd","dayNumber":1,"description":null,"items":[{"itemName":"活动","startTime":"09:00","endTime":"10:00","sortOrder":1,"transportation":null,"estimatedCost":0,"note":null}]}]}。
            必须覆盖输入起止日期（含端点）的每一天；dayNumber 从1开始，sortOrder 每天从1连续递增。
            时间为HH:mm，费用为非负且最多两位小数。不得输出 attractionId 或其他字段。仅提供建议，不虚构实时票价、天气或开放情况。
            """;
        try {
            JsonNode result=http.post().uri("/chat/completions").header("Authorization","Bearer "+key)
                .body(Map.of("model",model,"stream",false,"response_format",Map.of("type","json_object"),
                    "messages",List.of(Map.of("role","system","content",prompt),Map.of("role","user","content",json.writeValueAsString(request)))))
                .retrieve().body(JsonNode.class);
            if(result==null) throw new BusinessException(502,"AI 返回空响应");
            String content=result.path("choices").path(0).path("message").path("content").asText();
            return json.readValue(content,Draft.class);
        } catch (RestClientResponseException e) {
            throw new BusinessException(e.getStatusCode().value()==429?429:502,"AI 外部服务请求失败，请稍后重试");
        } catch (ResourceAccessException e) { throw new BusinessException(504,"AI 外部服务连接失败或超时"); }
        catch (BusinessException e) { throw e; }
        catch (Exception e) {
            if (ExternalErrors.isTimeout(e)) throw new BusinessException(504,"AI 外部服务连接失败或超时");
            throw new BusinessException(502,"AI 响应结构不可解析");
        }
    }
}
