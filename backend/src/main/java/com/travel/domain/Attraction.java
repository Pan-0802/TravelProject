package com.travel.domain;

import lombok.Data;
import java.math.BigDecimal;
import java.time.*;
import com.fasterxml.jackson.annotation.*;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;

@Data
public class Attraction {
    @JsonSerialize(using = ToStringSerializer.class)
    private Long attractionId;
    @JsonSerialize(using = ToStringSerializer.class)
    private Long createdBy;
    private String name;
    private String city;
    private String category;
    private String description;
    private Integer suggestedDurationMinutes;
    private BigDecimal referenceTicketPrice;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
