# Database — Kỹ thuật cơ sở dữ liệu

---

## 1. Optimistic Locking (@Version)

### Là gì?
2 người sửa cùng 1 record cùng lúc → người save **sau** bị lỗi thay vì ghi đè im lặng.

### Ví dụ đời thường
Google Docs: 2 người edit cùng file → người save sau được cảnh báo "conflict".

### Cách hoạt động
```
Người A đọc movie (version=5)
Người B đọc movie (version=5)
Người A save → UPDATE ... WHERE id=1 AND version=5 → OK, version thành 6
Người B save → UPDATE ... WHERE id=1 AND version=5 → 0 rows (version đã là 6) → LỖI
```

```java
@Version
private Long version; // BaseEntity — tất cả entity đều có
```

### Dùng khi: Ít conflict (sửa profile, sửa phim)

---

## 2. Pessimistic Locking

### Là gì?
**Khóa row trong DB** ngay khi đọc, người khác phải chờ.

### Ví dụ đời thường
Phòng thay đồ: 1 người vào → khóa cửa → người khác đứng ngoài chờ.

### Trong CineX — Chọn ghế
```
User A chọn ghế E5 → SELECT ... FOR UPDATE (LOCK) → khóa row E5
User B chọn ghế E5 → SELECT ... FOR UPDATE → PHẢI CHỜ
User A tạo booking → COMMIT → mở khóa
User B được vào → kiểm tra: ghế đã HELD → trả lỗi "Ghế đã được chọn"
```

```java
@Lock(LockModeType.PESSIMISTIC_WRITE)
List<Seat> findByIdIn(List<Long> ids);
```

### Dùng khi: Nhiều conflict (chọn ghế, thanh toán)

### So sánh

| | Optimistic | Pessimistic |
|---|---|---|
| Khóa khi | Save (cuối) | Đọc (ngay đầu) |
| Ai chờ | Không ai, conflict → lỗi | Người thứ 2 CHỜ |
| Performance | Nhanh | Chậm hơn |
| Dùng khi | Ít conflict | Nhiều conflict |

---

## 3. Transaction (ACID)

### Là gì?
Nhóm thao tác hoặc **tất cả thành công** hoặc **tất cả rollback**, không nửa vời.

### Ví dụ đời thường
Chuyển tiền: trừ A + cộng B phải cùng thành công. Trừ A mà cộng B lỗi → hoàn tiền A.

### ACID

| Chữ | Nghĩa | Ví dụ |
|---|---|---|
| **A** — Atomicity | Tất cả hoặc không | Hold 3 ghế, ghế 3 trùng → rollback cả 3 |
| **C** — Consistency | DB luôn hợp lệ | Tổng ghế trống + đã đặt = tổng ghế phòng |
| **I** — Isolation | Transaction không thấy nhau | User A hold ghế → User B không thấy "nửa hold" |
| **D** — Durability | Commit xong không mất | Server crash → khởi động lại vẫn còn booking |

```java
@Transactional // tất cả trong method = 1 transaction
public Booking holdSeats(Long userId, HoldSeatsRequest request) {
    // Nếu bất kỳ bước nào lỗi → rollback tất cả
}
```

---

## 4. Soft Delete

### Là gì?
Xóa = **đổi trạng thái**, không DELETE thật. Data vẫn còn, có thể khôi phục.

### Ví dụ đời thường
Thùng rác máy tính: xóa file → vào thùng rác (chưa mất hẳn).

```java
// ĐÚNG
movie.setStorageState(StorageState.ARCHIVED); // data vẫn còn

// SAI
movieRepo.deleteById(id); // MẤT VĨNH VIỄN
```

> Lưu ý: CineX dùng enum `StorageState` chỉ có 2 giá trị: `ACTIVE` (đang dùng) và `ARCHIVED` (đã "xóa" mềm). Không có `DELETED`.

---

## 5. N+1 Problem

### Là gì?
Load danh sách entity có quan hệ → JPA chạy **1 query danh sách + N query quan hệ** = N+1 query.

### Ví dụ đời thường
Hỏi lớp trưởng "danh sách 40 học sinh" (1 câu) → hỏi TỪNG NGƯỜI "điểm toán?" (40 câu) = 41 câu.

