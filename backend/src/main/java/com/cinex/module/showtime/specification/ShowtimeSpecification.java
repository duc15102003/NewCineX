package com.cinex.module.showtime.specification;

import com.cinex.common.entity.StorageState;
import com.cinex.module.showtime.dto.ShowtimeFilter;
import com.cinex.module.showtime.entity.Showtime;
import com.cinex.module.showtime.entity.ShowtimeStatus;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class ShowtimeSpecification {

    private ShowtimeSpecification() {}

    public static Specification<Showtime> fromFilter(ShowtimeFilter filter) {
        Specification<Showtime> spec = Specification.where(null);

        if (!Boolean.TRUE.equals(filter.getIncludeDeleted())) {
            spec = spec.and(notDeleted());
        }
        if (filter.getMovieId() != null) {
            spec = spec.and(hasMovie(filter.getMovieId()));
        }
        if (filter.getRoomId() != null) {
            spec = spec.and(hasRoom(filter.getRoomId()));
        }
        if (filter.getDate() != null) {
            spec = spec.and(onDate(filter.getDate()));
        }
        if (filter.getStatus() != null) {
            spec = spec.and(hasStatus(filter.getStatus()));
        }
        return spec;
    }

    public static Specification<Showtime> hasMovie(Long movieId) {
        return (root, query, cb) -> cb.equal(root.get("movie").get("id"), movieId);
    }

    public static Specification<Showtime> hasRoom(Long roomId) {
        return (root, query, cb) -> cb.equal(root.get("room").get("id"), roomId);
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
}
