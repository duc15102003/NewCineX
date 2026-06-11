# Design Patterns Catalog — Toàn bộ patterns đã áp dụng trong CineX

> File này là **catalog tổng hợp 25+ design patterns** đã áp dụng trong CineX, kèm ví dụ đời thường, vị trí trong code, trade-off và khi nào KHÔNG nên dùng.
>
> Đây là **bản đồ học tập** dành cho sinh viên: đọc xong file này sẽ biết "khi gặp bài toán X thì dùng pattern Y" và nhìn được pattern đó **đã ở chỗ nào trong source CineX**.
>
> Để xem **deep-dive về architectural patterns kèm bài học refactor** (denormalization, derived status, schema migration 2-phase, ShedLock distributed lock,...) → đọc `docs/backend/16-architectural-patterns.md`.

---

## 1. Tổng quan

CineX áp dụng **25+ design patterns** chia thành 6 nhóm:

| Nhóm | Số patterns | Mục đích |
|---|---|---|
| **Creational (GoF)** | 3 | Cách tạo object: Builder, Factory, IdTracker (Sequence) |
| **Structural (GoF)** | 7 | Cách compose object: DTO, Mapper, Repository, Facade, Composition, Decorator (implicit), Wrapper/Adapter |
| **Behavioral (GoF)** | 6 | Cách object giao tiếp: Strategy, Observer, Specification, State Machine, Chain of Responsibility (Filter), Template Method |
| **Architectural** | 10 | Cấu trúc hệ thống lớn — xem chi tiết tại file `16-architectural-patterns.md` |
| **Enterprise (POEAA + Spring)** | 6 | AOP, Method Security, Config-driven, Idempotency, Distributed Lock, Real-time |
| **Frontend** | 6 | Patterns dành cho React: Composition, Custom Hooks, useFieldArray, Server/Client state split,... |

### Cấu trúc mỗi pattern trong catalog

Mỗi mục pattern trình bày theo template:

1. **Định nghĩa ngắn** — pattern này là gì, thuộc nhóm nào
2. **Ví dụ đời thường** — analogy giúp nhớ (pizza, nhà máy, công tắc,...)
3. **Ví dụ trong CineX** — file:line cụ thể trong source
4. **Trade-off / Khi nào KHÔNG dùng** — tránh over-engineering

> **Mẹo đọc:** Đọc lướt phần 9 trước (Pattern Decision Tree) để có cái nhìn tổng thể, rồi tra cứu chi tiết khi gặp bài toán cụ thể.

---

## 2. CREATIONAL PATTERNS

> Pattern tạo object. Trả lời câu hỏi: "Làm sao tạo object một cách linh hoạt, không phụ thuộc class cụ thể?"

### 2.1 Builder Pattern (Lombok @Builder)

**Định nghĩa:** Tạo object phức tạp **từng bước**, mỗi bước chỉ chỉ định 1 field, kết thúc bằng `.build()`. Tránh constructor có 10+ tham số (telescoping constructor).

**Ví dụ đời thường:** Đặt pizza — không nói cùng lúc "pizza 18cm, đế dày, phô mai gấp đôi, không ô liu, thêm nấm, sốt cà chua, không cay" mà từng bước: chọn size → chọn đế → chọn topping → chọn sauce.

**Ví dụ CineX:**

```java
// BookingService.java khi tạo Booking
Booking booking = Booking.builder()
        .bookingCode(idTracker.nextCodeWithDate("BOOKING"))
        .user(user)
        .showtime(showtime)
        .totalAmount(totalAmount)
        .status(BookingStatus.HOLDING)
        .holdExpiresAt(LocalDateTime.now().plusMinutes(holdMinutes))
        .build();
```

**File:line:**

- `common/entity/BaseEntity.java` — @SuperBuilder cho tất cả entity
- `module/booking/entity/Booking.java` — @Builder
- `module/booking/entity/BookingSeat.java` — @Builder
- `common/response/ApiResponse.java` — `ApiResponse.success(data)` cũng dùng builder ngầm
- DTO bất kỳ có `@Builder` (UserResponse, MovieResponse, ShowtimeResponse,...)

**Trade-off:**

| Lợi | Hại |
|---|---|
| Code đọc dễ, tên field rõ ràng | Tự sinh thêm class Builder (compile time) |
| Tránh constructor 10+ tham số | Object created phải `final` field hoặc cần @Builder.Default |
| Order field tự do | Validation chỉ chạy ở build() — không catch sớm như constructor |

**Khi nào KHÔNG dùng Builder:**
- Object có **< 4 field**: dùng constructor thẳng (`new Pair<>(a, b)`)
- Object **không có** field optional: constructor đủ rõ
- Object cần validate ngay khi tạo: dùng factory method static

---

### 2.2 Factory Pattern

**Định nghĩa:** Tạo object **không gọi `new` trực tiếp**, mà uỷ thác cho 1 class chuyên trách (Factory). Factory quyết định trả về subclass nào dựa trên input.

**Ví dụ đời thường:** Nhà máy ô tô có dây chuyền chung. Khách đặt "Sedan" → ra Sedan. Đặt "SUV" → ra SUV. Khách KHÔNG cần biết quy trình lắp ráp.

**Ví dụ CineX — PaymentProcessorFactory:**

```java
// module/payment/processor/PaymentProcessorFactory.java
@Component
@RequiredArgsConstructor
public class PaymentProcessorFactory {
    // Spring tự inject Map: {"MOMO": MoMoProcessor, "CASH": CashProcessor}
    private final Map<String, PaymentProcessor> processors;

    public PaymentProcessor getProcessor(PaymentMethod method) {
        PaymentProcessor processor = processors.get(method.name());
        if (processor == null) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST, "...");
        }
        return processor;
    }
}
```

Mỗi processor được Spring đăng ký với tên: `@Component("MOMO")`, `@Component("CASH")` → Spring tự inject Map.

**File:line:**

- `module/payment/processor/PaymentProcessorFactory.java:24-37`
- `module/payment/processor/PaymentProcessor.java` (interface)
- `module/payment/processor/MoMoPaymentProcessor.java` (@Component("MOMO"))
- `module/payment/processor/CashPaymentProcessor.java` (@Component("CASH"))

**Trade-off vs gọi Strategy trực tiếp:**

