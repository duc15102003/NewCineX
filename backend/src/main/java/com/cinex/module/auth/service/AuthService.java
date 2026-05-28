package com.cinex.module.auth.service;

import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.common.service.EmailService;
import com.cinex.module.config.service.SystemConfigService;
import com.cinex.common.util.SecurityUtil;
import com.cinex.module.auth.dto.AuthResponse;
import com.cinex.module.auth.dto.ForgotPasswordRequest;
import com.cinex.module.auth.dto.LoginRequest;
import com.cinex.module.auth.dto.RefreshTokenRequest;
import com.cinex.module.auth.dto.RegisterRequest;
import com.cinex.module.auth.dto.ResetPasswordRequest;
import com.cinex.module.auth.entity.PasswordResetToken;
import com.cinex.module.auth.entity.RefreshToken;
import com.cinex.module.auth.entity.User;
import com.cinex.module.auth.repository.PasswordResetTokenRepository;
import com.cinex.module.auth.repository.UserRepository;
import com.cinex.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final RefreshTokenService refreshTokenService;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final EmailService emailService;
    private final SystemConfigService systemConfigService;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new BusinessException(ErrorCode.USER_EXISTED, "Tên đăng nhập đã được sử dụng");
        }
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new BusinessException(ErrorCode.USER_EXISTED, "Email đã được sử dụng");
        }

        User user = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName())
                .build();

        userRepository.save(user);

        return buildAuthResponse(user);
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        // Dùng findActiveByUsername → user đã soft delete không login được
        User user = userRepository.findActiveByUsername(request.getUsername())
                .orElseThrow(() -> new BusinessException(ErrorCode.INVALID_CREDENTIALS));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new BusinessException(ErrorCode.INVALID_CREDENTIALS);
        }

        if (!user.isEnabled()) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Tài khoản đã bị vô hiệu hóa");
        }

        return buildAuthResponse(user);
    }

    /**
     * Refresh token rotation: tạo access token MỚI + refresh token MỚI.
     * Token cũ bị revoke ngay → nếu bị lộ, attacker không dùng lại được.
     */
    @Transactional
    public AuthResponse refreshToken(RefreshTokenRequest request) {
        RefreshToken oldToken = refreshTokenService.validateRefreshToken(request.getRefreshToken());
        User user = oldToken.getUser();

        // Revoke token cũ + tạo token mới (rotation)
        refreshTokenService.revokeAllUserTokens(user.getId());
        RefreshToken newToken = refreshTokenService.createRefreshToken(user);

        String accessToken = jwtUtil.generateToken(user.getUsername(), Map.of("role", user.getRole().name()));

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(newToken.getToken())
                .expiresIn(jwtUtil.getExpirationMs() / 1000)
                .build();
    }

    /**
     * Logout — revoke tất cả refresh token.
     * Client cần xóa token khỏi localStorage sau khi gọi.
     */
    @Transactional
    public void logout() {
        String username = SecurityUtil.getCurrentUsername();
        User user = userRepository.findActiveByUsername(username)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
        refreshTokenService.revokeAllUserTokens(user.getId());
        log.info("User {} logged out", username);
    }

    /**
     * Quên mật khẩu — tạo token + gửi email.
     * KHÔNG báo lỗi nếu email không tồn tại → tránh lộ email đã đăng ký (security).
     */
    @Transactional
    public void forgotPassword(ForgotPasswordRequest request) {
        userRepository.findByEmail(request.getEmail()).ifPresent(user -> {
            String token = UUID.randomUUID().toString();
            PasswordResetToken resetToken = PasswordResetToken.builder()
                    .user(user)
                    .token(token)
                    .expiryDate(LocalDateTime.now().plusMinutes(
                            systemConfigService.getInt("auth.reset_token_expiry_minutes", 15)))
                    .build();
            passwordResetTokenRepository.save(resetToken);
            int expiryMinutes = systemConfigService.getInt("auth.reset_token_expiry_minutes", 15);
            emailService.sendResetPasswordEmail(user.getEmail(), token, expiryMinutes);
            log.info("Password reset token created for {}", user.getUsername());
        });
    }

    /**
     * Reset mật khẩu — validate token → đổi password → revoke tokens.
     */
    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new BusinessException(ErrorCode.INVALID_PASSWORD,
                    "Mật khẩu mới và xác nhận mật khẩu không khớp");
        }

        PasswordResetToken resetToken = passwordResetTokenRepository
                .findByTokenAndUsedFalse(request.getToken())
                .orElseThrow(() -> new BusinessException(ErrorCode.INVALID_REQUEST,
                        "Token không hợp lệ hoặc đã được sử dụng"));

        if (resetToken.isExpired()) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST, "Token đặt lại mật khẩu đã hết hạn");
        }

        User user = resetToken.getUser();

        // Không cho đặt password mới trùng password cũ
        if (passwordEncoder.matches(request.getNewPassword(), user.getPassword())) {
            throw new BusinessException(ErrorCode.INVALID_PASSWORD, "Mật khẩu mới phải khác mật khẩu cũ");
        }

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        resetToken.setUsed(true);
        passwordResetTokenRepository.save(resetToken);

        refreshTokenService.revokeAllUserTokens(user.getId());
        log.info("Password reset for {}", user.getUsername());
    }

    private AuthResponse buildAuthResponse(User user) {
        String accessToken = jwtUtil.generateToken(user.getUsername(), Map.of("role", user.getRole().name()));

        refreshTokenService.revokeAllUserTokens(user.getId());
        RefreshToken refreshToken = refreshTokenService.createRefreshToken(user);

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken.getToken())
                .expiresIn(jwtUtil.getExpirationMs() / 1000)
                .build();
    }
}
