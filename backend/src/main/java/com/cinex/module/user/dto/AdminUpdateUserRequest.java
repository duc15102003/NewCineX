package com.cinex.module.user.dto;

import com.cinex.module.auth.entity.Role;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.Setter;

/**
 * Request SUPER_ADMIN cập nhật user (info + role + enabled + theater).
 *
 * <p><b>Validation matrix theo role (xử lý ở Service):</b>
 * <ul>
 *   <li>USER: theaterId BẮT BUỘC null (booking không thuộc chi nhánh cố định)</li>
 *   <li>ADMIN: theaterId BẮT BUỘC NOT NULL (branch admin phải gắn 1 chi nhánh)</li>
 *   <li>SUPER_ADMIN: theaterId BẮT BUỘC null (HQ admin xem mọi chi nhánh)</li>
 * </ul>
 */
@Getter
@Setter
public class AdminUpdateUserRequest {

    private String fullName;

    @Pattern(regexp = "^((0|\\+84)\\d{8,9})?$", message = "Số điện thoại không hợp lệ")
    private String phone;

    @NotNull(message = "Vai trò là bắt buộc")
    private Role role;

    @NotNull(message = "Trạng thái là bắt buộc")
    private Boolean enabled;

    /**
     * Chi nhánh gán cho user — phải có nếu role=ADMIN, phải null cho USER/SUPER_ADMIN.
     */
    private Long theaterId;
}
