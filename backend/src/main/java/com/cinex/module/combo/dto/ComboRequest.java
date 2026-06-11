package com.cinex.module.combo.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.List;

@Getter
@Setter
public class ComboRequest {

    /** Chi nhánh sở hữu combo. Branch ADMIN: service override từ JWT. */
    @NotNull(message = "Chi nhánh là bắt buộc")
    private Long theaterId;

    @NotBlank(message = "Mã combo là bắt buộc")
    @Size(max = 50)
    @Pattern(regexp = "^[A-Z0-9-]+$", message = "Mã chỉ chữ hoa, số, gạch ngang")
    private String code;

    @NotBlank(message = "Tên combo là bắt buộc")
    @Size(max = 200)
    private String name;

    @Size(max = 500)
    private String description;

    @Size(max = 500)
    private String imageUrl;

    @NotNull(message = "Giá combo là bắt buộc")
    @DecimalMin(value = "0", inclusive = false, message = "Giá phải > 0")
    private BigDecimal price;

    private boolean active = true;

    @Valid
    @NotEmpty(message = "Combo phải có ít nhất 1 snack")
    private List<ComboItemRequest> items;
}