- Factory **thêm 1 lớp indirection** (1 class trung gian)
- Nhưng **mở rộng dễ:** thêm processor mới → tạo class + thêm `@Component("VNPAY")` → KHÔNG sửa code cũ (Open/Closed Principle)
- Nếu dùng `if-else` trực tiếp: thêm method mới → phải sửa `PaymentService` → vi phạm O của SOLID

**Khi nào KHÔNG dùng Factory:**
- Chỉ có **1 implementation** duy nhất: dùng class thẳng
- Logic chọn impl **không bao giờ thay đổi**: hardcode if-else cho đơn giản
- Số impl **rất nhỏ và ổn định** (vd: 2 và không bao giờ tăng): if-else có thể OK

---

### 2.3 IdTracker / Sequence Pattern

**Định nghĩa:** Sinh code business-friendly dạng `BKG-251208-001` thay vì dùng `UUID` hoặc auto-increment thuần. Pattern này là **Sequence Number Generator có domain semantics**.

**Ví dụ đời thường:** Mã hoá đơn ngân hàng `INV-20260609-0042` — nhìn vào biết ngay là invoice tháng 6 ngày 9 năm 2026, hoá đơn thứ 42 trong ngày.

**Ví dụ CineX:**

```java
// common/entity/tracker/IdTrackerService.java
@Transactional
public String nextCodeWithDate(String entityType) {
    IdTracker tracker = getAndIncrement(entityType);
    String date = LocalDate.now().format(DATE_FMT);
    return String.format("%s-%s-%03d", tracker.getPrefix(), date, tracker.getCurrentValue());
}
```

Mỗi entity type có 1 row trong bảng `id_trackers`:

| entity_type | prefix | current_value |
|---|---|---|
| BOOKING | BKG | 42 |
| PAYMENT | PMT | 13 |
| USER | USR | 8 |

**File:line:**

- `common/entity/tracker/IdTrackerService.java:23-37`
- `common/entity/tracker/IdTracker.java` (entity)
- Sử dụng: `BookingService.createBooking()`, `PaymentService.create()`, `UserService.create()`,...

**Trade-off:**

| Lợi | Hại |
|---|---|
| Mã đẹp, business-friendly | Cần row lock trên id_trackers (bottleneck nếu QPS cao) |
| In ra vé/hoá đơn dễ đọc | Cần Transactional → tăng latency 1 query |
| Tránh UUID xấu xí với user | Reset counter mỗi ngày phức tạp hơn |

**Khi nào KHÔNG dùng:**
- Backend internal API không expose ra user: dùng `Long id` đủ
- QPS cao 1000+/s: dùng UUID hoặc Snowflake ID (no lock)

---

## 3. STRUCTURAL PATTERNS

> Pattern compose object. Trả lời: "Làm sao gắn các class lại để tạo cấu trúc lớn hơn?"

### 3.1 DTO (Data Transfer Object)

**Định nghĩa:** Object **chỉ chứa data** dùng để truyền giữa các tầng (Controller ↔ Service ↔ Client). Tách biệt với Entity để KHÔNG lộ field nhạy cảm.

**Ví dụ đời thường:** Đơn hàng nội bộ kho hàng (Entity) khác đơn hàng giao cho khách (DTO) — phiếu giao không có giá vốn, công thức chiết khấu nội bộ.

**Ví dụ CineX:**

- `UserResponse` KHÔNG có `passwordHash` (Entity `User` có)
- `MovieResponse` cho admin có `cost`, cho public KHÔNG có
- `BookingDetailResponse` flatten nested `Showtime.movie.title` lên thẳng `movieTitle`

**File:line:**

- Mỗi module có thư mục `dto/`: `XxxRequest` (input) và `XxxResponse` (output)
- VD: `module/movie/dto/MovieRequest.java`, `MovieResponse.java`, `MovieFilter.java`

**Quy tắc CineX (xem CLAUDE.md):**

> KHÔNG BAO GIỜ trả Entity thẳng cho client. Luôn map qua DTO.

**Khi nào KHÔNG dùng DTO:**
- API internal microservices có shared library: có thể truyền Entity thẳng (đã được agree contract)
- Project mini-tutorial < 1000 dòng: DTO sẽ làm bộn

---

### 3.2 Mapper (MapStruct compile-time)

**Định nghĩa:** Class chuyên trách **convert giữa Entity và DTO**. MapStruct sinh code Java tại compile-time (nhanh, không reflection runtime).

**Ví dụ đời thường:** Phiên dịch viên giữa tiếng Việt (Entity) và tiếng Anh (DTO). Mapper biết cách dịch field-by-field.

**Ví dụ CineX:**

```java
// module/user/mapper/UserMapper.java
@Mapper(componentModel = "spring")
public interface UserMapper {
    UserResponse toResponse(User user);  // MapStruct tự sinh impl
    List<UserResponse> toResponseList(List<User> users);
}
```

**File:line:**

- `module/user/mapper/UserMapper.java`
- `module/movie/mapper/MovieMapper.java`
- `module/booking/mapper/BookingMapper.java`
- Hầu hết modules đều có 1 mapper

**So với BeanUtils.copyProperties / ModelMapper:**

| MapStruct | ModelMapper |
|---|---|
| Compile-time → nhanh | Runtime reflection → chậm |
| Type-safe, IDE check | Lỗi mới phát hiện runtime |
| Code sinh ra đọc được, debug được | Black box, khó debug |
| Cấu hình verbose hơn | API đơn giản |

**Khi nào KHÔNG dùng Mapper:**
- Entity và DTO **gần như giống hệt** (cùng field, cùng tên): copy thủ công 5 dòng cũng OK
- Project nhỏ không có nhiều DTO

---

### 3.3 Repository (Spring Data JPA)

**Định nghĩa:** Trừu tượng hoá truy vấn database. Service KHÔNG viết SQL trực tiếp mà gọi method của Repository: `userRepository.findByEmail(...)`.

**Ví dụ đời thường:** Thư viện có thủ thư. Bạn nói "tìm sách của tác giả X" → thủ thư đi tìm. Bạn KHÔNG cần biết sách nằm kệ nào.

**Ví dụ CineX:**

```java
// module/user/repository/UserRepository.java
public interface UserRepository extends JpaRepository<User, Long>,
                                        JpaSpecificationExecutor<User> {
    Optional<User> findByEmail(String email);
    boolean existsByPhone(String phone);
}
```

