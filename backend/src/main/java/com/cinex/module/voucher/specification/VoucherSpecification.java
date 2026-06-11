package com.cinex.module.voucher.specification;

import com.cinex.common.entity.StorageState;
import com.cinex.module.voucher.dto.VoucherFilter;
import com.cinex.module.voucher.entity.DiscountType;
import com.cinex.module.voucher.entity.Voucher;
import com.cinex.module.voucher.entity.VoucherUsage;
import jakarta.persistence.criteria.Subquery;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Specification builder cho Voucher — dynamic WHERE theo VoucherFilter.
 */
public class VoucherSpecification {

    private VoucherSpecification() {}

    public static Specification<Voucher> fromFilter(VoucherFilter filter) {
        Specification<Voucher> spec = Specification.where(null);

        if (!Boolean.TRUE.equals(filter.getIncludeDeleted())) {
            spec = spec.and(notDeleted());
        }
        // Scope theater: globalOnly ưu tiên cao nhất, kế đến theaterId (combine + global).
        if (Boolean.TRUE.equals(filter.getGlobalOnly())) {
            spec = spec.and(isGlobal());
        } else if (filter.getTheaterId() != null) {
            spec = spec.and(inTheaterOrGlobal(filter.getTheaterId()));
        }
        if (StringUtils.hasText(filter.getKeyword())) {
            spec = spec.and(keywordSpec(filter.getKeyword()));
        }
        if (filter.getActive() != null) {
            spec = spec.and(isActive(filter.getActive()));
        }
        if (filter.getDiscountType() != null) {
            spec = spec.and(hasDiscountType(filter.getDiscountType()));
        }
        if (Boolean.TRUE.equals(filter.getCurrentlyValid())) {
            spec = spec.and(isCurrentlyValid());
        } else if (Boolean.FALSE.equals(filter.getCurrentlyValid())) {
            spec = spec.and(isNotCurrentlyValid());
        }
        if (Boolean.TRUE.equals(filter.getExpired())) {
            spec = spec.and(isExpired());
        } else if (Boolean.FALSE.equals(filter.getExpired())) {
            spec = spec.and(isNotExpired());
        }
        if (filter.getMinDiscount() != null || filter.getMaxDiscount() != null) {
            spec = spec.and(discountBetween(filter.getMinDiscount(), filter.getMaxDiscount()));
        }
        if (filter.getStartDateFrom() != null || filter.getStartDateTo() != null) {
            spec = spec.and(startDateBetween(filter.getStartDateFrom(), filter.getStartDateTo()));
        }
        if (filter.getEndDateFrom() != null || filter.getEndDateTo() != null) {
            spec = spec.and(endDateBetween(filter.getEndDateFrom(), filter.getEndDateTo()));
        }
        if (filter.getHasUsageLeft() != null) {
            spec = spec.and(hasUsageLeft(filter.getHasUsageLeft()));
        }
        return spec;
    }

    // ---------- Atomic specs ----------

    public static Specification<Voucher> keywordSpec(String keyword) {
        return (root, query, cb) -> {
            String pattern = "%" + keyword.toLowerCase() + "%";
            return cb.or(
                    cb.like(cb.lower(root.get("code")), pattern),
                    cb.like(cb.lower(root.get("description")), pattern)
            );
        };
    }

    public static Specification<Voucher> isActive(boolean active) {
        return (root, query, cb) -> cb.equal(root.get("active"), active);
    }

    public static Specification<Voucher> hasDiscountType(DiscountType type) {
        return (root, query, cb) -> cb.equal(root.get("discountType"), type);
    }

    /**
     * Voucher đang trong khoảng valid time:
     * startDate &lt;= now AND endDate &gt;= now.
     */
    public static Specification<Voucher> isCurrentlyValid() {
        return (root, query, cb) -> {
            LocalDateTime now = LocalDateTime.now();
            return cb.and(
                    cb.lessThanOrEqualTo(root.get("startDate"), now),
                    cb.greaterThanOrEqualTo(root.get("endDate"), now)
            );
        };
    }

    /** Ngược của {@link #isCurrentlyValid()} — chưa đến hạn HOẶC đã quá hạn. */
    public static Specification<Voucher> isNotCurrentlyValid() {
        return (root, query, cb) -> {
            LocalDateTime now = LocalDateTime.now();
            return cb.or(
                    cb.greaterThan(root.get("startDate"), now),
                    cb.lessThan(root.get("endDate"), now)
            );
        };
    }

    public static Specification<Voucher> isExpired() {
        return (root, query, cb) -> cb.lessThan(root.get("endDate"), LocalDateTime.now());
    }

