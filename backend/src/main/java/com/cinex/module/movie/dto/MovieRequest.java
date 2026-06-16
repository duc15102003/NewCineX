package com.cinex.module.movie.dto;

import com.cinex.module.movie.entity.AgeRating;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.Set;

/**
 * Request tạo / sửa thông tin phim (metadata).
 *
 * <p><b>Sau refactor MovieRun:</b> các field về <i>vòng đời chiếu</i> nằm hoàn toàn ở
 * {@code MovieRunRequest}. Cụ thể KHÔNG còn:
 * <ul>
 *   <li>{@code status} — computed on-the-fly từ MovieRun + theaterId context
 *       (xem {@code MovieStatusComputer}). Không lưu cache trên Movie nữa.</li>
 *   <li>{@code releaseDate / endDate} — vòng đời nằm ở {@code MovieRun.startDate/endDate}.
 *       1 phim có thể có nhiều run (FIRST_RUN, REISSUE, FESTIVAL).</li>
 * </ul>
 *
 * <p><b>Single Source of Truth:</b> MovieRun là nguồn duy nhất quyết định "phim đang ở giai
 * đoạn nào tại chi nhánh nào". Movie chỉ giữ metadata bất biến (title, poster, duration, ...).
 */
@Getter
@Setter
public class MovieRequest {

    @NotBlank(message = "Tên phim là bắt buộc")
    @Size(max = 200, message = "Tên phim tối đa 200 ký tự")
    private String title;

    private String description;

    @NotNull(message = "Thời lượng là bắt buộc")
    @Min(value = 1, message = "Thời lượng phải ít nhất 1 phút")
    @Max(value = 500, message = "Thời lượng tối đa 500 phút (~8h, đủ cho director's cut dài nhất)")
    private Integer duration;

    /**
     * URL trailer — chỉ chấp nhận YouTube hoặc Vimeo (chuẩn industry CGV/Lotte).
     * Tránh admin gắn link random / phishing / malware.
     */
    @Pattern(
            regexp = "^$|^https?://(www\\.)?(youtube\\.com|youtu\\.be|vimeo\\.com)/.+",
            message = "Trailer URL phải là link YouTube hoặc Vimeo"
    )
    @Size(max = 500, message = "Trailer URL tối đa 500 ký tự")
    private String trailerUrl;

    @Size(max = 100, message = "Tên đạo diễn tối đa 100 ký tự")
    private String director;

    @Size(max = 500, message = "Diễn viên tối đa 500 ký tự")
    private String cast;

    @Size(max = 50, message = "Ngôn ngữ tối đa 50 ký tự")
    private String language;

    @DecimalMin(value = "0.0", message = "Điểm đánh giá phải từ 0 đến 10")
    @DecimalMax(value = "10.0", message = "Điểm đánh giá phải từ 0 đến 10")
    private BigDecimal rating;

    /** Phân loại tuổi (TT 25/2024): P, K, T13, T16, T18, C. Default P khi không nhập. */
    private AgeRating ageRating;

    /**
     * Danh sách ID thể loại — bắt buộc ít nhất 1 (chuẩn industry CGV/Lotte:
     * mọi phim phải có genre tag để khách filter và recommend engine hoạt động).
     */
    @NotEmpty(message = "Phim phải có ít nhất 1 thể loại")
    private Set<Long> genreIds;
}
