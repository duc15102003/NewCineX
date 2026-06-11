package com.cinex.module.room.mapper;

import com.cinex.module.room.dto.RoomResponse;
import com.cinex.module.room.entity.Room;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface RoomMapper {

    @Mapping(source = "theater.id", target = "theaterId")
    @Mapping(source = "theater.name", target = "theaterName")
    @Mapping(source = "theater.city", target = "theaterCity")
    RoomResponse toResponse(Room room);
}
