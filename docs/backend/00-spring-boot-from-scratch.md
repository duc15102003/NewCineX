# Tạo Dự Án Spring Boot Từ Đầu — Hướng Dẫn Chi Tiết

> **Đối tượng:** Sinh viên chưa biết gì về Spring Boot, muốn hiểu SÂU từ bước đầu tiên.
> **Dự án mẫu:** CineX — Hệ thống đặt vé xem phim online.

---

## Mục lục

1. [Cài đặt môi trường](#1-cai-dat-moi-truong)
2. [Tạo project Spring Boot](#2-tao-project-spring-boot)
3. [Cấu hình build.gradle](#3-cau-hinh-buildgradle)
4. [Cấu hình application.yml](#4-cau-hinh-applicationyml)
5. [Tạo cấu trúc package](#5-tao-cau-truc-package)
6. [Tạo BaseEntity](#6-tao-baseentity)
7. [Tạo ApiResponse wrapper](#7-tao-apiresponse-wrapper)
8. [Tạo module đầu tiên (User)](#8-tao-module-dau-tien-user)
9. [Chạy và test](#9-chay-va-test)

---

## 1. Cài đặt môi trường

### 1.1. Cài JDK 21

**Tại sao cần JDK 21?**
JDK (Java Development Kit) là bộ công cụ để viết và chạy code Java. Spring Boot 3.x yêu cầu **tối thiểu Java 17**, nhưng chúng ta dùng **Java 21** vì đây là phiên bản LTS (Long Term Support — được hỗ trợ lâu dài, giống như Windows 10 được hỗ trợ nhiều năm hơn Windows 8).

#### Cách 1: Dùng SDKMAN (khuyên dùng cho macOS/Linux)

SDKMAN giống như "app store" cho các công cụ Java — cài, chuyển đổi version dễ dàng:

```bash
# Cài SDKMAN
curl -s "https://get.sdkman.io" | bash
source "$HOME/.sdkman/bin/sdkman-init.sh"

# Xem các phiên bản Java có thể cài
sdk list java

# Cài JDK 21 (Temurin — bản miễn phí của Eclipse Foundation)
sdk install java 21.0.3-tem

# Kiểm tra
java -version
# openjdk version "21.0.3" ...
```

#### Cách 2: Download trực tiếp

- Vào [https://adoptium.net/](https://adoptium.net/)
- Chọn **JDK 21**, hệ điều hành của bạn (macOS/Windows/Linux)
- Tải về, cài đặt như phần mềm bình thường
- Thêm vào PATH (Windows: System Environment Variables; macOS/Linux: export trong `~/.zshrc` hoặc `~/.bashrc`)

```bash
# macOS/Linux — thêm vào ~/.zshrc
export JAVA_HOME=$(/usr/libexec/java_home -v 21)
export PATH=$JAVA_HOME/bin:$PATH
```

### 1.2. Cài IDE

#### Lựa chọn 1: IntelliJ IDEA Community (miễn phí, khuyên dùng)

- Tải tại [https://www.jetbrains.com/idea/download/](https://www.jetbrains.com/idea/download/)
- Chọn phiên bản **Community** (miễn phí, đủ dùng cho Spring Boot)
- IntelliJ hiểu Java rất tốt: auto-complete, refactor, debug, tích hợp Gradle

#### Lựa chọn 2: VS Code + Extension Pack for Java

- Tải VS Code tại [https://code.visualstudio.com/](https://code.visualstudio.com/)
- Cài các extension:
  - **Extension Pack for Java** (bao gồm tất cả extension cần thiết)
  - **Spring Boot Extension Pack** (hỗ trợ Spring Boot)
  - **Gradle for Java** (hỗ trợ build Gradle)

**Tại sao IntelliJ tốt hơn cho Java?**
VS Code là text editor được mở rộng thành IDE. IntelliJ là IDE chuyên cho Java từ đầu — nó hiểu cấu trúc dự án, annotation, dependency injection tốt hơn nhiều. Giống như so sánh dao Thụy Sĩ (VS Code — đa năng) với dao đầu bếp (IntelliJ — chuyên biệt).

### 1.3. Cài Docker Desktop

**Tại sao cần Docker?**
Thay vì cài SQL Server, Redis trực tiếp vào máy (phức tạp, khó gỡ), Docker cho phép chạy chúng trong "container" — giống như máy ảo nhẹ, bật/tắt trong 1 giây, xóa sạch không để lại rác.

- Tải tại [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/)
- Cài đặt, khởi động Docker Desktop
- Kiểm tra:

```bash
docker --version
# Docker version 27.x.x

docker compose version
# Docker Compose version v2.x.x
```

### 1.4. Kiểm tra tất cả

Chạy lần lượt để đảm bảo mọi thứ đã sẵn sàng:

```bash
java -version        # Phải thấy "21.x.x"
gradle -v            # Không bắt buộc — Spring Boot có Gradle Wrapper
docker --version     # Phải thấy "Docker version 2x.x"
docker compose version  # Phải thấy "v2.x"
```

> **Lưu ý:** Không cần cài Gradle riêng. Spring Boot sinh ra file `gradlew` (Gradle Wrapper) — nó tự tải đúng phiên bản Gradle cần thiết. Đây là cách làm chuẩn trong thực tế.

---

## 2. Tạo project Spring Boot

### 2.1. Vào Spring Initializr

Spring Initializr ([https://start.spring.io](https://start.spring.io)) là "công cụ sinh dự án" chính thức của Spring. Nó tạo sẵn cấu trúc folder, file build, và cấu hình cơ bản.

**Tại sao không tạo tay?** Vì cấu hình Spring Boot khá phức tạp (phiên bản phù hợp, auto-configuration, ...). Initializr đảm bảo mọi thứ tương thích với nhau.

### 2.2. Chọn các tùy chọn

| Mục | Giá trị | Giải thích |
|---|---|---|
| Project | **Gradle - Groovy** | Build tool. Gradle nhanh hơn Maven, Groovy là ngôn ngữ viết file build |
| Language | **Java** | Ngôn ngữ chính |
| Spring Boot | **3.3.5** | Phiên bản ổn định mới nhất |
| Group | **com.cinex** | Tên tổ chức (giống domain ngược: cinex.com → com.cinex) |
| Artifact | **backend** | Tên dự án |
| Packaging | **Jar** | File chạy được (java -jar backend.jar) |
| Java | **21** | Phiên bản JDK |

### 2.3. Chọn Dependencies

Tick chọn các dependency sau:

| Dependency | Tác dụng |
|---|---|
| **Spring Web** | Xây dựng REST API (nhận HTTP request, trả JSON response) |
| **Spring Data JPA** | ORM — tương tác database bằng Java object thay vì viết SQL tay |
| **Spring Security** | Xác thực (login) và phân quyền (ai được làm gì) |
| **Validation** | Kiểm tra dữ liệu đầu vào (@NotBlank, @Email, @Size, ...) |
| **Spring Boot Starter Mail** | Gửi email (reset password, xác nhận đặt vé) |
| **WebSocket** | Giao tiếp 2 chiều realtime (cập nhật ghế đang chọn) |
| **Spring Data Redis** | Cache dữ liệu vào RAM để tăng tốc (Redis) |
| **Liquibase Migration** | Quản lý thay đổi database có kiểm soát (giống git cho DB) |

Nhấn **Generate**, tải file `.zip` về, giải nén.

### 2.4. Mở dự án bằng IDE

**IntelliJ:**
- File → Open → Chọn folder `backend` vừa giải nén
- Chờ IntelliJ download dependencies (góc dưới bên phải sẽ thấy progress bar)

**VS Code:**
- File → Open Folder → Chọn folder `backend`
- VS Code tự động nhận diện dự án Java và gợi ý cài extension

### 2.5. Cấu trúc folder sinh ra

```
backend/
├── build.gradle              ← File cấu hình build (tương tự package.json của Node.js)
├── settings.gradle           ← Tên dự án
├── gradlew                   ← Gradle Wrapper (Linux/macOS)
├── gradlew.bat               ← Gradle Wrapper (Windows)
├── gradle/
│   └── wrapper/
│       └── gradle-wrapper.properties  ← Phiên bản Gradle sẽ dùng
└── src/
    ├── main/
    │   ├── java/com/cinex/
    │   │   └── CineXApplication.java      ← Điểm khởi động của ứng dụng
    │   └── resources/
    │       ├── application.properties     ← File cấu hình (ta đổi thành .yml)
    │       ├── static/                    ← File tĩnh (HTML, CSS, JS — ta không dùng)
    │       └── templates/                 ← Template engine (ta không dùng — dùng React)
    └── test/
        └── java/com/cinex/
            └── CineXApplicationTests.java  ← Test tự động
```

**Giải thích:**

- `build.gradle` — "danh sách nguyên liệu" của dự án. Khai báo dùng thư viện nào, phiên bản bao nhiêu.
- `gradlew` — Tương tự `npx` của Node.js. Chạy `./gradlew build` sẽ tự tải Gradle về nếu chưa có.
- `CineXApplication.java` — File `main()` của Java. Spring Boot khởi động từ đây.
- `application.properties` — File cấu hình (URL database, port server, ...). Ta sẽ đổi thành `.yml` cho dễ đọc.

---

## 3. Cấu hình build.gradle

### 3.1. Hiểu cấu trúc file build.gradle

File `build.gradle` giống như "công thức nấu ăn" — nó nói cho Gradle biết: dự án cần những gì, lấy ở đâu, build thế nào.

```groovy
// === PLUGINS ===
// Plugin là "kỹ năng" mà Gradle cần để build dự án.
// Giống như bạn cần biết "nấu ăn" (java), "làm bánh" (spring boot).
plugins {
    id 'java'                                                    // 1) Biết compile Java
    id 'org.springframework.boot' version '3.3.5'                // 2) Biết đóng gói Spring Boot JAR
    id 'io.spring.dependency-management' version '1.1.6'         // 3) Quản lý phiên bản thư viện tự động
}

// === THÔNG TIN DỰ ÁN ===
group = 'com.cinex'             // Tên tổ chức (giống họ của bạn)
version = '0.0.1-SNAPSHOT'     // Phiên bản dự án (SNAPSHOT = đang phát triển)

// === PHIÊN BẢN JAVA ===
java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)  // Dùng JDK 21 để compile
    }
}

// === CẤU HÌNH ĐẶC BIỆT ===
// Đảm bảo Lombok có thể "nhóm" với annotation processor khác
configurations {
    compileOnly {
        extendsFrom annotationProcessor
    }
}

// === LẤY THƯ VIỆN TỪ ĐÂU ===
repositories {
    mavenCentral()  // Kho thư viện lớn nhất của Java (giống npm registry)
}

// === DANH SÁCH THƯ VIỆN (DEPENDENCIES) ===
dependencies {
    // ... (chi tiết bên dưới)
}

// === CẤU HÌNH TEST ===
tasks.named('test') {
    useJUnitPlatform()  // Dùng JUnit 5 để chạy test
}
```

### 3.2. Giải thích các loại dependency

Trong Gradle, mỗi dependency có 1 **scope** (phạm vi):

| Scope | Ý nghĩa | Ví dụ |
|---|---|---|
| `implementation` | Cần khi COMPILE và khi CHẠY | Spring Web, JPA, JWT |
| `compileOnly` | Chỉ cần khi COMPILE, không đóng gói vào JAR | Lombok (chỉ sinh code lúc compile) |
| `runtimeOnly` | Chỉ cần khi CHẠY, không cần lúc compile | JDBC Driver (JPA tự tìm) |
| `annotationProcessor` | Xử lý annotation lúc compile, sinh code tự động | Lombok, MapStruct |
| `testImplementation` | Chỉ dùng trong test | JUnit, Mockito |

**Ví dụ đời thường:** Giống như xây nhà:
- `implementation` = gạch, xi măng (cần khi xây VÀ khi sử dụng)
- `compileOnly` = dàn giáo (cần khi xây, nhưng gỡ bỏ sau khi xong)
- `runtimeOnly` = điện, nước (không cần khi xây, nhưng cần khi ở)
- `annotationProcessor` = robot thợ (giúp xây nhanh hơn, nhưng không ở lại trong nhà)

### 3.3. File build.gradle hoàn chỉnh của CineX

```groovy
plugins {
    id 'java'
    id 'org.springframework.boot' version '3.3.5'
    id 'io.spring.dependency-management' version '1.1.6'
}

group = 'com.cinex'
version = '0.0.1-SNAPSHOT'

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

configurations {
    compileOnly {
        extendsFrom annotationProcessor
    }
}

repositories {
    mavenCentral()
}

dependencies {
    // =====================================================
    // SPRING BOOT STARTERS
    // "Starter" là gói combo — 1 starter bao gồm nhiều thư viện liên quan.
    // Giống như mua "combo phở" thay vì mua từng món riêng lẻ.
    // =====================================================

    // Web — xây dựng REST API (nhúng Tomcat, Jackson JSON, DispatcherServlet)
    implementation 'org.springframework.boot:spring-boot-starter-web'

    // JPA — ORM framework, tương tác DB bằng Java object
    implementation 'org.springframework.boot:spring-boot-starter-data-jpa'

    // Security — xác thực, phân quyền, bảo mật
    implementation 'org.springframework.boot:spring-boot-starter-security'

    // Validation — kiểm tra dữ liệu đầu vào: @NotBlank, @Email, @Size, ...
    implementation 'org.springframework.boot:spring-boot-starter-validation'

    // Redis — cache dữ liệu trong RAM để tăng tốc truy vấn
    implementation 'org.springframework.boot:spring-boot-starter-data-redis'

    // WebSocket — giao tiếp 2 chiều realtime (cập nhật ghế đang chọn)
    implementation 'org.springframework.boot:spring-boot-starter-websocket'

    // =====================================================
    // DATABASE
    // =====================================================

    // JDBC Driver cho SQL Server — cầu nối giữa Java và SQL Server
    // runtimeOnly vì JPA tự động tìm driver, code không gọi trực tiếp
    runtimeOnly 'com.microsoft.sqlserver:mssql-jdbc'

    // Liquibase — quản lý thay đổi database (giống git cho DB schema)
    // Mỗi thay đổi (thêm bảng, sửa cột) được ghi vào file XML → chạy tự động khi start
    implementation 'org.liquibase:liquibase-core'

    // =====================================================
    // JWT (JSON Web Token) — xác thực không trạng thái (stateless)
    // Cần 3 thư viện: API (interface), Impl (code thực thi), Jackson (đọc/ghi JSON)
    // =====================================================
    implementation 'io.jsonwebtoken:jjwt-api:0.12.6'
    runtimeOnly 'io.jsonwebtoken:jjwt-impl:0.12.6'
    runtimeOnly 'io.jsonwebtoken:jjwt-jackson:0.12.6'

    // =====================================================
    // MAPSTRUCT — tự động chuyển đổi Entity <-> DTO
    // Giống như robot tự động dịch tiếng Anh sang tiếng Việt:
    // bạn chỉ cần nói "dịch entity User thành UserResponse" → nó làm hết.
    //
    // QUAN TRỌNG: MapStruct chạy lúc COMPILE (không dùng reflection lúc runtime)
    // → nhanh hơn và an toàn hơn các thư viện khác (ModelMapper, Dozer).
    // =====================================================
    implementation 'org.mapstruct:mapstruct:1.6.3'
    annotationProcessor 'org.mapstruct:mapstruct-processor:1.6.3'

    // =====================================================
    // LOMBOK — giảm code boilerplate (getter, setter, constructor, builder)
    // Thay vì viết 50 dòng getter/setter, chỉ cần @Getter @Setter.
    //
    // THỨ TỰ ANNOTATION PROCESSOR RẤT QUAN TRỌNG:
    // Lombok PHẢI đứng TRƯỚC MapStruct trong danh sách annotationProcessor.
    //
    // Tại sao? Vì Lombok sinh getter/setter trước → MapStruct đọc getter/setter
    // để biết cách mapping. Nếu MapStruct chạy trước → nó không thấy getter/setter
    // → mapping bị lỗi.
    //
    // Giống như: phải có bánh mì (Lombok sinh getter) trước khi kẹp thịt
    // (MapStruct đọc getter để map).
    // =====================================================
    compileOnly 'org.projectlombok:lombok'
    annotationProcessor 'org.projectlombok:lombok'
    // Cầu nối giữa Lombok và MapStruct — đảm bảo 2 thư viện "nói chuyện" được với nhau
    annotationProcessor 'org.projectlombok:lombok-mapstruct-binding:0.2.0'

    // =====================================================
    // EMAIL — gửi email xác nhận, reset password
    // =====================================================
    implementation 'org.springframework.boot:spring-boot-starter-mail'

    // =====================================================
    // CLOUDINARY — upload ảnh lên cloud (poster phim, avatar user)
    // Thay vì lưu ảnh trên server → lưu trên Cloudinary (CDN toàn cầu, nhanh hơn)
    // =====================================================
    implementation 'com.cloudinary:cloudinary-http5:2.0.0'

    // =====================================================
    // QR CODE — sinh mã QR cho vé xem phim
    // ZXing (Zebra Crossing) là thư viện mã nguồn mở của Google
    // =====================================================
    implementation 'com.google.zxing:core:3.5.3'
    implementation 'com.google.zxing:javase:3.5.3'

    // =====================================================
    // SWAGGER / OPENAPI — tự động sinh trang tài liệu API
    // Truy cập http://localhost:8088/swagger-ui.html để xem
    // Mỗi endpoint tự động xuất hiện, có thể test trực tiếp trên trình duyệt
    // =====================================================
    implementation 'org.springdoc:springdoc-openapi-starter-webmvc-ui:2.6.0'

    // =====================================================
    // TEST
    // =====================================================
    testImplementation 'org.springframework.boot:spring-boot-starter-test'
    testImplementation 'org.springframework.security:spring-security-test'
    testImplementation 'org.testcontainers:mssqlserver:1.20.4'
    testImplementation 'org.testcontainers:junit-jupiter:1.20.4'
}

tasks.named('test') {
    useJUnitPlatform()
}
```

### 3.4. Về thứ tự annotationProcessor

Đây là lỗi **rất phổ biến** khi dùng Lombok + MapStruct cùng lúc:

```
// SAI — MapStruct không thấy getter/setter
annotationProcessor 'org.mapstruct:mapstruct-processor:1.6.3'
annotationProcessor 'org.projectlombok:lombok'

// ĐÚNG — Lombok sinh getter trước, MapStruct đọc sau
annotationProcessor 'org.projectlombok:lombok'
annotationProcessor 'org.projectlombok:lombok-mapstruct-binding:0.2.0'
annotationProcessor 'org.mapstruct:mapstruct-processor:1.6.3'
```

> **Mẹo:** Trong thực tế, `lombok-mapstruct-binding` giúp Gradle hiểu đúng thứ tự xử lý. Nhưng để an toàn, luôn khai báo Lombok trước MapStruct.

---

## 4. Cấu hình application.yml

### 4.1. Tại sao dùng .yml thay vì .properties?

Spring Boot hỗ trợ 2 định dạng cấu hình:

```properties
# application.properties — phẳng, lặp lại prefix
spring.datasource.url=jdbc:sqlserver://localhost:1433
spring.datasource.username=sa
spring.datasource.password=CineX@2026
spring.jpa.hibernate.ddl-auto=validate
spring.jpa.show-sql=true
```

```yaml
# application.yml — có phân cấp, dễ đọc hơn
spring:
  datasource:
    url: jdbc:sqlserver://localhost:1433
    username: sa
    password: CineX@2026
  jpa:
    hibernate:
      ddl-auto: validate
    show-sql: true
```

**Kết luận:** `.yml` dễ đọc hơn khi có nhiều cấp lồng nhau. Hầu hết dự án thực tế dùng `.yml`.

**Cách chuyển:** Xóa file `application.properties`, tạo file `application.yml` cùng thư mục (`src/main/resources/`).

### 4.2. Profiles là gì?

**Vấn đề:** Khi code ở máy cá nhân (dev), database là `localhost`. Khi deploy lên server (prod), database là `db.production.com`. Làm sao để không phải sửa code mỗi lần deploy?

**Giải pháp: Spring Profiles**

Spring cho phép tạo nhiều file cấu hình cho từng môi trường:

```
src/main/resources/
├── application.yml          ← Cấu hình CHUNG (dùng cho tất cả môi trường)
├── application-dev.yml      ← Cấu hình riêng cho DEV (ghi đè lên cấu hình chung)
└── application-prod.yml     ← Cấu hình riêng cho PRODUCTION
```

**Cách hoạt động:**
1. Spring đọc `application.yml` trước (cấu hình chung)
2. Dựa vào profile đang active (`spring.profiles.active`), đọc thêm file tương ứng
3. Cấu hình trong file profile **ghi đè** lên cấu hình chung

**Ví dụ đời thường:** Giống như bạn có 1 bộ quần áo cơ bản (application.yml). Khi đi làm → mặc thêm áo vest (dev.yml). Khi đi tiệc → mặc thêm áo khoác (prod.yml). Bộ cơ bản vẫn giữ nguyên.

### 4.3. Cú pháp ${ENV_VAR:default}

```yaml
url: jdbc:sqlserver://${DB_HOST:localhost}:${DB_PORT:1433}
```

Dịch: "Lấy giá trị từ biến môi trường `DB_HOST`. Nếu không tìm thấy → dùng `localhost`."

**Tại sao cần?**
- Khi chạy trên máy cá nhân: không set biến môi trường → tự động dùng `localhost`
- Khi chạy trên server/Docker: set `DB_HOST=db.production.com` → dùng giá trị đó
- **Không bao giờ hardcode** password, secret key vào code → lộ khi push lên Git

### 4.4. File application.yml (cấu hình chung)

```yaml
# === CẤU HÌNH CHUNG — DÙNG CHO TẤT CẢ MÔI TRƯỜNG ===

spring:
  profiles:
    active: dev                    # Mặc định dùng profile "dev"
  servlet:
    multipart:
      max-file-size: 5MB          # Kích thước file upload tối đa
      max-request-size: 5MB       # Kích thước request tối đa

server:
  port: 8088                       # Port của backend (mặc định Spring là 8080)

# === CẤU HÌNH TÙY CHỈNH CỦA DỰ ÁN ===

app:
  frontend-url: ${FRONTEND_URL:http://localhost:5173}   # URL frontend (cho CORS)
  jwt:
    # Secret key để ký JWT — PHẢI là chuỗi Base64, độ dài >= 256 bit
    secret: ${JWT_SECRET:dGhpcyBpcyBhIHZlcnkgbG9uZyBzZWNyZXQga2V5IGZvciBkZXZlbG9wbWVudCBvbmx5IDEyMzQ1Njc4OTA=}
    expiration-ms: ${JWT_EXPIRATION:900000}             # 15 phút (access token)
    refresh-expiration-ms: ${JWT_REFRESH_EXPIRATION:604800000}  # 7 ngày (refresh token)

# === CLOUDINARY — UPLOAD ẢNH ===
cloudinary:
  cloud-name: ${CLOUDINARY_CLOUD_NAME:your-cloud-name}
  api-key: ${CLOUDINARY_API_KEY:your-api-key}
  api-secret: ${CLOUDINARY_API_SECRET:your-api-secret}
```

### 4.5. File application-dev.yml (cấu hình riêng cho dev)

```yaml
# === CẤU HÌNH CHỈ DÙNG KHI CHẠY Ở MÁY CÁ NHÂN (DEV) ===

spring:
  # --- DATABASE ---
  datasource:
    # jdbc:sqlserver://HOST:PORT;databaseName=TEN_DB;...
    url: jdbc:sqlserver://${DB_HOST:localhost}:${DB_PORT:1433};databaseName=${DB_NAME:cinex};encrypt=false;trustServerCertificate=true
    username: ${DB_USERNAME:sa}
    password: ${DB_PASSWORD:CineX@2026}
    driver-class-name: com.microsoft.sqlserver.jdbc.SQLServerDriver

  # --- JPA / HIBERNATE ---
  jpa:
    hibernate:
      # ddl-auto có 5 chế độ:
      # - none:     KHÔNG làm gì (production dùng cái này)
      # - validate: CHỈ KIỂM TRA entity khớp với DB, không sửa DB
      # - update:   Tự động ALTER TABLE khi entity thay đổi (NGUY HIỂM cho production!)
      # - create:   Xóa hết + tạo lại bảng mỗi lần start (mất dữ liệu!)
      # - create-drop: Giống create + xóa hết khi tắt app
      #
      # Ta dùng "validate" + Liquibase để quản lý DB an toàn.
      ddl-auto: validate
    show-sql: true                     # In SQL ra console (chỉ bật ở dev)
    properties:
      hibernate:
        dialect: org.hibernate.dialect.SQLServerDialect
        format_sql: true               # Format SQL cho dễ đọc

  # --- LIQUIBASE ---
  liquibase:
    change-log: classpath:db/changelog/db.changelog-master.xml

  # --- REDIS ---
  data:
    redis:
      host: ${REDIS_HOST:localhost}
      port: ${REDIS_PORT:6379}

  # --- EMAIL ---
  mail:
    host: ${MAIL_HOST:sandbox.smtp.mailtrap.io}     # Mailtrap = "hộp thư giả" cho dev
    port: ${MAIL_PORT:2525}
    username: ${MAIL_USERNAME:your-mailtrap-username}
    password: ${MAIL_PASSWORD:your-mailtrap-password}
    properties:
      mail.smtp.auth: true
      mail.smtp.starttls.enable: true

# --- LOGGING ---
logging:
  level:
    com.cinex: DEBUG                    # Log chi tiết cho code của mình
    org.springframework.security: DEBUG # Log chi tiết cho security (debug lỗi phân quyền)
```

### 4.6. Giải thích các cấu hình quan trọng

| Cấu hình | Tác dụng | Ví dụ đời thường |
|---|---|---|
| `ddl-auto: validate` | Chỉ kiểm tra entity có khớp DB không, KHÔNG tự động sửa DB | Kiểm tra khóa có vừa ổ không, nhưng không tự ý làm thêm chìa khóa |
| `show-sql: true` | In SQL mà Hibernate sinh ra | Bật camera giám sát để xem ai làm gì |
| `format_sql: true` | SQL được format đẹp (xuống dòng, thụt đầu dòng) | Giống như viết văn có dàn ý thay vì viết liền tù tì |
| Liquibase `change-log` | Điểm bắt đầu đọc các file thay đổi DB | Giống như mục lục của cuốn sách |

---

## 5. Tạo cấu trúc package

### 5.1. Package by Feature vs Package by Layer

Có 2 cách tổ chức code:

**Package by Layer (KHÔNG DÙNG):**
```
com.cinex/
├── controller/
│   ├── UserController.java
│   ├── MovieController.java
│   └── BookingController.java
├── service/
│   ├── UserService.java
│   ├── MovieService.java
│   └── BookingService.java
├── repository/
│   ├── UserRepository.java
│   ├── MovieRepository.java
│   └── BookingRepository.java
└── entity/
    ├── User.java
    ├── Movie.java
    └── Booking.java
```

**Vấn đề:** Khi sửa module Booking, bạn phải nhảy qua 4 folder khác nhau. Khi dự án lớn (20+ entity), mỗi folder có 20+ file → khó tìm.

**Package by Feature (DÙNG CÁI NÀY):**
```
com.cinex/
├── common/                          ← Code dùng chung cho tất cả module
│   ├── entity/
│   │   ├── BaseEntity.java         ← Class cha của mọi entity
│   │   └── StorageState.java       ← Enum: ACTIVE, ARCHIVED
│   ├── config/                      ← Cấu hình: Security, CORS, Redis, OpenAPI
│   ├── exception/                   ← Xử lý lỗi tập trung
│   │   ├── ErrorCode.java          ← Mã lỗi: USER_NOT_FOUND, INVALID_CREDENTIALS, ...
│   │   ├── BusinessException.java  ← Exception cho lỗi nghiệp vụ
│   │   └── GlobalExceptionHandler.java  ← Bắt lỗi từ tất cả controller
│   ├── response/                    ← Format response thống nhất
│   │   ├── ApiResponse.java        ← { success, message, data, timestamp }
│   │   └── PageResponse.java       ← { content, page, size, totalElements, ... }
│   ├── service/                     ← Service dùng chung (email, upload, ...)
│   └── util/                        ← Hàm tiện ích (SecurityUtil, DateTimeUtil, ...)
│
├── security/                        ← Xác thực + Phân quyền
│   ├── JwtUtil.java                ← Tạo/đọc/validate JWT token
│   ├── JwtAuthFilter.java          ← Filter bắt mọi request, kiểm tra JWT
│   └── CustomUserDetailsService.java
│
└── module/                          ← TẤT CẢ MODULE NGHIỆP VỤ
    ├── auth/                        ← Đăng ký, Đăng nhập, Refresh, Reset password
    │   ├── entity/
    │   │   ├── User.java
    │   │   ├── Role.java           ← Enum: USER, ADMIN
    │   │   ├── RefreshToken.java
    │   │   └── PasswordResetToken.java
    │   ├── dto/
    │   │   ├── RegisterRequest.java
    │   │   ├── LoginRequest.java
    │   │   └── AuthResponse.java
    │   ├── repository/
    │   │   └── UserRepository.java
    │   ├── service/
    │   │   └── AuthService.java
    │   └── controller/
    │       └── AuthController.java
    │
    ├── user/                        ← Quản lý profile, admin quản lý user
    │   ├── dto/
    │   ├── service/
    │   ├── controller/
    │   ├── mapper/
    │   └── specification/
    │
    ├── movie/                       ← Quản lý phim, thể loại, suất chiếu
    │   ├── entity/
    │   ├── dto/
    │   ├── repository/
    │   ├── service/
    │   ├── controller/
    │   └── mapper/
    │
    └── booking/                     ← Đặt vé, thanh toán
        ├── entity/
        ├── dto/
        ├── repository/
        ├── service/
        └── controller/
```

**Tại sao Package by Feature?**
1. **Liên quan ở gần nhau:** Tất cả code của module Booking nằm cùng 1 chỗ → dễ tìm, dễ hiểu
2. **Dễ xóa:** Muốn bỏ module nào → xóa 1 folder là xong
3. **Dễ phân công:** Người A làm module auth, người B làm module movie → không xung đột
4. **Thực tế:** Hầu hết công ty lớn (Netflix, Uber, Grab) dùng package by feature

### 5.2. Tạo các package

Trong IDE, click chuột phải vào `src/main/java/com/cinex/` → New → Package:

```
com.cinex.common.entity
com.cinex.common.config
com.cinex.common.exception
com.cinex.common.response
com.cinex.common.util
com.cinex.common.service
com.cinex.security
com.cinex.module.auth.entity
com.cinex.module.auth.dto
com.cinex.module.auth.repository
com.cinex.module.auth.service
com.cinex.module.auth.controller
```

> **Lưu ý:** Java yêu cầu mỗi package PHẢI có ít nhất 1 file. Package rỗng sẽ bị IDE xóa tự động. Nên tạo package khi cần, không tạo trước tất cả.

---

## 6. Tạo BaseEntity

### 6.1. Tại sao cần BaseEntity?

**Vấn đề:** Mọi entity trong dự án đều cần các trường giống nhau:
- `id` — khóa chính
- `version` — kiểm tra xung đột khi 2 người sửa cùng lúc
- `storageState` — xóa mềm (ACTIVE/ARCHIVED)
- `createdAt`, `updatedAt` — thời gian tạo/sửa
- `createdBy`, `updatedBy` — ai tạo/sửa

Nếu viết lại các trường này trong **MỌI** entity (User, Movie, Booking, ...) → lặp code, dễ quên, khó bảo trì.

**Giải pháp:** Tạo 1 class cha `BaseEntity`, tất cả entity kế thừa từ nó.

**Ví dụ đời thường:** Giống như mẫu đơn xin việc đã có sẵn "Họ tên", "Ngày sinh", "Số điện thoại" — bạn chỉ cần điền thêm phần "Kinh nghiệm làm việc" (các trường riêng của từng entity).

### 6.2. Code BaseEntity

Tạo file `src/main/java/com/cinex/common/entity/BaseEntity.java`:

```java
package com.cinex.common.entity;

import jakarta.persistence.Column;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
public abstract class BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Version
    private Long version;

    @Enumerated(EnumType.STRING)
    @Column(name = "storage_state", length = 20)
    private StorageState storageState = StorageState.ACTIVE;

    @CreatedBy
    @Column(updatable = false)
    private String createdBy;

    @LastModifiedBy
    private String updatedBy;

    @CreatedDate
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;
}
```

Tạo file `src/main/java/com/cinex/common/entity/StorageState.java`:

```java
package com.cinex.common.entity;

/**
 * Trạng thái lưu trữ — dùng cho soft delete toàn bộ dự án.
 *
 * ACTIVE: đang hoạt động (mặc định khi tạo mới)
 * ARCHIVED: đã xóa mềm (không hiện cho user, admin có thể khôi phục)
 */
public enum StorageState {
    ACTIVE,
    ARCHIVED
}
```

### 6.3. Giải thích từng annotation

| Annotation | Tác dụng | Ví dụ đời thường |
|---|---|---|
| `@MappedSuperclass` | Báo JPA: "Đây là class cha, KHÔNG tạo bảng riêng, chỉ truyền field xuống class con" | Giống như bản vẽ thiết kế cơ bản — nhà nào cũng có nền móng, nhưng nền móng không phải là 1 căn nhà riêng |
| `@EntityListeners(AuditingEntityListener.class)` | Tự động điền `createdAt`, `updatedAt`, `createdBy`, `updatedBy` | Giống như camera giám sát tự động ghi lại: ai vào lúc nào, ai sửa lúc nào |
| `@Id` | Đánh dấu trường này là khóa chính | Số CMND của mỗi bản ghi |
| `@GeneratedValue(strategy = IDENTITY)` | Database tự tăng id (1, 2, 3, ...) | Giống như số thứ tự khi xếp hàng — máy tính tự động cấp |
| `@Version` | Optimistic Locking — ngăn 2 người sửa cùng lúc bị ghi đè | Giống như Google Docs: nếu 2 người sửa cùng 1 dòng → báo xung đột |
| `@Enumerated(EnumType.STRING)` | Lưu enum dưới dạng chữ (ACTIVE, ARCHIVED) thay vì số (0, 1) | Đọc DB thấy "ACTIVE" dễ hiểu hơn thấy "0" |
| `@Column(updatable = false)` | Trường này chỉ được set 1 lần khi INSERT, không được UPDATE | Giống như ngày sinh — không ai đổi được |
| `@CreatedDate` | Spring tự động điền ngày tạo | Không cần viết `entity.setCreatedAt(LocalDateTime.now())` |
| `@CreatedBy` | Spring tự động điền người tạo (lấy từ SecurityContext) | Không cần viết `entity.setCreatedBy(currentUser)` |

### 6.4. Về @Version — Optimistic Locking

**Tình huống:** Admin A và admin B cùng mở trang sửa phim "Avengers". A sửa giá vé 100k, B sửa tên phim "Avengers 5". Cả 2 nhấn Save cùng lúc.

**Không có @Version:**
- A save trước: giá = 100k, tên = "Avengers" (chưa đổi)
- B save sau: giá = ? (bị ghi đè về giá cũ!), tên = "Avengers 5"
→ Thay đổi của A bị mất!

**Có @Version:**
- Khi A load phim: version = 1
- Khi B load phim: version = 1
- A save: `UPDATE movies SET ... WHERE id = 1 AND version = 1` → Thành công, version tăng lên 2
- B save: `UPDATE movies SET ... WHERE id = 1 AND version = 1` → THẤT BẠI (vì version đã là 2)
- B nhận thông báo: "Dữ liệu đã bị người khác cập nhật, vui lòng tải lại"

---

## 7. Tạo ApiResponse wrapper

### 7.1. Tại sao cần response thống nhất?

**Không có wrapper — mỗi API trả kiểu khác nhau:**

```json
// GET /api/users/1 → trả User trực tiếp
{ "id": 1, "username": "vanan" }

// POST /api/auth/login → trả token
{ "accessToken": "xxx", "refreshToken": "yyy" }

// DELETE /api/users/1 → trả gì? String? null? void?
"Deleted successfully"
```

**Frontend rất khó xử lý:** Mỗi API phải viết logic khác nhau để đọc response.

**Có wrapper — TẤT CẢ API cùng format:**

```json
// Thành công
{
    "success": true,
    "message": "OK",
    "data": { ... },            // Dữ liệu thực tế (bất kỳ kiểu gì)
    "timestamp": "2026-05-27T..."
}

// Lỗi
{
    "success": false,
    "message": "Email đã được sử dụng",
    "data": null,
    "timestamp": "2026-05-27T..."
}
```

**Frontend chỉ cần:**
```javascript
const res = await api.post('/auth/login', data);
if (res.data.success) {
    // Đúng: đọc res.data.data
} else {
    // Lỗi: hiện res.data.message
}
```

### 7.2. Code ApiResponse

Tạo file `src/main/java/com/cinex/common/response/ApiResponse.java`:

```java
package com.cinex.common.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.time.Instant;

@Getter
@Builder
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)  // Không trả field null trong JSON
public class ApiResponse<T> {

    private boolean success;     // true = thành công, false = lỗi
    private String message;      // Thông báo ("Login successful", "User not found")
    private T data;              // Dữ liệu thực tế (Generic — bất kỳ kiểu gì)
    @Builder.Default
    private Instant timestamp = Instant.now();  // Thời điểm response

    // --- Factory method cho trường hợp thành công ---

    public static <T> ApiResponse<T> ok(T data) {
        return ApiResponse.<T>builder()
                .success(true)
                .message("OK")
                .data(data)
                .build();
    }

    public static <T> ApiResponse<T> ok(String message, T data) {
        return ApiResponse.<T>builder()
                .success(true)
                .message(message)
                .data(data)
                .build();
    }

    // --- Factory method cho trường hợp lỗi ---

    public static <T> ApiResponse<T> error(String message) {
        return ApiResponse.<T>builder()
                .success(false)
                .message(message)
                .build();
    }
}
```

### 7.3. Code PageResponse (cho phân trang)

Tạo file `src/main/java/com/cinex/common/response/PageResponse.java`:

```java
package com.cinex.common.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import org.springframework.data.domain.Page;

import java.util.List;

@Getter
@Builder
@AllArgsConstructor
public class PageResponse<T> {

    private List<T> content;         // Danh sách item trang hiện tại
    private int page;                // Trang hiện tại (bắt đầu từ 0)
    private int size;                // Số item mỗi trang
    private long totalElements;      // Tổng số item
    private int totalPages;          // Tổng số trang
    private boolean last;            // Có phải trang cuối không

    /**
     * Chuyển từ Spring Page<T> sang PageResponse<T>.
     * Giúp controller không phụ thuộc vào class Page của Spring.
     */
    public static <T> PageResponse<T> from(Page<T> page) {
        return PageResponse.<T>builder()
                .content(page.getContent())
                .page(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .last(page.isLast())
                .build();
    }
}
```

### 7.4. Giải thích Generic `<T>`

`ApiResponse<T>` nghĩa là: "Response này chứa dữ liệu kiểu T — T có thể là BẤT KỲ kiểu gì."

```java
ApiResponse<User>                   // T = User → data là 1 User object
ApiResponse<List<Movie>>            // T = List<Movie> → data là danh sách phim
ApiResponse<String>                 // T = String → data là 1 chuỗi
ApiResponse<Void>                   // T = Void → không có data (delete, logout)
```

**Ví dụ đời thường:** `ApiResponse<T>` giống như hộp quà — cái hộp luôn giống nhau (success, message, timestamp), nhưng bên trong có thể là bánh (User), hoa (Movie), hoặc rỗng (Void).

---

## 8. Tạo module đầu tiên (User)

Ta sẽ tạo từng file theo thứ tự: **Entity → DTO → Repository → Service → Controller → Mapper**.

Thứ tự này quan trọng vì: Repository cần Entity, Service cần Repository, Controller cần Service.

### 8.1. Entity — User.java

**Entity là gì?** Là class Java đại diện cho 1 bảng trong database. Mỗi field = 1 cột. Mỗi instance = 1 dòng.

```java
package com.cinex.module.auth.entity;

import com.cinex.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity                          // Báo JPA: "Đây là 1 entity, map với 1 bảng trong DB"
@Table(name = "users")           // Tên bảng trong DB (số nhiều)
@Getter @Setter                  // Lombok: tự sinh getter/setter
@NoArgsConstructor               // Lombok: constructor không tham số (JPA yêu cầu)
@AllArgsConstructor              // Lombok: constructor đầy đủ tham số
@Builder                         // Lombok: tạo object bằng Builder pattern
public class User extends BaseEntity {
    //             ^^^^^^^^^^^^^^^^
    //  Kế thừa BaseEntity → tự động có id, version, storageState, audit fields

    @Column(nullable = false, unique = true, length = 50)
    private String username;
    //  → Cột "username" trong DB, KHÔNG được null, KHÔNG được trùng, tối đa 50 ký tự

    @Column(nullable = false, unique = true, length = 100)
    private String email;

    @Column(nullable = false)
    private String password;     // Lưu dạng MÃ HÓA (bcrypt), KHÔNG BAO GIỜ lưu plain text

    @Column(name = "full_name", length = 100)
    private String fullName;
    //  name = "full_name" → tên cột trong DB là "full_name" (snake_case)
    //  Còn Java dùng "fullName" (camelCase)

    @Column(length = 20)
    private String phone;

    @Column(name = "avatar_url", length = 500)
    private String avatarUrl;

    @Enumerated(EnumType.STRING)  // Lưu "USER" thay vì 0, "ADMIN" thay vì 1
    @Column(nullable = false, length = 20)
    @Builder.Default              // Khi dùng Builder, mặc định là USER
    private Role role = Role.USER;

    @Column(nullable = false)
    @Builder.Default
    private boolean enabled = true;
}
```

**Enum Role:**

```java
package com.cinex.module.auth.entity;

public enum Role {
    USER,    // Người dùng thường
    ADMIN    // Quản trị viên
}
```

### 8.2. DTO — Request và Response

**DTO là gì?** Data Transfer Object — đối tượng chuyển dữ liệu giữa các tầng (frontend ↔ backend).

**Tại sao không trả entity thẳng?**
1. **Bảo mật:** Entity có trường `password` — trả thẳng = lộ mật khẩu
2. **Linh hoạt:** API list chỉ cần `id, username, email`. API detail cần nhiều hơn. 1 entity → nhiều DTO
3. **Kiểm soát:** DTO chỉ cho phép client gửi đúng các trường cần thiết

**Ví dụ đời thường:** Entity giống như hồ sơ y tế đầy đủ (tên, bệnh sử, xét nghiệm, ...). DTO giống như phiếu khám — chỉ hiện thông tin cần thiết cho từng trường hợp.

#### RegisterRequest (client gửi lên khi đăng ký)

```java
package com.cinex.module.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RegisterRequest {

    @NotBlank(message = "Tên đăng nhập là bắt buộc")
    @Size(min = 3, max = 50, message = "Tên đăng nhập từ 3-50 ký tự")
    private String username;

    @NotBlank(message = "Email là bắt buộc")
    @Email(message = "Email không hợp lệ")
    private String email;

    @NotBlank(message = "Mật khẩu là bắt buộc")
    @Size(min = 6, max = 100, message = "Mật khẩu từ 6-100 ký tự")
    private String password;

    private String fullName;   // Không bắt buộc → không có @NotBlank
}
```

**Giải thích Validation annotations:**

| Annotation | Tác dụng |
|---|---|
| `@NotBlank` | Không được null, không được rỗng, không được chỉ có khoảng trắng |
| `@Email` | Phải có dạng email hợp lệ (có @, có domain) |
| `@Size(min, max)` | Độ dài chuỗi phải trong khoảng min-max |

Khi client gửi dữ liệu KHÔNG hợp lệ, Spring tự động trả lời 400 Bad Request + thông báo lỗi.

#### AuthResponse (server trả về sau khi login/register)

```java
package com.cinex.module.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@AllArgsConstructor
public class AuthResponse {

    private String accessToken;      // JWT token để xác thực các request sau
    private String refreshToken;     // Token để lấy access token mới khi hết hạn

    @Builder.Default
    private String tokenType = "Bearer";   // Loại token (luôn là "Bearer")

    private long expiresIn;          // Thời gian hết hạn (giây)
}
```

#### UserProfileResponse (server trả về khi xem profile)

```java
package com.cinex.module.user.dto;

import com.cinex.module.auth.entity.Role;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class UserProfileResponse {

    private Long id;
    private String storageState;
    private String username;
    private String email;
    private String fullName;
    private String phone;
    private String avatarUrl;
    private Role role;
    private boolean enabled;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    // Chú ý: KHÔNG có trường "password" → KHÔNG BAO GIỜ trả password cho client
}
```

### 8.3. Repository — UserRepository.java

**Repository là gì?** Là interface tương tác với database. Spring Data JPA tự động sinh code SQL — bạn chỉ cần khai báo method.

```java
package com.cinex.module.auth.repository;

import com.cinex.module.auth.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface UserRepository
        extends JpaRepository<User, Long>,          // CRUD cơ bản + phân trang
                JpaSpecificationExecutor<User> {     // Query động (search, filter)
    //            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    //  JpaRepository<Entity, KiểuID>
    //  - Entity: class entity (User)
    //  - KiểuID: kiểu của trường @Id (Long)
    //
    //  Tự động có sẵn các method:
    //  - save(entity)        → INSERT hoặc UPDATE
    //  - findById(id)        → SELECT * WHERE id = ?
    //  - findAll()           → SELECT *
    //  - findAll(pageable)   → SELECT * LIMIT ? OFFSET ?
    //  - deleteById(id)      → DELETE WHERE id = ?
    //  - count()             → SELECT COUNT(*)

    // Query method — Spring đọc tên method và tự sinh SQL
    // findActiveByUsername → SELECT * FROM users WHERE username = ? AND storage_state <> 'ARCHIVED'
    @Query("SELECT u FROM User u WHERE u.username = :username AND (u.storageState IS NULL OR u.storageState <> 'ARCHIVED')")
    Optional<User> findActiveByUsername(String username);

    Optional<User> findByUsername(String username);
    // → SELECT * FROM users WHERE username = ?

    Optional<User> findByEmail(String email);
    // → SELECT * FROM users WHERE email = ?

    boolean existsByUsername(String username);
    // → SELECT COUNT(*) > 0 FROM users WHERE username = ?

    boolean existsByEmail(String email);
    // → SELECT COUNT(*) > 0 FROM users WHERE email = ?
}
```

**Tại sao là interface mà không phải class?**
Spring Data JPA dùng **Proxy Pattern** — lúc runtime, nó tự động tạo 1 class implement interface này. Bạn chỉ cần khai báo "cần gì", Spring lo "làm thế nào".

**Quy tắc đặt tên method:**

| Tên method | SQL được sinh |
|---|---|
| `findByUsername(String)` | `WHERE username = ?` |
| `findByEmailAndEnabled(String, boolean)` | `WHERE email = ? AND enabled = ?` |
| `findByRoleOrderByCreatedAtDesc(Role)` | `WHERE role = ? ORDER BY created_at DESC` |
| `countByEnabled(boolean)` | `SELECT COUNT(*) WHERE enabled = ?` |
| `existsByEmail(String)` | `SELECT CASE WHEN COUNT(*) > 0 THEN true ELSE false END WHERE email = ?` |

### 8.4. Mapper — UserMapper.java

**Mapper là gì?** Là lớp chuyển đổi giữa Entity và DTO. MapStruct tự động sinh code lúc compile.

```java
package com.cinex.module.user.mapper;

import com.cinex.module.auth.entity.User;
import com.cinex.module.user.dto.UserProfileResponse;
import org.mapstruct.Mapper;

/**
 * [Mapper Pattern - MapStruct]
 * componentModel = "spring" → Đăng ký như 1 Spring Bean
 * → có thể inject bằng constructor injection.
 */
@Mapper(componentModel = "spring")
public interface UserMapper {

    /**
     * MapStruct tự động match field theo TÊN:
     * user.getUsername()  → response.username
     * user.getEmail()     → response.email
     * user.getFullName()  → response.fullName
     * ...
     *
     * Nếu tên khác nhau, dùng @Mapping:
     * @Mapping(source = "avatarUrl", target = "profileImage")
     */
    UserProfileResponse toProfileResponse(User user);
}
```

**Tại sao dùng MapStruct mà không viết tay?**

```java
// KHÔNG dùng MapStruct — viết TAY (5 trường = 5 dòng, 20 trường = 20 dòng)
public UserProfileResponse toResponse(User user) {
    return UserProfileResponse.builder()
            .id(user.getId())
            .username(user.getUsername())
            .email(user.getEmail())
            .fullName(user.getFullName())
            .phone(user.getPhone())
            .avatarUrl(user.getAvatarUrl())
            .role(user.getRole())
            .enabled(user.isEnabled())
            .createdAt(user.getCreatedAt())
            .updatedAt(user.getUpdatedAt())
            .build();
    // Thêm 1 field mới → phải nhớ sửa ở đây. Dễ QUÊN!
}

// DÙNG MapStruct — chỉ 1 dòng, tự động match tất cả field cùng tên
UserProfileResponse toProfileResponse(User user);
// Thêm field mới có cùng tên → tự động map. KHÔNG CẦN SỬA GÌ!
```

### 8.5. Service — AuthService.java

**Service là gì?** Là nơi chứa **TOÀN BỘ business logic** (luận nghiệp vụ). Controller chỉ nhận request rồi chuyển cho Service xử lý.

```java
package com.cinex.module.auth.service;

import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.module.auth.dto.AuthResponse;
import com.cinex.module.auth.dto.LoginRequest;
import com.cinex.module.auth.dto.RegisterRequest;
import com.cinex.module.auth.entity.User;
import com.cinex.module.auth.repository.UserRepository;
import com.cinex.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Service                  // Đánh dấu đây là Service Bean — Spring quản lý lifecycle
@RequiredArgsConstructor  // Lombok: tự sinh constructor cho tất cả trường final
@Slf4j                    // Lombok: tự sinh logger (log.info(), log.warn(), log.error())
public class AuthService {

    // Dependency Injection qua constructor (RequiredArgsConstructor sinh constructor)
    // Tại sao dùng "final"? → Đảm bảo dependency KHÔNG bị thay đổi sau khi tạo
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    /**
     * Đăng ký tài khoản mới.
     *
     * @Transactional: Tất cả thao tác DB trong method này nằm trong 1 transaction.
     * Nếu lỗi xảy ra giữa chừng → ROLLBACK tất cả (không lưu gì cả).
     *
     * Ví dụ: Như ký hợp đồng — hoặc ký HẾT hoặc HỦY hết, không ký nửa chừng.
     */
    @Transactional
    public AuthResponse register(RegisterRequest request) {
        // Kiểm tra trùng username
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new BusinessException(ErrorCode.USER_EXISTED, "Tên đăng nhập đã được sử dụng");
        }
        // Kiểm tra trùng email
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new BusinessException(ErrorCode.USER_EXISTED, "Email đã được sử dụng");
        }

        // Tạo User entity bằng Builder pattern
        User user = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                //         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                //  MÃ HÓA mật khẩu trước khi lưu. KHÔNG BAO GIỜ lưu plain text!
                //  bcrypt: "123456" → "$2a$10$N9qo8uLOickgx2ZMRZoMye..."
                .fullName(request.getFullName())
                .build();

        userRepository.save(user);
        // JPA tự động: INSERT INTO users (username, email, password, ...) VALUES (?, ?, ?, ...)

        log.info("User {} registered", user.getUsername());

        return buildAuthResponse(user);
    }

    /**
     * Đăng nhập.
     */
    @Transactional
    //  KHÔNG dùng readOnly = true vì login có ghi DB:
    //  - revoke tất cả refresh token cũ của user (UPDATE)
    //  - tạo refresh token mới (INSERT)
    //  → Cần transaction read-write để đảm bảo ACID.
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findActiveByUsername(request.getUsername())
                .orElseThrow(() -> new BusinessException(ErrorCode.INVALID_CREDENTIALS));
                //  ^^^^^^^^^^^^
                //  Optional.orElseThrow: Nếu không tìm thấy → ném exception
                //  KHÔNG dùng .get() vì sẽ NullPointerException nếu rỗng

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new BusinessException(ErrorCode.INVALID_CREDENTIALS);
            //  Chú ý: KHÔNG nói "sai mật khẩu" hay "sai username" cụ thể
            //  → Tránh kẻ tấn công biết username nào tồn tại (security best practice)
        }

        if (!user.isEnabled()) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Tài khoản đã bị vô hiệu hóa");
        }

        return buildAuthResponse(user);
    }

    private AuthResponse buildAuthResponse(User user) {
        String accessToken = jwtUtil.generateToken(
                user.getUsername(),
                Map.of("role", user.getRole().name())
        );

        return AuthResponse.builder()
                .accessToken(accessToken)
                .expiresIn(jwtUtil.getExpirationMs() / 1000)
                .build();
    }
}
```

**Các quy tắc Service:**
1. **Mỗi method công khai** phải có `@Transactional` (ghi) hoặc `@Transactional(readOnly = true)` (đọc)
2. **Khi có lỗi** → throw `BusinessException`, KHÔNG return null
3. **Tên method rõ ràng:** `createBooking()` thay vì `process()`, `handleUser()` thay vì `doStuff()`
4. **KHÔNG gọi Controller**, không trả HttpResponse, không đọc HttpRequest

### 8.6. Controller — AuthController.java

**Controller là gì?** Là "lễ tân" — nhận request từ client, chuyển cho Service xử lý, rồi trả response về client. Controller chỉ làm 3 việc: NHẬN → GỌI → TRẢ.

```java
package com.cinex.module.auth.controller;

import com.cinex.common.response.ApiResponse;
import com.cinex.module.auth.dto.AuthResponse;
import com.cinex.module.auth.dto.LoginRequest;
import com.cinex.module.auth.dto.RegisterRequest;
import com.cinex.module.auth.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController            // = @Controller + @ResponseBody
                           // Mọi method tự động trả JSON (không cần ghi @ResponseBody)
@RequestMapping("/api/auth")  // Tất cả endpoint bắt đầu bằng /api/auth
@RequiredArgsConstructor
@Tag(name = "Auth", description = "Register, Login, Logout, Refresh, Reset Password")  // Swagger: nhóm các API
public class AuthController {

    private final AuthService authService;
    //  Chỉ inject Service, KHÔNG inject Repository.
    //  Controller → Service → Repository (không nhảy cấp)

    @PostMapping("/register")                        // POST /api/auth/register
    @Operation(summary = "Register a new account")   // Swagger: mô tả API
    public ApiResponse<AuthResponse> register(
            @Valid @RequestBody RegisterRequest request) {
        //  @Valid: bắt Spring kiểm tra @NotBlank, @Email, @Size trong DTO
        //  Nếu không hợp lệ → tự động trả 400 Bad Request
        //
        //  @RequestBody: đọc JSON từ body request và chuyển thành Java object
        //  { "username": "vanan", "email": "..." } → RegisterRequest object
        return ApiResponse.ok("Registration successful", authService.register(request));
    }

    @PostMapping("/login")                           // POST /api/auth/login
    @Operation(summary = "Login")
    public ApiResponse<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ApiResponse.ok("Login successful", authService.login(request));
    }
}
```

**Giải thích annotation:**

| Annotation | Tác dụng |
|---|---|
| `@RestController` | Đánh dấu class này là controller, tự động trả JSON |
| `@RequestMapping("/api/auth")` | Prefix URL cho tất cả method trong class |
| `@PostMapping("/register")` | Method này xử lý POST /api/auth/register |
| `@GetMapping`, `@PutMapping`, `@DeleteMapping` | Tương tự cho GET, PUT, DELETE |
| `@Valid` | Kích hoạt validation trên DTO |
| `@RequestBody` | Parse JSON body thành Java object |
| `@PathVariable` | Đọc giá trị từ URL: `/users/{id}` → `@PathVariable Long id` |
| `@RequestParam` | Đọc query param: `/users?role=ADMIN` → `@RequestParam Role role` |

### 8.7. Luồng xử lý tổng hợp

```
Client (Frontend/Postman/curl)
    │
    │  POST /api/auth/register
    │  { "username": "vanan", "email": "vanan@mail.com", "password": "123456" }
    │
    ▼
┌─────────────────────────────────────────────────┐
│  JwtAuthFilter (Security Filter)                │
│  → Kiểm tra JWT token trong header              │
│  → Endpoint /api/auth/** không cần token → PASS │
└─────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────┐
│  AuthController.register()                      │
│  1. @Valid kiểm tra: username không blank? ✓     │
│     email hợp lệ? ✓, password >= 6 ký tự? ✓     │
│  2. Gọi authService.register(request)           │
└─────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────┐
│  AuthService.register()                         │
│  1. existsByUsername("vanan") → false ✓          │
│  2. existsByEmail("vanan@mail.com") → false ✓   │
│  3. User.builder()...build() → tạo User object  │
│  4. passwordEncoder.encode("123456") → bcrypt   │
│  5. userRepository.save(user) → INSERT vào DB   │
│  6. jwtUtil.generateToken() → tạo JWT           │
│  7. return AuthResponse                         │
└─────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────┐
│  AuthController                                 │
│  → Bọc vào ApiResponse.ok(message, data)        │
│  → Spring tự động chuyển thành JSON             │
└─────────────────────────────────────────────────┘
    │
    ▼
Client nhận response:
{
    "success": true,
    "message": "Registration successful",
    "data": {
        "accessToken": "eyJhbG...",
        "refreshToken": "a1b2c3...",
        "tokenType": "Bearer",
        "expiresIn": 900
    },
    "timestamp": "2026-05-27T10:30:00Z"
}
```

---

## 9. Chạy và test

### 9.1. Khởi động database bằng Docker

Tạo file `docker-compose.yml` ở thư mục gốc dự án:

```yaml
services:
  # SQL Server — cơ sở dữ liệu chính
  sqlserver:
    image: mcr.microsoft.com/mssql/server:2022-latest
    environment:
      ACCEPT_EULA: "Y"                    # Chấp nhận điều khoản sử dụng
      MSSQL_SA_PASSWORD: "CineX@2026"     # Mật khẩu user "sa" (system admin)
    ports:
      - "1433:1433"                        # Map port 1433 của container ra máy host
    volumes:
      - sqlserver-data:/var/opt/mssql      # Lưu dữ liệu vào volume (không mất khi restart)

  # Redis — cache dữ liệu, session
  redis:
    image: redis:7-alpine                  # Alpine = bản nhẹ, chỉ 5MB
    ports:
      - "6379:6379"

volumes:
  sqlserver-data:                          # Khai báo volume để lưu dữ liệu
```

Chạy:

```bash
# Khởi động SQL Server và Redis
cd /Users/vutuongan/cinex
docker compose up sqlserver redis -d
#                                 ^^ -d = detached (chạy ngầm, không chiếm terminal)

# Kiểm tra container đang chạy
docker ps
# CONTAINER ID   IMAGE                            STATUS        PORTS
# abc123         mcr.microsoft.com/mssql/server   Up 5 seconds  0.0.0.0:1433->1433/tcp
# def456         redis:7-alpine                   Up 5 seconds  0.0.0.0:6379->6379/tcp

# Tạo database (chỉ cần lần đầu)
docker exec cinex-sqlserver-1 /opt/mssql-tools18/bin/sqlcmd \
    -S localhost -U sa -P 'CineX@2026' -C \
    -Q "CREATE DATABASE cinex"
```

### 9.2. Chạy backend

```bash
cd /Users/vutuongan/cinex/backend

# Build (compile + kiểm tra lỗi)
./gradlew clean build -x test
#         ^^^^^               xóa build cũ
#               ^^^^^         compile + đóng gói
#                     ^^^^^^^  bỏ qua test (chạy nhanh hơn)

# Chạy server
./gradlew bootRun
```

Khi thấy dòng này → server đã sẵn sàng:

```
Started CineXApplication in 5.123 seconds (process running for 5.678)
```

### 9.3. Test bằng curl

```bash
# === ĐĂNG KÝ ===
curl -X POST http://localhost:8088/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "vanan",
    "email": "vanan@gmail.com",
    "password": "123456",
    "fullName": "Vu Tuong An"
  }'

# Response mong đợi:
# {
#     "success": true,
#     "message": "Registration successful",
#     "data": {
#         "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
#         "refreshToken": "a1b2c3d4-e5f6-...",
#         "tokenType": "Bearer",
#         "expiresIn": 900
#     },
#     "timestamp": "2026-05-27T10:30:00Z"
# }

# === ĐĂNG NHẬP ===
curl -X POST http://localhost:8088/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "vanan",
    "password": "123456"
  }'

# === GỌI API CẦN XÁC THỰC ===
# Copy accessToken từ response login
TOKEN="eyJhbGciOiJIUzI1NiJ9..."

curl http://localhost:8088/api/users/me \
  -H "Authorization: Bearer $TOKEN"

# Response: thông tin profile của user đang đăng nhập
```

### 9.4. Test bằng Swagger UI

Mở trình duyệt, truy cập: **http://localhost:8088/swagger-ui.html**

Swagger tự động sinh trang tài liệu API tương tác:
- Xem tất cả endpoint
- Thử nghiệm trực tiếp (nhấn "Try it out")
- Xem request/response mẫu

### 9.5. Các lỗi thường gặp

| Lỗi | Nguyên nhân | Cách sửa |
|---|---|---|
| `Connection refused: localhost:1433` | SQL Server chưa chạy | `docker compose up sqlserver -d` |
| `Login failed for user 'sa'` | Sai mật khẩu | Kiểm tra `MSSQL_SA_PASSWORD` trong docker-compose.yml |
| `Database 'cinex' does not exist` | Chưa tạo database | Chạy lệnh `CREATE DATABASE cinex` |
| `Connection refused: localhost:6379` | Redis chưa chạy | `docker compose up redis -d` |
| `Table 'users' doesn't exist` | Liquibase chưa chạy hoặc lỗi | Kiểm tra file changelog + log khi bootRun |
| `Compilation failed` | Code bị lỗi | Đọc log lỗi, sửa rồi `./gradlew clean build -x test` |
| `Port 8088 already in use` | Có process khác đang dùng port | `lsof -i :8088` rồi `kill <PID>` |
| `MapStruct: Unknown property` | Lombok chưa sinh getter | Kiểm tra thứ tự annotationProcessor trong build.gradle |

---

## Tổng kết — Lưu đồ tổng quan

```
[1] Cài JDK 21 + IDE + Docker
         │
         ▼
[2] start.spring.io → Tạo dự án → Giải nén
         │
         ▼
[3] Cấu hình build.gradle → Thêm dependencies
         │
         ▼
[4] Cấu hình application.yml → DB, Redis, JWT, Mail
         │
         ▼
[5] Tạo package structure → Package by Feature
         │
         ▼
[6] Tạo BaseEntity → Class cha cho tất cả entity
         │
         ▼
[7] Tạo ApiResponse → Format response thống nhất
         │
         ▼
[8] Tạo module đầu tiên:
    Entity → DTO → Repository → Mapper → Service → Controller
         │
         ▼
[9] docker compose up → ./gradlew bootRun → curl/Swagger test
```

> **Bước tiếp theo:** Đọc file `docs/module-guides/auth-explained.md` để hiểu chi tiết module Auth (JWT, Security Filter, Refresh Token, ...).
