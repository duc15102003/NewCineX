package com.cinex.module.user.dto;

import com.cinex.module.auth.entity.Role;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UserFilter {

    private String keyword;         // Tìm theo username, email, fullName
    private Role role;              // Lọc theo role (ADMIN/USER)
    private Boolean enabled;        // Lọc theo trạng thái account
    private Boolean includeDeleted;
}
