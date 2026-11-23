package com.travel.domain;

import lombok.Data;
import java.math.BigDecimal;
import java.time.*;
import com.fasterxml.jackson.annotation.*;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;

@Data
public class User {
    @JsonSerialize(using = ToStringSerializer.class)
    private Long userId;
    private String username;
    @JsonIgnore
    private String passwordHash;
    private String nickname;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
