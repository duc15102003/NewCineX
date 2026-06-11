# CineX — Architecture Overview (Đọc đầu tiên)

> File này là **OVERVIEW TỔNG**. Đọc trước khi đi sâu vào từng module. Mọi link tham chiếu đến `/docs/module-guides/*` cho phần chi tiết.
>
> Phiên bản: 2026-06 (sau refactor F1 thêm 4 module Theater / Pricing / Loyalty / Combo + MovieRun)

---

## 1. CineX là gì

### 1.1. Bối cảnh dự án

CineX là **đồ án tốt nghiệp ngành CNTT** — xây dựng hệ thống đặt vé xem phim online theo mô hình **multi-branch cinema** (nhiều chi nhánh). Web app gồm 2 mặt:

- **User-facing (public)**: chọn chi nhánh → duyệt phim → chọn suất chiếu → chọn ghế → thanh toán → nhận vé QR → đến rạp check-in.
- **Admin (back-office)**: quản lý phim, suất chiếu, phòng/ghế, voucher, combo snack, theo dõi doanh thu (dashboard), POS bán đồ ăn tại quầy, check-in vé.

### 1.2. So sánh CGV / Lotte / Galaxy

| Tính năng | CGV / Lotte | CineX |
|---|---|---|
| Multi-branch (N chi nhánh) | Có (~80 / 50 / 20) | Có (`theater` table) |
| Đặt vé online | Có | Có |
| Snack POS tại quầy | Có (POS riêng) | Có (`/admin/pos`) |
| Combo (gộp đồ ăn) | Có | Có (`combos` + `combo_items`) |
| Loyalty / điểm thưởng | Có (CGV Member) | Có (`loyalty_tiers` + `loyalty_transactions`) |
| Pricing engine | Có (peak hour, weekend, VIP) | Có (`pricing_rules` table) |
| Voucher / khuyến mãi | Có | Có |
| QR check-in | Có | Có (ZXing) |
| Dynamic seat map | Có | Có (`SeatMapEditorPage`) |

### 1.3. Mục đích đồ án

> **Không phải làm sản phẩm thương mại.** Mục đích là **học**: cấu trúc code đúng chuẩn industry, áp dụng đủ 23 design patterns GoF, vận dụng SOLID, hiểu sâu Spring / JPA / Security.

Mỗi module có file `/docs/module-guides/{N}-{module}-explained.md` giải thích:
- Pattern nào áp dụng, **tại sao** (so sánh before/after).
- Annotation Java / API mới gặp.
- SQL sinh ra.
- Câu hỏi tự kiểm tra cuối bài.

### 1.4. Tech Stack tóm tắt

```
Backend  : Spring Boot 3.3.5 / Java 21 / SQL Server / Redis / Liquibase
Frontend : React 19 / TypeScript / Vite / Tailwind 4 / shadcn/ui
Realtime : WebSocket STOMP (seat sync)
Auth     : JWT (HS256) + Refresh Token
Deploy   : Docker Compose (DB + Redis), JAR cho BE, Vite build cho FE
```

---

## 2. Tech Stack Decisions — Vì sao chọn?

> Mỗi quyết định công nghệ đều **có lý do**. Hiểu lý do quan trọng hơn nhớ tên.

### 2.1. Bảng quyết định Backend

| Công nghệ | Phiên bản | Vì sao chọn | Trade-off |
|---|---|---|---|
| **Spring Boot** | 3.3.5 | Ecosystem chuẩn enterprise. DI / Transaction / Security đã giải quyết. Tài liệu tiếng Việt nhiều. | Memory ~512MB minimum. Học cong cong: cần nắm bean lifecycle, scope. |
| **Java 21** | LTS | Virtual threads (Project Loom) hỗ trợ I/O nhẹ. Sealed interfaces giúp State Machine. Pattern matching switch. | Lambda capture syntax dễ nhầm. |
| **SQL Server** | 2022 | Chuẩn enterprise VN (ngân hàng, viễn thông dùng nhiều). Phù hợp đồ án (instructor quen). Có `MERGE`, window functions. | License Microsoft (Docker image free để dev). |
| **Liquibase** | core | Schema migration **version-controlled**. Mỗi changeset có author + id, không thể chạy lại 2 lần. Hỗ trợ rollback. | Phải viết XML/YAML, không tự generate như Hibernate `ddl-auto`. **Tốt vì** dùng `ddl-auto=update` ở production là antipattern. |
| **Redis (Lettuce)** | 7+ | Distributed cache + JWT blacklist + rate limit. Lettuce client async, hỗ trợ pool. | Cần Docker hoặc cloud Redis. |
| **MapStruct** | 1.6.3 | Compile-time mapper (sinh ra `*Impl.java`). Type-safe, không reflection → nhanh. | Phải build mới thấy code. Lỗi mapping hiện compile-time. |
| **Lombok** | latest | Giảm boilerplate (getter/setter/builder). | IDE cần plugin. Lạm dụng `@Data` lộ field nhạy cảm. |
| **JJWT** | 0.12.6 | Library JWT chuẩn nhất Java. Hỗ trợ HS256, HS512, RS256, ES256. | API thay đổi giữa các version (0.10 → 0.11 → 0.12). |
| **ShedLock** | 5.16.0 | Chống chạy trùng `@Scheduled` trên multi-instance. Dùng table `shedlock` làm distributed lock. | Cần thêm 1 table. |
| **Caffeine** | 3.1.8 | In-process cache hiệu năng cao (W-TinyLFU eviction). Nhanh hơn Guava Cache. | Chỉ local 1 instance, không chia sẻ giữa các pod. |
| **Cloudinary** | http5 2.0.0 | Free tier 25GB. CDN sẵn. Transform ảnh on-the-fly (resize, crop). | Vendor lock-in. |
| **ZXing** | 3.5.3 | Sinh QR code cho vé. Library Google, ổn định 10+ năm. | API thuần Java, không Spring-native. |

### 2.2. Bảng quyết định Frontend

