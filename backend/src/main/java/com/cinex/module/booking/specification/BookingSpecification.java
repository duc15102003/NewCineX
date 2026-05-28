package com.cinex.module.booking.specification;

import com.cinex.common.entity.StorageState;
import com.cinex.module.booking.dto.BookingFilter;
import com.cinex.module.booking.entity.Booking;
import com.cinex.module.booking.entity.BookingStatus;
import org.springframework.data.jpa.domain.Specification;

public class BookingSpecification {

    private BookingSpecification() {}

    /**
     * Filter cho user — lọc theo userId bắt buộc.
     */
    public static Specification<Booking> fromFilter(BookingFilter filter, Long userId) {
        Specification<Booking> spec = Specification.where(hasUser(userId));

        if (!Boolean.TRUE.equals(filter.getIncludeDeleted())) {
            spec = spec.and(notDeleted());
        }
        if (filter.getStatus() != null) {
            spec = spec.and(hasStatus(filter.getStatus()));
        }
        return spec;
    }

    /**
     * Filter cho admin — không lọc userId, xem tất cả booking.
     */
    public static Specification<Booking> fromAdminFilter(BookingFilter filter) {
        Specification<Booking> spec = Specification.where(null);

        if (!Boolean.TRUE.equals(filter.getIncludeDeleted())) {
            spec = spec.and(notDeleted());
        }
        if (filter.getStatus() != null) {
            spec = spec.and(hasStatus(filter.getStatus()));
        }
        if (filter.getKeyword() != null && !filter.getKeyword().isBlank()) {
            spec = spec.and(hasKeyword(filter.getKeyword()));
        }
        return spec;
    }

    public static Specification<Booking> hasUser(Long userId) {
        return (root, query, cb) -> cb.equal(root.get("user").get("id"), userId);
    }

    public static Specification<Booking> hasStatus(BookingStatus status) {
        return (root, query, cb) -> cb.equal(root.get("status"), status);
    }

    public static Specification<Booking> notDeleted() {
        return (root, query, cb) ->
                cb.or(
                        cb.isNull(root.get("storageState")),
                        cb.notEqual(root.get("storageState"), StorageState.ARCHIVED)
                );
    }

    public static Specification<Booking> hasKeyword(String keyword) {
        return (root, query, cb) -> {
            String pattern = "%" + keyword.toLowerCase() + "%";
            return cb.or(
                    cb.like(cb.lower(root.get("bookingCode")), pattern),
                    cb.like(cb.lower(root.get("user").get("username")), pattern)
            );
        };
    }
}
