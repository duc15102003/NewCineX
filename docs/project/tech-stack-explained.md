# CineX — Tổng hợp Công nghệ Sử dụng (Chi tiết)

> Đọc xong tài liệu này, bạn có thể tự xây dựng 1 dự án tương tự từ đầu.
> Mỗi công nghệ đều giải thích: Nó là gì? Tại sao dùng? Dùng ở đâu? Cách hoạt động?

---

## MỤC LỤC

1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [Backend — Java + Spring Boot](#2-backend--java--spring-boot)
3. [Database — SQL Server + JPA/Hibernate](#3-database--sql-server--jpahibernate)
4. [Bảo mật — Spring Security + JWT](#4-bảo-mật--spring-security--jwt)
5. [Cache — Redis](#5-cache--redis)
6. [Thời gian thực — WebSocket + STOMP](#6-thời-gian-thực--websocket--stomp)
7. [Email — Spring Mail + Mailtrap](#7-email--spring-mail--mailtrap)
8. [Upload ảnh — Cloudinary](#8-upload-ảnh--cloudinary)
9. [Mã QR — ZXing](#9-mã-qr--zxing)
10. [API Docs — Swagger/OpenAPI](#10-api-docs--swaggeropenapi)
11. [Database Migration — Liquibase](#11-database-migration--liquibase)
12. [Code Generation — Lombok + MapStruct](#12-code-generation--lombok--mapstruct)
13. [JPA Auditing — Tự động ghi nhật ký thay đổi](#13-jpa-auditing--tự-động-ghi-nhật-ký-thay-đổi)
14. [Build Tool — Gradle](#14-build-tool--gradle)
15. [Frontend — React + TypeScript + Vite](#15-frontend--react--typescript--vite)
16. [State Management — TanStack Query + Zustand](#16-state-management--tanstack-query--zustand)
17. [UI — Tailwind CSS + shadcn/ui](#17-ui--tailwind-css--shadcnui)
18. [Form — React Hook Form + Zod](#18-form--react-hook-form--zod)
19. [HTTP Client — Axios](#19-http-client--axios)
20. [Biểu đồ — Recharts](#20-biểu-đồ--recharts)
21. [Xuất báo cáo — jsPDF + SheetJS](#21-xuất-báo-cáo--jspdf--sheetjs)
22. [POS — Bán hàng tại quầy (SnackOrder)](#22-pos--bán-hàng-tại-quầy-snackorder)
23. [Voucher — Mã giảm giá](#23-voucher--mã-giảm-giá)
24. [Containerization — Docker](#24-containerization--docker)
25. [Testing — JUnit + Testcontainers](#25-testing--junit--testcontainers)
26. [Design Patterns — Tổng hợp](#26-design-patterns--tổng-hợp)
27. [Sơ đồ tổng thể](#27-sơ-đồ-tổng-thể)
28. [Thanh toán MoMo Sandbox](#28-thanh-toán-momo-sandbox)
29. [POS Bán vé tại quầy](#29-pos-bán-vé-tại-quầy)
30. [Ghế hỏng (BROKEN)](#30-ghế-hỏng-broken)
31. [Cấu hình động (System Config)](#31-cấu-hình-động-system-config)
32. [Phim "Đang chiếu" theo suất chiếu thực tế](#32-phim-đang-chiếu-theo-suất-chiếu-thực-tế)

---

## 1. Tổng quan kiến trúc

### Kiến trúc tổng thể

```
                         Internet
                            |
                    +-------+-------+
                    |   Frontend    |
                    |  React + TS   |
                    |  Vite (5173)  |
                    +-------+-------+
                            |
                      HTTP / WebSocket
                            |
                    +-------+-------+
                    |   Backend     |
                    | Spring Boot   |
                    |  Java (8088)  |
                    +-------+-------+
                       /    |    \
                      /     |     \
              +------+ +----+---+ +----------+
              |  SQL | | Redis  | | Cloudinary|
              |Server| | Cache  | | (Ảnh)    |
              |(1433)| | (6379) | | (Cloud)  |
              +------+ +--------+ +----------+
```

### Tại sao chọn kiến trúc này?

| Thành phần | Lý do chọn | Thay thế được bởi |
|---|---|---|
| Java 21 | An toàn kiểu, hiệu năng cao, hệ sinh thái lớn | Kotlin, Go |
| Spring Boot 3.3.5 | Framework phổ biến nhất Java, nhiều thư viện sẵn | Quarkus, Micronaut |
| React 19 | Thư viện UI phổ biến nhất, cộng đồng lớn | Vue.js, Angular, Svelte |
| TypeScript | An toàn kiểu cho JavaScript, bắt lỗi sớm | JavaScript (thiếu type safety) |
| SQL Server | Database quan hệ mạnh, hợp doanh nghiệp | PostgreSQL, MySQL |
| Redis | Cache nhanh nhất (in-memory), hỗ trợ TTL | Memcached, Caffeine |
| Docker | Đóng gói và triển khai nhất quán | Podman, native install |

---

## 2. Backend — Java + Spring Boot

### Java 21 — Ngôn ngữ chính

**Java là gì?**
Ngôn ngữ lập trình hướng đối tượng (OOP), chạy trên JVM (Java Virtual Machine).
Code Java được compile thành bytecode -> JVM đọc và thực thi -> chạy trên mọi hệ điều hành.

**Tại sao Java 21?**
- **Long-Term Support (LTS)**: Được hỗ trợ lâu dài (đến 2029)
- **Tính năng mới**: Virtual threads, pattern matching, sealed classes
- **An toàn kiểu mạnh**: Compiler bắt lỗi trước khi chạy (khác JavaScript)
- **Hệ sinh thái**: 10+ triệu lập trình viên, hàng ngàn thư viện

**Phiên bản trong dự án:**
```groovy
// build.gradle
java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}
```

### Spring Boot 3.3.5 — Framework chính

**Spring Boot là gì?**
Framework giúp xây dựng ứng dụng Java nhanh chóng. Nó tự động cấu hình (auto-configuration) mọi thứ bạn cần: web server, database, security, ...

**Ví dụ đời thường:** Spring Boot giống như **căn hộ cho thuê đã nội thất đầy đủ**. Bạn chỉ cần dọn đồ vào ở (viết business logic), không cần tự lắp đặt điện nước (cấu hình web server, database connection, ...).

**Khác với Spring thường:** Spring thường = nhà thô, bạn phải tự làm mọi thứ. Spring Boot = căn hộ, mọi thứ đã sẵn, bạn chỉ cần tùy chỉnh.

**Auto-configuration hoạt động thế nào?**
```java
@SpringBootApplication  // 3 annotation gộp lại:
// @Configuration     — Khai báo này là class cấu hình
// @EnableAutoConfiguration — Tự detect và cấu hình thư viện
// @ComponentScan     — Quét tất cả @Component, @Service, @Repository, @Controller
public class CinexApplication {
    public static void main(String[] args) {
        SpringApplication.run(CinexApplication.class, args);
        // Spring tự động:
        // 1. Tạo web server (Tomcat) trên port 8088
        // 2. Kết nối SQL Server (đọc application.yml)
        // 3. Kết nối Redis
        // 4. Cấu hình Spring Security
        // 5. Bật Swagger UI
        // ... tất cả tự động!
    }
}
```

**Spring Boot Starters sử dụng trong dự án:**

| Starter | Dependency | Tác dụng |
|---|---|---|
| `spring-boot-starter-web` | Tomcat, Jackson, Spring MVC | REST API, HTTP server |
| `spring-boot-starter-data-jpa` | Hibernate, JPA, JDBC | ORM, truy vấn database |
| `spring-boot-starter-security` | Spring Security, BCrypt | Xác thực, phân quyền |
| `spring-boot-starter-validation` | Hibernate Validator | @NotBlank, @Email, @Size |
| `spring-boot-starter-data-redis` | Lettuce, Spring Data Redis | Cache với Redis |
| `spring-boot-starter-websocket` | Spring WebSocket, STOMP | Real-time communication |
| `spring-boot-starter-mail` | JavaMail | Gửi email |

### Kiến trúc phân lớp (Layered Architecture)

```
        Request              Response
           |                    ^
           v                    |
    +------+------+      +------+------+
    | Controller  |      | Controller  |
    | (Nhận HTTP) |      | (Trả JSON)  |
    +------+------+      +------+------+
           |                    ^
           v                    |
    +------+------+      +------+------+
    |   Service   |      |   Service   |
    |(Business    |      | (Trả DTO)   |
    | Logic)      |      |             |
    +------+------+      +------+------+
           |                    ^
           v                    |
    +------+------+      +------+------+
    | Repository  |      | Repository  |
    | (Query DB)  |      | (Trả Entity)|
    +------+------+      +------+------+
           |                    ^
           v                    |
    +------+------+      +------+------+
    |  Database   |----->|  Database   |
    +-------------+      +-------------+
```

**Quy tắc nghiêm ngặt:**
- Controller CHỈ ĐƯỢC gọi Service (KHÔNG gọi Repository)
- Service CHỈ ĐƯỢC gọi Repository (KHÔNG gọi Controller)
- Repository CHỈ ĐƯỢC gọi Database (KHÔNG chứa business logic)

**Tại sao phân lớp?**
1. **Dễ tìm lỗi**: Bug ở database query -> chỉ xem Repository. Bug ở logic -> chỉ xem Service.
2. **Đổi database**: Chỉ sửa Repository. Service và Controller không biết gì.
3. **Team work**: 1 người làm Controller, 1 người làm Service, không xung đột.

---

## 3. Database — SQL Server + JPA/Hibernate

### SQL Server 2022

**SQL Server là gì?**
Hệ quản trị cơ sở dữ liệu quan hệ (RDBMS) của Microsoft. Dữ liệu được lưu trong bảng (table), các bảng liên kết nhau qua khóa ngoại (foreign key).

**Tại sao dùng SQL Server?**
- Phổ biến trong doanh nghiệp Việt Nam (nhiều công ty dùng)
- Hỗ trợ tốt với Windows và .NET (nhưng vẫn chạy trên Linux/Docker)
- Công cụ quản lý mạnh (SSMS — SQL Server Management Studio)

**Cấu hình kết nối:**
```yaml
# application-dev.yml
spring:
  datasource:
    url: jdbc:sqlserver://localhost:1433;databaseName=cinex;encrypt=false
    username: sa
    password: CineX@2026
    driver-class-name: com.microsoft.sqlserver.jdbc.SQLServerDriver
```

**Giải thích URL:**
- `jdbc:sqlserver://` — giao thức kết nối
- `localhost:1433` — địa chỉ và port của SQL Server
- `databaseName=cinex` — tên database
- `encrypt=false` — tắt SSL (dev only, production phải bật)

### JPA — Java Persistence API

**JPA là gì?**
Đặc tả (specification) định nghĩa cách Java làm việc với database. JPA chỉ là **giao diện** (interface), không phải code thực.

**Ví dụ đời thường:** JPA giống **luật giao thông** — chỉ định nghĩa quy tắc (xe phải đi bên phải). Hibernate là **xe hơi cụ thể** — thực hiện luật đó.

**Annotation chính:**

```java
@Entity                           // "Class này map với 1 bảng trong DB"
@Table(name = "movies")           // "Tên bảng là movies"
public class Movie extends BaseEntity {

    @Column(name = "title",       // "Cột title"
            nullable = false,     // "Không được NULL"
            length = 200)         // "Tối đa 200 ký tự"
    private String title;

    @ManyToOne(fetch = FetchType.LAZY)   // "Nhiều Movie thuộc 1 Genre"
    @JoinColumn(name = "genre_id")       // "Liên kết qua cột genre_id"
    private Genre genre;

    @Enumerated(EnumType.STRING)  // "Lưu enum dưới dạng String (không phải số)"
    private MovieStatus status;   // -> cột status = 'NOW_SHOWING' (dễ đọc)
}
```

### Hibernate — JPA Implementation

**Hibernate là gì?**
Thư viện implement JPA. Nó tự động:
1. Chuyển Java object -> SQL (INSERT, UPDATE, DELETE)
2. Chuyển SQL result -> Java object (SELECT)
3. Quản lý lifecycle của entity (Transient -> Managed -> Detached -> Removed)

**ddl-auto: validate (quan trọng!):**
```yaml
spring:
  jpa:
    hibernate:
      ddl-auto: validate  # Hibernate CHỈ KIỂM TRA schema, KHÔNG tự tạo/sửa bảng
```

| Giá trị | Hành động | Dùng khi |
|---|---|---|
| `create` | XÓA và TẠO LẠI toàn bộ bảng | KHÔNG BAO GIỜ dùng (mất dữ liệu) |
| `update` | Tự ALTER TABLE khi entity thay đổi | Dev nhanh (NGUY HIỂM) |
| `validate` | Chỉ kiểm tra schema đúng chưa | **Production (chuẩn)** |
| `none` | Không làm gì | Khi dùng migration tool |

**CineX dùng `validate`** kết hợp Liquibase (migration tool) để quản lý schema.

### Spring Data JPA — Repository tạo tự động

**Spring Data JPA là gì?**
Thư viện của Spring giúp tạo Repository tự động từ interface. Bạn chỉ cần khai báo tên method, Spring Data tự sinh SQL.

```java
// CHỈ CẦN khai báo interface — Spring Data tự tạo implementation!
public interface MovieRepository extends JpaRepository<Movie, Long>,
                                         JpaSpecificationExecutor<Movie> {

    // Spring Data tự sinh: SELECT * FROM movies WHERE title = ?
    Optional<Movie> findByTitle(String title);

    // Spring Data tự sinh: SELECT * FROM movies WHERE status = ? AND genre_id = ?
    List<Movie> findByStatusAndGenreId(MovieStatus status, Long genreId);

    // Khi tên method không đủ -> dùng @Query với JPQL
    @Query("SELECT m FROM Movie m WHERE m.rating >= :minRating ORDER BY m.rating DESC")
    List<Movie> findTopRated(@Param("minRating") double minRating);
}
```

**Quy tắc đặt tên method:**

| Prefix | Sinh SQL | Ví dụ |
|---|---|---|
| `findBy` | SELECT ... WHERE | `findByTitle(title)` |
| `countBy` | SELECT COUNT(*) WHERE | `countByStatus(status)` |
| `existsBy` | SELECT CASE WHEN EXISTS | `existsByEmail(email)` |
| `deleteBy` | DELETE ... WHERE | `deleteByExpiredAtBefore(date)` |

| Từ khóa | Sinh SQL | Ví dụ |
|---|---|---|
| `And` | AND | `findByTitleAndStatus(...)` |
| `Or` | OR | `findByTitleOrStatus(...)` |
| `Between` | BETWEEN | `findByPriceBetween(min, max)` |
| `OrderBy` | ORDER BY | `findByStatusOrderByCreatedAtDesc(...)` |
| `In` | IN (...) | `findByStatusIn(List<Status>)` |

### 3 loại Repository trong dự án

```
+--------------------------------------------------+
| 1. JpaRepository<Entity, ID>                     |
|    -> CRUD cơ bản: save, findById, delete, ...    |
|    -> Spring Data tự tạo implementation           |
|    -> Dùng cho: tất cả entity                     |
|    VD: MovieRepository extends JpaRepository      |
+--------------------------------------------------+
                |
                v
+--------------------------------------------------+
| 2. + JpaSpecificationExecutor<Entity>            |
|    -> Tìm kiếm động (dynamic WHERE clause)        |
|    -> Kết hợp với Specification pattern           |
|    -> Dùng cho: search/filter                     |
|    VD: MovieRepository extends JpaRepository,     |
|                           JpaSpecificationExecutor |
+--------------------------------------------------+
                |
                v
+--------------------------------------------------+
| 3. Standalone @Repository class                  |
|    -> Query phức tạp JOIN nhiều bảng              |
|    -> Dùng EntityManager trực tiếp               |
|    -> KHÔNG extends JpaRepository                |
|    -> Dùng cho: thống kê, báo cáo, analytics     |
|    VD: StatisticsRepository                       |
+--------------------------------------------------+
```

---

## 4. Bảo mật — Spring Security + JWT

### Spring Security

**Spring Security là gì?**
Framework bảo mật của Spring, xử lý 2 việc chính:
1. **Authentication (Xác thực)**: "Bạn là ai?" — kiểm tra username/password
2. **Authorization (Phân quyền)**: "Bạn được làm gì?" — kiểm tra role (ADMIN/USER)

**Luồng xử lý request:**

```
Request đến
    |
    v
[CorsFilter]         — Kiểm tra nguồn gốc (localhost:5173 OK)
    |
    v
[JwtAuthFilter]      — Đọc JWT từ header "Authorization: Bearer xxx"
    |                   -> Hợp lệ? Set user vào SecurityContext
    |                   -> Không hợp lệ? Bỏ qua (xem như anonymous)
    v
[SecurityFilterChain] — Kiểm tra quyền truy cập URL:
    |                   /api/auth/** -> cho tất cả (permitAll)
    |                   /api/statistics/** -> chỉ ADMIN
    |                   /api/bookings -> chỉ user đã đăng nhập
    v
[Controller]          — Xử lý request
```

**Cấu hình SecurityConfig:**
```java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    return http
        .csrf(csrf -> csrf.disable())          // Tắt CSRF vì dùng JWT (không dùng cookie)
        .sessionManagement(s -> s
            .sessionCreationPolicy(STATELESS))  // Không tạo session (stateless)
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/api/auth/**").permitAll()     // Ai cũng vào được
            .requestMatchers("/api/payments/callback").permitAll()
            .requestMatchers("/ws/**").permitAll()           // WebSocket
            .anyRequest().authenticated()                     // Còn lại phải đăng nhập
        )
        .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
        .build();
}
```

### JWT (JSON Web Token)

**JWT là gì?**
Chuỗi ký tự (token) chứa thông tin user, được ký số (signed) để đảm bảo không bị thay đổi.

**Cấu trúc JWT:**
```
eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbiJ9.abc123xyz
|_____HEADER_____|._______PAYLOAD_______|._SIGNATURE_|

HEADER:  { "alg": "HS256" }          // Thuật toán ký
PAYLOAD: { "sub": "admin",           // Username
           "role": "ADMIN",          // Quyền
           "exp": 1716825600 }       // Hết hạn
SIGNATURE: HMAC-SHA256(header + payload, SECRET_KEY)
```

**Luồng hoạt động:**

```
1. Login:
   Client ---POST /api/auth/login---> Server
                                       |
                                       v
                                    Kiểm tra username/password
                                       |
                                       v
                                    Tạo JWT (ký bằng SECRET_KEY)
                                       |
   Client <--{ accessToken, refreshToken }--- Server

2. Gọi API:
   Client ---GET /api/bookings---> JwtAuthFilter
             Authorization:          |
             Bearer eyJhbG...        v
                                  Đọc token từ header
                                  Verify chữ ký (SECRET_KEY)
                                  Đọc username từ payload
                                  Set vào SecurityContext
                                       |
                                       v
                                    Controller (biết user là ai)

3. Token hết hạn (15 phút):
   Client ---POST /api/auth/refresh-token---> Server
             { refreshToken: "xxx" }            |
                                                v
                                            Kiểm tra refreshToken
                                            còn hợp lệ? (7 ngày)
                                                |
   Client <--{ newAccessToken }--- Server
```

**Thư viện JJWT 0.12.6:**
```java
// Tạo token
String token = Jwts.builder()
    .subject(user.getUsername())     // "Chủ nhân" của token
    .claim("role", user.getRole())  // Thông tin thêm
    .issuedAt(new Date())           // Thời điểm tạo
    .expiration(new Date(System.currentTimeMillis() + 900000))  // Hết hạn (15 phút)
    .signWith(secretKey)            // Ký bằng secret key
    .compact();                     // Trả về chuỗi JWT

// Xác thực token
Claims claims = Jwts.parser()
    .verifyWith(secretKey)          // Dùng key để verify
    .build()
    .parseSignedClaims(token)       // Parse và verify
    .getPayload();                  // Lấy payload
String username = claims.getSubject();  // Lấy username
```

**Cấu hình trong dự án:**
```yaml
app:
  jwt:
    secret: dGhpcyBpcyBhIH...  # Base64 encoded secret key
    expiration-ms: 900000        # 15 phút (access token)
    refresh-expiration-ms: 604800000  # 7 ngày (refresh token)
```

### BCrypt — Mã hóa mật khẩu

```java
// Lưu mật khẩu: KHÔNG BAO GIỜ lưu plain text!
// BCrypt = hàm băm 1 chiều (hash), KHÔNG thể giải mã ngược
String hashed = passwordEncoder.encode("MyPassword123");
// -> "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"

// Kiểm tra: hash mật khẩu nhập vào và so sánh
boolean match = passwordEncoder.matches("MyPassword123", hashed);
// -> true
```

---

## 5. Cache — Redis

### Redis là gì?

Database lưu trong RAM (in-memory), truy xuất cực nhanh (< 1ms).
Khác với SQL Server (lưu trên ổ cứng, ~10ms/query).

**Ví dụ đời thường:** Redis giống **tủ lạnh** — lấy đồ ăn nhanh hơn đi chợ (SQL Server).

### Dùng để làm gì trong CineX?

| Chức năng | Key | Value | TTL |
|---|---|---|---|
| Cache system config | `config:booking.max_seats` | `8` | 5 phút |
| Session token | `refresh_token:{userId}` | token string | 7 ngày |
| Rate limiting | `rate:{ip}:{endpoint}` | số lần gọi | 1 phút |

### Cấu hình:
```yaml
spring:
  data:
    redis:
      host: localhost
      port: 6379
```

### Cache-aside Pattern (áp dụng trong SystemConfigService):

```
                Đọc config
                    |
                    v
            +--- Có trong Redis? ---+
            |                       |
           YES                     NO
            |                       |
            v                       v
     Trả về từ Redis          Đọc từ SQL Server
     (< 1ms)                  (~10ms)
                                    |
                                    v
                              Lưu vào Redis (TTL 5 phút)
                                    |
                                    v
                              Trả về cho client
```

---

## 6. Thời gian thực — WebSocket + STOMP

### WebSocket là gì?

Giao thức cho phép **2 chiều** (bidirectional) giữa client và server.
HTTP thường: client gửi request -> server trả response -> ĐÓNG kết nối.
WebSocket: mở kết nối 1 lần -> cả 2 bên gửi dữ liệu bất kỳ lúc nào.

**Ví dụ đời thường:**
- HTTP = gửi thư (gửi đi, đợi hồi âm)
- WebSocket = gọi điện (nói chuyện 2 chiều liên tục)

### STOMP (Simple Text Oriented Messaging Protocol)

Giao thức tin nhắn chạy trên WebSocket. Hỗ trợ publish/subscribe.

```
STOMP là gì?
- Giao thức định dạng tin nhắn (giống HTTP có header + body)
- Chạy trên WebSocket (WebSocket chỉ là "ống dẫn", STOMP là "nội dung")
- Hỗ trợ Subscribe (đăng ký nhận tin) và Send (gửi tin)
```

### SockJS — Fallback

Nếu trình duyệt không hỗ trợ WebSocket (cũ), SockJS tự chuyển sang kỹ thuật khác (long-polling, Server-Sent Events).

### Dùng để làm gì trong CineX?

**1. Cập nhật ghế real-time khi đặt vé:**
```
User A chọn ghế A1        User B đang xem cùng suất chiếu
    |                          |
    v                          | (Đã subscribe /topic/showtime/5/seats)
Server cập nhật ghế A1         |
    |                          |
    +---- gửi message -------->|
                               v
                        Ghế A1 chuyển màu đỏ (đã có người chọn)
```

**2. Thông báo real-time:**
```
Admin tạo suất chiếu mới
    |
    v
Server gửi thông báo đến tất cả user đã subscribe
    |
    +---- /topic/notifications ----> User nhận thông báo
```

### Cấu hình Backend:
```java
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")           // URL kết nối WebSocket
                .setAllowedOriginPatterns("*") // Cho phép tất cả origin (dev)
                .withSockJS();                 // Bật SockJS fallback
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic");  // Prefix cho subscribe
        registry.setApplicationDestinationPrefixes("/app");  // Prefix cho send
    }
}
```

### Frontend kết nối:
```typescript
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

const client = new Client({
  webSocketFactory: () => new SockJS('http://localhost:8088/ws'),
  onConnect: () => {
    // Đăng ký nhận cập nhật ghế của suất chiếu số 5
    client.subscribe('/topic/showtime/5/seats', (message) => {
      const seats = JSON.parse(message.body)
      // Cập nhật UI
    })
  },
})
client.activate()
```

---

## 7. Email — Spring Mail + Mailtrap

### Spring Mail là gì?

Module của Spring gửi email qua giao thức SMTP. Dùng `JavaMailSender`.

### Mailtrap là gì?

Dịch vụ email **sandbox** (môi trường thử). Email gửi đi KHÔNG đến người nhận thật mà vào hộp thư Mailtrap để kiểm tra.

**Tại sao dùng Mailtrap?**
- Dev: không gửi nhầm email đến người dùng thật
- Xem được email gửi đi (HTML, nội dung, header)
- Miễn phí cho developer

### Cấu hình:
```yaml
spring:
  mail:
    host: sandbox.smtp.mailtrap.io
    port: 2525
    username: b80f8260dfbae4
    password: f3596ae5d769d4
```

### Các email gửi trong CineX:

| Sự kiện | Nội dung email | Template |
|---|---|---|
| Đặt vé thành công | Mã đặt vé, tên phim, giờ chiếu, ghế, tổng tiền | booking-confirmation.html |
| Hủy vé | Xác nhận hủy, mã vé, lý do | booking-cancellation.html |
| Đăng ký tài khoản | Chào mừng, thông tin tài khoản | welcome.html |

---

## 8. Upload ảnh — Cloudinary

### Cloudinary là gì?

Dịch vụ lưu trữ ảnh/video trên cloud. Cung cấp:
- **CDN** (Content Delivery Network): Ảnh được cache trên server gần người dùng -> tải nhanh
- **Transform**: Resize, crop, đổi định dạng ngay trên URL
- **URL**: `https://res.cloudinary.com/{cloud_name}/image/upload/v123/cinex/posters/movie1.jpg`

### Tại sao không lưu ảnh trên server?

| Lưu trên server | Lưu trên Cloudinary |
|---|---|
| Tốn dung lượng ổ cứng | Không tốn dung lượng |
| Mất ảnh nếu server hỏng | An toàn (backup tự động) |
| Tải chậm (1 server) | Tải nhanh (CDN toàn cầu) |
| Tự code resize | Resize bằng URL |

### Cấu hình:
```yaml
cloudinary:
  cloud-name: dale1y60n
  api-key: 233379921854635
  api-secret: R6Ws-brlo7FhCX2NYGHPQlnS8W8
```

### Folder:
```
cinex/
  posters/   — Ảnh poster phim
  avatars/   — Ảnh đại diện user
  snacks/    — Ảnh món ăn/thức uống
```

### Code upload:
```java
@Service
public class FileUploadService {
    private final Cloudinary cloudinary;

    public String upload(MultipartFile file, String folder) {
        Map result = cloudinary.uploader().upload(file.getBytes(), Map.of(
            "folder", folder,        // VD: "cinex/posters"
            "resource_type", "auto"  // Tự detect ảnh/video
        ));
        return (String) result.get("secure_url");
        // -> "https://res.cloudinary.com/dale1y60n/image/upload/v.../cinex/posters/abc.jpg"
    }
}
```

---

## 9. Mã QR — ZXing

### ZXing (Zebra Crossing) là gì?

Thư viện Java tạo và đọc mã vạch/QR code. Trong CineX dùng để tạo mã QR cho vé xem phim.

### Luồng hoạt động:

```
User đặt vé thành công
    |
    v
Server tạo QR code từ bookingCode (VD: "CX-20260527-001")
    |
    v
Lưu QR code image vào Cloudinary
    |
    v
Trả URL QR cho Frontend hiển thị
    |
    v
User đến rạp -> nhân viên quét QR -> check-in
```

### Thư viện sử dụng:
```groovy
implementation 'com.google.zxing:core:3.5.3'    // Logic tạo QR
implementation 'com.google.zxing:javase:3.5.3'  // Chuyển QR thành ảnh
```

### Frontend hiển thị QR:
```tsx
import { QRCode } from 'react-qr-code'

<QRCode value={booking.bookingCode} size={250} />
```

### Frontend quét QR (nhân viên):
```tsx
import { Html5QrcodeScanner } from 'html5-qrcode'
// Quét QR bằng camera -> lấy bookingCode -> gọi API check-in
```

---

## 10. API Docs — Swagger/OpenAPI

### Swagger là gì?

Giao diện web tự động sinh ra từ code, cho phép **xem và test API** trực tiếp trên trình duyệt.

**URL:** `http://localhost:8088/swagger-ui.html`

### SpringDoc OpenAPI 2.6.0

Thư viện tự đọc code Java (annotation) và sinh file OpenAPI 3.0 spec.

```java
@RestController
@RequestMapping("/api/movies")
@Tag(name = "Movie", description = "Movie CRUD operations")  // Nhóm trong Swagger
public class MovieController {

    @Operation(summary = "Get all movies with filter")        // Mô tả API
    @GetMapping
    public ApiResponse<PageResponse<MovieResponse>> getAll(
            @Valid MovieFilter filter, Pageable pageable) {
        // ...
    }
}
```

**Cấu hình:**
```groovy
implementation 'org.springdoc:springdoc-openapi-starter-webmvc-ui:2.6.0'
```

---

## 11. Database Migration — Liquibase

### Liquibase là gì?

Công cụ quản lý phiên bản schema database (tương tự Git cho database). Mỗi thay đổi schema = 1 file XML (changeset).

**Tại sao cần?**
- **Không dùng ddl-auto=update**: Hibernate tự đổi schema NGUY HIỂM (có thể mất dữ liệu)
- **Version control**: Mỗi thay đổi schema được ghi lại, có thể rollback
- **Team work**: Nhiều người cùng làm, merge schema thay đổi dễ dàng
- **Deploy**: Schema tự động cập nhật khi deploy lên server mới

### Cách hoạt động:

```
Spring Boot khởi động
    |
    v
Liquibase đọc db.changelog-master.xml
    |
    v
Kiểm tra bảng DATABASECHANGELOG trong SQL Server
(lưu các changeset đã chạy)
    |
    v
Changeset mới chưa chạy? -> Chạy SQL -> Ghi vào DATABASECHANGELOG
Đã chạy rồi? -> Bỏ qua
```

### Cấu trúc file:

```
resources/db/changelog/
  db.changelog-master.xml          -- File gốc, include tất cả changeset
  changes/
    001-create-users-table.xml     -- Tạo bảng users
    002-create-movies-table.xml    -- Tạo bảng movies
    003-create-rooms-table.xml     -- Tạo bảng rooms
    ...
    026-create-snack-orders-table.xml
```

### Ví dụ changeset:
```xml
<changeSet id="001-create-users" author="cinex">
    <createTable tableName="users">
        <column name="id" type="BIGINT" autoIncrement="true">
            <constraints primaryKey="true"/>
        </column>
        <column name="username" type="NVARCHAR(50)">
            <constraints nullable="false" unique="true"/>
        </column>
        <column name="password" type="VARCHAR(100)">
            <constraints nullable="false"/>
        </column>
    </createTable>
</changeSet>
```

**Quy tắc:**
- KHÔNG BAO GIỜ sửa changeset đã chạy -> tạo changeset mới để ALTER
- Đánh số tăng dần: 001, 002, 003, ...
- Mỗi changeset có `id` unique và `author`

---

## 12. Code Generation — Lombok + MapStruct

### Lombok

**Lombok là gì?**
Thư viện Java sinh code tự động từ annotation. Giảm code boilerplate (code lặp đi lặp lại).

**Ví dụ:**
```java
// KHÔNG có Lombok — 50 dòng code:
public class Movie {
    private String title;
    private int duration;

    public Movie() {}
    public Movie(String title, int duration) { ... }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public int getDuration() { return duration; }
    public void setDuration(int duration) { this.duration = duration; }
    // ... còn Builder, toString, equals, hashCode nữa
}

// CÓ Lombok — 5 dòng:
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Movie {
    private String title;
    private int duration;
}
// Lombok TỰ SINH tất cả getter, setter, constructor, builder lúc compile!
```

**Annotation hay dùng:**

| Annotation | Sinh ra | Dùng cho |
|---|---|---|
| `@Getter` | Tất cả getter methods | Entity, DTO |
| `@Setter` | Tất cả setter methods | Entity |
| `@NoArgsConstructor` | Constructor không tham số | JPA entity (bắt buộc) |
| `@AllArgsConstructor` | Constructor đầy đủ tham số | — |
| `@Builder` | Builder pattern | DTO Response, ApiResponse |
| `@RequiredArgsConstructor` | Constructor cho `final` fields | Service, Controller (DI) |
| `@Slf4j` | Logger: `log.info(...)` | Service |

### MapStruct 1.6.3

**MapStruct là gì?**
Thư viện tự sinh code chuyển đổi Entity <-> DTO. Sinh code lúc **compile** (không phải runtime) -> nhanh.

**Ví dụ:**
```java
@Mapper(componentModel = "spring")
public interface MovieMapper {

    // MapStruct tự sinh code: movieResponse.setTitle(movie.getTitle()), ...
    MovieResponse toResponse(Movie movie);

    // Tạo entity từ request
    Movie toEntity(MovieRequest request);

    // Cập nhật entity từ dữ liệu của request
    void updateEntity(MovieRequest request, @MappingTarget Movie movie);
}
```

**Code được sinh ra (lúc compile):**
```java
// MapStruct tự tạo file MovieMapperImpl.java:
@Component
public class MovieMapperImpl implements MovieMapper {
    @Override
    public MovieResponse toResponse(Movie movie) {
        MovieResponse resp = new MovieResponse();
        resp.setTitle(movie.getTitle());
        resp.setDuration(movie.getDuration());
        resp.setPosterUrl(movie.getPosterUrl());
        // ... map tất cả field trùng tên
        return resp;
    }
}
```

**Tại sao dùng MapStruct thay vì tự viết?**
- **Không sót field**: MapStruct cảnh báo nếu có field chưa map
- **Compile-time**: Lỗi type mismatch bắt lúc compile, không phải runtime
- **Hiệu năng**: Code thường (getter/setter), không dùng reflection

### Lưu ý khi dùng Lombok + MapStruct cùng nhau:

```groovy
// build.gradle — thứ tự annotation processor QUAN TRỌNG:
annotationProcessor 'org.mapstruct:mapstruct-processor:1.6.3'
annotationProcessor 'org.projectlombok:lombok'
annotationProcessor 'org.projectlombok:lombok-mapstruct-binding:0.2.0'
// lombok-mapstruct-binding đảm bảo Lombok chạy TRƯỚC MapStruct
// (MapStruct cần getter/setter từ Lombok để sinh code)
```

---

## 13. JPA Auditing — Tự động ghi nhật ký thay đổi

### JPA Auditing là gì?

Khi lưu một entity vào database, bạn thường muốn biết:
- **Ai** tạo bản ghi này? (`createdBy`)
- **Khi nào** tạo? (`createdAt`)
- **Ai** sửa lần cuối? (`updatedBy`)
- **Khi nào** sửa? (`updatedAt`)

**JPA Auditing** là tính năng của Spring Data JPA, giúp **tự động điền** 4 trường trên mỗi khi `save()` entity — bạn không cần viết code set thủ công.

> **Ví dụ đời thường:** Giống như camera an ninh ở cửa hàng. Mỗi khi có ai vào kho lấy hàng hoặc thêm hàng, camera tự động ghi lại "ai làm, lúc mấy giờ" — nhân viên không cần tự viết sổ nhật ký. JPA Auditing chính là "camera" đó cho database.

### Cách hoạt động — 3 thành phần kết nối

JPA Auditing cần 3 thành phần phối hợp với nhau:

```
┌──────────────────────────────────────────────────────────────────┐
│                    KHI GỌI repository.save(entity)              │
│                                                                  │
│  ① @EnableJpaAuditing          → Bật tính năng auditing         │
│  ② @EntityListeners(...)       → Lắng nghe sự kiện save/update  │
│  ③ AuditorAware<String>        → Trả lời "ai đang thao tác?"   │
│                                                                  │
│  Kết quả: createdBy, updatedBy, createdAt, updatedAt            │
│           được TỰ ĐỘNG điền vào entity trước khi INSERT/UPDATE  │
└──────────────────────────────────────────────────────────────────┘
```

#### Thành phần 1: `@EnableJpaAuditing` — Bật công tắc

```java
// File: common/config/JpaAuditingConfig.java
@Configuration
@EnableJpaAuditing  // ← Bật tính năng JPA Auditing cho toàn bộ ứng dụng
public class JpaAuditingConfig {
    // Chỉ cần annotation, không cần code gì thêm
}
```

Nếu thiếu annotation này, tất cả `@CreatedBy`, `@CreatedDate`... sẽ **bị bỏ qua** — các trường audit sẽ luôn là `null`.

#### Thành phần 2: `@EntityListeners` — Lắng nghe sự kiện

```java
// File: common/entity/BaseEntity.java
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)  // ← "Canh chừng" entity này
public abstract class BaseEntity {

    @CreatedBy                          // Spring tự điền khi INSERT
    @Column(updatable = false)          // Không cho sửa sau khi tạo
    private String createdBy;

    @LastModifiedBy                     // Spring tự điền khi UPDATE
    private String updatedBy;

    @CreatedDate                        // Spring tự điền thời gian INSERT
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate                   // Spring tự điền thời gian UPDATE
    private LocalDateTime updatedAt;
}
```

**`AuditingEntityListener`** là class có sẵn của Spring. Nó hoạt động như một "người canh gác":
- Trước khi **INSERT** → gọi `@PrePersist` → điền `createdBy`, `createdAt`, `updatedBy`, `updatedAt`
- Trước khi **UPDATE** → gọi `@PreUpdate` → chỉ điền `updatedBy`, `updatedAt` (không đè `created*`)

#### Thành phần 3: `AuditorAware` — Hỏi "ai đang thao tác?"

```java
// File: common/config/AuditorAwareImpl.java
@Component
public class AuditorAwareImpl implements AuditorAware<String> {

    @Override
    public Optional<String> getCurrentAuditor() {
        // Đọc JWT từ SecurityContext → lấy username
        return Optional.ofNullable(SecurityContextHolder.getContext().getAuthentication())
                .filter(Authentication::isAuthenticated)
                .map(Authentication::getName);
        // Trả về "admin@cinex.vn" hoặc username của người đang đăng nhập
    }
}
```

Khi `AuditingEntityListener` cần điền `createdBy` / `updatedBy`, nó gọi `getCurrentAuditor()` để hỏi "ai đang thao tác?". Method này đọc **JWT token** từ `SecurityContext` (đã được `JwtAuthFilter` parse trước đó) và trả về username.

### 4 annotation audit trong BaseEntity

| Annotation | Điền khi | Giá trị | Ví dụ |
|---|---|---|---|
| `@CreatedBy` | INSERT (lần đầu save) | Username từ `AuditorAware` | `"admin@cinex.vn"` |
| `@LastModifiedBy` | INSERT + UPDATE | Username từ `AuditorAware` | `"staff@cinex.vn"` |
| `@CreatedDate` | INSERT (lần đầu save) | `LocalDateTime.now()` | `2026-05-31T10:30:00` |
| `@LastModifiedDate` | INSERT + UPDATE | `LocalDateTime.now()` | `2026-05-31T14:45:00` |

> **Lưu ý:** `@CreatedBy` và `@CreatedDate` có `@Column(updatable = false)` — nghĩa là khi UPDATE, Hibernate sẽ **không** ghi đè 2 trường này. Ai tạo thì mãi mãi là người đó.

### Flow chi tiết: Admin tạo phim mới

```
Admin đăng nhập (JWT token chứa username = "admin@cinex.vn")
    │
    ▼
POST /api/movies  (Controller nhận request)
    │
    ▼
movieService.createMovie(request)
    │
    ▼
movieRepository.save(movie)          ← Gọi save()
    │
    ▼
AuditingEntityListener               ← Listener bắt sự kiện @PrePersist
    │
    ├─→ Gọi AuditorAware.getCurrentAuditor()
    │       └─→ Đọc SecurityContext → "admin@cinex.vn"
    │
    ├─→ movie.setCreatedBy("admin@cinex.vn")
    ├─→ movie.setUpdatedBy("admin@cinex.vn")
    ├─→ movie.setCreatedAt(LocalDateTime.now())    // 2026-05-31T10:30:00
    └─→ movie.setUpdatedAt(LocalDateTime.now())    // 2026-05-31T10:30:00
    │
    ▼
Hibernate sinh SQL:
INSERT INTO movies (title, ..., created_by, updated_by, created_at, updated_at)
VALUES ('Avengers', ..., 'admin@cinex.vn', 'admin@cinex.vn', '2026-05-31 10:30:00', '2026-05-31 10:30:00')
```

Khi staff sửa phim đó sau:
```
Staff đăng nhập (JWT = "staff@cinex.vn")
    │
    ▼
PUT /api/movies/1
    │
    ▼
movieRepository.save(movie)          ← save() entity đã tồn tại = UPDATE
    │
    ▼
AuditingEntityListener               ← Listener bắt sự kiện @PreUpdate
    │
    ├─→ movie.setUpdatedBy("staff@cinex.vn")       // ← Đổi thành staff
    └─→ movie.setUpdatedAt(LocalDateTime.now())     // ← Cập nhật thời gian
    │   (createdBy và createdAt KHÔNG bị đổi nhờ @Column(updatable = false))
    │
    ▼
Hibernate sinh SQL:
UPDATE movies SET title = '...', updated_by = 'staff@cinex.vn',
       updated_at = '2026-05-31 14:45:00'
WHERE id = 1
-- created_by và created_at KHÔNG xuất hiện trong SET clause
```

### Tại sao không thấy code set?

Đây là câu hỏi rất phổ biến khi đọc code CineX:

```java
// Trong MovieService.createMovie()
public MovieResponse createMovie(MovieRequest request) {
    Movie movie = movieMapper.toEntity(request);
    // ❓ Không thấy movie.setCreatedBy("admin") ở đâu cả?
    // ❓ Không thấy movie.setCreatedAt(LocalDateTime.now()) ở đâu cả?
    movieRepository.save(movie);  // ← Spring làm tự động tại đây!
    return movieMapper.toResponse(movie);
}
```

**Trả lời:** Bạn không cần set thủ công. `AuditingEntityListener` **can thiệp** vào thời điểm giữa lúc gọi `save()` và lúc Hibernate thực sự chạy SQL. Nó tự gọi setter cho 4 trường audit.

Đây chính là sức mạnh của **AOP (Aspect-Oriented Programming)** — code xử lý "cắt ngang" (cross-cutting concern) được tách riêng, không làm bẩn business logic.

### So sánh: Không dùng vs Có dùng JPA Auditing

**Không dùng (code xấu, lặp lại khắp nơi):**
```java
// Phải viết ở MỌI service, MỌI method tạo/sửa
public MovieResponse createMovie(MovieRequest request) {
    Movie movie = movieMapper.toEntity(request);
    movie.setCreatedBy(getCurrentUsername());     // ← Lặp lại
    movie.setCreatedAt(LocalDateTime.now());      // ← Lặp lại
    movie.setUpdatedBy(getCurrentUsername());      // ← Lặp lại
    movie.setUpdatedAt(LocalDateTime.now());       // ← Lặp lại
    movieRepository.save(movie);
    return movieMapper.toResponse(movie);
}

// Copy-paste y hệt cho BookingService, UserService, ShowtimeService...
// Quên 1 chỗ → audit bị null → không biết ai tạo bản ghi
```

**Có dùng (code sạch, không lặp):**
```java
public MovieResponse createMovie(MovieRequest request) {
    Movie movie = movieMapper.toEntity(request);
    movieRepository.save(movie);  // ← Spring tự xử lý audit, sạch sẽ!
    return movieMapper.toResponse(movie);
}
// Áp dụng cho TẤT CẢ entity kế thừa BaseEntity — không cần thêm dòng nào
```

---

## 14. Build Tool — Gradle

### Gradle là gì?

Công cụ build và quản lý dependency cho Java project. Đọc file `build.gradle` để biết:
- Cần thư viện nào? -> Tự tải từ Maven Central
- Compile code như thế nào?
- Chạy test như thế nào?
- Đóng gói thành file JAR như thế nào?

### build.gradle giải thích:

```groovy
plugins {
    id 'java'                                          // Compile Java
    id 'org.springframework.boot' version '3.3.5'      // Đóng gói Spring Boot JAR
    id 'io.spring.dependency-management' version '1.1.6' // Quản lý version thư viện
}

dependencies {
    // implementation: cần thiết khi chạy
    implementation 'org.springframework.boot:spring-boot-starter-web'

    // runtimeOnly: chỉ cần khi chạy (không cần khi compile)
    runtimeOnly 'com.microsoft.sqlserver:mssql-jdbc'

    // compileOnly: chỉ cần khi compile (không đóng gói)
    compileOnly 'org.projectlombok:lombok'

    // annotationProcessor: xử lý annotation lúc compile
    annotationProcessor 'org.projectlombok:lombok'

    // testImplementation: chỉ dùng trong test
    testImplementation 'org.springframework.boot:spring-boot-starter-test'
}
```

### Lệnh hay dùng:

```bash
./gradlew clean build -x test  # Build (không chạy test)
./gradlew bootRun              # Chạy ứng dụng
./gradlew test                 # Chạy test
./gradlew dependencies         # Xem dependency tree
```

---

## 15. Frontend — React + TypeScript + Vite

### React 19

**React là gì?**
Thư viện JavaScript xây dựng giao diện người dùng (UI). Dùng mô hình **Component-based** — chia UI thành các mảnh nhỏ (component), mỗi mảnh tự quản lý logic và hiển thị.

**Ví dụ đời thường:** React giống **xếp LEGO** — mỗi viên LEGO là 1 component. Ghép các component lại thành trang hoàn chỉnh.

```
DashboardPage (trang Dashboard)
    |
    +-- StatCard (card thống kê: booking hôm nay)
    +-- StatCard (card thống kê: doanh thu)
    +-- StatCard (card thống kê: tổng user)
    +-- TopMoviesChart (biểu đồ top phim)
    +-- TopSnacksChart (biểu đồ top snack)
    +-- RevenueChart (biểu đồ doanh thu)
    +-- ExportButtons (nút xuất PDF/Excel)
```

### TypeScript 6.0

**TypeScript là gì?**
JavaScript + hệ thống kiểu dữ liệu (type system). Compiler bắt lỗi TRƯỚC khi chạy.

```typescript
// JavaScript — chạy được nhưng LỖI lúc runtime:
function formatPrice(amount) {
    return amount.toLocaleString('vi-VN') + 'đ'
}
formatPrice("hello")  // Chạy được... nhưng kết quả sai

// TypeScript — bắt lỗi lúc COMPILE:
function formatPrice(amount: number): string {
    return amount.toLocaleString('vi-VN') + 'đ'
}
formatPrice("hello")  // LỖI COMPILE: "hello" is not number
```

### Vite 8.0

**Vite là gì?**
Build tool cho frontend, thay thế Webpack. Nhanh hơn rất nhiều nhờ:
- **Dev**: Dùng ES modules của trình duyệt (không cần bundle)
- **Build**: Dùng esbuild (viết bằng Go, nhanh gấp 10-100x Webpack)

```bash
npm run dev    # Khởi động dev server (< 1 giây)
npm run build  # Build production (tsc + vite build)
```

---

## 16. State Management — TanStack Query + Zustand

### TanStack Query (React Query) 5

**Là gì?**
Thư viện quản lý **server state** (dữ liệu từ API). Tự động:
- **Cache**: Lưu kết quả API, không gọi lại khi chưa cần
- **Refetch**: Tự động gọi lại khi data cũ (stale)
- **Loading/Error**: Tự động quản lý trạng thái loading, error
- **Invalidation**: Khi tạo/sửa/xóa -> tự động gọi lại API để cập nhật

```typescript
// KHÔNG có React Query — phải tự viết:
const [movies, setMovies] = useState([])
const [loading, setLoading] = useState(false)
const [error, setError] = useState(null)

useEffect(() => {
    setLoading(true)
    api.get('/api/movies')
        .then(res => setMovies(res.data.data))
        .catch(err => setError(err))
        .finally(() => setLoading(false))
}, [])

// CÓ React Query — 5 dòng:
const { data: movies, isLoading, error } = useQuery({
    queryKey: ['movies'],
    queryFn: () => api.get('/api/movies').then(r => r.data.data),
})
```

**Mutation (tạo/sửa/xóa):**
```typescript
const createMovie = useMutation({
    mutationFn: (data) => api.post('/api/movies', data),
    onSuccess: () => {
        toast.success('Tạo phim thành công')
        queryClient.invalidateQueries({ queryKey: ['movies'] })
        // -> Tự động gọi lại GET /api/movies để cập nhật danh sách
    },
})
```

### Zustand 5

**Là gì?**
Thư viện quản lý **client state** (dữ liệu chỉ ở frontend). Nhẹ hơn Redux rất nhiều.

**Khi nào dùng Zustand thay vì React Query?**

| React Query | Zustand |
|---|---|
| Dữ liệu từ server (API) | Dữ liệu chỉ ở client |
| Movies, bookings, users | Theme (dark/light), sidebar open/close |
| Cần cache + refetch | Không cần cache |
| VD: `useQuery(['movies'])` | VD: `useAuthStore()` |

```typescript
// Zustand store:
interface AuthState {
    user: User | null
    token: string | null
    login: (user: User, token: string) => void
    logout: () => void
}

const useAuthStore = create<AuthState>((set) => ({
    user: null,
    token: null,
    login: (user, token) => set({ user, token }),
    logout: () => set({ user: null, token: null }),
}))

// Sử dụng trong component:
const { user, logout } = useAuthStore()
```

---

## 17. UI — Tailwind CSS + shadcn/ui

### Tailwind CSS 4.2

**Là gì?**
Framework CSS dùng class utility. Thay vì viết CSS riêng, dùng class trực tiếp trong HTML.

```html
<!-- CSS truyền thống: -->
<style>
.card { background: #0a1929; border-radius: 12px; padding: 16px; }
</style>
<div class="card">...</div>

<!-- Tailwind: -->
<div class="bg-[#0a1929] rounded-xl p-4">...</div>
<!-- Đọc class = biết ngay style: nền #0a1929, bo góc 12px, padding 16px -->
```

### shadcn/ui

**Là gì?**
Bộ component React đẹp, dựa trên Radix UI (accessible). KHÔNG phải library (không install qua npm) — copy code component trực tiếp vào dự án.

**Component dùng trong CineX:**
- `Button` — Nút bấm (solid, ghost, destructive)
- `Card` — Card chứa nội dung
- `Badge` — Nhãn trạng thái (xanh/đỏ/vàng)
- `Dialog` — Modal popup
- `Input`, `Select`, `Textarea` — Form elements
- `Table` — Bảng dữ liệu

---

## 18. Form — React Hook Form + Zod

### React Hook Form 7.75

**Là gì?**
Thư viện quản lý form trong React. Sử dụng **uncontrolled components** (không re-render mỗi lần nhập).

```typescript
const { register, handleSubmit, formState: { errors } } = useForm<MovieRequest>({
    resolver: zodResolver(movieSchema),  // Kết nối Zod validation
})

<form onSubmit={handleSubmit(onSubmit)}>
    <Input {...register('title')} />           {/* Auto bind value + onChange */}
    {errors.title && <span>{errors.title.message}</span>}
</form>
```

### Zod 4.4

**Là gì?**
Thư viện validation schema cho TypeScript. Định nghĩa "dữ liệu hợp lệ thì như thế nào".

```typescript
const movieSchema = z.object({
    title: z.string().min(1, 'Bắt buộc nhập').max(200),
    duration: z.number().min(30, 'Tối thiểu 30 phút').max(300),
    releaseDate: z.string().min(1, 'Bắt buộc chọn'),
})

// Zod tự sinh TypeScript type:
type MovieRequest = z.infer<typeof movieSchema>
// -> { title: string; duration: number; releaseDate: string }
```

---

## 19. HTTP Client — Axios

### Axios 1.16

**Là gì?**
Thư viện HTTP client cho JavaScript. Dùng để gọi REST API từ frontend.

**Tại sao dùng Axios thay vì fetch?**
- **Interceptors**: Tự động đính JWT vào mọi request
- **Auto JSON**: Tự parse response JSON
- **Error handling**: HTTP error -> throw exception tự động
- **Base URL**: Cấu hình 1 lần, dùng mọi nơi

```typescript
// api/axios.ts — Cấu hình 1 lần:
const api = axios.create({
    baseURL: 'http://localhost:8088',
})

// Interceptor: Tự động đính JWT
api.interceptors.request.use((config) => {
    const token = useAuthStore.getState().token
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
})

// Interceptor: Token hết hạn -> tự động refresh
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401) {
            // Gọi refresh token API
            // Nếu thành công -> retry request
            // Nếu thất bại -> logout
        }
        return Promise.reject(error)
    }
)
```

---

## 20. Biểu đồ — Recharts

### Recharts 3.8

**Là gì?**
Thư viện vẽ biểu đồ cho React, dựa trên D3.js. Dùng để vẽ biểu đồ doanh thu trên Dashboard.

```tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

<ResponsiveContainer width="100%" height={300}>
    <LineChart data={revenueData}>
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="revenue" stroke="#eab308" />
    </LineChart>
</ResponsiveContainer>
```

**Loại biểu đồ trong CineX:**
- **LineChart**: Biểu đồ doanh thu theo ngày
- **BarChart**: Có thể dùng cho top movies/snacks

---

## 21. Xuất báo cáo — jsPDF + SheetJS

### Tổng quan

Chức năng xuất báo cáo cho phép admin tải dữ liệu thống kê dưới dạng file PDF hoặc Excel, phục vụ in ấn và lưu trữ. Toàn bộ quá trình xử lý diễn ra **trên trình duyệt** (client-side), KHÔNG cần gọi API riêng.

### jsPDF 4.2 + jspdf-autotable 5.0

**jsPDF là gì?**
Thư viện JavaScript tạo file PDF ngay trên trình duyệt. Bạn viết code "vẽ" nội dung (text, bảng, hình ảnh) lên document, rồi gọi `doc.save()` để tải file.

**jspdf-autotable là gì?**
Plugin mở rộng cho jsPDF, chuyên vẽ **bảng dữ liệu** (table) trong PDF. Tự động xử lý:
- Chia trang khi bảng quá dài
- Căn chỉnh cột, header
- Xen kẽ màu nền dòng (alternateRowStyles)

### Vấn đề font tiếng Việt trong PDF

**Vấn đề:** jsPDF mặc định chỉ có font **Helvetica** (ASCII), KHÔNG hiển thị được ký tự có dấu tiếng Việt (ă, ơ, ư, ê, ...). Nếu xuất PDF mà không xử lý font, toàn bộ chữ có dấu sẽ bị lỗi hiển thị hoặc mất ký tự.

**Giải pháp: Nhúng font Roboto (embed font)**

Roboto là font miễn phí của Google, hỗ trợ đầy đủ ký tự Unicode tiếng Việt. Ta cần:
1. Chuyển file font `.ttf` thành chuỗi **Base64**
2. Nhúng chuỗi Base64 vào jsPDF bằng `addFileToVFS()` và `addFont()`
3. Set font Roboto làm font mặc định: `doc.setFont('Roboto')`

**Ví dụ đời thường:** Giống như khi bạn gửi email có font đặc biệt — nếu máy người nhận không có font đó thì chữ sẽ bị lỗi. Giải pháp là **đính kèm font** vào file PDF, để máy nào mở cũng hiển thị đúng.

**Code thực tế trong dự án:**

```typescript
// utils/roboto-font.ts — Chứa font dưới dạng Base64 (file rất lớn ~500KB)
export const ROBOTO_REGULAR = 'AAEAAAARAQAABAAQ...'  // Base64 của Roboto-Regular.ttf
export const ROBOTO_BOLD = 'AAEAAAARAQAABAAQ...'     // Base64 của Roboto-Bold.ttf

// utils/export.ts — Hàm tạo PDF có font tiếng Việt
import { ROBOTO_REGULAR, ROBOTO_BOLD } from './roboto-font'

function createPDF(): jsPDF {
  const doc = new jsPDF()

  // Bước 1: Đăng ký file font vào VFS (Virtual File System) của jsPDF
  doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR)
  doc.addFileToVFS('Roboto-Bold.ttf', ROBOTO_BOLD)

  // Bước 2: Khai báo font với jsPDF
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold')

  // Bước 3: Set làm font mặc định
  doc.setFont('Roboto')

  return doc
}
```

**Tại sao dùng Roboto mà không dùng font khác?**
- Google cung cấp miễn phí, license cho phép nhúng vào ứng dụng
- Hỗ trợ đầy đủ bảng mã Unicode (Latin Extended, Vietnamese)
- Phổ biến, dễ đọc, phù hợp cho cả tiêu đề và nội dung

### Xuất PDF — Luồng chi tiết

```
User click nút "Xuất PDF"
    |
    v
Lấy dữ liệu từ React Query cache (KHÔNG gọi API lại)
    |
    v
createPDF() — tạo document + nhúng font Roboto
    |
    v
Vẽ tiêu đề: doc.text("Báo cáo doanh thu", ...)
Vẽ phụ đề: doc.text("CineX — Xuất ngày 27/05/2026", ...)
    |
    v
autoTable(doc, {
    head: [["STT", "Ngày", "Doanh thu"]],     // Header bảng
    body: data.map(row => [...]),               // Dữ liệu
    styles: { font: 'Roboto' },                 // Dùng font Roboto
    headStyles: { fillColor: [234, 179, 8] },   // Header màu vàng gold
})
    |
    v
Thêm footer mỗi trang: "CineX — Trang 1/3"
    |
    v
doc.save("bao-cao-doanh-thu.pdf")
    |
    v
Trình duyệt tự động tải file PDF
```

**Hỗ trợ nhiều bảng (sections):**
Khi báo cáo có nhiều nhóm dữ liệu (VD: doanh thu theo tháng chia thành nhiều bảng), hàm `exportPDF` hỗ trợ tham số `sections`:

```typescript
exportPDF({
  title: 'Báo cáo doanh thu',
  columns: [
    { header: 'STT', key: 'stt' },
    { header: 'Phim', key: 'movieTitle' },
    { header: 'Doanh thu', key: 'revenue', format: (v) => v.toLocaleString('vi-VN') + 'đ' },
  ],
  rows: [],  // Không dùng khi có sections
  fileName: 'bao-cao-doanh-thu',
  sections: [
    { label: 'Tháng 4/2026', rows: monthAprilData },
    { label: 'Tháng 5/2026', rows: monthMayData },
  ],
})
```

### SheetJS (xlsx) 0.18.5

**Là gì?**
Thư viện đọc/ghi file Excel (.xlsx) từ JavaScript. Chạy hoàn toàn trên trình duyệt.

**Cách hoạt động:**

```typescript
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

export function exportExcel({ title, subtitle, columns, rows, fileName, sections }: ExportData) {
  // 1. Tạo mảng 2 chiều (array of arrays) — mỗi phần tử = 1 dòng Excel
  const allRows: any[][] = [
    [title],                    // Dòng 1: Tiêu đề (merge toàn bộ cột)
    [subtitle || 'Xuất ngày...'], // Dòng 2: Phụ đề
    [],                          // Dòng 3: Trống
    columns.map(c => c.header),  // Dòng 4: Header bảng
    ...rows.map(row =>           // Dòng 5+: Dữ liệu
      columns.map(c => c.format ? c.format(row[c.key]) : row[c.key])
    ),
  ]

  // 2. Chuyển mảng thành sheet Excel
  const ws = XLSX.utils.aoa_to_sheet(allRows)

  // 3. Merge cells cho tiêu đề
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } },
  ]

  // 4. Tự động điều chỉnh độ rộng cột
  ws['!cols'] = columns.map(c => ({ wch: Math.max(c.header.length * 2, 12) + 4 }))

  // 5. Tạo workbook + tải file
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31))  // Tên sheet tối đa 31 ký tự
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  saveAs(new Blob([buf]), `${fileName}.xlsx`)
}
```

### file-saver 2.0.5

**Là gì?**
Thư viện trigger download file từ trình duyệt. Hàm `saveAs(blob, filename)` tạo một link tải ẩn và tự click để tải file.

### Tại sao xử lý trên client thay vì server?

| Xử lý trên Client (jsPDF/SheetJS) | Xử lý trên Server |
|---|---|
| Không tốn tài nguyên server | Tốn CPU/RAM server |
| Không cần API riêng cho export | Phải tạo endpoint riêng |
| Dùng data đã có trong cache | Phải query DB lại |
| Giảm traffic mạng | Truyền file lớn qua HTTP |
| Phù hợp dự án nhỏ-vừa | Cần khi data quá lớn (>10.000 dòng) |

---

## 22. POS — Bán hàng tại quầy (SnackOrder)

### POS là gì?

POS (Point of Sale) là chức năng **bán hàng tại quầy**, dành cho nhân viên thu ngân tại rạp phim. Khi khách hàng muốn mua bắp nước tại quầy (không qua app), nhân viên dùng giao diện POS để chọn món, tính tổng và lưu đơn hàng.

**Ví dụ đời thường:** POS giống **máy tính tiền** ở cửa hàng tiện lợi — nhân viên bấm chọn sản phẩm, máy tự tính tổng tiền, in hóa đơn.

### Cấu trúc dữ liệu

```
SnackOrder (đơn hàng)
    |
    +-- orderCode: "SNACK-20260527-001"   (mã đơn, tự sinh bằng IdTracker)
    +-- totalAmount: 150.000               (tổng tiền)
    +-- note: "Khách VIP phòng 3"          (ghi chú)
    +-- items: []                          (danh sách món)
         |
         +-- SnackOrderItem (món trong đơn)
              +-- snack: Bắp rang bơ lớn   (liên kết với Snack entity)
              +-- quantity: 2               (số lượng)
              +-- price: 50.000            (giá TẠI THỜI ĐIỂM ĐẶT — Price Snapshot)
```

**Price Snapshot Pattern — Tại sao lưu giá tại thời điểm đặt?**

Giá bắp nước có thể thay đổi (tăng giá, khuyến mãi). Nếu chỉ lưu `snackId` mà không lưu `price`, khi xem lại đơn cũ sẽ hiển thị **giá mới** chứ không phải giá lúc mua. Đây là lỗi nghiệp vụ nghiêm trọng.

```
ĐÚNG (có Price Snapshot):
- 01/05: Mua Pepsi 20.000đ → lưu price = 20.000
- 15/05: Pepsi tăng giá 25.000đ
- Xem lại đơn 01/05: vẫn hiện 20.000đ ✓

SAI (không có Price Snapshot):
- 01/05: Mua Pepsi → chỉ lưu snackId
- 15/05: Pepsi tăng giá 25.000đ
- Xem lại đơn 01/05: hiện 25.000đ ✗ (sai!)
```

### Luồng xử lý POS

```
Nhân viên mở trang POS
    |
    v
Chọn món: Bắp rang bơ lớn x2, Pepsi x1
    |
    v
[Frontend] POST /api/snack-orders
{
  "items": [
    { "snackId": 1, "quantity": 2 },
    { "snackId": 5, "quantity": 1 }
  ],
  "note": "Khách VIP phòng 3"
}
    |
    v
[SnackOrderController] → [SnackOrderService.createOrder()]
    |
    v
1. Sinh mã đơn: IdTrackerService.nextCodeWithDate("SNACK")
   → "SNACK-20260527-001"
    |
    v
2. Duyệt từng item:
   - Tìm Snack theo snackId (nếu không tìm thấy → throw SNACK_NOT_FOUND)
   - Lấy giá hiện tại: snack.getPrice() = 50.000đ
   - Tính tiền: 50.000 × 2 = 100.000đ
   - Tạo SnackOrderItem (lưu price = 50.000 — Price Snapshot)
    |
    v
3. Tính tổng tiền: 100.000 + 20.000 = 120.000đ
    |
    v
4. Lưu SnackOrder + items (Cascade ALL — 1 lệnh save, tự lưu cả items)
    |
    v
5. Log: "POS order created: SNACK-20260527-001 - total 120.000đ, 2 items"
    |
    v
Trả về SnackOrderResponse cho Frontend
```

### Code Backend chính

```java
@Service
@RequiredArgsConstructor
@Slf4j
public class SnackOrderService {

    private final SnackOrderRepository snackOrderRepository;
    private final SnackRepository snackRepository;
    private final IdTrackerService idTrackerService;

    @Transactional
    public SnackOrderResponse createOrder(SnackOrderRequest request) {
        // [IdTracker Pattern] Sinh mã đơn tự động có ngày
        String orderCode = idTrackerService.nextCodeWithDate("SNACK");

        SnackOrder order = SnackOrder.builder()
                .orderCode(orderCode)
                .note(request.getNote())
                .totalAmount(BigDecimal.ZERO)
                .build();

        BigDecimal total = BigDecimal.ZERO;

        for (SnackOrderItemRequest itemReq : request.getItems()) {
            Snack snack = snackRepository.findById(itemReq.getSnackId())
                    .orElseThrow(() -> new BusinessException(ErrorCode.SNACK_NOT_FOUND));

            // [Price Snapshot] Lưu giá tại thời điểm đặt
            BigDecimal itemTotal = snack.getPrice().multiply(BigDecimal.valueOf(itemReq.getQuantity()));
            total = total.add(itemTotal);

            SnackOrderItem item = SnackOrderItem.builder()
                    .snackOrder(order)
                    .snack(snack)
                    .quantity(itemReq.getQuantity())
                    .price(snack.getPrice())  // ← Price Snapshot
                    .build();
            order.getItems().add(item);
        }

        order.setTotalAmount(total);
        // [Cascade ALL] 1 lệnh save → Hibernate tự INSERT cả order + items
        snackOrderRepository.save(order);

        log.info("POS order created: {} - total {}đ, {} items",
                orderCode, total, order.getItems().size());
        return toResponse(order);
    }
}
```

### Cascade ALL — Lưu 1 lần, cả cha lẫn con

```java
@OneToMany(mappedBy = "snackOrder", cascade = CascadeType.ALL, orphanRemoval = true)
private List<SnackOrderItem> items = new ArrayList<>();
```

- **cascade = CascadeType.ALL**: Khi `save(order)` → Hibernate tự `save` tất cả items trong list. Không cần gọi `save(item)` riêng.
- **orphanRemoval = true**: Khi xóa 1 item khỏi list (`order.getItems().remove(item)`) → Hibernate tự DELETE item đó trong DB.

**Ví dụ đời thường:** Giống như khi bạn gửi bưu phẩm có nhiều món đồ bên trong. Gửi 1 lần cả hộp (order) → tất cả đồ bên trong (items) đều đi theo. Không cần gửi từng món riêng.

---

## 23. Voucher — Mã giảm giá

### Voucher là gì?

Voucher (mã giảm giá) cho phép khách hàng nhập mã khi thanh toán để được giảm giá vé xem phim. Đây là tính năng marketing phổ biến: rạp phim phát mã cho khách hàng thân thiết, chương trình khuyến mãi, v.v.

### Cấu trúc dữ liệu

```
Voucher (mã giảm giá)
    |
    +-- code: "SUMMER2026"           (mã voucher, duy nhất, viết hoa)
    +-- description: "Giảm giá hè"   (mô tả)
    +-- discountType: PERCENTAGE     (loại giảm: phần trăm hoặc số tiền cố định)
    +-- discountValue: 20            (giá trị: 20% hoặc 20.000đ)
    +-- minOrderAmount: 100.000      (đơn tối thiểu để áp dụng)
    +-- maxDiscount: 50.000          (giảm tối đa — chỉ dùng cho PERCENTAGE)
    +-- usageLimit: 100              (giới hạn số lượt dùng, null = không giới hạn)
    +-- usedCount: 45                (đã dùng bao nhiêu lượt)
    +-- startDate: 01/06/2026        (ngày bắt đầu hiệu lực)
    +-- endDate: 30/06/2026          (ngày hết hạn)
    +-- active: true                 (admin bật/tắt)

VoucherUsage (lịch sử sử dụng)
    |
    +-- voucher → Voucher            (voucher nào)
    +-- user → User                  (ai dùng)
    +-- booking → Booking            (cho đơn đặt vé nào)
    +-- createdAt                    (thời điểm dùng)
```

### 2 loại giảm giá (DiscountType)

| Loại | Ví dụ | Công thức | Khi nào dùng |
|---|---|---|---|
| **PERCENTAGE** | Giảm 20%, tối đa 50.000đ | `orderAmount × 20% = discount`, cap 50.000 | Đơn lớn (càng mua nhiều càng giảm nhiều) |
| **FIXED_AMOUNT** | Giảm 30.000đ | `discount = 30.000` (cố định) | Đơn nhỏ, khuyến mãi cụ thể |

**Ví dụ tính toán:**

```
Voucher: SUMMER2026 — Giảm 20%, tối đa 50.000đ, đơn tối thiểu 100.000đ

Đơn 200.000đ:
  discount = 200.000 × 20% = 40.000đ (< 50.000 cap → giữ nguyên)
  Thanh toán: 200.000 - 40.000 = 160.000đ

Đơn 500.000đ:
  discount = 500.000 × 20% = 100.000đ (> 50.000 cap → cắt còn 50.000)
  Thanh toán: 500.000 - 50.000 = 450.000đ

Đơn 80.000đ:
  → Lỗi: "Đơn hàng tối thiểu phải là 100.000 VND" (< minOrderAmount)
```

### Luồng validate voucher (5 bước kiểm tra)

```
User nhập mã "SUMMER2026" vào ô voucher
    |
    v
[Frontend] POST /api/vouchers/validate
{ "code": "SUMMER2026", "orderAmount": 200000 }
    |
    v
[VoucherService.validateVoucher()]
    |
    v
Bước 1: Mã tồn tại + chưa bị xóa mềm?
  → findByCode("SUMMER2026")
  → Nếu null hoặc ARCHIVED → "Mã voucher không tồn tại"
    |
    v
Bước 2: Voucher đang active?
  → Nếu active = false → "Voucher chưa được kích hoạt"
    |
    v
Bước 3: Còn trong thời hạn?
  → now PHẢI nằm giữa startDate và endDate
  → Nếu ngoài → "Voucher đã hết hạn hoặc chưa đến ngày áp dụng"
    |
    v
Bước 4: Còn lượt dùng?
  → usageLimit = null hoặc 0 → không giới hạn (OK)
  → usageLimit > 0 VÀ usedCount >= usageLimit → "Voucher đã hết lượt sử dụng"
    |
    v
Bước 5: User này đã dùng voucher này chưa?
  → Kiểm tra bảng VoucherUsage (mỗi user chỉ dùng 1 lần)
  → Nếu đã dùng → "Bạn đã sử dụng voucher này rồi"
    |
    v
Bước 6: Đơn hàng đủ tối thiểu?
  → orderAmount >= minOrderAmount?
  → Nếu không → "Đơn hàng tối thiểu phải là 100.000 VND"
    |
    v
✓ Tất cả OK → Tính discountAmount → Trả về { valid: true, discountAmount: 40000 }
```

### Ghi nhận đã dùng voucher

Sau khi booking được tạo thành công, hệ thống gọi `useVoucherByCode()` để:
1. Tạo bản ghi `VoucherUsage` (ai dùng, cho booking nào)
2. Tăng `usedCount` lên 1

```java
@Transactional
public void useVoucher(Long voucherId, User user, Booking booking) {
    Voucher voucher = voucherRepository.findById(voucherId)
            .orElseThrow(() -> new BusinessException(ErrorCode.VOUCHER_NOT_FOUND));

    // Lưu lịch sử: ai dùng, cho đơn nào
    VoucherUsage usage = VoucherUsage.builder()
            .voucher(voucher)
            .user(user)
            .booking(booking)
            .build();
    voucherUsageRepository.save(usage);

    // Tăng số lượt đã dùng
    voucher.setUsedCount(voucher.getUsedCount() + 1);
    voucherRepository.save(voucher);
}
```

### Lấy danh sách voucher khả dụng

Khi user ở trang thanh toán, hệ thống tự động lọc và hiển thị các voucher mà user có thể dùng:

```
GET /api/vouchers/available?orderAmount=200000

Lọc qua 6 điều kiện:
1. storageState = ACTIVE (chưa bị xóa)
2. active = true (admin bật)
3. startDate <= now <= endDate (trong thời hạn)
4. usedCount < usageLimit (còn lượt — hoặc không giới hạn)
5. orderAmount >= minOrderAmount (đơn đủ tối thiểu)
6. User chưa dùng voucher này (kiểm tra VoucherUsage)

→ Trả về: [ { code: "SUMMER2026", description: "Giảm 20% (tối đa 50.000đ)", discountAmount: 40000 } ]
```

### Voucher Cleanup Scheduler

Hệ thống có scheduler chạy định kỳ để tự động tắt (deactivate) các voucher đã hết hạn, tránh hiển thị voucher không còn giá trị cho user.

### Validation khi admin tạo/sửa voucher

```
Quy tắc nghiệp vụ:
1. PERCENTAGE: discountValue <= 100 (không giảm quá 100%)
2. maxDiscount <= minOrderAmount (giảm tối đa không được lớn hơn đơn tối thiểu)
3. FIXED_AMOUNT: discountValue <= minOrderAmount (giá trị giảm không lớn hơn đơn tối thiểu)
4. endDate > startDate (ngày kết thúc phải sau ngày bắt đầu)
5. code: unique, tự động viết hoa (summer2026 → SUMMER2026)
```

---

## 24. Containerization — Docker

### Docker là gì?

Công cụ đóng gói ứng dụng + môi trường chạy thành **container**. Container giống như "hộp" chứa tất cả thứ cần thiết để chạy ứng dụng.

**Ví dụ đời thường:** Container giống **thùng hàng vận chuyển**. Bất kể hàng gì (Java, SQL Server, Redis) đều đóng vào thùng chuẩn -> chuyển đi đâu cũng chạy được.

### Docker Compose

Công cụ điều phối nhiều container cùng lúc. 1 file `docker-compose.yml` định nghĩa tất cả service.

```yaml
services:
  sqlserver:                              # Service 1: Database
    image: mcr.microsoft.com/mssql/server:2022-latest
    ports: ["1433:1433"]                  # Host:Container

  redis:                                  # Service 2: Cache
    image: redis:7-alpine
    ports: ["6379:6379"]

  backend:                                # Service 3: Spring Boot
    build: ./backend                      # Build từ Dockerfile
    ports: ["8088:8088"]
    depends_on: [sqlserver, redis]        # Khởi động sau DB và Redis

  frontend:                               # Service 4: React
    build: ./frontend
    ports: ["5173:80"]                    # Nginx serve static files
    depends_on: [backend]
```

### Lệnh hay dùng:

```bash
docker-compose up -d               # Khởi động tất cả service
docker-compose up sqlserver redis   # Chỉ khởi động DB và Redis
docker-compose down                 # Tắt tất cả
docker-compose logs backend -f     # Xem log backend
```

---

## 25. Testing — JUnit + Testcontainers

### JUnit 5

**Là gì?**
Framework test cho Java. Mỗi test là 1 method với `@Test`.

### Testcontainers 1.20.4

**Là gì?**
Thư viện khởi động database thật (trong Docker) khi chạy test. Không cần mock database.

```java
@Testcontainers
@SpringBootTest
class BookingServiceTest {

    @Container
    static MSSQLServerContainer<?> sqlServer = new MSSQLServerContainer<>("mcr.microsoft.com/mssql/server:2022-latest")
            .acceptLicense();

    @Test
    void shouldCreateBooking() {
        // Test với SQL Server thật, không phải H2 giả
    }
}
```

---

## 26. Design Patterns — Tổng hợp

### Các pattern đã áp dụng trong CineX

| STT | Pattern | Nhóm | Áp dụng ở đâu | Giải thích |
|---|---|---|---|---|
| 1 | **Repository** | Structural | Mỗi module có Repository | Tách biệt data access khỏi business logic |
| 2 | **DTO** | Structural | Request/Response riêng biệt | Không lộ entity (mật khẩu, ...) ra ngoài |
| 3 | **Builder** | Creational | @Builder của Lombok | Tạo object phức tạp không cần nhiều constructor |
| 4 | **Factory** | Creational | PaymentProcessorFactory | Tạo đúng payment processor theo method |
| 5 | **Strategy** | Behavioral | PaymentProcessor interface | Mỗi cổng thanh toán có xử lý riêng |
| 6 | **Observer** | Behavioral | Spring Events (PaymentCompleted) | Thanh toán xong -> gửi email + thông báo |
| 7 | **State Machine** | Behavioral | BookingStatus (HOLDING->CONFIRMED->...) | Kiểm soát trạng thái hợp lệ |
| 8 | **Specification** | Behavioral | *Specification.java | Tìm kiếm động (WHERE clause) |
| 9 | **Filter Chain** | Behavioral | JwtAuthFilter | Mỗi request đi qua chuỗi filter |
| 10 | **Facade** | Structural | ApiResponse<T> | Bọc mọi response cùng format |
| 11 | **Mapper** | Structural | MapStruct | Chuyển Entity <-> DTO tự động |
| 12 | **Singleton** | Creational | Spring Bean (mặc định) | Mỗi @Service, @Repository chỉ có 1 instance |
| 13 | **Template Method** | Behavioral | BaseEntity | Class cha định nghĩa fields chung |
| 14 | **Cache-aside** | Behavioral | SystemConfigService + Redis | Đọc cache trước, miss thì đọc DB |
| 15 | **Soft Delete** | Behavioral | storageState = ARCHIVED | Xóa mềm, không mất dữ liệu |
| 16 | **Price Snapshot** | — | BookingSeat.price, SnackOrderItem.price | Lưu giá tại thời điểm đặt, không thay đổi |
| 17 | **Scheduled Task** | — | BookingCleanupScheduler | Dọn dẹp booking hết hạn mỗi phút |
| 18 | **Config Table** | — | system_config + cache | Cấu hình động từ DB, không cần restart |
| 19 | **Standalone Repository** | Structural | StatisticsRepository | Query phức tạp JOIN nhiều bảng |

---

## 27. Sơ đồ tổng thể

### Luồng đặt vé (end-to-end)

```
User mở trang phim
    |
    v
[Frontend] GET /api/movies/{id} -----> [Controller] -> [Service] -> [Repository] -> [SQL Server]
    |                                                                                     |
    v                                                                                     |
Hiển thị thông tin phim <------ MovieResponse (DTO, không lộ password) <----- Movie entity
    |
    v
User chọn suất chiếu
    |
    v
[WebSocket] Subscribe /topic/showtime/{id}/seats
    |
    v
Nhận real-time seat map (ghế nào đã có người chọn)
    |
    v
User chọn ghế A1, A2, A3
    |
    v
[Frontend] POST /api/bookings -----> [BookingController]
    { showtimeId, seatIds }              |
                                         v
                                    [BookingService]
                                    1. Kiểm tra số ghế <= max_seats (đọc từ SystemConfig + Redis cache)
                                    2. Lock ghế (PESSIMISTIC_WRITE) -> tránh 2 người chọn cùng ghế
                                    3. Tạo Booking (status = HOLDING, hết hạn 10 phút)
                                    4. Tạo BookingSeat (status = HELD)
                                         |
                                         v
                                    [WebSocket] Gửi cập nhật ghế -> tất cả user đang xem
                                         |
    v                                    |
User nhập voucher (nếu có)              |
    |                                    |
    v                                    |
[Frontend] POST /api/vouchers/validate  |
    { code: "SUMMER2026", orderAmount }  |
    → Kiểm tra hợp lệ → Tính discount  |
    |                                    |
    v                                    |
User chọn phương thức thanh toán        |
    |                                    |
    v                                    |
[Frontend] POST /api/payments -----> [PaymentController]
    { bookingId, method: "MOMO" }        |
                                         v
                                    [PaymentService]
                                    1. PaymentProcessorFactory.get("MOMO")   // Factory Pattern
                                    2. MoMoPaymentProcessor.createPayment(...) // Strategy Pattern
                                         |
                                         v
                                    Redirect -> Trang thanh toán MoMo
                                         |
                                         v
                                    Thanh toán thành công
                                         |
                                         v
                                    [Callback] POST /api/payments/callback
                                         |
                                         v
                                    [PaymentService]
                                    1. Verify giao dịch
                                    2. Payment.status = COMPLETED
                                    3. Booking.status = CONFIRMED
                                    4. BookingSeat.status = BOOKED
                                    5. Ghi nhận voucher đã dùng (VoucherService.useVoucherByCode)
                                    6. Publish PaymentCompletedEvent    // Observer Pattern
                                         |
                                    +----+----+
                                    |         |
                                    v         v
                              [EmailService]  [NotificationService]
                              Gửi email       Gửi thông báo real-time
                              xác nhận        qua WebSocket
                                    |
    v                               |
User nhận email + thông báo         |
Xem vé với QR code                  |
    |                               |
    v                               |
Đến rạp -> Nhân viên quét QR -----> [CheckInService]
                                    Booking.status = CHECKED_IN
```

### Bảng kết nối toàn bộ công nghệ

```
+------------------------------------------------------------------+
|                        FRONTEND                                    |
|                                                                    |
|  React 19 + TypeScript 6 + Vite 8                                |
|  Tailwind CSS 4 + shadcn/ui + Lucide Icons                       |
|  React Hook Form + Zod (form + validation)                       |
|  TanStack Query 5 (server state) + Zustand 5 (client state)      |
|  Axios (HTTP) + @stomp/stompjs (WebSocket)                       |
|  Recharts (biểu đồ) + jsPDF + SheetJS (xuất báo cáo)            |
|  react-qr-code (hiển thị QR) + html5-qrcode (quét QR)           |
|                                                                    |
+-------------------------------+------------------------------------+
                                |
                          HTTP + WebSocket
                                |
+-------------------------------+------------------------------------+
|                        BACKEND                                     |
|                                                                    |
|  Java 21 + Spring Boot 3.3.5                                     |
|  Spring MVC (REST API) + Spring WebSocket (STOMP)                 |
|  Spring Security + JWT (JJWT 0.12.6) + BCrypt                    |
|  Spring Data JPA + Hibernate (ORM)                                |
|  Spring Data Redis (cache) + Spring Mail (email)                  |
|  Liquibase (DB migration) + MapStruct (DTO mapping)              |
|  Lombok (code gen) + ZXing (QR code) + Cloudinary (ảnh)          |
|  SpringDoc OpenAPI (Swagger)                                      |
|  Voucher (mã giảm giá) + POS/SnackOrder (bán hàng tại quầy)    |
|                                                                    |
+-------+----------------+-----------------+------------------------+
        |                |                 |
    SQL Server       Redis 7           Cloudinary
    2022             (cache)           (ảnh CDN)
    (dữ liệu)                          + Mailtrap
                                       (email dev)
+------------------------------------------------------------------+
|                       DOCKER                                       |
|  docker-compose.yml: sqlserver + redis + backend + frontend       |
+------------------------------------------------------------------+
```

---

## PHỤ LỤC: Lệnh chạy dự án

```bash
# 1. Khởi động database + cache
cd /Users/vutuongan/cinex && docker-compose up sqlserver redis -d

# 2. Tạo database (lần đầu)
docker exec cinex-sqlserver-1 /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P 'CineX@2026' -C \
  -Q "CREATE DATABASE cinex"

# 3. Build + chạy backend
cd /Users/vutuongan/cinex/backend && ./gradlew clean build -x test
cd /Users/vutuongan/cinex/backend && ./gradlew bootRun

# 4. Chạy frontend
cd /Users/vutuongan/cinex/frontend && npm run dev

# 5. Truy cập
# Frontend: http://localhost:5173
# Swagger:  http://localhost:8088/swagger-ui.html
```

---

## 28. Thanh toán MoMo Sandbox

### MoMo là gì?

Ví điện tử phổ biến nhất Việt Nam. MoMo cung cấp **môi trường sandbox** (test) cho developer tích hợp thanh toán mà không cần tiền thật.

### Tại sao dùng MoMo Sandbox thay vì Mock?

| | Mock (giả lập) | MoMo Sandbox (thật) |
|---|---|---|
| Giao diện | Trang tự tạo, 2 nút "Thành công/Thất bại" | Trang MoMo **thật** (QR, nhập thẻ, OTP) |
| Hội đồng | "Sao giả thế?" | "Tích hợp cổng thanh toán thật luôn!" |
| Flow | Bấm 1 nút → xong | Quét QR / nhập thẻ / OTP → giống production |
| Code thay đổi | 1 file processor | 1 file processor (Strategy Pattern) |

### Cách hoạt động

```
User chọn "Thanh toán MoMo"
    |
    v
BE tạo request → gọi MoMo API (HMAC-SHA256)
    |
    v
MoMo trả payUrl → FE redirect user đến trang MoMo
    |
    v
User quét QR / nhập thẻ ATM / Visa trên trang MoMo
    |
    v
MoMo redirect về BE callback URL với params (orderId, resultCode, signature)
    |
    v
BE verify chữ ký HMAC-SHA256 → resultCode = 0 → thành công
    |
    v
Booking CONFIRMED + email vé + WebSocket cập nhật ghế
```

### Cấu hình

```yaml
# application.yml
momo:
  partner-code: ${MOMO_PARTNER_CODE:MOMO}        # Mã đối tác (test)
  access-key: ${MOMO_ACCESS_KEY:F8BBA842ECF85}    # Access key (test)
  secret-key: ${MOMO_SECRET_KEY:K951B6PE1waDMi640xX08PD3vg6EkVlz}  # Secret (test)
  api-url: https://test-payment.momo.vn/v2/gateway/api/create
  return-url: http://localhost:8088/api/payments/callback
```

### Thẻ test MoMo Sandbox

```
Cách 1: Quét QR bằng app MoMo Test (Android/iOS)
Cách 2: Thu nhỏ browser → mobile view → F5 → đăng nhập ví
  SĐT: 0123456789
  OTP: 123456

Docs: https://developers.momo.vn/v3/vi/docs/payment/onboarding/test-instructions/
```

### Code chính — MoMoPaymentProcessor.java

```java
@Component("VNPAY")  // Tên trong Factory — FE gửi paymentMethod=VNPAY
public class MoMoPaymentProcessor implements PaymentProcessor {

    // 1. createPayment(): tạo chữ ký HMAC-SHA256 → gọi MoMo API → trả payUrl
    // 2. verifyCallback(): nhận params từ MoMo → verify chữ ký → trả true/false

    // requestType = "payWithMethod" → hiện tất cả: QR + ATM + Visa/Master
}
```

### Strategy Pattern — Thêm cổng mới không sửa code cũ

```
PaymentProcessor (interface)
    ├── MoMoPaymentProcessor   ← đang dùng (MoMo Sandbox)
    ├── CashPaymentProcessor   ← POS tại quầy (tiền mặt)
    ├── VnPayProcessor         ← thêm sau (chỉ tạo class mới)
    └── ZaloPayProcessor       ← thêm sau (chỉ tạo class mới)
```

---

## 29. POS Bán vé tại quầy

### Bài toán

Khách đến quầy rạp mua vé → không có tài khoản, không thanh toán online. Nhân viên chọn suất chiếu + ghế + thu tiền mặt → xuất vé ngay.

### Khác với đặt vé online

| | Đặt vé online (User) | Bán vé tại quầy (Admin POS) |
|---|---|---|
| Cần đăng nhập? | Có (JWT) | Không (khách vãng lai) |
| Hold ghế? | 10 phút → thanh toán → CONFIRMED | **CONFIRMED luôn** (không qua HOLDING) |
| Thanh toán | MoMo Sandbox | Tiền mặt (nhân viên thu) |
| Payment record | VNPAY + COMPLETED | CASH + COMPLETED |
| Booking.user | Bắt buộc | **NULL** (khách vãng lai) |
| Email vé | Gửi tự động | Không gửi (không có email) |

### API

```
POST /api/bookings/counter-sale (Admin only)
Body: { "showtimeId": 1, "seatIds": [5, 6] }

→ Tạo Booking CONFIRMED + BookingSeat BOOKED + Payment CASH COMPLETED
→ WebSocket cập nhật ghế real-time
→ Trả BookingResponse (có bookingCode)
```

### Booking.user nullable

```java
// Entity cho phép user = null (khách vãng lai)
@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "user_id")  // không có nullable=false
private User user;
```

Liquibase migration `027-booking-user-nullable.xml` đổi cột `user_id` từ NOT NULL → nullable.

### FE — Trang POS Bán vé

```
Suất chiếu hôm nay (scroll ngang, chỉ hiện suất còn đặt được)
    ↓ chọn
Sơ đồ ghế (render theo hàng, COUPLE gộp, hỏng đỏ, đã bán xám)
    ↓ chọn ghế
Tóm tắt: phim + giờ + phòng + ghế + breakdown giá + tổng tiền
    ↓ xác nhận
Bán vé thành công → toast mã booking
```

---

## 30. Ghế hỏng (BROKEN)

### Bài toán

Ghế rạp có thể bị hỏng (rách, gãy tay, bảo trì) → không cho khách ngồi nhưng không xóa khỏi sơ đồ.

### Cách xử lý

```
Seat entity có 2 field riêng biệt:
  - seatType: STANDARD / VIP / COUPLE  (loại ghế — không đổi khi hỏng)
  - status: AVAILABLE / BROKEN          (trạng thái — đổi khi hỏng)
```

### Admin đánh dấu ghế hỏng

```
Sơ đồ ghế Editor → chọn tool "Hỏng / Bảo trì" → click ghế
→ Ghế chuyển đỏ, status = BROKEN, giữ nguyên seatType (VIP vẫn là VIP)
→ Đổi loại ghế (click VIP/Thường) → tự khôi phục status = AVAILABLE
```

### User thấy ghế hỏng

```
Trang đặt vé → ghế BROKEN hiện đỏ, cursor not-allowed, không click được
Chú thích: Hỏng = đỏ, Đã bán = xám
```

### BE chặn đặt ghế hỏng

```java
// BookingService.holdSeats() + counterSale()
List<String> brokenSeats = seats.stream()
    .filter(s -> s.getStatus() == SeatStatus.BROKEN)
    .map(Seat::getSeatNumber).toList();
if (!brokenSeats.isEmpty()) {
    throw new BusinessException("Ghế đang bảo trì: " + String.join(", ", brokenSeats));
}
```

### Màu sắc ghế đồng bộ 3 nơi

| Trạng thái | User đặt vé | Admin Editor | Admin POS |
|---|---|---|---|
| Thường | Xanh lá | Xanh lá | Xanh lá |
| VIP | Vàng | Vàng | Vàng |
| Đôi | Tím | Tím | Tím |
| Đang chọn | Gold | — | Gold |
| Đã bán | Xám | — | Xám |
| Hỏng | Đỏ | Đỏ | Đỏ |

---

## 31. Cấu hình động (System Config)

### Bài toán

Các giá trị business logic (thời gian giữ ghế, số ghế tối đa, buffer vệ sinh...) nếu hardcode trong code → muốn thay đổi phải sửa code + deploy lại.

### Giải pháp — Bảng system_config + Redis cache

```
Admin thay đổi config trên UI
    → Lưu vào bảng system_config (DB)
    → Invalidate Redis cache
    → Lần đọc tiếp theo: đọc từ DB → lưu vào cache → lần sau đọc cache

Code đọc config:
    int maxSeats = systemConfigService.getInt("booking.max_seats", 8);
    //                                        ↑ key trong DB        ↑ default nếu chưa có
```

### 6 config động hiện có

| Key | Default | Mô tả |
|---|---|---|
| `booking.hold_minutes` | 10 | Thời gian giữ ghế khi đặt vé (phút) |
| `booking.max_seats` | 8 | Tối đa số ghế mỗi lần đặt vé |
| `booking.cutoff_after_start_minutes` | 15 | Cho đặt vé trong X phút sau khi suất chiếu bắt đầu |
| `booking.cancel_before_minutes` | 60 | Hủy vé trước X phút khi suất chiếu bắt đầu |
| `showtime.buffer_minutes` | 15 | Thời gian vệ sinh phòng giữa 2 suất chiếu |
| `auth.reset_token_expiry_minutes` | 15 | Token đặt lại mật khẩu hết hạn sau X phút |

### Cache-aside Pattern

```
Đọc config:
    Redis có?  → trả về (< 1ms)
    Redis không có? → đọc DB → lưu Redis (TTL 5 phút) → trả về

Sửa config:
    Update DB → xóa Redis cache → lần đọc tiếp đọc DB mới
```

---

## 32. Phim "Đang chiếu" theo suất chiếu thực tế

### Cách cũ (sai)

```
Admin set status: NOW_SHOWING / COMING_SOON / ENDED
+ Scheduler tự đổi theo releaseDate/endDate
→ Phim NOW_SHOWING nhưng không có suất chiếu nào → vẫn hiện
→ Phim hết suất nhưng endDate chưa tới → vẫn hiện "Đang chiếu"
```

### Cách mới (chuẩn rạp CGV/Lotte)

```
"Đang chiếu" = phim có ít nhất 1 suất chiếu chưa kết thúc (endTime >= now)
"Sắp chiếu"  = admin set status COMING_SOON

SQL:
WHERE EXISTS (
    SELECT 1 FROM showtimes s
    WHERE s.movie_id = m.id AND s.end_time >= NOW()
    AND s.storage_state != 'ARCHIVED'
)
```

### Tại sao dùng endTime thay vì startTime?

```
Suất 10:00-11:30, bây giờ 11:00 (đang chiếu dở)
  startTime >= now → FALSE (10:00 < 11:00) → phim biến mất khi đang chiếu!
  endTime >= now   → TRUE (11:30 >= 11:00) → phim vẫn hiện đến 11:30 ✓
```

### Code — MovieSpecification.java

```java
public static Specification<Movie> hasActiveShowtimes() {
    return (root, query, cb) -> {
        Subquery<Long> sub = query.subquery(Long.class);
        Root<Showtime> showtime = sub.from(Showtime.class);
        sub.select(cb.literal(1L));
        sub.where(
            cb.equal(showtime.get("movie"), root),
            cb.greaterThanOrEqualTo(showtime.get("endTime"), LocalDateTime.now()),
            // ... filter ARCHIVED
        );
        return cb.exists(sub);
    };
}
```

---

> **Ghi chú:** Tài liệu này viết bằng tiếng Việt có dấu đầy đủ.
> Đọc kết hợp với các file *-explained.md trong /docs/module-guides/ để hiểu chi tiết từng module.
