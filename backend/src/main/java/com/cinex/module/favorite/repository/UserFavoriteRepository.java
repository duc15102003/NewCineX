package com.cinex.module.favorite.repository;

import com.cinex.module.favorite.entity.UserFavorite;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserFavoriteRepository extends JpaRepository<UserFavorite, Long> {

    Page<UserFavorite> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    Optional<UserFavorite> findByUserIdAndMovieId(Long userId, Long movieId);

    boolean existsByUserIdAndMovieId(Long userId, Long movieId);
}
