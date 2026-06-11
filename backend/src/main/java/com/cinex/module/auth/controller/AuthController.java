package com.cinex.module.auth.controller;

import com.cinex.common.response.ApiResponse;
import com.cinex.module.auth.dto.AuthResponse;
import com.cinex.module.auth.dto.ForgotPasswordRequest;
import com.cinex.module.auth.dto.LoginRequest;
import com.cinex.module.auth.dto.RefreshTokenRequest;
import com.cinex.module.auth.dto.RegisterRequest;
import com.cinex.module.auth.dto.ResetPasswordRequest;
import com.cinex.module.auth.service.AuthService;
import com.cinex.module.auth.util.RefreshTokenCookieUtil;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "Auth", description = "Register, Login, Logout, Refresh, Reset Password")
public class AuthController {

    private final AuthService authService;
    private final RefreshTokenCookieUtil cookieUtil;

    @PostMapping("/register")
    @Operation(summary = "Register a new account")
    public ApiResponse<AuthResponse> register(@Valid @RequestBody RegisterRequest request,
                                               HttpServletResponse httpResponse) {
        AuthResponse res = authService.register(request);
        moveRefreshTokenToCookie(res, httpResponse);
        return ApiResponse.ok("Registration successful", res);
    }

    @PostMapping("/login")
    @Operation(summary = "Login")
    public ApiResponse<AuthResponse> login(@Valid @RequestBody LoginRequest request,
                                           HttpServletRequest httpRequest,
                                           HttpServletResponse httpResponse) {
        AuthResponse res = authService.login(request, httpRequest);
        moveRefreshTokenToCookie(res, httpResponse);
        return ApiResponse.ok("Login successful", res);
    }

    @PostMapping("/refresh")
    @Operation(summary = "Refresh access token — đọc refresh token từ HttpOnly cookie")
    public ApiResponse<AuthResponse> refresh(
            @CookieValue(value = RefreshTokenCookieUtil.COOKIE_NAME, required = false) String cookieRefreshToken,
            @RequestBody(required = false) RefreshTokenRequest body,
            HttpServletResponse httpResponse) {
        // Cookie WIN; body fallback cho client cũ chưa migrate (deprecated).
        String refreshToken = (cookieRefreshToken != null && !cookieRefreshToken.isBlank())
                ? cookieRefreshToken
                : (body != null ? body.getRefreshToken() : null);
        if (refreshToken == null || refreshToken.isBlank()) {
            return ApiResponse.error("Missing refresh token");
        }
        RefreshTokenRequest req = new RefreshTokenRequest();
        req.setRefreshToken(refreshToken);
        AuthResponse res = authService.refreshToken(req);
        moveRefreshTokenToCookie(res, httpResponse);
        return ApiResponse.ok(res);
    }

    @PostMapping("/logout")
    @Operation(summary = "Logout — revoke refresh tokens + clear cookie + blacklist access token")
    public ApiResponse<Void> logout(HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        authService.logout(httpRequest);
        cookieUtil.clearRefreshTokenCookie(httpResponse);
        return ApiResponse.ok("Logged out", null);
    }

    /**
     * Chuyển refreshToken từ body sang HttpOnly cookie:
     * - Set cookie qua header Set-Cookie (HttpOnly, Secure prod, SameSite=Lax)
     * - Null-out field refreshToken trong response body (FE không cần — browser tự gửi cookie)
     */
    private void moveRefreshTokenToCookie(AuthResponse res, HttpServletResponse httpResponse) {
        if (res != null && res.getRefreshToken() != null) {
            cookieUtil.setRefreshTokenCookie(httpResponse, res.getRefreshToken());
            res.setRefreshToken(null);
        }
    }

    @PostMapping("/forgot-password")
    @Operation(summary = "Send reset password email")
    public ApiResponse<Void> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request,
                                            HttpServletRequest httpRequest) {
        authService.forgotPassword(request, httpRequest);
        return ApiResponse.ok("If email exists, a reset link has been sent", null);
    }

    @PostMapping("/reset-password")
    @Operation(summary = "Reset password with token from email")
    public ApiResponse<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest request,
                                            HttpServletRequest httpRequest) {
        authService.resetPassword(request, httpRequest);
        return ApiResponse.ok("Password reset successful", null);
    }

    @GetMapping("/verify-email")
    @Operation(summary = "Verify email with token from registration email")
    public ApiResponse<Void> verifyEmail(@RequestParam("token") String token,
                                          HttpServletRequest httpRequest) {
        authService.verifyEmail(token, httpRequest);
        return ApiResponse.ok("Email verified successfully", null);
    }
}
