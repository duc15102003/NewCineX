package com.cinex.module.review.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ReviewFilter {

    // Lọc theo phim
    private Long movieId;

    // Lọc review có điểm >= minRating
    private Integer minRating;

    // Mặc định chỉ lấy review ACTIVE, true = lấy cả đã xóa (dành cho admin)
    private Boolean includeDeleted;
}
