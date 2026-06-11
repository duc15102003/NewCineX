package com.cinex.module.user.dto;

import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
public class UpdateProfileRequest {

    @Size(max = 100, message = "Họ tên tối đa 100 ký tự")
    private String fullName;

    @Pattern(regexp = "^((0|\\+84)\\d{8,9})?$", message = "Số điện thoại không hợp lệ")
    private String phone;

    /**
     * Ngày sinh — optional. Khai báo sẽ giúp BE auto-block khi user book phim không đủ tuổi
     * (chuẩn industry — tránh phải confirm tay mỗi lần). Không khai vẫn book được nhưng phải
     * tick confirm dialog mỗi lần T13+.
     */
    @Past(message = "Ngày sinh phải là ngày trong quá khứ")
    private LocalDate dateOfBirth;
}
