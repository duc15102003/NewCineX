package com.cinex.module.movie.dto;

import com.cinex.module.movie.entity.MovieStatus;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Set;

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

    private LocalDate releaseDate;

    private LocalDate endDate;

    private String trailerUrl;

    @Size(max = 100, message = "Tên đạo diễn tối đa 100 ký tự")
    private String director;

    @Size(max = 500, message = "Diễn viên tối đa 500 ký tự")
    private String cast;

    @Size(max = 50, message = "Ngôn ngữ tối đa 50 ký tự")
    private String language;

    private BigDecimal rating;

    @NotNull(message = "Trạng thái là bắt buộc")
    private MovieStatus status;

    // Danh sách ID thể loại — client gửi [1, 3, 5] thay vì object Genre
    private Set<Long> genreIds;
}
