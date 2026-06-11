package com.cinex.module.seat.specification;

import com.cinex.common.entity.StorageState;
import com.cinex.module.seat.dto.SeatFilter;
import com.cinex.module.seat.entity.Seat;
import com.cinex.module.seat.entity.SeatStatus;
import com.cinex.module.seat.entity.SeatType;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

/**
 * [Specification Pattern] Build query WHERE động cho Seat.
 *
 * <p>Service luôn check {@code filter.roomId != null} trước khi gọi spec — đây là invariant
 * (không cho phép list ghế cross-room). Spec chỉ build điều kiện trên giả định đó.
 */
public class SeatSpecification {

    private SeatSpecification() {}

    public static Specification<Seat> fromFilter(SeatFilter filter) {
        Specification<Seat> spec = Specification.where(null);

        if (!Boolean.TRUE.equals(filter.getIncludeDeleted())) {
            spec = spec.and(notDeleted());
        }
        if (filter.getRoomId() != null) {
            spec = spec.and(hasRoom(filter.getRoomId()));
        }
        if (filter.getType() != null) {
            spec = spec.and(hasType(filter.getType()));
        }
        if (filter.getStatus() != null) {
            spec = spec.and(hasStatus(filter.getStatus()));
        }
        if (StringUtils.hasText(filter.getRowLabel())) {
            spec = spec.and(hasRowLabel(filter.getRowLabel()));
        }
        return spec;
    }

    public static Specification<Seat> hasRoom(Long roomId) {
        return (root, query, cb) -> cb.equal(root.get("room").get("id"), roomId);
    }

    public static Specification<Seat> hasType(SeatType type) {
        return (root, query, cb) -> cb.equal(root.get("seatType"), type);
    }

    public static Specification<Seat> hasStatus(SeatStatus status) {
        return (root, query, cb) -> cb.equal(root.get("status"), status);
    }

    /** Equals hàng (case-insensitive). */
    public static Specification<Seat> hasRowLabel(String rowLabel) {
        return (root, query, cb) ->
                cb.equal(cb.upper(root.get("rowLabel")), rowLabel.toUpperCase());
    }

    public static Specification<Seat> notDeleted() {
        return (root, query, cb) ->
                cb.or(
                        cb.isNull(root.get("storageState")),
                        cb.notEqual(root.get("storageState"), StorageState.ARCHIVED)
                );
    }
}
