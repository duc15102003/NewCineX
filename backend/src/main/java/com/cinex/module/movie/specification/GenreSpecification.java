package com.cinex.module.movie.specification;

import com.cinex.common.entity.StorageState;
import com.cinex.module.movie.dto.GenreFilter;
import com.cinex.module.movie.entity.Genre;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

public class GenreSpecification {

    private GenreSpecification() {}

    public static Specification<Genre> fromFilter(GenreFilter filter) {
        Specification<Genre> spec = Specification.where(null);

        if (!Boolean.TRUE.equals(filter.getIncludeDeleted())) {
            spec = spec.and(notDeleted());
        }
        if (StringUtils.hasText(filter.getKeyword())) {
            spec = spec.and(hasName(filter.getKeyword()));
        }
        return spec;
    }

    public static Specification<Genre> hasName(String keyword) {
        return (root, query, cb) ->
                cb.like(cb.lower(root.get("name")), "%" + keyword.toLowerCase() + "%");
    }

    public static Specification<Genre> notDeleted() {
        return (root, query, cb) ->
                cb.or(
                        cb.isNull(root.get("storageState")),
                        cb.notEqual(root.get("storageState"), StorageState.ARCHIVED)
                );
    }
}
