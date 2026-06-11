package com.cinex.module.payment.processor;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Map;

/**
 * [Strategy] Chuyển khoản ngân hàng tại quầy — staff verify đã nhận tiền rồi confirm.
 *
 * <p>Use case: khách quét QR ngân hàng (VietQR, Napas247) hoặc chuyển khoản app
 * MB/VCB/TCB. Staff check app ngân hàng rạp thấy tiền vào → confirm trong CineX.
 * Status COMPLETED ngay khi staff confirm.
 *
 * <p>Refund: staff chuyển khoản hoàn lại qua app ngân hàng rạp.
 */
@Component("TRANSFER")
@Slf4j
public class TransferPaymentProcessor implements PaymentProcessor {

    @Override
    public String createPayment(String transactionCode, BigDecimal amount, String description) {
        log.info("Bank transfer payment created: {} - {} VND", transactionCode, amount);
        return null;
    }

    @Override
    public boolean verifyCallback(Map<String, String> params) {
        return true;
    }

    @Override
    public boolean refund(String transactionCode, String gatewayTransactionId,
                          BigDecimal amount, String reason) {
        log.info("[Transfer Refund] Hoàn qua app ngân hàng rạp. txn={}, amount={}, reason={}",
                transactionCode, amount, reason);
        return true;
    }
}
