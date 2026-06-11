package com.cinex.module.snack.controller;

import com.cinex.common.dto.BulkDeleteRequest;
import com.cinex.common.response.ApiResponse;
import com.cinex.common.response.PageResponse;
import com.cinex.module.snack.dto.SnackFilter;
import com.cinex.module.snack.dto.SnackRequest;
import com.cinex.module.snack.dto.SnackResponse;
import com.cinex.module.snack.service.SnackService;
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
@RequestMapping("/api/snacks")
@RequiredArgsConstructor
@Tag(name = "Snack", description = "Snack management")
public class SnackController {

    private final SnackService snackService;

    /**
     * GET /api/snacks?keyword=&includeDeleted=false&page=0&size=20
     * Public: chỉ trả snack available + chưa bị xóa (không truyền filter).
     * Admin: truyền includeDeleted=true để xem cả snack đã xóa, keyword để tìm kiếm.
     */
    @GetMapping
    @Operation(summary = "List snacks (public or admin with filter)")
    public ApiResponse<PageResponse<SnackResponse>> listSnacks(
            SnackFilter filter,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        boolean isAdminContext = Boolean.TRUE.equals(filter.getIncludeDeleted())
                || (filter.getKeyword() != null && !filter.getKeyword().isBlank());
        if (isAdminContext) {
            return ApiResponse.ok(PageResponse.from(snackService.listSnacksAdmin(filter, pageable)));
        }
        // Public path — vẫn cần honor theaterId vì ComboFormDialog / public POS lọc snack
        // theo chi nhánh; trước đây bị bypass → combo của CN A vô tình chọn được snack CN B.
        return ApiResponse.ok(PageResponse.from(snackService.listSnacksPublic(filter, pageable)));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get snack detail")
    public ApiResponse<SnackResponse> getSnack(@PathVariable Long id) {
        return ApiResponse.ok(snackService.getSnack(id));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) Create a new snack")
    public ApiResponse<SnackResponse> createSnack(@Valid @RequestBody SnackRequest request) {
        return ApiResponse.ok("Snack created", snackService.createSnack(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) Update a snack")
    public ApiResponse<SnackResponse> updateSnack(
            @PathVariable Long id,
            @Valid @RequestBody SnackRequest request) {
        return ApiResponse.ok("Snack updated", snackService.updateSnack(id, request));
    }

    @PostMapping("/{id}/image")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) Upload snack image")
    public ApiResponse<SnackResponse> uploadImage(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file) {
        return ApiResponse.ok("Image uploaded", snackService.uploadImage(id, file));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) Soft delete a snack")
    public ApiResponse<Void> deleteSnack(@PathVariable Long id) {
        snackService.deleteSnack(id);
        return ApiResponse.ok("Snack deleted", null);
    }

    @PostMapping("/{id}/restore")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) Restore a soft-deleted snack")
    public ApiResponse<SnackResponse> restoreSnack(@PathVariable Long id) {
        return ApiResponse.ok("Snack restored", snackService.restoreSnack(id));
    }

    @PostMapping("/bulk-delete")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) Bulk soft delete")
    public ApiResponse<Void> bulkDelete(@Valid @RequestBody BulkDeleteRequest request) {
        snackService.bulkDelete(request.getIds());
        return ApiResponse.ok("Deleted " + request.getIds().size() + " items", null);
    }

    @PostMapping("/bulk-restore")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) Bulk restore")
    public ApiResponse<Void> bulkRestore(@Valid @RequestBody BulkDeleteRequest request) {
        snackService.bulkRestore(request.getIds());
        return ApiResponse.ok("Restored " + request.getIds().size() + " items", null);
    }
}
