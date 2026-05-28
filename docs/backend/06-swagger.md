# Swagger/OpenAPI — Test API trên trình duyệt

---

## Swagger là gì?

Swagger UI tự sinh **giao diện web** để xem và test API. Không cần Postman, không cần viết curl.

### Mở Swagger UI

Chạy backend → mở trình duyệt: **http://localhost:8088/swagger-ui/index.html**

---

## Giao diện Swagger

```
┌─────────────────────────────────────────────────┐
│  CineX API  v1.0.0                              │
│  CineX - Online Cinema Booking System           │
│                                                 │
│  [Authorize 🔒]  ← Click để nhập JWT token      │
│                                                 │
│  ▼ Auth — Register, Login, Refresh token        │
│    POST /api/auth/register                      │
│    POST /api/auth/login                         │
│    POST /api/auth/refresh                       │
│                                                 │
│  ▼ Health                                       │
│    GET  /api/health                             │
└─────────────────────────────────────────────────┘
```

---

## Cách test API trên Swagger

### 1. Test API public (không cần token)

```
1. Mở http://localhost:8088/swagger-ui/index.html
2. Click "POST /api/auth/register" → mở ra
3. Click "Try it out"
4. Điền JSON body:
   {
     "username": "testuser",
     "email": "test@cinex.com",
     "password": "123456"
   }
5. Click "Execute"
6. Xem response bên dưới
```

### 2. Test API cần token

```
1. Login trước: POST /api/auth/login → copy accessToken từ response
2. Click nút "Authorize 🔒" ở góc phải trên
3. Nhập: Bearer eyJhbGci... (có chữ "Bearer " ở đầu)
4. Click "Authorize" → Close
5. Từ giờ mọi request đều tự gắn token
6. Test các API cần auth bình thường
```

---

## Annotation Swagger trong code

### @Tag — Nhóm API

```java
@RestController
@RequestMapping("/api/auth")
@Tag(name = "Auth", description = "Register, Login, Refresh token")
//   ↑ tên nhóm         ↑ mô tả hiện trên Swagger UI
public class AuthController { }
```

### @Operation — Mô tả từng API

```java
@PostMapping("/register")
@Operation(summary = "Register a new account")
//         ↑ mô tả ngắn hiện trên Swagger UI
public ApiResponse<AuthResponse> register(@Valid @RequestBody RegisterRequest request) { }
```

---

## Config trong CineX

```java
// common/config/OpenApiConfig.java
@Configuration    // ← Đánh dấu: "đây là class cấu hình, Spring tự quét khi khởi động"
public class OpenApiConfig {

    @Bean         // ← Đánh dấu: "tạo object này và giữ trong Spring container"
    public OpenAPI openAPI() {
        return new OpenAPI()
            .info(new Info()
                .title("CineX API")              // Tiêu đề hiện trên Swagger UI
                .version("1.0.0")                // Version API
                .description("CineX - Online Cinema Booking System"))  // Mô tả
            .addSecurityItem(new SecurityRequirement().addList("Bearer"))
                // ↑ Thêm security requirement: mọi API mặc định cần Bearer token
            .components(new Components()
                .addSecuritySchemes("Bearer", new SecurityScheme()
                    .type(SecurityScheme.Type.HTTP)   // Loại: HTTP authentication
                    .scheme("bearer")                 // Scheme: bearer
                    .bearerFormat("JWT")));            // Format: JWT
                // ↑ Định nghĩa scheme "Bearer" → Swagger UI hiện nút "Authorize 🔒"
    }
}
```

---

## Tại sao chỉ viết class là tự hoạt động? (Auto-Configuration)

### Luồng tự động khi chạy backend:

