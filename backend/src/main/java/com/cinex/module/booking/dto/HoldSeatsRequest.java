package com.cinex.module.booking.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class HoldSeatsRequest {

    @NotNull(message = "Vui lòng chọn suất chiếu")
    private Long showtimeId;

    @NotEmpty(message = "Vui lòng chọn ít nhất 1 ghế")
    @Size(max = 8, message = "Tối đa 8 ghế mỗi lần đặt")
    private List<Long> seatIds;

    /**
     * Optional voucher code (chỉ chấp nhận A-Z, 0-9, dấu gạch ngang, độ dài 3-20).
     * Pattern chặn input rác trước khi vào DB query — tránh truy vấn vô ích
     * và prevent injection-like patterns ở voucherRepository.findByCode.
     */
    @Pattern(regexp = "^$|^[A-Z0-9-]{3,20}$",
             message = "Mã voucher chỉ gồm chữ in hoa, số và dấu gạch ngang, 3-20 ký tự")
    private String voucherCode;

    /**
     * Số điểm khách muốn dùng để giảm giá vé (0 hoặc bỏ qua = không dùng điểm).
     * BE sẽ validate: user đủ điểm + ≥ loyalty.min_redeem_points (mặc định 100).
     * Mỗi điểm quy đổi thành tiền theo {@code loyalty.redeem_value} (1000đ/điểm).
     */
    @Min(value = 0, message = "Số điểm đổi phải >= 0")
    private Integer redeemPoints;
}
