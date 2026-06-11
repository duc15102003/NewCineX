# ShedLock — Chống chạy trùng `@Scheduled` đa instance

> Lib `net.javacrumbs.shedlock:shedlock-spring:5.16.0` — distributed lock cho `@Scheduled` khi deploy nhiều instance.

---

## 1. Vấn đề: `@Scheduled` chạy trùng trên cluster

Service `BookingCleanupScheduler` quét booking HOLDING hết hạn mỗi phút:

```java
@Scheduled(cron = "0 * * * * *")  // mỗi phút giây 0
public void cleanupExpiredHoldings() {
    bookingService.releaseExpiredHoldings();
}
```

Deploy 3 instance (load balancer) → 3 instance đều chạy `@Scheduled` cùng lúc → 3 lần `releaseExpiredHoldings()` → race condition + duplicate notification + lãng phí DB.

---

## 2. Giải pháp: 1 instance lock → các instance khác bỏ qua

ShedLock pattern:
1. Instance A acquire lock trong DB (hoặc Redis/MongoDB)
2. Instance B,C check lock → đã bị giữ → skip
3. A chạy xong → release lock
4. Phút sau: instance nào fast nhất acquire → chạy

→ **Exactly 1 instance** chạy 1 lần.

---

## 3. Cài đặt

### 3.1. build.gradle

```gradle
implementation 'net.javacrumbs.shedlock:shedlock-spring:5.16.0'
implementation 'net.javacrumbs.shedlock:shedlock-provider-jdbc-template:5.16.0'
```

CineX dùng **JDBC provider** vì đã có SQL Server. Có thể dùng Redis/Mongo provider.

### 3.2. Bảng `shedlock`

Liquibase changelog tạo bảng:

```xml
<changeSet id="shedlock-table" author="cinex">
    <sql>
        CREATE TABLE shedlock (
            name VARCHAR(64) NOT NULL,
            lock_until DATETIME2 NOT NULL,
            locked_at DATETIME2 NOT NULL,
            locked_by VARCHAR(255) NOT NULL,
            PRIMARY KEY (name)
        );
    </sql>
</changeSet>
```

### 3.3. Config

```java
@Configuration
@EnableScheduling
@EnableSchedulerLock(defaultLockAtMostFor = "10m")
public class SchedulerConfig {

    @Bean
    public LockProvider lockProvider(DataSource dataSource) {
        return new JdbcTemplateLockProvider(
            JdbcTemplateLockProvider.Configuration.builder()
                .withJdbcTemplate(new JdbcTemplate(dataSource))
                .usingDbTime()  // dùng giờ DB (tránh clock drift giữa các instance)
                .build()
        );
    }
}
```

- `usingDbTime()`: dùng `GETDATE()` của SQL Server thay vì `System.currentTimeMillis()` → tránh clock drift
- `defaultLockAtMostFor = "10m"`: nếu instance crash khi đang lock → lock auto release sau 10 phút

---

## 4. Sử dụng

```java
@Component
@RequiredArgsConstructor
public class BookingCleanupScheduler {

    @Scheduled(cron = "0 * * * * *")  // mỗi phút giây 0
    @SchedulerLock(name = "BookingCleanupScheduler_run",
                   lockAtMostFor = "PT5M",
                   lockAtLeastFor = "PT30S")
    public void cleanupExpiredHoldings() {
        bookingService.releaseExpiredHoldings();
    }
}
```

### `@SchedulerLock` params

| Param | Ý nghĩa |
|---|---|
| `name` | Tên lock unique (cùng tên = cùng lock) |
| `lockAtMostFor` | Tối đa giữ lock (chống deadlock khi crash) — phải > thời gian job thường chạy |
| `lockAtLeastFor` | Tối thiểu giữ lock (chống job chạy quá nhanh ở 2 instance gần như cùng lúc) |

**Quy tắc:**
- `lockAtMostFor` = thời gian job × 5 (safety margin)
- `lockAtLeastFor` = thời gian job dự kiến + tolerance (vd 30s nếu chạy ~5s)

---

## 5. CineX schedulers dùng ShedLock

### 5.1. `BookingCleanupScheduler`

Quét booking HOLDING hết hạn (>15 phút) → set EXPIRED → release seat.

```java
@SchedulerLock(name = "booking-cleanup", lockAtMostFor = "PT5M")
@Scheduled(cron = "0 * * * * *")
public void cleanupExpiredHoldings() { ... }
```

### 5.2. `MovieRunStatusScheduler`

00:01 mỗi ngày → update `MovieRun.status` (SCHEDULED → NOW_SHOWING → ENDED).

