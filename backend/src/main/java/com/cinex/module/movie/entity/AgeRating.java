package com.cinex.module.movie.entity;

/**
 * Phân loại độ tuổi phim — theo chuẩn Cục Điện ảnh VN (TT 25/2024/BVHTTDL)
 * + chuẩn quốc tế (MPAA) cho phim ngoại.
 *
 * <p><b>Mức rating VN (TT 25/2024):</b>
 * <ul>
 *   <li>P — Phổ biến (mọi đối tượng, kể cả trẻ em)</li>
 *   <li>K — Phù hợp dưới 13 tuổi (có người lớn xem cùng)</li>
 *   <li>T13 — Từ 13 tuổi trở lên</li>
 *   <li>T16 — Từ 16 tuổi trở lên</li>
 *   <li>T18 — Từ 18 tuổi trở lên</li>
 * </ul>
 *
 * <p><b>Vì sao KHÔNG có mức C?</b> Theo TT 25/2024, C = "Cấm phổ biến" — phim BỊ
 * CẤM phát hành công khai (không chiếu rạp, không streaming). Đây là gating quyết
 * định phim có ra rạp hay không, KHÔNG phải gating tuổi khán giả. Booking system
 * chuẩn industry (Vista FilmAtSite / Veezi) không bao gồm mức này — phim C
 * đáng lẽ không bao giờ xuất hiện trong catalog rạp.
 */
public enum AgeRating {
    /** Phổ biến — mọi đối tượng. */
    P,
    /** Dưới 13 tuổi xem cùng người lớn. */
    K,
    /** Từ 13 tuổi. */
    T13,
    /** Từ 16 tuổi. */
    T16,
    /** Từ 18 tuổi. */
    T18
}
