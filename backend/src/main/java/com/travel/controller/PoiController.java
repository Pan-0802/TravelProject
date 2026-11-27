package com.travel.controller;

import com.travel.common.ApiResponse;
import com.travel.integration.PoiClient;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class PoiController {
    private final PoiClient pois;
    @GetMapping("/api/pois/search") public ApiResponse<?> search(@RequestParam String keywords,@RequestParam String region,
        @RequestParam(defaultValue="true") boolean cityLimit,@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="20") int size) {
        return ApiResponse.ok(pois.search(keywords,region,cityLimit,page,size));
    }
}
