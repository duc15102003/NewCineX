# Báo cáo Audit Knowledge Gaps — CineX Docs

**Ngày audit:** 2026-06-08
**Phạm vi:** 75 files docs trong `/Users/vutuongan/cinex/docs/`
**Mục tiêu:** Đánh giá xem docs có dạy được sinh viên năm 4 CNTT chưa biết gì không (mức độ "giáo trình đại học").

> **Cách dùng báo cáo này:** Sau khi đọc xong, bạn quyết định các session sau expand nhóm nào trước. Mỗi entry có "Đề xuất expand" cụ thể để tôi thực hiện.

---

## 1. Tóm tắt phân loại

| Priority | Số file | Ý nghĩa |
|---|---|---|
| **P1** — Thiếu nặng | **7** | Người mới đọc không hiểu vì thiếu nền tảng. CẦN expand ngay. |
| **P2** — Thiếu vừa | **50** | Code OK nhưng thiếu ví dụ đời thường / before-after / quiz / anti-patterns. |
| **P3** — Ổn rồi | **18** | Đầy đủ. Chỉ cần review nhẹ về typo/format. |

**Phân bố theo nhóm:**

| Nhóm | Tổng | P1 | P2 | P3 |
|---|---|---|---|---|
| Backend (`docs/backend/`) | 16 | 1 | 14 | 1 |
| Frontend (`docs/frontend/`) | 24 | 2 | 13 | 9 |
| Module Guides (`docs/module-guides/`) | 15 | 1 | 12 | 2 |
| Database + DP + Project (`docs/database/`, `docs/design-patterns/`, `docs/docker/`, `docs/project/`) | 15 | 0 | 10 | 5 |
| Files lẻ (`docs/README.md`, `glossary.md`, `common-mistakes.md`, `features-completed.md`, `test-cases.md`) | 5 | 3 | 1 | 1 |

---

## 2. Thứ tự đề xuất expand (Action Plan)

### Đợt 1 — P1 (7 files, ưu tiên cao nhất, ~5-7 giờ)

| # | File | Lý do P1 |
|---|---|---|
| 1 | `docs/README.md` | Là cửa ngõ, người mới không biết bắt đầu từ đâu |
| 2 | `docs/glossary.md` | Thiếu nhiều thuật ngữ gây bug (LazyInit, N+1, CORS, Race Condition) |
| 3 | `docs/common-mistakes.md` | Thiếu giải thích "tại sao sai" cho mỗi lỗi |
| 4 | `docs/backend/15-common-pitfalls.md` | Liệt kê bug nhưng không giải thích cơ chế gốc (Proxy, Lifecycle, LazyLoad) |
| 5 | `docs/frontend/00-react-vite-from-scratch.md` | Thiếu giải thích Node/npm + troubleshooting setup |
| 6 | `docs/frontend/17-testing-frontend.md` | Người mới không hiểu "tại sao cần test", thiếu "Hello World" test |
| 7 | `docs/module-guides/09-booking-explained.md` | Thiếu so sánh Pessimistic vs Optimistic Lock + scenario concurrency |

### Đợt 2 — P2 nhóm Module Guides (12 files, ~8-10 giờ)

Các module nghiệp vụ cốt lõi của CineX. Ưu tiên cao vì user đang sửa dở (git status có 5 file thuộc nhóm này).

### Đợt 3 — P2 nhóm Backend Fundamentals (14 files, ~10-12 giờ)

Spring/JPA/Security/AOP — kiến thức nền cho mọi module. Cần thêm "Khái niệm nền tảng" + so sánh + anti-pattern.

### Đợt 4 — P2 nhóm Frontend (13 files, ~8-10 giờ)

React/TS/Tailwind/Forms — chủ yếu thiếu quiz + troubleshooting.

### Đợt 5 — P2 nhóm Database + Design Patterns + Project (10 files, ~6-8 giờ)

Liquibase / Patterns / Deploy — chủ yếu thiếu code example cụ thể.

### Đợt 6 — Review nhẹ P3 (18 files, ~2-3 giờ)

Chỉ sửa typo, format, fix file:line citations.

**Tổng ước lượng:** 40-50 giờ làm việc tập trung. Có thể chia làm 8-10 sessions, mỗi session 4-6 giờ.

---

## 3. Chi tiết từng file — Nhóm BACKEND (16 files)

### `docs/backend/00-java-spring-fundamentals.md` — P3
- **Quy mô:** 794 dòng | **Phù hợp người mới?** Có
- **Câu hỏi tự test:** Có
- **Đề xuất:** Đã đầy đủ. JVM → JAR → classpath giải thích kỹ, có diagram + ví dụ đời thường.

