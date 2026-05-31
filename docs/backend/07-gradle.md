# Gradle — Build tool cho Java

---

## 1. Gradle là gì?

**Gradle** là công cụ **build** (biên dịch + đóng gói) và **quản lý dependency** (thư viện) cho Java. Nó đọc file cấu hình `build.gradle`, biết cần tải thư viện nào, compile code ra sao, và đóng gói thành file JAR để chạy.

### Ví dụ đời thường: Đầu bếp theo công thức

Hãy tưởng tượng bạn là đầu bếp nấu phở:

- **Công thức (build.gradle):** Ghi rõ cần nguyên liệu gì (dependency), nấu thế nào (build steps), dùng bếp gì (Java 21)
- **Siêu thị (Maven Central):** Nơi mua nguyên liệu (tải thư viện)
- **Gradle:** Người đi chợ + nấu bếp. Đọc công thức → mua đúng nguyên liệu → nấu theo đúng trình tự → ra món phở (file JAR)

Không có Gradle, bạn phải: tự tải từng file `.jar` về, tự thêm vào classpath, tự compile, tự đóng gói. **Cực kỳ mất thời gian** và dễ sai.

---

## 2. Maven vs Gradle — So sánh 2 build tool phổ biến nhất

Thế giới Java có 2 build tool chính: **Maven** (ra đời 2004) và **Gradle** (ra đời 2012). CineX dùng Gradle.

| Tiêu chí | Maven | Gradle |
|---|---|---|
| File cấu hình | `pom.xml` (XML) | `build.gradle` (Groovy/Kotlin) |
| Cú pháp | Dài dòng, khó đọc | Ngắn gọn, dễ đọc |
| Tốc độ build | Chậm hơn | **Nhanh hơn 2-3 lần** (incremental build) |
| Linh hoạt | Cứng nhắc (convention) | Linh hoạt (scripting) |
| Thị phần | Phổ biến ở enterprise cũ | Phổ biến ở dự án mới, Android |
| Học dễ không? | Dễ bắt đầu | Khó hơn một chút |

### Ví dụ cùng 1 dependency, 2 cách viết

**Maven (pom.xml) — 5 dòng:**
```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
    <version>3.3.5</version>
</dependency>
```

**Gradle (build.gradle) — 1 dòng:**
```groovy
implementation 'org.springframework.boot:spring-boot-starter-web'
```

> **Tại sao CineX chọn Gradle?** Vì cú pháp ngắn gọn, build nhanh hơn Maven, và Spring Initializr (công cụ tạo project Spring Boot) mặc định dùng Gradle.

---

## 3. Giải thích build.gradle của CineX — Từng block

File `build.gradle` nằm ở `/Users/vutuongan/cinex/backend/build.gradle`. Hãy đọc từng phần:

### Block 1: Plugins — "Phần mềm" Gradle cần cài

```groovy
plugins {
    id 'java'                                              // Plugin biên dịch Java
    id 'org.springframework.boot' version '3.3.5'          // Plugin Spring Boot
    id 'io.spring.dependency-management' version '1.1.6'   // Quản lý version tự động
}
```

**Giải thích từng plugin:**

| Plugin | Tác dụng |
|---|---|
| `java` | Dạy Gradle cách compile file `.java` → `.class`. Không có plugin này, Gradle không biết build Java |
| `org.springframework.boot` | Thêm lệnh `bootRun` (chạy server), `bootJar` (đóng gói JAR chạy được). Cũng thêm embedded Tomcat vào JAR |
| `io.spring.dependency-management` | Tự động quản lý version thư viện Spring. Bạn chỉ cần viết `spring-boot-starter-web` mà **không cần ghi version** — plugin tự chọn version tương thích |

> **Tại sao không cần ghi version cho Spring dependency?** Plugin `dependency-management` đọc BOM (Bill of Materials) của Spring Boot 3.3.5, biết mỗi thư viện Spring cần version bao nhiêu. Giống như mua combo ở KFC — bạn chọn combo 3.3.5, KFC tự biết cho burger size nào, nước size nào.

### Block 2: Thông tin project

```groovy
group = 'com.cinex'            // Package gốc (giống "thương hiệu" của project)
version = '0.0.1-SNAPSHOT'     // Phiên bản hiện tại

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)   // Dùng Java 21
    }
}
```

**`SNAPSHOT` nghĩa là gì?**
- `SNAPSHOT` = phiên bản đang phát triển, chưa release chính thức
- `0.0.1-SNAPSHOT` → bản dev. Khi release sẽ đổi thành `1.0.0`
- Convention: `MAJOR.MINOR.PATCH` (ví dụ `2.1.3` = phiên bản lớn 2, tính năng mới 1, bản vá 3)

