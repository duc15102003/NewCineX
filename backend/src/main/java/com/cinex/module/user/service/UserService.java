package com.cinex.module.user.service;

import com.cinex.common.audit.Auditable;
import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.common.service.FileUploadService;
import com.cinex.common.util.SecurityUtil;
import com.cinex.module.auth.entity.Role;
import com.cinex.module.auth.entity.User;
import com.cinex.module.auth.repository.UserRepository;
import com.cinex.module.auth.service.RefreshTokenService;
import com.cinex.module.theater.entity.Theater;
import com.cinex.module.theater.repository.TheaterRepository;
import com.cinex.module.user.dto.ChangePasswordRequest;
import com.cinex.module.user.dto.UpdateProfileRequest;
import com.cinex.module.user.dto.AdminCreateUserRequest;
import com.cinex.module.user.dto.AdminUpdateUserRequest;
import com.cinex.module.user.dto.UpdateRoleRequest;
import com.cinex.module.user.dto.UserFilter;
import com.cinex.module.user.dto.UserProfileResponse;
import com.cinex.module.user.mapper.UserMapper;
import com.cinex.module.user.specification.UserSpecification;
import com.cinex.security.JwtBlacklistService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserService {

    private final UserRepository userRepository;
    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final FileUploadService fileUploadService;
    private final RefreshTokenService refreshTokenService;
    private final JwtBlacklistService jwtBlacklistService;
    private final TheaterRepository theaterRepository;

    /**
     * Lấy profile user hiện tại từ SecurityContext.
     * Không truyền userId qua URL → tránh user sửa profile người khác.
     */
    @Transactional(readOnly = true)
    public UserProfileResponse getProfile() {
        User user = getCurrentUser();
        return userMapper.toProfileResponse(user);
    }

    /**
     * Cập nhật profile: fullName, phone, dateOfBirth.
     * Username, email, role → KHÔNG cho sửa qua API này.
     *
     * <p>dateOfBirth optional (Phase 2 age-rating enforcement): nếu user khai báo →
     * BE auto-block booking phim không đủ tuổi. Khai 1 lần là xong.
     */
    @Transactional
    public UserProfileResponse updateProfile(UpdateProfileRequest request) {
        User user = getCurrentUser();

        if (request.getFullName() != null) {
            user.setFullName(request.getFullName());
        }
        if (request.getPhone() != null) {
            user.setPhone(request.getPhone());
        }
        if (request.getDateOfBirth() != null) {
            user.setDateOfBirth(request.getDateOfBirth());
        }

        userRepository.save(user);
        log.info("User {} updated profile", user.getUsername());
        return userMapper.toProfileResponse(user);
    }

    /**
     * Đổi mật khẩu: verify old password → hash new password → save.
     *
     * Business rules:
     * 1. Old password phải đúng (so sánh bằng BCrypt.matches)
     * 2. New password và confirm password phải giống nhau
     * 3. New password không được trùng old password
     */
    @Transactional
    public void changePassword(ChangePasswordRequest request, HttpServletRequest httpRequest) {
        User user = getCurrentUser();

        // Verify old password
        if (!passwordEncoder.matches(request.getOldPassword(), user.getPassword())) {
            throw new BusinessException(ErrorCode.INVALID_PASSWORD, "Mật khẩu cũ không đúng");
        }

        // Verify confirm password
        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new BusinessException(ErrorCode.INVALID_PASSWORD,
                    "Mật khẩu mới và xác nhận mật khẩu không khớp");
        }

        // Không cho đặt password mới trùng password cũ
        if (passwordEncoder.matches(request.getNewPassword(), user.getPassword())) {
            throw new BusinessException(ErrorCode.INVALID_PASSWORD,
                    "Mật khẩu mới phải khác mật khẩu cũ");
        }

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        // Security: đổi password → revoke mọi refresh token để kill session ở device khác.
        // Nếu attacker có refresh token cũ (do leak), sau khi user đổi pass attacker không refresh được nữa.
        refreshTokenService.revokeAllUserTokens(user.getId());

        // Blacklist access token hiện tại — tránh attacker đang có access token còn hạn
        // tiếp tục dùng trong 15 phút sau khi user đã đổi password.
        if (httpRequest != null) {
            String authHeader = httpRequest.getHeader("Authorization");
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                jwtBlacklistService.blacklist(authHeader.substring(7));
            }
        }

        log.info("User {} changed password — all refresh tokens revoked + access token blacklisted", user.getUsername());
    }

    /**
     * Upload avatar lên Cloudinary, lưu URL vào User.avatarUrl.
     * Folder trên Cloudinary: "cinex/avatars" → dễ quản lý, phân loại ảnh.
     */
    @Transactional
    public UserProfileResponse uploadAvatar(MultipartFile file) {
        User user = getCurrentUser();

        if (user.getAvatarUrl() != null) {
            fileUploadService.deleteImage(user.getAvatarUrl());
        }

        String avatarUrl = fileUploadService.uploadImage(file, "cinex/avatars");
        user.setAvatarUrl(avatarUrl);
        userRepository.save(user);
        log.info("User {} uploaded avatar", user.getUsername());
        return userMapper.toProfileResponse(user);
    }

    /**
     * (ADMIN) Danh sách user — Filter DTO + Specification.
     *
     * <p>RBAC scope: nếu user gọi là branch ADMIN → force filter theaterId =
     * theater của ADMIN, và chỉ trả USER + STAFF (không cho xem ADMIN/SUPER_ADMIN
     * khác). SUPER_ADMIN không bị scope, xem tất cả.
     */
    @Transactional(readOnly = true)
    public Page<UserProfileResponse> listUsers(UserFilter filter, Pageable pageable) {
        User current = getCurrentUser();
        if (current.getRole() == Role.ADMIN) {
            Long adminTheaterId = current.getTheater() != null
                    ? current.getTheater().getId() : null;
            // Branch ADMIN chỉ thấy user/staff của chi nhánh mình. USER không có
            // theater (theaterId=null) → cũng cho thấy để branch ADMIN quản khách
            // booking ở chi nhánh mình (industry pattern).
            filter.setScopedTheaterId(adminTheaterId);
            filter.setExcludeAdminRoles(true);
        }
        var spec = UserSpecification.fromFilter(filter);
        return userRepository.findAll(spec, pageable)
                .map(userMapper::toProfileResponse);
    }

    /**
     * (ADMIN) Đổi role user.
     * Admin không thể đổi role của chính mình → tránh tự tước quyền.
     */
    @Transactional
    @Auditable(action = "UPDATE_USER_ROLE", entityType = "User")
    public UserProfileResponse updateRole(Long userId, UpdateRoleRequest request) {
        User target = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        // Không cho admin đổi role chính mình
        String currentUsername = SecurityUtil.getCurrentUsername();
        if (target.getUsername().equals(currentUsername)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Không thể thay đổi vai trò của chính mình");
        }

        // Quick endpoint chỉ đổi role — KHÔNG đụng theater. Nếu chuyển sang ADMIN
        // mà chưa có theater_id, target sẽ là admin "lơ lửng" — hệ thống không cho
        // truy cập tài nguyên. SUPER_ADMIN phải dùng PUT /api/users/{id} đầy đủ
        // để set thêm theater. Cảnh báo bằng exception:
        if (request.getRole() == Role.ADMIN && target.getTheater() == null) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Promote user lên ADMIN cần kèm theater_id. Dùng API /api/users/{id} (admin update đầy đủ).");
        }
        // USER hoặc SUPER_ADMIN phải KHÔNG có theater
        if (request.getRole() != Role.ADMIN && target.getTheater() != null) {
            target.setTheater(null);
        }

        target.setRole(request.getRole());
        userRepository.save(target);
        log.info("Admin {} changed role of user {} to {}", currentUsername, target.getUsername(), request.getRole());
        return userMapper.toProfileResponse(target);
    }

    /**
     * Admin tạo user mới (cho cả 4 role).
     *
     * <p>RBAC:
     * <ul>
     *   <li>SUPER_ADMIN: tạo được bất kỳ role, theaterId tự do</li>
     *   <li>ADMIN (branch): chỉ tạo STAFF + USER, theaterId FORCE = theater của
     *       ADMIN (FE có gửi sai cũng bị override để tránh leak cross-theater)</li>
     * </ul>
     *
     * <p>Endpoint guard ở Controller (@PreAuthorize). Service double-check role
     * + override theaterId là defense in depth.
     */
    @Transactional
    @Auditable(action = "CREATE_USER", entityType = "User")
    public UserProfileResponse adminCreateUser(AdminCreateUserRequest request) {
        User currentUser = getCurrentUser();
        Role currentRole = currentUser.getRole();
        Role requestedRole = request.getRole();

        // Branch ADMIN chỉ được tạo STAFF + USER (không tạo ADMIN/SUPER_ADMIN)
        if (currentRole == Role.ADMIN
                && requestedRole != Role.STAFF && requestedRole != Role.USER) {
            throw new BusinessException(ErrorCode.FORBIDDEN,
                    "Quản trị chi nhánh chỉ tạo được tài khoản Nhân viên hoặc Khách hàng");
        }

        // Branch ADMIN: force theaterId = theater của ADMIN (không cho gán CN khác)
        Long effectiveTheaterId = currentRole == Role.ADMIN
                ? (currentUser.getTheater() != null ? currentUser.getTheater().getId() : null)
                : request.getTheaterId();
        if (currentRole == Role.ADMIN && effectiveTheaterId == null) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Tài khoản admin của bạn chưa được gán chi nhánh — liên hệ Quản trị tổng");
        }

        if (userRepository.findByUsername(request.getUsername()).isPresent()) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Tên đăng nhập '" + request.getUsername() + "' đã tồn tại");
        }
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Email '" + request.getEmail() + "' đã được dùng cho tài khoản khác");
        }

        User newUser = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName())
                .phone(request.getPhone())
                .role(requestedRole)
                .enabled(true)
                .build();

        applyTheaterByRole(newUser, requestedRole, effectiveTheaterId);

        User saved = userRepository.save(newUser);
        log.info("Admin {} created user {} (role={}, theaterId={})",
                currentUser.getUsername(), saved.getUsername(), requestedRole, effectiveTheaterId);
        return userMapper.toProfileResponse(saved);
    }

    /**
     * (ADMIN) Cập nhật thông tin user: fullName, phone, role, enabled.
     * Admin không thể disable/đổi role chính mình.
     */
    @Transactional
    @Auditable(action = "ADMIN_UPDATE_USER", entityType = "User")
    public UserProfileResponse adminUpdateUser(Long userId, AdminUpdateUserRequest request) {
        User target = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        String currentUsername = SecurityUtil.getCurrentUsername();
        if (target.getUsername().equals(currentUsername)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Không thể chỉnh sửa tài khoản của chính mình");
        }

        // RBAC cho branch ADMIN: chỉ sửa user CÙNG chi nhánh + role thuộc {STAFF, USER}.
        // SUPER_ADMIN bypass mọi check (đã guard ở Controller).
        User currentUser = getCurrentUser();
        if (currentUser.getRole() == Role.ADMIN) {
            Long adminTheaterId = currentUser.getTheater() != null
                    ? currentUser.getTheater().getId() : null;
            Long targetTheaterId = target.getTheater() != null
                    ? target.getTheater().getId() : null;
            if (target.getRole() == Role.ADMIN || target.getRole() == Role.SUPER_ADMIN) {
                throw new BusinessException(ErrorCode.FORBIDDEN,
                        "Bạn không có quyền sửa tài khoản quản trị khác");
            }
            if (adminTheaterId == null || !adminTheaterId.equals(targetTheaterId)) {
                // Target STAFF khác chi nhánh hoặc USER (không thuộc chi nhánh) — chặn
                if (target.getRole() == Role.STAFF) {
                    throw new BusinessException(ErrorCode.FORBIDDEN,
                            "Bạn chỉ sửa được nhân viên cùng chi nhánh");
                }
            }
            // ADMIN không được promote user lên ADMIN/SUPER_ADMIN
            if (request.getRole() == Role.ADMIN || request.getRole() == Role.SUPER_ADMIN) {
                throw new BusinessException(ErrorCode.FORBIDDEN,
                        "Bạn không có quyền gán vai trò Quản trị");
            }
            // ADMIN không được đổi chi nhánh của STAFF sang chi nhánh khác
            if (request.getRole() == Role.STAFF && request.getTheaterId() != null
                    && !request.getTheaterId().equals(adminTheaterId)) {
                throw new BusinessException(ErrorCode.FORBIDDEN,
                        "Chỉ được gán nhân viên vào chi nhánh của bạn");
            }
        }

        // Chặn disable / demote SUPER_ADMIN cuối cùng — tránh lockout hệ thống.
        // Industry chuẩn (CGV/Lotte): luôn phải có ≥ 1 super admin enabled.
        boolean isDemotingSuperAdmin = target.getRole() == Role.SUPER_ADMIN
                && request.getRole() != Role.SUPER_ADMIN;
        boolean isDisablingSuperAdmin = target.getRole() == Role.SUPER_ADMIN
                && target.isEnabled() && !request.getEnabled();
        if (isDemotingSuperAdmin || isDisablingSuperAdmin) {
            long activeSupers = userRepository.countByRoleAndEnabledTrue(Role.SUPER_ADMIN);
            if (activeSupers <= 1) {
                throw new BusinessException(ErrorCode.INVALID_REQUEST,
                        "Không thể " + (isDemotingSuperAdmin ? "đổi vai trò" : "vô hiệu hoá") +
                        " SUPER_ADMIN cuối cùng. Hãy thăng cấp 1 user khác lên SUPER_ADMIN trước.");
            }
        }

        if (request.getFullName() != null) {
            target.setFullName(request.getFullName());
        }
        if (request.getPhone() != null) {
            target.setPhone(request.getPhone());
        }
        target.setRole(request.getRole());
        target.setEnabled(request.getEnabled());

        // Validation matrix role × theater_id (xem javadoc AdminUpdateUserRequest)
        applyTheaterByRole(target, request.getRole(), request.getTheaterId());

        userRepository.save(target);
        log.info("Admin {} updated user {}: role={}, theaterId={}, enabled={}",
                currentUsername, target.getUsername(), request.getRole(),
                request.getTheaterId(), request.getEnabled());
        return userMapper.toProfileResponse(target);
    }

    /**
     * Set theater theo role + validate matrix:
     * <ul>
     *   <li>USER / SUPER_ADMIN: theaterId BẮT BUỘC null → set theater = null</li>
     *   <li>ADMIN / STAFF: theaterId BẮT BUỘC NOT NULL — cả 2 đều scope theater</li>
     * </ul>
     */
    private void applyTheaterByRole(User target, Role role, Long requestedTheaterId) {
        if (role == Role.ADMIN || role == Role.STAFF) {
            if (requestedTheaterId == null) {
                throw new BusinessException(ErrorCode.INVALID_REQUEST,
                        role.name() + " phải được gán 1 chi nhánh — vui lòng chọn theater_id");
            }
            Theater theater = theaterRepository.findById(requestedTheaterId)
                    .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND,
                            "Không tìm thấy chi nhánh"));
            target.setTheater(theater);
        } else {
            // USER + SUPER_ADMIN: KHÔNG cho phép có theater
            if (requestedTheaterId != null) {
                throw new BusinessException(ErrorCode.INVALID_REQUEST,
                        "USER / SUPER_ADMIN không được gán chi nhánh");
            }
            target.setTheater(null);
        }
    }

    private User getCurrentUser() {
        String username = SecurityUtil.getCurrentUsername();
        return userRepository.findActiveByUsername(username)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
    }
}
