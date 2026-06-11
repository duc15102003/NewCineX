package com.cinex.module.loyalty.entity;

public enum LoyaltyTransactionType {
    /** Earn: cộng điểm khi booking confirmed. */
    EARN,
    /** Redeem: trừ điểm khi user dùng đổi voucher/discount. */
    REDEEM,
    /** Adjust: admin điều chỉnh tay (refund, correction). */
    ADJUST
}
