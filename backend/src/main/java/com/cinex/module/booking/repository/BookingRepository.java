package com.cinex.module.booking.repository;

import com.cinex.common.entity.StorageState;
import com.cinex.module.booking.entity.Booking;
import com.cinex.module.booking.entity.BookingStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.lang.Nullable;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface BookingRepository extends JpaRepository<Booking, Long>, JpaSpecificationExecutor<Booking> {

    /**
     * Override findAll(spec, pageable) với {@link EntityGraph} fetch showtime + movie + room + user
     * cùng 1 query.
     *
     * <p><b>Vì sao:</b> {@code toBookingListResponse} access {@code booking.showtime.movie.title},
     * {@code booking.showtime.room.name}, ... đều là LAZY {@code @ManyToOne}. Với list 20 booking,
     * mỗi lần map gọi 3-4 proxy → trigger 60-80 SELECT (N+1 chained). EntityGraph load tất cả
     * trong 1 LEFT JOIN.
     *
     * <p><b>Lưu ý:</b> đây là override interface method JpaSpecificationExecutor — Spring Data
     * tự áp @EntityGraph khi proxy method này được gọi. Các call findAll khác (không có spec)
     * không bị ảnh hưởng.
     */
    @Override
    @EntityGraph(attributePaths = {"showtime", "showtime.movie", "showtime.room", "user", "theater"})
    Page<Booking> findAll(@Nullable Specification<Booking> spec, Pageable pageable);

    Optional<Booking> findByBookingCode(String bookingCode);

    // Tìm booking theo qr_token (random 32 ký tự) — dùng cho check-in qua QR scan
    Optional<Booking> findByQrToken(String qrToken);

    // Tìm booking HOLDING đã hết hạn (tạo trước X phút) → dùng cho cleanup scheduler.
    // Loại trừ ARCHIVED — admin có thể xoá mềm booking, không scheduler đụng vào nữa
    // (soft-delete consistency).
    List<Booking> findByStatusAndCreatedAtBeforeAndStorageStateNot(
            BookingStatus status, LocalDateTime before, StorageState excludeState);

    // Tìm booking CONFIRMED đã qua giờ chiếu kết thúc → dùng cho NoShowScheduler
    // Suất chiếu kết thúc trước now - buffer (vd 30 phút) và user chưa CHECKED_IN → đánh NO_SHOW
    List<Booking> findByStatusAndShowtime_EndTimeBefore(BookingStatus status, LocalDateTime endTimeBefore);

    // Đếm booking active (HOLDING/CONFIRMED) theo showtimeId → dùng để chặn sửa suất chiếu có vé
    long countByShowtimeIdAndStatusIn(Long showtimeId, List<BookingStatus> statuses);

    // Kiểm tra user đã từng CHECKED_IN cho phim này chưa → dùng cho Review (chống review giả)
    boolean existsByUserIdAndShowtime_Movie_IdAndStatus(Long userId, Long movieId, BookingStatus status);

    // Kiểm tra phòng có booking active (HOLDING/CONFIRMED) nào không → chặn tạo lại seat map khi đang có vé
    boolean existsByShowtime_Room_IdAndStatusIn(Long roomId, List<BookingStatus> statuses);

    // Đếm số booking HOLDING của 1 user trên 1 showtime → chặn user hold nhiều booking cùng suất
    long countByUserIdAndShowtimeIdAndStatus(Long userId, Long showtimeId, BookingStatus status);

    // Đếm số booking 1 user đã tạo từ một mốc thời gian → chống bot DoS (max booking/day)
    long countByUserIdAndCreatedAtAfter(Long userId, LocalDateTime after);
}
