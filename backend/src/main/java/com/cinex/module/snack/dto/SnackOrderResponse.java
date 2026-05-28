package com.cinex.module.snack.dto;

import lombok.Builder;
import lombok.Getter;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Builder
public class SnackOrderResponse {

    private Long id;
    private String orderCode;
    private BigDecimal totalAmount;
    private String note;
    private List<SnackOrderItemResponse> items;
    private LocalDateTime createdAt;
}
