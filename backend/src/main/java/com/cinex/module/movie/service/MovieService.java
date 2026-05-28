package com.cinex.module.movie.service;

import com.cinex.common.entity.StorageState;
import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.common.response.PageResponse;
import com.cinex.common.service.FileUploadService;
import com.cinex.module.movie.dto.MovieFilter;
import com.cinex.module.movie.dto.MovieListResponse;
import com.cinex.module.movie.dto.MovieRequest;
import com.cinex.module.movie.dto.MovieResponse;
import com.cinex.module.movie.entity.Genre;
import com.cinex.module.movie.entity.Movie;
import com.cinex.module.movie.mapper.MovieMapper;
import com.cinex.module.movie.repository.GenreRepository;
import com.cinex.module.movie.repository.MovieRepository;
import com.cinex.module.movie.specification.MovieSpecification;
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
    private final MovieMapper movieMapper;
    private final FileUploadService fileUploadService;

    /**
     * Danh sách phim — nhận Filter DTO, build Specification tự động.
     * Pattern thống nhất: Filter DTO → Specification.fromFilter() → findAll(spec, pageable)
     */
    @Transactional(readOnly = true)
    public PageResponse<MovieListResponse> listMovies(MovieFilter filter, Pageable pageable) {
        var spec = MovieSpecification.fromFilter(filter);
        Page<MovieListResponse> page = movieRepository.findAll(spec, pageable)
                .map(movieMapper::toListResponse);
        return PageResponse.from(page);
    }

    @Transactional(readOnly = true)
    public MovieResponse getMovie(Long id) {
        Movie movie = movieRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.MOVIE_NOT_FOUND));
        return movieMapper.toResponse(movie);
    }

    @Transactional
    public MovieResponse createMovie(MovieRequest request) {
        // Ngày kết thúc chiếu phải sau ngày phát hành
        if (request.getEndDate() != null && request.getReleaseDate() != null
                && request.getEndDate().isBefore(request.getReleaseDate())) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Ngày kết thúc chiếu phải sau ngày phát hành");
        }

        Movie movie = Movie.builder()
                .title(request.getTitle())
                .description(request.getDescription())
                .duration(request.getDuration())
                .releaseDate(request.getReleaseDate())
                .endDate(request.getEndDate())
                .trailerUrl(request.getTrailerUrl())
                .director(request.getDirector())
                .cast(request.getCast())
                .language(request.getLanguage())
                .rating(request.getRating())
                .status(request.getStatus())
                .genres(resolveGenres(request.getGenreIds()))
                .build();

        movieRepository.save(movie);
        log.info("Created movie: {}", movie.getTitle());
        return movieMapper.toResponse(movie);
    }

    @Transactional
    public MovieResponse updateMovie(Long id, MovieRequest request) {
        Movie movie = movieRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.MOVIE_NOT_FOUND));

        // Ngày kết thúc chiếu phải sau ngày phát hành
        if (request.getEndDate() != null && request.getReleaseDate() != null
                && request.getEndDate().isBefore(request.getReleaseDate())) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Ngày kết thúc chiếu phải sau ngày phát hành");
        }

        movie.setTitle(request.getTitle());
        movie.setDescription(request.getDescription());
        movie.setDuration(request.getDuration());
        movie.setReleaseDate(request.getReleaseDate());
        movie.setEndDate(request.getEndDate());
        movie.setTrailerUrl(request.getTrailerUrl());
        movie.setDirector(request.getDirector());
        movie.setCast(request.getCast());
        movie.setLanguage(request.getLanguage());
        movie.setRating(request.getRating());
        movie.setStatus(request.getStatus());
        movie.setGenres(resolveGenres(request.getGenreIds()));

        movieRepository.save(movie);
        log.info("Updated movie: {}", movie.getTitle());
        return movieMapper.toResponse(movie);
    }

    @Transactional
    public void deleteMovie(Long id) {
        Movie movie = movieRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.MOVIE_NOT_FOUND));
        movie.setStorageState(StorageState.ARCHIVED);
        movieRepository.save(movie);
        log.info("Soft deleted movie: {}", movie.getTitle());
    }

    @Transactional
    public MovieResponse restoreMovie(Long id) {
        Movie movie = movieRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.MOVIE_NOT_FOUND));
        movie.setStorageState(StorageState.ACTIVE);
        movieRepository.save(movie);
        log.info("Restored movie: {}", movie.getTitle());
        return movieMapper.toResponse(movie);
    }

    @Transactional
    public void bulkDelete(List<Long> ids) {
        List<Movie> movies = movieRepository.findAllById(ids);
        movies.forEach(m -> m.setStorageState(StorageState.ARCHIVED));
        movieRepository.saveAll(movies);
        log.info("Bulk soft deleted {} movies", movies.size());
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
        return movieMapper.toResponse(movie);
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
