package com.cinex.module.movie.mapper;

import com.cinex.module.movie.dto.MovieRunResponse;
import com.cinex.module.movie.entity.MovieRun;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * [Mapper Pattern — MapStruct] Chuyển {@link MovieRun} entity → {@link MovieRunResponse}.
 *
 * <p><b>Tại sao KHÔNG có toEntity(MovieRunRequest)?</b>
 * MovieRun cần resolve {@code movieId} → {@link com.cinex.module.movie.entity.Movie} thông qua
 * repository — đây là logic của service. Để service tự build entity từ request, mapper chỉ lo
 * chiều entity → DTO (đơn giản, dễ test).
 */
@Mapper(componentModel = "spring")
public interface MovieRunMapper {

    /**
     * MovieRun → MovieRunResponse.
     *
     * <p>Flatten các field từ {@code movie} (LAZY) ra DTO để FE không phải query thêm.
     * Truy cập {@code run.movie.getTitle()} ở mapper sẽ trigger 1 lazy fetch — chấp nhận được
     * khi list runs vì page size nhỏ. Nếu cần optimize → dùng JOIN FETCH ở repository.
     */
    @Mapping(target = "movieId", source = "movie.id")
    @Mapping(target = "movieTitle", source = "movie.title")
    @Mapping(target = "moviePosterUrl", source = "movie.posterUrl")
    @Mapping(target = "theaterId", source = "theater.id")
    @Mapping(target = "theaterName", source = "theater.name")
    @Mapping(target = "theaterCity", source = "theater.city")
    @Mapping(target = "storageState", expression = "java(run.getStorageState() != null ? run.getStorageState().name() : null)")
    MovieRunResponse toResponse(MovieRun run);
}
