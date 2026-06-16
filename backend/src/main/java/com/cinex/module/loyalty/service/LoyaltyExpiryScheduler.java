package com.cinex.module.loyalty.service;

import com.cinex.module.loyalty.entity.LoyaltyTransaction;
import com.cinex.module.loyalty.entity.LoyaltyTransactionType;
import com.cinex.module.loyalty.repository.LoyaltyTransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Scheduler hết hạn điểm tích — chạy mỗi đêm 2h sáng.
 *
 * <p>Industry pattern (CGV/Lotte/BHD): điểm tích EARN có hạn 12 tháng. Mỗi đợt
 * (batch) sau X tháng từ ngày tích, nếu còn {@code remaining_points > 0} thì:
 * <ol>
 *   <li>Trừ remaining khỏi {@code user.loyaltyPoints} (cap floor 0)</li>
 *   <li>Set batch.remaining = 0 để không reprocess</li>
 *   <li>Log EXPIRE transaction với balanceAfter snapshot</li>
 * </ol>
 *
 * <p>Lifetime points KHÔNG bị giảm — tier giữ vĩnh viễn.
 *
 * <p>Batch processing 500 record/lần để tránh memory spike. Chạy lại lần tới
 * sẽ pick batch còn lại — eventually consistent.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class LoyaltyExpiryScheduler {

    private static final int BATCH_SIZE = 500;

    private final LoyaltyTransactionRepository loyaltyTransactionRepository;
    private final LoyaltyService loyaltyService;

    /**
     * Chạy lúc 2h sáng mỗi ngày (low traffic). Cron: {@code 0 0 2 * * *}.
     * SchedulerLock 30 phút để 1 instance duy nhất xử lý (multi-instance safe).
     */
    @Scheduled(cron = "0 0 2 * * *")
    @SchedulerLock(name = "loyaltyExpiry", lockAtLeastFor = "PT5M", lockAtMostFor = "PT30M")
    public void runExpiry() {
        LocalDateTime now = LocalDateTime.now();
        List<LoyaltyTransaction> expiredBatches = loyaltyTransactionRepository
                .findExpiredBatchesNotYetProcessed(LoyaltyTransactionType.EARN, now, PageRequest.of(0, BATCH_SIZE));

        if (expiredBatches.isEmpty()) {
            log.debug("[LoyaltyExpiry] Không có batch nào hết hạn");
            return;
        }

        int expiredCount = 0;
        int totalPointsExpired = 0;
        for (LoyaltyTransaction batch : expiredBatches) {
            try {
                // Mỗi batch 1 transaction riêng — fail 1 batch không kill cả run
                int expired = loyaltyService.expireBatch(batch);
                if (expired > 0) {
                    expiredCount++;
                    totalPointsExpired += expired;
                }
            } catch (Exception e) {
                log.warn("[LoyaltyExpiry] Lỗi expire batch {} của user {}: {}",
                        batch.getId(),
                        batch.getUser() != null ? batch.getUser().getId() : "?",
                        e.getMessage());
            }
        }
        log.info("[LoyaltyExpiry] Hết hạn {} batch, tổng {} điểm (batch size limit {})",
                expiredCount, totalPointsExpired, BATCH_SIZE);
    }
}
