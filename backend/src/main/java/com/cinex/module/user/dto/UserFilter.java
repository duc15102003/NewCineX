package com.cinex.module.user.dto;

import com.cinex.module.auth.entity.Role;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Filter DTO cho admin list user.
 *
 * Phối hợp với {@link com.cinex.module.user.specification.UserSpecification#fromFilter}.
 */
@Getter
@Setter
public class UserFilter {

    // LIKE trên username/email/fullName/phone (case-insensitive)
    private String keyword;

    // Lọc theo role: USER / ADMIN
    private Role role;

    // true = active, false = disabled, null = cả 2
    private Boolean enabled;

    // Khoảng thời gian đăng ký (admin xem user mới tuần/tháng)
    private LocalDateTime createdFrom;
    private LocalDateTime createdTo;

    // Mặc định ẩn user đã xóa mềm; admin có thể bật true
    private Boolean includeDeleted;

    /**
     * RBAC scope — Service set khi user gọi là branch ADMIN. Filter:
     * (target.theater_id = scopedTheaterId) OR (target.role = USER AND theater_id IS NULL).
     * SUPER_ADMIN gọi để null → không scope, xem hết.
     */
    private Long scopedTheaterId;

    /**
     * RBAC scope — true để loại ADMIN + SUPER_ADMIN khỏi kết quả. Branch
     * ADMIN không được xem tài khoản quản trị khác.
     */
    private Boolean excludeAdminRoles;
}
