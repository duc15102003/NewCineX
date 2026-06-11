package com.cinex.module.snack.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class SnackRequest {

    /**
     * Chi nhánh sở hữu snack. Bắt buộc khi tạo bởi SUPER_ADMIN xem "Tất cả".
     * Branch ADMIN: service auto-override từ JWT (FE có thể bỏ qua hoặc gửi cùng).
     */
    @NotNull(message = "Chi nhánh là bắt buộc")
    private Long theaterId;

    @NotBlank(message = "Tên đồ ăn là bắt buộc")
    @Size(max = 100, message = "Tên đồ ăn tối đa 100 ký tự")
    private String name;

    @Size(max = 255, message = "Mô tả tối đa 255 ký tự")
    private String description;

    @NotNull(message = "Giá là bắt buộc")
    @Min(value = 0, message = "Giá không được âm")
    private BigDecimal price;

    @Size(max = 500, message = "URL ảnh tối đa 500 ký tự")
    private String imageUrl;

    @Size(max = 50, message = "Danh mục tối đa 50 ký tự")
    private String category;

    private Boolean available;
}
