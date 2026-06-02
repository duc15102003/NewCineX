# JPA & Hibernate — Làm việc với Database

---

## JPA là gì?

JPA (Java Persistence API) là **chuẩn** để map Java object ↔ bảng DB.
Hibernate là **implementation** (thư viện thật) của JPA.

### Ví dụ đời thường
- JPA = luật giao thông (quy định chung)
- Hibernate = cảnh sát giao thông (thực thi luật)

---

## Entity — Map class Java với bảng DB

```java
@Entity                        // Đánh dấu: class này map với bảng DB
@Table(name = "movies")        // Tên bảng trong DB (nếu khác tên class)
@Getter @Setter
public class Movie extends BaseEntity {

    @Column(name = "title", nullable = false, length = 200)
    // ↑ tên cột       ↑ NOT NULL          ↑ NVARCHAR(200)
    private String title;

    @Column(columnDefinition = "NTEXT")    // Kiểu dữ liệu đặc biệt
    private String description;

    @Column(nullable = false)
    private Integer duration;              // Hibernate tự map → INT

    @Column(name = "release_date")
    private LocalDate releaseDate;         // Java camelCase → DB snake_case

    @Column(name = "poster_url", length = 500)
    private String posterUrl;

    @Column(precision = 3, scale = 1)      // DECIMAL(3,1)
    private BigDecimal rating;

    @Enumerated(EnumType.STRING)           // Lưu dạng String "NOW_SHOWING"
    @Column(nullable = false, length = 20)
    private MovieStatus status;
}
```

### Mapping kiểu dữ liệu

| Java | SQL Server | Annotation |
|---|---|---|
| `String` | `NVARCHAR(255)` | `@Column(length = 200)` |
| `Integer` / `int` | `INT` | mặc định |
| `Long` / `long` | `BIGINT` | mặc định |
| `BigDecimal` | `DECIMAL` | `@Column(precision, scale)` |
| `Boolean` / `boolean` | `BIT` | mặc định |
| `LocalDate` | `DATE` | mặc định |
| `LocalDateTime` | `DATETIME2` | mặc định |
| `Enum` | `NVARCHAR` | `@Enumerated(EnumType.STRING)` |

---

## Quan hệ giữa các Entity

### @ManyToOne — Nhiều-Một

```java
// Nhiều Showtime thuộc về 1 Movie
@Entity
public class Showtime extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)     // Lazy: chỉ load Movie khi gọi getMovie()
    @JoinColumn(name = "movie_id", nullable = false)
    //          ↑ tên cột FK trong bảng showtimes
    private Movie movie;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;
}

// DB: bảng showtimes có cột movie_id (FK → movies.id)
```

### @OneToMany — Một-Nhiều

```java
// 1 Booking có nhiều BookingSeat
@Entity
public class Booking extends BaseEntity {

    @OneToMany(mappedBy = "booking", cascade = CascadeType.ALL, orphanRemoval = true)
    //         ↑ field trong BookingSeat  ↑ cascade: lưu/xóa luôn con  ↑ xóa con mồ côi
    private List<BookingSeat> bookingSeats = new ArrayList<>();

    // Helper method
    public void addSeat(BookingSeat seat) {
        bookingSeats.add(seat);
        seat.setBooking(this);   // ← set 2 chiều
    }
}

@Entity
public class BookingSeat {
    @ManyToOne
    @JoinColumn(name = "booking_id")
    private Booking booking;     // ← phía "nhiều" giữ FK
}
```

### @ManyToMany — Nhiều-Nhiều

```java
// 1 Movie có nhiều Genre, 1 Genre có nhiều Movie
@Entity
public class Movie extends BaseEntity {

    @ManyToMany
    @JoinTable(
        name = "movie_genres",                          // tên bảng liên kết
        joinColumns = @JoinColumn(name = "movie_id"),   // FK về bảng movies
        inverseJoinColumns = @JoinColumn(name = "genre_id")  // FK về bảng genres
    )
    private Set<Genre> genres = new HashSet<>();
}

// DB tự tạo bảng movie_genres (movie_id, genre_id)
// Không cần tạo Entity cho bảng liên kết
```

### @OneToOne — Một-Một

```java
// 1 Booking có 1 Payment
@Entity
public class Payment extends BaseEntity {

    @OneToOne
    @JoinColumn(name = "booking_id", unique = true)  // unique = 1-1
    private Booking booking;
}
```

### CascadeType — Lan truyền thao tác

```java
@OneToMany(cascade = CascadeType.ALL)
// CascadeType.ALL = PERSIST + MERGE + REMOVE
// Nghĩa: lưu Booking → TỰ ĐỘNG lưu BookingSeat con
//         xóa Booking → TỰ ĐỘNG xóa BookingSeat con

// PERSIST: save cha → save con
// MERGE: update cha → update con
// REMOVE: delete cha → delete con
// ALL: tất cả
```

**Cẩn thận:** `CascadeType.REMOVE` trên `@ManyToOne` → xóa 1 movie → xóa TẤT CẢ showtime → **NGUY HIỂM**.
Chỉ dùng cascade trên `@OneToMany` (cha quản lý con).

---

## Repository — Truy vấn DB

### Query tự sinh từ tên method

