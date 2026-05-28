package com.cinex.module.booking.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
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

    // Optional: mã voucher giảm giá
    private String voucherCode;
}
