package com.cinex.module.theater.controller;

import com.cinex.common.response.ApiResponse;
import com.cinex.common.response.PageResponse;
import com.cinex.module.theater.dto.TheaterFilter;
import com.cinex.module.theater.dto.TheaterRequest;
import com.cinex.module.theater.dto.TheaterResponse;
import com.cinex.module.theater.service.TheaterService;
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
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/theaters")
@RequiredArgsConstructor
@Tag(name = "Theater", description = "Quản lý chi nhánh rạp")
public class TheaterController {

    private final TheaterService theaterService;

    @GetMapping
    @Operation(summary = "List chi nhánh (public — user chọn rạp)")
    public ApiResponse<PageResponse<TheaterResponse>> list(
            @ModelAttribute TheaterFilter filter,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ApiResponse.ok(theaterService.list(filter, pageable));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Chi tiết 1 chi nhánh")
    public ApiResponse<TheaterResponse> get(@PathVariable Long id) {
        return ApiResponse.ok(theaterService.get(id));
    }

    @PostMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Operation(summary = "(Admin) Tạo chi nhánh mới")
    public ApiResponse<TheaterResponse> create(@Valid @RequestBody TheaterRequest request) {
        return ApiResponse.ok("Tạo chi nhánh thành công", theaterService.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Operation(summary = "(Admin) Cập nhật chi nhánh")
    public ApiResponse<TheaterResponse> update(@PathVariable Long id,
                                               @Valid @RequestBody TheaterRequest request) {
        return ApiResponse.ok("Cập nhật chi nhánh thành công", theaterService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Operation(summary = "(Admin) Lưu trữ chi nhánh (soft delete)")
    public ApiResponse<Void> archive(@PathVariable Long id) {
        theaterService.archive(id);
        return ApiResponse.ok("Đã lưu trữ chi nhánh", null);
    }

    @PostMapping("/bulk-archive")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Operation(summary = "(Admin) Lưu trữ hàng loạt")
    public ApiResponse<Void> bulkArchive(@RequestBody List<Long> ids) {
        theaterService.bulkArchive(ids);
        return ApiResponse.ok("Đã lưu trữ", null);
    }

    @PostMapping("/bulk-restore")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Operation(summary = "(Admin) Khôi phục hàng loạt")
    public ApiResponse<Void> bulkRestore(@RequestBody List<Long> ids) {
        theaterService.bulkRestore(ids);
        return ApiResponse.ok("Đã khôi phục", null);
    }
}
