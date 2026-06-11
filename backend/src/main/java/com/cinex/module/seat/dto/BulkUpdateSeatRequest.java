package com.cinex.module.seat.dto;

import com.cinex.module.seat.entity.SeatStatus;
import com.cinex.module.seat.entity.SeatType;
import jakarta.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

/**
 * Admin bulk update ghế trong Seat Map Editor.
 *
 * <p>Phải truyền ÍT NHẤT 1 dimension:
 * <ul>
 *   <li>{@code seatType} — đổi loại ghế (STANDARD/VIP/COUPLE/SWEETBOX/DELUXE/HANDICAP)</li>
 *   <li>{@code status} — đổi trạng thái (AVAILABLE/BROKEN/BLOCKED)</li>
 *   <li>{@code isAisle} — đánh dấu là lối đi (true/false)</li>
 * </ul>
 *
 * <p>Có thể combine: vd seatType=STANDARD + isAisle=false (un-aisle + reset type).
 */
@Getter
@Setter
public class BulkUpdateSeatRequest {

    @NotEmpty(message = "Vui lòng chọn ghế")
    private List<Long> seatIds;

    private SeatType seatType;
    private SeatStatus status;
    /** Nullable — không gửi = không thay đổi. */
    private Boolean aisle;
}
