package com.cinex.module.snack.specification;

import com.cinex.common.entity.StorageState;
import com.cinex.module.snack.dto.SnackFilter;
import com.cinex.module.snack.entity.Snack;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;

/**
 * [Specification Pattern] Build WHERE động cho Snack.
 *
 * fromFilter — admin: cho phép xem cả snack đã tắt + đã xóa.
 * publicFilter — user: bắt buộc available + chưa xóa, vẫn cho phép keyword/category/price.
 */
public class SnackSpecification {

    private SnackSpecification() {}

    public static Specification<Snack> fromFilter(SnackFilter filter) {
        Specification<Snack> spec = Specification.where(null);

        if (!Boolean.TRUE.equals(filter.getIncludeDeleted())) {
            spec = spec.and(notDeleted());
        }
        if (filter.getTheaterId() != null) {
            spec = spec.and(hasTheater(filter.getTheaterId()));
        }
        if (StringUtils.hasText(filter.getKeyword())) {
            spec = spec.and(keywordLike(filter.getKeyword()));
        }
        if (StringUtils.hasText(filter.getCategory())) {
            spec = spec.and(hasCategory(filter.getCategory()));
        }
        if (filter.getAvailable() != null) {
            spec = spec.and(hasAvailable(filter.getAvailable()));
        }
        if (filter.getMinPrice() != null || filter.getMaxPrice() != null) {
            spec = spec.and(priceBetween(filter.getMinPrice(), filter.getMaxPrice()));
        }
        return spec;
    }

    /**
     * Filter công khai (user) — bắt buộc snack available + chưa bị xóa,
     * vẫn áp được keyword/category/price từ FE menu snack.
     */
    public static Specification<Snack> publicFilter(SnackFilter filter) {
        Specification<Snack> spec = Specification.where(notDeleted())
                .and(hasAvailable(true));

        if (filter != null) {
            if (filter.getTheaterId() != null) {
                spec = spec.and(hasTheater(filter.getTheaterId()));
            }
            if (StringUtils.hasText(filter.getKeyword())) {
                spec = spec.and(keywordLike(filter.getKeyword()));
            }
            if (StringUtils.hasText(filter.getCategory())) {
                spec = spec.and(hasCategory(filter.getCategory()));
            }
            if (filter.getMinPrice() != null || filter.getMaxPrice() != null) {
                spec = spec.and(priceBetween(filter.getMinPrice(), filter.getMaxPrice()));
            }
        }
        return spec;
    }

    public static Specification<Snack> hasTheater(Long theaterId) {
        return (root, query, cb) -> cb.equal(root.get("theater").get("id"), theaterId);
    }

    /**
     * Overload không filter — giữ tương thích lùi với SnackService.listSnacks().
     */
    public static Specification<Snack> publicFilter() {
        return publicFilter(null);
    }

    /**
     * LIKE trên name OR description (case-insensitive).
     * Description có thể null → wrap coalesce để tránh predicate null.
     */
    public static Specification<Snack> keywordLike(String keyword) {
        return (root, query, cb) -> {
            String pattern = "%" + keyword.toLowerCase() + "%";
            return cb.or(
                    cb.like(cb.lower(root.get("name")), pattern),
                    cb.like(cb.lower(cb.coalesce(root.get("description"), "")), pattern)
            );
        };
    }

    /**
     * Alias cũ giữ tương thích — search trong name + category.
     * Khuyến nghị dùng keywordLike + hasCategory riêng.
     */
    public static Specification<Snack> hasKeyword(String keyword) {
        return (root, query, cb) -> {
            String pattern = "%" + keyword.toLowerCase() + "%";
            return cb.or(
                    cb.like(cb.lower(root.get("name")), pattern),
                    cb.like(cb.lower(cb.coalesce(root.get("category"), "")), pattern)
            );
        };
    }

    public static Specification<Snack> hasCategory(String category) {
        return (root, query, cb) ->
                cb.equal(cb.lower(root.get("category")), category.toLowerCase());
    }

    public static Specification<Snack> hasAvailable(boolean available) {
        return (root, query, cb) -> cb.equal(root.get("available"), available);
    }

    public static Specification<Snack> priceBetween(BigDecimal min, BigDecimal max) {
        return (root, query, cb) -> {
            if (min != null && max != null) {
                return cb.between(root.get("price"), min, max);
            } else if (min != null) {
                return cb.greaterThanOrEqualTo(root.get("price"), min);
            } else {
                return cb.lessThanOrEqualTo(root.get("price"), max);
            }
        };
    }

    public static Specification<Snack> notDeleted() {
        return (root, query, cb) ->
                cb.or(
                        cb.isNull(root.get("storageState")),
                        cb.notEqual(root.get("storageState"), StorageState.ARCHIVED)
                );
    }
}
