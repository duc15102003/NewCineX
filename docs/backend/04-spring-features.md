# Spring Features — Tính năng nâng cao

---

## 1. AOP — Aspect-Oriented Programming

### Là gì?
Tách logic **xuyên suốt** (logging, audit, đo thời gian) ra khỏi business logic. Code chạy **tự động** mà không cần gọi thủ công.

### Ví dụ đời thường
Camera an ninh: tự ghi hình mọi người ra vào. Nhân viên không cần bấm nút ghi. Thêm camera mới → nhân viên không bị ảnh hưởng.

### Không có AOP (thủ công, dễ quên)
```java
public Movie updateMovie(Long id, MovieRequest req) {
    long start = System.currentTimeMillis();                    // ← logging
    log.info("Updating movie {}", id);                          // ← logging
    String oldTitle = movie.getTitle();                         // ← audit

    Movie movie = findById(id);
    movie.setTitle(req.getTitle());
    Movie saved = movieRepo.save(movie);

    auditService.log("movies", id, "title", oldTitle, saved.getTitle()); // ← audit
    long elapsed = System.currentTimeMillis() - start;          // ← logging
    log.info("Updated movie {} in {}ms", id, elapsed);          // ← logging

    return saved;
    // 8 module × 5 method = 40 chỗ viết logging/audit thủ công
    // Quên 1 chỗ = mất audit
}
```

### Có AOP (tự động)
```java
// Aspect — chạy tự động, Service không cần biết
@Aspect
@Component
@Slf4j
public class LoggingAspect {

    @Around("execution(* com.cinex.module..service.*Service.*(..))")
    //       ↑ Pointcut: tất cả method trong *Service
    public Object logExecutionTime(ProceedingJoinPoint joinPoint) throws Throwable {
        String methodName = joinPoint.getSignature().toShortString();
        long start = System.currentTimeMillis();

        log.info("→ {}", methodName);                              // trước
        Object result = joinPoint.proceed();                        // chạy method gốc
        long elapsed = System.currentTimeMillis() - start;
        log.info("← {} completed in {}ms", methodName, elapsed);   // sau

        return result;
    }
}

// Service — sạch sẽ, CHỈ có business logic
public Movie updateMovie(Long id, MovieRequest req) {
    Movie movie = findById(id);
    movie.setTitle(req.getTitle());
    return movieRepo.save(movie);
    // Logging/audit TỰ ĐỘNG bởi Aspect
}
```

### Thuật ngữ AOP

| Thuật ngữ | Nghĩa | Ví dụ |
|---|---|---|
| **Aspect** | Class chứa logic cross-cutting | `LoggingAspect`, `AuditAspect` |
| **Pointcut** | "Ở đâu" — chọn method nào bị chặn | `execution(* ..service.*Service.*(..))` |
| **Advice** | "Làm gì" — code chạy khi bị chặn | `@Around`, `@Before`, `@After` |
| **JoinPoint** | Điểm cụ thể đang bị chặn | `MovieService.updateMovie()` |

### Các loại Advice

```java
@Before("pointcut")       // Chạy TRƯỚC method
public void before() { log.info("Bắt đầu"); }

@After("pointcut")        // Chạy SAU method (dù success hay fail)
public void after() { log.info("Kết thúc"); }

@AfterReturning("pointcut") // Chạy SAU method THÀNH CÔNG
public void afterOk() { log.info("Thành công"); }

@AfterThrowing("pointcut")  // Chạy SAU method NÉM EXCEPTION
public void afterError() { log.info("Lỗi"); }

@Around("pointcut")       // Bao quanh: TRƯỚC + SAU (linh hoạt nhất)
public Object around(ProceedingJoinPoint jp) {
    // code trước
    Object result = jp.proceed();  // chạy method gốc
    // code sau
    return result;
}
```

### Trong CineX — Audit Log

```java
@Aspect
@Component
public class AuditAspect {

    @Around("execution(* com.cinex.module..service.*Service.update*(..))")
    public Object auditUpdate(ProceedingJoinPoint jp) throws Throwable {
        // Trước: lấy giá trị cũ
        Object result = jp.proceed();  // chạy update
        // Sau: ghi audit log (entity nào, field nào thay đổi, ai sửa)
        auditLogService.log(...);
        return result;
    }
}
```

---

## 2. @Scheduled — Job chạy tự động

### Là gì?
Đánh dấu method để chạy **tự động** theo lịch, không cần ai gọi.

### Ví dụ đời thường
Robot hút bụi: cứ 2 tiếng tự chạy. Đồng hồ báo thức: 6h sáng kêu.

### Kích hoạt

```java
@SpringBootApplication
@EnableScheduling       // ← BẬT tính năng scheduled
public class CineXApplication { }
```

### fixedRate — Cứ X giây chạy 1 lần

```java
@Component
public class BookingCleanupScheduler {

    @Scheduled(fixedRate = 60000)  // 60000ms = 60 giây = 1 phút
    public void releaseExpiredHolds() {
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(10);
        List<Booking> expired = bookingRepo.findByStatusAndCreatedAtBefore("HOLDING", cutoff);

        for (Booking booking : expired) {
            booking.setStatus("EXPIRED");
            bookingSeatRepo.cancelByBookingId(booking.getId());
        }

        if (!expired.isEmpty()) {
            log.info("Released {} expired holds", expired.size());
        }
    }
    // Chạy mỗi phút, tìm booking HOLDING > 10 phút → hủy
    // User bỏ đi không thanh toán → ghế tự trở lại trống
}
```

### fixedDelay — Chờ xong + X giây mới chạy tiếp

