package com.cinex.module.favorite.repository;

import com.cinex.module.favorite.entity.UserFavorite;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface UserFavoriteRepository extends JpaRepository<UserFavorite, Long> {

    Page<UserFavorite> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    Optional<UserFavorite> findByUserIdAndMovieId(Long userId, Long movieId);

    boolean existsByUserIdAndMovieId(Long userId, Long movieId);

    /**
     * Batch hard-delete tất cả favorite của 1 phim.
     *
     * <p>Dùng khi admin archive Movie → user không còn thấy phim trong "Yêu thích" của mình.
     * Hard delete OK vì favorite là toggle (user có thể add lại nếu phim được restore).
     */
    @Modifying
    @Query("DELETE FROM UserFavorite uf WHERE uf.movie.id = :movieId")
    int deleteByMovieId(@Param("movieId") Long movieId);
}
