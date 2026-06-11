package com.cinex.module.movie.service;

import com.cinex.common.entity.StorageState;
import com.cinex.module.movie.entity.Movie;
import com.cinex.module.movie.entity.MovieRun;
import com.cinex.module.movie.entity.MovieStatus;
import com.cinex.module.movie.repository.MovieRunRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

/**
 * Compute "effective status" của phim dựa trên {@link MovieRun} — single source of truth
 * sau refactor "bỏ Movie.status field".
 *
 * <p><b>Logic:</b>
 * <ul>
 *   <li>NOW_SHOWING — có ≥ 1 MovieRun với {@code startDate ≤ today ≤ endDate} (endDate null = open-ended).</li>
 *   <li>COMING_SOON — không có MovieRun NOW_SHOWING nhưng có MovieRun với {@code startDate > today}.</li>
 *   <li>ENDED — tất cả MovieRun đều có {@code endDate < today} (hoặc phim không có MovieRun nào).</li>
 * </ul>
 *
 * <p><b>Per-theater context:</b> khi truyền theaterId, chỉ tính MovieRun của theater đó.
 * theaterId null → tính qua tất cả MovieRun (global view — dùng cho admin "Tất cả chi nhánh").
 *
 * <p><b>Performance:</b> MovieRun mỗi phim thường ít (~1-5 đợt), nên N+1 query chấp nhận
 * được cho page size 20-50. Nếu sau này cần optimize, có thể batch fetch trong service.
 */
@Service
@RequiredArgsConstructor
public class MovieStatusComputer {

    private final MovieRunRepository movieRunRepository;

    public MovieStatus compute(Movie movie, Long theaterId) {
        return compute(movie.getId(), theaterId);
    }

    public MovieStatus compute(Long movieId, Long theaterId) {
        List<MovieRun> runs = movieRunRepository
                .findByMovieIdAndStorageStateNot(movieId, StorageState.ARCHIVED);

        if (theaterId != null) {
            runs = runs.stream()
                    .filter(r -> r.getTheater() != null
                            && theaterId.equals(r.getTheater().getId()))
                    .toList();
        }

        if (runs.isEmpty()) return MovieStatus.ENDED;

        LocalDate today = LocalDate.now();
        boolean hasNowShowing = runs.stream().anyMatch(r ->
                !r.getStartDate().isAfter(today)
                        && (r.getEndDate() == null || !r.getEndDate().isBefore(today)));
        if (hasNowShowing) return MovieStatus.NOW_SHOWING;

        boolean hasUpcoming = runs.stream().anyMatch(r -> r.getStartDate().isAfter(today));
        if (hasUpcoming) return MovieStatus.COMING_SOON;

        return MovieStatus.ENDED;
    }
}
