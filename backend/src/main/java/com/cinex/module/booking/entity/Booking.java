package com.cinex.module.booking.entity;

import com.cinex.common.entity.BaseEntity;
import com.cinex.module.auth.entity.User;
import com.cinex.module.showtime.entity.Showtime;
import com.cinex.module.theater.entity.Theater;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "bookings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Booking extends BaseEntity {

    // nullable = true: POS bán vé tại quầy không cần user (khách vãng lai)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "showtime_id", nullable = false)
    private Showtime showtime;

    /**
     * Chi nhánh nơi booking phát sinh — IMMUTABLE snapshot lúc tạo booking
     * (chuẩn industry Vista FilmAtSite / Veezi). Không derive lại từ
     * {@code showtime.room.theater} ở query — vì showtime có thể move room
     * sau khi booking đã thanh toán, kéo theo doanh thu chạy sai rạp.
     *
     * <p>Set 1 lần trong service tạo booking (holdSeats / counterSale) và
     * không bao giờ đổi.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "theater_id", nullable = false)
    private Theater theater;

    @Column(name = "total_amount", nullable = false, precision = 12, scale = 0)
    private BigDecimal totalAmount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BookingStatus status;

    @Column(name = "booking_code", nullable = false, unique = true, length = 30)
    private String bookingCode;

    // qr_token random 32 ký tự — chỉ chứa trong QR, không hiển thị cho user.
    // Tránh bị brute force booking_code dễ đoán (CX-YYYYMMDD-NNN) để check-in giả.
    @Column(name = "qr_token", nullable = false, unique = true, length = 32)
    private String qrToken;

    @Column(name = "confirmed_at")
    private LocalDateTime confirmedAt;

    @Column(name = "cancelled_at")
    private LocalDateTime cancelledAt;

    @OneToMany(mappedBy = "booking", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<BookingSeat> bookingSeats = new ArrayList<>();
}
