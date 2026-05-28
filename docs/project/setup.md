# Hướng dẫn Setup CineX

## 1. Yêu cầu hệ thống

| Công cụ          | Phiên bản | Tác dụng                                      |
|-------------------|-----------|-----------------------------------------------|
| Java (JDK)        | 21+       | Biên dịch và chạy Backend Spring Boot          |
| Node.js           | 20+       | Chạy Frontend React + Vite                     |
| Docker            | 24+       | Chạy SQL Server, Redis trong container          |
| Docker Compose    | 2.x       | Quản lý nhiều container cùng lúc               |
| Git               | 2.x       | Quản lý source code                            |

### Kiểm tra đã cài chưa

```bash
java --version        # → openjdk 21.x.x
node --version        # → v20.x.x hoặc cao hơn
docker --version      # → Docker version 24.x+
docker compose version # → Docker Compose version v2.x
git --version         # → git version 2.x
```

---

## 2. Quick Start — Clone và chạy lần đầu (5 phút)

```bash
# 1. Clone project
git clone <repository-url>
cd cinex

# 2. Chạy database + Redis
docker compose up sqlserver redis -d

# 3. Chờ SQL Server khởi động (~10 giây), rồi tạo database
docker exec cinex-sqlserver-1 /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P 'CineX@2026' -C \
  -Q "CREATE DATABASE cinex"

# 4. Chạy Backend
cd backend
./gradlew bootRun
# Chờ thấy: "Started CineXApplication in x.x seconds"
# Mở tab terminal mới ↓

# 5. Chạy Frontend (terminal mới)
cd frontend
npm install
npm run dev
# Mở: http://localhost:5173

# 6. Kiểm tra
# Backend health: http://localhost:8088/api/health
# Swagger UI:     http://localhost:8088/swagger-ui/index.html
# Frontend:       http://localhost:5173
```

> **Lưu ý:** Bước 3 chỉ cần chạy 1 LẦN DUY NHẤT. Từ lần sau chỉ cần bước 2, 4, 5.

---

## 3. Cách chạy từng phần (chi tiết)

### 3.1 Chạy database và Redis bằng Docker

```bash
docker compose up sqlserver redis -d
```

- SQL Server chạy tại `localhost:1433` (user: `sa`, password: `CineX@2026`)
- Redis chạy tại `localhost:6379`

**Tạo database lần đầu:**

```bash
docker exec cinex-sqlserver-1 /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P 'CineX@2026' -C \
  -Q "CREATE DATABASE cinex"
```

Hoặc dùng SQL Server Management Studio / Azure Data Studio kết nối `localhost:1433` rồi chạy `CREATE DATABASE cinex`.

### 3.2 Chạy Backend

```bash
cd backend

# Build (bỏ qua test)
./gradlew clean build -x test

# Chạy server
./gradlew bootRun
```

Sau khi chạy thành công:
- Health check: `http://localhost:8088/api/health` → trả về `{"success":true,"message":"OK","data":"UP"}`
- Swagger UI: `http://localhost:8088/swagger-ui/index.html` → giao diện test API trực quan

### 3.3 Chạy Frontend

```bash
cd frontend
npm install        # cài dependencies lần đầu
npm run dev        # chạy dev server
```

Frontend chạy tại `http://localhost:5173`.

### 3.4 Chạy full stack với Docker Compose

```bash
docker-compose up --build
```

4 services sẽ được build và chạy: SQL Server, Redis, Backend, Frontend.

## 4. Cách reset DB / chạy lại Liquibase

```bash
# Bước 1: Xóa toàn bộ volume (xóa sạch data SQL Server)
docker-compose down -v

# Bước 2: Chạy lại
docker-compose up sqlserver redis -d
```

Khi Backend start lại, Liquibase tự động tạo lại tất cả bảng từ đầu.

## 5. Cách test API qua Swagger

