# CineX — Quy tắc làm việc

---

## Về dự án
- **Đồ án tốt nghiệp:** Hệ thống đặt vé xem phim online
- **Mục tiêu chính:** Học hỏi design patterns, kiến trúc phần mềm, công nghệ thực tế
- **Đối tượng:** Sinh viên đang học, cần hiểu SÂU từng khái niệm, không chỉ copy code
- **Ngôn ngữ giao tiếp:** Tiếng Việt có dấu

---

## CINEX DESIGN SYSTEM & FRONTEND STANDARDS

> **UNIFIED (Phase 7a):** CineX dùng **MỘT hệ design duy nhất** — "Dark Brown + Warm Gold" — cho **toàn bộ** project (cả user-facing và admin). KHÔNG còn khái niệm "Public Dark Blue" tách biệt. Mọi page, mọi component đều dùng cùng bộ tokens dưới đây.

### 1. Color Palette (Unified)

| Token | Hex | Tailwind | Dùng cho |
|---|---|---|---|
| Page bg | `#181309` | `bg-[#181309]` | Body, main content, page background |
| Sidebar (admin) | `#120e05` | `bg-[#120e05]` | Sidebar admin (cố định 280px) |
| Card/Container | `#201b11` | `bg-[#201b11]` | Card, dialog, drawer, table header, topbar, dropdown menu |
| Input/Surface | `#2a2317` | `bg-[#2a2317]` | Input, select, textarea, nested surface |
| Border/Divider | `#3f382d` | `border-[#3f382d]` | Divider chính (table row separator, card border chính, dropdown border) |
| Border phụ | `white/5` `white/10` | `border-white/5` / `border-white/10` | Subtle border (vẫn dùng cho các chỗ rất nhẹ) |
| Accent gold | `#ffc107` | `bg-[#ffc107]`, `text-[#ffc107]` | Button chính, accent text, active state, logo |
| Gold hover | `#e6ac06` | `hover:bg-[#e6ac06]` | Button hover (10% darker) |
| Title text (cream) | `#fffbe6` | `text-amber-50` hoặc `text-[#fffbe6]` | Tiêu đề H1/H2 lớn (giảm chói so với trắng thuần) |
| Body text | trắng | `text-white` | Text thường, label nổi |
| Text phụ | xám | `text-gray-300` / `text-gray-400` | Secondary text, label form |
| Active icon | gold | `text-[#ffc107]` | Icon ở trạng thái active |
| Inactive icon | xám | `text-gray-400` (hoặc `text-[#3f382d]` cho rất mờ) | Icon ở trạng thái inactive |
| Thành công | xanh | `text-green-400` | Badge active, confirmed |
| Lỗi/Xóa | đỏ | `text-red-400` | Badge cancelled, inactive, đăng xuất |

**CẢNH BÁO — KHÔNG dùng các hex Public Dark Blue cũ:**
- KHÔNG dùng `#051424`, `#0a1929`, `#0d2137`, `#0d1c2d` — đây là tokens Public cũ, đã bỏ
- KHÔNG dùng `#eab308`, `#ca8a04` — đây là gold Public cũ, đã thay bằng `#ffc107` / `#e6ac06`
- KHÔNG dùng `bg-gray-950`, `bg-gray-900`, `bg-gray-800` series
- KHÔNG dùng `text-amber-400`, `bg-amber-500` series (chỉ cream `text-amber-50` cho title)

### 2. Border radius (Unified)
- **Container/Card/Dialog/Drawer**: `rounded-2xl` (16px)
- **Button**: `rounded-lg` (8px)
- **Input/Select/Textarea**: `rounded-md` (6px)
- **Badge/Tag**: `rounded-md` hoặc `rounded-full`

### 3. Status tag pattern (Low-opacity — MỚI Phase 7a)
Pattern thống nhất cho mọi badge trạng thái:
```
text-xs px-2 py-1 rounded-md border bg-{color}/10 text-{color} border-{color}/30
```
**ĐÃ ĐỔI từ `/20` → `/10`** để giảm độ chói trên nền nâu ấm. Ví dụ:
- Active/Confirmed: `bg-green-500/10 text-green-400 border-green-500/30`
- Cancelled/Failed: `bg-red-500/10 text-red-400 border-red-500/30`
- Pending/Warning: `bg-orange-500/10 text-orange-400 border-orange-500/30`
- Info: `bg-blue-500/10 text-blue-400 border-blue-500/30`
- Gold accent: `bg-[#ffc107]/10 text-[#ffc107] border-[#ffc107]/30`

