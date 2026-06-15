package com.cinex.module.loyalty.dto;

import com.cinex.module.loyalty.entity.LoyaltyTier;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

/**
 * Trạng thái loyalty của 1 user — overview cho trang Profile.
 */
@Getter
@Builder
public class LoyaltyAccountResponse {

    private Integer loyaltyPoints;
    private Integer lifetimePoints;
    private LoyaltyTier tier;

    /** Threshold đạt next tier (null nếu đã PLATINUM). FE hiển thị progress bar. */
    private Integer nextTierThreshold;
    private LoyaltyTier nextTier;

    /** Số point còn thiếu để lên tier kế tiếp (null nếu PLATINUM). */
    private Integer pointsToNextTier;

    /**
     * Tổng số điểm sẽ hết hạn trong 30 ngày tới — UI hiển thị warning vàng
     * "X điểm sắp hết hạn, dùng ngay kẻo phí" (industry CGV/Lotte/BHD app).
     */
    private Integer pointsExpiringIn30Days;

    /**
     * Ngày sớm nhất có batch hết hạn — UI hiển thị "Hết hạn sớm nhất: DD/MM".
     * Null nếu không có batch nào active.
     */
    private LocalDateTime nearestExpiryDate;
}
