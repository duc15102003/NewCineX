package com.cinex.common.config;

import org.springframework.context.annotation.Configuration;
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
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // /topic = prefix cho broadcast messages (1 → nhiều subscriber)
        config.enableSimpleBroker("/topic");
        // /app = prefix cho messages từ client → server (nếu cần)
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // FE connect tại: ws://localhost:8088/ws
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")  // CORS: cho phép mọi origin (dev)
                .withSockJS();                   // Fallback cho browser cũ
    }
}
