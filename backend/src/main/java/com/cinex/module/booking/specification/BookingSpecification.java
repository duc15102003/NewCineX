package com.cinex.module.booking.specification;

import com.cinex.common.entity.StorageState;
import com.cinex.module.booking.dto.BookingFilter;
import com.cinex.module.booking.entity.Booking;
import com.cinex.module.booking.entity.BookingStatus;
import com.cinex.module.payment.entity.Payment;
import com.cinex.module.payment.entity.PaymentMethod;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Subquery;
import org.springframework.data.jpa.domain.Specification;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Specification builder cho Booking — dynamic WHERE theo BookingFilter.
 *
 * <p>Tách 2 entry point:
 *  - {@link #fromFilter(BookingFilter, Long)} cho user (luôn lọc userId).
 *  - {@link #fromAdminFilter(BookingFilter)} cho admin (không lọc userId mặc định).
 */
public class BookingSpecification {

    private BookingSpecification() {}

    /**
     * Filter cho user — lọc theo userId bắt buộc. Áp thêm vài field cơ bản
     * (status, keyword tên phim) nếu user muốn lọc trong lịch sử.
     */
    public static Specification<Booking> fromFilter(BookingFilter filter, Long userId) {
        Specification<Booking> spec = Specification.where(hasUser(userId));

        if (!Boolean.TRUE.equals(filter.getIncludeDeleted())) {
            spec = spec.and(notDeleted());
        }
        if (filter.getStatus() != null) {
            spec = spec.and(hasStatus(filter.getStatus()));
        }
        if (filter.getKeyword() != null && !filter.getKeyword().isBlank()) {
            spec = spec.and(keywordSpec(filter.getKeyword()));
        }
        if (filter.getCreatedFrom() != null || filter.getCreatedTo() != null) {
            spec = spec.and(createdBetween(filter.getCreatedFrom(), filter.getCreatedTo()));
        }
        if (filter.getMinAmount() != null || filter.getMaxAmount() != null) {
            spec = spec.and(amountBetween(filter.getMinAmount(), filter.getMaxAmount()));
        }
        return spec;
    }

    /**
     * Filter cho admin — không lọc userId mặc định. Áp đầy đủ field.
     */
    public static Specification<Booking> fromAdminFilter(BookingFilter filter) {
        Specification<Booking> spec = Specification.where(null);

        if (!Boolean.TRUE.equals(filter.getIncludeDeleted())) {
            spec = spec.and(notDeleted());
        }
        if (filter.getStatus() != null) {
            spec = spec.and(hasStatus(filter.getStatus()));
        }
        if (filter.getUserId() != null) {
            spec = spec.and(hasUser(filter.getUserId()));
        }
        if (filter.getMovieId() != null) {
            spec = spec.and(hasMovie(filter.getMovieId()));
        }
        if (filter.getShowtimeId() != null) {
            spec = spec.and(hasShowtime(filter.getShowtimeId()));
        }
        if (filter.getRoomId() != null) {
            spec = spec.and(hasRoom(filter.getRoomId()));
        }
        if (filter.getTheaterId() != null) {
            spec = spec.and(hasTheater(filter.getTheaterId()));
        }
        if (filter.getCreatedFrom() != null || filter.getCreatedTo() != null) {
            spec = spec.and(createdBetween(filter.getCreatedFrom(), filter.getCreatedTo()));
        }
        if (filter.getConfirmedFrom() != null || filter.getConfirmedTo() != null) {
            spec = spec.and(confirmedBetween(filter.getConfirmedFrom(), filter.getConfirmedTo()));
        }
        if (filter.getMinAmount() != null || filter.getMaxAmount() != null) {
            spec = spec.and(amountBetween(filter.getMinAmount(), filter.getMaxAmount()));
        }
        if (filter.getPaymentMethod() != null) {
            spec = spec.and(hasPaymentMethod(filter.getPaymentMethod()));
        }
        if (filter.getKeyword() != null && !filter.getKeyword().isBlank()) {
            spec = spec.and(keywordSpec(filter.getKeyword()));
        }
        return spec;
    }

    // ---------- Atomic specs ----------

    public static Specification<Booking> hasUser(Long userId) {
        return (root, query, cb) -> cb.equal(root.get("user").get("id"), userId);
    }

    public static Specification<Booking> hasStatus(BookingStatus status) {
        return (root, query, cb) -> cb.equal(root.get("status"), status);
    }

    public static Specification<Booking> hasShowtime(Long showtimeId) {
        return (root, query, cb) -> cb.equal(root.get("showtime").get("id"), showtimeId);
    }

    public static Specification<Booking> hasMovie(Long movieId) {
        return (root, query, cb) -> {
            // Join LEFT để vẫn match nếu showtime nullable (defensive).
            var showtime = root.join("showtime", JoinType.LEFT);
            var movie = showtime.join("movie", JoinType.LEFT);
            return cb.equal(movie.get("id"), movieId);
        };
    }

    public static Specification<Booking> hasRoom(Long roomId) {
        return (root, query, cb) -> {
            var showtime = root.join("showtime", JoinType.LEFT);
            var room = showtime.join("room", JoinType.LEFT);
            return cb.equal(room.get("id"), roomId);
        };
    }

    /**
     * Lọc booking theo chi nhánh (admin context) — dùng {@code booking.theater}
     * direct field (snapshot immutable lúc tạo booking). Hết JOIN 3-hop dễ vỡ.
     */
    public static Specification<Booking> hasTheater(Long theaterId) {
        return (root, query, cb) -> {
            var theater = root.join("theater", JoinType.LEFT);
            return cb.equal(theater.get("id"), theaterId);
        };
    }

    public static Specification<Booking> createdBetween(LocalDateTime from, LocalDateTime to) {
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

    public static Specification<Booking> confirmedBetween(LocalDateTime from, LocalDateTime to) {
        return (root, query, cb) -> {
            if (from != null && to != null) {
                return cb.between(root.get("confirmedAt"), from, to);
            } else if (from != null) {
                return cb.greaterThanOrEqualTo(root.get("confirmedAt"), from);
            } else {
                return cb.lessThanOrEqualTo(root.get("confirmedAt"), to);
            }
        };
    }

    public static Specification<Booking> amountBetween(BigDecimal min, BigDecimal max) {
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
     * Booking entity KHÔNG có inverse Payment field — phải dùng subquery EXISTS.
     * SQL: WHERE EXISTS (SELECT 1 FROM payments p WHERE p.booking_id = b.id AND p.method = ?)
     */
    public static Specification<Booking> hasPaymentMethod(PaymentMethod method) {
        return (root, query, cb) -> {
            Subquery<Long> sub = query.subquery(Long.class);
            var payment = sub.from(Payment.class);
            sub.select(cb.literal(1L))
               .where(
                       cb.equal(payment.get("booking").get("id"), root.get("id")),
                       cb.equal(payment.get("method"), method)
               );
            return cb.exists(sub);
        };
    }

    public static Specification<Booking> notDeleted() {
        return (root, query, cb) ->
                cb.or(
                        cb.isNull(root.get("storageState")),
                        cb.notEqual(root.get("storageState"), StorageState.ARCHIVED)
                );
    }

    /**
     * Keyword tìm theo bookingCode + username + email + fullName của user.
     * User là LEFT JOIN vì user_id nullable (booking POS không có user).
     */
    public static Specification<Booking> keywordSpec(String keyword) {
        return (root, query, cb) -> {
            String pattern = "%" + keyword.toLowerCase() + "%";
            // distinct để tránh duplicate khi join
            if (query != null) {
                query.distinct(true);
            }
            var user = root.join("user", JoinType.LEFT);
            return cb.or(
                    cb.like(cb.lower(root.get("bookingCode")), pattern),
                    cb.like(cb.lower(user.get("username")), pattern),
                    cb.like(cb.lower(user.get("email")), pattern),
                    cb.like(cb.lower(user.get("fullName")), pattern)
            );
        };
    }

}
