package com.cinex.module.loyalty.dto;

import com.cinex.module.loyalty.entity.LoyaltyTier;
import lombok.Builder;
import lombok.Getter;

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
}
