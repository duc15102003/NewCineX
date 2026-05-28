package com.cinex.common.service;

import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.common.util.SecurityUtil;
import com.cinex.module.auth.entity.User;
import com.cinex.module.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class SecurityService {

    private final UserRepository userRepository;

    /**
     * Lấy userId của user đang đăng nhập.
     * Throw BusinessException(USER_NOT_FOUND) nếu không tìm thấy user trong DB.
     */
    public Long getCurrentUserId() {
        String username = SecurityUtil.getCurrentUsername();
        return userRepository.findActiveByUsername(username)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND))
                .getId();
    }

    /**
     * Lấy User entity của user đang đăng nhập.
     * Throw BusinessException(USER_NOT_FOUND) nếu không tìm thấy user trong DB.
     */
    public User getCurrentUser() {
        String username = SecurityUtil.getCurrentUsername();
        return userRepository.findActiveByUsername(username)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
    }

    /**
     * Lấy userId của user đang đăng nhập, hoặc null nếu chưa đăng nhập / không tìm thấy.
     * Dùng cho các endpoint public (guest có thể truy cập, nhưng nếu đăng nhập thì có thêm logic riêng).
     */
    public Long getCurrentUserIdOrNull() {
        String username = SecurityUtil.getCurrentUsernameOrNull();
        if (username == null) return null;
        return userRepository.findActiveByUsername(username)
                .map(User::getId)
                .orElse(null);
    }
}
