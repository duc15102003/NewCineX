package com.cinex.module.user.specification;

import com.cinex.common.entity.StorageState;
import com.cinex.module.auth.entity.Role;
import com.cinex.module.auth.entity.User;
import com.cinex.module.user.dto.UserFilter;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;

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
        if (filter.getCreatedFrom() != null || filter.getCreatedTo() != null) {
            spec = spec.and(createdBetween(filter.getCreatedFrom(), filter.getCreatedTo()));
        }
        return spec;
    }

    /**
     * Tìm theo keyword trên nhiều field cùng lúc (username OR email OR fullName OR phone).
     * User search "vanan" → tìm trong cả 4 field.
     * Phone có thể null → coalesce sang chuỗi rỗng để tránh predicate null.
     */
    public static Specification<User> hasKeyword(String keyword) {
        return (root, query, cb) -> {
            String pattern = "%" + keyword.toLowerCase() + "%";
            return cb.or(
                    cb.like(cb.lower(root.get("username")), pattern),
                    cb.like(cb.lower(root.get("email")), pattern),
                    cb.like(cb.lower(cb.coalesce(root.get("fullName"), "")), pattern),
                    cb.like(cb.lower(cb.coalesce(root.get("phone"), "")), pattern)
            );
        };
    }

    public static Specification<User> hasRole(Role role) {
        return (root, query, cb) -> cb.equal(root.get("role"), role);
    }

    public static Specification<User> isEnabled(boolean enabled) {
        return (root, query, cb) -> cb.equal(root.get("enabled"), enabled);
    }

    public static Specification<User> createdBetween(LocalDateTime from, LocalDateTime to) {
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

    public static Specification<User> notDeleted() {
        return (root, query, cb) ->
                cb.or(
                        cb.isNull(root.get("storageState")),
                        cb.notEqual(root.get("storageState"), StorageState.ARCHIVED)
                );
    }
}
