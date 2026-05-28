package com.cinex.module.booking.repository;

import com.cinex.module.booking.entity.BookingSeat;
import com.cinex.module.booking.entity.BookingSeatStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface BookingSeatRepository extends JpaRepository<BookingSeat, Long> {

    /**
     * Tìm ghế đã đặt/đang giữ cho 1 suất chiếu.
     * Dùng để kiểm tra ghế trống trước khi hold.
     */
    @Query("SELECT bs FROM BookingSeat bs WHERE bs.booking.showtime.id = :showtimeId " +
            "AND bs.seat.id IN :seatIds " +
            "AND bs.status IN ('HELD', 'BOOKED')")
    List<BookingSeat> findHeldOrBookedSeats(Long showtimeId, List<Long> seatIds);

    /**
     * Lấy tất cả ghế đang HELD hoặc BOOKED cho 1 suất chiếu.
     * Dùng cho sơ đồ ghế (biết ghế nào trống/đã đặt/đang giữ).
     */
    @Query("SELECT bs FROM BookingSeat bs WHERE bs.booking.showtime.id = :showtimeId " +
            "AND bs.status IN ('HELD', 'BOOKED')")
    List<BookingSeat> findAllOccupiedByShowtimeId(Long showtimeId);
}
