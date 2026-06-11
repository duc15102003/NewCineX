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

### ❓ Câu hỏi quan trọng: Đã mã hóa 1 chiều thì database làm sao biết password đúng?

> **Đây là câu hỏi mà 90% người mới học bảo mật đều hỏi. Câu trả lời rất quan trọng để hiểu đúng bản chất.**

#### 🔑 Insight cốt lõi
**Database KHÔNG BAO GIỜ biết password thật của bạn. Nó cũng không cần biết.**

Database chỉ làm được 1 việc: **lưu hash đã có sẵn**. Khi login, **server không "giải mã" hash để lấy password ra rồi so sánh**. Mà làm ngược lại:

> 👉 **Lấy password mà user vừa nhập → hash lại bằng đúng công thức cũ → so sánh 2 hash với nhau.**

Hai hash giống nhau → password đúng. Hai hash khác nhau → password sai. **Server chưa bao giờ "đọc" được password gốc trong DB.**

#### 🍵 Ví dụ đời thường: Pha trà theo công thức bí mật

Tưởng tượng bạn là chủ quán trà và có một **công thức bí mật**: 5g lá trà + 200ml nước 90°C + hãm 3 phút → ra ly trà có **màu nâu vàng đặc biệt**.

- Hôm qua bạn pha sẵn 1 ly mẫu (= **hash lưu trong DB**) và đặt trong tủ kính.
- Hôm nay khách đến nhận: "Tôi là khách quen, cho tôi ly trà của tôi."
- Bạn **không thể** nhìn ly mẫu để biết khách đã dùng nguyên liệu gì (1 chiều — không reverse được).
- Nhưng bạn yêu cầu khách **đọc lại công thức** ("5g lá trà + 200ml + 90°C + 3 phút") → bạn **pha lại theo đúng công thức đó** → so sánh màu ly mới với ly mẫu trong tủ.

→ **Màu giống → khách đúng là khách cũ.** Bạn không cần "đọc lại" ly mẫu — chỉ cần **pha lại** rồi so sánh.

#### 🔬 Mô phỏng bằng số cụ thể

Giả sử hash đơn giản là: `hash(x) = (x × 7 + 3) mod 100` (1 chiều, vì biết kết quả không suy ra được `x`).

**Lúc đăng ký:** user nhập password `12`
```
hash(12) = (12 × 7 + 3) mod 100 = 87
→ DB lưu: password = 87       (KHÔNG lưu số 12)
```

**Lúc đăng nhập lần 1:** user nhập `12` (đúng)
```
1. Server lấy 12 (input) → hash lại: (12 × 7 + 3) mod 100 = 87
2. Lấy 87 từ DB ra
3. So sánh: 87 == 87 ✅ → cho đăng nhập
```

**Lúc đăng nhập lần 2:** user nhập `99` (sai)
```
1. Server lấy 99 (input) → hash lại: (99 × 7 + 3) mod 100 = 96
2. Lấy 87 từ DB ra
3. So sánh: 96 != 87 ❌ → "Sai mật khẩu"
```

→ Server **không cần biết** trong DB là số 12 hay số nào. Chỉ cần biết: hash của input có khớp với hash đã lưu không.

#### 🧂 Vậy salt nằm ở đâu trong câu chuyện này?

BCrypt phức tạp hơn vì có thêm salt ngẫu nhiên. Vấn đề: nếu salt random, làm sao lúc login server biết salt nào để hash lại?

**Giải pháp thiên tài: SALT ĐƯỢC LƯU TRONG CHÍNH CHUỖI HASH.**

```
$2a$10$N9qo8uLOickgx2ZMRZoMye  IjZAgcfl7p92ldGxad68LJZdL17lhWy
└┬┘ └┬┘ └──────────┬─────────┘  └─────────────┬──────────────┘
 │   │            Salt                       Hash
algorithm cost   (22 ký tự,                  (31 ký tự,
                 random mỗi lần              kết quả hash(password + salt))
                 đăng ký)
```

Lúc verify, server đọc chuỗi này từ DB và:
1. **Cắt** đoạn `$2a$10$N9qo8uLOickgx2ZMRZoMye` → lấy ra salt.
2. **Hash lại** password user vừa nhập với đúng salt đó.
3. **So sánh** phần hash mới sinh ra với phần hash trong DB.

→ Salt **không cần giấu**. Hacker thấy salt cũng vô dụng vì BCrypt vẫn rất chậm.

#### 🚪 Luồng đầy đủ khi user login

```
┌─────────────────────────────────────────────────────────────┐
│  user nhập: "vanan" / "123456"                              │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Server query: SELECT password FROM users                │
│     WHERE username = 'vanan'                                │
│                                                             │
│     DB trả: "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p9..."   │
│             (chuỗi hash đã lưu lúc đăng ký)                 │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  2. BCrypt.matches("123456", "$2a$10$N9qo8uLO...")          │
│                                                             │
│     2a. Đọc cost (10) và salt ("N9qo8uLOickgx2ZMRZoMye")    │
│         từ chuỗi DB                                         │
│                                                             │
│     2b. Hash lại: BCrypt("123456", salt, cost=10)           │
│         → "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p9..."     │
│                                                             │
│     2c. So sánh chuỗi mới với chuỗi trong DB                │
│         → Giống hệt → return true                           │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Sinh JWT token → trả về FE                              │
└─────────────────────────────────────────────────────────────┘
```

#### ❓ Tại sao không dùng `equals()` mà phải dùng `matches()`?

```java
// ❌ SAI — luôn luôn false
if (user.getPassword().equals("123456")) { ... }
// → so sánh "$2a$10$N9qo8uLO..." với "123456" → KHÔNG bao giờ bằng

// ❌ SAI — vẫn không khớp
String inputHash = BCrypt.encode("123456");
if (user.getPassword().equals(inputHash)) { ... }
// → mỗi lần encode("123456") sinh salt RANDOM khác nhau
//   → hash mới khác hash trong DB → luôn false

// ✅ ĐÚNG
if (passwordEncoder.matches("123456", user.getPassword())) { ... }
// → matches() biết tách salt từ hash trong DB
//   → dùng ĐÚNG salt đó để hash lại input → so sánh
```

#### 💡 Hệ quả thực tế

1. **Admin cũng không biết password của user.** Vào DB chỉ thấy chuỗi `$2a$10$...`. Đó là lý do khi quên password, hệ thống yêu cầu **reset** (đặt password mới) chứ không phải **gửi lại** password cũ. Nếu web nào gửi lại password gốc qua email → web đó **lưu password dạng plain text** → cực kỳ nguy hiểm.

2. **Hacker dump DB cũng không lấy được password.** Phải brute force từng password thử với salt từng user → quá chậm vì BCrypt cố tình chậm.

3. **Đổi password không cần biết password cũ ở mức DB.** Service chỉ cần verify password cũ (matches), rồi `encode()` password mới và `UPDATE` hash mới vào.

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

    @Value("${app.frontend-url}")
    private String frontendUrl;
    // ↑ Đọc từ application.yml (app.frontend-url: http://localhost:5173)
    //   Đổi env (dev/staging/prod) chỉ cần đổi config, KHÔNG sửa code.

    @Bean
    public CorsFilter corsFilter() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(frontendUrl));
        // ↑ CHỈ cho FE đã khai báo trong config. Web khác → bị chặn.
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));         // Cho phép header Authorization
        config.setAllowCredentials(true);                // Cho phép gửi token

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return new CorsFilter(source);
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

### Config SecurityFilterChain (full code thực tế)

Đường dẫn: `backend/src/main/java/com/cinex/common/config/SecurityConfig.java`

```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity         // Bật @PreAuthorize / @PostAuthorize (mặc định prePostEnabled = true)
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
                .cors(cors -> {})
                // ↑ BẬT CORS — sử dụng bean CorsFilter đã khai báo trong CorsConfig.
                //   Không bật → mọi request từ FE (localhost:5173) bị block.

                .csrf(AbstractHttpConfigurer::disable)
                // ↑ Tắt CSRF vì dùng JWT (stateless). CSRF chỉ cần cho cookie-based session.

                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                // ↑ Không tạo session trên server. Mỗi request mang token riêng.

                .authorizeHttpRequests(auth -> auth
                        // === Luôn public ===
                        .requestMatchers("/api/health").permitAll()
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**").permitAll()

                        // === Chỉ GET public (xem phim, thể loại, phòng, ghế) — POST/PUT/DELETE cần auth ===
                        .requestMatchers(HttpMethod.GET, "/api/movies/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/genres/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/rooms/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/showtimes/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/bookings/showtimes/*/occupied-seats").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/configs/public/**").permitAll()

                        // === Payment callback — cổng thanh toán (MoMo, VNPay...) gọi trực tiếp, không có JWT ===
                        .requestMatchers(HttpMethod.GET, "/api/payments/callback").permitAll()

                        // === WebSocket — STOMP handshake không có header Authorization ===
                        .requestMatchers("/ws/**").permitAll()

                        // === Còn lại cần authenticated (POST, PUT, DELETE, /api/users/me, /api/bookings...) ===
                        .anyRequest().authenticated()
                )
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED))
                        // ↑ Chưa đăng nhập / token hết hạn → trả 401 thay vì 403 mặc định.
                        //   401 = "chưa xác định danh tính", 403 = "đã biết nhưng không có quyền".
                        //   FE dựa vào 401 để tự gọi /api/auth/refresh.
                )
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                // ↑ Chèn JwtAuthFilter VÀO TRƯỚC UsernamePasswordAuthenticationFilter mặc định.
                //   → Request đi qua JwtAuthFilter trước → set Authentication từ JWT.

                .build();
    }
}
```

### Vì sao tách GET vs POST/PUT/DELETE?

CineX cho phép **xem phim, lịch chiếu, ghế đã đặt** mà KHÔNG cần login (giống tinyvietnam, betacinemas). Nhưng **đặt vé, sửa profile, xóa** thì BẮT BUỘC phải có token.

```
GET  /api/movies               → public  (khách vãng lai xem được)
POST /api/movies               → auth    (chỉ admin tạo phim)
PUT  /api/movies/123           → auth    (chỉ admin sửa)

GET  /api/bookings/showtimes/45/occupied-seats   → public (xem ghế nào đã đặt)
POST /api/bookings                                → auth   (đặt vé phải login)
```

