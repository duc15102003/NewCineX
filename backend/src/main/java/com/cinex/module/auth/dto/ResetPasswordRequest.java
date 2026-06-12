package com.cinex.module.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ResetPasswordRequest {

    @NotBlank(message = "Token là bắt buộc")
    private String token;

    @NotBlank(message = "Mật khẩu mới là bắt buộc")
    @Pattern(
            // Pattern .{8,100} đã bao gồm length check → KHÔNG cần @Size song song
            // (tránh 2 message duplicate: 1 tiếng Việt từ Pattern + 1 tiếng Anh từ Size mặc định).
            regexp = "^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d).{8,100}$",
            message = "Mật khẩu phải ≥ 8 ký tự, có chữ HOA, chữ thường và số"
    )
    private String newPassword;

    @NotBlank(message = "Xác nhận mật khẩu là bắt buộc")
    private String confirmPassword;
}