### Bị N+1
```java
List<Movie> movies = movieRepo.findAll(); // 1 query
for (Movie m : movies) {
    m.getGenres(); // MỖI phim 1 query → 20 phim = 21 query!
}
```

### Fix N+1
```java
// Cách 1: JOIN FETCH
@Query("SELECT m FROM Movie m JOIN FETCH m.genres")
List<Movie> findAllWithGenres(); // 1 query DUY NHẤT

// Cách 2: @EntityGraph
@EntityGraph(attributePaths = {"genres"})
List<Movie> findAll(); // Spring tự JOIN
```

---

## 6. Lazy vs Eager Loading

### Là gì?
- **Lazy:** Chỉ load quan hệ **khi gọi getter** (mặc định cho @OneToMany, @ManyToMany)
- **Eager:** Load **ngay lập tức** (mặc định cho @ManyToOne, @OneToOne)

### Ví dụ đời thường
- Lazy: Mở Netflix → chỉ thấy thumbnail. Click → mới load video.
- Eager: Mở Netflix → tự tải TẤT CẢ video → rất chậm.

### Lỗi thường gặp: LazyInitializationException
```java
Movie movie = movieService.findById(id); // Transaction đóng
movie.getGenres(); // LỖI! Lazy load nhưng transaction đã đóng

// Fix: load trong Service (trong transaction)
@Transactional(readOnly = true)
public MovieResponse getMovie(Long id) {
    Movie movie = findById(id);
    movie.getGenres().size(); // force load trong transaction
    return movieMapper.toResponse(movie);
}
```

### Quy tắc: Mặc định Lazy, khi cần → JOIN FETCH

---

## 7. Pagination — Phân trang

### Là gì?
Danh sách nhiều record → chia thành **từng trang**, mỗi trang 10-20 record.

### Ví dụ đời thường
Google: 1 triệu kết quả nhưng chỉ hiện 10/trang.

```java
@GetMapping("/movies")
public ApiResponse<PageResponse<MovieResponse>> getMovies(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "10") int size) {

    Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
    Page<Movie> movies = movieRepo.findAll(pageable);
    return ApiResponse.ok(PageResponse.from(movies));
}
```

Response:
```json
{
    "content": [ ... 10 phim ... ],
    "page": 0,
    "size": 10,
    "totalElements": 156,
    "totalPages": 16,
    "last": false
}
```

SQL: `SELECT * FROM movies ORDER BY created_at DESC OFFSET 20 ROWS FETCH NEXT 10 ROWS ONLY`

---

## 8. Index — Tăng tốc query

### B-tree là gì
Index là "mục lục" của bảng. Default ở SQL Server: B-tree (balanced tree). Tra cứu O(log n) thay vì O(n) full scan.

### Khi nào tạo index
- Cột xuất hiện trong `WHERE`, `JOIN`, `ORDER BY`
- Cột có cardinality cao (nhiều giá trị khác nhau)
- Bảng có > 1000 row

### Khi nào KHÔNG tạo
- Bảng nhỏ (< 1000 row) — full scan đã nhanh
- Cột write-heavy (mỗi UPDATE cũng update index → tốn)
- Cột boolean (cardinality 2 → index không có lợi nhiều)

### Composite index
```sql
CREATE INDEX idx_booking_status_user ON bookings (status, user_id);
```

Index theo thứ tự `(status, user_id)`. Hữu ích cho:
- `WHERE status = ? AND user_id = ?` (cả 2)
- `WHERE status = ?` (chỉ field đầu)
- KHÔNG hữu ích cho `WHERE user_id = ?` (skip field đầu)

**Quy tắc**: cột có cardinality cao đặt trước.

### Covering index
Index chứa hết cột query cần → không cần truy bảng:

```sql
CREATE INDEX idx_user_email_cover ON users (email) INCLUDE (id, username, role);

-- Query:
SELECT id, username, role FROM users WHERE email = 'a@b.com';
-- → đọc thẳng từ index, không cần đọc bảng → cực nhanh
```

### Index recommendations CineX

