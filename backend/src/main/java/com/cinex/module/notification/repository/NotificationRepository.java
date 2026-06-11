package com.cinex.module.notification.repository;

import com.cinex.module.notification.entity.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;

public interface NotificationRepository extends JpaRepository<Notification, Long>, JpaSpecificationExecutor<Notification> {

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

    /**
     * Xóa CỨNG các thông báo đã đọc và cũ hơn mốc thời gian truyền vào.
     *
     * <p>Dùng bởi {@code NotificationCleanupScheduler} để dọn dẹp DB định kỳ:
     * thông báo đã đọc + cũ hơn 90 ngày → user khả năng cao không cần nữa.
     *
     * <p>SQL sinh ra (JPQL bulk delete):
     * {@code DELETE FROM notifications WHERE created_at < ? AND is_read = 1}
     *
     * @return số bản ghi bị xóa (dùng cho log)
     */
    @Modifying
    @Query("DELETE FROM Notification n WHERE n.createdAt < :before AND n.isRead = true")
    int deleteReadOlderThan(@Param("before") LocalDateTime before);

    /**
     * Xóa CỨNG tất cả thông báo cũ hơn mốc (kể cả chưa đọc).
     *
     * <p>Dùng cho mốc cực cũ (vd: 180 ngày) — user không đọc trong 6 tháng thì
     * thông báo gần như chắc chắn không còn ý nghĩa, xóa cứng để DB không phình.
     *
     * @return số bản ghi bị xóa
     */
    @Modifying
    @Query("DELETE FROM Notification n WHERE n.createdAt < :before")
    int deleteOlderThan(@Param("before") LocalDateTime before);
}
