package com.cinex.module.statistics.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * Sức khoẻ vận hành booking — KPI cốt lõi để đánh giá UX checkout + thái độ khách.
 *
 * <p>2 tỉ lệ quan trọng nhất:
 * <ul>
 *   <li><b>No-show rate</b> = CONFIRMED nhưng không CHECKED_IN / CONFIRMED.
 *       Rạp đo để: (1) calibrate over-booking strategy hàng bay, (2) quyết
 *       khuyến mãi reminder, (3) target khách hay no-show.</li>
 *   <li><b>Cancel rate</b> = CANCELLED / tổng booking tạo. Đo: UX flow, tỉ lệ
 *       suy nghĩ lại sau hold, hiệu quả refund policy.</li>
 * </ul>
 *
 * <p><b>EXPIRED tách riêng:</b> hold quá hạn không thanh toán — đo UX flow
 * checkout (gateway chậm? UI rối?). Khác với CANCELLED chủ động.
 */
@Getter
@AllArgsConstructor
public class BookingHealthStatistics {

    /** Tổng booking CONFIRMED (đã thanh toán xong) trong khoảng. */
    private long confirmedCount;

    /** Số booking đã CHECKED_IN tại cổng. */
    private long checkedInCount;

    /** Số booking CONFIRMED nhưng không CHECKED_IN tới cuối suất chiếu. */
    private long noShowCount;

    /** % no-show = noShowCount / (CONFIRMED đã hết suất chiếu) × 100. */
    private double noShowRate;

    /** Số booking CANCELLED chủ động (user huỷ trước/sau confirm). */
    private long cancelledCount;

    /** Số booking EXPIRED — HOLDING quá hạn không thanh toán. */
    private long expiredCount;

    /** Tổng booking tạo (mọi status) — denominator cho cancel rate. */
    private long totalBookings;

    /** % cancel = cancelledCount / totalBookings × 100. */
    private double cancelRate;

    /** % hold-expire = expiredCount / totalBookings × 100 — đo UX checkout. */
    private double expireRate;
}