### `docs/backend/00-spring-boot-from-scratch.md` — P2
- **Quy mô:** 1719 dòng | **Phù hợp người mới?** Có
- **Thiếu:** Gradle Wrapper là gì + tại sao quan trọng. So sánh starter (web vs webflux). Troubleshooting setup lần đầu.
- **Câu hỏi tự test:** Không
- **Đề xuất expand:**
  - Section "5 lỗi setup phổ biến + cách fix" (Java version mismatch, IDE không nhận annotation...)
  - So sánh Spring Initializr vs clone GitHub
  - Quiz cuối bài

### `docs/backend/01-spring-boot-basics.md` — P2
- **Quy mô:** 294 dòng | **Phù hợp người mới?** Một phần
- **Thiếu:** Spring Container (IoC) là gì, lưu bean ở đâu. Bean scope (singleton/prototype). `@Component` vs `@Service` vs `@Repository` chỉ liệt kê chưa giải thích.
- **Câu hỏi tự test:** Không
- **Đề xuất expand:**
  - Giải thích IoC Container + lifecycle
  - Singleton vs Prototype scope với ví dụ
  - Anti-pattern: KHÔNG dùng `@Autowired` field injection
  - Quiz cuối bài

### `docs/backend/02-jpa-hibernate.md` — P2
- **Quy mô:** 1219 dòng | **Phù hợp người mới?** Một phần
- **Thiếu:** LAZY vs EAGER cơ chế (proxy, reflection). Optimistic vs Pessimistic lock - race condition. LazyInitializationException không cảnh báo.
- **Câu hỏi tự test:** Không
- **Đề xuất expand:**
  - Giải thích cơ chế Proxy trong LAZY loading
  - Cảnh báo LazyInitException + 3 cách fix
  - So sánh `@Query` custom vs auto-generated method
  - Quiz cuối bài

### `docs/backend/03-security.md` — P2
- **Quy mô:** 2686 dòng | **Phù hợp người mới?** Một phần
- **Thiếu:** CORS giải thích sâu hơn. Filter chain diagram. `@EnableGlobalMethodSecurity` cảnh báo.
- **Câu hỏi tự test:** Có
- **Đề xuất expand:**
  - Diagram filter chain
  - So sánh Cookie Session vs JWT (CSRF, CORS, stateless, scale)
  - Cảnh báo `@PreAuthorize` không hoạt động khi quên enable

### `docs/backend/04-spring-features.md` — P2
- **Quy mô:** 1246 dòng | **Phù hợp người mới?** Một phần
- **Thiếu:** AOP Proxy cách hoạt động. `@Scheduled` fixedDelay vs fixedRate. Self-invocation bug.
- **Câu hỏi tự test:** Không
- **Đề xuất expand:**
  - Giải thích AOP Proxy (CGLIB vs JDK Proxy)
  - Cảnh báo bug self-invocation `this.method()` bypass `@Transactional`
  - So sánh `@Scheduled` vs message queue
  - Quiz

### `docs/backend/05-lombok.md` — P3
- **Quy mô:** 202 dòng | **Phù hợp người mới?** Có
- **Đề xuất:** Đã ổn.

### `docs/backend/06-swagger.md` — P2
- **Quy mô:** 212 dòng | **Phù hợp người mới?** Một phần
- **Thiếu:** `@Tag` vs `@Operation` vs `@Parameter`. OpenAPI spec là JSON/YAML.
- **Câu hỏi tự test:** Không
- **Đề xuất expand:**
  - Phân biệt `@Parameter` vs `@RequestParam` vs `@PathVariable`
  - OpenAPI spec là gì, Swagger UI render từ đó
  - So sánh Swagger vs Postman vs cURL

### `docs/backend/07-gradle.md` — P2
- **Quy mô:** 487 dòng | **Phù hợp người mới?** Một phần
- **Thiếu:** Dependency scope rõ hơn (implementation/runtimeOnly/testOnly). Gradle cache. Circular dependency.
- **Câu hỏi tự test:** Có
- **Đề xuất expand:**
  - Giải thích chi tiết dependency scope
  - Khi nào xóa Gradle cache
  - Lệnh `gradle dependencies` để debug

### `docs/backend/08-redis.md` — P2
- **Quy mô:** 1318 dòng | **Phù hợp người mới?** Một phần
- **Thiếu:** Cache stampede. Persistence (RDB, AOF). Pub/Sub vs Stream.
- **Câu hỏi tự test:** Có
- **Đề xuất expand:**
  - Cảnh báo: Redis volatile, dùng RDB/AOF nếu cần persistent
  - So sánh Pub/Sub vs Stream vs RabbitMQ
  - Cache key naming convention

