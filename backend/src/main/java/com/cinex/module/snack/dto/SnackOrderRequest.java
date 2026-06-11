package com.cinex.module.snack.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;
import java.util.List;

@Getter
@Setter
public class SnackOrderRequest {

    /**
     * Chi nhánh nơi đơn POS được tạo.
     * Branch ADMIN: service override từ JWT (FE có gửi cũng bị bỏ qua).
     * SUPER_ADMIN: bắt buộc gửi để biết tạo cho chi nhánh nào.
     */
    private Long theaterId;

    @NotEmpty(message = "Vui lòng chọn ít nhất 1 món")
    @Valid
    private List<SnackOrderItemRequest> items;

    private String note;
}
