package com.travel.dto;

import com.travel.dto.AiRequests.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;

public final class ChatRequests {
    private ChatRequests() {}
    public record Create(@Valid Generate conditions, @Min(1) Long aiPlanId,
        @Size(min=1,max=15) List<@NotNull @Valid Day> currentDays) {}
    public record Edit(@NotNull @Min(0) Long expectedVersion,
        @NotNull @Size(min=1,max=15) List<@NotNull @Valid Day> days) {}
    public record Send(
        @NotBlank @Pattern(regexp="[A-Za-z0-9_-]{8,64}") String requestId,
        @NotNull @Min(0) Long expectedVersion,
        @NotBlank @Size(max=2000) String content,
        @NotBlank @Pattern(regexp="AUTO|ASK|REVISE") String intent,
        @Size(min=1,max=15) List<@NotNull @Valid Day> currentDays) {}
    public record Message(String role, String content) {}
    public record Context(Generate conditions, Draft currentPlan, String memory, String intent, List<Message> messages) {}
    public record Reply(@NotBlank @Size(max=4000) String reply,
        @NotNull @Size(max=2000) String memory, @Valid Draft plan) {}
}
