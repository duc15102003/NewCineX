package com.cinex.module.snack.controller;

import com.cinex.common.response.ApiResponse;
import com.cinex.common.response.PageResponse;
import com.cinex.module.snack.dto.SnackOrderRequest;
import com.cinex.module.snack.dto.SnackOrderResponse;
import com.cinex.module.snack.service.SnackOrderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/snack-orders")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Snack Orders (POS)", description = "POS system — counter snack sales (Admin only)")
public class SnackOrderController {

    private final SnackOrderService snackOrderService;

    /**
     * POST /api/snack-orders
     * Thu ngân tạo đơn hàng tại quầy: chọn snack + số lượng → tính tiền → lưu.
     */
    @PostMapping
    @Operation(summary = "(Admin) Create POS snack order at counter")
    public ApiResponse<SnackOrderResponse> createOrder(@Valid @RequestBody SnackOrderRequest request) {
        return ApiResponse.ok("Đơn hàng đã được tạo", snackOrderService.createOrder(request));
    }

    /**
     * GET /api/snack-orders?page=0&size=20&sort=createdAt,desc
     * Danh sách đơn hàng — admin xem lịch sử bán hàng tại quầy.
     */
    @GetMapping
    @Operation(summary = "(Admin) List all POS snack orders")
    public ApiResponse<PageResponse<SnackOrderResponse>> listOrders(
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ApiResponse.ok(PageResponse.from(snackOrderService.listOrders(pageable)));
    }
}
