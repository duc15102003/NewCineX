# Java & Spring Boot — Nền tảng từ gốc

> Giải thích từ zero: Java chạy thế nào, JAR là gì, Spring container hoạt động ra sao, tại sao viết annotation là mọi thứ tự hoạt động.

---

## 1. Java chạy như thế nào?

### Luồng từ code → chạy

```
BẠN VIẾT: AuthService.java (file text)
      │
      ▼ javac (compiler)
FILE .class: AuthService.class (bytecode — máy hiểu)
      │
      ▼ JVM (Java Virtual Machine)
CHẠY trên máy tính (Windows/Mac/Linux đều được)
```

### Ví dụ đời thường

| Bước | Ví dụ |
|---|---|
| `.java` file | Bài luận tiếng Việt |
| `javac` compiler | Phiên dịch viên |
| `.class` bytecode | Bản dịch tiếng Anh |
| JVM | Người Anh đọc bản dịch → thực hiện |

### Tại sao cần bước trung gian (bytecode)?

Java gọi là "Write Once, Run Anywhere" (viết 1 lần, chạy mọi nơi):
- Code Java → compile → bytecode (chung cho mọi máy)
- JVM trên Windows đọc bytecode → chạy trên Windows
- JVM trên Mac đọc bytecode → chạy trên Mac
- CÙNG 1 file bytecode, chạy được ở MỌI NƠI có JVM

So sánh: C/C++ compile ra file riêng cho mỗi hệ điều hành → phải compile lại khi đổi máy.

---

## 2. JDK, JRE, JVM — Ba anh em

```
┌──────────────────────────────────────────┐
│ JDK (Java Development Kit)               │  ← BẠN CÀI CÁI NÀY (JDK 21)
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ JRE (Java Runtime Environment)     │  │  ← Môi trường chạy
│  │                                    │  │
│  │  ┌──────────────────────────────┐  │  │
│  │  │ JVM (Java Virtual Machine)   │  │  │  ← Máy ảo thực thi bytecode
│  │  │ ├── Class Loader             │  │  │
│  │  │ ├── Memory Manager (GC)      │  │  │
│  │  │ └── Execution Engine         │  │  │
│  │  └──────────────────────────────┘  │  │
│  │  + Thư viện chuẩn (java.util, ...) │  │
│  └────────────────────────────────────┘  │
│  + javac (compiler)                      │
│  + jar (đóng gói)                        │
│  + javadoc, jdb, ...                     │
└──────────────────────────────────────────┘
```

| Cái gì | Dùng khi nào | Ai cần |
|---|---|---|
| **JDK** | Lập trình (compile + run) | Developer |
| **JRE** | Chỉ chạy (không compile) | Server production |
| **JVM** | Engine bên trong JRE | Tự động |

**CineX dùng JDK 21** — phiên bản LTS (Long Term Support), hỗ trợ đến 2029.

---

## 3. JAR file — Đóng gói ứng dụng

### JAR là gì?

**J**ava **AR**chive = file ZIP chứa tất cả code đã compile (.class) + resources + metadata.

### Ví dụ đời thường

| Khái niệm | Ví dụ |
|---|---|
| `.java` files | Nguyên liệu thô (rau, thịt, gia vị) |
| Compile → `.class` | Nấu thành món ăn |
| Đóng JAR | Đóng hộp thành **hộp cơm** mang đi |
| Chạy JAR | Ai có JVM (miệng) thì **mở hộp ăn** được |

### Bên trong file JAR

```
backend-0.0.1-SNAPSHOT.jar (≈50MB)
├── BOOT-INF/
│   ├── classes/                          ← Code CineX đã compile
│   │   ├── com/cinex/CineXApplication.class
│   │   ├── com/cinex/module/auth/...
│   │   └── application.yml, db/changelog/...
│   └── lib/                              ← TẤT CẢ thư viện (dependencies)
│       ├── spring-boot-3.3.5.jar
│       ├── spring-security-6.x.jar
│       ├── hibernate-core-6.x.jar
│       ├── mssql-jdbc-12.x.jar
│       └── ... (100+ file jar)
├── META-INF/
│   └── MANIFEST.MF                       ← Metadata: main class, version
└── org/springframework/boot/loader/      ← Spring Boot launcher
```

