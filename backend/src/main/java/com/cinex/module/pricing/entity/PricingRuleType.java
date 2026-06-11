package com.cinex.module.pricing.entity;

/**
 * Loại điều kiện áp dụng pricing rule.
 *
 * <p>Mỗi loại dùng tập cột khác nhau trong bảng pricing_rules:
 * <ul>
 *   <li>{@link #DAY_OF_WEEK}: dùng {@code day_of_week} (CSV danh sách thứ).
 *       VD weekend: "SATURDAY,SUNDAY"</li>
 *   <li>{@link #HOUR_RANGE}: dùng {@code hour_start} - {@code hour_end} [closed-open).
 *       VD peak tối: 18-22 (18:00 ≤ start < 22:00)</li>
 *   <li>{@link #DATE_RANGE}: dùng {@code date_start} - {@code date_end} [closed-closed].
 *       VD Tết Nguyên Đán: 2026-02-10 → 2026-02-15</li>
 * </ul>
 *
 * <p>Có thể combine: rule "Peak weekend night" = DAY_OF_WEEK (T7,CN) + HOUR_RANGE (18-22).
 * Khi cả 2 trường được set, rule chỉ apply nếu CẢ HAI match.
 */
public enum PricingRuleType {
    DAY_OF_WEEK,
    HOUR_RANGE,
    DATE_RANGE,
    /** Combine nhiều điều kiện trong cùng 1 rule. */
    COMPOSITE
}
