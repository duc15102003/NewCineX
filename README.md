# CineX

Hệ thống đặt vé xem phim online - Đồ án tốt nghiệp.

## Chạy nhanh

```bash
# Backend
cd backend && ./gradlew bootRun

# Frontend
cd frontend && npm install && npm run dev
```

### Chạy full stack với Docker

```bash
docker-compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8088
- Swagger UI: http://localhost:8088/swagger-ui/index.html

---

## Tech Stack

### Backend

| Công nghệ | Version | Mục đích |
|---|---|---|
| Java | 21 | Ngôn ngữ chính |
| Spring Boot | 3.3.5 | Framework chính |
| Spring Security | (BOM) | Xác thực & phân quyền (JWT stateless) |
| Spring Data JPA | (BOM) | ORM — Hibernate + Repository pattern |
| Spring Data Redis | (BOM) | Cache, lưu refresh token |
| Hibernate | (BOM) | JPA implementation, sinh SQL tự động |
| SQL Server | 2022 | Database chính (chạy Docker) |
| Redis | 7 | Cache layer |
| Liquibase | (BOM) | Migration schema DB (version control cho DB) |
| JJWT | 0.12.6 | Tạo/parse/validate JWT token |
| MapStruct | 1.6.3 | Tự sinh code chuyển Entity <-> DTO |
| Lombok | (BOM) | Giảm boilerplate (@Getter, @Builder, @Slf4j...) |
| Spring Mail | (BOM) | Gửi email xác nhận vé, reset password |
| Cloudinary | 2.0.0 | Upload + quản lý ảnh (poster, avatar) trên cloud |
| ZXing | 3.5.3 | Sinh QR code cho vé điện tử |
| SpringDoc OpenAPI | 2.6.0 | Swagger UI — test API trên trình duyệt |
| Gradle | wrapper | Build tool |
| Testcontainers | 1.20.4 | Chạy SQL Server thật trong Docker khi test |
| JUnit 5 + Mockito | (BOM) | Unit test + mock |

### Frontend

| Công nghệ | Version | Mục đích |
|---|---|---|
| React | 19.2 | UI framework |
| TypeScript | 6.0 | Type safety |
| Vite | 8.0 | Build tool + dev server (port 5173) |
| Tailwind CSS | 4.2 | Utility-first CSS framework |
| React Router | 7.15 | Client-side routing (BrowserRouter) |
| TanStack Query | 5.x | Server state management, caching, async data |
| Zustand | 5.x | Client state (auth store, localStorage sync) |
| Axios | 1.16 | HTTP client + JWT interceptor |
| React Hook Form | 7.75 | Form management |
| Zod | 4.4 | Schema validation (kết hợp với form) |
| @hookform/resolvers | 5.2 | Kết nối React Hook Form + Zod |
| Sonner | 2.0 | Toast notification (thông báo popup) |
| class-variance-authority | 0.7 | Tạo variant cho component (button sizes, colors) |
| clsx + tailwind-merge | — | Merge className thông minh — hàm `cn()` |
| Lucide React | 1.16 | Icon library (SVG icons) |
| react-qr-code | latest | Render QR code từ bookingCode trên màn hình |
| Recharts | latest | Biểu đồ thống kê (Admin Dashboard) |
| ESLint + Prettier | — | Lint + format code tự động |

### UI Components (Custom shadcn-style)

Không dùng Radix UI. Components viết tay bằng HTML native + Tailwind + cva:

| Component | Mô tả |
|---|---|
| Button | Nhiều variant (default/destructive/outline/ghost/link) + sizes + loading |
| Input, Label, Textarea, Select | Form elements native + Tailwind styling |
| Card | Container với header/content/footer |
| Dialog | Modal popup (custom, không phải Radix) |
| Table | Bảng dữ liệu responsive |
| Badge | Label nhỏ (status, tag) |
| Skeleton | Loading placeholder animated |
| Avatar | Ảnh user / fallback initials |
| Tabs | Tab navigation |
| Separator | Đường kẻ phân cách |
| Toaster (Sonner) | Toast notification container |

### Infrastructure

| Công cụ | Mục đích |
|---|---|
| Docker + Docker Compose | Chạy SQL Server, Redis, build production |
| Nginx | Serve frontend static files + proxy API (production) |
| GitHub Actions | CI/CD — build + lint + test tự động |

---

## Tài liệu

### project/ — Tổng quan dự án

| File | Nội dung |
|---|---|
| [setup.md](docs/project/setup.md) | Hướng dẫn cài đặt, chạy dự án từ A-Z |
| [architecture.md](docs/project/architecture.md) | Kiến trúc Layered Architecture, cấu trúc package |
| [business-flow.md](docs/project/business-flow.md) | Luồng nghiệp vụ — User đặt vé thế nào, Admin quản lý gì, danh sách API |
| [erd.md](docs/project/erd.md) | Sơ đồ ERD, chi tiết từng bảng, quan hệ |
| [git-guide.md](docs/project/git-guide.md) | Git & GitHub — lệnh cơ bản, branch, commit, workflow nhóm |

### design-patterns/ — Mẫu thiết kế

| File | Nội dung |
|---|---|
| [01-creational-patterns.md](docs/design-patterns/01-creational-patterns.md) | Builder, Factory, Singleton — Tạo đối tượng |
| [02-structural-patterns.md](docs/design-patterns/02-structural-patterns.md) | DTO, Repository, Mapper (MapStruct), Facade — Cấu trúc code |
| [03-behavioral-patterns.md](docs/design-patterns/03-behavioral-patterns.md) | Template Method, Strategy, Observer, State, Filter, Specification, Enum — Hành vi |
| [04-solid-principles.md](docs/design-patterns/04-solid-principles.md) | SOLID (5 nguyên tắc), DRY, KISS |

### backend/ — Kiến thức Backend (Spring Boot + Java)

| File | Nội dung |
|---|---|
| [00-java-spring-fundamentals.md](docs/backend/00-java-spring-fundamentals.md) | Java chạy thế nào, JVM, Gradle, Spring Container, IoC, DI, Auto-Config, Bean Lifecycle |
| [01-spring-boot-basics.md](docs/backend/01-spring-boot-basics.md) | Annotation, Bean, DI, @Value, Profile, @Transactional, REST API convention |
| [02-jpa-hibernate.md](docs/backend/02-jpa-hibernate.md) | Entity, @Column, quan hệ, Cascade, Repository query method, Entity Lifecycle |
| [03-security.md](docs/backend/03-security.md) | JWT, BCrypt, CORS, SecurityFilterChain, Validation, Exception Handling |
| [04-spring-features.md](docs/backend/04-spring-features.md) | AOP (Audit Log), @Scheduled, Spring Events (Observer), Cache-aside |
| [05-lombok.md](docs/backend/05-lombok.md) | @Getter, @Setter, @Builder, @RequiredArgsConstructor, @Slf4j |
| [06-swagger.md](docs/backend/06-swagger.md) | Swagger UI test API, @Tag, @Operation |
| [07-gradle.md](docs/backend/07-gradle.md) | build.gradle đọc thế nào, lệnh gradlew, thêm dependency |
| [08-redis.md](docs/backend/08-redis.md) | Redis cache, config, cách dùng, khi nào dùng |
| [09-email-cloudinary-qr.md](docs/backend/09-email-cloudinary-qr.md) | Email (Spring Mail), Upload ảnh (Cloudinary), QR Code (ZXing) |

### frontend/ — Kiến thức Frontend (React + TypeScript)

| File | Nội dung |
|---|---|
| [00-typescript-basics.md](docs/frontend/00-typescript-basics.md) | TypeScript — kiểu dữ liệu, Interface, Type, Generic |
| [01-react-basics.md](docs/frontend/01-react-basics.md) | Component, Props, JSX, useState, useEffect, Event |
| [02-react-router.md](docs/frontend/02-react-router.md) | Routing, Layout, URL params, ProtectedRoute |
| [03-tanstack-query.md](docs/frontend/03-tanstack-query.md) | useQuery (GET), useMutation (POST/PUT/DELETE), Custom hooks, Cache |
| [04-zustand-state.md](docs/frontend/04-zustand-state.md) | Auth store, Seat selection store |
| [05-tailwind-css.md](docs/frontend/05-tailwind-css.md) | Utility CSS, Layout, Spacing, Colors, Responsive |
| [06-form-validation.md](docs/frontend/06-form-validation.md) | react-hook-form + Zod |
| [07-axios-api.md](docs/frontend/07-axios-api.md) | Axios instance, JWT interceptor, cách gọi API |
| [08-shadcn-ui.md](docs/frontend/08-shadcn-ui.md) | UI Components custom (shadcn-style), cva, cn(), Sonner toast |
| [09-project-config-files.md](docs/frontend/09-project-config-files.md) | package.json, tsconfig, vite, eslint, prettier |
| [10-how-frontend-works.md](docs/frontend/10-how-frontend-works.md) | SPA, Virtual DOM, Component, State, Props, Routing |

### database/ — Database

| File | Nội dung |
|---|---|
| [01-database-techniques.md](docs/database/01-database-techniques.md) | Optimistic/Pessimistic Lock, ACID, Soft Delete, N+1 Problem |
| [02-liquibase-guide.md](docs/database/02-liquibase-guide.md) | Liquibase từ zero — tạo bảng, thêm cột, insert data mẫu |
| [03-id-tracker.md](docs/database/03-id-tracker.md) | IdTracker sinh mã code tự động (VC-20260512-001) |

### docker/ — Docker

| File | Nội dung |
|---|---|
| [01-docker-guide.md](docs/docker/01-docker-guide.md) | Docker từ zero — Image, Container, Volume, Dockerfile, docker-compose |

### module-guides/ — Giải thích từng module (đánh số theo thứ tự học)

| # | File | Nội dung |
|---|---|---|
| 01 | [01-common-infra-explained.md](docs/module-guides/01-common-infra-explained.md) | AuditLog, SystemConfig, Cloudinary/FileUpload |
| 02 | [02-auth-explained.md](docs/module-guides/02-auth-explained.md) | Auth: login, register, JWT, BCrypt |
| 03 | [03-user-explained.md](docs/module-guides/03-user-explained.md) | User: profile, password, avatar, @PreAuthorize |
| 04 | [04-filter-specification-explained.md](docs/module-guides/04-filter-specification-explained.md) | Filter DTO + Specification — pattern dùng chung |
| 05 | [05-movie-explained.md](docs/module-guides/05-movie-explained.md) | Movie: CRUD, N:N genre, search/filter |
| 06 | [06-room-explained.md](docs/module-guides/06-room-explained.md) | Room: CRUD phòng chiếu |
| 07 | [07-seat-explained.md](docs/module-guides/07-seat-explained.md) | Seat: sơ đồ ghế, generate, @ManyToOne |
| 08 | [08-showtime-explained.md](docs/module-guides/08-showtime-explained.md) | Showtime: suất chiếu, check trùng giờ |
| 09 | [09-booking-explained.md](docs/module-guides/09-booking-explained.md) | Booking: hold ghế, confirm, cancel, QR, scheduler |
| 10 | [10-payment-explained.md](docs/module-guides/10-payment-explained.md) | Payment: Factory, Strategy, Observer, ticket QR |

### Tham khảo thêm
| File | Nội dung |
|---|---|
| [docs/README.md](docs/README.md) | **Lộ trình đọc tài liệu** (đọc cái gì trước cái gì) |
| [docs/glossary.md](docs/glossary.md) | Từ điển thuật ngữ (50+ thuật ngữ A-Z) |
| [docs/common-mistakes.md](docs/common-mistakes.md) | 10 lỗi hay gặp khi code + cách fix |

---

## Thứ tự đọc gợi ý

> Chi tiết hơn: xem [docs/README.md](docs/README.md)

1. `docs/project/business-flow.md` — Hiểu dự án làm gì
2. `docs/project/setup.md` — Cài đặt chạy thử
3. `docs/project/erd.md` — Hiểu database
4. `docs/design-patterns/` — Hiểu các pattern sẽ dùng
5. `docs/backend/` hoặc `docs/frontend/` — Tùy bạn làm BE hay FE
6. `docs/docker/` — Khi cần chạy SQL Server
7. `docs/database/` — Khi cần tạo bảng mới
