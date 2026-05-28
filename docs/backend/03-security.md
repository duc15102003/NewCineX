# Security — Bảo mật ứng dụng

---

## 1. JWT (JSON Web Token)

### Là gì?
Chuỗi token chứa thông tin user, dùng để xác thực mỗi request thay vì session.

### Ví dụ đời thường
- **Session:** Mỗi lần vào công ty → bảo vệ gọi lên phòng HR hỏi "người này là nhân viên không?" (chậm)
- **JWT:** Có thẻ nhân viên → bảo vệ quét thẻ là biết (nhanh, không cần hỏi ai)

### Cấu trúc 3 phần

```
eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiVVNFUiIsInN1YiI6InZhbmFuIiwiaWF0IjoxNzE1MzIwMDAwLCJleHAiOjE3MTUzMjA5MDB9.abc123signature
──────── Header ──────  ──────────────────────────── Payload ────────────────────────────  ── Signature ──
```

**Header** (Base64):
```json
{ "alg": "HS256" }        // Thuật toán ký: HMAC-SHA256
```

**Payload** (Base64 — AI CŨNG ĐỌC ĐƯỢC, không mã hóa):
```json
{
    "sub": "vanan",        // Subject = username
    "role": "USER",        // Vai trò
    "iat": 1715320000,     // Issued at: thời điểm tạo
    "exp": 1715320900      // Expiration: hết hạn (15 phút sau)
}
```

**Signature** (không decode được):
```
HMACSHA256(
    base64(header) + "." + base64(payload),
    secret_key     // ← chỉ server biết
)
```

### Tại sao an toàn?
- Payload ai cũng đọc được (chỉ là Base64)
- Nhưng **KHÔNG THỂ SỬA** payload vì không có secret key để tạo lại signature
- Server verify: tạo lại signature → so sánh → khớp = hợp lệ, khác = bị sửa

### Decode JWT thử
Vào https://jwt.io → paste token → thấy payload rõ ràng. Nhưng không sửa được vì thiếu secret key.

### Access Token vs Refresh Token

| | Access Token | Refresh Token |
|---|---|---|
| **Là gì** | JWT chứa info user | Chuỗi UUID lưu DB |
| **Thời hạn** | 15 phút (ngắn) | 7 ngày (dài) |
| **Dùng để** | Gắn vào header gọi API | Lấy access token mới khi hết hạn |
| **Lưu ở đâu** | Client (localStorage) | Client + Server (DB) |
| **Thu hồi** | Không được (chờ hết hạn) | Được (set revoked=true trong DB) |

### Tại sao cần cả 2?
- Access token 7 ngày → bị lộ → hacker dùng 7 ngày
- Access token 15 phút → user phải login lại mỗi 15 phút
- **Giải pháp:** Access 15 phút + Refresh 7 ngày
  - Hết 15 phút → dùng refresh lấy access mới → user không biết
  - Bị lộ access → chỉ dùng được 15 phút

### Luồng trong CineX

```
1. User login → server trả { accessToken, refreshToken }
2. User gọi API → header: Authorization: Bearer <accessToken>
3. Access hết hạn → FE tự gọi /api/auth/refresh với refreshToken
4. Server trả accessToken mới → FE tiếp tục gọi API
5. Refresh hết hạn (7 ngày) → user phải login lại
```

---

## 2. BCrypt — Hash password

### Là gì?
Mã hóa password **1 chiều** — hash thành chuỗi random, không thể giải mã ngược.

### Ví dụ đời thường
Xay sinh tố: táo + chuối + sữa → sinh tố. Không thể lấy lại quả táo nguyên vẹn.

### Cách hoạt động

```
Input:  "123456"
Output: "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"
         ──── ── ──────────────────────── ──────────────────────────────
          │    │         │                              │
          │    │    Salt (ngẫu nhiên)              Hash (kết quả)
          │    Cost (10 = 2^10 rounds = chậm có chủ đích)
          Algorithm (2a = BCrypt)
```

### Salt là gì?
Chuỗi **ngẫu nhiên** thêm vào password trước khi hash.
- `hash("123456" + salt1)` → "abc..."
- `hash("123456" + salt2)` → "xyz..." (KHÁC nhau dù cùng password)
- → Hacker không thể dùng bảng hash sẵn (rainbow table) để dò