| Công nghệ | Phiên bản | Vì sao chọn | Trade-off |
|---|---|---|---|
| **React** | 19 | Hệ sinh thái lớn nhất. JSX dễ học. Concurrent features (Suspense, useTransition). | Cần state library bên ngoài (không có như Vue Pinia). |
| **TypeScript** | ~6.0 | Type-safe → IDE autocomplete tốt. Bắt lỗi compile-time. | Build chậm hơn JS thuần. |
| **Vite** | 8 | Dev server cực nhanh (ESM native). HMR chuẩn. Build dùng Rollup. | Plugin ecosystem nhỏ hơn Webpack. |
| **Tailwind CSS** | 4 | Utility-first → không cần đặt tên class. Tree-shake → bundle nhỏ. JIT compile. | HTML/JSX dài. Học cong cong. |
| **shadcn/ui** | — | Pattern **copy-and-customize** (không phải npm package). Mỗi component nằm trong `src/components/ui/`, tự sửa được. Dùng Radix UI primitives. | Phải tự maintain code khi shadcn update. |
| **TanStack Query** | 5 | Server state management chuẩn. Cache + invalidate + retry + optimistic update. | Bóng tối học: stale-time, gc-time, mutation. |
| **Zustand** | 5 | Client state nhẹ (1 file ~30 dòng). Không có boilerplate như Redux. | Không có devtools mạnh như Redux DevTools. |
| **react-hook-form** | 7 | Form performance tốt (uncontrolled). Tích hợp Zod validation. | API hooks, không state-driven như Formik. |
| **Zod** | 4 | Schema validation TypeScript-first. Infer type từ schema. | Bundle size lớn (~12KB gzip). |
| **STOMP / SockJS** | 7 / 1.6 | Real-time seat sync (1 user chọn ghế → user khác thấy ghế đó disabled). | Cần backend WebSocket support. |
| **TanStack Query + Zustand** | combo | TanStack cache server data, Zustand cache UI state (auth, theater). KHÔNG dùng Zustand cho server data. | Phải hiểu ranh giới. |
| **recharts** | 3 | Charts đẹp + declarative React. Dashboard admin dùng. | Bundle size lớn. |

---

## 3. Layered Architecture

### 3.1. Sơ đồ tổng

```
┌──────────────────────────────────────────────────────────────┐
│                  FRONTEND (React + TS + Vite)                │
│                                                              │
│   ┌─────────────────────────────────────────────────────┐    │
│   │ Pages (features/*/Page.tsx)                         │    │
│   │   ↓ gọi hooks                                       │    │
│   │ Hooks (hooks/useAdmin*.ts, useAuth.ts, ...)         │    │
│   │   ↓ gọi api                                         │    │
│   │ API client (api/axios.ts + interceptor JWT)         │    │
│   ├─────────────────────────────────────────────────────┤    │
│   │ State: Zustand (auth, theater)                      │    │
│   │ Cache: TanStack Query (server data)                 │    │
│   │ Form:  react-hook-form + Zod                        │    │
│   │ Realtime: STOMP /topic/seats/{showtimeId}           │    │
│   └─────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
                  │ HTTP (REST + JSON)
                  │ WS  (STOMP over SockJS)
                  ▼
┌──────────────────────────────────────────────────────────────┐
│                BACKEND (Spring Boot 3.3.5)                   │
│                                                              │
│   ┌─── Cross-cutting ─────────────────────────────┐          │
│   │ SecurityFilterChain (JWT)                     │          │
│   │ GlobalExceptionHandler (@RestControllerAdvice)│          │
│   │ AuditableAspect (AOP) → audit_logs            │          │
│   │ JpaAuditingConfig (createdBy/updatedBy)       │          │
│   │ CORS + CSRF off                               │          │
│   └───────────────────────────────────────────────┘          │
│                                                              │
│   ┌─── Layered ───────────────────────────────────┐          │
│   │ Controller   (REST, @PreAuthorize, @Valid)    │          │
│   │     ↓ inject Service (Dependency Inversion)   │          │
│   │ Service      (Business logic, @Transactional) │          │
│   │     ↓ inject Repository                       │          │
│   │ Repository   (JPA + Specification)            │          │
│   │     ↓                                         │          │
│   │ Database     (SQL Server)                     │          │
│   └───────────────────────────────────────────────┘          │
│                                                              │
│   ┌─── Async / Background ────────────────────────┐          │
│   │ @Scheduled + ShedLock (8 cron jobs)           │          │
│   │ Spring Events (PaymentCompletedEvent → ...)   │          │
│   │ WebSocket (SeatHoldService → broadcast)       │          │
│   │ AsyncConfig (@Async cho email)                │          │
│   └───────────────────────────────────────────────┘          │
│                                                              │
│   ┌─── Cache layer ───────────────────────────────┐          │
│   │ Caffeine (local): stats-overview, ...         │          │
│   │ Redis (distributed): JWT blacklist, rate limit│          │
│   └───────────────────────────────────────────────┘          │
└──────────────────────────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────────┐
│   External services:                                         │
│   - SQL Server (port 1433)                                   │
│   - Redis (port 6379)                                        │
│   - Cloudinary (upload ảnh poster/avatar/snack)              │
│   - SMTP Gmail (gửi mail xác minh + reset password)          │
│   - MoMo / Cash (payment processor)                          │
└──────────────────────────────────────────────────────────────┘
```

### 3.2. Trách nhiệm từng layer

#### Controller layer

- **Trách nhiệm**: parse request → validate (`@Valid`) → gọi Service → trả `ApiResponse<T>`.
- **KHÔNG**: business logic, KHÔNG truy cập Repository.
- **Annotation chính**: `@RestController`, `@RequestMapping`, `@PreAuthorize`, `@Operation` (Swagger).
- File mẫu: `MovieController.java`, `BookingController.java`.

#### Service layer

- **Trách nhiệm**: business logic, orchestrate Repository + Mapper + external service.
- **Mỗi method public**: `@Transactional` (write) hoặc `@Transactional(readOnly = true)` (read).
- **Pattern**: 1 service = 1 domain. Cross-module → service A inject service B (không inject repository B).
- File mẫu: `BookingService.java`, `PaymentService.java`.

#### Repository layer

