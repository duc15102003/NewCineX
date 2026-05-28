package com.cinex.module.notification.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

/**
 * DTO trả về cho client — chỉ expose các field cần thiết.
 * Không trả entity thẳng → tránh lộ quan hệ user, lazy-loading exception.
 */
@Getter
@Builder
@AllArgsConstructor
public class NotificationResponse {

    private Long id;
    private String title;
    private String content;
    private String type;
    private boolean isRead;
    private LocalDateTime createdAt;
}