### Verify (so sánh)
```java
// Login: user nhập "123456"
BCrypt.matches("123456", "$2a$10$N9qo8uLO...")
// 1. Tách salt từ hash đã lưu
// 2. Hash lại "123456" + salt → ra kết quả mới
// 3. So sánh kết quả mới với hash đã lưu → khớp = đúng password
```

### Tại sao không dùng MD5/SHA?
- MD5/SHA: nhanh (hàng tỷ hash/giây) → hacker brute force dễ
- BCrypt: **chậm có chủ đích** (cost=10 → ~100ms/hash) → brute force rất lâu

### Trong CineX
```java
// Register: hash password trước khi lưu DB
String hash = passwordEncoder.encode("123456");
user.setPassword(hash);

// Login: so sánh
if (!passwordEncoder.matches(inputPassword, user.getPassword())) {
    throw new BusinessException(ErrorCode.INVALID_CREDENTIALS);
}
```

---

## 3. CORS — Cross-Origin Resource Sharing

### Là gì?
Cơ chế trình duyệt **chặn** request từ domain A gọi API domain B.

### Tại sao trình duyệt chặn?
Bảo vệ user: web giả mạo (hacker.com) không thể gọi API ngân hàng của bạn.

```
FE: http://localhost:5173  (origin A)
BE: http://localhost:8088  (origin B — KHÁC PORT = KHÁC ORIGIN)

Trình duyệt: "Khác origin → CHẶN!"
Postman: "Tôi không phải trình duyệt, tôi không chặn" (OK)
```

### Luồng CORS (Preflight)

```
Bước 1: Trình duyệt gửi OPTIONS trước (preflight — hỏi thăm)
    OPTIONS /api/auth/login
    Origin: http://localhost:5173
    Access-Control-Request-Method: POST

Bước 2: Server trả lời
    Access-Control-Allow-Origin: http://localhost:5173  ← "OK cho vào"
    Access-Control-Allow-Methods: GET, POST, PUT, DELETE
    Access-Control-Allow-Headers: *

Bước 3: Trình duyệt thấy được phép → gửi request thật
    POST /api/auth/login
    Origin: http://localhost:5173
    Content-Type: application/json
    Body: { "username": "vanan", "password": "123456" }
```

### Config trong CineX

```java
@Configuration
public class CorsConfig {
    @Bean
    public CorsFilter corsFilter() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of("http://localhost:5173"));
        // ↑ CHỈ cho FE ở port 5173. Web khác → bị chặn.
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));         // Cho phép header Authorization
        config.setAllowCredentials(true);                // Cho phép gửi token
        // ...
    }
}
```

### Lỗi CORS thường gặp
```
Console: Access to fetch at 'http://localhost:8088/api/movies'
         from origin 'http://localhost:5173' has been blocked by CORS policy

Nguyên nhân:
1. Backend chưa config CORS
2. FE chạy sai port (không phải 5173)
3. Backend chưa start
```

---

## 4. SecurityFilterChain — Chuỗi bộ lọc bảo mật

### Luồng request đi qua các filter

```
Client gửi request
    │
    ▼
┌─────────────────────────┐
│  CorsFilter             │  Kiểm tra origin có được phép?
│  localhost:5173 → OK ✅  │  Hacker.com → CHẶN ❌
└──────────┬──────────────┘
           ▼
┌─────────────────────────┐
│  JwtAuthFilter          │  1. Lấy header "Authorization: Bearer eyJ..."
│  (code mình viết)       │  2. Cắt "Bearer " → lấy token
│                         │  3. jwtUtil.extractUsername(token) → "vanan"
│                         │  4. Tìm user "vanan" trong DB
│                         │  5. Token hợp lệ → set Authentication vào context
│                         │  6. Token sai/hết hạn → bỏ qua, đi tiếp
└──────────┬──────────────┘
           ▼
┌─────────────────────────┐
│  AuthorizationFilter    │  URL /api/auth/** → cho qua (permitAll)
│  (Spring tự tạo)        │  URL /swagger-ui → cho qua
│                         │  URL /api/movies → cần authenticated?
│                         │    → Có Authentication trong context? → OK ✅
│                         │    → Không có? → trả 401 ❌
└──────────┬──────────────┘
           ▼
┌─────────────────────────┐
│  Controller             │  Xử lý request, trả response
└─────────────────────────┘
```

### Config SecurityFilterChain

