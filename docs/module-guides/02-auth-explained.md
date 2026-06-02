# Module Auth — Giải thích chi tiết

## 1. Tổng quan
Module Auth xử lý **xác thực** (authentication) — ai đang dùng hệ thống:
- Đăng ký tài khoản mới
- Đăng nhập lấy token
- Refresh token khi access token hết hạn
- Logout (revoke token)
- Quên mật khẩu (gửi email reset link)
- Reset mật khẩu (token dùng 1 lần, hết hạn 15 phút)

**Bài toán giải quyết:**
- User cần đăng nhập để đặt vé, xem profile
- Server cần biết "request này của ai" mà KHÔNG lưu session (stateless)
- Password phải an toàn (hash 1 chiều)
- Token bị lộ phải hạn chế thiệt hại (access token ngắn hạn + refresh token thu hồi được)

## 2. Danh sách files đã tạo/sửa

| File | Tác dụng | Design Pattern |
|---|---|---|
| `module/auth/entity/Role.java` | Enum vai trò: USER, ADMIN | Enum Pattern |
| `module/auth/entity/User.java` | Entity map bảng `users`, extends BaseEntity | — |
| `module/auth/entity/RefreshToken.java` | Entity map bảng `refresh_tokens` | — |
| `module/auth/dto/RegisterRequest.java` | Data đăng ký + validation | DTO Pattern |
| `module/auth/dto/LoginRequest.java` | Data đăng nhập + validation | DTO Pattern |
| `module/auth/dto/AuthResponse.java` | Response chứa tokens | DTO + Builder |
| `module/auth/dto/RefreshTokenRequest.java` | Data refresh token | DTO Pattern |
| `module/auth/repository/UserRepository.java` | Truy vấn bảng users | Repository |
| `module/auth/repository/RefreshTokenRepository.java` | Truy vấn bảng refresh_tokens | Repository |
| `module/auth/service/AuthService.java` | Logic register/login/refresh | Service Layer |
| `module/auth/service/RefreshTokenService.java` | Tạo/validate/revoke refresh token | Service Layer |
| `module/auth/controller/AuthController.java` | 3 API endpoints | Controller |
| `security/JwtUtil.java` | Tạo/verify JWT token (JJWT library) | — |
| `security/JwtAuthFilter.java` | Filter xác thực JWT mỗi request | Chain of Responsibility |
| `security/CustomUserDetailsService.java` | Load user từ DB cho Spring Security | — |
| `common/config/SecurityConfig.java` | Cấu hình security: CORS, CSRF, stateless | Configuration |

---

## 3. Design Patterns đã áp dụng

### 3.1 Filter — Chain of Responsibility (Behavioral)

#### Pattern là gì?
Một chuỗi các "bộ lọc" xử lý request theo thứ tự. Mỗi filter quyết định: xử lý xong → chuyển tiếp cho filter tiếp theo, hoặc dừng lại.

#### Ví dụ đời thường
Vào rạp xem phim:
1. **Bảo vệ cổng:** Kiểm tra vé (JwtAuthFilter — có token không?)
2. **Nhân viên soát vé:** Kiểm tra vé đúng suất (AuthorizationFilter — có quyền truy cập URL không?)
3. **Vào phòng chiếu:** Xem phim (Controller — xử lý request)

Nếu không có vé → bảo vệ chặn ngay, không cần soát vé.

#### Áp dụng ở đâu — SecurityFilterChain

```
Client gửi request
    │
    ▼
┌─────────────────────────────┐
│  CorsFilter                 │  ← Kiểm tra origin (localhost:5173 OK)
└─────────────┬───────────────┘
              ▼
┌─────────────────────────────┐
│  JwtAuthFilter              │  ← Lấy token từ header → validate → set SecurityContext
│  (OncePerRequestFilter)     │
│                             │
│  if (có token hợp lệ) {    │
│    → set Authentication     │
│  } else {                   │
│    → bỏ qua, đi tiếp       │
│  }                          │
└─────────────┬───────────────┘
              ▼
┌─────────────────────────────┐
│  AuthorizationFilter        │  ← Kiểm tra URL có cần auth không
│  (Spring Security built-in) │
│                             │
│  /api/auth/** → permitAll   │  ← Cho qua không cần token
│  GET /api/movies/** → permitAll│ ← Xem phim (chỉ GET)
│  GET /api/genres/** → permitAll│ ← Xem thể loại
│  GET /api/rooms/** → permitAll │ ← Xem phòng
│  GET /api/showtimes/** → allow │ ← Xem suất chiếu
│  POST/PUT/DELETE → authenticated│ ← Cần token
│  /* (còn lại) → authenticated│ ← Cần token
│                             │
│  if (cần auth mà chưa có)  │
│    → trả 401 Unauthorized   │
└─────────────┬───────────────┘
              ▼
┌─────────────────────────────┐
│  Controller                 │  ← Xử lý request
└─────────────────────────────┘
```

### 3.2 DTO Pattern (Structural)

**Tại sao dùng DTO thay vì trả Entity thẳng?**

```json
// ❌ Trả Entity User thẳng → LỘ PASSWORD HASH!
{
  "id": 1,
  "username": "vanan",
  "password": "$2a$10$N9qo8uLOickgx2ZMRZoMye...",
  "storageState": null,
  "version": 0
}

// ✅ Trả AuthResponse DTO → chỉ có token, không lộ gì
{
  "accessToken": "eyJhbG...",
  "refreshToken": "550e8400-...",
  "tokenType": "Bearer",
  "expiresIn": 900
}
```

### 3.3 Builder Pattern (Creational)

```java
// Không dùng Builder — constructor dài, dễ nhầm thứ tự
AuthResponse response = new AuthResponse("eyJ...", "550e...", "Bearer", 900);
//                                        ↑ cái nào là access, cái nào refresh? Dễ nhầm!

// Có dùng Builder — rõ ràng, đọc hiểu ngay
AuthResponse response = AuthResponse.builder()
    .accessToken("eyJ...")
    .refreshToken("550e...")
    .expiresIn(900)
    .build();
```

---

## 4. Sơ đồ luồng xử lý

