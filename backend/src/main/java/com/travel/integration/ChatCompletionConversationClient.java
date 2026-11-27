package com.travel.integration;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.travel.dto.ChatRequests.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Separate provider boundary so single-shot planning and chat can be replaced independently. */
@Component
public class ChatCompletionConversationClient implements AiChatClient {
    private final ChatCompletionAiClient transport;
    public ChatCompletionConversationClient(ObjectMapper json,@Value("${app.external.ai-key}") String key,
        @Value("${app.external.ai-base-url}") String base,@Value("${app.external.ai-model}") String model,
        @Value("${app.external.timeout-seconds}") int timeout,@Value("${app.external.ai-max-output-tokens:16384}") int maxOutputTokens) {
        transport=new ChatCompletionAiClient(json,key,base,model,timeout,maxOutputTokens);
    }
    @Override public Reply reply(Context context) {return transport.reply(context);}
}