```java
@Scheduled(fixedDelay = 60000)
// fixedRate: cứ 60s chạy, kể cả lần trước chưa xong → có thể chồng chéo
// fixedDelay: lần trước XONG + chờ 60s → mới chạy tiếp → không chồng chéo
```

### Cron expression — Chạy theo lịch cụ thể

```java
@Scheduled(cron = "0 0 2 * * ?")    // 2:00 AM mỗi ngày
public void dailyCleanup() { }

@Scheduled(cron = "0 */5 * * * ?")  // Mỗi 5 phút
public void everyFiveMinutes() { }

@Scheduled(cron = "0 0 9-17 * * MON-FRI")  // 9h-17h thứ 2-6, mỗi giờ
public void businessHours() { }
```

**Đọc cron:**
```
┌───── giây (0-59)
│ ┌───── phút (0-59)
│ │ ┌───── giờ (0-23)
│ │ │ ┌───── ngày tháng (1-31)
│ │ │ │ ┌───── tháng (1-12)
│ │ │ │ │ ┌───── thứ (0-7, 0=7=CN)
│ │ │ │ │ │
0 0 2 * * ?   = 2:00 AM mỗi ngày
0 */5 * * * ? = mỗi 5 phút
```

---

## 3. Spring Events — Publish/Subscribe

### Là gì?
Một module **publish** sự kiện → các module khác **subscribe** và xử lý. Không cần biết nhau.

### Bước 1: Tạo Event class

```java
@Getter
@AllArgsConstructor
public class BookingConfirmedEvent {
    private final Booking booking;
    private final Long userId;
}
```

### Bước 2: Publish event

```java
@Service
@RequiredArgsConstructor
public class BookingService {
    private final ApplicationEventPublisher eventPublisher;

    public void confirmBooking(Long bookingId) {
        Booking booking = findById(bookingId);
        booking.setStatus("CONFIRMED");
        bookingRepo.save(booking);

        // Publish — KHÔNG biết ai đang nghe, KHÔNG coupling
        eventPublisher.publishEvent(new BookingConfirmedEvent(booking, booking.getUserId()));
    }
}
```

### Bước 3: Subscribe (Listener)

```java
// Listener 1: Gửi notification — FILE RIÊNG
@Component
public class NotificationListener {
    @EventListener
    public void onBookingConfirmed(BookingConfirmedEvent event) {
        notificationService.create(event.getUserId(), "Booking confirmed: " + event.getBooking().getBookingCode());
    }
}

// Listener 2: Ghi audit log — FILE RIÊNG
@Component
public class AuditListener {
    @EventListener
    public void onBookingConfirmed(BookingConfirmedEvent event) {
        auditLogService.log("bookings", event.getBooking().getId(), "CONFIRMED");
    }
}

// Thêm Listener 3: Gửi email — TẠO FILE MỚI, KHÔNG sửa BookingService
@Component
public class EmailListener {
    @EventListener
    public void onBookingConfirmed(BookingConfirmedEvent event) {
        emailService.sendConfirmation(event.getBooking());
    }
}
```

### Tại sao cần?
- **Decouple:** BookingService không import EmailService, NotificationService
- **Mở rộng:** Thêm listener mới KHÔNG sửa code cũ
- **Dễ test:** Test BookingService riêng, test listener riêng

---

## 4. Cache-aside Pattern — Đọc cache trước DB

### Là gì?
Đọc **cache (nhanh)** trước, không có → đọc **DB (chậm)** → ghi vào cache cho lần sau.

### Ví dụ đời thường
Tủ lạnh (cache) và chợ (DB):
- Cần trứng → mở tủ lạnh → **có** → dùng luôn (**cache hit** — nhanh)
- Cần thịt → mở tủ lạnh → **hết** → ra chợ mua → cất vào tủ lạnh (**cache miss** → DB → ghi cache)

### Trong CineX — System Config

```java
@Service
public class SystemConfigService {
    private final Map<String, String> cache = new ConcurrentHashMap<>();
    // ↑ Cache trong memory (ConcurrentHashMap = thread-safe)

    public String getString(String key, String defaultValue) {
        // 1. Đọc cache trước (O(1), cực nhanh)
        if (cache.containsKey(key)) {
            return cache.get(key);            // ← CACHE HIT
        }

        // 2. Cache miss → đọc DB (chậm hơn)
        SystemConfig config = configRepo.findByConfigKey(key).orElse(null);
        if (config == null) return defaultValue;

        // 3. Ghi vào cache cho lần sau
        cache.put(key, config.getConfigValue());
        return config.getConfigValue();
    }

    public int getInt(String key, int defaultValue) {
        String value = getString(key, null);
        return value != null ? Integer.parseInt(value) : defaultValue;
    }

    // Admin sửa config → xóa cache → lần đọc tiếp sẽ đọc DB mới
    public void updateConfig(String key, String value) {
        configRepo.save(new SystemConfig(key, value));
        cache.remove(key);                    // ← CACHE INVALIDATION
    }
}

// Sử dụng
int holdMinutes = configService.getInt("booking.hold_minutes", 10);
int maxSeats = configService.getInt("booking.max_seats", 8);
// Lần 1: đọc DB → cache. Lần 2+: đọc cache → nhanh ×1000
```

### Cache Invalidation — Khi nào xóa cache?
- Admin sửa config → `cache.remove(key)`
- Entity bị update/delete → xóa cache liên quan
- **Khó nhất trong lập trình:** "Chỉ có 2 thứ khó: đặt tên biến và cache invalidation"

---

## 11. AOP Proxy Mechanism — Cốt lõi để hiểu "magic" của Spring

