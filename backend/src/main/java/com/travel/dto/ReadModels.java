package com.travel.dto;

import com.travel.domain.Attraction;
import com.travel.domain.Trip;
import lombok.Getter;
import lombok.Setter;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** Internal SQL projections. Services shape these into the existing API contract. */
public final class ReadModels {
    private ReadModels() {}
    public record TripFilter(Long userId, String keyword, String status, LocalDate today) {}
    public record AttractionFilter(Long userId, String keyword, String city, boolean mineOnly, boolean favoritesOnly) {}
    public record ExpenseFilter(Long tripId, String category, LocalDate startDate, LocalDate endDate) {}

    @Getter @Setter
    public static class TripRow extends Trip {
        private BigDecimal actualExpense;
    }
    @Getter @Setter
    public static class AttractionRow extends Attraction {
        private boolean favorited;
        private Long favoriteId;
        private LocalDateTime favoriteCreatedAt;
    }
    @Getter @Setter
    public static class CategoryTotal {
        private String category;
        private BigDecimal amount;
    }
    @Getter @Setter
    public static class Overview {
        private long totalTrips;
        private long totalTravelDays;
        private BigDecimal totalActualExpense;
        private BigDecimal totalBudget;
        private long ongoingTrips;
        private long finishedTrips;
        private long upcomingTrips;
    }
}
