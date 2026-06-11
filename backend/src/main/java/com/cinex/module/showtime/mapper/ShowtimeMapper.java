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
    @Mapping(source = "movie.ageRating", target = "movieAgeRating")
    @Mapping(source = "movieRun.id", target = "movieRunId")
    @Mapping(source = "movieRun.runType", target = "runType")
    @Mapping(source = "movieRun.startDate", target = "runStartDate")
    @Mapping(source = "movieRun.endDate", target = "runEndDate")
    @Mapping(source = "room.id", target = "roomId")
    @Mapping(source = "room.name", target = "roomName")
    @Mapping(source = "room.type", target = "roomType")
    @Mapping(source = "room.theater.id", target = "theaterId")
    @Mapping(source = "room.theater.name", target = "theaterName")
    @Mapping(source = "room.theater.city", target = "theaterCity")
    @Mapping(target = "availableSeats", ignore = true)
    // Service populate effective prices + applied rules (qua PricingEngine) sau khi map xong
    @Mapping(target = "effectiveBasePrice", ignore = true)
    @Mapping(target = "effectiveVipPrice", ignore = true)
    @Mapping(target = "effectiveCouplePrice", ignore = true)
    @Mapping(target = "appliedRules", ignore = true)
    ShowtimeResponse toResponse(Showtime showtime);

    @Mapping(source = "movie.id", target = "movieId")
    @Mapping(source = "movie.title", target = "movieTitle")
    @Mapping(source = "movie.posterUrl", target = "moviePosterUrl")
    @Mapping(source = "movieRun.id", target = "movieRunId")
    @Mapping(source = "movieRun.runType", target = "runType")
    @Mapping(source = "movieRun.startDate", target = "runStartDate")
    @Mapping(source = "movieRun.endDate", target = "runEndDate")
    @Mapping(source = "room.id", target = "roomId")
    @Mapping(source = "room.name", target = "roomName")
    @Mapping(source = "room.type", target = "roomType")
    @Mapping(source = "room.theater.id", target = "theaterId")
    @Mapping(source = "room.theater.name", target = "theaterName")
    @Mapping(source = "room.theater.city", target = "theaterCity")
    // Service populate effective prices + applied rules sau khi map xong (xem ShowtimeService.enrichWithPricing)
    @Mapping(target = "effectiveBasePrice", ignore = true)
    @Mapping(target = "effectiveVipPrice", ignore = true)
    @Mapping(target = "effectiveCouplePrice", ignore = true)
    @Mapping(target = "appliedRules", ignore = true)
    ShowtimeListResponse toListResponse(Showtime showtime);
}
