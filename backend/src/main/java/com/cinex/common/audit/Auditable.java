package com.cinex.common.audit;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Đánh dấu method admin critical cần ghi audit log.
 *
 * <p><b>Pattern:</b> AOP — aspect đọc annotation này sau khi method chạy thành công
 * sẽ gọi {@link com.cinex.common.audit.service.AuditLogService#log} để lưu lại.
 *
 * <p>Ví dụ:
 * <pre>
 * &#64;Auditable(action = "UPDATE_USER_ROLE", entityType = "User")
 * public UserProfileResponse updateRole(Long userId, UpdateRoleRequest request) { ... }
 * </pre>
 *
 * <p>Aspect tự động:
 * - Lấy username + IP + user-agent từ request hiện tại
 * - Trích {@code entityId} từ tham số {@code Long ...Id} hoặc từ return value có {@code getId()}
 * - Serialize input args (loại password) thành JSON detail
 * - Nếu method throw → KHÔNG ghi audit (chỉ ghi khi thành công)
 */
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.METHOD)
public @interface Auditable {

    /** Action code, vd: "UPDATE_USER_ROLE", "REFUND_PAYMENT", "ARCHIVE_MOVIE". */
    String action();

    /** Loại entity bị tác động, vd: "User", "Movie", "Payment", "Booking". */
    String entityType();
}
