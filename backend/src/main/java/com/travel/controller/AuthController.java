package com.travel.controller;

import com.travel.common.ApiResponse;
import com.travel.dto.Requests.*;
import com.travel.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class AuthController {
    private final AuthService auth;
    @PostMapping("/api/auth/register") @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
    public ApiResponse<?> register(@Valid @RequestBody Register dto) { return ApiResponse.ok(auth.register(dto)); }
    @PostMapping("/api/auth/login") public ApiResponse<?> login(@Valid @RequestBody Login dto) { return ApiResponse.ok(auth.login(dto)); }
    @PostMapping("/api/auth/logout") public ApiResponse<?> logout() { return ApiResponse.ok(Map.of("loggedOut",true)); }
    @GetMapping("/api/users/me") public ApiResponse<?> me() { return ApiResponse.ok(auth.me()); }
    @PatchMapping("/api/users/me") public ApiResponse<?> nickname(@Valid @RequestBody Nickname dto) { return ApiResponse.ok(auth.nickname(dto)); }
    @PatchMapping("/api/users/me/password") public ApiResponse<?> password(@Valid @RequestBody Password dto) { return ApiResponse.ok(auth.password(dto)); }
    @GetMapping("/health") public ApiResponse<?> health() { return ApiResponse.ok(Map.of("status","UP")); }
}
