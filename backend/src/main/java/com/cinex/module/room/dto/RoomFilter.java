package com.cinex.module.room.dto;

import com.cinex.module.room.entity.RoomStatus;
import com.cinex.module.room.entity.RoomType;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RoomFilter {

    private String keyword;       // Tìm theo tên phòng
    /** Lọc theo chi nhánh (sau F1). */
    private Long theaterId;
    private RoomType type;        // Lọc theo loại (IMAX, 3D, ...)
    private RoomStatus status;    // Lọc theo trạng thái (ACTIVE, MAINTENANCE)
    private Boolean includeDeleted;

    // ==== Mở rộng filter (J4) ====

    /** totalSeats >= minSeats — lọc phòng có sức chứa tối thiểu. */
    private Integer minSeats;

    /** totalSeats <= maxSeats — lọc phòng có sức chứa tối đa. */
    private Integer maxSeats;
}