Spring tự sinh impl từ method name: `findByEmail` → `SELECT * FROM users WHERE email = ?`.

**File:line:** Mỗi module có thư mục `repository/`. Tất cả extends `JpaRepository<Entity, Long>`.

**Khi nào KHÔNG dùng Spring Data Repository:**
- Query siêu phức tạp với raw SQL hint: dùng `@Query(value = "...", nativeQuery = true)` hoặc JdbcTemplate
- Cần custom logic trong query: implement custom repository interface

---

### 3.4 Facade (Service layer)

**Định nghĩa:** Một class đứng "mặt tiền" che giấu nhiều class phức tạp bên trong. Controller chỉ gọi 1 method Facade, KHÔNG cần biết bên trong có bao nhiêu Repository, Mapper, Validator.

**Ví dụ đời thường:** Tổng đài chăm sóc khách hàng. Bạn gọi 1 số → tổng đài chuyển nội bộ qua nhiều phòng ban. Bạn KHÔNG cần biết số máy lẻ.

**Ví dụ CineX — BookingService:**

```java
@Transactional
public BookingDetailResponse createBooking(BookingRequest req) {
    // Đằng sau facade: ShowtimeRepo, SeatRepo, BookingRepo,
    // BookingSeatRepo, IdTracker, PricingEngine, SystemConfig, Mapper
    // → tất cả ẩn sau 1 method
}
```

**File:line:**

- Mọi `*Service.java` trong CineX đều là Facade
- VD: `module/booking/service/BookingService.java`, `module/payment/service/PaymentService.java`

**Khi nào KHÔNG dùng:**
- Method chỉ gọi đúng 1 Repository: Facade thừa, có thể inject Repo thẳng (nhưng CineX không khuyến nghị vì phá kiến trúc)

---

### 3.5 Composition (Combo + ComboItem)

**Định nghĩa:** Entity cha chứa **danh sách entity con**. Không phải kế thừa (Inheritance), mà là "has-a" relationship.

**Ví dụ đời thường:** Combo bữa ăn gồm: 1 burger + 1 khoai chiên + 1 nước. Combo CÓ các item, không PHẢI item.

**Ví dụ CineX:**

```java
// module/combo/entity/Combo.java
@Entity
public class Combo extends BaseEntity {
    private String name;
    private BigDecimal price;

    @OneToMany(mappedBy = "combo", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ComboItem> items = new ArrayList<>();
}

// module/combo/entity/ComboItem.java
@Entity
public class ComboItem {
    @ManyToOne private Combo combo;
    @ManyToOne private Snack snack;
    private int quantity;  // metadata: bao nhiêu cái
}
```

**File:line:**

- `module/combo/entity/Combo.java` + `ComboItem.java`
- `module/booking/entity/Booking.java` chứa `List<BookingSeat>` cũng là composition

**Khi nào KHÔNG dùng:**
- Quan hệ M-N không có metadata trên cạnh: dùng `@ManyToMany` đơn giản
- Có metadata trên cạnh: BẮT BUỘC dùng composition (entity trung gian)

---

### 3.6 Decorator (implicit qua nhân multiplier)

**Định nghĩa:** "Bọc" object thêm hành vi mà KHÔNG sửa class gốc. Mỗi decorator add 1 chức năng.

**Ví dụ đời thường:** Cà phê nguyên bản. Quấn thêm caramel → "caramel coffee". Quấn thêm whipped cream → "caramel coffee with whipped cream". Mỗi lớp thêm tính năng, không sửa cà phê gốc.

**Ví dụ CineX — PricingEngine nhân chain multiplier:**

```java
// module/pricing/service/PricingEngine.java (simplified)
BigDecimal finalPrice = basePrice;
for (PricingRule rule : matchingRules) {
    finalPrice = finalPrice.multiply(rule.getMultiplier());  // mỗi rule nhân 1 hệ số
}
```

Mỗi `PricingRule` là 1 "lớp decorator" nhân vào giá. Thứ tự áp dụng có thể đảo (commutative).

**File:line:**

- `module/pricing/service/PricingEngine.java`
- `module/pricing/strategy/PricingRuleMatcher.java`

**Lưu ý:** Đây là Decorator **implicit** (qua data, không qua class wrapping). Nếu cần GoF Decorator chuẩn → dùng class inheritance/composition.

**Khi nào KHÔNG dùng:**
- Chỉ cần 1-2 hành vi thêm: subclass đủ
- Hành vi quan trọng theo thứ tự: tránh decorator vì khó tracking order

---

### 3.7 Wrapper / Adapter — ApiResponse&lt;T&gt;

**Định nghĩa:** Class `ApiResponse<T>` bọc mọi response để **format thống nhất**: luôn có `{success, code, message, data, timestamp}`.

**Ví dụ đời thường:** Phong bì thư. Bên trong có thể là thư tay, thư mời, hoá đơn,... nhưng phong bì luôn cùng kích thước, cùng vị trí ghi địa chỉ.

**Ví dụ CineX:**

```java
// common/response/ApiResponse.java
@Builder
public class ApiResponse<T> {
    private boolean success;
    private String code;       // "SUCCESS", "USER_NOT_FOUND",...
    private String message;
    private T data;            // payload thực tế (UserResponse, List<MovieResponse>,...)
    private LocalDateTime timestamp;
}
```

Mọi Controller trả `ApiResponse<T>`:

```java
@GetMapping("/{id}")
public ApiResponse<UserResponse> get(@PathVariable Long id) {
    return ApiResponse.success(userService.findById(id));
}
```

**File:line:** `common/response/ApiResponse.java`

**Khi nào KHÔNG dùng:**
- API public phải tuân chuẩn ngoài (OAuth2 spec, OpenAPI 3.0 spec strict): có thể không cần wrapper
- Endpoint trả file binary (PDF, CSV): wrapper không phù hợp

---

## 4. BEHAVIORAL PATTERNS

> Pattern object giao tiếp. Trả lời: "Object truyền message/responsibility giữa nhau thế nào?"

### 4.1 Strategy Pattern

**Định nghĩa:** Đóng gói **nhiều thuật toán tương đương** vào các class riêng (implement chung 1 interface), client chọn class nào tuỳ runtime.

**Ví dụ đời thường:** Đi từ nhà tới trường có nhiều cách: xe đạp, xe máy, ô tô, đi bộ. Mỗi cách là 1 strategy. Bạn chọn cách nào tuỳ thời tiết, gấp/không gấp.

