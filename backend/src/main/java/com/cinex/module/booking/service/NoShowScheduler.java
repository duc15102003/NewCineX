package com.cinex.module.booking.service;

import com.cinex.common.service.EmailService;
import com.cinex.module.auth.entity.User;
import com.cinex.module.auth.repository.UserRepository;
import com.cinex.module.booking.entity.Booking;
import com.cinex.module.booking.entity.BookingStatus;
import com.cinex.module.booking.repository.BookingRepository;
import com.cinex.module.config.service.SystemConfigService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * [Scheduled Task] Đánh dấu booking CONFIRMED nhưng không CHECKED_IN sau giờ chiếu = NO_SHOW.
 *
 * <p><b>Vấn đề:</b> Nếu user đã thanh toán (CONFIRMED) nhưng không đến rạp xem phim,
 * booking sẽ giữ status CONFIRMED mãi. Báo cáo doanh thu vẫn coi vé "đã sử dụng" → sai lệch.
 *
 * <p><b>Logic:</b> Mỗi giờ tròn, tìm booking CONFIRMED có showtime.endTime &lt; now - 30 phút
 * (buffer cho user check-in muộn sau khi phim kết thúc) → đánh dấu NO_SHOW.
 *
 * <p><b>Tần suất:</b> Mỗi giờ tròn — không cần real-time vì NO_SHOW chỉ ảnh hưởng báo cáo.
 *
 * <p><b>@SchedulerLock:</b> tránh nhiều instance cùng UPDATE → contention DB.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class NoShowScheduler {

    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;
    private final SystemConfigService systemConfigService;
    private final EmailService emailService;

    /**
     * Buffer mặc định (phút) sau khi phim kết thúc — cho user check-in muộn.
     * Có thể override qua config `booking.no_show_buffer_minutes`.
     */
    private static final int DEFAULT_NO_SHOW_BUFFER_MINUTES = 30;

    /**
     * Chạy mỗi giờ tròn (phút 0 mỗi giờ).
     * Cron: "0 0 * * * *" = giây 0, phút 0, mọi giờ, mọi ngày.
     */
    @Scheduled(cron = "0 0 * * * *")
    @SchedulerLock(name = "noShowMark", lockAtLeastFor = "PT1M", lockAtMostFor = "PT10M")
    @Transactional
    public void markNoShowBookings() {
        int bufferMinutes = systemConfigService.getInt(
                "booking.no_show_buffer_minutes", DEFAULT_NO_SHOW_BUFFER_MINUTES);
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(bufferMinutes);

        List<Booking> candidates = bookingRepository
                .findByStatusAndShowtime_EndTimeBefore(BookingStatus.CONFIRMED, cutoff);

        if (candidates.isEmpty()) {
            log.debug("[NoShowScheduler] Không có booking nào cần đánh NO_SHOW");
            return;
        }

        // Industry chuẩn (CGV/Lotte): NO_SHOW phải có consequence để chống
        // ghost booking. Tăng user.noShowCount, nếu vượt threshold → block N
        // ngày. Reset count xử lý ngay trong BookingCheckInService khi check-in
        // thành công — đỡ tốn cron, feedback ngay cho khách.
        int threshold = systemConfigService.getInt("booking.no_show_block_threshold", 3);
        int blockDays = systemConfigService.getInt("booking.no_show_block_days", 7);

        int blockedUsers = 0;
        for (Booking booking : candidates) {
            booking.setStatus(BookingStatus.NO_SHOW);
            bookingRepository.save(booking);

            User user = booking.getUser();
            if (user == null) continue; // counter-sale (POS) không có user account
            user.setNoShowCount(user.getNoShowCount() + 1);
            if (user.getNoShowCount() >= threshold) {
                LocalDateTime blockedUntil = LocalDateTime.now().plusDays(blockDays);
                user.setBlockedUntil(blockedUntil);
                blockedUsers++;
                log.warn("[NoShowScheduler] BLOCK user {} ({} NO_SHOW lần) đến {}",
                        user.getUsername(), user.getNoShowCount(), blockedUntil);
            } else if (user.getNoShowCount() == threshold - 1) {
                // Cảnh báo strike kế cuối — industry chuẩn (CGV/Lotte): warn user
                // còn 1 lần nữa sẽ bị block, cho cơ hội điều chỉnh hành vi.
                if (user.getEmail() != null) {
                    emailService.sendNoShowWarningEmail(
                            user.getEmail(), user.getUsername(),
                            user.getNoShowCount(), threshold, blockDays);
                }
            }
            userRepository.save(user);
            log.info("[NoShowScheduler] Marked booking {} as NO_SHOW (user {} count={})",
                    booking.getBookingCode(), user.getUsername(), user.getNoShowCount());
        }

        log.info("[NoShowScheduler] Marked {} booking NO_SHOW, blocked {} users (cutoff={})",
                candidates.size(), blockedUsers, cutoff);
    }
}