### Đăng ký (Register)
```
POST /api/auth/register
Body: { "username": "vanan", "email": "an@gmail.com", "password": "123456", "fullName": "Vũ Tường An" }
│
▼
AuthController.register(RegisterRequest)
│
▼
AuthService.register(request)
│
├── 1. existsByUsername("vanan") → false ✅
├── 2. existsByEmail("an@gmail.com") → false ✅
├── 3. BCrypt.encode("123456") → "$2a$10$N9qo8uLOi..."
├── 4. User.builder().username("vanan").password(hash).build() → save DB
├── 5. JwtUtil.generateToken("vanan", {role: "USER"}) → "eyJhbG..."
├── 6. RefreshTokenService.createRefreshToken(user) → UUID "550e8400-..."
│       └── INSERT INTO refresh_tokens (token, user_id, expiry_date, revoked)
└── 7. Return AuthResponse { accessToken, refreshToken, expiresIn: 900 }
```

### Đăng nhập (Login)
```
POST /api/auth/login
Body: { "username": "vanan", "password": "123456" }
│
▼
AuthService.login(request)
│
├── 1. findByUsername("vanan") → User entity
├── 2. BCrypt.matches("123456", user.getPassword())
│       → Tách salt từ hash → hash lại "123456" với cùng salt → so sánh
│       → true ✅ (hoặc false → throw INVALID_CREDENTIALS)
├── 3. user.isEnabled() → true ✅ (false → throw FORBIDDEN)
├── 4. Revoke TẤT CẢ refresh token cũ (logout thiết bị khác)
│       → UPDATE refresh_tokens SET revoked = true WHERE user_id = ?
├── 5. Tạo access token + refresh token mới
└── 6. Return AuthResponse
```

### Gọi API có xác thực (VD: GET /api/users/me)
```
GET /api/users/me
Header: Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
│
▼
JwtAuthFilter (chạy trước Controller)
│
├── 1. Lấy token từ header: "Bearer eyJhbG..." → "eyJhbG..."
├── 2. JwtUtil.extractUsername(token) → "vanan"
├── 3. JwtUtil.isTokenValid(token) → kiểm tra signature + expiration
│       → Nếu hết hạn hoặc signature sai → bỏ qua, không set auth
├── 4. CustomUserDetailsService.loadByUsername("vanan")
│       → SELECT * FROM users WHERE username = 'vanan'
│       → Tạo Spring Security UserDetails (username + authorities [ROLE_USER])
├── 5. Set Authentication vào SecurityContext
│       → Từ giờ SecurityUtil.getCurrentUsername() trả "vanan"
│
▼
AuthorizationFilter
│
├── /api/users/me → cần authenticated → có Authentication ✅ → cho qua
│
▼
UserController.getProfile() → UserService → response
```

---

## 5. Khái niệm mới cần biết

### BCrypt — Hash password 1 chiều

```
Input:  "123456"
Output: "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"
         ──── ── ──────────────────────── ──────────────────────────────
          │    │         │                              │
          │    │         Salt (22 ký tự, random)        Hash (31 ký tự)
          │    Cost factor (10 = 2^10 = 1024 rounds)
          Algorithm version (2a)
```

- **1 chiều:** Không thể giải mã ngược hash → password
- **Salt:** Mỗi lần hash cùng "123456" → ra hash KHÁC NHAU (salt random)
- **Verify:** `BCrypt.matches("123456", hash)` → tách salt → hash lại → so sánh
- **Tại sao không dùng MD5/SHA?** → MD5 quá nhanh → hacker brute force hàng tỷ lần/giây. BCrypt chậm có chủ đích (~100ms/lần)

### JWT — Cấu trúc 3 phần

```
eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiVVNFUiIsInN1YiI6InZhbmFuIn0.signature
─────────────────────  ──────────────────────────────────────────────  ─────────
      Header                         Payload                          Signature
```

- **Header:** `{"alg": "HS256"}` — thuật toán ký
- **Payload:** `{"sub": "vanan", "role": "USER", "exp": 1715320900}` — dữ liệu user
- **Signature:** `HMACSHA256(header + payload, secret_key)` — chữ ký xác thực

**Tại sao an toàn?**
- Payload ai cũng đọc được (Base64, không mã hóa)
- Nhưng không thể SỬA vì không có secret key để tạo lại signature
- Server verify: hash lại header+payload+secret → so sánh với signature

### Access Token vs Refresh Token

| | Access Token | Refresh Token |
|---|---|---|
| **Là gì** | JWT chứa thông tin user | Chuỗi UUID ngẫu nhiên |
| **Lưu ở đâu** | Client (localStorage) | Client + Server (DB) |
| **Thời hạn** | 15 phút | 7 ngày |
| **Dùng để** | Gọi API (gắn vào header) | Lấy access token mới khi hết hạn |
| **Thu hồi?** | Không (chờ hết hạn) | Có (set revoked=true trong DB) |

**Tại sao cần 2 token?**
- Access token dài hạn (7 ngày) → lộ = hacker dùng 7 ngày
- Access token ngắn hạn (15 phút) → user phải login lại mỗi 15 phút
- **Giải pháp:** Access ngắn (15 phút) + Refresh dài (7 ngày). Bị hack access → chỉ 15 phút. Bị hack refresh → admin revoke trong DB

### Stateless Authentication
- Server KHÔNG lưu session (không như PHP session, ASP.NET session)
- Mỗi request phải tự gửi token trong header `Authorization: Bearer <token>`
- Server verify token mỗi request → biết user là ai
- **Ưu điểm:** Scale dễ — chạy 10 server, request đến server nào cũng verify được

### OncePerRequestFilter
- Spring filter đảm bảo chỉ chạy **1 lần mỗi request**
- Vấn đề: 1 request có thể đi qua filter chain nhiều lần (forward, include)
- `JwtAuthFilter extends OncePerRequestFilter` → chỉ verify token 1 lần

---

## 6. Annotation/API mới sử dụng