### Fat JAR (Spring Boot)

Spring Boot tạo **Fat JAR** (hay Uber JAR) = 1 file chứa TẤT CẢ:
- Code của bạn
- Tất cả thư viện (Spring, Hibernate, JDBC driver, ...)
- Web server nhúng (Tomcat)

→ Chỉ cần **1 lệnh** để chạy:
```bash
java -jar backend-0.0.1-SNAPSHOT.jar
# Xong! Server chạy tại port 8088. Không cần cài thêm gì.
```

### So sánh với cách cũ

| Cách cũ (WAR + Tomcat riêng) | Cách mới (Spring Boot Fat JAR) |
|---|---|
| Cài Tomcat server riêng | Tomcat nhúng SẴN trong JAR |
| Deploy WAR file vào Tomcat | Chỉ cần `java -jar app.jar` |
| Cấu hình Tomcat phức tạp | Cấu hình trong application.yml |
| Mỗi server = 1 Tomcat chung cho nhiều app | Mỗi app = 1 JAR độc lập |

### Trong CineX

```bash
# Build → sinh ra JAR
./gradlew build
# File JAR nằm ở:
# backend/build/libs/backend-0.0.1-SNAPSHOT.jar

# Chạy trực tiếp (production)
java -jar build/libs/backend-0.0.1-SNAPSHOT.jar

# Hoặc chạy dev (Gradle lo compile + chạy)
./gradlew bootRun
```

---

## 4. Classpath — Java tìm code ở đâu?

### Là gì?

Classpath = **danh sách thư mục/JAR** mà JVM tìm kiếm class. Giống PATH trên terminal.

### Ví dụ đời thường

Bạn viết: `import com.cinex.security.JwtUtil`

JVM hỏi: "JwtUtil ở đâu?" → tìm trong classpath:
1. `backend/build/classes/` → tìm thấy `com/cinex/security/JwtUtil.class` ✓
2. Nếu không có → tìm trong các JAR khác (thư viện)
3. Vẫn không có → `ClassNotFoundException` ❌

### Classpath trong CineX

```
Classpath gồm:
├── build/classes/java/main/        ← Code bạn viết (compile rồi)
├── build/resources/main/           ← application.yml, db/changelog/...
└── Tất cả JAR trong dependencies:
    ├── spring-boot-starter-web.jar
    ├── spring-boot-starter-data-jpa.jar
    ├── jjwt-api-0.12.6.jar
    └── ...
```

### Tại sao quan trọng?

Khi bạn viết:
```java
import io.jsonwebtoken.Jwts;  // Thư viện bên ngoài
```

JVM tìm class `io.jsonwebtoken.Jwts`:
- Tìm trong `jjwt-api-0.12.6.jar` (đã khai báo trong build.gradle) → THẤY ✓
- Nếu QUÊN khai báo trong build.gradle → JAR không có trong classpath → LỖI compile

→ Đó là lý do phải khai báo dependency trong `build.gradle`: để Gradle download JAR + thêm vào classpath.

---

## 5. Gradle — Build Tool

### Gradle là gì?

Công cụ **tự động hóa**: download thư viện, compile code, chạy test, đóng JAR.

### Ví dụ đời thường

Gradle = **đầu bếp robot**:
1. Bạn viết menu (build.gradle): "Tôi cần Spring Boot, JWT, SQL Server driver"
2. Robot đi siêu thị (Maven Central): download tất cả JAR
3. Robot nấu (compile): .java → .class
4. Robot đóng hộp (package): tất cả → 1 file JAR
5. Robot test (test): chạy unit test, báo pass/fail

### Gradle Wrapper (gradlew)

```bash
./gradlew build    # Linux/Mac
gradlew.bat build  # Windows
```

**Tại sao dùng `./gradlew` thay vì `gradle`?**

| `gradle` (cài trên máy) | `./gradlew` (wrapper trong project) |
|---|---|
| Mỗi dev có thể cài version khác | Tất cả dùng CÙNG version (trong `gradle-wrapper.properties`) |
| Phải tự cài | Tải project về là chạy được luôn |
| "Trên máy tôi chạy, máy bạn lỗi" | Đảm bảo ai cũng giống nhau |

### Lệnh Gradle thường dùng

