package com.cinex.module.seat.dto;

import com.cinex.module.seat.entity.SeatStatus;
import com.cinex.module.seat.entity.SeatType;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class SeatResponse {

    private Long id;
    private String storageState;
    private String rowLabel;
    private Integer colNumber;
    private String seatNumber;
    private SeatType seatType;
    private SeatStatus status;

    /**
     * Lối đi (không phải ghế thật). KHÔNG cho book.
     * Field tên {@code aisle} để JSON serialize thành {@code "aisle"} —
     * đồng bộ với Lombok getter {@code isAisle()} + Jackson convention.
     */
    private boolean aisle;
}
