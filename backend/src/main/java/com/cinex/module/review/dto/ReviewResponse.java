package com.cinex.module.review.dto;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class ReviewResponse {

    private Long id;
    private String storageState;

    // Thông tin user (lấy từ review.getUser())
    private String username;
    private String avatarUrl;

    // Thông tin phim (lấy từ review.getMovie())
    private Long movieId;
    private String movieTitle;

    private Integer rating;
    private String comment;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
