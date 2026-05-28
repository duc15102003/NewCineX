package com.cinex.module.statistics.repository;

import com.cinex.module.statistics.dto.OccupancyStatistics;
import com.cinex.module.statistics.dto.RevenueStatistics;
import com.cinex.module.statistics.dto.TopMovieStatistics;
import com.cinex.module.statistics.dto.TopSnackStatistics;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * [Repository Pattern — Standalone @Repository]
 *
 * Đây là Custom Repository, KHÔNG extends JpaRepository vì:
 * - JpaRepository dành cho CRUD 1 entity (VD: MovieRepository quản lý Movie)
 * - Thống kê cần JOIN nhiều bảng (Booking + Payment + Snack + Movie + ...)
 *   → không thuộc 1 entity cụ thể nào
 *
 * Trong các dự án thực tế, analytics/reporting luôn dùng cách này:
 * - @Repository class + @PersistenceContext EntityManager
 * - Mỗi method = 1 query rõ ràng, có tên mô tả mục đích
 * - Service chỉ gọi repository, KHÔNG viết query
 *
 * So sánh với cách cũ (EntityManager trong Service):
 *   SAI:  Service chứa JPQL → vi phạm Single Responsibility
 *         Service vừa xử lý logic VỪA truy vấn DB
 *   ĐÚNG: Repository chứa JPQL → đúng vai trò "data access layer"
 *         Service chỉ gọi repository + xử lý business logic
 */
@Repository
public class StatisticsRepository {

    // [Dependency Injection] Spring tự inject EntityManager
    // @PersistenceContext là cách chuẩn inject EntityManager (thay vì @Autowired)
    // vì nó đảm bảo mỗi thread có EntityManager riêng (thread-safe)
    @PersistenceContext
    private EntityManager em;

    // ──────────────────────────────────────────────────────────────
    // OVERVIEW — Các query đếm tổng quan cho dashboard
    // ──────────────────────────────────────────────────────────────

    /**
     * Đếm số booking hôm nay (chỉ tính CONFIRMED + CHECKED_IN, bỏ qua CANCELLED/EXPIRED).
     *
     * Tại sao dùng confirmedAt thay vì createdAt?
     * → Vì booking được tạo ở trạng thái HOLDING (chưa thanh toán),
     *   chỉ khi thanh toán xong mới chuyển sang CONFIRMED và ghi confirmedAt.
     *   Đếm theo confirmedAt mới phản ánh đúng doanh thu thực.
     */
    public Long countTodayBookings(LocalDateTime start, LocalDateTime end) {
        return (Long) em.createQuery(
                        "SELECT COUNT(b) FROM Booking b " +
                                "WHERE b.status IN ('CONFIRMED', 'CHECKED_IN') " +
                                "AND b.confirmedAt >= :start AND b.confirmedAt < :end")
                .setParameter("start", start)
                .setParameter("end", end)
                .getSingleResult();
    }

    /**
     * Doanh thu vé hôm nay — tính từ bảng Payment (chỉ status = COMPLETED).
     *
     * Tại sao không tính từ Booking.totalAmount?
     * → Vì Booking có thể bị hủy (refund), Payment.status = COMPLETED
     *   mới là tiền thực sự đã thu được.
     *
     * COALESCE(SUM(...), 0): nếu không có payment nào → trả 0 thay vì NULL.
     */
    public BigDecimal sumTodayRevenue(LocalDateTime start, LocalDateTime end) {
        return (BigDecimal) em.createQuery(
                        "SELECT COALESCE(SUM(p.amount), 0) FROM Payment p " +
                                "WHERE p.status = 'COMPLETED' " +
                                "AND p.paidAt >= :start AND p.paidAt < :end")
                .setParameter("start", start)
                .setParameter("end", end)
                .getSingleResult();
    }

    /**
     * Doanh thu snack POS hôm nay — tính từ bảng SnackOrder.
     * Lọc bỏ đơn đã bị xóa mềm (ARCHIVED).
     */
    public BigDecimal sumTodaySnackRevenue(LocalDateTime start, LocalDateTime end) {
        return (BigDecimal) em.createQuery(
                        "SELECT COALESCE(SUM(o.totalAmount), 0) FROM SnackOrder o " +
                                "WHERE o.createdAt >= :start AND o.createdAt < :end " +
                                "AND (o.storageState IS NULL OR o.storageState <> 'ARCHIVED')")
                .setParameter("start", start)
                .setParameter("end", end)
                .getSingleResult();
    }