**Ví dụ CineX — PaymentProcessor:**

```java
// module/payment/processor/PaymentProcessor.java
public interface PaymentProcessor {
    PaymentInitResponse initiate(Payment payment);
    void handleCallback(String reference, Map<String, String> params);
}

// Mỗi cổng có 1 strategy
@Component("MOMO")  class MoMoPaymentProcessor implements PaymentProcessor { ... }
@Component("CASH")  class CashPaymentProcessor implements PaymentProcessor { ... }
```

**Ví dụ CineX — PricingRuleMatcher (function table variant):**

```java
// module/pricing/strategy/PricingRuleMatcher.java:38-53
public static boolean matches(PricingRule rule, LocalDateTime t) {
    switch (rule.getRuleType()) {
        case DAY_OF_WEEK: return matchesDayOfWeek(rule, t);
        case HOUR_RANGE:  return matchesHourRange(rule, t);
        case DATE_RANGE:  return matchesDateRange(rule, t);
        case COMPOSITE:   return matchesComposite(rule, t);
        default: return false;
    }
}
```

Đây là **Strategy variant qua switch trên enum** — đơn giản hơn class hierarchy khi số strategy ít và stable.

**File:line:**

- `module/payment/processor/PaymentProcessor.java` (interface)
- `module/payment/processor/MoMoPaymentProcessor.java`, `CashPaymentProcessor.java`
- `module/pricing/strategy/PricingRuleMatcher.java:38-53`

**Khi nào dùng Strategy:**
- Có **nhiều cách làm cùng việc**, mỗi cách độc lập
- Có thể **chuyển đổi runtime** (user chọn payment method tuỳ checkout)
- Cần **mở rộng** mà không sửa code cũ (Open/Closed)

**Khi nào KHÔNG dùng:**
- Chỉ có 1-2 cách, không bao giờ thêm: if-else đủ
- Các strategy có **rất ít code khác biệt**: giải pháp parametric (truyền tham số) tốt hơn

---

### 4.2 Observer (Spring ApplicationEvent)

**Định nghĩa:** Một subject publish event, **nhiều observer** đăng ký nhận. Subject KHÔNG biết observer là ai → loose coupling.

**Ví dụ đời thường:** YouTuber đăng video → tất cả người subscribe nhận thông báo. YouTuber KHÔNG biết tên từng subscriber.

**Ví dụ CineX — PaymentCompletedEvent:**

```java
// module/payment/event/PaymentCompletedEvent.java
public class PaymentCompletedEvent {
    private final Payment payment;
}

// module/payment/service/PaymentService.java
applicationEventPublisher.publishEvent(new PaymentCompletedEvent(payment));

// 2 listener cùng lắng nghe — KHÔNG biết nhau
@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
public void onPaymentCompleted(PaymentCompletedEvent event) {
    // Listener 1: gửi email
}

@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
public void onPaymentCompleted(PaymentCompletedEvent event) {
    // Listener 2: earn loyalty points
}
```

**File:line:**

- `module/payment/event/PaymentCompletedEvent.java`
- `module/payment/listener/PaymentEventListener.java` (email + notification)
- `module/loyalty/listener/LoyaltyEventListener.java:38-52` (earn points)

**Nuance — @TransactionalEventListener(AFTER_COMMIT):**

- Chỉ trigger **SAU KHI** transaction publish event commit thành công
- Tránh case: payment fail rollback nhưng email đã gửi
- Bắt buộc dùng `Propagation.REQUIRES_NEW` nếu listener cần save DB (vì outer tx đã commit, không còn tx context)

**Khi nào dùng Observer:**
- 1 event có **nhiều side effect** không liên quan nhau (email + loyalty + analytics)
- Muốn **thêm subscriber** không sửa publisher

**Khi nào KHÔNG dùng:**
- Chỉ có **1 side effect** đơn giản: gọi thẳng method nhanh hơn, dễ trace stack
- Side effect critical (transaction bắt buộc cùng): KHÔNG dùng AFTER_COMMIT — gọi đồng bộ trong cùng tx

---

### 4.3 Specification Pattern (JPA Criteria)

**Định nghĩa:** Build query WHERE **động** từ các điều kiện (filter) theo runtime. Mỗi điều kiện là 1 `Predicate`.

**Ví dụ đời thường:** Tìm nhà trên Batdongsan: chọn quận + giá + diện tích + hướng. Mỗi filter là 1 điều kiện AND. Filter trống thì bỏ qua.

**Ví dụ CineX:**

```java
// module/movie/specification/MovieSpecification.java
public static Specification<Movie> build(MovieFilter filter) {
    return (root, query, cb) -> {
        List<Predicate> predicates = new ArrayList<>();
        if (filter.getTitle() != null) {
            predicates.add(cb.like(cb.lower(root.get("title")),
                "%" + filter.getTitle().toLowerCase() + "%"));
        }
        if (filter.getStatus() != null) {
            predicates.add(cb.equal(root.get("status"), filter.getStatus()));
        }
        if (filter.getGenreId() != null) {
            predicates.add(cb.equal(root.join("genres").get("id"), filter.getGenreId()));
        }
        return cb.and(predicates.toArray(new Predicate[0]));
    };
}
```

**File:line:** Mỗi module list-API có 1 specification:

- `module/movie/specification/MovieSpecification.java`
- `module/showtime/specification/ShowtimeSpecification.java`
- `module/booking/specification/BookingSpecification.java`
- `module/theater/specification/TheaterSpecification.java`
- `module/room/specification/RoomSpecification.java`
- `module/payment/specification/PaymentSpecification.java`
- `module/user/specification/UserSpecification.java`
- `common/audit/specification/AuditLogSpecification.java`

Chi tiết: `docs/module-guides/04-filter-specification-explained.md`.

**Khi nào KHÔNG dùng:**
- Query đơn giản 1-2 điều kiện fixed: dùng `findByXxxAndYyy()` đủ
- Query siêu phức tạp nhiều JOIN, GROUP BY phức tạp: dùng native SQL hoặc QueryDSL

---

### 4.4 State Machine — BookingStatus

**Định nghĩa:** Object có **trạng thái** và **transition rules** giữa các trạng thái. Mỗi transition có rule (ai được làm, khi nào được).

