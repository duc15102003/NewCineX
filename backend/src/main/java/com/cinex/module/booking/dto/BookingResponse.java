package com.cinex.module.booking.dto;

import com.cinex.module.booking.entity.BookingStatus;
import com.cinex.module.movie.entity.AgeRating;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Builder
public class BookingResponse {

    private Long id;
    private String storageState;
    private String bookingCode;
    private BookingStatus status;

    // Movie info
    private String movieTitle;
    private String moviePosterUrl;
    /** Phân loại độ tuổi — FE QR ticket hiện chip cảnh báo "Mang CCCD" cho T13+. */
    private AgeRating movieAgeRating;

    // Showtime info
    private Long showtimeId;
    private LocalDateTime startTime;
    private LocalDateTime endTime;

    // Room info
    private String roomName;
    private String roomType;

    private List<BookingSeatResponse> seats;

    /**
     * Pricing breakdown — industry chuẩn (CGV/Lotte) tách 3 dòng trên hóa đơn:
     * <ul>
     *   <li>{@code subtotalAmount} — tạm tính chưa VAT</li>
     *   <li>{@code vatAmount} — tiền VAT (= total - subtotal)</li>
     *   <li>{@code vatPercent} — VAT% áp dụng lúc bán (history-preserving)</li>
     *   <li>{@code totalAmount} — tổng cộng (đã VAT, khách trả)</li>
     * </ul>
     */
    /** Giá vé niêm yết gốc trước mọi giảm giá — dùng cho loyalty earn + audit. */
    private BigDecimal seatTotalAmount;
    private BigDecimal subtotalAmount;
    private BigDecimal vatAmount;
    private BigDecimal vatPercent;
    /** Tiền giảm theo hạng thành viên — null/0 cho counter-sale + STANDARD tier. */
    private BigDecimal tierDiscountAmount;
    /** Hạng thành viên lúc đặt vé — null cho counter-sale. */
    private String tierAtBooking;
    /** Tiền giảm group booking — 0 nếu seats < threshold. */
    private BigDecimal groupDiscountAmount;
    /** Số điểm khách dùng để đổi giảm giá khi đặt vé. */
    private Integer pointsRedeemed;
    /** Tiền giảm tương ứng số điểm đã đổi. */
    private BigDecimal loyaltyDiscountAmount;
    private BigDecimal totalAmount;

    private LocalDateTime confirmedAt;
    private LocalDateTime cancelledAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
