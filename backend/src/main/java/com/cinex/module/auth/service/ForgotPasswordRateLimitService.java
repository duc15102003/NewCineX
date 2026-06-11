package com.cinex.module.auth.service;

import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.module.config.service.SystemConfigService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

/**
 * Rate limit forgot-password — chống spam email + chống enum email.
 *
 * 2 counter song song:
 * - forgot:email:{email}  → 1 email tối đa N lần / window (mặc định 3 / 60 phút)
 * - forgot:ip:{ip}        → 1 IP tối đa M lần / window (mặc định 10 / 60 phút)
 *
 * Vì sao cần?
 * - Không có rate limit → attacker spam endpoint forgot-password để:
 *   1. Spam mailbox của user thật (DoS gián tiếp qua email).
 *   2. Enum email: thử nhiều email, đo response time / volume gửi email → biết email nào tồn tại.
 * - Chống enum: ngay cả khi email không tồn tại trong DB, vẫn ghi nhận attempt
 *   → response time đồng đều, attacker không phân biệt được.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ForgotPasswordRateLimitService {

    private final StringRedisTemplate redis;
    private final SystemConfigService systemConfigService;

    private static final String KEY_PREFIX_EMAIL = "forgot:email:";
    private static final String KEY_PREFIX_IP = "forgot:ip:";

    // ============================================================
    // BY EMAIL
    // ============================================================

    public void checkBlockedByEmail(String email) {
        if (email == null || email.isBlank()) return;

        String key = buildKeyEmail(email);
        int attempts = readCounter(key);
        int max = systemConfigService.getInt("auth.forgot_password_max_per_email", 3);

        if (attempts >= max) {
            int windowMinutes = systemConfigService.getInt("auth.forgot_password_window_minutes", 60);
            log.warn("Forgot-password blocked for email '{}' — {} attempts (max {})", email, attempts, max);
            throw new BusinessException(ErrorCode.TOO_MANY_LOGIN_ATTEMPTS,
                    String.format("Bạn đã yêu cầu đặt lại mật khẩu quá nhiều lần, thử lại sau %d phút", windowMinutes));
        }
    }

    public void recordAttemptByEmail(String email) {
        if (email == null || email.isBlank()) return;
        incrWithTtl(buildKeyEmail(email));
    }

    // ============================================================
    // BY IP
    // ============================================================

    public void checkBlockedByIp(String ip) {
        if (ip == null || ip.isBlank()) return;

        String key = buildKeyIp(ip);
        int attempts = readCounter(key);
        int max = systemConfigService.getInt("auth.forgot_password_max_per_ip", 10);

        if (attempts >= max) {
            int windowMinutes = systemConfigService.getInt("auth.forgot_password_window_minutes", 60);
            log.warn("Forgot-password blocked for IP {} — {} attempts (max {})", ip, attempts, max);
            throw new BusinessException(ErrorCode.TOO_MANY_LOGIN_ATTEMPTS,
                    String.format("IP của bạn đã yêu cầu đặt lại mật khẩu quá nhiều lần, thử lại sau %d phút", windowMinutes));
        }
    }

    public void recordAttemptByIp(String ip) {
        if (ip == null || ip.isBlank()) return;
        incrWithTtl(buildKeyIp(ip));
    }

    // ============================================================
    // Helpers
    // ============================================================

    private void incrWithTtl(String key) {
        Long attempts = redis.opsForValue().increment(key);
        if (attempts != null && attempts == 1L) {
            int windowMinutes = systemConfigService.getInt("auth.forgot_password_window_minutes", 60);
            redis.expire(key, Duration.ofMinutes(windowMinutes));
        }
    }

    private int readCounter(String key) {
        String value = redis.opsForValue().get(key);
        if (value == null) return 0;
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private String buildKeyEmail(String email) {
        return KEY_PREFIX_EMAIL + email.toLowerCase();
    }

    private String buildKeyIp(String ip) {
        return KEY_PREFIX_IP + ip;
    }
}
