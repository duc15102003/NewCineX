package com.cinex.module.showtime.dto;

import com.cinex.module.showtime.entity.ShowtimeStatus;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Builder
public class ShowtimeListResponse {

    private Long id;
    private String storageState;
    private Long movieId;
    private String movieTitle;
    private String moviePosterUrl;
    /** MovieRun info — xem javadoc ShowtimeResponse. */
    private Long movieRunId;
    private String runType;
    private LocalDate runStartDate;
    private LocalDate runEndDate;
    private Long roomId;
    private String roomName;
    private String roomType;
    /** Chi nhánh chứa room — phục vụ FE grouped view khi SUPER_ADMIN xem 'Tất cả'. */
    private Long theaterId;
    private String theaterName;
    private String theaterCity;
    private LocalDateTime startTime;
    private LocalDateTime endTime;

    /**
     * Giá GỐC (raw từ DB) — chưa áp pricing rules. Dùng để hiển thị gạch ngang khi có discount.
     * Khi không có rule nào match: {@code basePrice == effectiveBasePrice} → FE chỉ hiển thị 1 giá.
     */
    private BigDecimal basePrice;
    private BigDecimal vipPrice;
    private BigDecimal couplePrice;
    private BigDecimal sweetboxPrice;
    private BigDecimal deluxePrice;

    /**
     * Giá CUỐI sau khi áp {@link com.cinex.module.pricing.service.PricingEngine}.
     * <b>Đây là giá thực sự thu</b> — chuẩn industry "What You See Is What You Pay".
     * Trùng raw price nếu không có rule match.
     */
    private BigDecimal effectiveBasePrice;
    private BigDecimal effectiveVipPrice;
    private BigDecimal effectiveCouplePrice;
    private BigDecimal effectiveSweetboxPrice;
    private BigDecimal effectiveDeluxePrice;

    /** Danh sách rule đang áp dụng — FE render badge "Suất sáng -20%" / "Cuối tuần +30%". */
    private List<AppliedPricingRule> appliedRules;

    private ShowtimeStatus status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