### `docs/backend/09-email-cloudinary-qr.md` — P2
- **Quy mô:** 532 dòng | **Phù hợp người mới?** Một phần
- **Thiếu:** SMTP protocol. Gmail App Password vs Regular. Cloudinary CDN. QR version.
- **Câu hỏi tự test:** Không
- **Đề xuất expand:**
  - Gmail App Password: 2FA → 16-char password riêng
  - Cloudinary transformation example
  - QR code version trade-off

### `docs/backend/10-websocket.md` — P2
- **Quy mô:** 338 dòng | **Phù hợp người mới?** Một phần
- **Thiếu:** WebSocket handshake (HTTP Upgrade). Simple Broker vs RabbitMQ/Redis broker. Reconnect logic.
- **Câu hỏi tự test:** Có
- **Đề xuất expand:**
  - Handshake: HTTP Upgrade → 101 Switching Protocols
  - Cảnh báo: Simple Broker chỉ in-memory, 1 server
  - `@SendTo` destination giải thích

### `docs/backend/11-testing.md` — P2
- **Quy mô:** 881 dòng | **Phù hợp người mới?** Một phần
- **Thiếu:** `@WebMvcTest` vs `@DataJpaTest` vs `@SpringBootTest`. `@Transactional` test rollback. Test Double types (mock/stub/spy/fake). AssertJ.
- **Câu hỏi tự test:** Có
- **Đề xuất expand:**
  - Phân biệt 3 test scope annotation
  - Cảnh báo: `@Transactional` test method tự rollback
  - So sánh Test Double types

### `docs/backend/13-deployment.md` — P2
- **Quy mô:** 535 dòng | **Phù hợp người mới?** Một phần
- **Thiếu:** Blue-green, canary. Actuator /health. Secrets management. DB migration khi deploy.
- **Câu hỏi tự test:** Có
- **Đề xuất expand:**
  - Actuator /health: liveness vs readiness probe
  - So sánh Blue-green vs Rolling vs Canary
  - Cảnh báo: secret không commit vào git

### `docs/backend/14-observability.md` — P2
- **Quy mô:** 529 dòng | **Phù hợp người mới?** Một phần
- **Thiếu:** MDC cơ chế (thread-local). Tracing tool (Jaeger, Zipkin). Prometheus format. Alert threshold.
- **Câu hỏi tự test:** Có
- **Đề xuất expand:**
  - MDC: thread-local lưu correlationId
  - Jaeger/Zipkin visualize request flow
  - Prometheus metrics format

### `docs/backend/15-common-pitfalls.md` — **P1**
- **Quy mô:** 1147 dòng | **Phù hợp người mới?** Không
- **Thiếu:** Section "Khái niệm cần hiểu trước" (Proxy, Reflection, Lifecycle, LazyLoading). Mỗi bug cần giải thích "tại sao xảy ra".
- **Câu hỏi tự test:** Có
- **Đề xuất expand:**
  - **Thêm intro:** "5 khái niệm cần hiểu để tránh các bug này"
  - Thêm "Bug: `@PostConstruct` gọi method `@Transactional`"
  - Giải thích cơ chế LazyInitException chi tiết

---

## 4. Chi tiết từng file — Nhóm FRONTEND (24 files)

### `docs/frontend/pre-01-html-css-basics.md` — P3
- 205 dòng. Đầy đủ HTML/CSS cơ bản. Đề xuất thêm bài tập + responsive section.

### `docs/frontend/pre-02-javascript-essentials.md` — P3
- 303 dòng. Đề xuất thêm Hoisting, `this`, bài tập.

### `docs/frontend/pre-03-http-api-basics.md` — P3
- 256 dòng. Đề xuất thêm CORS error, rate limiting, cURL example.

### `docs/frontend/pre-04-typescript-utility-types.md` — P2
- 950 dòng | **Phù hợp người mới?** Một phần
- **Thiếu:** Conditional types thiếu ví dụ đời thường. Quiz. Decision tree khi nào dùng utility type.
- **Đề xuất expand:** Decision tree, Generic constraints, bài tập DeepReadonly.

### `docs/frontend/00-react-vite-from-scratch.md` — **P1**
- 1377 dòng | **Phù hợp người mới?** Một phần
- **Thiếu:** Tại sao Vite chứ không Webpack. Node.js/npm là gì. Troubleshooting (npm install lỗi, port conflict). Checklist setup.
- **Đề xuất expand:**
  - Section "5 lỗi setup phổ biến + cách fix"
  - Checklist "làm sao biết setup đã đúng"
  - Bài tập "chạy + sửa 3 bug cố tình"

