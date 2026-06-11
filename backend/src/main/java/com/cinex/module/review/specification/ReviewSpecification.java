package com.cinex.module.review.specification;

import com.cinex.common.entity.StorageState;
import com.cinex.module.review.dto.ReviewFilter;
import com.cinex.module.review.entity.Review;
import jakarta.persistence.criteria.JoinType;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;

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
        if (StringUtils.hasText(filter.getKeyword())) {
            spec = spec.and(keywordSpec(filter.getKeyword()));
        }
        if (filter.getMovieId() != null) {
            spec = spec.and(hasMovie(filter.getMovieId()));
        }
        if (filter.getUserId() != null) {
            spec = spec.and(hasUser(filter.getUserId()));
        }
        if (filter.getMinRating() != null || filter.getMaxRating() != null) {
            spec = spec.and(ratingBetween(filter.getMinRating(), filter.getMaxRating()));
        }
        if (Boolean.TRUE.equals(filter.getHasComment())) {
            spec = spec.and(hasComment());
        }
        if (filter.getCreatedFrom() != null || filter.getCreatedTo() != null) {
            spec = spec.and(createdBetween(filter.getCreatedFrom(), filter.getCreatedTo()));
        }

        return spec;
    }

    /**
     * Keyword search: LOWER LIKE %x% trên user.username + user.fullName + user.email
     * + movie.title + comment. LEFT JOIN user vì có thể null (POS review chẳng hạn — hiện chưa có,
     * nhưng để safe). Dùng query.distinct(true) chống duplicate row do JOIN.
     */
    public static Specification<Review> keywordSpec(String keyword) {
        return (root, query, cb) -> {
            if (query != null) query.distinct(true);
            String pattern = "%" + keyword.toLowerCase() + "%";
            var userJoin = root.join("user", JoinType.LEFT);
            var movieJoin = root.join("movie", JoinType.LEFT);
            return cb.or(
                    cb.like(cb.lower(userJoin.get("username")), pattern),
                    cb.like(cb.lower(cb.coalesce(userJoin.get("fullName"), "")), pattern),
                    cb.like(cb.lower(cb.coalesce(userJoin.get("email"), "")), pattern),
                    cb.like(cb.lower(movieJoin.get("title")), pattern),
                    cb.like(cb.lower(cb.coalesce(root.get("comment"), "")), pattern)
            );
        };
    }

    public static Specification<Review> hasMovie(Long movieId) {
        return (root, query, cb) ->
                cb.equal(root.get("movie").get("id"), movieId);
    }

    public static Specification<Review> hasUser(Long userId) {
        return (root, query, cb) ->
                cb.equal(root.get("user").get("id"), userId);
    }

    /**
     * Lọc rating trong khoảng [min, max]. Cho phép truyền 1 trong 2 = null
     * → ghép 1 vế. Cả 2 null không gọi method này.
     */
    public static Specification<Review> ratingBetween(Integer min, Integer max) {
        return (root, query, cb) -> {
            if (min != null && max != null) {
                return cb.between(root.get("rating"), min, max);
            } else if (min != null) {
                return cb.greaterThanOrEqualTo(root.get("rating"), min);
            } else {
                return cb.lessThanOrEqualTo(root.get("rating"), max);
            }
        };
    }

    public static Specification<Review> hasMinRating(Integer minRating) {
        return (root, query, cb) ->
                cb.greaterThanOrEqualTo(root.get("rating"), minRating);
    }

    /**
     * Chỉ lấy review có comment thực sự (không null + không rỗng).
     * Tách bạch review "có nội dung" vs review "chỉ chấm sao".
     */
    public static Specification<Review> hasComment() {
        return (root, query, cb) ->
                cb.and(
                        cb.isNotNull(root.get("comment")),
                        cb.notEqual(root.get("comment"), "")
                );
    }

    public static Specification<Review> createdBetween(LocalDateTime from, LocalDateTime to) {
        return (root, query, cb) -> {
            if (from != null && to != null) {
                return cb.between(root.get("createdAt"), from, to);
            } else if (from != null) {
                return cb.greaterThanOrEqualTo(root.get("createdAt"), from);
            } else {
                return cb.lessThanOrEqualTo(root.get("createdAt"), to);
            }
        };
    }

    public static Specification<Review> notDeleted() {
        return (root, query, cb) ->
                cb.or(
                        cb.isNull(root.get("storageState")),
                        cb.notEqual(root.get("storageState"), StorageState.ARCHIVED)
                );
    }
}
