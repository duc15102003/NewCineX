package com.cinex.module.movie.dto;

import com.cinex.module.movie.entity.AgeRating;
import com.cinex.module.movie.entity.MovieStatus;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Set;

/**
 * Response chi tiết phim — trả tất cả field + danh sách genre.
 * Dùng cho: GET /api/movies/{id}
 *
 * <p>Sau refactor MovieRun, vòng đời chiếu (releaseDate/endDate/status từng đợt)
 * trả qua endpoint {@code GET /api/movie-runs?movieId=X} — KHÔNG còn ở response này.
 */
@Getter
@Builder
public class MovieResponse {

    private Long id;
    private String storageState;
    private String title;
    private String description;
    private Integer duration;
    private String posterUrl;
    private String trailerUrl;
    private String director;
    private String cast;
    private String language;
    private BigDecimal rating;
    private MovieStatus status;
    private AgeRating ageRating;
    private Set<GenreResponse> genres;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
