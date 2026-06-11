package com.cinex.module.voucher.mapper;

import com.cinex.module.voucher.dto.VoucherResponse;
import com.cinex.module.voucher.entity.Voucher;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface VoucherMapper {

    @Mapping(target = "theaterId", source = "theater.id")
    @Mapping(target = "theaterName", source = "theater.name")
    @Mapping(target = "theaterCity", source = "theater.city")
    VoucherResponse toResponse(Voucher voucher);
}
