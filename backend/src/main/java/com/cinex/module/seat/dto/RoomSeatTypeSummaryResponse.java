package com.cinex.module.seat.dto;

import com.cinex.module.seat.entity.SeatType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/**
 * Tóm tắt loại ghế có trong 1 phòng — dùng cho form tạo/sửa Showtime để
 * render ô nhập giá ĐỘNG (chỉ hiện input cho loại ghế phòng có thật).
 *
 * <p>Chuẩn industry (CGV/Lotte): admin chọn phòng → biết phòng có VIP / COUPLE /
 * SWEETBOX / DELUXE hay không → KHÔNG bắt nhập giá cho loại ghế phòng không có.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RoomSeatTypeSummaryResponse {

    private Long roomId;
    private String roomName;

    /** Danh sách loại ghế có trong phòng + số lượng mỗi loại. */
    private List<SeatTypeCount> seatTypes;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SeatTypeCount {
        private SeatType seatType;
        private long count;
    }
}
