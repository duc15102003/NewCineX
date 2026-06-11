package com.cinex.module.auth.entity;

/**
 * Vai trò user — phân quyền RBAC.
 *
 * <p><b>Hierarchy (mức cao → thấp):</b>
 * <ul>
 *   <li>{@link #SUPER_ADMIN} — quản trị trung ương, xem mọi chi nhánh (theater_id = null).
 *       Tạo chi nhánh mới, manage role của admin khác, cross-branch analytics.</li>
 *   <li>{@link #ADMIN} — quản lý chi nhánh cụ thể (theater_id != null). Chỉ thấy/sửa
 *       data của chi nhánh được assign (rooms, showtimes, bookings, payments).</li>
 *   <li>{@link #USER} — khách hàng. Book vé, xem lịch sử của bản thân.</li>
 * </ul>
 *
 * <p><b>Pattern theo industry (CGV/Lotte HQ vs Branch staff):</b> ADMIN bị "khóa"
 * theo theater_id qua JWT claim. Server-side filter ép buộc — admin HN không thể
 * thấy data TPHCM dù manipulate client state.
 */
public enum Role {
    USER,
    /** Quản lý chi nhánh — scope theo {@code users.theater_id}. */
    ADMIN,
    /** Quản trị tổng — xem mọi chi nhánh, tạo chi nhánh mới. */
    SUPER_ADMIN
}
