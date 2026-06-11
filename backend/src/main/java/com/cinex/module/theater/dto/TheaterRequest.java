package com.cinex.module.theater.dto;

import com.cinex.module.theater.entity.TheaterStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * Request tạo / cập nhật {@link com.cinex.module.theater.entity.Theater}.
 */
@Getter
@Setter
public class TheaterRequest {

    /** Mã chi nhánh — chỉ chữ hoa, số, dấu gạch ngang. VD "CNX-HN-LOTTE". */
    @NotBlank(message = "Mã chi nhánh là bắt buộc")
    @Size(max = 30, message = "Mã tối đa 30 ký tự")
    @Pattern(regexp = "^[A-Z0-9-]+$", message = "Mã chỉ gồm chữ hoa, số, dấu gạch ngang")
    private String code;

    @NotBlank(message = "Tên chi nhánh là bắt buộc")
    @Size(max = 200, message = "Tên tối đa 200 ký tự")
    private String name;

    @NotBlank(message = "Địa chỉ là bắt buộc")
    @Size(max = 500, message = "Địa chỉ tối đa 500 ký tự")
    private String address;

    @NotBlank(message = "Thành phố là bắt buộc")
    @Size(max = 100, message = "Thành phố tối đa 100 ký tự")
    private String city;

    @Size(max = 30, message = "Hotline tối đa 30 ký tự")
    private String hotline;

    @Size(max = 100, message = "Email tối đa 100 ký tự")
    private String email;

    /** Vĩ độ — optional, dùng cho "rạp gần nhất". */
    private BigDecimal latitude;
    private BigDecimal longitude;

    @NotNull(message = "Trạng thái là bắt buộc")
    private TheaterStatus status;
}
