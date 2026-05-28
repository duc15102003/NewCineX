package com.cinex.module.seat.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.util.Set;

/**
 * Cấu hình để tự động sinh ghế cho phòng.
 *
 * VD: totalRows=10, totalCols=12, vipRows=["E","F","G"], coupleRow="J"
 * → Sinh 10 hàng (A-J), mỗi hàng 12 cột
 * → Hàng E, F, G = VIP
 * → Hàng J = COUPLE (ghế đôi)
 * → Còn lại = STANDARD
 */
@Getter
@Setter
public class SeatGenerateRequest {

    @NotNull(message = "Số hàng là bắt buộc")
    @Min(value = 1, message = "Tối thiểu 1 hàng")
    @Max(value = 26, message = "Tối đa 26 hàng (A-Z)")
    private Integer totalRows;

    @NotNull(message = "Số cột là bắt buộc")
    @Min(value = 1, message = "Tối thiểu 1 cột")
    @Max(value = 30, message = "Tối đa 30 cột")
    private Integer totalCols;

    // Hàng VIP (VD: ["E", "F", "G"])
    private Set<String> vipRows;

    // Hàng couple (VD: "J") — ghế đôi, thường hàng cuối
    private String coupleRow;
}
