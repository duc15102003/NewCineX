# Security Hardening — Tóm tắt 6 lớp bảo mật

> Mục đích: tổng hợp 6 lớp bảo mật đã apply tháng 6/2026 (gói A1-A3 + D1 + D4 + Q2). Đọc xong bạn hiểu vì sao CineX hiện tại an toàn hơn trước.

---

## Lớp 1 — Secrets không hardcode trong git

### Vấn đề trước

`application-dev.yml` có default JWT_SECRET + MoMo keys → leak qua git history. Nếu prod accidentally chạy `profile=dev` → secret exposure.

### Fix (commit `0fd1a12`)

- `application-dev.yml`: vẫn có sandbox defaults cho local DX (Mailtrap public sandbox, MoMo public test keys từ docs)
- `application.yml` (baseline production): `${JWT_SECRET}` no default → fail-fast nếu env không set
- Production deploy phải `SPRING_PROFILES_ACTIVE=prod` (KHÔNG để mặc định dev)
- Mailtrap credentials per-dev: mỗi dev tự setup `application-local.yml` riêng, không share inbox

---

## Lớp 2 — Rate limit endpoint sensitive

### Vấn đề trước

`/verify-email?token=...` và `/reset-password` không rate-limit. Attacker có thể:
1. Brute force token (UUID 36 ký tự → entropy effective bị giảm nếu thử vài tỷ lần)
2. DoS DB qua spam `findByToken`
3. Enumeration: thử token, đo response time

### Fix (commit `feff3fe`)

`EmailVerifyRateLimitService` — pattern Redis counter + TTL như `ForgotPasswordRateLimitService`:
- Key: `tokenverify:ip:{ip}`
- Max 30 attempts/IP/giờ (configurable qua `auth.token_verify_max_per_ip`)
- TTL 60 phút (configurable qua `auth.token_verify_window_minutes`)

`AuthService.verifyEmail` + `resetPassword` nhận `HttpServletRequest`, `resolveClientIp`, check + record attempt trước khi lookup token.

---

## Lớp 3 — Refresh token HttpOnly cookie (chống XSS theft)

### Vấn đề trước

Refresh token (7 ngày TTL) lưu localStorage. XSS payload (vd qua review comment chứa script) có thể `localStorage.getItem('refreshToken')` → impersonate user.

### Fix (commit `92c3fd3`) — Hybrid pattern Auth0/Cognito/Okta

| Token | TTL | Lưu ở đâu | XSS impact |
|---|---|---|---|
| **Access token** | 15 phút | localStorage + Authorization header | Có thể bị steal nhưng vô hại sau 15 phút |
| **Refresh token** | 7 ngày | HttpOnly cookie (Set-Cookie từ BE) | JS KHÔNG đọc được → XSS bất lực |

### Backend

`RefreshTokenCookieUtil`:
```java
ResponseCookie cookie = ResponseCookie.from("refreshToken", token)
    .httpOnly(true)           // JS không đọc được
    .secure(cookieSecure)      // prod true (HTTPS), dev false
    .sameSite("Lax")           // chống CSRF nhưng vẫn cho navigation (vd click link email)
    .path("/")
    .maxAge(Duration.ofMillis(refreshExpirationMs))
    .build();
response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
```

- `/api/auth/login` + `/register`: `moveRefreshTokenToCookie()` set cookie, null body field
- `/api/auth/refresh`: đọc `@CookieValue("refreshToken")` trước, body fallback cho client cũ
- `/api/auth/logout`: clear cookie với `max-age=0`

### Frontend

- `axios.create({ withCredentials: true })` → browser tự gửi cookie cho mọi request
- `authStore` bỏ field `refreshToken`, `setAuth(token, user)` signature đổi
- `/api/auth/refresh` body rỗng `{}`, browser tự gửi cookie

---

## Lớp 4 — OWASP security headers

### Fix (commit `8cde944`)

`SecurityConfig.headers()`:

| Header | Vai trò |
|---|---|
| `X-Frame-Options: DENY` | Chống clickjacking (browser không cho embed iframe) |
| `X-Content-Type-Options: nosniff` | Chống MIME confusion (browser không guess type) |
| `Referrer-Policy: same-origin` | Không leak full URL ra origin ngoài qua referrer |
| `Content-Security-Policy` | Chỉ load resource từ self + Cloudinary + MoMo CDN |
| `Strict-Transport-Security` | HSTS max-age 1 năm + includeSubDomains (effective sau lần đầu HTTPS) |

```java
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
```

---

## Lớp 5 — JSON strict deserialization