**`toolchain` là gì?**
- Chỉ định version Java để compile. Ở đây là Java 21
- Nếu máy bạn cài Java 17, Gradle sẽ **tự động tải Java 21** về để build
- Đảm bảo mọi người trong team đều build bằng cùng Java version

### Block 3: Configurations — Cấu hình đặc biệt

```groovy
configurations {
    compileOnly {
        extendsFrom annotationProcessor
    }
}
```

**Đoạn này làm gì?**
- Nói với Gradle: "Mọi thư viện khai báo ở `annotationProcessor` cũng được dùng ở `compileOnly`"
- Cụ thể: Lombok vừa là `compileOnly` (dùng lúc viết code: `@Getter`, `@Setter`) vừa là `annotationProcessor` (sinh code lúc compile)
- Nhờ `extendsFrom`, bạn không cần khai báo Lombok 2 lần

### Block 4: Repositories — Tải thư viện từ đâu

```groovy
repositories {
    mavenCentral()    // Kho thư viện lớn nhất thế giới Java
}
```

**Maven Central** là gì? Giống **npm registry** cho Node.js, hoặc **PyPI** cho Python. Kho chứa hàng triệu thư viện Java mã nguồn mở. Khi bạn viết `implementation 'org.springframework.boot:spring-boot-starter-web'`, Gradle sẽ lên Maven Central tải file JAR về.

> **Có kho nào khác không?** Có. Ví dụ: `google()` (kho của Google, cho Android), `jcenter()` (đã đóng cửa 2021), hoặc kho nội bộ công ty (`maven { url "https://repo.company.com" }`).

### Block 5: Dependencies — Thư viện cần dùng

Đây là phần quan trọng nhất. Mỗi dòng khai báo 1 thư viện, theo format:

```
scope 'group:artifact:version'
```

Ví dụ: `implementation 'io.jsonwebtoken:jjwt-api:0.12.6'`
- **scope:** `implementation` (cần lúc compile + runtime)
- **group:** `io.jsonwebtoken` (tổ chức/tác giả thư viện)
- **artifact:** `jjwt-api` (tên thư viện)
- **version:** `0.12.6` (phiên bản)

Bảng tất cả dependency trong CineX:

| Dependency | Scope | Tác dụng |
|---|---|---|
| `spring-boot-starter-web` | implementation | REST API (Tomcat + Spring MVC) |
| `spring-boot-starter-data-jpa` | implementation | ORM (Hibernate + JPA) |
| `spring-boot-starter-security` | implementation | Bảo mật (authentication, authorization) |
| `spring-boot-starter-validation` | implementation | Validate DTO (@NotBlank, @Email, @Size) |
| `spring-boot-starter-data-redis` | implementation | Kết nối Redis (cache) |
| `spring-boot-starter-websocket` | implementation | WebSocket (real-time ghế) |
| `spring-boot-starter-mail` | implementation | Gửi email (xác nhận vé) |
| `mssql-jdbc` | runtimeOnly | Driver kết nối SQL Server |
| `liquibase-core` | implementation | Quản lý migration database |
| `jjwt-api` | implementation | API tạo/đọc JWT token |
| `jjwt-impl` | runtimeOnly | Implementation JWT (runtime) |
| `jjwt-jackson` | runtimeOnly | Parse JWT JSON (runtime) |
| `mapstruct` | implementation | Tự sinh code chuyển Entity ↔ DTO |
| `mapstruct-processor` | annotationProcessor | Sinh MapStruct code lúc compile |
| `lombok` | compileOnly + annotationProcessor | Sinh getter/setter/builder lúc compile |
| `lombok-mapstruct-binding` | annotationProcessor | Kết nối Lombok + MapStruct |
| `cloudinary-http5` | implementation | Upload ảnh lên Cloudinary |
| `zxing core + javase` | implementation | Sinh QR code cho vé |
| `springdoc-openapi` | implementation | Swagger UI (API docs) |
| `spring-boot-starter-test` | testImplementation | Unit test framework |
| `spring-security-test` | testImplementation | Test security |
| `testcontainers mssqlserver` | testImplementation | Chạy SQL Server trong Docker khi test |
| `testcontainers junit-jupiter` | testImplementation | Tích hợp Testcontainers với JUnit 5 |

---

## 4. Dependency Scopes — Thư viện dùng ở giai đoạn nào?

Gradle có **5 scope chính**, mỗi scope quyết định thư viện được dùng **khi nào** và **có đóng gói vào JAR không**.

