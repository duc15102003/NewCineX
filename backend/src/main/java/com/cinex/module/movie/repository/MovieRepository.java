package com.cinex.module.movie.repository;

import com.cinex.module.movie.entity.Movie;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

/**
 * [Specification Pattern] extends JpaSpecificationExecutor để hỗ trợ query động.
 * findAll(Specification) cho phép build WHERE clause động — ghép filter tùy ý.
 */
public interface MovieRepository extends JpaRepository<Movie, Long>, JpaSpecificationExecutor<Movie> {
}