### `docs/frontend/00-typescript-basics.md` — P2
- 1464 dòng. **Thiếu:** Union vs intersection, type vs interface, narrowing, generics.
- **Đề xuất:** Type narrowing, generics + constraint, bài tập fix 5 errors.

### `docs/frontend/01-react-basics.md` — P2
- 904 dòng. **Thiếu:** Hook Rules root cause. Virtual DOM diagram. Lifecycle mindset.
- **Đề xuất:** State batching, Children prop, bài tập Counter.

### `docs/frontend/02-react-router.md` — P2
- 744 dòng. **Thiếu:** SPA vs MPA root cause. `useParams`. `useNavigate`. **Encoding issue file đầu**.
- **Đề xuất:** Nested routes + Outlet, lazy loading, bài tập `/movies/:id`.

### `docs/frontend/03-tanstack-query.md` — P2
- 757 dòng. **Thiếu:** staleTime vs gcTime. invalidateQueries. Race condition.
- **Đề xuất:** Error handling, optimistic update, bài tập useMovies.

### `docs/frontend/04-zustand-state.md` — P2
- 613 dòng. **Thiếu:** Props drilling. Middleware (persist, immer). Khi nào KHÔNG dùng.
- **Đề xuất:** Devtools, localStorage persist, bài tập authStore.

### `docs/frontend/05-tailwind-css.md` — P2
- 734 dòng. **Thiếu:** Arbitrary value. Responsive prefix. Dark mode.
- **Đề xuất:** Preflight CSS reset, custom config, bài tập hero banner.

### `docs/frontend/06-form-validation.md` — P2
- 806 dòng. **Thiếu:** Custom validation. Conditional validation. Async validation.
- **Đề xuất:** Form watching + reset, dynamic field, bài tập register form.

### `docs/frontend/07-axios-api.md` — P2
- 1039 dòng. **Thiếu:** Interceptor 401. Timeout. File upload FormData.
- **Đề xuất:** Cancel request (AbortController), network error vs server error, bài tập setup interceptor.

### `docs/frontend/08-shadcn-ui.md` — P3
- 340 dòng. Đề xuất: customize variants, bài tập copy Dialog.

### `docs/frontend/09-project-config-files.md` — P3
- 708 dòng. Đề xuất: `.env` files, `.gitignore`.

### `docs/frontend/10-how-frontend-works.md` — P3
- 943 dòng. Đề xuất: DevTools inspector, bài tập trace 1 click.

### `docs/frontend/11-cinex-project-structure.md` — P3
- 372 dòng. Đề xuất: feature-based vs layer-based, path aliases sâu.

### `docs/frontend/12-auth-flow-explained.md` — P2
- 505 dòng. **Thiếu:** JWT decode field (`sub`, `role`). Refresh token rotation. CSRF + CORS.
- **Đề xuất:** Logout flow, password reset flow, bài tập auto logout.

### `docs/frontend/13-movie-feature-explained.md` — P3
- 443 dòng. Đề xuất: infinite scroll vs pagination, bài tập sort option.

### `docs/frontend/14-booking-websocket-explained.md` — P2
- 720 dòng. **Thiếu:** WebSocket lifecycle. Reconnect logic. Message acknowledgment.
- **Đề xuất:** WebSocket vs long-polling, real-time conflicts, bài tập debug DevTools.

### `docs/frontend/15-react-pitfalls.md` — P3
- 1598 dòng. **Câu hỏi tự test:** Có. Đề xuất: thêm React DevTools Profiler.

### `docs/frontend/16-performance-optimization.md` — P2
- 481 dòng. **Thiếu:** React.memo / useMemo khi nào dùng. Image optimization. Bundle analysis.
- **Đề xuất:** Lighthouse audit, web workers, bài tập Lighthouse MovieListPage.

### `docs/frontend/17-testing-frontend.md` — **P1**
- 485 dòng | **Phù hợp người mới?** Không
- **Thiếu:** Tại sao cần test. Testing strategies (unit/integration/e2e). MSW setup mơ. Query selection. Hello World test.
- **Đề xuất expand:**
  - Section "Why test" trước "How"
  - AAA pattern (Arrange-Act-Assert)
  - Mocking hooks (useQuery, useNavigate)
  - Bài tập viết test MovieCard

### `docs/frontend/18-cookbook.md` — P2
- 587 dòng. **Thiếu:** Tại sao recipe hoạt động. Common mistakes mỗi recipe. TS generics.
- **Đề xuất:** Intersection observer, localStorage pattern, bài tập search debounce.

---

## 5. Chi tiết từng file — Nhóm MODULE GUIDES (15 files)