```bash
./gradlew clean           # Xóa build cũ (thư mục build/)
./gradlew build           # Compile + test + đóng JAR
./gradlew build -x test   # Build BỎ QUA test (nhanh hơn)
./gradlew bootRun         # Compile + chạy server ngay (dev mode)
./gradlew dependencies    # Xem cây dependency (ai phụ thuộc ai)
```

### build.gradle đọc thế nào?

```groovy
plugins {
    id 'java'                                        // Plugin Java: compile .java
    id 'org.springframework.boot' version '3.3.5'    // Plugin Spring Boot: đóng fat JAR
    id 'io.spring.dependency-management' version '1.1.6'  // Quản lý version tự động
}

group = 'com.cinex'          // Package gốc
version = '0.0.1-SNAPSHOT'   // Version ứng dụng (SNAPSHOT = đang phát triển)

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)  // Dùng Java 21
    }
}

repositories {
    mavenCentral()   // Kho thư viện công cộng (giống npm registry cho JS)
                     // URL: https://repo1.maven.org/maven2/
}

dependencies {
    // implementation: code sản phẩm cần (giống "dependencies" của package.json)
    implementation 'org.springframework.boot:spring-boot-starter-web'

    // runtimeOnly: chỉ cần khi CHẠY, không cần khi compile
    runtimeOnly 'com.microsoft.sqlserver:mssql-jdbc'

    // compileOnly: chỉ cần khi COMPILE, không đóng vào JAR
    compileOnly 'org.projectlombok:lombok'

    // annotationProcessor: chạy lúc compile để SINH CODE
    annotationProcessor 'org.projectlombok:lombok'

    // testImplementation: chỉ dùng trong test
    testImplementation 'org.springframework.boot:spring-boot-starter-test'
}
```

### So sánh scope

| Gradle scope | npm tương đương | Ý nghĩa |
|---|---|---|
| `implementation` | `dependencies` | Code chính cần |
| `testImplementation` | `devDependencies` (test) | Chỉ test cần |
| `runtimeOnly` | — | Chạy cần, compile không cần |
| `compileOnly` | — | Compile cần, chạy không cần |
| `annotationProcessor` | — | Tool sinh code lúc compile |

---

## 6. Spring Container (IoC Container) — "Nhà máy" quản lý Bean

### Vấn đề: Ứng dụng lớn có hàng trăm class phụ thuộc nhau

```
AuthController → AuthService → UserRepository → DataSource → Connection Pool → ...
MovieController → MovieService → MovieRepository → DataSource → ...
BookingService → SeatRepository, ShowtimeRepository, PaymentService, EmailService → ...
```

Ai tạo object? Ai quản lý vòng đời? Ai inject dependency?

→ **Spring Container** lo hết.

### IoC là gì?

**I**nversion **o**f **C**ontrol = **Đảo ngược quyền kiểm soát**

| Không có IoC | Có IoC (Spring) |
|---|---|
| BẠN tạo object: `new AuthService(...)` | SPRING tạo object cho bạn |
| BẠN quản lý vòng đời | SPRING quản lý |
| BẠN nối dependency | SPRING tự nối (DI) |
| BẠN quyết định khi nào tạo/hủy | SPRING quyết định |

### Ví dụ đời thường

**Không có IoC** = Tự nấu ăn:
- Bạn phải đi chợ mua nguyên liệu (tạo dependency)
- Bạn phải biết công thức (biết constructor)
- Bạn phải nấu đúng thứ tự (quản lý thứ tự khởi tạo)
- Bạn phải rửa bát (hủy object)

**Có IoC (Spring)** = Gọi Grab Food:
- Bạn chỉ nói "Tôi muốn phở" (khai báo dependency)
- Nhà hàng (Spring) lo tất cả: mua nguyên liệu, nấu, giao hàng
- Bạn chỉ cần **ăn** (dùng object)

### Spring Container hoạt động thế nào?

