package com.cinex.module.statistics.repository;

import com.cinex.module.statistics.dto.BookingHealthStatistics;
import com.cinex.module.statistics.dto.OccupancyAggregateStatistics;
import com.cinex.module.statistics.dto.OccupancyStatistics;
import com.cinex.module.statistics.dto.RevenueByRoomTypeStatistics;
import com.cinex.module.statistics.dto.RevenueBreakdownStatistics;
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
        // Doanh thu = proportional allocation: mỗi ghế gánh phần discount+VAT của booking
        // theo tỉ lệ giá ghế gốc / tổng giá ghế gốc. SUM bằng tổng totalAmount thực thu
        // → match cột "Doanh thu hôm nay" (sumTodayRevenue lấy từ Payment.amount).
        // Trước đây SUM(bs.price) = giá GỐC trước discount → cộng top phim > overview.
        String jpql = "SELECT m.id, m.title, m.posterUrl, COUNT(bs), " +
                "       SUM(bs.price * b.totalAmount / b.seatTotalAmount) " +
                "FROM BookingSeat bs " +
                "JOIN bs.booking b " +
                "JOIN b.showtime s " +
                "JOIN s.movie m " +
                "WHERE b.status IN ('CONFIRMED', 'CHECKED_IN') " +
                "AND bs.status = 'BOOKED' " +
                "AND b.seatTotalAmount > 0 ";
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
        // Cùng formula proportional với findTopMovies — doanh thu thực thu, match
        // overview. Trước đây dùng SUM(bs.price) gây mâu thuẫn với "Doanh thu hôm nay".
        String jpql = "SELECT mr.id, m.id, m.title, m.posterUrl, mr.runType, mr.startDate, mr.endDate, " +
                "       COUNT(bs), SUM(bs.price * b.totalAmount / b.seatTotalAmount) " +
                "FROM BookingSeat bs " +
                "JOIN bs.booking b " +
                "JOIN b.showtime s " +
                "JOIN s.movieRun mr " +
                "JOIN mr.movie m " +
                "WHERE b.status IN ('CONFIRMED', 'CHECKED_IN') " +
                "AND bs.status = 'BOOKED' " +
                "AND b.seatTotalAmount > 0 ";
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
    // OCCUPANCY AGGREGATE — Tỉ lệ lấp ghế tổng hợp tuần/tháng
    // ──────────────────────────────────────────────────────────────

    /**
     * Aggregate occupancy KPI cinema chuẩn industry. Khác {@link #findOccupancyByDate}
     * (per-showtime list), method này gom tổng theo khoảng để dashboard summary.
     *
     * <p>Chỉ tính các suất đã/đang chiếu (status IN ONGOING/FINISHED) — SCHEDULED
     * tương lai chưa "bán hết được" nên không tính denominator. CANCELLED loại
     * trừ vì ghế không thực sự chào bán.
     */
    public OccupancyAggregateStatistics findOccupancyAggregate(LocalDate from, LocalDate to, Long theaterId) {
        // Sub-query showtime: chỉ tính suất chưa ARCHIVED — nếu admin xoá mềm
        // showtime sau khi đã chạy, không tính vào occupancy KPI để tránh
        // báo cáo lệch (showtime cũ vẫn count vô denominator).
        String jpql = "SELECT " +
                "  COALESCE(SUM(r.totalSeats), 0), " +
                "  COALESCE((SELECT COUNT(bs) FROM BookingSeat bs " +
                "            WHERE bs.booking.showtime IN " +
                "              (SELECT s2 FROM Showtime s2 " +
                "               WHERE s2.startTime >= :start AND s2.startTime < :end " +
                "               AND s2.status IN ('ONGOING', 'FINISHED') " +
                "               AND (s2.storageState IS NULL OR s2.storageState <> 'ARCHIVED') " +
                (theaterId != null ? "               AND s2.room.theater.id = :theaterId " : "") +
                "              ) " +
                "            AND bs.status = 'BOOKED' " +
                "            AND bs.booking.status IN ('CONFIRMED', 'CHECKED_IN')), 0), " +
                "  COUNT(s) " +
                "FROM Showtime s " +
                "JOIN s.room r " +
                "WHERE s.startTime >= :start AND s.startTime < :end " +
                "AND s.status IN ('ONGOING', 'FINISHED') " +
                "AND (s.storageState IS NULL OR s.storageState <> 'ARCHIVED') ";
        if (theaterId != null) {
            jpql += "AND r.theater.id = :theaterId ";
        }

        Query q = em.createQuery(jpql)
                .setParameter("start", from.atStartOfDay())
                .setParameter("end", to.plusDays(1).atStartOfDay());
        if (theaterId != null) q.setParameter("theaterId", theaterId);
        Object[] row = (Object[]) q.getSingleResult();

        long totalSeats = ((Number) row[0]).longValue();
        long bookedSeats = ((Number) row[1]).longValue();
        long sessionCount = ((Number) row[2]).longValue();
        double rate = totalSeats > 0 ? (double) bookedSeats / totalSeats * 100 : 0;
        return new OccupancyAggregateStatistics(
                bookedSeats, totalSeats,
                Math.round(rate * 10.0) / 10.0,
                sessionCount);
    }

    // ──────────────────────────────────────────────────────────────
    // BOOKING HEALTH — No-show + Cancel + Expire rates
    // ──────────────────────────────────────────────────────────────

    /**
     * Operational health KPI — đánh giá UX checkout + thái độ khách.
     *
     * <p>Dùng 1 query duy nhất với conditional SUM (CASE WHEN) để tránh round-trip
     * nhiều query. Filter chính: {@code createdAt} trong khoảng cho rate denominators
     * + sub-filter cho no-show (showtime đã kết thúc).
     */
    public BookingHealthStatistics findBookingHealth(LocalDate from, LocalDate to, Long theaterId) {
        LocalDateTime now = LocalDateTime.now();
        String jpql = "SELECT " +
                "  COUNT(b), " +
                "  SUM(CASE WHEN b.status IN ('CONFIRMED', 'CHECKED_IN') THEN 1 ELSE 0 END), " +
                "  SUM(CASE WHEN b.status = 'CHECKED_IN' THEN 1 ELSE 0 END), " +
                "  SUM(CASE WHEN b.status = 'CONFIRMED' AND b.showtime.endTime < :now THEN 1 ELSE 0 END), " +
                "  SUM(CASE WHEN b.status = 'CANCELLED' THEN 1 ELSE 0 END), " +
                "  SUM(CASE WHEN b.status = 'EXPIRED' THEN 1 ELSE 0 END), " +
                "  SUM(CASE WHEN b.status IN ('CONFIRMED', 'CHECKED_IN') AND b.showtime.endTime < :now THEN 1 ELSE 0 END) " +
                "FROM Booking b " +
                "WHERE b.createdAt >= :start AND b.createdAt < :end ";
        if (theaterId != null) {
            jpql += "AND b.theater.id = :theaterId ";
        }

        Query q = em.createQuery(jpql)
                .setParameter("start", from.atStartOfDay())
                .setParameter("end", to.plusDays(1).atStartOfDay())
                .setParameter("now", now);
        if (theaterId != null) q.setParameter("theaterId", theaterId);
        Object[] r = (Object[]) q.getSingleResult();

        long total = ((Number) r[0]).longValue();
        long confirmed = numOrZero(r[1]);
        long checkedIn = numOrZero(r[2]);
        long noShow = numOrZero(r[3]);
        long cancelled = numOrZero(r[4]);
        long expired = numOrZero(r[5]);
        long endedShows = numOrZero(r[6]); // mẫu số no-show: chỉ tính suất đã kết thúc

        double noShowRate = endedShows > 0 ? (double) noShow / endedShows * 100 : 0;
        double cancelRate = total > 0 ? (double) cancelled / total * 100 : 0;
        double expireRate = total > 0 ? (double) expired / total * 100 : 0;

        return new BookingHealthStatistics(
                confirmed, checkedIn, noShow,
                Math.round(noShowRate * 10.0) / 10.0,
                cancelled, expired, total,
                Math.round(cancelRate * 10.0) / 10.0,
                Math.round(expireRate * 10.0) / 10.0);
    }

    // ──────────────────────────────────────────────────────────────
    // REVENUE BREAKDOWN — Vé / Snack pie chart
    // ──────────────────────────────────────────────────────────────

    /**
     * Cơ cấu doanh thu theo nguồn — pie chart classic. Generalize logic của
     * {@link #sumTodayRevenue} + {@link #sumTodaySnackRevenue} sang khoảng range.
     */
    public RevenueBreakdownStatistics findRevenueBreakdown(LocalDate from, LocalDate to, Long theaterId) {
        LocalDateTime start = from.atStartOfDay();
        LocalDateTime end = to.plusDays(1).atStartOfDay();

        String ticketJpql = "SELECT COALESCE(SUM(p.amount), 0) FROM Payment p " +
                "WHERE p.status = 'COMPLETED' " +
                "AND p.paidAt >= :start AND p.paidAt < :end ";
        if (theaterId != null) {
            ticketJpql += "AND p.booking.theater.id = :theaterId ";
        }
        Query tq = em.createQuery(ticketJpql)
                .setParameter("start", start).setParameter("end", end);
        if (theaterId != null) tq.setParameter("theaterId", theaterId);
        BigDecimal ticketRev = (BigDecimal) tq.getSingleResult();

        String snackJpql = "SELECT COALESCE(SUM(o.totalAmount), 0) FROM SnackOrder o " +
                "WHERE o.createdAt >= :start AND o.createdAt < :end " +
                "AND (o.storageState IS NULL OR o.storageState <> 'ARCHIVED') ";
        if (theaterId != null) {
            snackJpql += "AND o.theater.id = :theaterId ";
        }
        Query sq = em.createQuery(snackJpql)
                .setParameter("start", start).setParameter("end", end);
        if (theaterId != null) sq.setParameter("theaterId", theaterId);
        BigDecimal snackRev = (BigDecimal) sq.getSingleResult();

        BigDecimal total = ticketRev.add(snackRev);
        double ticketPct = total.signum() > 0
                ? ticketRev.multiply(BigDecimal.valueOf(100))
                    .divide(total, 1, java.math.RoundingMode.HALF_UP).doubleValue()
                : 0;
        double snackPct = total.signum() > 0
                ? snackRev.multiply(BigDecimal.valueOf(100))
                    .divide(total, 1, java.math.RoundingMode.HALF_UP).doubleValue()
                : 0;
        return new RevenueBreakdownStatistics(ticketRev, snackRev, total, ticketPct, snackPct);
    }

    // ──────────────────────────────────────────────────────────────
    // REVENUE BY ROOM TYPE — Segment 2D/3D/IMAX/4DX
    // ──────────────────────────────────────────────────────────────

    /**
     * Doanh thu theo loại phòng — validate pricing strategy (IMAX có thu đủ
     * gấp 2× để bù số phòng ít hơn 2D không).
     *
     * <p>Cùng formula proportional với {@link #findTopMovies} — tổng các row
     * = doanh thu vé toàn dashboard. GROUP BY {@code room.type}.
     */
    @SuppressWarnings("unchecked")
    public List<RevenueByRoomTypeStatistics> findRevenueByRoomType(LocalDate from, LocalDate to, Long theaterId) {
        String jpql = "SELECT r.type, COUNT(bs), " +
                "       SUM(bs.price * b.totalAmount / b.seatTotalAmount) " +
                "FROM BookingSeat bs " +
                "JOIN bs.booking b " +
                "JOIN b.showtime s " +
                "JOIN s.room r " +
                "WHERE b.status IN ('CONFIRMED', 'CHECKED_IN') " +
                "AND bs.status = 'BOOKED' " +
                "AND b.seatTotalAmount > 0 " +
                "AND b.confirmedAt >= :start AND b.confirmedAt < :end ";
        if (theaterId != null) {
            jpql += "AND b.theater.id = :theaterId ";
        }
        jpql += "GROUP BY r.type ORDER BY SUM(bs.price * b.totalAmount / b.seatTotalAmount) DESC";

        Query q = em.createQuery(jpql)
                .setParameter("start", from.atStartOfDay())
                .setParameter("end", to.plusDays(1).atStartOfDay());
        if (theaterId != null) q.setParameter("theaterId", theaterId);
        List<Object[]> rows = q.getResultList();

        // Tính total để derive % — 2 pass: pass 1 collect raw, pass 2 fill percent
        BigDecimal total = rows.stream()
                .map(row -> toBigDecimal(row[2]))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return rows.stream()
                .map(row -> {
                    BigDecimal rev = toBigDecimal(row[2]);
                    double pct = total.signum() > 0
                            ? rev.multiply(BigDecimal.valueOf(100))
                                .divide(total, 1, java.math.RoundingMode.HALF_UP).doubleValue()
                            : 0;
                    return new RevenueByRoomTypeStatistics(
                            row[0] != null ? row[0].toString() : "UNKNOWN",
                            ((Number) row[1]).longValue(),
                            rev,
                            pct);
                })
                .toList();
    }

    // ──────────────────────────────────────────────────────────────
    // HELPER
    // ──────────────────────────────────────────────────────────────

    /** SUM(CASE WHEN) trả NULL nếu không có row match — convert về 0L. */
    private long numOrZero(Object value) {
        return value == null ? 0L : ((Number) value).longValue();
    }

    private BigDecimal toBigDecimal(Object value) {
        if (value == null) return BigDecimal.ZERO;
        if (value instanceof BigDecimal) return (BigDecimal) value;
        return new BigDecimal(((Number) value).toString());
    }
}