- **Trách nhiệm**: thao tác DB.
- **Convention method**: `findByXxx`, `existsByXxx`, `countByXxx` (Spring Data).
- **Query phức tạp**: `@Query` (JPQL) hoặc `Specification<T>` (dynamic).
- File mẫu: `BookingRepository.java`, `MovieRepository.java`.

#### Mapper layer (MapStruct)

- **Trách nhiệm**: Entity ↔ DTO chuyển đổi.
- **Sinh ra**: compile-time, file `*MapperImpl.java` trong `build/generated/`.
- **Pattern**: 1 mapper / 1 module.
- File mẫu: `MovieMapper.java`, `UserMapper.java`.

#### Specification layer

- **Trách nhiệm**: Build query động cho list API (filter + search + sort).
- **Pattern**: Specification (Domain-Driven Design).
- File mẫu: `MovieSpecification.java`, `BookingSpecification.java`.
- Chi tiết: [`04-filter-specification-explained.md`](./module-guides/04-filter-specification-explained.md).

---

## 4. Module Map (18 modules backend)

> Mỗi module có `controller / dto / entity / repository / service` cơ bản. Một số có thêm `mapper`, `specification`, `event`, `listener`, `processor`, `strategy`, `scheduler` tùy nhu cầu.

| # | Module | Trách nhiệm | Cấu trúc đặc biệt | Docs |
|---|---|---|---|---|
| 1 | `auth` | Login/Register/Refresh/Forgot Password/Email Verification | + scheduler (cleanup token) | [`02-auth`](./module-guides/02-auth-explained.md) |
| 2 | `user` | User profile, avatar, role | + mapper | [`03-user`](./module-guides/03-user-explained.md) |
| 3 | `theater` | **Chi nhánh rạp** (multi-branch) | + specification, + mapper | [`15-theater`](./module-guides/15-theater-explained.md) |
| 4 | `movie` + `movie-run` | Phim metadata + **đợt chiếu** (run) | MovieRunStatusScheduler | [`05-movie`](./module-guides/05-movie-explained.md) |
| 5 | `genre` | Thể loại phim (M-N với Movie) | — | [`05-movie`](./module-guides/05-movie-explained.md) |
| 6 | `room` | Phòng chiếu (thuộc Theater) | — | [`06-room`](./module-guides/06-room-explained.md) |
| 7 | `seat` | Ghế (thuộc Room) | — | [`07-seat`](./module-guides/07-seat-explained.md) |
| 8 | `showtime` | Suất chiếu (Room + Movie + thời gian) | + ShowtimeStatusScheduler | [`08-showtime`](./module-guides/08-showtime-explained.md) |
| 9 | `booking` | Đặt vé: hold → confirm → check-in / expire | + 2 scheduler, + WebSocket | [`09-booking`](./module-guides/09-booking-explained.md) |
| 10 | `payment` | MoMo + Cash + Refund | **+ processor (Strategy), + event, + listener** | [`10-payment`](./module-guides/10-payment-explained.md) |
| 11 | `pricing` | **Rule engine giá vé** (peak/weekend/holiday) | **+ strategy (PricingRuleMatcher)** | [`16-pricing`](./module-guides/16-pricing-explained.md) |
| 12 | `voucher` | Khuyến mãi (% hoặc fix amount) | + VoucherCleanupScheduler | [`10-payment`](./module-guides/10-payment-explained.md) |
| 13 | `loyalty` | **Điểm thưởng + tier (Bronze/Silver/Gold/Platinum)** | **+ listener (Observer event)** | [`17-loyalty`](./module-guides/17-loyalty-explained.md) |
| 14 | `snack` | Đồ ăn lẻ (popcorn, nước ngọt) | — | [`12-snack`](./module-guides/12-snack-explained.md) |
| 15 | `combo` | **Gộp snack thành combo (bundle)** | — | [`18-combo`](./module-guides/18-combo-explained.md) |
| 16 | `review` | Đánh giá phim (1-5 sao) | + cập nhật rating_count | [`11-review`](./module-guides/11-review-explained.md) |
| 17 | `favorite` | Phim yêu thích của user | — | [`14-favorite`](./module-guides/14-favorite-explained.md) |
| 18 | `notification` | Thông báo in-app + email | + NotificationCleanupScheduler | [`13-notification`](./module-guides/13-notification-explained.md) |
| 19 | `statistics` | Dashboard analytics | + Caffeine cache | [`15-statistics`](./module-guides/15-statistics-explained.md) |
| 20 | `config` | `system_config` table — admin sửa runtime | — | [`01-common-infra`](./module-guides/01-common-infra-explained.md) |
| 21 | `audit` | `@Auditable` AOP logging | + aspect | — |
| 22 | `health` | Health check endpoint cho monitoring | — | — |

> **Lưu ý refactor F1**: 4 module **MỚI** (theater / pricing / loyalty / combo) + bảng `movie_runs` (tách "đợt chiếu" ra khỏi `movies`) được thêm Phase 7. Trước đó Showtime gắn thẳng vào Movie, không có khái niệm "đợt chiếu" — gây khó cho việc 1 phim chiếu 2 đợt khác nhau (premiere + standard).

### 4.1. Frontend features (10 thư mục)

| Folder | Trang chính | Hook |
|---|---|---|
| `features/home` | `HomePage` | — |
| `features/auth` | Login/Register/ForgotPassword/ResetPassword/VerifyEmail | `useAuth.ts` |
| `features/movie` | `MovieListPage` + `MovieDetailPage` | `useMovies.ts`, `useMovieRuns.ts` |
| `features/booking` | `SeatSelectionPage` + `PaymentPage` + `MyTicketsPage` + `TicketDetailPage` + `MockPaymentGateway` | `useBooking.ts`, `useWebSocket.ts` |
| `features/profile` | `ProfilePage` | `useAuth.ts` |
| `features/favorite` | `FavoritesPage` | `useFavorites.ts` |
| `features/notification` | `NotificationListPage` | `useNotifications.ts`, `useNotificationWebSocket.ts` |
| `features/loyalty` | `LoyaltyPage` | `useLoyalty.ts` |
| `features/admin` | 20 admin page (CRUD, POS, dashboard, check-in) | `useAdmin*.ts` |
| `features/common` | `NotFoundPage` | — |