**Ví dụ đời thường:** Đèn giao thông: Đỏ → Vàng → Xanh → Vàng → Đỏ. KHÔNG được Đỏ → Xanh (skip Vàng).

**Ví dụ CineX — BookingStatus:**

```
HOLDING ──confirm──▶ CONFIRMED ──checkin──▶ CHECKED_IN
   │                     │
   │ user/scheduler      │ admin or showtime-passed
   ▼                     ▼
EXPIRED              NO_SHOW / CANCELLED (refund)
```

| From | To | Ai trigger | Điều kiện |
|---|---|---|---|
| HOLDING | CONFIRMED | PaymentService (auto) | Payment success |
| HOLDING | EXPIRED | BookingCleanupScheduler | hold_expires_at < now |
| HOLDING | CANCELLED | User | Trước khi pay |
| CONFIRMED | CHECKED_IN | Admin/QR scan | Showtime đang diễn ra |
| CONFIRMED | NO_SHOW | NoShowScheduler | Showtime đã kết thúc + chưa check-in |
| CONFIRMED | CANCELLED | Admin | Refund flow |

**File:line:**

- `module/booking/entity/BookingStatus.java` (enum)
- `module/booking/service/BookingService.java` — validate transition
- `module/booking/service/BookingCleanupScheduler.java` — HOLDING → EXPIRED
- `module/booking/service/NoShowScheduler.java` — CONFIRMED → NO_SHOW

Chi tiết: `docs/module-guides/09-booking-explained.md`.

**Khi nào KHÔNG dùng:**
- Object có **< 3 state**: if-else đủ
- Transitions không có rule: không phải state machine, chỉ là enum field thông thường

---

### 4.5 Chain of Responsibility — Filter Chain

**Định nghĩa:** Request đi qua **chuỗi handler**, mỗi handler có thể xử lý hoặc chuyển tiếp. Spring Security Filter Chain là điển hình.

**Ví dụ đời thường:** Đi qua cổng sân bay: check vé → check passport → check hành lý → check kim loại. Mỗi cửa 1 nhiệm vụ. Failed bất kỳ cửa nào → block.

**Ví dụ CineX — JwtAuthFilter:**

```java
// security/JwtAuthFilter.java
public class JwtAuthFilter extends OncePerRequestFilter {
    protected void doFilterInternal(req, res, chain) {
        String token = extractToken(req);
        if (token != null && jwtUtil.validate(token)) {
            // set SecurityContext
        }
        chain.doFilter(req, res);  // pass to next filter
    }
}
```

Filter chain Spring:

```
Request → CORS → JwtAuthFilter → AuthorizationFilter → Controller
```

**File:line:**

- `security/JwtAuthFilter.java`
- `common/config/SecurityConfig.java` — `.addFilterBefore(jwtAuthFilter, ...)`

**Khi nào KHÔNG dùng:**
- Chỉ có 1-2 bước check: gọi thẳng method
- Logic không có "pass through" nature: chỉ là method chain thường

---

### 4.6 Template Method — BaseEntity hook

**Định nghĩa:** Class cha định nghĩa **khung xương** thuật toán. Class con KHÔNG override toàn bộ, chỉ override **hook method** cụ thể.

**Ví dụ đời thường:** Công thức làm bánh chung (trộn bột → nướng → để nguội → trang trí). Mỗi loại bánh chỉ thay đổi bước "trang trí" — các bước khác y nguyên.

**Ví dụ CineX — BaseEntity @PrePersist/@PreUpdate:**

```java
// common/entity/BaseEntity.java
@MappedSuperclass
public abstract class BaseEntity {
    @CreatedDate private LocalDateTime createdAt;
    @LastModifiedDate private LocalDateTime modifiedAt;
    @CreatedBy private String createdBy;
    @LastModifiedBy private String modifiedBy;

    @PrePersist
    protected void onCreate() {
        if (storageState == null) storageState = StorageState.ACTIVE;
    }
}
```

Hibernate tự gọi `@PrePersist` trước khi INSERT. Subclass KHÔNG cần biết — chỉ kế thừa.

**File:line:** `common/entity/BaseEntity.java`

**Khi nào KHÔNG dùng:**
- Logic ở subclass khác nhau **hoàn toàn**: dùng Strategy thay vì Template Method
- Khung xương không stable: dễ thành God Class theo thời gian

---

## 5. ARCHITECTURAL PATTERNS

> Đây là phần **summary**. Deep-dive đầy đủ với bài học refactor: xem `docs/backend/16-architectural-patterns.md`.

### 5.1 Layered Architecture

```
Controller → Service → Repository → Database
```

- Controller: KHÔNG business logic, KHÔNG inject Repository
- Service: chứa business logic, @Transactional
- Repository: chỉ access data, không có biz rule

**File:line:** Toàn bộ modules CineX.

### 5.2 Multi-Branch Lite — Theater

Theater là multi-tenant rút gọn: 1 codebase, 1 database, nhưng phân chia data theo `theater_id`. Mỗi theater có rooms riêng, showtimes riêng.

**File:line:**

- `module/theater/entity/Theater.java`
- `docs/module-guides/15-theater-explained.md`

### 5.3 CQRS-lite — Loyalty

Loyalty tách Service **command** (LoyaltyService — earn/spend) khỏi Service **query** (LoyaltyQueryService — lấy history).

**File:line:**

- `module/loyalty/service/LoyaltyService.java` (write)
- `module/loyalty/service/LoyaltyQueryService.java` (read)
- `docs/module-guides/17-loyalty-explained.md`

### 5.4 Event-driven — Spring Events

Xem mục 4.2 Observer. CineX dùng `ApplicationEventPublisher` + `@TransactionalEventListener` cho:

- PaymentCompletedEvent → email + loyalty
- (Sẵn sàng cho) BookingCancelledEvent, ShowtimeUpdatedEvent,...

### 5.5 Cache-aside — Caffeine + @Cacheable

Pattern: đọc cache trước, miss thì query DB → ghi cache. Spring `@Cacheable` + provider Caffeine.

**File:line:**

- `module/statistics/service/StatisticsService.java:47-105` — cache 60s TTL
- `module/pricing/service/PricingEngine.java` — cache rule list
- `security/UserDetailsCacheService.java` — cache UserDetails

### 5.6 Soft Delete — StorageState

