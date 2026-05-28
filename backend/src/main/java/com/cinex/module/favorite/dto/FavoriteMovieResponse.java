package com.cinex.module.favorite.dto;

import com.cinex.module.movie.entity.MovieStatus;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Builder
public class FavoriteMovieResponse {

    private Long movieId;
    private String title;
    private String posterUrl;
    private Integer duration;
    private BigDecimal rating;
    private MovieStatus status;
    private LocalDateTime favoritedAt;
}
