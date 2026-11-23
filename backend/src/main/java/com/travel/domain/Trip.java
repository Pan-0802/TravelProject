package com.travel.domain;

import lombok.Data;
import java.math.BigDecimal;
import java.time.*;
import com.fasterxml.jackson.annotation.*;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;

@Data
public class Trip {
    @JsonSerialize(using = ToStringSerializer.class)
    private Long tripId;
    @JsonSerialize(using = ToStringSerializer.class)
    private Long userId;
    private String title;
    private String destination;
    private LocalDate startDate;
    private LocalDate endDate;
    private BigDecimal totalBudget;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
