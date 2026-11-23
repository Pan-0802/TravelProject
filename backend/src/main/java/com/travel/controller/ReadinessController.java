package com.travel.controller;

import com.travel.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import javax.sql.DataSource;
import java.sql.SQLException;
import java.util.Map;

/** Database readiness is separate from process liveness at /health. */
@RestController
@RequiredArgsConstructor
public class ReadinessController {
    private final DataSource dataSource;

    @GetMapping("/health/ready")
    public ResponseEntity<ApiResponse<Map<String,String>>> ready() {
        try (var connection = dataSource.getConnection()) {
            // Also detects an absent schema/table rather than merely an open TCP port.
            try (var statement = connection.prepareStatement("SELECT user_id FROM `user` WHERE 1=0")) {
                statement.setQueryTimeout(2);
                try (var ignored = statement.executeQuery()) {
                    return ResponseEntity.ok(ApiResponse.ok(Map.of("status","UP","database","UP")));
                }
            }
        } catch (SQLException e) {
            return ResponseEntity.status(503).body(new ApiResponse<>(50300,"数据库尚未就绪，请检查连接配置和建表脚本",
                Map.of("status","DOWN","database","DOWN")));
        }
    }
}
