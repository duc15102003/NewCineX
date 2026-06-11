package com.cinex.module.voucher.dto;

import com.cinex.module.voucher.entity.DiscountType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
public class VoucherRequest {

    /**
     * Chi nhánh áp dụng voucher.
     * <ul>
     *   <li>NULL = voucher toàn hệ thống (chỉ SUPER_ADMIN được tạo)</li>
     *   <li>NOT NULL = voucher chỉ áp dụng tại 1 chi nhánh cụ thể</li>
     * </ul>
     * Branch ADMIN: service override field này từ JWT (không cho tạo cho rạp khác).
     */
    private Long theaterId;

    @NotBlank(message = "Mã voucher là bắt buộc")
    @Size(max = 30, message = "Mã voucher tối đa 30 ký tự")
    private String code;

    private String description;

    @NotNull(message = "Loại giảm giá là bắt buộc")
    private DiscountType discountType;

    @NotNull(message = "Giá trị giảm là bắt buộc")
    @Min(value = 1, message = "Giá trị giảm phải ít nhất 1")
    private BigDecimal discountValue;

    @Min(value = 0, message = "Đơn hàng tối thiểu không được âm")
    private BigDecimal minOrderAmount;

    @Min(value = 0, message = "Giảm tối đa không được âm")
    private BigDecimal maxDiscount;

    @Min(value = 0, message = "Giới hạn sử dụng không được âm")
    private Integer usageLimit;

    @NotNull(message = "Ngày bắt đầu là bắt buộc")
    private LocalDateTime startDate;

    @NotNull(message = "Ngày kết thúc là bắt buộc")
    private LocalDateTime endDate;
}
