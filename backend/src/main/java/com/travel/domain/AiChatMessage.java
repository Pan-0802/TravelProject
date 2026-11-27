package com.travel.domain;
import lombok.Data;
import java.time.LocalDateTime;

@Data
public class AiChatMessage {
    private Long messageId;
    private Long conversationId;
    private String requestId;
    private String role;
    private String content;
    private String status;
    private String errorMessage;
    private Long planId;
    private LocalDateTime createdAt;
}
