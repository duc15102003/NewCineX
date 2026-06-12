package com.cinex.module.payment.entity;

/**
 * Phương thức thanh toán.
 *
 * <p><b>Online (qua gateway):</b>
 * <ul>
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
 *
 * <p><b>{@code VNPAY} (deprecated):</b> giữ trong enum vì DB constraint
 * {@code chk_payments_method} đã include VNPAY (xem
 * {@code 008-check-constraints.xml}). Không có processor — gọi method này
 * sẽ {@link com.cinex.common.exception.BusinessException} từ
 * {@link com.cinex.module.payment.processor.PaymentProcessorFactory}.
 * Có thể remove khi viết migration drop constraint.
 */
public enum PaymentMethod {
    MOMO,
    CASH,
    CARD_POS,
    TRANSFER,
    /** @deprecated chưa có processor — xem JavaDoc enum. */
    @Deprecated
    VNPAY
}
