package com.cinex.module.loyalty.entity;

import com.cinex.common.entity.BaseEntity;
import com.cinex.module.auth.entity.User;
import com.cinex.module.booking.entity.Booking;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Log mỗi lần earn/redeem/adjust loyalty points — entity bất biến (không update sau khi tạo).
 *
 * <p><b>Pattern "Append-Only Log":</b> không bao giờ UPDATE/DELETE transaction. Audit toàn vẹn,
 * có thể recompute balance từ log nếu data corrupt (xem {@code LoyaltyService.recomputeBalance}).
 *
 * <p><b>{@code balanceAfter}</b> snapshot số dư SAU khi transaction này được ghi. Cho phép
 * FE hiển thị "lịch sử số dư" mà không cần recompute mỗi lần — giống bank statement.
 */
@Entity
@Table(name = "loyalty_transactions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LoyaltyTransaction extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /**
     * Booking liên quan (cho EARN từ booking). Null khi:
     * <ul>
     *   <li>REDEEM tự do (đổi voucher chung)</li>
     *   <li>ADJUST từ admin</li>
     * </ul>
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id")
    private Booking booking;

    @Enumerated(EnumType.STRING)
    @Column(name = "transaction_type", nullable = false, length = 20)
    private LoyaltyTransactionType transactionType;

    /**
     * Số point. EARN > 0, REDEEM < 0, ADJUST có thể ± tuỳ trường hợp.
     * Convention rõ ràng giúp SUM(points) ra balance chính xác.
     */
    @Column(nullable = false)
    private Integer points;

    /** Số dư SAU transaction này — snapshot phục vụ UI statement. */
    @Column(name = "balance_after", nullable = false)
    private Integer balanceAfter;

    /** Mô tả ngắn (vd "Booking BKG-251208-001", "Đổi voucher 50k", "Hoàn point do hủy vé"). */
    @Column(length = 500)
    private String reason;
}
