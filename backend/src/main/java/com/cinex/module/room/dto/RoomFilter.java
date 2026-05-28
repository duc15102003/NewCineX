package com.cinex.module.room.dto;

import com.cinex.module.room.entity.RoomStatus;
import com.cinex.module.room.entity.RoomType;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RoomFilter {

    private String keyword;       // Tìm theo tên phòng
    private RoomType type;        // Lọc theo loại (IMAX, 3D, ...)
    private RoomStatus status;    // Lọc theo trạng thái (ACTIVE, MAINTENANCE)
    private Boolean includeDeleted;
}
