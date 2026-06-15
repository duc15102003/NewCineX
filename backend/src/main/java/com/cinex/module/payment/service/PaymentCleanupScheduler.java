package com.cinex.module.payment.service;

import com.cinex.module.config.service.SystemConfigService;
import com.cinex.module.payment.entity.Payment;
import com.cinex.module.payment.entity.PaymentStatus;
import com.cinex.module.payment.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Auto-fail payment kẹt PENDING quá lâu — pattern industry chuẩn (Vista
 * Veezi / Cinetixx). Lý do payment kẹt: user mở MoMo app nhưng không thanh
 * toán + tắt app; callback IPN network fail; MoMo downtime.
 *
 * <p>Không cleanup → payment stuck PENDING vĩnh viễn, kéo theo booking
 * HOLDING không expire đúng giờ (vì có payment đang chờ).
 *
 * <p>Run mỗi 60s, ShedLock chặn 2 instance chạy cùng nhau. Default 30 phút
 * (cấu hình qua system_config {@code payment.pending_cleanup_minutes}).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class PaymentCleanupScheduler {

    private final PaymentRepository paymentRepository;
    private final SystemConfigService systemConfigService;

    @Scheduled(fixedRate = 60_000)
    @SchedulerLock(name = "paymentCleanup", lockAtLeastFor = "PT30S", lockAtMostFor = "PT5M")
    @Transactional
    public void cleanupStuckPending() {
        int cleanupMinutes = systemConfigService.getInt("payment.pending_cleanup_minutes", 30);
        LocalDateTime expireBefore = LocalDateTime.now().minusMinutes(cleanupMinutes);

        List<Payment> stuck = paymentRepository.findByStatusAndCreatedAtBefore(
                PaymentStatus.PENDING, expireBefore);

        if (stuck.isEmpty()) return;

        int failed = 0;
        for (Payment p : stuck) {
            try {
                p.setStatus(PaymentStatus.FAILED);
                paymentRepository.save(p);
                log.info("Auto-failed payment {} kẹt PENDING > {} phút", p.getTransactionCode(), cleanupMinutes);
                failed++;
            } catch (Exception e) {
                log.error("Lỗi auto-fail payment {}: {}", p.getTransactionCode(), e.getMessage());
            }
        }
        log.info("PaymentCleanup: auto-failed {}/{} payment kẹt PENDING (> {} phút)",
                failed, stuck.size(), cleanupMinutes);
    }
}
