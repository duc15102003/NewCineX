package com.cinex.module.room.mapper;

import com.cinex.module.room.dto.RoomResponse;
import com.cinex.module.room.entity.Room;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface RoomMapper {

    RoomResponse toResponse(Room room);
}
