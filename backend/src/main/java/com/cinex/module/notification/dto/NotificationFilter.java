package com.cinex.module.notification.dto;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Filter DTO cho user list notifications của chính mình.
 *
 * Lưu ý: KHÔNG có {@code userId} — userId LUÔN lấy từ SecurityContext
 * (current authenticated user) để tránh IDOR (user A đọc notification của user B).
 *
 * Specification truy cập userId qua tham số riêng:
 * {@link com.cinex.module.notification.specification.NotificationSpecification#fromFilter(NotificationFilter, Long)}.
 */
@Getter
@Setter
public class NotificationFilter {

    // BOOKING / PROMOTION / SYSTEM — xem NotificationType constants
    private String type;

    // true = chỉ đã đọc, false = chỉ chưa đọc, null = cả 2
    private Boolean isRead;

    // Khoảng thời gian (FE filter "trong 7 ngày qua", v.v.)
    private LocalDateTime createdFrom;
    private LocalDateTime createdTo;
}
