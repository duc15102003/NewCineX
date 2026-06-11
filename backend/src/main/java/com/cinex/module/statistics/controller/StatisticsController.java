package com.cinex.module.statistics.controller;

import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.common.response.ApiResponse;
import com.cinex.module.statistics.dto.OccupancyStatistics;
import com.cinex.module.statistics.dto.OverviewStatistics;
import com.cinex.module.statistics.dto.RevenueStatistics;
import com.cinex.module.statistics.dto.TopMovieRunStatistics;
import com.cinex.module.statistics.dto.TopMovieStatistics;
import com.cinex.module.statistics.dto.TopSnackStatistics;
import com.cinex.module.statistics.service.StatisticsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

@RestController
@RequestMapping("/api/statistics")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Statistics", description = "Dashboard statistics (Admin only)")
public class StatisticsController {

    /** Fallback nếu config không set — giới hạn cứng phòng DB DoS. */
    private static final long MAX_RANGE_DAYS_FALLBACK = 365L;
    private static final int DEFAULT_RANGE_DAYS_FALLBACK = 30;

    private final StatisticsService statisticsService;
    private final com.cinex.module.config.service.SystemConfigService systemConfigService;

    @GetMapping("/overview")
    @Operation(summary = "Overview: today bookings, revenue, total users/movies/rooms (filter theo theaterId)")
    public ApiResponse<OverviewStatistics> getOverview(
            @RequestParam(required = false) Long theaterId) {
        return ApiResponse.ok(statisticsService.getOverview(theaterId));
    }

    @GetMapping("/revenue")
    @Operation(summary = "Revenue by date (for chart, filter theo theaterId)")
    public ApiResponse<List<RevenueStatistics>> getRevenue(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Long theaterId) {
        LocalDate[] range = normalizeAndValidate(from, to);
        return ApiResponse.ok(statisticsService.getRevenue(range[0], range[1], theaterId));
    }

    @GetMapping("/top-movies")
    @Operation(summary = "Top movies by ticket count (filter theo theaterId)")
    public ApiResponse<List<TopMovieStatistics>> getTopMovies(
            @RequestParam(defaultValue = "5") int limit,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Long theaterId) {
        LocalDate[] range = normalizeAndValidate(from, to);
        return ApiResponse.ok(statisticsService.getTopMovies(limit, range[0], range[1], theaterId));
    }

    @GetMapping("/top-movie-runs")
    @Operation(summary = "Top movie runs (engagements) by ticket count (filter theo theaterId)")
    public ApiResponse<List<TopMovieRunStatistics>> getTopMovieRuns(
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Long theaterId) {
        LocalDate[] range = normalizeAndValidate(from, to);
        return ApiResponse.ok(statisticsService.getTopMovieRuns(limit, range[0], range[1], theaterId));
    }

    @GetMapping("/top-snacks")
    @Operation(summary = "Top snacks sold at POS (filter theo theaterId)")
    public ApiResponse<List<TopSnackStatistics>> getTopSnacks(
            @RequestParam(defaultValue = "5") int limit,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Long theaterId) {
        LocalDate[] range = normalizeAndValidate(from, to);
        return ApiResponse.ok(statisticsService.getTopSnacks(limit, range[0], range[1], theaterId));
    }

    @GetMapping("/occupancy")
    @Operation(summary = "Seat occupancy rate by showtime on a date (filter theo theaterId)")
    public ApiResponse<List<OccupancyStatistics>> getOccupancy(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) Long theaterId) {
        return ApiResponse.ok(statisticsService.getOccupancy(date, theaterId));
    }

    /**
     * Validate + normalize khoảng thời gian. Config-driven:
     * <ul>
     *   <li>{@code statistics.default_range_days} (fallback 30) — default khi không truyền from/to</li>
     *   <li>{@code statistics.max_range_days} (fallback 365) — giới hạn để bảo vệ DB</li>
     * </ul>
     * Rule:
     * <ul>
     *   <li>Cả 2 null → default N ngày gần nhất</li>
     *   <li>from null mà to có → from = to - N ngày</li>
     *   <li>to null mà from có → to = today</li>
     *   <li>from > to → INVALID_REQUEST</li>
     *   <li>khoảng > MAX → INVALID_REQUEST</li>
     * </ul>
     */
    private LocalDate[] normalizeAndValidate(LocalDate from, LocalDate to) {
        LocalDate today = LocalDate.now();
        int defaultRangeDays = systemConfigService.getInt(
                "statistics.default_range_days", DEFAULT_RANGE_DAYS_FALLBACK);
        long maxRangeDays = systemConfigService.getLong(
                "statistics.max_range_days", MAX_RANGE_DAYS_FALLBACK);

        if (from == null && to == null) {
            from = today.minusDays(defaultRangeDays);
            to = today;
        } else if (from == null) {
            from = to.minusDays(defaultRangeDays);
        } else if (to == null) {
            to = today;
        }

        if (from.isAfter(to)) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc");
        }

        long days = ChronoUnit.DAYS.between(from, to);
        if (days > maxRangeDays) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Khoảng thời gian không được vượt quá " + maxRangeDays + " ngày");
        }

        return new LocalDate[]{from, to};
    }
}
