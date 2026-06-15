package com.cinex.module.statistics.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.math.BigDecimal;

/**
 * Cơ cấu doanh thu theo nguồn — chart pie classic dashboard rạp.
 *
 * <p>Trả lời "Tiền vào từ đâu?" — vé chiếu vs đồ ăn vs combo. Rạp ngoài đời
 * sống bằng F&B (margin 60-80%) chứ không phải vé (margin 10-20% sau khi chia
 * distributor), nên xem ratio này để quyết định marketing.
 *
 * <p>Nguồn:
 * <ul>
 *   <li>{@code ticketRevenue} = SUM(Payment.amount) status=COMPLETED — vé đã
 *       thanh toán (net after discount, gross with VAT — "khách trả thực thu").</li>
 *   <li>{@code snackRevenue} = SUM(SnackOrder.totalAmount) — bao gồm cả combo
 *       (combo line đã apply discount inline trong OrderItem.price).</li>
 * </ul>
 */
@Getter
@AllArgsConstructor
public class RevenueBreakdownStatistics {

    private BigDecimal ticketRevenue;
    private BigDecimal snackRevenue;
    private BigDecimal totalRevenue;

    /** % vé / tổng × 100. 0.0 nếu tổng = 0. */
    private double ticketPercent;

    /** % snack / tổng × 100. */
    private double snackPercent;
}