### 11.1. Tại sao cần proxy?
Khi bạn viết:
```java
@Service
public class PaymentService {
    @Transactional
    public void pay(Long id) { /* ... */ }
}
```
Spring KHÔNG sửa bytecode của `PaymentService`. Thay vào đó, Spring tạo ra một **đối tượng trung gian (proxy)** đứng giữa caller và `PaymentService` thật. Proxy này có cùng "hình dạng" với `PaymentService` nhưng mỗi khi gọi `pay()` thì proxy chạy thêm logic mở/đóng transaction trước-sau khi gọi method thật.

**Ví dụ đời thường:** Bạn gọi điện cho giám đốc, nhưng tổng đài viên (proxy) bắt máy trước, ghi nhận cuộc gọi, rồi mới chuyển máy cho giám đốc. Khi giám đốc nói xong, tổng đài viên tổng kết cuộc gọi rồi mới ngắt máy. Bạn tưởng là gọi thẳng giám đốc, thực ra luôn đi qua tổng đài.

### 11.2. Hai loại proxy
| Loại | Khi nào dùng | Cơ chế |
|---|---|---|
| **JDK Dynamic Proxy** | Target class có **implement interface** | Tạo class mới implement cùng interface, delegate sang target |
| **CGLIB** | Target là **class concrete** không có interface | Tạo subclass kế thừa target, override mọi method public |

**Spring Boot từ 2.0 mặc định dùng CGLIB** cho mọi bean, kể cả khi có interface (đặt `spring.aop.proxy-target-class=true`). Lý do: nhất quán, tránh bug khi inject bằng class cụ thể thay vì interface.

### 11.3. Sơ đồ proxy

```
                      [External call]
                            │
                            ▼
        ┌──────────────────────────────────────┐
        │  Proxy (CGLIB subclass)              │
        │                                      │
        │  pay(id) {                           │
        │     beginTransaction();   ◄─ advice  │
        │     target.pay(id);       ◄─ thật    │
        │     commitTransaction();  ◄─ advice  │
        │  }                                   │
        └──────────────────────────────────────┘
                            │
                            ▼
        ┌──────────────────────────────────────┐
        │  Target: PaymentService (bean thật)  │
        │                                      │
        │  pay(id) { /* business logic */ }    │
        └──────────────────────────────────────┘
```

Khi bạn `@Autowired PaymentService`, Spring inject **proxy** chứ không phải target. Đó là lý do `@Transactional`, `@Async`, `@Cacheable`, `@PreAuthorize`... mới hoạt động.

### 11.4. Self-invocation problem — Bug kinh điển

Đây là cái bẫy mà 99% dev Spring đã từng dính.

```java
@Service
public class PaymentService {

    public void payAndAudit(Long id) {
        pay(id);           // 1. Trả tiền
        this.audit(id);    // 2. Ghi audit log — GỌI TRỰC TIẾP
    }

    @Transactional
    public void audit(Long id) {
        auditRepo.save(new AuditLog(id, "PAID"));
    }
}
```

**Mong đợi:** `audit()` chạy trong transaction riêng.
**Thực tế:** KHÔNG có transaction nào được tạo. Nếu DB lỗi, không rollback. `@Transactional` bị **bỏ qua âm thầm**.

**Tại sao?** `this` trỏ tới **target object thật**, không phải proxy. Mà advice của `@Transactional` chỉ nằm trong proxy. Lệnh `this.audit(id)` bypass proxy → không có `beginTransaction()`.

```
[External]
    │
    ▼
[Proxy.payAndAudit()]                ← Proxy ở đây
    │
    ▼
[Target.payAndAudit()]
    │
    ▼ this.audit(id)
[Target.audit()]                     ← KHÔNG ĐI QUA PROXY → @Transactional vô tác dụng
```

### 11.5. Ba cách fix self-invocation

**Cách 1: Inject chính mình** (xấu, nhưng đôi khi cần)
```java
@Service
public class PaymentService {

    @Autowired
    @Lazy   // tránh circular dependency lúc startup
    private PaymentService self;

    public void payAndAudit(Long id) {
        pay(id);
        self.audit(id);    // ← đi qua proxy
    }

    @Transactional
    public void audit(Long id) { /* ... */ }
}
```

**Cách 2: Tách bean (best practice — tuân thủ SRP)**
```java
@Service
public class PaymentService {
    private final AuditService auditService;

    public void payAndAudit(Long id) {
        pay(id);
        auditService.audit(id);   // ← Inject bean khác → đi qua proxy của AuditService
    }
}

@Service
public class AuditService {
    @Transactional
    public void audit(Long id) { /* ... */ }
}
```

**Cách 3: AspectJ Load-Time Weaving** (nâng cao, hiếm dùng)
- Dùng `aspectjweaver` agent: bytecode bị "vá" trực tiếp lúc class load → mọi call đều có advice, không phụ thuộc proxy.
- Cấu hình phức tạp, chỉ dùng khi project lớn cần performance cao.

### 11.6. Quy tắc vàng để tránh bug AOP
1. `@Transactional`, `@Async`, `@Cacheable` chỉ chạy khi gọi từ bean khác.
2. KHÔNG gọi `this.methodCoAnnotation()` trong cùng class.
3. KHÔNG đặt các annotation trên `private` / `final` method (CGLIB không override được).
4. KHÔNG đặt trên constructor (constructor chạy trước khi proxy được tạo).

---

## 12. @EnableAsync và @Async — Deep Dive

### 12.1. Nguyên tắc cơ bản
- `@EnableAsync` đặt trên class config (CineX đặt trên `CineXApplication.java`). Nếu thiếu → `@Async` bị bỏ qua **âm thầm** (không lỗi build, code vẫn chạy nhưng sync).
- `@Async` đặt trên method `public`. Khi gọi, Spring chuyển method sang chạy ở **thread khác** trong thread pool, return ngay cho caller.

