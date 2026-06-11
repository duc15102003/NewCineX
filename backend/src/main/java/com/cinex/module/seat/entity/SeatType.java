package com.cinex.module.seat.entity;

/**
 * Loại ghế — đồng bộ với chuẩn rạp chiếu phim VN (CGV / Lotte / BHD / Beta).
 *
 * <p>6 loại:
 * <ul>
 *   <li>STANDARD — Ghế thường mặc định</li>
 *   <li>VIP — Ghế giữa rạp "sweet spot" (zone, không phải toàn row)</li>
 *   <li>COUPLE — Ghế đôi thường, hàng cuối, 1 ghế chiếm 2 cột</li>
 *   <li>SWEETBOX — Ghế đôi cao cấp (nệm dày, bàn nhỏ), giá 2-3× COUPLE</li>
 *   <li>DELUXE — Ghế ngả lưng (recliner) cho phòng Premium / L'amour</li>
 *   <li>HANDICAP — Ghế cho người khuyết tật. BẮT BUỘC theo NĐ 28/2012 —
 *       rạp phải có chỗ ngồi cho người khuyết tật; đặt đầu hàng gần lối vào.</li>
 * </ul>
 */
public enum SeatType {
    STANDARD,
    VIP,
    COUPLE,
    SWEETBOX,
    DELUXE,
    HANDICAP
}