### Vì sao Payment callback phải permitAll?

Khi user thanh toán MoMo, MoMo redirect về `GET /api/payments/callback?orderId=...&signature=...`. Request này KHÔNG có header `Authorization` (MoMo không biết JWT của user). Nếu để `.authenticated()` → 401 → user không bao giờ được redirect về trang success.

**An toàn:** Backend verify chữ ký HMAC từ MoMo trong controller — hacker không tự gọi giả được vì không biết secret.

### Vì sao WebSocket phải permitAll?

STOMP handshake qua HTTP UPGRADE, browser KHÔNG đính kèm header `Authorization`. Auth phải làm ở tầng STOMP (CONNECT frame) chứ không qua SecurityFilterChain.

---

## 5. Validation (@Valid) — Kiểm tra dữ liệu đầu vào

### Là gì?
Kiểm tra data client gửi lên **trước khi** vào Service. Sai → trả lỗi ngay.

### Ví dụ đời thường
Nộp hồ sơ: bảo vệ kiểm tra "có đủ giấy tờ?" TRƯỚC KHI cho vào phỏng vấn.

### Ví dụ đầy đủ (CineX thực tế — strict password policy)

```java
// File: backend/src/main/java/com/cinex/module/auth/dto/RegisterRequest.java
public class RegisterRequest {

    @NotBlank(message = "Tên đăng nhập là bắt buộc")
    @Pattern(
            regexp = "^[a-zA-Z0-9_.]{3,50}$",
            message = "Username chỉ chấp nhận chữ cái không dấu, số, dấu chấm và gạch dưới"
    )
    private String username;

    @NotBlank(message = "Email là bắt buộc")
    @Email(message = "Email không hợp lệ")
    private String email;

    @NotBlank(message = "Mật khẩu là bắt buộc")
    @Pattern(
            regexp = "^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d).{8,100}$",
            message = "Mật khẩu phải ≥ 8 ký tự, có chữ HOA, chữ thường và số"
    )
    @Size(min = 8, max = 100)
    private String password;

    private String fullName;
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

### Password policy chuẩn của CineX (strict regex)

CineX áp dụng **strict password policy** thông qua `@Pattern` ở mọi DTO liên quan đến mật khẩu, không chỉ ở register.

| DTO | File | Áp dụng cho endpoint |
|---|---|---|
| `RegisterRequest` | `module/auth/dto/RegisterRequest.java` | `POST /api/auth/register` |
| `ResetPasswordRequest` | `module/auth/dto/ResetPasswordRequest.java` | `POST /api/auth/reset-password` |
| `ChangePasswordRequest` | `module/user/dto/ChangePasswordRequest.java` | `POST /api/users/me/change-password` |

Cả 3 DTO cùng dùng 1 regex thống nhất:

```java
@Pattern(
    regexp = "^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d).{8,100}$",
    message = "Mật khẩu phải ≥ 8 ký tự, có chữ HOA, chữ thường và số"
)
```

#### Bóc tách regex bằng ví dụ đời thường

Regex giống "checklist kiểm tra hành lý ở sân bay" — phải đủ tất cả mục thì mới cho qua.

| Phần | Ý nghĩa | Ví dụ pass | Ví dụ fail |
|---|---|---|---|
| `^` | Bắt đầu chuỗi | — | — |
| `(?=.*[A-Z])` | **Lookahead**: phải có ≥ 1 chữ hoa | `Abc123xy` | `abc123xy` ❌ thiếu HOA |
| `(?=.*[a-z])` | Lookahead: phải có ≥ 1 chữ thường | `Abc123xy` | `ABC123XY` ❌ thiếu thường |
| `(?=.*\\d)` | Lookahead: phải có ≥ 1 chữ số | `Abc123xy` | `Abcdefgh` ❌ thiếu số |
| `.{8,100}` | Độ dài 8-100 ký tự bất kỳ | `Abc12345` | `Abc123` ❌ chỉ 6 ký tự |
| `$` | Kết thúc chuỗi | — | — |

**Lookahead `(?=...)` là gì?** Là kiểm tra "có tồn tại pattern này ở đâu đó phía trước" nhưng **không tiêu hao ký tự**. Nhờ vậy 3 lookahead có thể check 3 điều kiện độc lập trên cùng 1 chuỗi.

> So sánh: nếu viết tuần tự `[A-Z][a-z]\\d.{5,}` → bắt buộc thứ tự HOA → thường → số → 5 ký tự còn lại → `Aa1xxxxx` pass nhưng `aA1xxxxx` fail (sai thứ tự). Đó là sai thiết kế.

#### Vì sao chọn policy này (không quá khắt khe)

| Quy tắc | Ngưỡng CineX | Vì sao không cao hơn |
|---|---|---|
| Độ dài | ≥ 8 | NIST 800-63B khuyến cáo ≥ 8 là tối thiểu chấp nhận được |
| Chữ hoa + thường + số | Bắt buộc | Tăng entropy mà user vẫn nhớ được |
| Ký tự đặc biệt | **Không bắt buộc** | NIST 2017+ không còn yêu cầu — user thường đặt `Password1!` cho có lệ |
| Đổi pass định kỳ | **Không bắt buộc** | NIST 2017+ đã bỏ — gây user đặt pass dễ đoán dạng `Spring2026!` → `Summer2026!` |

#### Username regex

```java
@Pattern(regexp = "^[a-zA-Z0-9_.]{3,50}$", message = "...")
```

| Cho phép | Không cho phép | Vì sao |
|---|---|---|
| `a-zA-Z` (latin) | Chữ Tiếng Việt có dấu | URL `/users/vănan` cần encode → bug |
| `0-9` | — | OK |
| `_` dấu gạch dưới | — | OK |
| `.` dấu chấm | — | OK |
| | Khoảng trắng | `@vanan ` vs `@vanan` confused |
| | `@`, `#`, `!` | Conflict với mention `@username` trong UI |

Độ dài 3-50: 3 đủ ngắn để username gọn (`an`, `v3`), 50 đủ dài cho username dài.

#### Lưu ý kiến trúc: Validation ở 2 lớp

Password policy ở DTO là lớp **đầu tiên**, **không phải duy nhất**:

```
1. DTO @Valid     → Format: độ dài, ký tự, regex      (lớp này)
2. Service        → Logic: != password cũ, != email   (xem AuthService.resetPassword)
```

VD logic mà DTO không check được:

```java
// AuthService.resetPassword() — line 269
if (passwordEncoder.matches(request.getNewPassword(), user.getPassword())) {
    throw new BusinessException(ErrorCode.INVALID_PASSWORD,
            "Mật khẩu mới phải khác mật khẩu cũ");
}
```

→ Không thể check ở DTO vì cần query DB lấy hash cũ. DTO chỉ check format, Service check rule liên quan dữ liệu.

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
| Thêm URL public mới (VD: thêm endpoint xem-thử không cần login) | `SecurityConfig.java` → thêm dòng `.requestMatchers(HttpMethod.GET, "/api/xxx/**").permitAll()` trong block `authorizeHttpRequests` |
| Thêm role mới (VD: STAFF) | `Role.java` → thêm enum. Thêm `@PreAuthorize("hasRole('STAFF')")` ở Controller cần phân quyền |
| Sửa thời gian hết hạn token | `application.yml` → `app.jwt.expiration-ms` |
| Cho phép FE ở domain khác gọi API | `application.yml` → đổi `app.frontend-url` (CorsConfig đọc qua `@Value`) |
| Thêm loại lỗi mới | `ErrorCode.java` → thêm enum |
| Thêm validation cho DTO mới | DTO class → thêm `@NotBlank`, `@Size`, ... |

---

## 10. Câu hỏi tự kiểm tra

1. **JWT có mã hóa payload không?** → Không, chỉ Base64 encode. Ai cũng đọc được. An toàn nhờ signature.

2. **Tại sao tắt CSRF khi dùng JWT?** → CSRF tấn công qua cookie. JWT gửi qua header, không dùng cookie → không bị CSRF.

3. **User A có token, gửi cho User B. B dùng được không?** → Được, trong 15 phút. Vì JWT stateless, server không biết ai đang cầm token. Đây là lý do access token phải ngắn hạn.

4. **Nếu bỏ `@Valid` trong Controller, điều gì xảy ra?** → Request không được validate → data sai vào Service → có thể gây lỗi DB (VD: username null → SQL error) hoặc lỗi logic.

5. **Tại sao `passwordEncoder.matches()` chứ không phải `equals()`?** → BCrypt hash có salt ngẫu nhiên, cùng password hash 2 lần ra 2 kết quả KHÁC nhau. `matches()` tách salt + hash lại + so sánh. `equals()` so sánh string → luôn sai.

---

## 11. JWT Pitfalls — Top 5 lỗ hổng JWT thường gặp

JWT nghe thì oai nhưng nếu cấu hình sai, nó là cánh cửa mở toang cho hacker. Sau đây là 5 lỗ hổng phổ biến nhất, và cách CineX phòng tránh.

### Lỗ hổng 1: `alg=none` attack — Hacker bảo "tôi không cần ký"

**Tấn công thế nào?**
JWT có 3 phần: `header.payload.signature`. Phần header chứa thuật toán ký, ví dụ `{"alg":"HS256","typ":"JWT"}`. Hacker đổi thành `{"alg":"none","typ":"JWT"}` và xóa luôn phần signature. Nếu thư viện JWT lỏng lẻo, server sẽ tin và cho qua.

**Ví dụ đời thường:** Giống hợp đồng yêu cầu công chứng. Hacker bảo "tờ này không cần công chứng đâu" và đưa cho bạn. Nếu bạn tin → toang.

**Cách phòng tránh trong CineX:** Trong `JwtUtil.java`, chúng ta dùng `Jwts.parser().verifyWith(getSigningKey())`. Phương thức `verifyWith()` BẮT BUỘC token phải có signature hợp lệ với key. Nếu hacker gửi token `alg=none`, thư viện jjwt 0.12+ sẽ ném `UnsupportedJwtException` ngay.

**Đoạn code an toàn:**
```java
// JwtUtil.java — luôn dùng verifyWith, không bao giờ parse mà không verify
Claims claims = Jwts.parser()
        .verifyWith(getSigningKey())   // BẮT BUỘC verify với key server-side
        .build()
        .parseSignedClaims(token)       // parseSignedClaims = bắt buộc có signature
        .getPayload();
```

