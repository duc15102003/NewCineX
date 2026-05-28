package com.cinex.module.seat.dto;

import com.cinex.module.seat.entity.SeatStatus;
import com.cinex.module.seat.entity.SeatType;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateSeatRequest {

    private SeatType seatType;
    private SeatStatus status;
}
