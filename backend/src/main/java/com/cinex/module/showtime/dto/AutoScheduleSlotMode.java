package com.cinex.module.showtime.dto;

/**
 * Mode tạo slot khi auto-schedule — chuẩn Vista/Veezi/Cinetixx.
 *
 * <ul>
 *   <li>{@link #WINDOW} — auto-fill liên tiếp trong khung [startHour, endHour]
 *       bằng slot = movie.duration + buffer. Dùng cho phim mới đẩy hết suất khả thi.</li>
 *   <li>{@link #TEMPLATES} — chỉ tạo suất vào các giờ cố định do admin nhập
 *       (vd 10:00, 13:00, 16:00, 19:00, 22:00). Dùng khi rạp muốn "giờ vàng"
 *       đồng nhất qua các ngày. Phổ biến hơn trong CGV/Lotte/BHD.</li>
 * </ul>
 */
public enum AutoScheduleSlotMode {
    WINDOW,
    TEMPLATES
}
