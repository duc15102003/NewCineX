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
    private String name;
    private RoomType type;
    private Integer totalSeats;
    private RoomStatus status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