---

## 5. Cross-cutting Concerns

### 5.1. Security — JWT + RBAC

```
Request → JwtAuthFilter (extract token) → SecurityContext (set Authentication)
                                       ↓
                          Controller @PreAuthorize("hasRole('ADMIN')")
                                       ↓
                                  Service / Repository
```

- **JWT HS256**: secret từ `application.yml` (`app.jwt.secret`).
- **Access token**: TTL ~15 phút.
- **Refresh token**: TTL ~7 ngày, lưu DB `refresh_tokens` table.
- **JWT blacklist**: khi logout, token chưa hết hạn → push vào Redis (`SET blacklist:{token} 1 EX {ttl}`).
- **RBAC**: `Role` enum = `ADMIN`, `STAFF`, `CUSTOMER`. Method security qua `@PreAuthorize("hasRole('ADMIN')")`.
- **Rate limit**: login + forgot-password dùng Redis (`LoginRateLimitService`, `ForgotPasswordRateLimitService`).

Chi tiết: [`03-security.md`](./backend/03-security.md), [`02-auth-explained.md`](./module-guides/02-auth-explained.md).

### 5.2. Soft Delete

- Tất cả entity nghiệp vụ **extends `BaseEntity`** → có cột `storage_state` (`ACTIVE` / `ARCHIVED`).
- "Xóa" = `UPDATE ... SET storage_state = 'ARCHIVED'`. KHÔNG `DELETE FROM`.
- Repository có method `findActiveById(id)`, list API filter `WHERE storage_state = 'ACTIVE'`.
- Đặc biệt: `users` không soft delete (lý do hợp đồng), `audit_logs` không soft delete.

### 5.3. Audit — `@Auditable` AOP

```java
@Auditable(action = "UPDATE_USER_ROLE", entityType = "User")
public UserProfileResponse updateRole(Long userId, UpdateRoleRequest request) { ... }
```

- AOP aspect (`AuditableAspect`) intercept method có annotation.
- Sau khi method **chạy thành công** → ghi 1 row vào `audit_logs` (username + IP + user-agent + action + entityType + entityId + JSON detail).
- Nếu method throw → KHÔNG ghi audit.
- Đang áp dụng 8 method (xem `grep -l '@Auditable'`): user role/status, payment refund, archive movie, ...

### 5.4. Transaction Management

- `@Transactional` Spring đảm bảo **ACID** ở mức method.
- Default `propagation = REQUIRED`: tham gia transaction cha nếu có, không thì tạo mới.
- `readOnly = true` cho query → Hibernate skip dirty check, nhanh hơn.
- **Rollback rules**: mặc định rollback khi `RuntimeException`. Checked exception KHÔNG rollback → cần `rollbackFor = Exception.class` nếu muốn.

### 5.5. Concurrency — Lock

#### Optimistic Lock (mặc định)

- `BaseEntity` có `@Version private Long version`.
- Mỗi UPDATE: Hibernate thêm `AND version = ?` vào WHERE. Nếu 0 row affected → throw `OptimisticLockException`.
- Dùng cho hầu hết entity (Movie, User, Showtime, ...) — assume conflict hiếm.

#### Pessimistic Lock (đặc biệt)

- `@Lock(LockModeType.PESSIMISTIC_WRITE)` → `SELECT ... FOR UPDATE`.
- Áp dụng ở:
  - `ShowtimeRepository.findByIdWithLock(id)` — khi giữ ghế (booking).
  - `IdTrackerRepository.findByPrefixWithLock(prefix)` — sinh code không trùng (`BK202606xx`).

### 5.6. WebSocket — STOMP

- Endpoint: `/ws` (SockJS fallback).
- Topic: `/topic/seats/{showtimeId}` — broadcast khi có ghế bị hold/release.
- Topic: `/topic/notifications/{userId}` — push notification real-time.
- Filter: `StompChannelInterceptor` validate JWT từ STOMP CONNECT header.

Chi tiết: [`10-websocket.md`](./backend/10-websocket.md), [`14-booking-websocket-explained.md`](./frontend/14-booking-websocket-explained.md).

### 5.7. Scheduled jobs + ShedLock

8 scheduler trong codebase:

| Class | Cron | Trách nhiệm |
|---|---|---|
| `BookingCleanupScheduler` | `*/1 * * * *` (mỗi phút) | Hủy booking `HOLDING` quá `hold_minutes` |
| `NoShowScheduler` | mỗi 5 phút | Đánh dấu booking `CONFIRMED` quá giờ chiếu + buffer → `NO_SHOW` |
| `ShowtimeStatusScheduler` | mỗi 5 phút | `SCHEDULED` → `IN_PROGRESS` → `FINISHED` theo thời gian |
| `MovieRunStatusScheduler` | mỗi ngày | `MovieRun.startDate / endDate` → `UPCOMING` / `NOW_SHOWING` / `ENDED` |
| `CleanupTokenScheduler` | mỗi đêm | Xóa refresh token expired, email verification token expired |
| `NotificationCleanupScheduler` | mỗi tuần | Xóa notification > 30 ngày |
| `VoucherCleanupScheduler` | mỗi ngày | Voucher quá `endDate` → archive |

**ShedLock**: chống chạy trùng khi deploy multi-instance. Mỗi scheduler có `@SchedulerLock(name = "...", lockAtLeastFor = ..., lockAtMostFor = ...)`. Lock lưu trong table `shedlock` (changeset 038).

### 5.8. Caching

#### Caffeine (local in-process)

- File: `common/config/CacheConfig.java`.
- 4 cache: `stats-overview`, `stats-revenue`, `stats-top-movies`, `stats-top-snacks`.
- TTL: 60s.
- Áp dụng: `StatisticsService` methods có `@Cacheable(value = "stats-overview")`.

#### Redis (distributed)