```java
public interface MovieRepository extends JpaRepository<Movie, Long> {

    // Spring đọc tên method → sinh SQL
    Optional<Movie> findByTitle(String title);
    // → SELECT * FROM movies WHERE title = ?

    List<Movie> findByStatusAndRatingGreaterThan(MovieStatus status, BigDecimal rating);
    // → SELECT * FROM movies WHERE status = ? AND rating > ?

    boolean existsByTitle(String title);
    // → SELECT COUNT(*) > 0 FROM movies WHERE title = ?

    long countByStatus(MovieStatus status);
    // → SELECT COUNT(*) FROM movies WHERE status = ?

    List<Movie> findByTitleContainingIgnoreCase(String keyword);
    // → SELECT * FROM movies WHERE LOWER(title) LIKE '%keyword%'

    List<Movie> findAllByOrderByCreatedAtDesc();
    // → SELECT * FROM movies ORDER BY created_at DESC
}
```

### Từ khóa query method

| Từ khóa | SQL | Ví dụ |
|---|---|---|
| `findBy` | `WHERE` | `findByUsername` |
| `And` | `AND` | `findByStatusAndType` |
| `Or` | `OR` | `findByTitleOrDirector` |
| `Between` | `BETWEEN` | `findByRatingBetween(7, 10)` |
| `LessThan` / `GreaterThan` | `<` / `>` | `findByDurationLessThan(120)` |
| `Like` / `Containing` | `LIKE` | `findByTitleContaining("Avenger")` |
| `In` | `IN` | `findByStatusIn(List.of("A","B"))` |
| `OrderBy` | `ORDER BY` | `findAllByOrderByRatingDesc` |
| `IsNull` / `IsNotNull` | `IS NULL` | `findByAvatarUrlIsNull` |
| `True` / `False` | `= 1` / `= 0` | `findByEnabledTrue` |

### @Query — Viết JPQL thủ công

```java
public interface MovieRepository extends JpaRepository<Movie, Long> {

    // JPQL — giống SQL nhưng dùng tên Entity + field (không dùng tên bảng + cột)
    @Query("SELECT m FROM Movie m WHERE m.status = :status ORDER BY m.rating DESC")
    List<Movie> findTopRatedByStatus(@Param("status") MovieStatus status);

    // JOIN FETCH — fix N+1 problem
    @Query("SELECT m FROM Movie m JOIN FETCH m.genres WHERE m.id = :id")
    Optional<Movie> findByIdWithGenres(@Param("id") Long id);

    // UPDATE
    @Modifying
    @Query("UPDATE Movie m SET m.status = :status WHERE m.endDate < :today")
    int updateExpiredMovies(@Param("status") MovieStatus status, @Param("today") LocalDate today);
}
```

### Pageable — Phân trang

```java
public interface MovieRepository extends JpaRepository<Movie, Long> {

    Page<Movie> findByStatus(MovieStatus status, Pageable pageable);
    // Pageable = page number + page size + sort

    // Service gọi:
    Pageable pageable = PageRequest.of(0, 10, Sort.by("rating").descending());
    Page<Movie> page = movieRepo.findByStatus(NOW_SHOWING, pageable);
    // → SQL: SELECT * FROM movies WHERE status='NOW_SHOWING' ORDER BY rating DESC
    //        OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY
}
```

---

## Entity Lifecycle — Vòng đời Entity

```
1. TRANSIENT (mới tạo, chưa lưu)
   Movie movie = new Movie();        // ← Java object bình thường
   movie.setTitle("Avengers");       // Chưa có id, chưa liên kết DB

2. MANAGED (đang quản lý bởi JPA)
   movieRepo.save(movie);            // ← JPA INSERT vào DB, gán id
   movie.setTitle("Avengers 2");     // ← JPA TỰ ĐỘNG UPDATE khi commit transaction
                                     // Không cần gọi save() lần nữa!

3. DETACHED (đã tách khỏi JPA)
   // Khi transaction kết thúc (ra khỏi @Transactional method)
   movie.setTitle("Avengers 3");     // ← JPA KHÔNG biết, KHÔNG update DB
   movieRepo.save(movie);            // ← Phải gọi save() lại để JPA quản lý lại

4. REMOVED (đã xóa)
   movieRepo.delete(movie);          // ← JPA DELETE từ DB
```

**Lưu ý quan trọng:** Trong `@Transactional` method, entity là MANAGED → sửa field = **TỰ ĐỘNG UPDATE DB** khi method kết thúc. Đây gọi là **dirty checking**.

```java
@Transactional
public void updateTitle(Long id, String newTitle) {
    Movie movie = movieRepo.findById(id).orElseThrow(...);
    movie.setTitle(newTitle);
    // KHÔNG cần gọi movieRepo.save(movie)!
    // JPA tự detect "title đã thay đổi" → generate UPDATE SQL
}
```

---

## 14. N+1 Query Problem — Bài Toán Im Lặng Giết Performance

### 14.1. Hiểu vấn đề bằng ví dụ thực tế

Hãy tưởng tượng bạn vào một thư viện, hỏi thủ thư: "Cho tôi xem danh sách 100 cuốn sách". Thủ thư đưa danh sách. Sau đó với mỗi cuốn, bạn lại hỏi: "Sách này thuộc thể loại gì?" → thủ thư phải đi tra cứu 100 lần. Tổng cộng: **1 lần hỏi danh sách + 100 lần hỏi thể loại = 101 lần đi lại**.

Đây chính là **N+1 query problem**: 1 query lấy danh sách + N query lấy mỗi item con.

### 14.2. Reproduce vấn đề với code thật CineX

Giả sử ta có code:

```java
// MovieService.java — CODE SAI gây N+1
@Transactional(readOnly = true)
public List<MovieResponse> listMoviesWithGenres() {
    List<Movie> movies = movieRepository.findAll();
    // Giả sử có 100 phim
    return movies.stream().map(m -> MovieResponse.builder()
        .id(m.getId())
        .title(m.getTitle())
        .genreNames(m.getGenres().stream()  // <-- DÒNG GÂY N+1
            .map(Genre::getName)
            .toList())
        .build()
    ).toList();
}
```

