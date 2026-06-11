# Tech Stack CineX — Inventory đầy đủ

> **Mục đích:** Liệt kê chi tiết mọi công nghệ, framework, library dùng trong dự án + lý do chọn. Đọc trước khi setup local hoặc rebuild project.

---

## 1. Tổng quan

CineX là hệ thống đặt vé xem phim online + POS rạp đa chi nhánh, gồm 3 phần:

| Phần | Stack chính | Port |
|---|---|---|
| **Backend** | Spring Boot 3.3.5, Java 21 | 8088 |
| **Frontend** | React 19, TypeScript, Vite | 5173 |
| **Infrastructure** | SQL Server 2022, Redis 7, Docker Compose | 1433 / 6379 |

---

## 2. Backend Stack

### 2.1. Core framework

| Tech | Version | Vai trò |
|---|---|---|
| **Spring Boot** | 3.3.5 | Framework chính — REST API, IoC container, auto-config |
| **Java** | 21 (LTS) | Ngôn ngữ — yêu cầu JDK 21 (Temurin/OpenJDK/Oracle) |
| **Gradle** | 8.10.2 | Build tool (qua `gradlew` wrapper, không cần cài global) |
| **Spring Web MVC** | (included) | HTTP request mapping, controller layer |

### 2.2. Security & Authentication

| Tech | Version | Vai trò |
|---|---|---|
| **Spring Security** | 6.x | Auth, authorization, security filter chain |
| **JJWT** | 0.12.6 | Sinh + verify JWT access token (15 phút TTL) |
| **BCrypt** | (Spring built-in) | Hash password user (strength 10) |
| **HttpOnly Cookie** | — | Refresh token (7 ngày) — chống XSS theft |

**Pattern hybrid:** access token trong localStorage (ngắn hạn), refresh token trong HttpOnly cookie (dài hạn). Chuẩn Auth0/Cognito/Okta.

### 2.3. Persistence

| Tech | Version | Vai trò |
|---|---|---|
| **Spring Data JPA** | 3.3.5 | ORM abstraction, Repository + Specification pattern |
| **Hibernate** | 6.5.3 | ORM engine (đứng sau Spring Data) |
| **MSSQL JDBC Driver** | 12.6.4 | Kết nối SQL Server 2022 |
| **Liquibase** | 4.27 | Versioned schema migration (16 changelog đã consolidate từ 72) |

### 2.4. Caching & Session

| Tech | Version | Vai trò |
|---|---|---|
| **Redis 7-alpine** | — | Distributed cache (rate-limit, session blacklist, view counter) |
| **Lettuce** | 6.3.2 | Redis client (async, non-blocking) |
| **Caffeine** | 3.1.8 | Local in-memory cache (PricingEngine L2, Statistics cache) |
| **Spring Cache** | (Spring built-in) | `@Cacheable`/`@CacheEvict` annotation |

**Cache strategy 2 tầng:** Caffeine cho data tần suất cao đơn instance; Redis cho cross-instance + persistence.

### 2.5. Async & Scheduling

| Tech | Version | Vai trò |
|---|---|---|
| **@EnableAsync** | (Spring) | Background task — email, notification, audit |
| **@Scheduled** | (Spring) | Cron job — cleanup booking expired, MovieRun status |
| **ShedLock** | 5.16 | Distributed lock cho @Scheduled (multi-instance safety) |
| **@TransactionalEventListener** | (Spring) | Event-driven — phát event AFTER_COMMIT của transaction |

### 2.6. Mapping & Boilerplate

| Tech | Version | Vai trò |
|---|---|---|
| **MapStruct** | 1.6.3 | Code-gen Entity ↔ DTO mapper compile-time (zero reflection) |
| **Lombok** | (Spring-managed) | `@Getter/@Setter/@Builder/@Slf4j` — bớt boilerplate |

### 2.7. Media & QR

| Tech | Version | Vai trò |
|---|---|---|
| **Cloudinary** | 2.0 | Upload + CDN ảnh poster phim, avatar, snack |
| **ZXing** | 3.5.3 | Sinh QR code vé (encode random token, không phải bookingCode) |

### 2.8. Email

| Tech | Version | Vai trò |
|---|---|---|
| **Spring Mail** | (Spring) | SMTP client |
| **Jakarta Mail** | 2.0.3 | Mail API |
| **Thymeleaf** | 3.1.2 | Template engine cho email HTML (verify, booking confirm, reset password) |
| **Mailtrap sandbox** | — | Dev SMTP — không gửi thật, trap email trong inbox test |

