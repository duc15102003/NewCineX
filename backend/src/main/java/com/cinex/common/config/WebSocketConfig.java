package com.cinex.common.config;

import com.cinex.security.StompChannelInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * WebSocket config — cho phép FE subscribe nhận real-time updates.
 *
 * STOMP = Simple Text Oriented Messaging Protocol
 * → Protocol chuẩn cho WebSocket messaging (subscribe, send, receive)
 *
 * SockJS = fallback khi browser không hỗ trợ WebSocket (dùng long-polling)
 *
 * Luồng:
 * 1. FE connect: ws://localhost:8088/ws (endpoint)
 * 2. FE subscribe: /topic/showtime/1/seats (nhận cập nhật ghế suất 1)
 * 3. BE gửi message đến /topic/showtime/1/seats → TẤT CẢ subscriber nhận
 */
@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    /**
     * Frontend URL — đọc từ application.yml (giống CorsConfig).
     * Giới hạn origin để tránh CSRF qua WebSocket (cross-site WebSocket hijacking).
     */
    @Value("${app.frontend-url}")
    private String frontendUrl;

    private final StompChannelInterceptor stompChannelInterceptor;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // /topic = prefix cho broadcast messages (1 → nhiều subscriber, public).
        // /queue = prefix cho per-user messages (mỗi user 1 destination riêng).
        config.enableSimpleBroker("/topic", "/queue");
        // /app = prefix cho messages từ client → server (nếu cần)
        config.setApplicationDestinationPrefixes("/app");
        // [Security] /user = prefix cho per-user destination.
        // convertAndSendToUser(username, "/queue/notifications", ...) sẽ map nội bộ
        // thành /user/{sessionId}/queue/notifications — chỉ session của username đó nhận.
        // FE subscribe "/user/queue/notifications" và bắt buộc phải có Principal hợp lệ
        // → ngăn IDOR: user khác không thể subscribe vào kênh của mình.
        config.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // FE connect tại: ws://localhost:8088/ws
        // Chỉ cho phép origin của FE đã config — KHÔNG dùng "*" để tránh
        // các site khác có thể mở WebSocket đến server và đánh cắp dữ liệu của user đã login
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns(frontendUrl)
                .withSockJS();                   // Fallback cho browser cũ
    }

    /**
     * Gắn STOMP ChannelInterceptor để parse JWT ở STOMP CONNECT → set Principal.
     * convertAndSendToUser(username, ...) cần Principal khớp để route đúng session.
     */
    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(stompChannelInterceptor);
    }
}
