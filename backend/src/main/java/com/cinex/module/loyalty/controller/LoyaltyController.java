package com.cinex.module.loyalty.controller;

import com.cinex.common.response.ApiResponse;
import com.cinex.common.response.PageResponse;
import com.cinex.module.loyalty.dto.LoyaltyAccountResponse;
import com.cinex.module.loyalty.dto.LoyaltyTransactionResponse;
import com.cinex.module.loyalty.service.LoyaltyQueryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST endpoints cho user xem loyalty status + history.
 *
 * <p><b>SOLID/D:</b> Controller chỉ inject {@link LoyaltyQueryService} — không đụng vào
 * Repository trực tiếp. Tất cả business logic (lookup user, calculate tier progress,
 * map DTO) nằm trong Service.
 *
 * <p>Redeem được thực hiện qua booking flow (BookingService → LoyaltyService.redeem,
 * không qua REST endpoint này).
 */
@RestController
@RequestMapping("/api/loyalty")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
@Tag(name = "Loyalty", description = "Loyalty points + tier của user")
public class LoyaltyController {

    private final LoyaltyQueryService loyaltyQueryService;

    @GetMapping("/me")
    @Operation(summary = "Trạng thái loyalty của user hiện tại")
    public ApiResponse<LoyaltyAccountResponse> getMyAccount(Authentication auth) {
        return ApiResponse.ok(loyaltyQueryService.getAccountByUsername(auth.getName()));
    }

    @GetMapping("/me/transactions")
    @Operation(summary = "Lịch sử earn/redeem của user hiện tại")
    public ApiResponse<PageResponse<LoyaltyTransactionResponse>> getMyTransactions(
            Authentication auth,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(loyaltyQueryService.getTransactionsByUsername(auth.getName(), page, size));
    }
}