**File CineX:** `CineXApplication.java` đã có sẵn:
```java
@SpringBootApplication
@EnableScheduling
@EnableAsync
public class CineXApplication { ... }
```

### 12.2. Default Executor — Nguy hiểm khi production

Nếu bạn không cấu hình executor, Spring dùng **`SimpleAsyncTaskExecutor`**:
- KHÔNG có thread pool.
- Mỗi lần gọi `@Async` → tạo **một thread mới**.
- 1000 request/giây → 1000 thread Java → tốn memory (~1MB/thread stack) → server crash.

**Đây là lý do bạn PHẢI cấu hình executor custom trong production.**

### 12.3. Cấu hình TaskExecutor chuẩn

```java
@Configuration
public class AsyncConfig implements AsyncConfigurer {

    @Override
    @Bean(name = "taskExecutor")
    public Executor getAsyncExecutor() {
        ThreadPoolTaskExecutor exec = new ThreadPoolTaskExecutor();
        exec.setCorePoolSize(4);          // 4 thread luôn sẵn sàng
        exec.setMaxPoolSize(16);          // tối đa 16 thread khi bận
        exec.setQueueCapacity(200);       // queue 200 job khi pool đầy
        exec.setThreadNamePrefix("cinex-async-");
        exec.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        // Khi queue cũng đầy → chạy luôn trên thread caller (degrade chứ không drop)
        exec.initialize();
        return exec;
    }

    @Override
    public AsyncUncaughtExceptionHandler getAsyncUncaughtExceptionHandler() {
        // Bắt exception trong @Async void — nếu không bắt thì exception bị nuốt mất
        return (ex, method, params) ->
            log.error("Async error in {}: {}", method.getName(), ex.getMessage(), ex);
    }
}
```

**Tham số thread pool đời thường:** Coi pool như quầy bán vé rạp phim:
- `corePoolSize = 4`: 4 quầy luôn mở.
- `maxPoolSize = 16`: lúc cao điểm mở thêm tới 16 quầy.
- `queueCapacity = 200`: 200 chỗ xếp hàng. Hết chỗ → áp dụng policy (CallerRuns = bắt khách tự bán vé, AbortPolicy = đuổi khách về).

### 12.4. CompletableFuture vs void return

| Kiểu return | Khi nào dùng |
|---|---|
| `void` | Fire-and-forget. Gửi email, ghi log, không cần biết kết quả. |
| `CompletableFuture<T>` | Caller cần kết quả hoặc cần đợi xong. Có thể `.thenCompose()`, `.thenCombine()` để chain. |

```java
@Async
public CompletableFuture<byte[]> generateReport(Long bookingId) {
    byte[] pdf = heavyPdfGeneration(bookingId);
    return CompletableFuture.completedFuture(pdf);
}

// Caller:
CompletableFuture<byte[]> f1 = reportService.generateReport(1L);
CompletableFuture<byte[]> f2 = reportService.generateReport(2L);
CompletableFuture.allOf(f1, f2).join();   // đợi cả 2 xong
```

### 12.5. Cảnh báo `@Async` thường gặp
- Đặt trên `private` method → **không hoạt động** (CGLIB không override).
- Gọi `this.asyncMethod()` trong cùng class → **không hoạt động** (self-invocation, xem §11.4).
- Return `void` mà bên trong throw exception → exception bị nuốt. Phải có `AsyncUncaughtExceptionHandler`.
- Spring Security context **không tự propagate** sang thread con → bạn không lấy được user trong `@Async`. Phải config `DelegatingSecurityContextAsyncTaskExecutor`.

### 12.6. Áp dụng trong CineX
File `PaymentEventListener.handlePaymentCompleted()`:
```java
@Async
@EventListener
public void handlePaymentCompleted(PaymentCompletedEvent event) {
    // Gửi email + tạo notification
}
```
**Tác dụng:** User trả tiền xong → `/api/payments/confirm` return 200 **ngay lập tức** trong ~50ms. Việc gửi email (mất 1-2 giây vì SMTP) chạy ngầm ở thread `cinex-async-1`. User không phải đợi.

---

## 13. @TransactionalEventListener — AFTER_COMMIT vs AFTER_ROLLBACK

### 13.1. Bug kinh điển của @EventListener thường

```java
@Service
public class PaymentService {
    @Transactional
    public void confirmPayment(Long bookingId) {
        booking.setStatus(CONFIRMED);
        bookingRepo.save(booking);
        eventPublisher.publishEvent(new PaymentCompletedEvent(payment));
        //                            ↑ publish ở đây, transaction CHƯA commit
        throwIfSomethingWrong();       // ← Nếu lỗi ở đây → ROLLBACK
    }
}

@Component
public class PaymentEventListener {
    @EventListener
    public void onPaid(PaymentCompletedEvent e) {
        // 1. Lúc này transaction publisher CHƯA commit
        // 2. Listener gửi email "Vé đã xác nhận"
        // 3. Sau đó publisher rollback → DB không có booking CONFIRMED
        // 4. Nhưng user đã nhận email → user khiếu nại "tôi có vé mà sao vào rạp không có?"
        emailService.send(...);
    }
}
```

**Vấn đề:** `@EventListener` thường chạy **đồng bộ trong transaction của publisher**. Nếu publisher rollback, listener đã chạy rồi → side effect không thể undo (email đã gửi đi rồi).

### 13.2. Giải pháp: @TransactionalEventListener

```java
@Component
public class PaymentEventListener {
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onPaid(PaymentCompletedEvent e) {
        emailService.send(...);   // Chỉ chạy khi transaction commit thành công
    }
}
```

### 13.3. Bốn phase

