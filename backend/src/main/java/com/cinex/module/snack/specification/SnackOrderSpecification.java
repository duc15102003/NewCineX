package com.cinex.module.snack.specification;

import com.cinex.common.entity.StorageState;
import com.cinex.module.snack.dto.SnackOrderFilter;
import com.cinex.module.snack.entity.Snack;
import com.cinex.module.snack.entity.SnackOrder;
import com.cinex.module.snack.entity.SnackOrderItem;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Subquery;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * [Specification Pattern] Build WHERE động cho SnackOrder (POS).
 *
 * Đặc biệt: keyword tìm trên orderCode OR (tên snack trong items) — phải dùng
 * subquery EXISTS để tránh duplicate row khi JOIN items.
 */
public class SnackOrderSpecification {

    private SnackOrderSpecification() {}

    public static Specification<SnackOrder> fromFilter(SnackOrderFilter filter) {
        Specification<SnackOrder> spec = Specification.where(null);

        if (!Boolean.TRUE.equals(filter.getIncludeDeleted())) {
            spec = spec.and(notDeleted());
        }
        if (filter.getTheaterId() != null) {
            spec = spec.and(hasTheater(filter.getTheaterId()));
        }
        if (StringUtils.hasText(filter.getStaffUsername())) {
            spec = spec.and(hasStaff(filter.getStaffUsername()));
        }
        if (filter.getCreatedFrom() != null || filter.getCreatedTo() != null) {
            spec = spec.and(createdBetween(filter.getCreatedFrom(), filter.getCreatedTo()));
        }
        if (filter.getMinTotal() != null || filter.getMaxTotal() != null) {
            spec = spec.and(totalBetween(filter.getMinTotal(), filter.getMaxTotal()));
        }
        if (StringUtils.hasText(filter.getKeyword())) {
            spec = spec.and(keywordLike(filter.getKeyword()));
        }
        return spec;
    }

    /** Filter theo chi nhánh — match join column theater_id của SnackOrder. */
    public static Specification<SnackOrder> hasTheater(Long theaterId) {
        return (root, query, cb) ->
                cb.equal(root.get("theater").get("id"), theaterId);
    }

    /**
     * Match audit field {@code createdBy} = username nhân viên tạo đơn.
     */
    public static Specification<SnackOrder> hasStaff(String username) {
        return (root, query, cb) ->
                cb.equal(cb.lower(root.get("createdBy")), username.toLowerCase());
    }

    public static Specification<SnackOrder> createdBetween(LocalDateTime from, LocalDateTime to) {
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

    public static Specification<SnackOrder> totalBetween(BigDecimal min, BigDecimal max) {
        return (root, query, cb) -> {
            if (min != null && max != null) {
                return cb.between(root.get("totalAmount"), min, max);
            } else if (min != null) {
                return cb.greaterThanOrEqualTo(root.get("totalAmount"), min);
            } else {
                return cb.lessThanOrEqualTo(root.get("totalAmount"), max);
            }
        };
    }

    /**
     * Tìm orderCode OR snack-name-in-items.
     *
     * Cách tiếp cận: subquery EXISTS thay vì JOIN trực tiếp items để tránh
     * Page.totalElements bị nhân lên do JOIN tạo Cartesian rows.
     */
    public static Specification<SnackOrder> keywordLike(String keyword) {
        return (root, query, cb) -> {
            String pattern = "%" + keyword.toLowerCase() + "%";
            Predicate matchCode = cb.like(cb.lower(root.get("orderCode")), pattern);

            Subquery<Long> sub = query.subquery(Long.class);
            var itemRoot = sub.from(SnackOrderItem.class);
            Join<SnackOrderItem, Snack> snackJoin = itemRoot.join("snack", JoinType.INNER);
            sub.select(itemRoot.get("id"))
               .where(
                       cb.equal(itemRoot.get("snackOrder").get("id"), root.get("id")),
                       cb.like(cb.lower(snackJoin.get("name")), pattern)
               );

            return cb.or(matchCode, cb.exists(sub));
        };
    }

    public static Specification<SnackOrder> notDeleted() {
        return (root, query, cb) ->
                cb.or(
                        cb.isNull(root.get("storageState")),
                        cb.notEqual(root.get("storageState"), StorageState.ARCHIVED)
                );
    }
}
