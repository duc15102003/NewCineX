package com.cinex.module.auth.service;

import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.module.auth.entity.RefreshToken;
import com.cinex.module.auth.entity.User;
import com.cinex.module.auth.repository.RefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class RefreshTokenService {

    private final RefreshTokenRepository refreshTokenRepository;

    @Value("${app.jwt.refresh-expiration-ms:604800000}")
    private long refreshExpirationMs;

    @Transactional
    public RefreshToken createRefreshToken(User user) {
        RefreshToken refreshToken = RefreshToken.builder()
                .user(user)
                .token(UUID.randomUUID().toString())
                .expiryDate(LocalDateTime.now().plusSeconds(refreshExpirationMs / 1000))
                .build();
        return refreshTokenRepository.save(refreshToken);
    }

    /**
     * Validate refresh token + phát hiện REUSE.
     *
     * Reuse detection:
     * - Nếu token KHÔNG tồn tại trong DB → invalid bình thường.
     * - Nếu token tồn tại NHƯNG đã revoked → đây là dấu hiệu attacker dùng lại
     *   token đã rotate. Trong rotation flow, mỗi refresh token chỉ được dùng 1 lần,
     *   sau đó bị revoke. Nếu thấy token revoked được dùng lại → ai đó đã copy token.
     *   Phản ứng: revoke TẤT CẢ token của user đó + log WARN + throw lỗi.
     */
    @Transactional
    public RefreshToken validateRefreshToken(String token) {
        Optional<RefreshToken> opt = refreshTokenRepository.findByToken(token);

        if (opt.isEmpty()) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED,
                    "Refresh token không hợp lệ hoặc đã bị thu hồi");
        }

        RefreshToken refreshToken = opt.get();

        // Reuse detection: token tồn tại nhưng đã revoke → nghi ngờ bị lộ
        if (refreshToken.isRevoked()) {
            Long userId = refreshToken.getUser().getId();
            String username = refreshToken.getUser().getUsername();
            log.warn("Suspected refresh token reuse for user {} (id={}). Revoking all refresh tokens.",
                    username, userId);
            refreshTokenRepository.revokeAllByUserId(userId);
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Phát hiện refresh token bị tái sử dụng, mọi phiên đã bị thu hồi");
        }

        if (refreshToken.isExpired()) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "Refresh token đã hết hạn");
        }

        return refreshToken;
    }

    /**
     * Revoke TẤT CẢ refresh token của user (logout, reset password, change password).
     */
    @Transactional
    public void revokeAllUserTokens(Long userId) {
        refreshTokenRepository.revokeAllByUserId(userId);
    }

    /**
     * Revoke 1 refresh token cụ thể (rotation: chỉ revoke token CŨ vừa dùng).
     * Cho phép multi-device: device khác vẫn còn token valid của chúng.
     */
    @Transactional
    public void revokeToken(String token) {
        refreshTokenRepository.revokeByToken(token);
    }
}
