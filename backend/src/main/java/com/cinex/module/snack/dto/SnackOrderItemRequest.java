package com.cinex.module.snack.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

/**
 * Item trong giỏ POS. Phải có ĐÚNG MỘT trong 2 (XOR):
 * <ul>
 *   <li>snackId — bán snack riêng lẻ</li>
 *   <li>comboId — bán combo nguyên giá combo</li>
 * </ul>
 */
@Getter
@Setter
public class SnackOrderItemRequest {

    /** Bán snack đơn — null nếu là combo line. */
    private Long snackId;

    /** Bán combo — null nếu là snack line. */
    private Long comboId;

    @NotNull(message = "Số lượng không được để trống")
    @Min(value = 1, message = "Số lượng tối thiểu là 1")
    @Max(value = 100, message = "Số lượng tối đa 100 mỗi item (anti-spam/DoS)")
    private Integer quantity;

    @AssertTrue(message = "Mỗi line phải có đúng một trong snackId hoặc comboId")
    public boolean isExactlyOneTarget() {
        return (snackId != null) ^ (comboId != null);
    }
}
