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
import java.time.LocalDateTime;
import java.util.List;

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
        // Earn theo GIÁ VÉ NIÊM YẾT (seatTotal) — industry chuẩn CGV/Lotte/BHD.
        // KHÔNG dùng totalAmount vì đã trừ tier + group + voucher discount → khách
        // dùng voucher 50% chỉ nhận nửa điểm, voucher trở thành "phạt cắt điểm".
        // Fallback totalAmount cho booking cũ chưa có seat_total (defensive).
        BigDecimal basisAmount = booking.getSeatTotalAmount() != null
                ? booking.getSeatTotalAmount()
                : booking.getTotalAmount();
        int pointsEarned = basisAmount
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

        int expiryMonths = systemConfigService.getInt("loyalty.points_expiry_months", 12);
        loyaltyTransactionRepository.save(LoyaltyTransaction.builder()
                .user(fresh)
                .booking(booking)
                .transactionType(LoyaltyTransactionType.EARN)
                .points(pointsEarned)
                .balanceAfter(newBalance)
                .reason("Booking " + booking.getBookingCode())
                // Batch tracking — FIFO expiry: điểm tích từ booking này hết hạn
                // sau X tháng (industry standard CGV/Lotte/BHD 12 tháng).
                .expiresAt(LocalDateTime.now().plusMonths(expiryMonths))
                .remainingPoints(pointsEarned)
                .build());

        log.info("User {} earned {} points from booking {} (balance now {}, tier {}, expires {} months)",
                fresh.getId(), pointsEarned, booking.getBookingCode(), newBalance, fresh.getTier(), expiryMonths);
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

        // FIFO: trừ batch cũ nhất trước — tận dụng điểm sắp hết hạn, đúng accounting
        deductFromBatchesFifo(user.getId(), pointsToRedeem);

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
     * Trừ điểm theo FIFO — batch EARN cũ nhất (sắp expire) tiêu trước.
     *
     * <p>Industry rationale: nếu user còn batch sắp hết hạn 1 tháng nữa, REDEEM
     * nên trừ batch đó trước thay vì batch mới EARN tuần trước (còn 11 tháng).
     * Tránh lãng phí điểm + match accounting chuẩn (FIFO inventory).
     *
     * <p>Caller đã validate đủ điểm tổng — method này chỉ trừ remaining_points
     * của các batch active, không validate lại.
     */
    private void deductFromBatchesFifo(Long userId, int pointsToDeduct) {
        List<LoyaltyTransaction> activeBatches = loyaltyTransactionRepository
                .findActiveBatchesByUserIdFifo(userId, LoyaltyTransactionType.EARN, LocalDateTime.now());
        int remaining = pointsToDeduct;
        for (LoyaltyTransaction batch : activeBatches) {
            if (remaining <= 0) break;
            int batchRemaining = batch.getRemainingPoints() != null ? batch.getRemainingPoints() : 0;
            if (batchRemaining <= 0) continue;
            int take = Math.min(remaining, batchRemaining);
            batch.setRemainingPoints(batchRemaining - take);
            loyaltyTransactionRepository.save(batch);
            remaining -= take;
        }
        if (remaining > 0) {
            log.warn("User {} REDEEM thiếu batch tracking — còn {} điểm chưa attribute (data inconsistency).",
                    userId, remaining);
        }
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

    /**
     * Tính tiền giảm cho 1 booking theo hạng thành viên — áp dụng tự động khi
     * khách đặt vé (industry pattern CGV VIP/Lotte Star/BHD Star).
     *
     * <p>Đọc % giảm từ system_config theo hạng:
     * <ul>
     *   <li>STANDARD → 0% (không seed config, default trong code)</li>
     *   <li>SILVER → loyalty.tier.silver_discount_percent (default 3)</li>
     *   <li>GOLD → loyalty.tier.gold_discount_percent (default 5)</li>
     *   <li>PLATINUM → loyalty.tier.platinum_discount_percent (default 10)</li>
     * </ul>
     *
     * @param grossSeatTotal tổng tiền ghế trước mọi discount
     * @param tier hạng khách hiện tại
     * @return tiền giảm (rounded HALF_UP, scale 0). Trả 0 nếu tier null hoặc STANDARD.
     */
    public BigDecimal calculateTierDiscount(BigDecimal grossSeatTotal, LoyaltyTier tier) {
        if (tier == null || tier == LoyaltyTier.STANDARD) {
            return BigDecimal.ZERO;
        }
        int percent = switch (tier) {
            case SILVER -> systemConfigService.getInt("loyalty.tier.silver_discount_percent", 3);
            case GOLD -> systemConfigService.getInt("loyalty.tier.gold_discount_percent", 5);
            case PLATINUM -> systemConfigService.getInt("loyalty.tier.platinum_discount_percent", 10);
            default -> 0;
        };
        if (percent <= 0) return BigDecimal.ZERO;

        return grossSeatTotal
                .multiply(BigDecimal.valueOf(percent))
                .divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP);
    }

    /**
     * Preview tiền giảm cho 1 lần redeem — validate điểm + cap floor để không
     * âm. Gọi từ BookingService.computePriceBreakdown trước khi tạo booking.
     *
     * <p>Không trừ điểm thực — chỉ tính discount. Trừ điểm thật ở
     * {@link #redeemForBooking} sau khi booking đã có id.
     *
     * <p>Validate (throw BusinessException nếu fail):
     * <ul>
     *   <li>≥ min_redeem_points</li>
     *   <li>≤ user.loyaltyPoints (đủ điểm)</li>
     * </ul>
     *
     * <p>Cap discount theo {@code maxDiscountCap} (afterGroup) để loyalty không
     * khiến total âm. Vd user có 10.000 điểm = 10.000.000đ nhưng vé chỉ 100k →
     * cap discount 100k, không cho tiêu hết điểm dư.
     */
    public BigDecimal previewRedeemDiscount(User user, int pointsToRedeem, BigDecimal maxDiscountCap) {
        if (pointsToRedeem <= 0) return BigDecimal.ZERO;
        int minRedeem = systemConfigService.getInt("loyalty.min_redeem_points", 100);
        if (pointsToRedeem < minRedeem) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Số điểm đổi tối thiểu là " + minRedeem);
        }
        if (user.getLoyaltyPoints() < pointsToRedeem) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Số điểm không đủ. Hiện có: " + user.getLoyaltyPoints());
        }
        // Cap=0 (vd voucher đã giảm hết) → reject sớm, không cho user mất điểm
        // đổi 0đ. Trước đây silent return 0 → user click confirm → mất điểm.
        if (maxDiscountCap.signum() <= 0) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Đơn hàng đã được giảm hết bằng voucher hoặc khuyến mãi — không cần dùng điểm tích luỹ");
        }
        long redeemValue = systemConfigService.getLong("loyalty.redeem_value", 1000);
        BigDecimal discount = BigDecimal.valueOf((long) pointsToRedeem * redeemValue);
        // Cap: không vượt quá số tiền còn lại sau group discount
        return discount.min(maxDiscountCap);
    }

    /**
     * Redeem điểm gắn với 1 booking — wire booking_id vào REDEEM tx để hoàn
     * lại được khi cancel/expire.
     *
     * <p><b>Cap-aware deduction:</b> nếu user nhập THỪA điểm so với giá trị
     * giảm tối đa (maxDiscountCap), CHỈ trừ số điểm CẦN — phần dư giữ nguyên
     * trong balance. Tránh case khách mất điểm oan:
     * <pre>
     *   Vé 80k, user có 200 điểm (= 200k giá trị), nhập 200.
     *   Trước: trừ 200, giảm 80k (cap) → mất 120 điểm = 120k value oan.
     *   Sau:   tính cần 80 điểm, trừ 80, giảm 80k → 120 điểm còn lại.
     * </pre>
     *
     * <p>Trả về số tiền giảm thực tế. Throw nếu không đủ điểm hoặc số điểm
     * cần (sau cap) dưới min_redeem_points.
     */
    @Transactional
    public BigDecimal redeemForBooking(User user, int pointsToRedeem,
                                        BigDecimal maxDiscountCap, Booking booking) {
        int minRedeem = systemConfigService.getInt("loyalty.min_redeem_points", 100);
        if (pointsToRedeem < minRedeem) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Số điểm đổi tối thiểu là " + minRedeem);
        }
        User fresh = userRepository.findById(user.getId())
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND, "User không tồn tại"));
        if (fresh.getLoyaltyPoints() < pointsToRedeem) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Số điểm không đủ. Hiện có: " + fresh.getLoyaltyPoints());
        }

        long redeemValue = systemConfigService.getLong("loyalty.redeem_value", 1000);

        // Số điểm THỰC SỰ cần để cover cap. CEILING vì 1 điểm rời rạc:
        // cap 999đ + redeem_value 1000 → cần 1 điểm (giảm full 999đ).
        long pointsNeededForCap = maxDiscountCap.signum() <= 0
                ? 0
                : maxDiscountCap
                    .divide(BigDecimal.valueOf(redeemValue), 0, RoundingMode.CEILING)
                    .longValue();
        // Thực dùng = min(user yêu cầu, số cần cho cap)
        int actualPointsUsed = (int) Math.min(pointsToRedeem, pointsNeededForCap);
        // Sanity: nếu sau cap < min_redeem → reject (vé quá nhỏ cho min điểm)
        if (actualPointsUsed < minRedeem) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Đơn này chỉ cần " + actualPointsUsed + " điểm để giảm hết, "
                            + "nhưng tối thiểu phải đổi " + minRedeem
                            + " điểm. Đặt vé giá trị lớn hơn để dùng điểm tích luỹ.");
        }

        deductFromBatchesFifo(fresh.getId(), actualPointsUsed);

        BigDecimal discountAmount = BigDecimal.valueOf((long) actualPointsUsed * redeemValue)
                .min(maxDiscountCap);

        int newBalance = fresh.getLoyaltyPoints() - actualPointsUsed;
        fresh.setLoyaltyPoints(newBalance);
        userRepository.save(fresh);

        loyaltyTransactionRepository.save(LoyaltyTransaction.builder()
                .user(fresh)
                .booking(booking)
                .transactionType(LoyaltyTransactionType.REDEEM)
                .points(-actualPointsUsed)
                .balanceAfter(newBalance)
                .reason("Đặt vé " + booking.getBookingCode() + " — đổi "
                        + actualPointsUsed + " điểm"
                        + (actualPointsUsed < pointsToRedeem
                            ? " (yêu cầu " + pointsToRedeem + ", chỉ cần " + actualPointsUsed + ")"
                            : ""))
                .build());

        log.info("User {} redeemed {} points cho booking {} (yêu cầu {}, balance còn {})",
                fresh.getId(), actualPointsUsed, booking.getBookingCode(),
                pointsToRedeem, newBalance);
        return discountAmount;
    }

    /**
     * Hoàn điểm khi booking cancel/expire — tìm REDEEM tx có booking_id, tạo
     * ADJUST tx cộng lại bằng cùng số điểm.
     *
     * <p>KHÔNG đụng remaining_points batch — điểm hoàn thêm vào loyaltyPoints
     * như "điểm thưởng tự do" (không có batch tracking expiry). Edge case
     * batch đã expire trong thời gian giữ ghế → chấp nhận (cancel trong 10-60p,
     * batch không expire trong khoảng đó).
     *
     * <p>Idempotent: nếu đã có ADJUST refund tx cho booking này, skip — tránh
     * double-refund nếu scheduler retry.
     */
    @Transactional
    public void refundPointsForBooking(Booking booking) {
        if (booking.getUser() == null) return;  // counter-sale
        if (booking.getPointsRedeemed() == null || booking.getPointsRedeemed() <= 0) return;

        // Idempotency: check đã refund chưa
        if (loyaltyTransactionRepository.existsByBookingIdAndTransactionType(
                booking.getId(), LoyaltyTransactionType.ADJUST)) {
            log.info("Booking {} đã refund loyalty trước đó — skip", booking.getBookingCode());
            return;
        }

        int pointsToRefund = booking.getPointsRedeemed();
        User fresh = userRepository.findById(booking.getUser().getId())
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND, "User không tồn tại"));
        int newBalance = fresh.getLoyaltyPoints() + pointsToRefund;
        fresh.setLoyaltyPoints(newBalance);
        userRepository.save(fresh);

        loyaltyTransactionRepository.save(LoyaltyTransaction.builder()
                .user(fresh)
                .booking(booking)
                .transactionType(LoyaltyTransactionType.ADJUST)
                .points(pointsToRefund)
                .balanceAfter(newBalance)
                .reason("Hoàn điểm — hủy vé " + booking.getBookingCode())
                .build());

        log.info("Refunded {} points cho user {} từ booking {} (balance {})",
                pointsToRefund, fresh.getId(), booking.getBookingCode(), newBalance);
    }

    /**
     * Expire 1 batch EARN — trừ điểm còn lại khỏi balance user, log EXPIRE tx.
     * Gọi bởi {@code LoyaltyExpiryScheduler} cho từng batch hết hạn.
     *
     * <p>Cap floor 0 nếu user đã redeem vượt qua batch (data inconsistency,
     * không nên xảy ra với FIFO chính xác — vẫn defensive).
     *
     * <p>{@code lifetimePoints} KHÔNG giảm — hạng giữ vĩnh viễn (industry).
     *
     * @return số điểm đã expire (= remaining lúc gọi)
     */
    @Transactional
    public int expireBatch(LoyaltyTransaction batch) {
        if (batch.getTransactionType() != LoyaltyTransactionType.EARN) {
            throw new IllegalArgumentException("Chỉ expire batch EARN, không phải " + batch.getTransactionType());
        }
        int expiringPoints = batch.getRemainingPoints() != null ? batch.getRemainingPoints() : 0;
        if (expiringPoints <= 0) return 0;

        User user = userRepository.findById(batch.getUser().getId())
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND, "User không tồn tại"));
        int newBalance = Math.max(0, user.getLoyaltyPoints() - expiringPoints);
        user.setLoyaltyPoints(newBalance);
        userRepository.save(user);

        batch.setRemainingPoints(0);
        loyaltyTransactionRepository.save(batch);

        loyaltyTransactionRepository.save(LoyaltyTransaction.builder()
                .user(user)
                .transactionType(LoyaltyTransactionType.EXPIRE)
                .points(-expiringPoints)
                .balanceAfter(newBalance)
                .reason("Hết hạn — batch tích ngày " + batch.getCreatedAt().toLocalDate())
                .build());

        log.info("User {} expired {} points from batch {} (created {}, balance now {})",
                user.getId(), expiringPoints, batch.getId(), batch.getCreatedAt(), newBalance);
        return expiringPoints;
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