```
1. build.gradle có: springdoc-openapi-starter-webmvc-ui
        │
        ▼
2. Spring Boot khởi động → phát hiện thư viện springdoc trong classpath
        │
        ▼
3. Kích hoạt AUTO-CONFIGURATION (tự động, không cần bạn làm gì):
   ├── Đăng ký endpoint GET /v3/api-docs       (JSON spec)
   ├── Đăng ký endpoint GET /swagger-ui/**     (giao diện web)
   └── Quét TẤT CẢ @RestController → đọc annotation → sinh tài liệu
        │
        ▼
4. Tìm Bean OpenAPI (class bạn viết ở trên) → dùng làm config:
   ├── Title: "CineX API"
   ├── Security: nút "Authorize" cho JWT
   └── Description: "Online Cinema Booking System"
        │
        ▼
5. http://localhost:8088/swagger-ui/index.html → SẴN SÀNG dùng
```

### Ví dụ đời thường

Giống **lắp camera an ninh** trong nhà:
- Bạn chỉ cần **gắn camera vào tường** (`@Configuration` + `@Bean`)
- Camera **tự quay**, tự thu hình, tự hiện lên app điện thoại
- Bạn KHÔNG cần "bật camera mỗi sáng" hay "kết nối thủ công"
- Spring Boot cũng vậy — bạn **khai báo**, Spring **tự lo** phần còn lại

### Không cần đăng ký ở đâu cả!

| Câu hỏi | Trả lời |
|---|---|
| Cần đăng ký class trong file nào không? | **Không** — `@Configuration` là đủ, Spring tự quét |
| Cần gọi `openAPI()` ở đâu không? | **Không** — `@Bean` Spring tự gọi 1 lần khi khởi động |
| Cần cấu hình trong application.yml không? | **Không** — mặc định đã hoạt động |
| Nếu xóa class này thì sao? | Swagger **VẪN chạy**, nhưng không có title, không có nút Authorize |

### Cơ chế: Convention over Configuration

Đây là triết lý Spring Boot: **quy ước thay vì cấu hình**

- Cài thư viện (`springdoc` trong build.gradle) → Spring Boot biết bạn muốn Swagger
- Viết class đúng annotation (`@Configuration`, `@Bean`) → Spring tự nối
- KHÔNG cần XML config, KHÔNG cần đăng ký thủ công, KHÔNG cần gọi hàm

So sánh framework cũ (Spring MVC thuần):
```xml
<!-- Ngày xưa phải viết XML dài dòng: -->
<bean id="openApi" class="com.cinex.config.OpenApiConfig" />
<mvc:resources mapping="/swagger-ui/**" location="classpath:/META-INF/resources/" />
<!-- ... 20 dòng config nữa -->
```

Spring Boot 2024+:
```java
// Chỉ cần 1 annotation. XONG.
@Configuration
public class OpenApiConfig { ... }
```

---

## springdoc tự quét những gì?

Khi sinh tài liệu, springdoc tự đọc:

| Annotation | Thông tin lấy được |
|---|---|
| `@RestController` | Tìm class nào là controller |
| `@RequestMapping("/api/auth")` | Base URL của nhóm API |
| `@GetMapping`, `@PostMapping`, ... | HTTP method + path |
| `@RequestBody RegisterRequest` | Body format (tự đọc field của DTO) |
| `@PathVariable Long id` | URL parameter |
| `@RequestParam String name` | Query parameter |
| `@Valid` | Biết field nào required |
| `@Tag(name = "Auth")` | Nhóm API trên UI |
| `@Operation(summary = "...")` | Mô tả từng endpoint |
| `ApiResponse<T>` | Response format |

→ Bạn viết Controller đúng convention → Swagger **tự sinh** tài liệu hoàn chỉnh mà không cần viết thêm gì.

---

## Tại sao cần Swagger?

- **Dev:** Test API nhanh không cần Postman
- **Team:** FE dev xem danh sách API + request/response format
- **Demo:** Thầy mở Swagger UI thấy ngay tất cả API
- **Tài liệu sống:** Code thay đổi → Swagger tự cập nhật (không bao giờ outdate)
