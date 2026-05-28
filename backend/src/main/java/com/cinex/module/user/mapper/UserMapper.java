package com.cinex.module.user.mapper;

import com.cinex.module.auth.entity.User;
import com.cinex.module.user.dto.UserProfileResponse;
import org.mapstruct.Mapper;

/**
 * [Mapper Pattern - MapStruct] Tự động sinh code chuyển User entity sang DTO.
 *
 * Tại sao dùng MapStruct thay vì viết tay?
 * - Viết tay: mỗi lần thêm field phải sửa code mapping → dễ quên, dễ sai
 * - MapStruct: chỉ cần khai báo interface, compile-time sinh code → nhanh, an toàn, không dùng reflection
 *
 * componentModel = "spring" → MapStruct tạo class implement interface này và đăng ký
 * như 1 Spring Bean → có thể @Autowired / constructor injection như bình thường.
 */
@Mapper(componentModel = "spring")
public interface UserMapper {

    /**
     * Chuyển User entity → UserProfileResponse DTO.
     * MapStruct tự match field theo tên: user.getFullName() → response.fullName
     */
    UserProfileResponse toProfileResponse(User user);
}
