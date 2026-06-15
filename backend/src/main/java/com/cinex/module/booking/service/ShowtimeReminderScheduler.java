package com.cinex.module.booking.service;

import com.cinex.common.service.EmailService;
import com.cinex.module.booking.entity.Booking;
import com.cinex.module.booking.entity.BookingStatus;
import com.cinex.module.booking.repository.BookingRepository;
import com.cinex.module.showtime.entity.ShowtimeStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Nhắc khách suất chiếu sắp đến — pattern industry chuẩn (CGV/Lotte/BHD):
 *
 * <ul>
 *   <li><b>24h trước</b> giờ chiếu: email "Mai bạn đi xem phim..." — khách có
 *       thời gian sắp xếp, hủy nếu bận.</li>
 *   <li><b>1h trước</b> giờ chiếu: email "Sắp tới giờ chiếu..." — khách quên
 *       giờ vẫn còn thời gian chạy đến rạp.</li>
 * </ul>
 *
 * <p>Tác dụng: giảm tỷ lệ NO_SHOW từ 10-15% xuống 5-8% (industry data).
 *
 * <p><b>Slot 24h chạy mỗi giờ</b> để window 1h khớp với fixedRate — không gửi
 * trùng cho cùng booking. <b>Slot 1h chạy mỗi 15 phút</b> để chính xác hơn cho
 * khách sát giờ.
 *
 * <p>Booking đặt &lt; 24h trước showtime sẽ tự nhiên bỏ qua slot 24h (window
 * không bắt được) — chỉ nhận reminder 1h. Acceptable theo industry.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ShowtimeReminderScheduler {

    private final BookingRepository bookingRepository;
    private final EmailService emailService;

    private static final DateTimeFormatter FMT_VN =
            DateTimeFormatter.ofPattern("HH:mm - dd/MM/yyyy");

    /** 60 phút trước, window 15 phút khớp fixedRate. */
    private static final long ONE_HOUR_FIXED_RATE_MS = 15 * 60 * 1000L;
    private static final int ONE_HOUR_WINDOW_START_MIN = 60;
    private static final int ONE_HOUR_WINDOW_END_MIN = 75;

    /** 24h trước, window 60 phút khớp fixedRate. */
    private static final long DAY_BEFORE_FIXED_RATE_MS = 60 * 60 * 1000L;
    private static final int DAY_BEFORE_WINDOW_START_MIN = 24 * 60;        // 1440
    private static final int DAY_BEFORE_WINDOW_END_MIN = 24 * 60 + 60;     // 1500

    /**
     * Mỗi 15 phút check booking CONFIRMED có showtime trong window
     * [now+1h, now+1h15min] → gửi reminder. Window 15 phút khớp với
     * fixedRate để không gửi 2 lần cho cùng 1 booking.
     */
    @Scheduled(fixedRate = ONE_HOUR_FIXED_RATE_MS)
    @SchedulerLock(name = "showtimeReminder1h", lockAtLeastFor = "PT1M", lockAtMostFor = "PT10M")
    @Transactional(readOnly = true)
    public void sendOneHourReminders() {
        sendRemindersInWindow(ONE_HOUR_WINDOW_START_MIN, ONE_HOUR_WINDOW_END_MIN, "1 giờ");
    }

    /**
     * Mỗi 1 giờ check booking CONFIRMED có showtime trong window
     * [now+24h, now+25h] → gửi reminder 1 ngày. Window 1h khớp fixedRate.
     */
    @Scheduled(fixedRate = DAY_BEFORE_FIXED_RATE_MS)
    @SchedulerLock(name = "showtimeReminderDay", lockAtLeastFor = "PT2M", lockAtMostFor = "PT30M")
    @Transactional(readOnly = true)
    public void sendDayBeforeReminders() {
        sendRemindersInWindow(DAY_BEFORE_WINDOW_START_MIN, DAY_BEFORE_WINDOW_END_MIN, "1 ngày");
    }

    /**
     * Gửi reminder cho mọi booking CONFIRMED có showtime trong window
     * [now + startMin, now + endMin]. Skip vé bán quầy không có email.
     */
    private void sendRemindersInWindow(int startMin, int endMin, String label) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime windowStart = now.plusMinutes(startMin);
        LocalDateTime windowEnd = now.plusMinutes(endMin);

        List<Booking> bookings = bookingRepository
                .findByStatusAndShowtime_StartTimeBetweenAndShowtime_StatusNot(
                        BookingStatus.CONFIRMED, windowStart, windowEnd, ShowtimeStatus.CANCELLED);

        if (bookings.isEmpty()) {
            log.debug("[ShowtimeReminder-{}] Không có booking nào trong window", label);
            return;
        }

        int sent = 0;
        for (Booking b : bookings) {
            if (b.getUser() == null || b.getUser().getEmail() == null) continue;  // counter-sale
            try {
                emailService.sendShowtimeReminderEmail(
                        b.getUser().getEmail(),
                        b.getBookingCode(),
                        b.getShowtime().getMovie().getTitle(),
                        b.getShowtime().getStartTime().format(FMT_VN),
                        b.getShowtime().getRoom().getName(),
                        b.getShowtime().getRoom().getTheater().getName(),
                        label);
                sent++;
            } catch (Exception e) {
                log.warn("[ShowtimeReminder-{}] Failed to send for booking {}: {}",
                        label, b.getBookingCode(), e.getMessage());
            }
        }
        log.info("[ShowtimeReminder-{}] Sent {} reminder emails (window {}-{})",
                label, sent, windowStart, windowEnd);
    }
}
