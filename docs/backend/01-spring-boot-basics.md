# Spring Boot Cơ bản — Từ zero đến hiểu

---

## Spring Boot là gì?

Framework Java giúp tạo ứng dụng web **nhanh chóng**. Nó tự cấu hình hầu hết mọi thứ, bạn chỉ cần viết business logic.

### Ví dụ đời thường
- **Không có Spring Boot:** Mở nhà hàng → tự xây bếp, tự mua bàn ghế, tự thuê nhân viên, tự trang trí.
- **Có Spring Boot:** Mở nhà hàng franchise → bếp + bàn ghế + nhân viên có sẵn, bạn chỉ cần nấu món ăn.

---

## Annotation — Nhãn đánh dấu class

Spring đọc annotation để biết class này **làm gì**, **ở đâu**, **liên kết với ai**.

### Annotation phân loại class (Stereotype)

```java
@Controller   // Nhận HTTP request (có thể trả HTML)
@RestController // Nhận HTTP request + TỰ ĐỘNG trả JSON (= @Controller + @ResponseBody)
@Service      // Xử lý business logic
@Repository   // Truy vấn database
@Component    // Class chung, không thuộc loại nào ở trên
@Configuration // Chứa cấu hình (@Bean methods)
```

**Trong CineX:**
```
@RestController → AuthController, MovieController, ...
@Service        → AuthService, MovieService, ...
@Repository     → UserRepository, MovieRepository, ...
@Configuration  → SecurityConfig, RedisConfig, CorsConfig, ...
@Component      → JwtUtil, JwtAuthFilter, AuditAspect, ...
```

### Tại sao cần annotation?
Spring start → **quét tất cả class** trong package `com.cinex.*` → tìm annotation → tạo object (Bean) → quản lý.

Không có annotation → Spring không biết class tồn tại → không tạo Bean → không inject được.

---

## Bean & Dependency Injection — Tiêm phụ thuộc

### Bean là gì?
Object được **Spring tạo và quản lý**. Bạn không cần `new AuthService()`, Spring tự tạo.

### Dependency Injection (DI) là gì?
Spring **tự tiêm** (inject) các Bean cần thiết vào class của bạn.

### Ví dụ đời thường
Đi nhà hàng: bạn không tự nấu ăn (new), bạn gọi món → nhà hàng (Spring) **mang đến** cho bạn (inject).

### Không có DI (tự tạo — SAI)
```java
public class AuthController {
    // Phải tự tạo tất cả dependency
    private AuthService authService = new AuthService(
        new UserRepository(...),      // phải tự tạo
        new PasswordEncoder(...),     // phải tự tạo
        new JwtUtil(...),             // phải tự tạo
        new RefreshTokenService(...)  // phải tự tạo, lại cần thêm dependency khác...
    );
    // Rất phức tạp, coupling chặt
}
```

### Có DI (Spring inject — ĐÚNG)
```java
@RestController
@RequiredArgsConstructor  // Lombok tạo constructor với tất cả final fields
public class AuthController {

    private final AuthService authService;
    // ← Spring TỰ ĐỘNG tìm Bean AuthService → inject vào đây
    // Bạn không cần biết AuthService cần gì, Spring lo hết
}
```

### 3 cách inject

```java
// Cách 1: Constructor injection (KHUYÊN DÙNG)
@RequiredArgsConstructor
public class AuthService {
    private final UserRepository userRepository;   // Spring inject
    private final PasswordEncoder passwordEncoder; // Spring inject
    private final JwtUtil jwtUtil;                 // Spring inject
}

// Cách 2: Field injection (@Autowired — KHÔNG KHUYÊN)
public class AuthService {
    @Autowired
    private UserRepository userRepository;
    // Lý do không nên: không thể tạo instance trong unit test
}

// Cách 3: Setter injection (hiếm dùng)
public class AuthService {
    private UserRepository userRepository;

    @Autowired
    public void setUserRepository(UserRepository repo) {
        this.userRepository = repo;
    }
}
```

**Quy tắc CineX:** Luôn dùng **Constructor injection** (`@RequiredArgsConstructor` + `private final`).

---

## @Bean — Tạo Bean thủ công

Khi class **không có annotation** (VD: class từ thư viện), dùng `@Bean` trong `@Configuration`:

```java
@Configuration
public class SecurityConfig {

    @Bean  // Spring gọi method này → tạo Bean PasswordEncoder
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
    // Bây giờ bất kỳ class nào inject PasswordEncoder → nhận BCryptPasswordEncoder
}
```

---

## @Value — Đọc config từ application.yml

```java
@Component
public class JwtUtil {

    @Value("${app.jwt.secret}")
    private String secret;
    // ← Đọc giá trị app.jwt.secret từ application.yml

    @Value("${app.jwt.expiration-ms}")
    private long expirationMs;
    // ← Đọc giá trị app.jwt.expiration-ms
}
```

