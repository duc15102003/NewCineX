package com.cinex.module.movie.mapper;

import com.cinex.module.movie.dto.GenreResponse;
import com.cinex.module.movie.dto.MovieListResponse;
import com.cinex.module.movie.dto.MovieResponse;
import com.cinex.module.movie.entity.Genre;
import com.cinex.module.movie.entity.Movie;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;

import java.util.Set;
import java.util.stream.Collectors;

/**
 * [Mapper Pattern — MapStruct] Chuyển Movie entity → DTO.
 *
 * Genre trả TẤT CẢ (kể cả ARCHIVED) kèm storageState.
 * FE tự quyết: user lọc bỏ ARCHIVED, admin hiện hết (badge mờ).
 */
@Mapper(componentModel = "spring")
public interface MovieMapper {

    /**
     * Movie → MovieResponse (chi tiết).
     * genres: Set<Genre> → Set<GenreResponse> kèm storageState.
     */
    @Mapping(source = "genres", target = "genres", qualifiedByName = "genreResponses")
    MovieResponse toResponse(Movie movie);

    /**
     * Movie → MovieListResponse (rút gọn).
     * genres: Set<Genre> → Set<GenreResponse> kèm storageState.
     * FE tự lọc: user ẩn ARCHIVED, admin hiện hết (badge mờ).
     */
    @Mapping(source = "genres", target = "genres", qualifiedByName = "genreResponses")
    MovieListResponse toListResponse(Movie movie);

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
}
