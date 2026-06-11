package com.cinex.module.auth.util;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * Tiện ích set/clear HttpOnly cookie cho refresh token — chuẩn industry chống XSS token theft.
 *
 * <p><b>Vì sao HttpOnly cookie thay vì localStorage?</b> Token trong localStorage bị JS đọc
 * được → XSS payload (vd qua review/comment chứa script) có thể steal token → impersonate user.
 * HttpOnly cookie không expose ra JS → XSS không lấy được.
 *
 * <p><b>Flags áp dụng:</b>
 * <ul>
 *   <li>{@code HttpOnly} — JS không đọc được (chống XSS)</li>
 *   <li>{@code Secure} — chỉ gửi qua HTTPS (prod=true, dev=false vì localhost HTTP)</li>
 *   <li>{@code SameSite=Lax} — cookie không gửi cho cross-site POST (chống CSRF) nhưng
 *       vẫn gửi cho navigation (vd click link email verify). "Strict" sẽ phá flow link.</li>
 *   <li>{@code Path=/} — cookie scope toàn site, mọi endpoint đọc được</li>
 *   <li>{@code Max-Age = refresh expiration} — match TTL refresh token BE side</li>
 * </ul>
 */
@Component
public class RefreshTokenCookieUtil {

    public static final String COOKIE_NAME = "refreshToken";

    @Value("${app.jwt.refresh-expiration-ms:604800000}")
    private long refreshExpirationMs;

    /**
     * Set {@code secure=true} chỉ khi prod (HTTPS). Dev local HTTP → false để browser chấp nhận.
     * Inject qua env COOKIE_SECURE=true ở prod deploy.
     */
    @Value("${app.cookie.secure:false}")
    private boolean cookieSecure;

    public void setRefreshTokenCookie(HttpServletResponse response, String refreshToken) {
        ResponseCookie cookie = ResponseCookie.from(COOKIE_NAME, refreshToken)
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite("Lax")
                .path("/")
                .maxAge(Duration.ofMillis(refreshExpirationMs))
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    public void clearRefreshTokenCookie(HttpServletResponse response) {
        ResponseCookie cookie = ResponseCookie.from(COOKIE_NAME, "")
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite("Lax")
                .path("/")
                .maxAge(0)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }
}
