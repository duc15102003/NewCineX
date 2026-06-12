package com.cinex.common.util;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Resolve client IP từ HttpServletRequest — ưu tiên X-Forwarded-For (khi BE
 * sau reverse proxy/CDN), fallback về remoteAddr.
 *
 * <p>Tách ra util để LoginRateLimitService, CheckInRateLimitService, EmailVerifyRateLimitService
 * dùng chung — tránh duplicate logic.
 */
public final class ClientIpUtil {

    private ClientIpUtil() {}

    /**
     * Trả về IP đầu tiên trong X-Forwarded-For chain (client gốc), hoặc
     * remoteAddr nếu không có header. Null-safe.
     */
    public static String resolve(HttpServletRequest request) {
        if (request == null) return null;
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            int commaIdx = xff.indexOf(',');
            return (commaIdx > 0 ? xff.substring(0, commaIdx) : xff).trim();
        }
        return request.getRemoteAddr();
    }
}
