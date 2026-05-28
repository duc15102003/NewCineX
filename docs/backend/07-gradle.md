# Gradle — Build tool

---

## Gradle là gì?

Công cụ **build + quản lý dependency** cho Java. Giống npm cho Node.js.

| npm (Node.js) | Gradle (Java) |
|---|---|
| `package.json` | `build.gradle` |
| `npm install` | `./gradlew build` |
| `node_modules/` | `.gradle/` (cache) |
| `npm run dev` | `./gradlew bootRun` |

---

## Đọc build.gradle

```groovy
// === Plugins ===
plugins {
    id 'java'                                        // Compile Java
    id 'org.springframework.boot' version '3.3.5'    // Spring Boot plugin
    id 'io.spring.dependency-management' version '1.1.6'  // Quản lý version tự động
}

group = 'com.cinex'          // Package gốc
version = '0.0.1-SNAPSHOT'   // Version dự án

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)  // Java 21
    }
}

// === Repositories — Tải dependency từ đâu ===
repositories {
    mavenCentral()  // Maven Central — kho thư viện lớn nhất Java
}

// === Dependencies — Thư viện cần dùng ===
dependencies {
    // implementation: cần lúc compile + runtime
    implementation 'org.springframework.boot:spring-boot-starter-web'

    // runtimeOnly: chỉ cần lúc runtime (không cần lúc compile)
    runtimeOnly 'com.microsoft.sqlserver:mssql-jdbc'

    // compileOnly: chỉ cần lúc compile (không đóng gói vào JAR)
    compileOnly 'org.projectlombok:lombok'

    // annotationProcessor: xử lý annotation lúc compile
    annotationProcessor 'org.projectlombok:lombok'

    // testImplementation: chỉ dùng cho test
    testImplementation 'org.springframework.boot:spring-boot-starter-test'
}
```

---

## Lệnh Gradle thường dùng

```bash
# Build (compile + đóng gói JAR, bỏ qua test)
./gradlew clean build -x test

# Chạy server (development)
./gradlew bootRun

# Chạy test
./gradlew test

# Xem danh sách dependency
./gradlew dependencies

# Xóa build cũ
./gradlew clean
```

### gradlew là gì?
**Gradle Wrapper** — script tự download đúng version Gradle. Team không cần cài Gradle thủ công.

```
gradlew       ← cho Linux/Mac
gradlew.bat   ← cho Windows
```

---

## Thêm dependency mới

1. Tìm thư viện trên https://mvnrepository.com
2. Copy dòng Gradle
3. Paste vào `build.gradle` trong block `dependencies`
4. Chạy `./gradlew build` để download

```groovy
// Ví dụ: thêm thư viện gửi email
implementation 'org.springframework.boot:spring-boot-starter-mail'
```
