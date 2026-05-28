package com.cinex.module.booking.repository;

import com.cinex.module.booking.entity.Booking;
import com.cinex.module.booking.entity.BookingStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface BookingRepository extends JpaRepository<Booking, Long>, JpaSpecificationExecutor<Booking> {

    Optional<Booking> findByBookingCode(String bookingCode);

    // Tìm booking HOLDING đã hết hạn (tạo trước X phút) → dùng cho cleanup scheduler
    List<Booking> findByStatusAndCreatedAtBefore(BookingStatus status, LocalDateTime before);

    // Đếm booking active (HOLDING/CONFIRMED) theo showtimeId → dùng để chặn sửa suất chiếu có vé
    long countByShowtimeIdAndStatusIn(Long showtimeId, List<BookingStatus> statuses);
}
