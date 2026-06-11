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
 * Rate limit login bằng Redis — chống brute force password.
 *
 * 2 counter song song:
 * - login:fail:{username}    → block 1 username sau N lần fail (mặc định 5/15 phút)
 * - login:fail:ip:{ip}       → block 1 IP sau M lần fail (mặc định 30/15 phút)
 *
 * Vì sao cần CẢ 2 counter?
 * - Counter theo username chống được attacker biết 1 username & spam 1000 password.
 * - Counter theo IP chống được attacker spam nhiều username khác nhau từ 1 botnet IP
 *   (gọi là "credential stuffing" — dùng list email/pass leak từ site khác).
 * - Threshold IP cao hơn username vì 1 IP có thể có nhiều user thật (NAT, ký túc xá, văn phòng).
 *
 * Cách hoạt động:
 * - Mỗi lần login fail → INCR cả 2 counter.
 * - Login thành công → DEL counter username (KHÔNG xóa counter IP — attacker có thể đoán
 *   trúng 1 password rồi tiếp tục brute force username khác cùng IP).
 *
 * Vì sao dùng Redis (không phải HashMap)?
 * - INCR atomic ở tầng Redis → an toàn khi nhiều thread/instance cùng INCR.
 * - TTL tự động xóa key cũ → không cần scheduler dọn dẹp.
 * - Multi-instance share chung 1 counter → khi scale ra nhiều BE, attacker
 *   không thể "vòng" qua các instance để vượt rate limit.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LoginRateLimitService {

    private final StringRedisTemplate redis;
    private final SystemConfigService systemConfigService;

    private static final String KEY_PREFIX = "login:fail:";
    private static final String KEY_PREFIX_IP = "login:fail:ip:";

    // ============================================================
    // BY USERNAME
    // ============================================================

    /**
     * Check trước khi xác thực — throw nếu username đang bị block.
     * Gọi đầu method login(), trước cả khi tìm user trong DB.
     */
    public void checkBlocked(String username) {
        String key = buildKey(username);
        String value = redis.opsForValue().get(key);
        int attempts = (value == null) ? 0 : parseIntSafe(value);
        int maxAttempts = systemConfigService.getInt("auth.login_max_attempts", 5);

        if (attempts >= maxAttempts) {
            int blockMinutes = systemConfigService.getInt("auth.login_block_minutes", 15);
            log.warn("Login blocked for '{}' — {} attempts (max {})", username, attempts, maxAttempts);
            throw new BusinessException(ErrorCode.TOO_MANY_LOGIN_ATTEMPTS,
                    String.format("Tài khoản tạm khóa %d phút sau %d lần đăng nhập sai", blockMinutes, maxAttempts));
        }
    }

    /**
     * Ghi nhận 1 lần login fail → INCR counter.
     *
     * Lưu ý: INCR atomic — nhiều thread cùng INCR vẫn cho kết quả đúng.
     * Set TTL chỉ ở lần fail đầu tiên (khi counter = 1) để tránh reset TTL mỗi lần fail
     * (nếu reset mỗi lần → attacker spam fail vẫn không trigger expire).
     */
    public void recordFail(String username) {
        String key = buildKey(username);
        Long attempts = redis.opsForValue().increment(key);

        if (attempts != null && attempts == 1L) {
            int blockMinutes = systemConfigService.getInt("auth.login_block_minutes", 15);
            redis.expire(key, Duration.ofMinutes(blockMinutes));
        }

        log.info("Login fail #{} for username '{}'", attempts, username);
    }

    /**
     * Xóa counter khi login thành công — user được làm lại từ đầu.
     */
    public void clearFails(String username) {
        redis.delete(buildKey(username));
    }

    // ============================================================
    // BY IP — chống credential stuffing (1 IP spam nhiều username)
    // ============================================================

    /**
     * Check trước khi xác thực — throw nếu IP đang bị block.
     * Gọi đầu method login() song song với checkBlocked(username).
     */
    public void checkBlockedByIp(String ip) {
        if (ip == null || ip.isBlank()) return;

        String key = buildKeyIp(ip);
        String value = redis.opsForValue().get(key);
        int attempts = (value == null) ? 0 : parseIntSafe(value);
        int maxAttempts = systemConfigService.getInt("auth.login_max_attempts_per_ip", 30);

        if (attempts >= maxAttempts) {
            int blockMinutes = systemConfigService.getInt("auth.login_block_minutes", 15);
            log.warn("Login blocked for IP {} — {} attempts (max {})", ip, attempts, maxAttempts);
            throw new BusinessException(ErrorCode.TOO_MANY_LOGIN_ATTEMPTS,
                    String.format("IP của bạn đã đăng nhập sai quá nhiều, vui lòng thử lại sau %d phút", blockMinutes));
        }
    }

    /**
     * Ghi nhận 1 lần login fail theo IP → INCR counter IP.
     */
    public void recordFailByIp(String ip) {
        if (ip == null || ip.isBlank()) return;

        String key = buildKeyIp(ip);
        Long attempts = redis.opsForValue().increment(key);

        if (attempts != null && attempts == 1L) {
            int blockMinutes = systemConfigService.getInt("auth.login_block_minutes", 15);
            redis.expire(key, Duration.ofMinutes(blockMinutes));
        }

        log.info("Login fail #{} for IP {}", attempts, ip);
    }

    // ============================================================
    // Helpers
    // ============================================================

    private String buildKey(String username) {
        return KEY_PREFIX + username.toLowerCase();
    }

    private String buildKeyIp(String ip) {
        return KEY_PREFIX_IP + ip;
    }

    private int parseIntSafe(String value) {
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}
