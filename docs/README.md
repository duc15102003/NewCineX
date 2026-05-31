# CineX — Tài liệu dự án

## Lộ trình đọc (theo thứ tự)

### Bước 1: Hiểu dự án (đọc trước khi code)
| # | File | Nội dung | Thời gian |
|---|---|---|---|
| 1 | [project/business-flow.md](project/business-flow.md) | Dự án làm gì, luồng đặt vé, vai trò USER/ADMIN | 15 phút |
| 2 | [project/architecture.md](project/architecture.md) | Kiến trúc 4 lớp: Controller → Service → Repository → DB | 10 phút |
| 3 | [project/erd.md](project/erd.md) | Sơ đồ database 15 bảng, quan hệ giữa các bảng | 20 phút |
| 4 | [project/setup.md](project/setup.md) | Cài đặt + chạy dự án lần đầu | 30 phút |
| 5 | [project/git-guide.md](project/git-guide.md) | Git workflow, branching, pull request | 10 phút |

### Bước 2: Kiến thức nền tảng (học trước khi đọc code)

**Backend — đọc theo thứ tự:**
| # | File | Nội dung | Cần biết trước |
|---|---|---|---|
| 1 | [backend/00-java-spring-fundamentals.md](backend/00-java-spring-fundamentals.md) | Java cơ bản, JVM, JAR, Spring là gì | — |
| 2 | [backend/07-gradle.md](backend/07-gradle.md) | Build tool, dependencies, lệnh build/run | Java cơ bản |
| 3 | [backend/05-lombok.md](backend/05-lombok.md) | @Getter, @Setter, @Builder — viết ít code hơn | Java cơ bản |
| 4 | [backend/01-spring-boot-basics.md](backend/01-spring-boot-basics.md) | @Component, @Service, @Repository, Bean lifecycle | Spring cơ bản |
| 5 | [backend/02-jpa-hibernate.md](backend/02-jpa-hibernate.md) | Entity, @ManyToOne, @ManyToMany, Lazy/Eager | Spring Boot |
| 6 | [backend/03-security.md](backend/03-security.md) | JWT, BCrypt, SecurityFilterChain, @PreAuthorize | Spring Boot + JPA |
| 7 | [backend/04-spring-features.md](backend/04-spring-features.md) | @Transactional, @Scheduled, AOP | Spring Boot |
| 8 | [backend/06-swagger.md](backend/06-swagger.md) | Swagger UI, test API trực tiếp | Spring Boot |
| 9 | [backend/08-redis.md](backend/08-redis.md) | Cache, TTL, cache-aside pattern | Spring Boot |
| 10 | [backend/09-email-cloudinary-qr.md](backend/09-email-cloudinary-qr.md) | Gửi email, upload ảnh, sinh QR code | Spring Boot |
| 11 | [backend/10-websocket.md](backend/10-websocket.md) | WebSocket real-time: STOMP, SockJS, push ghế thay đổi | Spring Boot |
| 12 | [backend/11-testing.md](backend/11-testing.md) | JUnit 5, Mockito, @WebMvcTest, @DataJpaTest, Testcontainers | Spring Boot |
| 13 | [backend/13-deployment.md](backend/13-deployment.md) | Dockerfile production, Nginx, SSL, CI/CD, backup 3-2-1 | Docker + Spring |
| 14 | [backend/14-observability.md](backend/14-observability.md) | Logging, MDC, Actuator, Prometheus, distributed tracing | Spring Boot |
| 15 | [backend/15-common-pitfalls.md](backend/15-common-pitfalls.md) | Top 20 bug Spring (AOP proxy, N+1, LazyInit, circular dep) | JPA + Spring |

**Database — đọc sau backend 02:**
| # | File | Nội dung | Cần biết trước |
|---|---|---|---|
| 1 | [database/01-database-techniques.md](database/01-database-techniques.md) | Optimistic/Pessimistic Lock, N+1, Index | JPA |
| 2 | [database/02-liquibase-guide.md](database/02-liquibase-guide.md) | Quản lý schema DB, DATABASECHANGELOG, team workflow | JPA |
| 3 | [database/03-id-tracker.md](database/03-id-tracker.md) | Sinh mã tự động (CX-20260520-001) | Liquibase |

