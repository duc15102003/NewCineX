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
