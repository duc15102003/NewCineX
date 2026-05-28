package com.cinex.module.user.dto;

import com.cinex.module.auth.entity.Role;
import lombok.Builder;
import lombok.Getter;

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
    private String avatarUrl;
    private Role role;
    private boolean enabled;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
