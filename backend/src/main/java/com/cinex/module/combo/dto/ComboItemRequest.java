package com.cinex.module.combo.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ComboItemRequest {

    @NotNull(message = "Snack là bắt buộc")
    private Long snackId;

    @NotNull
    @Min(value = 1, message = "Số lượng phải ít nhất 1")
    private Integer quantity;
}
