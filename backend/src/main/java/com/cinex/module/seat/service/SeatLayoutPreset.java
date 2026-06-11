package com.cinex.module.seat.service;

import com.cinex.module.room.entity.RoomType;
import com.cinex.module.seat.dto.SeatGenerateRequest;

import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Preset layout chuẩn industry theo RoomType.
 *
 * <p>Pattern tham khảo:
 * <ul>
 *   <li>TWO_D    — 10×12, VIP zone giữa 5 hàng × 6 cột, couple hàng cuối,
 *                  2 handicap đầu hàng B, 2 aisle cols, 0 deluxe.</li>
 *   <li>THREE_D  — 10×12 như TWO_D nhưng VIP zone rộng hơn (kính 3D đắt).</li>
 *   <li>IMAX     — 14×18, nhiều VIP + DELUXE giữa, 0 couple, 2 handicap, 3 aisle.</li>
 *   <li>FOUR_DX  — 8×10, KHÔNG có couple/sweetbox (ghế đặc biệt rung/gió),
 *                  toàn VIP/STANDARD + 2 handicap.</li>
 * </ul>
 *
 * <p>Mỗi preset trả về SeatGenerateRequest đầy đủ — admin có thể tinh chỉnh
 * trước khi submit. Mục đích: 80% case dùng preset OK; 20% custom.
 */
public final class SeatLayoutPreset {

    private SeatLayoutPreset() {}

    public static SeatGenerateRequest forRoomType(RoomType type) {
        return switch (type) {
            case TWO_D -> twoDPreset();
            case THREE_D -> threeDPreset();
            case IMAX -> imaxPreset();
            case FOUR_DX -> fourDxPreset();
        };
    }

    /** TWO_D: 10×12 = 120 ghế tổng (− aisle − blocked) ≈ 100 thực bán. */
    private static SeatGenerateRequest twoDPreset() {
        SeatGenerateRequest r = new SeatGenerateRequest();
        r.setTotalRows(10);
        r.setTotalCols(12);

        SeatGenerateRequest.ZoneRange vip = new SeatGenerateRequest.ZoneRange();
        vip.setRowStart("C"); vip.setRowEnd("G");
        vip.setColStart(4); vip.setColEnd(9);
        r.setVipZone(vip);

        r.setCoupleRows(Set.of("J"));
        r.setHandicapPositions(set(pos("B", 1), pos("B", 12)));
        r.setAisleCols(set(4, 9));
        return r;
    }

    /** THREE_D: tương tự TWO_D nhưng VIP zone rộng hơn. */
    private static SeatGenerateRequest threeDPreset() {
        SeatGenerateRequest r = twoDPreset();
        SeatGenerateRequest.ZoneRange vip = new SeatGenerateRequest.ZoneRange();
        vip.setRowStart("C"); vip.setRowEnd("H");
        vip.setColStart(3); vip.setColEnd(10);
        r.setVipZone(vip);
        return r;
    }

    /** IMAX: 14×18, layout cong + DELUXE rows giữa, không couple. */
    private static SeatGenerateRequest imaxPreset() {
        SeatGenerateRequest r = new SeatGenerateRequest();
        r.setTotalRows(14);
        r.setTotalCols(18);

        SeatGenerateRequest.ZoneRange vip = new SeatGenerateRequest.ZoneRange();
        vip.setRowStart("D"); vip.setRowEnd("J");
        vip.setColStart(5); vip.setColEnd(14);
        r.setVipZone(vip);

        r.setDeluxeRows(Set.of("F", "G"));
        r.setHandicapPositions(set(pos("C", 1), pos("C", 18)));
        r.setAisleCols(set(5, 14));
        return r;
    }

    /** FOUR_DX: 8×10, KHÔNG có couple/sweetbox (ghế đặc biệt). */
    private static SeatGenerateRequest fourDxPreset() {
        SeatGenerateRequest r = new SeatGenerateRequest();
        r.setTotalRows(8);
        r.setTotalCols(10);

        SeatGenerateRequest.ZoneRange vip = new SeatGenerateRequest.ZoneRange();
        vip.setRowStart("C"); vip.setRowEnd("F");
        vip.setColStart(3); vip.setColEnd(8);
        r.setVipZone(vip);

        r.setHandicapPositions(set(pos("B", 1), pos("B", 10)));
        r.setAisleCols(set(5));
        return r;
    }

    private static SeatGenerateRequest.SeatPosition pos(String row, int col) {
        SeatGenerateRequest.SeatPosition p = new SeatGenerateRequest.SeatPosition();
        p.setRow(row); p.setCol(col);
        return p;
    }

    @SafeVarargs
    private static <T> Set<T> set(T... items) {
        return new LinkedHashSet<>(java.util.Arrays.asList(items));
    }
}