### `docs/module-guides/01-common-infra-explained.md` — P2
- 1139 dòng. **Thiếu:** CloudinaryConfig env vars. `@EnableJpaAuditing` Auditor lấy từ SecurityContext. Cache invalidation multi-instance.
- **Câu hỏi tự test:** Có (10 câu)
- **Đề xuất:** Code Cache-aside chi tiết, diagram before-after, anti-pattern cache cũ, test JUnit cache invalidation.

### `docs/module-guides/02-auth-explained.md` — P2
- 1204 dòng. **Thiếu:** OncePerRequestFilter cơ chế. CORS preflight curl. Refresh token. BCrypt cost factor. Reset token defense in depth.
- **Câu hỏi tự test:** Có
- **Đề xuất:** Curl login-refresh-logout, diagram JWT decode, OWASP User Enumeration, `@NotBlank` vs `@NotEmpty`.

### `docs/module-guides/03-user-explained.md` — P3
- 403 dòng. Đã ổn. Không cần expand.

### `docs/module-guides/04-filter-specification-explained.md` — P2
- 1056 dòng. **Thiếu:** Criteria API join vs fetch. Pageable fields. Compound index ordering.
- **Câu hỏi tự test:** Có
- **Đề xuất:** Query thực tế SQL sinh ra, `@EntityGraph` + Specification, INNER vs LEFT JOIN.

### `docs/module-guides/05-movie-explained.md` — P2
- 889 dòng. **Thiếu:** `@ManyToMany` Set vs List. MovieStatus transition rules. `@EntityGraph` strategy. 11 field MovieFilter.
- **Câu hỏi tự test:** Có (10 câu)
- **Đề xuất:** Genre add/edit/delete, status state machine, N:M cascade.

### `docs/module-guides/06-room-explained.md` — P2
- 1122 dòng. **Thiếu:** RoomType 4 loại giải thích rạp thực. RoomStatus MAINTENANCE rules. Soft delete restore. Optimistic lock concurrency.
- **Đề xuất:** ASCII diagram sơ đồ ghế, capacity rules, cascade soft delete.

### `docs/module-guides/07-seat-explained.md` — P2
- 1042 dòng. **Thiếu:** COUPLE rendering canvas. Thuật toán sinh ghế pseudo-code. Validation. LinkedHashMap vs TreeMap.
- **Đề xuất:** JS rendering COUPLE colspan, drag-paint editor, migration safe.

### `docs/module-guides/08-showtime-explained.md` — P2
- 1296 dòng. **Thiếu:** ShowtimeStatus transition. Movie duration cache stale. Buffer config key. Overlapping formula.
- **Đề xuất:** State machine diagram + cancel flow, edge case boundary time, schedule suggestion.

### `docs/module-guides/09-booking-explained.md` — **P1**
- 1354 dòng. **Thiếu nặng:** Pessimistic vs Optimistic Lock so sánh. QR code ZXing example. IdTracker format. `@Scheduled` fixed* vs cron. WebSocket STOMP subscription setup.
- **Câu hỏi tự test:** Có nhưng thiếu concurrency
- **Đề xuất expand:**
  - Scenario 2 user chọn ghế E1 cùng lúc → Pessimistic Lock flow (SELECT FOR UPDATE)
  - ZXing example sinh QR từ bookingCode
  - WebSocket STOMP broker config
  - BookingCleanupScheduler 60s interval

### `docs/module-guides/10-payment-explained.md` — P2
- 1355 dòng. **Thiếu:** Factory + Strategy tách nơi nào. MoMo IPN HMAC verify. PaymentCompletedEvent REQUIRES_NEW. Refund partial.
- **Đề xuất:** HMAC verify code, idempotency callback, timeout policy.

### `docs/module-guides/11-review-explained.md` — P3
- 506 dòng. Đã ổn.

### `docs/module-guides/12-snack-explained.md` — P2
- 644 dòng. **Thiếu:** Snapshot Price Pattern lý do. Future HoldSeatsRequest. Upload riêng action lợi ích.
- **Đề xuất:** POS checkout example, future API list snack, category dropdown.

### `docs/module-guides/13-notification-explained.md` — P2
- 676 dòng. **Thiếu:** Spring Events lifecycle. IDOR prevention pattern. `convertAndSendToUser` vs `convertAndSend`. `@SchedulerLock` distributed lock.
- **Đề xuất:** Event listener retry, notification archival, email template mapping.

### `docs/module-guides/14-favorite-explained.md` — P2
- 615 dòng. **Thiếu:** Asymmetric cascade (favorite hard, review soft). Hard delete despite BaseEntity. Toggle pattern idempotent issue. isFavorited bulk check.
- **Đề xuất:** Đã bổ sung khá đủ ở section 10.