| Annotation | Tác dụng | Ví dụ |
|---|---|---|
| `@EnableWebSecurity` | Bật Spring Security | SecurityConfig class |
| `@RestController` | Đánh dấu controller REST (trả JSON) | AuthController |
| `@RequestMapping("/api/auth")` | Prefix URL cho tất cả endpoint | AuthController |
| `@PostMapping("/register")` | Map HTTP POST → method | AuthController.register() |
| `@Valid` | Kích hoạt validation trên DTO | `@Valid @RequestBody RegisterRequest` |
| `@NotBlank` | Field không được trống | RegisterRequest.username |
| `@Email` | Field phải là email hợp lệ | RegisterRequest.email |
| `@Size(min, max)` | Giới hạn độ dài | RegisterRequest.password (6-100) |
| `@Builder` | Lombok sinh Builder pattern | AuthResponse |
| `@Builder.Default` | Giá trị mặc định khi dùng Builder | `tokenType = "Bearer"` |
| `@Modifying` | Đánh dấu query UPDATE/DELETE (JPA) | RefreshTokenRepository.revokeAllByUserId() |

---

## 7. SQL được sinh ra

```sql
-- Register: kiểm tra trùng
SELECT COUNT(*) FROM users WHERE username = 'vanan'    -- existsByUsername
SELECT COUNT(*) FROM users WHERE email = 'an@gmail.com' -- existsByEmail

-- Register: tạo user
INSERT INTO users (username, email, password, full_name, role, enabled, version, created_by, created_at, updated_at)
VALUES ('vanan', 'an@gmail.com', '$2a$10$...', 'Vũ Tường An', 'USER', 1, 0, 'anonymousUser', GETDATE(), GETDATE())

-- Register/Login: tạo refresh token
INSERT INTO refresh_tokens (token, user_id, expiry_date, revoked)
VALUES ('550e8400-e29b-41d4-a716-446655440000', 1, '2026-05-26T22:00:00', 0)

-- Login: tìm user
SELECT * FROM users WHERE username = 'vanan'

-- Login: revoke refresh token cũ
UPDATE refresh_tokens SET revoked = 1 WHERE user_id = 1 AND revoked = 0

-- Refresh: validate token
SELECT * FROM refresh_tokens WHERE token = '550e8400-...' AND revoked = 0

-- JwtAuthFilter: load user cho SecurityContext
SELECT * FROM users WHERE username = 'vanan'
```

---

## 8. Request/Response mẫu

### POST /api/auth/register — Đăng ký
```bash
curl -X POST http://localhost:8088/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "vanan",
    "email": "an@gmail.com",
    "password": "123456",
    "fullName": "Vũ Tường An"
  }'
```

**Response thành công (200):**
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiVVNFUiIsInN1YiI6InZhbmFuIiwiaWF0IjoxNzE1MzIwMDAwLCJleHAiOjE3MTUzMjA5MDB9.abc123",
    "refreshToken": "550e8400-e29b-41d4-a716-446655440000",
    "tokenType": "Bearer",
    "expiresIn": 900
  },
  "timestamp": "2026-05-19T15:00:00Z"
}
```

**Response lỗi — username đã tồn tại (409):**
```json
{
  "success": false,
  "message": "Username already exists",
  "timestamp": "2026-05-19T15:00:00Z"
}
```

**Response lỗi — validation fail (400):**
```json
{
  "success": false,
  "message": "username: Username is required; email: Invalid email format",
  "timestamp": "2026-05-19T15:00:00Z"
}
```

### POST /api/auth/login — Đăng nhập
```bash
curl -X POST http://localhost:8088/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "vanan", "password": "123456"}'
```

**Response thành công (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbG...",
    "refreshToken": "a1b2c3d4-...",
    "tokenType": "Bearer",
    "expiresIn": 900
  }
}
```

**Response lỗi — sai password (401):**
```json
{
  "success": false,
  "message": "Invalid username or password"
}
```

### POST /api/auth/refresh — Refresh token
```bash
curl -X POST http://localhost:8088/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "550e8400-e29b-41d4-a716-446655440000"}'
```

**Response thành công (200):**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "accessToken": "eyJhbG...(token MỚI)...",
    "refreshToken": "550e8400-e29b-41d4-a716-446655440000",
    "tokenType": "Bearer",
    "expiresIn": 900
  }
}
```

### Gọi API cần xác thực
```bash
# Lấy token từ login response, gắn vào header Authorization
curl http://localhost:8088/api/users/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9..."
```

**Response lỗi — không có token (401):**
```json
{
  "success": false,
  "message": "Unauthorized"
}
```

---

## 9. Câu hỏi tự kiểm tra

1. **BCrypt hash cùng password "123456" hai lần, kết quả có giống nhau không? Tại sao?**
   → KHÔNG giống. Vì mỗi lần hash, BCrypt tạo salt random khác nhau. Nhưng verify vẫn đúng vì salt được lưu trong chính chuỗi hash.

2. **Nếu hacker đánh cắp access token, thiệt hại tối đa là bao lâu? Nếu đánh cắp refresh token thì sao?**
   → Access token: 15 phút (hết hạn thì vô dụng). Refresh token: nguy hiểm hơn vì dùng được 7 ngày, nhưng admin có thể revoke trong DB.

3. **Tại sao server không lưu session mà dùng JWT (stateless)?**
   → Vì khi scale (chạy nhiều server), session trên server A không thấy ở server B. JWT gửi theo mỗi request → server nào verify cũng được.

4. **JWT payload ai cũng đọc được (chỉ là Base64). Vậy sao gọi là an toàn?**
   → An toàn ở chỗ KHÔNG THỂ SỬA payload. Sửa payload → signature không khớp → server reject. Nên không lưu data nhạy cảm (password) trong payload.

5. **Tại sao login phải revoke tất cả refresh token cũ?**
   → Để logout thiết bị khác. VD: login trên điện thoại → revoke token của laptop → laptop phải login lại. Đảm bảo chỉ 1 thiết bị active.

---

# PHẦN BỔ SUNG — FORGOT/RESET PASSWORD & LOGOUT (chi tiết)

> Mục 1 đầu file có hứa "Quên mật khẩu" + "Reset mật khẩu" + "Logout" nhưng các mục 4, 7, 8, 9 phía trên CHỈ tập trung vào register/login/refresh. Phần này bổ sung đầy đủ ba luồng còn thiếu để các bạn có thể tự code lại từ đầu.

---

## 10. Luồng Forgot Password — Quên mật khẩu

### 10.1. Bài toán đời thường

Hình dung bạn quên mật khẩu Facebook. Bạn không thể đập cửa văn phòng Facebook và bảo "tôi là tôi, đổi mật khẩu giúp". Facebook cũng KHÔNG được phép gửi lại mật khẩu cũ (vì họ KHÔNG biết — chỉ lưu hash). Cách duy nhất họ tin "đúng là bạn" là:

1. Bạn nhập email
2. Facebook gửi link bí mật vào email đó
3. Bạn click link → đổi mật khẩu mới
4. Link tự huỷ sau 1 lần dùng

Cơ chế này đặt cược vào giả định "chỉ chủ email mới đọc được email đó". Tức email = "căn cước" tạm thời. Vì vậy nếu email của bạn bị hack thì bao nhiêu tài khoản dùng email đó đều mất theo.

### 10.2. Sequence diagram (ASCII)

```
HAPPY PATH — forgot password thành công
─────────────────────────────────────────────────────────────────────

