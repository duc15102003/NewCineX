package com.cinex.module.payment.listener;

import com.cinex.common.service.EmailService;
import com.cinex.common.service.QrCodeService;
import com.cinex.module.booking.entity.Booking;
import com.cinex.module.notification.entity.NotificationType;
import com.cinex.module.notification.service.NotificationService;
import com.cinex.module.payment.entity.Payment;
import com.cinex.module.payment.event.PaymentCompletedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.text.NumberFormat;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.stream.Collectors;

/**
 * [Observer Pattern] Lắng nghe PaymentCompletedEvent.
 * Khi thanh toán thành công → tạo notification + gửi email vé.
 *
 * [B5] @TransactionalEventListener(AFTER_COMMIT): chỉ xử lý SAU KHI transaction
 * publish event đã commit thành công. Nếu PaymentService rollback (vd: lưu DB lỗi)
 * thì email/notification KHÔNG bị gửi — tránh email "thanh toán thành công" cho
 * giao dịch thực tế đã fail.
 *
 * @Async: chạy trên thread riêng → không block response.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class PaymentEventListener {

    private final NotificationService notificationService;
    private final EmailService emailService;
    private final QrCodeService qrCodeService;

    private static final DateTimeFormatter DT_FMT = DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy");
    private static final NumberFormat VND_FMT = NumberFormat.getInstance(new Locale("vi", "VN"));

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handlePaymentCompleted(PaymentCompletedEvent event) {
        Payment payment = event.getPayment();
        Booking booking = payment.getBooking();
        String bookingCode = booking.getBookingCode();

        // POS bán vé tại quầy: user = null (khách vãng lai) → không gửi notification/email
        if (booking.getUser() == null) {
            log.info("Counter sale {} — skip notification/email (no user)", bookingCode);
            return;
        }

        Long userId = booking.getUser().getId();
        String email = booking.getUser().getEmail();

        // Step 1: notification (DB) — log + isolate
        try {
            notificationService.createNotification(
                    userId,
                    "Thanh toán thành công",
                    "Vé " + bookingCode + " đã được xác nhận. Chúc bạn xem phim vui vẻ!",
                    NotificationType.BOOKING
            );
            log.info("[BOOKING_EMAIL] Notification created for booking {}", bookingCode);
        } catch (Exception e) {
            log.error("[BOOKING_EMAIL] Notification creation FAILED for booking {}: {}",
                    bookingCode, e.getMessage(), e);
            // Tiếp tục — email vẫn nên thử gửi
        }

        // Step 2: gen QR — isolated try/catch để fail QR không block khả năng gửi email plain
        byte[] qrCode = null;
        try {
            qrCode = qrCodeService.generateQrCode(booking.getQrToken(), 200);
            log.info("[BOOKING_EMAIL] QR generated for booking {} ({} bytes)", bookingCode, qrCode.length);
        } catch (Exception e) {
            log.error("[BOOKING_EMAIL] QR generation FAILED for booking {}: {}",
                    bookingCode, e.getMessage(), e);
        }

        // Step 3: gửi email — isolated try/catch để log clearly
        try {
            String movieTitle = booking.getShowtime().getMovie().getTitle();
            String roomName = booking.getShowtime().getRoom().getName();
            String startTime = booking.getShowtime().getStartTime().format(DT_FMT);
            String seats = booking.getBookingSeats().stream()
                    .map(bs -> bs.getSeat().getSeatNumber())
                    .collect(Collectors.joining(", "));
            String totalAmount = VND_FMT.format(booking.getTotalAmount()) + "đ";

            emailService.sendBookingConfirmationEmail(
                    email, bookingCode, movieTitle, roomName, startTime, seats, totalAmount, qrCode);
            log.info("[BOOKING_EMAIL] Email enqueued for {} (booking {})", email, bookingCode);
        } catch (Exception e) {
            // Bắt mọi exception (Thymeleaf TemplateProcessingException, NPE, ...) — không để
            // @Async swallow silently rồi user mất email mà không biết tại sao.
            log.error("[BOOKING_EMAIL] Send FAILED for {} (booking {}): {}",
                    email, bookingCode, e.getMessage(), e);
        }
    }
}