Tất cả status colors **tập trung trong `frontend/src/utils/colors.ts`** — KHÔNG khai báo local trong page.

### 4. Typography
- **Font Family**: 'Inter', sans-serif (dùng cho toàn bộ)
- **Title (H1/H2 lớn)**: `text-amber-50` hoặc `text-[#fffbe6]` + `font-bold tracking-tight` — giảm chói
- **Body**: `text-white text-base` hoặc `text-sm leading-relaxed`
- **Secondary**: `text-gray-300` (label, mô tả), `text-gray-400` (timestamp, hint)

### 5. Layout chuẩn
- **Sidebar (admin)**: width cố định `w-[280px]`, `bg-[#120e05]`, border-r `border-[#3f382d]`
- **Topbar**: `bg-[#201b11]`, height ~64px, border-b `border-[#3f382d]`, chứa breadcrumb (trái) + user dropdown (phải)
- **Main content**: `bg-[#181309]`, padding `p-8` (32px) hoặc `p-10` (40px)
- **Header public**: `bg-[#181309]/95 backdrop-blur`, border-b `border-[#3f382d]`
- **Logo CineX**: text gold `text-[#ffc107] font-bold`

### 6. Button variants
- **Primary**: `bg-[#ffc107] hover:bg-[#e6ac06] text-black font-semibold rounded-lg`
- **Outline/Ghost gold**: `border border-[#ffc107] text-[#ffc107] hover:bg-[#ffc107]/10 rounded-lg`
- **Secondary/Cancel**: `border border-white/10 text-gray-300 hover:bg-white/5 rounded-lg`
- **Destructive**: variant `destructive` (đỏ) `rounded-lg`
- **Icon**: Lucide React, size `16-20`

### 7. Input & Form
- **Input/Select/Textarea**: `bg-[#2a2317] border-white/10 text-white rounded-md focus:ring-1 focus:ring-[#ffc107] focus:border-[#ffc107]`
- **Checkbox**: `accent-[#ffc107]`
- Component shadcn `Input`, `Textarea`, `Select` đã được set default theo tokens này — KHÔNG cần override className mỗi lần dùng

### 8. Menu item (Sidebar / Dropdown)
- Default: `text-gray-300 hover:bg-white/5 hover:text-white`
- Active: `bg-[#ffc107]/10 text-[#ffc107]` (có thể thêm `border-l-2 border-[#ffc107]`)
- Bo góc item: `rounded-xl`
- Icon active: `text-[#ffc107]`; icon inactive: `text-gray-400`

### 9. Bảng (Table)
- Container: `rounded-2xl border border-[#3f382d] overflow-hidden bg-[#201b11]`
- Header row: `bg-[#201b11] border-[#3f382d] hover:bg-transparent`
- Body row: `border-[#3f382d] hover:bg-white/5`
- Sticky cột: `sticky left-0 z-10 bg-[#201b11]`
- Cell content: `whitespace-nowrap`

### 10. Format dữ liệu
- **Tiền VNĐ**: `amount.toLocaleString('vi-VN') + 'đ'` → `100.000đ`
- **Ngày**: `fmtDate()` → `21/05/2026`
- **Ngày + giờ**: `fmtDateTime()` → `23:47 21/05/2026`
- **Tất cả hàm format** nằm trong `utils/labels.ts`

### 11. Pattern Admin Page
Mỗi trang admin CRUD tuân theo pattern:
1. **Toolbar**: Search Input (trái) + Nút Thêm mới + Nút Xóa (phải) — dùng `bg-[#2a2317]` input + `bg-[#ffc107]` button primary
2. **Table**: Checkbox + Cột unique clickable (gold `#ffc107`) + Data columns + Badge trạng thái — container `rounded-2xl bg-[#201b11] border-[#3f382d]`
3. **ConfirmDialog**: Xác nhận trước khi xóa — `rounded-2xl bg-[#201b11]`
4. **Dialog Create/Edit**: Form với Input/Textarea/Select — `rounded-2xl bg-[#201b11]`
5. **Hooks**: Tất cả query/mutation nằm trong `hooks/useAdmin.ts`

---

## SOLID PRINCIPLES & ARCHITECTURE RULES

### Nguyên tắc SOLID — BẮT BUỘC tuân thủ