    /** Tổng user chưa bị xóa. */
    public Long countActiveUsers() {
        return (Long) em.createQuery(
                        "SELECT COUNT(u) FROM User u " +
                                "WHERE u.storageState IS NULL OR u.storageState <> 'ARCHIVED'")
                .getSingleResult();
    }

    /** Tổng phim chưa bị xóa. */
    public Long countActiveMovies() {
        return (Long) em.createQuery(
                        "SELECT COUNT(m) FROM Movie m " +
                                "WHERE m.storageState IS NULL OR m.storageState <> 'ARCHIVED'")
                .getSingleResult();
    }

    /** Tổng phòng chiếu chưa bị xóa. */
    public Long countActiveRooms() {
        return (Long) em.createQuery(
                        "SELECT COUNT(r) FROM Room r " +
                                "WHERE r.storageState IS NULL OR r.storageState <> 'ARCHIVED'")
                .getSingleResult();
    }

    /** Tổng suất chiếu hôm nay. */
    public Long countTodayShowtimes(LocalDateTime start, LocalDateTime end) {
        return (Long) em.createQuery(
                        "SELECT COUNT(s) FROM Showtime s " +
                                "WHERE s.startTime >= :start AND s.startTime < :end " +
                                "AND (s.storageState IS NULL OR s.storageState <> 'ARCHIVED')")
                .setParameter("start", start)
                .setParameter("end", end)
                .getSingleResult();
    }

    // ──────────────────────────────────────────────────────────────
    // REVENUE — Doanh thu theo ngày (FE vẽ chart)
    // ──────────────────────────────────────────────────────────────

    /**
     * Doanh thu theo ngày — gom nhóm Payment.paidAt theo ngày.
     *
     * CAST(p.paidAt AS LocalDate): chuyển datetime → date để GROUP BY theo ngày.
     * Ví dụ: 2026-05-27T10:30 và 2026-05-27T14:00 → cùng nhóm 2026-05-27.
     *
     * Kết quả: mỗi dòng = [ngày, tổng doanh thu, số giao dịch]
     */
    @SuppressWarnings("unchecked")
    public List<RevenueStatistics> findRevenueByDateRange(LocalDate from, LocalDate to) {
        List<Object[]> rows = em.createQuery(
                        "SELECT CAST(p.paidAt AS LocalDate), SUM(p.amount), COUNT(p) " +
                                "FROM Payment p " +
                                "WHERE p.status = 'COMPLETED' " +
                                "AND p.paidAt >= :start AND p.paidAt < :end " +
                                "GROUP BY CAST(p.paidAt AS LocalDate) " +
                                "ORDER BY CAST(p.paidAt AS LocalDate)")
                .setParameter("start", from.atStartOfDay())
                .setParameter("end", to.plusDays(1).atStartOfDay())
                .getResultList();

        return rows.stream()
                .map(r -> new RevenueStatistics(
                        (LocalDate) r[0],
                        (BigDecimal) r[1],
                        ((Number) r[2]).longValue()))
                .toList();
    }

    // ──────────────────────────────────────────────────────────────
    // TOP MOVIES — Phim bán chạy nhất (theo số vé)
    // ──────────────────────────────────────────────────────────────

