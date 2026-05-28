package com.cinex.module.review.entity;

import com.cinex.common.entity.BaseEntity;
import com.cinex.module.auth.entity.User;
import com.cinex.module.movie.entity.Movie;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Entity đánh giá phim — map bảng `reviews`.
 *
 * Quan hệ:
 * - N:1 với User: nhiều review thuộc về 1 user
 * - N:1 với Movie: nhiều review thuộc về 1 phim
 *
 * Business rule: 1 user chỉ được review 1 phim 1 lần.
 * Kiểm tra trong ReviewService.createReview() thay vì DB unique constraint
 * để trả về lỗi có nghĩa cho client.
 */
@Entity
@Table(name = "reviews")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Review extends BaseEntity {

    /**
     * [Quan hệ N:1] Review → User.
     * FetchType.LAZY: chỉ load user khi gọi review.getUser() — tránh N+1
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /**
     * [Quan hệ N:1] Review → Movie.
     * FetchType.LAZY: chỉ load movie khi gọi review.getMovie() — tránh N+1
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "movie_id", nullable = false)
    private Movie movie;

    // Điểm đánh giá từ 1-10
    @Column(nullable = false)
    private Integer rating;

    // Nội dung nhận xét (tùy chọn). NTEXT để hỗ trợ Unicode/tiếng Việt dài
    @Column(columnDefinition = "NTEXT")
    private String comment;
}