#### S — Single Responsibility
- **Controller** chỉ làm 3 việc: nhận request → gọi service → trả response. KHÔNG chứa business logic, KHÔNG inject Repository
- **Service** chứa toàn bộ business logic. 1 service = 1 domain (BookingService chỉ xử lý booking)
- **FE Hook file** chỉ quản lý 1 domain: `useAdminMovies.ts`, `useAdminRooms.ts`... KHÔNG gộp nhiều domain vào 1 file
- **FE Component** < 300 dòng. Nếu lớn hơn → tách dialog, form thành component riêng
- **Upload ảnh** là action riêng biệt (cột Upload trên table), KHÔNG đặt trong form Tạo/Sửa

#### O — Open/Closed
- Thêm payment method mới → tạo class mới implement `PaymentProcessor`, KHÔNG sửa `PaymentService`
- Thêm filter mới → thêm field vào `*Filter` DTO + predicate trong `*Specification`, KHÔNG sửa service
- **FE**: Labels tập trung trong `utils/labels.ts`, Colors tập trung trong `utils/colors.ts`
- Thêm admin page mới → follow pattern chuẩn, import hooks + colors từ file tập trung

#### L — Liskov Substitution
- Entity extends `BaseEntity` chỉ thêm field, KHÔNG override behavior
- `PaymentProcessor` implementations phải hoạt động đúng với cả 2 method

#### I — Interface Segregation
- Repository chỉ chứa method thực sự được gọi, KHÔNG viết method "phòng hờ"
- FE hooks export chỉ những gì page cần

#### D — Dependency Inversion
- Controller inject `SecurityService` (abstraction), KHÔNG inject `UserRepository` trực tiếp
- FE component dùng hooks (`useAdminMovies`), KHÔNG gọi `api.get()` trực tiếp trong component
- Cross-module: module A gọi module B qua Service, KHÔNG qua Repository

### Architecture Rules

#### Backend Layered Architecture
```
Controller → Service → Repository → Database
     ↓           ↓
SecurityService  Mapper (MapStruct)
     ↓           ↓
  JwtUtil    Specification (dynamic query)
```
- Controller KHÔNG gọi Repository
- Service KHÔNG gọi Controller
- Repository KHÔNG chứa business logic

#### Frontend Architecture
```
Page Component → Hooks (useAdmin*.ts) → API (axios)
      ↓
  UI Components (shadcn/ui)
  Common Components (ConfirmDialog, StatusDropdown...)
  Utils (labels.ts, colors.ts)
```
- Page import hooks, KHÔNG import `api` trực tiếp
- Hook barrel file: `useAdmin.ts` re-export từ domain files
- Colors/Labels tập trung, KHÔNG khai báo local trong page

#### Data & API Rules
- **Soft delete** = `StorageState.ARCHIVED` (không phải DELETED)
- **Mới nhất ở đầu**: tất cả API list default `sort = "createdAt", direction = DESC`
- **Giá tiền** dùng `PriceInput` component (format `10.000đ`, value raw number)
- **Ngày** dùng `fmtDate()` (chỉ ngày) hoặc `fmtDateTime()` (ngày + giờ) từ `utils/labels.ts`
- **Input number** chặn ký tự `e`, `-`, `+` (HTML number cho phép scientific notation)
- **Form grid** dùng `grid-cols-12`: `col-span-12` (full), `col-span-6` (half), `col-span-4` (1/3)

#### File Upload Rules
- Upload ảnh (poster, avatar, snack) = action **riêng biệt**, gọi API ngay
- KHÔNG đặt upload trong form Tạo/Sửa (vì ấn Hủy nhưng ảnh đã lưu → nhầm lẫn)
- Upload lên **Cloudinary**, lưu URL vào entity
- Folder: `cinex/posters`, `cinex/avatars`, `cinex/snacks`

---

## QUY TRÌNH LÀM VIỆC BẮT BUỘC

### Bước 1: Trước khi code
- Đọc file task trong `/tasks/` → chỉ làm task có Status: PENDING hoặc IN_PROGRESS
- Đọc `/docs/erd.md` để hiểu quan hệ dữ liệu
- Đổi Status task sang IN_PROGRESS khi bắt đầu
- Đọc lại các file `/docs/*-explained.md` liên quan để không làm trùng hoặc sai kiến trúc

