package com.cinex.common.config;

import com.cinex.security.JwtAuthFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.hierarchicalroles.RoleHierarchy;
import org.springframework.security.access.hierarchicalroles.RoleHierarchyImpl;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    @Value("${app.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    /**
     * Lấy origin (scheme + host + port) từ frontend URL — connect-src CSP yêu cầu origin không có path.
     * Vd "http://localhost:5173/admin" → "http://localhost:5173".
     */
    private String frontendOriginForCsp() {
        try {
            java.net.URI uri = java.net.URI.create(frontendUrl);
            return uri.getScheme() + "://" + uri.getAuthority();
        } catch (Exception e) {
            return frontendUrl;
        }
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
                .cors(cors -> {})  // Bật CORS — dùng CorsConfig bean đã khai báo
                .csrf(AbstractHttpConfigurer::disable)
                // Security headers (OWASP recommendations) — áp cho mọi response
                .headers(headers -> headers
                        // X-Frame-Options: DENY — chống clickjacking (browser không cho embed trong iframe)
                        .frameOptions(frame -> frame.deny())
                        // X-Content-Type-Options: nosniff — browser không guess MIME (chống MIME confusion attack)
                        .contentTypeOptions(nosniff -> {})
                        // Referrer-Policy: same-origin — không leak full URL ra rạp ngoài qua referrer
                        .referrerPolicy(referrer -> referrer
                                .policy(org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter.ReferrerPolicy.SAME_ORIGIN))
                        // CSP — chỉ load resource từ self + trusted CDN. Báo cáo violation tới /csp-report (chưa wire)
                        .contentSecurityPolicy(csp -> csp.policyDirectives(
                                "default-src 'self'; " +
                                "img-src 'self' data: https://res.cloudinary.com https://*.momocdn.net; " +
                                "script-src 'self' 'unsafe-inline'; " +
                                "style-src 'self' 'unsafe-inline'; " +
                                "connect-src 'self' " + frontendOriginForCsp() + "; " +
                                "frame-ancestors 'none'; " +
                                "base-uri 'self'; " +
                                "form-action 'self'"
                        ))
                        // HSTS — bắt browser luôn HTTPS (chỉ effective khi đã HTTPS lần đầu)
                        .httpStrictTransportSecurity(hsts -> hsts
                                .includeSubDomains(true)
                                .maxAgeInSeconds(31536000)) // 1 năm
                )
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // Luôn public
                        .requestMatchers("/api/health").permitAll()
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**").permitAll()

                        // Chỉ GET public (xem phim, thể loại, phòng, ghế, chi nhánh) — POST/PUT/DELETE cần auth
                        .requestMatchers(HttpMethod.GET, "/api/movies/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/genres/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/rooms/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/showtimes/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/theaters/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/movie-runs/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/combos/public").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/bookings/showtimes/*/occupied-seats").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/configs/public/**").permitAll()

                        // Payment callback (user redirect GET) + IPN (server-to-server POST) — không có JWT
                        .requestMatchers(HttpMethod.GET, "/api/payments/callback").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/payments/ipn").permitAll()

                        // WebSocket
                        .requestMatchers("/ws/**").permitAll()

                        // Còn lại cần authenticated (POST, PUT, DELETE, user APIs, ...)
                        .anyRequest().authenticated()
                )
                // Unauthenticated (no token / expired) → 401, không phải 403
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED))
                )
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    /**
     * Role hierarchy — phản ánh chain of command nhân sự rạp:
     * SUPER_ADMIN (HQ) → ADMIN (manager) → STAFF (cashier) → USER.
     *
     * <p><b>Tác động:</b> mọi {@code @PreAuthorize("hasRole('ADMIN')")} hiện tại
     * (72+ chỗ) tự động cho phép SUPER_ADMIN. {@code hasRole('STAFF')} cho phép
     * cả ADMIN và SUPER_ADMIN — manager có thể thao tác POS nếu cần. STAFF
     * KHÔNG được quyền ADMIN (không sửa config được).
     *
     * <p>Spring convert {@code Role.ADMIN} thành authority {@code ROLE_ADMIN}.
     */
    @Bean
    public RoleHierarchy roleHierarchy() {
        return RoleHierarchyImpl.fromHierarchy(
                "ROLE_SUPER_ADMIN > ROLE_ADMIN\n" +
                "ROLE_ADMIN > ROLE_STAFF\n" +
                "ROLE_STAFF > ROLE_USER"
        );
    }
}