```
         ┌─── SPRING CONTAINER ───────────────────────────────┐
         │                                                     │
KHỞI ĐỘNG│  1. Quét classpath → tìm @Component, @Service, ... │
    │     │  2. Tạo Bean cho mỗi class tìm thấy               │
    │     │  3. Phân tích dependency (ai cần ai)               │
    │     │  4. Inject dependency (DI)                         │
    │     │  5. Gọi @PostConstruct (init)                      │
    │     │  6. Bean SẴN SÀNG sử dụng                          │
    ▼     │                                                     │
         │  ┌─────────────────────────────────────────────────┐ │
         │  │ Bean Pool:                                       │ │
         │  │  • authController (singleton)                    │ │
         │  │  • authService (singleton)                       │ │
         │  │  • userRepository (singleton)                    │ │
         │  │  • jwtUtil (singleton)                           │ │
         │  │  • passwordEncoder (singleton)                   │ │
         │  │  • dataSource (singleton)                        │ │
         │  │  • ... (hàng trăm bean)                          │ │
         │  └─────────────────────────────────────────────────┘ │
         │                                                     │
TẮT APP  │  7. Gọi @PreDestroy (cleanup)                       │
    │     │  8. Hủy tất cả Bean                                │
    ▼     │  9. Đóng container                                 │
         └─────────────────────────────────────────────────────┘
```

### Singleton — Mỗi Bean chỉ có 1 instance

```java
@Service
public class AuthService { }

// Spring CHỈ tạo 1 object AuthService duy nhất
// Tất cả class inject AuthService → nhận CÙNG 1 object
// → Tiết kiệm bộ nhớ, đảm bảo state nhất quán
```

**Ví dụ:** 1000 request đồng thời gọi API → tất cả đều dùng CÙNG 1 AuthService object.

**Hệ quả:** KHÔNG lưu state (biến instance) trong Service!
```java
@Service
public class AuthService {
    private int count = 0;  // ❌ SAI! 1000 request chia sẻ biến này → race condition

    private final UserRepository userRepo;  // ✓ ĐÚNG! final, inject 1 lần, không đổi
}
```

---

## 7. Bean Lifecycle — Vòng đời của Bean

```
┌─────────────────────────────────────────────────────────┐
│                    VÒNG ĐỜI BEAN                         │
│                                                         │
│  1. Instantiation     ← Spring gọi constructor          │
│       │                  (new AuthService(repo, jwt))    │
│       ▼                                                 │
│  2. Dependency Inject ← Spring inject các field/param   │
│       │                  (userRepo, jwtUtil, ...)        │
│       ▼                                                 │
│  3. @PostConstruct    ← Method chạy SAU KHI inject xong │
│       │                  (init cache, validate config)   │
│       ▼                                                 │
│  4. BEAN SẴN SÀNG    ← Nhận request, xử lý logic       │
│       │                  (suốt thời gian app chạy)      │
│       ▼                                                 │
│  5. @PreDestroy       ← Method chạy TRƯỚC KHI app tắt  │
│       │                  (đóng connection, flush cache)  │
│       ▼                                                 │
│  6. BEAN BỊ HỦY      ← Garbage collected               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Ví dụ thực tế

```java
@Service
public class SystemConfigService {

    private final SystemConfigRepository configRepo;
    private Map<String, String> cache;  // Cache config trong memory

    // Bước 1+2: Constructor + Inject
    public SystemConfigService(SystemConfigRepository configRepo) {
        this.configRepo = configRepo;
    }

    @PostConstruct  // Bước 3: Chạy sau inject
    public void init() {
        // Load tất cả config từ DB vào cache
        // → Sau này đọc config không cần query DB mỗi lần
        this.cache = configRepo.findAll().stream()
            .collect(Collectors.toMap(c -> c.getKey(), c -> c.getValue()));
        log.info("Loaded {} configs into cache", cache.size());
    }

    @PreDestroy  // Bước 5: Chạy trước khi app tắt
    public void cleanup() {
        log.info("Flushing config cache...");
        this.cache.clear();
    }
}
```

---

## 8. Auto-Configuration — "Phép thuật" Spring Boot

### Vấn đề: Spring thuần (không Boot) cần CẤU HÌNH RẤT NHIỀU

```java
// Ngày xưa (Spring MVC thuần) — phải viết tay TẤT CẢ:
@Configuration
public class WebConfig {
    @Bean public DispatcherServlet dispatcherServlet() { ... }
    @Bean public InternalResourceViewResolver viewResolver() { ... }
    @Bean public HandlerMapping handlerMapping() { ... }
    @Bean public HandlerAdapter handlerAdapter() { ... }
    @Bean public MessageConverter jsonConverter() { ... }
    // ... 50+ dòng config
}

