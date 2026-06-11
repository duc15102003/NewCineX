package com.cinex.module.notification.service;

import com.cinex.module.notification.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * [Scheduled Cleanup] Dọn dẹp bảng notifications định kỳ để DB không phình.
 *
 * <p><b>Bài toán:</b> Mỗi user/booking có thể sinh nhiều thông báo (đặt vé, hủy,
 * thanh toán, voucher hết hạn, ...). Sau vài tháng, bảng notifications có thể có
 * hàng triệu dòng → query chậm, backup tốn.
 *
 * <p><b>Chính sách dọn:</b>
 * <ul>
 *   <li>Thông báo ĐÃ ĐỌC và cũ hơn 90 ngày → xóa cứng. User đã xem, không có
 *       lý do giữ lâu thêm.</li>
 *   <li>Thông báo CHƯA ĐỌC nhưng cũ hơn 180 ngày → vẫn xóa. User không đọc trong
 *       6 tháng tức là không quan tâm hoặc tài khoản bỏ rơi.</li>
 * </ul>
 *
 * <p><b>Lịch chạy:</b> mỗi ngày 04:00 (giờ rảnh, ít traffic).
 *
 * <p><b>ShedLock:</b> nếu deploy nhiều instance, chỉ 1 instance giành lock và chạy.
 * Tránh N instance cùng DELETE → deadlock hoặc query trùng.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class NotificationCleanupScheduler {

    /** Mốc xóa thông báo đã đọc. */
    private static final int DAYS_KEEP_READ = 90;
    /** Mốc xóa tất cả (kể cả chưa đọc). */
    private static final int DAYS_KEEP_ALL = 180;

    private final NotificationRepository notificationRepository;

    /**
     * Chạy mỗi ngày lúc 04:00 sáng.
     *
     * <p>Cron format: giây phút giờ ngày tháng thứ
     * <br/>"0 0 4 * * *" = 04:00:00 mỗi ngày.
     */
    @Scheduled(cron = "0 0 4 * * *")
    @SchedulerLock(name = "notificationCleanup", lockAtLeastFor = "PT1M", lockAtMostFor = "PT10M")
    @Transactional
    public void cleanupOldNotifications() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime readCutoff = now.minusDays(DAYS_KEEP_READ);
        LocalDateTime allCutoff = now.minusDays(DAYS_KEEP_ALL);

        // Bước 1: xóa thông báo cực cũ (kể cả chưa đọc) — chạy trước để giảm số dòng
        // bước 2 cần quét.
        int deletedAll = notificationRepository.deleteOlderThan(allCutoff);

        // Bước 2: xóa thông báo đã đọc + cũ hơn 90 ngày
        int deletedRead = notificationRepository.deleteReadOlderThan(readCutoff);

        log.info("Notification cleanup done: deleted {} old (>{}d) + {} read-old (>{}d)",
                deletedAll, DAYS_KEEP_ALL, deletedRead, DAYS_KEEP_READ);
    }
}
