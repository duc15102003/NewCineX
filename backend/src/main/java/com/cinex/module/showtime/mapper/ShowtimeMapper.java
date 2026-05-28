package com.cinex.module.showtime.mapper;

import com.cinex.module.showtime.dto.ShowtimeListResponse;
import com.cinex.module.showtime.dto.ShowtimeResponse;
import com.cinex.module.showtime.entity.Showtime;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface ShowtimeMapper {

    @Mapping(source = "movie.id", target = "movieId")
    @Mapping(source = "movie.title", target = "movieTitle")
    @Mapping(source = "movie.posterUrl", target = "moviePosterUrl")
    @Mapping(source = "movie.duration", target = "movieDuration")
    @Mapping(source = "room.id", target = "roomId")
    @Mapping(source = "room.name", target = "roomName")
    @Mapping(source = "room.type", target = "roomType")
    @Mapping(target = "availableSeats", ignore = true)
    ShowtimeResponse toResponse(Showtime showtime);

    @Mapping(source = "movie.id", target = "movieId")
    @Mapping(source = "movie.title", target = "movieTitle")
    @Mapping(source = "movie.posterUrl", target = "moviePosterUrl")
    @Mapping(source = "room.id", target = "roomId")
    @Mapping(source = "room.name", target = "roomName")
    @Mapping(source = "room.type", target = "roomType")
    ShowtimeListResponse toListResponse(Showtime showtime);
}