**ĐỪNG làm thế này:**
```java
// Code SAI — không verify signature
Claims claims = Jwts.parser()
        .build()
        .parseClaimsJwt(token)   // parseClaimsJwt = không kiểm tra signature
        .getBody();
```

### Lỗ hổng 2: Weak secret — Mật khẩu ký quá yếu

**Tấn công thế nào?** Hacker download token bất kỳ, dùng tool brute-force (như `jwt_tool`, `hashcat`) thử các secret phổ biến: `secret`, `123456`, `cinex`, `mysecret`. Nếu trúng → hacker tự ký token với role ADMIN.

**Yêu cầu của HS256:** secret phải dài ≥ 256-bit (32 byte). Thư viện jjwt 0.12 từ chối ký với secret ngắn hơn.

**Cách generate secret an toàn:**
```bash
# Cách 1: openssl (chuẩn nhất)
openssl rand -base64 32
# Kết quả: VEYxQ1lr8KW7vGGyZRsTb3iFqaFnxJqyN8kQXrL5Mbk=

# Cách 2: dùng /dev/urandom
head -c 32 /dev/urandom | base64

# Cách 3: Python
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

**Cấu hình trong `application.yml`:**
```yaml
app:
  jwt:
    secret: ${JWT_SECRET}   # đọc từ env var, KHÔNG hardcode trong git
    expiration-ms: 900000   # 15 phút
```

**Ví dụ đời thường:** Secret giống mật khẩu mở két sắt. Đặt `123456` cho két sắt = hacker mở trong 2 giây.

### Lỗ hổng 3: No expiration — Token sống mãi

**Tấn công thế nào?** Token không có claim `exp` → sống vĩnh viễn. Hacker chôm 1 lần dùng cả đời, kể cả khi user đã đổi password.

**Cách phòng tránh:** Mỗi token PHẢI có `expiration`. CineX dùng:
- Access token: 15 phút (`exp` ngắn để hacker khó dùng)
- Refresh token: 7 ngày (lưu trong DB, có thể revoke)

```java
// JwtUtil.java đã xử lý đúng
.expiration(new Date(System.currentTimeMillis() + ttlMs))
```

**Ví dụ đời thường:** Vé xem phim phải có ngày giờ chiếu. Vé "vĩnh viễn" = ai cầm cũng vào được, mãi mãi.

### Lỗ hổng 4: Missing audience/issuer claim

**Tấn công thế nào?** Công ty có 3 service: `cinex-api`, `cinex-admin`, `cinex-partner`. Cả 3 dùng chung secret. Hacker lấy token của `partner` (quyền thấp) đem dùng cho `admin` (quyền cao) → leo thang đặc quyền.

**Cách phòng tránh:** Thêm claim `iss` (issuer = ai cấp) và `aud` (audience = cấp cho ai), rồi verify cả 2:

```java
// Khi cấp token
.claim("iss", "cinex-auth-service")
.claim("aud", "cinex-api")

// Khi verify
Claims claims = Jwts.parser()
        .verifyWith(getSigningKey())
        .requireIssuer("cinex-auth-service")    // ép buộc iss
        .requireAudience("cinex-api")            // ép buộc aud
        .build()
        .parseSignedClaims(token)
        .getPayload();
```

Nếu token không có `iss=cinex-auth-service` hoặc `aud=cinex-api` → ném `IncorrectClaimException`.

**Ví dụ đời thường:** Thẻ ra vào "Công ty A" không dùng được ở "Công ty B" dù cùng nhà bảo vệ.

### Lỗ hổng 5: Token lưu ở đâu? localStorage vs httpOnly cookie

| Tiêu chí | localStorage | httpOnly Cookie |
|---|---|---|
| Bị XSS đọc được? | CÓ (`document.cookie` cũng đọc được nhưng cookie httpOnly thì KHÔNG) | KHÔNG (JS không truy cập được) |
| Bị CSRF? | KHÔNG (phải tự gửi qua header `Authorization`) | CÓ (browser tự gửi cookie kèm mọi request) |
| Mobile app dùng được? | Dễ (đọc bằng JS) | Khó (cookie chỉ dành cho browser) |
| Cross-domain? | Dễ (FE tự attach token) | Khó (CORS + SameSite phức tạp) |

**CineX chọn `localStorage`. Tại sao?**

1. **Đối tượng người dùng đa dạng:** Web + Mobile + Partner API. localStorage hoạt động đồng nhất.
2. **Phòng XSS bằng cách khác:** Dùng `Content-Security-Policy`, sanitize input, dùng React (auto escape) → giảm risk XSS.
3. **CSRF khó tránh hơn XSS nếu dùng cookie:** Phải thêm CSRF token, SameSite=Strict, dễ break flow OAuth.
4. **Access token chỉ 15 phút:** Dù bị XSS chôm, hacker chỉ có 15 phút để dùng.

**Cảnh báo cho production thật:** Nếu là ngân hàng/y tế → ưu tiên httpOnly cookie + CSRF token. CineX là cinema booking, risk thấp hơn.

---

## 12. Refresh Token Rotation — Pattern chuẩn production

### Vấn đề: refresh token bị lộ = sống mãi 7 ngày

Access token chỉ 15 phút nên rủi ro thấp. Nhưng refresh token (7 ngày) nếu bị hacker chôm → hắn có thể tự `/auth/refresh` mỗi 15 phút, lấy access token mới mãi mãi trong 7 ngày. User đổi password cũng vô ích vì refresh token cũ vẫn hợp lệ.

**Ví dụ đời thường:** Refresh token giống thẻ thành viên VIP. Mất thẻ = ai nhặt được cũng vào nhà hàng được suốt 7 ngày, kể cả bạn đã đổi mã PIN.

### Giải pháp: Rotation (xoay vòng) + Reuse Detection

**Pattern:**
1. Mỗi lần user gọi `/auth/refresh` với refresh token cũ → server cấp **refresh token MỚI** + **invalidate refresh token cũ**.
2. Nếu refresh token cũ bị dùng lại lần thứ 2 → đây là dấu hiệu hacker đang dùng. Server **revoke TẤT CẢ refresh token của user** → logout mọi device.

### Schema bảng `refresh_tokens`

```sql
CREATE TABLE refresh_tokens (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    token_hash      VARCHAR(64) NOT NULL UNIQUE,   -- SHA-256 hash, KHÔNG lưu plain
    user_id         BIGINT NOT NULL,
    expires_at      DATETIME2 NOT NULL,
    revoked         BIT NOT NULL DEFAULT 0,        -- đã invalidate chưa
    replaced_by     VARCHAR(64) NULL,              -- hash của token thay thế (chain)
    created_at      DATETIME2 NOT NULL DEFAULT GETDATE(),
    created_ip      VARCHAR(45) NULL,              -- audit
    user_agent      VARCHAR(255) NULL,             -- audit
    CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_refresh_user (user_id),
    INDEX idx_refresh_hash (token_hash)
);
```

**Vì sao lưu hash mà không lưu plain?** Nếu DB bị leak, hacker chỉ có hash → không tự tạo được token. Giống password, không bao giờ lưu raw.

### Service `refreshToken()` đầy đủ

```java
@Service
@RequiredArgsConstructor
@Transactional
public class RefreshTokenService {

    private final RefreshTokenRepository refreshRepo;
    private final UserRepository userRepo;
    private final JwtUtil jwtUtil;

    private static final long REFRESH_TTL_MS = 7L * 24 * 60 * 60 * 1000; // 7 ngày

    /**
     * Cấp refresh token mới khi login.
     */
    public String issueRefreshToken(User user, String ip, String userAgent) {
        String rawToken = UUID.randomUUID().toString() + "-" + System.currentTimeMillis();
        String hash = sha256(rawToken);

        RefreshToken entity = RefreshToken.builder()
                .tokenHash(hash)
                .userId(user.getId())
                .expiresAt(LocalDateTime.now().plusDays(7))
                .revoked(false)
                .createdIp(ip)
                .userAgent(userAgent)
                .build();
        refreshRepo.save(entity);

        return rawToken; // trả raw cho client, server chỉ lưu hash
    }

    /**
     * Rotation: nhận refresh cũ → cấp access + refresh mới.
     */
    public TokenPair rotate(String oldRawToken, String ip, String userAgent) {
        String oldHash = sha256(oldRawToken);
        RefreshToken old = refreshRepo.findByTokenHash(oldHash)
                .orElseThrow(() -> new BusinessException(ErrorCode.INVALID_REFRESH_TOKEN));

        // [REUSE DETECTION] Nếu token cũ đã bị revoke → có người dùng lại token cũ
        // → đây là dấu hiệu hacker đã chôm token. Cảnh báo: revoke toàn bộ user.
        if (old.isRevoked()) {
            log.warn("[SECURITY] Refresh token reuse detected for user {}. Revoking all sessions.",
                     old.getUserId());
            refreshRepo.revokeAllByUserId(old.getUserId());
            throw new BusinessException(ErrorCode.REFRESH_TOKEN_REUSED);
        }

        if (old.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new BusinessException(ErrorCode.REFRESH_TOKEN_EXPIRED);
        }

        User user = userRepo.findById(old.getUserId())
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        // Cấp refresh mới
        String newRawToken = issueRefreshToken(user, ip, userAgent);
        String newHash = sha256(newRawToken);

        // Invalidate refresh cũ + đánh dấu nó được thay bằng token nào (chain)
        old.setRevoked(true);
        old.setReplacedBy(newHash);
        refreshRepo.save(old);

        // Cấp access token mới
        String accessToken = jwtUtil.generateToken(
                user.getUsername(),
                Map.of("role", user.getRole().name(), "userId", user.getId())
        );

        return new TokenPair(accessToken, newRawToken);
    }

