package com.cinex.module.user.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateProfileRequest {

    @Size(max = 100, message = "Họ tên tối đa 100 ký tự")
    private String fullName;

    @Pattern(regexp = "^((0|\\+84)\\d{8,9})?$", message = "Số điện thoại không hợp lệ")
    private String phone;
}
