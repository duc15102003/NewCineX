package com.cinex.module.combo.dto;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
@Builder
public class ComboItemResponse {

    private Long id;
    private Long snackId;
    private String snackName;
    private String snackImageUrl;
    private BigDecimal snackPrice;
    private Integer quantity;
}
