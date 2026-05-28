package com.cinex.module.payment.processor;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
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
@Component("VNPAY")  // Giữ tên VNPAY trong factory vì FE gửi paymentMethod=VNPAY
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

    @Value("${momo.return-url:http://localhost:8088/api/payments/callback}")
    private String returnUrl;

    @Value("${momo.ipn-url:http://localhost:8088/api/payments/callback}")
    private String ipnUrl;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newHttpClient();

    @Override
    public String createPayment(String transactionCode, BigDecimal amount, String description) {
        try {
            String requestId = UUID.randomUUID().toString();
            String orderId = transactionCode;
            long amountLong = amount.longValue();
            String extraData = "";
            String requestType = "payWithMethod";

            // Tạo chữ ký HMAC-SHA256 theo format MoMo yêu cầu
            String rawSignature = "accessKey=" + accessKey
                    + "&amount=" + amountLong
                    + "&extraData=" + extraData
                    + "&ipnUrl=" + ipnUrl
                    + "&orderId=" + orderId
                    + "&orderInfo=" + description
                    + "&partnerCode=" + partnerCode
                    + "&redirectUrl=" + returnUrl
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
            bodyMap.put("redirectUrl", returnUrl);
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
        } catch (Exception e) {
            log.error("MoMo payment error", e);
            throw new RuntimeException("Lỗi kết nối MoMo", e);
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
            if (!expectedSignature.equals(signature)) {
                log.warn("MoMo callback invalid signature");
                return false;
            }

            String resultCode = params.get("resultCode");
            boolean success = "0".equals(resultCode);
            log.info("MoMo callback: orderId={}, resultCode={}, success={}", params.get("orderId"), resultCode, success);
            return success;

        } catch (Exception e) {
            log.error("MoMo verify callback error", e);
            return false;
        }
    }

    private String hmacSHA256(String key, String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] bytes = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : bytes) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            throw new RuntimeException("HMAC-SHA256 error", e);
        }
    }
}
