package com.cinex.module.review.dto;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Filter DTO cho list review — admin và public dùng chung.
 *
 * [Filter DTO Pattern] Gom tất cả tiêu chí lọc vào 1 object → controller bind 1 lần,
 * service truyền sang Specification. Thêm tiêu chí mới = thêm field, không cần đổi method signature.
 */
@Getter
@Setter
public class ReviewFilter {

    // Search keyword admin — LIKE trên user.username + user.fullName + user.email + movie.title + comment
    private String keyword;

    // Lọc theo phim cụ thể (public dùng — review của 1 phim)
    private Long movieId;

    // Lọc review của user cụ thể (admin dùng — soi xem user X đã review gì)
    private Long userId;

    // Lọc review có điểm >= minRating (kết hợp với maxRating tạo range)
    private Integer minRating;

    // Lọc review có điểm <= maxRating
    private Integer maxRating;

    // true = chỉ lấy review có comment khác null và khác chuỗi rỗng
    // false hoặc null = không quan tâm (lấy cả review chỉ chấm sao)
    private Boolean hasComment;

    // Lọc theo khoảng thời gian tạo (admin xem review tuần/tháng)
    private LocalDateTime createdFrom;
    private LocalDateTime createdTo;

    // Mặc định chỉ lấy review ACTIVE, true = lấy cả đã xóa (dành cho admin)
    private Boolean includeDeleted;
}
