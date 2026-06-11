package com.cinex.module.showtime.dto;

import com.cinex.module.movie.entity.AgeRating;
import com.cinex.module.showtime.entity.ShowtimeStatus;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Builder(toBuilder = true)
public class ShowtimeResponse {

    private Long id;
    private String storageState;

    // Movie info (rút gọn, không trả full movie object)
    private Long movieId;
    private String movieTitle;
    private String moviePosterUrl;
    private Integer movieDuration;
    /** Phân loại độ tuổi (TT 25/2024): FE confirm dialog khi T16/T18 + chip cảnh báo trên QR vé. */
    private AgeRating movieAgeRating;

    /**
     * Thông tin MovieRun (đợt chiếu) — sau refactor MovieRun, mỗi showtime thuộc 1 đợt cụ thể.
     * FE dùng các field này để: filter "showtime của REISSUE 2026", group by đợt chiếu,
     * hiển thị badge "FIRST_RUN / REISSUE" cạnh tên phim.
     */
    private Long movieRunId;
    private String runType;
    private LocalDate runStartDate;
    private LocalDate runEndDate;

    // Room info
    private Long roomId;
    private String roomName;
    private String roomType;

    /** Chi nhánh chứa room — Edit dialog dùng để pre-fill dropdown 'Chi nhánh'. */
    private Long theaterId;
    private String theaterName;
    private String theaterCity;

    private LocalDateTime startTime;
    private LocalDateTime endTime;

    /** Giá GỐC từ DB — chưa áp pricing rules. FE dùng để hiển thị gạch ngang khi có discount. */
    private BigDecimal basePrice;
    private BigDecimal vipPrice;
    private BigDecimal couplePrice;
    private BigDecimal sweetboxPrice;
    private BigDecimal deluxePrice;

    /**
     * Giá CUỐI sau khi áp {@link com.cinex.module.pricing.service.PricingEngine}.
     * <b>Đây là giá thực sự thu</b> — chuẩn "What You See Is What You Pay".
     * Trùng raw price nếu không có rule match.
     */
    private BigDecimal effectiveBasePrice;
    private BigDecimal effectiveVipPrice;
    private BigDecimal effectiveCouplePrice;
    private BigDecimal effectiveSweetboxPrice;
    private BigDecimal effectiveDeluxePrice;

    /** Danh sách rule đang áp — FE render badge "Suất sáng -20%". */
    private List<AppliedPricingRule> appliedRules;

    private ShowtimeStatus status;

    private int availableSeats;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
