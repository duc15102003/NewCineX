package com.cinex.module.snack.mapper;

import com.cinex.module.snack.dto.SnackResponse;
import com.cinex.module.snack.entity.Snack;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface SnackMapper {

    @Mapping(source = "theater.id", target = "theaterId")
    @Mapping(source = "theater.name", target = "theaterName")
    @Mapping(source = "theater.city", target = "theaterCity")
    SnackResponse toResponse(Snack snack);
}
