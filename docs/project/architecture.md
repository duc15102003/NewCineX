# Kiến trúc hệ thống CineX

## 1. Tổng quan

CineX sử dụng **Layered Architecture** (kiến trúc phân lớp) — một pattern phổ biến, dễ hiểu và dễ mở rộng. Hệ thống chia thành các lớp rõ ràng, mỗi lớp có trách nhiệm riêng.

## 2. Các lớp trong Layered Architecture

```
Client (Browser)
    │
    ├── HTTP REST ──▶ Controller Layer ← Nhận request, validate input, trả response
    │                       │
    │                       ▼
    │                 Service Layer    ← Xử lý business logic
    │                       │
    │                       ▼
    │                 Repository Layer ← Truy vấn database (Spring Data JPA)
    │                       │
    │                       ▼
    │                 Database (SQL Server)
    │
    └── WebSocket ◀─ SeatWebSocketService ← Real-time push (ghế thay đổi trạng thái)
         (STOMP)     Server chủ động gửi → client nhận ngay, không cần refresh
```

### Controller — Lớp tiếp nhận request

- Nhận HTTP request từ client, gọi Service xử lý, trả về `ApiResponse<T>`
- **KHÔNG** chứa business logic (chỉ điều phối)
- Ví dụ: `HealthController` nhận GET `/api/health` → trả về `ApiResponse.ok("UP")`
- Annotation: `@RestController`, `@RequestMapping`, `@GetMapping`, `@PostMapping`

### Service — Lớp xử lý nghiệp vụ

- Chứa **toàn bộ** logic nghiệp vụ (tính toán, kiểm tra điều kiện, gọi API ngoài, ...)
- Gọi Repository để đọc/ghi database
- Gọi Mapper (MapStruct) để chuyển đổi Entity ↔ DTO
- Annotation: `@Service`, `@Transactional`

### Repository — Lớp truy vấn database

- Interface extend `JpaRepository<Entity, ID>`
- Spring Data JPA **tự động sinh SQL** từ tên method (VD: `findByEmail(String email)` → `SELECT * FROM users WHERE email = ?`)
- Không cần viết SQL thủ công cho các truy vấn đơn giản
- Annotation: `@Repository`

### Entity — Đối tượng ánh xạ bảng DB

- Mỗi Entity class map với 1 bảng trong database
- Mỗi field map với 1 cột
- Quản lý bởi JPA/Hibernate (tự chuyển đổi Java object ↔ SQL row)
- Annotation: `@Entity`, `@Table`, `@Column`, `@Id`, `@GeneratedValue`

## 3. Tại sao chọn Layered Architecture?

| Ưu điểm | Giải thích |
|---|---|
| Dễ hiểu | Luồng data đi 1 chiều: Controller → Service → Repository → DB |
| Dễ test | Mock từng lớp độc lập (VD: test Service mà không cần DB thật) |
| Dễ mở rộng | Thêm module mới chỉ cần tạo package mới theo cùng cấu trúc |
| Phù hợp đồ án | Pattern phổ biến nhất, tài liệu nhiều, dễ trình bày |

| Nhược điểm | Giải thích |
|---|---|
| Có thể phình to | Khi dự án lớn, Service layer có thể rất dày |
| Boilerplate | Mỗi feature cần tạo nhiều file (Controller, Service, DTO, Entity, Repository, Mapper) |

## 4. Cross-cutting concerns (các thành phần dùng chung)

### Package `common/response/`

| Class | Tác dụng | Tại sao cần |
|---|---|---|
| `ApiResponse<T>` | Wrapper chuẩn cho mọi API response | FE chỉ cần 1 cách xử lý cho tất cả API. Format: `{success, message, data, timestamp}` |
| `PageResponse<T>` | Wrapper cho kết quả phân trang | Chứa `content`, `page`, `size`, `totalElements`, `totalPages`, `last`. Chuyển đổi từ Spring `Page<T>` |

### Package `common/exception/`