User (Browser)         AuthController         AuthService           UserRepo         PwResetRepo        EmailService
     │                       │                      │                   │                  │                   │
     │  POST /forgot-password│                      │                   │                  │                   │
     │  { email }            │                      │                   │                  │                   │
     ├──────────────────────▶│                      │                   │                  │                   │
     │                       │  forgotPassword(req) │                   │                  │                   │
     │                       ├─────────────────────▶│                   │                  │                   │
     │                       │                      │  findByEmail(...)  │                  │                   │
     │                       │                      ├──────────────────▶│                  │                   │
     │                       │                      │◀─── Optional<User>─┤                  │                   │
     │                       │                      │                   │                  │                   │
     │                       │                      │  UUID.randomUUID()                   │                   │
     │                       │                      │  expiry = now + 15 phút              │                   │
     │                       │                      │                   │                  │                   │
     │                       │                      │  save(PasswordResetToken)            │                   │
     │                       │                      ├─────────────────────────────────────▶│                   │
     │                       │                      │◀──── saved token ───────────────────┤                   │
     │                       │                      │                                      │                   │
     │                       │                      │  sendResetPasswordEmail(email, token, 15)                │
     │                       │                      ├──────────────────────────────────────────────────────────▶│
     │                       │                      │◀─── async sent ──────────────────────────────────────────┤
     │                       │◀──── void ───────────┤                                                          │
     │  200 OK               │                                                                                 │
     │  "If email exists,    │                                                                                 │
     │   a reset link…"      │                                                                                 │
     │◀──────────────────────┤                                                                                 │


KHÔNG HAPPY PATH — email không tồn tại trong DB
─────────────────────────────────────────────────────────────────────

User → POST /forgot-password { email: "ai_do@gmail.com" }
                │
                ▼
findByEmail → Optional.empty()
                │
                ▼  ← .ifPresent(...) bỏ qua block, KHÔNG throw exception
                │
                ▼
Response: 200 OK + "If email exists, a reset link has been sent"

→ Người gửi KHÔNG biết email đó có đăng ký hay không.
→ Chống User Enumeration Attack.
```

### 10.3. Schema bảng `password_reset_tokens`

Liquibase `015-create-password-reset-tokens-table.xml` (đã có trong repo):

```xml
<changeSet id="015" author="cinex">
    <createTable tableName="password_reset_tokens">
        <column name="id" type="BIGINT" autoIncrement="true">
            <constraints primaryKey="true" nullable="false"/>
        </column>
        <column name="user_id" type="BIGINT">
            <constraints nullable="false"/>
        </column>
        <column name="token" type="NVARCHAR(255)">
            <constraints nullable="false" unique="true"/>
        </column>
        <column name="expiry_date" type="DATETIME2">
            <constraints nullable="false"/>
        </column>
        <column name="used" type="BIT" defaultValueBoolean="false"/>
        <column name="created_at" type="DATETIME2"/>
    </createTable>

    <addForeignKeyConstraint baseTableName="password_reset_tokens" baseColumnNames="user_id"
                             referencedTableName="users" referencedColumnNames="id"
                             constraintName="fk_password_reset_tokens_user_id"/>
</changeSet>
```

Giải thích từng cột:

| Cột | Tác dụng | Ghi chú học |
|---|---|---|
| `id` | PK auto-increment | Theo convention |
| `user_id` | FK trỏ tới `users.id` | 1 user có thể có nhiều token (xin lại nhiều lần) |
| `token` | Chuỗi bí mật gửi qua email | UNIQUE để không trùng |
| `expiry_date` | Thời điểm hết hạn (mặc định +15 phút) | So với `LocalDateTime.now()` |
| `used` | Đã dùng chưa | TRUE → không cho reset lần 2 |
| `created_at` | Lúc tạo | Để audit/debug |

### 10.4. Code mẫu — `AuthService.forgotPassword()`

Trích từ `AuthService.java` thực tế trong repo:

```java
@Transactional
public void forgotPassword(ForgotPasswordRequest request) {
    userRepository.findByEmail(request.getEmail()).ifPresent(user -> {
        String token = UUID.randomUUID().toString();
        PasswordResetToken resetToken = PasswordResetToken.builder()
                .user(user)
                .token(token)
                .expiryDate(LocalDateTime.now().plusMinutes(
                        systemConfigService.getInt("auth.reset_token_expiry_minutes", 15)))
                .build();
        passwordResetTokenRepository.save(resetToken);
        int expiryMinutes = systemConfigService.getInt("auth.reset_token_expiry_minutes", 15);
        emailService.sendResetPasswordEmail(user.getEmail(), token, expiryMinutes);
        log.info("Password reset token created for {}", user.getUsername());
    });
}
```

Phân tích từng dòng:

1. `findByEmail(...).ifPresent(user -> { ... })`
   - `Optional.ifPresent` chỉ chạy block khi user TỒN TẠI.
   - Không tồn tại → BỎ QUA, method vẫn return bình thường.
   - **Vì sao quan trọng?** Đây là vũ khí chống "user enumeration attack" — xem mục 10.6.

2. `UUID.randomUUID().toString()`
   - Sinh chuỗi 36 ký tự kiểu `550e8400-e29b-41d4-a716-446655440000`.
   - UUID v4 dùng `SecureRandom` (cryptographically secure) → không đoán được.
   - **Nâng cao production:** Nên hash token bằng SHA-256 trước khi lưu DB (xem mục 10.7 "Điểm có thể cải thiện").

3. `expiryDate = now + 15 phút`
   - Lấy từ `system_config` key `auth.reset_token_expiry_minutes` (fallback 15).
   - Vì sao 15 phút? Đủ để user mở email + click. Quá dài → cửa sổ bị tấn công lớn hơn.

4. `passwordResetTokenRepository.save(resetToken)` → INSERT row mới.

5. `emailService.sendResetPasswordEmail(...)` → gửi email kèm link `https://app.cinex.vn/reset-password?token=550e8400-...`.