```java
@Bean
public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
    return http
        .csrf(AbstractHttpConfigurer::disable)
        // ↑ Tắt CSRF vì dùng JWT (stateless). CSRF chỉ cần cho cookie-based session.

        .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        // ↑ Không tạo session trên server. Mỗi request mang token riêng.

        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/api/health", "/api/auth/**", "/swagger-ui/**", "/v3/api-docs/**").permitAll()
            // ↑ Các URL public — không cần token

            .anyRequest().authenticated()
            // ↑ Tất cả URL khác — PHẢI có token hợp lệ
        )

        .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
        // ↑ Chèn JwtAuthFilter VÀO TRƯỚC filter mặc định
        // → Request đi qua JwtAuthFilter trước

        .build();
}
```

---

## 5. Validation (@Valid) — Kiểm tra dữ liệu đầu vào

### Là gì?
Kiểm tra data client gửi lên **trước khi** vào Service. Sai → trả lỗi ngay.

### Ví dụ đời thường
Nộp hồ sơ: bảo vệ kiểm tra "có đủ giấy tờ?" TRƯỚC KHI cho vào phỏng vấn.

### Ví dụ đầy đủ

```java
// DTO với validation
public class RegisterRequest {

    @NotBlank(message = "Username is required")
    @Size(min = 3, max = 50, message = "Username must be between 3 and 50 characters")
    private String username;

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;

    @NotBlank(message = "Password is required")
    @Size(min = 6, max = 100, message = "Password must be between 6 and 100 characters")
    private String password;
}

// Controller — @Valid kích hoạt validation
@PostMapping("/register")
public ApiResponse<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
    // request đã được validate, chắc chắn đúng format
    return ApiResponse.ok(authService.register(request));
}
```

### Client gửi data sai → response

```json
// Request: { "username": "", "email": "abc", "password": "12" }
// Response 400:
{
    "success": false,
    "message": "username: Username is required; email: Invalid email format; password: Password must be between 6 and 100 characters"
}
// Service KHÔNG bị gọi → tiết kiệm tài nguyên
```

### Các annotation validation

| Annotation | Tác dụng | Ví dụ |
|---|---|---|
| `@NotBlank` | Không null, rỗng, khoảng trắng | username, password |
| `@NotNull` | Không null (cho phép rỗng) | showtimeId |
| `@Email` | Đúng format email | email |
| `@Size(min, max)` | Độ dài chuỗi | password min=6 |
| `@Min(value)` | Số >= value | duration min=1 |
| `@Max(value)` | Số <= value | rating max=10 |
| `@Positive` | Số > 0 | price |
| `@Future` | Ngày trong tương lai | startTime |
| `@Past` | Ngày trong quá khứ | birthDate |
| `@Pattern(regex)` | Khớp regex | phone: `^0[0-9]{9}$` |

### Validate ở DTO vs Service

| DTO (@Valid) | Service |
|---|---|
| Format: rỗng, email, độ dài | Logic: username trùng, ghế đã đặt |
| Spring tự kiểm tra | Viết if-else |
| Không cần query DB | Cần query DB |
| **Dùng cả hai** | **Dùng cả hai** |

---

## 6. Exception Handling — Xử lý lỗi toàn cục

### Vấn đề
Không có exception handler → server trả **stack trace** cho client → lộ code, lộ cấu trúc → hacker lợi dụng.

### GlobalExceptionHandler

```java
@RestControllerAdvice  // ← Spring tự gọi khi CÓ exception
public class GlobalExceptionHandler {

    // Lỗi nghiệp vụ (user gây ra) → 4xx
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusiness(BusinessException ex) {
        return ResponseEntity
            .status(ex.getErrorCode().getHttpStatus())
            .body(ApiResponse.error(ex.getMessage()));
    }
    // VD: throw new BusinessException(ErrorCode.USER_EXISTED, "Username already exists")
    // → Response 409: { "success": false, "message": "Username already exists" }

    // Lỗi validation (sai format) → 400
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
            .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
            .reduce((a, b) -> a + "; " + b)
            .orElse("Validation failed");
        return ResponseEntity.badRequest().body(ApiResponse.error(message));
    }
    // VD: { "username": "" } → Response 400: "username: Username is required"

    // Lỗi hệ thống (bug, DB down) → 500
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGeneral(Exception ex) {
        log.error("System error: ", ex);   // ← log đầy đủ trong server
        return ResponseEntity.status(500)
            .body(ApiResponse.error("An unexpected error occurred"));
        // Client CHỈ thấy message chung, KHÔNG thấy stack trace
    }
}
```

