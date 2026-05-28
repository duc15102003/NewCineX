package com.cinex.module.voucher.mapper;

import com.cinex.module.voucher.dto.VoucherResponse;
import com.cinex.module.voucher.entity.Voucher;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface VoucherMapper {

    VoucherResponse toResponse(Voucher voucher);
}
