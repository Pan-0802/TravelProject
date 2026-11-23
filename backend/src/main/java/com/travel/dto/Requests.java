package com.travel.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.*;
import lombok.Data;

/** Write DTOs deliberately exclude userId, ownership and computed fields. */
public final class Requests {
    private Requests() {}
    public record Register(@NotBlank @Size(max=50) String username,
        @NotBlank @Size(min=8,max=72) String password, @NotBlank String confirmPassword,
        @Size(max=60) String nickname) {}
    public record Login(@NotBlank @Size(max=50) String username, @NotBlank @Size(max=72) String password) {}
    public record Nickname(@Size(max=60) String nickname) {}
    public record Password(@NotBlank String oldPassword, @NotBlank @Size(min=8,max=72) String newPassword,
        @NotBlank String confirmPassword) {}
    @Data public static class TripWrite {
        @NotBlank @Size(max=120) private String title;
        @NotBlank @Size(max=120) private String destination;
        @NotNull private LocalDate startDate;
        @NotNull private LocalDate endDate;
        @NotNull @DecimalMin("0") @Digits(integer=10,fraction=2) private BigDecimal totalBudget;
    }
    @Data public static class AttractionWrite {
        @NotBlank @Size(max=120) private String name;
        @NotBlank @Size(max=80) private String city;
        @Size(max=40) private String category;
        @Size(max=16000) private String description;
        @Min(1) @Max(65535) private Integer suggestedDurationMinutes;
        @DecimalMin("0") @Digits(integer=8,fraction=2) private BigDecimal referenceTicketPrice;
    }
    @Data public static class ItemWrite {
        @Min(1) private Long attractionId;
        @NotBlank @Size(max=150) private String itemName;
        @com.fasterxml.jackson.annotation.JsonFormat(pattern="HH:mm") private LocalTime startTime;
        @com.fasterxml.jackson.annotation.JsonFormat(pattern="HH:mm") private LocalTime endTime;
        @NotNull @Min(1) private Integer sortOrder = 1;
        @Size(max=60) private String transportation;
        @NotNull @DecimalMin("0") @Digits(integer=8,fraction=2) private BigDecimal estimatedCost = BigDecimal.ZERO;
        @Size(max=500) private String note;
    }
    @Data public static class ExpenseWrite {
        @NotNull private Category category;
        @NotNull @DecimalMin(value="0",inclusive=false) @Digits(integer=10,fraction=2) private BigDecimal amount;
        @NotNull private LocalDate spentOn;
        @Size(max=300) private String description;
    }
    public enum Category { FOOD, TRANSPORT, HOTEL, TICKET, SHOPPING, OTHER }
    public record FavoriteWrite(@NotNull @Min(1) Long attractionId) {}
    public record ItemOrder(@NotNull java.util.List<@NotNull @Min(1) Long> itemIds) {}
}
