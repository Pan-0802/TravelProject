package com.travel.controller;

import com.travel.common.ApiResponse;
import com.travel.service.StatisticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/statistics")
@RequiredArgsConstructor
public class StatisticsController {
    private final StatisticsService statistics;
    @GetMapping("/overview") public ApiResponse<?> overview() { return ApiResponse.ok(statistics.overview()); }
    @GetMapping("/expense-categories") public ApiResponse<?> categories(@RequestParam(required=false) Long tripId) { return ApiResponse.ok(statistics.categories(tripId)); }
    @GetMapping("/trip-costs") public ApiResponse<?> costs(@RequestParam(defaultValue="10") int limit) { return ApiResponse.ok(statistics.comparison(limit,false)); }
    @GetMapping("/budget-comparison") public ApiResponse<?> comparison(@RequestParam(defaultValue="10") int limit) { return ApiResponse.ok(statistics.comparison(limit,true)); }
}
