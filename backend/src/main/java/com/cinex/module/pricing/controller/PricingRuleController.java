package com.cinex.module.pricing.controller;

import com.cinex.common.response.ApiResponse;
import com.cinex.module.pricing.dto.PricingRuleRequest;
import com.cinex.module.pricing.dto.PricingRuleResponse;
import com.cinex.module.pricing.service.PricingRuleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/pricing-rules")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Pricing Rule", description = "Quản lý quy tắc giá (admin)")
public class PricingRuleController {

    private final PricingRuleService pricingRuleService;

    @GetMapping
    public ApiResponse<Page<PricingRuleResponse>> list(
            @RequestParam(required = false) Long theaterId,
            @PageableDefault(size = 20, sort = "priority", direction = Sort.Direction.DESC) Pageable pageable) {
        return ApiResponse.ok(pricingRuleService.list(theaterId, pageable));
    }

    @GetMapping("/{id}")
    public ApiResponse<PricingRuleResponse> get(@PathVariable Long id) {
        return ApiResponse.ok(pricingRuleService.get(id));
    }

    @PostMapping
    @Operation(summary = "Tạo pricing rule")
    public ApiResponse<PricingRuleResponse> create(@Valid @RequestBody PricingRuleRequest request) {
        return ApiResponse.ok("Tạo rule thành công", pricingRuleService.create(request));
    }

    @PutMapping("/{id}")
    public ApiResponse<PricingRuleResponse> update(@PathVariable Long id,
                                                   @Valid @RequestBody PricingRuleRequest request) {
        return ApiResponse.ok("Cập nhật rule thành công", pricingRuleService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> archive(@PathVariable Long id) {
        pricingRuleService.archive(id);
        return ApiResponse.ok("Đã lưu trữ rule", null);
    }

    @PostMapping("/bulk-archive")
    public ApiResponse<Void> bulkArchive(@RequestBody List<Long> ids) {
        pricingRuleService.bulkArchive(ids);
        return ApiResponse.ok("Đã lưu trữ", null);
    }

    @PostMapping("/bulk-restore")
    public ApiResponse<Void> bulkRestore(@RequestBody List<Long> ids) {
        pricingRuleService.bulkRestore(ids);
        return ApiResponse.ok("Đã khôi phục", null);
    }
}
