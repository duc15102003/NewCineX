package com.cinex.module.showtime.repository;

import com.cinex.module.showtime.entity.Showtime;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDateTime;
import java.util.List;

public interface ShowtimeRepository extends JpaRepository<Showtime, Long>, JpaSpecificationExecutor<Showtime> {

    /**
     * Kiểm tra phòng có suất chiếu trùng giờ không.
     * Trùng giờ = khoảng thời gian [startTime, endTime] giao nhau.
     *
     * Ví dụ: Suất mới 14:00-16:30
     * - Suất cũ 10:00-12:30 → KHÔNG trùng (kết thúc trước 14:00)
     * - Suất cũ 13:00-15:00 → TRÙNG (15:00 > 14:00 AND 13:00 < 16:30)
     * - Suất cũ 16:00-18:00 → TRÙNG (16:00 < 16:30)
     * - Suất cũ 17:00-19:00 → KHÔNG trùng (bắt đầu sau 16:30)
     *
     * Công thức: 2 khoảng [A, B] và [C, D] giao nhau khi A < D AND C < B
     */
    @Query("SELECT s FROM Showtime s WHERE s.room.id = :roomId " +
            "AND s.startTime < :endTime AND s.endTime > :startTime " +
            "AND (s.storageState IS NULL OR s.storageState <> 'DELETED') " +
            "AND s.status <> 'CANCELLED'")
    List<Showtime> findConflictingShowtimes(Long roomId, LocalDateTime startTime, LocalDateTime endTime);
}
