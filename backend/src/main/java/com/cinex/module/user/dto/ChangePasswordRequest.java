package com.cinex.module.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ChangePasswordRequest {

    @NotBlank(message = "Mật khẩu cũ là bắt buộc")
    private String oldPassword;

    @NotBlank(message = "Mật khẩu mới là bắt buộc")
    @Size(min = 6, max = 100, message = "Mật khẩu từ 6-100 ký tự")
    private String newPassword;

    @NotBlank(message = "Xác nhận mật khẩu là bắt buộc")
    private String confirmPassword;
}
