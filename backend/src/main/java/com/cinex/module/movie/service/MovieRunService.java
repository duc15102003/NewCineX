package com.cinex.module.movie.service;

import com.cinex.common.audit.Auditable;
import com.cinex.common.entity.StorageState;
import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.common.service.SecurityService;
import com.cinex.module.movie.dto.MovieRunRequest;
import com.cinex.module.movie.dto.MovieRunResponse;
import com.cinex.module.movie.entity.Movie;
import com.cinex.module.movie.entity.MovieRun;
import com.cinex.module.movie.entity.MovieRunStatus;
import com.cinex.module.movie.mapper.MovieRunMapper;
import com.cinex.module.movie.repository.MovieRepository;
import com.cinex.module.movie.repository.MovieRunRepository;
import com.cinex.module.showtime.entity.ShowtimeStatus;
import com.cinex.module.showtime.repository.ShowtimeRepository;
import com.cinex.module.theater.entity.Theater;
import com.cinex.module.theater.repository.TheaterRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/**
 * Service CRUD cho {@link MovieRun}.
 *
 * <p><b>Multi-tenant (Vista FilmAtSite pattern):</b> mỗi (movie, theater) là 1 run riêng.
 * Branch ADMIN auto-scope theo theater từ JWT. SUPER_ADMIN tạo run cho theater cụ thể.
 *
 * <p><b>Trách nhiệm chính:</b>
 * <ul>
 *   <li>List runs theo movieId (filter theater nếu có)</li>
 *   <li>Create / Update / Archive 1 đợt chiếu</li>
 *   <li>Validate: startDate ≤ endDate, không trùng khoảng với run khác CÙNG (movie, theater)</li>
 *   <li>Chặn archive khi run còn showtime active (SCHEDULED/ONGOING)</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MovieRunService {

    private final MovieRunRepository movieRunRepository;
    private final MovieRepository movieRepository;
    private final ShowtimeRepository showtimeRepository;
    private final MovieRunMapper movieRunMapper;
    private final SecurityService securityService;
    private final TheaterRepository theaterRepository;

    private static final List<ShowtimeStatus> ACTIVE_SHOWTIME_STATUSES =
            List.of(ShowtimeStatus.SCHEDULED, ShowtimeStatus.ONGOING);

    private static final Long NO_EXCLUDE_ID = -1L;

    /**
     * List runs của 1 phim (backward-compat overload).
     */
    @Transactional(readOnly = true)
    public List<MovieRunResponse> listByMovie(Long movieId) {
        return listByMovie(movieId, null);
    }

    /**
     * List runs của 1 phim với optional theater scope.
     * Branch ADMIN: auto-scope theo JWT (chỉ thấy run của rạp mình).
     */
    @Transactional(readOnly = true)
    public List<MovieRunResponse> listByMovie(Long movieId, Long theaterId) {
        if (!movieRepository.existsById(movieId)) {
            throw new BusinessException(ErrorCode.MOVIE_NOT_FOUND);
        }
        Long scopedTheaterId = securityService.getCurrentUserTheaterId();
        Long effectiveId = scopedTheaterId != null ? scopedTheaterId : theaterId;

        List<MovieRun> runs;
        if (effectiveId != null) {
            runs = movieRunRepository.findByMovieIdAndTheaterIdAndStorageStateNotOrderByStartDateDesc(
                    movieId, effectiveId, StorageState.ARCHIVED);
        } else {
            runs = movieRunRepository.findByMovieIdAndStorageStateNotOrderByStartDateDesc(
                    movieId, StorageState.ARCHIVED);
        }
        return runs.stream().map(movieRunMapper::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public MovieRunResponse getRun(Long id) {
        MovieRun run = findRunOrThrow(id);
        requireScopeAccess(run);
        return movieRunMapper.toResponse(run);
    }

    @Transactional
    @Auditable(action = "CREATE_MOVIE_RUN", entityType = "MovieRun")
    public MovieRunResponse create(MovieRunRequest request) {
        validateDates(request.getStartDate(), request.getEndDate());

        Movie movie = movieRepository.findById(request.getMovieId())
                .orElseThrow(() -> new BusinessException(ErrorCode.MOVIE_NOT_FOUND));

        if (movie.getStorageState() == StorageState.ARCHIVED) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Không thể tạo đợt chiếu cho phim đã bị xóa");
        }

        // Scope theater: branch ADMIN bị override từ JWT
        Long scopedTheaterId = securityService.getCurrentUserTheaterId();
        Long targetTheaterId = scopedTheaterId != null ? scopedTheaterId : request.getTheaterId();
        if (targetTheaterId == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR);
        }
        Theater theater = theaterRepository.findById(targetTheaterId)
                .orElseThrow(() -> new BusinessException(ErrorCode.THEATER_NOT_FOUND));

        // Overlap check chỉ trong cùng (movie, theater) — khác theater được phép overlap
        ensureNoOverlap(request.getMovieId(), targetTheaterId,
                request.getStartDate(), request.getEndDate(), NO_EXCLUDE_ID);

        MovieRun run = MovieRun.builder()
                .movie(movie)
                .theater(theater)
                .startDate(request.getStartDate())
                .endDate(request.getEndDate())
                .runType(request.getRunType())
                .status(deriveStatus(request.getStartDate(), request.getEndDate()))
                .notes(request.getNotes())
                .build();

        movieRunRepository.save(run);
        log.info("Created MovieRun id={} cho movie '{}' tại theater '{}' [{} → {}, type={}]",
                run.getId(), movie.getTitle(), theater.getCode(),
                run.getStartDate(), run.getEndDate(), run.getRunType());
        return movieRunMapper.toResponse(run);
    }

    @Transactional
    @Auditable(action = "UPDATE_MOVIE_RUN", entityType = "MovieRun")
    public MovieRunResponse update(Long id, MovieRunRequest request) {
        MovieRun run = findRunOrThrow(id);
        requireScopeAccess(run);

        validateDates(request.getStartDate(), request.getEndDate());

        if (!run.getMovie().getId().equals(request.getMovieId())) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Không thể đổi phim của đợt chiếu — vui lòng tạo đợt chiếu mới");
        }
        // KHÔNG cho đổi theater của run — tạo run mới ở rạp khác nếu cần
        if (request.getTheaterId() != null && !request.getTheaterId().equals(run.getTheater().getId())) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Không thể đổi chi nhánh của đợt chiếu — vui lòng tạo đợt chiếu mới");
        }

        ensureNoOverlap(request.getMovieId(), run.getTheater().getId(),
                request.getStartDate(), request.getEndDate(), id);

        run.setStartDate(request.getStartDate());
        run.setEndDate(request.getEndDate());
        run.setRunType(request.getRunType());
        run.setStatus(deriveStatus(request.getStartDate(), request.getEndDate()));
        run.setNotes(request.getNotes());

        movieRunRepository.save(run);
        log.info("Updated MovieRun id={}", id);
        return movieRunMapper.toResponse(run);
    }

    @Transactional
    @Auditable(action = "ARCHIVE_MOVIE_RUN", entityType = "MovieRun")
    public void archive(Long id) {
        MovieRun run = findRunOrThrow(id);
        requireScopeAccess(run);

        boolean hasActiveShowtime = showtimeRepository
                .existsByMovieRunIdAndStatusInAndStorageStateNot(id, ACTIVE_SHOWTIME_STATUSES, StorageState.ARCHIVED);
        if (hasActiveShowtime) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Không thể xóa đợt chiếu đang có suất chiếu hoạt động");
        }

        run.setStorageState(StorageState.ARCHIVED);
        movieRunRepository.save(run);
        log.info("Archived MovieRun id={}", id);
    }

    // ===== Helpers =====

    /** Branch ADMIN chỉ thao tác được run của rạp mình. */
    private void requireScopeAccess(MovieRun run) {
        Long scopedTheaterId = securityService.getCurrentUserTheaterId();
        if (scopedTheaterId == null) return;
        if (run.getTheater() == null
                || !run.getTheater().getId().equals(scopedTheaterId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN,
                    "Bạn chỉ được thao tác đợt chiếu của chi nhánh mình");
        }
    }

    private MovieRun findRunOrThrow(Long id) {
        return movieRunRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Không tìm thấy đợt chiếu"));
    }

    private void validateDates(LocalDate start, LocalDate end) {
        if (start == null) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST, "Ngày bắt đầu là bắt buộc");
        }
        if (end != null && end.isBefore(start)) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu");
        }
    }

    /**
     * Chặn 2 đợt chiếu của cùng (movie, theater) overlap.
     * Khác theater được phép overlap (theater A chiếu 8-10, theater B chiếu 9-11).
     */
    private void ensureNoOverlap(Long movieId, Long theaterId,
                                  LocalDate start, LocalDate end, Long excludeId) {
        boolean hasOverlap = movieRunRepository
                .findByMovieIdAndTheaterIdAndStorageStateNot(movieId, theaterId, StorageState.ARCHIVED).stream()
                .filter(r -> !r.getId().equals(excludeId))
                .anyMatch(r -> rangesOverlap(start, end, r.getStartDate(), r.getEndDate()));
        if (hasOverlap) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Khoảng ngày bị trùng với đợt chiếu khác của cùng phim tại chi nhánh này");
        }
    }

    private boolean rangesOverlap(LocalDate a1, LocalDate a2, LocalDate b1, LocalDate b2) {
        boolean aReachesB = (a2 == null) || !a2.isBefore(b1);
        boolean bReachesA = (b2 == null) || !b2.isBefore(a1);
        return aReachesB && bReachesA;
    }

    private MovieRunStatus deriveStatus(LocalDate start, LocalDate end) {
        LocalDate today = LocalDate.now();
        if (today.isBefore(start)) return MovieRunStatus.SCHEDULED;
        if (end != null && today.isAfter(end)) return MovieRunStatus.ENDED;
        return MovieRunStatus.NOW_SHOWING;
    }
}
