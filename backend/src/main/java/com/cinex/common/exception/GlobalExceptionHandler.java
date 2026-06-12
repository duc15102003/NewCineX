package com.cinex.common.exception;

import com.cinex.common.response.ApiResponse;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

/**
 * Bắt mọi exception ném ra từ controller/service → chuyển thành ApiResponse chuẩn.
 *
 * [Centralized Exception Handling]
 * Thay vì mỗi controller try/catch, gom hết về 1 chỗ → DRY, dễ maintain.
 *
 * <p>Mỗi response error đều có {@code code} là tên ErrorCode → FE check code để
 * phân biệt loại lỗi (không cần parse message tiếng Việt).
 *
 * Ưu tiên handler: Spring tìm handler theo thứ tự CỤ THỂ → TỔNG QUÁT.
 * VD: BusinessException ưu tiên hơn Exception (cha).
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusinessException(BusinessException ex) {
        ErrorCode errorCode = ex.getErrorCode();
        return ResponseEntity
                .status(errorCode.getHttpStatus())
                .body(ApiResponse.error(errorCode.name(), ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException ex) {
        // Chỉ join các message tiếng Việt — KHÔNG prefix field name (vì field name
        // là Java camelCase, user thấy "newPassword: ..." sẽ confusing). DTO phải
        // tự viết message rõ trong @NotBlank/@Pattern/@Size... để user hiểu được.
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> fe.getDefaultMessage())
                .reduce((a, b) -> a + "; " + b)
                .orElse("Dữ liệu không hợp lệ");
        return ResponseEntity.badRequest()
                .body(ApiResponse.error(ErrorCode.INVALID_REQUEST.name(), message));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleConstraintViolation(ConstraintViolationException ex) {
        return ResponseEntity.badRequest()
                .body(ApiResponse.error(ErrorCode.INVALID_REQUEST.name(), ex.getMessage()));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Void>> handleAccessDenied(AccessDeniedException ex) {
        ErrorCode code = ErrorCode.FORBIDDEN;
        return ResponseEntity.status(code.getHttpStatus())
                .body(ApiResponse.error(code.name(), code.getMessage()));
    }

    /**
     * Authentication failure (token sai/expired, account bị disable, ...) — nếu nhảy
     * tới ExceptionHandler (không qua entry point của Spring Security) thì trả 401
     * đồng nhất format ApiResponse.
     */
    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiResponse<Void>> handleAuthentication(AuthenticationException ex) {
        ErrorCode code = ErrorCode.UNAUTHORIZED;
        return ResponseEntity.status(code.getHttpStatus())
                .body(ApiResponse.error(code.name(), code.getMessage()));
    }

    /**
     * Optimistic Lock conflict — 2 user cùng sửa 1 record, người sau bị reject.
     *
     * VD đời thường: 2 người cùng edit Google Doc → ai save trước được, người sau
     * phải reload bản mới rồi sửa lại.
     *
     * Trong CineX: @Version trong BaseEntity → JPA tự throw exception này khi
     * version trong DB khác version client gửi lên.
     */
    @ExceptionHandler({OptimisticLockingFailureException.class, ObjectOptimisticLockingFailureException.class})
    public ResponseEntity<ApiResponse<Void>> handleOptimisticLock(Exception ex) {
        log.warn("Optimistic lock conflict: {}", ex.getMessage());
        ErrorCode code = ErrorCode.OPTIMISTIC_LOCK_CONFLICT;
        return ResponseEntity.status(code.getHttpStatus())
                .body(ApiResponse.error(code.name(), code.getMessage()));
    }

    /**
     * Data Integrity Violation — vi phạm ràng buộc DB:
     * - UNIQUE constraint (insert trùng email/username)
     * - FOREIGN KEY constraint (xóa parent khi còn child)
     * - NOT NULL constraint (insert thiếu field bắt buộc)
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleDataIntegrity(DataIntegrityViolationException ex) {
        log.warn("Data integrity violation: {}", ex.getMostSpecificCause().getMessage());
        ErrorCode code = ErrorCode.DATA_INTEGRITY_VIOLATION;
        return ResponseEntity.status(code.getHttpStatus())
                .body(ApiResponse.error(code.name(), code.getMessage()));
    }

    /**
     * Request body JSON bị malformed (thiếu dấu ngoặc, sai kiểu dữ liệu, ...).
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Void>> handleMessageNotReadable(HttpMessageNotReadableException ex) {
        log.warn("Request body không đọc được: {}", ex.getMostSpecificCause().getMessage());
        return ResponseEntity.badRequest()
                .body(ApiResponse.error(ErrorCode.INVALID_REQUEST.name(), "Request body không hợp lệ"));
    }

    /**
     * Thiếu @RequestParam bắt buộc (VD: ?page=0 thiếu).
     */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ApiResponse<Void>> handleMissingParam(MissingServletRequestParameterException ex) {
        String msg = "Thiếu tham số bắt buộc: " + ex.getParameterName();
        return ResponseEntity.badRequest()
                .body(ApiResponse.error(ErrorCode.INVALID_REQUEST.name(), msg));
    }

    /**
     * Tham số sai kiểu dữ liệu (VD: ?id=abc nhưng controller nhận Long).
     */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiResponse<Void>> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        String msg = "Kiểu dữ liệu tham số sai: " + ex.getName();
        return ResponseEntity.badRequest()
                .body(ApiResponse.error(ErrorCode.INVALID_REQUEST.name(), msg));
    }

    /**
     * File upload vượt giới hạn (config trong application.yml: max-file-size).
     */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiResponse<Void>> handleMaxUploadSize(MaxUploadSizeExceededException ex) {
        log.warn("Upload file vượt giới hạn: {}", ex.getMessage());
        ErrorCode code = ErrorCode.FILE_TOO_LARGE;
        return ResponseEntity.status(code.getHttpStatus())
                .body(ApiResponse.error(code.name(), code.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGeneral(Exception ex) {
        // Log stack trace — không log thì bug biến mất, không debug được
        log.error("Unexpected error", ex);
        ErrorCode code = ErrorCode.UNCATEGORIZED;
        return ResponseEntity.status(code.getHttpStatus())
                .body(ApiResponse.error(code.name(), code.getMessage()));
    }
}
