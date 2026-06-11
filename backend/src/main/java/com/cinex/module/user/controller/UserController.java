package com.cinex.module.user.controller;

import com.cinex.common.response.ApiResponse;
import com.cinex.common.response.PageResponse;
import com.cinex.module.user.dto.AdminUpdateUserRequest;
import com.cinex.module.user.dto.ChangePasswordRequest;
import com.cinex.module.user.dto.UpdateProfileRequest;
import com.cinex.module.user.dto.UpdateRoleRequest;
import com.cinex.module.user.dto.UserFilter;
import com.cinex.module.user.dto.UserProfileResponse;
import com.cinex.module.user.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
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
@RequestMapping("/api/users")
@RequiredArgsConstructor
@Tag(name = "User", description = "User profile management")
public class UserController {

    private final UserService userService;

    @GetMapping("/me")
    @Operation(summary = "Get current user profile")
    public ApiResponse<UserProfileResponse> getProfile() {
        return ApiResponse.ok(userService.getProfile());
    }

    @PutMapping("/me")
    @Operation(summary = "Update current user profile")
    public ApiResponse<UserProfileResponse> updateProfile(@Valid @RequestBody UpdateProfileRequest request) {
        return ApiResponse.ok("Profile updated", userService.updateProfile(request));
    }

    @PutMapping("/me/password")
    @Operation(summary = "Change password")
    public ApiResponse<Void> changePassword(@Valid @RequestBody ChangePasswordRequest request,
                                            HttpServletRequest httpRequest) {
        userService.changePassword(request, httpRequest);
        return ApiResponse.ok("Password changed successfully", null);
    }

    @PostMapping("/me/avatar")
    @Operation(summary = "Upload avatar image")
    public ApiResponse<UserProfileResponse> uploadAvatar(@RequestParam("file") MultipartFile file) {
        return ApiResponse.ok("Avatar uploaded", userService.uploadAvatar(file));
    }

    // ===== SUPER_ADMIN APIs (User management) =====
    //
    // Vì sao chỉ SUPER_ADMIN, không phải ADMIN thường?
    // - Branch ADMIN không có lý do nghiệp vụ để quản user (HR/HQ task).
    // - Branch ADMIN có thể abuse: tạo USER role giả mạo / promote chính mình → leak data.
    // - Pattern industry: HR portal tách khỏi Branch admin panel. CineX dùng chung URL
    //   nhưng chỉ SUPER_ADMIN truy cập được.

    /**
     * GET /api/users?keyword=vanan&role=ADMIN&enabled=true&includeDeleted=false&page=0&size=20
     */
    @GetMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Operation(summary = "(Admin) List users with filter")
    public ApiResponse<PageResponse<UserProfileResponse>> listUsers(
            UserFilter filter,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ApiResponse.ok(PageResponse.from(userService.listUsers(filter, pageable)));
    }

    @PutMapping("/{id}/role")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Operation(summary = "(Admin) Update user role")
    public ApiResponse<UserProfileResponse> updateRole(
            @PathVariable Long id,
            @Valid @RequestBody UpdateRoleRequest request) {
        return ApiResponse.ok("Role updated", userService.updateRole(id, request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Operation(summary = "(Admin) Update user info, role and enabled status")
    public ApiResponse<UserProfileResponse> adminUpdateUser(
            @PathVariable Long id,
            @Valid @RequestBody AdminUpdateUserRequest request) {
        return ApiResponse.ok("User updated", userService.adminUpdateUser(id, request));
    }
}
