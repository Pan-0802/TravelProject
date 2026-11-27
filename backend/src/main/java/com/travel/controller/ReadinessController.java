package com.travel.controller;

import com.travel.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.travel.mapper.SchemaProbe;
import org.springframework.dao.DataAccessException;
import java.util.Map;

/** Database readiness is separate from process liveness at /health. */
@RestController
@RequiredArgsConstructor
public class ReadinessController {
    private final SchemaProbe schema;

    @GetMapping("/health/ready")
    public ResponseEntity<ApiResponse<Map<String,String>>> ready() {
        try {
            schema.requireUsers();
            return ResponseEntity.ok(ApiResponse.ok(Map.of("status","UP","database","UP")));
        } catch (DataAccessException e) {
            return ResponseEntity.status(503).body(new ApiResponse<>(50300,"数据库尚未就绪，请检查连接配置和建表脚本",
                Map.of("status","DOWN","database","DOWN")));
        }
    }
}
