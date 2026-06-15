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

    /**
     * Giá vé niêm yết gốc (SUM seat prices, trước mọi giảm giá).
     *
     * <p>Industry chuẩn (CGV/Lotte/BHD): loyalty earn dựa trên giá niêm yết —
     * khách dùng voucher 50% vẫn nhận full điểm. Tránh voucher trở thành
     * "phạt cắt điểm" làm khách không dùng.
     *
     * <p>Cũng phục vụ audit/finance: tính được revenue niêm yết vs revenue
     * thực thu sau mọi giảm giá.
     */
    @Column(name = "seat_total_amount", nullable = false, precision = 12, scale = 0)
    private BigDecimal seatTotalAmount;

    /**
     * Tạm tính (chưa VAT) — tính ngược từ totalAmount theo công thức
     * {@code subtotal = total * 100 / (100 + vat_percent)}.
     * Industry pattern (CGV/Lotte/BHD): giá niêm yết đã bao gồm VAT, hóa đơn
     * tách ngược để khách thấy rõ phần thuế.
     */
    @Column(name = "subtotal_amount", nullable = false, precision = 12, scale = 0)
    private BigDecimal subtotalAmount;

    /** Tiền VAT — {@code vat = total - subtotal}. */
    @Column(name = "vat_amount", nullable = false, precision = 12, scale = 0)
    private BigDecimal vatAmount;

    /**
     * VAT% áp dụng lúc tạo booking — lưu history. Nếu luật thay đổi (8% → 10%),
     * vé cũ vẫn show đúng % lúc bán; chỉ vé mới dùng giá trị system_config.
     */
    @Column(name = "vat_percent", nullable = false, precision = 5, scale = 2)
    private BigDecimal vatPercent;

    /**
     * Tiền giảm theo hạng thành viên (loyalty tier benefit). 0 cho counter-sale
     * (booking.user == null) hoặc STANDARD tier. History-preserving: % giảm theo
     * tier có thể đổi nhưng vé cũ giữ amount đã áp.
     */
    @Column(name = "tier_discount_amount", nullable = false, precision = 12, scale = 0)
    @Builder.Default
    private BigDecimal tierDiscountAmount = BigDecimal.ZERO;

    /**
     * Hạng thành viên lúc đặt vé — null cho counter-sale. Lưu enum name
     * (STANDARD/SILVER/GOLD/PLATINUM) để hiển thị trên hóa đơn.
     */
    @Column(name = "tier_at_booking", length = 20)
    private String tierAtBooking;

    /**
     * Tiền giảm cho group booking — đặt từ N vé trở lên (config
     * booking.group_discount_threshold). 0 nếu booking dưới ngưỡng.
     * History-preserving giống tier discount.
     */
    @Column(name = "group_discount_amount", nullable = false, precision = 12, scale = 0)
    @Builder.Default
    private BigDecimal groupDiscountAmount = BigDecimal.ZERO;

    /**
     * Số điểm khách dùng để đổi giảm giá khi đặt vé. 0 nếu không dùng. Lưu để
     * hoàn lại khi cancel/expire booking.
     */
    @Column(name = "points_redeemed", nullable = false)
    @Builder.Default
    private Integer pointsRedeemed = 0;

    /**
     * Tiền giảm tương ứng số điểm đã đổi = pointsRedeemed × loyalty.redeem_value.
     * Lưu trị giá lúc đặt — luật quy đổi đổi sau (1000đ → 2000đ/điểm) không
     * ảnh hưởng vé cũ.
     */
    @Column(name = "loyalty_discount_amount", nullable = false, precision = 12, scale = 0)
    @Builder.Default
    private BigDecimal loyaltyDiscountAmount = BigDecimal.ZERO;

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
