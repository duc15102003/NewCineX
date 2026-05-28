package com.cinex.module.review.specification;

import com.cinex.common.entity.StorageState;
import com.cinex.module.review.dto.ReviewFilter;
import com.cinex.module.review.entity.Review;
import org.springframework.data.jpa.domain.Specification;

/**
 * [Specification Pattern] Build query WHERE động cho Review.
 *
 * fromFilter(ReviewFilter) nhận Filter DTO → ghép điều kiện tự động.
 * Thêm filter mới = thêm field vào DTO + thêm if trong fromFilter.
 *
 * Tại sao dùng pattern này thay vì viết nhiều method findByXxx?
 * - findByMovieId, findByMinRating, findByMovieIdAndMinRating → 2^n method
 * - Specification: chỉ 1 fromFilter(), ghép điều kiện tùy ý
 */
public class ReviewSpecification {

    private ReviewSpecification() {}

    /**
     * Entry point: chuyển Filter DTO → Specification.
     * Tất cả module dùng cùng pattern này.
     */
    public static Specification<Review> fromFilter(ReviewFilter filter) {
        Specification<Review> spec = Specification.where(null);

        if (!Boolean.TRUE.equals(filter.getIncludeDeleted())) {
            spec = spec.and(notDeleted());
        }
        if (filter.getMovieId() != null) {
            spec = spec.and(hasMovie(filter.getMovieId()));
        }
        if (filter.getMinRating() != null) {
            spec = spec.and(hasMinRating(filter.getMinRating()));
        }

        return spec;
    }

    public static Specification<Review> hasMovie(Long movieId) {
        return (root, query, cb) ->
                cb.equal(root.get("movie").get("id"), movieId);
    }

    public static Specification<Review> hasMinRating(Integer minRating) {
        return (root, query, cb) ->
                cb.greaterThanOrEqualTo(root.get("rating"), minRating);
    }

    public static Specification<Review> notDeleted() {
        return (root, query, cb) ->
                cb.or(
                        cb.isNull(root.get("storageState")),
                        cb.notEqual(root.get("storageState"), StorageState.ARCHIVED)
                );
    }
}
