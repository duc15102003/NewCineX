package com.cinex.module.movie.dto;

import com.cinex.module.movie.entity.MovieStatus;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
public class MovieFilter {

    private String keyword;
    private MovieStatus status;
    private Long genreId;
    /** Lọc theo chi nhánh — phim chỉ tính "đang chiếu" nếu có showtime tại chi nhánh này (F1). */
    private Long theaterId;
    private Boolean includeDeleted;

    // true = phim có ít nhất 1 suất chiếu từ bây giờ trở đi (tab "Đang chiếu")
    private Boolean showing;

    // ==== Mở rộng filter (J1) ====

    /** Tìm theo tên đạo diễn (LIKE %director%, case-insensitive). */
    private String director;

    /** Tìm theo diễn viên (LIKE %cast%, case-insensitive). */
    private String cast;

    /** Lọc theo ngôn ngữ (equals, VD: "Tiếng Việt", "English"). */
    private String language;

    /** Thời lượng tối thiểu (phút). VD: minDuration=90 → chỉ lấy phim ≥ 90 phút. */
    private Integer minDuration;

    /** Thời lượng tối đa (phút). */
    private Integer maxDuration;

    /**
     * Rating tối thiểu (0.0 - 10.0). Phim chưa có rating coi như 0
     * (COALESCE(rating, 0) >= minRating) — user lọc "phim ≥ 7 sao" sẽ KHÔNG lẫn phim chưa có review.
     */
    private BigDecimal minRating;

    /** Rating tối đa (0.0 - 10.0). Phim chưa có rating coi như 0. */
    private BigDecimal maxRating;

    /** Ngày phát hành từ (>=). */
    private LocalDate releaseDateFrom;

    /** Ngày phát hành đến (<=). */
    private LocalDate releaseDateTo;

    /** Alias của {@code showing} — đặt cho rõ nghĩa khi FE gọi (cả 2 đều OR-merge). */
    private Boolean hasActiveShowtimes;

    /**
     * Lọc phim đủ điều kiện TẠO SUẤT CHIẾU tại {@code theaterId} — chuẩn rạp CGV/Lotte/BHD.
     *
     * <p>Khác biệt với {@code theaterId} mặc định: filter mặc định ({@code hasShowtimesAtTheater})
     * yêu cầu phim đã có ≥1 showtime tại CN (dùng cho filter LIST showtime hiện có).
     * Còn {@code eligibleForShowtime} yêu cầu phim có MovieRun ACTIVE/UPCOMING tại CN,
     * KHÔNG đòi showtime sẵn có — đúng nghĩa "phim đang/sắp được phép xếp suất tại CN này".
     *
     * <p>Dùng cho: dropdown phim trong form tạo suất chiếu (đơn lẻ + hàng loạt).
     * Bắt buộc dùng kèm {@code theaterId} (nếu null sẽ bị bỏ qua).
     */
    private Boolean eligibleForShowtime;
}