| Bảng | Index | Lý do |
|---|---|---|
| `users` | `username` UNIQUE | Login |
| `users` | `email` UNIQUE | Register, forgot password |
| `bookings` | `(user_id, created_at DESC)` | My bookings page |
| `bookings` | `(showtime_id, status)` | Check ghế đã đặt |
| `bookings` | `(status, expires_at)` | Cleanup scheduler |
| `booking_seats` | `(showtime_id, seat_id)` UNIQUE WHERE status IN ('HELD','BOOKED') | Chống race condition |
| `payments` | `(booking_id)` UNIQUE | 1-1 với booking |
| `payments` | `(status, paid_at)` | Statistics |
| `showtimes` | `(movie_id, start_time)` | List showtime của phim |
| `showtimes` | `(room_id, start_time, end_time)` | Overlap detection |
| `seats` | `(room_id, row_label, col_number)` UNIQUE | Sinh ghế không trùng |
| `notifications` | `(user_id, is_read, created_at DESC)` | Inbox query |
| `audit_logs` | `(table_name, record_id, created_at)` | Tra cứu audit |

### Phân tích index có hữu dụng không
```sql
SELECT * FROM sys.dm_db_index_usage_stats
WHERE database_id = DB_ID();
```

Cột `user_seeks`, `user_scans`, `user_updates` cho biết index được dùng vs maintain bao nhiêu. Index có `user_updates > user_seeks + user_scans` → cần xem có drop được không.

---

## 9. Transaction Isolation Levels

### 4 levels (yếu → mạnh)

| Level | Dirty Read | Non-repeatable Read | Phantom Read | Performance |
|---|---|---|---|---|
| READ_UNCOMMITTED | có | có | có | nhanh nhất |
| READ_COMMITTED (SQL Server default) | KHÔNG | có | có | nhanh |
| REPEATABLE_READ (MySQL default) | KHÔNG | KHÔNG | có | chậm hơn |
| SERIALIZABLE | KHÔNG | KHÔNG | KHÔNG | chậm nhất |

### Hiện tượng

**Dirty Read** — đọc data chưa commit:
```
T1: UPDATE balance SET amount = 500 (chưa commit)
T2: SELECT balance → 500 ← dirty!
T1: ROLLBACK
T2 đã đọc data không tồn tại
```

**Non-repeatable Read** — đọc 2 lần cùng row, giá trị khác:
```
T1: SELECT seat A1 → AVAILABLE
T2: UPDATE seat A1 SET status=HELD; COMMIT
T1: SELECT seat A1 → HELD ← khác lần đọc trước
```

**Phantom Read** — đọc 2 lần cùng range, số row khác:
```
T1: SELECT COUNT(*) FROM seats WHERE status=AVAILABLE → 10
T2: INSERT seat mới với status=AVAILABLE; COMMIT
T1: SELECT COUNT(*) WHERE status=AVAILABLE → 11 ← phantom
```

### Spring `@Transactional(isolation = ...)`

```java
@Transactional(isolation = Isolation.REPEATABLE_READ)
public Booking createBooking(...) { ... }
```

**Default Spring**: dùng default DB → SQL Server = READ_COMMITTED.

### CineX dùng level nào?

READ_COMMITTED + Pessimistic Lock cho hold ghế:
- READ_COMMITTED đủ chống dirty read
- Phantom/non-repeatable không vấn đề vì lock cụ thể seat
- SERIALIZABLE quá nặng (lock range) → giảm throughput

---

## 10. Deadlock

### Là gì
2 transaction giữ lock của nhau, đợi nhau vô tận. DB phát hiện và kill 1 trong 2.

```
T1: lock seat A1 → cần lock A2
T2: lock seat A2 → cần lock A1
→ deadlock!
```

### Cách phát hiện trong SQL Server
```sql
-- Bật trace deadlock
DBCC TRACEON (1222, -1);

-- Hoặc query session locks
SELECT * FROM sys.dm_tran_locks;
```

Log SQL Server hiện XML deadlock graph.

### Cách tránh
**1. Consistent lock order**: luôn lock theo cùng thứ tự (vd ID nhỏ trước):
```java
seatIds.sort();  // sort trước khi lock
seats = seatRepository.findAllByIdsOrderByIdAsc(seatIds);
```

**2. Lock timeout**:
```java
@Lock(LockModeType.PESSIMISTIC_WRITE)
@QueryHints({ @QueryHint(name = "javax.persistence.lock.timeout", value = "3000") })
Seat findByIdForUpdate(Long id);
```

