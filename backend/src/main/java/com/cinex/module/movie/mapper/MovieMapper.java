package com.cinex.module.movie.mapper;

import com.cinex.module.movie.dto.GenreResponse;
import com.cinex.module.movie.dto.MovieListResponse;
import com.cinex.module.movie.dto.MovieResponse;
import com.cinex.module.movie.entity.Genre;
import com.cinex.module.movie.entity.Movie;
import com.cinex.module.movie.entity.MovieStatus;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;

import java.math.BigDecimal;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * [Mapper Pattern — MapStruct] Chuyển Movie entity → DTO.
 *
 * <p><b>status param (sau refactor "bỏ Movie.status field"):</b> mapper nhận thêm
 * MovieStatus đã compute từ MovieStatusComputer (per-theater context). MapStruct
 * dùng tham số thứ 2 cho field {@code status} của response, các field còn lại lấy
 * từ entity Movie.
 *
 * <p>Genre trả TẤT CẢ (kể cả ARCHIVED) kèm storageState — FE tự lọc.
 *
 * <p>Rating null → 0 ở DTO layer (UX nhất quán, không mất info ở DB).
 */
@Mapper(componentModel = "spring")
public interface MovieMapper {

    /**
     * Movie + computed status → MovieResponse (chi tiết).
     * Status compute từ {@code MovieStatusComputer.compute(movie, theaterId)} ở Service.
     */
    @Mapping(target = "id", source = "movie.id")
    @Mapping(target = "storageState", source = "movie.storageState")
    @Mapping(target = "title", source = "movie.title")
    @Mapping(target = "description", source = "movie.description")
    @Mapping(target = "duration", source = "movie.duration")
    @Mapping(target = "posterUrl", source = "movie.posterUrl")
    @Mapping(target = "trailerUrl", source = "movie.trailerUrl")
    @Mapping(target = "director", source = "movie.director")
    @Mapping(target = "cast", source = "movie.cast")
    @Mapping(target = "language", source = "movie.language")
    @Mapping(target = "rating", source = "movie.rating", qualifiedByName = "ratingOrZero")
    @Mapping(target = "ageRating", source = "movie.ageRating")
    @Mapping(target = "genres", source = "movie.genres", qualifiedByName = "genreResponses")
    @Mapping(target = "createdAt", source = "movie.createdAt")
    @Mapping(target = "updatedAt", source = "movie.updatedAt")
    @Mapping(target = "status", source = "status")
    MovieResponse toResponse(Movie movie, MovieStatus status);

    /**
     * Movie + computed status → MovieListResponse (rút gọn cho list/grid).
     */
    @Mapping(target = "id", source = "movie.id")
    @Mapping(target = "storageState", source = "movie.storageState")
    @Mapping(target = "title", source = "movie.title")
    @Mapping(target = "posterUrl", source = "movie.posterUrl")
    @Mapping(target = "duration", source = "movie.duration")
    @Mapping(target = "rating", source = "movie.rating", qualifiedByName = "ratingOrZero")
    @Mapping(target = "genres", source = "movie.genres", qualifiedByName = "genreResponses")
    @Mapping(target = "createdAt", source = "movie.createdAt")
    @Mapping(target = "updatedAt", source = "movie.updatedAt")
    @Mapping(target = "status", source = "status")
    MovieListResponse toListResponse(Movie movie, MovieStatus status);

    /** Set<Genre> → Set<GenreResponse>: trả TẤT CẢ kèm storageState (FE tự lọc). */
    @Named("genreResponses")
    default Set<GenreResponse> mapGenreResponses(Set<Genre> genres) {
        if (genres == null) return Set.of();
        return genres.stream()
                .map(g -> GenreResponse.builder()
                        .id(g.getId())
                        .name(g.getName())
                        .description(g.getDescription())
                        .storageState(g.getStorageState() != null ? g.getStorageState().name() : null)
                        .build())
                .collect(Collectors.toSet());
    }

    /** rating null → 0 (xem javadoc class). */
    @Named("ratingOrZero")
    default BigDecimal ratingOrZero(BigDecimal rating) {
        return rating != null ? rating : BigDecimal.ZERO;
    }
}
