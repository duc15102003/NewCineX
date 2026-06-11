package com.cinex.module.statistics.repository;

import com.cinex.module.statistics.dto.OccupancyStatistics;
import com.cinex.module.statistics.dto.RevenueStatistics;
import com.cinex.module.statistics.dto.TopMovieRunStatistics;
import com.cinex.module.statistics.dto.TopMovieStatistics;
import com.cinex.module.statistics.dto.TopSnackStatistics;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Custom Repository cho thống kê (không extends JpaRepository vì JOIN nhiều bảng).
 *
 * <p><b>theaterId param:</b> null = tất cả chi nhánh (SUPER_ADMIN "Tất cả");
 * có giá trị = lọc theo chi nhánh cụ thể (SUPER_ADMIN chọn 1 hoặc branch ADMIN).
 * Mỗi method nhận theaterId optional và thêm WHERE clause khi != null.
 */
@Repository
public class StatisticsRepository {

    @PersistenceContext
    private EntityManager em;

    // ──────────────────────────────────────────────────────────────
    // OVERVIEW — đếm + tổng quan cho dashboard
    // ──────────────────────────────────────────────────────────────

    public Long countTodayBookings(LocalDateTime start, LocalDateTime end, Long theaterId) {
        String jpql = "SELECT COUNT(b) FROM Booking b " +
                "WHERE b.status IN ('CONFIRMED', 'CHECKED_IN') " +
                "AND b.confirmedAt >= :start AND b.confirmedAt < :end ";
        if (theaterId != null) {
            jpql += "AND b.theater.id = :theaterId ";
        }
        Query q = em.createQuery(jpql)
                .setParameter("start", start)
                .setParameter("end", end);
        if (theaterId != null) q.setParameter("theaterId", theaterId);
        return (Long) q.getSingleResult();
    }

    /**
     * Doanh thu vé hôm nay — dùng Booking.theater direct field (snapshot immutable
     * lúc booking tạo). Tránh JOIN chain showtime.room.theater dài + vỡ nếu showtime
     * move room cross-theater sau khi booking thanh toán.
     */
    public BigDecimal sumTodayRevenue(LocalDateTime start, LocalDateTime end, Long theaterId) {
        String jpql = "SELECT COALESCE(SUM(p.amount), 0) FROM Payment p " +
                "WHERE p.status = 'COMPLETED' " +
                "AND p.paidAt >= :start AND p.paidAt < :end ";
        if (theaterId != null) {
            jpql += "AND p.booking.theater.id = :theaterId ";
        }
        Query q = em.createQuery(jpql)
                .setParameter("start", start)
                .setParameter("end", end);
        if (theaterId != null) q.setParameter("theaterId", theaterId);
        return (BigDecimal) q.getSingleResult();
    }

    /** SnackOrder có field theater trực tiếp (per-theater). */
    public BigDecimal sumTodaySnackRevenue(LocalDateTime start, LocalDateTime end, Long theaterId) {
        String jpql = "SELECT COALESCE(SUM(o.totalAmount), 0) FROM SnackOrder o " +
                "WHERE o.createdAt >= :start AND o.createdAt < :end " +
                "AND (o.storageState IS NULL OR o.storageState <> 'ARCHIVED') ";
        if (theaterId != null) {
            jpql += "AND o.theater.id = :theaterId ";
        }
        Query q = em.createQuery(jpql)
                .setParameter("start", start)
                .setParameter("end", end);
        if (theaterId != null) q.setParameter("theaterId", theaterId);
        return (BigDecimal) q.getSingleResult();
    }

    /** User là SHARED entity (không thuộc chi nhánh) — KHÔNG filter theo theaterId. */
    public Long countActiveUsers() {
        return (Long) em.createQuery(
                        "SELECT COUNT(u) FROM User u " +
                                "WHERE u.storageState IS NULL OR u.storageState <> 'ARCHIVED'")
                .getSingleResult();
    }

    /** Movie là SHARED entity (cùng phim chiếu nhiều rạp) — KHÔNG filter theo theaterId. */
    public Long countActiveMovies() {
        return (Long) em.createQuery(
                        "SELECT COUNT(m) FROM Movie m " +
                                "WHERE m.storageState IS NULL OR m.storageState <> 'ARCHIVED'")
                .getSingleResult();
    }

    public Long countActiveRooms(Long theaterId) {
        String jpql = "SELECT COUNT(r) FROM Room r " +
                "WHERE (r.storageState IS NULL OR r.storageState <> 'ARCHIVED') ";
        if (theaterId != null) {
            jpql += "AND r.theater.id = :theaterId ";
        }
        Query q = em.createQuery(jpql);
        if (theaterId != null) q.setParameter("theaterId", theaterId);
        return (Long) q.getSingleResult();
    }

