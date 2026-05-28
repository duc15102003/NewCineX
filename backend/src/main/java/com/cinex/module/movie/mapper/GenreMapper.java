package com.cinex.module.movie.mapper;

import com.cinex.module.movie.dto.GenreRequest;
import com.cinex.module.movie.dto.GenreResponse;
import com.cinex.module.movie.entity.Genre;
import org.mapstruct.Mapper;
import org.mapstruct.MappingTarget;

@Mapper(componentModel = "spring")
public interface GenreMapper {

    GenreResponse toResponse(Genre genre);

    Genre toEntity(GenreRequest request);

    /**
     * Cập nhật entity từ request — MapStruct ghi đè field TRÊN entity có sẵn.
     * @MappingTarget: "target" = entity cần update (không tạo mới)
     */
    void updateEntity(GenreRequest request, @MappingTarget Genre genre);
}
