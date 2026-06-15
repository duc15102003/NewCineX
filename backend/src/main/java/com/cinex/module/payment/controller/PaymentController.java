package com.cinex.module.payment.controller;

import com.cinex.common.exception.BusinessException;
import com.cinex.common.response.ApiResponse;
import com.cinex.common.response.PageResponse;
import com.cinex.common.service.SecurityService;
import com.cinex.module.payment.dto.CreatePaymentRequest;
import com.cinex.module.payment.dto.PaymentFilter;
import com.cinex.module.payment.dto.PaymentResponse;
import com.cinex.module.payment.dto.TicketResponse;
import com.cinex.module.payment.service.PaymentService;
import com.cinex.module.payment.service.TicketService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Payment", description = "Payment processing")
public class PaymentController {

    private final PaymentService paymentService;
    private final TicketService ticketService;
    private final SecurityService securityService;

    @org.springframework.beans.factory.annotation.Value("${app.frontend-url}")
    private String frontendUrl;

    /**
     * (Admin) List tất cả payment với filter động.
     *
     * <p>Hỗ trợ filter: keyword (transactionCode/bookingCode), status, method,
     * paidFrom/paidTo, createdFrom/createdTo, minAmount/maxAmount, userId, bookingId.
     */
    @GetMapping("/payments")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) List payments với filter")
    public ApiResponse<PageResponse<PaymentResponse>> listPayments(
            PaymentFilter filter,
            @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        return ApiResponse.ok(paymentService.listPayments(filter, pageable));
    }

    /**
     * Liệt kê các payment race-condition cần admin xử lý refund thủ công.
     * Trường hợp: MoMo callback đến muộn sau khi booking đã CANCELLED → tiền
     * đã trừ user mà vé không issue. Admin vào trang này → click "Refund" cho
     * từng payment để gọi MoMo refund API.
     */
    @GetMapping("/payments/needs-refund")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Operation(summary = "(SuperAdmin) Danh sách payment cần refund thủ công (race condition)")
    public ApiResponse<java.util.List<PaymentResponse>> listNeedsRefund() {
        return ApiResponse.ok(paymentService.listNeedsRefund());
    }

    @PostMapping("/payments/create")
    @Operation(summary = "Create payment for a booking")
    public ApiResponse<PaymentResponse> createPayment(@Valid @RequestBody CreatePaymentRequest request) {
        Long userId = securityService.getCurrentUserId();
        return ApiResponse.ok("Payment created", paymentService.createPayment(userId, request));
    }

    /**
     * Callback từ cổng thanh toán (VNPay pattern).
     * Cổng redirect user về URL này với params (transactionCode, status, ...).
     */
    @GetMapping("/payments/callback")
    @Operation(summary = "Payment callback (user redirect) — redirect to FE result page")
    public void paymentCallback(@RequestParam Map<String, String> params,
                                 jakarta.servlet.http.HttpServletResponse response) throws java.io.IOException {
        PaymentResponse result = paymentService.handleCallback(params);
        // Redirect user về FE trang kết quả
        String feUrl = frontendUrl + "/payment/result?bookingId=" + result.getBookingId()
                + "&transactionCode=" + result.getTransactionCode();
        response.sendRedirect(feUrl);
    }

    /**
     * [B2] MoMo IPN (Instant Payment Notification) — server-to-server POST.
     * MoMo gửi JSON body trực tiếp tới endpoint này khi giao dịch xong (kể cả khi user
     * không quay lại trang). Server-to-server nên đáng tin cậy hơn redirect URL.
     *
     * MoMo expect response JSON {"partnerCode":"...","resultCode":0} để xác nhận đã xử lý.
     * Nếu trả khác → MoMo retry IPN nhiều lần → handleCallback PHẢI idempotent (đã fix ở B1).
     *
     * Docs: https://developers.momo.vn/v3/vi/docs/payment/api/wallet/onepay#ipn-url
     */
    @PostMapping("/payments/ipn")
    @Operation(summary = "MoMo IPN (server-to-server) — instant payment notification")
    public Map<String, Object> paymentIpn(@RequestBody Map<String, Object> body) {
        // MoMo gửi JSON với các field giống callback nhưng value có thể là số → ép sang String
        Map<String, String> params = new java.util.HashMap<>();
        body.forEach((k, v) -> params.put(k, v == null ? "" : String.valueOf(v)));

        try {
            paymentService.handleCallback(params);
        } catch (BusinessException e) {
            // Lỗi nghiệp vụ (chữ ký sai, payment không tìm thấy, đã xử lý rồi) — log warn,
            // vẫn trả response 200 để MoMo không retry vô tận (handleCallback đã idempotent).
            log.warn("Payment IPN business error: orderId={}, error={}",
                    params.getOrDefault("orderId", "?"), e.getMessage());
        } catch (RuntimeException e) {
            // Lỗi không lường trước — log error với stack trace để admin investigate.
            // Vẫn trả response 200 để MoMo không spam retry; admin tự fix qua dashboard.
            log.error("Payment IPN unexpected error: orderId={}",
                    params.getOrDefault("orderId", "?"), e);
        }

        Map<String, Object> resp = new java.util.LinkedHashMap<>();
        resp.put("partnerCode", params.getOrDefault("partnerCode", ""));
        resp.put("requestId", params.getOrDefault("requestId", ""));
        resp.put("orderId", params.getOrDefault("orderId", ""));
        resp.put("resultCode", 0);
        resp.put("message", "Confirmed");
        resp.put("responseTime", System.currentTimeMillis());
        return resp;
    }

    @GetMapping("/payments/{bookingId}")
    @Operation(summary = "Get payment status by booking ID")
    public ApiResponse<PaymentResponse> getPayment(@PathVariable Long bookingId) {
        Long userId = securityService.getCurrentUserId();
        return ApiResponse.ok(paymentService.getPaymentByBookingId(userId, bookingId));
    }

    @GetMapping("/bookings/{bookingId}/ticket")
    @Operation(summary = "Get digital ticket with QR code")
    public ApiResponse<TicketResponse> getTicket(@PathVariable Long bookingId) {
        Long userId = securityService.getCurrentUserId();
        return ApiResponse.ok(ticketService.generateTicket(userId, bookingId));
    }

    /**
     * Manual refund cho payment race-condition (needs_refund=true) hoặc admin
     * cần intervene. Trước đây không có endpoint → admin chỉ có thể flag
     * needs_refund qua callback handler, không trigger được refund.
     */
    @PostMapping("/admin/payments/{paymentId}/refund")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) Manual refund payment — dùng cho race condition needs_refund=true")
    public ApiResponse<PaymentResponse> manualRefund(
            @PathVariable Long paymentId,
            @RequestBody(required = false) java.util.Map<String, String> body) {
        String reason = body != null
                ? body.getOrDefault("reason", "Manual refund by admin")
                : "Manual refund by admin";
        PaymentResponse result = paymentService.manualRefund(paymentId, reason);
        return ApiResponse.ok("Refund triggered", result);
    }

}
