package com.cinex.module.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ChangePasswordRequest {

    @NotBlank(message = "Mật khẩu cũ là bắt buộc")
    private String oldPassword;

    @NotBlank(message = "Mật khẩu mới là bắt buộc")
    @Pattern(
            // Pattern .{8,100} đã bao gồm length check → không cần @Size song song.
            regexp = "^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d).{8,100}$",
            message = "Mật khẩu phải ≥ 8 ký tự, có chữ HOA, chữ thường và số"
    )
    private String newPassword;

    @NotBlank(message = "Xác nhận mật khẩu là bắt buộc")
    private String confirmPassword;
}
