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
