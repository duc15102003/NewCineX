package com.cinex.module.movie.dto;

import lombok.Getter;
import lombok.Setter;

/**
 * Filter DTO cho list Genre.
 *
 * {@code hasMovies}: hữu ích để admin nhanh chóng tìm genre đã/chưa có phim nào sử dụng
 * (để cân nhắc xóa genre không dùng đến).
 */
@Getter
@Setter
public class GenreFilter {

    // LIKE trên name OR description (case-insensitive)
    private String keyword;

    // true = chỉ genre đang được dùng trong ít nhất 1 movie
    // false = chỉ genre chưa được dùng
    // null = cả 2
    private Boolean hasMovies;

    private Boolean includeDeleted;
}
