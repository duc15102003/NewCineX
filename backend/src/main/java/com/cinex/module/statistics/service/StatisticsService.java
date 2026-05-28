package com.cinex.module.statistics.service;

import com.cinex.module.statistics.dto.OccupancyStatistics;
import com.cinex.module.statistics.dto.OverviewStatistics;
import com.cinex.module.statistics.dto.RevenueStatistics;
import com.cinex.module.statistics.dto.TopMovieStatistics;
import com.cinex.module.statistics.dto.TopSnackStatistics;
import com.cinex.module.statistics.repository.StatisticsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * [Single Responsibility Principle]
 * Service CHỈ chứa business logic (tính toán, phối hợp gọi repository).
 * KHÔNG chứa JPQL/SQL — query nằm ở StatisticsRepository.
 *
 * So sánh TRƯỚC và SAU refactor:
 *
 * TRƯỚC (sai):
 *   Service inject EntityManager → viết JPQL trực tiếp
 *   → Service vừa xử lý logic VỪA truy vấn DB → vi phạm SRP
 *
 * SAU (đúng):
 *   Service inject StatisticsRepository → gọi method có tên rõ ràng
 *   → Service chỉ lo business logic, Repository lo data access
 *
 * Tại sao quan trọng?
 * - Dễ test: mock Repository, không cần mock EntityManager
 * - Dễ đọc: nhìn Service biết ngay logic gì, nhìn Repository biết query gì
 * - Dễ sửa: đổi query → chỉ sửa Repository, Service không bị ảnh hưởng
 */
@Service
@RequiredArgsConstructor
public class StatisticsService {

    private final StatisticsRepository statisticsRepository;

    /**
     * Tổng quan dashboard: booking hôm nay, doanh thu hôm nay, tổng user/movie/room.
     * Service chỉ lo: xác định khoảng thời gian + gọi repository + ghép kết quả.
     */
    @Transactional(readOnly = true)
    public OverviewStatistics getOverview() {
        LocalDateTime todayStart = LocalDate.now().atStartOfDay();
        LocalDateTime todayEnd = todayStart.plusDays(1);

        return OverviewStatistics.builder()
                .todayBookings(statisticsRepository.countTodayBookings(todayStart, todayEnd))
                .todayRevenue(statisticsRepository.sumTodayRevenue(todayStart, todayEnd))
                .todaySnackRevenue(statisticsRepository.sumTodaySnackRevenue(todayStart, todayEnd))
                .totalUsers(statisticsRepository.countActiveUsers())
                .totalMovies(statisticsRepository.countActiveMovies())
                .totalRooms(statisticsRepository.countActiveRooms())
                .totalShowtimesToday(statisticsRepository.countTodayShowtimes(todayStart, todayEnd))
                .build();
    }

    /**
     * Doanh thu theo ngày — FE dùng để vẽ biểu đồ doanh thu.
     */
    @Transactional(readOnly = true)
    public List<RevenueStatistics> getRevenue(LocalDate from, LocalDate to) {
        return statisticsRepository.findRevenueByDateRange(from, to);
    }

    /**
     * Top phim bán chạy nhất (theo số vé đã bán).
     * Chỉ tính vé hợp lệ: CONFIRMED + CHECKED_IN (không tính CANCELLED/EXPIRED).
     */
    @Transactional(readOnly = true)
    public List<TopMovieStatistics> getTopMovies(int limit, LocalDate from, LocalDate to) {
        return statisticsRepository.findTopMovies(limit, from, to);
    }

    /**
     * Top snack bán chạy nhất tại quầy POS (theo tổng số lượng).
     * Chỉ tính đơn hàng chưa bị xóa (ARCHIVED).
     */
    @Transactional(readOnly = true)
    public List<TopSnackStatistics> getTopSnacks(int limit, LocalDate from, LocalDate to) {
        return statisticsRepository.findTopSnacks(limit, from, to);
    }

    /**
     * Tỉ lệ lấp đầy ghế theo suất chiếu trong ngày.
     * Chỉ tính ghế của booking hợp lệ (CONFIRMED + CHECKED_IN).
     */
    @Transactional(readOnly = true)
    public List<OccupancyStatistics> getOccupancy(LocalDate date) {
        return statisticsRepository.findOccupancyByDate(date);
    }
}