6. `log.info(...)` ghi log để debug — KHÔNG log token (lộ thì cả log = tấn công).

### 10.5. Code mẫu — `AuthService.resetPassword()`

```java
@Transactional
public void resetPassword(ResetPasswordRequest request) {
    if (!request.getNewPassword().equals(request.getConfirmPassword())) {
        throw new BusinessException(ErrorCode.INVALID_PASSWORD,
                "Mật khẩu mới và xác nhận mật khẩu không khớp");
    }

    PasswordResetToken resetToken = passwordResetTokenRepository
            .findByTokenAndUsedFalse(request.getToken())
            .orElseThrow(() -> new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Token không hợp lệ hoặc đã được sử dụng"));

    if (resetToken.isExpired()) {
        throw new BusinessException(ErrorCode.INVALID_REQUEST, "Token đặt lại mật khẩu đã hết hạn");
    }

    User user = resetToken.getUser();

    if (passwordEncoder.matches(request.getNewPassword(), user.getPassword())) {
        throw new BusinessException(ErrorCode.INVALID_PASSWORD, "Mật khẩu mới phải khác mật khẩu cũ");
    }

    user.setPassword(passwordEncoder.encode(request.getNewPassword()));
    userRepository.save(user);

    resetToken.setUsed(true);
    passwordResetTokenRepository.save(resetToken);

    refreshTokenService.revokeAllUserTokens(user.getId());
    log.info("Password reset for {}", user.getUsername());
}
```

Các bước "kiểm chứng" được sắp theo thứ tự fail-fast (lỗi xa trước, gần sau):

| Bước | Kiểm tra | Lý do |
|---|---|---|
| 1 | `newPassword == confirmPassword` | User tự gõ nhầm, không cần query DB |
| 2 | Token có tồn tại + chưa `used` | Repository: `findByTokenAndUsedFalse` |
| 3 | Token chưa expired | `isExpired()` trong entity |
| 4 | newPassword khác password cũ | Tránh "đổi" mà thực ra không đổi |
| 5 | Hash password mới + save | BCrypt — KHÔNG lưu plain text |
| 6 | Đánh dấu token `used = true` | Để không tái sử dụng (one-time token) |
| 7 | Revoke toàn bộ refresh token | Vì có thể password lộ → đá hết phiên cũ |

**Tại sao phải revoke refresh token ở bước 7?** Vì có khả năng password cũ đã lộ → hacker đang dùng tài khoản. Đổi password mà KHÔNG đá phiên cũ → hacker vẫn dùng được tới khi access/refresh token hết hạn.

### 10.6. User Enumeration Attack — chống thế nào?

**Tấn công:** Hacker muốn biết email `victim@gmail.com` có đăng ký CineX hay không (để phishing).

- Nếu API trả `404 "Email không tồn tại"` → hacker biết là chưa đăng ký.
- Nếu API trả `200 "Đã gửi email"` → hacker biết đã đăng ký.
- Sau khi xác định email tồn tại → tấn công tiếp (brute force password, gửi phishing email giả mạo CineX).

**Phòng thủ:** Forgot-password LUÔN trả 200 với cùng 1 message, bất kể email tồn tại hay không. Hacker không lấy được tín hiệu nào. CineX implement đúng pattern này (xem `AuthController.forgotPassword` → message: `"If email exists, a reset link has been sent"`).

**Ghi nhớ:** "Nguyên tắc bí mật bí mật" — bất kỳ endpoint nào liên quan tới việc XÁC NHẬN sự tồn tại của user (login, forgot, register) đều phải đồng nhất response.

### 10.7. Điểm CineX có thể cải thiện (production-grade)

Code thực tế của CineX hiện đang lưu **plain UUID** vào cột `token`. Production ngon hơn sẽ:

1. **Hash token trước khi lưu DB** (SHA-256):
   ```java
   String rawToken = UUID.randomUUID().toString();           // gửi email
   String hashedToken = DigestUtils.sha256Hex(rawToken);     // lưu DB
   ```
   Vì sao? Nếu DB bị leak (SQL injection, backup lộ), hacker thấy hashedToken cũng không dùng được — không gửi email được, không reset được.

2. **Index cột `token`** để query nhanh khi DB to.

3. **Rate limit** trên endpoint `forgot-password` (VD 3 request / email / giờ) để chống spam email + chống brute force.

4. **Đánh dấu user gần đây có reset password** → nếu phát hiện hoạt động bất thường, alert.

> Đây là chỗ các bạn có thể tự nâng cấp code làm đồ án thêm điểm.

---

## 11. Luồng Logout — Revoke Refresh Token

### 11.1. Bài toán đời thường

JWT là "tấm vé xem phim" — đã in ra giấy thì người soát vé không thể "huỷ" tấm vé đó từ xa. Tấm vé chỉ tự hết hạn khi tới ngày ghi trên vé. Đây gọi là **stateless** — server không lưu danh sách "vé nào còn hiệu lực".

Vậy logout làm sao? Có 2 cách:

| Cách | Mô tả | Nhược điểm |
|---|---|---|
| Blacklist access token | Lưu danh sách "JWT đã logout" trong Redis | Mất tính stateless, mỗi request phải check Redis |
| Refresh token rotation | Access token cứ để hết hạn (15 phút), revoke refresh token | Window 15 phút hacker vẫn dùng được nếu đã có access token |

