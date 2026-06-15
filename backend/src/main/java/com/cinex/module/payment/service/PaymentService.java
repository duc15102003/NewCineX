package com.cinex.module.payment.service;

import com.cinex.common.audit.Auditable;
import com.cinex.common.entity.tracker.IdTrackerService;

import java.math.BigDecimal;
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
import com.cinex.module.payment.entity.PaymentMethod;
import com.cinex.module.payment.entity.PaymentStatus;
import com.cinex.module.payment.processor.PaymentProcessor;
import com.cinex.module.booking.service.SeatWebSocketService;
import com.cinex.module.payment.processor.PaymentProcessorFactory;
import com.cinex.module.payment.event.PaymentCompletedEvent;
import com.cinex.module.config.service.SystemConfigService;
import com.cinex.module.payment.repository.PaymentRepository;
import com.cinex.module.voucher.service.VoucherService;
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
    private final VoucherService voucherService;
    private final SystemConfigService systemConfigService;

    /**
     * Tạo payment → gọi PaymentProcessor (Factory+Strategy) → trả URL.
     *
     * Luồng:
     * 1. Kiểm tra booking HOLDING + chưa có payment
     * 2. Factory chọn processor theo method (MOMO/CASH/CARD_POS/TRANSFER)
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

        // Đơn 0đ — đã được giảm 100% bằng loyalty point / voucher / promotion
        // → KHÔNG gọi cổng thanh toán (MoMo từ chối <10k, CASH tại quầy vô
        // nghĩa cho 0đ). Auto-confirm như "vé miễn phí" (industry pattern
        // CGV/Lotte: gift voucher / loyalty full redeem → vé tự confirm).
        if (booking.getTotalAmount().signum() <= 0) {
            return confirmFreeBooking(booking);
        }

        // Retry-friendly: payment FAILED cho phép retry — reset cùng row sang
        // PENDING với transactionCode mới. PENDING/COMPLETED block. User
        // thanh toán fail → chuyển method khác (MoMo → CASH/CARD POS) thay
        // vì phải book lại từ đầu.
        var existing = paymentRepository.findByBookingId(booking.getId());
        Payment payment;
        if (existing.isPresent()) {
            payment = existing.get();
            PaymentStatus status = payment.getStatus();
            if (status == PaymentStatus.PENDING || status == PaymentStatus.COMPLETED) {
                throw new BusinessException(ErrorCode.INVALID_REQUEST,
                        "Đơn đặt vé này đã có thanh toán đang xử lý hoặc đã hoàn tất");
            }
            // FAILED → reset cho retry
            log.info("Retry payment cho booking {} — payment cũ {} ở trạng thái {}",
                    booking.getBookingCode(), payment.getTransactionCode(), status);
        } else {
            payment = null;
        }

        // Block online booking dùng method chỉ phù hợp POS quầy. CASH (tiền
        // mặt) + CARD_POS (thẻ qua máy) + TRANSFER (chuyển khoản) đều không
        // auto-confirm online được → user click "Thanh toán" rồi đi đâu? Online
        // chỉ MOMO/VNPay đi qua gateway redirect.
        PaymentMethod requestMethod = request.getPaymentMethod();
        if (requestMethod == PaymentMethod.CASH
                || requestMethod == PaymentMethod.CARD_POS
                || requestMethod == PaymentMethod.TRANSFER) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Đặt vé online chỉ hỗ trợ ví điện tử (MoMo). "
                            + "Phương thức tiền mặt / thẻ POS / chuyển khoản chỉ dùng tại quầy.");
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

        // Tạo mới hoặc update record existing (retry case)
        if (payment == null) {
            payment = Payment.builder()
                    .booking(booking)
                    .amount(booking.getTotalAmount())
                    .method(request.getPaymentMethod())
                    .transactionCode(transactionCode)
                    .status(PaymentStatus.PENDING)
                    .build();
        } else {
            payment.setMethod(request.getPaymentMethod());
            payment.setTransactionCode(transactionCode);
            payment.setStatus(PaymentStatus.PENDING);
            payment.setAmount(booking.getTotalAmount());
            payment.setGatewayTransactionId(null);
            payment.setPaidAt(null);
        }

        paymentRepository.save(payment);
        log.info("Payment created/retried: {} for booking {}", transactionCode, booking.getBookingCode());

        return toPaymentResponse(payment, paymentUrl);
    }

    /**
     * Auto-confirm booking khi totalAmount = 0 (vé miễn phí do loyalty/voucher
     * phủ 100%). Tạo Payment record COMPLETED method=CASH (semantic "không phải
     * trả gì thêm"), confirm booking, publish event để loyalty listener earn
     * điểm theo seatTotalAmount như booking trả tiền bình thường.
     *
     * <p>Dùng method=CASH (không tạo enum FREE riêng) vì:
     * <ul>
     *   <li>Không cần track riêng — báo cáo doanh thu lọc theo {@code amount > 0}</li>
     *   <li>Refund flow giữ nguyên (CashPaymentProcessor.refund là no-op log)</li>
     * </ul>
     */
    private PaymentResponse confirmFreeBooking(Booking booking) {
        String transactionCode = idTrackerService.nextCodeWithDate("PAYMENT");
        Payment payment = Payment.builder()
                .booking(booking)
                .amount(BigDecimal.ZERO)
                .method(PaymentMethod.CASH)
                .transactionCode(transactionCode)
                .status(PaymentStatus.COMPLETED)
                .paidAt(LocalDateTime.now())
                .build();
        paymentRepository.save(payment);

        booking.setStatus(BookingStatus.CONFIRMED);
        booking.setConfirmedAt(LocalDateTime.now());
        booking.getBookingSeats().forEach(bs -> bs.setStatus(BookingSeatStatus.BOOKED));
        bookingRepository.save(booking);

        eventPublisher.publishEvent(new PaymentCompletedEvent(this, payment));

        List<Long> seatIds = booking.getBookingSeats().stream()
                .map(bs -> bs.getSeat().getId()).toList();
        seatWebSocketService.notifySeatChanged(booking.getShowtime().getId(), seatIds, "BOOKED");

        log.info("Free booking {} auto-confirmed (0đ — covered by loyalty/voucher)",
                booking.getBookingCode());
        return toPaymentResponse(payment, null);
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
            // Defense in depth: verify callback amount khớp với payment.amount.
            // Phòng case MoMo callback trả amount=50000 cho payment 100000 → tránh
            // under-charge. Pattern industry: signature OK chưa đủ, phải re-check
            // amount đúng record.
            String callbackAmountStr = params.get("amount");
            if (callbackAmountStr != null && !callbackAmountStr.isBlank()) {
                try {
                    BigDecimal callbackAmount = new BigDecimal(callbackAmountStr);
                    if (callbackAmount.compareTo(payment.getAmount()) != 0) {
                        log.error("[AMOUNT_MISMATCH] Payment {}: callback amount={}, payment.amount={} — fraud attempt hoặc lỗi gateway",
                                transactionCode, callbackAmount, payment.getAmount());
                        payment.setStatus(PaymentStatus.FAILED);
                        paymentRepository.save(payment);
                        throw new BusinessException(ErrorCode.INVALID_REQUEST,
                                "Số tiền callback không khớp với giao dịch");
                    }
                } catch (NumberFormatException nfe) {
                    log.warn("Callback amount không parse được: {}", callbackAmountStr);
                }
            }

            // Payment thành công
            payment.setStatus(PaymentStatus.COMPLETED);
            payment.setPaidAt(LocalDateTime.now());

            // [Refund prep] Lưu transId nội bộ của MoMo từ callback để dùng cho refund sau này.
            // MoMo refund API yêu cầu transId (KHÔNG phải orderId/transactionCode của ta).
            String gatewayTxId = params.get("transId");
            if (gatewayTxId != null && !gatewayTxId.isBlank()) {
                payment.setGatewayTransactionId(gatewayTxId);
            }

            // Pessimistic lock booking — chống race condition khi user/scheduler
            // đổi status giữa check + update. Trước đây bug: callback verify OK,
            // check status=HOLDING, nhưng giữa check và set CONFIRMED, thread khác
            // có thể đổi status → payment COMPLETED + booking CANCELLED inconsistent.
            // Lock force serialize 2 thread, thread thứ 2 đợi thread 1 commit rồi
            // mới read được status mới nhất.
            Booking booking = bookingRepository.findByIdForUpdate(payment.getBooking().getId())
                    .orElseThrow(() -> new BusinessException(ErrorCode.BOOKING_NOT_FOUND));

            // [B4] Race condition: nếu booking đã CANCELLED (do user/scheduler hủy)
            // trước khi callback đến → KHÔNG được set booking về CONFIRMED.
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

            // KHÔNG cần force-init LAZY nữa: paymentRepository.findByTransactionCode
            // đã @EntityGraph fetch toàn bộ graph (user, movie, room, seats) trong
            // 1 query → @Async listener access không gặp LazyInitializationException.

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

            // Industry chuẩn (CGV/Lotte/MoMo retry): payment FAIL KHÔNG auto-cancel
            // booking nữa. Giữ booking HOLDING → user retry payment khác (CASH/CARD
            // POS/voucher khác). BookingCleanupScheduler sẽ expire HOLDING sau
            // 10 phút (booking.hold_minutes) nếu user không retry → fallback cleanup.
            //
            // Voucher: KHÔNG return vội — nếu return rồi user retry payment khác
            // (cùng booking), VoucherUsage đã xoá → useVoucher gọi lại tăng count
            // sai. Cleanup scheduler khi expire booking sẽ return voucher.
            Booking booking = payment.getBooking();
            log.warn("Payment {} failed → Booking {} GIỮ HOLDING cho user retry. " +
                    "BookingCleanupScheduler sẽ expire sau {} phút nếu không retry.",
                    transactionCode, booking.getBookingCode(),
                    systemConfigService.getInt("booking.hold_minutes", 10));
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

    /**
     * Admin endpoint refund — tìm payment theo id, RBAC check theater scope,
     * gọi refundPayment internal. Dùng cho race condition needs_refund=true
     * hoặc admin cần intervene khi customer dispute.
     */
    @Transactional
    @Auditable(action = "MANUAL_REFUND_PAYMENT", entityType = "Payment")
    public PaymentResponse manualRefund(Long paymentId, String reason) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new BusinessException(ErrorCode.PAYMENT_NOT_FOUND));
        // RBAC: branch ADMIN chỉ refund payment thuộc CN mình
        securityService.requireAccessToTheater(payment.getBooking().getShowtime().getRoom().getTheater().getId());
        if (payment.getStatus() != PaymentStatus.COMPLETED) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Chỉ có thể refund payment ở trạng thái COMPLETED. Hiện tại: " + payment.getStatus());
        }
        refundPayment(payment, reason);
        return toPaymentResponse(payment, null);
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
