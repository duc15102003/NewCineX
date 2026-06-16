package com.cinex.module.showtime.entity;

/**
 * Định dạng chiếu của suất — chuẩn industry CGV/Lotte/BHD.
 *
 * <p>Lưu ở showtime (KHÔNG ở room) vì 1 phòng có thể chiếu nhiều format trong tuần
 * (sáng 2D phim Việt, tối IMAX phim Hollywood). Room.type chỉ quyết khả năng vật
 * lý (phòng IMAX-equipped), còn format mỗi suất là quyết định nội dung.
 *
 * <ul>
 *   <li>{@link #TWO_D} — 2D phẳng, default cho phim thường</li>
 *   <li>{@link #THREE_D} — 3D kính phân cực</li>
 *   <li>{@link #IMAX} — IMAX 2D màn lớn (chỉ phòng IMAX-equipped)</li>
 *   <li>{@link #IMAX_3D} — IMAX 3D (yêu cầu phòng IMAX + phim hỗ trợ 3D)</li>
 *   <li>{@link #FOUR_DX} — 4DX ghế chuyển động + hiệu ứng (rạp CGV)</li>
 *   <li>{@link #SCREEN_X} — Screen X 270 độ (rạp CGV)</li>
 * </ul>
 */
public enum ShowtimeFormat {
    TWO_D,
    THREE_D,
    IMAX,
    IMAX_3D,
    FOUR_DX,
    SCREEN_X
}