1. Chạy Backend (mục 2.2)
2. Mở `http://localhost:8088/swagger-ui/index.html`
3. API public (không cần token): `/api/health`
4. API cần xác thực: Click nút **"Authorize"** ở góc phải → nhập `Bearer <token>` → Click "Authorize"

## 6. Cấu trúc thư mục và giải thích chi tiết từng file

### 6.1 Backend

```
backend/
├── build.gradle                          # Cấu hình Gradle
├── settings.gradle                       # Tên project cho Gradle
├── gradlew / gradlew.bat                 # Script chạy Gradle (Linux/Mac / Windows)
├── gradle/wrapper/                       # Gradle wrapper (tự download Gradle đúng version)
├── Dockerfile                            # Build Docker image cho Backend
└── src/main/
    ├── java/com/cinex/
    │   ├── CineXApplication.java     # Điểm khởi chạy
    │   ├── common/
    │   │   ├── config/
    │   │   │   ├── SecurityConfig.java   # Cấu hình bảo mật
    │   │   │   ├── CorsConfig.java       # Cấu hình CORS
    │   │   │   ├── RedisConfig.java      # Cấu hình Redis
    │   │   │   └── OpenApiConfig.java    # Cấu hình Swagger
    │   │   ├── exception/
    │   │   │   ├── ErrorCode.java        # Enum mã lỗi
    │   │   │   ├── BusinessException.java # Exception nghiệp vụ
    │   │   │   └── GlobalExceptionHandler.java # Bắt exception toàn cục
    │   │   └── response/
    │   │       ├── ApiResponse.java      # Wrapper response chuẩn
    │   │       └── PageResponse.java     # Wrapper phân trang
    │   ├── security/
    │   │   ├── JwtUtil.java              # Tạo/parse/validate JWT
    │   │   ├── JwtAuthFilter.java        # Filter kiểm tra token mỗi request
    │   │   └── CustomUserDetailsService.java # Load user từ DB
    │   └── module/
    │       └── health/
    │           └── HealthController.java # API kiểm tra hệ thống
    └── resources/
        ├── application.yml               # Config chung
        ├── application-dev.yml           # Config cho môi trường dev
        └── db/changelog/
            ├── db.changelog-master.xml   # File gốc Liquibase
            └── changes/
                └── 001-create-users-table.xml  # Tạo bảng users
```

### 6.2 Frontend

```
frontend/
├── package.json              # Dependencies và scripts
├── vite.config.ts            # Cấu hình Vite + Tailwind plugin
├── tsconfig.json             # Cấu hình TypeScript
├── index.html                # File HTML gốc (Vite inject JS vào đây)
├── .env.development          # Biến môi trường dev
├── .prettierrc               # Cấu hình format code
├── Dockerfile                # Build Docker image cho Frontend
├── nginx.conf                # Cấu hình Nginx (dùng khi chạy Docker)
└── src/
    ├── main.tsx              # Điểm khởi chạy React
    ├── App.tsx               # Root component
    ├── index.css             # Import Tailwind CSS
    ├── api/
    │   └── axios.ts          # Axios instance + JWT interceptor
    ├── features/
    │   └── home/
    │       └── HomePage.tsx  # Trang chủ
    ├── routes/
    │   └── AppRouter.tsx     # Cấu hình React Router
    ├── store/
    │   └── authStore.ts      # Zustand store quản lý auth
    ├── components/           # Components dùng chung (thêm sau)
    ├── hooks/                # Custom hooks (thêm sau)
    ├── types/                # TypeScript types (thêm sau)
    └── utils/                # Utility functions (thêm sau)
```

## 7. Giải thích chi tiết từng file Backend

### `build.gradle` — Cấu hình dependencies

