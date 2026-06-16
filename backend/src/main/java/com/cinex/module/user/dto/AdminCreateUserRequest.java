package com.cinex.module.user.dto;

import com.cinex.module.auth.entity.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

/**
 * Request admin tạo user mới (USER / STAFF / ADMIN / SUPER_ADMIN).
 *
 * <p><b>RBAC ở Service:</b>
 * <ul>
 *   <li>SUPER_ADMIN: tạo được bất kỳ role + chỉ định theaterId tự do</li>
 *   <li>ADMIN (branch): chỉ tạo STAFF + USER, theaterId tự override = theater
 *       của ADMIN (FE có gửi cũng bị bỏ qua — defense)</li>
 *   <li>STAFF / USER: 403 (không có quyền tạo)</li>
 * </ul>
 *
 * <p><b>Validation matrix theo role (Service enforce):</b>
 * <ul>
 *   <li>USER: theaterId = null (khách book vé không thuộc chi nhánh cố định)</li>
 *   <li>STAFF: theaterId bắt buộc NOT NULL (nhân viên gắn 1 chi nhánh)</li>
 *   <li>ADMIN: theaterId bắt buộc NOT NULL (branch admin gắn 1 chi nhánh)</li>
 *   <li>SUPER_ADMIN: theaterId = null (HQ admin xem mọi chi nhánh)</li>
 * </ul>
 */
@Getter
@Setter
public class AdminCreateUserRequest {

    @NotBlank(message = "Tên đăng nhập là bắt buộc")
    @Size(min = 3, max = 50, message = "Tên đăng nhập 3-50 ký tự")
    @Pattern(regexp = "^[a-zA-Z0-9._-]+$",
            message = "Tên đăng nhập chỉ chứa chữ, số, dấu chấm/gạch ngang/gạch dưới")
    private String username;

    @NotBlank(message = "Email là bắt buộc")
    @Email(message = "Email không hợp lệ")
    private String email;

    @NotBlank(message = "Mật khẩu là bắt buộc")
    @Size(min = 8, max = 100, message = "Mật khẩu 8-100 ký tự")
    @Pattern(regexp = "^(?=.*[A-Za-z])(?=.*\\d).+$",
            message = "Mật khẩu phải có cả chữ và số")
    private String password;

    private String fullName;

    @Pattern(regexp = "^((0|\\+84)\\d{8,9})?$", message = "Số điện thoại không hợp lệ")
    private String phone;

    @NotNull(message = "Vai trò là bắt buộc")
    private Role role;

    /**
     * Chi nhánh gán cho user — phải có nếu role=STAFF/ADMIN, phải null cho
     * USER/SUPER_ADMIN. Branch ADMIN tự override = theater của mình.
     */
    private Long theaterId;
}
