package com.travel.domain;

import lombok.Data;
import java.math.BigDecimal;
import java.time.*;
import com.fasterxml.jackson.annotation.*;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;

@Data
public class Favorite {
    @JsonSerialize(using = ToStringSerializer.class)
    private Long favoriteId;
    @JsonSerialize(using = ToStringSerializer.class)
    private Long userId;
    @JsonSerialize(using = ToStringSerializer.class)
    private Long attractionId;
    private LocalDateTime createdAt;
}
