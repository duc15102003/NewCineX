package com.cinex.module.theater.mapper;

import com.cinex.module.theater.dto.TheaterResponse;
import com.cinex.module.theater.entity.Theater;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface TheaterMapper {

    TheaterResponse toResponse(Theater theater);
}
