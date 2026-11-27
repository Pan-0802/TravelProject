package com.travel.domain;
import lombok.Data;
import java.time.LocalDateTime;

@Data
public class AiConversation {
    private Long conversationId;
    private Long userId;
    private String title;
    private String conditionsJson;
    private Long currentPlanId;
    private String currentDaysJson;
    private String memory;
    private long version;
    private String activeRequestId;
    private LocalDateTime startedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
