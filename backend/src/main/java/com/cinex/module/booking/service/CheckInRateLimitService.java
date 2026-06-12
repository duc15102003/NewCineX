package com.cinex.module.booking.service;

import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.module.config.service.SystemConfigService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

/**
 * Rate limit check-in để chống brute-force bookingCode (CX-YYYYMMDD-NNN).
 *
 * <p><b>Vì sao?</b> Endpoint check-in yêu cầu role ADMIN, nhưng nếu staff/admin
 * credential bị leak → attacker có thể đoán bookingCode (chỉ 3 digit NNN ~ 1000
 * khả năng/ngày) để gate-crash. qrToken 32-char random thì không brute được.
 *
 * <p><b>Cách hoạt động:</b>
 * <ul>
 *   <li>Đếm số lần check-in failed (BOOKING_NOT_FOUND) theo IP.</li>
 *   <li>Sau {@code maxAttempts} lần fail/cửa sổ → block IP trong N phút.</li>
 *   <li>Reset counter khi check-in success.</li>
 * </ul>
 *
 * <p>Threshold cao hơn login (mặc định 60 fails/15 phút) vì staff quét QR thật
 * có thể trượt nhiều lần, lỗi mạng, scanner đọc sai... Mục đích là chặn
 * brute-force tự động, không cản trở use case bình thường.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CheckInRateLimitService {

    private final StringRedisTemplate redis;
    private final SystemConfigService systemConfigService;

    private static final String KEY_PREFIX_IP = "checkin:fail:ip:";

    /**
     * Check trước khi xử lý check-in — throw nếu IP đang bị block.
     * Gọi đầu method checkIn() / previewCheckIn() / rejectCheckIn().
     */
    public void checkBlockedByIp(String ip) {
        if (ip == null || ip.isBlank()) return;

        String key = KEY_PREFIX_IP + ip;
        String value = redis.opsForValue().get(key);
        int attempts = (value == null) ? 0 : parseIntSafe(value);
        int maxAttempts = systemConfigService.getInt("checkin.max_fails_per_ip", 60);

        if (attempts >= maxAttempts) {
            int blockMinutes = systemConfigService.getInt("checkin.block_minutes", 15);
            log.warn("Check-in blocked for IP {} — {} attempts (max {})", ip, attempts, maxAttempts);
            throw new BusinessException(ErrorCode.TOO_MANY_LOGIN_ATTEMPTS,
                    String.format("IP của bạn đã thử check-in sai quá nhiều, vui lòng thử lại sau %d phút", blockMinutes));
        }
    }

    /**
     * Ghi nhận 1 lần check-in fail (BOOKING_NOT_FOUND) → INCR counter IP.
     * TTL set ở lần fail đầu để tránh reset window mỗi lần fail.
     */
    public void recordFailByIp(String ip) {
        if (ip == null || ip.isBlank()) return;

        String key = KEY_PREFIX_IP + ip;
        Long attempts = redis.opsForValue().increment(key);

        if (attempts != null && attempts == 1L) {
            int blockMinutes = systemConfigService.getInt("checkin.block_minutes", 15);
            redis.expire(key, Duration.ofMinutes(blockMinutes));
        }

        log.info("Check-in fail #{} for IP {}", attempts, ip);
    }

    /** Xóa counter khi check-in success — staff được làm lại từ đầu. */
    public void clearFails(String ip) {
        if (ip == null || ip.isBlank()) return;
        redis.delete(KEY_PREFIX_IP + ip);
    }

    private int parseIntSafe(String value) {
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}