### ErrorCode enum

```java
public enum ErrorCode {
    UNCATEGORIZED(9999, "An unexpected error occurred", HttpStatus.INTERNAL_SERVER_ERROR),
    UNAUTHORIZED(1001, "Unauthorized", HttpStatus.UNAUTHORIZED),
    FORBIDDEN(1002, "Access denied", HttpStatus.FORBIDDEN),
    NOT_FOUND(1003, "Resource not found", HttpStatus.NOT_FOUND),
    USER_EXISTED(1004, "User already exists", HttpStatus.CONFLICT),
    INVALID_CREDENTIALS(1006, "Invalid username or password", HttpStatus.UNAUTHORIZED),
    SEAT_TAKEN(2001, "Seat already taken", HttpStatus.CONFLICT),
    BOOKING_EXPIRED(2002, "Booking has expired", HttpStatus.BAD_REQUEST),
    // Thêm mã lỗi mới ở đây khi cần
}
```

### Cách sử dụng

```java
// Trong Service
if (userRepo.existsByUsername(username)) {
    throw new BusinessException(ErrorCode.USER_EXISTED, "Username already exists");
    // → GlobalExceptionHandler bắt → trả 409 + message
}

Movie movie = movieRepo.findById(id)
    .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Movie not found"));
    // → trả 404 + "Movie not found"
```

---

## 7. Thực tế trong CineX — Tất cả file Security nằm ở đâu

### Danh sách file và tác dụng

```
backend/src/main/java/com/cinex/
├── security/
│   ├── JwtUtil.java                ← Tạo token, parse token, verify token
│   ├── JwtAuthFilter.java          ← Filter chạy mỗi request, kiểm tra token
│   └── CustomUserDetailsService.java ← Load user từ DB cho Spring Security
├── common/
│   ├── config/
│   │   ├── SecurityConfig.java     ← Cấu hình: URL nào public, URL nào cần auth
│   │   └── CorsConfig.java        ← Cho phép FE gọi BE (cross-origin)
│   └── exception/
│       ├── ErrorCode.java          ← Enum mã lỗi (401, 403, 404, ...)
│       ├── BusinessException.java  ← Exception nghiệp vụ
│       └── GlobalExceptionHandler.java ← Bắt tất cả exception, trả JSON chuẩn
└── module/auth/
    ├── controller/AuthController.java ← API: /register, /login, /refresh
    ├── service/AuthService.java       ← Logic: hash password, tạo token
    ├── service/RefreshTokenService.java ← Logic: tạo/validate refresh token
    ├── dto/RegisterRequest.java       ← Input đăng ký (có @Valid)
    ├── dto/LoginRequest.java          ← Input đăng nhập
    ├── dto/AuthResponse.java          ← Output: accessToken + refreshToken
    ├── dto/RefreshTokenRequest.java   ← Input refresh token
    ├── entity/User.java               ← Entity map bảng users
    ├── entity/RefreshToken.java       ← Entity map bảng refresh_tokens
    ├── entity/Role.java               ← Enum: USER, ADMIN
    └── repository/
        ├── UserRepository.java        ← Query bảng users
        └── RefreshTokenRepository.java ← Query bảng refresh_tokens
```

### Luồng đăng ký — đi qua file nào?

