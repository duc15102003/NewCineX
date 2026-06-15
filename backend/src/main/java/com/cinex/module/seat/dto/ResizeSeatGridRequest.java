package com.cinex.module.seat.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * Resize lưới ghế (rows × cols) — preserve các ghế hiện có.
 *
 * <p>Khác với {@code SeatGenerateRequest}: KHÔNG soft-delete toàn bộ rồi tạo
 * lại. Logic:
 * <ul>
 *   <li>newRows &gt; current → add các row mới ở dưới (label tiếp theo)
 *   <li>newRows &lt; current → soft-delete các row cuối (block nếu có booking)
 *   <li>newCols &gt; current → insert thêm seat ở mỗi row, col phía sau
 *   <li>newCols &lt; current → soft-delete các col cuối
 * </ul>
 *
 * <p>Tất cả ghế mới mặc định STANDARD/AVAILABLE — admin dùng editor sau để
 * đổi loại.
 */
@Data
public class ResizeSeatGridRequest {

    @NotNull(message = "rows là bắt buộc")
    @Min(value = 1, message = "rows tối thiểu 1")
    @Max(value = 26, message = "rows tối đa 26 (A-Z)")
    private Integer rows;

    @NotNull(message = "cols là bắt buộc")
    @Min(value = 1, message = "cols tối thiểu 1")
    @Max(value = 40, message = "cols tối đa 40")
    private Integer cols;
}
