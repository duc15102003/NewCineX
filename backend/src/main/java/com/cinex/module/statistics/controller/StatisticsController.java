package com.cinex.module.statistics.controller;

import com.cinex.common.response.ApiResponse;
import com.cinex.module.statistics.dto.OccupancyStatistics;
import com.cinex.module.statistics.dto.OverviewStatistics;
import com.cinex.module.statistics.dto.RevenueStatistics;
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
import java.util.List;

@RestController
@RequestMapping("/api/statistics")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Statistics", description = "Dashboard statistics (Admin only)")
public class StatisticsController {

    private final StatisticsService statisticsService;

    @GetMapping("/overview")
    @Operation(summary = "Overview: today bookings, revenue, total users/movies/rooms")
    public ApiResponse<OverviewStatistics> getOverview() {
        return ApiResponse.ok(statisticsService.getOverview());
    }

    @GetMapping("/revenue")
    @Operation(summary = "Revenue by date (for chart)")
    public ApiResponse<List<RevenueStatistics>> getRevenue(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ApiResponse.ok(statisticsService.getRevenue(from, to));
    }

    @GetMapping("/top-movies")
    @Operation(summary = "Top movies by ticket count (optional date range filter)")
    public ApiResponse<List<TopMovieStatistics>> getTopMovies(
            @RequestParam(defaultValue = "5") int limit,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ApiResponse.ok(statisticsService.getTopMovies(limit, from, to));
    }

    @GetMapping("/top-snacks")
    @Operation(summary = "Top snacks sold at POS counter by quantity (optional date range filter)")
    public ApiResponse<List<TopSnackStatistics>> getTopSnacks(
            @RequestParam(defaultValue = "5") int limit,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ApiResponse.ok(statisticsService.getTopSnacks(limit, from, to));
    }

    @GetMapping("/occupancy")
    @Operation(summary = "Seat occupancy rate by showtime on a date")
    public ApiResponse<List<OccupancyStatistics>> getOccupancy(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ApiResponse.ok(statisticsService.getOccupancy(date));
    }
}
