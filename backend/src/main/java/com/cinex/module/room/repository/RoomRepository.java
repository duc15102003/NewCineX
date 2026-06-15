package com.cinex.module.room.repository;

import com.cinex.common.entity.StorageState;
import com.cinex.module.room.entity.Room;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface RoomRepository extends JpaRepository<Room, Long>, JpaSpecificationExecutor<Room> {

    /**
     * Check unique tên phòng TRONG CÙNG chi nhánh.
     *
     * <p>Sau F1, scope unique chuyển từ global → per-theater (nhiều chi nhánh có thể
     * cùng đặt "Phòng 1"). Validation tên dùng method này thay cho existsByName cũ.
     */
    boolean existsByNameAndTheaterId(String name, Long theaterId);

    /** Case-insensitive — "Phòng 1" và "phòng 1" coi như duplicate. */
    boolean existsByNameIgnoreCaseAndTheaterId(String name, Long theaterId);

    /** Cùng method nhưng loại trừ 1 room (dùng khi update tên — tránh tự conflict). */
    boolean existsByNameAndTheaterIdAndIdNot(String name, Long theaterId, Long excludeId);

    /** Case-insensitive + loại trừ id chính nó. */
    boolean existsByNameIgnoreCaseAndTheaterIdAndIdNot(String name, Long theaterId, Long excludeId);

    /** Đếm room không-ARCHIVED của 1 theater — phục vụ chặn xoá theater khi còn room. */
    long countByTheaterIdAndStorageStateNot(Long theaterId, StorageState excludeState);
}