### Vấn đề trước

Spring Boot default IGNORE field không khai trong DTO:
```bash
POST /api/movies { "title": "X", "duration": 120, "isAdmin": true }
→ BE accept, ignore isAdmin
```

Rủi ro:
- Audit log nhiễu (request body có field rác BE không biết)
- Mass-assignment risk khi sau này thêm field nhạy cảm vào entity (vd `User.isAdmin`)
- Document lừa: client nghĩ field được hỗ trợ

### Fix (commit `a04a398`)

`application.yml`:
```yaml
spring:
  jackson:
    deserialization:
      fail-on-unknown-properties: true
```

→ Client gửi field unknown → throw `UnrecognizedPropertyException` → `GlobalExceptionHandler` trả 400 Bad Request.

---

## Lớp 6 — Multi-tenant access guards

### 6.1. counterSale theater scope (commit `3caf06a`)

Trước: endpoint `/api/bookings/counter-sale` chỉ check `@PreAuthorize hasRole('ADMIN')`. BRANCH_ADMIN rạp A vẫn gọi được với `showtimeId` của rạp B → booking attribute sai rạp.

Sau: derive `showtimeTheaterId = showtime.room.theater.id` → `securityService.requireAccessToTheater(showtimeTheaterId)`:
- SUPER_ADMIN: pass mọi theater (FE đã ép chọn 1 CN qua `POSTheaterRequired`)
- BRANCH_ADMIN: chỉ pass nếu theater khớp JWT scope → cross-theater → 403 FORBIDDEN

### 6.2. ageRating auto-block khi user khai DOB (commit `267e866`)

User profile có `dateOfBirth` optional. Khi book phim T13+, `BookingService.validateAgeIfDOBSet`:

```java
private void validateAgeIfDOBSet(User user, AgeRating ageRating) {
    if (user.getDateOfBirth() == null || ageRating == null) return; // chưa khai → FE confirm dialog
    int minAge = switch (ageRating) {
        case P, K -> 0;
        case T13 -> 13;
        case T16 -> 16;
        case T18 -> 18;
    };
    int userAge = Period.between(user.getDateOfBirth(), LocalDate.now()).getYears();
    if (userAge < minAge) {
        throw new BusinessException(ErrorCode.INVALID_REQUEST,
            "Phim này phân loại " + ageRating + " — yêu cầu từ " + minAge + " tuổi trở lên.");
    }
}
```

3-lớp enforcement age rating:
1. Confirm dialog FE khi đặt vé T13+
2. BE auto-block khi user khai DOB (lớp này)
3. POS reject check-in vật lý tại cổng (verify CCCD)

→ Xem [age-rating.md](./age-rating.md)

---

## Checklist Production-ready

Trước khi deploy production:

- [ ] `SPRING_PROFILES_ACTIVE=prod` (không để mặc định dev)
- [ ] Env vars: `JWT_SECRET`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY`, `DB_PASSWORD`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- [ ] `app.cookie.secure=true` (HTTPS → set Secure flag cho refresh cookie)
- [ ] HTTPS reverse proxy (Nginx/Caddy/Cloudflare) — HSTS chỉ effective khi đã HTTPS
- [ ] Disable Swagger UI production (hoặc auth-protected)
- [ ] Review CSP policyDirectives nếu thêm CDN ngoài (vd Google Analytics)
- [ ] Set rate-limit configs hợp lý theo expected traffic
- [ ] Review BCrypt strength — default 10 OK cho prod; tăng lên 12 nếu CPU dư
- [ ] Monitor `audit_logs` table — log admin actions
- [ ] Backup DB schedule (Liquibase DATABASECHANGELOG cần preserve)

---

## Tham khảo code

| File | Vai trò |
|---|---|
| `common/config/SecurityConfig.java` | OWASP headers + JWT filter chain + role hierarchy |
| `common/config/CorsConfig.java` | CORS allowCredentials cho refresh cookie |
| `module/auth/util/RefreshTokenCookieUtil.java` | Set/clear HttpOnly cookie |
| `module/auth/service/AuthService.java` | login/logout/refresh + rate-limit integration |
| `module/auth/service/EmailVerifyRateLimitService.java` | Redis counter cho /verify-email + /reset-password |
| `module/auth/service/ForgotPasswordRateLimitService.java` | Redis counter cho /forgot-password |
| `module/auth/service/LoginRateLimitService.java` | Redis counter cho /login (đã có từ trước) |
| `common/service/SecurityService.java` | `requireAccessToTheater(theaterId)` cho multi-tenant guard |