    public static Specification<Voucher> isNotExpired() {
        return (root, query, cb) -> cb.greaterThanOrEqualTo(root.get("endDate"), LocalDateTime.now());
    }

    public static Specification<Voucher> discountBetween(BigDecimal min, BigDecimal max) {
        return (root, query, cb) -> {
            if (min != null && max != null) {
                return cb.between(root.get("discountValue"), min, max);
            } else if (min != null) {
                return cb.greaterThanOrEqualTo(root.get("discountValue"), min);
            } else {
                return cb.lessThanOrEqualTo(root.get("discountValue"), max);
            }
        };
    }

    public static Specification<Voucher> startDateBetween(LocalDateTime from, LocalDateTime to) {
        return (root, query, cb) -> {
            if (from != null && to != null) {
                return cb.between(root.get("startDate"), from, to);
            } else if (from != null) {
                return cb.greaterThanOrEqualTo(root.get("startDate"), from);
            } else {
                return cb.lessThanOrEqualTo(root.get("startDate"), to);
            }
        };
    }

    public static Specification<Voucher> endDateBetween(LocalDateTime from, LocalDateTime to) {
        return (root, query, cb) -> {
            if (from != null && to != null) {
                return cb.between(root.get("endDate"), from, to);
            } else if (from != null) {
                return cb.greaterThanOrEqualTo(root.get("endDate"), from);
            } else {
                return cb.lessThanOrEqualTo(root.get("endDate"), to);
            }
        };
    }

    /**
     * hasUsageLeft = true: còn lượt (usedCount < usageLimit OR usageLimit IS NULL).
     * hasUsageLeft = false: đã hết (usedCount >= usageLimit AND usageLimit IS NOT NULL).
     */
    public static Specification<Voucher> hasUsageLeft(boolean hasLeft) {
        return (root, query, cb) -> {
            if (hasLeft) {
                return cb.or(
                        cb.isNull(root.get("usageLimit")),
                        cb.lessThan(root.get("usedCount"), root.get("usageLimit"))
                );
            } else {
                return cb.and(
                        cb.isNotNull(root.get("usageLimit")),
                        cb.greaterThanOrEqualTo(root.get("usedCount"), root.get("usageLimit"))
                );
            }
        };
    }

    public static Specification<Voucher> notDeleted() {
        return (root, query, cb) ->
                cb.or(
                        cb.isNull(root.get("storageState")),
                        cb.notEqual(root.get("storageState"), StorageState.ARCHIVED)
                );
    }

    // ============================================================
    //  Scope theater — hybrid (NULL global + per-theater)
    // ============================================================

    /** Voucher toàn hệ thống: theater_id IS NULL. */
    public static Specification<Voucher> isGlobal() {
        return (root, query, cb) -> cb.isNull(root.get("theater"));
    }

    /** Voucher của 1 chi nhánh cụ thể: theater_id = ?. */
    public static Specification<Voucher> inTheater(Long theaterId) {
        return (root, query, cb) -> cb.equal(root.get("theater").get("id"), theaterId);
    }

    /**
     * Scope chuẩn cho branch ADMIN: voucher của chi nhánh mình HOẶC voucher global.
     * → admin xem được mọi voucher áp dụng được cho rạp mình.
     */
    public static Specification<Voucher> inTheaterOrGlobal(Long theaterId) {
        return (root, query, cb) -> cb.or(
                cb.isNull(root.get("theater")),
                cb.equal(root.get("theater").get("id"), theaterId)
        );
    }

    /** Đơn hàng đạt minOrderAmount của voucher (NULL coi như không yêu cầu). */
    public static Specification<Voucher> orderMeetsMin(BigDecimal orderAmount) {
        return (root, query, cb) -> cb.or(
                cb.isNull(root.get("minOrderAmount")),
                cb.lessThanOrEqualTo(root.get("minOrderAmount"), orderAmount)
        );
    }

    /**
     * User chưa dùng voucher này — đẩy xuống DB bằng NOT EXISTS subquery.
     * <pre>
     * NOT EXISTS (
     *   SELECT 1 FROM voucher_usages u
     *   WHERE u.voucher_id = v.id AND u.user_id = :userId
     * )
     * </pre>
     */
    public static Specification<Voucher> notUsedByUser(Long userId) {
        return (root, query, cb) -> {
            Subquery<Long> sub = query.subquery(Long.class);
            var usageRoot = sub.from(VoucherUsage.class);
            sub.select(cb.literal(1L))
                    .where(
                            cb.equal(usageRoot.get("voucher").get("id"), root.get("id")),
                            cb.equal(usageRoot.get("user").get("id"), userId)
                    );
            return cb.not(cb.exists(sub));
        };
    }
}