### `docs/module-guides/15-statistics-explained.md` — P2
- 948 dòng. **Thiếu:** `@PersistenceContext` vs `@Autowired`. CAST kiểu dữ liệu. ExportSection pattern. Number type casting.
- **Câu hỏi tự test:** **KHÔNG** ← cần thêm
- **Đề xuất:** PDF export multi-section, cron 04:00 lý do, chart library, **thêm 10 câu quiz**.

---

## 6. Chi tiết từng file — Nhóm DATABASE + DESIGN PATTERNS + PROJECT (15 files)

### `docs/database/01-database-techniques.md` — P2
- 609 dòng. **Thiếu:** Optimistic Lock SQL check version. Phantom read ví dụ CineX. Index B-tree. Deadlock scenario.
- **Đề xuất:** Deadlock 2 booking ghế ngược thứ tự, bảng Isolation vs performance, EXPLAIN PLAN, N+1 detection.

### `docs/database/02-liquibase-guide.md` — P2
- 375 dòng. **Thiếu:** DATABASECHANGELOGLOCK deadlock handling. Checksum fail giải thích. Rollback example.
- **Đề xuất:** Conflict 2 dev cùng tạo 015, rename column index, preConditions example.

### `docs/database/03-id-tracker.md` — P2
- 225 dòng. **Thiếu:** Hi/Lo pattern chi tiết. UUID v7 so sánh size. Performance 500 req/s context.
- **Đề xuất:** So sánh IdTracker vs UUID v7 vs Snowflake, reset sequence at 999999, clock skew warning.

### `docs/design-patterns/01-creational-patterns.md` — P2
- 189 dòng. **Thiếu:** Setter hell demo. Singleton code example. Lombok generated code.
- **Đề xuất:** Demo `new User("a", null, "b"...)`, `User.builder().build()` validation timing.

### `docs/design-patterns/02-structural-patterns.md` — P2
- 142 dòng. **Thiếu:** Nested DTO. MapStruct `@Mapping` source khác target. Facade example.
- **Đề xuất:** Entity.user → DTO userId (không lồng), lifecycle Request → DTO → Entity.

### `docs/design-patterns/03-behavioral-patterns.md` — P2
- 289 dòng. **Thiếu:** State pattern code. Observer Spring Events before-after. Strategy ví dụ cụ thể. Specification code.
- **Đề xuất:** Invalid transition throw, async listener, `findAll(Specification.where(...))`.

### `docs/design-patterns/04-solid-principles.md` — P2
- 227 dòng. **Thiếu:** LSP violation ví dụ. Interface kích thước. DRY/KISS chỉ 1 dòng.
- **Đề xuất:** CashPaymentProcessor.generateQrCode throw → phá contract, extract BaseService.

### `docs/docker/01-docker-guide.md` — P3
- 1314 dòng. Đã ổn. Câu hỏi tự test có.

### `docs/project/architecture.md` — P3
- 1137 dòng. Đã ổn. Diagram + auth flow + package structure rõ.

### `docs/project/business-flow.md` — P3
- 634 dòng. Đã ổn. 6 flow cốt lõi rõ + sequence diagram.

### `docs/project/deploy-guide.md` — P2
- 1288 dòng. **Thiếu:** systemd service file template. SSL renewal automation. Monitoring alert threshold. Backup recovery test.
- **Đề xuất:** systemd template, certbot auto-renew, Prometheus + Alertmanager setup, backup test procedure.

### `docs/project/erd.md` — P3
- 560 dòng. Đã ổn. Chi tiết từng bảng.

### `docs/project/git-guide.md` — P2
- 486 dòng. **Thiếu:** Conventional Commits scope. Liquibase auto-reorder. Hotfix vs bugfix.
- **Đề xuất:** Scope examples từ CineX, script tự reorder, hotfix decision tree.

### `docs/project/setup.md` — P3
- 679 dòng. Đã ổn. Quick Start + troubleshooting.

### `docs/project/tech-stack-explained.md` — P2
- 2548 dòng. **Thiếu:** JPA Auditing magic. Gradle cơ bản. Testcontainers trade-off. ZXing QR error correction.
- **Đề xuất:** Minimal Gradle example, AuditingConfig setup, Testcontainers fast vs realistic, QR EC level.

---

## 7. Chi tiết từng file — FILES LẺ (5 files)

### `docs/README.md` — **P1**
- 116 dòng. **Thiếu:** "Start here" rõ ràng. Flow user ví dụ đời thường.
- **Đề xuất expand:**
  - Banner "Quick Start" 5 phút ở đầu
  - Chia 3 phần: "Bắt đầu" (30p) → "Kiến thức nền" → "Làm feature"
  - Prerequisite cho backend/frontend

