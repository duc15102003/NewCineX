package com.cinex.module.booking.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * Service gửi real-time seat updates qua WebSocket.
 *
 * Khi ghế thay đổi trạng thái (hold, cancel, confirm, expire):
 * → Gửi message đến /topic/showtime/{showtimeId}/seats
 * → TẤT CẢ user đang xem sơ đồ ghế suất đó nhận được ngay
 *
 * SimpMessagingTemplate = Spring cung cấp, gửi message đến STOMP topic.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SeatWebSocketService {

    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Gửi thông báo ghế thay đổi trạng thái.
     *
     * @param showtimeId suất chiếu
     * @param seatIds    danh sách ghế thay đổi
     * @param status     trạng thái mới: HELD, BOOKED, AVAILABLE (khi cancel/expire)
     */
    public void notifySeatChanged(Long showtimeId, List<Long> seatIds, String status) {
        String destination = "/topic/showtime/" + showtimeId + "/seats";

        Map<String, Object> message = Map.of(
                "seatIds", seatIds,
                "status", status,
                "timestamp", System.currentTimeMillis()
        );

        // Cô lập lỗi WS để KHÔNG phá vỡ business transaction.
        // VD: payment đã commit DB nhưng broker lỗi → nếu propagate exception
        // sẽ rollback payment → user mất tiền. FE fallback bằng polling
        // getSeatMap mỗi 5s khi WS disconnect.
        try {
            messagingTemplate.convertAndSend(destination, message);
            log.debug("WebSocket: sent seat update to {} — {} seats → {}", destination, seatIds.size(), status);
        } catch (Exception e) {
            log.error("WebSocket notify failed for showtime {} ({} seats → {}): {}",
                    showtimeId, seatIds.size(), status, e.getMessage(), e);
        }
    }
}
