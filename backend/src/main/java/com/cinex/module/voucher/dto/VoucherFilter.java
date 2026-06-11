package com.cinex.module.voucher.dto;

import com.cinex.module.voucher.entity.DiscountType;
import lombok.Getter;
import lombok.Setter;
import org.springframework.format.annotation.DateTimeFormat;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Filter cho admin tra cứu voucher. Mọi field optional — null thì bỏ qua.
 *
 * <p>Phân biệt 2 khái niệm trạng thái:
 *  - {@code active}: cờ active trong entity (admin chủ động bật/tắt).
 *  - {@code currentlyValid}: now nằm trong khoảng [startDate, endDate].
 *  - {@code expired}: endDate < now.
 */
@Getter
@Setter
public class VoucherFilter {

    /**
     * Chi nhánh cần lọc.
     * <ul>
     *   <li>NULL + globalOnly NULL → trả về tất cả (SUPER_ADMIN xem "Tất cả")</li>
     *   <li>NOT NULL → kết hợp voucher chi nhánh đó VỚI voucher global (admin scope)</li>
     * </ul>
     * Branch ADMIN: service override field này từ JWT.
     */
    private Long theaterId;

    /** True = chỉ trả về voucher global (theater_id IS NULL). Bỏ qua theaterId. */
    private Boolean globalOnly;

    /** LIKE code OR description (lowercase). */
    private String keyword;

    /** Loại giảm giá: PERCENTAGE / FIXED_AMOUNT. */
    private DiscountType discountType;

    /** Cờ active của entity. */
    private Boolean active;

    /** true = đang trong khoảng startDate..endDate (now). */
    private Boolean currentlyValid;

    /** true = endDate < now. */
    private Boolean expired;

    /** Khoảng discountValue. */
    private BigDecimal minDiscount;
    private BigDecimal maxDiscount;

    /** Khoảng startDate. */
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
    private LocalDateTime startDateFrom;
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
    private LocalDateTime startDateTo;

    /** Khoảng endDate. */
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
    private LocalDateTime endDateFrom;
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
    private LocalDateTime endDateTo;

    /**
     * true = chỉ lấy voucher còn lượt (usedCount < usageLimit
     * HOẶC usageLimit IS NULL — không giới hạn).
     * false = chỉ lấy voucher đã hết lượt.
     */
    private Boolean hasUsageLeft;

    private Boolean includeDeleted;
}
