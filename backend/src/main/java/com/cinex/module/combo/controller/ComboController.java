package com.cinex.module.combo.controller;

import com.cinex.common.response.ApiResponse;
import com.cinex.module.combo.dto.ComboRequest;
import com.cinex.module.combo.dto.ComboResponse;
import com.cinex.module.combo.service.ComboService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
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

import java.util.List;

@RestController
@RequestMapping("/api/combos")
@RequiredArgsConstructor
@Tag(name = "Combo", description = "Combo snack bundle")
public class ComboController {

    private final ComboService comboService;

    @GetMapping("/public")
    @Operation(summary = "List combo ACTIVE (cho FE user xem ở POS / booking add-on)")
    public ApiResponse<List<ComboResponse>> listActive(
            @RequestParam(required = false) Long theaterId) {
        // Combo PER-THEATER: nếu FE truyền theaterId → chỉ trả combo của rạp đó (đúng pattern
        // POS quầy + booking add-on theo rạp đang chiếu). Bỏ qua → trả tất cả (backward-compat).
        if (theaterId != null) {
            return ApiResponse.ok(comboService.listActiveByTheater(theaterId));
        }
        return ApiResponse.ok(comboService.listActive());
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) List combo có phân trang, filter theo theaterId")
    public ApiResponse<Page<ComboResponse>> list(
            @RequestParam(required = false) Long theaterId,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ApiResponse.ok(comboService.list(theaterId, pageable));
    }

    @GetMapping("/{id}")
    public ApiResponse<ComboResponse> get(@PathVariable Long id) {
        return ApiResponse.ok(comboService.get(id));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<ComboResponse> create(@Valid @RequestBody ComboRequest request) {
        return ApiResponse.ok("Tạo combo thành công", comboService.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<ComboResponse> update(@PathVariable Long id, @Valid @RequestBody ComboRequest request) {
        return ApiResponse.ok("Cập nhật combo thành công", comboService.update(id, request));
    }

    @PostMapping("/{id}/image")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) Upload combo image")
    public ApiResponse<ComboResponse> uploadImage(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file) {
        return ApiResponse.ok("Image uploaded", comboService.uploadImage(id, file));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> archive(@PathVariable Long id) {
        comboService.archive(id);
        return ApiResponse.ok("Đã lưu trữ combo", null);
    }

    @PostMapping("/bulk-archive")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> bulkArchive(@RequestBody List<Long> ids) {
        comboService.bulkArchive(ids);
        return ApiResponse.ok("Đã lưu trữ", null);
    }

    @PostMapping("/bulk-restore")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> bulkRestore(@RequestBody List<Long> ids) {
        comboService.bulkRestore(ids);
        return ApiResponse.ok("Đã khôi phục", null);
    }
}
