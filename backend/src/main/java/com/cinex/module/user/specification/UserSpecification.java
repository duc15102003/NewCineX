package com.cinex.module.user.specification;

import com.cinex.common.entity.StorageState;
import com.cinex.module.auth.entity.Role;
import com.cinex.module.auth.entity.User;
import com.cinex.module.user.dto.UserFilter;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

public class UserSpecification {

    private UserSpecification() {}

    public static Specification<User> fromFilter(UserFilter filter) {
        Specification<User> spec = Specification.where(null);

        if (!Boolean.TRUE.equals(filter.getIncludeDeleted())) {
            spec = spec.and(notDeleted());
        }
        if (StringUtils.hasText(filter.getKeyword())) {
            spec = spec.and(hasKeyword(filter.getKeyword()));
        }
        if (filter.getRole() != null) {
            spec = spec.and(hasRole(filter.getRole()));
        }
        if (filter.getEnabled() != null) {
            spec = spec.and(isEnabled(filter.getEnabled()));
        }
        return spec;
    }

    /**
     * Tìm theo keyword trên nhiều field cùng lúc (username OR email OR fullName).
     * User search "vanan" → tìm trong cả 3 field.
     */
    public static Specification<User> hasKeyword(String keyword) {
        return (root, query, cb) -> {
            String pattern = "%" + keyword.toLowerCase() + "%";
            return cb.or(
                    cb.like(cb.lower(root.get("username")), pattern),
                    cb.like(cb.lower(root.get("email")), pattern),
                    cb.like(cb.lower(root.get("fullName")), pattern)
            );
        };
    }

    public static Specification<User> hasRole(Role role) {
        return (root, query, cb) -> cb.equal(root.get("role"), role);
    }

    public static Specification<User> isEnabled(boolean enabled) {
        return (root, query, cb) -> cb.equal(root.get("enabled"), enabled);
    }

    public static Specification<User> notDeleted() {
        return (root, query, cb) ->
                cb.or(
                        cb.isNull(root.get("storageState")),
                        cb.notEqual(root.get("storageState"), StorageState.ARCHIVED)
                );
    }
}
