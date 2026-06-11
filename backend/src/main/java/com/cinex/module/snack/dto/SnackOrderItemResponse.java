package com.cinex.module.snack.dto;

import lombok.Builder;
import lombok.Getter;
import java.math.BigDecimal;

@Getter
@Builder
public class SnackOrderItemResponse {

    private Long id;
    /** Loại line — SNACK hoặc COMBO. FE render badge khác nhau. */
    private String kind;

    // Snack fields — chỉ set khi kind=SNACK
    private Long snackId;
    private String snackName;
    private String snackImageUrl;

    // Combo fields — chỉ set khi kind=COMBO
    private Long comboId;
    private String comboName;
    private String comboImageUrl;

    private Integer quantity;
    private BigDecimal price;
    private BigDecimal subtotal;
}
