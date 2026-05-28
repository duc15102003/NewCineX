package com.cinex.module.user.dto;

import com.cinex.module.auth.entity.Role;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AdminUpdateUserRequest {

    private String fullName;

    @Pattern(regexp = "^((0|\\+84)\\d{8,9})?$", message = "Số điện thoại không hợp lệ")
    private String phone;

    @NotNull(message = "Vai trò là bắt buộc")
    private Role role;

    @NotNull(message = "Trạng thái là bắt buộc")
    private Boolean enabled;
}