```
Client gửi POST /api/auth/register { username, email, password }
    │
    ▼
CorsFilter (CorsConfig.java)
    → Kiểm tra origin http://localhost:5173 → OK
    │
    ▼
JwtAuthFilter (JwtAuthFilter.java)
    → Không có header Authorization → bỏ qua, đi tiếp
    │
    ▼
AuthorizationFilter (SecurityConfig.java)
    → URL /api/auth/** → permitAll → cho qua, không cần token
    │
    ▼
AuthController.register() (AuthController.java)
    → @Valid → Spring kiểm tra RegisterRequest:
      username != blank? ✅  email đúng format? ✅  password >= 6 ký tự? ✅
    → Sai → MethodArgumentNotValidException → GlobalExceptionHandler → 400
    → Đúng → gọi authService.register(request)
    │
    ▼
AuthService.register() (AuthService.java)
    → userRepo.existsByUsername("testuser") → false → OK
    → userRepo.existsByEmail("test@cinex.com") → false → OK
    → passwordEncoder.encode("123456") → "$2a$10$xxx..." (BCrypt hash)
    → User.builder().username("testuser").password("$2a$10$xxx...").build()
    → userRepo.save(user) → INSERT INTO users (...) VALUES (...)
    │
    ▼
AuthService.buildAuthResponse() (AuthService.java)
    → jwtUtil.generateToken("testuser", {role: "USER"}) → "eyJhbG..." (JWT)
    → refreshTokenService.createRefreshToken(user) → UUID + lưu DB
    → return AuthResponse { accessToken, refreshToken, expiresIn: 900 }
    │
    ▼
AuthController → ApiResponse.ok("Registration successful", authResponse)
    │
    ▼
Client nhận:
{
    "success": true,
    "message": "Registration successful",
    "data": {
        "accessToken": "eyJhbG...",
        "refreshToken": "a1b2c3d4-...",
        "tokenType": "Bearer",
        "expiresIn": 900
    }
}
```

### Luồng đăng nhập — đi qua file nào?

```
Client gửi POST /api/auth/login { username: "testuser", password: "123456" }
    │
    ▼
CorsFilter → JwtAuthFilter (bỏ qua) → AuthorizationFilter (permitAll)
    │
    ▼
AuthController.login() → authService.login(request)
    │
    ▼
AuthService.login()
    → userRepo.findByUsername("testuser")
      → Không tìm thấy? → throw BusinessException(INVALID_CREDENTIALS)
                           → GlobalExceptionHandler → 401 "Invalid username or password"
      → Tìm thấy user ✅
    │
    → passwordEncoder.matches("123456", user.getPassword())
      → Sai password? → throw BusinessException(INVALID_CREDENTIALS) → 401
      → Đúng password ✅
    │
    → user.isEnabled()?
      → false? → throw BusinessException(FORBIDDEN, "Account is disabled") → 403
      → true ✅
    │
    → buildAuthResponse(user) → tạo JWT + refresh token → trả về
```

### Luồng gọi API có xác thực — đi qua file nào?

```
Client gửi GET /api/movies
    Header: Authorization: Bearer eyJhbGciOiJIUzM4NCJ9.eyJyb2xlIjoi...
    │
    ▼
CorsFilter → OK
    │
    ▼
JwtAuthFilter.doFilterInternal() (JwtAuthFilter.java)
    │
    ├── 1. String authHeader = request.getHeader("Authorization")
    │      → "Bearer eyJhbGci..."
    │
    ├── 2. String token = authHeader.substring(7)
    │      → "eyJhbGci..." (bỏ "Bearer ")
    │
    ├── 3. String username = jwtUtil.extractUsername(token)
    │      → JwtUtil parse token → lấy field "sub" → "testuser"
    │      → Nếu token sai format/hết hạn → exception → bỏ qua filter
    │
    ├── 4. UserDetails userDetails = userDetailsService.loadUserByUsername("testuser")
    │      → CustomUserDetailsService.java
    │      → userRepo.findByUsername("testuser") → tìm trong DB
    │      → Trả về UserDetails { username, password, authorities: [ROLE_USER] }
    │
    ├── 5. jwtUtil.isTokenValid(token, "testuser")
    │      → Username khớp? ✅  Token chưa hết hạn? ✅  → hợp lệ
    │
    └── 6. Set Authentication vào SecurityContext
           → UsernamePasswordAuthenticationToken { principal: userDetails, authorities: [ROLE_USER] }
           → SecurityContextHolder.getContext().setAuthentication(authToken)
           → Từ giờ: mọi code trong request này đều biết user là "testuser", role là "USER"
    │
    ▼
AuthorizationFilter (SecurityConfig.java)
    → URL /api/movies → anyRequest().authenticated()
    → Có Authentication trong SecurityContext? → CÓ (JwtAuthFilter vừa set) → OK ✅
    │
    ▼
MovieController.getMovies()
    → Xử lý request, trả danh sách phim
```

### Luồng khi token hết hạn

