package com.cinex.module.auth.service;

import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.common.service.EmailService;
import com.cinex.common.util.ClientIpUtil;
import com.cinex.module.config.service.SystemConfigService;
import com.cinex.common.util.SecurityUtil;
import com.cinex.module.auth.dto.AuthResponse;
import com.cinex.module.auth.dto.ForgotPasswordRequest;
import com.cinex.module.auth.dto.LoginRequest;
import com.cinex.module.auth.dto.RefreshTokenRequest;
import com.cinex.module.auth.dto.RegisterRequest;
import com.cinex.module.auth.dto.ResetPasswordRequest;
import com.cinex.module.auth.entity.EmailVerificationToken;
import com.cinex.module.auth.entity.PasswordResetToken;
import com.cinex.module.auth.entity.RefreshToken;
import com.cinex.module.auth.entity.User;
import com.cinex.module.auth.repository.EmailVerificationTokenRepository;
import com.cinex.module.auth.repository.PasswordResetTokenRepository;
import com.cinex.module.auth.repository.UserRepository;
import com.cinex.security.JwtBlacklistService;
import com.cinex.security.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Locale;
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
    private final EmailVerificationTokenRepository emailVerificationTokenRepository;
    private final EmailService emailService;
    private final SystemConfigService systemConfigService;
    private final LoginRateLimitService loginRateLimitService;
    private final ForgotPasswordRateLimitService forgotPasswordRateLimitService;
    private final EmailVerifyRateLimitService emailVerifyRateLimitService;
    private final JwtBlacklistService jwtBlacklistService;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        // Normalize: trim + lowercase để tránh trùng "User@A.com" vs "user@a.com"
        String normalizedUsername = request.getUsername().trim().toLowerCase(Locale.ROOT);
        String normalizedEmail = request.getEmail().trim().toLowerCase(Locale.ROOT);

        if (userRepository.existsByUsername(normalizedUsername)) {
            throw new BusinessException(ErrorCode.USER_EXISTED, "Tên đăng nhập đã được sử dụng");
        }
        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new BusinessException(ErrorCode.USER_EXISTED, "Email đã được sử dụng");
        }

        User user = User.builder()
                .username(normalizedUsername)
                .email(normalizedEmail)
                .password(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName())
                .enabled(true)         // Vẫn cho login ngay sau register
                .emailVerified(false)  // Chưa verify → FE có thể chặn action quan trọng
                .build();

        userRepository.save(user);

        // Tạo token verify email (TTL 24h) → gửi email với link verify.
        int expiryHours = systemConfigService.getInt("auth.email_verification_expiry_hours", 24);
        String token = UUID.randomUUID().toString();
        EmailVerificationToken verificationToken = EmailVerificationToken.builder()
                .user(user)
                .token(token)
                .expiryDate(LocalDateTime.now().plusHours(expiryHours))
                .build();
        emailVerificationTokenRepository.save(verificationToken);
        emailService.sendVerificationEmail(user.getEmail(), token, expiryHours);
        log.info("Email verification token created for {}", user.getUsername());

        return buildAuthResponse(user);
    }

    /**
     * Xác thực email — validate token → set user.emailVerified = true → đánh dấu token used.
     * Idempotent: nếu user đã verify rồi, gọi lại với token used sẽ throw lỗi token invalid.
     */
    @Transactional
    public void verifyEmail(String token, HttpServletRequest httpRequest) {
        // Rate-limit theo IP — chống brute force token + DoS DB qua spam request
        String ip = ClientIpUtil.resolve(httpRequest);
        emailVerifyRateLimitService.checkBlockedByIp(ip);
        emailVerifyRateLimitService.recordAttemptByIp(ip);

        EmailVerificationToken verificationToken = emailVerificationTokenRepository
                .findByTokenAndUsedFalse(token)
                .orElseThrow(() -> new BusinessException(ErrorCode.INVALID_REQUEST,
                        "Token xác thực không hợp lệ hoặc đã được sử dụng"));

        if (verificationToken.isExpired()) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Token xác thực đã hết hạn");
        }

        User user = verificationToken.getUser();
        user.setEmailVerified(true);
        userRepository.save(user);

        verificationToken.setUsed(true);
        emailVerificationTokenRepository.save(verificationToken);

        log.info("Email verified for user {}", user.getUsername());
    }

    @Transactional
    public AuthResponse login(LoginRequest request, HttpServletRequest httpRequest) {
        String username = request.getUsername();
        String ip = ClientIpUtil.resolve(httpRequest);

        // Chặn brute force: nếu username HOẶC IP đang bị Redis rate-limit → throw 429 sớm
        loginRateLimitService.checkBlocked(username);
        loginRateLimitService.checkBlockedByIp(ip);

        // Dùng findActiveByUsername → user đã soft delete không login được
        User user = userRepository.findActiveByUsername(username)
                .orElseThrow(() -> {
                    // Username không tồn tại cũng tính là 1 lần fail (chống enum username)
                    loginRateLimitService.recordFail(username);
                    loginRateLimitService.recordFailByIp(ip);
                    return new BusinessException(ErrorCode.INVALID_CREDENTIALS);
                });

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            loginRateLimitService.recordFail(username);
            loginRateLimitService.recordFailByIp(ip);
            throw new BusinessException(ErrorCode.INVALID_CREDENTIALS);
        }

        if (!user.isEnabled()) {
            // Account disabled — password đúng nên KHÔNG tính fail (tránh oan cho user)
            throw new BusinessException(ErrorCode.FORBIDDEN, "Tài khoản đã bị vô hiệu hóa");
        }

        // Login thành công → reset counter username (KHÔNG reset counter IP — xem javadoc service)
        loginRateLimitService.clearFails(username);

        return buildAuthResponse(user);
    }

    /**
     * Refresh token rotation: tạo access token MỚI + refresh token MỚI.
     *
     * Multi-device safe: CHỈ revoke token CŨ vừa dùng, KHÔNG revoke tất cả token của user.
     * → User đăng nhập laptop + điện thoại đồng thời → 2 device đều giữ session riêng.
     *
     * Reuse detection nằm trong validateRefreshToken() → nếu token bị revoked đã được dùng
     * tiếp lần nữa, service sẽ revoke TẤT CẢ token + throw.
     */
    @Transactional
    public AuthResponse refreshToken(RefreshTokenRequest request) {
        RefreshToken oldToken = refreshTokenService.validateRefreshToken(request.getRefreshToken());
        User user = oldToken.getUser();

        // Revoke CHỈ token cũ + tạo token mới (rotation)
        refreshTokenService.revokeToken(oldToken.getToken());
        RefreshToken newToken = refreshTokenService.createRefreshToken(user);

        String accessToken = jwtUtil.generateToken(user.getUsername(), buildJwtClaims(user));

        return buildAuthResponseWithToken(user, accessToken, newToken.getToken());
    }

    /**
     * Logout — revoke tất cả refresh token (kill mọi device của user này) +
     * blacklist access token hiện tại (tránh access token còn hạn vẫn dùng được).
     * Client cần xóa token khỏi localStorage sau khi gọi.
     */
    @Transactional
    public void logout(HttpServletRequest httpRequest) {
        String username = SecurityUtil.getCurrentUsername();
        User user = userRepository.findActiveByUsername(username)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
        refreshTokenService.revokeAllUserTokens(user.getId());

        // Blacklist access token hiện tại — nếu user logout xong attacker dùng lại token
        // cũ vẫn bị reject ở JwtAuthFilter (cho tới khi token hết hạn tự nhiên).
        String accessToken = extractBearerToken(httpRequest);
        if (accessToken != null) {
            jwtBlacklistService.blacklist(accessToken);
        }
        log.info("User {} logged out", username);
    }

    /**
     * Lấy access token từ header "Authorization: Bearer ...".
     * Trả null nếu không có hoặc sai format → caller tự xử lý (skip blacklist).
     */
    private String extractBearerToken(HttpServletRequest request) {
        if (request == null) return null;
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) return null;
        return authHeader.substring(7);
    }

    /**
     * Quên mật khẩu — tạo token + gửi email.
     * KHÔNG báo lỗi nếu email không tồn tại → tránh lộ email đã đăng ký (security).
     *
     * Rate limit (chống spam email + chống enum email):
     * - Theo email: tối đa N lần / window (mặc định 3 lần / 60 phút)
     * - Theo IP: tối đa M lần / window (mặc định 10 lần / 60 phút)
     */
    @Transactional
    public void forgotPassword(ForgotPasswordRequest request, HttpServletRequest httpRequest) {
        String email = request.getEmail().trim().toLowerCase(Locale.ROOT);
        String ip = ClientIpUtil.resolve(httpRequest);

        // Check rate limit TRƯỚC khi query DB → tránh attacker dùng để enum email
        forgotPasswordRateLimitService.checkBlockedByEmail(email);
        forgotPasswordRateLimitService.checkBlockedByIp(ip);

        // Ghi nhận attempt bất kể email có tồn tại hay không (chống enum email)
        forgotPasswordRateLimitService.recordAttemptByEmail(email);
        forgotPasswordRateLimitService.recordAttemptByIp(ip);

        userRepository.findByEmail(email).ifPresent(user -> {
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
     * Rate-limit theo IP — chống brute force reset-token.
     */
    @Transactional
    public void resetPassword(ResetPasswordRequest request, HttpServletRequest httpRequest) {
        String ip = ClientIpUtil.resolve(httpRequest);
        emailVerifyRateLimitService.checkBlockedByIp(ip);
        emailVerifyRateLimitService.recordAttemptByIp(ip);

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
        String accessToken = jwtUtil.generateToken(user.getUsername(), buildJwtClaims(user));
        // Multi-device: chỉ TẠO refresh token mới, KHÔNG revoke token cũ của device khác.
        RefreshToken refreshToken = refreshTokenService.createRefreshToken(user);
        return buildAuthResponseWithToken(user, accessToken, refreshToken.getToken());
    }

    /**
     * Tạo claims cho JWT — include role + theaterId nếu là ADMIN.
     *
     * <p>theaterId trong claim là source-of-truth cho server-side filter
     * (SecurityService đọc claim này, không gọi DB user mỗi request).
     */
    private Map<String, Object> buildJwtClaims(User user) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("role", user.getRole().name());
        if (user.getTheater() != null) {
            // theaterId chỉ có cho ADMIN — null cho USER + SUPER_ADMIN
            claims.put("theaterId", user.getTheater().getId());
        }
        return claims;
    }

    /**
     * Build AuthResponse với metadata về role + theater (FE dùng để render UI).
     */
    private AuthResponse buildAuthResponseWithToken(User user, String accessToken, String refreshToken) {
        var builder = AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .expiresIn(jwtUtil.getExpirationMs() / 1000)
                .username(user.getUsername())
                .role(user.getRole().name());
        if (user.getTheater() != null) {
            builder.theaterId(user.getTheater().getId())
                    .theaterName(user.getTheater().getName())
                    .theaterCity(user.getTheater().getCity());
        }
        return builder.build();
    }

    /* resolveClientIp đã tách sang com.cinex.common.util.ClientIpUtil */
}