Bật log SQL để thấy hiện tượng:

```yaml
# application.yml
spring:
  jpa:
    show-sql: true
    properties:
      hibernate:
        format_sql: true
logging:
  level:
    org.hibernate.SQL: DEBUG
    org.hibernate.orm.jdbc.bind: TRACE  # Hiện cả parameter ?
```

Khi gọi API `/api/movies`, log sẽ hiện:

```sql
-- Query #1: Lấy tất cả movies (cái này OK)
SELECT m.id, m.title, m.code, m.duration, ...
FROM movies m
WHERE m.storage_state = 'ACTIVE';

-- Query #2: Lấy genres cho movie có id=1
SELECT g.id, g.name FROM genres g
INNER JOIN movie_genres mg ON g.id = mg.genre_id
WHERE mg.movie_id = 1;

-- Query #3: Lấy genres cho movie có id=2
SELECT g.id, g.name FROM genres g
INNER JOIN movie_genres mg ON g.id = mg.genre_id
WHERE mg.movie_id = 2;

-- ... lặp 98 lần nữa ...

-- Query #101: Lấy genres cho movie có id=100
SELECT g.id, g.name FROM genres g
INNER JOIN movie_genres mg ON g.id = mg.genre_id
WHERE mg.movie_id = 100;
```

**Hậu quả:** 1 API call → 101 SQL query → 100ms × 101 = 10 giây. Database CPU lên 90%. Khi 10 user cùng gọi → server đơ.

### 14.3. Cách fix #1: JPQL `JOIN FETCH` — Phù hợp 1 collection

```java
public interface MovieRepository extends JpaRepository<Movie, Long> {
    @Query("SELECT DISTINCT m FROM Movie m LEFT JOIN FETCH m.genres")
    List<Movie> findAllWithGenres();
}
```

SQL sinh ra **chỉ 1 query**:

```sql
SELECT m.id, m.title, ..., g.id, g.name
FROM movies m
LEFT JOIN movie_genres mg ON m.id = mg.movie_id
LEFT JOIN genres g ON mg.genre_id = g.id
WHERE m.storage_state = 'ACTIVE';
```

**Tại sao `DISTINCT`?** Vì JOIN sinh nhiều dòng trùng movie (1 movie × N genres). `DISTINCT` ở JPQL chỉ ảnh hưởng kết quả Java, không thêm `DISTINCT` vào SQL khi dùng Hibernate >= 6 (đã tự tối ưu).

### 14.4. Cách fix #2: `@EntityGraph` — Khai báo gọn

```java
public interface MovieRepository extends JpaRepository<Movie, Long> {
    @EntityGraph(attributePaths = {"genres"})
    @Override
    List<Movie> findAll();

    // Hoặc dùng với Specification
    @EntityGraph(attributePaths = {"genres", "director"})
    List<Movie> findByStorageState(StorageState state);
}
```

Hibernate tự sinh JOIN FETCH dựa trên `attributePaths`. **Ưu điểm**: không cần viết JPQL, hoạt động cả với Specification.

### 14.5. Cách fix #3: `@BatchSize` — Khi có nhiều collection cần fetch

```java
@Entity
public class Movie extends BaseEntity {
    @ManyToMany(fetch = FetchType.LAZY)
    @BatchSize(size = 50)  // <-- Mỗi lần load batch 50 movie cùng lúc
    private Set<Genre> genres;
}
```

SQL sinh ra:

```sql
-- Query #1: lấy movies
SELECT * FROM movies WHERE storage_state = 'ACTIVE';

-- Query #2: lấy genres CHO 50 MOVIE CÙNG LÚC (dùng IN)
SELECT g.*, mg.movie_id FROM genres g
INNER JOIN movie_genres mg ON g.id = mg.genre_id
WHERE mg.movie_id IN (1, 2, 3, ..., 50);

-- Query #3: lấy genres cho 50 movie còn lại
WHERE mg.movie_id IN (51, 52, ..., 100);
```

Từ 101 query → còn **3 query**. Không cần sửa JPQL, chỉ thêm annotation.

### 14.6. Cảnh báo `MultipleBagFetchException`

Khi cố `JOIN FETCH` 2 collection cùng lúc:

```java
@Query("SELECT m FROM Movie m " +
       "LEFT JOIN FETCH m.genres " +
       "LEFT JOIN FETCH m.showtimes")  // <-- LỖI!
List<Movie> findAllWithGenresAndShowtimes();
```

Hibernate throw:

```
org.hibernate.loader.MultipleBagFetchException:
cannot simultaneously fetch multiple bags: [Movie.genres, Movie.showtimes]
```

**Tại sao?** Nếu phim A có 3 genre và 5 showtime, SQL JOIN sẽ trả 3×5 = 15 dòng → Hibernate không biết phân biệt đâu là bản gốc. Cộng dồn 100 phim = hàng nghìn dòng trùng → **cartesian product explosion**.

**Cách fix:**
1. Đổi `List` → `Set` cho 1 trong 2 collection (Set chấp nhận JOIN FETCH song song với List).
2. Hoặc tách 2 query riêng + dùng `@BatchSize`.
3. Hoặc dùng `@EntityGraph` (Hibernate 6 đã tối ưu cartesian).

### 14.7. Công cụ phát hiện N+1

- **Hibernate Statistics:** thêm `spring.jpa.properties.hibernate.generate_statistics: true`, log ra cuối request số query đã chạy.
- **p6spy:** library proxy JDBC, log mọi câu SQL kèm thời gian thực thi.
- **Datasource-proxy** hoặc **FlexyPool**: detect N+1 tự động, throw exception khi vượt ngưỡng N query/request trong dev.