### `docs/glossary.md` — **P1**
- 124 dòng. **Thiếu:** LazyInitException, N+1, CORS, Pessimistic Lock, Race Condition... Acronym chưa giới thiệu từ trước (FK = khóa ngoại).
- **Đề xuất expand:**
  - Thêm 10+ thuật ngữ gây bug
  - Đánh dấu "⚠️ nguy hiểm" cho mỗi term
  - Mục "Cách nhớ nhanh" (vd ACID = "tất cả xong hoặc roll lại")

### `docs/common-mistakes.md` — **P1**
- 533 dòng. **Thiếu:** "Tại sao sai" cho mỗi lỗi. Lỗi #11+ quá nhiều code không tóm tắt kiến thức.
- **Đề xuất expand:**
  - Thêm "Tại sao sai?" 1 câu mỗi lỗi
  - Section "3 lỗi tuần 1": entity leak, EAGER fetch, missing `@Transactional`
  - Link tới `backend/15-common-pitfalls.md` thay vì lặp

### `docs/features-completed.md` — P3
- 241 dòng. **Tracking sheet, không cần dạy.** Giữ nguyên + thêm link tới module guides.

### `docs/test-cases.md` — P2
- 513 dòng. **Thiếu:** Cách chạy test command. "Tại sao test cái này". Manual test WebSocket.
- **Đề xuất expand:**
  - Quick Guide chạy test (3-5 lệnh)
  - Chia P0/P1/P2 ưu tiên
  - Manual Test Plan cho WebSocket + Payment callback

---

## 8. Phát hiện chung (cross-cutting issues)

### 8.1 Thiếu câu hỏi tự test (Quiz)
**~50% files KHÔNG có section "Câu hỏi tự kiểm tra"**. Đặc biệt:
- Hầu hết file frontend (24 files): chỉ 15-react-pitfalls có quiz
- Backend: 7/16 file thiếu quiz
- Module guide: 15-statistics thiếu quiz hoàn toàn

→ **Action chung:** Đợt expand nào cũng thêm 5-10 câu quiz cuối bài.

### 8.2 Thiếu giải thích "tại sao" (Why before What)
Nhiều file nêu cú pháp / annotation nhưng không nói:
- Tại sao có thứ này (vấn đề gì nó giải quyết)
- Trước khi có nó, code phải làm sao (before-after)
- Khi nào KHÔNG dùng

→ **Action chung:** Mỗi khái niệm mới phải có 3 phần: Vấn đề → Giải pháp → Trade-off.

### 8.3 Thiếu anti-pattern cảnh báo
Các bug "vô hình" (self-invocation `@Transactional`, LazyInitException, N+1, stale state React) chỉ nói ở 1-2 nơi.

→ **Action chung:** Thêm box `⚠️ Cảnh báo` ở mỗi file có liên quan tới các pattern này.

