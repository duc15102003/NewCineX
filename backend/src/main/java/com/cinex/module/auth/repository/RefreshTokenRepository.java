package com.cinex.module.auth.repository;

import com.cinex.module.auth.entity.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDateTime;
import java.util.Optional;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    /**
     * Tìm token chưa bị revoke — dùng cho validate refresh token (happy path).
     */
    Optional<RefreshToken> findByTokenAndRevokedFalse(String token);

    /**
     * Tìm token KHÔNG quan tâm trạng thái revoked — dùng để phát hiện reuse.
     * Nếu token tồn tại nhưng đã revoked → dấu hiệu attacker dùng lại token đã rotate.
     */
    Optional<RefreshToken> findByToken(String token);

    @Modifying
    @Query("UPDATE RefreshToken rt SET rt.revoked = true WHERE rt.user.id = :userId AND rt.revoked = false")
    void revokeAllByUserId(Long userId);

    /**
     * Revoke 1 refresh token cụ thể (multi-device: chỉ revoke token vừa dùng).
     */
    @Modifying
    @Query("UPDATE RefreshToken rt SET rt.revoked = true WHERE rt.token = :token AND rt.revoked = false")
    void revokeByToken(String token);

    /**
     * Xóa cứng các refresh token đã hết hạn TRƯỚC mốc thời gian truyền vào.
     * Dùng cho job cleanup hàng ngày (vd: xóa token đã expire > 30 ngày).
     * Trả về số dòng bị xóa để log.
     */
    @Modifying
    @Query("DELETE FROM RefreshToken rt WHERE rt.expiryDate < :cutoff")
    int deleteByExpiryDateBefore(LocalDateTime cutoff);
}