| Dependency | Tác dụng |
|---|---|
| `spring-boot-starter-web` | Tạo REST API (nhúng Tomcat, xử lý HTTP request/response) |
| `spring-boot-starter-data-jpa` | ORM - map Java object với bảng DB, tự sinh SQL |
| `spring-boot-starter-security` | Bảo mật: xác thực, phân quyền, mã hóa password |
| `spring-boot-starter-validation` | Validate input (`@NotBlank`, `@Email`, `@Size`, ...) |
| `spring-boot-starter-data-redis` | Kết nối Redis để cache dữ liệu |
| `mssql-jdbc` | Driver kết nối SQL Server |
| `liquibase-core` | Quản lý version schema DB (tạo/sửa bảng bằng XML, không dùng ddl-auto) |
| `jjwt-api/impl/jackson` | Thư viện JWT: tạo token, parse token, verify chữ ký |
| `mapstruct` | Tự động sinh code chuyển đổi Entity ↔ DTO (giảm boilerplate) |
| `lombok` | Tự sinh getter/setter/constructor/builder (giảm boilerplate) |
| `lombok-mapstruct-binding` | Cho Lombok và MapStruct hoạt động cùng nhau khi compile |
| `spring-boot-starter-mail` | Gửi email (xác nhận vé, reset password, thông báo) |
| `cloudinary-http5` | Upload + quản lý ảnh trên cloud (poster phim, avatar user) |
| `zxing-core` + `zxing-javase` | Sinh QR code dạng ảnh (nhúng vào email vé, export PDF) |
| `springdoc-openapi-starter-webmvc-ui` | Tự sinh Swagger UI từ code, test API trên trình duyệt |
| `spring-boot-starter-test` | JUnit 5 + Mockito để viết unit test |
| `spring-security-test` | Hỗ trợ test với Spring Security (mock user, mock auth) |
| `testcontainers:mssqlserver` | Chạy SQL Server thật trong Docker khi test (integration test) |

### `CineXApplication.java` — Điểm khởi chạy

```java
@SpringBootApplication   // = @Configuration + @EnableAutoConfiguration + @ComponentScan
                          // Spring tự quét tất cả class trong package com.cinex.*
                          // và tự cấu hình dựa trên dependencies có trong classpath
```

### `application.yml` — Config chung

```yaml
spring.profiles.active: dev     # Dùng profile "dev" → load thêm application-dev.yml
server.port: 8088               # Backend lắng nghe ở port 8088
app.jwt.secret: ${JWT_SECRET:...}   # Khóa ký JWT, đọc từ env var JWT_SECRET
                                    # Nếu không có env var → dùng giá trị mặc định (chỉ cho dev)
app.jwt.expiration-ms: ${JWT_EXPIRATION:86400000}  # Token hết hạn sau 24h (86400000ms)
```

### `application-dev.yml` — Config môi trường dev

```yaml
spring.datasource.url: jdbc:sqlserver://...   # URL kết nối SQL Server
    # ${DB_HOST:localhost} → đọc env var DB_HOST, mặc định là localhost
    # encrypt=false → tắt mã hóa SSL (chỉ cho dev)
    # trustServerCertificate=true → bỏ qua verify SSL cert

spring.jpa.hibernate.ddl-auto: validate
    # QUAN TRỌNG: "validate" = Hibernate CHỈ kiểm tra schema khớp với Entity
    # KHÔNG tự tạo/sửa bảng. Việc tạo bảng do Liquibase đảm nhiệm
    # Tại sao? Vì ddl-auto=update không an toàn: có thể xóa cột, mất data

spring.jpa.show-sql: true       # In ra câu SQL trong log (debug)
spring.jpa.properties.hibernate.format_sql: true  # Format SQL cho dễ đọc

spring.liquibase.change-log: classpath:db/changelog/db.changelog-master.xml
    # Liquibase đọc file này khi start → chạy các migration chưa chạy

spring.data.redis.host/port     # Kết nối Redis server
```

### `SecurityConfig.java` — Cấu hình bảo mật