### Bước 2: Khi code — TỰ ĐỘNG HÓA KIỂM TRA
- **Tự build:** Chạy `cd /Users/vutuongan/cinex/backend && ./gradlew clean build -x test` sau khi viết code
- **Tự kiểm tra log lỗi:** Nếu build fail → đọc log → sửa → build lại cho đến khi pass
- **Tự chạy server test:** Khi cần verify runtime → `./gradlew bootRun` → đọc log startup → kiểm tra lỗi
- **Tự test API:** Khi tạo endpoint mới → dùng curl hoặc chỉ dẫn user test qua Swagger
- **Không bỏ qua lỗi:** Mỗi lỗi compile/runtime phải được xử lý, không skip
- **Không hardcode:** Giá trị cấu hình đọc từ `system_config` hoặc `application.yml`, không viết thẳng trong code

### Bước 3: Sau khi code — VIẾT TÀI LIỆU (BẮT BUỘC, KHÔNG ĐƯỢC BỎ QUA)

Sau mỗi task hoàn thành, **PHẢI** viết file `/docs/{module}-explained.md`. Đây là phần QUAN TRỌNG NHẤT vì user cần học từ code.

**Cấu trúc file docs BẮT BUỘC:**

```markdown
# Module {Tên} — Giải thích chi tiết

## 1. Tổng quan
- Module này làm gì, giải quyết bài toán gì

## 2. Danh sách files đã tạo/sửa
- Bảng: tên file | tác dụng | design pattern

## 3. Design Patterns đã áp dụng
Với MỖI pattern:
  a) Pattern tên gì, thuộc nhóm nào (Creational/Structural/Behavioral)
  b) Giải thích pattern bằng ví dụ đời thường (VD: Factory = nhà máy sản xuất)
  c) Áp dụng ở đâu trong code (file:line)
  d) Tại sao dùng pattern này (giải quyết vấn đề gì)
  e) So sánh: KHÔNG dùng pattern → code xấu thế nào (before/after)
  f) Khi nào KHÔNG nên dùng pattern này

## 4. Sơ đồ luồng xử lý
- Vẽ bằng ASCII diagram
- Ghi rõ từng bước: request đi qua đâu, gọi class nào, query gì

## 5. Khái niệm mới cần biết
- Giải thích đơn giản, VD:
  - "Optimistic Lock giống như 2 người cùng edit Google Doc — ai save trước thì được"
  - "ACID giống hợp đồng: hoặc ký hết hoặc hủy hết, không ký nửa chừng"

## 6. Annotation/API mới sử dụng
- Liệt kê từng annotation: tên, tác dụng, ví dụ
- VD: @Transactional → đảm bảo tất cả query trong method này chạy trong 1 transaction

## 7. SQL được sinh ra
- Ghi lại SQL mà JPA/Hibernate tự sinh cho các method quan trọng
- VD: findByUsername("vanan") → SELECT * FROM users WHERE username = 'vanan'

## 8. Request/Response mẫu
- Curl command mẫu
- JSON request body mẫu
- JSON response mẫu (cả success và error)

## 9. Câu hỏi tự kiểm tra
- 3-5 câu hỏi để user tự test kiến thức
- VD: "Nếu bỏ @Transactional thì điều gì xảy ra khi hold 3 ghế mà ghế thứ 3 lỗi?"
```

### Bước 4: Kết thúc task
- Tick tất cả checkbox [x] trong file task
- Đổi Status → DONE
- Move file task sang `/tasks/done/`
- Cập nhật `/docs/erd.md` nếu thêm bảng mới
- Cập nhật bảng Design Patterns trong file CLAUDE.md này nếu thêm pattern mới

---

## DESIGN PATTERNS — BẢNG TỔNG HỢP

### Đã áp dụng