---

## 15. LazyInitializationException — Bệnh Kinh Niên của JPA

### 15.1. Khi nào xảy ra?

`LazyInitializationException` xảy ra khi bạn **gọi getter của một LAZY collection/association SAU KHI transaction đã đóng**. Lúc đó proxy không còn Hibernate Session để query DB → văng exception.

3 tình huống phổ biến:

**Tình huống 1: Serialize entity trong response JSON**

```java
@RestController
public class MovieController {
    @GetMapping("/api/movies/{id}")
    public ApiResponse<Movie> getMovie(@PathVariable Long id) {
        Movie movie = movieService.findById(id);  // transaction đóng tại đây
        return ApiResponse.success(movie);  // Jackson serialize movie.genres → BÙM
    }
}
```

**Tình huống 2: Gọi getter ngoài @Transactional**

```java
public MovieDTO getMovieInfo(Long id) {
    Movie movie = movieService.findById(id);  // service đã @Transactional
    // ngoài transaction
    int genreCount = movie.getGenres().size();  // BÙM
    return ...;
}
```

**Tình huống 3: Async / Thread khác**

```java
@Transactional
public void notifyAsync(Long bookingId) {
    Booking booking = bookingRepo.findById(bookingId).orElseThrow();
    CompletableFuture.runAsync(() -> {
        // Thread mới KHÔNG có Hibernate Session
        booking.getBookingSeats().forEach(...);  // BÙM
    });
}
```

### 15.2. Stack trace mẫu

```
org.hibernate.LazyInitializationException:
failed to lazily initialize a collection of role:
com.cinex.module.movie.entity.Movie.genres,
could not initialize proxy - no Session
    at org.hibernate.collection.spi.AbstractPersistentCollection.throwLazyInitializationException(AbstractPersistentCollection.java:635)
    at com.cinex.module.movie.entity.Movie.getGenres(Movie.java:42)
    at com.fasterxml.jackson.databind.ser.BeanPropertyWriter.serializeAsField(...)
```

### 15.3. Cách fix #1: JOIN FETCH eager 1 chỗ

Dùng khi: API trả entity kèm relationship.

```java
@Query("SELECT m FROM Movie m LEFT JOIN FETCH m.genres WHERE m.id = :id")
Optional<Movie> findByIdWithGenres(@Param("id") Long id);
```

**Nhược điểm:** mỗi use case cần JPQL riêng, dễ phình.

### 15.4. Cách fix #2: DTO Projection — CineX chọn cách này

CineX KHÔNG BAO GIỜ trả entity ra Controller. Luôn map sang DTO trong Service (vẫn còn transaction):

```java
@Transactional(readOnly = true)
public MovieResponse findById(Long id) {
    Movie movie = movieRepo.findByIdWithGenres(id)
        .orElseThrow(() -> new BusinessException(ErrorCode.MOVIE_NOT_FOUND));
    return movieMapper.toResponse(movie);  // truy cập genres TRONG transaction
    // sau khi method return, MovieResponse đã có sẵn genreNames String[]
    // không còn proxy → serialize JSON an toàn
}
```

**Tại sao đây là cách tốt nhất?**
- Tách biệt entity (DB layer) với response (API layer) — Single Responsibility.
- Không lo `LazyInitializationException` vì DTO không có proxy.
- Không lộ field nhạy cảm (password, internal flag).
- Stable API contract: đổi entity không vỡ FE.

### 15.5. Cách fix #3: Open-Session-In-View (anti-pattern)

Spring Boot DEFAULT bật `spring.jpa.open-in-view: true` → Hibernate Session sống suốt request (cả Controller, View render).

**Có vẻ tiện** nhưng là **anti-pattern**:

1. **Performance ngầm:** mỗi getter LAZY trong template/serializer → query DB ngay → N+1 ẩn không biết.
2. **Transaction boundary mờ:** Controller có thể vô tình modify entity → flush khi request đóng.
3. **Connection pool cạn:** mỗi request giữ 1 DB connection suốt lifetime → server đông user → hết connection.

**CineX TẮT open-in-view:**

```yaml
spring:
  jpa:
    open-in-view: false  # BẮT BUỘC trong production
```

Sau khi tắt, mọi LazyInitializationException sẽ phơi bày → buộc viết DTO/JOIN FETCH đúng cách.

---

## 16. Transaction Isolation Levels — 4 Mức Cô Lập

### 16.1. 4 hiện tượng (phenomena) cần phòng

Khi 2 transaction chạy đồng thời, có 4 tình huống xấu:

**Dirty Read:** T1 update chưa commit, T2 đọc giá trị mới đó, T1 rollback → T2 đọc giá trị "ma".
> Ví dụ: Bạn (T1) bắt đầu đặt 8 ghế nhưng chưa commit. Bạn bè (T2) nhìn vào hệ thống thấy chỉ còn 2 ghế trống → bạn bè đặt 2 ghế. Sau đó bạn rollback → ghế quay lại 10. Bạn bè đã đặt dựa trên dữ liệu sai.

**Non-Repeatable Read:** T1 đọc row A. T2 update row A và commit. T1 đọc lại row A → thấy giá trị khác.
> Ví dụ: Bạn check ghế A1 → trống. 1 giây sau check lại → đã có người đặt. Cùng transaction nhưng 2 lần đọc khác nhau.

**Phantom Read:** T1 query `SELECT * WHERE showtime_id = 5` → 10 row. T2 INSERT thêm 1 row vào showtime 5. T1 query lại → 11 row. Có "ghế ma" xuất hiện.

