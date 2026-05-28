package com.cinex.common.util;

import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * Utility class lấy thông tin user đang đăng nhập từ SecurityContext.
 *
 * [ThreadLocal Pattern] SecurityContextHolder dùng ThreadLocal để lưu Authentication.
 * Mỗi request HTTP chạy trên 1 thread riêng → mỗi thread có SecurityContext riêng.
 * → Gọi SecurityUtil.getCurrentUsername() ở bất kỳ đâu trong cùng request đều ra đúng user.
 *
 * Tại sao cần class này?
 * Thay vì viết đi viết lại:
 *   SecurityContextHolder.getContext().getAuthentication().getName()
 * Chỉ cần:
 *   SecurityUtil.getCurrentUsername()
 */
public final class SecurityUtil {

    private SecurityUtil() {}

    /**
     * Lấy username của user đang đăng nhập.
     *
     * VD: User "vanan" gọi API → SecurityUtil.getCurrentUsername() → "vanan"
     *
     * Luồng: Request → JwtAuthFilter set Authentication → SecurityContext
     *        → Service gọi SecurityUtil → lấy username từ context
     */
    public static String getCurrentUsername() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "Chưa đăng nhập");
        }
        return auth.getName();
    }

    /**
     * Lấy username, trả null nếu chưa đăng nhập (không throw exception).
     *
     * Dùng cho: các API vừa public vừa private
     * (VD: xem phim không cần login, nhưng nếu login thì hiện "đã thích")
     */
    public static String getCurrentUsernameOrNull() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return null;
        }
        return auth.getName();
    }

    /**
     * Kiểm tra user hiện tại có role cụ thể không.
     *
     * VD: SecurityUtil.hasRole("ADMIN") → true/false
     *
     * Tại sao cần khi đã có @PreAuthorize?
     * → @PreAuthorize dùng ở Controller (kiểm tra trước khi vào method)
     * → hasRole() dùng trong Service khi logic phụ thuộc vào role
     * VD: Admin hủy vé không cần kiểm tra "chưa chiếu", user thường thì cần
     */
    public static boolean hasRole(String role) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return false;
        return auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_" + role));
    }
}
