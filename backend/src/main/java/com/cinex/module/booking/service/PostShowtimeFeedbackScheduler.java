package com.cinex.module.booking.service;

import com.cinex.common.service.EmailService;
import com.cinex.module.booking.entity.Booking;
import com.cinex.module.booking.entity.BookingStatus;
import com.cinex.module.booking.repository.BookingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Email mời khách đánh giá phim sau khi xem — chuẩn industry (CGV/Lotte/BHD).
 *
 * <p><b>Khi gửi:</b> 24h sau showtime kết thúc, cho mọi booking CHECKED_IN
 * (khách đã thật sự đi xem — không gửi cho NO_SHOW/CANCELLED).
 *
 * <p><b>Tác dụng:</b> tăng tỷ lệ feedback từ 2-3% lên 8-12% (industry data).
 * Review của khách cũ giúp khách mới chọn phim → tăng booking trên app.
 *
 * <p>Chạy mỗi 1 giờ, window 1h khớp fixedRate để không gửi trùng cho cùng booking.
 * Window {@code [endTime + 24h, endTime + 25h]} — sai số ±30 phút quanh mốc 24h
 * tùy lúc scheduler tick.
 *
 * <p>Counter-sale (booking.user == null) skip — không có email gửi.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class PostShowtimeFeedbackScheduler {

    /** 1 giờ — fixedRate khớp với window 1h. */
    private static final long FIXED_RATE_MS = 60 * 60 * 1000L;
    private static final int WINDOW_START_MIN = 24 * 60;        // 24h
    private static final int WINDOW_END_MIN = 24 * 60 + 60;     // 25h

    private final BookingRepository bookingRepository;
    private final EmailService emailService;

    @Value("${app.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    @Scheduled(fixedRate = FIXED_RATE_MS)
    @SchedulerLock(name = "postShowtimeFeedback", lockAtLeastFor = "PT2M", lockAtMostFor = "PT30M")
    @Transactional(readOnly = true)
    public void sendFeedbackEmails() {
        LocalDateTime now = LocalDateTime.now();
        // Window: showtime kết thúc trong [now - 25h, now - 24h]
        // = endTime nằm khoảng "24h trước → 25h trước" hiện tại.
        LocalDateTime windowStart = now.minusMinutes(WINDOW_END_MIN);
        LocalDateTime windowEnd = now.minusMinutes(WINDOW_START_MIN);

        List<Booking> bookings = bookingRepository
                .findByStatusAndShowtime_EndTimeBetween(BookingStatus.CHECKED_IN, windowStart, windowEnd);

        if (bookings.isEmpty()) {
            log.debug("[PostShowtimeFeedback] Không có booking nào cần gửi mời đánh giá");
            return;
        }

        int sent = 0;
        for (Booking b : bookings) {
            if (b.getUser() == null || b.getUser().getEmail() == null) continue;  // counter-sale
            try {
                String movieId = String.valueOf(b.getShowtime().getMovie().getId());
                String reviewUrl = frontendUrl + "/movies/" + movieId;
                emailService.sendPostShowtimeFeedbackEmail(
                        b.getUser().getEmail(),
                        b.getBookingCode(),
                        b.getShowtime().getMovie().getTitle(),
                        reviewUrl);
                sent++;
            } catch (Exception e) {
                log.warn("[PostShowtimeFeedback] Failed to send for booking {}: {}",
                        b.getBookingCode(), e.getMessage());
            }
        }
        log.info("[PostShowtimeFeedback] Sent {} feedback emails (window {}-{})",
                sent, windowStart, windowEnd);
    }
}
