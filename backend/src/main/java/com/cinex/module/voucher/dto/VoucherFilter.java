package com.cinex.module.voucher.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class VoucherFilter {

    private String keyword;
    private Boolean active;
    private Boolean expired;         // true = chỉ lấy đã hết hạn
    private Boolean includeDeleted;
}