@Configuration
public class DataSourceConfig {
    @Bean public DataSource dataSource() { ... }
    @Bean public EntityManagerFactory entityManagerFactory() { ... }
    @Bean public TransactionManager transactionManager() { ... }
    // ... 30+ dòng config
}
```

### Spring Boot Auto-Configuration: "Tôi lo cho bạn"

```java
// Bây giờ (Spring Boot) — KHÔNG CẦN viết gì:
@SpringBootApplication  // 1 annotation = xong
public class CineXApplication {
    public static void main(String[] args) {
        SpringApplication.run(CineXApplication.class, args);
    }
}
// Spring Boot TỰ ĐỘNG cấu hình tất cả dựa trên classpath
```

### Cơ chế hoạt động

```
Spring Boot khởi động
    │
    ▼
Quét classpath: thư viện nào có trong project?
    │
    ├── Thấy spring-boot-starter-web.jar?
    │   → Tự cấu hình: Tomcat + Jackson + DispatcherServlet
    │   → KHÔNG CẦN bạn viết WebConfig
    │
    ├── Thấy spring-boot-starter-data-jpa.jar?
    │   → Tự cấu hình: EntityManager + TransactionManager
    │   → Đọc application.yml lấy datasource URL
    │   → KHÔNG CẦN bạn viết DataSourceConfig
    │
    ├── Thấy spring-boot-starter-security.jar?
    │   → Tự cấu hình: SecurityFilterChain mặc định
    │   → Tất cả URL cần auth (bạn override để tùy chỉnh)
    │
    ├── Thấy spring-boot-starter-data-redis.jar?
    │   → Tự cấu hình: RedisTemplate + ConnectionFactory
    │   → Đọc spring.data.redis.host/port từ yml
    │
    ├── Thấy springdoc-openapi.jar?
    │   → Tự cấu hình: Swagger UI + API docs endpoint
    │
    └── Thấy liquibase-core.jar?
        → Tự chạy migration khi start
        → Đọc spring.liquibase.change-log từ yml
```

### Ví dụ đời thường

**Khách sạn thông minh:**
- Bạn book phòng (thêm dependency vào build.gradle)
- Bạn đến → phòng đã có sẵn: giường, TV, wifi, điều hòa (auto-config)
- Bạn muốn thay gối → gọi lễ tân (override config bằng yml hoặc @Configuration)
- Bạn KHÔNG cần tự lắp giường, kéo dây điện, cài wifi

### Override Auto-Configuration

Auto-config là **mặc định**. Bạn có thể **ghi đè** bất kỳ lúc nào:

```java
// Spring Boot tự tạo SecurityFilterChain mặc định (chặn tất cả)
// Bạn OVERRIDE bằng cách viết Bean riêng:
@Configuration
public class SecurityConfig {

    @Bean  // ← Bean của bạn THAY THẾ Bean mặc định
    public SecurityFilterChain securityFilterChain(HttpSecurity http) {
        // Cấu hình riêng cho CineX
        return http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(s -> s.sessionCreationPolicy(STATELESS))
            // ...
            .build();
    }
}
```

**Nguyên tắc:** Nếu bạn khai báo Bean cùng type → Spring dùng CỦA BẠN, bỏ qua auto-config.

---

## 9. @SpringBootApplication — 3 annotation trong 1

```java
@SpringBootApplication
// = @Configuration + @EnableAutoConfiguration + @ComponentScan
public class CineXApplication {
    public static void main(String[] args) {
        SpringApplication.run(CineXApplication.class, args);
    }
}
```

| Annotation ẩn | Tác dụng |
|---|---|
| `@Configuration` | Class này chứa cấu hình (có thể khai báo @Bean) |
| `@EnableAutoConfiguration` | BẬT auto-config (đọc classpath → cấu hình tự động) |
| `@ComponentScan` | Quét package `com.cinex` + sub-packages → tìm @Component, @Service, ... |

### ComponentScan hoạt động thế nào?

```
CineXApplication.java nằm ở: com.cinex
    │
    ▼ @ComponentScan quét TẤT CẢ package bên dưới:
    │
    ├── com.cinex.common.config       → tìm @Configuration (SecurityConfig, ...)
    ├── com.cinex.common.exception    → tìm @RestControllerAdvice
    ├── com.cinex.security            → tìm @Component (JwtUtil, JwtAuthFilter)
    ├── com.cinex.module.auth         → tìm @Service, @RestController, @Repository
    ├── com.cinex.module.movie        → tìm ...
    └── com.cinex.module.booking      → tìm ...

