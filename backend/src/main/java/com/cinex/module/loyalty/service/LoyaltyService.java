package com.cinex.module.loyalty.service;

import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.module.auth.entity.User;
import com.cinex.module.auth.repository.UserRepository;
import com.cinex.module.booking.entity.Booking;
import com.cinex.module.config.service.SystemConfigService;
import com.cinex.module.loyalty.entity.LoyaltyTier;
import com.cinex.module.loyalty.entity.LoyaltyTransaction;
import com.cinex.module.loyalty.entity.LoyaltyTransactionType;
import com.cinex.module.loyalty.repository.LoyaltyTransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Service quản lý loyalty points + tier.
 *
 * <p><b>Config-driven:</b> tỉ lệ earn, giá trị redeem, tier thresholds đọc từ system_config
 * → admin chỉnh runtime không cần deploy. Default theo chuẩn rạp VN:
 * <ul>
 *   <li>{@code loyalty.earn_rate = 0.001} — 1 point / 1000đ</li>
 *   <li>{@code loyalty.redeem_value = 1000} — 1 point = 1000đ discount</li>
 *   <li>{@code loyalty.min_redeem_points = 100} — tối thiểu 100 point/lần redeem</li>
 *   <li>SILVER ≥ 1000, GOLD ≥ 5000, PLATINUM ≥ 20000 lifetime</li>
 * </ul>
 *
 * <p><b>Concurrency:</b> mọi mutation đi qua transaction; User có version (optimistic lock)
 * tự kích bump khi setPoints/setLifetime/setTier — race conditions giữa 2 booking song song
 * sẽ throw OptimisticLockException, caller retry.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LoyaltyService {

    private final UserRepository userRepository;
    private final LoyaltyTransactionRepository loyaltyTransactionRepository;
    private final SystemConfigService systemConfigService;

    /**
     * Earn points khi booking confirmed. Idempotent: nếu booking đã có EARN log thì skip.
     *
     * @return số point đã earn (0 nếu skip do đã earn trước đó)
     */
    @Transactional
    public int earnFromBooking(Booking booking) {
        if (booking.getUser() == null) {
            return 0; // POS counter sale — không user, không earn
        }
        if (loyaltyTransactionRepository.existsByBookingIdAndTransactionType(
                booking.getId(), LoyaltyTransactionType.EARN)) {
            log.info("Booking {} đã earn points trước đó — skip", booking.getBookingCode());
            return 0;
        }

        BigDecimal earnRate = readDecimalConfig("loyalty.earn_rate", "0.001");
        int pointsEarned = booking.getTotalAmount()
                .multiply(earnRate)
                .setScale(0, RoundingMode.DOWN)
                .intValue();
        if (pointsEarned <= 0) return 0;

        User user = booking.getUser();
        // Re-fetch để bump optimistic lock đúng (booking.user có thể stale từ event)
        User fresh = userRepository.findById(user.getId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "User không tồn tại"));

        int newBalance = fresh.getLoyaltyPoints() + pointsEarned;
        int newLifetime = fresh.getLifetimePoints() + pointsEarned;
        fresh.setLoyaltyPoints(newBalance);
        fresh.setLifetimePoints(newLifetime);
        fresh.setTier(calculateTier(newLifetime));
        userRepository.save(fresh);

        loyaltyTransactionRepository.save(LoyaltyTransaction.builder()
                .user(fresh)
                .booking(booking)
                .transactionType(LoyaltyTransactionType.EARN)
                .points(pointsEarned)
                .balanceAfter(newBalance)
                .reason("Booking " + booking.getBookingCode())
                .build());

        log.info("User {} earned {} points from booking {} (balance now {}, tier {})",
                fresh.getId(), pointsEarned, booking.getBookingCode(), newBalance, fresh.getTier());
        return pointsEarned;
    }

    /**
     * Redeem points → trả về discount tương ứng (VNĐ).
     *
     * <p>Validate: đủ điểm + đủ min_redeem_points + integer points (không lẻ).
     * Không hoàn lại khi REDEEM (giữ pattern simple) — admin có thể ADJUST tay nếu cần.
     */
    @Transactional
    public BigDecimal redeem(Long userId, int pointsToRedeem) {
        int minRedeem = systemConfigService.getInt("loyalty.min_redeem_points", 100);
        if (pointsToRedeem < minRedeem) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Số điểm đổi tối thiểu là " + minRedeem);
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "User không tồn tại"));
        if (user.getLoyaltyPoints() < pointsToRedeem) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Số điểm không đủ. Hiện có: " + user.getLoyaltyPoints());
        }

        long redeemValue = systemConfigService.getLong("loyalty.redeem_value", 1000);
        BigDecimal discountAmount = BigDecimal.valueOf((long) pointsToRedeem * redeemValue);

        int newBalance = user.getLoyaltyPoints() - pointsToRedeem;
        user.setLoyaltyPoints(newBalance);
        // KHÔNG trừ lifetime — pattern industry: tier không bị tụt khi redeem
        userRepository.save(user);

        loyaltyTransactionRepository.save(LoyaltyTransaction.builder()
                .user(user)
                .transactionType(LoyaltyTransactionType.REDEEM)
                .points(-pointsToRedeem) // negative = trừ
                .balanceAfter(newBalance)
                .reason("Đổi " + pointsToRedeem + " điểm = " + discountAmount + "đ")
                .build());

        log.info("User {} redeemed {} points = {}đ (balance now {})",
                userId, pointsToRedeem, discountAmount, newBalance);
        return discountAmount;
    }

    /**
     * Tính tier dựa trên lifetime points + thresholds từ config.
     * KHÔNG downgrade — caller phải compare với tier hiện tại trước khi gọi (nếu cần giữ pattern
     * "tier chỉ lên"). Hiện implementation chỉ trả giá trị theo lifetime, đảm bảo monotonic
     * tăng vì lifetime chỉ tăng.
     */
    public LoyaltyTier calculateTier(int lifetimePoints) {
        int platinum = systemConfigService.getInt("loyalty.tier.platinum_threshold", 20000);
        int gold = systemConfigService.getInt("loyalty.tier.gold_threshold", 5000);
        int silver = systemConfigService.getInt("loyalty.tier.silver_threshold", 1000);

        if (lifetimePoints >= platinum) return LoyaltyTier.PLATINUM;
        if (lifetimePoints >= gold) return LoyaltyTier.GOLD;
        if (lifetimePoints >= silver) return LoyaltyTier.SILVER;
        return LoyaltyTier.STANDARD;
    }

    private BigDecimal readDecimalConfig(String key, String defaultStr) {
        String raw = systemConfigService.getString(key, defaultStr);
        try {
            return new BigDecimal(raw);
        } catch (NumberFormatException e) {
            log.warn("Config {} = '{}' không phải số — dùng default '{}'", key, raw, defaultStr);
            return new BigDecimal(defaultStr);
        }
    }
}
