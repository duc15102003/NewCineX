package com.cinex.module.payment.processor;

import java.math.BigDecimal;
import java.util.Map;

/**
 * [Strategy Pattern] Interface chung cho tất cả cổng thanh toán.
 *
 * Mỗi cổng (VNPay, Momo, Cash) implement interface này → logic khác nhau.
 * PaymentService gọi cùng interface → không cần biết cổng nào đang dùng.
 *
 * Ví dụ đời thường: Remote TV — bấm nút "tắt" → TV tắt.
 * Bạn không cần biết bên trong TV Samsung hay LG xử lý thế nào.
 * Đổi TV → remote vẫn hoạt động (cùng interface).
 */
public interface PaymentProcessor {

    /**
     * Tạo yêu cầu thanh toán → trả URL redirect (hoặc null nếu cash).
     */
    String createPayment(String transactionCode, BigDecimal amount, String description);

    /**
     * Xác nhận callback từ cổng thanh toán → trả true nếu thanh toán thành công.
     */
    boolean verifyCallback(Map<String, String> params);
}
