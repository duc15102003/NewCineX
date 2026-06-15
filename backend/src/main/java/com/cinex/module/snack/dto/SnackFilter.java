package com.cinex.module.snack.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * Filter DTO cho list snack — admin và public dùng chung.
 *
 * Public dùng: keyword, category, price range, available=true (mặc định).
 * Admin dùng: thêm includeDeleted, available=false (xem snack tắt).
 */
@Getter
@Setter
public class SnackFilter {

    // Lọc theo chi nhánh — SUPER_ADMIN switch CN qua selector; BRANCH_ADMIN auto-override server-side
    private Long theaterId;

    // LIKE trên name OR description (case-insensitive)
    private String keyword;

    // Lọc theo nhóm: POPCORN/DRINK/COMBO/...
    private String category;

    // true = chỉ snack đang bán, false = chỉ snack đã tắt, null = cả 2
    private Boolean available;

    // Lọc giá trong khoảng [min, max] (truyền 1 trong 2 cũng OK)
    private BigDecimal minPrice;
    private BigDecimal maxPrice;

    // Admin: true = lấy cả snack đã xóa mềm
    private Boolean includeDeleted;
}
