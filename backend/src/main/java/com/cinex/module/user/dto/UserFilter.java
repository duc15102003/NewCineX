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
}
