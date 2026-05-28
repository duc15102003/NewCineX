package com.cinex.module.booking.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

/**
 * DTO bán vé tại quầy — admin chọn suất chiếu + ghế, thu tiền mặt,
 * hệ thống tạo booking CONFIRMED luôn (không qua HOLDING).
 * Không cần userId vì khách vãng lai không đăng nhập.
 */
@Getter
@Setter
public class CounterSaleRequest {

    @NotNull(message = "Vui lòng chọn suất chiếu")
    private Long showtimeId;

    @NotEmpty(message = "Vui lòng chọn ghế")
    private List<Long> seatIds;

    // Phương thức thanh toán tại quầy: CASH (tiền mặt), MOMO (QR MoMo), TRANSFER (chuyển khoản)
    private String paymentMethod;
}