```java
.csrf(disable)                  // Tắt CSRF vì dùng JWT (stateless), không dùng cookie session
.sessionManagement(STATELESS)   // Không tạo session trên server, mỗi request tự mang token

// URL public — không cần token
.requestMatchers("/api/health").permitAll()
.requestMatchers("/api/auth/**").permitAll()
.requestMatchers("/swagger-ui/**", "/v3/api-docs/**").permitAll()

// Chỉ GET public (xem phim, phòng, suất chiếu) — POST/PUT/DELETE cần auth
.requestMatchers(HttpMethod.GET, "/api/movies/**").permitAll()
.requestMatchers(HttpMethod.GET, "/api/genres/**").permitAll()
.requestMatchers(HttpMethod.GET, "/api/rooms/**").permitAll()
.requestMatchers(HttpMethod.GET, "/api/showtimes/**").permitAll()

.anyRequest().authenticated()   // Còn lại cần JWT token

.addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
    // JwtAuthFilter chạy TRƯỚC mỗi request → extract + verify token

// Annotations bật thêm:
// @EnableMethodSecurity → cho phép @PreAuthorize("hasRole('ADMIN')") trên method
// @EnableScheduling → cho phép @Scheduled cleanup expired bookings
// @EnableAsync → cho phép @Async gửi email không block response
```

### `JwtUtil.java` — Xử lý JWT token

```java
generateToken(username, extraClaims)
    // Tạo JWT token chứa: subject=username, thời gian tạo, thời gian hết hạn
    // Ký bằng HMAC-SHA với secret key (Base64 decode từ config)

extractUsername(token)
    // Parse token → lấy ra username (subject)

isTokenValid(token, username)
    // Kiểm tra: username trong token khớp + token chưa hết hạn

getSigningKey()
    // Decode Base64 secret → tạo SecretKey cho HMAC-SHA
```

### `JwtAuthFilter.java` — Filter kiểm tra token mỗi request

```
Chạy 1 lần cho mỗi request (OncePerRequestFilter). Luồng xử lý:

1. Lấy header "Authorization"
2. Nếu không có hoặc không bắt đầu bằng "Bearer " → bỏ qua, cho đi tiếp
3. Cắt "Bearer " → lấy token
4. Parse token → lấy username
5. Load user từ DB (qua UserDetailsService)
6. Nếu token hợp lệ → set Authentication vào SecurityContext
   → các filter sau và Controller biết user đã đăng nhập
7. Gọi filterChain.doFilter() → cho request đi tiếp
```

### `CorsConfig.java` — Cho phép Frontend gọi API

```java
setAllowedOrigins("http://localhost:5173")  // Chỉ cho phép FE ở port 5173 gọi API
setAllowedMethods(GET, POST, PUT, DELETE, PATCH, OPTIONS)  // Các HTTP method được phép
setAllowedHeaders("*")          // Cho phép tất cả headers (bao gồm Authorization)
setAllowCredentials(true)       // Cho phép gửi cookie/auth header cross-origin
// Nếu KHÔNG có config này → trình duyệt sẽ chặn FE gọi API (lỗi CORS)
```

### `RedisConfig.java` — Cấu hình Redis

```java
RedisTemplate<String, Object>
    // Template để đọc/ghi data vào Redis
    // Key serializer: StringRedisSerializer → key lưu dạng string thuần
    // Value serializer: GenericJackson2JsonRedisSerializer → value lưu dạng JSON
    // Tác dụng: cache session, cache data thường xuyên truy vấn (phim, suất chiếu, ...)
```

### `OpenApiConfig.java` — Cấu hình Swagger UI

```java
.info(title, version, description)   // Thông tin hiển thị trên Swagger UI
.addSecurityItem("Bearer")           // Thêm nút "Authorize" trên Swagger
.addSecuritySchemes("Bearer", HTTP/bearer/JWT)
    // Khi click Authorize → nhập token → Swagger tự gắn header Authorization
    // cho tất cả request test trên UI
```

### `ApiResponse.java` — Wrapper response chuẩn

