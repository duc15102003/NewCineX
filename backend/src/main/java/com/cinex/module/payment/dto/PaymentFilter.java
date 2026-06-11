package com.cinex.module.payment.dto;

import com.cinex.module.payment.entity.PaymentMethod;
import com.cinex.module.payment.entity.PaymentStatus;
import lombok.Getter;
import lombok.Setter;
import org.springframework.format.annotation.DateTimeFormat;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Filter cho admin tra cứu payment. Mọi field optional — null thì bỏ qua.
 */
@Getter
@Setter
public class PaymentFilter {

    /** LIKE transactionCode OR booking.bookingCode (lowercase). */
    private String keyword;

    private PaymentStatus status;
    private PaymentMethod method;

    /** Khoảng thời gian thực sự thanh toán (paidAt). */
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
    private LocalDateTime paidFrom;
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
    private LocalDateTime paidTo;

    /** Khoảng thời gian tạo payment (createdAt). */
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
    private LocalDateTime createdFrom;
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
    private LocalDateTime createdTo;

    private BigDecimal minAmount;
    private BigDecimal maxAmount;

    /** Join booking.user.id. */
    private Long userId;

    private Long bookingId;

    /** Join booking.showtime.room.theater.id — filter theo chi nhánh (admin context). */
    private Long theaterId;

    private Boolean includeDeleted;
}
