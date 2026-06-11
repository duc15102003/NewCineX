package com.cinex.module.theater.entity;

/**
 * Trạng thái hoạt động của 1 chi nhánh rạp.
 *
 * <p>Theo chuẩn rạp lớn (CGV/Lotte): khi đóng tạm thời (sửa chữa, tổ chức event riêng)
 * chuyển sang {@code MAINTENANCE} — không cho user book. {@code CLOSED} = đã dừng vĩnh viễn.
 */
public enum TheaterStatus {
    ACTIVE,
    MAINTENANCE,
    CLOSED
}
