package com.cinex.module.config.controller;

import com.cinex.common.audit.Auditable;
import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.common.response.ApiResponse;
import com.cinex.module.config.dto.SystemConfigResponse;
import com.cinex.module.config.service.SystemConfigService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * [Facade Pattern] Controller chỉ nhận request, gọi Service, trả ApiResponse.
 *
 * <p><b>SOLID/D — Dependency Inversion:</b> Controller chỉ depend vào abstraction (Service),
 * KHÔNG inject Repository trực tiếp. Tất cả business logic (validate key, validate
 * range, update + refresh cache, list) nằm trong {@link SystemConfigService}.
 */
@RestController
@RequestMapping("/api/configs")
@RequiredArgsConstructor
@PreAuthorize("hasRole('SUPER_ADMIN')")
@Tag(name = "Config", description = "System configuration management")
public class ConfigController {

    private final SystemConfigService systemConfigService;

    /**
     * GET /api/configs?includeHidden=false
     *
     * <p>Mặc định chỉ trả config admin care hằng ngày (visible=true). Truyền
     * {@code includeHidden=true} để xem cả config kỹ thuật (rate-limit, cache,
     * NO_SHOW buffer) — toggle ở FE.
     */
    @GetMapping
    @Operation(summary = "(SUPER_ADMIN) List configs — mặc định ẩn config kỹ thuật")
    public ApiResponse<List<SystemConfigResponse>> listConfigs(
            @RequestParam(defaultValue = "false") boolean includeHidden) {
        return ApiResponse.ok(systemConfigService.listForAdmin(includeHidden));
    }

    @GetMapping("/public/{key}")
    @PreAuthorize("permitAll()")
    @Operation(summary = "Get a single config value (public, no auth required)")
    public ApiResponse<String> getPublicConfig(@PathVariable String key) {
        return ApiResponse.ok(systemConfigService.getString(key, ""));
    }

    /**
     * System config update — chỉ SUPER_ADMIN (config ảnh hưởng toàn hệ thống:
     * booking hold time, max seats, payment cutoff, loyalty thresholds).
     * BRANCH_ADMIN không được set vì sẽ thay đổi policy across all theaters.
     */
    @PutMapping("/{key}")
    @Auditable(action = "UPDATE_SYSTEM_CONFIG", entityType = "SystemConfig")
    @Operation(summary = "(SUPER_ADMIN) Update a config value")
    public ApiResponse<SystemConfigResponse> updateConfig(
            @PathVariable String key,
            @RequestBody Map<String, String> body) {

        String newValue = body.get("value");
        if (newValue == null) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST, "Missing 'value' field");
        }

        SystemConfigResponse updated = systemConfigService.updateConfig(key, newValue);
        return ApiResponse.ok("Đã lưu cấu hình", updated);
    }
}
