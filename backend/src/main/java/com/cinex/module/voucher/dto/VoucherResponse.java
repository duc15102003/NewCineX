package com.cinex.module.voucher.dto;

import com.cinex.module.voucher.entity.DiscountType;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Builder
public class VoucherResponse {

    private Long id;
    private String storageState;

    /** Chi nhánh áp dụng. NULL = voucher toàn hệ thống. */
    private Long theaterId;
    private String theaterName;
    private String theaterCity;

    private String code;
    private String description;
    private DiscountType discountType;
    private BigDecimal discountValue;
    private BigDecimal minOrderAmount;
    private BigDecimal maxDiscount;
    private Integer usageLimit;
    private Integer usedCount;
    private LocalDateTime startDate;
    private LocalDateTime endDate;
    private boolean active;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
