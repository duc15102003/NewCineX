package com.cinex.module.loyalty.service;

import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.common.response.PageResponse;
import com.cinex.module.auth.entity.User;
import com.cinex.module.auth.repository.UserRepository;
import com.cinex.module.config.service.SystemConfigService;
import com.cinex.module.loyalty.dto.LoyaltyAccountResponse;
import com.cinex.module.loyalty.dto.LoyaltyTransactionResponse;
import com.cinex.module.loyalty.entity.LoyaltyTier;
import com.cinex.module.loyalty.entity.LoyaltyTransaction;
import com.cinex.module.loyalty.entity.LoyaltyTransactionType;
import com.cinex.module.loyalty.repository.LoyaltyTransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Query-side service cho Loyalty — đọc account + history.
 *
 * <p><b>SOLID — Dependency Inversion:</b> Controller chỉ inject Service này, không inject
 * Repository trực tiếp. Tách khỏi {@link LoyaltyService} (mutation: earn/redeem) theo
 * pattern CQRS-lite — read và write trách nhiệm khác nhau.
 *
 * <p>Trách nhiệm:
 * <ul>
 *   <li>Lookup user theo username (từ auth context)</li>
 *   <li>Tính tier progress (points to next tier)</li>
 *   <li>Map LoyaltyTransaction entity → DTO</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class LoyaltyQueryService {

    private final UserRepository userRepository;
    private final LoyaltyTransactionRepository loyaltyTransactionRepository;
    private final SystemConfigService systemConfigService;

    /**
     * Lấy trạng thái loyalty + progress của user theo username (auth context).
     */
    @Transactional(readOnly = true)
    public LoyaltyAccountResponse getAccountByUsername(String username) {
        User user = loadUserOrThrow(username);

        LoyaltyTier currentTier = user.getTier();
        LoyaltyTier nextTier = nextTier(currentTier);
        Integer nextThreshold = nextTier == null ? null : tierThreshold(nextTier);
        Integer pointsToNext = nextThreshold == null
                ? null
                : Math.max(0, nextThreshold - user.getLifetimePoints());

        // Điểm sắp hết hạn 30 ngày tới — warning UI "dùng ngay kẻo phí".
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime in30Days = now.plusDays(30);
        Integer expiringIn30 = loyaltyTransactionRepository.sumPointsExpiringInWindow(
                user.getId(), LoyaltyTransactionType.EARN, now, in30Days);
        LocalDateTime nearestExpiry = loyaltyTransactionRepository.findNearestExpiryDate(
                user.getId(), LoyaltyTransactionType.EARN, now);

        return LoyaltyAccountResponse.builder()
                .loyaltyPoints(user.getLoyaltyPoints())
                .lifetimePoints(user.getLifetimePoints())
                .tier(currentTier)
                .nextTier(nextTier)
                .nextTierThreshold(nextThreshold)
                .pointsToNextTier(pointsToNext)
                .pointsExpiringIn30Days(expiringIn30 != null ? expiringIn30 : 0)
                .nearestExpiryDate(nearestExpiry)
                .build();
    }

    /**
     * Lịch sử transaction của user — phân trang, sort created_at DESC.
     */
    @Transactional(readOnly = true)
    public PageResponse<LoyaltyTransactionResponse> getTransactionsByUsername(
            String username, int page, int size) {
        User user = loadUserOrThrow(username);

        Page<LoyaltyTransaction> txs = loyaltyTransactionRepository
                .findByUserIdOrderByCreatedAtDesc(user.getId(), PageRequest.of(page, size));

        Page<LoyaltyTransactionResponse> mapped = txs.map(tx -> LoyaltyTransactionResponse.builder()
                .id(tx.getId())
                .transactionType(tx.getTransactionType())
                .points(tx.getPoints())
                .balanceAfter(tx.getBalanceAfter())
                .reason(tx.getReason())
                .bookingCode(tx.getBooking() != null ? tx.getBooking().getBookingCode() : null)
                .createdAt(tx.getCreatedAt())
                .build());
        return PageResponse.from(mapped);
    }

    // ──────────────── Helpers ────────────────

    private User loadUserOrThrow(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "User không tồn tại"));
    }

    private LoyaltyTier nextTier(LoyaltyTier current) {
        return switch (current) {
            case STANDARD -> LoyaltyTier.SILVER;
            case SILVER -> LoyaltyTier.GOLD;
            case GOLD -> LoyaltyTier.PLATINUM;
            case PLATINUM -> null;
        };
    }

    private Integer tierThreshold(LoyaltyTier tier) {
        return switch (tier) {
            case SILVER -> systemConfigService.getInt("loyalty.tier.silver_threshold", 1000);
            case GOLD -> systemConfigService.getInt("loyalty.tier.gold_threshold", 5000);
            case PLATINUM -> systemConfigService.getInt("loyalty.tier.platinum_threshold", 20000);
            case STANDARD -> 0;
        };
    }
}