    private String sha256(String raw) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(raw.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
```

### Sơ đồ luồng Rotation + Reuse Detection

```
LOGIN (lần đầu)
┌─────────┐        POST /auth/login                ┌─────────┐
│ Client  │ ─────────────────────────────────────> │ Server  │
│         │                                         │         │
│         │ <───────────────────────────────────── │ access1 │
│         │   { accessToken: A1, refreshToken: R1 } │ refresh1│
└─────────┘                                         └─────────┘
                                                    DB: R1 (revoked=false)

REFRESH (sau 15 phút, access hết hạn)
┌─────────┐  POST /auth/refresh { token: R1 }      ┌─────────┐
│ Client  │ ─────────────────────────────────────> │ Server  │
│         │                                         │         │
│         │ <───────────────────────────────────── │ Cấp A2,R2│
│         │   { accessToken: A2, refreshToken: R2 } │ Revoke R1│
└─────────┘                                         └─────────┘
                                                    DB: R1 (revoked=true, replaced_by=R2)
                                                        R2 (revoked=false)

HACKER chôm được R1 (qua XSS, log leak, MITM)
HACKER dùng R1 → server thấy R1.revoked=true → REUSE DETECTED
┌─────────┐  POST /auth/refresh { token: R1 }      ┌─────────┐
│ Hacker  │ ─────────────────────────────────────> │ Server  │
│         │                                         │         │
│         │ <───────────────────────────────────── │ ALERT!  │
│         │   401 Refresh token reused              │ Revoke  │
└─────────┘                                         │ ALL R*  │
                                                    │ của user│
                                                    └─────────┘
                                                    DB: R2 (revoked=true)
                                                    → User thật bị logout
                                                    → User login lại với password
                                                    → Hacker mất quyền truy cập
```

**Lợi ích chính:** Dù hacker chôm được refresh token, vừa dùng là bị phát hiện ngay (vì user thật đã rotate qua R2). Window of attack chỉ là từ lúc chôm đến lúc user thật refresh lần kế tiếp.

---

## 13. Method-level Security với `@PreAuthorize`

### Vì sao cần?

`SecurityConfig` cấu hình quyền theo URL (`/api/admin/**` cần ADMIN). Nhưng đôi khi muốn phân quyền **mịn hơn**:
- "User chỉ được xem booking của chính mình"
- "Chỉ ADMIN có permission `MOVIE_WRITE` mới được sửa phim"
- "STAFF chỉ check-in được booking trong rạp mình quản lý"

URL-based không đủ → cần method-level.

### Bật `@PreAuthorize`

Trong `SecurityConfig.java` thêm annotation `@EnableMethodSecurity`. CineX đã bật sẵn:
```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity   // BẬT @PreAuthorize / @PostAuthorize
public class SecurityConfig {
    // ...
}
```

> **Lưu ý:** Từ Spring Security 5.6+, `@EnableMethodSecurity` mặc định đã có `prePostEnabled = true`. Không cần ghi `@EnableMethodSecurity(prePostEnabled = true)` (chỉ thừa). Cách viết cũ `@EnableGlobalMethodSecurity(prePostEnabled = true)` đã deprecated, đừng dùng.

`@EnableMethodSecurity` → Spring Security wrap mỗi bean có `@PreAuthorize` bằng AOP proxy. Trước khi gọi method, nó eval biểu thức trong `@PreAuthorize`. Nếu false → ném `AccessDeniedException`.

### Cú pháp SpEL (Spring Expression Language)

```java
@PreAuthorize("hasRole('ADMIN')")
// → user phải có authority "ROLE_ADMIN"

@PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
// → user là ADMIN HOẶC STAFF

@PreAuthorize("hasAuthority('MOVIE_WRITE')")
// → user có authority "MOVIE_WRITE" (không tự prefix ROLE_)

@PreAuthorize("#userId == authentication.principal.id")
// → param userId phải bằng id của user đang login

@PreAuthorize("hasRole('ADMIN') or #userId == authentication.principal.id")
// → ADMIN xem được mọi user, user thường chỉ xem được chính mình

@PreAuthorize("@bookingSecurity.isOwner(#bookingId, authentication)")
// → gọi bean bookingSecurity.isOwner() để kiểm tra
```

### Code mẫu `UserController` với `@PreAuthorize`

```java
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    // Chỉ ADMIN xem được danh sách user
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<PageResponse<UserResponse>> list(...) {
        return ApiResponse.success(userService.list(...));
    }

    // ADMIN xem được mọi user, user thường chỉ xem được CHÍNH MÌNH
    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or #id == authentication.principal.id")
    public ApiResponse<UserResponse> getOne(@PathVariable Long id) {
        return ApiResponse.success(userService.getById(id));
    }

    // Chỉ ADMIN sửa được user khác
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<UserResponse> update(@PathVariable Long id,
                                            @Valid @RequestBody UpdateUserRequest req) {
        return ApiResponse.success(userService.update(id, req));
    }

    // User tự đổi password CỦA MÌNH, ADMIN không cần
    @PostMapping("/{id}/password")
    @PreAuthorize("#id == authentication.principal.id")
    public ApiResponse<Void> changePassword(@PathVariable Long id,
                                            @Valid @RequestBody ChangePasswordRequest req) {
        userService.changePassword(id, req);
        return ApiResponse.success(null);
    }
}
```

### URL-based vs Method-level — Khi nào dùng cái nào?

| Tình huống | Cách phù hợp |
|---|---|
| Toàn bộ module admin chỉ cho ADMIN | URL-based trong `SecurityConfig` (`/api/admin/**`) |
| 90% endpoint public, 10% cần login | URL-based với `permitAll()` + `authenticated()` |
| 1 endpoint có rule phức tạp dựa trên data | `@PreAuthorize` ở method |
| Cần kiểm tra ownership (user A chỉ xem được booking của A) | `@PreAuthorize` với SpEL hoặc bean custom |
| Cần check quyền sau khi method chạy (VD: chỉ trả booking nếu hợp lệ) | `@PostAuthorize` |

### Cảnh báo: `@PreAuthorize` KHÔNG hoạt động khi...

**1. Method là `private`:**
```java
@Service
public class UserService {

    public void update(Long id) {
        validate(id);   // self-invocation
    }

    @PreAuthorize("hasRole('ADMIN')")  // KHÔNG có tác dụng!
    private void validate(Long id) {
        // ...
    }
}
```

Vì Spring Security dùng proxy AOP. Proxy chỉ chặn được method `public`. Method `private` gọi nội bộ → bypass proxy.

**2. Self-invocation (gọi method trong cùng class):**
```java
@Service
public class UserService {

    public void doStuff() {
        this.updateUser(123L);   // self-invocation → bypass proxy!
    }

    @PreAuthorize("hasRole('ADMIN')")  // KHÔNG có tác dụng khi gọi từ doStuff()
    public void updateUser(Long id) {
        // ...
    }
}
```

**Fix:** Tách method `updateUser` ra service khác, hoặc inject `self` proxy:
```java
@Autowired
@Lazy
private UserService self;

public void doStuff() {
    self.updateUser(123L);   // qua proxy → @PreAuthorize hoạt động
}
```

**Ví dụ đời thường:** AOP proxy giống bảo vệ ở cổng. Bạn vào nhà từ cổng = qua bảo vệ. Nhưng nếu bạn đã ở trong nhà rồi, đi từ phòng khách sang bếp = không qua bảo vệ. `this.method()` = đi trong nhà, không gặp bảo vệ.

---

## 14. SecurityContextHolder + ThreadLocal

### ThreadLocal là gì?

`ThreadLocal<T>` là biến mà **mỗi thread giữ một bản sao riêng**. Thread A set giá trị X, thread B đọc → vẫn null. Không có tranh chấp giữa các thread.

**Ví dụ đời thường:** Như tủ đồ cá nhân ở phòng gym. Mỗi người 1 tủ, có chìa khóa riêng. Người A bỏ đồ vào tủ A, người B mở tủ B → không thấy đồ của A.

### Spring Security dùng ThreadLocal để làm gì?

Mỗi request HTTP được xử lý bởi 1 thread riêng (từ thread pool của Tomcat). `JwtAuthFilter` set thông tin user vào `SecurityContextHolder` → thực chất là set vào `ThreadLocal<SecurityContext>`. Khi Controller chạy → cùng thread → đọc được user.

```
Request 1 → Thread T1 → JwtAuthFilter set Auth1 → Controller đọc Auth1
Request 2 → Thread T2 → JwtAuthFilter set Auth2 → Controller đọc Auth2
   ↑ T1 và T2 không nhìn thấy data của nhau, dù dùng chung SecurityContextHolder
```

### Cách lấy current user

**Cách 1: lấy trực tiếp:**
```java
Authentication auth = SecurityContextHolder.getContext().getAuthentication();
String username = auth.getName();                              // "vanan"
UserDetails details = (UserDetails) auth.getPrincipal();       // userDetails object
boolean isAdmin = auth.getAuthorities().stream()
        .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
```

**Cách 2: dùng `@AuthenticationPrincipal` (Spring tự inject):**
```java
@GetMapping("/me")
public ApiResponse<UserResponse> me(@AuthenticationPrincipal UserDetails userDetails) {
    return ApiResponse.success(userService.findByUsername(userDetails.getUsername()));
}
```

### Tạo custom annotation `@CurrentUser`

Hơi xấu khi controller nào cũng `auth.getPrincipal()`. Tạo annotation đẹp hơn:

```java
// 1. Annotation
@Target(ElementType.PARAMETER)
@Retention(RetentionPolicy.RUNTIME)
public @interface CurrentUser {
}

// 2. Resolver
@Component
@RequiredArgsConstructor
public class CurrentUserArgumentResolver implements HandlerMethodArgumentResolver {

    private final UserRepository userRepository;

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return parameter.hasParameterAnnotation(CurrentUser.class)
                && parameter.getParameterType().equals(User.class);
    }

    @Override
    public Object resolveArgument(MethodParameter parameter,
                                  ModelAndViewContainer mavContainer,
                                  NativeWebRequest webRequest,
                                  WebDataBinderFactory binderFactory) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            return null;
        }
        UserDetails details = (UserDetails) auth.getPrincipal();
        return userRepository.findActiveByUsername(details.getUsername())
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
    }
}

// 3. Đăng ký resolver
@Configuration
@RequiredArgsConstructor
public class WebMvcConfig implements WebMvcConfigurer {

    private final CurrentUserArgumentResolver currentUserResolver;

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(currentUserResolver);
    }
}

// 4. Dùng
@GetMapping("/api/bookings/me")
public ApiResponse<List<BookingResponse>> myBookings(@CurrentUser User user) {
    return ApiResponse.success(bookingService.findByUserId(user.getId()));
}
```

### Cảnh báo lớn: `@Async` không tự propagate SecurityContext

```java
@Service
public class NotificationService {

    @Async
    public void sendEmailAsync() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        // → NULL! Vì @Async chạy trên thread khác, ThreadLocal không truyền sang
    }
}
```

**Fix 1: Mode INHERITABLETHREADLOCAL** (kế thừa từ thread cha):
```java
// Trong main class hoặc @Configuration
@Bean
public MethodInvokingFactoryBean securityContextStrategy() {
    MethodInvokingFactoryBean bean = new MethodInvokingFactoryBean();
    bean.setTargetClass(SecurityContextHolder.class);
    bean.setTargetMethod("setStrategyName");
    bean.setArguments(SecurityContextHolder.MODE_INHERITABLETHREADLOCAL);
    return bean;
}
```

Hạn chế: chỉ work cho thread tạo MỚI từ thread cha. Thread pool tái sử dụng thread → vẫn fail.

**Fix 2: `DelegatingSecurityContextExecutor`** (chuẩn nhất):
```java
@Configuration
public class AsyncConfig implements AsyncConfigurer {

    @Override
    public Executor getAsyncExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(5);
        executor.setMaxPoolSize(10);
        executor.initialize();
        // Wrap executor để tự copy SecurityContext sang thread con
        return new DelegatingSecurityContextExecutor(executor);
    }
}
```

**Ví dụ đời thường:** ThreadLocal giống tủ đồ cá nhân. Khi bạn nhờ người khác làm hộ việc gì (@Async), họ không có chìa khóa tủ của bạn. `DelegatingSecurityContextExecutor` = đưa chìa khóa cho người ta cầm qua phòng khác.

---

## 15. CORS Pitfalls — Lỗi thường gặp + cách debug

### Pitfall 1: `allowedOrigins("*")` + `allowCredentials(true)`

```java
// CẤU HÌNH SAI — trình duyệt sẽ reject
configuration.setAllowedOrigins(List.of("*"));
configuration.setAllowCredentials(true);
```

**Lỗi trên DevTools:**
```
Access to XMLHttpRequest at 'http://localhost:8088/api/auth/login' from origin
'http://localhost:5173' has been blocked by CORS policy: The value of the
'Access-Control-Allow-Origin' header in the response must not be the wildcard
'*' when the request's credentials mode is 'include'.
```

**Vì sao?** Nếu cho phép gửi credentials (cookie, header `Authorization`) thì BẮT BUỘC phải chỉ định origin cụ thể, không được `*`. Chuẩn CORS chặn vì nếu cho phép, hacker từ bất kỳ domain nào cũng đọc được response có cookie auth.

**Fix:**
```java
configuration.setAllowedOrigins(List.of(
        "http://localhost:5173",
        "https://cinex.vn"
));
configuration.setAllowCredentials(true);
```

Hoặc dùng `setAllowedOriginPatterns` cho pattern:
```java
configuration.setAllowedOriginPatterns(List.of("https://*.cinex.vn"));
```

### Pitfall 2: Preflight quá nhiều → API chậm

Mỗi request `POST/PUT/DELETE` hoặc có custom header → browser gửi **OPTIONS preflight** trước. Nếu mỗi lần đều preflight → API chậm gấp đôi.

**Fix:** Cache preflight với `setMaxAge`:
```java
configuration.setMaxAge(3600L);   // browser cache 1 giờ
```

Sau khi cache, các request cùng origin + method + header trong 1 giờ không cần preflight nữa.

### Pitfall 3: WebSocket bypass CORS

WebSocket khi handshake KHÔNG dùng CORS chuẩn. Nhưng nếu dùng SockJS fallback (over HTTP) → request đầu tiên qua HTTP → DÍNH CORS.

**Fix:** Cấu hình thêm cho WebSocket:
```java
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOrigins("http://localhost:5173", "https://cinex.vn")
                .withSockJS();
    }
}
```

### Pitfall 4: Browser cache 401 → tưởng CORS lỗi

Khi token hết hạn → server trả 401 → browser cache response. Lần sau gọi → vẫn 401 dù token đã refresh. Sinh viên dễ tưởng "CORS lỗi" mà thực ra là cache.

**Debug bằng DevTools Network tab:**
1. Mở DevTools → Network
2. Tick "Disable cache"
3. Lọc theo `XHR/Fetch`
4. Click request lỗi → tab "Headers" → xem:
   - **Request Headers:** `Origin: http://localhost:5173`
   - **Response Headers:** `Access-Control-Allow-Origin: ?`
5. Nếu response KHÔNG có `Access-Control-Allow-Origin` → server chưa cho phép origin này.
6. Nếu response CÓ nhưng giá trị khác origin → cấu hình sai.

### Common error message + nguyên nhân

| Error message | Nguyên nhân |
|---|---|
| `No 'Access-Control-Allow-Origin' header is present` | Server chưa cấu hình CORS, hoặc origin không match |
| `The value of the 'Access-Control-Allow-Origin' header must not be the wildcard '*'` | `allowedOrigins("*")` + `allowCredentials(true)` |
| `Method PATCH is not allowed by Access-Control-Allow-Methods` | Chưa thêm PATCH vào `setAllowedMethods` |
| `Request header field authorization is not allowed by Access-Control-Allow-Headers` | Chưa thêm `Authorization` vào `setAllowedHeaders` |
| `Response to preflight request doesn't pass access control check` | OPTIONS endpoint bị Security block — phải `permitAll()` cho OPTIONS |

**Đừng quên permit OPTIONS trong SecurityConfig:**
```java
.authorizeHttpRequests(auth -> auth
    .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()   // BẮT BUỘC
    ...
)
```

---

## 16. AccessDeniedHandler + AuthenticationEntryPoint (ĐỀ XUẤT NÂNG CẤP)

> **⚠️ Lưu ý:** Section này là **ĐỀ XUẤT NÂNG CẤP**, KHÔNG phải code đang chạy trong CineX.
>
> Hiện tại CineX dùng `HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)` (xem Section 4) — trả về **status 401 với body rỗng**. FE tự hiển thị message "Phiên đăng nhập hết hạn" dựa vào status code.
>
> Nếu sau này muốn body JSON đẹp hơn (kèm `code`, `message` tiếng Việt), có thể nâng cấp theo pattern dưới đây. Hai file `CustomAuthenticationEntryPoint.java` và `CustomAccessDeniedHandler.java` **chưa tồn tại trong codebase**.

### Vấn đề

Mặc định khi user không có quyền → Spring trả 403 với HTML mặc định của Tomcat. FE đang expect JSON → parse fail → hiển thị "Lỗi không xác định". Trải nghiệm tệ.

### Phân biệt 2 trường hợp

| Tình huống | Spring xử lý qua | HTTP code |
|---|---|---|
| Chưa login (chưa có token, token sai) | `AuthenticationEntryPoint` | 401 Unauthorized |
| Đã login nhưng không đủ quyền | `AccessDeniedHandler` | 403 Forbidden |

**Ví dụ đời thường:**
- 401 = "Bạn là ai? Trình thẻ đi" (chưa xác định danh tính)
- 403 = "À chị bảo vệ này tôi biết, nhưng phòng này không cho chị vào" (đã biết là ai, nhưng không có quyền)

### Code mẫu `CustomAuthenticationEntryPoint` (401)

```java
package com.cinex.security;

import com.cinex.common.exception.ErrorCode;
import com.cinex.common.response.ApiResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class CustomAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ObjectMapper objectMapper;

    @Override
    public void commence(HttpServletRequest request,
                         HttpServletResponse response,
                         AuthenticationException authException) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");

        ApiResponse<Void> body = ApiResponse.error(
                ErrorCode.UNAUTHORIZED.getCode(),
                "Bạn cần đăng nhập để truy cập tài nguyên này"
        );

        response.getWriter().write(objectMapper.writeValueAsString(body));
    }
}
```

### Code mẫu `CustomAccessDeniedHandler` (403)

```java
package com.cinex.security;

import com.cinex.common.exception.ErrorCode;
import com.cinex.common.response.ApiResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class CustomAccessDeniedHandler implements AccessDeniedHandler {

    private final ObjectMapper objectMapper;

    @Override
    public void handle(HttpServletRequest request,
                       HttpServletResponse response,
                       AccessDeniedException accessDeniedException) throws IOException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");

        ApiResponse<Void> body = ApiResponse.error(
                ErrorCode.FORBIDDEN.getCode(),
                "Bạn không có quyền thực hiện thao tác này"
        );

        response.getWriter().write(objectMapper.writeValueAsString(body));
    }
}
```

### Tích hợp vào `SecurityConfig`

```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final CustomAuthenticationEntryPoint authEntryPoint;
    private final CustomAccessDeniedHandler accessDeniedHandler;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .anyRequest().authenticated()
                )
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(authEntryPoint)      // 401
                        .accessDeniedHandler(accessDeniedHandler)       // 403
                )
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }
}
```

### Kết quả

**Trước (HTML mặc định):**
```html
<!doctype html>
<html lang="en">
<head><title>HTTP Status 403 – Forbidden</title>...</head>
...
```

**Sau (JSON đẹp, FE parse được):**
```json
{
  "success": false,
  "code": "FORBIDDEN",
  "message": "Bạn không có quyền thực hiện thao tác này",
  "data": null,
  "timestamp": "2026-05-31T10:30:00"
}
```

---

## 17. Full code 3 file cốt lõi của CineX (rebuild được)

Phần này show full code của `JwtUtil`, `JwtAuthFilter`, `CustomUserDetailsService` đúng như trong codebase, để sinh viên có thể đọc-hiểu hoặc rebuild từ đầu.

### File 1: `JwtUtil.java`

Đường dẫn: `backend/src/main/java/com/cinex/security/JwtUtil.java`

```java
package com.cinex.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.Map;
import java.util.function.Function;

@Component
public class JwtUtil {

    @Value("${app.jwt.secret}")
    private String secret;

    @Getter
    @Value("${app.jwt.expiration-ms}")
    private long expirationMs;

    /**
     * Cấp access token với TTL mặc định (15 phút).
     */
    public String generateToken(String username, Map<String, Object> extraClaims) {
        return generateToken(username, extraClaims, expirationMs);
    }

    /**
     * Cấp token với TTL tùy chỉnh — dùng cho refresh hoặc reset password token.
     */
    public String generateToken(String username, Map<String, Object> extraClaims, long ttlMs) {
        return Jwts.builder()
                .claims(extraClaims)                                                  // userId, role, ...
                .subject(username)                                                    // sub = username
                .issuedAt(new Date())                                                 // iat
                .expiration(new Date(System.currentTimeMillis() + ttlMs))             // exp
                .signWith(getSigningKey())                                            // HS256 signature
                .compact();                                                            // → "header.payload.signature"
    }

    /**
     * Lấy username từ token đã verify thành công.
     */
    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    /**
     * Token hợp lệ ↔ username khớp + chưa hết hạn.
     */
    public boolean isTokenValid(String token, String username) {
        return extractUsername(token).equals(username) && !isTokenExpired(token);
    }

    private boolean isTokenExpired(String token) {
        return extractClaim(token, Claims::getExpiration).before(new Date());
    }

    /**
     * Parse + verify token, sau đó dùng resolver lấy claim cụ thể.
     * Nếu token sai signature, hết hạn, format lỗi → ném exception.
     */
    private <T> T extractClaim(String token, Function<Claims, T> resolver) {
        Claims claims = Jwts.parser()
                .verifyWith(getSigningKey())            // BẮT BUỘC verify signature
                .build()
                .parseSignedClaims(token)               // bắt buộc token phải có signature hợp lệ
                .getPayload();
        return resolver.apply(claims);
    }

    /**
     * Convert secret (base64 string trong application.yml) → SecretKey HS256.
     * Secret PHẢI ≥ 256-bit sau khi decode base64.
     */
    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(Decoders.BASE64.decode(secret));
    }
}
```

### File 2: `JwtAuthFilter.java`

Đường dẫn: `backend/src/main/java/com/cinex/security/JwtAuthFilter.java`

```java
package com.cinex.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Filter chạy 1 lần mỗi request, kiểm tra header Authorization.
 * extends OncePerRequestFilter → đảm bảo không chạy 2 lần cho cùng request
 * (kể cả khi có forward / include servlet).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final UserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");

        // Không có header Authorization → bỏ qua, để Spring Security tự xử lý
        // (request đến endpoint public sẽ pass, đến endpoint authenticated sẽ 401)
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            // Lấy phần token sau "Bearer "
            String token = authHeader.substring(7);
            String username = jwtUtil.extractUsername(token);

            // Chỉ set authentication nếu chưa có (tránh ghi đè khi có filter khác đã set)
            if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                UserDetails userDetails = userDetailsService.loadUserByUsername(username);

                if (jwtUtil.isTokenValid(token, userDetails.getUsername())) {
                    UsernamePasswordAuthenticationToken authToken =
                            new UsernamePasswordAuthenticationToken(
                                    userDetails,
                                    null,                                  // credentials = null (đã verify qua JWT)
                                    userDetails.getAuthorities()
                            );
                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                }
            }
        } catch (Exception e) {
            // Token hết hạn, sai format, bị tampering → bỏ qua, không set auth
            // → Spring Security sẽ trả 401 cho endpoint cần authenticated
            log.debug("JWT validation failed: {}", e.getMessage());
        }

        filterChain.doFilter(request, response);
    }
}
```

### File 3: `CustomUserDetailsService.java`

Đường dẫn: `backend/src/main/java/com/cinex/security/CustomUserDetailsService.java`

```java
package com.cinex.security;