- JWT blacklist (`JwtBlacklistService`).
- Rate limit login (`LoginRateLimitService`).
- Rate limit forgot-password (`ForgotPasswordRateLimitService`).
- UserDetails cache (`UserDetailsCacheService` — TTL ngắn để giảm load DB).

### 5.9. Event-driven — Spring ApplicationEvent

Pattern Observer áp dụng cho:

```
PaymentService.markCompleted()
       ↓ publishEvent(PaymentCompletedEvent)
       ↓
       ├── PaymentEventListener  (gửi email vé QR + notification)
       └── LoyaltyEventListener  (cộng điểm + auto upgrade tier)
```

- `@TransactionalEventListener(phase = AFTER_COMMIT)`: chỉ trigger khi transaction parent commit thành công.
- Lý do: nếu PaymentService throw → rollback → listener KHÔNG gửi email (đúng business).
- Chi tiết: [`10-payment-explained.md`](./module-guides/10-payment-explained.md), [`17-loyalty-explained.md`](./module-guides/17-loyalty-explained.md).

### 5.10. Configuration

Hai loại config song song:

| Loại | Lưu ở đâu | Dùng cho | Đổi ở đâu |
|---|---|---|---|
| **Static** | `application.yml` | DB URL, JWT secret, port, Cloudinary key, SMTP host | Sửa file → restart |
| **Runtime** | Table `system_config` | `hold_minutes`, `max_seats_per_booking`, `pricing_base_price`, `loyalty_points_per_vnd`, `email_throttle_seconds`, ... | Admin sửa `/admin/configs` → có hiệu lực ngay |

> **Anti-pattern**: hardcode magic number trong code (`if (seats > 8)`). **Đúng**: đọc từ `SystemConfigService.getInt("max_seats_per_booking", 8)`.

---

## 6. Database Architecture

### 6.1. Migration với Liquibase

- **Master file**: `backend/src/main/resources/db/changelog/db.changelog-master.xml`.
- **59 changesets** (001 → 059) tính đến 2026-06.
- Mỗi changeset: 1 file XML riêng trong `changes/`, đánh số tăng dần (`001-create-users-table.xml`).
- Mỗi changeset có `id` + `author = "cinex"` unique.
- **Đã chạy KHÔNG được sửa**. Muốn alter → tạo changeset mới.

#### Pattern 2-phase migration (cho thay đổi schema có dữ liệu sẵn)

VD chuyển `showtime.movie_run_id` từ NULL sang NOT NULL:
1. Changeset 051: `ADD COLUMN movie_run_id BIGINT NULL` + tạo table `movie_runs`.
2. Backfill: tạo MovieRun mặc định cho mỗi Movie hiện có, gán `showtime.movie_run_id`.
3. Changeset 052: `ALTER COLUMN movie_run_id BIGINT NOT NULL` + thêm FK.

### 6.2. BaseEntity — Class cha cho tất cả entity nghiệp vụ

```java
public abstract class BaseEntity {
    @Id @GeneratedValue
    private Long id;
    @Version
    private Long version;             // Optimistic lock
    @Enumerated(EnumType.STRING)
    private StorageState storageState; // ACTIVE / ARCHIVED
    @CreatedDate
    private Instant createdAt;
    @LastModifiedDate
    private Instant updatedAt;
    @CreatedBy
    private String createdBy;          // username (từ SecurityContext)
    @LastModifiedBy
    private String updatedBy;
}
```

- Mỗi entity nghiệp vụ extends class này → kế thừa **7 field chuẩn**.
- `@EnableJpaAuditing` ở `JpaAuditingConfig` → tự fill `createdAt / updatedAt / createdBy / updatedBy`.

### 6.3. ER summary (top-level)

```
                 ┌────────┐
                 │  user  │ ──── refresh_tokens
                 └────────┘            └── password_reset_tokens
                     │                 └── email_verification_tokens
                     │                 └── user_favorites (M-N Movie)
                     │                 └── loyalty_transactions
                     ▼
                 ┌─────────┐
   theater ──→   │  room   │  ─── seat (1-N, có row + col + type)
   (1-N)         └─────────┘
                     │
                     ▼  (1-N)
                 ┌──────────┐
   movie  ──→    │ showtime │  ─→  booking ──→ booking_seats (M-N seat)
   movie_run     └──────────┘            │
   (1-N)             ▲                   ├── payment (1-1, có gateway_transaction_id)
                     │ (movie_run)       ├── snack_orders (1-N)
                     │                   └── voucher_usage (M-1 voucher)
                  genre (M-N)
                     │
                 ┌────────────────┐
                 │  pricing_rule  │  ← engine apply theo showtime context
                 └────────────────┘

   loyalty_tier (Bronze / Silver / Gold / Platinum) — config-only

   snack ──┐
           ├─→ combo_items ──→ combo
           └─→ snack_orders (lẻ hoặc combo)

   system_config — key-value config admin sửa được
   audit_logs    — log mọi @Auditable action
   id_tracker    — sinh code (BK*, OD*, PR*, ...)
   shedlock      — distributed lock cho scheduler
```

Chi tiết ER + cột từng bảng: [`erd.md`](./erd.md) và [`/docs/database/`](./database/).

### 6.4. Index strategy

- **Unique business key**: `users.username`, `bookings.booking_code`, `movies.code`, `theaters.code`, `pricing_rules.code`.
- **Filter columns**: `bookings.status`, `theaters.status`, `showtimes.movie_run_id`, `rooms.theater_id`.
- **Composite (uk_booking_seats_active)** (changeset 034):
  - `UNIQUE (showtime_id, seat_id) WHERE storage_state = 'ACTIVE'`
  - → Chặn 2 booking ACTIVE cùng giữ 1 ghế trong cùng showtime.
- **Composite (uk_voucher_usage)** (changeset 035): `UNIQUE (voucher_id, booking_id)`.
- **Performance indexes** (changeset 039): các index cho dashboard query (group by + date range).

---

## 7. Frontend Architecture

### 7.1. Routing — code-splitting bằng `lazy`

