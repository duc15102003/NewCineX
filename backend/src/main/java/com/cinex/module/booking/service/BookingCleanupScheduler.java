package com.cinex.module.booking.service;

import com.cinex.common.entity.StorageState;
import com.cinex.module.booking.entity.Booking;
import com.cinex.module.booking.entity.BookingSeatStatus;
import com.cinex.module.booking.entity.BookingStatus;
import com.cinex.module.booking.repository.BookingRepository;
import com.cinex.module.config.service.SystemConfigService;
import com.cinex.module.voucher.entity.VoucherUsage;
import com.cinex.module.voucher.repository.VoucherRepository;
import com.cinex.module.voucher.repository.VoucherUsageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
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
    private final VoucherUsageRepository voucherUsageRepository;
    private final VoucherRepository voucherRepository;

    @Scheduled(fixedRate = 60000)
    @SchedulerLock(name = "bookingCleanup", lockAtLeastFor = "PT30S", lockAtMostFor = "PT5M")
    @Transactional
    public void cleanupExpiredHolds() {
        int holdMinutes = systemConfigService.getInt("booking.hold_minutes", 10);
        LocalDateTime expireBefore = LocalDateTime.now().minusMinutes(holdMinutes);

        List<Booking> expiredBookings = bookingRepository.findByStatusAndCreatedAtBeforeAndStorageStateNot(
                BookingStatus.HOLDING, expireBefore, StorageState.ARCHIVED);

        int success = 0;
        int failed = 0;
        for (Booking booking : expiredBookings) {
            // Cô lập lỗi per-item: nếu 1 booking lỗi (DB constraint, lazy load, ...)
            // → log + skip, các booking khác vẫn được cleanup. Trước đây 1 lỗi
            // sẽ rollback cả loop → bookings sau bị stuck HOLDING vĩnh viễn.
            try {
                expireSingleBooking(booking, holdMinutes);
                success++;
            } catch (Exception e) {
                failed++;
                log.error("Cleanup failed for booking {}: {}",
                        booking.getBookingCode(), e.getMessage(), e);
            }
        }

        if (success > 0 || failed > 0) {
            log.info("Cleanup batch: {} expired OK, {} failed (will retry next tick)", success, failed);
        }
    }

    /** Tách method để try-catch per item gọn — vẫn cùng @Transactional outer. */
    private void expireSingleBooking(Booking booking, int holdMinutes) {
        booking.setStatus(BookingStatus.EXPIRED);
        booking.getBookingSeats().forEach(bs -> bs.setStatus(BookingSeatStatus.CANCELLED));
        bookingRepository.save(booking);

        // [G1] Trả lại voucher: decrement used_count atomic + xóa voucher_usage.
        List<VoucherUsage> usages = voucherUsageRepository.findByBookingId(booking.getId());
        for (VoucherUsage usage : usages) {
            voucherRepository.decrementUsedCount(usage.getVoucher().getId());
            voucherUsageRepository.delete(usage);
            log.info("Voucher {} returned for expired booking {}",
                    usage.getVoucher().getCode(), booking.getBookingCode());
        }

        // Real-time: ghế hết hạn → notify AVAILABLE cho tất cả user đang xem.
        // WS errors đã được isolate trong SeatWebSocketService.notifySeatChanged.
        List<Long> seatIds = booking.getBookingSeats().stream()
                .map(bs -> bs.getSeat().getId()).toList();
        seatWebSocketService.notifySeatChanged(booking.getShowtime().getId(), seatIds, "AVAILABLE");

        log.info("Expired booking {} (held for > {} minutes)", booking.getBookingCode(), holdMinutes);
    }
}
