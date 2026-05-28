package com.cinex.module.snack.mapper;

import com.cinex.module.snack.dto.SnackResponse;
import com.cinex.module.snack.entity.Snack;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface SnackMapper {

    SnackResponse toResponse(Snack snack);
}
