package com.cinex.module.config.controller;

import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.common.response.ApiResponse;
import com.cinex.module.config.entity.SystemConfig;
import com.cinex.module.config.repository.SystemConfigRepository;
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
 * Logic cập nhật cache nằm trong SystemConfigService (Cache-aside Pattern).
 */
@RestController
@RequestMapping("/api/configs")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Config", description = "System configuration management")
public class ConfigController {

    private final SystemConfigRepository configRepository;
    private final SystemConfigService systemConfigService;

    @GetMapping
    @Operation(summary = "(Admin) List all configs")
    public ApiResponse<List<SystemConfig>> listConfigs() {
        return ApiResponse.ok(configRepository.findAll());
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

        // Validate key tồn tại trước
        configRepository.findByConfigKey(key)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Config not found: " + key));

        String newValue = body.get("value");
        if (newValue == null) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST, "Missing 'value' field");
        }

        // [Cache-aside] updateConfig() lưu DB + refresh cache trong 1 lần gọi
        systemConfigService.updateConfig(key, newValue);

        SystemConfig updated = configRepository.findByConfigKey(key).orElseThrow();
        return ApiResponse.ok("Config updated", updated);
    }
}
