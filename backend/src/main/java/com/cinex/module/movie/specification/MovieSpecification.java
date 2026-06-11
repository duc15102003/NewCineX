package com.cinex.module.movie.specification;

import com.cinex.common.entity.StorageState;
import com.cinex.module.movie.dto.MovieFilter;
import com.cinex.module.movie.entity.Movie;
import com.cinex.module.movie.entity.MovieRun;
import com.cinex.module.movie.entity.MovieStatus;
import com.cinex.module.showtime.entity.Showtime;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;

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
        if (filter.getGenreId() != null) {
            spec = spec.and(hasGenre(filter.getGenreId()));
        }

        // ============================================================
        // Phân loại NOW_SHOWING / COMING_SOON / ENDED — TẤT CẢ dùng MovieRun làm
        // single source of truth (sau refactor "bỏ Movie.status field"). Chuẩn CGV/Lotte/BHD.
        // ============================================================
        boolean showingMode = Boolean.TRUE.equals(filter.getShowing())
                || Boolean.TRUE.equals(filter.getHasActiveShowtimes());

        if (showingMode || filter.getStatus() == MovieStatus.NOW_SHOWING) {
            // "Đang chiếu" = MovieRun ACTIVE today + showtime bookable
            spec = spec.and(hasActiveShowtimes(filter.getTheaterId()));
        } else if (filter.getStatus() == MovieStatus.COMING_SOON) {
            // "Sắp chiếu" = có MovieRun upcoming (startDate > today)
            spec = spec.and(hasUpcomingRuns(filter.getTheaterId()));
        } else if (filter.getStatus() == MovieStatus.ENDED) {
            // "Đã kết thúc" = không có MovieRun ACTIVE và cũng không có MovieRun upcoming
            spec = spec.and(hasNoActiveOrUpcomingRuns(filter.getTheaterId()));
        } else if (filter.getTheaterId() != null) {
            // Không filter status — chỉ scope theo theater
            spec = spec.and(hasShowtimesAtTheater(filter.getTheaterId()));
        }

        // ==== Spec mở rộng (J1) ====
        if (StringUtils.hasText(filter.getDirector())) {
            spec = spec.and(hasDirectorLike(filter.getDirector()));
        }
        if (StringUtils.hasText(filter.getCast())) {
            spec = spec.and(hasCastLike(filter.getCast()));
        }
        if (StringUtils.hasText(filter.getLanguage())) {
            spec = spec.and(hasLanguage(filter.getLanguage()));
        }
        if (filter.getMinDuration() != null || filter.getMaxDuration() != null) {
            spec = spec.and(hasDurationBetween(filter.getMinDuration(), filter.getMaxDuration()));
        }
        if (filter.getMinRating() != null || filter.getMaxRating() != null) {
            spec = spec.and(hasRatingBetween(filter.getMinRating(), filter.getMaxRating()));
        }
        if (filter.getReleaseDateFrom() != null || filter.getReleaseDateTo() != null) {
            spec = spec.and(hasAnyRunInDateRange(filter.getReleaseDateFrom(), filter.getReleaseDateTo()));
        }
        return spec;
    }

    public static Specification<Movie> hasTitle(String keyword) {
        return (root, query, cb) ->
                cb.like(cb.lower(root.get("title")), "%" + keyword.toLowerCase() + "%");
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
     * Phim "Đang chiếu" — chuẩn industry CGV/Lotte/BHD: phim phải thỏa BOTH
     * <ol>
     *   <li><b>Có MovieRun ACTIVE bao trùm hôm nay</b>: startDate ≤ today ≤ endDate
     *       (endDate null = chiếu vô thời hạn, vẫn count). Đảm bảo phim đang trong
     *       vòng đời chiếu chính thức tại chi nhánh — không phải còn 1 suất rớt
     *       cuối tuần trước.</li>
     *   <li><b>Có showtime với startTime > now</b>: phim phải còn suất CHƯA BẮT ĐẦU
     *       để book. Suất đang chiếu dở (startTime &lt; now &lt; endTime) KHÔNG count
     *       vì user không book được — tránh bug "phim hiện đang chiếu nhưng click
     *       vào không có suất".</li>
     * </ol>
     *
     * <p>VD: Suất 14:00-16:00, bây giờ 15:30
     * <ul>
     *   <li>Chỉ có suất này thôi → BE list "đang chiếu"? KHÔNG (startTime 14h
     *       &lt; now 15:30 → suất đang dở, không bookable). User không thấy phim
     *       confusing — đúng kỳ vọng.</li>
     *   <li>Có thêm suất 18:00 → BE list "đang chiếu"? CÓ (18h &gt; 15:30 →
     *       bookable). User click vào thấy suất 18h để book.</li>
     * </ul>
     */
    public static Specification<Movie> hasActiveShowtimes(Long theaterId) {
        return (root, query, cb) -> {
            // Subquery 1: EXISTS MovieRun ACTIVE bao trùm today
            Subquery<Long> runSub = query.subquery(Long.class);
            Root<MovieRun> run = runSub.from(MovieRun.class);
            runSub.select(cb.literal(1L));
            var runConditions = new ArrayList<Predicate>();
            runConditions.add(cb.equal(run.get("movie"), root));
            runConditions.add(cb.lessThanOrEqualTo(run.get("startDate"), LocalDate.now()));
            // endDate null (open-ended) hoặc endDate >= today (chưa kết thúc)
            runConditions.add(cb.or(
                    cb.isNull(run.get("endDate")),
                    cb.greaterThanOrEqualTo(run.get("endDate"), LocalDate.now())
            ));
            runConditions.add(cb.or(
                    cb.isNull(run.get("storageState")),
                    cb.notEqual(run.get("storageState"), StorageState.ARCHIVED)
            ));
            if (theaterId != null) {
                runConditions.add(cb.equal(run.get("theater").get("id"), theaterId));
            }
            runSub.where(runConditions.toArray(new Predicate[0]));

            // Subquery 2: EXISTS showtime CHƯA BẮT ĐẦU (bookable)
            Subquery<Long> stSub = query.subquery(Long.class);
            Root<Showtime> showtime = stSub.from(Showtime.class);
            stSub.select(cb.literal(1L));
            var stConditions = new ArrayList<Predicate>();
            stConditions.add(cb.equal(showtime.get("movie"), root));
            stConditions.add(cb.greaterThan(showtime.get("startTime"), LocalDateTime.now()));
            stConditions.add(cb.or(
                    cb.isNull(showtime.get("storageState")),
                    cb.notEqual(showtime.get("storageState"), StorageState.ARCHIVED)
            ));
            if (theaterId != null) {
                stConditions.add(cb.equal(showtime.get("room").get("theater").get("id"), theaterId));
            }
            stSub.where(stConditions.toArray(new Predicate[0]));

            return cb.and(cb.exists(runSub), cb.exists(stSub));
        };
    }

    /** Overload backward-compat: hasActiveShowtimes() không theaterId. */
    public static Specification<Movie> hasActiveShowtimes() {
        return hasActiveShowtimes(null);
    }

    /**
     * Phim "Sắp chiếu" = có MovieRun ACTIVE với {@code startDate > today}.
     *
     * <p><b>Per-theater context:</b> nếu {@code theaterId != null}, chỉ tính MovieRun của
     * chi nhánh đó (chuẩn CGV/Lotte — "Sắp chiếu tại CGV Vincom" chỉ tính đợt chiếu công bố
     * tại CN đó). {@code theaterId == null} → tính qua tất cả chi nhánh (SUPER_ADMIN view).
     */
    public static Specification<Movie> hasUpcomingRuns(Long theaterId) {
        return (root, query, cb) -> {
            Subquery<Long> sub = query.subquery(Long.class);
            Root<MovieRun> run = sub.from(MovieRun.class);
            sub.select(cb.literal(1L));
            var conditions = new ArrayList<Predicate>();
            conditions.add(cb.equal(run.get("movie"), root));
            conditions.add(cb.greaterThan(run.get("startDate"), LocalDate.now()));
            conditions.add(cb.or(
                    cb.isNull(run.get("storageState")),
                    cb.notEqual(run.get("storageState"), StorageState.ARCHIVED)
            ));
            if (theaterId != null) {
                conditions.add(cb.equal(run.get("theater").get("id"), theaterId));
            }
            sub.where(conditions.toArray(new Predicate[0]));
            return cb.exists(sub);
        };
    }

    /**
     * Phim "Đã kết thúc" = KHÔNG có MovieRun nào còn ACTIVE today VÀ KHÔNG có MovieRun upcoming.
     *
     * <p>Tức là tất cả MovieRun đều đã ENDED ({@code endDate < today}). Phim chưa từng có
     * MovieRun cũng coi là ENDED (newly-created, chưa setup đợt chiếu).
     */
    public static Specification<Movie> hasNoActiveOrUpcomingRuns(Long theaterId) {
        return (root, query, cb) -> {
            Subquery<Long> sub = query.subquery(Long.class);
            Root<MovieRun> run = sub.from(MovieRun.class);
            sub.select(cb.literal(1L));
            var conditions = new ArrayList<Predicate>();
            conditions.add(cb.equal(run.get("movie"), root));
            conditions.add(cb.or(
                    cb.isNull(run.get("storageState")),
                    cb.notEqual(run.get("storageState"), StorageState.ARCHIVED)
            ));
            // ACTIVE today (startDate ≤ today ≤ endDate) HOẶC upcoming (startDate > today)
            conditions.add(cb.or(
                    cb.and(
                            cb.lessThanOrEqualTo(run.get("startDate"), LocalDate.now()),
                            cb.or(
                                    cb.isNull(run.get("endDate")),
                                    cb.greaterThanOrEqualTo(run.get("endDate"), LocalDate.now())
                            )
                    ),
                    cb.greaterThan(run.get("startDate"), LocalDate.now())
            ));
            if (theaterId != null) {
                conditions.add(cb.equal(run.get("theater").get("id"), theaterId));
            }
            sub.where(conditions.toArray(new Predicate[0]));
            return cb.not(cb.exists(sub));
        };
    }

    /**
     * Phim có suất tại chi nhánh (kể cả đã chiếu xong) — dùng cho query "phim đã / đang / sắp
     * chiếu tại chi nhánh X". Khác hasActiveShowtimes ở chỗ không lọc endTime >= now.
     */
    public static Specification<Movie> hasShowtimesAtTheater(Long theaterId) {
        return (root, query, cb) -> {
            Subquery<Long> sub = query.subquery(Long.class);
            Root<Showtime> showtime = sub.from(Showtime.class);
            sub.select(cb.literal(1L));
            sub.where(
                    cb.equal(showtime.get("movie"), root),
                    cb.equal(showtime.get("room").get("theater").get("id"), theaterId),
                    cb.or(
                            cb.isNull(showtime.get("storageState")),
                            cb.notEqual(showtime.get("storageState"), StorageState.ARCHIVED)
                    )
            );
            return cb.exists(sub);
        };
    }

    // ============================================================
    //  Specs mở rộng (J1) — director / cast / language / duration / rating / releaseDate
    // ============================================================

    /** LIKE %director% — case-insensitive. */
    public static Specification<Movie> hasDirectorLike(String director) {
        return (root, query, cb) ->
                cb.like(cb.lower(root.get("director")), "%" + director.toLowerCase() + "%");
    }

    /** LIKE %cast% — case-insensitive. Cast lưu chuỗi phân cách dấu phẩy. */
    public static Specification<Movie> hasCastLike(String cast) {
        return (root, query, cb) ->
                cb.like(cb.lower(root.get("cast")), "%" + cast.toLowerCase() + "%");
    }

    /** Equals ngôn ngữ (VD: "Tiếng Việt", "English"). */
    public static Specification<Movie> hasLanguage(String language) {
        return (root, query, cb) -> cb.equal(root.get("language"), language);
    }

    /** BETWEEN min, max — xử lý khi 1 trong 2 null. */
    public static Specification<Movie> hasDurationBetween(Integer min, Integer max) {
        return (root, query, cb) -> {
            if (min != null && max != null) {
                return cb.between(root.get("duration"), min, max);
            } else if (min != null) {
                return cb.greaterThanOrEqualTo(root.get("duration"), min);
            } else {
                return cb.lessThanOrEqualTo(root.get("duration"), max);
            }
        };
    }

    /**
     * BETWEEN min, max cho rating — phim NULL rating coi như 0 (COALESCE).
     *
     * Tại sao COALESCE? User filter "rating >= 7":
     *   - Nếu KHÔNG coalesce → phim rating NULL bị loại bỏ (NULL không so sánh được)
     *     → đúng, user muốn ≥ 7
     *   - Nhưng nếu user filter "rating >= 0" (default) → phim NULL cũng bị loại (KHÔNG đúng)
     * Coalesce(rating, 0) → đảm bảo phim chưa có review (NULL) tham gia comparison như 0,
     * khớp với hành vi FE hiện hex 0 thay vì dash.
     */
    public static Specification<Movie> hasRatingBetween(BigDecimal min, BigDecimal max) {
        return (root, query, cb) -> {
            var ratingExpr = cb.coalesce(root.<BigDecimal>get("rating"), BigDecimal.ZERO);
            if (min != null && max != null) {
                return cb.between(ratingExpr, min, max);
            } else if (min != null) {
                return cb.greaterThanOrEqualTo(ratingExpr, min);
            } else {
                return cb.lessThanOrEqualTo(ratingExpr, max);
            }
        };
    }

    /**
     * EXISTS subquery: phim có ít nhất 1 {@link MovieRun} overlap với khoảng [from, to].
     *
     * <p><b>Vì sao đổi từ {@code Movie.releaseDate} cũ?</b> Sau refactor MovieRun, vòng đời
     * chiếu nằm ở từng run. Phim REISSUE 2026 có {@code Movie.releaseDate = 2009-12-18}
     * (ngày FIRST_RUN) — nếu filter theo field cũ thì user lọc "phát hành 2026" sẽ KHÔNG
     * thấy phim này dù có đợt REISSUE 2026.
     *
     * <p><b>Công thức overlap [a,b] ∩ [c,d]:</b> {@code a ≤ d AND c ≤ b}
     * <pre>
     *   Run khoảng: [run.start, run.end]
     *   Filter khoảng: [from, to]
     *   Overlap ⇔ run.start ≤ to AND from ≤ run.end
     * </pre>
     *
     * <p>Tên field FE/MovieFilter giữ nguyên ({@code releaseDateFrom/To}) để không break API;
     * chỉ semantic thay đổi: "phim có đợt chiếu trong khoảng" thay vì "ngày phát hành phim".
     */
    public static Specification<Movie> hasAnyRunInDateRange(LocalDate from, LocalDate to) {
        return (root, query, cb) -> {
            Subquery<Long> sub = query.subquery(Long.class);
            Root<MovieRun> run = sub.from(MovieRun.class);
            sub.select(cb.literal(1L));

            var conditions = new ArrayList<Predicate>();
            conditions.add(cb.equal(run.get("movie"), root));
            conditions.add(cb.or(
                    cb.isNull(run.get("storageState")),
                    cb.notEqual(run.get("storageState"), StorageState.ARCHIVED)
            ));
            // Overlap: run.startDate ≤ to AND from ≤ run.endDate
            if (to != null) {
                conditions.add(cb.lessThanOrEqualTo(run.get("startDate"), to));
            }
            if (from != null) {
                conditions.add(cb.greaterThanOrEqualTo(run.get("endDate"), from));
            }
            sub.where(conditions.toArray(new Predicate[0]));
            return cb.exists(sub);
        };
    }
}
