package com.cinex.module.showtime.entity;

public enum ShowtimeStatus {
    DRAFT,        // Nháp — chưa public cho user, admin có thể review/sửa trước khi đẩy SCHEDULED
    SCHEDULED,    // Đã lên lịch, chưa chiếu — public
    ONGOING,      // Đang chiếu
    FINISHED,     // Đã chiếu xong
    CANCELLED     // Đã hủy
}