```java
public enum StorageState { ACTIVE, ARCHIVED }
```

Xoá = `storageState = ARCHIVED`, KHÔNG `DELETE FROM`. Tất cả query mặc định filter `WHERE storageState = 'ACTIVE'`.

**File:line:** `common/entity/StorageState.java`, BaseEntity.

### 5.7 2-Phase Migration — MovieRun, Theater

Khi rename/restructure entity:

- Phase 1: Thêm cột/bảng mới song song, copy data, code dual-write
- Phase 2: Switch reads sang mới, xoá cột cũ

**File:line:** `docs/backend/16-architectural-patterns.md` section 7-8.

### 5.8 Append-only Log — loyalty_transactions

Bảng `loyalty_transactions` **KHÔNG bao giờ UPDATE/DELETE**, chỉ INSERT. Số dư = SUM(amount).

**File:line:**

- `module/loyalty/entity/LoyaltyTransaction.java`
- `module/loyalty/repository/LoyaltyTransactionRepository.java`

### 5.9 Snapshot vs Live Reference

| Snapshot | Live Reference |
|---|---|
| `BookingSeat.price` (copy giá lúc đặt) | `Movie.title` (luôn live qua FK) |
| `Showtime.endTime` (computed at create) | `Showtime.movieRun.movie` (FK trace) |

Snapshot khi cần **immutable historical record**. Live khi cần **always-fresh data**.

**File:line:** `docs/backend/16-architectural-patterns.md` section 4-5.

### 5.10 Optimistic Lock — @Version

```java
@Version
private Long version;  // BaseEntity field
```

Hibernate tự generate: `UPDATE ... WHERE id = ? AND version = ?`. Nếu version đã thay đổi (user khác update song song) → `OptimisticLockException`.

**File:line:** `common/entity/BaseEntity.java`

---

## 6. ENTERPRISE PATTERNS (POEAA + Spring)

### 6.1 AOP — @Auditable Annotation

**Định nghĩa:** Cross-cutting concern (log, security, transaction) tách ra **Aspect**, áp dụng vào method qua annotation.

**Ví dụ CineX:**

```java
// common/audit/Auditable.java
@Retention(RUNTIME) @Target(METHOD)
public @interface Auditable {
    String action();      // "UPDATE_USER_ROLE"
    String entityType();  // "User"
}

// Sử dụng
@Auditable(action = "UPDATE_USER_ROLE", entityType = "User")
public UserProfileResponse updateRole(Long userId, UpdateRoleRequest req) { ... }

// common/audit/aspect/AuditableAspect.java tự intercept:
// - Lấy username + IP + user-agent từ request
// - Trích entityId từ args
// - Serialize input thành JSON
// - Lưu vào audit_log
```

**File:line:**

- `common/audit/Auditable.java`
- `common/audit/aspect/AuditableAspect.java`
- `common/audit/service/AuditLogV2Service.java`

**Lợi ích:** Không phải viết `auditLog.log(...)` ở mọi method admin. Tách hẳn cross-cutting code.

### 6.2 Method Security — @PreAuthorize

**Định nghĩa:** Phân quyền **method-level** bằng annotation, KHÔNG cần if-else `if (user.role != ADMIN)`.

**Ví dụ CineX:**

```java
@PreAuthorize("hasRole('ADMIN')")
@PostMapping("/users")
public ApiResponse<UserResponse> create(@RequestBody UserCreateRequest req) {
    return ApiResponse.success(userService.create(req));
}
```

Spring Security parse expression, check role trước khi vào method.

**File:line:**

- `common/config/SecurityConfig.java` — `@EnableMethodSecurity`
- Controllers admin: `@PreAuthorize("hasRole('ADMIN')")`

### 6.3 Config-driven Business Rules — system_config + PricingRule

**Định nghĩa:** Business rule **lưu trong DB** thay vì hardcode trong code. Admin sửa qua UI → effect ngay.

**Ví dụ CineX:**

| Config key | Giá trị | Tác dụng |
|---|---|---|
| `booking.hold_minutes` | 5 | Giữ ghế 5 phút |
| `booking.max_seats_per_user` | 8 | Mỗi user đặt tối đa 8 ghế/lần |
| `payment.refund_window_hours` | 24 | Được refund trong 24h sau khi đặt |

PricingRule cũng data-driven: admin tạo rule "thứ 7 chủ nhật +20%" qua UI → áp dụng ngay.

**File:line:**

- `module/config/entity/SystemConfig.java`
- `module/config/service/SystemConfigService.java`
- `module/pricing/entity/PricingRule.java`

### 6.4 Idempotency

**Định nghĩa:** Method gọi **nhiều lần với cùng input** cho ra **cùng kết quả** (không double-execute side effect).

**Ví dụ CineX:**

```java
// LoyaltyService.earnFromBooking — check trước khi earn
public int earnFromBooking(Booking booking) {
    if (loyaltyTransactionRepo.existsByBookingAndType(booking, EARN)) {
        log.warn("Already earned for booking {}", booking.getBookingCode());
        return 0;  // idempotent: trả 0 thay vì throw
    }
    // ... earn logic
}

// PaymentService.handleCallback — check status đã processed
public void handleCallback(...) {
    if (payment.getStatus() == COMPLETED) {
        log.info("Payment {} already completed, skip", payment.getId());
        return;  // idempotent: callback từ gateway có thể gửi 2 lần
    }
    // ... process
}
```

**File:line:**

- `module/loyalty/service/LoyaltyService.java`
- `module/payment/service/PaymentService.java#handleCallback`

**Tại sao quan trọng:** Network retry, gateway resend webhook → tránh **earn double, charge double**.

### 6.5 Distributed Lock — ShedLock

**Định nghĩa:** Khi chạy **multi-instance** backend (HA), 1 cron job chỉ được chạy bởi đúng 1 instance. ShedLock acquire lock qua DB row.

**Ví dụ CineX:**

```java
@Scheduled(cron = "0 0 3 * * *")  // 3h sáng
@SchedulerLock(name = "cleanupTokens", lockAtLeastFor = "PT1M", lockAtMostFor = "PT15M")
public void cleanupExpiredTokens() {
    refreshTokenRepo.deleteExpired();
}
```

`lockAtLeastFor` = giữ lock tối thiểu 1 phút (tránh job chạy 2 lần liên tiếp nếu hoàn thành nhanh).
`lockAtMostFor` = release lock sau 15 phút (tránh deadlock nếu instance crash).

