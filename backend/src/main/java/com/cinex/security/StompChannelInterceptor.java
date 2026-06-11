package com.cinex.security;

import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Component;

/**
 * [STOMP ChannelInterceptor] Gắn Principal vào WebSocket session từ JWT access token.
 *
 * <p><b>Vì sao cần?</b> {@code SimpMessagingTemplate.convertAndSendToUser(username, ...)}
 * map nội bộ destination thành {@code /user/{sessionId}/queue/...}. Spring lookup
 * sessionId qua {@code Principal.getName()} trong STOMP session. Nếu Principal null
 * hoặc khác username → message KHÔNG đến được client → notification bị mất.
 *
 * <p><b>Bảo mật:</b> Bonus — chặn user A subscribe vào kênh của user B vì Principal
 * được set từ JWT đã verify chữ ký (không phải FE tự gửi username).
 *
 * <p><b>FE phải làm gì?</b> Khi kết nối STOMP, gửi header:
 * <pre>
 *   const client = new Client({
 *     brokerURL: 'ws://localhost:8088/ws',
 *     connectHeaders: { Authorization: `Bearer ${accessToken}` }
 *   });
 * </pre>
 *
 * <p><b>Lifecycle:</b> Chỉ parse JWT ở STOMP command = CONNECT. Các message
 * SEND/SUBSCRIBE sau đó Spring tự attach lại Principal từ session — không cần
 * decode JWT mỗi message (tránh tốn CPU HMAC).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class StompChannelInterceptor implements ChannelInterceptor {

    private final JwtUtil jwtUtil;
    private final UserDetailsService userDetailsService;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null) return message;

        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            String authHeader = accessor.getFirstNativeHeader("Authorization");
            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                // KHÔNG reject — vẫn cho connect để các flow public (nếu có) chạy được.
                // Endpoint cần auth sẽ tự fail khi convertAndSendToUser lookup Principal null.
                log.debug("STOMP CONNECT without Authorization header");
                return message;
            }

            try {
                String token = authHeader.substring(7);
                Claims claims = jwtUtil.extractAllClaims(token);
                String username = claims.getSubject();

                if (username != null) {
                    // Load UserDetails để có authorities — match với HTTP filter (tránh
                    // có user enabled=false vẫn mở được WebSocket).
                    UserDetails userDetails = userDetailsService.loadUserByUsername(username);
                    UsernamePasswordAuthenticationToken auth =
                            new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
                    accessor.setUser(auth);
                    log.debug("STOMP CONNECT: bound Principal for user '{}'", username);
                }
            } catch (Exception e) {
                log.debug("STOMP CONNECT JWT invalid: {}", e.getMessage());
                // Không set Principal → convertAndSendToUser sẽ không tìm thấy session
            }
        }

        return message;
    }
}