### 2.9. API Documentation

| Tech | Version | Vai trò |
|---|---|---|
| **Springdoc OpenAPI** | 2.6 | Auto-gen Swagger UI từ annotation `@Operation`/`@Tag` |

Mở `http://localhost:8088/swagger-ui.html` sau khi BE run.

### 2.10. Real-time

| Tech | Version | Vai trò |
|---|---|---|
| **Spring WebSocket** | (Spring) | Server-side WS |
| **STOMP** | — | Sub-protocol cho message routing |

Use case: seat lock real-time khi user khác cùng đặt ghế.

### 2.11. AOP

| Tech | Version | Vai trò |
|---|---|---|
| **Spring AOP + AspectJ Weaver** | 1.9.22 | Custom `@Auditable` aspect — auto-log admin action vào `audit_logs` |

### 2.12. Pricing engine

| Tech | Version | Vai trò |
|---|---|---|
| **Custom PricingEngine** | — | Strategy + Composite pattern, áp `pricing_rules` (weekend surcharge, suất sáng giảm) |

Cache theo `(theaterId, hour bucket)` với Caffeine, refresh schedule 5 phút.

### 2.13. Testing

| Tech | Version | Vai trò |
|---|---|---|
| **JUnit 5** | (Spring) | Unit test framework |
| **Spring Test** | (Spring) | `@SpringBootTest`/`@WebMvcTest`/`@DataJpaTest` |
| **Testcontainers** | — | Integration test với container MSSQL thật |

---

## 3. Frontend Stack

### 3.1. Core

| Tech | Version | Vai trò |
|---|---|---|
| **React** | 19.2.5 | UI library |
| **TypeScript** | 6.0.2 | Static typing |
| **Vite** | 8.0.10 | Build tool (dev server HMR + bundle production) |
| **React Router** | 7.15.0 | SPA routing |

### 3.2. State + Data Fetching

| Tech | Version | Vai trò |
|---|---|---|
| **Zustand** | 5.0.13 | Local state (auth, admin theater context, UI prefs) — alternative cho Redux |
| **TanStack Query** | 5.100.9 | Server state — fetch/cache/refetch/invalidate, dedupe request |
| **React Hook Form** | 7.75.0 | Form state — uncontrolled inputs, performant |
| **Zod** | 4.4.3 | Schema validation kết hợp react-hook-form |
| **@hookform/resolvers** | 5.2.2 | Integration Zod → react-hook-form |

### 3.3. UI & Styling

| Tech | Version | Vai trò |
|---|---|---|
| **Tailwind CSS** | 4.2 (via Vite plugin) | Utility-first CSS framework |
| **shadcn/ui** | (copy-paste) | Component library trên Radix UI — Dialog, Dropdown, Tabs, ... |
| **Radix UI** | (under shadcn) | Headless UI primitives accessible by default |
| **Lucide React** | 1.16 | Icon library (~1000 icon, tree-shake tốt) |
| **class-variance-authority** | 0.7.1 | Variant styling cho components |
| **clsx + tailwind-merge** | 2.1 / 3.6 | Conditional className + dedupe Tailwind class conflicts |

### 3.4. Charts & Export

| Tech | Version | Vai trò |
|---|---|---|
| **Recharts** | 3.8 | Dashboard chart (line revenue, top movies) |
| **jsPDF + autotable** | 4.2 / 5.0 | Export PDF báo cáo doanh thu |
| **xlsx** | 0.18 | Export Excel cho admin reports |
| **html5-qrcode** | 2.3 | QR scanner (admin check-in qua camera) |

### 3.5. HTTP & WebSocket

| Tech | Version | Vai trò |
|---|---|---|
| **Axios** | 1.16 | HTTP client + interceptor refresh token auto |
| **@stomp/stompjs** | 7.3 | STOMP client |
| **sockjs-client** | 1.6 | Fallback transport khi WS không support |

### 3.6. UX libs

| Tech | Version | Vai trò |
|---|---|---|
| **Sonner** | 2.0 | Toast notification |
| **file-saver** | 2.0 | Browser file download trigger |
| **@fontsource/inter** | 5.2 | Font Inter (self-host, không phụ thuộc Google Fonts CDN) |

### 3.7. Dev tools