**File:line:**

- `module/booking/service/BookingCleanupScheduler.java:33-34`
- `module/booking/service/NoShowScheduler.java:48-49`
- `module/movie/service/MovieRunStatusScheduler.java:58-59`
- `module/notification/service/NotificationCleanupScheduler.java:51-52`
- `module/auth/service/CleanupTokenScheduler.java:61-62`

### 6.6 Real-time WebSocket — STOMP

**Định nghĩa:** Server push update tới client qua WebSocket. Client KHÔNG cần polling.

**Ví dụ CineX:**

- User A chọn ghế A1 → broadcast `/topic/seats/{showtimeId}` → User B đang xem cùng showtime thấy A1 chuyển màu "đang giữ"
- Real-time seat status, không cần refresh

**File:line:**

- `common/config/WebSocketConfig.java`
- `module/booking/service/BookingService.java` — `messagingTemplate.convertAndSend(...)`
- Chi tiết: `docs/backend/10-websocket.md`

---

## 7. FRONTEND PATTERNS

### 7.1 Component Composition — shadcn/ui

**Định nghĩa:** Không import từ npm package, mà **copy source** của component vào project, chỉnh sửa theo nhu cầu.

**Ví dụ CineX:**

- `frontend/src/components/ui/button.tsx` — copy từ shadcn, custom với token gold #ffc107
- Input, Select, Dialog, Table,... cùng pattern

**Lợi ích:** Toàn quyền tuỳ chỉnh, không phụ thuộc lib upgrade.

### 7.2 Custom Hooks — useAdmin*.ts

**Định nghĩa:** Tách logic data fetching ra hook tái sử dụng.

```typescript
// hooks/useAdminMovies.ts
export function useAdminMovies(filter: MovieFilter) {
  return useQuery({
    queryKey: ['admin-movies', filter],
    queryFn: () => api.get('/api/movies', { params: filter }),
  });
}

export function useCreateMovie() {
  return useMutation({ mutationFn: (data) => api.post('/api/movies', data) });
}
```

**File:line:**

- `hooks/useAdminMovies.ts`
- `hooks/useAdminShowtimes.ts`
- `hooks/useAdminTheaters.ts`
- `hooks/useAdminCombos.ts`
- `hooks/useAdminPricingRules.ts`
- Barrel: `hooks/useAdmin.ts` re-export tất cả

### 7.3 useFieldArray — Combo Items Dynamic List

**Định nghĩa:** React Hook Form's `useFieldArray` cho phép quản lý **danh sách field động** (add/remove items).

**Ví dụ CineX — Combo Dialog:**

```typescript
const { fields, append, remove } = useFieldArray({
  control,
  name: 'items',  // [{snackId, quantity}, ...]
});

// User click "Thêm item" → append({snackId: null, quantity: 1})
// User click X bên row → remove(index)
```

### 7.4 Server State vs Client State

| Server State (TanStack Query) | Client State (Zustand) |
|---|---|
| Data fetch từ API | UI state (sidebar open, dialog open) |
| Cache theo queryKey | Persist qua localStorage |
| Auto refetch on focus | Auth user, theme |
| Background sync | Form draft tạm |

**File:line:**

- `hooks/use*.ts` (TanStack Query)
- `store/authStore.ts`, `store/uiStore.ts` (Zustand)

### 7.5 Lazy Loading Routes — React.lazy

```typescript
const AdminMovies = React.lazy(() => import('./features/admin/movies'));
const AdminShowtimes = React.lazy(() => import('./features/admin/showtimes'));
```

Chunk split theo route → first page load nhỏ, các page khác load on-demand.

### 7.6 Subcomponent for Lazy Hook — TheaterPickerModal

Khi 1 modal cần data nặng (`useTheaterOptions`), tách thành subcomponent **chỉ mount khi modal mở** → hook chỉ chạy khi cần.

```typescript
{open && <TheaterPickerContent ... />}  // hook bên trong chỉ chạy khi open
```

Tránh: nếu render `useTheaterOptions` ở parent → fetch ngay từ đầu, lãng phí.

---

## 8. Anti-patterns CineX đã TRÁNH

### 8.1 Service Locator (vs Dependency Injection)

**Sai:**
```java
SecurityService sec = ApplicationContextHolder.getBean(SecurityService.class);
```

**Đúng:**
```java
@RequiredArgsConstructor
public class UserController {
    private final SecurityService securityService;  // constructor inject
}
```

Service Locator giấu dependency, khó test. DI bộc lộ rõ.

### 8.2 God Service / God Controller

**Sai:** `MainService` 5000 dòng làm mọi việc.

**Đúng:** Mỗi module 1 service: `BookingService`, `PaymentService`, `MovieService`,...

### 8.3 Anemic Domain Model

**Sai:** Entity chỉ có getter/setter, mọi logic ở Service → Entity không phải Object thực thụ.

**Đúng (CineX):** Entity có một số method nghiệp vụ đơn giản (vd `BaseEntity.isArchived()`, `Showtime.hasEnded()`).

> Lưu ý: CineX vẫn nghiêng về Service-heavy (anemic-ish) vì là project học tập, nhưng KHÔNG bị tệ vì có DTO + Mapper rõ ràng.

### 8.4 Catch Exception Generic

**Sai:**
```java
try { ... } catch (Exception e) { throw new BusinessException("Error"); }
```
→ Mất hẳn nguyên nhân gốc.

**Đúng:**
```java
try { ... }
catch (DataIntegrityViolationException e) { throw new BusinessException(SEAT_CONFLICT); }
catch (OptimisticLockException e) { throw new BusinessException(CONCURRENT_UPDATE); }
```

### 8.5 Hard-coded Business Rule

**Sai:**
```java
booking.setHoldExpiresAt(now.plusMinutes(5));  // 5 hardcoded
```

**Đúng:**
```java
int holdMinutes = systemConfig.getInt("booking.hold_minutes");
booking.setHoldExpiresAt(now.plusMinutes(holdMinutes));
```

### 8.6 Bidirectional JPA mọi nơi

**Sai (overkill):** Mọi `@ManyToOne` đều có `@OneToMany` ngược lại.

**Đúng (CineX):** Chỉ bidirectional khi thực sự cần navigate cả 2 chiều. Ưu tiên unidirectional → ít risk LazyInitializationException + cascade bug.