CineX dùng cách 2 (đơn giản, đủ tốt cho đa số use case).

### 11.2. Sequence diagram (ASCII)

```
HAPPY PATH — logout
────────────────────────────────────────────────────────────

User (Browser)        AuthController         AuthService         RefreshTokenRepo
     │                      │                      │                    │
     │  POST /logout        │                      │                    │
     │  Authorization:      │                      │                    │
     │   Bearer eyJ...      │                      │                    │
     ├─────────────────────▶│                      │                    │
     │                      │  logout()             │                    │
     │                      ├─────────────────────▶│                    │
     │                      │                      │ getCurrentUsername()│
     │                      │                      │  (từ SecurityContext)
     │                      │                      │                    │
     │                      │                      │ findActiveByUsername│
     │                      │                      ├──────────────────▶│
     │                      │                      │                    │
     │                      │                      │ revokeAllByUserId  │
     │                      │                      ├──────────────────▶│
     │                      │                      │   UPDATE refresh_tokens
     │                      │                      │   SET revoked=true │
     │                      │                      │   WHERE user_id=?  │
     │                      │                      │   AND revoked=false│
     │                      │                      │◀──────────────────┤
     │                      │◀───── void ─────────┤                    │
     │ 200 OK "Logged out"  │                                            │
     │◀─────────────────────┤                                            │
     │                                                                    │
   localStorage.removeItem("accessToken")
   localStorage.removeItem("refreshToken")
   → redirect /login
```

### 11.3. Schema bảng `refresh_tokens`

```xml
<changeSet id="002" author="cinex">
    <createTable tableName="refresh_tokens">
        <column name="id" type="BIGINT" autoIncrement="true">
            <constraints primaryKey="true" nullable="false"/>
        </column>
        <column name="user_id" type="BIGINT">
            <constraints nullable="false"/>
        </column>
        <column name="token" type="NVARCHAR(255)">
            <constraints nullable="false" unique="true"/>
        </column>
        <column name="expiry_date" type="DATETIME2">
            <constraints nullable="false"/>
        </column>
        <column name="revoked" type="BIT" defaultValueBoolean="false">
            <constraints nullable="false"/>
        </column>
    </createTable>

    <createIndex tableName="refresh_tokens" indexName="idx_refresh_tokens_token">
        <column name="token"/>
    </createIndex>
</changeSet>
```

Giải thích cột `revoked`:
- Soft delete kiểu Boolean — không xoá row, chỉ đánh dấu.
- Lợi ích: giữ lại lịch sử để audit ("token này từng bị revoke khi nào, do hành động nào?").
- Production cao cấp hơn có thêm `revoked_at` (timestamp) + `replaced_by` (id của refresh token mới — phục vụ refresh token rotation chain).

### 11.4. Code mẫu — `AuthService.logout()`

```java
@Transactional
public void logout() {
    String username = SecurityUtil.getCurrentUsername();
    User user = userRepository.findActiveByUsername(username)
            .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
    refreshTokenService.revokeAllUserTokens(user.getId());
    log.info("User {} logged out", username);
}
```

Khác cách thông thường (`logout(refreshToken)` lấy từ request body), CineX lấy username từ `SecurityContext` — vì:

1. Endpoint `/logout` ĐÃ được bảo vệ bằng JWT (phải Authorization header).
2. JwtAuthFilter đã đặt `Authentication` vào `SecurityContextHolder` rồi.
3. Logout = revoke TẤT CẢ refresh token của user → không cần biết cụ thể token nào.

### 11.5. Repository — `revokeAllByUserId`

```java
@Modifying
@Query("UPDATE RefreshToken rt SET rt.revoked = true " +
       "WHERE rt.user.id = :userId AND rt.revoked = false")
void revokeAllByUserId(Long userId);
```

`@Modifying` BẮT BUỘC với UPDATE/DELETE JPQL — không có sẽ ném exception "Not supported for DML operations".

**Tại sao thêm `AND rt.revoked = false`?** Để query không update lại row đã revoke → giảm số dòng bị động (DB metric đẹp hơn).

### 11.6. Frontend — phối hợp với logout

```typescript
// frontend/src/features/auth/useLogout.ts (giả định)
async function logout() {
  try {
    await api.post('/api/auth/logout');
  } catch (e) {
    // Kể cả lỗi network, vẫn phải xoá local
  } finally {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    navigate('/login');
  }
}
```

Vì sao luôn xoá local kể cả khi API fail? Vì user muốn "thoát" — UI phải tôn trọng ý muốn. Backend không revoke được lần này thì refresh token cũng tự hết hạn sau 7 ngày.

### 11.7. Bonus — Logout all devices

Đã có sẵn! Vì `revokeAllUserTokens` đã revoke MỌI refresh token. Nếu muốn endpoint "logout this device only" thì cần:

```java
@Transactional
public void logoutCurrentDevice(String refreshToken) {
    refreshTokenRepository.findByTokenAndRevokedFalse(refreshToken)
        .ifPresent(rt -> {
            rt.setRevoked(true);
            refreshTokenRepository.save(rt);
        });
}
```

Tới đây bạn thấy trade-off: thiết kế đơn giản (revoke all) vs UX tinh tế (logout từng device). CineX chọn đơn giản.

---

## 12. Bổ sung mục 4 — Sơ đồ luồng đầy đủ

(Mục 4 gốc chỉ có register/login/refresh. Bổ sung forgot/reset/logout.)

