package com.travel.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.travel.common.ApiResponse;
import com.travel.dto.Requests.TripWrite;
import com.travel.service.TripService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/trips")
@RequiredArgsConstructor
public class TripController {
    private final TripService trips;
    @GetMapping public ApiResponse<?> list(@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="10") int size,
        @RequestParam(required=false) String keyword,@RequestParam(required=false) String status) { return ApiResponse.ok(trips.list(page,size,keyword,status)); }
    @PostMapping @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
    public ApiResponse<?> create(@Valid @RequestBody TripWrite dto) { return ApiResponse.ok(trips.create(dto)); }
    @GetMapping("/{tripId}") public ApiResponse<?> detail(@PathVariable Long tripId) { return ApiResponse.ok(trips.view(trips.owned(tripId,false))); }
    @PatchMapping("/{tripId}") public ApiResponse<?> patch(@PathVariable Long tripId,@RequestBody JsonNode dto) { return ApiResponse.ok(trips.patch(tripId,dto)); }
    @DeleteMapping("/{tripId}") public ApiResponse<?> delete(@PathVariable Long tripId) { return ApiResponse.ok(trips.delete(tripId)); }
}
