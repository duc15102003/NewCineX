package com.cinex.module.showtime.dto;

import com.cinex.module.room.entity.RoomType;
import com.cinex.module.showtime.entity.ShowtimeStatus;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
public class ShowtimeFilter {

    private Long movieId;
    private Long roomId;
    /** Lọc theo chi nhánh — sau F1 (Theater). JOIN room → theater. */
    private Long theaterId;
    private LocalDate date;           // Lọc theo ngày (VD: 2026-05-20) — alias của startDate
    private ShowtimeStatus status;
    private Boolean includeDeleted;

    // ==== Mở rộng filter (J3) ====

    /** Alias rõ nghĩa hơn của {@code date}. */
    private LocalDate startDate;

    /** startTime >= startTimeFrom. */
    private LocalDateTime startTimeFrom;

    /** startTime <= startTimeTo. */
    private LocalDateTime startTimeTo;

    /** Lọc theo loại phòng (STANDARD/IMAX/3D/...) — JOIN bảng rooms. */
    private RoomType roomType;

    /** basePrice >= minPrice. */
    private BigDecimal minPrice;

    /** basePrice <= maxPrice. */
    private BigDecimal maxPrice;
}
