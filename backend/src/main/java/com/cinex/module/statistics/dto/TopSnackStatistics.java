package com.cinex.module.statistics.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import java.math.BigDecimal;

@Getter
@AllArgsConstructor
public class TopSnackStatistics {

    private Long snackId;
    private String snackName;
    private String imageUrl;
    /** Tổng số lượng đã bán (tất cả đơn POS) */
    private Long totalQuantitySold;
    /** Tổng doanh thu từ snack này */
    private BigDecimal totalRevenue;
}
