package com.cinex.module.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RegisterRequest {

    @NotBlank(message = "Tên đăng nhập là bắt buộc")
    @Pattern(
            regexp = "^[a-zA-Z0-9_.]{3,50}$",
            message = "Username chỉ chấp nhận chữ cái không dấu, số, dấu chấm và gạch dưới"
    )
    private String username;

    @NotBlank(message = "Email là bắt buộc")
    @Email(message = "Email không hợp lệ")
    private String email;

    @NotBlank(message = "Mật khẩu là bắt buộc")
    @Pattern(
            // Pattern .{8,100} đã bao gồm length check → không cần @Size song song.
            regexp = "^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d).{8,100}$",
            message = "Mật khẩu phải ≥ 8 ký tự, có chữ HOA, chữ thường và số"
    )
    private String password;

    private String fullName;
}
