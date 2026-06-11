package com.cinex.module.booking.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
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
    @Size(max = 8, message = "Tối đa 8 ghế mỗi lần bán")
    private List<Long> seatIds;

    /** Phương thức thanh toán tại quầy: CASH, MOMO, TRANSFER. */
    @NotBlank(message = "Vui lòng chọn phương thức thanh toán")
    @Pattern(regexp = "CASH|MOMO|TRANSFER",
             message = "Phương thức thanh toán không hợp lệ (CASH/MOMO/TRANSFER)")
    private String paymentMethod;
}
