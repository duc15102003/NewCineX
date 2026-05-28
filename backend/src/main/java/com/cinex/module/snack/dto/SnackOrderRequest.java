package com.cinex.module.snack.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;
import java.util.List;

@Getter
@Setter
public class SnackOrderRequest {

    @NotEmpty(message = "Vui lòng chọn ít nhất 1 món")
    @Valid
    private List<SnackOrderItemRequest> items;

    private String note;
}
