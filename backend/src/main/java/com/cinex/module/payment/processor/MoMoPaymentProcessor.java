package com.cinex.module.payment.processor;

import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.util.Map;
import java.util.UUID;

/**
 * [Strategy Pattern] MoMo Sandbox — cổng thanh toán MoMo (môi trường test).
 *
 * Flow:
 * 1. createPayment() → gọi MoMo API tạo link thanh toán
 * 2. User quét QR hoặc nhập thông tin trên trang MoMo
 * 3. MoMo redirect về returnUrl → verifyCallback() kiểm tra chữ ký
 *
 * Test: dùng app MoMo Test hoặc tài khoản test trên developers.momo.vn
 *
 * Docs: https://developers.momo.vn/v3/vi/docs/payment/api/wallet/pay
 */
@Component("MOMO")
@Slf4j
public class MoMoPaymentProcessor implements PaymentProcessor {

    @Value("${momo.partner-code:MOMO}")
    private String partnerCode;

    @Value("${momo.access-key:F8BBA842ECF85}")
    private String accessKey;

    @Value("${momo.secret-key:K951B6PE1waDMi640xX08PD3vg6EkVlz}")
    private String secretKey;

    @Value("${momo.api-url:https://test-payment.momo.vn/v2/gateway/api/create}")
    private String apiUrl;

    @Value("${momo.refund-url:https://test-payment.momo.vn/v2/gateway/api/refund}")
    private String refundUrl;

    /**
     * [B2] redirectUrl — nơi MoMo redirect TRÌNH DUYỆT user về sau khi thanh toán.
     * Trỏ thẳng về FE (GET) để FE hiển thị trang kết quả ngay.
     * FE sau đó tự gọi BE /api/payments/{bookingId} để biết trạng thái.
     */
    @Value("${momo.redirect-url:${app.frontend-url:http://localhost:5173}/payment/result}")
    private String redirectUrl;

    /**
     * [B2] ipnUrl — endpoint server-to-server (POST) MoMo gọi để xác nhận giao dịch.
     * KHÁC redirectUrl vì IPN chạy độc lập kể cả khi user đóng browser.
     */
    @Value("${momo.ipn-url:${app.backend-url:http://localhost:8088}/api/payments/ipn}")
    private String ipnUrl;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newHttpClient();

    /**
     * Giới hạn cứng MoMo theo tài liệu chính thức:
     * https://developers.momo.vn/v3/vi/docs/payment/api/wallet/onetime
     * Min 10.000đ / Max 50.000.000đ per transaction. Validate trước khi gọi API
     * để báo lỗi UX rõ thay vì để MoMo reject với code 22 generic.
     */
    private static final long MOMO_MIN_AMOUNT = 10_000L;
    private static final long MOMO_MAX_AMOUNT = 50_000_000L;