**Lost Update:** T1 đọc balance = 100, T2 cũng đọc = 100. T1 update = 90, T2 update = 80. Lệnh T1 mất.

### 16.2. Bảng 4 isolation level

| Level | Dirty Read | Non-Repeatable | Phantom | Lost Update | Performance |
|---|---|---|---|---|---|
| READ_UNCOMMITTED | Có thể | Có thể | Có thể | Có thể | Nhanh nhất |
| READ_COMMITTED | Không | Có thể | Có thể | Có thể | Nhanh |
| REPEATABLE_READ | Không | Không | Có thể | Không | Vừa |
| SERIALIZABLE | Không | Không | Không | Không | Chậm nhất |

### 16.3. Default của các DB

- **SQL Server (CineX):** `READ_COMMITTED` (mặc định). Có thể bật `READ_COMMITTED_SNAPSHOT` để dùng MVCC như PostgreSQL.
- **MySQL InnoDB:** `REPEATABLE_READ`.
- **PostgreSQL:** `READ_COMMITTED`.
- **Oracle:** `READ_COMMITTED`.

### 16.4. Cách set trong Spring

```java
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Transactional(isolation = Isolation.REPEATABLE_READ)
public Booking createBooking(...) {
    ...
}
```

### 16.5. Khi nào CineX cần SERIALIZABLE?

Trường hợp giữ ghế: 2 user click "Đặt ghế A5" cùng lúc.

- `READ_COMMITTED`: cả 2 đều SELECT thấy A5 trống → cả 2 INSERT → conflict ở DB unique constraint (chấp nhận được vì có constraint).
- `SERIALIZABLE`: T1 lock luôn cả range query → T2 phải chờ → tuần tự hóa.

**Trade-off:** SERIALIZABLE → deadlock nhiều, throughput giảm 50-70%. CineX chọn `READ_COMMITTED` + **Pessimistic Lock** (`@Lock(LockModeType.PESSIMISTIC_WRITE)`) cho query select ghế, vì lock cụ thể row thay vì cả range.

```java
@Lock(LockModeType.PESSIMISTIC_WRITE)
@Query("SELECT s FROM Seat s WHERE s.id IN :ids")
List<Seat> findSeatsForUpdate(@Param("ids") List<Long> ids);
```

SQL sinh ra (SQL Server): `SELECT ... FROM seats WITH (UPDLOCK, ROWLOCK) WHERE id IN (...)`.

---

## 17. Propagation Behaviors — Cách Transaction Lồng Nhau

### 17.1. Bảng 7 propagation

| Propagation | Có transaction sẵn | Không có transaction | Use case |
|---|---|---|---|
| `REQUIRED` (default) | Join | Tạo mới | 90% trường hợp |
| `REQUIRES_NEW` | Suspend cũ, tạo mới | Tạo mới | Audit log, gửi email |
| `SUPPORTS` | Join | Chạy không transaction | Read-only optional |
| `NOT_SUPPORTED` | Suspend, chạy không tx | Chạy không tx | Long-running task |
| `MANDATORY` | Join | Throw exception | Method nội bộ |
| `NEVER` | Throw exception | Chạy không tx | Cấm gọi trong tx |
| `NESTED` | Tạo savepoint | Tạo mới | Rollback 1 phần |

### 17.2. Ví dụ thực tế CineX: Audit Log

```java
@Service
@RequiredArgsConstructor
public class BookingService {
    private final AuditLogService auditLogService;

    @Transactional  // REQUIRED — tx chính cho booking
    public Booking createBooking(CreateBookingRequest req) {
        Booking booking = new Booking();
        // ... lưu booking
        bookingRepo.save(booking);

        // Ghi audit log — DÙ booking lỗi vẫn phải log
        auditLogService.log("CREATE_BOOKING", booking.getId(), userId);

        // Nếu hold ghế lỗi → toàn bộ tx rollback
        seatHoldService.holdSeats(req.getSeatIds());

        return booking;
    }
}

@Service
public class AuditLogService {
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void log(String action, Long entityId, Long userId) {
        AuditLog audit = AuditLog.builder()
            .action(action)
            .entityId(entityId)
            .userId(userId)
            .timestamp(Instant.now())
            .build();
        auditLogRepo.save(audit);
        // Tx này commit NGAY, không phụ thuộc tx ngoài
    }
}
```

**Kịch bản:**

- `createBooking` mở tx T1.
- Gọi `log(...)` → Spring suspend T1, mở T2 mới.
- `log` save audit → T2 commit ngay → audit lưu vào DB.
- Quay lại `createBooking` → T1 resume.
- `holdSeats` fail → T1 rollback → booking bị xóa.
- **Nhưng audit log vẫn còn** (vì T2 đã commit).

→ Đúng yêu cầu nghiệp vụ: log "đã có người TRY tạo booking nhưng fail".

### 17.3. Cảnh báo: Self-invocation không kích hoạt proxy

```java
@Service
public class BookingService {
    @Transactional
    public void methodA() {
        methodB();  // KHÔNG kích hoạt REQUIRES_NEW!
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void methodB() { ... }
}
```

Vì gọi `methodB()` qua `this` → bypass proxy Spring → propagation bị bỏ qua. Phải tách `methodB` sang service khác, hoặc inject self qua `ApplicationContext`.

---

## 18. Entity Equality — KHÔNG dùng @Data Lombok cho Entity

### 18.1. 3 lý do `@Data` là thảm họa với entity

**Lý do 1: StackOverflow với bidirectional relationship**

