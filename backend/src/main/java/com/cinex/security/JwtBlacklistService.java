package com.cinex.security;

import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.Date;

/**
 * [JWT Blacklist] Vô hiệu hóa access token TRƯỚC khi hết hạn tự nhiên.
 *
 * <p><b>Vì sao cần?</b> JWT là stateless — server không lưu phiên. Khi user logout
 * hoặc đổi password, refresh token bị revoke nhưng access token CŨ vẫn dùng được
 * tới khi hết hạn (mặc định 15 phút). Nếu attacker có access token leak, họ vẫn
 * gọi API được trong khoảng thời gian đó.
 *
 * <p><b>Giải pháp:</b> lưu token (hoặc hash) vào Redis với TTL = thời gian còn lại
 * của token. Filter check Redis trước khi set Authentication.
 *
 * <p><b>Tại sao hash thay vì lưu raw token?</b>
 * <ul>
 *   <li>Token raw là credential — nếu Redis bị leak (memory dump, RDB file)
 *       attacker có thể dùng lại token để impersonate.</li>
 *   <li>SHA-256 1 chiều — chỉ verify được, không thể khôi phục token.</li>
 *   <li>Key 64 hex chars cố định → tiết kiệm memory hơn lưu cả JWT 200+ ký tự.</li>
 * </ul>
 *
 * <p><b>Tại sao TTL = (exp - now)?</b> Sau khi token hết hạn tự nhiên, JWT filter
 * đã reject rồi → không cần giữ trong blacklist nữa. Redis tự xóa key giúp tiết
 * kiệm bộ nhớ, không cần scheduler dọn rác.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class JwtBlacklistService {

    private static final String KEY_PREFIX = "jwt:blacklist:";

    private final StringRedisTemplate redis;
    private final JwtUtil jwtUtil;

    /**
     * Đưa token vào blacklist với TTL = phần còn lại trước khi token hết hạn.
     * Nếu token đã hết hạn → bỏ qua (không cần lưu, filter sẽ tự reject).
     */
    public void blacklist(String token) {
        if (token == null || token.isBlank()) return;
        try {
            Claims claims = jwtUtil.extractAllClaims(token);
            Date exp = claims.getExpiration();
            if (exp == null) return;

            long remainMs = exp.getTime() - System.currentTimeMillis();
            if (remainMs <= 0) {
                // Token đã expire — không cần blacklist
                return;
            }

            String key = KEY_PREFIX + tokenHash(token);
            redis.opsForValue().set(key, "1", Duration.ofMillis(remainMs));
            log.info("JWT blacklisted for user '{}', TTL={}s", claims.getSubject(), remainMs / 1000);
        } catch (Exception e) {
            // Token sai format / signature → coi như không cần blacklist
            log.debug("Skip blacklist (invalid token): {}", e.getMessage());
        }
    }

    /**
     * Check xem token có nằm trong blacklist không. Gọi mỗi request từ JwtAuthFilter.
     * Trả false nếu token blank hoặc Redis lỗi → fail-open để tránh outage block toàn site.
     */
    public boolean isBlacklisted(String token) {
        if (token == null || token.isBlank()) return false;
        try {
            String key = KEY_PREFIX + tokenHash(token);
            Boolean exists = redis.hasKey(key);
            return Boolean.TRUE.equals(exists);
        } catch (Exception e) {
            log.warn("Redis check blacklist failed, fail-open: {}", e.getMessage());
            return false;
        }
    }

    /**
     * SHA-256 hash → 64 hex chars. Tránh lưu token raw vào Redis.
     */
    public String tokenHash(String token) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(token.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(hash.length * 2);
            for (byte b : hash) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 luôn có trong JDK chuẩn — không bao giờ throw thực tế
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
