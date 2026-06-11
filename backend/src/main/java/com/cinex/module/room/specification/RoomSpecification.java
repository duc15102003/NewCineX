package com.cinex.module.room.specification;

import com.cinex.common.entity.StorageState;
import com.cinex.module.room.dto.RoomFilter;
import com.cinex.module.room.entity.Room;
import com.cinex.module.room.entity.RoomStatus;
import com.cinex.module.room.entity.RoomType;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

public class RoomSpecification {

    private RoomSpecification() {}

    public static Specification<Room> fromFilter(RoomFilter filter) {
        Specification<Room> spec = Specification.where(null);

        if (!Boolean.TRUE.equals(filter.getIncludeDeleted())) {
            spec = spec.and(notDeleted());
        }
        if (StringUtils.hasText(filter.getKeyword())) {
            spec = spec.and(hasName(filter.getKeyword()));
        }
        if (filter.getTheaterId() != null) {
            spec = spec.and(hasTheater(filter.getTheaterId()));
        }
        if (filter.getType() != null) {
            spec = spec.and(hasType(filter.getType()));
        }
        if (filter.getStatus() != null) {
            spec = spec.and(hasStatus(filter.getStatus()));
        }

        // ==== Spec mở rộng (J4) ====
        if (filter.getMinSeats() != null || filter.getMaxSeats() != null) {
            spec = spec.and(hasSeatsBetween(filter.getMinSeats(), filter.getMaxSeats()));
        }
        return spec;
    }

    /** Lọc phòng theo chi nhánh (F1). */
    public static Specification<Room> hasTheater(Long theaterId) {
        return (root, query, cb) -> cb.equal(root.get("theater").get("id"), theaterId);
    }

    public static Specification<Room> hasName(String keyword) {
        return (root, query, cb) ->
                cb.like(cb.lower(root.get("name")), "%" + keyword.toLowerCase() + "%");
    }

    public static Specification<Room> hasType(RoomType type) {
        return (root, query, cb) ->
                cb.equal(root.get("type"), type);
    }

    public static Specification<Room> hasStatus(RoomStatus status) {
        return (root, query, cb) ->
                cb.equal(root.get("status"), status);
    }

    public static Specification<Room> notDeleted() {
        return (root, query, cb) ->
                cb.or(
                        cb.isNull(root.get("storageState")),
                        cb.notEqual(root.get("storageState"), StorageState.ARCHIVED)
                );
    }

    /** BETWEEN totalSeats — xử lý khi 1 trong 2 null. */
    public static Specification<Room> hasSeatsBetween(Integer min, Integer max) {
        return (root, query, cb) -> {
            if (min != null && max != null) {
                return cb.between(root.get("totalSeats"), min, max);
            } else if (min != null) {
                return cb.greaterThanOrEqualTo(root.get("totalSeats"), min);
            } else {
                return cb.lessThanOrEqualTo(root.get("totalSeats"), max);
            }
        };
    }
}
