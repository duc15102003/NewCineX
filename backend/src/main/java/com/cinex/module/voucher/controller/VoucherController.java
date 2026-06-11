package com.cinex.module.voucher.controller;

import com.cinex.common.dto.BulkDeleteRequest;
import com.cinex.common.response.ApiResponse;
import com.cinex.common.response.PageResponse;
import com.cinex.common.service.SecurityService;
import com.cinex.module.voucher.dto.ValidateVoucherRequest;
import com.cinex.module.voucher.dto.ValidateVoucherResponse;
import com.cinex.module.voucher.dto.VoucherFilter;
import com.cinex.module.voucher.dto.VoucherRequest;
import com.cinex.module.voucher.dto.VoucherResponse;
import com.cinex.module.voucher.service.VoucherService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/vouchers")
@RequiredArgsConstructor
@Tag(name = "Voucher", description = "Voucher / Promotion management")
public class VoucherController {

    private final VoucherService voucherService;
    private final SecurityService securityService;

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) List vouchers with filter")
    public ApiResponse<PageResponse<VoucherResponse>> listVouchers(
            VoucherFilter filter,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ApiResponse.ok(PageResponse.from(voucherService.listVouchers(filter, pageable)));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) Get voucher detail")
    public ApiResponse<VoucherResponse> getVoucher(@PathVariable Long id) {
        return ApiResponse.ok(voucherService.getVoucher(id));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) Create a new voucher")
    public ApiResponse<VoucherResponse> createVoucher(@Valid @RequestBody VoucherRequest request) {
        return ApiResponse.ok("Voucher created", voucherService.createVoucher(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) Update a voucher")
    public ApiResponse<VoucherResponse> updateVoucher(
            @PathVariable Long id,
            @Valid @RequestBody VoucherRequest request) {
        return ApiResponse.ok("Voucher updated", voucherService.updateVoucher(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) Soft delete a voucher")
    public ApiResponse<Void> deleteVoucher(@PathVariable Long id) {
        voucherService.deleteVoucher(id);
        return ApiResponse.ok("Voucher deleted", null);
    }

    @PostMapping("/{id}/restore")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) Restore a voucher")
    public ApiResponse<VoucherResponse> restoreVoucher(@PathVariable Long id) {
        return ApiResponse.ok("Voucher restored", voucherService.restoreVoucher(id));
    }

    @PostMapping("/bulk-delete")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) Bulk soft delete")
    public ApiResponse<Void> bulkDelete(@Valid @RequestBody BulkDeleteRequest request) {
        voucherService.bulkDelete(request.getIds());
        return ApiResponse.ok("Deleted " + request.getIds().size() + " items", null);
    }

    @PostMapping("/bulk-restore")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) Bulk restore")
    public ApiResponse<Void> bulkRestore(@Valid @RequestBody BulkDeleteRequest request) {
        voucherService.bulkRestore(request.getIds());
        return ApiResponse.ok("Restored " + request.getIds().size() + " items", null);
    }

    @GetMapping("/available")
    @Operation(summary = "Get available vouchers for an order amount (paged)")
    public ApiResponse<PageResponse<ValidateVoucherResponse>> getAvailableVouchers(
            @RequestParam java.math.BigDecimal orderAmount,
            @RequestParam(required = false) Long theaterId,
            @PageableDefault(size = 10, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        Long userId = securityService.getCurrentUserIdOrNull();
        return ApiResponse.ok(PageResponse.from(
                voucherService.getAvailableVouchers(orderAmount, userId, theaterId, pageable)));
    }

    @PostMapping("/validate")
    @Operation(summary = "Validate a voucher code and get discount amount")
    public ApiResponse<ValidateVoucherResponse> validateVoucher(
            @Valid @RequestBody ValidateVoucherRequest request) {
        Long userId = securityService.getCurrentUserIdOrNull();
        return ApiResponse.ok(voucherService.validateVoucher(
                request.getCode(), request.getOrderAmount(), userId, request.getTheaterId()));
    }

}