import com.cinex.module.auth.entity.User;
import com.cinex.module.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Spring Security gọi loadUserByUsername mỗi khi cần xác thực user.
 * Trong CineX, gọi mỗi request có JWT (để verify user còn tồn tại + lấy role).
 */
@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        // Dùng findActiveByUsername → user đã soft delete không qua được JWT filter
        // Query: WHERE username = ? AND storage_state <> 'ARCHIVED'
        User user = userRepository.findActiveByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));

        // Convert User (entity của CineX) → UserDetails (interface Spring Security hiểu)
        return new org.springframework.security.core.userdetails.User(
                user.getUsername(),
                user.getPassword(),                                                  // password đã BCrypt hash
                user.isEnabled(),                                                    // tài khoản đang active?
                true,                                                                // accountNonExpired
                true,                                                                // credentialsNonExpired
                true,                                                                // accountNonLocked
                // Spring Security yêu cầu role có prefix "ROLE_"
                // → hasRole('ADMIN') sẽ match với authority "ROLE_ADMIN"
                List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()))
        );
    }
}
```

### Tổng hợp: luồng JWT đầy đủ với 3 file này

```
1. POST /api/auth/login (username + password)
       ↓
   AuthController → AuthService.login()
       ↓
   passwordEncoder.matches(raw, hashed)
       ↓
   JwtUtil.generateToken(username, {role, userId}) → "eyJ..."
       ↓
   Trả về client: { accessToken: "eyJ..." }

