package com.cinex.module.notification.service;

import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.module.auth.entity.User;
import com.cinex.module.auth.repository.UserRepository;
import com.cinex.module.notification.dto.NotificationResponse;
import com.cinex.module.notification.entity.Notification;
import com.cinex.module.notification.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    // [Observer Pattern] SimpMessagingTemplate là "broadcaster" — push message đến
    // tất cả FE client đang subscribe topic tương ứng, không cần FE polling
    private final SimpMessagingTemplate simpMessagingTemplate;

    /**
     * Lấy danh sách thông báo của user, phân trang, mới nhất lên đầu.
     */
    @Transactional(readOnly = true)
    public Page<NotificationResponse> getMyNotifications(Long userId, Pageable pageable) {
        return notificationRepository.findByUserId(userId, pageable)
                .map(this::toResponse);
    }

    /**
     * Đếm số thông báo chưa đọc — dùng cho badge/counter trên UI.
     */
    @Transactional(readOnly = true)
    public long getUnreadCount(Long userId) {
        return notificationRepository.countByUserIdAndIsReadFalse(userId);
    }

    /**
     * Đánh dấu 1 thông báo là đã đọc.
     *
     * Kiểm tra ownership: user chỉ được đọc thông báo của chính mình.
     * Nếu không kiểm tra → user A có thể đánh dấu đọc thông báo của user B (IDOR vulnerability).
     */
    @Transactional
    public NotificationResponse markAsRead(Long userId, Long notificationId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Không tìm thấy thông báo"));

        // Ownership check: thông báo phải thuộc về user đang request
        if (!notification.getUser().getId().equals(userId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Không có quyền truy cập thông báo này");
        }

        notification.setRead(true);
        notificationRepository.save(notification);
        log.info("User {} marked notification {} as read", userId, notificationId);
        return toResponse(notification);
    }

    /**
     * Đánh dấu TẤT CẢ thông báo chưa đọc của user là đã đọc.
     *
     * Dùng bulk UPDATE query thay vì load từng cái → hiệu suất tốt hơn.
     * Xem NotificationRepository.markAllAsReadByUserId() để hiểu tại sao.
     */
    @Transactional
    public void markAllAsRead(Long userId) {
        notificationRepository.markAllAsReadByUserId(userId);
        log.info("User {} marked all notifications as read", userId);
    }

    /**
     * Tạo thông báo mới — được gọi nội bộ từ các service khác.
     *
     * VD: BookingService gọi createNotification() sau khi confirm booking
     *     PaymentService gọi createNotification() sau khi thanh toán thành công
     *
     * Pattern: Internal API — không expose qua Controller, chỉ dùng trong backend.
     *
     * @param userId  ID user nhận thông báo
     * @param title   Tiêu đề (VD: "Đặt vé thành công")
     * @param content Nội dung chi tiết
     * @param type    Loại thông báo — dùng constants từ NotificationType
     */
    @Transactional
    public Notification createNotification(Long userId, String title, String content, String type) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        Notification notification = Notification.builder()
                .user(user)
                .title(title)
                .content(content)
                .type(type)
                .build();

        Notification saved = notificationRepository.save(notification);
        log.info("Created {} notification for user {}: {}", type, userId, title);

        // [WebSocket Push] Broadcast thông báo mới đến FE ngay lập tức.
        // Topic: /topic/user/{username}/notifications — per-user, chỉ FE của user đó nhận.
        // FE subscribe topic này → bell icon cập nhật ngay, không cần polling 30s.
        simpMessagingTemplate.convertAndSend(
                "/topic/user/" + user.getUsername() + "/notifications",
                toResponse(saved)
        );

        return saved;
    }

    // ===== Private helpers =====

    private NotificationResponse toResponse(Notification n) {
        return NotificationResponse.builder()
                .id(n.getId())
                .title(n.getTitle())
                .content(n.getContent())
                .type(n.getType())
                .isRead(n.isRead())
                .createdAt(n.getCreatedAt())
                .build();
    }
}
