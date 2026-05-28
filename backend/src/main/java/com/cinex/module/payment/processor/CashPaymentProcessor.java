package com.cinex.module.payment.processor;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Map;

/**
 * [Strategy] Cash payment — thanh toán tại quầy.
 * Không cần redirect URL, admin xác nhận thủ công.
 */
@Component("CASH")
@Slf4j
public class CashPaymentProcessor implements PaymentProcessor {

    @Override
    public String createPayment(String transactionCode, BigDecimal amount, String description) {
        // Cash: không có URL, admin xác nhận tại quầy
        log.info("Cash payment created: {} - {} VND", transactionCode, amount);
        return null;
    }

    @Override
    public boolean verifyCallback(Map<String, String> params) {
        // Cash: luôn true khi admin xác nhận
        return true;
    }
}