| Phase | Khi nào chạy | Use case |
|---|---|---|
| `BEFORE_COMMIT` | Trước khi commit, sau khi business logic xong | Validate cross-entity trước commit |
| `AFTER_COMMIT` | **Sau khi commit thành công** | Gửi email, push notification, sync sang service khác |
| `AFTER_ROLLBACK` | Khi transaction rollback | Log lỗi, alert, undo side effect |
| `AFTER_COMPLETION` | Commit hoặc rollback đều chạy | Cleanup resource |

### 13.4. Áp dụng đúng trong CineX

Hiện tại `PaymentEventListener` dùng `@EventListener + @Async`. Cải tiến đúng nên là:

```java
@Component
public class PaymentEventListener {

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handlePaymentCompleted(PaymentCompletedEvent event) {
        // 1. AFTER_COMMIT → đảm bảo booking đã thực sự CONFIRMED trong DB
        // 2. @Async → chạy thread khác, không block transaction commit
        emailService.sendBookingConfirmationEmail(...);
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_ROLLBACK)
    public void handlePaymentRolledBack(PaymentCompletedEvent event) {
        log.warn("Payment {} rolled back — refund initiated", event.getPayment().getId());
        refundService.scheduleRefund(event.getPayment());
    }
}
```

**Lý do kết hợp `@Async` + `@TransactionalEventListener(AFTER_COMMIT)`:**
- `AFTER_COMMIT` đảm bảo **tính đúng đắn** (commit xong mới gửi mail).
- `@Async` đảm bảo **tốc độ** (không block thread DB sau commit).

### 13.5. Khi nào dùng @EventListener thường?
- Khi event không có side effect bên ngoài DB (chỉ update cache nội bộ).
- Khi muốn rollback cùng publisher (event listener throw exception → rollback cả publisher).

---

## 14. @Scheduled — Pitfalls khi lên Production

### 14.1. Default scheduler chỉ có 1 thread

Mặc định Spring dùng `ThreadPoolTaskScheduler` với pool size = 1. Hệ quả:
- Hai `@Scheduled` cùng giờ → chạy **tuần tự**, job sau đợi job trước.
- Một job chạy 5 phút → các job khác bị delay 5 phút.

**Ví dụ CineX:** Nếu thêm `@Scheduled` báo cáo daily (chạy lúc 0h), trùng lúc `BookingCleanupScheduler` đang xử lý → cleanup bị delay → khoá ghế lâu hơn user mong đợi.

### 14.2. Cấu hình SchedulerPool

```java
@Configuration
public class SchedulingConfig implements SchedulingConfigurer {

    @Override
    public void configureTasks(ScheduledTaskRegistrar registrar) {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(4);
        scheduler.setThreadNamePrefix("cinex-sched-");
        scheduler.setErrorHandler(t ->
            log.error("Scheduled task failed", t));   // không có cái này → exception bị nuốt
        scheduler.initialize();
        registrar.setTaskScheduler(scheduler);
    }
}
```

### 14.3. Multi-instance deployment — Bug nguy hiểm

Khi production deploy 3 instance (Kubernetes), `@Scheduled` chạy **trên cả 3 instance** → `BookingCleanupScheduler.cleanupExpiredHolds()` chạy 3 lần/phút → 3 lần update cùng row → race condition + log spam.

**Sơ đồ:**
```
Instance A: cleanup() ──┐
Instance B: cleanup() ──┼──► Update cùng 1 row → conflict
Instance C: cleanup() ──┘
```

### 14.4. Giải pháp: ShedLock — Distributed lock cho @Scheduled

**Ý tưởng:** Trước khi chạy, mỗi instance phải "giành" lock trong DB. Chỉ 1 instance giành được → chạy job. Hai instance kia thấy lock → skip.

**Bước 1: Thêm dependency** (`build.gradle`)
```groovy
implementation 'net.javacrumbs.shedlock:shedlock-spring:5.10.0'
implementation 'net.javacrumbs.shedlock:shedlock-provider-jdbc-template:5.10.0'
```

**Bước 2: Tạo table SQL Server** (Liquibase changelog)
```xml
<createTable tableName="shedlock">
    <column name="name" type="VARCHAR(64)"><constraints primaryKey="true"/></column>
    <column name="lock_until" type="DATETIME2(3)"/>
    <column name="locked_at" type="DATETIME2(3)"/>
    <column name="locked_by" type="VARCHAR(255)"/>
</createTable>
```

**Bước 3: Config**
```java
@Configuration
@EnableSchedulerLock(defaultLockAtMostFor = "5m")
public class ShedLockConfig {
    @Bean
    public LockProvider lockProvider(DataSource dataSource) {
        return new JdbcTemplateLockProvider(dataSource);
    }
}
```

**Bước 4: Annotate scheduler**
```java
@Scheduled(fixedRate = 60000)
@SchedulerLock(name = "cleanupExpiredHolds", lockAtMostFor = "55s", lockAtLeastFor = "30s")
@Transactional
public void cleanupExpiredHolds() { /* như cũ */ }
```

**Giải thích tham số:**
- `lockAtMostFor`: lock hết hạn sau 55s kể cả instance crash → instance khác tự take over.
- `lockAtLeastFor`: giữ lock ít nhất 30s để 2 instance không cùng chạy job ngắn liên tục.

### 14.5. initialDelay quan trọng cho job nặng

```java
@Scheduled(fixedRate = 60000, initialDelay = 30000)   // delay 30s
public void heavyJob() { /* ... */ }
```

**Lý do:** Lúc app vừa start, Spring đang init bean, cache chưa warm. Nếu `@Scheduled` chạy ngay → DB chưa sẵn sàng, cache miss hàng loạt → spike load. `initialDelay` cho app "ổn định" trước.

