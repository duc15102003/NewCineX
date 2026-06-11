package com.cinex.module.movie.dto;

import com.cinex.module.movie.entity.AgeRating;
import com.cinex.module.movie.entity.MovieStatus;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Set;

@Getter
@Builder
public class MovieListResponse {

    private Long id;
    private String storageState;
    private String title;
    private String posterUrl;
    private Integer duration;
    private BigDecimal rating;
    /** Đạo diễn — bổ sung để admin scan list không cần click detail. */
    private String director;
    /** Phân loại tuổi (P/K/T13/T16/T18) — badge nhỏ trong list. */
    private AgeRating ageRating;
    /** Ngôn ngữ phim — VD: "Tiếng Anh - Phụ đề Việt". */
    private String language;
    private MovieStatus status;
    private Set<GenreResponse> genres;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
