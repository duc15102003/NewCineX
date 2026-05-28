package com.cinex.module.room.dto;

import com.cinex.module.room.entity.RoomStatus;
import com.cinex.module.room.entity.RoomType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RoomRequest {

    @NotBlank(message = "Tên phòng là bắt buộc")
    @Size(max = 50, message = "Tên phòng tối đa 50 ký tự")
    private String name;

    @NotNull(message = "Loại phòng là bắt buộc")
    private RoomType type;

    @Min(value = 0, message = "Số ghế không được âm")
    private Integer totalSeats;

    private RoomStatus status;
}
