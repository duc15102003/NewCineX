package com.cinex.common.service;

import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.common.util.SecurityUtil;
import com.cinex.module.auth.entity.User;
import com.cinex.module.auth.repository.UserRepository;
import com.cinex.security.CinexUserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
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

    // ──────────────────────────────────────────────────────────────
    // Multi-branch RBAC helpers
    // ──────────────────────────────────────────────────────────────

    /**
     * Lấy theater_id của user đang đăng nhập — đọc từ {@link CinexUserPrincipal}
     * (cache 2 phút qua UserDetailsCacheService, KHÔNG query DB mỗi request).
     *
     * <p><b>QUAN TRỌNG — return null cho SUPER_ADMIN dù DB có theater_id:</b>
     * SUPER_ADMIN account có thể bị gắn theater_id trong DB (vd "trụ sở chính" để
     * coi như nhân viên có CN). Nếu trả về theater id đó, các service auto-scope
     * sẽ override request param → SUPER_ADMIN chọn QN trên dropdown nhưng query
     * vẫn lấy theater gắn cố định → bug "dữ liệu HN dù chọn QN".
     *
     * <p>Method này là single source of truth cho 16+ callsite scope theater
     * (StatisticsService, SnackService, ComboService, VoucherService, ...). Trả
     * null cho SUPER_ADMIN → tất cả service tự nhiên dùng request param, đúng kỳ
     * vọng "SUPER_ADMIN xem được mọi rạp".
     *
     * @return theaterId nếu branch ADMIN; null cho USER + SUPER_ADMIN + guest.
     */
    public Long getCurrentUserTheaterId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return null;
        if (isSuperAdmin()) return null;
        if (auth.getPrincipal() instanceof CinexUserPrincipal principal) {
            return principal.getTheaterId();
        }
        return null;
    }

    /** True nếu user hiện tại có role SUPER_ADMIN. */
    public boolean isSuperAdmin() {
        return SecurityUtil.hasRole("SUPER_ADMIN");
    }

    /** True nếu branch ADMIN (gắn 1 chi nhánh cụ thể). */
    public boolean isBranchAdmin() {
        return SecurityUtil.hasRole("ADMIN") && !isSuperAdmin() && getCurrentUserTheaterId() != null;
    }

    /**
     * Enforce: ADMIN chỉ truy cập resource của chi nhánh mình.
     *
     * <ul>
     *   <li>SUPER_ADMIN: pass mọi theaterId</li>
     *   <li>Branch ADMIN: chỉ pass nếu {@code resourceTheaterId == user.theaterId}</li>
     * </ul>
     *
     * @throws BusinessException FORBIDDEN khi admin truy cập resource khác chi nhánh
     */
    public void requireAccessToTheater(Long resourceTheaterId) {
        if (isSuperAdmin()) return;
        Long myTheaterId = getCurrentUserTheaterId();
        if (myTheaterId == null) {
            throw new BusinessException(ErrorCode.FORBIDDEN,
                    "Tài khoản chưa được gán chi nhánh");
        }
        if (!myTheaterId.equals(resourceTheaterId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN,
                    "Bạn không có quyền truy cập tài nguyên của chi nhánh khác");
        }
    }
}
