package com.cinex.module.auth.service;

import com.cinex.module.auth.repository.EmailVerificationTokenRepository;
import com.cinex.module.auth.repository.PasswordResetTokenRepository;
import com.cinex.module.auth.repository.RefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * [Scheduled Task] Cleanup token đã hết hạn để giữ bảng auth gọn nhẹ.
 *
 * <p><b>Vì sao cần?</b><br>
 * - refresh_tokens: mỗi lần login + rotate → 1 row mới. Sau vài tháng có thể
 *   tích hàng triệu row → query findByToken chậm dù có index.<br>
 * - password_reset_tokens: thường được dùng 1 lần rồi quên → tích lũy rác.
 *
 * <p><b>Vì sao không xóa ngay khi expire?</b><br>
 * - Giữ 30 ngày sau khi expire (refresh) / 7 ngày (reset) để audit khi user
 *   báo "có ai đăng nhập vào account tôi", admin xem được lịch sử token.
 *
 * <p><b>Tần suất:</b> 1 lần / ngày lúc 03:00 — giờ traffic thấp nhất.
 *
 * <p><b>@SchedulerLock:</b> tránh nhiều instance cùng DELETE → contention DB.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class CleanupTokenScheduler {

    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final EmailVerificationTokenRepository emailVerificationTokenRepository;

    /**
     * Số ngày giữ lại refresh token đã hết hạn (cho audit).
     * Cutoff = now - REFRESH_RETENTION_DAYS → token expire trước cutoff sẽ bị xóa.
     */
    private static final int REFRESH_RETENTION_DAYS = 30;

    /**
     * Số ngày giữ lại password reset token đã hết hạn.
     * Token reset TTL ngắn (15p) nên 7 ngày là quá đủ.
     */
    private static final int RESET_RETENTION_DAYS = 7;

    /**
     * Số ngày giữ lại email verification token đã hết hạn.
     * Token verify TTL 24h → 7 ngày sau expire đủ cho audit.
     */
    private static final int EMAIL_VERIFY_RETENTION_DAYS = 7;

    /**
     * Chạy 03:00 mỗi ngày. Cron: "0 0 3 * * *" (giây phút giờ ngày tháng thứ).
     */
    @Scheduled(cron = "0 0 3 * * *")
    @SchedulerLock(name = "cleanupTokens", lockAtLeastFor = "PT1M", lockAtMostFor = "PT15M")
    @Transactional
    public void cleanupExpiredTokens() {
        LocalDateTime refreshCutoff = LocalDateTime.now().minusDays(REFRESH_RETENTION_DAYS);
        int refreshDeleted = refreshTokenRepository.deleteByExpiryDateBefore(refreshCutoff);
        if (refreshDeleted > 0) {
            log.info("[CleanupTokenScheduler] Đã xóa {} refresh token expire trước {}",
                    refreshDeleted, refreshCutoff);
        }

        LocalDateTime resetCutoff = LocalDateTime.now().minusDays(RESET_RETENTION_DAYS);
        int resetDeleted = passwordResetTokenRepository.deleteByExpiryDateBefore(resetCutoff);
        if (resetDeleted > 0) {
            log.info("[CleanupTokenScheduler] Đã xóa {} password reset token expire trước {}",
                    resetDeleted, resetCutoff);
        }

        LocalDateTime verifyCutoff = LocalDateTime.now().minusDays(EMAIL_VERIFY_RETENTION_DAYS);
        int verifyDeleted = emailVerificationTokenRepository.deleteByExpiryDateBefore(verifyCutoff);
        if (verifyDeleted > 0) {
            log.info("[CleanupTokenScheduler] Đã xóa {} email verification token expire trước {}",
                    verifyDeleted, verifyCutoff);
        }

        if (refreshDeleted == 0 && resetDeleted == 0 && verifyDeleted == 0) {
            log.debug("[CleanupTokenScheduler] Không có token nào cần xóa");
        }
    }
}