```java
@Entity
@Data  // SAI! sinh toString() in cả relationship
public class Movie extends BaseEntity {
    @OneToMany(mappedBy = "movie")
    private List<Showtime> showtimes;
}

@Entity
@Data
public class Showtime extends BaseEntity {
    @ManyToOne
    private Movie movie;
}
```

Khi gọi `movie.toString()`:
1. In `movie` → in `showtimes` → in từng `showtime.toString()`.
2. `showtime.toString()` → in `movie` → vòng lặp vô tận → `StackOverflowError`.

**Lý do 2: equals/hashCode trigger lazy load → N+1 hoặc LazyInitException**

`@Data` sinh `equals/hashCode` dùng TẤT CẢ field, kể cả collection LAZY. Khi compare:

```java
Set<Movie> set = new HashSet<>();
set.add(movie1);  // Gọi hashCode() → trigger movie1.getGenres() → query DB
set.contains(movie2);  // hashCode → query DB cho movie2.getGenres()
```

Nếu ở ngoài transaction → `LazyInitializationException`.

**Lý do 3: hashCode thay đổi sau khi save → Set lưu sai**

```java
Movie m = new Movie();  // id = null
m.setTitle("Avengers");
Set<Movie> set = new HashSet<>();
set.add(m);  // hashCode dựa trên id=null

movieRepo.save(m);  // sau save, id = 123 → hashCode đổi!
set.contains(m);  // false! không tìm thấy chính nó
```

### 18.2. Cách viết equals/hashCode đúng cho entity

**Cách 1: Theo business key (recommended)**

Movie có `code` unique → dùng `code`:

```java
@Entity
@Getter
@Setter
@NoArgsConstructor
public class Movie extends BaseEntity {
    @Column(unique = true)
    private String code;
    private String title;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Movie movie)) return false;
        return code != null && code.equals(movie.code);
    }

    @Override
    public int hashCode() {
        // Hằng số → tránh hashCode đổi
        // Performance không tối ưu nhưng đúng đắn
        return getClass().hashCode();
    }
}
```

**Cách 2: Dùng @EqualsAndHashCode.Include của Lombok**

```java
@Entity
@Getter
@Setter
@NoArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@ToString(onlyExplicitlyIncluded = true)
public class Movie extends BaseEntity {

    @EqualsAndHashCode.Include
    @ToString.Include
    @Column(unique = true)
    private String code;

    @ToString.Include
    private String title;

    // Collection KHÔNG include → tránh lazy load + stack overflow
    @OneToMany(mappedBy = "movie")
    private List<Showtime> showtimes;
}
```

### 18.3. Tóm tắt quy tắc CineX

- KHÔNG dùng `@Data` cho entity.
- Dùng `@Getter @Setter @NoArgsConstructor`.
- Tự viết hoặc khai báo rõ `equals/hashCode` theo business key.
- `toString` chỉ include field primitive, KHÔNG include relationship.

---

## 19. Fetch Strategy Mặc Định — Bẫy Tự Nhiên

### 19.1. Bảng default fetch

| Annotation | Default Fetch | Lý do |
|---|---|---|
| `@ManyToOne` | **EAGER** | Spec JPA (gây N+1 ngầm) |
| `@OneToOne` | **EAGER** | Spec JPA |
| `@OneToMany` | LAZY | Collection → không load mặc định |
| `@ManyToMany` | LAZY | Collection → không load mặc định |

### 19.2. Tại sao `@ManyToOne` EAGER nguy hiểm?

```java
@Entity
public class Booking extends BaseEntity {
    @ManyToOne  // Default EAGER
    private User user;

    @ManyToOne  // Default EAGER
    private Showtime showtime;
}
```

Khi `bookingRepo.findAll()`:

```sql
-- Hibernate sinh JOIN tự động (đỡ hơn N+1)
SELECT b.*, u.*, s.* FROM bookings b
LEFT JOIN users u ON b.user_id = u.id
LEFT JOIN showtimes s ON b.showtime_id = s.id;
```

Nhưng nếu Showtime cũng có `@ManyToOne Movie` (EAGER) → JOIN tiếp → JOIN bậc 3, 4. Query phình to. Nếu nhiều booking + nhiều EAGER → query 1000 dòng × 20 cột.

Tệ hơn, nếu fetch theo collection:

```java
@Entity
public class User extends BaseEntity {
    @OneToMany(mappedBy = "user")
    private List<Booking> bookings;  // LAZY OK
}
```

Khi `user.getBookings()` → mỗi booking lại EAGER fetch User và Showtime → **N+1 ngầm** ngay cả khi bạn nghĩ mình chỉ LAZY load 1 collection.

### 19.3. Best practice CineX: TẤT CẢ LAZY

```java
@Entity
public class Booking extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "showtime_id", nullable = false)
    private Showtime showtime;

    @OneToMany(mappedBy = "booking", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    private List<BookingSeat> bookingSeats = new ArrayList<>();
}
```

Cần data nào → fetch bằng `JOIN FETCH` hoặc `@EntityGraph` ở Repository.

---

## 20. Pagination — OFFSET vs Keyset

### 20.1. OFFSET pagination chậm với page lớn

```java
Page<Movie> page = movieRepo.findAll(PageRequest.of(1000, 20));
```

SQL Server sinh ra:

```sql
SELECT * FROM movies
ORDER BY created_at DESC
OFFSET 20000 ROWS FETCH NEXT 20 ROWS ONLY;
```

**Vấn đề:** DB phải quét + sort 20020 row, vứt 20000 row đầu, chỉ trả 20 row cuối. Page càng to → càng chậm. Page 1000 có thể mất 5-10 giây.

