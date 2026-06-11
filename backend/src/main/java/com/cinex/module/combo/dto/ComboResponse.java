package com.cinex.module.combo.dto;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Builder
public class ComboResponse {

    private Long id;
    private String storageState;
    /** Chi nhánh — phục vụ grouped view + audit. */
    private Long theaterId;
    private String theaterName;
    private String theaterCity;
    private String code;
    private String name;
    private String description;
    private String imageUrl;
    private BigDecimal price;
    private boolean active;
    private List<ComboItemResponse> items;
    /** Tổng giá nếu mua snack riêng lẻ — FE hiển thị "tiết kiệm X đồng". */
    private BigDecimal regularPrice;
    /** Số tiền tiết kiệm = regularPrice - price. NULL hoặc 0 nếu combo không có lợi. */
    private BigDecimal savingsAmount;
    /** Phần trăm tiết kiệm làm tròn. NULL nếu regularPrice=0 hoặc savings≤0. */
    private Integer savingsPercent;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
