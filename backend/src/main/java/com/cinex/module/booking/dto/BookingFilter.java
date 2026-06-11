package com.cinex.module.booking.dto;

import com.cinex.module.booking.entity.BookingStatus;
import com.cinex.module.payment.entity.PaymentMethod;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import org.springframework.format.annotation.DateTimeFormat;

/**
 * Filter cho admin tra cứu booking. Hầu hết field optional — null thì bỏ qua.
 *
 * <p>Dùng cho cả:
 *  - User self list (BookingService#getMyBookings): chỉ áp keyword + status + ngày + tiền.
 *  - Admin list (BookingService#listAllBookings): áp toàn bộ field.
 */
@Getter
@Setter
public class BookingFilter {

    /** LIKE bookingCode OR user.username/email/fullName (lowercase). */
    private String keyword;

    private BookingStatus status;

    /** Filter theo user cụ thể (admin xem booking của 1 user). */
    private Long userId;

    /** Join showtime.movie.id — xem booking của 1 phim. */
    private Long movieId;

    /** Booking của 1 suất chiếu. */
    private Long showtimeId;

    /** Join showtime.room.id — xem booking trong 1 phòng. */
    private Long roomId;

    /** Join showtime.room.theater.id — filter booking theo chi nhánh (admin context). */
    private Long theaterId;

    /** Khoảng thời gian tạo booking. */
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
    private LocalDateTime createdFrom;
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
    private LocalDateTime createdTo;

    /** Khoảng thời gian confirm (booking đã thanh toán xong). */
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
    private LocalDateTime confirmedFrom;
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
    private LocalDateTime confirmedTo;

    /** Khoảng tổng tiền. */
    private BigDecimal minAmount;
    private BigDecimal maxAmount;

    /** Phương thức thanh toán — EXISTS subquery sang Payment. */
    private PaymentMethod paymentMethod;

    private Boolean includeDeleted;
}
