package com.cinex.module.auth.repository;

import com.cinex.module.auth.entity.EmailVerificationToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDateTime;
import java.util.Optional;

public interface EmailVerificationTokenRepository extends JpaRepository<EmailVerificationToken, Long> {

    /**
     * Tìm token còn hợp lệ (chưa used) — dùng cho luồng verify email.
     * Check expiry riêng (xem {@link EmailVerificationToken#isExpired()}).
     */
    Optional<EmailVerificationToken> findByTokenAndUsedFalse(String token);

    /**
     * Xóa cứng các email verification token đã hết hạn TRƯỚC mốc thời gian.
     * Token verify TTL 24h → giữ 7 ngày sau expire là quá đủ cho audit.
     */
    @Modifying
    @Query("DELETE FROM EmailVerificationToken evt WHERE evt.expiryDate < :cutoff")
    int deleteByExpiryDateBefore(LocalDateTime cutoff);
}
