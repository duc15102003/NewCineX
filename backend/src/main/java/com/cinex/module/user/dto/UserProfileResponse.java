package com.cinex.module.user.dto;

import com.cinex.module.auth.entity.Role;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Builder
public class UserProfileResponse {

    private Long id;
    private String storageState;
    private String username;
    private String email;
    private String fullName;
    private String phone;
    /** Ngày sinh — null nếu user chưa khai báo. */
    private LocalDate dateOfBirth;
    private String avatarUrl;
    private Role role;
    private boolean enabled;
    private boolean emailVerified;

    /** Chi nhánh gán (chỉ có cho ADMIN). Null cho USER + SUPER_ADMIN. */
    private Long theaterId;
    private String theaterName;
    private String theaterCity;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
