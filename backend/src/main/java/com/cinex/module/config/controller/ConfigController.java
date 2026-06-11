package com.cinex.module.config.controller;

import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.common.response.ApiResponse;
import com.cinex.module.config.entity.SystemConfig;
import com.cinex.module.config.service.SystemConfigService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * [Facade Pattern] Controller chỉ nhận request, gọi Service, trả ApiResponse.
 *
 * <p><b>SOLID/D — Dependency Inversion:</b> Controller chỉ depend vào abstraction (Service),
 * KHÔNG inject Repository trực tiếp. Tất cả business logic (validate key, update + refresh
 * cache, list) nằm trong {@link SystemConfigService}.
 */
@RestController
@RequestMapping("/api/configs")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Config", description = "System configuration management")
public class ConfigController {

    private final SystemConfigService systemConfigService;

    @GetMapping
    @Operation(summary = "(Admin) List all configs")
    public ApiResponse<List<SystemConfig>> listConfigs() {
        return ApiResponse.ok(systemConfigService.listAll());
    }

    @GetMapping("/public/{key}")
    @PreAuthorize("permitAll()")
    @Operation(summary = "Get a single config value (public, no auth required)")
    public ApiResponse<String> getPublicConfig(@PathVariable String key) {
        return ApiResponse.ok(systemConfigService.getString(key, ""));
    }

    @PutMapping("/{key}")
    @Operation(summary = "(Admin) Update a config value")
    public ApiResponse<SystemConfig> updateConfig(
            @PathVariable String key,
            @RequestBody Map<String, String> body) {

        String newValue = body.get("value");
        if (newValue == null) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST, "Missing 'value' field");
        }

        SystemConfig updated = systemConfigService.updateConfig(key, newValue);
        return ApiResponse.ok("Config updated", updated);
    }
}
