package com.cinex.module.statistics.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.math.BigDecimal;

/**
 * Doanh thu phân theo loại phòng (2D/3D/IMAX/4DX) — validate pricing strategy.
 *
 * <p>Câu hỏi nghiệp vụ: IMAX bán đắt gấp 2× phòng 2D — có thực thu được nhiều
 * tiền hơn không, hay phòng 2D doanh thu tổng cao hơn vì lấp đầy hơn? Insight
 * để: (1) quyết phân bổ phim IMAX cho rạp nào, (2) đầu tư thêm phòng IMAX hay
 * tăng số phòng 2D.
 *
 * <p>Formula: dùng proportional allocation match findTopMovies (sau fix
 * commit 249fd91) — {@code SUM(bs.price * b.totalAmount / b.seatTotalAmount)}
 * GROUP BY {@code room.type}. Tổng các row = doanh thu vé toàn dashboard.
 */
@Getter
@AllArgsConstructor
public class RevenueByRoomTypeStatistics {

    /** Loại phòng: TWO_D / THREE_D / IMAX / FOUR_DX. FE map ROOM_TYPE_LABELS. */
    private String roomType;

    /** Số vé bán được trong khoảng cho loại phòng này. */
    private long ticketCount;

    /** Doanh thu thực thu (sau giảm + sau VAT, proportional allocation). */
    private BigDecimal revenue;

    /** % doanh thu loại phòng này / tổng tất cả loại. 0.0 nếu tổng = 0. */
    private double percent;
}
