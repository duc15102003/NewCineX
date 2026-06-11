package com.cinex.module.payment.service;

import com.cinex.common.audit.Auditable;
import com.cinex.common.entity.tracker.IdTrackerService;
import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.common.service.SecurityService;
import com.cinex.module.booking.entity.Booking;
import com.cinex.module.booking.entity.BookingSeatStatus;
import com.cinex.module.booking.entity.BookingStatus;
import com.cinex.module.booking.repository.BookingRepository;
import com.cinex.module.payment.dto.CreatePaymentRequest;
import com.cinex.module.payment.dto.PaymentFilter;
import com.cinex.module.payment.dto.PaymentResponse;
import com.cinex.module.payment.entity.Payment;
import com.cinex.module.payment.entity.PaymentStatus;
import com.cinex.module.payment.processor.PaymentProcessor;
import com.cinex.module.booking.service.SeatWebSocketService;
import com.cinex.module.payment.processor.PaymentProcessorFactory;
import com.cinex.module.payment.event.PaymentCompletedEvent;
import com.cinex.module.payment.repository.PaymentRepository;
import com.cinex.module.payment.specification.PaymentSpecification;
import com.cinex.common.response.PageResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
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
    private final SecurityService securityService;

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

        // [B1] Idempotency: MoMo có thể gọi callback/IPN nhiều lần (retry).
        // Nếu payment đã được xử lý (COMPLETED/FAILED) → trả response cũ, KHÔNG throw lỗi.
        // MoMo expect 200 OK cho cả 2 lần gọi.
        if (payment.getStatus() == PaymentStatus.COMPLETED
                || payment.getStatus() == PaymentStatus.FAILED
                || payment.getStatus() == PaymentStatus.REFUNDED) {
            log.info("Callback idempotent — payment {} đã ở trạng thái {}, trả response cũ",
                    transactionCode, payment.getStatus());
            return toPaymentResponse(payment, null);
        }

        if (payment.getStatus() != PaymentStatus.PENDING) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Thanh toán đang ở trạng thái không xử lý được: " + payment.getStatus());
        }

        // Verify callback bằng processor tương ứng
        PaymentProcessor processor = processorFactory.getProcessor(payment.getMethod());
        boolean success = processor.verifyCallback(params);

        if (success) {
            // Payment thành công
            payment.setStatus(PaymentStatus.COMPLETED);
            payment.setPaidAt(LocalDateTime.now());

            // [Refund prep] Lưu transId nội bộ của MoMo từ callback để dùng cho refund sau này.
            // MoMo refund API yêu cầu transId (KHÔNG phải orderId/transactionCode của ta).
            String gatewayTxId = params.get("transId");
            if (gatewayTxId != null && !gatewayTxId.isBlank()) {
                payment.setGatewayTransactionId(gatewayTxId);
            }

            Booking booking = payment.getBooking();

            // [B4] Race condition: nếu booking đã CANCELLED (do user/scheduler hủy)
            // trong khi MoMo callback đến muộn → KHÔNG được set booking về CONFIRMED.
            // Đánh dấu payment COMPLETED + needsRefund=true để admin query được
            // (SELECT * FROM payments WHERE needs_refund = 1) → xử lý refund manual.
            if (booking.getStatus() != BookingStatus.HOLDING) {
                payment.setNeedsRefund(true);
                log.warn("[REFUND_NEEDED] Payment {} COMPLETED nhưng booking {} đã ở trạng thái {} — đã flag needs_refund=true, admin xử lý hoàn tiền thủ công",
                        transactionCode, booking.getBookingCode(), booking.getStatus());
                paymentRepository.save(payment);
                return toPaymentResponse(payment, null);
            }

            // Confirm booking + booking seats
            booking.setStatus(BookingStatus.CONFIRMED);
            booking.setConfirmedAt(LocalDateTime.now());
            booking.getBookingSeats().forEach(bs -> bs.setStatus(BookingSeatStatus.BOOKED));
            bookingRepository.save(booking);

            // Force initialize LAZY associations TRƯỚC khi publish event.
            //
            // Tại sao? @TransactionalEventListener(AFTER_COMMIT) + @Async → listener chạy ở
            // thread khác SAU KHI transaction đã commit + Session đã đóng. Lúc đó access
            // booking.getUser().getEmail() (proxy LAZY) → Hibernate cần Session để fetch
            // → Session closed → SQLException "The statement is closed.".
            //
            // Cách fix: gọi getter trong transaction này → proxy initialize ngay → khi
            // listener access sau, data đã có sẵn trong entity, không cần Session.
            booking.getUser().getEmail();
            booking.getShowtime().getMovie().getTitle();
            booking.getShowtime().getRoom().getName();
            booking.getBookingSeats().forEach(bs -> bs.getSeat().getSeatNumber());

            // Publish event → listener gửi email (async, sau khi commit transaction)
            eventPublisher.publishEvent(new PaymentCompletedEvent(this, payment));

            // Real-time: ghế chuyển từ HELD → BOOKED
            List<Long> seatIds = booking.getBookingSeats().stream()
                    .map(bs -> bs.getSeat().getId()).toList();
            seatWebSocketService.notifySeatChanged(booking.getShowtime().getId(), seatIds, "BOOKED");

            log.info("Payment completed: {} → Booking {} confirmed",
                    transactionCode, booking.getBookingCode());
        } else {
            payment.setStatus(PaymentStatus.FAILED);

            // [B4] Chỉ cancel booking nếu nó còn HOLDING. Nếu đã CANCELLED rồi thì thôi.
            Booking booking = payment.getBooking();
            if (booking.getStatus() == BookingStatus.HOLDING) {
                booking.setStatus(BookingStatus.CANCELLED);
                booking.setCancelledAt(LocalDateTime.now());
                booking.getBookingSeats().forEach(bs -> bs.setStatus(BookingSeatStatus.CANCELLED));
                bookingRepository.save(booking);

                // Real-time: ghế trả lại → notify AVAILABLE
                List<Long> seatIds = booking.getBookingSeats().stream()
                        .map(bs -> bs.getSeat().getId()).toList();
                seatWebSocketService.notifySeatChanged(booking.getShowtime().getId(), seatIds, "AVAILABLE");

                log.warn("Payment failed: {} → Booking {} cancelled", transactionCode, booking.getBookingCode());
            } else {
                log.warn("Payment failed: {} — booking {} đã ở trạng thái {}, không đổi",
                        transactionCode, booking.getBookingCode(), booking.getStatus());
            }
        }

        paymentRepository.save(payment);
        return toPaymentResponse(payment, null);
    }

    /**
     * Hoàn tiền cho 1 payment đã COMPLETED.
     *
     * Gọi từ BookingService.cancelBooking → đảm bảo logic refund tập trung tại PaymentService,
     * KHÔNG để BookingService set status REFUNDED trực tiếp (vi phạm Single Responsibility).
     *
     * Luồng:
     * 1. Skip nếu payment không ở trạng thái COMPLETED (PENDING/FAILED/REFUNDED đã skip)
     * 2. Lấy processor tương ứng (MoMo/Cash) qua Factory
     * 3. Gọi processor.refund() — cổng thật xử lý hoàn tiền
     * 4. Thành công → set status REFUNDED + save
     * 5. Thất bại → log error, KHÔNG throw (để booking vẫn cancel được, admin xử lý manual)
     */
    /**
     * Liệt kê các payment cần refund thủ công — gọi từ admin dashboard.
     * Không filter theo theater scope vì SUPER_ADMIN only (xem cross-theater).
     */
    @Transactional(readOnly = true)
    public java.util.List<PaymentResponse> listNeedsRefund() {
        return paymentRepository.findByNeedsRefundTrueOrderByPaidAtDesc().stream()
                .map(p -> toPaymentResponse(p, null))
                .toList();
    }

    @Transactional
    @Auditable(action = "REFUND_PAYMENT", entityType = "Payment")
    public void refundPayment(Payment payment, String reason) {
        if (payment.getStatus() != PaymentStatus.COMPLETED) {
            log.warn("Skip refund — payment {} status is {}", payment.getTransactionCode(), payment.getStatus());
            return;
        }
        PaymentProcessor processor = processorFactory.getProcessor(payment.getMethod());
        boolean success = processor.refund(
                payment.getTransactionCode(),
                payment.getGatewayTransactionId(),
                payment.getAmount(),
                reason);
        if (success) {
            payment.setStatus(PaymentStatus.REFUNDED);
            // Refund thành công → clear flag race-condition
            payment.setNeedsRefund(false);
            paymentRepository.save(payment);
            log.info("Refunded payment {}", payment.getTransactionCode());
        } else {
            // KHÔNG throw — để booking vẫn cancel được. Admin sẽ xử lý refund thủ công.
            log.error("Refund failed for payment {} — cần admin xử lý thủ công", payment.getTransactionCode());
        }
    }

    /**
     * Admin list payment với filter động (Specification).
     *
     * <p>RBAC scope: branch ADMIN bị override filter.theaterId theo chi nhánh mình
     * (chain JOIN payment.booking.showtime.room.theater). SUPER_ADMIN giữ filter nguyên.
     */
    @Transactional(readOnly = true)
    public PageResponse<PaymentResponse> listPayments(PaymentFilter filter, Pageable pageable) {
        Long scopedTheaterId = securityService.getCurrentUserTheaterId();
        if (scopedTheaterId != null) {
            filter.setTheaterId(scopedTheaterId);
        }
        Specification<Payment> spec = PaymentSpecification.fromFilter(filter);
        Page<Payment> page = paymentRepository.findAll(spec, pageable);
        Page<PaymentResponse> mapped = page.map(p -> toPaymentResponse(p, null));
        return PageResponse.from(mapped);
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
        // theater dùng booking.theater direct field (snapshot immutable). Tránh chain LAZY 3-hop.
        var booking = payment.getBooking();
        var theater = booking != null ? booking.getTheater() : null;
        return PaymentResponse.builder()
                .id(payment.getId())
                .storageState(payment.getStorageState() != null ? payment.getStorageState().name() : null)
                .bookingId(payment.getBooking().getId())
                .bookingCode(payment.getBooking().getBookingCode())
                .theaterId(theater != null ? theater.getId() : null)
                .theaterName(theater != null ? theater.getName() : null)
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