2. GET /api/bookings/me (kèm header Authorization: Bearer eyJ...)
       ↓
   JwtAuthFilter.doFilterInternal()
       ↓
   JwtUtil.extractUsername("eyJ...") → "vanan"
       ↓
   CustomUserDetailsService.loadUserByUsername("vanan")
       → UserRepository.findActiveByUsername("vanan")
       → SELECT * FROM users WHERE username='vanan' AND storage_state <> 'ARCHIVED'
       → UserDetails với authority "ROLE_USER"
       ↓
   JwtUtil.isTokenValid(token, "vanan") → true
       ↓
   SecurityContextHolder.setAuthentication(authToken)
       ↓
   filterChain.doFilter() → tiếp tục đến Controller
       ↓
   BookingController.myBookings(@CurrentUser user)
       → CurrentUserArgumentResolver lấy user từ SecurityContextHolder
       → bookingService.findByUserId(user.getId())
       → Trả JSON ApiResponse<List<BookingResponse>>
```

Với 3 file này, một sinh viên có thể tự xây lại toàn bộ luồng JWT của CineX từ con số 0.

---

## 18. JWT Blacklist (Redis) — Vô hiệu hóa access token sớm

### 18.1. Vấn đề: JWT stateless không revoke được

JWT là **stateless**: server không lưu phiên đăng nhập, mỗi request chỉ verify chữ ký + check expiration. Lợi ích: scale dễ (không cần sticky session, không cần Redis chia sẻ session giữa instance). Nhược điểm:

```
Time 0:00  → User login                  → access token TTL 15 phút (hết hạn 0:15)
Time 0:05  → User logout                 → Server revoke refresh token ✓
                                          → Nhưng access token CŨ vẫn còn hạn 10 phút!
Time 0:06  → Attacker steal access token → Vẫn gọi API được trong 9 phút nữa
```

Vấn đề tương tự khi user đổi password — refresh token bị revoke, nhưng access token cũ còn dùng được.

**Ví dụ đời thường:** Bạn báo mất CMND → công an thu hồi số CMND đã đăng ký. Nhưng tấm CMND cũ (vật lý) vẫn nằm trong tay kẻ trộm → kẻ trộm vẫn dùng đến ngân hàng đến khi CMND hết hạn. Cần thêm 1 "danh sách CMND báo mất" để mọi nơi check.

### 18.2. Giải pháp: Blacklist trong Redis với TTL = remaining

Khi logout / đổi password, lưu token vào Redis. JwtAuthFilter check Redis trước khi set Authentication.

**Quy tắc đặt key:**
```
Key:   jwt:blacklist:{sha256-hex-của-token}
Value: "1"   (không quan trọng, chỉ cần exists)
TTL:   exp - now   (phần còn lại trước khi token hết hạn tự nhiên)
```

**Vì sao TTL = remaining?** Token hết hạn tự nhiên → JwtAuthFilter đã reject ở bước check expiration → không cần giữ blacklist nữa. Redis tự xóa key → không cần scheduler dọn rác, không phình memory.

### 18.3. Vì sao hash SHA-256 thay vì lưu raw token?

| | Lưu raw token | Lưu SHA-256 hash |
|---|---|---|
| Memory | ~200 byte / key (JWT dài) | 64 byte (hex 32 byte hash) |
| Bảo mật khi Redis leak | ❌ Attacker có token raw → impersonate | ✅ Hash 1 chiều — không khôi phục token |
| Verify | `EXISTS jwt:blacklist:{raw}` | `EXISTS jwt:blacklist:{hash(raw)}` (cost ≈ 0) |

> **Vì sao không dùng `jti` claim (JWT ID)?** `jti` là cách chuẩn của JWT spec — lưu UUID vào claim khi tạo token, blacklist theo `jti` (ngắn 36 byte) thay vì hash. Tuy nhiên `JwtUtil` hiện tại của CineX chưa add `jti` vào claim (token chỉ chứa `sub`, `role`, `exp`, `iat`). Hash SHA-256 là cách **tương đương về bảo mật** mà không cần migrate JWT format. Khi nâng cấp lên `jti` claim cũng chỉ thay 1 dòng `tokenHash()` → `claims.getId()`.

### 18.4. Code thực tế

```
File: backend/src/main/java/com/cinex/security/JwtBlacklistService.java
```

```java
@Service
@RequiredArgsConstructor
@Slf4j
public class JwtBlacklistService {

    private static final String KEY_PREFIX = "jwt:blacklist:";

    private final StringRedisTemplate redis;
    private final JwtUtil jwtUtil;

    /**
     * Đưa token vào blacklist với TTL = phần còn lại trước khi token hết hạn.
     * Nếu token đã hết hạn → bỏ qua (filter sẽ tự reject expired).
     */
    public void blacklist(String token) {
        if (token == null || token.isBlank()) return;
        try {
            Claims claims = jwtUtil.extractAllClaims(token);
            Date exp = claims.getExpiration();
            if (exp == null) return;

            long remainMs = exp.getTime() - System.currentTimeMillis();
            if (remainMs <= 0) return;   // Đã expire → khỏi blacklist

            String key = KEY_PREFIX + tokenHash(token);
            redis.opsForValue().set(key, "1", Duration.ofMillis(remainMs));
            log.info("JWT blacklisted for user '{}', TTL={}s", claims.getSubject(), remainMs / 1000);
        } catch (Exception e) {
            // Token sai format / signature → coi như không cần blacklist
            log.debug("Skip blacklist (invalid token): {}", e.getMessage());
        }
    }

    /**
     * Check mỗi request từ JwtAuthFilter. Fail-open khi Redis lỗi
     * → tránh outage Redis làm block toàn site.
     */
    public boolean isBlacklisted(String token) {
        if (token == null || token.isBlank()) return false;
        try {
            String key = KEY_PREFIX + tokenHash(token);
            return Boolean.TRUE.equals(redis.hasKey(key));
        } catch (Exception e) {
            log.warn("Redis check blacklist failed, fail-open: {}", e.getMessage());
            return false;
        }
    }

