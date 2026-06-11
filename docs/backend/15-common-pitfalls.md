# Backend Pitfalls — Top 21 bug Spring Boot phổ biến

> File này gom các bug "vô hình" mà mọi dev Spring đều gặp khi build dự án CineX-style. Mỗi bug đều có code reproduce + cơ chế gốc + cách fix. Đọc 1 lần, tránh được 80% pain points.

---

## 🎓 PHẦN 0 — 5 khái niệm nền tảng PHẢI hiểu trước (đọc trước khi xem 21 bug)

Không hiểu 5 khái niệm này, bạn đọc bug bên dưới sẽ chỉ thuộc lòng "fix kiểu này" mà không hiểu WHY. Mỗi khái niệm có ví dụ đời thường + cơ chế hoạt động trong Spring.

### 0.1 Proxy Pattern — Tại sao `@Transactional` cần proxy?

**Ví dụ đời thường:** Bạn (target bean) muốn xin nghỉ phép, nhưng thay vì gọi thẳng Giám đốc, bạn phải đi qua thư ký (proxy). Thư ký ghi log "Anh A xin nghỉ", check quyền, rồi mới đưa giấy vào phòng Giám đốc. Mọi việc xin nghỉ đều đi qua thư ký → log + check quyền luôn được thực hiện.

**Spring proxy:**
```
External caller -> [Spring Proxy] -> Target bean (method gốc)
                       │
                       ├─ Before: openTransaction()
                       ├─ Invoke target method
                       └─ After: commit() / rollback()
```

Spring tạo proxy bằng 2 cách:
- **JDK Dynamic Proxy** (nếu class implement interface): tạo class mới implement cùng interface, mỗi method gọi tới target.
- **CGLIB** (nếu class không có interface): subclass target bằng bytecode manipulation.

