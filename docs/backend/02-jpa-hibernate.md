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
