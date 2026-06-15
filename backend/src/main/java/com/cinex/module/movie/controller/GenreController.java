package com.cinex.module.movie.controller;

import com.cinex.common.dto.BulkDeleteRequest;
import com.cinex.common.response.ApiResponse;
import com.cinex.common.response.PageResponse;
import com.cinex.module.movie.dto.GenreFilter;
import com.cinex.module.movie.dto.GenreRequest;
import com.cinex.module.movie.dto.GenreResponse;
import com.cinex.module.movie.service.GenreService;
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
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/genres")
@RequiredArgsConstructor
@Tag(name = "Genre", description = "Movie genres")
public class GenreController {

    private final GenreService genreService;

    @GetMapping
    @Operation(summary = "List genres with filter")
    public ApiResponse<PageResponse<GenreResponse>> listGenres(
            GenreFilter filter,
            @PageableDefault(size = 50, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ApiResponse.ok(PageResponse.from(genreService.listGenres(filter, pageable)));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get genre detail")
    public ApiResponse<GenreResponse> getGenre(@PathVariable Long id) {
        return ApiResponse.ok(genreService.getGenre(id));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    @Operation(summary = "(Admin) Create a new genre")
    public ApiResponse<GenreResponse> createGenre(@Valid @RequestBody GenreRequest request) {
        return ApiResponse.ok("Genre created", genreService.createGenre(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    @Operation(summary = "(Admin) Update a genre")
    public ApiResponse<GenreResponse> updateGenre(
            @PathVariable Long id,
            @Valid @RequestBody GenreRequest request) {
        return ApiResponse.ok("Genre updated", genreService.updateGenre(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    @Operation(summary = "(Admin) Soft delete a genre")
    public ApiResponse<Void> deleteGenre(@PathVariable Long id) {
        genreService.deleteGenre(id);
        return ApiResponse.ok("Genre deleted", null);
    }

    @PostMapping("/{id}/restore")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    @Operation(summary = "(Admin) Restore a soft-deleted genre")
    public ApiResponse<GenreResponse> restoreGenre(@PathVariable Long id) {
        return ApiResponse.ok("Genre restored", genreService.restoreGenre(id));
    }

    @PostMapping("/bulk-delete")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    @Operation(summary = "(Admin) Bulk soft delete")
    public ApiResponse<Void> bulkDelete(@Valid @RequestBody BulkDeleteRequest request) {
        genreService.bulkDelete(request.getIds());
        return ApiResponse.ok("Deleted " + request.getIds().size() + " items", null);
    }

    @PostMapping("/bulk-restore")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'ADMIN')")
    @Operation(summary = "(Admin) Bulk restore")
    public ApiResponse<Void> bulkRestore(@Valid @RequestBody BulkDeleteRequest request) {
        genreService.bulkRestore(request.getIds());
        return ApiResponse.ok("Restored " + request.getIds().size() + " items", null);
    }
}
