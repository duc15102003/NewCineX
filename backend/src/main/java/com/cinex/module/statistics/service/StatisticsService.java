package com.cinex.module.statistics.service;

import com.cinex.common.service.SecurityService;
import com.cinex.module.statistics.dto.BookingHealthStatistics;
import com.cinex.module.statistics.dto.OccupancyAggregateStatistics;
import com.cinex.module.statistics.dto.OccupancyStatistics;
import com.cinex.module.statistics.dto.OverviewStatistics;
import com.cinex.module.statistics.dto.RevenueByRoomTypeStatistics;
import com.cinex.module.statistics.dto.RevenueBreakdownStatistics;
import com.cinex.module.statistics.dto.RevenueStatistics;
import com.cinex.module.statistics.dto.TopMovieRunStatistics;
import com.cinex.module.statistics.dto.TopMovieStatistics;
import com.cinex.module.statistics.dto.TopSnackStatistics;
import com.cinex.module.statistics.repository.StatisticsRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Statistics service — per-theater filter.
 *
 * <p><b>RBAC scope:</b> branch ADMIN auto-override theaterId từ JWT —
 * không thể xem doanh thu rạp khác bằng cách truyền theaterId thủ công.
 * SUPER_ADMIN tự do chọn theaterId (null = tất cả rạp).
 *
 * <p><b>Cache key:</b> mọi method include theaterId trong key để tránh
 * cross-theater cache leak (vd SUPER_ADMIN xem HN rồi xem HCM → 2 cache entry).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class StatisticsService {

    private final StatisticsRepository statisticsRepository;
    private final SecurityService securityService;

    /**
     * Auto-scope theaterId. Pattern đồng nhất các service: getCurrentUserTheaterId()
     * đã return null cho SUPER_ADMIN ở nguồn → branch admin lấy từ JWT, SUPER_ADMIN
     * dùng request param.
     */
    private Long resolveTheaterId(Long requested) {
        Long scopedTheaterId = securityService.getCurrentUserTheaterId();
        return scopedTheaterId != null ? scopedTheaterId : requested;
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "stats-overview", key = "'today_' + (#theaterId != null ? #theaterId : 'all')")
    public OverviewStatistics getOverview(Long theaterId) {
        Long effectiveTheaterId = resolveTheaterId(theaterId);
        LocalDateTime todayStart = LocalDate.now().atStartOfDay();
        LocalDateTime todayEnd = todayStart.plusDays(1);

        return OverviewStatistics.builder()
                .todayBookings(statisticsRepository.countTodayBookings(todayStart, todayEnd, effectiveTheaterId))
                .todayRevenue(statisticsRepository.sumTodayRevenue(todayStart, todayEnd, effectiveTheaterId))
                .todaySnackRevenue(statisticsRepository.sumTodaySnackRevenue(todayStart, todayEnd, effectiveTheaterId))
                .totalUsers(statisticsRepository.countActiveUsers())
                .totalMovies(statisticsRepository.countActiveMovies())
                .totalRooms(statisticsRepository.countActiveRooms(effectiveTheaterId))
                .totalShowtimesToday(statisticsRepository.countTodayShowtimes(todayStart, todayEnd, effectiveTheaterId))
                .build();
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "stats-revenue",
            key = "#from.toString() + '_' + #to.toString() + '_' + (#theaterId != null ? #theaterId : 'all')")
    public List<RevenueStatistics> getRevenue(LocalDate from, LocalDate to, Long theaterId) {
        return statisticsRepository.findRevenueByDateRange(from, to, resolveTheaterId(theaterId));
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "stats-top-movies",
            key = "#limit + '_' + (#from != null ? #from.toString() : 'null') + '_' + (#to != null ? #to.toString() : 'null') + '_' + (#theaterId != null ? #theaterId : 'all')")
    public List<TopMovieStatistics> getTopMovies(int limit, LocalDate from, LocalDate to, Long theaterId) {
        return statisticsRepository.findTopMovies(limit, from, to, resolveTheaterId(theaterId));
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "stats-top-movie-runs",
            key = "#limit + '_' + (#from != null ? #from.toString() : 'null') + '_' + (#to != null ? #to.toString() : 'null') + '_' + (#theaterId != null ? #theaterId : 'all')")
    public List<TopMovieRunStatistics> getTopMovieRuns(int limit, LocalDate from, LocalDate to, Long theaterId) {
        return statisticsRepository.findTopMovieRuns(limit, from, to, resolveTheaterId(theaterId));
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "stats-top-snacks",
            key = "#limit + '_' + (#from != null ? #from.toString() : 'null') + '_' + (#to != null ? #to.toString() : 'null') + '_' + (#theaterId != null ? #theaterId : 'all')")
    public List<TopSnackStatistics> getTopSnacks(int limit, LocalDate from, LocalDate to, Long theaterId) {
        return statisticsRepository.findTopSnacks(limit, from, to, resolveTheaterId(theaterId));
    }

    @Transactional(readOnly = true)
    public List<OccupancyStatistics> getOccupancy(LocalDate date, Long theaterId) {
        return statisticsRepository.findOccupancyByDate(date, resolveTheaterId(theaterId));
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "stats-occupancy-aggregate",
            key = "#from.toString() + '_' + #to.toString() + '_' + (#theaterId != null ? #theaterId : 'all')")
    public OccupancyAggregateStatistics getOccupancyAggregate(LocalDate from, LocalDate to, Long theaterId) {
        return statisticsRepository.findOccupancyAggregate(from, to, resolveTheaterId(theaterId));
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "stats-booking-health",
            key = "#from.toString() + '_' + #to.toString() + '_' + (#theaterId != null ? #theaterId : 'all')")
    public BookingHealthStatistics getBookingHealth(LocalDate from, LocalDate to, Long theaterId) {
        return statisticsRepository.findBookingHealth(from, to, resolveTheaterId(theaterId));
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "stats-revenue-breakdown",
            key = "#from.toString() + '_' + #to.toString() + '_' + (#theaterId != null ? #theaterId : 'all')")
    public RevenueBreakdownStatistics getRevenueBreakdown(LocalDate from, LocalDate to, Long theaterId) {
        return statisticsRepository.findRevenueBreakdown(from, to, resolveTheaterId(theaterId));
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "stats-revenue-by-room-type",
            key = "#from.toString() + '_' + #to.toString() + '_' + (#theaterId != null ? #theaterId : 'all')")
    public List<RevenueByRoomTypeStatistics> getRevenueByRoomType(LocalDate from, LocalDate to, Long theaterId) {
        return statisticsRepository.findRevenueByRoomType(from, to, resolveTheaterId(theaterId));
    }
}
