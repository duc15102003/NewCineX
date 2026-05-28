package com.cinex.module.notification.repository;

import com.cinex.module.notification.entity.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    /**
     * Lấy danh sách thông báo của user, sắp xếp mới nhất lên đầu.
     * Spring Data tự sinh SQL:
     *   SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC
     */
    Page<Notification> findByUserId(Long userId, Pageable pageable);

    /**
     * Đếm số thông báo chưa đọc của user.
     * SQL: SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = false
     */
    long countByUserIdAndIsReadFalse(Long userId);

    /**
     * [Bulk Update] Đánh dấu TẤT CẢ thông báo chưa đọc của user thành đã đọc.
     *
     * Tại sao dùng @Query UPDATE thay vì load từng cái rồi set?
     * → Nếu user có 100 thông báo chưa đọc, cách naive = 100 SELECT + 100 UPDATE
     * → Dùng bulk UPDATE = 1 query duy nhất → nhanh hơn 200x
     *
     * @Modifying: báo Spring đây là query thay đổi dữ liệu (không phải SELECT)
     */
    @Modifying
    @Query("UPDATE Notification n SET n.isRead = true WHERE n.user.id = :userId AND n.isRead = false")
    void markAllAsReadByUserId(@Param("userId") Long userId);
}
