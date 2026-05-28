package com.cinex.module.snack.entity;

import com.cinex.module.booking.entity.Booking;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
 * Chi tiết snack trong đơn đặt. KHÔNG extends BaseEntity (bảng liên kết).
 */
@Entity
@Table(name = "booking_snacks")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingSnack {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id", nullable = false)
    private Booking booking;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "snack_id", nullable = false)
    private Snack snack;

    @Column(nullable = false)
    private Integer quantity;

    // Giá tại thời điểm đặt (giá snack có thể thay đổi sau)
    @Column(nullable = false, precision = 12, scale = 0)
    private BigDecimal price;
}
