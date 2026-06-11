package com.cinex.common.audit.specification;

import com.cinex.common.audit.dto.AuditLogFilter;
import com.cinex.common.audit.entity.AuditLogV2;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDateTime;

/**
 * Specification builder cho AuditLogV2 — dynamic WHERE theo AuditLogFilter.
 */
public final class AuditLogSpecification {

    private AuditLogSpecification() {}

    public static Specification<AuditLogV2> fromFilter(AuditLogFilter filter) {
        Specification<AuditLogV2> spec = Specification.where(null);
        if (filter == null) return spec;

        if (filter.getAction() != null && !filter.getAction().isBlank()) {
            spec = spec.and(hasAction(filter.getAction()));
        }
        if (filter.getEntityType() != null && !filter.getEntityType().isBlank()) {
            spec = spec.and(hasEntityType(filter.getEntityType()));
        }
        if (filter.getEntityId() != null) {
            spec = spec.and(hasEntityId(filter.getEntityId()));
        }
        if (filter.getUsername() != null && !filter.getUsername().isBlank()) {
            spec = spec.and(usernameLike(filter.getUsername()));
        }
        if (filter.getFrom() != null || filter.getTo() != null) {
            spec = spec.and(createdBetween(filter.getFrom(), filter.getTo()));
        }
        return spec;
    }

    public static Specification<AuditLogV2> hasAction(String action) {
        return (root, q, cb) -> cb.equal(root.get("action"), action);
    }

    public static Specification<AuditLogV2> hasEntityType(String entityType) {
        return (root, q, cb) -> cb.equal(root.get("entityType"), entityType);
    }

    public static Specification<AuditLogV2> hasEntityId(Long entityId) {
        return (root, q, cb) -> cb.equal(root.get("entityId"), entityId);
    }

    public static Specification<AuditLogV2> usernameLike(String keyword) {
        return (root, q, cb) -> cb.like(cb.lower(root.get("username")),
                "%" + keyword.toLowerCase() + "%");
    }

    public static Specification<AuditLogV2> createdBetween(LocalDateTime from, LocalDateTime to) {
        return (root, q, cb) -> {
            if (from != null && to != null) {
                return cb.between(root.get("createdAt"), from, to);
            } else if (from != null) {
                return cb.greaterThanOrEqualTo(root.get("createdAt"), from);
            } else {
                return cb.lessThanOrEqualTo(root.get("createdAt"), to);
            }
        };
    }
}
