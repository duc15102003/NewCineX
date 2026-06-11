package com.cinex.module.booking.service;

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
    private final SystemConfigService systemConfigService;

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

        for (Booking booking : candidates) {
            booking.setStatus(BookingStatus.NO_SHOW);
            bookingRepository.save(booking);
            log.info("[NoShowScheduler] Marked booking {} as NO_SHOW (showtime ended at {})",
                    booking.getBookingCode(), booking.getShowtime().getEndTime());
        }

        log.info("[NoShowScheduler] Đã đánh dấu {} booking thành NO_SHOW (cutoff = {})",
                candidates.size(), cutoff);
    }
}
