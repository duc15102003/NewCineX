package com.cinex.module.booking.service;

import com.cinex.module.booking.entity.Booking;
import com.cinex.module.booking.entity.BookingSeatStatus;
import com.cinex.module.booking.entity.BookingStatus;
import com.cinex.module.booking.repository.BookingRepository;
import com.cinex.module.config.service.SystemConfigService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class BookingCleanupScheduler {

    private final BookingRepository bookingRepository;
    private final SystemConfigService systemConfigService;
    private final SeatWebSocketService seatWebSocketService;

    @Scheduled(fixedRate = 60000)
    @Transactional
    public void cleanupExpiredHolds() {
        int holdMinutes = systemConfigService.getInt("booking.hold_minutes", 10);
        LocalDateTime expireBefore = LocalDateTime.now().minusMinutes(holdMinutes);

        List<Booking> expiredBookings = bookingRepository.findByStatusAndCreatedAtBefore(
                BookingStatus.HOLDING, expireBefore);

        for (Booking booking : expiredBookings) {
            booking.setStatus(BookingStatus.EXPIRED);
            booking.getBookingSeats().forEach(bs -> bs.setStatus(BookingSeatStatus.CANCELLED));
            bookingRepository.save(booking);

            // Real-time: ghế hết hạn → notify AVAILABLE cho tất cả user đang xem
            List<Long> seatIds = booking.getBookingSeats().stream()
                    .map(bs -> bs.getSeat().getId()).toList();
            seatWebSocketService.notifySeatChanged(booking.getShowtime().getId(), seatIds, "AVAILABLE");

            log.info("Expired booking {} (held for > {} minutes)", booking.getBookingCode(), holdMinutes);
        }

        if (!expiredBookings.isEmpty()) {
            log.info("Cleaned up {} expired bookings", expiredBookings.size());
        }
    }
}
