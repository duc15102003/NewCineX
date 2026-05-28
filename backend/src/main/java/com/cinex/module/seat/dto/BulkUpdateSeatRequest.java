package com.cinex.module.seat.dto;

import com.cinex.module.seat.entity.SeatStatus;
import com.cinex.module.seat.entity.SeatType;
import jakarta.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class BulkUpdateSeatRequest {

    @NotEmpty(message = "Vui lòng chọn ghế")
    private List<Long> seatIds;

    // Một trong hai phải có: seatType (đổi loại ghế) hoặc status (đổi trạng thái)
    private SeatType seatType;
    private SeatStatus status;
}
