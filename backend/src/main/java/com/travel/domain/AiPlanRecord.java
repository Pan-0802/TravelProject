package com.travel.domain;

import lombok.Data;
import java.math.BigDecimal;
import java.time.*;
import com.fasterxml.jackson.annotation.*;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;

@Data
public class AiPlanRecord {
    @JsonSerialize(using = ToStringSerializer.class)
    private Long aiPlanId;
    @JsonSerialize(using = ToStringSerializer.class)
    private Long userId;
    @JsonSerialize(using = ToStringSerializer.class)
    private Long tripId;
    private String requestJson;
    private String responseJson;
    private BigDecimal estimatedTotal;
    private String status;
    private String errorMessage;
    private LocalDateTime createdAt;
    private LocalDateTime savedAt;
}