    public Long countTodayShowtimes(LocalDateTime start, LocalDateTime end, Long theaterId) {
        String jpql = "SELECT COUNT(s) FROM Showtime s " +
                "WHERE s.startTime >= :start AND s.startTime < :end " +
                "AND (s.storageState IS NULL OR s.storageState <> 'ARCHIVED') ";
        if (theaterId != null) {
            jpql += "AND s.room.theater.id = :theaterId ";
        }
        Query q = em.createQuery(jpql)
                .setParameter("start", start)
                .setParameter("end", end);
        if (theaterId != null) q.setParameter("theaterId", theaterId);
        return (Long) q.getSingleResult();
    }

    // ──────────────────────────────────────────────────────────────
    // REVENUE — Doanh thu theo ngày
    // ──────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    public List<RevenueStatistics> findRevenueByDateRange(LocalDate from, LocalDate to, Long theaterId) {
        String jpql = "SELECT CAST(p.paidAt AS LocalDate), SUM(p.amount), COUNT(p) " +
                "FROM Payment p " +
                "WHERE p.status = 'COMPLETED' " +
                "AND p.paidAt >= :start AND p.paidAt < :end ";
        if (theaterId != null) {
            jpql += "AND p.booking.theater.id = :theaterId ";
        }
        jpql += "GROUP BY CAST(p.paidAt AS LocalDate) " +
                "ORDER BY CAST(p.paidAt AS LocalDate)";

        Query q = em.createQuery(jpql)
                .setParameter("start", from.atStartOfDay())
                .setParameter("end", to.plusDays(1).atStartOfDay());
        if (theaterId != null) q.setParameter("theaterId", theaterId);
        List<Object[]> rows = q.getResultList();