---

## 15. Spring Cache Abstraction — Cách "đúng" dùng Redis

### 15.1. So với cách thủ công

CineX hiện tại dùng `ConcurrentHashMap` trong `SystemConfigService` (xem §10). Cách này OK cho config nhỏ nhưng có hạn chế:
- Cache nằm trong heap → restart app mất cache.
- Multi-instance → mỗi instance có cache riêng → admin sửa config ở instance A, instance B không biết.
- Không có TTL tự động → phải tự code expire.

**Spring Cache + Redis** giải quyết hết:
- Cache nằm trong Redis (shared).
- Có TTL declarative.
- Có annotation, code sạch hơn.

### 15.2. Ba annotation chính

| Annotation | Tác dụng |
|---|---|
| `@Cacheable("movies")` | Đọc cache trước. Hit → return luôn. Miss → gọi method → ghi cache. |
| `@CacheEvict("movies", key = "#id")` | Xóa key khỏi cache. Dùng khi update/delete. |
| `@CachePut("movies", key = "#movie.id")` | Luôn gọi method (không đọc cache), kết quả ghi đè cache. Dùng khi update entity. |

### 15.3. Code mẫu áp dụng cho CineX MovieService

```java
@Service
public class MovieService {

    @Cacheable(value = "movies", key = "#id")
    public MovieResponse getMovie(Long id) {
        // Lần 1: chạy method, ghi Redis. Lần 2-N: skip method, đọc Redis.
        return movieRepo.findById(id).map(mapper::toResponse).orElseThrow();
    }

    @CachePut(value = "movies", key = "#result.id")
    @Transactional
    public MovieResponse updateMovie(Long id, MovieRequest req) {
        Movie m = movieRepo.findById(id).orElseThrow();
        mapper.updateEntity(m, req);
        return mapper.toResponse(movieRepo.save(m));
        // Cache key bằng id của response → cache luôn đồng bộ với DB
    }

    @CacheEvict(value = "movies", key = "#id")
    @Transactional
    public void deleteMovie(Long id) {
        movieRepo.deleteById(id);
    }

    @CacheEvict(value = "movies", allEntries = true)
    @Transactional
    public void importBatch(List<MovieRequest> list) {
        // Sửa hàng loạt → xóa hết cache movies, lần đọc sau load từ DB
    }
}
```

### 15.4. Cấu hình RedisCacheManager với TTL từng cache

```java
@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory cf) {
        RedisCacheConfiguration defaultCfg = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofMinutes(10))
                .serializeValuesWith(SerializationPair.fromSerializer(new GenericJackson2JsonRedisSerializer()));

        Map<String, RedisCacheConfiguration> perCache = Map.of(
                "movies",   defaultCfg.entryTtl(Duration.ofMinutes(30)),
                "showtimes", defaultCfg.entryTtl(Duration.ofMinutes(5)),   // hay thay đổi
                "config",   defaultCfg.entryTtl(Duration.ofHours(1))       // ít thay đổi
        );

        return RedisCacheManager.builder(cf)
                .cacheDefaults(defaultCfg)
                .withInitialCacheConfigurations(perCache)
                .build();
    }
}
```

### 15.5. So sánh với ConcurrentHashMap của CineX

| Tiêu chí | ConcurrentHashMap (CineX hiện tại) | Spring Cache + Redis |
|---|---|---|
| Setup | Tự code, đơn giản | Cần annotation + config |
| Shared across instances | Không (mỗi JVM riêng) | Có (Redis chung) |
| Survives restart | Không | Có |
| TTL tự động | Phải tự code | Khai báo trong config |
| Code sạch | Lẫn cache logic vào service | Chỉ thêm annotation |
| Phù hợp | Config tĩnh, ít, không thay đổi | Mọi loại cache thật sự |

**Khuyến nghị CineX:** Giữ `ConcurrentHashMap` cho `SystemConfigService` (chỉ 5-10 key, hiếm sửa). Dùng Spring Cache cho `MovieService`, `GenreService`, `RoomService` (data nhiều, đọc nhiều, ít sửa).

---

## 16. Thundering Herd / Cache Stampede

### 16.1. Tình huống

Phim hot "Avatar 3" có cache `movies::5` TTL = 30 phút. Đúng giây cache expire, có **1000 user đang xem trang chi tiết** đồng thời:

```
[t = 0s]   Cache expire
[t = 0s]   User 1   → cache miss → query DB
[t = 0.01s] User 2  → cache miss → query DB
[t = 0.02s] User 3  → cache miss → query DB
   ...
[t = 0.5s] User 1000 → cache miss → query DB
```

**1000 query SELECT cùng lúc** → DB CPU 100% → slow → các API khác cũng chậm → cascade failure.

Đây là **thundering herd** (hiệu ứng đàn voi giẫm cùng lúc) hay **cache stampede**.

### 16.2. Cách 1: Mutex lock — Chỉ 1 thread đọc DB

Ý tưởng: User đầu tiên giành lock → query DB → ghi cache. 999 user khác thấy lock → đợi → đọc cache mới.

