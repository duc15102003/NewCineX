package com.cinex.module.seat.repository;

import com.cinex.common.entity.StorageState;
import com.cinex.module.seat.entity.Seat;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface SeatRepository extends JpaRepository<Seat, Long>, JpaSpecificationExecutor<Seat> {

    // Chỉ lấy ghế chưa xóa (ACTIVE), sắp xếp theo hàng + cột
    List<Seat> findByRoomIdAndStorageStateOrderByRowLabelAscColNumberAsc(Long roomId, StorageState storageState);

    // Soft delete tất cả ghế của phòng (thay vì hard delete). Caller truyền StorageState.ARCHIVED.
    @Modifying
    @Query("UPDATE Seat s SET s.storageState = :archived WHERE s.room.id = :roomId AND s.storageState <> :archived")
    void softDeleteByRoomId(Long roomId, StorageState archived);

    /**
     * Group ghế theo seatType + count — dùng để form Showtime biết phòng có
     * loại ghế nào → render input giá động.
     * Loại trừ ghế aisle (lối đi) vì không phải ghế thật, không có giá.
     * Caller truyền StorageState.ACTIVE để chỉ tính ghế còn active.
     * Trả Object[]: [SeatType, Long count].
     */
    @Query("""
            SELECT s.seatType, COUNT(s)
            FROM Seat s
            WHERE s.room.id = :roomId
              AND s.storageState = :state
              AND s.aisle = false
            GROUP BY s.seatType
            ORDER BY s.seatType
            """)
    List<Object[]> countSeatsByTypeInRoom(Long roomId, StorageState state);
}
