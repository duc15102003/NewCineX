package com.cinex.module.booking.repository;

import com.cinex.common.entity.StorageState;
import com.cinex.module.booking.entity.Booking;
import com.cinex.module.booking.entity.BookingStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
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

    /**
     * Pessimistic lock booking — chống race condition handleCallback vs
     * cancelBooking song song. SQL Server tự sinh SELECT ... WITH (UPDLOCK).
     *
     * <p><b>Bug fix:</b> trước PaymentService.handleCallback check
     * booking.status == HOLDING ở line 186, set CONFIRMED ở line 195. Giữa
     * 2 dòng đó nếu thread khác (user cancel hoặc scheduler expire) đổi
     * status → inconsistent state (payment COMPLETED + booking REFUNDED,
     * hoặc payment REFUNDED + booking CONFIRMED). Lock row prevent.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT b FROM Booking b WHERE b.id = :id")
    Optional<Booking> findByIdForUpdate(@Param("id") Long id);

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

    // Tìm booking CONFIRMED có showtime trong window → dùng ShowtimeReminderScheduler
    // (gửi email reminder 1 giờ trước). Loại trừ showtime CANCELLED để không gửi nhầm.
    List<Booking> findByStatusAndShowtime_StartTimeBetweenAndShowtime_StatusNot(
            BookingStatus status, LocalDateTime start, LocalDateTime end,
            com.cinex.module.showtime.entity.ShowtimeStatus excludeStatus);

    // Tìm booking CHECKED_IN có showtime kết thúc trong window → dùng
    // PostShowtimeFeedbackScheduler gửi email mời đánh giá 24h sau showtime.
    List<Booking> findByStatusAndShowtime_EndTimeBetween(
            BookingStatus status, LocalDateTime start, LocalDateTime end);

    // Đếm booking active (HOLDING/CONFIRMED) theo showtimeId → dùng để chặn sửa suất chiếu có vé
    long countByShowtimeIdAndStatusIn(Long showtimeId, List<BookingStatus> statuses);

    // Kiểm tra user đã từng CHECKED_IN cho phim này chưa → dùng cho Review (chống review giả)
    boolean existsByUserIdAndShowtime_Movie_IdAndStatus(Long userId, Long movieId, BookingStatus status);

    // Kiểm tra phòng có booking active (HOLDING/CONFIRMED) nào không → chặn tạo lại seat map khi đang có vé
    boolean existsByShowtime_Room_IdAndStatusIn(Long roomId, List<BookingStatus> statuses);

    // Đếm booking active toàn chi nhánh — dùng để chặn archive Theater
    long countByShowtime_Room_Theater_IdAndStatusIn(Long theaterId, List<BookingStatus> statuses);

    // List booking để cascade cancel khi suất chiếu bị huỷ
    List<Booking> findByShowtimeIdAndStatusIn(Long showtimeId, List<BookingStatus> statuses);

    // Đếm số booking HOLDING của 1 user trên 1 showtime → chặn user hold nhiều booking cùng suất
    long countByUserIdAndShowtimeIdAndStatus(Long userId, Long showtimeId, BookingStatus status);

    // Đếm số booking 1 user đã tạo từ một mốc thời gian → chống bot DoS (max booking/day)
    long countByUserIdAndCreatedAtAfter(Long userId, LocalDateTime after);
}
