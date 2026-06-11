package com.cinex.module.notification.specification;

import com.cinex.common.entity.StorageState;
import com.cinex.module.notification.dto.NotificationFilter;
import com.cinex.module.notification.entity.Notification;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;

/**
 * [Specification Pattern] Build WHERE động cho Notification.
 *
 * Khác các module khác: {@code userId} là tham số BẮT BUỘC (truyền từ SecurityContext)
 * — không nằm trong Filter DTO để tránh client tự ý đổi userId qua query param (IDOR).
 *
 * Notification đã extends BaseEntity (changeset 044) → mặc định lọc bỏ row ARCHIVED.
 */
public class NotificationSpecification {

    private NotificationSpecification() {}

    public static Specification<Notification> fromFilter(NotificationFilter filter, Long userId) {
        // Mặc định loại notification đã soft-delete (storage_state = ARCHIVED).
        Specification<Notification> spec = Specification.where(hasUser(userId)).and(notDeleted());

        if (filter != null) {
            if (StringUtils.hasText(filter.getType())) {
                spec = spec.and(hasType(filter.getType()));
            }
            if (filter.getIsRead() != null) {
                spec = spec.and(hasIsRead(filter.getIsRead()));
            }
            if (filter.getCreatedFrom() != null || filter.getCreatedTo() != null) {
                spec = spec.and(createdBetween(filter.getCreatedFrom(), filter.getCreatedTo()));
            }
        }
        return spec;
    }

    public static Specification<Notification> hasUser(Long userId) {
        return (root, query, cb) -> cb.equal(root.get("user").get("id"), userId);
    }

    public static Specification<Notification> hasType(String type) {
        return (root, query, cb) -> cb.equal(root.get("type"), type);
    }

    public static Specification<Notification> hasIsRead(boolean isRead) {
        return (root, query, cb) -> cb.equal(root.get("isRead"), isRead);
    }

    /** Loại bỏ notification đã soft delete (storage_state = ARCHIVED). */
    public static Specification<Notification> notDeleted() {
        return (root, query, cb) -> cb.or(
                cb.isNull(root.get("storageState")),
                cb.notEqual(root.get("storageState"), StorageState.ARCHIVED)
        );
    }

    public static Specification<Notification> createdBetween(LocalDateTime from, LocalDateTime to) {
        return (root, query, cb) -> {
            if (from != null && to != null) {
                return cb.between(root.get("createdAt"), from, to);
            } else if (from != null) {
                return cb.greaterThanOrEqualTo(root.get("createdAt"), from);
            } else {
                return cb.lessThanOrEqualTo(root.get("createdAt"), to);
            }
        };
    }
}