    @Override
    public String createPayment(String transactionCode, BigDecimal amount, String description) {
        long amountLong = amount.longValue();
        // Pre-check ngưỡng MoMo — báo lỗi nghiệp vụ rõ ràng thay vì throw từ
        // network call. User thấy message hành động được (đổi payment method).
        if (amountLong < MOMO_MIN_AMOUNT) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "MoMo chỉ thanh toán đơn từ " + String.format("%,d", MOMO_MIN_AMOUNT)
                            + "đ trở lên. Đơn hiện tại " + String.format("%,d", amountLong)
                            + "đ — vui lòng chọn phương thức Tiền mặt tại quầy.");
        }
        if (amountLong > MOMO_MAX_AMOUNT) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "MoMo chỉ thanh toán đơn ≤ " + String.format("%,d", MOMO_MAX_AMOUNT)
                            + "đ. Đơn hiện tại " + String.format("%,d", amountLong)
                            + "đ — vui lòng chọn phương thức Tiền mặt tại quầy.");
        }
        try {
            String requestId = UUID.randomUUID().toString();
            String orderId = transactionCode;
            String extraData = "";
            // requestType cho phép chọn UI thanh toán trên MoMo sandbox:
            //   - "payWithMethod" → hiện 3 options: Ví MoMo + Thẻ ATM + VISA/Master/JCB
            //   - "payWithATM"    → CHỈ hiện Thẻ ATM nội địa (đang dùng cho môi trường test)
            //   - "payWithCC"     → CHỈ hiện thẻ quốc tế
            //   - "captureWallet" → CHỈ hiện Ví MoMo (legacy v2)
            // Đổi sang "payWithMethod" khi cần test full flow đa phương thức.
            String requestType = "payWithATM";

            // Tạo chữ ký HMAC-SHA256 theo format MoMo yêu cầu
            String rawSignature = "accessKey=" + accessKey
                    + "&amount=" + amountLong
                    + "&extraData=" + extraData
                    + "&ipnUrl=" + ipnUrl
                    + "&orderId=" + orderId
                    + "&orderInfo=" + description
                    + "&partnerCode=" + partnerCode
                    + "&redirectUrl=" + redirectUrl
                    + "&requestId=" + requestId
                    + "&requestType=" + requestType;

            String signature = hmacSHA256(secretKey, rawSignature);

            // Tạo request body (>10 fields → dùng HashMap thay vì Map.of)
            Map<String, Object> bodyMap = new java.util.LinkedHashMap<>();
            bodyMap.put("partnerCode", partnerCode);
            bodyMap.put("accessKey", accessKey);
            bodyMap.put("requestId", requestId);
            bodyMap.put("amount", amountLong);
            bodyMap.put("orderId", orderId);
            bodyMap.put("orderInfo", description);
            bodyMap.put("redirectUrl", redirectUrl);
            bodyMap.put("ipnUrl", ipnUrl);
            bodyMap.put("extraData", extraData);
            bodyMap.put("requestType", requestType);
            bodyMap.put("signature", signature);
            bodyMap.put("lang", "vi");
            String body = objectMapper.writeValueAsString(bodyMap);

            // Gọi MoMo API
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(apiUrl))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            JsonNode json = objectMapper.readTree(response.body());

            int resultCode = json.get("resultCode").asInt();
            if (resultCode == 0) {
                String payUrl = json.get("payUrl").asText();
                log.info("MoMo payment created: {} - {} VND - URL: {}", transactionCode, amount, payUrl);
                return payUrl;
            } else {
                String msg = json.has("message") ? json.get("message").asText() : "Unknown error";
                log.error("MoMo create payment failed: {} - {}", resultCode, msg);
                throw new RuntimeException("MoMo error: " + msg);
            }

        } catch (RuntimeException e) {
            throw e;
        } catch (IOException e) {
            // Network / read response failure — log + wrap RuntimeException (caller xử lý chung)
            log.error("MoMo payment network error: {}", e.getMessage(), e);
            throw new RuntimeException("Lỗi kết nối MoMo (network)", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt(); // restore interrupt flag — best practice
            log.error("MoMo payment interrupted: {}", e.getMessage(), e);
            throw new RuntimeException("Yêu cầu MoMo bị gián đoạn", e);
        } catch (GeneralSecurityException e) {
            // HMAC signature generation failure (rất hiếm — algorithm not found)
            log.error("MoMo payment crypto error: {}", e.getMessage(), e);
            throw new RuntimeException("Lỗi tạo chữ ký MoMo", e);
        }
    }

    @Override
    public boolean verifyCallback(Map<String, String> params) {
        try {
            String signature = params.get("signature");
            if (signature == null) return false;

            // Tạo lại chữ ký từ params callback
            String rawSignature = "accessKey=" + accessKey
                    + "&amount=" + params.getOrDefault("amount", "")
                    + "&extraData=" + params.getOrDefault("extraData", "")
                    + "&message=" + params.getOrDefault("message", "")
                    + "&orderId=" + params.getOrDefault("orderId", "")
                    + "&orderInfo=" + params.getOrDefault("orderInfo", "")
                    + "&orderType=" + params.getOrDefault("orderType", "")
                    + "&partnerCode=" + params.getOrDefault("partnerCode", "")
                    + "&payType=" + params.getOrDefault("payType", "")
                    + "&requestId=" + params.getOrDefault("requestId", "")
                    + "&responseTime=" + params.getOrDefault("responseTime", "")
                    + "&resultCode=" + params.getOrDefault("resultCode", "")
                    + "&transId=" + params.getOrDefault("transId", "");

            String expectedSignature = hmacSHA256(secretKey, rawSignature);
            // Constant-time compare chống timing attack: String.equals() return sớm khi gặp ký tự khác,
            // attacker đo độ trễ → đoán dần từng byte signature. MessageDigest.isEqual() so sánh hết byte.
            if (!MessageDigest.isEqual(
                    expectedSignature.getBytes(StandardCharsets.UTF_8),
                    signature.getBytes(StandardCharsets.UTF_8))) {
                log.warn("MoMo callback invalid signature");
                return false;
            }

            String resultCode = params.get("resultCode");
            boolean success = "0".equals(resultCode);
            log.info("MoMo callback: orderId={}, resultCode={}, success={}", params.get("orderId"), resultCode, success);
            return success;

        } catch (GeneralSecurityException e) {
            // HMAC verification fail — coi như invalid signature
            log.warn("MoMo callback HMAC error: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Hoàn tiền giao dịch MoMo qua API thật.
     *
     * <p><b>MoMo refund spec</b> (https://developers.momo.vn/v3/vi/docs/payment/api/refund-api/):
     * <pre>
     * POST {refundUrl}
     * Body: { partnerCode, orderId, requestId, amount, transId, lang, description, signature }
     * Signature (HMAC-SHA256, alphabet order):
     *   accessKey=...&amount=...&description=...&orderId=...&partnerCode=...
     *   &requestId=...&transId=...
     * Response: resultCode == 0 → success
     * </pre>
     *
     * @param transactionCode orderId của ta đã gửi MoMo khi tạo payment
     * @param gatewayTransactionId transId nội bộ MoMo (từ IPN callback) — BẮT BUỘC cho refund
     * @param amount số tiền hoàn (BigDecimal, MoMo cần long)
     * @param reason mô tả lý do
     * @return true nếu MoMo trả resultCode 0
     */
    @Override
    public boolean refund(String transactionCode, String gatewayTransactionId,
                          BigDecimal amount, String reason) {
        // Validate input — refund mà thiếu transId chắc chắn fail
        if (gatewayTransactionId == null || gatewayTransactionId.isBlank()) {
            log.error("[MoMo Refund] Thiếu gatewayTransactionId (transId) cho payment {}. " +
                    "Không thể refund — payment chưa lưu transId từ IPN. " +
                    "Cần admin xử lý thủ công.", transactionCode);
            return false;
        }
        if (amount == null || amount.signum() <= 0) {
            log.error("[MoMo Refund] Số tiền refund không hợp lệ: {}", amount);
            return false;
        }

        try {
            String requestId = UUID.randomUUID().toString();
            // MoMo yêu cầu orderId của refund request unique → suffix _REF
            String refundOrderId = transactionCode + "_REF_" + System.currentTimeMillis();
            long amountLong = amount.longValue();
            String description = reason != null ? reason : "Refund booking";

            // Build raw signature theo alphabet order MoMo quy định
            String rawSignature = "accessKey=" + accessKey
                    + "&amount=" + amountLong
                    + "&description=" + description
                    + "&orderId=" + refundOrderId
                    + "&partnerCode=" + partnerCode
                    + "&requestId=" + requestId
                    + "&transId=" + gatewayTransactionId;
            String signature = hmacSHA256(secretKey, rawSignature);

            Map<String, Object> bodyMap = new java.util.LinkedHashMap<>();
            bodyMap.put("partnerCode", partnerCode);
            bodyMap.put("orderId", refundOrderId);
            bodyMap.put("requestId", requestId);
            bodyMap.put("amount", amountLong);
            // transId MoMo dùng Number, nhưng giữ string-safe nếu parse lỗi
            try {
                bodyMap.put("transId", Long.parseLong(gatewayTransactionId));
            } catch (NumberFormatException nfe) {
                bodyMap.put("transId", gatewayTransactionId);
            }
            bodyMap.put("lang", "vi");
            bodyMap.put("description", description);
            bodyMap.put("signature", signature);
            String body = objectMapper.writeValueAsString(bodyMap);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(refundUrl))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            JsonNode json = objectMapper.readTree(response.body());
            int resultCode = json.has("resultCode") ? json.get("resultCode").asInt() : -1;
            String msg = json.has("message") ? json.get("message").asText() : "";

            if (resultCode == 0) {
                log.info("[MoMo Refund] Success: orderId={}, transId={}, amount={}, refundOrderId={}",
                        transactionCode, gatewayTransactionId, amountLong, refundOrderId);
                return true;
            } else {
                log.error("[MoMo Refund] Failed: orderId={}, transId={}, resultCode={}, message={}",
                        transactionCode, gatewayTransactionId, resultCode, msg);
                return false;
            }
        } catch (IOException ex) {
            // Network / response parse error — refund có thể đã thành công ở MoMo, nhưng app không nhận
            // được response. KHÔNG throw để booking vẫn cancel được. Admin cần check MoMo dashboard.
            log.error("[MoMo Refund] Network/parse error: orderId={}, transId={}",
                    transactionCode, gatewayTransactionId, ex);
            return false;
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            log.error("[MoMo Refund] Interrupted: orderId={}, transId={}",
                    transactionCode, gatewayTransactionId, ex);
            return false;
        } catch (GeneralSecurityException ex) {
            log.error("[MoMo Refund] HMAC crypto error: orderId={}, transId={}",
                    transactionCode, gatewayTransactionId, ex);
            return false;
        }
    }

    /**
     * Tính HMAC-SHA256. Throw {@link GeneralSecurityException} (checked) thay vì wrap RuntimeException
     * — caller bắt explicit, không bị nuốt mất exception.
     */
    private String hmacSHA256(String key, String data) throws GeneralSecurityException {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        byte[] bytes = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) sb.append(String.format("%02x", b));
        return sb.toString();
    }
}
