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

    // Soft delete tất cả ghế của phòng (thay vì hard delete)
    @Modifying
    @Query("UPDATE Seat s SET s.storageState = com.cinex.common.entity.StorageState.ARCHIVED WHERE s.room.id = :roomId AND s.storageState <> com.cinex.common.entity.StorageState.ARCHIVED")
    void softDeleteByRoomId(Long roomId);
}
