package com.cinex.module.payment.entity;

import com.cinex.common.entity.BaseEntity;
import com.cinex.module.booking.entity.Booking;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "payments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Payment extends BaseEntity {

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id", nullable = false, unique = true)
    private Booking booking;

    @Column(nullable = false, precision = 12, scale = 0)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PaymentMethod method;

    @Column(name = "transaction_code", length = 100)
    private String transactionCode;

    /**
     * transId nội bộ của cổng thanh toán (vd: MoMo transId từ IPN response).
     * Khác với {@code transactionCode}: đó là orderId của ta gửi cho MoMo,
     * còn cái này là ID nội bộ MoMo gán cho giao dịch — bắt buộc khi gọi refund API.
     */
    @Column(name = "gateway_transaction_id", length = 100)
    private String gatewayTransactionId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private PaymentStatus status = PaymentStatus.PENDING;

    @Column(name = "paid_at")
    private LocalDateTime paidAt;

    /**
     * Flag race condition: payment COMPLETED nhưng booking CANCELLED (vd MoMo
     * callback đến muộn). Tiền đã trừ user mà vé không issue → admin phải
     * refund thủ công. Query nhanh qua endpoint admin để xử lý hàng loạt.
     */
    @Column(name = "needs_refund", nullable = false)
    @Builder.Default
    private boolean needsRefund = false;
}
