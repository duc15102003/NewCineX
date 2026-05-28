package com.cinex.module.payment.service;

import com.cinex.common.entity.tracker.IdTrackerService;
import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.module.booking.entity.Booking;
import com.cinex.module.booking.entity.BookingSeatStatus;
import com.cinex.module.booking.entity.BookingStatus;
import com.cinex.module.booking.repository.BookingRepository;
import com.cinex.module.payment.dto.CreatePaymentRequest;
import com.cinex.module.payment.dto.PaymentResponse;
import com.cinex.module.payment.entity.Payment;
import com.cinex.module.payment.entity.PaymentStatus;
import com.cinex.module.payment.processor.PaymentProcessor;
import com.cinex.module.booking.service.SeatWebSocketService;
import com.cinex.module.payment.processor.PaymentProcessorFactory;
import com.cinex.module.payment.event.PaymentCompletedEvent;
import com.cinex.module.payment.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final BookingRepository bookingRepository;
    private final PaymentProcessorFactory processorFactory;
    private final IdTrackerService idTrackerService;
    private final ApplicationEventPublisher eventPublisher;
    private final SeatWebSocketService seatWebSocketService;

    /**
     * Tạo payment → gọi PaymentProcessor (Factory+Strategy) → trả URL.
     *
     * Luồng:
     * 1. Kiểm tra booking HOLDING + chưa có payment
     * 2. Factory chọn processor theo method (VNPAY/MOMO/CASH)
     * 3. Processor tạo payment → trả URL redirect
     * 4. Lưu Payment record (PENDING)
     */
    @Transactional
    public PaymentResponse createPayment(Long userId, CreatePaymentRequest request) {
        Booking booking = bookingRepository.findById(request.getBookingId())
                .orElseThrow(() -> new BusinessException(ErrorCode.BOOKING_NOT_FOUND));

        if (!booking.getUser().getId().equals(userId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Đây không phải đơn đặt vé của bạn");
        }

        if (booking.getStatus() != BookingStatus.HOLDING) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Đơn đặt vé không ở trạng thái chờ thanh toán");
        }

        // Kiểm tra đã có payment chưa
        if (paymentRepository.findByBookingId(booking.getId()).isPresent()) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Đơn đặt vé này đã có thanh toán");
        }

        // Factory chọn processor theo method
        PaymentProcessor processor = processorFactory.getProcessor(request.getPaymentMethod());

        // Sinh transaction code unique
        String transactionCode = idTrackerService.nextCodeWithDate("PAYMENT");

        // Processor tạo payment → trả URL (mock hoặc VNPay redirect)
        String paymentUrl = processor.createPayment(
                transactionCode,
                booking.getTotalAmount(),
                "CineX Booking " + booking.getBookingCode());

        // Lưu payment record
        Payment payment = Payment.builder()
                .booking(booking)
                .amount(booking.getTotalAmount())
                .method(request.getPaymentMethod())
                .transactionCode(transactionCode)
                .status(PaymentStatus.PENDING)
                .build();

        paymentRepository.save(payment);
        log.info("Payment created: {} for booking {}", transactionCode, booking.getBookingCode());

        return toPaymentResponse(payment, paymentUrl);
    }

    /**
     * Xử lý callback từ cổng thanh toán.
     *
     * Luồng (VNPay pattern):
     * 1. User thanh toán xong → cổng redirect về callback URL
     * 2. Server verify callback (processor.verifyCallback)
     * 3. Thành công → Payment COMPLETED + Booking CONFIRMED
     * 4. Publish PaymentCompletedEvent → listener gửi email
     */
    @Transactional
    public PaymentResponse handleCallback(Map<String, String> params) {
        // MoMo trả orderId, VNPay trả vnp_TxnRef, mock trả transactionCode
        String transactionCode = params.getOrDefault("orderId",
                params.getOrDefault("vnp_TxnRef", params.get("transactionCode")));

        Payment payment = paymentRepository.findByTransactionCode(transactionCode)
                .orElseThrow(() -> new BusinessException(ErrorCode.PAYMENT_NOT_FOUND,
                        "Không tìm thấy thanh toán: " + transactionCode));

        if (payment.getStatus() != PaymentStatus.PENDING) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Thanh toán đã được xử lý");
        }

        // Verify callback bằng processor tương ứng
        PaymentProcessor processor = processorFactory.getProcessor(payment.getMethod());
        boolean success = processor.verifyCallback(params);

        if (success) {
            // Payment thành công
            payment.setStatus(PaymentStatus.COMPLETED);
            payment.setPaidAt(LocalDateTime.now());

            // Confirm booking + booking seats
            Booking booking = payment.getBooking();
            booking.setStatus(BookingStatus.CONFIRMED);
            booking.setConfirmedAt(LocalDateTime.now());
            booking.getBookingSeats().forEach(bs -> bs.setStatus(BookingSeatStatus.BOOKED));
            bookingRepository.save(booking);

            // Publish event → listener gửi email (async)
            eventPublisher.publishEvent(new PaymentCompletedEvent(this, payment));

            // Real-time: ghế chuyển từ HELD → BOOKED
            List<Long> seatIds = booking.getBookingSeats().stream()
                    .map(bs -> bs.getSeat().getId()).toList();
            seatWebSocketService.notifySeatChanged(booking.getShowtime().getId(), seatIds, "BOOKED");

            log.info("Payment completed: {} → Booking {} confirmed",
                    transactionCode, booking.getBookingCode());
        } else {
            payment.setStatus(PaymentStatus.FAILED);

            // Hủy booking + trả ghế khi payment thất bại
            Booking booking = payment.getBooking();
            booking.setStatus(BookingStatus.CANCELLED);
            booking.setCancelledAt(java.time.LocalDateTime.now());
            booking.getBookingSeats().forEach(bs -> bs.setStatus(BookingSeatStatus.CANCELLED));
            bookingRepository.save(booking);

            // Real-time: ghế trả lại → notify AVAILABLE
            List<Long> seatIds = booking.getBookingSeats().stream()
                    .map(bs -> bs.getSeat().getId()).toList();
            seatWebSocketService.notifySeatChanged(booking.getShowtime().getId(), seatIds, "AVAILABLE");

            log.warn("Payment failed: {} → Booking {} cancelled", transactionCode, booking.getBookingCode());
        }

        paymentRepository.save(payment);
        return toPaymentResponse(payment, null);
    }

    @Transactional(readOnly = true)
    public PaymentResponse getPaymentByBookingId(Long userId, Long bookingId) {
        Payment payment = paymentRepository.findByBookingId(bookingId)
                .orElseThrow(() -> new BusinessException(ErrorCode.PAYMENT_NOT_FOUND));

        // Ownership check: chỉ chủ booking mới được xem payment
        if (!payment.getBooking().getUser().getId().equals(userId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Đây không phải đơn đặt vé của bạn");
        }

        return toPaymentResponse(payment, null);
    }

    private PaymentResponse toPaymentResponse(Payment payment, String paymentUrl) {
        return PaymentResponse.builder()
                .id(payment.getId())
                .storageState(payment.getStorageState() != null ? payment.getStorageState().name() : null)
                .bookingId(payment.getBooking().getId())
                .bookingCode(payment.getBooking().getBookingCode())
                .amount(payment.getAmount())
                .method(payment.getMethod())
                .transactionCode(payment.getTransactionCode())
                .status(payment.getStatus())
                .paymentUrl(paymentUrl)
                .paidAt(payment.getPaidAt())
                .createdAt(payment.getCreatedAt())
                .updatedAt(payment.getUpdatedAt())
                .build();
    }
}