```json
// Mọi API đều trả về cùng 1 format:
{
  "success": true,             // Thành công hay thất bại
  "message": "OK",             // Mô tả kết quả
  "data": { ... },             // Dữ liệu trả về (generic type T)
  "timestamp": "2026-05-09..." // Thời điểm response
}
```

- Tại sao cần? → FE chỉ cần 1 cách xử lý duy nhất cho tất cả API
- `@JsonInclude(NON_NULL)` → nếu data=null thì không hiện trong JSON (gọn hơn)

### `GlobalExceptionHandler.java` — Bắt exception toàn cục

```
@RestControllerAdvice → Spring tự gọi khi có exception xảy ra trong Controller

handleBusinessException     → Bắt lỗi nghiệp vụ (VD: "Tài khoản đã tồn tại")
handleValidation            → Bắt lỗi validate input (VD: "email: không được để trống")
handleConstraintViolation   → Bắt lỗi constraint (VD: "@Size(max=50)")
handleGeneral               → Bắt tất cả lỗi còn lại → trả "Lỗi không xác định"

Tại sao cần? → Không bao giờ để stack trace lộ ra cho client (bảo mật)
```

### `ErrorCode.java` — Enum mã lỗi

| Enum              | Code | HTTP Status | Ý nghĩa                    |
|-------------------|------|-------------|-----------------------------|
| UNCATEGORIZED     | 9999 | 500         | Lỗi không xác định          |
| INVALID_REQUEST   | 1000 | 400         | Request không hợp lệ         |
| UNAUTHORIZED      | 1001 | 401         | Chưa đăng nhập              |
| FORBIDDEN         | 1002 | 403         | Không có quyền              |
| NOT_FOUND         | 1003 | 404         | Không tìm thấy tài nguyên    |
| USER_EXISTED      | 1004 | 409         | Tài khoản đã tồn tại         |
| USER_NOT_FOUND    | 1005 | 404         | Không tìm thấy tài khoản     |
| INVALID_CREDENTIALS | 1006 | 401       | Sai tài khoản hoặc mật khẩu  |

### Liquibase — `001-create-users-table.xml`

Tạo bảng `users` với các cột:

| Cột        | Kiểu          | Mô tả                                  |
|------------|---------------|----------------------------------------|
| id         | BIGINT, PK    | Khóa chính, tự tăng                     |
| username   | NVARCHAR(50)  | Tên đăng nhập, UNIQUE                   |
| email      | NVARCHAR(100) | Email, UNIQUE                           |
| password   | NVARCHAR(255) | Hash BCrypt (KHÔNG lưu plain text)       |
| role       | NVARCHAR(20)  | Vai trò, mặc định 'USER'                |
| created_at | DATETIME2     | Ngày tạo, mặc định GETDATE()            |
| updated_at | DATETIME2     | Ngày cập nhật, mặc định GETDATE()        |

**Tại sao dùng Liquibase thay vì ddl-auto=update?**
1. Track được lịch sử thay đổi schema (ai sửa gì, khi nào)
2. Có thể rollback khi cần
3. Nhiều dev cùng làm không conflict schema
4. An toàn cho production (ddl-auto=update có thể xóa cột, mất data)

## 8. Frontend Dependencies — Giải thích từng thư viện

### Runtime Dependencies (chạy trong production)