    /** SHA-256 → 64 hex chars. */
    public String tokenHash(String token) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(token.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(hash.length * 2);
            for (byte b : hash) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
```

### 18.5. Tích hợp vào JwtAuthFilter

```java
// File: backend/src/main/java/com/cinex/security/JwtAuthFilter.java (line 51-73)

String token = authHeader.substring(7);

// Parse JWT 1 LẦN — lấy cả subject + expiration trong 1 call.
Claims claims = jwtUtil.extractAllClaims(token);
String username = claims.getSubject();
Date expiration = claims.getExpiration();

// 1. Check expired TỪ CLAIMS (không parse lại token)
if (expiration != null && expiration.before(new Date())) {
    log.debug("JWT expired for {}", username);
    filterChain.doFilter(request, response);
    return;
}

// 2. Check blacklist SAU expired
//    → Tiết kiệm 1 round-trip Redis cho token đã hết hạn
if (jwtBlacklistService.isBlacklisted(token)) {
    log.debug("JWT blacklisted for {}", username);
    filterChain.doFilter(request, response);
    return;
}
```

**Thứ tự check quan trọng:** expired → blacklisted, không phải ngược lại.
- Token expired chiếm tỷ lệ lớn (mọi request quá 15 phút) → check expired trước (CPU local, nhanh) → tiết kiệm round-trip Redis.

### 18.6. Tích hợp vào AuthService.logout & UserService.changePassword

```java
// AuthService.java — line 184-198
@Transactional
public void logout(HttpServletRequest httpRequest) {
    String username = SecurityUtil.getCurrentUsername();
    User user = userRepository.findActiveByUsername(username)
            .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
    refreshTokenService.revokeAllUserTokens(user.getId());

    // Blacklist access token hiện tại
    String accessToken = extractBearerToken(httpRequest);
    if (accessToken != null) {
        jwtBlacklistService.blacklist(accessToken);
    }
    log.info("User {} logged out", username);
}
```

```java
// UserService.java — line 104-115 (sau khi đổi password thành công)
refreshTokenService.revokeAllUserTokens(user.getId());

// Blacklist access token hiện tại — tránh attacker đang có token còn hạn
// tiếp tục dùng trong 15 phút sau khi user đã đổi password.
if (httpRequest != null) {
    String authHeader = httpRequest.getHeader("Authorization");
    if (authHeader != null && authHeader.startsWith("Bearer ")) {
        jwtBlacklistService.blacklist(authHeader.substring(7));
    }
}
```

### 18.7. Sequence diagram — Login → Logout → Request bị reject

```
┌──────┐                ┌────────────────┐  ┌─────────┐  ┌───────┐
│ User │                │ JwtAuthFilter  │  │ Service │  │ Redis │
└──┬───┘                └───────┬────────┘  └────┬────┘  └───┬───┘
   │                            │                │           │
   │ POST /api/auth/login       │                │           │
   │───────────────────────────────────────────►│           │
   │                            │                │ verify pwd│
   │  { access: "eyJ...", ... }                  │           │
   │◄───────────────────────────────────────────│           │
   │                            │                │           │
   │ GET /api/users/me          │                │           │
   │ Authorization: Bearer eyJ..│                │           │
   │───────────────────────────►│                │           │
   │                            │ extractClaims  │           │
   │                            │ check expired  │           │
   │                            │ check blacklist┼──EXISTS──►│
   │                            │◄─────────────────false─────│
   │                            │ setAuth        │           │
   │ 200 OK { user data }       │                │           │
   │◄───────────────────────────│                │           │
   │                            │                │           │
   │ POST /api/auth/logout      │                │           │
   │ Authorization: Bearer eyJ..│                │           │
   │───────────────────────────►│                │           │
   │                            │  forward       │ blacklist │
   │                            │───────────────►│ token     │
   │                            │                │──SET──────►│
   │                            │                │  TTL=600s │
   │ 200 OK                     │                │           │
   │◄───────────────────────────│                │           │
   │                            │                │           │
   │ GET /api/users/me          │                │           │
   │ Authorization: Bearer eyJ..│  (token cũ)    │           │
   │───────────────────────────►│                │           │
   │                            │ check blacklist┼──EXISTS──►│
   │                            │◄─────────────────true──────│
   │                            │ SKIP setAuth   │           │
   │ 401 Unauthorized           │                │           │
   │◄───────────────────────────│                │           │
```

### 18.8. Tradeoff — Stateless vs Revocable

| Aspect | JWT thuần (stateless) | JWT + Blacklist |
|---|---|---|
| Scale | ⭐⭐⭐⭐⭐ Không cần share state | ⭐⭐⭐⭐ Cần Redis chung |
| Revoke ngay | ❌ Phải đợi expire | ✅ Logout = invalidate ngay |
| Latency mỗi request | Verify chữ ký local | + 1 round-trip Redis (~1ms LAN) |
| Phụ thuộc Redis | Không | Có (nhưng fail-open) |

CineX chọn JWT + Blacklist vì:
- Logout phải có hiệu lực **ngay** (sai khi user nhấn "Đăng xuất" mà hacker vẫn dùng token 15 phút).
- Redis đã có sẵn cho rate limit, cache config → không phát sinh hạ tầng mới.

### 18.9. Fail-open khi Redis chết — quyết định thiết kế

`isBlacklisted` catch exception → return `false` → coi như không có trong blacklist → cho qua.

**Tại sao chọn fail-open thay vì fail-close (block)?**

| | Fail-open (CineX chọn) | Fail-close |
|---|---|---|
| Redis down 5 phút | Site vẫn chạy bình thường | **TOÀN BỘ user bị 401** |
| Token cũ vừa logout | Vẫn dùng được trong 5 phút | An toàn hơn |
| Tổn thất | Cửa sổ tấn công 15 phút (TTL JWT) | Mất doanh thu toàn site |

→ Trade-off này chỉ chấp nhận được vì **TTL access token đã ngắn (15 phút)**. Nếu TTL access token là 1 ngày → phải fail-close hoặc giảm TTL.

---

## 19. STOMP WebSocket — Binding Principal từ JWT

### 19.1. Vấn đề: convertAndSendToUser cần Principal

CineX dùng WebSocket để push notification real-time (booking confirmed, payment success). Phương thức:

```java
simpMessagingTemplate.convertAndSendToUser(
    username,                    // ← Spring tìm session theo Principal.getName()
    "/queue/notifications",
    notificationPayload
);
```

Spring nội bộ map destination này thành `/user/{sessionId}/queue/notifications`. Để biết `sessionId` thuộc về `username` nào, **mỗi STOMP session phải có `Principal`** lưu trong session attributes.

**Nếu không set Principal:**
- `convertAndSendToUser("vanan", ...)` không tìm thấy session nào có `Principal.getName() == "vanan"`.
- Message bị **drop âm thầm** — không exception, FE không nhận được notification.
- Log không có gì rõ ràng → debug rất khó.

### 19.2. Bonus security: chống IDOR

IDOR = Insecure Direct Object Reference: user A truy cập tài nguyên của user B bằng cách đoán/sửa ID.

**Nếu dùng `/topic/notifications/{userId}` (sai):**
```javascript
// FE user A subscribe topic của user B
stompClient.subscribe('/topic/notifications/123', ...);   // user 123 là user khác
```
→ Spring broker không check authorization theo destination — A nhận được mọi notification của user 123.

**Khi dùng `/user/queue/notifications` (đúng):**
- Spring tự gắn `sessionId` vào destination dựa trên **Principal đã verify từ JWT**.
- User A subscribe `/user/queue/notifications` → Spring map thành `/user/{sessionId-A}/queue/notifications`.
- Backend gọi `convertAndSendToUser("user_B", ...)` → chỉ session của user B nhận → A không nghe được.
- A không thể "spoof" Principal vì interceptor verify JWT chữ ký từ server secret.

### 19.3. Code thực tế

```
File: backend/src/main/java/com/cinex/security/StompChannelInterceptor.java
```

```java
@Component
@RequiredArgsConstructor
@Slf4j
public class StompChannelInterceptor implements ChannelInterceptor {

    private final JwtUtil jwtUtil;
    private final UserDetailsService userDetailsService;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor =
                MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null) return message;

        // CHỈ parse JWT ở STOMP CONNECT — các message SEND/SUBSCRIBE sau đó
        // Spring tự attach lại Principal từ session attributes.
        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            String authHeader = accessor.getFirstNativeHeader("Authorization");
            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                log.debug("STOMP CONNECT without Authorization header");
                return message;
            }

            try {
                String token = authHeader.substring(7);
                Claims claims = jwtUtil.extractAllClaims(token);
                String username = claims.getSubject();

                if (username != null) {
                    // Load UserDetails để có authorities — match với HTTP filter
                    // (tránh user enabled=false vẫn mở được WebSocket).
                    UserDetails userDetails = userDetailsService.loadUserByUsername(username);
                    UsernamePasswordAuthenticationToken auth =
                            new UsernamePasswordAuthenticationToken(
                                    userDetails, null, userDetails.getAuthorities());
                    accessor.setUser(auth);   // ← Đây mới là điểm mấu chốt
                    log.debug("STOMP CONNECT: bound Principal for user '{}'", username);
                }
            } catch (Exception e) {
                log.debug("STOMP CONNECT JWT invalid: {}", e.getMessage());
                // Không set Principal → convertAndSendToUser không tìm thấy session
            }
        }

        return message;
    }
}
```

### 19.4. Đăng ký interceptor — WebSocketConfig

```java
// File: backend/src/main/java/com/cinex/common/config/WebSocketConfig.java

@Override
public void configureClientInboundChannel(ChannelRegistration registration) {
    registration.interceptors(stompChannelInterceptor);
}

@Override
public void configureMessageBroker(MessageBrokerRegistry config) {
    config.enableSimpleBroker("/topic", "/queue");
    config.setApplicationDestinationPrefixes("/app");
    // /user = prefix cho per-user destination.
    // FE subscribe "/user/queue/notifications" và bắt buộc có Principal hợp lệ.
    config.setUserDestinationPrefix("/user");
}
```

### 19.5. Frontend phải gửi gì?

```typescript
import { Client } from '@stomp/stompjs';

