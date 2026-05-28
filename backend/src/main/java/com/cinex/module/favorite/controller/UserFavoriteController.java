package com.cinex.module.favorite.controller;

import com.cinex.common.response.ApiResponse;
import com.cinex.common.response.PageResponse;
import com.cinex.common.service.SecurityService;
import org.springframework.security.access.prepost.PreAuthorize;
import com.cinex.module.favorite.dto.FavoriteMovieResponse;
import com.cinex.module.favorite.service.UserFavoriteService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
@Tag(name = "Favorites", description = "User favorite movies")
public class UserFavoriteController {

    private final UserFavoriteService favoriteService;
    private final SecurityService securityService;

    @GetMapping("/users/me/favorites")
    @Operation(summary = "List my favorite movies")
    public ApiResponse<PageResponse<FavoriteMovieResponse>> getMyFavorites(
            @PageableDefault(size = 20) Pageable pageable) {
        Long userId = securityService.getCurrentUserId();
        return ApiResponse.ok(PageResponse.from(favoriteService.getMyFavorites(userId, pageable)));
    }

    @PostMapping("/movies/{movieId}/favorite")
    @Operation(summary = "Add movie to favorites")
    public ApiResponse<Void> addFavorite(@PathVariable Long movieId) {
        Long userId = securityService.getCurrentUserId();
        favoriteService.addFavorite(userId, movieId);
        return ApiResponse.ok("Added to favorites", null);
    }

    @DeleteMapping("/movies/{movieId}/favorite")
    @Operation(summary = "Remove movie from favorites")
    public ApiResponse<Void> removeFavorite(@PathVariable Long movieId) {
        Long userId = securityService.getCurrentUserId();
        favoriteService.removeFavorite(userId, movieId);
        return ApiResponse.ok("Removed from favorites", null);
    }

}
