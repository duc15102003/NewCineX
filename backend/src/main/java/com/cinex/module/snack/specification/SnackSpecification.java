package com.cinex.module.snack.specification;

import com.cinex.common.entity.StorageState;
import com.cinex.module.snack.dto.SnackFilter;
import com.cinex.module.snack.entity.Snack;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

public class SnackSpecification {

    private SnackSpecification() {}

    public static Specification<Snack> fromFilter(SnackFilter filter) {
        Specification<Snack> spec = Specification.where(null);

        if (!Boolean.TRUE.equals(filter.getIncludeDeleted())) {
            spec = spec.and(notDeleted());
        }
        if (StringUtils.hasText(filter.getKeyword())) {
            spec = spec.and(hasKeyword(filter.getKeyword()));
        }
        return spec;
    }

    /**
     * Filter công khai (user): chỉ snack available + chưa bị xóa.
     */
    public static Specification<Snack> publicFilter() {
        return (root, query, cb) ->
                cb.and(
                        cb.isTrue(root.get("available")),
                        cb.or(
                        cb.isNull(root.get("storageState")),
                        cb.notEqual(root.get("storageState"), StorageState.ARCHIVED)
                )
                );
    }

    public static Specification<Snack> hasKeyword(String keyword) {
        return (root, query, cb) -> {
            String pattern = "%" + keyword.toLowerCase() + "%";
            return cb.or(
                    cb.like(cb.lower(root.get("name")), pattern),
                    cb.like(cb.lower(root.get("category")), pattern)
            );
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
