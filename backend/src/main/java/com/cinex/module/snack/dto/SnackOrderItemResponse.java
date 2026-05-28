package com.cinex.module.snack.dto;

import lombok.Builder;
import lombok.Getter;
import java.math.BigDecimal;

@Getter
@Builder
public class SnackOrderItemResponse {

    private Long id;
    private Long snackId;
    private String snackName;
    private String snackImageUrl;
    private Integer quantity;
    private BigDecimal price;
    private BigDecimal subtotal;
}
