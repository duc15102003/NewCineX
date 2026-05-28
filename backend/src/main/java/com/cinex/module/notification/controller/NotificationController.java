package com.cinex.module.notification.controller;

import com.cinex.common.response.ApiResponse;
import com.cinex.common.response.PageResponse;
import com.cinex.common.service.SecurityService;
import org.springframework.security.access.prepost.PreAuthorize;
import com.cinex.module.notification.dto.NotificationResponse;
import com.cinex.module.notification.service.NotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
@Tag(name = "Notification", description = "Notification management — read, mark as read")
public class NotificationController {

    private final NotificationService notificationService;
    private final SecurityService securityService;

    /**
     * GET /api/notifications/me?page=0&size=20
     * Lấy danh sách thông báo của user hiện tại, phân trang.
     */
    @GetMapping("/me")
    @Operation(summary = "Get my notifications (paginated)")
    public ApiResponse<PageResponse<NotificationResponse>> getMyNotifications(
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        Long userId = securityService.getCurrentUserId();
        return ApiResponse.ok(PageResponse.from(notificationService.getMyNotifications(userId, pageable)));
    }

    /**
     * GET /api/notifications/me/unread-count
     * Lấy số thông báo chưa đọc — dùng cho badge trên UI.
     */
    @GetMapping("/me/unread-count")
    @Operation(summary = "Get unread notification count")
    public ApiResponse<Long> getUnreadCount() {
        Long userId = securityService.getCurrentUserId();
        return ApiResponse.ok(notificationService.getUnreadCount(userId));
    }

    /**
     * PUT /api/notifications/{id}/read
     * Đánh dấu 1 thông báo là đã đọc.
     */
    @PutMapping("/{id}/read")
    @Operation(summary = "Mark a notification as read")
    public ApiResponse<NotificationResponse> markAsRead(@PathVariable Long id) {
        Long userId = securityService.getCurrentUserId();
        return ApiResponse.ok("Notification marked as read", notificationService.markAsRead(userId, id));
    }

    /**
     * PUT /api/notifications/read-all
     * Đánh dấu tất cả thông báo chưa đọc là đã đọc.
     */
    @PutMapping("/read-all")
    @Operation(summary = "Mark all notifications as read")
    public ApiResponse<Void> markAllAsRead() {
        Long userId = securityService.getCurrentUserId();
        notificationService.markAllAsRead(userId);
        return ApiResponse.ok("All notifications marked as read", null);
    }

}
