package com.cinex.module.movie.specification;

import com.cinex.common.entity.StorageState;
import com.cinex.module.movie.dto.MovieFilter;
import com.cinex.module.movie.entity.Movie;
import com.cinex.module.movie.entity.MovieStatus;
import com.cinex.module.showtime.entity.Showtime;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;

/**
 * [Specification Pattern] Build query WHERE động cho Movie.
 *
 * Filter showing=true dùng EXISTS subquery kiểm tra bảng showtimes.
 * Đây là cách các rạp thực tế (CGV, Lotte) xác định phim "đang chiếu":
 * phim có ít nhất 1 suất chiếu từ bây giờ trở đi.
 */
public class MovieSpecification {

    private MovieSpecification() {}

    public static Specification<Movie> fromFilter(MovieFilter filter) {
        Specification<Movie> spec = Specification.where(null);

        if (!Boolean.TRUE.equals(filter.getIncludeDeleted())) {
            spec = spec.and(notDeleted());
        }
        if (StringUtils.hasText(filter.getKeyword())) {
            spec = spec.and(hasTitle(filter.getKeyword()));
        }
        if (filter.getStatus() != null) {
            spec = spec.and(hasStatus(filter.getStatus()));
        }
        if (filter.getGenreId() != null) {
            spec = spec.and(hasGenre(filter.getGenreId()));
        }
        if (Boolean.TRUE.equals(filter.getShowing())) {
            spec = spec.and(hasActiveShowtimes());
        }
        return spec;
    }

    public static Specification<Movie> hasTitle(String keyword) {
        return (root, query, cb) ->
                cb.like(cb.lower(root.get("title")), "%" + keyword.toLowerCase() + "%");
    }

    public static Specification<Movie> hasStatus(MovieStatus status) {
        return (root, query, cb) ->
                cb.equal(root.get("status"), status);
    }

    public static Specification<Movie> hasGenre(Long genreId) {
        return (root, query, cb) -> {
            var genreJoin = root.join("genres", JoinType.LEFT);
            return cb.equal(genreJoin.get("id"), genreId);
        };
    }

    public static Specification<Movie> notDeleted() {
        return (root, query, cb) ->
                cb.or(
                        cb.isNull(root.get("storageState")),
                        cb.notEqual(root.get("storageState"), StorageState.ARCHIVED)
                );
    }

    /**
     * Phim "đang chiếu" = EXISTS suất chiếu chưa kết thúc (endTime >= now).
     *
     * Tại sao dùng endTime thay vì startTime?
     * - startTime >= now: suất đang chiếu dở (startTime < now < endTime) bị loại
     * - endTime >= now: suất đang chiếu dở VẪN TÍNH → phim không biến mất giữa chừng
     *
     * VD: Suất 10:00-11:30, bây giờ 11:00
     * - startTime >= now → FALSE (10:00 < 11:00) → phim biến mất khi đang chiếu!
     * - endTime >= now   → TRUE (11:30 >= 11:00)  → phim vẫn hiện cho đến 11:30
     */
    public static Specification<Movie> hasActiveShowtimes() {
        return (root, query, cb) -> {
            Subquery<Long> sub = query.subquery(Long.class);
            Root<Showtime> showtime = sub.from(Showtime.class);
            sub.select(cb.literal(1L));
            sub.where(
                    cb.equal(showtime.get("movie"), root),
                    cb.greaterThanOrEqualTo(showtime.get("endTime"), LocalDateTime.now()),
                    cb.or(
                            cb.isNull(showtime.get("storageState")),
                            cb.notEqual(showtime.get("storageState"), StorageState.ARCHIVED)
                    )
            );
            return cb.exists(sub);
        };
    }
}
