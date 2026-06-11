package com.cinex.module.theater.specification;

import com.cinex.common.entity.StorageState;
import com.cinex.module.theater.dto.TheaterFilter;
import com.cinex.module.theater.entity.Theater;
import com.cinex.module.theater.entity.TheaterStatus;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

/**
 * [Specification Pattern] Build query động cho Theater.
 */
public class TheaterSpecification {

    private TheaterSpecification() {}

    public static Specification<Theater> fromFilter(TheaterFilter filter) {
        Specification<Theater> spec = Specification.where(null);

        if (!Boolean.TRUE.equals(filter.getIncludeDeleted())) {
            spec = spec.and(notArchived());
        }
        if (StringUtils.hasText(filter.getKeyword())) {
            spec = spec.and(hasKeyword(filter.getKeyword()));
        }
        if (StringUtils.hasText(filter.getCity())) {
            spec = spec.and(hasCity(filter.getCity()));
        }
        if (filter.getStatus() != null) {
            spec = spec.and(hasStatus(filter.getStatus()));
        }
        return spec;
    }

    /** Loại trừ theater ARCHIVED. */
    private static Specification<Theater> notArchived() {
        return (root, query, cb) -> cb.or(
                cb.isNull(root.get("storageState")),
                cb.notEqual(root.get("storageState"), StorageState.ARCHIVED)
        );
    }

    /** Search trong name, code, address — case-insensitive. */
    private static Specification<Theater> hasKeyword(String keyword) {
        return (root, query, cb) -> {
            String like = "%" + keyword.toLowerCase() + "%";
            return cb.or(
                    cb.like(cb.lower(root.get("name")), like),
                    cb.like(cb.lower(root.get("code")), like),
                    cb.like(cb.lower(root.get("address")), like)
            );
        };
    }

    private static Specification<Theater> hasCity(String city) {
        return (root, query, cb) -> cb.equal(root.get("city"), city);
    }

    private static Specification<Theater> hasStatus(TheaterStatus status) {
        return (root, query, cb) -> cb.equal(root.get("status"), status);
    }
}