| Class | Tác dụng | Tại sao cần |
|---|---|---|
| `ErrorCode` | Enum định nghĩa các mã lỗi hệ thống | Thống nhất mã lỗi giữa BE và FE. Mỗi lỗi có code (số), message, HTTP status |
| `BusinessException` | Exception cho lỗi nghiệp vụ | Throw khi gặp lỗi logic (VD: user đã tồn tại). Khác với lỗi hệ thống (NullPointer, ...) |
| `GlobalExceptionHandler` | Bắt TẤT CẢ exception, trả về `ApiResponse.error()` | Không bao giờ để stack trace lộ ra cho client. `@RestControllerAdvice` tự động bắt |

### Package `common/config/`

| Class | Tác dụng | Tại sao cần |
|---|---|---|
| `SecurityConfig` | Cấu hình Spring Security: stateless, JWT filter, public URLs | Bảo vệ API: chỉ user có token hợp lệ mới gọi được API private |
| `CorsConfig` | Cho phép FE (port 5173) gọi BE (port 8080) | Trình duyệt mặc định chặn cross-origin request. Cần config để mở |
| `RedisConfig` | Cấu hình RedisTemplate với JSON serializer | Mặc định Redis dùng Java serialization (không đọc được). JSON dễ debug hơn |
| `OpenApiConfig` | Cấu hình Swagger UI với JWT auth | Dev có thể test API trực tiếp trên trình duyệt, không cần Postman |

### Package `security/`

| Class | Tác dụng | Tại sao cần |
|---|---|---|
| `JwtUtil` | Tạo, parse, validate JWT token | Xác thực user bằng token thay vì session (stateless, dễ scale) |
| `JwtAuthFilter` | Filter chạy trước mỗi request, kiểm tra header `Authorization: Bearer <token>` | Tự động xác thực user mà Controller không cần làm gì |
| `CustomUserDetailsService` | Load user từ DB cho Spring Security | Spring Security cần biết user có tồn tại không, role là gì |

## 5. Design Patterns đã áp dụng

| Pattern | Sử dụng ở đâu | Giải thích chi tiết |
|---|---|---|
| **DTO** | Request/Response objects (sẽ thêm ở các module sau) | Tách biệt data giữa client và entity. VD: `UserDTO` không chứa password, `UserEntity` thì có |
| **Repository** | `JpaRepository` interfaces | Trừu tượng hóa việc truy vấn DB. Code Service không cần biết dùng SQL Server hay PostgreSQL |
| **Builder** | Lombok `@Builder` trên `ApiResponse`, `PageResponse` | Tạo object phức tạp dễ đọc: `ApiResponse.builder().success(true).data(x).build()` thay vì constructor dài |
| **Filter/Interceptor** | `JwtAuthFilter` | Xử lý cross-cutting concern (xác thực) trước khi request đến Controller. Không cần viết code auth trong mỗi Controller |
| **Wrapper/Facade** | `ApiResponse<T>` | Bọc mọi response trong 1 format chuẩn. Client chỉ cần check `success` là biết thành công hay thất bại |
| **Factory** | Sẽ dùng cho Payment (module sau) | Tạo đúng loại payment processor dựa trên payment method (VNPay, Momo, ...) |
| **Strategy** | Sẽ dùng cho Pricing (module sau) | Tính giá vé khác nhau theo loại ghế, khung giờ, ngày lễ, ... |
| **Observer** | Sẽ dùng Spring Events (module sau) | Khi đặt vé thành công → gửi email, cập nhật inventory, ghi log, ... mà không coupling |

## 6. Database Migration với Liquibase

### Tại sao không dùng `ddl-auto=update`?

| | `ddl-auto=update` | Liquibase |
|---|---|---|
| Tự tạo bảng | Có, nhưng có thể xóa cột, mất data | Có, qua changelog XML rõ ràng |
| Track lịch sử | Không | Có (bảng `DATABASECHANGELOG`) |
| Rollback | Không | Có |
| Team nhiều dev | Dễ conflict | Mỗi dev tạo file changelog riêng, merge dễ |
| Production | **KHÔNG AN TOÀN** | An toàn, kiểm soát được |

### Cách hoạt động

