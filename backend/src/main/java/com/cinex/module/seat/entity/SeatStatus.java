package com.cinex.module.seat.entity;

/**
 * Trạng thái ghế:
 * <ul>
 *   <li>AVAILABLE — có thể đặt</li>
 *   <li>BROKEN — hỏng tạm thời (có thể repair, BLOCK runtime)</li>
 *   <li>BLOCKED — block cố định (cột bê tông, thiết bị, lối thoát hiểm).
 *       Khác BROKEN ở chỗ KHÔNG repair được — vĩnh viễn không bán.</li>
 * </ul>
 */
public enum SeatStatus {
    AVAILABLE,
    BROKEN,
    BLOCKED
}