### 20.2. Keyset pagination (cursor-based)

Thay vì OFFSET, dùng "cursor" = giá trị cột sort của row cuối page trước.

```java
public interface MovieRepository extends JpaRepository<Movie, Long> {
    @Query("SELECT m FROM Movie m " +
           "WHERE m.createdAt < :lastCreatedAt " +
           "ORDER BY m.createdAt DESC")
    List<Movie> findNextPage(@Param("lastCreatedAt") Instant lastCreatedAt,
                              Pageable pageable);
}
```

API:

```
GET /api/movies?limit=20  -> trả page đầu + cursor = "2026-05-30T12:00:00Z"
GET /api/movies?limit=20&cursor=2026-05-30T12:00:00Z  -> page tiếp theo
```

SQL:

```sql
SELECT TOP 20 * FROM movies
WHERE created_at < '2026-05-30T12:00:00Z'
ORDER BY created_at DESC;
```

**DB chỉ quét index → trả 20 row ngay**. Nhanh constant time bất kể page nào.

### 20.3. Trade-off

| Tiêu chí | OFFSET | Keyset |
|---|---|---|
| Page jump (nhảy đến page 100) | Được | KHÔNG |
| Tổng số page | Biết | Không biết |
| Performance page lớn | Chậm | Nhanh |
| Phù hợp | Admin (ít data) | Mobile, infinite scroll |

CineX: Admin page dùng OFFSET (ít data + cần page jump). Public listing phim/showtime dùng keyset nếu data > 10k row.

---

## 21. @Modifying Pitfalls

### 21.1. Phải dùng cho UPDATE/DELETE qua @Query

```java
public interface NotificationRepository extends JpaRepository<Notification, Long> {

    // SAI — không có @Modifying → throw exception
    @Query("UPDATE Notification n SET n.isRead = true WHERE n.user.id = :userId")
    int markAllAsRead(@Param("userId") Long userId);

    // ĐÚNG
    @Modifying
    @Transactional
    @Query("UPDATE Notification n SET n.isRead = true WHERE n.user.id = :userId")
    int markAllAsRead(@Param("userId") Long userId);
}
```

### 21.2. clearAutomatically = true — Tránh stale entity

Sau UPDATE bulk, persistent context **vẫn giữ entity cũ**:

```java
@Modifying
@Query("UPDATE Notification n SET n.isRead = true WHERE n.user.id = :userId")
int markAllAsRead(@Param("userId") Long userId);
```

```java
@Transactional
public void test(Long userId) {
    Notification n = notificationRepo.findById(5L).orElseThrow();
    System.out.println(n.isRead());  // false

    notificationRepo.markAllAsRead(userId);  // UPDATE DB → notification.is_read = true

    System.out.println(n.isRead());  // vẫn FALSE! Persistent context không refresh
}
```

**Fix: `clearAutomatically = true`** — clear persistent context sau khi modify:

```java
@Modifying(clearAutomatically = true, flushAutomatically = true)
@Query("UPDATE Notification n SET n.isRead = true WHERE n.user.id = :userId")
int markAllAsRead(@Param("userId") Long userId);
```

- `flushAutomatically = true`: flush pending changes trước UPDATE → tránh ghi đè bằng giá trị cũ.
- `clearAutomatically = true`: clear cache sau UPDATE → lần đọc kế tiếp re-query DB.

### 21.3. Trả về số row affected

```java
int affected = notificationRepo.markAllAsRead(userId);
log.info("Đã đánh dấu {} notification là đã đọc", affected);
```

JPA trả số row bị UPDATE/DELETE → tiện cho audit log.

---

## 22. Cascade và orphanRemoval Pitfalls

### 22.1. Bảng các CascadeType

| Type | Tác dụng |
|---|---|
| `PERSIST` | save parent → save children |
| `MERGE` | merge parent → merge children |
| `REMOVE` | delete parent → delete children |
| `REFRESH` | refresh parent → refresh children |
| `DETACH` | detach parent → detach children |
| `ALL` | gộp tất cả |

`orphanRemoval = true`: child bị remove khỏi collection → DELETE child khỏi DB.

### 22.2. Anti-pattern: setCollection với orphanRemoval

```java
@Entity
public class Booking extends BaseEntity {
    @OneToMany(mappedBy = "booking", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<BookingSeat> bookingSeats = new ArrayList<>();
}
```

```java
// CODE SAI
booking.setBookingSeats(new ArrayList<>());
// Hibernate throw:
// org.hibernate.HibernateException: A collection with cascade="all-delete-orphan"
// was no longer referenced by the owning entity instance
```

**Tại sao?** Khi thay collection mới → collection cũ bị "abandon" → Hibernate không biết delete cái nào.

### 22.3. Cách đúng: clear() + addAll()

```java
booking.getBookingSeats().clear();  // Đánh dấu xóa từng phần tử
booking.getBookingSeats().addAll(newSeats);  // Thêm lại
```

Hoặc dùng helper method:

```java
@Entity
public class Booking extends BaseEntity {
    public void replaceSeats(List<BookingSeat> newSeats) {
        this.bookingSeats.clear();
        newSeats.forEach(s -> {
            s.setBooking(this);
            this.bookingSeats.add(s);
        });
    }
}
```

### 22.4. Ví dụ Booking - BookingSeat trong CineX

```java
@Entity
@Table(name = "bookings")
public class Booking extends BaseEntity {

    @OneToMany(
        mappedBy = "booking",
        cascade = CascadeType.ALL,  // save booking → save seats
        orphanRemoval = true,        // remove seat khỏi list → DELETE DB
        fetch = FetchType.LAZY
    )
    private List<BookingSeat> bookingSeats = new ArrayList<>();
}
```

