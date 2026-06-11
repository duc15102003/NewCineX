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
 * Rate limit endpoint /api/auth/verify-email — chống brute force token + reset-password token.
 *
 * <p><b>Tại sao cần?</b> Endpoint nhận token từ URL query param và lookup DB. Không rate limit
 * → attacker spam random tokens để:
 * <ol>
 *   <li>Brute force token hợp lệ (token UUID 36 ký tự có ~10^38 tổ hợp, brute mất tỷ năm,
 *       NHƯNG nếu chỉ rate-limit weakly thì có thể vẫn thử được vài tỷ lần/ngày → giảm
 *       entropy effective);</li>
 *   <li>DoS DB qua mỗi request là 1 query findByToken;</li>
 *   <li>Enumeration: thử nhiều token, log warning ở BE → biết khi nào có token thật.</li>
 * </ol>
 *
 * <p>Chỉ rate-limit theo IP (vì verify-email/reset-password không có email param public —
 * token trong URL coi là opaque).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class EmailVerifyRateLimitService {

    private final StringRedisTemplate redis;
    private final SystemConfigService systemConfigService;

    private static final String KEY_PREFIX_IP = "tokenverify:ip:";

    public void checkBlockedByIp(String ip) {
        if (ip == null || ip.isBlank()) return;

        String key = KEY_PREFIX_IP + ip;
        int attempts = readCounter(key);
        int max = systemConfigService.getInt("auth.token_verify_max_per_ip", 30);

        if (attempts >= max) {
            int windowMinutes = systemConfigService.getInt("auth.token_verify_window_minutes", 60);
            log.warn("Token-verify blocked for IP {} — {} attempts (max {})", ip, attempts, max);
            throw new BusinessException(ErrorCode.TOO_MANY_LOGIN_ATTEMPTS,
                    String.format("IP của bạn đã thử quá nhiều token, vui lòng đợi %d phút", windowMinutes));
        }
    }

    public void recordAttemptByIp(String ip) {
        if (ip == null || ip.isBlank()) return;
        String key = KEY_PREFIX_IP + ip;
        Long attempts = redis.opsForValue().increment(key);
        if (attempts != null && attempts == 1L) {
            int windowMinutes = systemConfigService.getInt("auth.token_verify_window_minutes", 60);
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
}
