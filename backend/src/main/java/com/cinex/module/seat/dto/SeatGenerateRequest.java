package com.cinex.module.seat.dto;

import com.cinex.module.room.entity.RoomType;
import com.cinex.module.seat.entity.SeatStatus;
import com.cinex.module.seat.entity.SeatType;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.util.List;
import java.util.Set;

/**
 * Cấu hình sinh ghế chuẩn industry (CGV / Lotte / BHD pattern).
 *
 * <p>Khác phiên bản cũ (vipRows toàn row, coupleRow toàn row):
 * <ul>
 *   <li>VIP zone là HÌNH CHỮ NHẬT (rowStart..rowEnd × colStart..colEnd) — "sweet
 *       spot" giữa rạp, không phải toàn row</li>
 *   <li>Sweetbox là 1 row con (rowSweetbox + colStart..colEnd) — cao cấp hơn couple</li>
 *   <li>Deluxe rows: cả row recliner (cho phòng Premium / L'amour)</li>
 *   <li>Handicap positions: bắt buộc theo NĐ 28/2012, đặt đầu hàng gần lối vào</li>
 *   <li>Aisle cols: lối đi giữa block ghế (không phải seat)</li>
 *   <li>Blocked positions: cột bê tông / thiết bị / lối thoát hiểm</li>
 * </ul>
 *
 * <p>Nếu {@code applyPresetForRoomType=true}, BE tự suggest layout theo RoomType
 * (vd FOUR_DX skip COUPLE, IMAX nhiều DELUXE, TWO_D layout cơ bản).
 */
@Getter
@Setter
public class SeatGenerateRequest {

    @NotNull(message = "Số hàng là bắt buộc")
    @Min(value = 1, message = "Tối thiểu 1 hàng")
    @Max(value = 26, message = "Tối đa 26 hàng (A-Z)")
    private Integer totalRows;

    @NotNull(message = "Số cột là bắt buộc")
    @Min(value = 1, message = "Tối thiểu 1 cột")
    @Max(value = 30, message = "Tối đa 30 cột")
    private Integer totalCols;

    /** VIP zone — hình chữ nhật. NULL = không có VIP. */
    private ZoneRange vipZone;

    /** Sweetbox — 1 row con (thường hàng cuối). NULL = không có. */
    private RowRange sweetboxRow;

    /** Couple row(s) — thường hàng cuối. Nếu cũng sweetbox row → sweetbox win. */
    private Set<String> coupleRows;

    /** Deluxe rows — cho phòng Premium/L'amour (recliner). */
    private Set<String> deluxeRows;

    /** Handicap positions — BẮT BUỘC theo NĐ 28/2012. */
    private Set<SeatPosition> handicapPositions;

    /** Aisle columns — lối đi (không phải ghế). VD {4, 10} = 2 lối đi. */
    private Set<Integer> aisleCols;

    /** Blocked positions — cột bê tông / thiết bị. */
    private Set<SeatPosition> blockedPositions;

    /** Nếu true, BE override config với preset theo RoomType. */
    private Boolean applyPresetForRoomType;

    /** RoomType để chọn preset (override room.type nếu cần). */
    private RoomType roomTypeOverride;

    /**
     * Custom layout — list cell với type + status + aisle.
     * Khi non-null, BE bỏ qua vipZone/coupleRows/... và iterate trực tiếp matrix này.
     * Pattern dùng cho FE visual grid editor (drag-paint).
     */
    private List<CustomLayoutCell> customLayout;

    /** Hình chữ nhật zone — VIP. */
    @Getter
    @Setter
    public static class ZoneRange {
        private String rowStart;   // "C"
        private String rowEnd;     // "G"
        private Integer colStart;  // 4
        private Integer colEnd;    // 12
    }

    /** 1 row + range cột. */
    @Getter
    @Setter
    public static class RowRange {
        private String row;        // "J"
        private Integer colStart;  // 3
        private Integer colEnd;    // 10
    }

    /** Position (row, col). */
    @Getter
    @Setter
    public static class SeatPosition {
        private String row;
        private Integer col;
    }

    /**
     * Cell trong custom layout matrix — FE visual grid editor build từ grid state.
     *
     * <p>Mỗi cell tả 1 vị trí: row + col + loại ghế + status + aisle flag.
     * BE iterate list này trực tiếp, bỏ qua zone-based resolution.
     */
    @Getter
    @Setter
    public static class CustomLayoutCell {
        private String row;        // "A", "B", ...
        private Integer col;       // 1, 2, ...
        private SeatType seatType; // STANDARD / VIP / COUPLE / SWEETBOX / DELUXE / HANDICAP
        private SeatStatus status; // AVAILABLE / BROKEN / BLOCKED (default AVAILABLE)
        private Boolean aisle;     // true = lối đi (không phải ghế)
    }
}