**Lý do chọn `ALL + orphanRemoval`:**
- BookingSeat KHÔNG tồn tại độc lập → vòng đời gắn 100% với Booking.
- Xóa Booking phải xóa BookingSeat.
- Sửa Booking (đổi ghế) → BookingSeat cũ bị remove khỏi list → tự DELETE.

**Ngược lại, Booking - User KHÔNG cascade REMOVE:**

```java
@ManyToOne(fetch = FetchType.LAZY)
// KHÔNG có cascade — vì xóa Booking KHÔNG được xóa User!
private User user;
```

---

## 23. Temporal Types — Bẫy Timezone

### 23.1. So sánh các kiểu thời gian Java 8+

| Type | Có timezone? | Use case |
|---|---|---|
| `LocalDateTime` | KHÔNG | Thời gian "địa phương" không gắn timezone (giờ chiếu phim tại rạp) |
| `LocalDate` | KHÔNG | Ngày sinh, ngày phát hành |
| `LocalTime` | KHÔNG | Giờ trong ngày (giờ mở cửa) |
| `Instant` | UTC (epoch) | Mốc thời gian tuyệt đối (createdAt, log timestamp) |
| `OffsetDateTime` | Có offset (+07:00) | API external trả về timezone cố định |
| `ZonedDateTime` | Có zone (Asia/Ho_Chi_Minh) | Cần lưu zone để DST/lịch sử |

### 23.2. SQL Server và timezone

SQL Server có 2 kiểu:
- `DATETIME2`: KHÔNG có timezone, lưu 7 chữ số nano.
- `DATETIMEOFFSET`: có offset, lưu kèm `+07:00`.

JPA mapping mặc định:
- `LocalDateTime` → `DATETIME2`
- `Instant` → `DATETIME2` (Hibernate tự convert UTC).
- `OffsetDateTime` → `DATETIMEOFFSET`.

### 23.3. Bẫy timezone phổ biến

**Bẫy 1: Server múi giờ khác client**

Server deploy ở Singapore (UTC+8), client xem ở Việt Nam (UTC+7).

```java
@Entity
public class Booking extends BaseEntity {
    private LocalDateTime createdAt;  // SAI — không gắn timezone
}
```

Server lưu `2026-05-31 10:00:00`. Client hiểu thành 10:00 giờ VN, nhưng thực ra là 10:00 giờ SG (= 09:00 giờ VN).

**Bẫy 2: Daylight Saving Time (DST)**

US đổi giờ mỗi 6 tháng. `LocalDateTime` không biết DST → tính khoảng cách 2 thời điểm sai.

### 23.4. Quy ước CineX

**Tất cả timestamp HỆ THỐNG (createdAt, updatedAt, expiredAt):** CineX dùng `LocalDateTime` (KHÔNG dùng `Instant`).

```java
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
public abstract class BaseEntity {

    @CreatedDate
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;
}
```

> Tradeoff: `LocalDateTime` đơn giản hơn `Instant` — value vào DB đúng như khi `LocalDateTime.now()` trả về, không qua bước convert timezone. **Đánh đổi:** mất thông tin múi giờ, nên chỉ phù hợp với app chạy trong **1 múi giờ duy nhất** (CineX: tất cả rạp ở Việt Nam, server cũng cấu hình timezone Asia/Ho_Chi_Minh). Nếu sau này CineX mở rạp ở nước ngoài → phải migrate sang `Instant` (UTC) + convert ở tầng FE.

DB lưu `2026-05-31 10:00:00` (giờ VN). Khi serialize JSON, Jackson trả ISO-8601 local:

```json
{
  "createdAt": "2026-05-31T10:00:00"
}
```

FE format hiển thị `10:00 31/05/2026` qua hàm `fmtDateTime()` trong `utils/labels.ts`.

**Giờ chiếu phim (showtime.startAt):** cũng dùng `LocalDateTime` cùng lý do — rạp ở Việt Nam, không cần timezone.

```java
@Entity
public class Showtime extends BaseEntity {
    @Column(name = "start_at", nullable = false)
    private LocalDateTime startAt;  // 19:30 tối — giờ VN
}
```

**Ngày sinh user (`dateOfBirth`):** `LocalDate` — chỉ ngày, không giờ, không zone.

**Khi nào nên dùng `Instant` thay vì `LocalDateTime`?**
- App đa quốc gia, đa timezone.
- Tích hợp với API ngoài (Stripe, PayPal, ...) yêu cầu timestamp UTC.
- Lưu thời điểm xảy ra event không phụ thuộc vị trí (analytics, audit log toàn cầu).

```java
private LocalDate birthDate;
```

### 23.5. Cấu hình Jackson trả UTC

```yaml
spring:
  jackson:
    time-zone: UTC
    date-format: yyyy-MM-dd'T'HH:mm:ss'Z'
    serialization:
      write-dates-as-timestamps: false
```

### 23.6. Tóm tắt nguyên tắc

1. **Store UTC, display local.** Lưu Instant UTC, convert sang giờ user khi hiển thị.
2. **Dùng LocalDateTime CHỈ khi:** thời gian không gắn timezone (giờ chiếu phim cùng rạp).
3. **Tránh `java.util.Date` và `java.sql.Timestamp`** — legacy, có bug timezone.
4. **Không tự parse "2026-05-31 10:00:00"** — luôn dùng `DateTimeFormatter` với `ZoneId` rõ ràng.
5. **DB column type khớp Java type:** `Instant` → `DATETIME2`, `OffsetDateTime` → `DATETIMEOFFSET`.
