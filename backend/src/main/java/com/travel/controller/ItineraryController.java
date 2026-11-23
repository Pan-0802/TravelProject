package com.travel.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.travel.common.ApiResponse;
import com.travel.dto.Requests.*;
import com.travel.service.ItineraryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;

@RestController
@RequiredArgsConstructor
public class ItineraryController {
    private final ItineraryService itinerary;
    @GetMapping("/api/trips/{tripId}/days") public ApiResponse<?> days(@PathVariable Long tripId) { return ApiResponse.ok(itinerary.days(tripId)); }
    @PostMapping("/api/trips/{tripId}/days/{date}/items") @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
    public ApiResponse<?> create(@PathVariable Long tripId,@PathVariable LocalDate date,@Valid @RequestBody ItemWrite dto) { return ApiResponse.ok(itinerary.create(tripId,date,dto)); }
    @PatchMapping("/api/itinerary-items/{itemId}") public ApiResponse<?> patch(@PathVariable Long itemId,@RequestBody JsonNode dto) { return ApiResponse.ok(itinerary.patch(itemId,dto)); }
    @DeleteMapping("/api/itinerary-items/{itemId}") public ApiResponse<?> delete(@PathVariable Long itemId) { return ApiResponse.ok(itinerary.delete(itemId)); }
    @PutMapping("/api/trips/{tripId}/days/{date}/items/order") public ApiResponse<?> order(@PathVariable Long tripId,@PathVariable LocalDate date,@Valid @RequestBody ItemOrder dto) { return ApiResponse.ok(itinerary.order(tripId,date,dto.itemIds())); }
}