| Thư viện | Version | Tác dụng |
|---|---|---|
| `react` | ^19.2.5 | UI framework — component-based, virtual DOM |
| `react-dom` | ^19.2.5 | Render React component lên trình duyệt (DOM) |
| `react-router-dom` | ^7.15.0 | Routing phía client — chuyển trang không reload |
| `@tanstack/react-query` | ^5.100.9 | Quản lý server state — fetch, cache, refetch tự động |
| `zustand` | ^5.0.13 | Quản lý client state (auth token, UI state) — nhẹ hơn Redux |
| `axios` | ^1.16.0 | HTTP client — tạo request, interceptor gắn JWT tự động |
| `react-hook-form` | ^7.75.0 | Quản lý form — giảm re-render, validation, error handling |
| `@hookform/resolvers` | ^5.2.2 | Cầu nối react-hook-form + Zod (schema validation) |
| `zod` | ^4.4.3 | Schema validation — khai báo rule validate 1 chỗ, dùng cho form + API |
| `sonner` | ^2.0.7 | Toast notification — hiển thị thông báo success/error/info dạng popup |
| `class-variance-authority` | ^0.7.1 | Tạo variant CSS cho component (VD: Button có 6 variant + 3 size) |
| `clsx` | ^2.1.1 | Gộp className có điều kiện: `clsx('btn', isActive && 'active')` |
| `tailwind-merge` | ^3.6.0 | Merge Tailwind class thông minh — loại bỏ conflict (VD: `p-2 p-4` → `p-4`) |
| `lucide-react` | ^1.16.0 | Bộ icon SVG — nhẹ, tree-shakable, 1500+ icon |
| `react-qr-code` | latest | Render QR code trên màn hình (vé điện tử, check-in) |
| `recharts` | latest | Biểu đồ thống kê cho Admin Dashboard (bar, line, pie chart) |

### Dev Dependencies (chỉ dùng khi phát triển)

| Thư viện | Version | Tác dụng |
|---|---|---|
| `vite` | ^8.0.10 | Build tool siêu nhanh — dev server HMR, bundle production |
| `@vitejs/plugin-react` | ^6.0.1 | Vite plugin cho React — Fast Refresh (sửa code thấy ngay) |
| `tailwindcss` | ^4.2.4 | CSS framework utility-first — viết class thay vì viết CSS |
| `@tailwindcss/vite` | ^4.2.4 | Tailwind v4 tích hợp Vite (không cần postcss.config riêng) |
| `typescript` | ~6.0.2 | Type safety — phát hiện lỗi lúc code, không cần chạy |
| `@types/react` | ^19.2.14 | TypeScript definitions cho React API |
| `@types/react-dom` | ^19.2.3 | TypeScript definitions cho React DOM |
| `@types/node` | ^24.12.4 | TypeScript definitions cho Node.js (`path` dùng trong vite.config) |
| `eslint` | ^10.2.1 | Linter — phát hiện lỗi logic, code smell |
| `typescript-eslint` | ^8.58.2 | ESLint rules dành riêng cho TypeScript |
| `eslint-plugin-react-hooks` | ^7.1.1 | Kiểm tra rules of hooks (deps array, gọi đúng chỗ) |
| `eslint-plugin-react-refresh` | ^0.5.2 | Đảm bảo HMR hoạt động đúng (component export) |
| `eslint-config-prettier` | ^10.1.8 | Tắt ESLint rules xung đột với Prettier |
| `eslint-plugin-prettier` | ^5.5.5 | Chạy Prettier như một rule ESLint |
| `prettier` | ^3.8.3 | Code formatter — đồng bộ style code trong team |
| `globals` | ^17.5.0 | Khai báo biến global cho ESLint config |

### Hàm tiện ích `cn()` — Kết hợp clsx + tailwind-merge

```ts
// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Cách dùng:
cn("px-4 py-2", isActive && "bg-blue-500", className)
// → gộp class, loại bỏ conflict, bỏ qua giá trị false/undefined
```

### Sonner — Toast notification

```tsx
// Khai báo 1 lần trong App.tsx:
import { Toaster } from "@/components/ui/sonner";
<Toaster position="top-right" richColors duration={3000} />

// Gọi bất kỳ đâu trong app:
import { toast } from "sonner";
toast.success("Đăng ký thành công!");
toast.error("Email đã tồn tại");
toast.info("Đang xử lý...");
```

---

## 9. Giải thích chi tiết từng file Frontend

### `vite.config.ts` — Cấu hình Vite

