package com.cinex.module.seat.dto;

import com.cinex.module.seat.entity.SeatStatus;
import com.cinex.module.seat.entity.SeatType;
import lombok.Getter;
import lombok.Setter;

/**
 * Filter DTO cho seat list (admin xem chi tiết theo phòng).
 *
 * <p>{@code roomId} BẮT BUỘC khi query — ghế luôn thuộc 1 phòng, không cho list ghế cross-room
 * (tránh trả về hàng ngàn record vô nghĩa).
 */
@Getter
@Setter
public class SeatFilter {

    /** Bắt buộc khi query — ghế luôn thuộc 1 phòng. */
    private Long roomId;

    /** STANDARD / VIP / COUPLE. */
    private SeatType type;

    /** AVAILABLE / BROKEN (theo SeatStatus). */
    private SeatStatus status;

    /** "A", "B", ... — lọc theo hàng. */
    private String rowLabel;

    /** true = bao gồm seat ARCHIVED (đã xóa mềm). */
    private Boolean includeDeleted;
}
