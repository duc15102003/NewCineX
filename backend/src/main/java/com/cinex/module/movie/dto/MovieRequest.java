package com.cinex.module.movie.dto;

import com.cinex.module.movie.entity.AgeRating;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
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
    private Integer duration;

    private String trailerUrl;

    @Size(max = 100, message = "Tên đạo diễn tối đa 100 ký tự")
    private String director;

    @Size(max = 500, message = "Diễn viên tối đa 500 ký tự")
    private String cast;

    @Size(max = 50, message = "Ngôn ngữ tối đa 50 ký tự")
    private String language;

    private BigDecimal rating;

    /** Phân loại tuổi (TT 25/2024): P, K, T13, T16, T18, C. Default P khi không nhập. */
    private AgeRating ageRating;

    // Danh sách ID thể loại — client gửi [1, 3, 5] thay vì object Genre
    private Set<Long> genreIds;
}
