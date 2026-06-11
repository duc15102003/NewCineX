package com.cinex.module.movie.service;

import com.cinex.common.entity.StorageState;
import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.module.movie.dto.GenreFilter;
import java.util.List;
import com.cinex.module.movie.dto.GenreRequest;
import com.cinex.module.movie.dto.GenreResponse;
import com.cinex.module.movie.entity.Genre;
import com.cinex.module.movie.entity.Movie;
import com.cinex.module.movie.mapper.GenreMapper;
import com.cinex.module.movie.repository.GenreRepository;
import com.cinex.module.movie.repository.MovieRepository;
import com.cinex.module.movie.specification.GenreSpecification;
import jakarta.persistence.criteria.Join;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class GenreService {

    private final GenreRepository genreRepository;
    private final MovieRepository movieRepository;
    private final GenreMapper genreMapper;

    /**
     * Pattern thống nhất: Filter DTO → Specification.fromFilter() → findAll(spec, pageable)
     */
    @Transactional(readOnly = true)
    public Page<GenreResponse> listGenres(GenreFilter filter, Pageable pageable) {
        var spec = GenreSpecification.fromFilter(filter);
        return genreRepository.findAll(spec, pageable)
                .map(genreMapper::toResponse);
    }

    @Transactional(readOnly = true)
    public GenreResponse getGenre(Long id) {
        Genre genre = genreRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.GENRE_NOT_FOUND));
        return genreMapper.toResponse(genre);
    }

    @Transactional
    public GenreResponse createGenre(GenreRequest request) {
        if (genreRepository.existsByName(request.getName())) {
            throw new BusinessException(ErrorCode.GENRE_EXISTED,
                    "Thể loại '" + request.getName() + "' đã tồn tại");
        }

        Genre genre = genreMapper.toEntity(request);
        genreRepository.save(genre);
        log.info("Created genre: {}", genre.getName());
        return genreMapper.toResponse(genre);
    }

    @Transactional
    public GenreResponse updateGenre(Long id, GenreRequest request) {
        Genre genre = genreRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.GENRE_NOT_FOUND));

        if (!genre.getName().equals(request.getName()) && genreRepository.existsByName(request.getName())) {
            throw new BusinessException(ErrorCode.GENRE_EXISTED,
                    "Thể loại '" + request.getName() + "' đã tồn tại");
        }

        genreMapper.updateEntity(request, genre);
        genreRepository.save(genre);
        log.info("Updated genre: {}", genre.getName());
        return genreMapper.toResponse(genre);
    }

    @Transactional
    public void deleteGenre(Long id) {
        Genre genre = genreRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.GENRE_NOT_FOUND));

        // Business rule: Không xóa thể loại đang có phim sử dụng
        // → Tránh FK orphan ở bảng movie_genres, và tránh phim mất tag thể loại đột ngột
        ensureNoActiveMovies(id);

        genre.setStorageState(StorageState.ARCHIVED);
        genreRepository.save(genre);
        log.info("Soft deleted genre: {}", genre.getName());
    }

    @Transactional
    public GenreResponse restoreGenre(Long id) {
        Genre genre = genreRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.GENRE_NOT_FOUND));
        genre.setStorageState(StorageState.ACTIVE);
        genreRepository.save(genre);
        log.info("Restored genre: {}", genre.getName());
        return genreMapper.toResponse(genre);
    }

    @Transactional
    public void bulkDelete(List<Long> ids) {
        // Kiểm tra từng genre — fail-fast nếu bất kỳ genre nào còn phim sử dụng
        for (Long id : ids) {
            ensureNoActiveMovies(id);
        }
        List<Genre> items = genreRepository.findAllById(ids);
        items.forEach(i -> i.setStorageState(StorageState.ARCHIVED));
        genreRepository.saveAll(items);
        log.info("Bulk soft deleted {} items", items.size());
    }

    /**
     * Helper: throw INVALID_REQUEST nếu genre còn phim (chưa archived) đang sử dụng.
     *
     * [Specification Pattern] Dùng JOIN với bảng movie_genres để đếm số phim
     *   tham chiếu genre này mà chưa bị soft-delete.
     */
    private void ensureNoActiveMovies(Long genreId) {
        Specification<Movie> spec = (root, query, cb) -> {
            Join<Movie, Genre> genreJoin = root.join("genres");
            return cb.and(
                    cb.equal(genreJoin.get("id"), genreId),
                    cb.notEqual(root.get("storageState"), StorageState.ARCHIVED)
            );
        };
        long count = movieRepository.count(spec);
        if (count > 0) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Không thể xóa thể loại đang có phim sử dụng");
        }
    }

    @Transactional
    public void bulkRestore(List<Long> ids) {
        List<Genre> items = genreRepository.findAllById(ids);
        items.forEach(i -> i.setStorageState(StorageState.ACTIVE));
        genreRepository.saveAll(items);
        log.info("Bulk restored {} items", items.size());
    }
}
