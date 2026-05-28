package com.cinex.module.voucher.dto;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
@Builder
public class ValidateVoucherResponse {

    private boolean valid;
    private String code;
    private String description;
    private BigDecimal discountAmount;
    private String message;
}
