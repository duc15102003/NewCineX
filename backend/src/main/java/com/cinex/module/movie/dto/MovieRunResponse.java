package com.cinex.module.movie.dto;

import com.cinex.module.movie.entity.MovieRunStatus;
import com.cinex.module.movie.entity.MovieRunType;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Response 1 đợt chiếu — kèm metadata cơ bản của Movie cha (title, poster) để FE không phải
 * query thêm khi list runs trong trang admin.
 */
@Getter
@Builder
public class MovieRunResponse {

    private Long id;
    private String storageState;

    /** ID phim — giữ riêng để FE có thể link sang trang chi tiết phim. */
    private Long movieId;
    private String movieTitle;
    private String moviePosterUrl;

    /** Chi nhánh sở hữu đợt chiếu — mỗi rạp 1 run riêng cho cùng phim. */
    private Long theaterId;
    private String theaterName;
    private String theaterCity;

    private LocalDate startDate;
    private LocalDate endDate;
    private MovieRunType runType;
    private MovieRunStatus status;
    private String notes;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
