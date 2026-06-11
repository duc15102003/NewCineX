package com.cinex.module.payment.specification;

import com.cinex.common.entity.StorageState;
import com.cinex.module.payment.dto.PaymentFilter;
import com.cinex.module.payment.entity.Payment;
import com.cinex.module.payment.entity.PaymentMethod;
import com.cinex.module.payment.entity.PaymentStatus;
import jakarta.persistence.criteria.JoinType;
import org.springframework.data.jpa.domain.Specification;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Specification builder cho Payment — dynamic WHERE theo PaymentFilter.
 *
 * <p>Join booking + user thông qua LEFT JOIN để tránh loại bỏ bản ghi
 * khi field rỗng (defensive — booking_id NOT NULL nhưng user_id nullable).
 */
public class PaymentSpecification {

    private PaymentSpecification() {}

    public static Specification<Payment> fromFilter(PaymentFilter filter) {
        Specification<Payment> spec = Specification.where(null);

        if (!Boolean.TRUE.equals(filter.getIncludeDeleted())) {
            spec = spec.and(notDeleted());
        }
        if (filter.getStatus() != null) {
            spec = spec.and(hasStatus(filter.getStatus()));
        }
        if (filter.getMethod() != null) {
            spec = spec.and(hasMethod(filter.getMethod()));
        }
        if (filter.getBookingId() != null) {
            spec = spec.and(hasBooking(filter.getBookingId()));
        }
        if (filter.getUserId() != null) {
            spec = spec.and(hasUser(filter.getUserId()));
        }
        if (filter.getTheaterId() != null) {
            spec = spec.and(hasTheater(filter.getTheaterId()));
        }
        if (filter.getPaidFrom() != null || filter.getPaidTo() != null) {
            spec = spec.and(paidBetween(filter.getPaidFrom(), filter.getPaidTo()));
        }
        if (filter.getCreatedFrom() != null || filter.getCreatedTo() != null) {
            spec = spec.and(createdBetween(filter.getCreatedFrom(), filter.getCreatedTo()));
        }
        if (filter.getMinAmount() != null || filter.getMaxAmount() != null) {
            spec = spec.and(amountBetween(filter.getMinAmount(), filter.getMaxAmount()));
        }
        if (filter.getKeyword() != null && !filter.getKeyword().isBlank()) {
            spec = spec.and(keywordSpec(filter.getKeyword()));
        }
        return spec;
    }

    // ---------- Atomic specs ----------

    public static Specification<Payment> hasStatus(PaymentStatus status) {
        return (root, query, cb) -> cb.equal(root.get("status"), status);
    }

    public static Specification<Payment> hasMethod(PaymentMethod method) {
        return (root, query, cb) -> cb.equal(root.get("method"), method);
    }

    public static Specification<Payment> hasBooking(Long bookingId) {
        return (root, query, cb) -> cb.equal(root.get("booking").get("id"), bookingId);
    }

    /**
     * Lọc payment theo chi nhánh (admin context) — dùng {@code booking.theater}
     * direct field (snapshot immutable). Hết JOIN 4-hop dễ vỡ.
     */
    public static Specification<Payment> hasTheater(Long theaterId) {
        return (root, query, cb) -> {
            var booking = root.join("booking", JoinType.LEFT);
            var theater = booking.join("theater", JoinType.LEFT);
            return cb.equal(theater.get("id"), theaterId);
        };
    }

    public static Specification<Payment> hasUser(Long userId) {
        return (root, query, cb) -> {
            var booking = root.join("booking", JoinType.LEFT);
            var user = booking.join("user", JoinType.LEFT);
            return cb.equal(user.get("id"), userId);
        };
    }

    public static Specification<Payment> paidBetween(LocalDateTime from, LocalDateTime to) {
        return (root, query, cb) -> {
            if (from != null && to != null) {
                return cb.between(root.get("paidAt"), from, to);
            } else if (from != null) {
                return cb.greaterThanOrEqualTo(root.get("paidAt"), from);
            } else {
                return cb.lessThanOrEqualTo(root.get("paidAt"), to);
            }
        };
    }

    public static Specification<Payment> createdBetween(LocalDateTime from, LocalDateTime to) {
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

    public static Specification<Payment> amountBetween(BigDecimal min, BigDecimal max) {
        return (root, query, cb) -> {
            if (min != null && max != null) {
                return cb.between(root.get("amount"), min, max);
            } else if (min != null) {
                return cb.greaterThanOrEqualTo(root.get("amount"), min);
            } else {
                return cb.lessThanOrEqualTo(root.get("amount"), max);
            }
        };
    }

    public static Specification<Payment> notDeleted() {
        return (root, query, cb) ->
                cb.or(
                        cb.isNull(root.get("storageState")),
                        cb.notEqual(root.get("storageState"), StorageState.ARCHIVED)
                );
    }

    /**
     * Keyword tìm theo transactionCode + booking.bookingCode (LEFT JOIN booking).
     */
    public static Specification<Payment> keywordSpec(String keyword) {
        return (root, query, cb) -> {
            String pattern = "%" + keyword.toLowerCase() + "%";
            if (query != null) {
                query.distinct(true);
            }
            var booking = root.join("booking", JoinType.LEFT);
            return cb.or(
                    cb.like(cb.lower(root.get("transactionCode")), pattern),
                    cb.like(cb.lower(booking.get("bookingCode")), pattern)
            );
        };
    }
}