### 8.4 Thiếu code comparison (before-after)
Pattern dùng mà không có "code KHÔNG dùng pattern xấu thế nào". Đặc biệt design-patterns/* (file ngắn 150-300 dòng).

→ **Action chung:** Mỗi pattern phải có 2 block code: "Cách XẤU" và "Cách TỐT".

### 8.5 Code/citation có thể lỗi (cần verify)
- `docs/frontend/02-react-router.md`: encoding UTF-8 garbled ở line đầu ("Dieu huong" thay vì "Điều hướng")
- Các file:line citations chưa cross-check toàn bộ — sẽ verify khi expand từng file.

---

## 9. Kế hoạch session sau (đề xuất)

| Session | Mục tiêu | Thời lượng ước |
|---|---|---|
| Session 2 | Expand 7 file P1 (đợt 1) | 5-7h |
| Session 3-4 | Expand 12 file module-guides P2 (đợt 2) | 8-10h |
| Session 5-6 | Expand 14 file backend P2 (đợt 3) | 10-12h |
| Session 7-8 | Expand 13 file frontend P2 (đợt 4) | 8-10h |
| Session 9 | Expand 10 file DB+DP+Project P2 (đợt 5) | 6-8h |
| Session 10 | Review nhẹ 18 file P3 + cross-cutting fixes (đợt 6) | 2-3h |

**Sau session 10:** Toàn bộ docs đạt mức "giáo trình đại học" với:
- Mọi file có quiz cuối bài
- Mọi khái niệm có Why → What → Trade-off
- Mọi pattern có before-after code
- Mọi annotation/API có ⚠️ Anti-pattern box

---

## 10. Câu hỏi cho user trước khi bắt đầu session 2

1. **Đợt 1 có làm hết 7 file P1 trong 1 session không, hay chia 2 sessions?** (Tôi đề xuất chia 2: 3 file files-lẻ + README/glossary trong 1 session, 4 file lớn trong session khác)
2. **Có ưu tiên expand file đang sửa dở (git status) không?** (5 files trong git status: filter-spec, movie, booking, notification, favorite — tất cả đều P2 trừ booking là P1)
3. **Có muốn tôi viết thêm file MỚI không?** (vd: `backend/16-spring-aop-deep-dive.md`, `frontend/19-react-internals.md`, `database/04-sql-server-internals.md`) — báo cáo này CHƯA đề xuất file mới, chỉ expand file có sẵn.

---

## 11. MovieRun Refactor Lessons (2026-06-08)

> **Cập nhật sau refactor lớn Movie → Movie + MovieRun** (5 commits BE+FE, ec8d1cf → 78625cd).

### Tóm tắt refactor

| Commit | Mô tả | Files chính |
|---|---|---|
| `ec8d1cf` (C1) | Tách entity MovieRun + Liquibase 051 (Phase 1 migration NULLABLE) | `MovieRun.java`, `051-create-movie-runs-table.xml` |
| `f93c8d7` (C2) | Showtime link MovieRun NOT NULL + Liquibase 052 (Phase 2 migration) | `Showtime.java`, `052-showtime-movie-run-not-null.xml` |
| `bde1457` (C3) | CRUD MovieRun + Scheduler + Movie.status derived | `MovieRunService.java`, `MovieRunStatusScheduler.java` |
| `78625cd` (C4) | FE CRUD admin với Single Dialog 2-Modes pattern | `MovieRunsDialog.tsx`, `useMovieRuns.ts` |
| C5 (doc) | Doc cập nhật | File này + module guide + 16-architectural-patterns.md |

### Bài học kỹ thuật đã rút ra → thành Pattern

Refactor lớn này phát sinh **9 pattern** đã được tổng hợp vào file mới:

→ **`docs/backend/16-architectural-patterns.md`** — Architectural Patterns from CineX

| # | Pattern | Phát sinh từ |
|---|---|---|
| 1 | Denormalized Foreign Key | Bug double-booking (`c65be05`) + `Showtime.movie` denormalized backup |
| 2 | Derived Status (Option A vs B) | `Movie.status` giữ làm derived field thay vì drop hẳn |
| 3 | 2-Phase Schema Migration | Liquibase 051 (NULLABLE) → 052 (NOT NULL với preConditions) |
| 4 | Single Dialog 2-Modes | `MovieRunsDialog.tsx` — list/form mode switch |
| 5 | ShedLock cho `@Scheduled` HA | `MovieRunStatusScheduler` với `@SchedulerLock` |
| 6 | JPQL Bulk Update `clearAutomatically` | `MovieRunRepository.archiveByMovieId` cascade |
| 7 | Overlap Check Formula `a ≤ d AND c ≤ b` | `existsOverlap` chống trùng đợt chiếu cùng phim |
| 8 | Auto-pick FK Strategy | `ShowtimeService.resolveMovieRun` NOW_SHOWING > SCHEDULED |
| 9 | application-local.yml | Setup dev secrets (commit `61dc496`) |

### Cảnh báo cho production deploy

Refactor lớn (entity mới + FK NOT NULL + scheduler distributed lock) **PHẢI test runtime kỹ trước production**:

1. **Verify Liquibase 051 backfill chạy đúng** trên data thực tế (production có thể có showtime cho phim đã ENDED — backfill phải tạo MovieRun ENDED tương ứng)
2. **Verify scheduler chỉ chạy trên 1 instance** sau khi deploy nhiều node (check log: chỉ 1 node log "[MovieRunStatusScheduler] N đợt chiếu...")
3. **Verify Movie.status được recompute đúng** sau khi tạo/sửa/archive run (eventual consistency — có thể trễ vài giây nếu request chưa commit)
4. **Verify showtime tạo mới luôn có `movie_run_id`** — nếu nhỡ nào còn code path cũ không set, sẽ fail NOT NULL
5. **Verify Phase 2 migration `MARK_RAN` log** nếu có row NULL còn sót — admin phải fix tay rồi rerun

### Đọc thêm

- Module guide: `docs/module-guides/05-movie-explained.md` **Section 4** (Pattern Movie + MovieRun) — chi tiết business + ASCII diagram
- Pattern reference: `docs/backend/16-architectural-patterns.md` — 9 pattern đầy đủ với trade-off

---

**Kết thúc báo cáo audit.**
