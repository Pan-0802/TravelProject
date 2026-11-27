package com.travel.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.travel.common.ApiResponse;
import com.travel.dto.Requests.*;
import com.travel.service.AttractionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class AttractionController {
    private final AttractionService attractions;
    @GetMapping("/api/attractions") public ApiResponse<?> list(@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="20") int size,
        @RequestParam(required=false) String keyword,@RequestParam(required=false) String city,@RequestParam(defaultValue="false") boolean mineOnly) {
        return ApiResponse.ok(attractions.list(page,size,keyword,city,mineOnly));
    }
    @PostMapping("/api/attractions") @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
    public ApiResponse<?> create(@Valid @RequestBody AttractionWrite dto) { return ApiResponse.ok(attractions.create(dto)); }
    @GetMapping("/api/attractions/{attractionId}") public ApiResponse<?> detail(@PathVariable Long attractionId) { return ApiResponse.ok(attractions.view(attractions.find(attractionId,false))); }
    @PatchMapping("/api/attractions/{attractionId}") public ApiResponse<?> patch(@PathVariable Long attractionId,@RequestBody JsonNode dto) { return ApiResponse.ok(attractions.patch(attractionId,dto)); }
    @DeleteMapping("/api/attractions/{attractionId}") public ApiResponse<?> delete(@PathVariable Long attractionId) { return ApiResponse.ok(attractions.delete(attractionId)); }
    @GetMapping("/api/favorites") public ApiResponse<?> favorites(@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="20") int size,
        @RequestParam(required=false) String keyword,@RequestParam(required=false) String city) { return ApiResponse.ok(attractions.favorites(page,size,keyword,city)); }
    @PostMapping("/api/favorites") @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
    public ApiResponse<?> favorite(@Valid @RequestBody FavoriteWrite dto) { return ApiResponse.ok(attractions.favorite(dto.attractionId())); }
    @DeleteMapping("/api/favorites/{attractionId}") public ApiResponse<?> unfavorite(@PathVariable Long attractionId) { return ApiResponse.ok(attractions.unfavorite(attractionId)); }
}
