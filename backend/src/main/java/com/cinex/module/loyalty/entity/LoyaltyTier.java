package com.cinex.module.loyalty.entity;

/**
 * Hạng thành viên — theo lifetime points (cộng dồn, không trừ khi redeem).
 *
 * <p>Thresholds đọc từ system_config (loyalty.tier.silver_threshold, ...) — admin có thể
 * điều chỉnh runtime. Các giá trị trong enum chỉ là display ordinal.
 *
 * <p>Tier tự upgrade khi lifetime đạt threshold, KHÔNG downgrade — pattern CGV/Lotte:
 * "hạng đã lên thì giữ". Tránh user mất motivation khi không spend đủ năm sau.
 */
public enum LoyaltyTier {
    STANDARD,
    SILVER,
    GOLD,
    PLATINUM
}
