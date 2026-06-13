package com.cinex.module.showtime.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Auto-schedule request — tạo hàng loạt suất chiếu trong 1 dải ngày.
 *
 * <p>Algorithm: với mỗi phòng × mỗi ngày, fill khung [startHour, endHour) bằng slot
 * = movie.duration + bufferMinutes. Slot conflict suất hiện có → SKIP (không throw).
 *
 * <p>Hard limit: dateTo - dateFrom ≤ 30 ngày (tránh tạo quá lố).
 */
@Data
public class AutoScheduleRequest {

    @NotNull(message = "movieId là bắt buộc")
    private Long movieId;

    @NotNull(message = "theaterId là bắt buộc")
    private Long theaterId;

    @NotEmpty(message = "roomIds không được rỗng")
    private List<@Positive Long> roomIds;

    @NotNull(message = "dateFrom là bắt buộc")
    private LocalDate dateFrom;

    @NotNull(message = "dateTo là bắt buộc")
    private LocalDate dateTo;

    @NotNull
    @Min(value = 0, message = "startHour từ 0-23")
    @Max(value = 23, message = "startHour từ 0-23")
    private Integer startHour;

    @NotNull
    @Min(value = 1, message = "endHour từ 1-24")
    @Max(value = 24, message = "endHour từ 1-24")
    private Integer endHour;

    /** Buffer giữa các suất (phút). Null → fallback system_config showtime.buffer_minutes (default 15). */
    @Min(value = 0)
    @Max(value = 120)
    private Integer bufferMinutes;

    @NotNull
    @Positive
    private BigDecimal basePrice;

    /** Giá VIP optional — null = phòng không có VIP thì skip, có VIP thì auto-fill từ config. */
    private BigDecimal vipPrice;
    private BigDecimal couplePrice;
    private BigDecimal sweetboxPrice;
    private BigDecimal deluxePrice;
}