```ts
plugins: [react(), tailwindcss()]
// react()       → plugin biên dịch JSX/TSX thành JS
// tailwindcss() → plugin Tailwind CSS v4 (xử lý utility classes)
// server.port: 5173 → dev server chạy ở port 5173
```

### `axios.ts` — HTTP client + JWT interceptor

```ts
baseURL: import.meta.env.VITE_API_BASE_URL
// Đọc biến môi trường từ .env.development → "http://localhost:8088"

// Request interceptor:
// Trước MỖI request gửi đi → lấy token từ localStorage → gắn vào header
// Authorization: Bearer eyJhbGciOiJIUzI1...

// Response interceptor:
// Nếu server trả 401 (Unauthorized) → xóa token → redirect về /login
// Tại sao? → token hết hạn hoặc bị revoke, buộc user login lại
```

### `App.tsx` — Root component

```tsx
<QueryClientProvider client={queryClient}>  // Cung cấp TanStack Query context
  <AppRouter />                              // Render router
</QueryClientProvider>

// QueryClient config:
// retry: 1         → nếu API lỗi, thử lại 1 lần (tổng 2 lần)
// refetchOnWindowFocus: false → KHÔNG tự gọi lại API khi user quay lại tab
```

### `authStore.ts` — Zustand store

```ts
// Quản lý trạng thái đăng nhập:
token: string | null     // JWT token hiện tại
setToken(token)          // Lưu token vào state + localStorage
logout()                 // Xóa token khỏi state + localStorage

// Tại sao dùng Zustand? → Nhẹ hơn Redux, không cần boilerplate (action/reducer/dispatch)
// Tại sao lưu localStorage? → Giữ login khi refresh trang
```

## 10. Các biến môi trường

### Backend

| Biến           | Mô tả                          | Mặc định           | Dùng ở đâu                |
|----------------|----------------------------------|---------------------|----------------------------|
| DB_HOST        | SQL Server host                  | localhost           | application-dev.yml        |
| DB_PORT        | SQL Server port                  | 1433                | application-dev.yml        |
| DB_NAME        | Tên database                     | cinex          | application-dev.yml        |
| DB_USERNAME    | DB username                      | sa                  | application-dev.yml        |
| DB_PASSWORD    | DB password                      | CineX@2026      | application-dev.yml        |
| REDIS_HOST     | Redis host                       | localhost           | application-dev.yml        |
| REDIS_PORT     | Redis port                       | 6379                | application-dev.yml        |
| JWT_SECRET     | Khóa ký JWT (Base64)             | (dev default)       | application.yml            |
| JWT_EXPIRATION | Thời gian sống token (ms)        | 86400000 (24 giờ)   | application.yml            |
| MAIL_HOST      | SMTP server                      | sandbox.smtp.mailtrap.io | application-dev.yml   |
| MAIL_PORT      | SMTP port                        | 2525                | application-dev.yml        |
| MAIL_USERNAME  | SMTP username                    | (đăng ký Mailtrap)  | application-dev.yml        |
| MAIL_PASSWORD  | SMTP password                    | (đăng ký Mailtrap)  | application-dev.yml        |
| CLOUDINARY_CLOUD_NAME | Cloudinary cloud name     | (đăng ký free)      | application-dev.yml        |
| CLOUDINARY_API_KEY    | Cloudinary API key        | (từ dashboard)      | application-dev.yml        |
| CLOUDINARY_API_SECRET | Cloudinary API secret     | (từ dashboard)      | application-dev.yml        |

> **Lưu ý:** Mail + Cloudinary chưa cần config ngay khi mới clone. Chỉ cần khi làm đến task upload ảnh (005) hoặc gửi email (009). Backend vẫn chạy bình thường nếu chưa config.

### Frontend

| Biến               | Mô tả           | Mặc định               | Dùng ở đâu           |
|--------------------|------------------|-------------------------|-----------------------|
| VITE_API_BASE_URL  | URL Backend API  | http://localhost:8088   | .env.development      |