Kết quả: MỌI class có annotation → Spring tạo Bean → quản lý
```

**Lưu ý:** Nếu class nằm NGOÀI `com.cinex.*` → Spring KHÔNG quét → KHÔNG tạo Bean → inject sẽ lỗi.

---

## 10. Thứ tự khởi động Spring Boot

```
1.  main() gọi SpringApplication.run()
        │
2.  ▼ Tạo ApplicationContext (Container)
        │
3.  ▼ Đọc application.yml → load config
        │
4.  ▼ ComponentScan → tìm tất cả class có annotation
        │
5.  ▼ Auto-Configuration → cấu hình tự động theo classpath
        │
6.  ▼ Tạo Bean theo thứ tự dependency:
        │   DataSource → EntityManagerFactory → Repository → Service → Controller
        │   (Spring tự sắp xếp thứ tự)
        │
7.  ▼ Inject dependency vào từng Bean
        │
8.  ▼ Gọi @PostConstruct methods
        │
9.  ▼ Liquibase chạy migration (tạo/sửa bảng DB)
        │
10. ▼ Khởi động Tomcat embedded (port 8088)
        │
11. ▼ Log: "Started CineXApplication in 4.5 seconds"
        │
12. ▼ SẴN SÀNG nhận HTTP request
```

### Khi request đến:

```
Client: POST /api/auth/login
        │
1.  ▼ Tomcat nhận request
        │
2.  ▼ Spring DispatcherServlet → tìm Controller match URL
        │
3.  ▼ Filter chain chạy: JwtAuthFilter → kiểm tra token
        │
4.  ▼ AuthController.login() được gọi
        │
5.  ▼ Controller gọi AuthService (đã inject sẵn)
        │
6.  ▼ AuthService gọi UserRepository (đã inject sẵn)
        │
7.  ▼ Repository gọi DB → trả kết quả
        │
8.  ▼ Service xử lý logic → trả DTO
        │
9.  ▼ Controller trả ApiResponse
        │
10. ▼ Jackson serialize → JSON
        │
11. ▼ Tomcat gửi HTTP response cho client
```

---

## 11. Dependency Injection — Đi sâu hơn

### Tại sao DI quan trọng? (3 lợi ích chính)

#### Lợi ích 1: Loose Coupling (Giảm ràng buộc)

```java
// ❌ KHÔNG DI: AuthService biết CHÍNH XÁC implementation
public class AuthService {
    private BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
    // → Muốn đổi sang Argon2 encoder? Phải SỬA code AuthService
}

// ✓ CÓ DI: AuthService chỉ biết INTERFACE
public class AuthService {
    private final PasswordEncoder encoder;  // Interface, không biết impl cụ thể
    // → Đổi BCrypt → Argon2? Chỉ sửa config, KHÔNG sửa AuthService
}

@Configuration
public class SecurityConfig {
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();  // Đổi ở ĐÂY, 1 chỗ duy nhất
        // return new Argon2PasswordEncoder();  // Muốn đổi → sửa 1 dòng
    }
}
```

#### Lợi ích 2: Testable (Dễ test)

```java
// ❌ KHÔNG DI: Không thể mock
public class AuthService {
    private UserRepository repo = new UserRepositoryImpl();  // Kết nối DB thật
    // Test = phải có DB thật → chậm, phức tạp
}

