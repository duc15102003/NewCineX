package com.cinex.module.voucher.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class ValidateVoucherRequest {

    @NotBlank(message = "Voucher code is required")
    private String code;

    @NotNull(message = "Order amount is required")
    private BigDecimal orderAmount;
}
