package com.travel.mapper;

import com.travel.domain.*;
import com.travel.dto.ReadModels.*;
import org.apache.ibatis.annotations.Param;
import java.time.LocalDate;
import java.util.List;

public interface ReadMapper {
    long countTrips(@Param("filter") TripFilter filter);
    List<TripRow> trips(@Param("filter") TripFilter filter, @Param("offset") long offset, @Param("size") int size);
    long countAttractions(@Param("filter") AttractionFilter filter);
    List<AttractionRow> attractions(@Param("filter") AttractionFilter filter, @Param("offset") long offset, @Param("size") int size);
    long countExpenses(@Param("filter") ExpenseFilter filter);
    List<Expense> expenses(@Param("filter") ExpenseFilter filter, @Param("offset") long offset, @Param("size") int size);
    long countPlans(@Param("userId") Long userId, @Param("status") String status);
    List<AiPlanRecord> plans(@Param("userId") Long userId, @Param("status") String status, @Param("offset") long offset, @Param("size") int size);
    Overview overview(@Param("userId") Long userId, @Param("today") LocalDate today);
    List<CategoryTotal> categories(@Param("userId") Long userId, @Param("tripId") Long tripId);
    List<ItineraryItem> tripItems(@Param("tripId") Long tripId);
}
