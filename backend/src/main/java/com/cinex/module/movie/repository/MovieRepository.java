package com.cinex.module.movie.repository;

import com.cinex.module.movie.entity.Movie;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

/**
 * [Specification Pattern] extends JpaSpecificationExecutor để hỗ trợ query động.
 * findAll(Specification) cho phép build WHERE clause động — ghép filter tùy ý.
 *
 * <p><b>Lưu ý sau C3:</b> 2 method {@code findByStatusAndReleaseDateLessThanEqual /
 * findByStatusAndEndDateLessThan} đã bị xoá vì lifecycle status chuyển sang MovieRun. Logic
 * tương đương giờ ở {@link com.cinex.module.movie.repository.MovieRunRepository}.
 */
public interface MovieRepository extends JpaRepository<Movie, Long>, JpaSpecificationExecutor<Movie> {

    /**
     * Override findAll(Spec, Pageable) + @EntityGraph để JOIN FETCH genres
     * trong cùng 1 query.
     *
     * Vấn đề trước đây (N+1):
     * - listMovies trả 20 phim → mỗi phim khi gọi getGenres() bắn 1 query
     *   → 1 query lấy movies + 20 query lấy genres = 21 round-trip DB.
     *
     * Sau khi có @EntityGraph(attributePaths = "genres"):
     * - Hibernate sinh LEFT JOIN movies + movie_genres + genres → chỉ 1 query.
     * - Pageable vẫn hoạt động (Hibernate dùng subquery để paginate trước khi join).
     *
     * Lưu ý: tránh dùng @EntityGraph cho MANY-TO-MANY khi list LỚN — có thể
     * dẫn tới cartesian product. Với @BatchSize trên entity là an toàn hơn,
     * tuy nhiên với page size 10-50 thì JOIN FETCH vẫn nhanh hơn N+1.
     */
    @Override
    @EntityGraph(attributePaths = {"genres"})
    Page<Movie> findAll(Specification<Movie> spec, Pageable pageable);
}
