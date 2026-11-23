package com.travel.dto;

import com.travel.dto.Requests.ItemWrite;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public final class AiRequests {
    private AiRequests() {}
    public record Generate(@Min(1) Long tripId,@NotBlank @Size(max=120) String destination,
        @NotNull LocalDate startDate,@NotNull LocalDate endDate,@Min(1) @Max(15) int travelDays,
        @NotNull @DecimalMin("0") @Digits(integer=10,fraction=2) BigDecimal totalBudget,
        @Size(max=60) String transportation,@Size(max=10) List<@NotBlank @Size(max=60) String> preferences,
        @Size(max=500) String requirements) {}
    public record Day(@NotNull LocalDate date,@Min(1) int dayNumber,@Size(max=255) String description,
        @NotNull @Size(max=50) List<@NotNull @Valid ItemWrite> items) {}
    public record Draft(@NotNull @DecimalMin("0") @Digits(integer=10,fraction=2) BigDecimal estimatedTotal,
        @NotNull @Size(min=1,max=15) List<@NotNull @Valid Day> days) {}
    public record Save(@NotNull @Min(1) Long tripId,boolean confirmOverwrite,
        @NotNull @Size(min=1,max=15) List<@NotNull @Valid Day> days) {}
}
