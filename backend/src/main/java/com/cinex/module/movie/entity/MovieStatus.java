package com.cinex.module.movie.entity;

/**
 * [Enum Pattern] Trạng thái phim — type-safe, compile-time check.
 *
 * Tại sao dùng Enum thay vì String?
 * - String: status = "comming_soon" (sai chính tả) → compile OK → lỗi runtime
 * - Enum: status = MovieStatus.COMMING_SOON → compile ERROR ngay → phát hiện lỗi sớm
 *
 * Lưu DB: @Enumerated(EnumType.STRING) → lưu "COMING_SOON" (text), không lưu số thứ tự
 * Tại sao STRING mà không ORDINAL?
 * → ORDINAL lưu số (0, 1, 2). Nếu thêm enum ở giữa → số bị lệch → dữ liệu sai
 */
public enum MovieStatus {
    COMING_SOON,   // Sắp chiếu
    NOW_SHOWING,   // Đang chiếu
    ENDED          // Đã kết thúc
}
