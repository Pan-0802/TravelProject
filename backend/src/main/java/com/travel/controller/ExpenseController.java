package com.travel.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.travel.common.ApiResponse;
import com.travel.dto.Requests.*;
import com.travel.service.ExpenseService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;

@RestController
@RequiredArgsConstructor
public class ExpenseController {
    private final ExpenseService expenses;
    @GetMapping("/api/trips/{tripId}/expenses") public ApiResponse<?> list(@PathVariable Long tripId,
        @RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="10") int size,@RequestParam(required=false) Category category,
        @RequestParam(required=false) LocalDate startDate,@RequestParam(required=false) LocalDate endDate) { return ApiResponse.ok(expenses.list(tripId,page,size,category,startDate,endDate)); }
    @PostMapping("/api/trips/{tripId}/expenses") @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
    public ApiResponse<?> create(@PathVariable Long tripId,@Valid @RequestBody ExpenseWrite dto) { return ApiResponse.ok(expenses.create(tripId,dto)); }
    @PatchMapping("/api/expenses/{expenseId}") public ApiResponse<?> patch(@PathVariable Long expenseId,@RequestBody JsonNode dto) { return ApiResponse.ok(expenses.patch(expenseId,dto)); }
    @DeleteMapping("/api/expenses/{expenseId}") public ApiResponse<?> delete(@PathVariable Long expenseId) { return ApiResponse.ok(expenses.delete(expenseId)); }
    @GetMapping("/api/trips/{tripId}/budget-summary") public ApiResponse<?> summary(@PathVariable Long tripId) { return ApiResponse.ok(expenses.summary(tripId)); }
}