3 giây không lấy được → throw `LockTimeoutException`, retry hoặc bỏ.

**3. Tránh hold lock lâu**: transaction càng ngắn càng tốt, không gọi API chậm trong transaction.

**4. Optimistic Lock với retry**: dùng `@Version` thay vì pessimistic, retry khi conflict.

---

## 11. Connection Pool (HikariCP)

### Là gì
Pool sẵn N connection tới DB → request đến → lấy 1 connection có sẵn → trả lại sau khi xong.

Không có pool: mỗi request mở connection (TCP handshake + auth, mất ~50ms) → quá chậm.

### Spring Boot default: HikariCP
```yaml
spring.datasource.hikari:
  maximum-pool-size: 20        # max connection
  minimum-idle: 5              # min connection idle
  idle-timeout: 600000         # 10 phút idle → close
  connection-timeout: 30000    # 30s đợi connection từ pool
  max-lifetime: 1800000        # 30 phút, force replace
  leak-detection-threshold: 60000  # warn nếu connection được giữ > 60s
```

### Sizing
- Quy tắc cũ: `connections = ((cores * 2) + spindles)` → CPU core × 2.
- 4-core server → 10-12 connection là đủ.
- Quá nhiều connection → context switching DB overhead → CHẬM hơn.

### Cảnh báo
Code giữ connection lâu (transaction dài) → pool cạn → request mới đợi → timeout → crash:

```java
@Transactional  // connection bị giữ suốt
public void slowMethod() {
    bookingRepository.save(booking);   // 5ms
    callExternalApi();                  // 30s ← connection idle nhưng vẫn giữ!
    paymentRepository.save(payment);    // 5ms
}
```

**Fix**: tách API call ra ngoài transaction.

---

## 12. Database Constraints

### UNIQUE
```sql
ALTER TABLE users ADD CONSTRAINT uk_users_email UNIQUE (email);
```

DB tự reject duplicate. KHÔNG dependent vào application logic (race condition vẫn an toàn).

### CHECK
```sql
ALTER TABLE bookings ADD CONSTRAINT chk_total_amount_positive
    CHECK (total_amount >= 0);
```

Đảm bảo invariant ở DB level.

### NOT NULL
Bắt buộc. KHÔNG để app gửi NULL ngầm.

### FOREIGN KEY với CASCADE
```sql
ALTER TABLE booking_seats ADD CONSTRAINT fk_booking_seat_booking
    FOREIGN KEY (booking_id) REFERENCES bookings (id)
    ON DELETE CASCADE   -- xóa booking → xóa booking_seats
    ON UPDATE NO ACTION;
```

| Action | Hiệu ứng |
|---|---|
| CASCADE | Xóa/update parent → propagate child |
| SET NULL | Xóa parent → child.parent_id = NULL |
| RESTRICT / NO ACTION | Có child → không cho xóa parent |
| SET DEFAULT | Set về default value |

CineX dùng soft delete → CASCADE ít cần. Nhưng `audit_logs` reference user có thể `ON DELETE SET NULL`.

---

## 13. Database Normalization

### 1NF — Atomic values
Mỗi cell 1 giá trị, không list/object.

SAI: `genres = "Action, Horror"`
ĐÚNG: bảng riêng `movie_genres (movie_id, genre_id)`.

### 2NF — Phụ thuộc đầy đủ vào PK
Mọi non-key column phải phụ thuộc TOÀN BỘ composite PK.

```
booking_seats (booking_id, seat_id, seat_name, booking_status)
                                    ↑              ↑
                  phụ thuộc seat   phụ thuộc booking
                  (không phụ thuộc cả 2)
```

Vi phạm 2NF → tách `seat_name` về `seats`, `booking_status` về `bookings`.

### 3NF — Không transitive dependency
Non-key column không phụ thuộc qua non-key column khác.

```
movies (id, title, director_id, director_name)
                                    ↑
                            phụ thuộc director_id
                            không trực tiếp phụ thuộc movie.id
```

Vi phạm 3NF → tách `director_name` về bảng `directors`.

### Khi nào denormalize
- Read-heavy + JOIN tốn: cache field tính sẵn
- Reporting: bảng aggregate riêng
- Hot path: copy giá trị cố định (snapshot price ở `booking_seats.price` tại thời điểm đặt vé)

---