| Pattern | Nhóm | Áp dụng ở đâu | File tham khảo |
|---|---|---|---|
| **BaseEntity (Inheritance)** | Structural | Tất cả entity kế thừa (id, version, storageState, audit) | `common/entity/BaseEntity.java` |
| **IdTracker (Sequence)** | Creational | Sinh code tự động cho entity | `common/entity/tracker/IdTrackerService.java` |
| **Soft Delete** | Behavioral | Xóa mềm qua storageState, không DELETE thật | BaseEntity.storageState |
| **DTO** | Structural | Tách biệt request/response với entity | `module/*/dto/` |
| **Repository** | Structural | Trừu tượng hóa truy vấn DB | `module/*/repository/` |
| **Builder** | Creational | Lombok @Builder tạo object phức tạp | ApiResponse, AuthResponse, User |
| **Filter (Chain of Resp.)** | Behavioral | JwtAuthFilter xác thực trước Controller | `security/JwtAuthFilter.java` |
| **Wrapper/Facade** | Structural | ApiResponse<T> bọc mọi response cùng format | `common/response/ApiResponse.java` |
| **Enum** | — | Role, ErrorCode, MovieStatus, ... type-safe | `module/auth/entity/Role.java` |
| **Mapper (MapStruct)** | Structural | Tự sinh code chuyển User ↔ DTO, compile-time | `module/user/mapper/UserMapper.java` |
| **Method Security** | Cross-cutting | @PreAuthorize phân quyền ADMIN method-level | `module/user/controller/UserController.java` |
| **Specification** | Behavioral | Build query WHERE động cho tất cả list API | `module/*/specification/*Specification.java` |
| **Filter DTO** | Structural | Nhận search/filter params từ FE, type-safe | `module/*/dto/*Filter.java` |
| **Factory** | Creational | PaymentProcessorFactory trả đúng processor theo method | `module/payment/processor/PaymentProcessorFactory.java` |
| **Strategy** | Behavioral | PaymentProcessor interface, mỗi cổng implement khác nhau | `module/payment/processor/PaymentProcessor.java` |
| **Observer (Events)** | Behavioral | Spring Events: payment completed → notification + email | `module/payment/service/PaymentCompletedEvent.java` |
| **State Machine** | Behavioral | Booking status flow: HOLDING → CONFIRMED → CHECKED_IN / EXPIRED | `module/booking/entity/BookingStatus.java` |
| **Scheduled Task** | — | @Scheduled dọn booking HOLDING hết hạn mỗi phút | `module/booking/service/BookingCleanupScheduler.java` |
| **Config Table** | — | Bảng system_config: cấu hình động (hold_minutes, max_seats) | `module/config/service/SystemConfigService.java` |

---

## QUY TẮC CODE CHI TIẾT

### Entity
- Tất cả entity nghiệp vụ **PHẢI** extends `BaseEntity`
- Entity nào cần code tự sinh → dùng `IdTrackerService.nextCode()` hoặc `nextCodeWithDate()`
- Xóa = soft delete (`storageState = StorageState.DELETED`), KHÔNG dùng `DELETE FROM`
- Mỗi entity mới → tạo Liquibase changelog, KHÔNG dùng `ddl-auto=update`
- Dùng `@Enumerated(EnumType.STRING)` cho enum fields (không dùng ORDINAL)
- Quan hệ `@ManyToOne` dùng `fetch = FetchType.LAZY` mặc định
- `@Column` ghi rõ `name`, `length`, `nullable` cho mọi field

### DTO & Validation
- Mỗi API endpoint có DTO riêng: `XxxRequest` (input) và `XxxResponse` (output)
- KHÔNG BAO GIỜ trả entity thẳng cho client (lộ field nhạy cảm)
- Request DTO phải có validation: `@NotBlank`, `@Email`, `@Size`, `@Min`, `@Max`, ...
- Response DTO dùng `@Builder` để dễ tạo
- Nếu list cần phân trang → trả `PageResponse<T>`
- Nếu 1 entity cần nhiều response khác nhau (list vs detail) → tạo nhiều DTO

### Service
- Mỗi public method cần `@Transactional` (hoặc `@Transactional(readOnly = true)` cho query)
- Business logic CHỈ nằm trong Service, KHÔNG nằm trong Controller hoặc Repository
- Khi có lỗi nghiệp vụ → throw `BusinessException(ErrorCode.XXX)`, KHÔNG return null
- Log quan trọng: dùng `log.info()` cho action thành công, `log.warn()` cho action đáng ngờ
- Method tên rõ ràng: `createBooking()` thay vì `process()`, `handle()` thay vì `doStuff()`

### Controller
- Chỉ làm 3 việc: nhận request → gọi service → trả `ApiResponse`
- KHÔNG chứa business logic, KHÔNG gọi repository trực tiếp
- Dùng `@Valid` cho request body validation
- Dùng Swagger annotation: `@Tag`, `@Operation` cho mỗi endpoint
- URL convention: `/api/{module}/{action}`, dùng danh từ số nhiều (`/api/movies`, `/api/bookings`)
- HTTP method đúng: GET (đọc), POST (tạo), PUT (sửa toàn bộ), PATCH (sửa 1 phần), DELETE (xóa)