```
Phút 0:  Login → accessToken (hết hạn sau 15 phút) + refreshToken (7 ngày)
Phút 14: Gọi API → OK (token còn hạn)
Phút 16: Gọi API → JwtAuthFilter: token expired → KHÔNG set Authentication
         → AuthorizationFilter: không có Authentication → 401 Unauthorized
         │
         ▼
FE nhận 401 → axios response interceptor tự động:
    → Gọi POST /api/auth/refresh { refreshToken: "a1b2c3d4-..." }
    │
    ▼
AuthController.refresh() → refreshTokenService.validateRefreshToken("a1b2c3d4-...")
    → Tìm trong DB → tồn tại + chưa revoke + chưa hết hạn → OK
    → jwtUtil.generateToken("testuser", {role: "USER"}) → access token MỚI
    → Trả AuthResponse { accessToken: "eyJ...(MỚI)", refreshToken: "a1b2c3d4-..." }
    │
    ▼
FE nhận token mới → lưu localStorage → gọi lại API ban đầu → thành công
User KHÔNG biết gì, KHÔNG cần login lại
```

---

## 8. Ví dụ thực tế — Test bằng curl

### Đăng ký
```bash
curl -X POST http://localhost:8088/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@cinex.com","password":"123456","fullName":"Test User"}'
```

### Đăng nhập
```bash
curl -X POST http://localhost:8088/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"123456"}'
```

### Gọi API có token
```bash
# Lấy token từ response login, thay vào đây
TOKEN="eyJhbGci..."

curl http://localhost:8088/api/health \
  -H "Authorization: Bearer $TOKEN"
```

### Gọi API không có token → 401
```bash
curl http://localhost:8088/api/health
# → Nếu /api/health là permitAll → vẫn OK
# Thử URL cần auth (khi có):
curl http://localhost:8088/api/users/me
# → 401 Unauthorized
```

### Refresh token
```bash
curl -X POST http://localhost:8088/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"a1b2c3d4-xxxx-yyyy-zzzz"}'
```

### Đăng ký trùng username → 409
```bash
curl -X POST http://localhost:8088/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test2@cinex.com","password":"123456"}'
# → { "success": false, "message": "Username already exists" }
```

### Đăng nhập sai password → 401
```bash
curl -X POST http://localhost:8088/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"wrongpass"}'
# → { "success": false, "message": "Invalid username or password" }
```

### Validation lỗi → 400
```bash
curl -X POST http://localhost:8088/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"","email":"abc","password":"12"}'
# → { "success": false, "message": "username: Username is required; email: Invalid email format; password: Password must be between 6 and 100 characters" }
```

---

## 9. Khi nào cần sửa file nào?

| Tình huống | File cần sửa |
|---|---|
| Thêm URL public mới (VD: `/api/movies` cho phép xem không cần login) | `SecurityConfig.java` → thêm vào `PUBLIC_URLS` |
| Thêm role mới (VD: STAFF) | `Role.java` → thêm enum. `SecurityConfig.java` → thêm `@PreAuthorize` |
| Sửa thời gian hết hạn token | `application.yml` → `app.jwt.expiration-ms` |
| Cho phép FE ở domain khác gọi API | `CorsConfig.java` → thêm vào `setAllowedOrigins` |
| Thêm loại lỗi mới | `ErrorCode.java` → thêm enum |
| Thêm validation cho DTO mới | DTO class → thêm `@NotBlank`, `@Size`, ... |

---

## 10. Câu hỏi tự kiểm tra

1. **JWT có mã hóa payload không?** → Không, chỉ Base64 encode. Ai cũng đọc được. An toàn nhờ signature.

2. **Tại sao tắt CSRF khi dùng JWT?** → CSRF tấn công qua cookie. JWT gửi qua header, không dùng cookie → không bị CSRF.

3. **User A có token, gửi cho User B. B dùng được không?** → Được, trong 15 phút. Vì JWT stateless, server không biết ai đang cầm token. Đây là lý do access token phải ngắn hạn.

4. **Nếu bỏ `@Valid` trong Controller, điều gì xảy ra?** → Request không được validate → data sai vào Service → có thể gây lỗi DB (VD: username null → SQL error) hoặc lỗi logic.

5. **Tại sao `passwordEncoder.matches()` chứ không phải `equals()`?** → BCrypt hash có salt ngẫu nhiên, cùng password hash 2 lần ra 2 kết quả KHÁC nhau. `matches()` tách salt + hash lại + so sánh. `equals()` so sánh string → luôn sai.
