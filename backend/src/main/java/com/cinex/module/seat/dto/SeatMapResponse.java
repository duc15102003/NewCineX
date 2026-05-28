package com.cinex.module.seat.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;
import java.util.Map;

/**
 * Sơ đồ ghế nhóm theo hàng — FE dùng để render grid.
 *
 * Cấu trúc:
 * {
 *   "roomId": 1,
 *   "roomName": "Room 1",
 *   "totalSeats": 120,
 *   "seatMap": {
 *     "A": [ {id:1, colNumber:1, seatNumber:"A1", seatType:"STANDARD"}, ... ],
 *     "B": [ ... ],
 *     "E": [ {seatType:"VIP"}, ... ],
 *     "J": [ {seatType:"COUPLE"}, ... ]
 *   }
 * }
 */
@Getter
@Builder
public class SeatMapResponse {

    private Long roomId;
    private String roomName;
    private int totalSeats;
    private Map<String, List<SeatResponse>> seatMap;
}
