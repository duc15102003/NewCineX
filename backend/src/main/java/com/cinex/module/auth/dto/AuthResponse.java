package com.cinex.module.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Builder
@AllArgsConstructor
public class AuthResponse {

    private String accessToken;
    /**
     * Refresh token — DEPRECATED trong response body sau security hardening A3.
     * BE set HttpOnly cookie qua Set-Cookie header (XSS không đọc được). Field này
     * giữ trong DTO cho backward compat, nhưng controller luôn null-out sau khi
     * set cookie. FE không còn đọc field này.
     */
    private String refreshToken;

    @Builder.Default
    private String tokenType = "Bearer";

    private long expiresIn;

    // RBAC info — FE dùng để hiển thị badge role + chi nhánh, quyết định UX
    // (ẩn/hiện theater selector, auto-set theater khi tạo phòng, ...).
    private String username;
    private String role;
    /** Null cho USER + SUPER_ADMIN. Có giá trị cho branch ADMIN. */
    private Long theaterId;
    private String theaterName;
    private String theaterCity;
}