```yaml
# application.yml
app:
  jwt:
    secret: ${JWT_SECRET:defaultSecretKey}  # đọc env var, có default
    expiration-ms: ${JWT_EXPIRATION:900000}  # 15 phút
```

**Cú pháp `${ENV_VAR:default}`:**
- Đọc biến môi trường `JWT_SECRET`
- Nếu không có → dùng giá trị mặc định `defaultSecretKey`

---

## Profile — Cấu hình theo môi trường

```yaml
# application.yml (chung)
spring:
  profiles:
    active: dev       # ← dùng profile "dev"

server:
  port: 8088

# application-dev.yml (chỉ cho dev)
spring:
  datasource:
    url: jdbc:sqlserver://localhost:1433;databaseName=cinex
  jpa:
    show-sql: true    # hiện SQL log

# application-prod.yml (production — sau này)
spring:
  datasource:
    url: jdbc:sqlserver://production-server:1433;databaseName=cinex
  jpa:
    show-sql: false   # tắt SQL log
```

**Cách hoạt động:**
1. Spring đọc `application.yml` (chung)
2. Thấy `profiles.active: dev`
3. Đọc thêm `application-dev.yml` → ghi đè config chung
4. Đổi sang production: `profiles.active: prod` → đọc `application-prod.yml`

---

## @Transactional — Quản lý giao dịch DB

```java
@Service
public class AuthService {

    @Transactional  // Tất cả query trong method = 1 transaction
    public AuthResponse register(RegisterRequest request) {
        // Query 1: kiểm tra username trùng
        if (userRepo.existsByUsername(request.getUsername())) { ... }

        // Query 2: lưu user
        userRepo.save(user);

        // Query 3: tạo refresh token
        refreshTokenRepo.save(token);

        // Nếu query 3 lỗi → ROLLBACK query 1 + 2
    }

    @Transactional(readOnly = true)  // Chỉ đọc, không ghi → Hibernate tối ưu performance
    public UserProfile getProfile(Long userId) {
        return userRepo.findById(userId).orElseThrow(...);
    }
}
```

**Quy tắc:**
- Method **ghi** (create/update/delete): `@Transactional`
- Method **đọc** (select): `@Transactional(readOnly = true)`
- Không có `@Transactional`: mỗi query = 1 transaction riêng → KHÔNG rollback được

---

## REST API Convention — Quy ước đặt tên API

### HTTP Methods

| Method | Tác dụng | Ví dụ |
|---|---|---|
| `GET` | Đọc dữ liệu | `GET /api/movies` — lấy danh sách phim |
| `POST` | Tạo mới | `POST /api/movies` — tạo phim mới |
| `PUT` | Sửa toàn bộ | `PUT /api/movies/1` — sửa phim id=1 |
| `PATCH` | Sửa 1 phần | `PATCH /api/movies/1` — sửa 1 field |
| `DELETE` | Xóa | `DELETE /api/movies/1` — xóa phim id=1 |

### URL Convention

```
/api/movies              → danh sách phim (GET) + tạo phim (POST)
/api/movies/1            → chi tiết phim 1 (GET) + sửa (PUT) + xóa (DELETE)
/api/movies/1/showtimes  → danh sách suất chiếu của phim 1
/api/auth/login          → đăng nhập (POST)
/api/bookings/me         → vé của tôi (GET)
```

**Quy tắc:**
- Danh từ số nhiều: `/movies` không phải `/movie`
- Không dùng động từ: `/api/movies` không phải `/api/getMovies`
- Nested resource: `/movies/1/showtimes` — suất chiếu thuộc phim 1

### HTTP Status Codes

| Code | Nghĩa | Khi nào dùng |
|---|---|---|
| `200` | OK | GET/PUT thành công |
| `201` | Created | POST tạo mới thành công |
| `400` | Bad Request | Validation lỗi |
| `401` | Unauthorized | Chưa đăng nhập |
| `403` | Forbidden | Không có quyền |
| `404` | Not Found | Không tìm thấy |
| `409` | Conflict | Trùng (username, email) |
| `500` | Internal Server Error | Bug, DB lỗi |

### Trong CineX

```java
@RestController
@RequestMapping("/api/movies")  // base URL
public class MovieController {

    @GetMapping                          // GET /api/movies
    public ApiResponse<PageResponse<MovieResponse>> getMovies(...) { }

    @GetMapping("/{id}")                 // GET /api/movies/1
    public ApiResponse<MovieResponse> getMovie(@PathVariable Long id) { }

    @PostMapping                         // POST /api/movies
    public ApiResponse<MovieResponse> createMovie(@Valid @RequestBody MovieRequest req) { }

    @PutMapping("/{id}")                 // PUT /api/movies/1
    public ApiResponse<MovieResponse> updateMovie(@PathVariable Long id, @RequestBody MovieRequest req) { }

    @DeleteMapping("/{id}")              // DELETE /api/movies/1
    public ApiResponse<Void> deleteMovie(@PathVariable Long id) { }
}
```
