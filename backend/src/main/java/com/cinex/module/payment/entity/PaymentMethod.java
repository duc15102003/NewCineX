package com.cinex.module.payment.entity;

/**
 * Phương thức thanh toán.
 *
 * <p><b>Online (qua gateway):</b>
 * <ul>
 *   <li>{@code VNPAY} — VNPay (đang mock bằng MockPaymentProcessor)</li>
 *   <li>{@code MOMO} — MoMo ví điện tử + thẻ ATM nội địa (tích sandbox)</li>
 * </ul>
 *
 * <p><b>Tại quầy (POS, manual confirm):</b>
 * <ul>
 *   <li>{@code CASH} — Tiền mặt</li>
 *   <li>{@code CARD_POS} — Thẻ qua máy POS riêng (Visa/Mastercard/ATM nội địa).
 *       BE không tích hợp gateway — staff cà thẻ qua máy POS hardware tách biệt rồi
 *       confirm trong app. Status COMPLETED ngay.</li>
 *   <li>{@code TRANSFER} — Chuyển khoản ngân hàng. Staff verify đã nhận tiền rồi confirm.</li>
 * </ul>
 */
public enum PaymentMethod {
    VNPAY,
    MOMO,
    CASH,
    CARD_POS,
    TRANSFER
}