| Tech | Version |
|---|---|
| ESLint + typescript-eslint | Linting |
| Prettier | Code formatting |

---

## 4. Infrastructure

### 4.1. Docker Compose

`docker-compose.yml` có 2 service infra:

| Service | Image | Port | Volume |
|---|---|---|---|
| `sqlserver` | mcr.microsoft.com/mssql/server:2022-latest | 1433 | `sqlserver-data` |
| `redis` | redis:7-alpine | 6379 | — (ephemeral) |

Backend + Frontend chạy local (không trong Docker dev) cho dev DX nhanh.

### 4.2. External services

| Service | Vai trò | Cần đăng ký? |
|---|---|---|
| **Cloudinary** | Image hosting + CDN | Free tier — đăng ký https://cloudinary.com |
| **MoMo Sandbox** | Test payment gateway | Public test keys có sẵn từ MoMo docs |
| **Mailtrap** | Dev SMTP testing | Free tier — https://mailtrap.io |
| **Gmail App Password** | (Optional) gửi email thật cho demo | https://myaccount.google.com/apppasswords |

---

## 5. Architectural Patterns (đã áp dụng)

| Pattern | Module áp dụng | File tham khảo |
|---|---|---|
| **Strategy** | Payment processors | `MoMoPaymentProcessor`, `CashPaymentProcessor`, `CardPosPaymentProcessor`, `TransferPaymentProcessor` |
| **Factory** | Chọn processor theo method | `PaymentProcessorFactory` |
| **Observer (Spring Events)** | Async post-commit | `PaymentCompletedEvent` → `PaymentEventListener` (email + notification + loyalty) |
| **State Machine** | Booking lifecycle | `BookingStatus`: HOLDING → CONFIRMED → CHECKED_IN / REJECTED / EXPIRED / NO_SHOW |
| **Specification** | Dynamic query | `*Specification` classes per module — build WHERE từ Filter DTO |
| **Filter DTO** | Search/filter input | `BookingFilter`, `MovieFilter`, ... |
| **Soft Delete** | Logical deletion | `BaseEntity.storageState = ARCHIVED` |
| **Mapper** | Entity ↔ DTO | MapStruct compile-time gen |
| **Wrapper/Facade** | Response format | `ApiResponse<T>`, `PageResponse<T>` |
| **Cache-aside** | Pricing engine, statistics | `@Cacheable` + manual invalidation |
| **Composite multi-tenant** | Per-theater scope | `Theater` entity + `theater_id` direct field trên Snack/Combo/Voucher/MovieRun/Booking |

---

## 6. Yêu cầu hệ thống tối thiểu

| Component | Yêu cầu |
|---|---|
| OS | macOS 13+ / Ubuntu 22.04+ / Windows 11 (WSL2) |
| RAM | 8GB (DB + BE + FE chiếm ~3GB) |
| Disk | 5GB free |
| JDK | OpenJDK 21 (Temurin recommended) |
| Node.js | 20+ (LTS) |
| Docker | 24+ (Docker Desktop hoặc CLI) |
| IDE backend | IntelliJ IDEA Community / Ultimate, VSCode + extensions |
| IDE frontend | VSCode + ESLint + Prettier extensions |

---

## 7. Tóm tắt — checklist setup

Trước khi chạy project lần đầu:

- [ ] Cài JDK 21 (`java -version` → 21.x)
- [ ] Cài Node 20+ (`node -v` → 20.x)
- [ ] Cài Docker Desktop (`docker --version`)
- [ ] Đăng ký Mailtrap (lấy SMTP credentials)
- [ ] (Optional) Đăng ký Cloudinary (lấy API key/secret)
- [ ] Clone repo: `git clone https://github.com/VuTuongAn/cinex.git`
- [ ] Setup `application-local.yml` với credentials (xem `application-local.yml.example`)
- [ ] Đọc `docs/00-quick-start.md` để biết các bước run

---

## 8. Tham khảo thêm

- [docs/00-quick-start.md](./00-quick-start.md) — Setup A-Z từng bước
- [docs/00-architecture-overview.md](./00-architecture-overview.md) — Kiến trúc hệ thống
- [docs/backend/](./backend/) — Tài liệu chi tiết Spring Boot, JPA, Security
- [docs/frontend/](./frontend/) — Tài liệu React, TypeScript, Tailwind
- [docs/module-guides/](./module-guides/) — Từng module business (Auth, Movie, Booking, ...)