### 8.7 Long Parameter List

**Sai:**
```java
public Booking createBooking(Long userId, Long showtimeId, List<Long> seatIds,
    String voucherCode, Integer loyaltyPoints, String note, Boolean isGift,
    String giftReceiverEmail, ...) { ... }
```

**Đúng:**
```java
public Booking createBooking(BookingRequest request) { ... }  // DTO bọc tất cả
```

---

## 9. Pattern Decision Tree — Khi nào dùng pattern nào?

```
Bài toán bạn đang gặp:
│
├─▶ "Có nhiều cách làm cùng việc, có thể thay đổi runtime"
│   → Strategy Pattern (PaymentProcessor, PricingRuleMatcher)
│
├─▶ "Có nhiều subscriber phản ứng với 1 event"
│   → Observer (Spring ApplicationEvent)
│   → Lưu ý AFTER_COMMIT nếu listener cần persist
│
├─▶ "Cần query động theo filter từ FE"
│   → Specification (JPA Criteria)
│
├─▶ "1 entity có nhiều child với metadata trên cạnh"
│   → Composition (Combo + ComboItem có quantity)
│
├─▶ "Object có >4 field, nhiều field optional"
│   → Builder (Lombok @Builder)
│
├─▶ "Cần audit log cho mọi action admin quan trọng"
│   → AOP + @Auditable annotation
│
├─▶ "Cần phân quyền method admin-only"
│   → Method Security (@PreAuthorize)
│
├─▶ "Business rule có thể thay đổi không cần redeploy"
│   → Config-driven (system_config table)
│
├─▶ "Cron job chạy trên multi-instance HA"
│   → Distributed Lock (@SchedulerLock)
│
├─▶ "Cần tạo object subtype dựa vào input"
│   → Factory Pattern
│
├─▶ "Object có nhiều state, transition có rule"
│   → State Machine (BookingStatus)
│
├─▶ "Cần cache để tránh query DB nhiều"
│   → Cache-aside (@Cacheable + Caffeine)
│
├─▶ "Webhook/callback có thể gọi 2 lần"
│   → Idempotency (check exists trước)
│
├─▶ "Cần push real-time tới browser"
│   → WebSocket STOMP (/topic/...)
│
├─▶ "Cần snapshot dữ liệu lúc giao dịch (giá lúc đặt)"
│   → Snapshot (copy value vào field riêng)
│
├─▶ "2 user cùng update 1 record"
│   → Optimistic Lock (@Version)
│
├─▶ "Xoá nhưng cần audit lại"
│   → Soft Delete (StorageState.ARCHIVED)
│
└─▶ "Đổi schema lớn không downtime"
    → 2-Phase Migration (xem 16-architectural-patterns.md)
```

---

## 10. References

### Sách kinh điển

- **GoF Design Patterns** — Gang of Four, "Design Patterns: Elements of Reusable Object-Oriented Software" (Strategy, Observer, Factory, Builder,...)
- **POEAA** — Martin Fowler, "Patterns of Enterprise Application Architecture" (Repository, Service Layer, DTO, Unit of Work,...)
- **DDD** — Eric Evans, "Domain-Driven Design" (Aggregate, Repository, Specification,...)
- **Refactoring** — Martin Fowler

### Spring docs

- Spring Framework Reference: https://docs.spring.io/spring-framework/reference/
- Spring Data JPA: https://docs.spring.io/spring-data/jpa/reference/
- Spring Security: https://docs.spring.io/spring-security/reference/

### Docs CineX liên quan

- `docs/backend/16-architectural-patterns.md` — **Deep-dive 9 architectural patterns** với bài học refactor (denormalization, derived status, 2-phase migration, ShedLock, snapshot vs live, soft delete, append-only log, optimistic lock, idempotency)
- `docs/module-guides/04-filter-specification-explained.md` — Specification chi tiết
- `docs/module-guides/09-booking-explained.md` — State Machine BookingStatus
- `docs/module-guides/10-payment-explained.md` — Strategy (PaymentProcessor) + Factory
- `docs/module-guides/15-theater-explained.md` — Multi-Branch Lite
- `docs/module-guides/16-pricing-explained.md` — Strategy (PricingRuleMatcher) + Cache-aside
- `docs/module-guides/17-loyalty-explained.md` — Observer + CQRS-lite + Append-only Log
- `docs/module-guides/18-combo-explained.md` — Composition
- `docs/backend/10-websocket.md` — Real-time STOMP

### Cheat-sheet 1 dòng cho từng pattern

| Pattern | One-liner |
|---|---|
| Builder | "Tạo object phức tạp từng bước, kết thúc .build()" |
| Factory | "Class chuyên trả về subclass đúng theo input" |
| Strategy | "Nhiều thuật toán tương đương, chọn runtime" |
| Observer | "Publish event, nhiều listener tự đăng ký" |
| Specification | "Build query WHERE động từ filter" |
| State Machine | "Object có state + transition rules" |
| Composition | "Entity cha chứa list entity con có metadata" |
| AOP | "Cross-cutting concern qua annotation + aspect" |
| Cache-aside | "Đọc cache trước, miss thì query + ghi cache" |
| Idempotency | "Gọi nhiều lần cùng input cho cùng kết quả" |
| Optimistic Lock | "@Version → UPDATE ... WHERE id=? AND version=?" |
| Distributed Lock | "@SchedulerLock → 1 instance chạy duy nhất" |
| Soft Delete | "StorageState=ARCHIVED thay vì DELETE" |
| Snapshot | "Copy value lúc giao dịch để immutable" |
| 2-Phase Migration | "Add new song song → switch reads → drop old" |

---

> **Lời kết:** Đừng cố dùng nhiều pattern. **Pattern là công cụ giải quyết bài toán cụ thể**, không phải mục tiêu. CineX bắt đầu với chỉ Layered + DTO + Repository (4 pattern), pattern khác **chỉ thêm khi gặp bài toán phù hợp**. Code đơn giản tốt hơn code đúng pattern nhưng over-engineering.
>
> Khi gặp 1 bài toán mới, hãy hỏi: "Mình thực sự CẦN pattern này hay đang complex hoá?" → Nếu giải pháp đơn giản (if-else, switch, gọi method thẳng) **đủ rõ ràng + dễ test** → không cần pattern.