```tsx
const HomePage = lazy(() => import('@/features/home/HomePage'))
const AdminMoviePage = lazy(() => import('@/features/admin/AdminMoviePage'))

<Routes>
  <Route element={<MainLayout />}>
    <Route path="/" element={<HomePage />} />
    <Route element={<ProtectedRoute />}>
      <Route path="/booking/seats/:showtimeId" element={<SeatSelectionPage />} />
    </Route>
  </Route>
  <Route element={<AdminRoute />}>
    <Route element={<AdminLayout />}>
      <Route path="/admin/movies" element={<AdminMoviePage />} />
    </Route>
  </Route>
</Routes>
```

- **Public routes** (under `MainLayout`): `/`, `/movies`, `/login`, ...
- **Protected** (cần login, under `ProtectedRoute`): `/booking/*`, `/my-tickets`, `/profile`, `/loyalty`.
- **Admin** (cần role ADMIN, under `AdminRoute` + `AdminLayout`): `/admin/*` (20+ pages).
- **Special**: `/payment/gateway` (mock cổng MoMo) không layout.

### 7.2. State management

| Loại | Library | Lưu gì | Persist |
|---|---|---|---|
| **Server state** | TanStack Query | Movie list, booking list, user list, ... (cache theo `queryKey`) | RAM (gc-time mặc định 5 phút) |
| **Auth state** | Zustand `authStore` | `token`, `refreshToken`, `user` | `localStorage` |
| **Theater context** | Zustand `theaterStore` | `currentTheater` (id + code + name + city) | `localStorage` |
| **Form state** | react-hook-form | Form values + validation errors | RAM (uncontrolled) |
| **URL state** | react-router-dom | Page, filter, search params | URL query string |

> **Quy tắc**: server data **luôn dùng TanStack Query**, KHÔNG cache vào Zustand. Chỉ những thứ "thuần UI" (auth token, theater chọn) mới cho vào Zustand.

### 7.3. API client

- File: `frontend/src/api/axios.ts`.
- Base URL: `import.meta.env.VITE_API_URL` (default `http://localhost:8088`).
- **Request interceptor**: tự gắn `Authorization: Bearer {token}` từ `authStore`.
- **Response interceptor**: nếu 401 → thử refresh token → retry request gốc. Nếu refresh fail → logout + redirect `/login`.

### 7.4. Theme — Dark Brown + Warm Gold (Unified Phase 7a)

> **Đã hợp nhất**: trước Phase 7a có 2 theme (Public Dark Blue + Admin Dark Brown). Sau Phase 7a chỉ còn **1 theme duy nhất** dùng cho cả 2 mặt.

| Token | Hex | Dùng cho |
|---|---|---|
| Page bg | `#181309` | Body, main content |
| Sidebar (admin) | `#120e05` | Sidebar admin |
| Card | `#201b11` | Card, dialog, drawer, topbar |
| Input | `#2a2317` | Input, select, textarea |
| Border | `#3f382d` | Divider chính |
| Accent gold | `#ffc107` | Button primary, logo, active state |
| Gold hover | `#e6ac06` | Hover button |
| Title cream | `#fffbe6` | H1/H2 lớn (giảm chói) |

Quy tắc chi tiết: xem `CLAUDE.md` mục **CINEX DESIGN SYSTEM**.

### 7.5. Component organization

```
frontend/src/
├── components/
│   ├── ui/          # shadcn primitives (Button, Input, Dialog, ...)
│   ├── common/      # ConfirmDialog, Loading, StatusBadge, ...
│   ├── layout/      # MainLayout, Header, Footer
│   ├── admin/       # AdminLayout, Sidebar, Topbar
│   ├── theater/     # TheaterSelector, TheaterBadge
│   └── movie/       # MovieCard, MoviePoster
├── features/        # Pages theo module (1 thư mục = 1 module)
├── hooks/           # Custom hooks (1 file = 1 domain)
├── store/           # Zustand stores
├── routes/          # AppRouter + ProtectedRoute + AdminRoute
├── utils/           # labels.ts (format), colors.ts (status), etc.
└── types/           # TypeScript shared types
```

### 7.6. Cookbook

- **Hook barrel**: `useAdmin.ts` re-export từ `useAdminMovies.ts`, `useAdminRooms.ts`, ... → page import 1 chỗ.
- **Labels tập trung**: `utils/labels.ts` chứa `fmtDate()`, `fmtDateTime()`, `fmtCurrency()`, `bookingStatusLabel()`, ...
- **Colors tập trung**: `utils/colors.ts` chứa `BOOKING_STATUS_COLORS`, `PAYMENT_STATUS_COLORS`, ...
- **Form pattern**: dùng `react-hook-form` + `@hookform/resolvers/zod` + `Zod` schema, không dùng `useState` cho form.

Chi tiết: [`18-cookbook.md`](./frontend/18-cookbook.md).

---

## 8. Design Patterns Summary

> Bảng tổng kết — chi tiết từng pattern xem [`/docs/design-patterns/`](./design-patterns/).

### 8.1. Pattern major đã áp dụng

| Pattern | Nhóm | Ở đâu | Lý do dùng |
|---|---|---|---|
| **Strategy** | Behavioral | `PaymentProcessor` (MoMo/Cash), `PricingRuleMatcher` | Thêm cổng thanh toán mới = thêm class, không sửa code cũ |
| **Factory** | Creational | `PaymentProcessorFactory` | Chọn processor động theo `PaymentMethod` enum |
| **Observer** | Behavioral | `PaymentCompletedEvent` + 2 listener (Email, Loyalty) | Decouple: payment không biết email/loyalty là ai |
| **Specification** | Behavioral | `MovieSpec`, `BookingSpec`, `ShowtimeSpec`, `TheaterSpec`, ... | Build query động (filter + search + sort) |
| **State Machine** | Behavioral | `BookingStatus` (HOLDING → CONFIRMED → CHECKED_IN / EXPIRED / CANCELLED) | Enforce transition hợp lệ |
| **Builder** | Creational | Lombok `@Builder` cho ApiResponse, AuthResponse, DTOs | Tạo object với nhiều field optional |
| **Mapper** | Structural | MapStruct cho mỗi module | Tách Entity ↔ DTO compile-time |
| **Repository** | Structural | Spring Data JPA | Trừu tượng hóa truy vấn DB |
| **Facade** | Structural | `ApiResponse<T>` wrapper | Mọi response cùng format `{success, data, message, code}` |
| **DTO** | Structural | `*Request`, `*Response`, `*Filter` | Không lộ field entity ra client |
| **Singleton** | Creational | Tất cả Spring Bean (default scope) | Quản lý qua DI container |
| **Filter (Chain of Responsibility)** | Behavioral | `JwtAuthFilter` trong SecurityFilterChain | Xác thực trước Controller |
| **AOP (Aspect)** | Cross-cutting | `AuditableAspect`, `@Transactional`, `@PreAuthorize` | Cross-cutting concern không lẫn vào business code |
| **Template Method** | Behavioral | `BaseEntity` (cha) + entity con | Cha định nghĩa skeleton (id, version, audit, soft delete), con extend |
| **Decorator** | Structural | `@Transactional`, `@Cacheable`, `@PreAuthorize` | Thêm hành vi không sửa code gốc |
| **Lazy Initialization** | Creational | `@ManyToOne(fetch = LAZY)`, React `lazy()` | Hoãn load đến khi cần |