## 14. N+1 Detection Tools

### Show SQL Hibernate
```yaml
spring:
  jpa:
    show-sql: true
    properties:
      hibernate:
        format_sql: true
        use_sql_comments: true
logging:
  level:
    org.hibernate.SQL: DEBUG
    org.hibernate.type.descriptor.sql: TRACE  # log binding params
```

### Hibernate Statistics
```java
@Bean
public StatisticsConfig() {
    sessionFactory.getStatistics().setStatisticsEnabled(true);
}

// In endpoint:
Statistics stats = sessionFactory.getStatistics();
log.info("Queries: {}", stats.getQueryExecutionCount());
log.info("Cache hit: {}", stats.getQueryCacheHitCount());
```

### p6spy
Library wrap JDBC, log mọi query với time + params:
```gradle
implementation 'p6spy:p6spy:3.9.1'
```

Output:
```
2026-05-24 10:00:00 - statement|connection 0|0 ms|...
SELECT * FROM movies
SELECT * FROM movie_genres WHERE movie_id = 1
SELECT * FROM movie_genres WHERE movie_id = 2
...
```

Đếm số query → biết có N+1 không.

---

## 15. Batch Operations

### saveAll vs loop save
```java
// SAI — N query
for (Seat seat : seats) {
    seatRepository.save(seat);  // 1 INSERT mỗi lần
}

// ĐÚNG — 1 batch
seatRepository.saveAll(seats);
```

### Cấu hình batch size
```yaml
spring.jpa.properties.hibernate:
  jdbc.batch_size: 50
  order_inserts: true
  order_updates: true
```

50 entity = 1 batch SQL.

### JPQL bulk update
```java
@Modifying
@Query("UPDATE Notification n SET n.isRead = true WHERE n.userId = :userId")
int markAllAsRead(@Param("userId") Long userId);
```

1 query thay vì N. Nhưng KHÔNG trigger entity lifecycle (`@PreUpdate`, `@Version`) → cẩn thận.

---

## 16. Cảnh báo Soft Delete với Index

### Vấn đề
```sql
SELECT * FROM movies WHERE storage_state = 'ACTIVE' ORDER BY created_at DESC;
```

Index trên `created_at` không lọc được `storage_state` → phải full scan rồi filter.

### Fix
- Composite index `(storage_state, created_at DESC)`
- Hoặc filtered index (SQL Server): `WHERE storage_state = 'ACTIVE'`

```sql
CREATE INDEX idx_movies_active_created
    ON movies (created_at DESC)
    WHERE storage_state = 'ACTIVE';
```

Index nhỏ hơn, query nhanh hơn — chỉ index row active.

---

## 17. Câu hỏi tự kiểm tra

**Câu 1**: Khi nào dùng Optimistic vs Pessimistic Lock?

→ Optimistic: read-heavy, conflict ít (admin sửa cùng phim hiếm). Pessimistic: write-heavy, conflict thường (hold ghế).

**Câu 2**: SERIALIZABLE chống được tất cả phenomena. Tại sao không dùng luôn?

→ Lock range nặng → throughput giảm mạnh. Trừ khi nghiệp vụ thực sự cần (sổ kế toán, kiểm toán), nên dùng level thấp hơn + lock cụ thể.

**Câu 3**: Composite index `(status, user_id)` có hữu ích cho `WHERE user_id = 5`?

→ Không. Index theo thứ tự (status, user_id) — phải có status trước. Phải tạo index riêng `(user_id)` nếu query thường lọc theo user_id.

**Câu 4**: Soft delete bằng `storage_state = ARCHIVED` có downside gì so với hard delete?

→ Tất cả query phải `WHERE storage_state = 'ACTIVE'` → dễ quên → bug data rò rỉ. Index phải cover cột này → tốn space. Tăng cường: filtered index hoặc Hibernate `@Where(clause = "storage_state = 'ACTIVE'")` auto-apply.

**Câu 5**: 2 user cùng book 1 ghế dùng pessimistic lock. Throughput giảm đáng kể, có cách khác?

→ UNIQUE constraint trên `(showtime_id, seat_id)` với điều kiện status IN ('HELD','BOOKED') → DB tự reject duplicate, không cần lock. Optimistic + retry. Hoặc Redis distributed lock cho key cụ thể.
