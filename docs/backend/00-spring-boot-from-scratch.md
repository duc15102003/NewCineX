# Tao Du An Spring Boot Tu Dau — Huong Dan Chi Tiet

> **Doi tuong:** Sinh vien chua biet gi ve Spring Boot, muon hieu SAU tu buoc dau tien.
> **Du an mau:** CineX — He thong dat ve xem phim online.

---

## Muc luc

1. [Cai dat moi truong](#1-cai-dat-moi-truong)
2. [Tao project Spring Boot](#2-tao-project-spring-boot)
3. [Cau hinh build.gradle](#3-cau-hinh-buildgradle)
4. [Cau hinh application.yml](#4-cau-hinh-applicationyml)
5. [Tao cau truc package](#5-tao-cau-truc-package)
6. [Tao BaseEntity](#6-tao-baseentity)
7. [Tao ApiResponse wrapper](#7-tao-apiresponse-wrapper)
8. [Tao module dau tien (User)](#8-tao-module-dau-tien-user)
9. [Chay va test](#9-chay-va-test)

---

## 1. Cai dat moi truong

### 1.1. Cai JDK 21

**Tai sao can JDK 21?**
JDK (Java Development Kit) la bo cong cu de viet va chay code Java. Spring Boot 3.x yeu cau **toi thieu Java 17**, nhung chung ta dung **Java 21** vi day la phien ban LTS (Long Term Support — duoc ho tro lau dai, giong nhu Windows 10 duoc ho tro nhieu nam hon Windows 8).

#### Cach 1: Dung SDKMAN (khuyen dung cho macOS/Linux)

SDKMAN giong nhu "app store" cho cac cong cu Java — cai, chuyen doi version de dang:

```bash
# Cai SDKMAN
curl -s "https://get.sdkman.io" | bash
source "$HOME/.sdkman/bin/sdkman-init.sh"

# Xem cac phien ban Java co the cai
sdk list java

# Cai JDK 21 (Temurin — ban mien phi cua Eclipse Foundation)
sdk install java 21.0.3-tem

# Kiem tra
java -version
# openjdk version "21.0.3" ...
```

#### Cach 2: Download truc tiep

- Vao [https://adoptium.net/](https://adoptium.net/)
- Chon **JDK 21**, he dieu hanh cua ban (macOS/Windows/Linux)
- Tai ve, cai dat nhu phan mem binh thuong
- Them vao PATH (Windows: System Environment Variables; macOS/Linux: export trong `~/.zshrc` hoac `~/.bashrc`)

```bash
# macOS/Linux — them vao ~/.zshrc
export JAVA_HOME=$(/usr/libexec/java_home -v 21)
export PATH=$JAVA_HOME/bin:$PATH
```

### 1.2. Cai IDE

#### Lua chon 1: IntelliJ IDEA Community (mien phi, khuyen dung)

- Tai tai [https://www.jetbrains.com/idea/download/](https://www.jetbrains.com/idea/download/)
- Chon phien ban **Community** (mien phi, du dung cho Spring Boot)
- IntelliJ hieu Java rat tot: auto-complete, refactor, debug, tich hop Gradle

#### Lua chon 2: VS Code + Extension Pack for Java

- Tai VS Code tai [https://code.visualstudio.com/](https://code.visualstudio.com/)
- Cai cac extension:
  - **Extension Pack for Java** (bao gom tat ca extension can thiet)
  - **Spring Boot Extension Pack** (ho tro Spring Boot)
  - **Gradle for Java** (ho tro build Gradle)

**Tai sao IntelliJ tot hon cho Java?**
VS Code la text editor duoc mo rong thanh IDE. IntelliJ la IDE chuyen cho Java tu dau — no hieu cau truc du an, annotation, dependency injection tot hon nhieu. Giong nhu so sanh dao Thuy Si (VS Code — da nang) voi dao dau bep (IntelliJ — chuyen biet).

### 1.3. Cai Docker Desktop

**Tai sao can Docker?**
Thay vi cai SQL Server, Redis truc tiep vao may (phuc tap, kho go), Docker cho phep chay chung trong "container" — giong nhu may ao nhe, bat/tat trong 1 giay, xoa sach khong de lai rac.

- Tai tai [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/)
- Cai dat, khoi dong Docker Desktop
- Kiem tra:

```bash
docker --version
# Docker version 27.x.x

docker compose version
# Docker Compose version v2.x.x
```

### 1.4. Kiem tra tat ca

Chay lan luot de dam bao moi thu da san sang:

```bash
java -version        # Phai thay "21.x.x"
gradle -v            # Khong bat buoc — Spring Boot co Gradle Wrapper
docker --version     # Phai thay "Docker version 2x.x"
docker compose version  # Phai thay "v2.x"
```

> **Luu y:** Khong can cai Gradle rieng. Spring Boot sinh ra file `gradlew` (Gradle Wrapper) — no tu tai dung phien ban Gradle can thiet. Day la cach lam chuan trong thuc te.

---

## 2. Tao project Spring Boot

### 2.1. Vao Spring Initializr

Spring Initializr ([https://start.spring.io](https://start.spring.io)) la "cong cu sinh du an" chinh thuc cua Spring. No tao san cau truc folder, file build, va cau hinh co ban.

**Tai sao khong tao tay?** Vi cau hinh Spring Boot kha phuc tap (phien ban phu hop, auto-configuration, ...). Initializr dam bao moi thu tuong thich voi nhau.

### 2.2. Chon cac tuy chon

| Muc | Gia tri | Giai thich |
|---|---|---|
| Project | **Gradle - Groovy** | Build tool. Gradle nhanh hon Maven, Groovy la ngon ngu viet file build |
| Language | **Java** | Ngon ngu chinh |
| Spring Boot | **3.3.5** | Phien ban on dinh moi nhat |
| Group | **com.cinex** | Ten to chuc (giong domain nguoc: cinex.com → com.cinex) |
| Artifact | **backend** | Ten du an |
| Packaging | **Jar** | File chay duoc (java -jar backend.jar) |
| Java | **21** | Phien ban JDK |

### 2.3. Chon Dependencies

Tick chon cac dependency sau:

| Dependency | Tac dung |
|---|---|
| **Spring Web** | Xay dung REST API (nhan HTTP request, tra JSON response) |
| **Spring Data JPA** | ORM — tuong tac database bang Java object thay vi viet SQL tay |
| **Spring Security** | Xac thuc (login) va phan quyen (ai duoc lam gi) |
| **Validation** | Kiem tra du lieu dau vao (@NotBlank, @Email, @Size, ...) |
| **Spring Boot Starter Mail** | Gui email (reset password, xac nhan dat ve) |
| **WebSocket** | Giao tiep 2 chieu realtime (cap nhat ghe dang chon) |
| **Spring Data Redis** | Cache du lieu vao RAM de tang toc (Redis) |
| **Liquibase Migration** | Quan ly thay doi database co kiem soat (giong git cho DB) |

Nhan **Generate**, tai file `.zip` ve, giai nen.

### 2.4. Mo du an bang IDE

**IntelliJ:**
- File → Open → Chon folder `backend` vua giai nen
- Cho IntelliJ download dependencies (goc duoi ben phai se thay progress bar)

**VS Code:**
- File → Open Folder → Chon folder `backend`
- VS Code tu dong nhan dien du an Java va goi y cai extension

### 2.5. Cau truc folder sinh ra

```
backend/
├── build.gradle              ← File cau hinh build (tuong tu package.json cua Node.js)
├── settings.gradle           ← Ten du an
├── gradlew                   ← Gradle Wrapper (Linux/macOS)
├── gradlew.bat               ← Gradle Wrapper (Windows)
├── gradle/
│   └── wrapper/
│       └── gradle-wrapper.properties  ← Phien ban Gradle se dung
└── src/
    ├── main/
    │   ├── java/com/cinex/backend/
    │   │   └── BackendApplication.java    ← Diem khoi dong cua ung dung
    │   └── resources/
    │       ├── application.properties     ← File cau hinh (ta doi thanh .yml)
    │       ├── static/                    ← File tinh (HTML, CSS, JS — ta khong dung)
    │       └── templates/                 ← Template engine (ta khong dung — dung React)
    └── test/
        └── java/com/cinex/backend/
            └── BackendApplicationTests.java  ← Test tu dong
```

**Giai thich:**

- `build.gradle` — "danh sach nguyen lieu" cua du an. Khai bao dung thu vien nao, phien ban bao nhieu.
- `gradlew` — Tuong tu `npx` cua Node.js. Chay `./gradlew build` se tu tai Gradle ve neu chua co.
- `BackendApplication.java` — File `main()` cua Java. Spring Boot khoi dong tu day.
- `application.properties` — File cau hinh (URL database, port server, ...). Ta se doi thanh `.yml` cho de doc.

---

## 3. Cau hinh build.gradle

### 3.1. Hieu cau truc file build.gradle

File `build.gradle` giong nhu "cong thuc nau an" — no noi cho Gradle biet: du an can nhung gi, lay o dau, build the nao.

```groovy
// === PLUGINS ===
// Plugin la "ky nang" ma Gradle can de build du an.
// Giong nhu ban can biet "nau an" (java), "lam banh" (spring boot).
plugins {
    id 'java'                                                    // 1) Biet compile Java
    id 'org.springframework.boot' version '3.3.5'                // 2) Biet dong goi Spring Boot JAR
    id 'io.spring.dependency-management' version '1.1.6'         // 3) Quan ly phien ban thu vien tu dong
}

// === THONG TIN DU AN ===
group = 'com.cinex'             // Ten to chuc (giong ho cua ban)
version = '0.0.1-SNAPSHOT'     // Phien ban du an (SNAPSHOT = dang phat trien)

// === PHIEN BAN JAVA ===
java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)  // Dung JDK 21 de compile
    }
}

// === CAU HINH DAC BIET ===
// Dam bao Lombok co the "nhom" voi annotation processor khac
configurations {
    compileOnly {
        extendsFrom annotationProcessor
    }
}

// === LAY THU VIEN TU DAU ===
repositories {
    mavenCentral()  // Kho thu vien lon nhat cua Java (giong npm registry)
}

// === DANH SACH THU VIEN (DEPENDENCIES) ===
dependencies {
    // ... (chi tiet ben duoi)
}

// === CAU HINH TEST ===
tasks.named('test') {
    useJUnitPlatform()  // Dung JUnit 5 de chay test
}
```

### 3.2. Giai thich cac loai dependency

Trong Gradle, moi dependency co 1 **scope** (pham vi):

| Scope | Y nghia | Vi du |
|---|---|---|
| `implementation` | Can khi COMPILE va khi CHAY | Spring Web, JPA, JWT |
| `compileOnly` | Chi can khi COMPILE, khong dong goi vao JAR | Lombok (chi sinh code luc compile) |
| `runtimeOnly` | Chi can khi CHAY, khong can luc compile | JDBC Driver (JPA tu tim) |
| `annotationProcessor` | Xu ly annotation luc compile, sinh code tu dong | Lombok, MapStruct |
| `testImplementation` | Chi dung trong test | JUnit, Mockito |

**Vi du doi thuong:** Giong nhu xay nha:
- `implementation` = gach, xi mang (can khi xay VA khi su dung)
- `compileOnly` = dan giao (can khi xay, nhung go bo sau khi xong)
- `runtimeOnly` = dien, nuoc (khong can khi xay, nhung can khi o)
- `annotationProcessor` = robot tho (giup xay nhanh hon, nhung khong o lai trong nha)

### 3.3. File build.gradle hoan chinh cua CineX

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
    // "Starter" la goi combo — 1 starter bao gom nhieu thu vien lien quan.
    // Giong nhu mua "combo pho" thay vi mua tung mon rieng le.
    // =====================================================

    // Web — xay dung REST API (nhung Tomcat, Jackson JSON, DispatcherServlet)
    implementation 'org.springframework.boot:spring-boot-starter-web'

    // JPA — ORM framework, tuong tac DB bang Java object
    implementation 'org.springframework.boot:spring-boot-starter-data-jpa'

    // Security — xac thuc, phan quyen, bao mat
    implementation 'org.springframework.boot:spring-boot-starter-security'

    // Validation — kiem tra du lieu dau vao: @NotBlank, @Email, @Size, ...
    implementation 'org.springframework.boot:spring-boot-starter-validation'

    // Redis — cache du lieu trong RAM de tang toc truy van
    implementation 'org.springframework.boot:spring-boot-starter-data-redis'

    // WebSocket — giao tiep 2 chieu realtime (cap nhat ghe dang chon)
    implementation 'org.springframework.boot:spring-boot-starter-websocket'

    // =====================================================
    // DATABASE
    // =====================================================

    // JDBC Driver cho SQL Server — cau noi giua Java va SQL Server
    // runtimeOnly vi JPA tu dong tim driver, code khong goi truc tiep
    runtimeOnly 'com.microsoft.sqlserver:mssql-jdbc'

    // Liquibase — quan ly thay doi database (giong git cho DB schema)
    // Moi thay doi (them bang, sua cot) duoc ghi vao file XML → chay tu dong khi start
    implementation 'org.liquibase:liquibase-core'

    // =====================================================
    // JWT (JSON Web Token) — xac thuc khong trang thai (stateless)
    // Can 3 thu vien: API (interface), Impl (code thuc thi), Jackson (doc/ghi JSON)
    // =====================================================
    implementation 'io.jsonwebtoken:jjwt-api:0.12.6'
    runtimeOnly 'io.jsonwebtoken:jjwt-impl:0.12.6'
    runtimeOnly 'io.jsonwebtoken:jjwt-jackson:0.12.6'

    // =====================================================
    // MAPSTRUCT — tu dong chuyen doi Entity <-> DTO
    // Giong nhu robot tu dong dich tieng Anh sang tieng Viet:
    // ban chi can noi "dich entity User thanh UserResponse" → no lam het.
    //
    // QUAN TRONG: MapStruct chay luc COMPILE (khong dung reflection luc runtime)
    // → nhanh hon va an toan hon cac thu vien khac (ModelMapper, Dozer).
    // =====================================================
    implementation 'org.mapstruct:mapstruct:1.6.3'
    annotationProcessor 'org.mapstruct:mapstruct-processor:1.6.3'

    // =====================================================
    // LOMBOK — giam code boilerplate (getter, setter, constructor, builder)
    // Thay vi viet 50 dong getter/setter, chi can @Getter @Setter.
    //
    // ⚠️ THU TU ANNOTATION PROCESSOR RAT QUAN TRONG:
    // Lombok PHAI dung TRUOC MapStruct trong danh sach annotationProcessor.
    //
    // Tai sao? Vi Lombok sinh getter/setter truoc → MapStruct doc getter/setter
    // de biet cach mapping. Neu MapStruct chay truoc → no khong thay getter/setter
    // → mapping bi loi.
    //
    // Giong nhu: phai co banh mi (Lombok sinh getter) truoc khi kep thit
    // (MapStruct doc getter de map).
    // =====================================================
    compileOnly 'org.projectlombok:lombok'
    annotationProcessor 'org.projectlombok:lombok'
    // Cau noi giua Lombok va MapStruct — dam bao 2 thu vien "noi chuyen" duoc voi nhau
    annotationProcessor 'org.projectlombok:lombok-mapstruct-binding:0.2.0'

    // =====================================================
    // EMAIL — gui email xac nhan, reset password
    // =====================================================
    implementation 'org.springframework.boot:spring-boot-starter-mail'

    // =====================================================
    // CLOUDINARY — upload anh len cloud (poster phim, avatar user)
    // Thay vi luu anh tren server → luu tren Cloudinary (CDN toan cau, nhanh hon)
    // =====================================================
    implementation 'com.cloudinary:cloudinary-http5:2.0.0'

    // =====================================================
    // QR CODE — sinh ma QR cho ve xem phim
    // ZXing (Zebra Crossing) la thu vien ma nguon mo cua Google
    // =====================================================
    implementation 'com.google.zxing:core:3.5.3'
    implementation 'com.google.zxing:javase:3.5.3'

    // =====================================================
    // SWAGGER / OPENAPI — tu dong sinh trang tai lieu API
    // Truy cap http://localhost:8088/swagger-ui.html de xem
    // Moi endpoint tu dong xuat hien, co the test truc tiep tren trinh duyet
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

### 3.4. Ve thu tu annotationProcessor

Day la loi **rat pho bien** khi dung Lombok + MapStruct cung luc:

```
// SAI — MapStruct khong thay getter/setter
annotationProcessor 'org.mapstruct:mapstruct-processor:1.6.3'
annotationProcessor 'org.projectlombok:lombok'

// DUNG — Lombok sinh getter truoc, MapStruct doc sau
annotationProcessor 'org.projectlombok:lombok'
annotationProcessor 'org.projectlombok:lombok-mapstruct-binding:0.2.0'
annotationProcessor 'org.mapstruct:mapstruct-processor:1.6.3'
```

> **Meo:** Trong thuc te, `lombok-mapstruct-binding` giup Gradle hieu dung thu tu xu ly. Nhung de an toan, luon khai bao Lombok truoc MapStruct.

---

## 4. Cau hinh application.yml

### 4.1. Tai sao dung .yml thay vi .properties?

Spring Boot ho tro 2 dinh dang cau hinh:

```properties
# application.properties — phang, lap lai prefix
spring.datasource.url=jdbc:sqlserver://localhost:1433
spring.datasource.username=sa
spring.datasource.password=CineX@2026
spring.jpa.hibernate.ddl-auto=validate
spring.jpa.show-sql=true
```

```yaml
# application.yml — co phan cap, de doc hon
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

**Ket luan:** `.yml` de doc hon khi co nhieu cap long nhau. Hau het du an thuc te dung `.yml`.

**Cach chuyen:** Xoa file `application.properties`, tao file `application.yml` cung thu muc (`src/main/resources/`).

### 4.2. Profiles la gi?

**Van de:** Khi code o may ca nhan (dev), database la `localhost`. Khi deploy len server (prod), database la `db.production.com`. Lam sao de khong phai sua code moi lan deploy?

**Giai phap: Spring Profiles**

Spring cho phep tao nhieu file cau hinh cho tung moi truong:

```
src/main/resources/
├── application.yml          ← Cau hinh CHUNG (dung cho tat ca moi truong)
├── application-dev.yml      ← Cau hinh rieng cho DEV (ghi de len cau hinh chung)
└── application-prod.yml     ← Cau hinh rieng cho PRODUCTION
```

**Cach hoat dong:**
1. Spring doc `application.yml` truoc (cau hinh chung)
2. Dua vao profile dang active (`spring.profiles.active`), doc them file tuong ung
3. Cau hinh trong file profile **ghi de** len cau hinh chung

**Vi du doi thuong:** Giong nhu ban co 1 bo quan ao co ban (application.yml). Khi di lam → mac them ao vest (dev.yml). Khi di tiec → mac them ao khoac (prod.yml). Bo co ban van giu nguyen.

### 4.3. Cu phap ${ENV_VAR:default}

```yaml
url: jdbc:sqlserver://${DB_HOST:localhost}:${DB_PORT:1433}
```

Dich: "Lay gia tri tu bien moi truong `DB_HOST`. Neu khong tim thay → dung `localhost`."

**Tai sao can?**
- Khi chay tren may ca nhan: khong set bien moi truong → tu dong dung `localhost`
- Khi chay tren server/Docker: set `DB_HOST=db.production.com` → dung gia tri do
- **Khong bao gio hardcode** password, secret key vao code → lo khi push len Git

### 4.4. File application.yml (cau hinh chung)

```yaml
# === CAU HINH CHUNG — DUNG CHO TAT CA MOI TRUONG ===

spring:
  profiles:
    active: dev                    # Mac dinh dung profile "dev"
  servlet:
    multipart:
      max-file-size: 5MB          # Kich thuoc file upload toi da
      max-request-size: 5MB       # Kich thuoc request toi da

server:
  port: 8088                       # Port cua backend (mac dinh Spring la 8080)

# === CAU HINH TUY CHINH CUA DU AN ===

app:
  frontend-url: ${FRONTEND_URL:http://localhost:5173}   # URL frontend (cho CORS)
  jwt:
    # Secret key de ky JWT — PHAI la chuoi Base64, du dai >= 256 bit
    secret: ${JWT_SECRET:dGhpcyBpcyBhIHZlcnkgbG9uZyBzZWNyZXQga2V5IGZvciBkZXZlbG9wbWVudCBvbmx5IDEyMzQ1Njc4OTA=}
    expiration-ms: ${JWT_EXPIRATION:900000}             # 15 phut (access token)
    refresh-expiration-ms: ${JWT_REFRESH_EXPIRATION:604800000}  # 7 ngay (refresh token)

# === CLOUDINARY — UPLOAD ANH ===
cloudinary:
  cloud-name: ${CLOUDINARY_CLOUD_NAME:your-cloud-name}
  api-key: ${CLOUDINARY_API_KEY:your-api-key}
  api-secret: ${CLOUDINARY_API_SECRET:your-api-secret}
```

### 4.5. File application-dev.yml (cau hinh rieng cho dev)

```yaml
# === CAU HINH CHI DUNG KHI CHAY O MAY CA NHAN (DEV) ===

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
      # ddl-auto co 5 che do:
      # - none:     KHONG lam gi (production dung cai nay)
      # - validate: CHI KIEM TRA entity khop voi DB, khong sua DB
      # - update:   Tu dong ALTER TABLE khi entity thay doi (NGUY HIEM cho production!)
      # - create:   Xoa het + tao lai bang moi lan start (mat du lieu!)
      # - create-drop: Giong create + xoa het khi tat app
      #
      # Ta dung "validate" + Liquibase de quan ly DB an toan.
      ddl-auto: validate
    show-sql: true                     # In SQL ra console (chi bat o dev)
    properties:
      hibernate:
        dialect: org.hibernate.dialect.SQLServerDialect
        format_sql: true               # Format SQL cho de doc

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
    host: ${MAIL_HOST:sandbox.smtp.mailtrap.io}     # Mailtrap = "hop thu gia" cho dev
    port: ${MAIL_PORT:2525}
    username: ${MAIL_USERNAME:your-mailtrap-username}
    password: ${MAIL_PASSWORD:your-mailtrap-password}
    properties:
      mail.smtp.auth: true
      mail.smtp.starttls.enable: true

# --- LOGGING ---
logging:
  level:
    com.cinex: DEBUG                    # Log chi tiet cho code cua minh
    org.springframework.security: DEBUG # Log chi tiet cho security (debug loi phan quyen)
```

### 4.6. Giai thich cac cau hinh quan trong

| Cau hinh | Tac dung | Vi du doi thuong |
|---|---|---|
| `ddl-auto: validate` | Chi kiem tra entity co khop DB khong, KHONG tu dong sua DB | Kiem tra khoa co vua o khong, nhung khong tu y lam them chia khoa |
| `show-sql: true` | In SQL ma Hibernate sinh ra | Bat camera giam sat de xem ai lam gi |
| `format_sql: true` | SQL duoc format dep (xuong dong, thut dau dong) | Giong nhu viet van co dan y thay vi viet lien tu |
| Liquibase `change-log` | Diem bat dau doc cac file thay doi DB | Giong nhu muc luc cua cuon sach |

---

## 5. Tao cau truc package

### 5.1. Package by Feature vs Package by Layer

Co 2 cach to chuc code:

**Package by Layer (KHONG DUNG):**
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

**Van de:** Khi sua module Booking, ban phai nhay qua 4 folder khac nhau. Khi du an lon (20+ entity), moi folder co 20+ file → kho tim.

**Package by Feature (DUNG CAI NAY):**
```
com.cinex/
├── common/                          ← Code dung chung cho tat ca module
│   ├── entity/
│   │   ├── BaseEntity.java         ← Class cha cua moi entity
│   │   └── StorageState.java       ← Enum: ACTIVE, ARCHIVED
│   ├── config/                      ← Cau hinh: Security, CORS, Redis, OpenAPI
│   ├── exception/                   ← Xu ly loi tap trung
│   │   ├── ErrorCode.java          ← Ma loi: USER_NOT_FOUND, INVALID_CREDENTIALS, ...
│   │   ├── BusinessException.java  ← Exception cho loi nghiep vu
│   │   └── GlobalExceptionHandler.java  ← Bat loi tu tat ca controller
│   ├── response/                    ← Format response thong nhat
│   │   ├── ApiResponse.java        ← { success, message, data, timestamp }
│   │   └── PageResponse.java       ← { content, page, size, totalElements, ... }
│   ├── service/                     ← Service dung chung (email, upload, ...)
│   └── util/                        ← Ham tien ich (SecurityUtil, DateTimeUtil, ...)
│
├── security/                        ← Xac thuc + Phan quyen
│   ├── JwtUtil.java                ← Tao/doc/validate JWT token
│   ├── JwtAuthFilter.java          ← Filter bat moi request, kiem tra JWT
│   └── CustomUserDetailsService.java
│
└── module/                          ← TAT CA MODULE NGHIEP VU
    ├── auth/                        ← Dang ky, Dang nhap, Refresh, Reset password
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
    ├── user/                        ← Quan ly profile, admin quan ly user
    │   ├── dto/
    │   ├── service/
    │   ├── controller/
    │   ├── mapper/
    │   └── specification/
    │
    ├── movie/                       ← Quan ly phim, the loai, suat chieu
    │   ├── entity/
    │   ├── dto/
    │   ├── repository/
    │   ├── service/
    │   ├── controller/
    │   └── mapper/
    │
    └── booking/                     ← Dat ve, thanh toan
        ├── entity/
        ├── dto/
        ├── repository/
        ├── service/
        └── controller/
```

**Tai sao Package by Feature?**
1. **Lien quan o gan nhau:** Tat ca code cua module Booking nam cung 1 cho → de tim, de hieu
2. **De xoa:** Muon bo module nao → xoa 1 folder la xong
3. **De phan cong:** Nguoi A lam module auth, nguoi B lam module movie → khong xung dot
4. **Thuc te:** Hau het cong ty lon (Netflix, Uber, Grab) dung package by feature

### 5.2. Tao cac package

Trong IDE, click chuot phai vao `src/main/java/com/cinex/` → New → Package:

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

> **Luu y:** Java yeu cau moi package PHAI co it nhat 1 file. Package rong se bi IDE xoa tu dong. Nen tao package khi can, khong tao truoc tat ca.

---

## 6. Tao BaseEntity

### 6.1. Tai sao can BaseEntity?

**Van de:** Moi entity trong du an deu can cac truong giong nhau:
- `id` — khoa chinh
- `version` — kiem tra xung dot khi 2 nguoi sua cung luc
- `storageState` — xoa mem (ACTIVE/ARCHIVED)
- `createdAt`, `updatedAt` — thoi gian tao/sua
- `createdBy`, `updatedBy` — ai tao/sua

Neu viet lai cac truong nay trong **MOI** entity (User, Movie, Booking, ...) → lap code, de quen, kho bao tri.

**Giai phap:** Tao 1 class cha `BaseEntity`, tat ca entity ke thua tu no.

**Vi du doi thuong:** Giong nhu mau don xin viec da co san "Ho ten", "Ngay sinh", "So dien thoai" — ban chi can dien them phan "Kinh nghiem lam viec" (cac truong rieng cua tung entity).

### 6.2. Code BaseEntity

Tao file `src/main/java/com/cinex/common/entity/BaseEntity.java`:

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

Tao file `src/main/java/com/cinex/common/entity/StorageState.java`:

```java
package com.cinex.common.entity;

/**
 * Trang thai luu tru — dung cho soft delete toan bo du an.
 *
 * ACTIVE: dang hoat dong (mac dinh khi tao moi)
 * ARCHIVED: da xoa mem (khong hien cho user, admin co the khoi phuc)
 */
public enum StorageState {
    ACTIVE,
    ARCHIVED
}
```

### 6.3. Giai thich tung annotation

| Annotation | Tac dung | Vi du doi thuong |
|---|---|---|
| `@MappedSuperclass` | Bao JPA: "Day la class cha, KHONG tao bang rieng, chi truyen field xuong class con" | Giong nhu ban ve thiet ke co ban — nha nao cung co nen mong, nhung nen mong khong phai la 1 can nha rieng |
| `@EntityListeners(AuditingEntityListener.class)` | Tu dong dien `createdAt`, `updatedAt`, `createdBy`, `updatedBy` | Giong nhu camera giam sat tu dong ghi lai: ai vao luc nao, ai sua luc nao |
| `@Id` | Danh dau truong nay la khoa chinh | So CMND cua moi ban ghi |
| `@GeneratedValue(strategy = IDENTITY)` | Database tu tang id (1, 2, 3, ...) | Giong nhu so thu tu khi xep hang — may tinh tu dong cap |
| `@Version` | Optimistic Locking — ngan 2 nguoi sua cung luc bi ghi de | Giong nhu Google Docs: neu 2 nguoi sua cung 1 dong → bao xung dot |
| `@Enumerated(EnumType.STRING)` | Luu enum duoi dang chu (ACTIVE, ARCHIVED) thay vi so (0, 1) | Doc DB thay "ACTIVE" de hieu hon thay "0" |
| `@Column(updatable = false)` | Truong nay chi duoc set 1 lan khi INSERT, khong duoc UPDATE | Giong nhu ngay sinh — khong ai doi duoc |
| `@CreatedDate` | Spring tu dong dien ngay tao | Khong can viet `entity.setCreatedAt(LocalDateTime.now())` |
| `@CreatedBy` | Spring tu dong dien nguoi tao (lay tu SecurityContext) | Khong can viet `entity.setCreatedBy(currentUser)` |

### 6.4. Ve @Version — Optimistic Locking

**Tinh huong:** Admin A va admin B cung mo trang sua phim "Avengers". A sua gia ve 100k, B sua ten phim "Avengers 5". Ca 2 nhan Save cung luc.

**Khong co @Version:**
- A save truoc: gia = 100k, ten = "Avengers" (chua doi)
- B save sau: gia = ? (bi ghi de ve gia cu!), ten = "Avengers 5"
→ Thay doi cua A bi mat!

**Co @Version:**
- Khi A load phim: version = 1
- Khi B load phim: version = 1
- A save: `UPDATE movies SET ... WHERE id = 1 AND version = 1` → Thanh cong, version tang len 2
- B save: `UPDATE movies SET ... WHERE id = 1 AND version = 1` → THAT BAI (vi version da la 2)
- B nhan thong bao: "Du lieu da bi nguoi khac cap nhat, vui long tai lai"

---

## 7. Tao ApiResponse wrapper

### 7.1. Tai sao can response thong nhat?

**Khong co wrapper — moi API tra kieu khac nhau:**

```json
// GET /api/users/1 → tra User truc tiep
{ "id": 1, "username": "vanan" }

// POST /api/auth/login → tra token
{ "accessToken": "xxx", "refreshToken": "yyy" }

// DELETE /api/users/1 → tra gi? String? null? void?
"Deleted successfully"
```

**Frontend rat kho xu ly:** Moi API phai viet logic khac nhau de doc response.

**Co wrapper — TAT CA API cung format:**

```json
// Thanh cong
{
    "success": true,
    "message": "OK",
    "data": { ... },            // Du lieu thuc te (bat ky kieu gi)
    "timestamp": "2026-05-27T..."
}

// Loi
{
    "success": false,
    "message": "Email da duoc su dung",
    "data": null,
    "timestamp": "2026-05-27T..."
}
```

**Frontend chi can:**
```javascript
const res = await api.post('/auth/login', data);
if (res.data.success) {
    // Dung: doc res.data.data
} else {
    // Loi: hien res.data.message
}
```

### 7.2. Code ApiResponse

Tao file `src/main/java/com/cinex/common/response/ApiResponse.java`:

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
@JsonInclude(JsonInclude.Include.NON_NULL)  // Khong tra field null trong JSON
public class ApiResponse<T> {

    private boolean success;     // true = thanh cong, false = loi
    private String message;      // Thong bao ("Login successful", "User not found")
    private T data;              // Du lieu thuc te (Generic — bat ky kieu gi)
    @Builder.Default
    private Instant timestamp = Instant.now();  // Thoi diem response

    // --- Factory method cho truong hop thanh cong ---

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

    // --- Factory method cho truong hop loi ---

    public static <T> ApiResponse<T> error(String message) {
        return ApiResponse.<T>builder()
                .success(false)
                .message(message)
                .build();
    }
}
```

### 7.3. Code PageResponse (cho phan trang)

Tao file `src/main/java/com/cinex/common/response/PageResponse.java`:

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

    private List<T> content;         // Danh sach item trang hien tai
    private int page;                // Trang hien tai (bat dau tu 0)
    private int size;                // So item moi trang
    private long totalElements;      // Tong so item
    private int totalPages;          // Tong so trang
    private boolean last;            // Co phai trang cuoi khong

    /**
     * Chuyen tu Spring Page<T> sang PageResponse<T>.
     * Giup controller khong phu thuoc vao class Page cua Spring.
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

### 7.4. Giai thich Generic `<T>`

`ApiResponse<T>` nghia la: "Response nay chua du lieu kieu T — T co the la BAT KY kieu gi."

```java
ApiResponse<User>                   // T = User → data la 1 User object
ApiResponse<List<Movie>>            // T = List<Movie> → data la danh sach phim
ApiResponse<String>                 // T = String → data la 1 chuoi
ApiResponse<Void>                   // T = Void → khong co data (delete, logout)
```

**Vi du doi thuong:** `ApiResponse<T>` giong nhu hop qua — cai hop luon giong nhau (success, message, timestamp), nhung ben trong co the la banh (User), hoa (Movie), hoac rong (Void).

---

## 8. Tao module dau tien (User)

Ta se tao tung file theo thu tu: **Entity → DTO → Repository → Service → Controller → Mapper**.

Thu tu nay quan trong vi: Repository can Entity, Service can Repository, Controller can Service.

### 8.1. Entity — User.java

**Entity la gi?** La class Java dai dien cho 1 bang trong database. Moi field = 1 cot. Moi instance = 1 dong.

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

@Entity                          // Bao JPA: "Day la 1 entity, map voi 1 bang trong DB"
@Table(name = "users")           // Ten bang trong DB (so nhieu)
@Getter @Setter                  // Lombok: tu sinh getter/setter
@NoArgsConstructor               // Lombok: constructor khong tham so (JPA yeu cau)
@AllArgsConstructor              // Lombok: constructor day du tham so
@Builder                         // Lombok: tao object bang Builder pattern
public class User extends BaseEntity {
    //             ^^^^^^^^^^^^^^^^
    //  Ke thua BaseEntity → tu dong co id, version, storageState, audit fields

    @Column(nullable = false, unique = true, length = 50)
    private String username;
    //  → Cot "username" trong DB, KHONG duoc null, KHONG duoc trung, toi da 50 ky tu

    @Column(nullable = false, unique = true, length = 100)
    private String email;

    @Column(nullable = false)
    private String password;     // Luu dang MA HOA (bcrypt), KHONG BAO GIO luu plain text

    @Column(name = "full_name", length = 100)
    private String fullName;
    //  name = "full_name" → ten cot trong DB la "full_name" (snake_case)
    //  Con Java dung "fullName" (camelCase)

    @Column(length = 20)
    private String phone;

    @Column(name = "avatar_url", length = 500)
    private String avatarUrl;

    @Enumerated(EnumType.STRING)  // Luu "USER" thay vi 0, "ADMIN" thay vi 1
    @Column(nullable = false, length = 20)
    @Builder.Default              // Khi dung Builder, mac dinh la USER
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
    USER,    // Nguoi dung thuong
    ADMIN    // Quan tri vien
}
```

### 8.2. DTO — Request va Response

**DTO la gi?** Data Transfer Object — doi tuong chuyen du lieu giua cac tang (frontend ↔ backend).

**Tai sao khong tra entity thang?**
1. **Bao mat:** Entity co truong `password` — tra thang = lo mat khau
2. **Linh hoat:** API list chi can `id, username, email`. API detail can nhieu hon. 1 entity → nhieu DTO
3. **Kiem soat:** DTO chi cho phep client gui dung cac truong can thiet

**Vi du doi thuong:** Entity giong nhu ho so y te day du (ten, benh su, xet nghiem, ...). DTO giong nhu phieu kham — chi hien thong tin can thiet cho tung truong hop.

#### RegisterRequest (client gui len khi dang ky)

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

    @NotBlank(message = "Ten dang nhap la bat buoc")
    @Size(min = 3, max = 50, message = "Ten dang nhap tu 3-50 ky tu")
    private String username;

    @NotBlank(message = "Email la bat buoc")
    @Email(message = "Email khong hop le")
    private String email;

    @NotBlank(message = "Mat khau la bat buoc")
    @Size(min = 6, max = 100, message = "Mat khau tu 6-100 ky tu")
    private String password;

    private String fullName;   // Khong bat buoc → khong co @NotBlank
}
```

**Giai thich Validation annotations:**

| Annotation | Tac dung |
|---|---|
| `@NotBlank` | Khong duoc null, khong duoc rong, khong duoc chi co khoang trang |
| `@Email` | Phai co dang email hop le (co @, co domain) |
| `@Size(min, max)` | Do dai chuoi phai trong khoang min-max |

Khi client gui du lieu KHONG hop le, Spring tu dong tra loi 400 Bad Request + thong bao loi.

#### AuthResponse (server tra ve sau khi login/register)

```java
package com.cinex.module.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@AllArgsConstructor
public class AuthResponse {

    private String accessToken;      // JWT token de xac thuc cac request sau
    private String refreshToken;     // Token de lay access token moi khi het han

    @Builder.Default
    private String tokenType = "Bearer";   // Loai token (luon la "Bearer")

    private long expiresIn;          // Thoi gian het han (giay)
}
```

#### UserProfileResponse (server tra ve khi xem profile)

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
    // Chu y: KHONG co truong "password" → KHONG BAO GIO tra password cho client
}
```

### 8.3. Repository — UserRepository.java

**Repository la gi?** La interface tuong tac voi database. Spring Data JPA tu dong sinh code SQL — ban chi can khai bao method.

```java
package com.cinex.module.auth.repository;

import com.cinex.module.auth.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface UserRepository
        extends JpaRepository<User, Long>,          // CRUD co ban + phan trang
                JpaSpecificationExecutor<User> {     // Query dong (search, filter)
    //            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    //  JpaRepository<Entity, KieuID>
    //  - Entity: class entity (User)
    //  - KieuID: kieu cua truong @Id (Long)
    //
    //  Tu dong co san cac method:
    //  - save(entity)        → INSERT hoac UPDATE
    //  - findById(id)        → SELECT * WHERE id = ?
    //  - findAll()           → SELECT *
    //  - findAll(pageable)   → SELECT * LIMIT ? OFFSET ?
    //  - deleteById(id)      → DELETE WHERE id = ?
    //  - count()             → SELECT COUNT(*)

    // Query method — Spring doc ten method va tu sinh SQL
    // findActiveByUsername → SELECT * FROM users WHERE username = ? AND storage_state != 'DELETED'
    @Query("SELECT u FROM User u WHERE u.username = :username AND (u.storageState IS NULL OR u.storageState <> 'DELETED')")
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

**Tai sao la interface ma khong phai class?**
Spring Data JPA dung **Proxy Pattern** — luc runtime, no tu dong tao 1 class implement interface nay. Ban chi can khai bao "can gi", Spring lo "lam the nao".

**Quy tac dat ten method:**

| Ten method | SQL duoc sinh |
|---|---|
| `findByUsername(String)` | `WHERE username = ?` |
| `findByEmailAndEnabled(String, boolean)` | `WHERE email = ? AND enabled = ?` |
| `findByRoleOrderByCreatedAtDesc(Role)` | `WHERE role = ? ORDER BY created_at DESC` |
| `countByEnabled(boolean)` | `SELECT COUNT(*) WHERE enabled = ?` |
| `existsByEmail(String)` | `SELECT CASE WHEN COUNT(*) > 0 THEN true ELSE false END WHERE email = ?` |

### 8.4. Mapper — UserMapper.java

**Mapper la gi?** La lop chuyen doi giua Entity va DTO. MapStruct tu dong sinh code luc compile.

```java
package com.cinex.module.user.mapper;

import com.cinex.module.auth.entity.User;
import com.cinex.module.user.dto.UserProfileResponse;
import org.mapstruct.Mapper;

/**
 * [Mapper Pattern - MapStruct]
 * componentModel = "spring" → Dang ky nhu 1 Spring Bean
 * → co the inject bang constructor injection.
 */
@Mapper(componentModel = "spring")
public interface UserMapper {

    /**
     * MapStruct tu dong match field theo TEN:
     * user.getUsername()  → response.username
     * user.getEmail()     → response.email
     * user.getFullName()  → response.fullName
     * ...
     *
     * Neu ten khac nhau, dung @Mapping:
     * @Mapping(source = "avatarUrl", target = "profileImage")
     */
    UserProfileResponse toProfileResponse(User user);
}
```

**Tai sao dung MapStruct ma khong viet tay?**

```java
// KHONG dung MapStruct — viet TAY (5 truong = 5 dong, 20 truong = 20 dong)
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
    // Them 1 field moi → phai nho sua o day. De QUEN!
}

// DUNG MapStruct — chi 1 dong, tu dong match tat ca field cung ten
UserProfileResponse toProfileResponse(User user);
// Them field moi co cung ten → tu dong map. KHONG CAN SUA GI!
```

### 8.5. Service — AuthService.java

**Service la gi?** La noi chua **TOAN BO business logic** (luan nghiep vu). Controller chi nhan request roi chuyen cho Service xu ly.

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

@Service                  // Danh dau day la Service Bean — Spring quan ly lifecycle
@RequiredArgsConstructor  // Lombok: tu sinh constructor cho tat ca truong final
@Slf4j                    // Lombok: tu sinh logger (log.info(), log.warn(), log.error())
public class AuthService {

    // Dependency Injection qua constructor (RequiredArgsConstructor sinh constructor)
    // Tai sao dung "final"? → Dam bao dependency KHONG bi thay doi sau khi tao
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    /**
     * Dang ky tai khoan moi.
     *
     * @Transactional: Tat ca thao tac DB trong method nay nam trong 1 transaction.
     * Neu loi xay ra giua chung → ROLLBACK tat ca (khong luu gi ca).
     *
     * Vi du: Nhu ky hop dong — hoac ky HET hoac HUY het, khong ky nua chung.
     */
    @Transactional
    public AuthResponse register(RegisterRequest request) {
        // Kiem tra trung username
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new BusinessException(ErrorCode.USER_EXISTED, "Ten dang nhap da duoc su dung");
        }
        // Kiem tra trung email
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new BusinessException(ErrorCode.USER_EXISTED, "Email da duoc su dung");
        }

        // Tao User entity bang Builder pattern
        User user = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                //         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                //  MA HOA mat khau truoc khi luu. KHONG BAO GIO luu plain text!
                //  bcrypt: "123456" → "$2a$10$N9qo8uLOickgx2ZMRZoMye..."
                .fullName(request.getFullName())
                .build();

        userRepository.save(user);
        // JPA tu dong: INSERT INTO users (username, email, password, ...) VALUES (?, ?, ?, ...)

        log.info("User {} registered", user.getUsername());

        return buildAuthResponse(user);
    }

    /**
     * Dang nhap.
     */
    @Transactional(readOnly = true)
    //              ^^^^^^^^^^^
    //  readOnly = true: bao Hibernate rang method nay CHI DOC, khong ghi
    //  → Hibernate toi uu: khong can track thay doi, khong can flush
    //  → Nhanh hon!
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findActiveByUsername(request.getUsername())
                .orElseThrow(() -> new BusinessException(ErrorCode.INVALID_CREDENTIALS));
                //  ^^^^^^^^^^^^
                //  Optional.orElseThrow: Neu khong tim thay → nem exception
                //  KHONG dung .get() vi se NullPointerException neu rong

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new BusinessException(ErrorCode.INVALID_CREDENTIALS);
            //  Chu y: KHONG noi "sai mat khau" hay "sai username" cu the
            //  → Tranh ke tan cong biet username nao ton tai (security best practice)
        }

        if (!user.isEnabled()) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Tai khoan da bi vo hieu hoa");
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

**Cac quy tac Service:**
1. **Moi method cong khai** phai co `@Transactional` (ghi) hoac `@Transactional(readOnly = true)` (doc)
2. **Khi co loi** → throw `BusinessException`, KHONG return null
3. **Ten method ro rang:** `createBooking()` thay vi `process()`, `handleUser()` thay vi `doStuff()`
4. **KHONG goi Controller**, khong tra HttpResponse, khong doc HttpRequest

### 8.6. Controller — AuthController.java

**Controller la gi?** La "le tan" — nhan request tu client, chuyen cho Service xu ly, roi tra response ve client. Controller chi lam 3 viec: NHAN → GOI → TRA.

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
                           // Moi method tu dong tra JSON (khong can ghi @ResponseBody)
@RequestMapping("/api/auth")  // Tat ca endpoint bat dau bang /api/auth
@RequiredArgsConstructor
@Tag(name = "Auth", description = "Register, Login, Logout")  // Swagger: nhom cac API
public class AuthController {

    private final AuthService authService;
    //  Chi inject Service, KHONG inject Repository.
    //  Controller → Service → Repository (khong nhay cap)

    @PostMapping("/register")                        // POST /api/auth/register
    @Operation(summary = "Register a new account")   // Swagger: mo ta API
    public ApiResponse<AuthResponse> register(
            @Valid @RequestBody RegisterRequest request) {
        //  @Valid: bat Spring kiem tra @NotBlank, @Email, @Size trong DTO
        //  Neu khong hop le → tu dong tra 400 Bad Request
        //
        //  @RequestBody: doc JSON tu body request va chuyen thanh Java object
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

**Giai thich annotation:**

| Annotation | Tac dung |
|---|---|
| `@RestController` | Danh dau class nay la controller, tu dong tra JSON |
| `@RequestMapping("/api/auth")` | Prefix URL cho tat ca method trong class |
| `@PostMapping("/register")` | Method nay xu ly POST /api/auth/register |
| `@GetMapping`, `@PutMapping`, `@DeleteMapping` | Tuong tu cho GET, PUT, DELETE |
| `@Valid` | Kich hoat validation tren DTO |
| `@RequestBody` | Parse JSON body thanh Java object |
| `@PathVariable` | Doc gia tri tu URL: `/users/{id}` → `@PathVariable Long id` |
| `@RequestParam` | Doc query param: `/users?role=ADMIN` → `@RequestParam Role role` |

### 8.7. Luong xu ly tong hop

```
Client (Frontend/Postman/curl)
    │
    │  POST /api/auth/register
    │  { "username": "vanan", "email": "vanan@mail.com", "password": "123456" }
    │
    ▼
┌─────────────────────────────────────────────────┐
│  JwtAuthFilter (Security Filter)                │
│  → Kiem tra JWT token trong header              │
│  → Endpoint /api/auth/** khong can token → PASS │
└─────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────┐
│  AuthController.register()                      │
│  1. @Valid kiem tra: username khong blank? ✓     │
│     email hop le? ✓, password >= 6 ky tu? ✓     │
│  2. Goi authService.register(request)           │
└─────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────┐
│  AuthService.register()                         │
│  1. existsByUsername("vanan") → false ✓          │
│  2. existsByEmail("vanan@mail.com") → false ✓   │
│  3. User.builder()...build() → tao User object  │
│  4. passwordEncoder.encode("123456") → bcrypt   │
│  5. userRepository.save(user) → INSERT vao DB   │
│  6. jwtUtil.generateToken() → tao JWT           │
│  7. return AuthResponse                         │
└─────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────┐
│  AuthController                                 │
│  → Boc vao ApiResponse.ok(message, data)        │
│  → Spring tu dong chuyen thanh JSON             │
└─────────────────────────────────────────────────┘
    │
    ▼
Client nhan response:
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

## 9. Chay va test

### 9.1. Khoi dong database bang Docker

Tao file `docker-compose.yml` o thu muc goc du an:

```yaml
services:
  # SQL Server — co so du lieu chinh
  sqlserver:
    image: mcr.microsoft.com/mssql/server:2022-latest
    environment:
      ACCEPT_EULA: "Y"                    # Chap nhan dieu khoan su dung
      MSSQL_SA_PASSWORD: "CineX@2026"     # Mat khau user "sa" (system admin)
    ports:
      - "1433:1433"                        # Map port 1433 cua container ra may host
    volumes:
      - sqlserver-data:/var/opt/mssql      # Luu du lieu vao volume (khong mat khi restart)

  # Redis — cache du lieu, session
  redis:
    image: redis:7-alpine                  # Alpine = ban nhe, chi 5MB
    ports:
      - "6379:6379"

volumes:
  sqlserver-data:                          # Khai bao volume de luu du lieu
```

Chay:

```bash
# Khoi dong SQL Server va Redis
cd /Users/vutuongan/cinex
docker compose up sqlserver redis -d
#                                 ^^ -d = detached (chay ngam, khong chiem terminal)

# Kiem tra container dang chay
docker ps
# CONTAINER ID   IMAGE                            STATUS        PORTS
# abc123         mcr.microsoft.com/mssql/server   Up 5 seconds  0.0.0.0:1433->1433/tcp
# def456         redis:7-alpine                   Up 5 seconds  0.0.0.0:6379->6379/tcp

# Tao database (chi can lan dau)
docker exec cinex-sqlserver-1 /opt/mssql-tools18/bin/sqlcmd \
    -S localhost -U sa -P 'CineX@2026' -C \
    -Q "CREATE DATABASE cinex"
```

### 9.2. Chay backend

```bash
cd /Users/vutuongan/cinex/backend

# Build (compile + kiem tra loi)
./gradlew clean build -x test
#         ^^^^^               xoa build cu
#               ^^^^^         compile + dong goi
#                     ^^^^^^^  bo qua test (chay nhanh hon)

# Chay server
./gradlew bootRun
```

Khi thay dong nay → server da san sang:

```
Started BackendApplication in 5.123 seconds (process running for 5.678)
```

### 9.3. Test bang curl

```bash
# === DANG KY ===
curl -X POST http://localhost:8088/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "vanan",
    "email": "vanan@gmail.com",
    "password": "123456",
    "fullName": "Vu Tuong An"
  }'

# Response mong doi:
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

# === DANG NHAP ===
curl -X POST http://localhost:8088/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "vanan",
    "password": "123456"
  }'

# === GOI API CAN XAC THUC ===
# Copy accessToken tu response login
TOKEN="eyJhbGciOiJIUzI1NiJ9..."

curl http://localhost:8088/api/users/me \
  -H "Authorization: Bearer $TOKEN"

# Response: thong tin profile cua user dang dang nhap
```

### 9.4. Test bang Swagger UI

Mo trinh duyet, truy cap: **http://localhost:8088/swagger-ui.html**

Swagger tu dong sinh trang tai lieu API tuong tac:
- Xem tat ca endpoint
- Thu nghiem truc tiep (nhan "Try it out")
- Xem request/response mau

### 9.5. Cac loi thuong gap

| Loi | Nguyen nhan | Cach sua |
|---|---|---|
| `Connection refused: localhost:1433` | SQL Server chua chay | `docker compose up sqlserver -d` |
| `Login failed for user 'sa'` | Sai mat khau | Kiem tra `MSSQL_SA_PASSWORD` trong docker-compose.yml |
| `Database 'cinex' does not exist` | Chua tao database | Chay lenh `CREATE DATABASE cinex` |
| `Connection refused: localhost:6379` | Redis chua chay | `docker compose up redis -d` |
| `Table 'users' doesn't exist` | Liquibase chua chay hoac loi | Kiem tra file changelog + log khi bootRun |
| `Compilation failed` | Code bi loi | Doc log loi, sua roi `./gradlew clean build -x test` |
| `Port 8088 already in use` | Co process khac dang dung port | `lsof -i :8088` roi `kill <PID>` |
| `MapStruct: Unknown property` | Lombok chua sinh getter | Kiem tra thu tu annotationProcessor trong build.gradle |

---

## Tong ket — Luu do tong quan

```
[1] Cai JDK 21 + IDE + Docker
         │
         ▼
[2] start.spring.io → Tao du an → Giai nen
         │
         ▼
[3] Cau hinh build.gradle → Them dependencies
         │
         ▼
[4] Cau hinh application.yml → DB, Redis, JWT, Mail
         │
         ▼
[5] Tao package structure → Package by Feature
         │
         ▼
[6] Tao BaseEntity → Class cha cho tat ca entity
         │
         ▼
[7] Tao ApiResponse → Format response thong nhat
         │
         ▼
[8] Tao module dau tien:
    Entity → DTO → Repository → Mapper → Service → Controller
         │
         ▼
[9] docker compose up → ./gradlew bootRun → curl/Swagger test
```

> **Buoc tiep theo:** Doc file `docs/module-guides/auth-explained.md` de hieu chi tiet module Auth (JWT, Security Filter, Refresh Token, ...).
