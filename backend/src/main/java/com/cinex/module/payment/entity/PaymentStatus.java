package com.cinex.module.payment.entity;

public enum PaymentStatus {
    PENDING,      // Chờ thanh toán
    COMPLETED,    // Đã thanh toán thành công
    FAILED,       // Thanh toán thất bại
    REFUNDED      // Đã hoàn tiền
}
