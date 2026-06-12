package com.cinex.module.showtime.repository;

import com.cinex.common.entity.StorageState;
import com.cinex.module.showtime.entity.Showtime;
import com.cinex.module.showtime.entity.ShowtimeStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface ShowtimeRepository extends JpaRepository<Showtime, Long>, JpaSpecificationExecutor<Showtime> {

    /**
     * Group by theater và đếm số suất chiếu chưa archived — dùng cho grouped view
     * ở admin (Tất cả chi nhánh). Trả {@code Object[]{theaterId, count}} cho mỗi chi nhánh.
     */
    @Query("SELECT s.room.theater.id, COUNT(s) FROM Showtime s " +
            "WHERE s.storageState IS NULL OR s.storageState <> :archived " +
            "GROUP BY s.room.theater.id")
    List<Object[]> countByTheater(@Param("archived") StorageState archived);

    /**
     * Top-N suất chiếu mới nhất MỖI chi nhánh — dùng cho grouped overview ở admin.
     *
     * <p>Trước đó "Tất cả chi nhánh" lấy page 50 sort createdAt DESC → group lại theo
     * theater → mỗi chi nhánh ra số lượng KHÔNG ĐỀU (Hà Nội 11, Đà Nẵng 9...) tùy
     * lúc tạo suất → confusing.
     *
     * <p>Giờ dùng SQL Server ROW_NUMBER() OVER (PARTITION BY theater_id ORDER BY
     * created_at DESC) → mỗi chi nhánh luôn show ĐÚNG N suất mới nhất. Chuẩn industry
     * cho "recent activity by group" dashboard pattern.
     *
     * <p>Native query vì JPQL không hỗ trợ window function. Trả Showtime entity →
     * service map sang ShowtimeListResponse.
     */
    @Query(value = """
            SELECT t.*
            FROM (
                SELECT s.*,
                       ROW_NUMBER() OVER (PARTITION BY r.theater_id ORDER BY s.created_at DESC) AS rn
                FROM showtimes s
                INNER JOIN rooms r ON s.room_id = r.id
                WHERE s.storage_state IS NULL OR s.storage_state <> 'ARCHIVED'
            ) t
            WHERE t.rn <= :limitPerTheater
            ORDER BY t.theater_id, t.created_at DESC
            """, nativeQuery = true)
    List<Showtime> findTopNPerTheater(@Param("limitPerTheater") int limitPerTheater);

    /**
     * Kiểm tra phòng có suất chiếu active (SCHEDULED/ONGOING) chưa archived hay không.
     * Dùng để chặn xóa Room / xóa Movie khi vẫn còn suất chiếu phụ thuộc.
     */
    boolean existsByRoomIdAndStatusInAndStorageStateNot(
            Long roomId, List<ShowtimeStatus> statuses, StorageState storageState);

    /**
     * Kiểm tra phim có suất chiếu active (SCHEDULED/ONGOING) chưa archived hay không.
     * Dùng để chặn xóa Movie khi vẫn còn suất chiếu phụ thuộc.
     */
    boolean existsByMovieIdAndStatusInAndStorageStateNot(
            Long movieId, List<ShowtimeStatus> statuses, StorageState storageState);

    /**
     * Kiểm tra 1 đợt chiếu ({@link com.cinex.module.movie.entity.MovieRun}) có suất chiếu
     * active (SCHEDULED/ONGOING) chưa archived hay không.
     *
     * <p>Sẽ dùng ở commit sau khi viết MovieRunService — chặn xóa run đang còn vé bán.
     */
    boolean existsByMovieRunIdAndStatusInAndStorageStateNot(
            Long movieRunId, List<ShowtimeStatus> statuses, StorageState storageState);

    /**
     * Kiểm tra phòng có suất chiếu trùng giờ không.
     * Trùng giờ = khoảng [startTime, slotEndTime] (đã gồm buffer dọn dẹp) giao nhau.
     *
     * Tham số `slotEndTime` là slot kết thúc của suất MỚI (đã + buffer).
     * So sánh với `s.slotEndTime` của suất cũ để đảm bảo:
     *  - Phòng phải free đến hết slot dọn dẹp của suất cũ trước khi mở suất mới.
     *  - Suất mới phải kết thúc (gồm buffer) trước khi suất khác bắt đầu.
     *
     * Ví dụ buffer=15p, suất mới 14:00-16:30 (phim 16:15 + buffer 15p):
     * - Suất cũ 13:00-15:00 (slot kết thúc 15:00) → TRÙNG (15:00 > 14:00 AND 13:00 < 16:30)
     * - Suất cũ 16:00-18:00 (slot kết thúc 18:00) → TRÙNG (16:00 < 16:30)
     * - Suất cũ 17:00-19:00 → KHÔNG trùng (bắt đầu sau 16:30)
     *
     * Công thức overlap: [A, B] giao [C, D] khi A < D AND C < B
     */
    @Query("SELECT s FROM Showtime s WHERE s.room.id = :roomId " +
            "AND s.startTime < :slotEndTime AND s.slotEndTime > :startTime " +
            "AND (s.storageState IS NULL OR s.storageState <> 'ARCHIVED') " +
            "AND s.status <> 'CANCELLED'")
    List<Showtime> findConflictingShowtimes(Long roomId, LocalDateTime startTime, LocalDateTime slotEndTime);

    /**
     * [Pessimistic Lock] Lock showtime row để serialize các thread cùng đặt vé
     * cho cùng 1 suất chiếu. Nhờ vậy 2 user click "Hold" cùng lúc sẽ phải nối đuôi,
     * thread sau chỉ chạy khi thread trước đã commit → hạn chế race condition
     * giữa "check ghế trống" và "INSERT booking_seats".
     *
     * KHÔNG đặt @Lock trên findById() vì sẽ ảnh hưởng tất cả nơi gọi findById
     * (gây deadlock / giảm throughput cho các flow chỉ đọc).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM Showtime s WHERE s.id = :id")
    Optional<Showtime> findByIdForUpdate(@Param("id") Long id);

    /**
     * Tìm các suất SCHEDULED đã đến giờ chiếu nhưng chưa kết thúc → cần đổi sang ONGOING.
     * Điều kiện: startTime <= now < endTime.
     * Chỉ lấy showtime chưa ARCHIVED để tránh xử lý dữ liệu đã xóa mềm.
     */
    @Query("SELECT s FROM Showtime s WHERE s.status = :status " +
            "AND s.startTime <= :now AND s.endTime > :now " +
            "AND (s.storageState IS NULL OR s.storageState <> 'ARCHIVED')")
    List<Showtime> findOngoingCandidates(@Param("status") ShowtimeStatus status,
                                         @Param("now") LocalDateTime now);

    /**
     * Tìm các suất ONGOING đã qua endTime → cần đổi sang FINISHED.
     * Chỉ lấy showtime chưa ARCHIVED.
     */
    @Query("SELECT s FROM Showtime s WHERE s.status = :status " +
            "AND s.endTime <= :now " +
            "AND (s.storageState IS NULL OR s.storageState <> 'ARCHIVED')")
    List<Showtime> findFinishedCandidates(@Param("status") ShowtimeStatus status,
                                          @Param("now") LocalDateTime now);
}