```
LUỒNG 1 — REGISTER
─────────────────────────────────────────────────────
Browser ──POST /register──▶ Controller ──▶ Service
                                              │
                       ┌──────────────────────┤
                       ▼                      ▼
                existsByUsername      existsByEmail
                       │                      │
                       └────────┬─────────────┘
                                ▼
                       passwordEncoder.encode (BCrypt)
                                ▼
                       userRepository.save
                                ▼
                       refreshTokenService.create
                                ▼
                  Response: { accessToken, refreshToken }


LUỒNG 2 — LOGIN
─────────────────────────────────────────────────────
Browser ──POST /login──▶ Controller ──▶ Service
                                          │
                                          ▼
                              findActiveByUsername
                                          │
                                ┌─────────┴──────────┐
                                ▼                    ▼
                         match password         FORBIDDEN (đã khoá)
                                ▼
                         revoke + tạo refresh mới
                                ▼
                  Response: { accessToken, refreshToken }


LUỒNG 3 — FORGOT PASSWORD
─────────────────────────────────────────────────────
Browser ──POST /forgot-password { email }──▶ Controller ──▶ Service
                                                              │
                                                              ▼
                                                  findByEmail (Optional)
                                                              │
                                          ┌───────────────────┤
                                          ▼                   ▼
                                  NOT PRESENT          PRESENT
                                          │                   │
                                          │     UUID + expiry 15 phút
                                          │                   ▼
                                          │   save PasswordResetToken
                                          │                   ▼
                                          │   emailService.sendResetPasswordEmail
                                          │                   │
                                          └───────────┬───────┘
                                                      ▼
                                    Response 200: "If email exists..."


LUỒNG 4 — RESET PASSWORD
─────────────────────────────────────────────────────
Browser ──POST /reset-password { token, newPassword, confirmPassword }──▶ Controller ──▶ Service
                                                                                          │
                              ┌───────────────────────────────────────────────────────────┤
                              ▼                                                           │
                       confirm == new?  ──── KHÔNG ───▶ throw INVALID_PASSWORD          │
                              │ CÓ                                                       │
                              ▼                                                           │
              findByTokenAndUsedFalse  ──── empty ───▶ throw INVALID_REQUEST            │
                              │                                                           │
                              ▼                                                           │
                       isExpired? ──── YES ───▶ throw INVALID_REQUEST                   │
                              │ NO                                                       │
                              ▼                                                           │
                  newPassword == oldHash? ── YES ─▶ throw INVALID_PASSWORD              │
                              │ NO                                                       │
                              ▼                                                           │
                  encode + save user + mark token used + revoke refresh tokens          │
                              │                                                           │
                              ▼                                                           │
                  Response 200: "Password reset successful"


LUỒNG 5 — LOGOUT
─────────────────────────────────────────────────────
Browser ──POST /logout (Authorization: Bearer …)──▶ JwtAuthFilter
                                                          │
                                                          ▼
                                              SecurityContext gắn user
                                                          ▼
                                                    Controller ──▶ Service
                                                                       │
                                                                       ▼
                                                       SecurityUtil.getCurrentUsername
                                                                       ▼
                                                       findActiveByUsername
                                                                       ▼
                                                       revokeAllByUserId (UPDATE)
                                                                       ▼
                                                          Response 200: "Logged out"
```

---

## 13. Bổ sung mục 7 — SQL được sinh ra (forgot/reset/logout)

### 13.1. `findByEmail` (forgot-password)

```sql
SELECT u.id, u.username, u.email, u.password, u.full_name,
       u.role, u.enabled, u.storage_state,
       u.version, u.created_at, u.updated_at, u.created_by, u.updated_by
FROM users u
WHERE u.email = ?         -- 'student@gmail.com'
```

> Lưu ý: `UserRepository.findByEmail(String email)` là method Spring Data tự sinh từ tên (không có `@Query`),
> nên Hibernate CHỈ generate điều kiện `WHERE u.email = ?` — KHÔNG có filter `storage_state`.
> Trường hợp cần lọc user đã ARCHIVED, dùng method khác như `findActiveByUsername` (có `@Query` viết tay).

### 13.2. `INSERT password_reset_tokens` (forgot-password)

```sql
INSERT INTO password_reset_tokens (user_id, token, expiry_date, used, created_at)
VALUES (
  ?,                                  -- 42
  ?,                                  -- '550e8400-e29b-41d4-a716-446655440000'
  ?,                                  -- '2026-05-31 14:15:00.000'  (now + 15 phút)
  ?,                                  -- 0  (false)
  ?                                   -- '2026-05-31 14:00:00.000'
);
```

### 13.3. `findByTokenAndUsedFalse` (reset-password)

```sql
SELECT t.id, t.user_id, t.token, t.expiry_date, t.used, t.created_at
FROM password_reset_tokens t
WHERE t.token = ?
  AND t.used = 0
```

### 13.4. `UPDATE users SET password` (reset-password)

```sql
UPDATE users
SET password   = ?,                   -- '$2a$10$N9qo8uLOickgx2ZMRZoMy...'
    version    = version + 1,         -- Optimistic Lock từ BaseEntity
    updated_at = ?,
    updated_by = ?
WHERE id = ?
  AND version = ?                     -- giá trị version cũ
```

Nếu version sai (ai đó đổi password song song) → 0 rows updated → JPA ném `OptimisticLockException`.

### 13.5. `UPDATE password_reset_tokens SET used` (reset-password)

```sql
UPDATE password_reset_tokens
SET used = 1
WHERE id = ?
```

Cập nhật cờ `used` thành true → lần sau dùng token này, `findByTokenAndUsedFalse` trả empty → user nhận lỗi `"Token không hợp lệ hoặc đã được sử dụng"`.

### 13.6. `revokeAllByUserId` (logout + reset-password)

```sql
UPDATE refresh_tokens
SET revoked = 1
WHERE user_id = ?
  AND revoked = 0
```

Vì query là JPQL `@Modifying`, JPA KHÔNG flush Hibernate session trước đó → cần cẩn thận nếu trong cùng transaction có thay đổi RefreshToken khác (đọc thêm flag `clearAutomatically = true` của `@Modifying`).

---

## 14. Bổ sung mục 8 — Request/Response mẫu

### 14.1. Forgot password — luôn 200

**Request:**

```bash
curl -X POST http://localhost:8088/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@gmail.com"
  }'
```

**Response (email TỒN TẠI):**

```json
{
  "success": true,
  "message": "If email exists, a reset link has been sent",
  "data": null,
  "timestamp": "2026-05-31T14:00:00"
}
```

**Response (email KHÔNG tồn tại):** Y HỆT response trên. Đó là chủ đích — chống enumeration.

