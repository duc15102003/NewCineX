package com.cinex.module.movie.controller;

import com.cinex.common.response.ApiResponse;
import com.cinex.module.movie.dto.MovieRunRequest;
import com.cinex.module.movie.dto.MovieRunResponse;
import com.cinex.module.movie.service.MovieRunService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
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

import java.util.List;

/**
 * REST endpoints quản lý đợt chiếu ({@link com.cinex.module.movie.entity.MovieRun}).
 *
 * <p>GET public — FE trang chi tiết phim cần hiển thị lịch sử các đợt chiếu (FIRST_RUN, REISSUE,
 * FESTIVAL...). Mutation chỉ ADMIN.
 */
@RestController
@RequestMapping("/api/movie-runs")
@RequiredArgsConstructor
@Tag(name = "MovieRun", description = "Đợt chiếu phim — Movie có nhiều run (FIRST_RUN, REISSUE, FESTIVAL...)")
public class MovieRunController {

    private final MovieRunService movieRunService;

    /**
     * List runs của 1 phim. Public — phục vụ trang chi tiết phim.
     *
     * <p>Param {@code movieId} bắt buộc để tránh trả toàn bộ runs trong DB (rất nặng nếu sau này
     * có hàng nghìn phim, mỗi phim 3-5 run).
     */
    @GetMapping
    @Operation(summary = "List MovieRun của 1 phim (mới nhất trước), filter theo theaterId")
    public ApiResponse<List<MovieRunResponse>> listByMovie(
            @RequestParam Long movieId,
            @RequestParam(required = false) Long theaterId) {
        return ApiResponse.ok(movieRunService.listByMovie(movieId, theaterId));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Chi tiết 1 đợt chiếu")
    public ApiResponse<MovieRunResponse> getRun(@PathVariable Long id) {
        return ApiResponse.ok(movieRunService.getRun(id));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) Tạo đợt chiếu mới")
    public ApiResponse<MovieRunResponse> create(@Valid @RequestBody MovieRunRequest request) {
        return ApiResponse.ok("Tạo đợt chiếu thành công", movieRunService.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) Cập nhật đợt chiếu")
    public ApiResponse<MovieRunResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody MovieRunRequest request) {
        return ApiResponse.ok("Cập nhật đợt chiếu thành công", movieRunService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) Xoá mềm 1 đợt chiếu")
    public ApiResponse<Void> archive(@PathVariable Long id) {
        movieRunService.archive(id);
        return ApiResponse.ok("Đã xoá đợt chiếu", null);
    }
}