```java
@Service
@RequiredArgsConstructor
public class MovieService {
    private final RedissonClient redisson;
    private final RedisTemplate<String, MovieResponse> redis;
    private final MovieRepository movieRepo;

    public MovieResponse getMovieSafe(Long id) {
        String cacheKey = "movie:" + id;
        MovieResponse cached = redis.opsForValue().get(cacheKey);
        if (cached != null) return cached;

        RLock lock = redisson.getLock("lock:movie:" + id);
        try {
            // tryLock(thời gian đợi, thời gian giữ lock, đơn vị)
            if (lock.tryLock(3, 5, TimeUnit.SECONDS)) {
                // Double-check: có thể thread khác đã ghi cache xong trong lúc mình đợi
                cached = redis.opsForValue().get(cacheKey);
                if (cached != null) return cached;

                MovieResponse fresh = movieRepo.findById(id)
                        .map(mapper::toResponse).orElseThrow();
                redis.opsForValue().set(cacheKey, fresh, Duration.ofMinutes(30));
                return fresh;
            } else {
                // Không giành được lock trong 3s → fallback đọc DB trực tiếp
                return movieRepo.findById(id).map(mapper::toResponse).orElseThrow();
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException(e);
        } finally {
            if (lock.isHeldByCurrentThread()) lock.unlock();
        }
    }
}
```

### 16.3. Cách 2: Probabilistic Early Expiration (XFetch)

Ý tưởng: Trước khi cache hết hạn, một số request "ngẫu nhiên" được phép refresh sớm → cache không bao giờ thực sự hết hạn đồng loạt.

```java
public MovieResponse getMovieXFetch(Long id) {
    CacheEntry<MovieResponse> e = redisGet(id);
    long now = System.currentTimeMillis();
    // Beta = hệ số xác suất, delta = thời gian tính toán DB query
    if (e != null && now - e.beta * e.delta * Math.log(Math.random()) < e.expiry) {
        return e.value;
    }
    long start = System.currentTimeMillis();
    MovieResponse fresh = movieRepo.findById(id).map(mapper::toResponse).orElseThrow();
    long delta = System.currentTimeMillis() - start;
    redisSet(id, fresh, delta, now + TTL);
    return fresh;
}
```

### 16.4. Cách 3: Refresh-Ahead

Cron job định kỳ refresh các cache key "nóng" trước khi expire:

```java
@Scheduled(fixedRate = 60000)
public void refreshHotMovies() {
    List<Long> hotIds = analyticsService.getTop10MovieIds();
    for (Long id : hotIds) {
        MovieResponse fresh = movieRepo.findById(id).map(mapper::toResponse).orElseThrow();
        redis.opsForValue().set("movie:" + id, fresh, Duration.ofMinutes(30));
    }
}
```

### 16.5. Khi nào dùng cách nào?

| Tình huống | Cách dùng |
|---|---|
| Cache key thông thường, không quá nóng | Mutex lock (đơn giản, đủ tốt) |
| Có hàng nghìn user/giây cho 1 key | XFetch (math-heavy nhưng smooth) |
| Biết trước key nào nóng (top phim, hot deal) | Refresh-ahead |

---

## 17. Pointcut Expression — Bộ chọn cho AOP

### 17.1. Cấu trúc `execution()`

```
execution(modifier? return-type declaring-type?.method-name(param) throws?)
```

Ví dụ giải nghĩa từng phần:
```
execution(* com.cinex.module.*.service.*.*(..))
         ↑  ↑                          ↑ ↑
         │  │                          │ └─ tham số bất kỳ
         │  │                          └── method bất kỳ
         │  └── package: com.cinex.module.<bất kỳ>.service.<bất kỳ class>
         └── return type bất kỳ
```

→ Áp dụng aspect cho **mọi method của mọi service trong mọi module**.

### 17.2. Các loại pointcut designator phổ biến

| Designator | Ý nghĩa | Ví dụ |
|---|---|---|
| `execution(...)` | Match method theo signature | `execution(* getMovie(..))` |
| `within(type)` | Match mọi method trong type | `within(com.cinex.module.payment..*)` |
| `@annotation(A)` | Method có annotation A | `@annotation(com.cinex.common.audit.Audit)` |
| `@within(A)` | Method trong class có annotation A | `@within(org.springframework.stereotype.Service)` |
| `args(...)` | Match theo kiểu tham số | `args(Long, String)` |
| `bean(name)` | Match theo tên bean | `bean(paymentService)` |

### 17.3. Custom annotation + @annotation pointcut

**Bước 1:** Khai báo annotation
```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Audit {
    String action() default "";
}
```

**Bước 2:** Aspect bắt mọi method có `@Audit`
```java
@Aspect
@Component
@RequiredArgsConstructor
@Slf4j
public class AuditAspect {

    private final AuditLogRepository auditRepo;

    @Around("@annotation(com.cinex.common.audit.Audit) && @annotation(audit)")
    public Object logAction(ProceedingJoinPoint pjp, Audit audit) throws Throwable {
        String user = SecurityContextHolder.getContext().getAuthentication().getName();
        long start = System.currentTimeMillis();
        try {
            Object result = pjp.proceed();
            auditRepo.save(new AuditLog(user, audit.action(), "SUCCESS",
                    System.currentTimeMillis() - start));
            return result;
        } catch (Throwable t) {
            auditRepo.save(new AuditLog(user, audit.action(), "FAIL: " + t.getMessage(),
                    System.currentTimeMillis() - start));
            throw t;
        }
    }
}
```

**Bước 3:** Dùng
```java
@Audit(action = "CONFIRM_PAYMENT")
public void confirmPayment(Long id) { /* ... */ }
```

### 17.4. Combine pointcut với `&&`, `||`, `!`

```java
// Mọi service trong module payment, nhưng KHÔNG phải method query
@Around("within(com.cinex.module.payment.service..*) && !execution(* find*(..)) && !execution(* get*(..))")
public Object aroundWriteOps(ProceedingJoinPoint pjp) throws Throwable { ... }
```

### 17.5. @Order — Chain nhiều aspect

```java
@Aspect @Order(1) public class SecurityAspect { ... }   // chạy ngoài cùng
@Aspect @Order(2) public class AuditAspect    { ... }
@Aspect @Order(3) public class CacheAspect    { ... }   // chạy trong cùng
```

