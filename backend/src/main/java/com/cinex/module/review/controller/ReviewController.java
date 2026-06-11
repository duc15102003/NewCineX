package com.cinex.module.review.controller;

import com.cinex.common.response.ApiResponse;
import com.cinex.common.response.PageResponse;
import com.cinex.common.service.SecurityService;
import org.springframework.security.access.prepost.PreAuthorize;
import com.cinex.module.review.dto.ReviewFilter;
import com.cinex.module.review.dto.ReviewRequest;
import com.cinex.module.review.dto.ReviewResponse;
import com.cinex.module.review.service.ReviewService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * ReviewController — xử lý API đánh giá phim.
 *
 * URL design:
 * - GET/POST /api/movies/{movieId}/reviews  → reviews thuộc về phim (RESTful resource nesting)
 * - PUT/DELETE /api/reviews/{id}            → thao tác trực tiếp trên review (không cần movieId)
 *
 * Lý do 2 mapping khác nhau:
 * - GET/POST cần movieId trong URL vì action gắn với phim cụ thể (xem review của phim X, review phim X)
 * - PUT/DELETE chỉ cần reviewId vì action gắn với review cụ thể (sửa/xóa review Y)
 */
@RestController
@RequiredArgsConstructor
@Tag(name = "Review", description = "Movie review management")
public class ReviewController {

    private final ReviewService reviewService;
    private final SecurityService securityService;

    /**
     * GET /api/movies/{movieId}/reviews?minRating=7&page=0&size=10
     *
     * movieId từ path variable → set vào filter trước khi truyền vào service.
     * Lý do: URL /api/movies/{movieId}/reviews ngầm định filter theo movieId,
     * nhưng ReviewFilter là POJO bind từ query params → phải set thủ công.
     */
    @GetMapping("/api/movies/{movieId}/reviews")
    @Operation(summary = "List reviews for a movie")
    public ApiResponse<PageResponse<ReviewResponse>> listReviews(
            @PathVariable Long movieId,
            ReviewFilter filter,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        // movieId từ path override filter.movieId (nếu client truyền cả 2)
        filter.setMovieId(movieId);
        return ApiResponse.ok(PageResponse.from(reviewService.listReviews(filter, pageable)));
    }

    /**
     * POST /api/movies/{movieId}/reviews
     * Body: { "rating": 8, "comment": "Phim hay!" }
     *
     * Yêu cầu đăng nhập: lấy userId từ JWT → SecurityUtil → UserRepository.
     */
    @PostMapping("/api/movies/{movieId}/reviews")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Create a review for a movie (requires login)")
    public ApiResponse<ReviewResponse> createReview(
            @PathVariable Long movieId,
            @Valid @RequestBody ReviewRequest request) {
        Long userId = securityService.getCurrentUserId();
        return ApiResponse.ok("Review created", reviewService.createReview(userId, movieId, request));
    }

    /**
     * PUT /api/reviews/{id}
     * Chỉ chủ review mới được sửa.
     */
    @PutMapping("/api/reviews/{id}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Update a review (owner only)")
    public ApiResponse<ReviewResponse> updateReview(
            @PathVariable Long id,
            @Valid @RequestBody ReviewRequest request) {
        Long userId = securityService.getCurrentUserId();
        return ApiResponse.ok("Review updated", reviewService.updateReview(userId, id, request));
    }

    /**
     * DELETE /api/reviews/{id}
     * Chủ review hoặc admin được xóa — logic kiểm tra trong service.
     */
    @DeleteMapping("/api/reviews/{id}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Delete a review (owner or admin)")
    public ApiResponse<Void> deleteReview(@PathVariable Long id) {
        Long userId = securityService.getCurrentUserId();
        reviewService.deleteReview(userId, id);
        return ApiResponse.ok("Review deleted", null);
    }

    @PutMapping("/api/reviews/{id}/restore")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Restore a soft-deleted review (owner or admin)")
    public ApiResponse<Void> restoreReview(@PathVariable Long id) {
        Long userId = securityService.getCurrentUserId();
        reviewService.restoreReview(userId, id);
        return ApiResponse.ok("Review restored", null);
    }

    /**
     * GET /api/reviews/admin?movieId=&userId=&minRating=&maxRating=&hasComment=&createdFrom=&createdTo=&includeDeleted=
     *
     * Admin xem TẤT CẢ review xuyên phim — phục vụ kiểm duyệt nội dung.
     * KHÔNG ràng buộc movieId; movieId trong filter là OPTIONAL (lọc nếu có).
     */
    @GetMapping("/api/reviews/admin")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) List all reviews across all movies (for moderation)")
    public ApiResponse<PageResponse<ReviewResponse>> adminListReviews(
            ReviewFilter filter,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ApiResponse.ok(PageResponse.from(reviewService.listReviews(filter, pageable)));
    }

}