```java
@SchedulerLock(name = "movie-run-status", lockAtMostFor = "PT10M")
@Scheduled(cron = "0 1 0 * * *")
public void updateStatus() { ... }
```

### 5.3. `LoyaltyExpirationScheduler`

00:30 mỗi ngày → expire điểm loyalty quá hạn 12 tháng.

```java
@SchedulerLock(name = "loyalty-expire", lockAtMostFor = "PT30M")
@Scheduled(cron = "0 30 0 * * *")
public void expirePoints() { ... }
```

---

## 6. Debug: kiểm tra lock đang giữ

```sql
SELECT * FROM shedlock;
```

| name | lock_until | locked_at | locked_by |
|---|---|---|---|
| booking-cleanup | 2026-06-11 14:01:05 | 2026-06-11 14:00:00 | hostname-instance-1 |

- `lock_until` > NOW → lock đang giữ
- `lock_until` < NOW → lock free, instance kế tiếp acquire được

**Manual release** (chỉ khi cần):
```sql
UPDATE shedlock SET lock_until = GETDATE() WHERE name = 'booking-cleanup';
```

---

## 7. Anti-pattern tránh

### 7.1. ❌ `lockAtMostFor` quá ngắn

```java
@SchedulerLock(name = "heavy-job", lockAtMostFor = "PT30S")
@Scheduled(cron = "0 0 * * * *")
public void heavyJob() {
    // job thật sự chạy 2 phút
}
```

Sau 30s lock auto release → instance B acquire → chạy trùng → race condition.

**Fix:** `lockAtMostFor` ít nhất gấp 5× thời gian thật.

### 7.2. ❌ `@SchedulerLock` không có `name` duplicate

```java
@SchedulerLock(name = "default")  // SAI: trùng với scheduler khác
```

→ 2 scheduler khác nhau chia lock → 1 trong 2 không chạy được.

**Fix:** `name` phải unique, follow convention `<feature>-<action>`.

### 7.3. ❌ Quên `usingDbTime()`

```java
JdbcTemplateLockProvider.Configuration.builder()
    .withJdbcTemplate(new JdbcTemplate(dataSource))
    .build();  // KHÔNG có usingDbTime()
```

Instance A clock 14:00:00, instance B clock 14:00:05 (NTP drift) → instance B acquire trước A vì check theo `System.currentTimeMillis()` lệch giờ.

**Fix:** luôn `.usingDbTime()` — dùng giờ DB single source of truth.

---

## 8. So sánh với alternative

| Approach | Pros | Cons |
|---|---|---|
| **ShedLock** | Dễ setup, native với @Scheduled | Cần bảng phụ |
| **Quartz Cluster** | Feature đầy đủ (retry, history) | Phức tạp, học cong |
| **Redis SETNX manual** | Nhẹ | Code tay nhiều, dễ sai |
| **Bỏ qua** (chấp nhận chạy trùng) | Đơn giản | Race condition, duplicate work |

CineX chọn ShedLock vì balance phù hợp dự án production-grade.

---

## 9. Tham khảo code CineX

| File | Vai trò |
|---|---|
| `common/config/SchedulerConfig.java` | `@EnableSchedulerLock` + `LockProvider` bean |
| `module/booking/service/BookingCleanupScheduler.java` | Quét booking HOLDING hết hạn |
| `module/movie/service/MovieRunStatusScheduler.java` | Update MovieRun status mỗi ngày |
| `db/changelog/changes/001-core-tables.xml` | Bảng `shedlock` |

---

## 10. Câu hỏi tự kiểm tra

1. **Tại sao cần ShedLock khi đã có `@Scheduled`?**
   → `@Scheduled` chạy độc lập trong mỗi instance. Cluster 3 instance → chạy 3 lần. ShedLock chỉ cho 1 instance chạy.

2. **`lockAtMostFor` khác `lockAtLeastFor`?**
   → `lockAtMostFor` = max lock (chống deadlock); `lockAtLeastFor` = min lock (chống job nhanh quá → instance khác cũng acquire).

3. **`.usingDbTime()` để làm gì?**
   → Dùng giờ DB single source thay vì clock từng instance → tránh NTP drift.

4. **ShedLock cần bảng phụ không?**
   → JDBC provider cần bảng `shedlock`. Redis provider dùng key Redis. Mongo provider dùng collection.

5. **Lock auto release khi nào?**
   → Sau `lockAtMostFor` (instance crash khi đang lock). Hoặc khi method scheduled return normally → release ngay.