        return rows.stream()
                .map(r -> new RevenueStatistics(
                        (LocalDate) r[0],
                        (BigDecimal) r[1],
                        ((Number) r[2]).longValue()))
                .toList();
    }

    // ──────────────────────────────────────────────────────────────
    // TOP MOVIES
    // ──────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    public List<TopMovieStatistics> findTopMovies(int limit, LocalDate from, LocalDate to, Long theaterId) {
        String jpql = "SELECT m.id, m.title, m.posterUrl, COUNT(bs), SUM(bs.price) " +
                "FROM BookingSeat bs " +
                "JOIN bs.booking b " +
                "JOIN b.showtime s " +
                "JOIN s.movie m " +
                "WHERE b.status IN ('CONFIRMED', 'CHECKED_IN') " +
                "AND bs.status = 'BOOKED' ";
        if (from != null && to != null) {
            jpql += "AND b.confirmedAt >= :start AND b.confirmedAt < :end ";
        }
        if (theaterId != null) {
            jpql += "AND b.theater.id = :theaterId ";
        }
        jpql += "GROUP BY m.id, m.title, m.posterUrl ORDER BY COUNT(bs) DESC";

        Query q = em.createQuery(jpql);
        if (from != null && to != null) {
            q.setParameter("start", from.atStartOfDay());
            q.setParameter("end", to.plusDays(1).atStartOfDay());
        }
        if (theaterId != null) q.setParameter("theaterId", theaterId);
        List<Object[]> rows = q.setMaxResults(limit).getResultList();

        return rows.stream()
                .map(r -> new TopMovieStatistics(
                        ((Number) r[0]).longValue(),
                        (String) r[1],
                        (String) r[2],
                        ((Number) r[3]).longValue(),
                        toBigDecimal(r[4])))
                .toList();
    }

    // ──────────────────────────────────────────────────────────────
    // TOP MOVIE RUNS — group theo MovieRun (per-theater)
    // ──────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    public List<TopMovieRunStatistics> findTopMovieRuns(int limit, LocalDate from, LocalDate to, Long theaterId) {
        String jpql = "SELECT mr.id, m.id, m.title, m.posterUrl, mr.runType, mr.startDate, mr.endDate, " +
                "       COUNT(bs), SUM(bs.price) " +
                "FROM BookingSeat bs " +
                "JOIN bs.booking b " +
                "JOIN b.showtime s " +
                "JOIN s.movieRun mr " +
                "JOIN mr.movie m " +
                "WHERE b.status IN ('CONFIRMED', 'CHECKED_IN') " +
                "AND bs.status = 'BOOKED' ";
        if (from != null && to != null) {
            jpql += "AND b.confirmedAt >= :start AND b.confirmedAt < :end ";
        }
        if (theaterId != null) {
            jpql += "AND b.theater.id = :theaterId ";
        }
        jpql += "GROUP BY mr.id, m.id, m.title, m.posterUrl, mr.runType, mr.startDate, mr.endDate " +
                "ORDER BY COUNT(bs) DESC";

        Query q = em.createQuery(jpql);
        if (from != null && to != null) {
            q.setParameter("start", from.atStartOfDay());
            q.setParameter("end", to.plusDays(1).atStartOfDay());
        }
        if (theaterId != null) q.setParameter("theaterId", theaterId);
        List<Object[]> rows = q.setMaxResults(limit).getResultList();

        return rows.stream()
                .map(r -> new TopMovieRunStatistics(
                        ((Number) r[0]).longValue(),
                        ((Number) r[1]).longValue(),
                        (String) r[2],
                        (String) r[3],
                        r[4] != null ? r[4].toString() : null,
                        (LocalDate) r[5],
                        (LocalDate) r[6],
                        ((Number) r[7]).longValue(),
                        toBigDecimal(r[8])))
                .toList();
    }

    // ──────────────────────────────────────────────────────────────
    // TOP SNACKS
    // ──────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    public List<TopSnackStatistics> findTopSnacks(int limit, LocalDate from, LocalDate to, Long theaterId) {
        String jpql = "SELECT s.id, s.name, s.imageUrl, SUM(oi.quantity), SUM(oi.price * oi.quantity) " +
                "FROM SnackOrderItem oi " +
                "JOIN oi.snack s " +
                "JOIN oi.snackOrder o " +
                "WHERE (o.storageState IS NULL OR o.storageState <> 'ARCHIVED') ";
        if (from != null && to != null) {
            jpql += "AND o.createdAt >= :start AND o.createdAt < :end ";
        }
        if (theaterId != null) {
            jpql += "AND o.theater.id = :theaterId ";
        }
        jpql += "GROUP BY s.id, s.name, s.imageUrl ORDER BY SUM(oi.quantity) DESC";

        Query q = em.createQuery(jpql);
        if (from != null && to != null) {
            q.setParameter("start", from.atStartOfDay());
            q.setParameter("end", to.plusDays(1).atStartOfDay());
        }
        if (theaterId != null) q.setParameter("theaterId", theaterId);
        List<Object[]> rows = q.setMaxResults(limit).getResultList();

        return rows.stream()
                .map(r -> new TopSnackStatistics(
                        ((Number) r[0]).longValue(),
                        (String) r[1],
                        (String) r[2],
                        ((Number) r[3]).longValue(),
                        toBigDecimal(r[4])))
                .toList();
    }

    // ──────────────────────────────────────────────────────────────
    // OCCUPANCY
    // ──────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    public List<OccupancyStatistics> findOccupancyByDate(LocalDate date, Long theaterId) {
        LocalDateTime dayStart = date.atStartOfDay();
        LocalDateTime dayEnd = date.plusDays(1).atStartOfDay();

        String jpql = "SELECT s.id, m.title, r.name, s.startTime, r.totalSeats, " +
                "COALESCE((SELECT COUNT(bs) FROM BookingSeat bs " +
                "   WHERE bs.booking.showtime.id = s.id " +
                "   AND bs.status = 'BOOKED' " +
                "   AND bs.booking.status IN ('CONFIRMED', 'CHECKED_IN')), 0) " +
                "FROM Showtime s " +
                "JOIN s.movie m " +
                "JOIN s.room r " +
                "WHERE s.startTime >= :start AND s.startTime < :end " +
                "AND (s.storageState IS NULL OR s.storageState <> 'ARCHIVED') ";
        if (theaterId != null) {
            jpql += "AND r.theater.id = :theaterId ";
        }
        jpql += "ORDER BY s.startTime";

        Query q = em.createQuery(jpql)
                .setParameter("start", dayStart)
                .setParameter("end", dayEnd);
        if (theaterId != null) q.setParameter("theaterId", theaterId);
        List<Object[]> rows = q.getResultList();

        return rows.stream()
                .map(r -> {
                    int totalSeats = ((Number) r[4]).intValue();
                    long bookedSeats = ((Number) r[5]).longValue();
                    double rate = totalSeats > 0
                            ? (double) bookedSeats / totalSeats * 100
                            : 0;
                    return new OccupancyStatistics(
                            ((Number) r[0]).longValue(),
                            (String) r[1],
                            (String) r[2],
                            (LocalDateTime) r[3],
                            totalSeats,
                            (int) bookedSeats,
                            Math.round(rate * 10.0) / 10.0);
                })
                .toList();
    }

    // ──────────────────────────────────────────────────────────────
    // HELPER
    // ──────────────────────────────────────────────────────────────

    private BigDecimal toBigDecimal(Object value) {
        if (value == null) return BigDecimal.ZERO;
        if (value instanceof BigDecimal) return (BigDecimal) value;
        return new BigDecimal(((Number) value).toString());
    }
}
