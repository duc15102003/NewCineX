package com.cinex.common.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.time.Instant;

/**
 * Wrapper chuẩn cho mọi response của API.
 *
 * <p><b>Tại sao cần wrapper?</b> Để FE có 1 schema thống nhất: luôn check
 * {@code success} trước, đọc {@code data} nếu OK hoặc {@code message + code}
 * nếu lỗi. Không phải đoán mò mỗi endpoint trả gì.
 *
 * <p><b>Field {@code code}:</b> tên của {@link com.cinex.common.exception.ErrorCode}
 * (vd: "INVALID_CREDENTIALS", "MOVIE_NOT_FOUND"). FE dùng code thay vì so sánh
 * message string — message có thể đổi theo i18n nhưng code không đổi.
 *
 * <p><b>{@code @JsonInclude(NON_NULL)}:</b> field null không xuất hiện trong JSON
 * → response success không có {@code code}, response error không có {@code data}.
 */
@Getter
@Builder
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResponse<T> {

    private boolean success;

    /** Mã lỗi cố định, không thay đổi theo ngôn ngữ. Chỉ có khi success = false. */
    private String code;

    private String message;
    private T data;

    @Builder.Default
    private Instant timestamp = Instant.now();

    public static <T> ApiResponse<T> ok(T data) {
        return ApiResponse.<T>builder()
                .success(true)
                .message("OK")
                .data(data)
                .build();
    }

    public static <T> ApiResponse<T> ok(String message, T data) {
        return ApiResponse.<T>builder()
                .success(true)
                .message(message)
                .data(data)
                .build();
    }

    /**
     * Trả lỗi không có code — chỉ dùng cho lỗi technical chưa thuộc ErrorCode enum.
     * Giữ lại cho backward compatibility với code cũ.
     */
    public static <T> ApiResponse<T> error(String message) {
        return ApiResponse.<T>builder()
                .success(false)
                .message(message)
                .build();
    }

    /**
     * Trả lỗi kèm code — preferred. FE check {@code code} để phân biệt loại lỗi.
     *
     * @param code    tên ErrorCode (vd: "INVALID_CREDENTIALS")
     * @param message message tiếng Việt user-facing
     */
    public static <T> ApiResponse<T> error(String code, String message) {
        return ApiResponse.<T>builder()
                .success(false)
                .code(code)
                .message(message)
                .build();
    }
}
