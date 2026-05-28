package com.cinex.common.entity;

/**
 * Trạng thái lưu trữ — dùng cho soft delete toàn bộ dự án.
 *
 * ACTIVE: đang hoạt động (mặc định khi tạo mới)
 * ARCHIVED: đã xóa mềm (không hiện cho user, admin có thể khôi phục)
 */
public enum StorageState {
    ACTIVE,
    ARCHIVED
}