### Sơ đồ vòng đời build

```
    Viết code          Compile            Runtime (chạy JAR)         Test
  (IDE hiểu)     (.java → .class)      (java -jar app.jar)    (./gradlew test)
       │                │                      │                     │
       ▼                ▼                      ▼                     ▼
  compileOnly    annotationProcessor     implementation          testImplementation
  (Lombok)       (Lombok, MapStruct)     (Spring, JWT)          (JUnit, Mockito)
                                         runtimeOnly
                                         (JDBC driver)
```

### Giải thích từng scope

#### `implementation` — Cần mọi lúc

```groovy
implementation 'org.springframework.boot:spring-boot-starter-web'
```

- Dùng lúc **compile** (viết code import được) + **runtime** (đóng gói vào JAR)
- **Khi nào dùng:** Đa số thư viện. Nếu không biết chọn scope nào → chọn `implementation`
- **Ví dụ:** Spring Web, JPA, Security — code của bạn `import` trực tiếp các class của chúng

#### `runtimeOnly` — Chỉ cần khi chạy

```groovy
runtimeOnly 'com.microsoft.sqlserver:mssql-jdbc'
```

- **Không** dùng lúc compile (code không import trực tiếp) + **có** đóng gói vào JAR
- **Khi nào dùng:** Driver, implementation cụ thể mà code không gọi trực tiếp
- **Ví dụ:** JDBC driver — code bạn chỉ gọi `DataSource.getConnection()` (interface), không gọi `MSSQLDriver` trực tiếp. Spring Boot tự phát hiện driver trong classpath và kết nối

> **Tại sao không khai báo `implementation`?** Vì bạn KHÔNG BAO GIỜ viết `import com.microsoft.sqlserver.jdbc.SQLServerDriver` trong code. Spring Boot tự tìm driver. Khai báo `runtimeOnly` giúp Gradle compile nhanh hơn (ít dependency để scan).

#### `compileOnly` — Chỉ cần khi viết code

```groovy
compileOnly 'org.projectlombok:lombok'
```

- Dùng lúc **compile** (IDE hiểu `@Getter`, `@Setter`) + **không** đóng gói vào JAR
- **Khi nào dùng:** Thư viện sinh code lúc compile xong thì không cần nữa
- **Ví dụ:** Lombok — lúc compile, Lombok đọc `@Getter` rồi sinh method `getName()` vào file `.class`. Sau đó Lombok không cần nữa (code đã sinh rồi)

#### `annotationProcessor` — Xử lý annotation lúc compile

```groovy
annotationProcessor 'org.projectlombok:lombok'
annotationProcessor 'org.mapstruct:mapstruct-processor:1.6.3'
```

- Chạy **trong quá trình compile**, đọc annotation → sinh code
- **Khi nào dùng:** Lombok (sinh getter/setter), MapStruct (sinh mapper code)
- **Ví dụ:** Khi compile, MapStruct processor đọc `@Mapper` → sinh file `UserMapperImpl.java` tự động

#### `testImplementation` — Chỉ dùng cho test

```groovy
testImplementation 'org.springframework.boot:spring-boot-starter-test'
```

- Dùng trong thư mục `src/test/` + **không** đóng gói vào JAR sản phẩm
- **Khi nào dùng:** Mọi thư viện test (JUnit, Mockito, Testcontainers)

### Bảng tóm tắt

| Scope | Compile | Runtime (JAR) | Test | Ví dụ |
|---|---|---|---|---|
| `implementation` | Co | Co | Co | Spring, JWT |
| `runtimeOnly` | Khong | Co | Co | JDBC driver |
| `compileOnly` | Co | Khong | Khong | Lombok |
| `annotationProcessor` | Chay luc compile | Khong | Khong | Lombok, MapStruct |
| `testImplementation` | Khong | Khong | Co | JUnit, Mockito |

---

## 5. Thứ tự annotationProcessor — Lombok PHẢI trước MapStruct

Đây là lỗi **cực kỳ phổ biến** mà nhiều người mắc phải:

```groovy
// SAI — MapStruct processor trước Lombok
annotationProcessor 'org.mapstruct:mapstruct-processor:1.6.3'   // MapStruct chạy trước
annotationProcessor 'org.projectlombok:lombok'                   // Lombok chạy sau
// → MapStruct không thấy getter/setter (vì Lombok chưa sinh) → build FAIL

// DUNG — Lombok trước, MapStruct sau
annotationProcessor 'org.projectlombok:lombok'                   // 1. Lombok sinh getter/setter
annotationProcessor 'org.projectlombok:lombok-mapstruct-binding:0.2.0'  // 2. Cầu nối
annotationProcessor 'org.mapstruct:mapstruct-processor:1.6.3'   // 3. MapStruct đọc getter/setter
```