**Response lỗi validation (email rỗng/sai format):**

```json
{
  "success": false,
  "message": "Email không hợp lệ",
  "data": null,
  "timestamp": "2026-05-31T14:00:00"
}
```

### 14.2. Reset password

**Request:**

```bash
curl -X POST http://localhost:8088/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "550e8400-e29b-41d4-a716-446655440000",
    "newPassword": "MatKhauMoi@2026",
    "confirmPassword": "MatKhauMoi@2026"
  }'
```

**Response success (200):**

```json
{
  "success": true,
  "message": "Password reset successful",
  "data": null,
  "timestamp": "2026-05-31T14:10:00"
}
```

**Response lỗi — token đã dùng/không tồn tại (400):**

```json
{
  "success": false,
  "message": "Token không hợp lệ hoặc đã được sử dụng",
  "timestamp": "2026-05-31T14:10:00"
}
```

**Response lỗi — token expired (400):**

```json
{
  "success": false,
  "message": "Token đặt lại mật khẩu đã hết hạn",
  "timestamp": "2026-05-31T14:10:00"
}
```

**Response lỗi — confirm không khớp (400):**

```json
{
  "success": false,
  "message": "Mật khẩu mới và xác nhận mật khẩu không khớp",
  "timestamp": "2026-05-31T14:10:00"
}
```

**Response lỗi — newPassword trùng password cũ (400):**

```json
{
  "success": false,
  "message": "Mật khẩu mới phải khác mật khẩu cũ",
  "timestamp": "2026-05-31T14:10:00"
}
```

> Lưu ý: `GlobalExceptionHandler` trả response qua `ApiResponse.error(message)` chỉ có 3 field:
> `success`, `message`, `timestamp` — KHÔNG có field `errorCode`. Mã `ErrorCode` (VD: `INVALID_REQUEST`)
> chỉ dùng nội bộ ở backend để xác định HTTP status, không lộ ra response.

### 14.3. Logout

**Request:**

```bash
curl -X POST http://localhost:8088/api/auth/logout \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...."
```

**Response (200):**

```json
{
  "success": true,
  "message": "Logged out",
  "data": null,
  "timestamp": "2026-05-31T14:20:00"
}
```

**Response lỗi — không có Authorization header (401):**

```json
{
  "success": false,
  "message": "Unauthorized"
}
```

> Lưu ý: CineX hiện trả `200 OK` chứ KHÔNG trả `204 No Content` như chuẩn REST khuyến nghị — vì wrapper `ApiResponse<Void>` luôn cần body để FE check `success`. Đây là trade-off "consistency over strict REST".

---

## 15. Bổ sung mục 9 — Câu hỏi tự kiểm tra (thêm 3 câu)

6. **Tại sao server forgot-password luôn trả 200 dù email không tồn tại?**
   → Chống **User Enumeration Attack**. Nếu trả 404 khi email không tồn tại → hacker dùng script quét hàng triệu email, tìm ra email nào đã đăng ký CineX → tấn công tiếp (brute force password, phishing giả mạo CineX gửi tới đúng tệp khách hàng). Trả 200 đồng nhất → hacker không lấy được tín hiệu nào, attack vô dụng.

7. **Reset token bị lộ trong URL — log của Nginx/CDN/Browser history có thể lưu. Làm sao giảm thiểu rủi ro?**
   → Nhiều lớp phòng thủ (defense in depth):
   - **Token chỉ dùng 1 lần** (`used = true` sau lần đầu) → hacker tìm thấy trong log thì token đã bất khả dụng.
   - **Expire 15 phút** → window tấn công cực ngắn.
   - **Hash token trong DB bằng SHA-256** (production-grade — CineX hiện chưa làm, là điểm cải thiện ở mục 10.7) → DB bị leak vẫn không lấy được token gốc.
   - **Không log token ra application log** (`log.info` chỉ log username, không log token).
   - **HTTPS bắt buộc** → trung gian không sniff được.
   - **Tốt hơn nữa:** đặt token vào request body POST `/verify-reset-token` thay vì query string GET (POST body không vào access log mặc định).

8. **Logout chỉ revoke refresh token. Nếu hacker đã có access token (lifetime 15 phút), có chặn được không? Giải pháp?**
   → KHÔNG chặn được, đó là trade-off của JWT stateless. Trong 15 phút đó hacker vẫn dùng được access token. **Giải pháp nâng cấp:**
   - **Rút ngắn access token TTL** xuống 5 phút (giảm window).
   - **Blacklist trong Redis** — khi logout, lưu `jti` (JWT ID) của access token vào Redis với TTL = thời gian còn lại của token. JwtAuthFilter check Redis trước khi cho qua. Mất tính "pure stateless" nhưng đổi lại revoke được.
   - **Distributed token revocation list (DTRL)** — danh sách `jti` đã revoke, đồng bộ giữa các instance.
   - **Token binding** — bind access token với IP/device fingerprint. Hacker đổi IP → token vô dụng.
   - **Đối với hành động nhạy cảm** (đổi email, đổi password, thanh toán) → yêu cầu nhập password / OTP lại bất kể token có còn hạn.

---

## 16. Tổng kết — checklist khi tự code lại

- [ ] Tạo bảng `password_reset_tokens` qua Liquibase, KHÔNG `ddl-auto=update`
- [ ] Entity `PasswordResetToken` có method `isExpired()` để encapsulate logic
- [ ] Forgot password dùng `Optional.ifPresent` để chống enumeration
- [ ] Sinh token bằng `UUID.randomUUID()` (SecureRandom)
- [ ] Token expire ngắn (15 phút), config từ `system_config`
- [ ] Reset password check thứ tự: confirm match → token valid → token chưa expired → password khác cũ
- [ ] Sau reset thành công: mark token `used` + revoke refresh tokens
- [ ] Logout lấy username từ SecurityContext, không từ request body
- [ ] Repository `revokeAllByUserId` dùng `@Modifying` + JPQL UPDATE
- [ ] FE luôn xoá localStorage kể cả khi logout API fail
- [ ] Tất cả response error đi qua `ApiResponse` wrapper, format đồng nhất