**Design Patterns — đọc song song với module-guides:**
| # | File | Nội dung | Cần biết trước |
|---|---|---|---|
| 1 | [design-patterns/01-creational-patterns.md](design-patterns/01-creational-patterns.md) | Builder, Factory, Singleton | Java OOP |
| 2 | [design-patterns/02-structural-patterns.md](design-patterns/02-structural-patterns.md) | DTO, Adapter, Facade, Wrapper | Java OOP |
| 3 | [design-patterns/03-behavioral-patterns.md](design-patterns/03-behavioral-patterns.md) | Strategy, Observer, State, Chain of Responsibility | Java OOP |
| 4 | [design-patterns/04-solid-principles.md](design-patterns/04-solid-principles.md) | S.O.L.I.D — 5 nguyên tắc thiết kế | Design Patterns |

**Docker:**
| # | File | Nội dung | Cần biết trước |
|---|---|---|---|
| 1 | [docker/01-docker-guide.md](docker/01-docker-guide.md) | Docker từ zero: Image, Container, Compose, Volume, Network | — |

**Frontend — đọc theo thứ tự (bắt đầu từ zero):**

**Prerequisite — đọc trước nếu chưa biết gì FE:**
| # | File | Nội dung | Cần biết trước |
|---|---|---|---|
| P1 | [frontend/pre-01-html-css-basics.md](frontend/pre-01-html-css-basics.md) | HTML thẻ, CSS box model, flexbox, responsive, Tailwind | — |
| P2 | [frontend/pre-02-javascript-essentials.md](frontend/pre-02-javascript-essentials.md) | Biến, hàm, array (.map .filter), destructuring, spread, async/await | — |
| P3 | [frontend/pre-03-http-api-basics.md](frontend/pre-03-http-api-basics.md) | HTTP request/response, REST API, JSON, status code, Axios | — |
| P4 | [frontend/pre-04-typescript-utility-types.md](frontend/pre-04-typescript-utility-types.md) | Partial, Pick, Omit, Record, ReturnType + type narrowing | TypeScript cơ bản |

**Kiến thức framework:**
| # | File | Nội dung | Cần biết trước |
|---|---|---|---|
| 1 | [frontend/00-typescript-basics.md](frontend/00-typescript-basics.md) | TypeScript: type, interface, generic | JavaScript (P2) |
| 2 | [frontend/01-react-basics.md](frontend/01-react-basics.md) | Component, JSX, props, useState, hooks | TypeScript |
| 3 | [frontend/02-react-router.md](frontend/02-react-router.md) | Routes, Link, useNavigate, nested routes | React |
| 4 | [frontend/03-tanstack-query.md](frontend/03-tanstack-query.md) | useQuery, useMutation, cache | React |
| 5 | [frontend/04-zustand-state.md](frontend/04-zustand-state.md) | State management: store, selectors | React |
| 6 | [frontend/05-tailwind-css.md](frontend/05-tailwind-css.md) | Utility classes, responsive, dark mode | — |
| 7 | [frontend/06-form-validation.md](frontend/06-form-validation.md) | react-hook-form + Zod | React |
| 8 | [frontend/07-axios-api.md](frontend/07-axios-api.md) | HTTP client, JWT interceptor | React + API |
| 9 | [frontend/08-shadcn-ui.md](frontend/08-shadcn-ui.md) | Component library: Button, Card, Dialog | React + Tailwind |
| 10 | [frontend/09-project-config-files.md](frontend/09-project-config-files.md) | package.json, vite.config, tsconfig | — |
| 11 | [frontend/10-how-frontend-works.md](frontend/10-how-frontend-works.md) | Tổng quan FE: SPA, state, lifecycle | Tất cả FE |
| 12 | [frontend/11-cinex-project-structure.md](frontend/11-cinex-project-structure.md) | Cấu trúc src/: features, components, hooks, store, types | Tất cả FE |
| 13 | [frontend/12-auth-flow-explained.md](frontend/12-auth-flow-explained.md) | Auth flow: login → token → interceptor → ProtectedRoute | React + Axios + Zustand |
| 14 | [frontend/13-movie-feature-explained.md](frontend/13-movie-feature-explained.md) | Movie pages: search debounce, MovieCard, cache, suất chiếu | TanStack Query |
| 15 | [frontend/14-booking-websocket-explained.md](frontend/14-booking-websocket-explained.md) | Booking: sơ đồ ghế, WebSocket real-time, payment, QR code | Tất cả FE + WebSocket |
| 16 | [frontend/15-react-pitfalls.md](frontend/15-react-pitfalls.md) | Top 18 bug React/TS/Tailwind (StrictMode, stale closure, dynamic class) | React |
| 17 | [frontend/16-performance-optimization.md](frontend/16-performance-optimization.md) | memo, code split, virtualize, bundle size, Web Vitals | React + TanStack Query |
| 18 | [frontend/17-testing-frontend.md](frontend/17-testing-frontend.md) | Vitest + React Testing Library + MSW + Playwright | React |
| 19 | [frontend/18-cookbook.md](frontend/18-cookbook.md) | Recipes: debounce, infinite scroll, file upload, toast, confirm | React |