### Tại sao thứ tự quan trọng?

Quá trình compile diễn ra theo thứ tự:

```
Bước 1: Lombok processor chạy
    → Đọc @Getter, @Setter, @Builder trên entity User
    → Sinh code: getName(), setName(), builder()
    → File User.class giờ ĐÃ CÓ getter/setter

Bước 2: lombok-mapstruct-binding chạy
    → Kết nối Lombok và MapStruct
    → Đảm bảo MapStruct "nhìn thấy" code Lombok sinh ra

Bước 3: MapStruct processor chạy
    → Đọc @Mapper trên UserMapper interface
    → Cần gọi user.getName(), user.setName() để copy field
    → Vì Lombok đã sinh rồi → MapStruct tìm thấy → sinh UserMapperImpl.java OK
```

**Nếu đảo ngược:** MapStruct chạy trước → tìm `getName()` → không thấy (Lombok chưa sinh) → lỗi `No property named 'name' exists`.

> **Mẹo nhớ:** "Lombok sinh hàng, MapStruct dùng hàng" → Người sinh phải đi trước người dùng.

---

## 6. Gradle Wrapper — Không cần cài Gradle

### gradlew là gì?

**Gradle Wrapper** (`gradlew`) là script tự động tải đúng version Gradle mà project cần. Team không cần cài Gradle thủ công.

```
backend/
├── gradlew           ← Script cho Linux/Mac (file thực thi)
├── gradlew.bat       ← Script cho Windows
└── gradle/
    └── wrapper/
        ├── gradle-wrapper.jar          ← Code tải Gradle
        └── gradle-wrapper.properties   ← Ghi version Gradle cần dùng
```

### Tại sao cần Wrapper?

**Vấn đề:** Developer A cài Gradle 8.5, developer B cài Gradle 8.10. Build script có thể chạy trên máy A nhưng lỗi trên máy B (vì syntax thay đổi giữa các version).

**Giải pháp:** `gradlew` đọc file `gradle-wrapper.properties`, biết project cần Gradle version nào, tự tải về nếu chưa có. **Mọi người trong team đều dùng cùng version.**

```properties
# gradle-wrapper.properties
distributionUrl=https\://services.gradle.org/distributions/gradle-8.10.2-bin.zip
```

### Cách dùng

```bash
# ĐÚNG — dùng gradlew (wrapper)
./gradlew build

# SAI — dùng gradle toàn cục (có thể sai version)
gradle build
```

> **Lưu ý:** Lần đầu chạy `./gradlew`, nó sẽ tải Gradle về (mất vài phút, file ~130MB). Các lần sau dùng bản đã tải, không cần internet.

---

## 7. Lệnh Gradle thường dùng

### Các lệnh cơ bản

```bash
# ============================================================
# BUILD — Compile code + đóng gói JAR
# ============================================================
./gradlew clean build -x test
```

**Phân tích từng phần:**
- `clean` — Xóa thư mục `build/` cũ (bắt đầu sạch)
- `build` — Compile `.java` → `.class` → đóng gói thành `.jar`
- `-x test` — Bỏ qua chạy test (tiết kiệm thời gian khi dev)

```bash
# ============================================================
# RUN — Chạy Spring Boot server
# ============================================================
./gradlew bootRun
```

- Compile code + khởi động embedded Tomcat
- Server chạy ở `localhost:8088`
- Nhấn `Ctrl+C` để dừng

```bash
# ============================================================
# TEST — Chạy tất cả unit test
# ============================================================
./gradlew test
```

- Chạy tất cả file test trong `src/test/`
- Báo cáo HTML ở `build/reports/tests/test/index.html`

```bash
# ============================================================
# CLEAN — Xóa thư mục build
# ============================================================
./gradlew clean
```

- Xóa toàn bộ `build/` (compiled classes, JAR, báo cáo test)
- Dùng khi build bị lỗi "kỳ lạ" — clean rồi build lại thường fix được

```bash
# ============================================================
# DEPENDENCIES — Xem danh sách thư viện
# ============================================================
./gradlew dependencies
```

- In ra **cây dependency** (thư viện nào phụ thuộc thư viện nào)
- Ví dụ: `spring-boot-starter-web` kéo theo `spring-webmvc`, `tomcat-embed`, `jackson`...

