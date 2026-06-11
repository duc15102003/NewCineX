package com.cinex.common.audit.service;

import com.cinex.common.audit.entity.AuditLogV2;
import com.cinex.common.audit.repository.AuditLogV2Repository;
import com.cinex.module.auth.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.LocalDateTime;

/**
 * Ghi audit log cho action admin.
 *
 * <p>Dùng {@code Propagation.REQUIRES_NEW}: audit log được commit độc lập với transaction
 * chính → kể cả nếu transaction gốc rollback sau khi gọi log thì audit vẫn được ghi
 * (mặc dù trong workflow hiện tại aspect chỉ gọi log SAU khi method thành công).
 *
 * <p>Lấy username + IP + user-agent từ:
 * - {@link SecurityContextHolder} — username
 * - {@link RequestContextHolder} — ip, user-agent (ThreadLocal request)
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AuditLogV2Service {

    private final AuditLogV2Repository auditLogRepository;
    private final UserRepository userRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void log(String action, String entityType, Long entityId, String detail) {
        String username = currentUsername();
        Long userId = resolveUserId(username);

        String ipAddress = null;
        String userAgent = null;
        HttpServletRequest request = currentRequest();
        if (request != null) {
            ipAddress = extractClientIp(request);
            userAgent = truncate(request.getHeader("User-Agent"), 255);
        }

        AuditLogV2 entry = AuditLogV2.builder()
                .userId(userId)
                .username(username)
                .action(action)
                .entityType(entityType)
                .entityId(entityId)
                .detail(truncate(detail, 2000))
                .ipAddress(ipAddress)
                .userAgent(userAgent)
                .createdAt(LocalDateTime.now())
                .build();
        try {
            auditLogRepository.save(entry);
            log.debug("Audit: {} {} #{} by {}", action, entityType, entityId, username);
        } catch (Exception ex) {
            // KHÔNG throw — audit fail không được làm hỏng business flow
            log.error("Failed to save audit log: action={}, entityType={}, entityId={}",
                    action, entityType, entityId, ex);
        }
    }

    private String currentUsername() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return "system";
        }
        return auth.getName();
    }

    private Long resolveUserId(String username) {
        if (username == null || "system".equals(username)) return null;
        try {
            return userRepository.findByUsername(username).map(u -> u.getId()).orElse(null);
        } catch (Exception ex) {
            return null;
        }
    }

    private HttpServletRequest currentRequest() {
        try {
            ServletRequestAttributes attrs =
                    (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            return attrs != null ? attrs.getRequest() : null;
        } catch (Exception ex) {
            return null;
        }
    }

    /**
     * IP client thật — ưu tiên X-Forwarded-For (nếu chạy sau proxy/nginx/load balancer).
     * Fallback về remote addr nếu không có header.
     */
    private String extractClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            // Header này có dạng "client, proxy1, proxy2" → lấy IP đầu tiên
            String first = forwarded.split(",")[0].trim();
            return truncate(first, 45);
        }
        return truncate(request.getRemoteAddr(), 45);
    }

    private String truncate(String value, int max) {
        if (value == null) return null;
        return value.length() > max ? value.substring(0, max) : value;
    }
}