### Repository
- Tên method theo convention Spring Data: `findByXxx`, `existsByXxx`, `countByXxx`
- Query phức tạp → dùng `@Query` với JPQL hoặc Specification
- Khi cần lock → dùng `@Lock(LockModeType.PESSIMISTIC_WRITE)`
- KHÔNG viết native SQL trừ khi JPQL không đáp ứng được

### Exception Handling
- Mỗi loại lỗi mới → thêm vào `ErrorCode` enum
- `BusinessException` cho lỗi nghiệp vụ (user gây ra): 4xx
- Lỗi hệ thống (bug, DB down): để `GlobalExceptionHandler` bắt → trả 500
- KHÔNG BAO GIỜ để stack trace lộ ra cho client

### Liquibase
- File đặt trong `resources/db/changelog/changes/`
- Đánh số tăng dần: `001-xxx.xml`, `002-xxx.xml`, ...
- Thêm `<include>` vào `db.changelog-master.xml`
- Có thể dùng `<insert>` để seed data mẫu (admin account, genres, ...)
- Mỗi changeset có `id` unique, `author` = "cinex"
- KHÔNG sửa changeset đã chạy → tạo changeset mới để alter

### Comment trong code
- Comment giải thích **TẠI SAO**, không giải thích **CÁI GÌ** (code tự nói cái gì)
- Khi áp dụng design pattern → comment ghi tên pattern và lý do
  ```java
  // [Strategy Pattern] Mỗi payment method có processor riêng
  // để thêm method mới không cần sửa code cũ (Open/Closed Principle)
  ```
- Khi có logic phức tạp → comment giải thích business rule
  ```java
  // Business rule: Không cho đặt quá 8 ghế/lần
  // để tránh 1 người chiếm hết ghế (scalper prevention)
  ```

---

## KIẾN THỨC CẦN GIẢI THÍCH KHI GẶP

Khi code gặp khái niệm mới, PHẢI giải thích trong docs. Danh sách khái niệm thường gặp:

### Spring Boot / Java
- `@SpringBootApplication` — auto-configuration là gì
- `@Component`, `@Service`, `@Repository`, `@Controller` — stereotype annotations
- `@Autowired` vs constructor injection — tại sao prefer constructor
- `@Transactional` — ACID, rollback, propagation
- `@Scheduled` — cron expression, fixedRate vs fixedDelay
- `@Aspect` / AOP — cross-cutting concern, pointcut, advice
- `@Value` vs `@ConfigurationProperties` — đọc config
- Bean lifecycle — singleton, prototype, request scope

### JPA / Hibernate
- Entity lifecycle: Transient → Managed → Detached → Removed
- Lazy vs Eager loading — N+1 problem
- `@Version` — Optimistic Locking
- `@Lock(PESSIMISTIC_WRITE)` — Pessimistic Locking
- `@ManyToOne`, `@OneToMany`, `@ManyToMany` — quan hệ, cascade, orphanRemoval
- First-level cache vs Second-level cache
- JPQL vs Native Query vs Specification

### Spring Security
- SecurityFilterChain — luồng filter
- Authentication vs Authorization — xác thực vs phân quyền
- `@PreAuthorize` — method-level security
- CORS — tại sao cần, cách hoạt động
- CSRF — tại sao tắt khi dùng JWT

### Design Patterns (GoF)
- **Creational:** Factory, Builder, Singleton
- **Structural:** Adapter, Facade, Decorator, DTO
- **Behavioral:** Strategy, Observer, Template Method, State, Chain of Responsibility
- **SOLID principles:** Single Responsibility, Open/Closed, Liskov, Interface Segregation, Dependency Inversion

### Database
- Index — tại sao cần, khi nào tạo, B-tree
- Transaction isolation levels — Read Uncommitted, Read Committed, Repeatable Read, Serializable
- Deadlock — là gì, cách tránh
- N+1 query problem — là gì, cách fix (JOIN FETCH, @EntityGraph)
- Database normalization — 1NF, 2NF, 3NF

### Redis
- Cache-aside pattern — đọc cache trước, miss thì đọc DB rồi ghi cache
- TTL — time to live, cache expiration
- Cache invalidation — khi nào xóa cache (update/delete entity)

### API Design
- RESTful conventions — resource naming, HTTP methods, status codes
- Pagination — offset-based vs cursor-based
- API versioning — URL vs header
- Rate limiting — tại sao cần, thuật toán Token Bucket

