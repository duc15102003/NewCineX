package com.cinex.module.loyalty.listener;

import com.cinex.module.booking.entity.Booking;
import com.cinex.module.loyalty.service.LoyaltyService;
import com.cinex.module.payment.event.PaymentCompletedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * [Observer Pattern] Listener earn loyalty points khi PaymentCompletedEvent xảy ra.
 *
 * <p><b>Vì sao tách Listener khỏi BookingService?</b>
 * <ul>
 *   <li>BookingService không biết về Loyalty domain → loose coupling</li>
 *   <li>Thêm Listener mới (vd gửi SMS, bumps recommendation score) không cần sửa BookingService</li>
 *   <li>Loyalty fail KHÔNG rollback booking — chỉ log warning</li>
 * </ul>
 *
 * <p><b>@TransactionalEventListener(AFTER_COMMIT):</b> chỉ trigger SAU KHI transaction
 * publish event đã commit. Tránh earn cho booking sau đó bị rollback.
 *
 * <p><b>Propagation.REQUIRES_NEW:</b> bắt buộc vì @TransactionalEventListener chạy ngoài
 * outer transaction (đã commit) — nếu không có new transaction, save không persist.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class LoyaltyEventListener {

    private final LoyaltyService loyaltyService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handlePaymentCompleted(PaymentCompletedEvent event) {
        Booking booking = event.getPayment().getBooking();
        try {
            int earned = loyaltyService.earnFromBooking(booking);
            if (earned > 0) {
                log.info("Earned {} loyalty points for booking {}", earned, booking.getBookingCode());
            }
        } catch (Exception e) {
            // Loyalty fail KHÔNG được lan ra ngoài (đã ngoài outer tx, không rollback được nữa).
            // Log để admin investigate; user vẫn có vé bình thường.
            log.error("Failed to earn loyalty for booking {}: {}", booking.getBookingCode(), e.getMessage(), e);
        }
    }
}
