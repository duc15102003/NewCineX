package com.cinex.module.showtime.entity;

/**
 * Mode ngôn ngữ của suất chiếu — chuẩn rạp VN.
 *
 * <p>Lưu ở showtime (KHÔNG ở phim) vì cùng 1 phim ở các suất khác nhau có thể
 * trình chiếu khác mode (suất 10h sub VI cho người đi xem buổi sáng, suất 19h
 * dub VI cho gia đình). Đây là chính sách rạp, không phải metadata phim.
 *
 * <ul>
 *   <li>{@link #SUB_VI} — phụ đề Việt (default cho phim ngoại)</li>
 *   <li>{@link #DUB_VI} — lồng tiếng Việt (phim hoạt hình, gia đình)</li>
 *   <li>{@link #ORIGINAL} — giữ nguyên ngôn ngữ gốc, không sub (phim Việt hoặc niche)</li>
 * </ul>
 */
public enum ShowtimeLanguage {
    SUB_VI,
    DUB_VI,
    ORIGINAL
}
