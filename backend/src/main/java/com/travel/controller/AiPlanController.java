package com.travel.controller;

import com.travel.common.ApiResponse;
import com.travel.dto.AiRequests.*;
import com.travel.service.AiPlanService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ai/plans")
@RequiredArgsConstructor
public class AiPlanController {
    private final AiPlanService plans;
    @PostMapping public ApiResponse<?> generate(@Valid @RequestBody Generate dto) { return ApiResponse.ok(plans.generate(dto)); }
    @GetMapping public ApiResponse<?> list(@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="20") int size,@RequestParam(required=false) String status) { return ApiResponse.ok(plans.list(page,size,status)); }
    @GetMapping("/{aiPlanId}") public ApiResponse<?> detail(@PathVariable Long aiPlanId) { return ApiResponse.ok(plans.detail(aiPlanId)); }
    @PostMapping("/{aiPlanId}/save") public ApiResponse<?> save(@PathVariable Long aiPlanId,@Valid @RequestBody Save dto) { return ApiResponse.ok(plans.save(aiPlanId,dto)); }
}
