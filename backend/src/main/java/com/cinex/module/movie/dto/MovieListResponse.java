package com.cinex.module.movie.dto;

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
    private MovieStatus status;
    private Set<GenreResponse> genres;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
