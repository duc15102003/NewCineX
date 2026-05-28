package com.cinex.module.voucher.specification;

import com.cinex.common.entity.StorageState;
import com.cinex.module.voucher.dto.VoucherFilter;
import com.cinex.module.voucher.entity.Voucher;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;

public class VoucherSpecification {

    private VoucherSpecification() {}

    public static Specification<Voucher> fromFilter(VoucherFilter filter) {
        Specification<Voucher> spec = Specification.where(null);

        if (!Boolean.TRUE.equals(filter.getIncludeDeleted())) {
            spec = spec.and(notDeleted());
        }
        if (StringUtils.hasText(filter.getKeyword())) {
            spec = spec.and(hasKeyword(filter.getKeyword()));
        }
        if (filter.getActive() != null) {
            spec = spec.and(isActive(filter.getActive()));
        }
        if (Boolean.TRUE.equals(filter.getExpired())) {
            spec = spec.and(isExpired());
        }
        return spec;
    }

    public static Specification<Voucher> hasKeyword(String keyword) {
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

    public static Specification<Voucher> isExpired() {
        return (root, query, cb) -> cb.lessThan(root.get("endDate"), LocalDateTime.now());
    }

    public static Specification<Voucher> notDeleted() {
        return (root, query, cb) ->
                cb.or(
                        cb.isNull(root.get("storageState")),
                        cb.notEqual(root.get("storageState"), StorageState.ARCHIVED)
                );
    }
}
