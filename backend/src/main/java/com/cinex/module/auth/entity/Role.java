package com.cinex.module.auth.entity;

/**
 * Vai trò user — phân quyền RBAC. Đồng bộ với hierarchy nhân sự rạp thực tế
 * (CGV/Lotte/BHD).
 *
 * <p><b>Hierarchy (mức cao → thấp):</b>
 * <ul>
 *   <li>{@link #SUPER_ADMIN} — quản trị trung ương (HQ). Tạo chi nhánh mới,
 *       manage role của admin khác, system config, cross-branch analytics.</li>
 *   <li>{@link #ADMIN} — quản lý chi nhánh cụ thể (manager). Sửa rooms,
 *       showtimes, snacks, combos. Approve refund, xem báo cáo doanh thu CN.</li>
 *   <li>{@link #STAFF} — nhân viên quầy (cashier/usher). Chỉ thao tác
 *       operational: POS bán vé, POS bán đồ ăn, check-in/quét QR. KHÔNG
 *       sửa config (rooms, showtimes, pricing rules), không xem báo cáo lớn,
 *       không refund. Scope theo theater giống ADMIN.</li>
 *   <li>{@link #USER} — khách hàng. Book vé, xem lịch sử của bản thân.</li>
 * </ul>
 *
 * <p><b>Industry rationale:</b> Trước CineX chỉ có ADMIN làm POS counter-sale —
 * không thực tế (manager không bán hàng). CGV/Lotte/BHD đều có ranking:
 * SuperUser → Branch Manager → Counter Staff (Cashier) → Ushers. Phân chia
 * trách nhiệm rõ + giảm risk (cashier không config được system, manager không
 * mất thời gian POS).
 *
 * <p><b>Theater scope:</b> ADMIN + STAFF cả 2 bị scope theater_id qua JWT
 * claim. Server-side filter ép buộc. STAFF Hà Nội không thấy data TPHCM.
 */
public enum Role {
    USER,
    /** Nhân viên quầy — POS bán vé/đồ ăn + check-in. Scope theo theater. */
    STAFF,
    /** Quản lý chi nhánh — scope theo {@code users.theater_id}. */
    ADMIN,
    /** Quản trị tổng — xem mọi chi nhánh, tạo chi nhánh mới. */
    SUPER_ADMIN
}
