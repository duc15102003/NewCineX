package com.cinex.module.payment.dto;

import com.cinex.module.payment.entity.PaymentMethod;
import com.cinex.module.payment.entity.PaymentStatus;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Builder
public class PaymentResponse {

    private Long id;
    private String storageState;
    private Long bookingId;
    private String bookingCode;
    private BigDecimal amount;
    private PaymentMethod method;
    private String transactionCode;
    private PaymentStatus status;
    private String paymentUrl;       // URL thanh toán (mock hoặc VNPay redirect)
    private LocalDateTime paidAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
