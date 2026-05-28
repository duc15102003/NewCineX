package com.cinex.module.user.dto;

import com.cinex.module.auth.entity.Role;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateRoleRequest {

    @NotNull(message = "Vai trò là bắt buộc")
    private Role role;
}
