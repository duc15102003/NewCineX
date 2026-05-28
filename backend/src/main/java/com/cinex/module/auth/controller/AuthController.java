package com.cinex.module.auth.controller;

import com.cinex.common.response.ApiResponse;
import com.cinex.module.auth.dto.AuthResponse;
import com.cinex.module.auth.dto.ForgotPasswordRequest;
import com.cinex.module.auth.dto.LoginRequest;
import com.cinex.module.auth.dto.RefreshTokenRequest;
import com.cinex.module.auth.dto.RegisterRequest;
import com.cinex.module.auth.dto.ResetPasswordRequest;
import com.cinex.module.auth.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "Auth", description = "Register, Login, Logout, Refresh, Reset Password")
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    @Operation(summary = "Register a new account")
    public ApiResponse<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ApiResponse.ok("Registration successful", authService.register(request));
    }

    @PostMapping("/login")
    @Operation(summary = "Login")
    public ApiResponse<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ApiResponse.ok("Login successful", authService.login(request));
    }

    @PostMapping("/refresh")
    @Operation(summary = "Refresh access token")
    public ApiResponse<AuthResponse> refresh(@Valid @RequestBody RefreshTokenRequest request) {
        return ApiResponse.ok(authService.refreshToken(request));
    }

    @PostMapping("/logout")
    @Operation(summary = "Logout — revoke all refresh tokens")
    public ApiResponse<Void> logout() {
        authService.logout();
        return ApiResponse.ok("Logged out", null);
    }

    @PostMapping("/forgot-password")
    @Operation(summary = "Send reset password email")
    public ApiResponse<Void> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        authService.forgotPassword(request);
        return ApiResponse.ok("If email exists, a reset link has been sent", null);
    }

    @PostMapping("/reset-password")
    @Operation(summary = "Reset password with token from email")
    public ApiResponse<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request);
        return ApiResponse.ok("Password reset successful", null);
    }
}