Thứ tự gọi: `Security → Audit → Cache → target → Cache → Audit → Security` (vào số nhỏ trước, ra số nhỏ sau).

---

## 18. Distributed Lock với Redisson — Booking ghế thật sự thread-safe

### 18.1. Vấn đề

Hai user cùng bấm "Đặt ghế A1" trong showtime 1 tại cùng giây:
```
[Thread 1] check ghế A1 chưa hold → còn trống
[Thread 2] check ghế A1 chưa hold → còn trống   ← race condition
[Thread 1] save booking A1
[Thread 2] save booking A1                       ← cả 2 đều có ghế A1!
```

CineX có cơ chế `@Version` (optimistic lock) cho `BookingSeat` nhưng vẫn cần lock **trước khi tạo booking** để tránh tạo nhầm.

### 18.2. Code mẫu với Redisson

```java
@Service
@RequiredArgsConstructor
public class BookingService {

    private final RedissonClient redisson;
    private final BookingRepository bookingRepo;
    private final BookingSeatRepository seatRepo;

    @Transactional
    public BookingResponse createBooking(BookingRequest req) {
        // Lock theo showtime — tất cả seat trong cùng showtime đều dùng chung lock
        String lockKey = "lock:showtime:" + req.getShowtimeId();
        RLock lock = redisson.getLock(lockKey);

        try {
            // tryLock(waitTime, leaseTime, unit):
            // - waitTime = 10s: đợi tối đa 10s để giành lock
            // - leaseTime = 30s: giữ lock tối đa 30s (auto release nếu mình crash)
            boolean acquired = lock.tryLock(10, 30, TimeUnit.SECONDS);
            if (!acquired) {
                throw new BusinessException(ErrorCode.SYSTEM_BUSY);
            }

            // ⚠ Trong block này CHỈ có 1 thread chạy với lockKey này
            // → Check ghế + insert booking an toàn
            validateSeatsAvailable(req.getSeatIds(), req.getShowtimeId());
            Booking booking = buildBooking(req);
            bookingRepo.save(booking);
            return mapper.toResponse(booking);

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BusinessException(ErrorCode.SYSTEM_BUSY);
        } finally {
            if (lock.isHeldByCurrentThread()) {
                lock.unlock();    // ⚠ BẮT BUỘC trong finally
            }
        }
    }
}
```

### 18.3. Các lỗi thường gặp

| Lỗi | Hậu quả | Cách tránh |
|---|---|---|
| Quên `unlock()` | Lock kẹt mãi → mọi booking sau timeout | Luôn dùng `finally { unlock(); }` |
| Không check `isHeldByCurrentThread()` | Thread A unlock lock của thread B → IllegalMonitorStateException | Kiểm tra trước unlock |
| `leaseTime` quá ngắn | Lock auto-release giữa chừng → mất tác dụng | Set lớn hơn thời gian xử lý max |
| `leaseTime` quá dài | App crash → lock kẹt lâu → user chờ lâu | 30-60s là vừa |
| Lock quá rộng (lock theo cinema) | Throughput thấp | Lock theo entity nhỏ nhất hợp lý (showtime, seat) |

### 18.4. Redisson distributed lock vs Database pessimistic lock

| Tiêu chí | Redisson `RLock` | `@Lock(PESSIMISTIC_WRITE)` |
|---|---|---|
| Storage | Redis | DB row lock |
| Performance | Rất nhanh (~1ms) | Chậm hơn (~10ms) |
| TTL/Auto release | Có | Không (phụ thuộc transaction) |
| Cần thêm hạ tầng | Cần Redis | Có sẵn (DB) |
| Cross-service | Có (Redis chung) | Chỉ trong cùng DB |
| Đảm bảo ACID | Không (cần code cẩn thận) | Có (DB transaction) |

**Quy tắc chọn:**
- **Booking ghế, hold tạm thời** → Redisson (cần nhanh, cross-service trong tương lai).
- **Trừ tiền ví, giảm tồn kho snack** → Pessimistic lock DB (cần ACID tuyệt đối).
- **Update phim, cập nhật thông tin user** → Optimistic lock `@Version` (ít conflict).

### 18.5. Sơ đồ lifecycle của Redisson lock

```
[Thread 1] tryLock(showtime:5) ──┐
                                 ▼
                          ┌─────────────┐
                          │ Redis       │
                          │ lock:show:5 │ ← Thread 1 giành được
                          │ owner=t1    │
                          │ expire=30s  │
                          └─────────────┘
                                 ▲
[Thread 2] tryLock(showtime:5) ──┘ ← đợi tới 10s
                                   ← khi t1 unlock hoặc TTL hết
                                   ← thì t2 vào được

[Thread 1] unlock() ─► Redis xoá key ─► Thread 2 acquired
```

---

## 19. Tổng kết — Khi nào dùng feature nào?

| Vấn đề | Feature dùng |
|---|---|
| Method cần transaction | `@Transactional` (nhớ proxy, tránh self-invocation) |
| Tác vụ chạy ngầm không cần kết quả | `@Async` + `@EnableAsync` + custom executor |
| Event listener chỉ chạy sau commit | `@TransactionalEventListener(AFTER_COMMIT)` |
| Job chạy theo giờ | `@Scheduled` (production: ShedLock) |
| Cache đơn giản, ít key | `ConcurrentHashMap` thủ công |
| Cache nhiều, multi-instance | `@Cacheable` + Redis |
| Cache 1 key cực nóng | Mutex lock chống stampede |
| Logging cross-cutting | `@Aspect` + `@annotation()` pointcut |
| Lock cross-instance | Redisson `RLock` |
| Lock ACID nghiêm ngặt | DB pessimistic lock |
