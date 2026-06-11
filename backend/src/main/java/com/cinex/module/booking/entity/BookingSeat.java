package com.cinex.module.booking.entity;

import com.cinex.module.seat.entity.Seat;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * Chi tiết ghế trong đơn đặt. KHÔNG extends BaseEntity (bảng liên kết).
 */
@Entity
@Table(name = "booking_seats")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingSeat {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id", nullable = false)
    private Booking booking;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "seat_id", nullable = false)
    private Seat seat;

    /**
     * Denormalized showtime_id — copy từ booking.showtime.id khi tạo.
     *
     * Vì sao tách field thay vì lấy qua booking.getShowtime().getId()?
     * - DB có partial unique index `uk_booking_seats_active (showtime_id, seat_id)
     *   WHERE status IN ('HELD','BOOKED')` để chống double-booking ở tầng DB
     *   (xem changeset 034).
     * - SQL Server filtered index KHÔNG tham chiếu được cột bảng khác (bookings.showtime_id),
     *   nên cột phải nằm trực tiếp trên booking_seats.
     * - Trigger AFTER INSERT có sync showtime_id từ bookings, nhưng SQL Server check NOT NULL
     *   constraint TRƯỚC khi trigger chạy → app phải set value trước.
     * - App set trong BookingService.holdSeats + counterSale = single source of truth.
     */
    @Column(name = "showtime_id", nullable = false)
    private Long showtimeId;

    // Giá tại thời điểm đặt (giá có thể thay đổi sau)
    @Column(nullable = false, precision = 12, scale = 0)
    private BigDecimal price;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BookingSeatStatus status;
}
