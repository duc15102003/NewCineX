package com.cinex.module.favorite.service;

import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.module.auth.entity.User;
import com.cinex.module.auth.repository.UserRepository;
import com.cinex.module.favorite.dto.FavoriteMovieResponse;
import com.cinex.module.favorite.entity.UserFavorite;
import com.cinex.module.favorite.repository.UserFavoriteRepository;
import com.cinex.module.movie.entity.Movie;
import com.cinex.module.movie.repository.MovieRepository;
import com.cinex.module.movie.service.MovieStatusComputer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserFavoriteService {

    private final UserFavoriteRepository favoriteRepository;
    private final UserRepository userRepository;
    private final MovieRepository movieRepository;
    private final MovieStatusComputer movieStatusComputer;

    @Transactional(readOnly = true)
    public Page<FavoriteMovieResponse> getMyFavorites(Long userId, Pageable pageable) {
        // Favorite list = aggregate qua TẤT CẢ chi nhánh (user không có context theater) → theaterId=null.
        return favoriteRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable)
                .map(fav -> FavoriteMovieResponse.builder()
                        .movieId(fav.getMovie().getId())
                        .title(fav.getMovie().getTitle())
                        .posterUrl(fav.getMovie().getPosterUrl())
                        .duration(fav.getMovie().getDuration())
                        .rating(fav.getMovie().getRating())
                        .status(movieStatusComputer.compute(fav.getMovie(), null))
                        .favoritedAt(fav.getCreatedAt())
                        .build());
    }

    @Transactional
    public void addFavorite(Long userId, Long movieId) {
        if (favoriteRepository.existsByUserIdAndMovieId(userId, movieId)) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST, "Phim đã có trong danh sách yêu thích");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
        Movie movie = movieRepository.findById(movieId)
                .orElseThrow(() -> new BusinessException(ErrorCode.MOVIE_NOT_FOUND));

        UserFavorite favorite = UserFavorite.builder()
                .user(user)
                .movie(movie)
                .build();
        favoriteRepository.save(favorite);
        log.info("User {} added movie {} to favorites", user.getUsername(), movie.getTitle());
    }

    @Transactional
    public void removeFavorite(Long userId, Long movieId) {
        UserFavorite favorite = favoriteRepository.findByUserIdAndMovieId(userId, movieId)
                .orElseThrow(() -> new BusinessException(ErrorCode.INVALID_REQUEST, "Movie not in favorites"));
        favoriteRepository.delete(favorite);
        log.info("User {} removed movie {} from favorites", userId, movieId);
    }

    @Transactional(readOnly = true)
    public boolean isFavorited(Long userId, Long movieId) {
        return favoriteRepository.existsByUserIdAndMovieId(userId, movieId);
    }
}
