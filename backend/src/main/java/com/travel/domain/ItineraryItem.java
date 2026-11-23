package com.travel.domain;

import lombok.Data;
import java.math.BigDecimal;
import java.time.*;
import com.fasterxml.jackson.annotation.*;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;

@Data
public class ItineraryItem {
    @JsonSerialize(using = ToStringSerializer.class)
    private Long itemId;
    @JsonSerialize(using = ToStringSerializer.class)
    private Long dayId;
    @JsonSerialize(using = ToStringSerializer.class)
    private Long attractionId;
    private String itemName;
    @JsonFormat(pattern = "HH:mm")
    private LocalTime startTime;
    @JsonFormat(pattern = "HH:mm")
    private LocalTime endTime;
    private Integer sortOrder;
    private String transportation;
    private BigDecimal estimatedCost;
    private String sourceType;
    private String note;
}
