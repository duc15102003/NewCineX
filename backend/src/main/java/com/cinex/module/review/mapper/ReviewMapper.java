package com.cinex.module.review.mapper;

import com.cinex.module.review.dto.ReviewResponse;
import com.cinex.module.review.entity.Review;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * [Mapper Pattern — MapStruct] Chuyển Review entity → ReviewResponse DTO.
 *
 * Vấn đề: ReviewResponse cần username, avatarUrl từ review.getUser()
 * và movieId, movieTitle từ review.getMovie() — MapStruct không tự biết.
 *
 * Giải pháp: @Mapping(source = "user.username", target = "username")
 * → MapStruct tự sinh code: response.setUsername(review.getUser().getUsername())
 *
 * Tại sao dùng MapStruct thay vì viết tay?
 * - Tự động: không cần viết review.getUser().getUsername() lặp đi lặp lại
 * - An toàn: lỗi mapping được phát hiện lúc compile, không phải lúc runtime
 * - Nhanh: sinh code Java thuần, không dùng reflection như ModelMapper
 */
@Mapper(componentModel = "spring")
public interface ReviewMapper {

    @Mapping(source = "user.username", target = "username")
    @Mapping(source = "user.avatarUrl", target = "avatarUrl")
    @Mapping(source = "movie.id", target = "movieId")
    @Mapping(source = "movie.title", target = "movieTitle")
    ReviewResponse toResponse(Review review);
}
