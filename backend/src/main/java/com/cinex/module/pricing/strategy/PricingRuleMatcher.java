package com.cinex.module.pricing.strategy;

import com.cinex.module.pricing.entity.PricingRule;

import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * [Strategy Pattern — function table]
 *
 * <p>Kiểm tra 1 {@link PricingRule} có áp dụng cho {@code LocalDateTime} (giờ chiếu) không.
 *
 * <p><b>Vì sao tách thành class riêng?</b> Tách matching logic khỏi {@link PricingRule}
 * entity (entity giữ data, không chứa business). Tách khỏi engine để dễ unit test từng
 * rule type độc lập.
 *
 * <p>Hỗ trợ 4 loại rule:
 * <ul>
 *   <li>DAY_OF_WEEK: match nếu thứ thuộc CSV {@code day_of_week}</li>
 *   <li>HOUR_RANGE: match nếu giờ start nằm trong [hourStart, hourEnd)</li>
 *   <li>DATE_RANGE: match nếu ngày start nằm trong [dateStart, dateEnd]</li>
 *   <li>COMPOSITE: AND tất cả điều kiện đã set (≥ 1 trong 3 trường)</li>
 * </ul>
 *
 * <p>Class final + static method → không cần inject, không có state.
 */
public final class PricingRuleMatcher {

    private PricingRuleMatcher() {}

    /**
     * @return true nếu rule áp dụng cho showtime tại {@code showtimeStart}.
     *         Inactive/ARCHIVED rule đã filter ở repository, không check lại ở đây.
     */
    public static boolean matches(PricingRule rule, LocalDateTime showtimeStart) {
        if (rule.getRuleType() == null) return false;

        switch (rule.getRuleType()) {
            case DAY_OF_WEEK:
                return matchesDayOfWeek(rule, showtimeStart);
            case HOUR_RANGE:
                return matchesHourRange(rule, showtimeStart);
            case DATE_RANGE:
                return matchesDateRange(rule, showtimeStart);
            case COMPOSITE:
                return matchesComposite(rule, showtimeStart);
            default:
                return false;
        }
    }

    private static boolean matchesDayOfWeek(PricingRule rule, LocalDateTime t) {
        if (rule.getDayOfWeek() == null || rule.getDayOfWeek().isBlank()) return false;
        Set<DayOfWeek> days = parseDays(rule.getDayOfWeek());
        return days.contains(t.getDayOfWeek());
    }

    private static boolean matchesHourRange(PricingRule rule, LocalDateTime t) {
        if (rule.getHourStart() == null || rule.getHourEnd() == null) return false;
        int h = t.getHour();
        // [hourStart, hourEnd) — closed-open. VD 18-22 nghĩa là 18:00 ≤ start < 22:00.
        return h >= rule.getHourStart() && h < rule.getHourEnd();
    }

    private static boolean matchesDateRange(PricingRule rule, LocalDateTime t) {
        if (rule.getDateStart() == null || rule.getDateEnd() == null) return false;
        var date = t.toLocalDate();
        // [dateStart, dateEnd] — closed-closed. Lễ tết thường có cả ngày cuối.
        return !date.isBefore(rule.getDateStart()) && !date.isAfter(rule.getDateEnd());
    }

    /**
     * COMPOSITE: AND tất cả điều kiện đã set (ít nhất 1 phải set).
     * VD: rule "Peak weekend night" = day_of_week (T7,CN) + hour_range (18-22)
     * → chỉ match khi cả 2 đều đúng.
     */
    private static boolean matchesComposite(PricingRule rule, LocalDateTime t) {
        boolean hasAny = false;

        if (rule.getDayOfWeek() != null && !rule.getDayOfWeek().isBlank()) {
            hasAny = true;
            if (!matchesDayOfWeek(rule, t)) return false;
        }
        if (rule.getHourStart() != null && rule.getHourEnd() != null) {
            hasAny = true;
            if (!matchesHourRange(rule, t)) return false;
        }
        if (rule.getDateStart() != null && rule.getDateEnd() != null) {
            hasAny = true;
            if (!matchesDateRange(rule, t)) return false;
        }
        return hasAny; // composite rỗng → không match (tránh áp dụng nhầm)
    }

    /** Parse CSV "SATURDAY,SUNDAY" → Set<DayOfWeek>. Tolerant với khoảng trắng. */
    private static Set<DayOfWeek> parseDays(String csv) {
        return java.util.Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(s -> {
                    try { return DayOfWeek.valueOf(s.toUpperCase()); }
                    catch (IllegalArgumentException e) { return null; }
                })
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toSet());
    }
}