    /**
     * Top phim bán chạy — đếm số ghế đã đặt (BookingSeat) cho mỗi phim.
     *
     * Chuỗi JOIN: BookingSeat → Booking → Showtime → Movie
     * Giải thích: mỗi BookingSeat thuộc 1 Booking, Booking thuộc 1 Showtime,
     *             Showtime chiếu 1 Movie → đếm BookingSeat = đếm vé cho phim đó.
     *
     * Filter quan trọng:
     * - b.status IN ('CONFIRMED', 'CHECKED_IN'): CHỈ tính vé hợp lệ
     *   → loại bỏ CANCELLED (đã hủy), EXPIRED (hết hạn), HOLDING (chưa thanh toán)
     * - bs.status = 'BOOKED': chỉ tính ghế đã xác nhận (không tính HELD/RELEASED)
     *
     * ((Number) r[x]).longValue(): SQL Server trả Integer cho COUNT/SUM,
     * nhưng Java cần Long → dùng Number để tránh ClassCastException.
     */
    @SuppressWarnings("unchecked")
    public List<TopMovieStatistics> findTopMovies(int limit, LocalDate from, LocalDate to) {
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
        jpql += "GROUP BY m.id, m.title, m.posterUrl ORDER BY COUNT(bs) DESC";

        var query = em.createQuery(jpql);
        if (from != null && to != null) {
            query.setParameter("start", from.atStartOfDay());
            query.setParameter("end", to.plusDays(1).atStartOfDay());
        }
        List<Object[]> rows = query.setMaxResults(limit).getResultList();

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
    // TOP SNACKS — Snack bán chạy nhất tại POS
    // ──────────────────────────────────────────────────────────────

    /**
     * Top snack bán chạy — tính từ SnackOrderItem (mỗi dòng = 1 snack trong 1 đơn).
     *
     * JOIN oi.snackOrder o: để lọc đơn hàng đã bị xóa mềm (ARCHIVED).
     * SUM(oi.quantity): tổng số lượng bán ra cho mỗi snack.
     * SUM(oi.price * oi.quantity): tổng doanh thu (giá × số lượng).
     *
     * Lưu ý: oi.price là giá tại thời điểm đặt, không phải giá hiện tại.
     * → Đảm bảo thống kê phản ánh đúng doanh thu thực (Price Snapshot pattern).
     */
    @SuppressWarnings("unchecked")
    public List<TopSnackStatistics> findTopSnacks(int limit, LocalDate from, LocalDate to) {
        String jpql = "SELECT s.id, s.name, s.imageUrl, SUM(oi.quantity), SUM(oi.price * oi.quantity) " +
                "FROM SnackOrderItem oi " +
                "JOIN oi.snack s " +
                "JOIN oi.snackOrder o " +
                "WHERE (o.storageState IS NULL OR o.storageState <> 'ARCHIVED') ";
        if (from != null && to != null) {
            jpql += "AND o.createdAt >= :start AND o.createdAt < :end ";
        }
        jpql += "GROUP BY s.id, s.name, s.imageUrl ORDER BY SUM(oi.quantity) DESC";

        var query = em.createQuery(jpql);
        if (from != null && to != null) {
            query.setParameter("start", from.atStartOfDay());
            query.setParameter("end", to.plusDays(1).atStartOfDay());
        }
        List<Object[]> rows = query.setMaxResults(limit).getResultList();

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
    // OCCUPANCY — Tỉ lệ lấp đầy ghế
    // ──────────────────────────────────────────────────────────────

    /**
     * Tỉ lệ lấp đầy ghế theo từng suất chiếu trong ngày.
     *
     * Subquery đếm ghế đã đặt cho mỗi suất chiếu:
     * - JOIN BookingSeat qua booking.showtime.id
     * - Chỉ tính ghế BOOKED thuộc booking CONFIRMED/CHECKED_IN
     *   → loại bỏ vé đã hủy (CANCELLED) và hết hạn (EXPIRED)
     *
     * COALESCE(..., 0): suất chiếu chưa có ai đặt → bookedSeats = 0.
     *
     * Occupancy rate = bookedSeats / totalSeats × 100 (%).
     */
    @SuppressWarnings("unchecked")
    public List<OccupancyStatistics> findOccupancyByDate(LocalDate date) {
        LocalDateTime dayStart = date.atStartOfDay();
        LocalDateTime dayEnd = date.plusDays(1).atStartOfDay();

        List<Object[]> rows = em.createQuery(
                        "SELECT s.id, m.title, r.name, s.startTime, r.totalSeats, " +
                                "COALESCE((SELECT COUNT(bs) FROM BookingSeat bs " +
                                "   WHERE bs.booking.showtime.id = s.id " +
                                "   AND bs.status = 'BOOKED' " +
                                "   AND bs.booking.status IN ('CONFIRMED', 'CHECKED_IN')), 0) " +
                                "FROM Showtime s " +
                                "JOIN s.movie m " +
                                "JOIN s.room r " +
                                "WHERE s.startTime >= :start AND s.startTime < :end " +
                                "AND (s.storageState IS NULL OR s.storageState <> 'ARCHIVED') " +
                                "ORDER BY s.startTime")
                .setParameter("start", dayStart)
                .setParameter("end", dayEnd)
                .getResultList();

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
    // HELPER — Chuyển đổi kiểu dữ liệu an toàn
    // ──────────────────────────────────────────────────────────────

    /**
     * SQL Server trả các kiểu số khác nhau cho SUM/COUNT:
     * - SUM(bigint) → Long
     * - SUM(int) → Integer
     * - SUM(decimal) → BigDecimal
     * - COUNT → Long hoặc Integer tùy driver
     *
     * Method này đảm bảo chuyển đổi an toàn sang BigDecimal.
     */
    private BigDecimal toBigDecimal(Object value) {
        if (value == null) return BigDecimal.ZERO;
        if (value instanceof BigDecimal) return (BigDecimal) value;
        return new BigDecimal(((Number) value).toString());
    }
}