**Hệ quả nguy hiểm — Self-Invocation (xem bug #1):**
```java
class A {
    @Transactional
    void m1() {}

    void m2() {
        this.m1();  // ❌ this = target, KHÔNG đi qua proxy → @Transactional vô hiệu
    }
}
```

**Khi nào proxy không tạo được?** Final class, final method, private method, static method — không subclass được → AOP không hoạt động.

📚 **Đọc thêm:** [glossary.md#p-q](../glossary.md#p-q) (Proxy), [backend/04-spring-features.md](04-spring-features.md) (AOP).

---

### 0.2 Reflection — Cơ chế "magic" của Spring/Hibernate/Jackson

**Ví dụ đời thường:** Bạn đưa cho Spring 1 hộp đen (Java class), Spring KHÔNG biết bên trong có gì. Reflection cho Spring khả năng "mở hộp ra, đọc nhãn từng đồ vật, tự gọi các method, sửa field" lúc runtime.

```java
Class<?> clazz = User.class;
// Đọc nhãn: tất cả annotation
Annotation[] annotations = clazz.getAnnotations();
// Tìm method có @PostConstruct
for (Method method : clazz.getDeclaredMethods()) {
    if (method.isAnnotationPresent(PostConstruct.class)) {
        method.invoke(userInstance);  // Gọi method qua reflection
    }
}
// Đọc/sửa field private (bypass encapsulation!)
Field passwordField = clazz.getDeclaredField("password");
passwordField.setAccessible(true);
passwordField.set(userInstance, "new-value");
```

**Spring dùng reflection cho:**
- Scan `@Component`, `@Service`, `@Repository` → tạo bean
- Inject `@Autowired` field/constructor
- Activate `@Transactional`, `@PreAuthorize`, `@PostConstruct`
- Jackson deserialize JSON → POJO

**Nhược điểm:**
- **Chậm hơn** code thường ~10-100 lần (vì JVM optimize kém)
- **Bypass type safety** ở compile-time
- **Bypass encapsulation** (đọc/sửa field private)

**Khi nào tránh dùng reflection:**
- Code business logic — luôn dùng method gọi trực tiếp
- Inner loop performance-critical — cache `Method` object thay vì lookup mỗi lần

📚 **Đọc thêm:** [glossary.md#r-s](../glossary.md#r-s) (Reflection).

---

### 0.3 Spring Bean Lifecycle — Từ khi tạo đến khi destroy

**Ví dụ đời thường:** Một nhân viên mới vào công ty (Bean được tạo) phải:
1. Tuyển dụng (instantiation)
2. Onboarding — nhận dependency (DI)
3. Đào tạo — chạy `@PostConstruct` (init)
4. Làm việc bình thường (sẵn sàng nhận request)
5. Nghỉ việc — chạy `@PreDestroy` (cleanup, đóng connection, flush log)

**Spring chi tiết:**
```
1. Bean Instantiation (new ClassName())
   ↓
2. Populate Properties (set field qua DI)
   ↓
3. BeanNameAware.setBeanName()
   ↓
4. BeanFactoryAware.setBeanFactory()
   ↓
5. ApplicationContextAware.setApplicationContext()
   ↓
6. @PostConstruct (init method) ← ⚠️ Bug #21 ở đây
   ↓
7. InitializingBean.afterPropertiesSet()
   ↓
8. Custom init-method
   ↓
9. Bean SẴN SÀNG nhận request
   ↓
10. (khi app shutdown)
    @PreDestroy
    ↓
11. DisposableBean.destroy()
    ↓
12. Custom destroy-method
```

**Lý do quan trọng:** `@PostConstruct` chạy TRƯỚC khi proxy hoàn thiện → nếu method `@PostConstruct` gọi method `@Transactional` của chính bean → annotation không hoạt động (xem bug #21).

📚 **Đọc thêm:** [backend/01-spring-boot-basics.md](01-spring-boot-basics.md) (Bean), [glossary.md#i](../glossary.md#i) (IoC).

---

### 0.4 Lazy Loading & Hibernate Session — Cơ chế của LazyInitializationException

**Ví dụ đời thường:** Bạn vào thư viện (Session opened), mượn 1 cuốn sách (entity load) với phần "danh sách tác giả" để trống (LAZY). Bạn ra khỏi thư viện (Session closed). Trên đường về, bạn lật xem danh sách tác giả → cuốn sách không tự lấy được từ thư viện (đã đóng cửa) → exception.

**Cơ chế chi tiết:**

```java
@Entity
public class Movie {
    @ManyToOne(fetch = LAZY)
    private Director director;  // ← LAZY = không load ngay
}

// Service:
@Transactional  // ← Session open
public Movie findMovie(Long id) {
    return movieRepo.findById(id).orElseThrow();
    // Lúc này: movie.director = HibernateProxy (chưa load)
}
// ← Khi method exit: Session CLOSED

// Controller:
@GetMapping("/{id}")
public Movie getMovie(@PathVariable Long id) {
    Movie m = movieService.findMovie(id);
    // Jackson serialize JSON → gọi m.getDirector().getName()
    // HibernateProxy cố lookup DB → Session đã đóng → LazyInitializationException ❌
}
```

**3 cách fix:**

1. **DTO projection trong `@Transactional`** ✅ Best practice
   ```java
   @Transactional
   public MovieResponse findMovie(Long id) {
       Movie m = movieRepo.findById(id).orElseThrow();
       return MovieResponse.builder()
           .title(m.getTitle())
           .directorName(m.getDirector().getName())  // Load LAZY trong session
           .build();
   }
   ```

2. **JOIN FETCH** (load eager 1 lần cụ thể)
   ```java
   @Query("SELECT m FROM Movie m JOIN FETCH m.director WHERE m.id = :id")
   Optional<Movie> findByIdWithDirector(Long id);
   ```

3. **`@EntityGraph`** (declarative)
   ```java
   @EntityGraph(attributePaths = {"director", "genres"})
   Optional<Movie> findById(Long id);
   ```

❌ **TRÁNH** Open Session In View (OSIV) — kéo dài session ra controller. Spring Boot bật mặc định `spring.jpa.open-in-view=true` nhưng nên TẮT vì che giấu N+1 và lazy issues.

📚 **Đọc thêm:** [backend/02-jpa-hibernate.md](02-jpa-hibernate.md) (JPA), [glossary.md#l-m](../glossary.md#l-m) (Lazy Loading).

---

### 0.5 Transaction & Propagation — ACID trong Spring

**Ví dụ đời thường:** Chuyển khoản 100k từ A sang B = 2 thao tác:
1. Trừ 100k tài khoản A
2. Cộng 100k tài khoản B

Bước 1 xong, mạng đứt ở bước 2 → A mất 100k, B không nhận được → tan rã. **Transaction** đảm bảo: hoặc cả 2 thành công, hoặc cả 2 rollback.

**Spring transaction qua `@Transactional`:**
```java
@Transactional(
    propagation = Propagation.REQUIRED,   // ← Default: dùng tx hiện tại, hoặc tạo mới nếu chưa có
    isolation = Isolation.READ_COMMITTED, // ← Mức cô lập
    timeout = 30,                          // ← Timeout 30s
    rollbackFor = Exception.class          // ← Rollback cho mọi exception (default chỉ RuntimeException)
)
public void transferMoney(Long fromId, Long toId, BigDecimal amount) {
    accountRepo.subtractBalance(fromId, amount);  // Bước 1
    accountRepo.addBalance(toId, amount);          // Bước 2 → nếu fail, bước 1 rollback
}
```

**7 mức Propagation — Khi nào dùng cái nào?**

| Propagation | Hành vi | Khi nào dùng |
|---|---|---|
| **REQUIRED** (default) | Dùng tx hiện tại, không có thì tạo mới | 99% trường hợp |
| **REQUIRES_NEW** | Luôn tạo tx MỚI, suspend tx cha | Audit log (phải commit dù business fail) |
| **NESTED** | Savepoint trong tx cha | Hiếm dùng |
| **SUPPORTS** | Có tx thì dùng, không có thì không | Method đọc read-only |
| **NOT_SUPPORTED** | Không cần tx, suspend tx cha | Long-running không cần lock |
| **MANDATORY** | BẮT BUỘC phải có tx cha (không có → throw) | Method nội bộ, defensive |
| **NEVER** | KHÔNG được có tx cha (có → throw) | Hiếm dùng |

**4 mức Isolation:**

| Isolation | Đảm bảo | Hiệu năng |
|---|---|---|
| **READ_UNCOMMITTED** | Không đảm bảo | Nhanh nhất, nhưng dirty read |
| **READ_COMMITTED** (default SQL Server) | Không đọc dirty data | Có phantom + non-repeatable read |
| **REPEATABLE_READ** | Đọc lại trong tx ra cùng giá trị | Có phantom read |
| **SERIALIZABLE** | Như chạy tuần tự | Chậm nhất, lock nặng |

**Quy tắc:** Method nào có save/update/delete DB → BẮT BUỘC `@Transactional`. Method chỉ đọc → `@Transactional(readOnly = true)` (Hibernate tối ưu, không dirty checking).

📚 **Đọc thêm:** [database/01-database-techniques.md](../database/01-database-techniques.md) (Transaction isolation), [glossary.md#a](../glossary.md#a) (ACID).

---

## Mục lục

1. [Self-invocation — `this.method()` bypass AOP](#1-self-invocation)
2. [N+1 query problem](#2-n1-query-problem)
3. [LazyInitializationException](#3-lazyinitializationexception)
4. [`@Transactional` không rollback checked exception](#4-transactional-checked-exception)
5. [Circular dependency](#5-circular-dependency)
6. [`@ComponentScan` không quét package cha](#6-componentscan-package)
7. [`@Data` Lombok phá entity](#7-data-lombok-entity)
8. [`@Builder` không kế thừa BaseEntity](#8-builder-inheritance)
9. [Quên `@Builder.Default`](#9-builder-default)
10. [Quên `@EnableJpaAuditing`](#10-enable-jpa-auditing)
11. [Quên `@EnableScheduling`](#11-enable-scheduling)
12. [Quên `@EnableAsync`](#12-enable-async)
13. [Quên `@Modifying` trên UPDATE/DELETE](#13-modifying-missing)
14. [CORS `*` + `allowCredentials(true)`](#14-cors-conflict)
15. [JWT `alg=none` attack](#15-jwt-alg-none)
16. [`@ManyToOne` mặc định EAGER](#16-manytoone-eager)
17. [Collection reassignment với `orphanRemoval`](#17-collection-reassignment)
18. [`@Transactional(readOnly = true)` save âm thầm](#18-transactional-readonly)
19. [`AuthenticationManager` vs `UserDetailsService`](#19-auth-manager-vs-user-details)
20. [Cache stampede / thundering herd](#20-cache-stampede)
21. [`@PostConstruct` + `@Transactional` không hoạt động](#21-postconstruct-transactional)

---

## 1. Self-invocation — `this.method()` bypass AOP

### Triệu chứng
Bạn đặt `@Transactional`, `@Async` hoặc `@Cacheable` trên method `inner()`. Method `outer()` cùng class gọi `this.inner()`. Logic của transaction/async/cache **không kích hoạt** mà bạn không thấy lỗi nào.

### Code reproduce
```java
@Service
public class PaymentService {

    public void payAndAudit(Long bookingId) {
        // Method này KHÔNG có @Transactional
        processPayment(bookingId);
        this.audit("Payment for booking " + bookingId);  // <-- self-invocation
    }

    @Transactional
    public void audit(String message) {
        auditLogRepository.save(new AuditLog(message));
        // Bạn nghĩ method này chạy trong transaction.
        // SAI! @Transactional bị bỏ qua vì gọi qua `this`.
    }
}
```

### Tại sao xảy ra
Spring AOP hoạt động qua **proxy pattern**. Khi `@Service` được scan, Spring tạo 1 lớp proxy bọc bean gốc:

```
External caller -> [Spring Proxy] -> Target bean
                      |
                      +-- Apply @Transactional, @Async, @Cacheable...
```

Khi bạn `@Autowired PaymentService paymentService` và gọi `paymentService.audit()`, gọi đi qua proxy → advice chạy.

Nhưng khi method `outer()` gọi `this.audit()`, `this` trỏ thẳng vào target bean (không phải proxy) → bypass toàn bộ advice → `@Transactional` không có hiệu lực.

### Cách phát hiện
- Log SQL không có BEGIN TRANSACTION cho method bị self-invoke.
- Khi exception throw, save trước đó **không rollback** → data nửa vời.
- Đặt breakpoint vào `TransactionInterceptor.invoke()` → không bao giờ stop khi self-invoke.

### 3 cách fix

**Fix 1: Inject self qua `@Lazy` (đơn giản)**

```java
@Service
public class PaymentService {

    @Autowired
    @Lazy
    private PaymentService self;  // self chính là proxy

    public void payAndAudit(Long bookingId) {
        processPayment(bookingId);
        self.audit("...");  // gọi qua proxy → @Transactional active
    }
}
```

`@Lazy` cần thiết để tránh circular dependency (Spring chưa tạo xong bean đã inject vào chính nó).

**Fix 2: Tách thành 2 bean (best practice)**

```java
@Service
@RequiredArgsConstructor
public class PaymentService {
    private final AuditService auditService;  // bean khác

    public void payAndAudit(Long bookingId) {
        processPayment(bookingId);
        auditService.audit("...");  // qua proxy bean khác → active
    }
}

@Service
public class AuditService {
    @Transactional
    public void audit(String message) { ... }
}
```

Single Responsibility — service tách biệt theo concern, không bị bug self-invoke.

**Fix 3: AspectJ load-time weaving (nâng cao)**

Dùng AspectJ thay AOP proxy → mọi call site bị weaving, kể cả `this.method()`. Phức tạp setup, ít khi cần.

### Tại sao quan trọng cho CineX
Bug này xảy ra với 3 annotation cốt lõi của project:
- `@Transactional` trong BookingService
- `@Async` trong PaymentEventListener
- `@Cacheable` nếu sau này tích hợp Spring Cache

Quy ước: **Mọi method có annotation AOP phải được gọi từ BÊN NGOÀI class chứa nó.**

---

## 2. N+1 query problem

### Triệu chứng
Trang list phim chậm khủng khiếp — 1 request 500ms khi DB có 50 phim, tệ hơn khi DB có 500 phim. Log Hibernate hiện hàng trăm câu SELECT.

### Code reproduce
Entity:
```java
@Entity
public class Movie extends BaseEntity {
    @ManyToMany
    @JoinTable(name = "movie_genres", ...)
    private Set<Genre> genres;  // default LAZY
}
```

Service:
```java
public List<MovieResponse> listMovies() {
    List<Movie> movies = movieRepository.findAll();  // 1 query SELECT * FROM movies
    return movies.stream()
        .map(m -> new MovieResponse(
            m.getTitle(),
            m.getGenres().stream().map(Genre::getName).toList()  // N query!
        ))
        .toList();
}
```

Log SQL:
```sql
SELECT * FROM movies;                              -- 1
SELECT * FROM movie_genres WHERE movie_id = 1;     -- N
SELECT * FROM movie_genres WHERE movie_id = 2;
SELECT * FROM movie_genres WHERE movie_id = 3;
...
```

50 phim → 51 query.

### Tại sao xảy ra
`@ManyToMany` mặc định LAZY → Hibernate chưa load `genres` lúc `findAll()`. Khi bạn `.getGenres()`, Hibernate phải fire query riêng cho từng movie để load collection.

### Cách phát hiện
- Bật log SQL trong `application.yml`:
  ```yaml
  spring:
    jpa:
      show-sql: true
      properties:
        hibernate.format_sql: true
  logging.level.org.hibernate.SQL: DEBUG
  ```
- Đếm số query mỗi request. Nếu phụ thuộc kích thước list → N+1.
- Dùng [p6spy](https://p6spy.readthedocs.io/) để log số query thực tế.
- Hibernate Statistics: `sessionFactory.getStatistics().getQueryExecutionCount()`.

### 3 cách fix

**Fix 1: JPQL `JOIN FETCH`**

```java
@Query("SELECT m FROM Movie m LEFT JOIN FETCH m.genres")
List<Movie> findAllWithGenres();
```

Hibernate sinh 1 query JOIN duy nhất. Nhược điểm: không hoạt động với phân trang (`Pageable`) — bạn sẽ bị `HHH000104` warning và Hibernate phân trang trong memory.

**Fix 2: `@EntityGraph` (recommended)**

```java
@EntityGraph(attributePaths = "genres")
List<Movie> findAll();
```

Tương đương JOIN FETCH nhưng compatible với phân trang. Dễ dùng nhất.

**Fix 3: `@BatchSize`**

```java
@ManyToMany
@BatchSize(size = 50)
private Set<Genre> genres;
```

Khi access `genres` của movie đầu tiên, Hibernate load `genres` của 50 movie cùng lúc trong 1 query → giảm N+1 thành N/50 + 1.

### Cảnh báo `MultipleBagFetchException`
Khi JOIN FETCH 2 collection `List<>` cùng lúc → Hibernate ném `cannot simultaneously fetch multiple bags`. Fix: đổi `List` thành `Set`, hoặc dùng `@EntityGraph` thay JOIN FETCH.

### Ví dụ thực tế CineX
- `MovieRepository.findAll()` cần fetch genres
- `BookingRepository.findByUserId()` cần fetch showtime + seats
- `ShowtimeRepository.findActive()` cần fetch movie + room

---

## 3. LazyInitializationException

### Triệu chứng
Bạn truy cập field LAZY của entity → exception:
```
org.hibernate.LazyInitializationException:
  could not initialize proxy [Movie#5] - no Session
```

### Code reproduce
```java
@Transactional(readOnly = true)
public Movie getMovie(Long id) {
    return movieRepository.findById(id).orElseThrow();
    // transaction kết thúc khi method return
}

@RestController
public class MovieController {
    public MovieResponse getMovie(@PathVariable Long id) {
        Movie movie = movieService.getMovie(id);  // transaction đã đóng
        return new MovieResponse(
            movie.getTitle(),
            movie.getGenres()  // BOOM! LazyInitializationException
        );
    }
}
```

### Tại sao xảy ra
Lazy proxy chỉ resolve được khi có **Hibernate Session active**. Session = scope của `@Transactional`. Sau khi method `@Transactional` return, Session đóng → proxy không load được.

### Cách phát hiện
- Stack trace có `LazyInitializationException` rõ ràng.
- Thường xảy ra khi serialize entity ra JSON (Jackson access getter để build JSON).
- Xảy ra trong `@Async` method (thread con không thấy Session của thread cha).

### 3 cách fix

**Fix 1: DTO projection (CineX dùng — recommended)**

```java
@Transactional(readOnly = true)
public MovieResponse getMovie(Long id) {
    Movie movie = movieRepository.findById(id).orElseThrow();
    // Map sang DTO TRONG transaction → genres được load
    return MovieMapper.toResponse(movie);
}
```

Đóng gói tất cả lazy access bên trong `@Transactional` → khi return là DTO đã đầy đủ data.

**Fix 2: JOIN FETCH ở repository**

```java
@Query("SELECT m FROM Movie m LEFT JOIN FETCH m.genres WHERE m.id = :id")
Optional<Movie> findByIdWithGenres(@Param("id") Long id);
```

Lazy được resolve trước khi transaction đóng.

**Fix 3: Open-Session-In-View (anti-pattern — tránh)**

```yaml
spring.jpa.open-in-view: true   # default = true!
```

Spring giữ Session mở suốt request → Controller truy cập lazy vẫn work. **Tránh** vì:
- Query bị fire trong Controller → vi phạm Layer separation
- Session lifetime dài → connection pool cạn
- Khó debug performance

CineX nên set `open-in-view: false` để force dùng pattern DTO.

---

## 4. `@Transactional` không rollback checked exception

### Triệu chứng
Method `@Transactional` throw checked exception (`IOException`, `MessagingException`, custom checked exception) → transaction **commit bình thường** thay vì rollback.

### Code reproduce
```java
@Transactional
public void createBooking(BookingRequest req) throws MessagingException {
    bookingRepository.save(booking);     // SAVE
    emailService.sendEmail(...);          // throw MessagingException
    // Transaction vẫn commit → booking đã lưu DB nhưng email fail!
}
```

### Tại sao xảy ra
Mặc định Spring `@Transactional` chỉ rollback khi gặp **RuntimeException** hoặc **Error**. Checked exception (extends `Exception` không phải `RuntimeException`) bị bỏ qua.

Đây là quyết định thiết kế: Spring giả định checked exception là "lỗi business" mà bạn đã xử lý có chủ đích.

### 3 cách fix

**Fix 1: `rollbackFor = Exception.class`**

```java
@Transactional(rollbackFor = Exception.class)
public void createBooking(...) throws MessagingException { ... }
```

**Fix 2: Bắt và wrap thành RuntimeException**

```java
@Transactional
public void createBooking(...) {
    try {
        ...
        emailService.sendEmail(...);
    } catch (MessagingException e) {
        throw new BusinessException(ErrorCode.EMAIL_FAILED);  // RuntimeException
    }
}
```

**Fix 3: Tách email ra ngoài transaction (best practice)**

```java
@Transactional
public void createBooking(...) {
    bookingRepository.save(booking);
    eventPublisher.publishEvent(new BookingCreatedEvent(booking));
}

@Async
@TransactionalEventListener(phase = AFTER_COMMIT)
public void onBookingCreated(BookingCreatedEvent event) {
    emailService.sendEmail(...);  // chạy sau khi booking đã commit
}
```

Tách side-effect (email) khỏi transaction chính → booking commit không phụ thuộc email.

---

## 5. Circular dependency

### Triệu chứng
Startup fail từ Spring Boot 2.6+:
```
The dependencies of some of the beans in the application context form a cycle:
   bookingService defined in ...
      ↓
   paymentService defined in ...
      ↓
   bookingService
```

### Code reproduce
```java
@Service
@RequiredArgsConstructor
public class BookingService {
    private final PaymentService paymentService;  // cần PaymentService
}

@Service
@RequiredArgsConstructor
public class PaymentService {
    private final BookingService bookingService;  // cần BookingService
}
```

### Tại sao xảy ra
Spring container tạo bean → cần resolve dependency. A cần B, B cần A → vòng tròn không phá vỡ được. Trước Spring Boot 2.6, container "vá" được bằng cách inject bean chưa init xong → bug ngầm. Sau 2.6 → fail-fast.

### 3 cách fix

**Fix 1: `@Lazy` (vá nhanh)**

```java
@Service
public class BookingService {
    @Autowired
    @Lazy
    private PaymentService paymentService;
}
```

`@Lazy` tạo proxy → A khởi tạo không cần B init xong. Khi A gọi B → proxy resolve.

**Fix 2: Tách bean trung gian (đúng kiến trúc)**

Bạn đang vi phạm SOLID. Tạo `BookingPaymentCoordinator` để gọi cả 2:

```java
@Service
@RequiredArgsConstructor
public class BookingPaymentCoordinator {
    private final BookingService bookingService;
    private final PaymentService paymentService;

    public void confirmBookingAndPay(Long bookingId) {
        Booking b = bookingService.getBooking(bookingId);
        paymentService.createPayment(b);
    }
}
```

`BookingService` và `PaymentService` không depend trực tiếp lên nhau.

**Fix 3: Spring Events (decouple)**

```java
@Service
public class BookingService {
    public void confirmBooking() {
        ...
        eventPublisher.publishEvent(new BookingConfirmedEvent(booking));
    }
}

@Service
public class PaymentService {
    @EventListener
    public void onBookingConfirmed(BookingConfirmedEvent event) { ... }
}
```

PaymentService không inject BookingService → cycle broken.

### Khôi phục hành vi cũ (KHÔNG khuyến khích)
```yaml
spring.main.allow-circular-references: true
```
Chỉ dùng tạm thời để debug, không deploy production.

---

## 6. `@ComponentScan` không quét package cha

### Triệu chứng
Bạn tạo class `@Service`, `@RestController` ở package khác → Spring không thấy → `NoSuchBeanDefinitionException` hoặc 404.

### Code reproduce
Cấu trúc:
```
com/
├── utils/           ← class bạn đặt ở đây
│   └── HelperService.java       (@Service)
└── cinex/
    └── CineXApplication.java    (@SpringBootApplication)
```

Class `HelperService` không được scan → inject thất bại.

### Tại sao xảy ra
`@SpringBootApplication` bao gồm `@ComponentScan` mặc định scan **package chứa class này và sub-package**. `com.utils` không phải sub-package của `com.cinex` → bị bỏ qua.

### 3 cách fix

**Fix 1: Đặt class main ở package gốc (best practice)**

```
com/cinex/
├── CineXApplication.java       ← package gốc
├── utils/
│   └── HelperService.java
├── module/
└── common/
```

CineX đã làm đúng — `CineXApplication` ở `com.cinex`, mọi class trong sub-package được scan.

**Fix 2: Mở rộng `scanBasePackages`**

```java
@SpringBootApplication(scanBasePackages = { "com.cinex", "com.utils" })
public class CineXApplication { ... }
```

**Fix 3: `@ComponentScan` riêng**

```java
@Configuration
@ComponentScan(basePackages = "com.utils")
public class UtilsScanConfig { ... }
```

---

## 7. `@Data` Lombok phá entity

### Triệu chứng
3 vấn đề tùy ngữ cảnh:
- `StackOverflowError` khi `.toString()` entity có bidirectional relationship
- N+1 query khi `.equals()` so sánh entity
- `Set<Movie>` mất tracking sau khi save (entity "biến mất")

### Code reproduce
```java
@Entity
@Data  // <-- nguy hiểm
public class Movie extends BaseEntity {
    private String title;

    @ManyToMany
    private Set<Genre> genres;
}

@Entity
@Data
public class Genre extends BaseEntity {
    private String name;

    @ManyToMany(mappedBy = "genres")
    private Set<Movie> movies;
}
```

- `movie.toString()` → gọi `genres.toString()` → gọi `genre.toString()` → gọi `movies.toString()` → ... → StackOverflow.
- `set.contains(movie)` → gọi `equals` → so sánh genres → load lazy → N+1.

### Tại sao xảy ra
`@Data` sinh `equals/hashCode/toString` dùng **TẤT CẢ field**. Với entity:
- Bidirectional → vòng tròn toString
- Lazy field → bị resolve khi equals
- `id` thay đổi sau save (null → 1) → hashCode đổi → Set không tìm được entity

### Cách fix

**Fix 1: Dùng annotation riêng**

```java
@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class Movie extends BaseEntity {
    // Không dùng @Data
}
```

**Fix 2: Viết equals/hashCode tay theo business key**

```java
@Override
public boolean equals(Object o) {
    if (this == o) return true;
    if (!(o instanceof Movie m)) return false;
    return Objects.equals(getId(), m.getId());
}

@Override
public int hashCode() {
    // Stable hash kể cả khi id null
    return getClass().hashCode();
}
```

**Fix 3: `@EqualsAndHashCode(onlyExplicitlyIncluded = true)`**

```java
@Entity
@Getter
@Setter
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@ToString(exclude = "genres")  // tránh stackoverflow
public class Movie extends BaseEntity {
    @EqualsAndHashCode.Include
    @Id
    private Long id;
}
```

---

## 8. `@Builder` không kế thừa BaseEntity

### Triệu chứng
```java
User u = User.builder()
    .username("vanan")
    .id(1L)            // compile error: method id() does not exist
    .createdAt(now)    // compile error
    .build();
```

### Tại sao xảy ra
`@Builder` ở subclass chỉ sinh method cho field của **chính subclass**, không cho field của BaseEntity.

### Fix: `@SuperBuilder`

```java
@MappedSuperclass
@Getter
@SuperBuilder      // <-- thay @Builder
@NoArgsConstructor
@AllArgsConstructor
public abstract class BaseEntity {
    @Id
    private Long id;
    private Instant createdAt;
    private Long version;
}

@Entity
@Getter
@SuperBuilder      // <-- ở subclass cũng @SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class User extends BaseEntity {
    private String username;
}
```

Giờ `User.builder().id(1L).username("vanan").build()` hoạt động.

---

## 9. Quên `@Builder.Default`

### Triệu chứng
```java
@Builder
public class User {
    private Set<Role> roles = new HashSet<>();  // default empty set
}

User u = User.builder().username("vanan").build();
u.getRoles();  // null! không phải empty set.
```

### Tại sao xảy ra
Builder gọi default constructor → field init với giá trị mặc định. Nhưng nếu bạn không set field qua builder, builder **set field về null** (override init).

### Fix: `@Builder.Default`

```java
@Builder
public class User {
    @Builder.Default
    private Set<Role> roles = new HashSet<>();
}
```

Bây giờ `u.getRoles()` trả empty set.

Áp dụng cho mọi field có giá trị mặc định: `roles`, `enabled = true`, `status = Status.ACTIVE`, list/set khởi tạo.

---

## 10. Quên `@EnableJpaAuditing`

### Triệu chứng
Entity extends `BaseEntity` có `@CreatedDate`, `@LastModifiedDate`. Sau khi save, `createdAt` và `updatedAt` đều **null**.

### Tại sao xảy ra
`@CreatedDate`, `@CreatedBy`, `@LastModifiedDate`, `@LastModifiedBy` cần Spring AOP listener `AuditingEntityListener` để hoạt động. Listener này chỉ được wire khi bạn bật:

```java
@Configuration
@EnableJpaAuditing
public class JpaAuditingConfig { }
```

### Cần thêm cho `@CreatedBy`/`@LastModifiedBy`
```java
@Bean
public AuditorAware<String> auditorAware() {
    return () -> Optional.of(
        SecurityContextHolder.getContext()
            .getAuthentication()
            .getName()
    );
}
```

Không có bean này → `createdBy` toàn null.

### Cách phát hiện
- INSERT log SQL thấy `created_at` value = NULL.
- Manual gán `entity.setCreatedAt(Instant.now())` không cần thiết nếu listener active.

---

## 11. Quên `@EnableScheduling`

### Triệu chứng
`BookingCleanupScheduler` có `@Scheduled(fixedRate = 60000)` nhưng **không bao giờ chạy**. Không có log, không có error, không có gì.

### Tại sao xảy ra
`@Scheduled` chỉ active khi có `@EnableScheduling` ở class config (thường là `CineXApplication`).

### Fix
```java
@SpringBootApplication
@EnableScheduling
@EnableAsync
@EnableJpaAuditing
public class CineXApplication { ... }
```

### Cách phát hiện
- Tab `Beans` của Actuator không có `ScheduledAnnotationBeanPostProcessor` active.
- Log INFO không có `Scheduling job triggered`.

### Khi multi-instance
3 server cùng chạy `@Scheduled` → 3 lần execute mỗi phút → duplicate. Fix bằng [ShedLock](https://github.com/lukas-krecan/ShedLock) — chi tiết ở `backend/04-spring-features.md` mục 14.

---

## 12. Quên `@EnableAsync`

### Triệu chứng
`@Async` method chạy như method bình thường — blocking, đồng bộ, không trên thread riêng.

### Code reproduce
```java
@Async
public void sendEmail(String to) {
    // Bạn nghĩ chạy async. Thực tế chạy sync trên thread caller.
    Thread.sleep(5000);
}
```

### Tại sao xảy ra
`@Async` cần `AsyncAnnotationBeanPostProcessor` wire — chỉ active khi có `@EnableAsync`.

### Cách phát hiện
- Log `Thread.currentThread().getName()` trong async method → thấy `http-nio-8088-exec-1` (thread của Tomcat) thay vì `task-1` (thread pool).
- Performance test: request chậm bằng tổng thời gian (sync) thay vì gần như instant (async).

### Fix
```java
@EnableAsync
@SpringBootApplication
public class CineXApplication { ... }
```

### Cảnh báo executor default
Spring Boot default dùng `SimpleAsyncTaskExecutor` — KHÔNG dùng thread pool, **tạo thread mới mỗi lần** → resource leak. Production phải config:

```java
@Configuration
public class AsyncConfig {
    @Bean(name = "taskExecutor")
    public Executor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(5);
        executor.setMaxPoolSize(20);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("cinex-async-");
        executor.initialize();
        return executor;
    }
}
```

---

## 13. Quên `@Modifying` trên UPDATE/DELETE

### Triệu chứng
```
org.springframework.dao.InvalidDataAccessApiUsageException:
  Expecting a SELECT query : UPDATE Notification n SET n.read = true ...
```

### Code reproduce
```java
@Query("UPDATE Notification n SET n.isRead = true WHERE n.user.id = :userId")
void markAllAsRead(@Param("userId") Long userId);  // FAIL — thiếu @Modifying
```

### Tại sao xảy ra
Spring Data mặc định coi `@Query` là SELECT, cố map kết quả thành entity. UPDATE trả `int` (số row affected) → không map được.

### Fix
```java
@Modifying(clearAutomatically = true)
@Query("UPDATE Notification n SET n.isRead = true WHERE n.user.id = :userId")
int markAllAsRead(@Param("userId") Long userId);  // return int = số row
```

### Tại sao cần `clearAutomatically = true`
Sau UPDATE bulk, persistent context vẫn giữ entity với giá trị cũ → query tiếp theo có thể trả data stale. `clearAutomatically = true` clear context sau modify.

Tương đương: `flushAutomatically = true` flush pending changes trước modify.

---

## 14. CORS `*` + `allowCredentials(true)` conflict

### Triệu chứng
Browser console:
```
Access to fetch at 'http://localhost:8088/api/movies' has been blocked
by CORS policy: The value of the 'Access-Control-Allow-Origin' header
in the response must not be the wildcard '*' when the request's credentials
mode is 'include'.
```

### Code reproduce
```java
config.setAllowedOrigins(List.of("*"));      // <-- conflict
config.setAllowCredentials(true);            // <-- với cái này
```

### Tại sao xảy ra
CORS spec quy định: nếu cookies/credentials được gửi, server PHẢI specify origin cụ thể (không wildcard) để client biết chắc API trusts origin đó.

### Fix
```java
config.setAllowedOrigins(List.of(
    "http://localhost:5173",
    "https://app.cinex.vn"
));
config.setAllowCredentials(true);
```

Hoặc dùng `setAllowedOriginPatterns(...)` cho dynamic origin (regex):
```java
config.setAllowedOriginPatterns(List.of("https://*.cinex.vn"));
```

---

## 15. JWT `alg=none` attack

### Triệu chứng
Hacker gửi token với `header: {"alg": "none"}` + payload bịa → một số JWT library **accept** token này không signature.

### Tại sao xảy ra
JWT spec hỗ trợ `alg=none` (không sign). Library naive có thể trust alg trong header thay vì enforce alg server-side.

### Code SAI
```java
// Trust alg từ header (sai)
Claims claims = Jwts.parserBuilder()
    .setSigningKey(key)
    .build()
    .parseClaimsJws(token)  // có thể accept alg=none
    .getBody();
```

### Fix
Library hiện đại như `jjwt 0.12+` mặc định enforce alg. Bổ sung explicit check:

```java
Jws<Claims> jws = Jwts.parser()
    .verifyWith((SecretKey) key)
    .build()
    .parseSignedClaims(token);

// Manual check alg
String alg = jws.getHeader().getAlgorithm();
if (!"HS256".equals(alg)) {
    throw new SecurityException("Invalid algorithm");
}
```

### Cảnh báo thêm
- Weak secret: dùng `openssl rand -base64 32` để generate
- No expiration: JWT phải có `exp` claim, server check
- Missing audience: thêm `aud` claim để token chỉ valid cho app cụ thể

---

## 16. `@ManyToOne` mặc định EAGER

### Triệu chứng
Load 1 entity → Hibernate JOIN hàng loạt bảng không cần thiết. Query đơn giản nhưng SQL dài 200 dòng.

### Code reproduce
```java
@Entity
public class Booking extends BaseEntity {
    @ManyToOne   // <-- default EAGER
    private User user;

    @ManyToOne   // <-- default EAGER
    private Showtime showtime;
}
```

Hibernate sinh SQL JOIN cả 4 bảng (users, showtimes, movies, rooms) khi load Booking.

### Tại sao xảy ra
JPA spec: `@ManyToOne` và `@OneToOne` default **EAGER**. `@OneToMany` và `@ManyToMany` default **LAZY**.

### Fix
Best practice: TẤT CẢ relationship LAZY, fetch khi cần qua `JOIN FETCH`:

```java
@ManyToOne(fetch = FetchType.LAZY)
private User user;

@ManyToOne(fetch = FetchType.LAZY)
private Showtime showtime;
```

Khi cần data: `@EntityGraph(attributePaths = {"user", "showtime.movie"})`.

---

## 17. Collection reassignment với `orphanRemoval`

### Triệu chứng
```
A collection with cascade="all-delete-orphan" was no longer referenced
by the owning entity instance: com.cinex.Movie.genres
```

### Code reproduce
```java
@Entity
public class Movie {
    @ManyToMany(orphanRemoval = true)
    private Set<Genre> genres = new HashSet<>();
}

// Update method:
movie.setGenres(new HashSet<>(newGenres));  // <-- reassign → exception
movieRepository.save(movie);
```

### Tại sao xảy ra
Hibernate track collection bằng reference. Khi bạn `setGenres(new HashSet<>())`, Hibernate mất track collection cũ → ném exception khi `orphanRemoval=true`.

### Fix
Modify collection thay vì reassign:

```java
movie.getGenres().clear();
movie.getGenres().addAll(newGenres);
movieRepository.save(movie);
```

Pattern này giữ reference collection cũ, Hibernate vẫn track được.

---

## 18. `@Transactional(readOnly = true)` save âm thầm

### Triệu chứng
```java
@Transactional(readOnly = true)
public void getMovieAndAuditView(Long id) {
    Movie m = movieRepository.findById(id).orElseThrow();
    auditLogRepository.save(new AuditLog("view " + id));
    // save không error nhưng cũng KHÔNG ghi DB
}
```

### Tại sao xảy ra
`readOnly = true` là **hint** cho Hibernate skip dirty checking → save trong method không trigger SQL INSERT. Spring không throw error.

### Cách phát hiện
- SELECT thấy data sau, không thấy row mới audit_log.
- Log Hibernate không có INSERT.

### Fix
Đừng dùng `readOnly = true` nếu có write:

```java
@Transactional
public void getMovieAndAuditView(Long id) {
    Movie m = movieRepository.findById(id).orElseThrow();
    auditLogRepository.save(new AuditLog("view " + id));
}
```

Quy ước: `readOnly = true` CHỈ cho method pure-read (query, list).

---

## 19. `AuthenticationManager` vs `UserDetailsService` confusion

### Triệu chứng
Bạn nhìn 2 tutorial khác nhau:
- Tutorial 1: login dùng `passwordEncoder.matches(input, user.getPassword())`
- Tutorial 2: login dùng `authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(...))`

Không hiểu chọn cái nào.

### Khác biệt

**`UserDetailsService`** — lookup user by username, return `UserDetails`. Spring Security gọi để load user trước khi authenticate.

**`AuthenticationManager`** — orchestrator dùng `UserDetailsService` + `PasswordEncoder` + `AuthenticationProvider` để verify credentials end-to-end. Return `Authentication` object đã authenticated.

### Khi nào dùng cái nào

**Manual** (CineX hiện tại):
```java
User user = userRepository.findByUsername(req.getUsername())
    .orElseThrow(() -> new BadCredentialsException("Invalid"));
if (!passwordEncoder.matches(req.getPassword(), user.getPassword())) {
    throw new BadCredentialsException("Invalid");
}
String token = jwtUtil.generate(user);
```

Đơn giản, control hoàn toàn. Phù hợp khi cần custom error message.

**AuthenticationManager** (Spring Security idiomatic):
```java
Authentication auth = authenticationManager.authenticate(
    new UsernamePasswordAuthenticationToken(req.getUsername(), req.getPassword())
);
UserDetails user = (UserDetails) auth.getPrincipal();
String token = jwtUtil.generate(user);
```

Spring tự handle locked account, expired account, disabled... thông qua `UserDetails` flags.

### Recommendation cho CineX
Bắt đầu manual cho dễ hiểu. Khi cần locked account/MFA/social login → migrate sang `AuthenticationManager`.

---

## 20. Cache stampede / thundering herd

### Triệu chứng
Trang đang chạy mượt → cache expire → 1 giây sau DB CPU 100% → trang chết → reset.

### Tại sao xảy ra
1000 user cùng request endpoint `GET /api/movies/popular` đúng lúc cache expire → 1000 cache miss → 1000 query DB cùng lúc → DB overload.

### Pattern fix: Mutex lock

```java
@Service
public class MovieService {
    private final RedissonClient redisson;

    public List<Movie> getPopular() {
        List<Movie> cached = redisCache.get("popular");
        if (cached != null) return cached;

        RLock lock = redisson.getLock("lock:popular");
        try {
            lock.lock();
            // double-check sau khi lấy lock
            cached = redisCache.get("popular");
            if (cached != null) return cached;

            List<Movie> fresh = movieRepository.findPopular();
            redisCache.set("popular", fresh, Duration.ofMinutes(5));
            return fresh;
        } finally {
            lock.unlock();
        }
    }
}
```

Chỉ 1 thread query DB, 999 thread khác đợi rồi đọc cache.

### Pattern khác
- **Probabilistic early expiration (XFetch)**: refresh cache trước khi expire với xác suất tăng dần.
- **Refresh-ahead**: background job refresh cache trước khi expire.

Chi tiết xem `backend/04-spring-features.md` mục 16.

---

## 21. `@PostConstruct` + `@Transactional` không hoạt động {#21-postconstruct-transactional}

### Triệu chứng
Bạn thêm `@PostConstruct` để chạy 1 method khởi tạo data lúc app start. Method này có `@Transactional`. App start không lỗi, nhưng data không được commit, hoặc lazy field không load được.

### Code reproduce
```java
@Service
public class GenreService {

    @Autowired
    private GenreRepository genreRepository;

    @PostConstruct
    @Transactional  // ❌ KHÔNG hoạt động!
    public void seedDefaultGenres() {
        if (genreRepository.count() == 0) {
            genreRepository.save(new Genre("Action"));
            genreRepository.save(new Genre("Drama"));
            // → Không có transaction → Hibernate không flush → data có thể không persist
        }
    }
}
```

### Tại sao xảy ra
Quay lại **Bean Lifecycle** (PHẦN 0.3): `@PostConstruct` chạy ở bước 6, NHƯNG Spring proxy hoàn thiện ở bước 9 (sau init). Khi `@PostConstruct` chạy:
- `this` = target bean gốc, chưa được proxy bọc lại
- `@Transactional` advice chưa được apply
- Method chạy như method thường, không có transaction

Đây cũng là dạng **Self-Invocation** (bug #1), nhưng ẩn hơn vì user không gọi `this.method()` trực tiếp — Spring tự gọi.

### Cách phát hiện
- Bật SQL log: không thấy `BEGIN TRANSACTION` cho method `@PostConstruct`.
- Đặt breakpoint trong `TransactionInterceptor.invoke()` → không stop.
- Nếu `@PostConstruct` method gọi method có lazy collection → `LazyInitializationException` (do session không mở).

### 3 cách fix

**Fix 1: `ApplicationRunner` thay `@PostConstruct`** ✅ Best practice

```java
@Component
@RequiredArgsConstructor
public class DataSeeder implements ApplicationRunner {
    private final GenreService genreService;

    @Override
    public void run(ApplicationArguments args) {
        // Chạy SAU khi context fully initialized (bước sau bước 9)
        // → proxy đã sẵn sàng → @Transactional hoạt động
        genreService.seedDefaultGenres();
    }
}

@Service
public class GenreService {
    @Transactional
    public void seedDefaultGenres() { ... }
}
```

**Fix 2: Inject self qua `@Lazy`**

```java
@Service
public class GenreService {
    @Autowired @Lazy
    private GenreService self;

    @PostConstruct
    public void init() {
        self.seedDefaultGenres();  // Gọi qua proxy
    }

    @Transactional
    public void seedDefaultGenres() { ... }
}
```

**Fix 3: `TransactionTemplate` thủ công**

```java
@Service
@RequiredArgsConstructor
public class GenreService {
    private final TransactionTemplate transactionTemplate;
    private final GenreRepository genreRepository;

    @PostConstruct
    public void init() {
        transactionTemplate.execute(status -> {
            // Code này chạy trong transaction
            if (genreRepository.count() == 0) {
                genreRepository.save(new Genre("Action"));
            }
            return null;
        });
    }
}
```

### Anti-pattern cảnh báo
**ĐỪNG** dùng `@PostConstruct` cho seed data quan trọng vì:
- Nếu app crash giữa chừng, data có thể bán-commit
- Khó test (PostConstruct chạy auto, khó mock)
- Multi-instance deploy: mỗi instance đều chạy `@PostConstruct` → race condition

**Thay vào đó:**
- Liquibase seed data (`<insert>` trong changeset) — chỉ chạy 1 lần
- `ApplicationRunner` + idempotent check (`if (count == 0)`)
- Migration script chạy lần đầu deploy

---

## Bảng tổng kết

| Triệu chứng | Bug | Fix nhanh |
|---|---|---|
| `@Transactional` không rollback | #4 | `rollbackFor = Exception.class` |
| AOP advice không chạy | #1 | Inject `@Lazy self` hoặc tách bean |
| Query 100 lần cho 50 record | #2 | `@EntityGraph` hoặc JOIN FETCH |
| Lazy không load được | #3 | DTO projection trong `@Transactional` |
| Cycle bean error | #5 | Tách bean trung gian |
| Bean không tồn tại | #6 | Class main ở package gốc |
| `Set<Movie>` mất tracking | #7 | Bỏ `@Data`, dùng `@Getter @Setter` |
| `id()` không có ở builder | #8 | `@SuperBuilder` |
| Field null sau build | #9 | `@Builder.Default` |
| `createdAt` null | #10 | `@EnableJpaAuditing` |
| Cronjob không chạy | #11 | `@EnableScheduling` |
| `@Async` chạy sync | #12 | `@EnableAsync` |
| "Expecting SELECT" | #13 | `@Modifying` |
| CORS error wildcard | #14 | Set origin cụ thể |
| JWT bypass signature | #15 | Enforce alg server-side |
| JOIN không cần thiết | #16 | `fetch = LAZY` |
| Orphan removal error | #17 | `clear() + addAll()` |
| Save không persist | #18 | Bỏ `readOnly = true` |
| Auth flow phức tạp | #19 | Chọn manual hoặc AuthenticationManager |
| DB sập khi cache expire | #20 | Mutex lock với Redisson |
| `@PostConstruct` + `@Transactional` không commit | #21 | `ApplicationRunner` thay `@PostConstruct` |

---

## Câu hỏi tự kiểm tra

**Câu 1:** Khi nào `@Transactional` KHÔNG rollback?

→ Khi gặp checked exception (extends `Exception` không phải `RuntimeException`). Fix: `rollbackFor = Exception.class`.

**Câu 2:** Tại sao `this.method()` không trigger `@Async`?

→ Spring AOP dùng proxy. `this` trỏ thẳng vào target bean, bypass proxy → annotation không apply. Fix: inject self qua `@Lazy` hoặc tách bean.

**Câu 3:** Bạn thấy `LazyInitializationException` trong controller. Cách fix nào tốt nhất cho CineX?

→ DTO projection. Map entity → DTO trong service `@Transactional` để mọi lazy field được resolve trước khi return. Tránh OSIV.

**Câu 4:** Bạn tạo bảng `notifications` mới và viết `markAllAsRead()` JPQL update. Sau khi gọi method, status không thay đổi trong DB. Lỗi gì?

→ Quên `@Modifying`. JPA mặc định coi `@Query` là SELECT. UPDATE/DELETE phải có `@Modifying(clearAutomatically = true)`.

**Câu 5:** Bạn deploy 3 instance app. Mỗi phút, scheduler `BookingCleanupScheduler` xóa booking expired. Vấn đề gì?

→ Mỗi instance đều chạy scheduler → 3 lần cùng lúc → duplicate work, có thể race condition. Fix: ShedLock với DB lock chung.

**Câu 6:** Khi nào nên dùng `@OneToMany(fetch = LAZY)`?

→ Luôn luôn. Đó cũng là default của `@OneToMany`. Chỉ EAGER khi entity LUÔN cần collection cùng load, mà thường không bao giờ đúng.

**Câu 7:** Vì sao KHÔNG dùng `@Data` Lombok cho entity?

→ 3 lý do: (1) `toString()` bidirectional → stack overflow, (2) `equals/hashCode` resolve lazy field → N+1, (3) hashCode đổi sau khi id được assign → Set mất tracking.

**Câu 8 (mới):** `@PostConstruct` chạy ở bước nào trong Bean lifecycle? Tại sao `@Transactional` trong `@PostConstruct` không hoạt động?

→ `@PostConstruct` chạy ở **bước 6** (init), TRƯỚC khi Spring proxy hoàn thiện (bước 9). Tại bước 6, `this` = target bean gốc chưa được proxy bọc → `@Transactional` advice chưa apply → method chạy không có transaction. Fix: dùng `ApplicationRunner` (chạy SAU bước 9) hoặc inject `@Lazy self` để gọi qua proxy.

**Câu 9 (mới):** Bạn deploy 3 instance app. `@PostConstruct seedDefaultData()` chạy ở mỗi instance. Vấn đề gì?

→ Race condition khi seed: 3 instance đồng thời check `count == 0` → đều thấy 0 → đều INSERT → duplicate. Fix: dùng Liquibase `<insert>` (chỉ chạy 1 lần qua DATABASECHANGELOG), hoặc DB UNIQUE constraint + try-catch DataIntegrityViolation.

**Câu 10 (mới):** Phân biệt Proxy Spring (JDK Dynamic Proxy vs CGLIB). Khi nào dùng cái nào?

→ JDK Dynamic Proxy: target class IMPLEMENT interface → Spring tạo class mới impl cùng interface, mỗi method gọi tới target. CGLIB: target không có interface → Spring subclass target bằng bytecode. CGLIB không proxy được `final class` / `final method` → AOP fail. Mặc định Spring Boot 2.x dùng CGLIB (`spring.aop.proxy-target-class=true`).

**Câu 11 (mới):** `Propagation.REQUIRES_NEW` khác `REQUIRED` thế nào? Ví dụ CineX dùng `REQUIRES_NEW` ở đâu?

→ `REQUIRED` (default): nếu có tx cha thì dùng, không có thì tạo mới. `REQUIRES_NEW`: LUÔN tạo tx mới, suspend tx cha. CineX dùng `REQUIRES_NEW` cho **AuditLog** — dù business transaction rollback, log audit vẫn phải commit (để debug). Nếu dùng `REQUIRED` thì audit log cũng bị rollback theo → mất dấu vết.

**Câu 12 (mới):** Bạn có method `cleanupExpiredBookings()` chạy mỗi phút. Bạn deploy 3 instance. Mỗi instance đều chạy scheduler riêng → cùng UPDATE 1 booking 3 lần. Cách fix?

→ ShedLock (xem [module-guides/09-booking-explained.md](../module-guides/09-booking-explained.md) section 4.1). ShedLock dùng DB row làm distributed lock — instance nào INSERT lock row trước thì chạy, 2 instance kia skip. Annotation: `@SchedulerLock(name="cleanup", lockAtLeastFor="PT30S", lockAtMostFor="PT5M")`.