---

## CẤU TRÚC CODE

### Backend
```
backend/src/main/java/com/cinex/
├── common/
│   ├── entity/
│   │   ├── BaseEntity.java          # Class cha: id, version, storageState, audit
│   │   └── tracker/                 # IdTracker: sinh code tự động
│   ├── config/                      # Security, CORS, Redis, OpenAPI, JpaAuditing
│   ├── exception/                   # ErrorCode, BusinessException, GlobalExceptionHandler
│   ├── response/                    # ApiResponse<T>, PageResponse<T>
│   └── util/
├── security/                        # JWT: JwtUtil, JwtAuthFilter, CustomUserDetailsService
└── module/
    └── {tên_module}/
        ├── entity/                  # JPA entities (extends BaseEntity)
        ├── dto/                     # Request/Response DTOs
        ├── repository/              # JPA repositories
        ├── service/                 # Business logic
        ├── controller/              # REST endpoints
        └── mapper/                  # MapStruct mappers
```

### Frontend
- **Font chữ: Inter** — dùng cho toàn bộ giao diện, không dùng font khác

```
frontend/src/
├── api/axios.ts                     # HTTP client + JWT interceptor
├── features/{module}/               # Trang theo module
├── components/                      # Component dùng chung
├── hooks/                           # Custom hooks (useQuery, useMutation)
├── store/                           # Zustand stores
├── routes/                          # React Router
├── types/                           # TypeScript types
└── utils/                           # Utility functions
```

### Docs
```
docs/
├── setup.md                         # Hướng dẫn setup A-Z
├── architecture.md                  # Kiến trúc + design patterns tổng quan
├── erd.md                           # Sơ đồ ERD + chi tiết bảng
├── auth-explained.md                # Giải thích module Auth
├── movie-explained.md               # (sẽ tạo) Giải thích module Movie
├── booking-explained.md             # (sẽ tạo) Giải thích module Booking
├── payment-explained.md             # (sẽ tạo) Giải thích module Payment
└── glossary.md                      # (sẽ tạo) Từ điển thuật ngữ
```

---

## SERVER & PORTS

| Service | Host | Port | Credentials |
|---|---|---|---|
| Backend | localhost | 8088 | — |
| Frontend | localhost | 5173 | — |
| SQL Server | localhost | 1433 | sa / CineX@2026 / cinex |
| Redis | localhost | 6379 | — |

## COMMANDS

```bash
# Build BE
cd /Users/vutuongan/cinex/backend && ./gradlew clean build -x test

# Run BE
cd /Users/vutuongan/cinex/backend && ./gradlew bootRun

# Build FE
cd /Users/vutuongan/cinex/frontend && npm run build

# Run FE
cd /Users/vutuongan/cinex/frontend && npm run dev

# Docker DB
cd /Users/vutuongan/cinex && docker-compose up sqlserver redis -d

# Tạo database (lần đầu)
docker exec cinex-sqlserver-1 /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P 'CineX@2026' -C -Q "CREATE DATABASE cinex"
```

## TASK MANAGEMENT

- Task folder: `/Users/vutuongan/cinex/tasks/`
- Done folder: `/Users/vutuongan/cinex/tasks/done/`
- Template: `/Users/vutuongan/cinex/tasks/TEMPLATE.md`
- Quy tắc:
  1. Chỉ làm task PENDING/IN_PROGRESS
  2. KHÔNG làm lại task trong `done/`
  3. Khi bắt đầu → đổi Status sang IN_PROGRESS
  4. Khi xong → đổi DONE, tick [x], move sang `done/`
  5. Nếu không có task PENDING → hỏi user muốn làm gì

## GHI NHỚ QUAN TRỌNG

- **User đang học:** Giải thích mọi thứ như đang dạy, dùng ví dụ đời thường
- **Không giả định user biết:** Khi gặp thuật ngữ mới → giải thích ngay
- **So sánh before/after:** Khi dùng pattern → chỉ ra code XẤU (không dùng) vs code TỐT (có dùng)
- **Tại sao quan trọng hơn cái gì:** Giải thích WHY trước WHAT
- **Thực tế production:** Giải thích "ngoài đời thật người ta cũng làm thế này vì..."
- **Anti-patterns:** Khi thấy cách làm sai phổ biến → cảnh báo "ĐỪNG làm thế này vì..."
