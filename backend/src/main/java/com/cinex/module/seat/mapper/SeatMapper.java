package com.cinex.module.seat.mapper;

import com.cinex.module.seat.dto.SeatResponse;
import com.cinex.module.seat.entity.Seat;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface SeatMapper {

    SeatResponse toResponse(Seat seat);
}