### 8.2. SOLID đã áp dụng

| Nguyên tắc | Ví dụ trong CineX |
|---|---|
| **S** — Single Responsibility | Controller chỉ HTTP, Service chỉ business, Repository chỉ DB. FE hook 1 domain / 1 file. |
| **O** — Open/Closed | Thêm payment method = thêm `MoMoPaymentProcessor` mới, không sửa `PaymentService`. Thêm filter = thêm field DTO + predicate Specification. |
| **L** — Liskov Substitution | Entity extends `BaseEntity` chỉ thêm field, không override behavior. |
| **I** — Interface Segregation | Repository chỉ chứa method thực sự được gọi. FE hook export đúng cái page cần. |
| **D** — Dependency Inversion | Controller inject Service (abstraction), không inject Repository. FE component dùng hook, không gọi `api.get()` thẳng. |

Chi tiết: [`04-solid-principles.md`](./design-patterns/04-solid-principles.md).

---

## 9. Workflow Examples (3 flow chính)

### 9.1. Flow 1: User đặt vé (happy path)

```
1. User vào /, lần đầu → modal chọn chi nhánh
       ↓ (lưu vào theaterStore localStorage)
2. Browse /movies?theater={id} → API GET /api/movies?theaterId=...
       ↓ (Service filter showtime có movie_run thuộc theater)
3. Click 1 phim → /movies/{id} → tab "Suất chiếu"
       ↓ (API GET /api/showtimes?movieId=&theaterId=&date=)
4. Click 1 suất → /booking/seats/{showtimeId}
       ↓ (subscribe WebSocket /topic/seats/{showtimeId})
       ↓ (GET /api/showtimes/{id}/seats → seat map + status từng ghế)
5. User chọn ghế → POST /api/bookings/hold {showtimeId, seatIds}
       ↓ (Service: PESSIMISTIC_WRITE showtime, check ghế chưa bị giữ, tạo booking HOLDING)
       ↓ (Broadcast /topic/seats/{showtimeId} cho user khác disable ghế)
       ↓ (Trả về bookingId + holdExpiresAt = now + hold_minutes)
6. /payment/{bookingId} → user chọn MoMo / Cash
       ↓ (POST /api/payments {bookingId, method: MOMO})
       ↓ (Service gọi PaymentProcessorFactory.get(MOMO) → MoMoPaymentProcessor.createPayment())
       ↓ (Redirect /payment/gateway?orderId=... — mock cổng MoMo)
7. Mock cổng → user click "Thành công" → callback POST /api/payments/momo/callback
       ↓ (Service đổi payment SUCCESS, booking HOLDING → CONFIRMED)
       ↓ (publishEvent(PaymentCompletedEvent))
       ↓
       ├── PaymentEventListener: gửi mail QR code + tạo notification
       └── LoyaltyEventListener: cộng điểm (10000 VNĐ = 1 điểm) + check upgrade tier
8. Redirect /payment/result?bookingId=... → hiện QR code + "Đến rạp trước 15p"
```

### 9.2. Flow 2: Admin tạo phim mới + lên lịch chiếu

```
1. Login admin → /admin → DashboardPage (Caffeine cache stats)
2. /admin/movies → toolbar [+ Thêm mới]
       ↓ Dialog tạo Movie: title, genre, duration, ageRating, poster (upload sau)
       ↓ POST /api/movies → Movie với storage_state=ACTIVE, status=COMING_SOON
3. Upload poster: cột "Upload" → modal chọn file → Cloudinary
       ↓ POST /api/movies/{id}/poster (multipart) → cập nhật posterUrl
4. /admin/movies → click hàng phim → [Đợt chiếu] (MovieRunsDialog)
       ↓ POST /api/movies/{id}/runs → MovieRun (type: PREMIERE / STANDARD, startDate, endDate)
5. /admin/showtimes → [+ Thêm mới]
       ↓ Chọn theater → chọn room → chọn movie_run → ngày + giờ
       ↓ Service validate: room không trùng giờ, movie_run status=NOW_SHOWING
       ↓ POST /api/showtimes → Showtime + auto-generate seat status (FREE cho mỗi seat của room)
6. Showtime status = SCHEDULED → tự đổi IN_PROGRESS / FINISHED qua ShowtimeStatusScheduler
7. User mở /movies?theater={theaterOfRoom} → thấy phim này có suất → đặt được
```

### 9.3. Flow 3: POS bán snack tại quầy (admin)

```
1. Login staff → /admin/pos (POSPage)
2. Pick chi nhánh (theaterStore)
3. Browse menu: Snack lẻ + Combo (tab riêng)
       ↓ GET /api/snacks?theaterId=... + GET /api/combos?theaterId=...
4. Click +/- item → cập nhật cart (local state)
       ↓ Combo gồm N snack → 1 line "Combo X1 = popcorn + coca + ..."
5. Click [Thanh toán]
       ↓ POST /api/snack-orders {items: [{snackId/comboId, qty}], paymentMethod: CASH}
       ↓ Service: PESSIMISTIC_WRITE id_tracker → sinh OD code (OD20260609001)
       ↓ Tạo SnackOrder + items, đánh dấu PAID
6. Hiện hóa đơn → click "In" → tạo PDF (jspdf-autotable) → download
       ↓ (Cũng có thể "Gắn vào vé": chọn 1 booking đang CONFIRMED, link snack_order → booking_id)
```