### Bước 3: Module guides (đọc khi làm từng task)

Đánh số theo **thứ tự học đúng** — module trước là prerequisite cho module sau:

| # | File | Module | Cần biết trước |
|---|---|---|---|
| 01 | [module-guides/01-common-infra-explained.md](module-guides/01-common-infra-explained.md) | AuditLog, SystemConfig, FileUpload, Cloudinary | Spring Boot + JPA |
| 02 | [module-guides/02-auth-explained.md](module-guides/02-auth-explained.md) | Login, Register, JWT, BCrypt, Refresh Token | Common Infra + Security |
| 03 | [module-guides/03-user-explained.md](module-guides/03-user-explained.md) | Profile, Password, Avatar, @PreAuthorize, MapStruct | Auth |
| 04 | [module-guides/04-filter-specification-explained.md](module-guides/04-filter-specification-explained.md) | Filter DTO + Specification — pattern dùng chung | JPA + Spring Boot |
| 05 | [module-guides/05-movie-explained.md](module-guides/05-movie-explained.md) | CRUD phim, N:N Genre, Specification search | Filter + MapStruct |
| 06 | [module-guides/06-room-explained.md](module-guides/06-room-explained.md) | CRUD phòng chiếu | Filter |
| 07 | [module-guides/07-seat-explained.md](module-guides/07-seat-explained.md) | Sơ đồ ghế, generate, @ManyToOne | Room |
| 08 | [module-guides/08-showtime-explained.md](module-guides/08-showtime-explained.md) | Suất chiếu, check trùng giờ, SystemConfig | Movie + Room |
| 09 | [module-guides/09-booking-explained.md](module-guides/09-booking-explained.md) | Hold ghế, confirm, cancel, check-in, QR, Scheduler | Showtime + Seat |
| 10 | [module-guides/10-payment-explained.md](module-guides/10-payment-explained.md) | Payment: Factory, Strategy, Observer, ticket QR | Booking |
| 11 | [module-guides/11-review-explained.md](module-guides/11-review-explained.md) | Đánh giá phim, UNIQUE constraint, auto AVG rating | Movie + User |
| 12 | [module-guides/12-snack-explained.md](module-guides/12-snack-explained.md) | Đồ ăn kèm vé, snapshot price | Booking |
| 13 | [module-guides/13-notification-explained.md](module-guides/13-notification-explained.md) | Thông báo, bulk JPQL, Observer integration | Payment |
| 14 | [module-guides/14-favorite-explained.md](module-guides/14-favorite-explained.md) | Phim yêu thích, toggle pattern, hard delete | Movie + User |
| 15 | [module-guides/15-statistics-explained.md](module-guides/15-statistics-explained.md) | Báo cáo, aggregate query, export PDF/Excel, Redis cache | Booking + Payment |

### Tham khảo thêm
| File | Nội dung |
|---|---|
| [glossary.md](glossary.md) | Từ điển thuật ngữ kỹ thuật (50+ thuật ngữ) |
| [common-mistakes.md](common-mistakes.md) | 30 lỗi hay gặp khi code + cách fix (mở rộng từ 10) |
| [test-cases.md](test-cases.md) | Test cases cho 23 module |
| [features-completed.md](features-completed.md) | Danh sách tính năng đã hoàn thành |