const client = new Client({
  brokerURL: 'ws://localhost:8088/ws',
  // BẮT BUỘC: gửi JWT trong CONNECT frame header
  connectHeaders: {
    Authorization: `Bearer ${accessToken}`
  },
  onConnect: () => {
    // Subscribe vào kênh per-user — không cần biết userId, Spring tự map
    client.subscribe('/user/queue/notifications', (message) => {
      console.log('Got notification:', message.body);
    });
  }
});

client.activate();
```

> **Lưu ý:** `connectHeaders` ≠ `headers`. `connectHeaders` chỉ gửi ở STOMP CONNECT frame (đúng chỗ interceptor đọc). `headers` mỗi message khác sẽ tốn CPU verify JWT lần nữa — không cần.

### 19.6. Sequence diagram — Connect & Send Notification

```
┌────┐         ┌─────────────────────┐  ┌────────────┐  ┌──────────┐
│ FE │         │ StompInterceptor    │  │ Spring     │  │ Service  │
└─┬──┘         └──────────┬──────────┘  │ Broker     │  └────┬─────┘
  │                       │              └─────┬──────┘       │
  │ WS handshake          │                    │              │
  │──────────────────────►│                    │              │
  │                       │                    │              │
  │ STOMP CONNECT         │                    │              │
  │ Auth: Bearer eyJ...   │                    │              │
  │──────────────────────►│ extractClaims      │              │
  │                       │ loadUserDetails    │              │
  │                       │ setUser(auth)      │              │
  │                       │───────────────────►│ store        │
  │                       │                    │ Principal    │
  │                       │                    │ in session   │
  │ CONNECTED             │                    │              │
  │◄──────────────────────│                    │              │
  │                       │                    │              │
  │ SUBSCRIBE             │                    │              │
  │ /user/queue/notifs    │                    │              │
  │────────────────────────────────────────────►│ map → /user │
  │                       │                    │ /{sessionId}│
  │                       │                    │ /queue/...   │
  │                       │                    │              │
  │                       │                    │  (backend trigger event)
  │                       │                    │◄─────────────│
  │                       │                    │ convertAnd   │
  │                       │                    │ SendToUser(  │
  │                       │                    │  "vanan",    │
  │                       │                    │  "/queue/..")│
  │                       │                    │ lookup       │
  │                       │                    │ session of   │
  │                       │                    │ "vanan"      │
  │ MESSAGE { payload }   │                    │              │
  │◄────────────────────────────────────────────│              │
```

### 19.7. Lifecycle: chỉ parse JWT ở CONNECT, không phải mỗi message

`preSend` được gọi cho MỌI STOMP frame (CONNECT, SUBSCRIBE, SEND, UNSUBSCRIBE, DISCONNECT). Nhưng code chỉ check `StompCommand.CONNECT`:

```java
if (StompCommand.CONNECT.equals(accessor.getCommand())) {
    // parse JWT, setUser
}
return message;   // các command khác đi tiếp không cần parse
```

**Vì sao?** Verify HMAC mỗi message tốn CPU. Sau CONNECT, Spring lưu Principal vào WebSocket session attributes — các SUBSCRIBE/SEND sau đó tự lấy Principal từ session, không cần JWT.

### 19.8. Lỗi thường gặp

| Triệu chứng | Nguyên nhân | Fix |
|---|---|---|
| `convertAndSendToUser` không tới FE | FE quên gửi `connectHeaders.Authorization` | Thêm header |
| FE connect OK nhưng nhận `null` Principal | Token expired / sai chữ ký | Check log `JWT invalid` |
| FE nhận được notification của user khác | Đang dùng `/topic/notifications/{id}` thay vì `/user/queue/...` | Đổi destination |
| Mở DevTools thấy STOMP frame có header `Authorization` nhưng vẫn không nhận | Server không config `configureClientInboundChannel` | Đăng ký interceptor |

---

## 20. Constant-time signature compare — Chống Timing Attack

### 20.1. Vấn đề: String.equals() rò rỉ thông tin qua thời gian

Method `String.equals()` của Java (và C++ `strcmp`, Python `==`) **return sớm ngay khi gặp byte đầu khác nhau**:

```java
public boolean equals(Object anObject) {
    // ... pseudo-code
    for (int i = 0; i < length; i++) {
        if (this.charAt(i) != other.charAt(i)) {
            return false;   // ← THOÁT NGAY khi gặp ký tự khác
        }
    }
    return true;
}
```

**Vì sao đây là lỗ hổng?**

```
String thật:    "aXc12345" (8 ký tự)
Attacker thử:   "bXXXXXXX" → fail ngay ký tự đầu          → 0.1 ns
Attacker thử:   "aXXXXXXX" → fail ở ký tự 2               → 0.2 ns  ← chậm hơn!
Attacker thử:   "aXXXXXXX" → fail ở ký tự 2 ...
Attacker thử:   "aYXXXXXX" → fail ở ký tự 2               → 0.2 ns
Attacker thử:   "aXcXXXXX" → fail ở ký tự 3               → 0.3 ns  ← chậm hơn nữa!
```

Đo response time của hàng nghìn request → attacker xác định **byte đầu = 'a'**, rồi tìm byte 2, byte 3... Brute force giảm từ `256^8 = 18 tỷ tỷ` xuống `256 × 8 = 2048` lần thử.

### 20.2. Ví dụ đời thường

Mở khóa số 4 chữ số. Nếu khóa "khóa thông minh" rung mỗi khi đúng 1 số:
- Thử `1234` → khóa rung 1 cái (số 1 đúng) → 1 không phải số 1.
- Thử `1235` → khóa rung 1 cái → giữ vị trí đầu là 1.
- Tăng dần vị trí 2, 3, 4 → mở khóa trong < 40 lần thử thay vì 10.000.

→ Khóa rung tiết lộ thông tin từng vị trí. `String.equals` cũng "rung" qua thời gian.

### 20.3. Giải pháp: MessageDigest.isEqual — Constant-time

```java
public static boolean isEqual(byte[] digesta, byte[] digestb) {
    if (digesta == digestb) return true;
    if (digesta == null || digestb == null) return false;

    int lenA = digesta.length;
    int lenB = digestb.length;

    if (lenB == 0) return lenA == 0;

    int result = 0;
    result |= lenA - lenB;

    // ALWAYS loop hết length B, dù phát hiện sai
    for (int i = 0; i < lenB; i++) {
        int indexA = Math.min(i, lenA - 1);
        result |= digesta[indexA] ^ digestb[i];
    }
    return result == 0;
}
```

Chìa khóa: dùng **bitwise OR cộng dồn** thay vì return sớm. Vòng lặp luôn duyệt hết → thời gian thực thi không phụ thuộc vị trí byte sai → attacker không đo được gì.

### 20.4. Code thực tế trong CineX — MoMoPaymentProcessor

```
File: backend/src/main/java/com/cinex/module/payment/processor/MoMoPaymentProcessor.java
Line: 138-178
```

```java
@Override
public boolean verifyCallback(Map<String, String> params) {
    try {
        String signature = params.get("signature");
        if (signature == null) return false;

        // Tạo lại chữ ký từ params callback
        String rawSignature = "accessKey=" + accessKey
                + "&amount=" + params.getOrDefault("amount", "")
                + "&extraData=" + params.getOrDefault("extraData", "")
                // ... các field khác theo alphabet order MoMo quy định
                + "&transId=" + params.getOrDefault("transId", "");

        String expectedSignature = hmacSHA256(secretKey, rawSignature);

        // Constant-time compare chống timing attack:
        // String.equals() return sớm khi gặp ký tự khác → attacker đo độ trễ
        // → đoán dần từng byte signature. MessageDigest.isEqual() so sánh hết byte.
        if (!MessageDigest.isEqual(
                expectedSignature.getBytes(StandardCharsets.UTF_8),
                signature.getBytes(StandardCharsets.UTF_8))) {
            log.warn("MoMo callback invalid signature");
            return false;
        }

        String resultCode = params.get("resultCode");
        return "0".equals(resultCode);

    } catch (Exception e) {
        log.error("MoMo verify callback error", e);
        return false;
    }
}
```

### 20.5. Khi nào BẮT BUỘC dùng constant-time?

| Comparing | Dùng `.equals()` | Dùng `MessageDigest.isEqual` |
|---|---|---|
| Username, email, status enum | ✅ OK (không bí mật) | ❌ Thừa |
| Password (raw) | ❌ Không bao giờ — phải hash | — |
| BCrypt hash (`passwordEncoder.matches`) | — | Built-in đã constant-time |
| HMAC signature (MoMo, VnPay, webhook) | ❌ **LỖ HỔNG** | ✅ Bắt buộc |
| JWT chữ ký | — | JJWT library đã tự dùng |
| API key, CSRF token | ❌ Lỗ hổng | ✅ Bắt buộc |
| Reset password token | ❌ Lỗ hổng | ✅ Bắt buộc (chưa có ở CineX) |

### 20.6. Tại sao timing attack hiếm khi thực thi qua Internet?

Đo timing qua Internet bị nhiễu: latency mạng (50-200ms) >> chênh lệch CPU (vài µs). Tuy nhiên:

- **LAN attack**: attacker cùng VPC với server → latency 1ms, chênh CPU vẫn đo được.
- **Statistical attack**: gửi 100.000 request, trung bình thống kê khử nhiễu mạng.
- **Browser cache + side-channel**: timing.now() trong JS có thể đo qua XHR.

→ Không phải nguy cơ "lý thuyết" — đã có CVE thực tế (ví dụ Django timing attack 2013, Rails 2014). Quy tắc an toàn: **mọi so sánh secret → constant-time**, không cần xét scenario.

### 20.7. Câu hỏi tự kiểm tra

1. Tại sao `String.equals()` thoát sớm khi gặp ký tự khác — đó là tối ưu performance hay lỗ hổng?
2. Nếu MoMo gửi signature 64 ký tự nhưng `expectedSignature` chỉ 32 ký tự, `MessageDigest.isEqual` có an toàn không? (Đáp: có — vẫn loop hết length B, không return sớm.)
3. Khi BCrypt verify password (`passwordEncoder.matches`), có cần lo về timing attack không? (Đáp: không — BCrypt nội bộ đã constant-time.)
