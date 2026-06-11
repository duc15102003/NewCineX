package com.cinex.module.movie.service;

import com.cinex.common.audit.Auditable;
import com.cinex.common.entity.StorageState;
import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.common.response.PageResponse;
import com.cinex.common.service.FileUploadService;
import com.cinex.module.movie.dto.MovieFilter;
import com.cinex.module.movie.dto.MovieListResponse;
import com.cinex.module.movie.dto.MovieRequest;
import com.cinex.module.movie.dto.MovieResponse;
import com.cinex.module.movie.entity.AgeRating;
import com.cinex.module.movie.entity.Genre;
import com.cinex.module.movie.entity.Movie;
import com.cinex.module.movie.mapper.MovieMapper;
import com.cinex.module.movie.repository.GenreRepository;
import com.cinex.module.movie.repository.MovieRepository;
import com.cinex.module.movie.repository.MovieRunRepository;
import com.cinex.module.favorite.repository.UserFavoriteRepository;
import com.cinex.module.movie.specification.MovieSpecification;
import com.cinex.module.review.repository.ReviewRepository;
import com.cinex.module.showtime.entity.ShowtimeStatus;
import com.cinex.module.showtime.repository.ShowtimeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class MovieService {

    private final MovieRepository movieRepository;
    private final GenreRepository genreRepository;
    private final MovieRunRepository movieRunRepository;
    private final ShowtimeRepository showtimeRepository;
    private final ReviewRepository reviewRepository;
    private final UserFavoriteRepository userFavoriteRepository;
    private final MovieMapper movieMapper;
    private final MovieStatusComputer statusComputer;
    private final FileUploadService fileUploadService;

    // Danh sách trạng thái suất chiếu được coi là "đang hoạt động" — chặn xóa phim liên quan
    private static final List<ShowtimeStatus> ACTIVE_SHOWTIME_STATUSES =
            List.of(ShowtimeStatus.SCHEDULED, ShowtimeStatus.ONGOING);

    /**
     * Danh sách phim — nhận Filter DTO, build Specification tự động.
     * Pattern thống nhất: Filter DTO → Specification.fromFilter() → findAll(spec, pageable)
     *
     * <p>effectiveStatus compute on-the-fly per movie + theaterId context — admin xem
     * 1 chi nhánh thấy status đúng tại chi nhánh đó; xem "Tất cả" → status global aggregate.
     */
    @Transactional(readOnly = true)
    public PageResponse<MovieListResponse> listMovies(MovieFilter filter, Pageable pageable) {
        var spec = MovieSpecification.fromFilter(filter);
        Long theaterId = filter.getTheaterId();
        Page<MovieListResponse> page = movieRepository.findAll(spec, pageable)
                .map(m -> movieMapper.toListResponse(m, statusComputer.compute(m, theaterId)));
        return PageResponse.from(page);
    }

    @Transactional(readOnly = true)
    public MovieResponse getMovie(Long id) {
        return getMovie(id, null);
    }

    @Transactional(readOnly = true)
    public MovieResponse getMovie(Long id, Long theaterId) {
        Movie movie = movieRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.MOVIE_NOT_FOUND));
        return movieMapper.toResponse(movie, statusComputer.compute(movie, theaterId));
    }

    @Transactional
    public MovieResponse createMovie(MovieRequest request) {
        // Phim mới chưa có MovieRun → effectiveStatus = ENDED (sẽ tự thành COMING_SOON / NOW_SHOWING
        // ngay khi admin tạo MovieRun đầu tiên). Không cần store status field nữa.
        Movie movie = Movie.builder()
                .title(request.getTitle())
                .description(request.getDescription())
                .duration(request.getDuration())
                .trailerUrl(request.getTrailerUrl())
                .director(request.getDirector())
                .cast(request.getCast())
                .language(request.getLanguage())
                .rating(request.getRating())
                .ageRating(request.getAgeRating() != null ? request.getAgeRating() : AgeRating.P)
                .genres(resolveGenres(request.getGenreIds()))
                .build();

        movieRepository.save(movie);
        log.info("Created movie: {}", movie.getTitle());
        return movieMapper.toResponse(movie, statusComputer.compute(movie, null));
    }

    @Transactional
    public MovieResponse updateMovie(Long id, MovieRequest request) {
        Movie movie = movieRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.MOVIE_NOT_FOUND));

        // Guard: KHÔNG cho đổi duration khi phim còn showtime SCHEDULED/ONGOING.
        //
        // Vì sao? Showtime.endTime = Showtime.startTime + Movie.duration (snapshot lúc tạo).
        // Nếu đổi duration sau đó:
        //   - Showtime cũ giữ endTime DB cũ (vd 11:30) → đúng với suất đã book
        //   - FE detail dùng Movie.duration MỚI để hiển thị (vd 90 phút) → user thấy "phim 90p"
        //     nhưng đến rạp 90p phòng vẫn chiếu vì showtime cũ là 120p
        //   - Hoặc tệ hơn: cascade update endTime → conflict suất kế tiếp đã book
        //
        // → Chính sách: muốn sửa duration phải xoá hết showtime active trước.
        if (!request.getDuration().equals(movie.getDuration())) {
            boolean hasActiveShowtime = showtimeRepository.existsByMovieIdAndStatusInAndStorageStateNot(
                    id, ACTIVE_SHOWTIME_STATUSES, StorageState.ARCHIVED);
            if (hasActiveShowtime) {
                throw new BusinessException(ErrorCode.INVALID_REQUEST,
                        "Không thể đổi thời lượng phim khi đang có suất chiếu — hủy các suất chiếu sắp tới trước");
            }
        }

        // Lifecycle (releaseDate, endDate, status) thuộc về MovieRun — KHÔNG đụng ở đây.
        movie.setTitle(request.getTitle());
        movie.setDescription(request.getDescription());
        movie.setDuration(request.getDuration());
        movie.setTrailerUrl(request.getTrailerUrl());
        movie.setDirector(request.getDirector());
        movie.setCast(request.getCast());
        movie.setLanguage(request.getLanguage());
        movie.setRating(request.getRating());
        if (request.getAgeRating() != null) {
            movie.setAgeRating(request.getAgeRating());
        }
        movie.setGenres(resolveGenres(request.getGenreIds()));

        movieRepository.save(movie);
        log.info("Updated movie: {}", movie.getTitle());
        return movieMapper.toResponse(movie, statusComputer.compute(movie, null));
    }

    @Transactional
    @Auditable(action = "ARCHIVE_MOVIE", entityType = "Movie")
    public void deleteMovie(Long id) {
        Movie movie = movieRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.MOVIE_NOT_FOUND));

        // Business rule: Không cho xóa phim nếu vẫn còn suất chiếu SCHEDULED/ONGOING
        // → Tránh showtime trỏ tới movie đã bị archive (FE list suất chiếu sẽ hiển thị lỗi)
        ensureNoActiveShowtimes(id);

        movie.setStorageState(StorageState.ARCHIVED);
        movieRepository.save(movie);

        // Cascade: archive review + xóa favorite để user không thấy "phim ma"
        cascadeArchiveDependencies(id);

        log.info("Soft deleted movie: {}", movie.getTitle());
    }

    @Transactional
    @Auditable(action = "RESTORE_MOVIE", entityType = "Movie")
    public MovieResponse restoreMovie(Long id) {
        Movie movie = movieRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.MOVIE_NOT_FOUND));
        movie.setStorageState(StorageState.ACTIVE);
        movieRepository.save(movie);

        // Reverse cascade: unarchive review. Favorite không restore được (đã hard delete).
        // KHÔNG auto-restore MovieRun — admin chọn restore từng đợt cần qua /api/movie-runs/{id}/restore.
        int restored = reviewRepository.unarchiveByMovieId(id);
        if (restored > 0) {
            log.info("Restored {} reviews for movie {}", restored, movie.getTitle());
        }

        log.info("Restored movie: {}", movie.getTitle());
        return movieMapper.toResponse(movie, statusComputer.compute(movie, null));
    }

    @Transactional
    public void bulkDelete(List<Long> ids) {
        // Kiểm tra từng phim — fail-fast nếu bất kỳ phim nào còn suất chiếu active
        for (Long id : ids) {
            ensureNoActiveShowtimes(id);
        }
        List<Movie> movies = movieRepository.findAllById(ids);
        movies.forEach(m -> m.setStorageState(StorageState.ARCHIVED));
        movieRepository.saveAll(movies);

        // Cascade: archive review + xóa favorite cho từng phim
        for (Long id : ids) {
            cascadeArchiveDependencies(id);
        }

        log.info("Bulk soft deleted {} movies", movies.size());
    }

    /**
     * Cascade dependencies khi phim bị archive:
     * - Archive tất cả MovieRun (đợt chiếu) của phim này (soft delete, có thể restore tay).
     * - Archive tất cả Review (soft delete, có thể restore).
     * - Hard delete tất cả UserFavorite (favorite là toggle, không cần audit).
     *
     * <p>Notification KHÔNG cần xử lý (không có FK trực tiếp đến Movie).
     *
     * <p><b>Vì sao cascade MovieRun?</b> Lifecycle thực sự ở MovieRun. Archive Movie mà giữ
     * MovieRun ACTIVE → run sẽ "mồ côi" trỏ về movie đã xoá → scheduler vẫn cập nhật status
     * cho run, FE list runs vẫn hiện. Cascade để DB nhất quán.
     */
    private void cascadeArchiveDependencies(Long movieId) {
        int runsArchived = movieRunRepository.archiveByMovieId(movieId);
        int reviewsArchived = reviewRepository.archiveByMovieId(movieId);
        int favoritesDeleted = userFavoriteRepository.deleteByMovieId(movieId);
        if (runsArchived > 0 || reviewsArchived > 0 || favoritesDeleted > 0) {
            log.info("Cascade archive for movie {}: {} runs, {} reviews archived, {} favorites deleted",
                    movieId, runsArchived, reviewsArchived, favoritesDeleted);
        }
    }

    /**
     * Helper: throw INVALID_REQUEST nếu phim còn suất chiếu SCHEDULED/ONGOING chưa archived.
     */
    private void ensureNoActiveShowtimes(Long movieId) {
        boolean hasActiveShowtime = showtimeRepository.existsByMovieIdAndStatusInAndStorageStateNot(
                movieId, ACTIVE_SHOWTIME_STATUSES, StorageState.ARCHIVED);
        if (hasActiveShowtime) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Không thể xóa phim đang có suất chiếu");
        }
    }

    @Transactional
    public void bulkRestore(List<Long> ids) {
        List<Movie> items = movieRepository.findAllById(ids);
        items.forEach(i -> i.setStorageState(StorageState.ACTIVE));
        movieRepository.saveAll(items);
        log.info("Bulk restored {} items", items.size());
    }

    @Transactional
    public MovieResponse uploadPoster(Long id, MultipartFile file) {
        Movie movie = movieRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.MOVIE_NOT_FOUND));

        if (movie.getPosterUrl() != null) {
            fileUploadService.deleteImage(movie.getPosterUrl());
        }

        String posterUrl = fileUploadService.uploadImage(file, "cinex/posters");
        movie.setPosterUrl(posterUrl);
        movieRepository.save(movie);
        log.info("Uploaded poster for movie: {}", movie.getTitle());
        return movieMapper.toResponse(movie, statusComputer.compute(movie, null));
    }

    private Set<Genre> resolveGenres(Set<Long> genreIds) {
        if (genreIds == null || genreIds.isEmpty()) {
            return new HashSet<>();
        }
        Set<Genre> genres = new HashSet<>(genreRepository.findAllById(genreIds));
        if (genres.size() != genreIds.size()) {
            throw new BusinessException(ErrorCode.GENRE_NOT_FOUND,
                    "Một hoặc nhiều thể loại không tồn tại");
        }
        return genres;
    }
}