// ✓ CÓ DI: Truyền mock object vào constructor
@Test
void testLogin() {
    UserRepository mockRepo = mock(UserRepository.class);  // Giả lập, không cần DB
    when(mockRepo.findByUsername("admin")).thenReturn(Optional.of(adminUser));

    AuthService service = new AuthService(mockRepo, mockEncoder, mockJwt);
    // Test nhanh, không cần DB, không cần network
}
```

#### Lợi ích 3: Quản lý lifecycle tập trung

Spring quản lý: khi nào tạo, khi nào hủy, mấy instance, scope nào.
- Singleton (mặc định): 1 instance cho cả app
- Prototype: mỗi lần inject = 1 instance mới
- Request: 1 instance per HTTP request

---

## 12. Embedded Server — Web server nhúng

### Ngày xưa vs bây giờ

```
NGÀY XƯA (Java EE):
┌─────────────────────────────┐
│ Tomcat Server (cài riêng)    │  ← Phải cài trước
│ ├── webapp1.war              │  ← Deploy file WAR vào
│ ├── webapp2.war              │
│ └── webapp3.war              │
└─────────────────────────────┘
• 3 app chia sẻ 1 Tomcat → conflict version, restart ảnh hưởng nhau

BÂY GIỜ (Spring Boot):
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ App 1            │  │ App 2            │  │ App 3            │
│ ├── Code         │  │ ├── Code         │  │ ├── Code         │
│ └── Tomcat nhúng │  │ └── Tomcat nhúng │  │ └── Jetty nhúng  │
└──────────────────┘  └──────────────────┘  └──────────────────┘
• Mỗi app có server riêng → độc lập hoàn toàn
• Chỉ cần JVM, không cần cài gì thêm
```

### Trong CineX

```yaml
# application.yml
server:
  port: 8088   # Tomcat nhúng lắng nghe ở port này
```

Khi `./gradlew bootRun`:
1. Spring Boot khởi tạo Tomcat embedded
2. Tomcat bind port 8088
3. Đăng ký DispatcherServlet (router HTTP requests)
4. Sẵn sàng nhận request

---

## 13. Tổng kết — Bản đồ kiến thức

```
┌─────────────────────────────────────────────────────────────────┐
│                         SPRING BOOT                              │
│                                                                 │
│  build.gradle ──→ Gradle download JARs ──→ Classpath            │
│       │                                        │                │
│       ▼                                        ▼                │
│  @SpringBootApplication                   Auto-Configuration    │
│  ├── @ComponentScan (quét class)          (dựa trên classpath)  │
│  └── @EnableAutoConfiguration                  │                │
│       │                                        │                │
│       ▼                                        ▼                │
│  ┌─── Spring Container (IoC) ──────────────────────────────┐    │
│  │                                                         │    │
│  │  @Configuration → @Bean (tạo Bean thủ công)             │    │
│  │  @Service, @Controller, @Repository (tạo Bean tự động)  │    │
│  │                                                         │    │
│  │  DI: Constructor Injection (final fields)               │    │
│  │  Lifecycle: create → inject → @PostConstruct → use      │    │
│  │  Scope: Singleton (mặc định)                            │    │
│  │                                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│       │                                                         │
│       ▼                                                         │
│  Embedded Tomcat (port 8088)                                    │
│  ├── Filter: JwtAuthFilter                                      │
│  ├── Controller: AuthController, MovieController, ...           │
│  ├── Service: AuthService, MovieService, ...                    │
│  └── Repository: UserRepository, ... → SQL Server               │
│                                                                 │
│  application.yml → @Value, @ConfigurationProperties             │
│  Liquibase → DB migration tự động                               │
│                                                                 │
│  Build: ./gradlew build → Fat JAR (all-in-one)                  │
│  Run:   java -jar app.jar (chỉ cần JVM, không cần gì khác)     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 14. Câu hỏi tự kiểm tra

1. **JAR là gì?** Tại sao Spring Boot tạo "Fat JAR"? Khác JAR thường thế nào?

2. **Classpath là gì?** Khi bạn viết `import io.jsonwebtoken.Jwts`, JVM tìm class này ở đâu?

3. **Nếu xóa `@Service` khỏi AuthService thì điều gì xảy ra?** Controller inject AuthService có lỗi không?

4. **Auto-Configuration hoạt động thế nào?** Tại sao chỉ cần thêm `spring-boot-starter-data-redis` vào build.gradle là Redis tự hoạt động?

5. **Tại sao Bean mặc định là Singleton?** Nếu 2 request đồng thời gọi cùng 1 Service, có bị conflict không?

6. **Constructor injection vs @Autowired?** Tại sao CineX dùng constructor injection (RequiredArgsConstructor)?

7. **`./gradlew` vs `gradle`?** Tại sao luôn dùng wrapper thay vì cài Gradle trên máy?
