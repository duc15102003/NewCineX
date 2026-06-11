package com.cinex.security;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Date;

/**
 * [JWT Auth Filter] Xác thực mỗi request bằng Bearer token.
 *
 * <p><b>Tối ưu hiệu năng:</b>
 * <ul>
 *   <li><b>Parse JWT 1 lần</b>: gọi {@code extractAllClaims} → lấy cả subject
 *       + expiration trong 1 lần verify signature. Trước đây parse 2 lần
 *       (extractUsername + isTokenValid → isTokenExpired) → tốn 2x CPU HMAC.</li>
 *   <li><b>Cache UserDetails (Caffeine, TTL 2p)</b>: không query DB mỗi request.</li>
 * </ul>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final UserDetailsCacheService userDetailsCacheService;
    private final JwtBlacklistService jwtBlacklistService;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            String token = authHeader.substring(7);

            // Parse JWT 1 LẦN — lấy cả subject + expiration trong 1 call.
            Claims claims = jwtUtil.extractAllClaims(token);
            String username = claims.getSubject();
            Date expiration = claims.getExpiration();

            // Check expired từ claims (KHÔNG parse lại token).
            if (expiration != null && expiration.before(new Date())) {
                log.debug("JWT expired for {}", username);
                filterChain.doFilter(request, response);
                return;
            }

            // Check blacklist — token vừa logout / vừa đổi password sẽ bị reject sớm.
            // Check SAU expired để tiết kiệm 1 round-trip Redis cho token đã hết hạn.
            if (jwtBlacklistService.isBlacklisted(token)) {
                log.debug("JWT blacklisted for {}", username);
                filterChain.doFilter(request, response);
                return;
            }

            if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                // Cache hit → skip DB. Miss → query DB + put cache (TTL 2p).
                UserDetails userDetails = userDetailsCacheService.loadUserByUsername(username);

                // Username trong token đã match subject (Jwt parse tự verify subject),
                // chỉ cần đảm bảo UserDetails load ra hợp lệ.
                UsernamePasswordAuthenticationToken authToken =
                        new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authToken);
            }
        } catch (Exception e) {
            // Token hết hạn, sai format, bị tampering → bỏ qua, không set auth
            // → Spring Security sẽ trả 401 cho endpoint cần authenticated
            log.debug("JWT validation failed: {}", e.getMessage());
        }

        filterChain.doFilter(request, response);
    }
}