1. Khi Backend start → Liquibase đọc `db.changelog-master.xml`
2. So sánh với bảng `DATABASECHANGELOG` trong DB (đã chạy những changeset nào?)
3. Chạy các changeset **chưa chạy** → tạo/sửa bảng
4. Ghi lại vào `DATABASECHANGELOG`

### Thêm bảng mới

1. Tạo file `db/changelog/changes/002-create-xxx-table.xml`
2. Thêm dòng `<include file="...002..."/>` vào `db.changelog-master.xml`
3. Restart Backend → Liquibase tự chạy

## 7. Authentication Flow (luồng xác thực)

### Đăng nhập

```
Client                          Backend
  │                                │
  ├─ POST /api/auth/login ────────▶│
  │  { username, password }        │
  │                                ├─ Tìm user trong DB
  │                                ├─ BCrypt.matches(password, hash)
  │                                ├─ Nếu đúng → JwtUtil.generateToken(username)
  │◀─── { token: "eyJ..." } ──────┤
  │                                │
  ├─ Lưu token vào localStorage   │
```

### Gọi API có xác thực

```
Client                          Backend
  │                                │
  ├─ GET /api/movies ─────────────▶│  Header: Authorization: Bearer eyJ...
  │                                │
  │                                ├─ JwtAuthFilter:
  │                                │   1. Lấy token từ header
  │                                │   2. JwtUtil.extractUsername(token)
  │                                │   3. UserDetailsService.loadByUsername(username)
  │                                │   4. JwtUtil.isTokenValid(token, username)
  │                                │   5. Set SecurityContext (đã xác thực)
  │                                │
  │                                ├─ Controller xử lý request
  │◀─── { success: true, data } ──┤
```

## 8. Tổ chức package theo module

```
com.cinex/
├── common/              # Dùng chung cho tất cả module
│   ├── config/          # Cấu hình: Security, CORS, Redis, OpenAPI
│   ├── exception/       # Xử lý lỗi: ErrorCode, BusinessException, GlobalExceptionHandler
│   ├── response/        # Wrapper: ApiResponse<T>, PageResponse<T>
│   └── util/            # Utility functions
├── security/            # JWT: JwtUtil, JwtAuthFilter, CustomUserDetailsService
└── module/              # Các module nghiệp vụ
    ├── health/          # [Đã tạo] Health check
    ├── auth/            # [Sẽ thêm] Đăng nhập, đăng ký, refresh token
    ├── user/            # [Sẽ thêm] Quản lý user, profile
    ├── movie/           # [Sẽ thêm] Quản lý phim, thể loại
    ├── showtime/        # [Sẽ thêm] Suất chiếu
    ├── room/            # [Sẽ thêm] Phòng chiếu
    ├── seat/            # [Sẽ thêm] Ghế ngồi, sơ đồ ghế
    ├── booking/         # [Sẽ thêm] Đặt vé
    └── payment/         # [Sẽ thêm] Thanh toán (VNPay, Momo, ...)
```

### Cấu trúc bên trong mỗi module

```
module/movie/
├── controller/
│   └── MovieController.java      # Nhận request, gọi service
├── service/
│   └── MovieService.java         # Logic nghiệp vụ
├── dto/
│   ├── MovieRequest.java         # Data từ client gửi lên (có validation)
│   └── MovieResponse.java        # Data trả về cho client (không chứa field nhạy cảm)
├── entity/
│   └── Movie.java                # Map với bảng movies trong DB
├── repository/
│   └── MovieRepository.java      # Interface truy vấn DB
└── mapper/
    └── MovieMapper.java          # MapStruct: chuyển Entity ↔ DTO tự động
```

### Quy tắc khi thêm feature mới

1. Tạo package `module/{tên_module}/` theo cấu trúc trên
2. Tạo Entity → tạo file Liquibase changelog (KHÔNG dùng ddl-auto)
3. Tạo DTO với validation (`@NotBlank`, `@Email`, `@Size`, ...)
4. Tạo Repository (extend JpaRepository)
5. Tạo Service (logic nghiệp vụ)
6. Tạo Controller (gọi Service, trả `ApiResponse`)
7. Tạo Mapper (MapStruct interface)
