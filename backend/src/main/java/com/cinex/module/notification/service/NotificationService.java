package com.cinex.module.notification.service;

import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.module.auth.entity.User;
import com.cinex.module.auth.repository.UserRepository;
import com.cinex.module.notification.dto.NotificationFilter;
import com.cinex.module.notification.dto.NotificationResponse;
import com.cinex.module.notification.entity.Notification;
import com.cinex.module.notification.repository.NotificationRepository;
import com.cinex.module.notification.specification.NotificationSpecification;
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
     * Overload không filter để giữ tương thích lùi.
     */
    @Transactional(readOnly = true)
    public Page<NotificationResponse> getMyNotifications(Long userId, Pageable pageable) {
        return listNotifications(userId, null, pageable);
    }

    /**
     * Lấy notifications của user theo filter (type/isRead/created range).
     *
     * [Specification Pattern] userId BẮT BUỘC, lấy từ SecurityContext ở controller →
     * không bao giờ tin client truyền vào (chống IDOR).
     */
    @Transactional(readOnly = true)
    public Page<NotificationResponse> listNotifications(Long userId, NotificationFilter filter, Pageable pageable) {
        var spec = NotificationSpecification.fromFilter(filter, userId);
        return notificationRepository.findAll(spec, pageable)
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

        // [WebSocket Push - per-user destination] Push thông báo mới đến FE ngay lập tức.
        //
        // TRƯỚC ĐÂY: convertAndSend("/topic/user/{username}/notifications", ...)
        //   → /topic là broadcast: ai biết username (rất dễ đoán) cũng subscribe được
        //     → IDOR — user A đọc lén thông báo của user B.
        //
        // GIỜ: convertAndSendToUser(username, "/queue/notifications", ...)
        //   → Spring tự dịch thành đích nội bộ /user/{sessionId}/queue/notifications.
        //   → FE phải subscribe "/user/queue/notifications" và phải đăng nhập (Principal
        //     khớp với username). Không user khác nào tự subscribe đường này được.
        //
        // Cần config setUserDestinationPrefix("/user") trong WebSocketConfig (đã có).
        simpMessagingTemplate.convertAndSendToUser(
                user.getUsername(),
                "/queue/notifications",
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
