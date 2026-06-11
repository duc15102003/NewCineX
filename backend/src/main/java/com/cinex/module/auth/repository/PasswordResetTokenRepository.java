package com.cinex.module.auth.repository;

import com.cinex.module.auth.entity.PasswordResetToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDateTime;
import java.util.Optional;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {

    Optional<PasswordResetToken> findByTokenAndUsedFalse(String token);

    /**
     * Xóa cứng các password reset token đã hết hạn TRƯỚC mốc thời gian.
     * Token reset thường TTL ngắn (15p) → cutoff = now - 7 ngày là quá đủ
     * cho audit/forensics rồi mới xóa.
     */
    @Modifying
    @Query("DELETE FROM PasswordResetToken prt WHERE prt.expiryDate < :cutoff")
    int deleteByExpiryDateBefore(LocalDateTime cutoff);
}
