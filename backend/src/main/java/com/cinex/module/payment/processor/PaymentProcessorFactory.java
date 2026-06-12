package com.cinex.module.payment.processor;

import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.module.payment.entity.PaymentMethod;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * [Factory Pattern] Trả đúng PaymentProcessor theo payment method.
 *
 * Tại sao dùng Factory thay vì if-else/switch?
 * - if-else: thêm method mới → sửa code cũ → vi phạm Open/Closed Principle
 * - Factory: thêm method mới → tạo class mới + đăng ký → code cũ KHÔNG SỬA
 *
 * Spring tự inject Map<String, PaymentProcessor>:
 * - key = @Component("MOMO") → "MOMO"
 * - value = MoMoPaymentProcessor instance
 */
@Component
@RequiredArgsConstructor
public class PaymentProcessorFactory {

    // Spring tự inject: {"MOMO": MoMoPaymentProcessor, "CASH": CashPaymentProcessor, ...}
    private final Map<String, PaymentProcessor> processors;

    public PaymentProcessor getProcessor(PaymentMethod method) {
        PaymentProcessor processor = processors.get(method.name());
        if (processor == null) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Phương thức thanh toán không được hỗ trợ: " + method);
        }
        return processor;
    }
}
