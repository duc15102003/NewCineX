package com.cinex.module.room.dto;

import com.cinex.module.room.entity.RoomStatus;
import com.cinex.module.room.entity.RoomType;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class RoomResponse {

    private Long id;
    private String storageState;

    /** Sau F1: phòng thuộc chi nhánh nào. FE dùng để hiển thị nhãn "Chi nhánh — Phòng". */
    private Long theaterId;
    private String theaterName;
    private String theaterCity;

    private String name;
    private RoomType type;
    private Integer totalSeats;
    private RoomStatus status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