## 11. Docker

### `docker-compose.yml` — 4 services

| Service    | Image                            | Port     | Tác dụng                        |
|------------|----------------------------------|----------|----------------------------------|
| sqlserver  | mcr.microsoft.com/mssql/server:2022-latest | 1433     | Database chính                   |
| redis      | redis:7-alpine                   | 6379     | Cache                            |
| backend    | Build từ `./backend/Dockerfile`  | 8080     | Spring Boot API server           |
| frontend   | Build từ `./frontend/Dockerfile` | 5173→80  | React app phục vụ qua Nginx      |

### `backend/Dockerfile` — Multi-stage build

```
Stage 1 (build): Dùng JDK 21 (có compiler)
  → Copy gradle wrapper + build.gradle trước → tận dụng Docker cache cho dependencies
  → Copy source code → build ra file JAR

Stage 2 (run): Dùng JRE 21 (nhẹ hơn, không có compiler)
  → Chỉ copy file JAR từ stage 1 → image nhỏ gọn hơn nhiều
```

### `frontend/Dockerfile` — Multi-stage build

```
Stage 1 (build): Dùng Node 20
  → npm ci → cài dependencies
  → npm run build → tạo static files trong dist/

Stage 2 (serve): Dùng Nginx
  → Copy dist/ vào Nginx → phục vụ static files
  → Copy nginx.conf → cấu hình proxy /api/ sang backend
```

### `nginx.conf` — Cấu hình Nginx cho Frontend

```nginx
location / {
    try_files $uri $uri/ /index.html;
    # Single Page App: mọi route đều trả về index.html
    # React Router xử lý routing phía client
}

location /api/ {
    proxy_pass http://backend:8080;
    # Proxy request /api/* sang Backend container
    # "backend" là tên service trong docker-compose
}
```

## 12. CI/CD — GitHub Actions

### `.github/workflows/ci.yml`

Trigger: push hoặc PR vào branch `main`

**Job `backend-ci`:**
1. Checkout code
2. Setup Java 21 (có cache Gradle)
3. `chmod +x gradlew`
4. `./gradlew build` → compile + chạy test

**Job `frontend-ci`:**
1. Checkout code
2. Setup Node 20 (có cache npm)
3. `npm ci` → cài dependencies
4. `npm run lint` → kiểm tra code style
5. `npm run build` → build production

## 13. Xử lý lỗi thường gặp

### Lỗi kết nối SQL Server
- Kiểm tra SQL Server đã chạy: `docker ps | grep sqlserver`
- Kiểm tra password đủ độ phức tạp (>=8 ký tự, có hoa/thường/số/ký tự đặc biệt)
- Kiểm tra đã tạo database `cinex` chưa
- Kiểm tra biến `DB_HOST`, `DB_PORT` đúng

### Lỗi Liquibase
- "table already exists": xóa DB và chạy lại (mục 3)
- Kiểm tra file XML changelog không bị lỗi cú pháp
- Liquibase tự tạo 2 bảng quản lý: `DATABASECHANGELOG` và `DATABASECHANGELOGLOCK`

### Lỗi JWT
- "JWT signature does not match": `JWT_SECRET` khác nhau giữa nơi tạo và nơi verify
- "Token expired": token hết hạn, login lại để lấy token mới

### Lỗi CORS
- Frontend phải chạy trên `http://localhost:5173` (đã cấu hình trong CorsConfig)
- Nếu đổi port FE → sửa `CorsConfig.java` dòng `setAllowedOrigins`

### Lỗi build Frontend
- Xóa `node_modules` và `package-lock.json`, chạy lại `npm install`
- Kiểm tra Node version >= 20: `node --version`

### Lỗi MapStruct
- Kiểm tra `annotationProcessor` đã khai báo cả 3: lombok, mapstruct-processor, lombok-mapstruct-binding
- Thứ tự quan trọng: lombok phải khai báo trước mapstruct
