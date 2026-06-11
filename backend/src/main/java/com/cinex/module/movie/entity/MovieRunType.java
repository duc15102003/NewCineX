package com.cinex.module.movie.entity;

/**
 * Loại đợt chiếu của 1 phim.
 *
 * <p>Trong thực tế (CGV, Lotte), 1 phim có thể được chiếu nhiều đợt:
 * <ul>
 *   <li>{@link #FIRST_RUN} — chiếu lần đầu (mặc định cho phim mới ra mắt)</li>
 *   <li>{@link #REISSUE} — chiếu lại bản remaster, special edition (vd: Avatar 4K, Titanic 25th anniversary)</li>
 *   <li>{@link #FESTIVAL} — chiếu trong khuôn khổ liên hoan phim / sự kiện đặc biệt</li>
 *   <li>{@link #SPECIAL} — chiếu đặc biệt: sneak peek, preview, charity, midnight ...</li>
 * </ul>
 */
public enum MovieRunType {
    FIRST_RUN,
    REISSUE,
    FESTIVAL,
    SPECIAL
}