```bash
# ============================================================
# Các lệnh khác hữu ích
# ============================================================

# Chỉ compile (không đóng JAR, không test) — nhanh nhất
./gradlew compileJava

# Xem tất cả task có thể chạy
./gradlew tasks

# Build với log chi tiết (debug lỗi)
./gradlew build --stacktrace

# Build không dùng cache (khi nghi cache gây lỗi)
./gradlew build --no-build-cache
```

### Thêm dependency mới

Khi cần thư viện mới (ví dụ: gửi SMS):

1. Vào https://mvnrepository.com → tìm thư viện
2. Chọn tab **Gradle (Short)** → copy dòng code
3. Paste vào block `dependencies` trong `build.gradle`
4. Chạy `./gradlew build` để tải về

```groovy
// Ví dụ: thêm thư viện gửi SMS (Twilio)
dependencies {
    // ... các dependency có sẵn ...
    implementation 'com.twilio.sdk:twilio:10.1.0'   // THÊM DÒNG NÀY
}
```

> **Chú ý:** Sau khi thêm dependency, IDE (IntelliJ) sẽ hiện nút **"Load Gradle Changes"** hoặc biểu tượng voi — nhấn vào để IDE cập nhật.

---

## 8. Cấu trúc thư mục build

Sau khi chạy `./gradlew build`, Gradle tạo thư mục `build/`:

```
backend/build/
├── classes/                        # File .class (bytecode Java)
│   └── java/main/com/cinex/...
├── generated/                      # Code được sinh tự động
│   └── sources/annotationProcessor/
│       └── java/main/com/cinex/
│           └── module/user/mapper/UserMapperImpl.java   ← MapStruct sinh
├── libs/
│   └── backend-0.0.1-SNAPSHOT.jar  # File JAR cuối cùng (chạy được)
└── reports/
    └── tests/                      # Báo cáo test (HTML)
```

**File JAR là gì?**
- JAR = Java ARchive = file ZIP chứa tất cả `.class` + thư viện + Tomcat
- Chạy bằng: `java -jar backend-0.0.1-SNAPSHOT.jar`
- 1 file duy nhất, deploy lên server rất tiện

---

## 9. Câu hỏi tự kiểm tra

**Câu 1:** Sự khác nhau giữa `implementation` và `runtimeOnly` là gì? Tại sao JDBC driver (`mssql-jdbc`) dùng `runtimeOnly` thay vì `implementation`?

<details>
<summary>Đáp án</summary>

- `implementation`: dùng được lúc viết code (import) VÀ lúc chạy (đóng gói vào JAR)
- `runtimeOnly`: CHỈ dùng lúc chạy (đóng gói vào JAR), KHÔNG import được trong code

JDBC driver dùng `runtimeOnly` vì code không bao giờ viết `import com.microsoft.sqlserver...`. Spring Boot tự phát hiện driver trong classpath và kết nối. Khai báo `runtimeOnly` giúp Gradle compile nhanh hơn (ít thư viện cần scan).

</details>

**Câu 2:** Nếu đảo thứ tự annotationProcessor, đặt MapStruct trước Lombok, điều gì xảy ra?

<details>
<summary>Đáp án</summary>

Build sẽ FAIL. MapStruct processor chạy trước, cần gọi `getName()`, `setName()` để sinh code mapper. Nhưng Lombok chưa chạy nên getter/setter chưa được sinh → MapStruct không tìm thấy → lỗi "No property named 'xxx' exists". Phải đặt Lombok trước để sinh getter/setter, sau đó MapStruct mới đọc được.

</details>

**Câu 3:** `compileOnly` khác `implementation` ở điểm nào? Tại sao Lombok dùng `compileOnly`?

<details>
<summary>Đáp án</summary>

- `compileOnly`: chỉ có lúc compile, KHÔNG đóng gói vào JAR cuối cùng
- `implementation`: có cả lúc compile VÀ đóng gói vào JAR

Lombok dùng `compileOnly` vì nó chỉ cần lúc compile để sinh getter/setter/builder vào file `.class`. Sau khi compile xong, file `.class` đã có sẵn code getter/setter → không cần Lombok nữa → không đóng gói vào JAR → file JAR nhỏ hơn.

</details>

**Câu 4:** `./gradlew build` khác `./gradlew bootRun` ở điểm nào?

<details>
<summary>Đáp án</summary>

- `./gradlew build`: Compile code + chạy test + đóng gói thành file JAR trong `build/libs/`. KHÔNG khởi động server. Dùng để kiểm tra code có compile được không và chuẩn bị deploy.
- `./gradlew bootRun`: Compile code + khởi động Spring Boot server ngay (embedded Tomcat). Dùng trong quá trình phát triển (development). Server chạy cho đến khi bạn nhấn Ctrl+C.

</details>
