package com.cinex.module.movie.controller;

import com.cinex.common.dto.BulkDeleteRequest;
import com.cinex.common.response.ApiResponse;
import com.cinex.common.response.PageResponse;
import com.cinex.module.movie.dto.MovieFilter;
import com.cinex.module.movie.dto.MovieListResponse;
import com.cinex.module.movie.dto.MovieRequest;
import com.cinex.module.movie.dto.MovieResponse;
import com.cinex.module.movie.service.MovieService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/movies")
@RequiredArgsConstructor
@Tag(name = "Movie", description = "Movie CRUD, search, filter")
public class MovieController {

    private final MovieService movieService;

    /**
     * Spring tự bind query params vào MovieFilter DTO:
     * GET /api/movies?keyword=Avengers&status=NOW_SHOWING&genreId=1&includeDeleted=true&page=0&size=20
     */
    @GetMapping
    @Operation(summary = "List movies with search and filter")
    public ApiResponse<PageResponse<MovieListResponse>> listMovies(
            MovieFilter filter,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ApiResponse.ok(movieService.listMovies(filter, pageable));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get movie detail")
    public ApiResponse<MovieResponse> getMovie(@PathVariable Long id) {
        return ApiResponse.ok(movieService.getMovie(id));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    @Operation(summary = "(Admin) Create a new movie")
    public ApiResponse<MovieResponse> createMovie(@Valid @RequestBody MovieRequest request) {
        return ApiResponse.ok("Movie created", movieService.createMovie(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    @Operation(summary = "(Admin) Update a movie")
    public ApiResponse<MovieResponse> updateMovie(
            @PathVariable Long id,
            @Valid @RequestBody MovieRequest request) {
        return ApiResponse.ok("Movie updated", movieService.updateMovie(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    @Operation(summary = "(Admin) Soft delete a movie")
    public ApiResponse<Void> deleteMovie(@PathVariable Long id) {
        movieService.deleteMovie(id);
        return ApiResponse.ok("Movie deleted", null);
    }

    @PostMapping("/{id}/restore")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    @Operation(summary = "(Admin) Restore a soft-deleted movie")
    public ApiResponse<MovieResponse> restoreMovie(@PathVariable Long id) {
        return ApiResponse.ok("Movie restored", movieService.restoreMovie(id));
    }

    @PostMapping("/bulk-delete")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    @Operation(summary = "(Admin) Bulk soft delete movies")
    public ApiResponse<Void> bulkDelete(@Valid @RequestBody BulkDeleteRequest request) {
        movieService.bulkDelete(request.getIds());
        return ApiResponse.ok("Deleted " + request.getIds().size() + " movies", null);
    }

    @PostMapping("/bulk-restore")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    @Operation(summary = "(Admin) Bulk restore")
    public ApiResponse<Void> bulkRestore(@Valid @RequestBody BulkDeleteRequest request) {
        movieService.bulkRestore(request.getIds());
        return ApiResponse.ok("Restored " + request.getIds().size() + " items", null);
    }

    @PostMapping("/{id}/poster")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    @Operation(summary = "(Admin) Upload movie poster")
    public ApiResponse<MovieResponse> uploadPoster(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file) {
        return ApiResponse.ok("Poster uploaded", movieService.uploadPoster(id, file));
    }
}
