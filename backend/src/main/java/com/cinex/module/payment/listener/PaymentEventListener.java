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
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.text.NumberFormat;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.stream.Collectors;

/**
 * [Observer Pattern] Lắng nghe PaymentCompletedEvent.
 * Khi thanh toán thành công → tạo notification + gửi email vé.
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
    @EventListener
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

        // 1. Tạo notification cho user
        notificationService.createNotification(
                userId,
                "Thanh toán thành công",
                "Vé " + bookingCode + " đã được xác nhận. Chúc bạn xem phim vui vẻ!",
                NotificationType.BOOKING
        );

        // 2. Gửi email xác nhận vé
        String email = booking.getUser().getEmail();
        String movieTitle = booking.getShowtime().getMovie().getTitle();
        String roomName = booking.getShowtime().getRoom().getName();
        String startTime = booking.getShowtime().getStartTime().format(DT_FMT);
        String seats = booking.getBookingSeats().stream()
                .map(bs -> bs.getSeat().getSeatNumber())
                .collect(Collectors.joining(", "));
        String totalAmount = VND_FMT.format(booking.getTotalAmount()) + "đ";

        byte[] qrCode = qrCodeService.generateQrCode(bookingCode, 200);
        emailService.sendBookingConfirmationEmail(email, bookingCode, movieTitle, roomName, startTime, seats, totalAmount, qrCode);

        log.info("Payment completed → notification + email sent for booking {}", bookingCode);
    }
}