---

## 10. References

### 10.1. Docs trong dự án

- **Setup**: [`/docs/project/setup.md`](./project/setup.md) — A→Z cài đặt local.
- **README**: [`/docs/README.md`](./README.md) — index toàn bộ docs.
- **ERD**: [`/docs/database/erd.md`](./database/erd.md) (nếu có) hoặc trong `/docs/database/`.
- **Audit knowledge gaps**: [`/docs/00-audit-knowledge-gaps.md`](./00-audit-knowledge-gaps.md) — danh sách gap cần lấp.

### 10.2. Module guides (chi tiết)

```
/docs/module-guides/
  01-common-infra-explained.md      — BaseEntity, IdTracker, SystemConfig
  02-auth-explained.md              — JWT, refresh, forgot-password
  03-user-explained.md              — Profile, avatar, role
  04-filter-specification-explained.md — Specification pattern
  05-movie-explained.md             — Movie + MovieRun + Genre
  06-room-explained.md              — Room thuộc Theater
  07-seat-explained.md              — Seat (row + col + type)
  08-showtime-explained.md          — Showtime + scheduler
  09-booking-explained.md           — Hold/Confirm/Cancel + State Machine
  10-payment-explained.md           — Strategy + Factory + Observer
  11-review-explained.md            — Review + rating_count
  12-snack-explained.md             — Snack POS
  13-notification-explained.md      — In-app + email
  14-favorite-explained.md          — Phim yêu thích
  15-statistics-explained.md        — Dashboard + Caffeine cache
  15-theater-explained.md           — Multi-branch refactor F1
  16-pricing-explained.md           — Rule engine giá vé
  17-loyalty-explained.md           — Tier + transactions + Observer
  18-combo-explained.md             — Combo (snack bundle)
```

### 10.3. Deep-dive theo công nghệ

```
/docs/backend/
  00-spring-boot-from-scratch.md   — Hướng dẫn Spring Boot từ A
  01-spring-boot-basics.md          — Bean lifecycle, DI
  02-jpa-hibernate.md               — Lazy/Eager, N+1, Optimistic Lock
  03-security.md                    — JWT + SecurityFilterChain
  04-spring-features.md             — @Transactional, @Scheduled, @Async, AOP
  05-lombok.md                      — @Data, @Builder
  06-swagger.md                     — OpenAPI annotations
  07-gradle.md                      — Dependency, plugin
  08-redis.md                       — Lettuce, blacklist, rate limit
  09-email-cloudinary-qr.md         — Mail SMTP, Cloudinary upload, ZXing QR
  10-websocket.md                   — STOMP, SockJS, broker
  11-testing.md                     — JUnit, Mockito, @SpringBootTest
  13-deployment.md                  — Docker, JAR, environment
  14-observability.md               — Logging, Actuator
  15-common-pitfalls.md             — Gotchas thường gặp
  16-architectural-patterns.md      — Pattern overview backend

/docs/frontend/
  00-react-vite-from-scratch.md     — Hướng dẫn React + Vite từ A
  00-typescript-basics.md           — TS basics
  01-react-basics.md                — Hooks, JSX
  02-react-router.md                — v7 syntax
  03-tanstack-query.md              — useQuery, useMutation
  04-zustand-state.md               — Store pattern
  05-tailwind-css.md                — Utility-first
  06-form-validation.md             — react-hook-form + Zod
  07-axios-api.md                   — Interceptor, refresh
  08-shadcn-ui.md                   — Copy-and-customize
  09-project-config-files.md        — tsconfig, vite.config, ...
  10-how-frontend-works.md          — Mental model
  11-cinex-project-structure.md     — Folder convention
  12-auth-flow-explained.md         — Login → store → interceptor
  13-movie-feature-explained.md     — Pattern 1 feature
  14-booking-websocket-explained.md — STOMP client trong React
  15-react-pitfalls.md              — Common bugs
  16-performance-optimization.md    — React profiler
  17-testing-frontend.md            — Vitest + RTL
  18-cookbook.md                    — Common recipes

/docs/design-patterns/
  01-creational-patterns.md         — Singleton, Factory, Builder, Prototype, Abstract Factory
  02-structural-patterns.md         — Adapter, Decorator, Facade, Proxy, Composite, Bridge, Flyweight
  03-behavioral-patterns.md         — Strategy, Observer, State, Command, Template, Chain, Iterator, ...
  04-solid-principles.md            — 5 nguyên tắc + ví dụ CineX

/docs/database/
  01-database-techniques.md         — Index, transaction, normalization
  02-liquibase-guide.md             — Pattern viết changeset
  03-id-tracker.md                  — Sinh code tự động

/docs/docker/                       — Compose file, image
/docs/superpowers/                  — User workflow + memory bank
```

---

## Phụ lục — Cheat sheet command

### Backend

```bash
# Build (no test)
cd /Users/vutuongan/cinex/backend && ./gradlew clean build -x test

# Run
cd /Users/vutuongan/cinex/backend && ./gradlew bootRun

# DB up
cd /Users/vutuongan/cinex && docker-compose up sqlserver redis -d
```

### Frontend

```bash
# Dev
cd /Users/vutuongan/cinex/frontend && npm run dev   # → http://localhost:5173

# Build
cd /Users/vutuongan/cinex/frontend && npm run build
```

### Ports

| Service | Host | Port |
|---|---|---|
| Backend | localhost | 8088 |
| Frontend dev | localhost | 5173 |
| SQL Server | localhost | 1433 |
| Redis | localhost | 6379 |

---

> **Next step**: đọc `module-guides/` theo thứ tự (01 → 18) hoặc tra `00-audit-knowledge-gaps.md` để biết module nào cần đào sâu trước.
