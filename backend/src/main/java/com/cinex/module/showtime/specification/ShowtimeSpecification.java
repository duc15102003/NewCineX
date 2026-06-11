package com.cinex.module.showtime.specification;

import com.cinex.common.entity.StorageState;
import com.cinex.module.room.entity.RoomType;
import com.cinex.module.showtime.dto.ShowtimeFilter;
import com.cinex.module.showtime.entity.Showtime;
import com.cinex.module.showtime.entity.ShowtimeStatus;
import org.springframework.data.jpa.domain.Specification;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public class ShowtimeSpecification {

    private ShowtimeSpecification() {}

    public static Specification<Showtime> fromFilter(ShowtimeFilter filter) {
        Specification<Showtime> spec = Specification.where(null);

        if (!Boolean.TRUE.equals(filter.getIncludeDeleted())) {
            spec = spec.and(notDeleted());
        }
        if (filter.getKeyword() != null && !filter.getKeyword().isBlank()) {
            spec = spec.and(hasKeyword(filter.getKeyword()));
        }
        if (filter.getMovieId() != null) {
            spec = spec.and(hasMovie(filter.getMovieId()));
        }
        if (filter.getRoomId() != null) {
            spec = spec.and(hasRoom(filter.getRoomId()));
        }
        // theaterId filter — bỏ qua predicate này → BE trả về tất cả showtime cross-theater,
        // FE dropdown chi nhánh "không hoạt động". Đồng thời lỗ hổng RBAC: branch ADMIN xem
        // được showtime của chi nhánh khác (ShowtimeService.listShowtimes override
        // filter.theaterId cho branch admin nhưng spec bỏ qua → vô hiệu).
        if (filter.getTheaterId() != null) {
            spec = spec.and(hasTheater(filter.getTheaterId()));
        }
        // date (cũ) và startDate (alias mới) đều là ngày — ưu tiên startDate nếu có cả 2
        LocalDate dayFilter = filter.getStartDate() != null ? filter.getStartDate() : filter.getDate();
        if (dayFilter != null) {
            spec = spec.and(onDate(dayFilter));
        }
        if (filter.getStatus() != null) {
            spec = spec.and(hasStatus(filter.getStatus()));
        }

        // ==== Spec mở rộng (J3) ====
        if (filter.getStartTimeFrom() != null || filter.getStartTimeTo() != null) {
            spec = spec.and(hasStartTimeBetween(filter.getStartTimeFrom(), filter.getStartTimeTo()));
        }
        if (filter.getRoomType() != null) {
            spec = spec.and(hasRoomType(filter.getRoomType()));
        }
        if (filter.getMinPrice() != null || filter.getMaxPrice() != null) {
            spec = spec.and(hasPriceBetween(filter.getMinPrice(), filter.getMaxPrice()));
        }
        return spec;
    }

    /**
     * Search text trên movie.title — case-insensitive LIKE.
     * Match FE input "Tìm theo tên phim..." trên trang quản trị suất chiếu.
     * Lý do search trên {@code movie.title} chứ không phải FK movieId: user gõ
     * tên thay vì chọn từ dropdown → phải fuzzy match.
     */
    public static Specification<Showtime> hasKeyword(String keyword) {
        return (root, query, cb) -> {
            String pattern = "%" + keyword.toLowerCase() + "%";
            return cb.like(cb.lower(root.get("movie").get("title")), pattern);
        };
    }

    public static Specification<Showtime> hasMovie(Long movieId) {
        return (root, query, cb) -> cb.equal(root.get("movie").get("id"), movieId);
    }

    public static Specification<Showtime> hasRoom(Long roomId) {
        return (root, query, cb) -> cb.equal(root.get("room").get("id"), roomId);
    }

    /** Filter showtime theo chi nhánh — join showtime → room → theater. */
    public static Specification<Showtime> hasTheater(Long theaterId) {
        return (root, query, cb) ->
                cb.equal(root.get("room").get("theater").get("id"), theaterId);
    }

    /**
     * Lọc suất chiếu theo ngày: startTime nằm trong [00:00, 23:59:59] của ngày đó.
     */
    public static Specification<Showtime> onDate(LocalDate date) {
        return (root, query, cb) -> {
            LocalDateTime dayStart = date.atStartOfDay();
            LocalDateTime dayEnd = date.plusDays(1).atStartOfDay();
            return cb.and(
                    cb.greaterThanOrEqualTo(root.get("startTime"), dayStart),
                    cb.lessThan(root.get("startTime"), dayEnd)
            );
        };
    }

    public static Specification<Showtime> hasStatus(ShowtimeStatus status) {
        return (root, query, cb) -> cb.equal(root.get("status"), status);
    }

    public static Specification<Showtime> notDeleted() {
        return (root, query, cb) ->
                cb.or(
                        cb.isNull(root.get("storageState")),
                        cb.notEqual(root.get("storageState"), StorageState.ARCHIVED)
                );
    }

    // ============================================================
    //  Specs mở rộng (J3) — startTimeBetween / roomType / priceBetween
    // ============================================================

    /** BETWEEN startTime — xử lý khi 1 trong 2 null. */
    public static Specification<Showtime> hasStartTimeBetween(LocalDateTime from, LocalDateTime to) {
        return (root, query, cb) -> {
            if (from != null && to != null) {
                return cb.between(root.get("startTime"), from, to);
            } else if (from != null) {
                return cb.greaterThanOrEqualTo(root.get("startTime"), from);
            } else {
                return cb.lessThanOrEqualTo(root.get("startTime"), to);
            }
        };
    }

    /** JOIN room → equals room.type. */
    public static Specification<Showtime> hasRoomType(RoomType type) {
        return (root, query, cb) -> cb.equal(root.get("room").get("type"), type);
    }

    /** BETWEEN basePrice — xử lý khi 1 trong 2 null. */
    public static Specification<Showtime> hasPriceBetween(BigDecimal min, BigDecimal max) {
        return (root, query, cb) -> {
            if (min != null && max != null) {
                return cb.between(root.get("basePrice"), min, max);
            } else if (min != null) {
                return cb.greaterThanOrEqualTo(root.get("basePrice"), min);
            } else {
                return cb.lessThanOrEqualTo(root.get("basePrice"), max);
            }
        };
    }
}
