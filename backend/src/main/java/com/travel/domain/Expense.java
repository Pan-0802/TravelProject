package com.travel.domain;

import lombok.Data;
import java.math.BigDecimal;
import java.time.*;
import com.fasterxml.jackson.annotation.*;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;

@Data
public class Expense {
    @JsonSerialize(using = ToStringSerializer.class)
    private Long expenseId;
    @JsonSerialize(using = ToStringSerializer.class)
    private Long tripId;
    private String category;
    private BigDecimal amount;
    private LocalDate spentOn;
    private String description;
    private LocalDateTime createdAt;
}
