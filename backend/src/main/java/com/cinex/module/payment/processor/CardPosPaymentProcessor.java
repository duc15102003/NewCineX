package com.cinex.module.payment.processor;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Map;

/**
 * [Strategy] Thẻ qua máy POS riêng — Visa/Mastercard/ATM nội địa.
 *
 * <p>BE không tích hợp gateway nào — máy POS hardware tách biệt (do ngân hàng cấp,
 * vd Smartlink/Napas). Staff cà thẻ qua máy POS, chờ approve, rồi confirm trong app.
 * Status COMPLETED ngay khi confirm — tương tự CASH.
 *
 * <p>Refund cũng manual: staff bấm "hoàn tiền" trên máy POS ngân hàng cấp.
 */
@Component("CARD_POS")
@Slf4j
public class CardPosPaymentProcessor implements PaymentProcessor {

    @Override
    public String createPayment(String transactionCode, BigDecimal amount, String description) {
        log.info("Card POS payment created: {} - {} VND", transactionCode, amount);
        return null;
    }

    @Override
    public boolean verifyCallback(Map<String, String> params) {
        return true;
    }

    @Override
    public boolean refund(String transactionCode, String gatewayTransactionId,
                          BigDecimal amount, String reason) {
        log.info("[Card POS Refund] Hoàn qua máy POS ngân hàng tại quầy. txn={}, amount={}, reason={}",
                transactionCode, amount, reason);
        return true;
    }
}
