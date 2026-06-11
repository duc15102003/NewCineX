# Module Movie — Giải thích chi tiết

## 1. Tổng quan
Module Movie quản lý **phim** và **thể loại phim**:
- User: xem danh sách phim, tìm kiếm, lọc theo thể loại/trạng thái, xem chi tiết
- Admin: thêm/sửa/xóa phim, upload poster, thêm thể loại mới

**Bài toán chính:** Phim có nhiều thể loại, thể loại có nhiều phim (N:N). User cần tìm kiếm + lọc linh hoạt.

## 2. Danh sách files

| File | Tác dụng | Design Pattern |
|---|---|---|
| `module/movie/entity/Movie.java` | Entity phim, @ManyToMany với Genre | — |
| `module/movie/entity/Genre.java` | Entity thể loại | — |
| `module/movie/entity/MovieStatus.java` | Enum trạng thái phim | Enum Pattern |
| `module/movie/dto/MovieRequest.java` | DTO tạo/sửa phim (validation) | DTO |
| `module/movie/dto/MovieResponse.java` | DTO chi tiết phim (full fields) | DTO |
| `module/movie/dto/MovieListResponse.java` | DTO rút gọn cho danh sách | DTO |
| `module/movie/dto/GenreRequest.java` | DTO tạo thể loại | DTO |
| `module/movie/dto/GenreResponse.java` | DTO trả thể loại | DTO |
| `module/movie/repository/MovieRepository.java` | JpaSpecificationExecutor + **@EntityGraph(genres)** fix N+1 | Repository + Specification |
| `module/movie/repository/GenreRepository.java` | CRUD thể loại | Repository |
| `module/movie/specification/MovieSpecification.java` | Build query WHERE động | Specification Pattern |
| `module/movie/mapper/MovieMapper.java` | Movie ↔ DTO (xử lý N:N) | Mapper (MapStruct) |
| `module/movie/mapper/GenreMapper.java` | Genre ↔ DTO | Mapper (MapStruct) |
| `module/movie/service/MovieService.java` | CRUD + search + upload poster | Service |
| `module/movie/service/GenreService.java` | List + create genre | Service |
| `module/movie/controller/MovieController.java` | 6 endpoints phim | Controller |
| `module/movie/controller/GenreController.java` | 2 endpoints thể loại | Controller |
| **Pattern Movie + MovieRun (Section 4)** | | |
| `module/movie/entity/MovieRun.java` | Entity đợt chiếu — 1 Movie ↔ N MovieRun | — |
| `module/movie/entity/MovieRunType.java` | Enum FIRST_RUN/REISSUE/FESTIVAL/SPECIAL | Enum Pattern |
| `module/movie/entity/MovieRunStatus.java` | Enum SCHEDULED/NOW_SHOWING/ENDED | Enum + State Machine |
| `module/movie/dto/MovieRunRequest.java` | DTO tạo/sửa run | DTO |
| `module/movie/dto/MovieRunResponse.java` | DTO trả run | DTO |
| `module/movie/repository/MovieRunRepository.java` | CRUD + `existsOverlap` + `archiveByMovieId` bulk | Repository |
| `module/movie/mapper/MovieRunMapper.java` | MovieRun → DTO (MapStruct) | Mapper |
| `module/movie/service/MovieRunService.java` | CRUD MovieRun + helper `recomputeMovieStatus` | Service |
| `module/movie/service/MovieRunStatusScheduler.java` | Cron 00:01 daily + `@SchedulerLock` | Scheduled Task |
| `module/movie/controller/MovieRunController.java` | REST `/api/movie-runs` | Controller |
| `db/changelog/changes/051-create-movie-runs-table.xml` | Phase 1 migration: tạo bảng + backfill + thêm cột NULLABLE | Liquibase |
| `db/changelog/changes/052-showtime-movie-run-not-null.xml` | Phase 2 migration: alter NOT NULL với preConditions | Liquibase |

---

## 3. Design Patterns

### 3.1 Specification Pattern (Behavioral)

#### Pattern là gì?
Cho phép **ghép nhiều điều kiện** query WHERE một cách linh hoạt, thay vì viết 1 method cho mỗi tổ hợp.

#### Ví dụ đời thường
Bạn tìm phim trên CGV:
- Chỉ tìm theo tên: "Avengers"
- Tìm theo tên + thể loại: "Avengers" + "Action"
- Tìm theo tên + thể loại + trạng thái: "Avengers" + "Action" + "Đang chiếu"
- Chỉ lọc trạng thái: "Đang chiếu"

→ 4 tổ hợp chỉ với 3 filter. Nếu thêm filter "ngôn ngữ" → 8 tổ hợp. Thêm "đạo diễn" → 16 tổ hợp.
→ **Không thể viết 1 method cho mỗi tổ hợp.**

#### Áp dụng ở đâu

```java
// MovieSpecification.java — mỗi điều kiện = 1 method nhỏ
public static Specification<Movie> hasTitle(String keyword) {
    return (root, query, cb) ->
        cb.like(cb.lower(root.get("title")), "%" + keyword.toLowerCase() + "%");
}

public static Specification<Movie> hasStatus(MovieStatus status) {
    return (root, query, cb) ->
        cb.equal(root.get("status"), status);
}

public static Specification<Movie> hasGenre(Long genreId) {
    return (root, query, cb) -> {
        var genreJoin = root.join("genres", JoinType.LEFT);
        return cb.equal(genreJoin.get("id"), genreId);
    };
}
```

```java
// MovieService.java — nhận Filter DTO, build Specification tự động
public PageResponse<MovieListResponse> listMovies(MovieFilter filter, Pageable pageable) {
    var spec = MovieSpecification.fromFilter(filter);
    // fromFilter() bên trong tự ghép: notDeleted + hasTitle + hasStatus + hasGenre
    Page<MovieListResponse> page = movieRepository.findAll(spec, pageable)
            .map(movieMapper::toListResponse);
    return PageResponse.from(page);
}

// MovieSpecification.fromFilter() — entry point thống nhất
public static Specification<Movie> fromFilter(MovieFilter filter) {
    Specification<Movie> spec = Specification.where(null);
    if (!Boolean.TRUE.equals(filter.getIncludeDeleted())) spec = spec.and(notDeleted());
    if (StringUtils.hasText(filter.getKeyword()))          spec = spec.and(hasTitle(filter.getKeyword()));
    if (filter.getStatus() != null)                        spec = spec.and(hasStatus(filter.getStatus()));
    if (filter.getGenreId() != null)                       spec = spec.and(hasGenre(filter.getGenreId()));
    return spec;
}
```

#### Giải thích Criteria API (root, query, cb)

```java
(root, query, cb) -> cb.like(cb.lower(root.get("title")), "%avengers%")
  │      │     │
  │      │     └── CriteriaBuilder: tạo biểu thức (like, equal, greaterThan, ...)
  │      └── CriteriaQuery: đại diện cho câu SELECT (ít khi dùng trực tiếp)
  └── Root<Movie>: đại diện cho bảng movies (root.get("title") = cột title)

// SQL sinh ra:
WHERE LOWER(m.title) LIKE '%avengers%'
```

#### So sánh: Không dùng vs Có dùng Specification

```java
// ❌ KHÔNG dùng Specification — viết method cho mỗi tổ hợp
interface MovieRepository {
    Page<Movie> findByTitle(String title, Pageable p);
    Page<Movie> findByStatus(MovieStatus status, Pageable p);
    Page<Movie> findByTitleAndStatus(String title, MovieStatus status, Pageable p);
    Page<Movie> findByTitleAndStatusAndGenresId(String t, MovieStatus s, Long gId, Pageable p);
    // ... thêm filter = thêm method theo CẤP SỐ NHÂN
}

// ✅ CÓ dùng Specification — ghép tùy ý, thêm filter = thêm 1 method nhỏ
Specification.where(hasTitle("Avengers"))
    .and(hasStatus(NOW_SHOWING))
    .and(hasGenre(1L))
// Thêm filter "language"? → chỉ thêm 1 method hasLanguage()
```

#### Khi nào KHÔNG nên dùng?
- Query đơn giản, chỉ 1-2 điều kiện cố định → `findByXxx` đủ rồi
- Specification phức tạp hơn → chỉ dùng khi có **search/filter động**

#### MovieFilter mở rộng (Phase 4a)

Phase 4a mở rộng `MovieFilter` từ 5 field → 11 field, hỗ trợ filter sâu hơn cho cả user (trang Phim) lẫn admin:

```java
@Getter @Setter
public class MovieFilter {
    // Cũ
    private String keyword;
    private MovieStatus status;
    private Long genreId;
    private Boolean includeDeleted;
    private Boolean showing;

    // ==== Mở rộng Phase 4a (J1) ====
    private String director;              // LIKE %director%, case-insensitive
    private String cast;                  // LIKE %cast%
    private String language;              // equals (VD: "Tiếng Việt", "English")
    private Integer minDuration;          // BETWEEN — phút
    private Integer maxDuration;
    private BigDecimal minRating;         // BETWEEN — COALESCE(rating, 0)
    private BigDecimal maxRating;
    private LocalDate releaseDateFrom;    // BETWEEN — ngày phát hành
    private LocalDate releaseDateTo;
    private Boolean hasActiveShowtimes;   // alias của showing
}
```

**Specification mới — `hasRatingBetween` với COALESCE:**
```java
public static Specification<Movie> hasRatingBetween(BigDecimal min, BigDecimal max) {
    return (root, query, cb) -> {
        // Phim chưa có review → rating NULL → coi như 0
        // Tránh user filter "rating >= 7" lẫn phim NULL (NULL không so sánh được)
        var ratingExpr = cb.coalesce(root.<BigDecimal>get("rating"), BigDecimal.ZERO);
        if (min != null && max != null) return cb.between(ratingExpr, min, max);
        else if (min != null)          return cb.greaterThanOrEqualTo(ratingExpr, min);
        else                            return cb.lessThanOrEqualTo(ratingExpr, max);
    };
}
```

SQL sinh ra: `WHERE COALESCE(m.rating, 0) >= 7.0`

**Sort: dùng Spring Pageable built-in, KHÔNG custom sortBy:**
```
GET /api/movies?sort=rating,desc&sort=createdAt,desc&size=20
                ^^^^^^^^^^^^^^^^                       ^^^^^^^
                Spring tự parse → ORDER BY m.rating DESC, m.created_at DESC
```

Controller chỉ cần `@PageableDefault(sort = "createdAt", direction = DESC)` cho default — FE override bằng `?sort=...`.

**Tránh over-filter:**

| Có nên thêm filter? | Lý do |
|---|---|
| FE thực sự cần lọc trên UI | YES |
| Filter chạy ≤ 10/giây | YES |
| Filter hot, có index hỗ trợ | YES |
| "Phòng hờ" — biết đâu FE cần | **NO** — KHÔNG thêm |
| Filter join sâu 4+ bảng | Cân nhắc — có thể chậm; xem index |

---

### 3.2 Quan hệ N:N (Many-to-Many) trong JPA

#### Bài toán
- 1 phim có nhiều thể loại: "Avengers" = Action + Sci-Fi + Adventure
- 1 thể loại thuộc nhiều phim: "Action" có Avengers, John Wick, Fast & Furious

#### Cách hoạt động trong database

```
┌───────────┐     ┌──────────────┐     ┌───────────┐
│  movies   │     │ movie_genres │     │  genres   │
├───────────┤     ├──────────────┤     ├───────────┤
│ id: 1     │──┐  │ movie_id: 1  │  ┌──│ id: 1     │
│ "Avengers"│  ├──│ genre_id: 1  │──┘  │ "Action"  │
│           │  │  │ movie_id: 1  │──┐  │           │
│           │  └──│ genre_id: 5  │  │  │ id: 5     │
│           │     │ movie_id: 2  │──┤  │ "Sci-Fi"  │
│ id: 2     │──┐  │ genre_id: 1  │  │  │           │
│ "John Wick│  └──│ movie_id: 2  │  └──│           │
└───────────┘     │ genre_id: 4  │     │ id: 4     │
                  └──────────────┘     │ "Drama"   │
                  Bảng JOIN (không     └───────────┘
                  có entity riêng)
```

- Bảng `movie_genres` = **bảng join** — chỉ chứa 2 FK, không có entity riêng
- JPA tự quản lý bảng join khi dùng `@ManyToMany`

#### Code entity

```java
// Movie.java
@ManyToMany(fetch = FetchType.LAZY)
@JoinTable(
    name = "movie_genres",                          // Tên bảng join
    joinColumns = @JoinColumn(name = "movie_id"),   // FK từ bảng movies
    inverseJoinColumns = @JoinColumn(name = "genre_id")  // FK từ bảng genres
)
private Set<Genre> genres = new HashSet<>();
```

**Tại sao `Set` mà không phải `List`?**
- `Set` đảm bảo không trùng (1 phim không thể có 2 lần "Action")
- Hibernate với `@ManyToMany` + `List` có bug: khi xóa 1 genre khỏi phim, Hibernate xóa **TẤT CẢ** row trong bảng join rồi insert lại → chậm + nguy hiểm
- `Set` tránh bug này — Hibernate chỉ xóa đúng row cần xóa

**FetchType.LAZY:**
```sql
-- Khi query movie, KHÔNG tự động load genres
SELECT * FROM movies WHERE id = 1

-- Chỉ khi gọi movie.getGenres() mới query:
SELECT g.* FROM genres g
JOIN movie_genres mg ON g.id = mg.genre_id
WHERE mg.movie_id = 1
```
→ Tránh N+1 problem: list 20 phim mà không cần genres → chỉ 1 query thay vì 21 query.

#### Cách gán genres cho movie

Client gửi `genreIds: [1, 3, 5]` (chỉ gửi ID, không gửi object Genre):

```java
// MovieService.resolveGenres()
private Set<Genre> resolveGenres(Set<Long> genreIds) {
    Set<Genre> genres = new HashSet<>(genreRepository.findAllById(genreIds));
    // SQL: SELECT * FROM genres WHERE id IN (1, 3, 5)
    // → Trả về 3 Genre entities

    if (genres.size() != genreIds.size()) {
        // Client gửi ID không tồn tại → báo lỗi
        throw new BusinessException(ErrorCode.GENRE_NOT_FOUND);
    }
    return genres;
}

// Khi save movie:
movie.setGenres(resolveGenres(request.getGenreIds()));
movieRepository.save(movie);
// JPA tự INSERT vào bảng movie_genres:
// INSERT INTO movie_genres (movie_id, genre_id) VALUES (1, 1), (1, 3), (1, 5)
```

---

### 3.3 MapStruct xử lý N:N

**Khó khăn:** Entity `Movie.genres = Set<Genre>`, nhưng:
- `MovieResponse.genres = Set<GenreResponse>` (DTO đầy đủ)
- `MovieListResponse.genres = Set<GenreResponse>` (cũng trả `GenreResponse` kèm `storageState`, FE tự lọc)

#### Cách MovieMapper xử lý Genre

```java
@Mapper(componentModel = "spring")
public interface MovieMapper {

    @Mapping(source = "genres", target = "genres", qualifiedByName = "genreResponses")
    MovieResponse toResponse(Movie movie);

    @Mapping(source = "genres", target = "genres", qualifiedByName = "genreResponses")
    MovieListResponse toListResponse(Movie movie);

    /** Set<Genre> → Set<GenreResponse>: trả TẤT CẢ kèm storageState (FE tự lọc). */
    @Named("genreResponses")
    default Set<GenreResponse> mapGenreResponses(Set<Genre> genres) {
        if (genres == null) return Set.of();
        return genres.stream()
                .map(g -> GenreResponse.builder()
                        .id(g.getId())
                        .name(g.getName())
                        .description(g.getDescription())
                        .storageState(g.getStorageState() != null ? g.getStorageState().name() : null)
                        .build())
                .collect(Collectors.toSet());
    }
}
```

Giải thích:

- `@Mapper(componentModel = "spring")` — KHÔNG dùng `uses = GenreMapper.class` vì MovieMapper tự
  viết custom method `mapGenreResponses` để build `GenreResponse` thủ công (cần trả `storageState`
  để FE phân biệt thể loại đã ARCHIVED). Đặt logic ngay trong MovieMapper giúp:
  - Không phụ thuộc bean `GenreMapper` (giảm coupling)
  - Tự do thêm field cho `GenreResponse` mà không ảnh hưởng nơi khác

- `@Named("genreResponses")` đánh dấu method này có tên `"genreResponses"`
- `qualifiedByName = "genreResponses"` → khi map field `genres`, MapStruct gọi đúng method có tên đó
- `default` method: Java cho phép viết method có body trong interface (từ Java 8)

> Vì sao trả `Set<GenreResponse>` cho cả list lẫn detail (không phải `Set<String>` chỉ tên)?
> — Admin muốn biết thể loại nào ARCHIVED (badge mờ), user muốn ẩn ARCHIVED. Trả full DTO + `storageState`
> giúp FE tự quyết, BE không phải tạo 2 response khác nhau.

---

### 3.4 Enum Pattern — MovieStatus

```java
public enum MovieStatus {
    COMING_SOON,   // Sắp chiếu
    NOW_SHOWING,   // Đang chiếu
    ENDED          // Đã kết thúc
}
```

**Tại sao Enum thay vì String?**

```java
// ❌ String — dễ sai chính tả, runtime mới phát hiện
movie.setStatus("COMMING_SOON");  // Typo! Nhưng compile OK → lỗi runtime
movie.setStatus("now_showing");   // Sai casing! DB lưu khác → query không ra

// ✅ Enum — compile-time check
movie.setStatus(MovieStatus.COMMING_SOON);  // Compile ERROR ngay!
movie.setStatus(MovieStatus.COMING_SOON);   // ✅ Đúng
```

**Lưu DB:** `@Enumerated(EnumType.STRING)` → lưu text "COMING_SOON" trong DB.

**Tại sao STRING mà không ORDINAL?**
- ORDINAL lưu số thứ tự (0, 1, 2)
- Nếu thêm enum ở giữa: `COMING_SOON(0), **PRE_SALE(1)**, NOW_SHOWING(2→trở thành 2), ENDED(3→trở thành 3)`
- Data cũ: NOW_SHOWING = 1 → giờ 1 = PRE_SALE → **SAI HOÀN TOÀN**
- STRING lưu text → thêm/xóa enum không ảnh hưởng data cũ

---

### 3.5 [DEPRECATED] Vòng đời Movie phẳng — pattern cũ "1 Movie = 1 lifecycle"

> **Lưu ý lịch sử:** Section này mô tả pattern **cũ** trước commit `ec8d1cf`. Đã được thay thế bởi **Section 4 — Pattern Movie + MovieRun (Engagement)** ở dưới. Giữ lại để tham khảo "trước-sau" cho bạn học hiểu vì sao phải refactor.

#### Bài toán ban đầu (đặt ở Movie)

Trước refactor, `Movie` entity chứa **trực tiếp** 3 field lifecycle:

```java
// PATTERN CŨ — KHÔNG dùng nữa
public class Movie {
    private LocalDate releaseDate;   // ngày khởi chiếu
    private LocalDate endDate;       // ngày rút rạp
    private MovieStatus status;      // COMING_SOON / NOW_SHOWING / ENDED
}
```

Và 1 `MovieStatusScheduler` cron 00:01 daily flip status theo `today vs (releaseDate, endDate)`.

#### Vấn đề (vì sao phải refactor)

Pattern này giả định **"1 phim chỉ có đúng 1 đợt chiếu trong vòng đời"**. Sai với thực tế công nghiệp:

| Scenario thực tế | Pattern cũ làm sao? |
|---|---|
| Avatar (2009) chiếu lần đầu → ENDED 2010. Năm 2026 chiếu lại bản 4K Remaster | **Phải tạo "Movie" mới** với title "Avatar (4K Remaster)" → review/favorite/lịch sử mất liên kết với phim gốc |
| Titanic chiếu kỷ niệm 25 năm | Tạo Movie trùng tên → 2 phim cùng tên trên app, user bối rối |
| Phim festival xen kẽ chiếu thương mại | Movie status chỉ có 1 trạng thái, không tách biệt được |
| Sneak preview trước releaseDate chính thức | Không kiến trúc nào hỗ trợ (preview = đợt chiếu sớm trước run chính) |

→ Pattern **"Movie = metadata + lifecycle gộp"** **không scale**. Industry (CGV, Lotte, AMC) tách rõ:

- **Movie** = "phim này" — metadata bất biến (title, đạo diễn, duration, poster, releaseDate gốc thế giới)
- **MovieRun** = "đợt chiếu này" — gắn với cinema/rạp, có thời gian + status riêng. 1 movie có thể có nhiều run.

Section 4 ngay dưới giải thích pattern mới chi tiết.

---

## 4. Pattern Movie + MovieRun (Engagement)

> Pattern này được CineX adopt từ commit `ec8d1cf` (C1) → `78625cd` (C4). Là refactor lớn nhất từ trước tới giờ của module Movie. Đây là chỗ học sâu nhất nếu bạn quan tâm đến **schema evolution** trong production.

### 4.1 Bài toán nhắc lại

1 phim có thể có nhiều đợt chiếu. Pattern 1-1 phẳng KHÔNG support. Phải tách:

```
┌─ Movie (metadata cố định) ─────────┐    ┌─ MovieRun (đợt chiếu) ──────────┐
│ id, title, director, cast          │    │ id, movie_id (FK ManyToOne)     │
│ duration, posterUrl, language      │ 1 ─< startDate, endDate              │
│ releaseDate (gốc thế giới — 2009)  │    │ runType: FIRST_RUN/REISSUE/...  │
│ status (derived field, xem 4.4)    │    │ status: SCHEDULED/NOW_SHOWING/  │
│ rating                             │    │         ENDED                   │
└────────────────────────────────────┘    │ notes ("Bản 4K kỷ niệm 17 năm") │
                                          └─────────────────────────────────┘
                                                       1
                                                       v
                                          ┌─ Showtime ──────────────────────┐
                                          │ id, movie_run_id (FK, NOT NULL) │
                                          │ movie_id (denormalized backup,  │
                                          │   invariant: == run.movie)      │
                                          │ room_id, startTime, ...         │
                                          └─────────────────────────────────┘
```

Quan hệ: **1 Movie ↔ N MovieRun ↔ N Showtime**. Showtime trỏ trực tiếp tới Run, KHÔNG trỏ tới Movie nữa (movie chỉ là field denormalized — xem 4.5).

### 4.2 Schema mới — bảng `movie_runs`

File: `backend/src/main/java/com/cinex/module/movie/entity/MovieRun.java`

```java
@Entity
@Table(name = "movie_runs")
public class MovieRun extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "movie_id", nullable = false)
    private Movie movie;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "run_type", nullable = false, length = 20)
    @Builder.Default
    private MovieRunType runType = MovieRunType.FIRST_RUN;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private MovieRunStatus status = MovieRunStatus.SCHEDULED;

    @Column(length = 500)
    private String notes;
}
```

2 enum đi kèm:

```java
public enum MovieRunType { FIRST_RUN, REISSUE, FESTIVAL, SPECIAL }
public enum MovieRunStatus { SCHEDULED, NOW_SHOWING, ENDED }
```

**Tại sao tách 2 enum?**

- `runType` = bản chất đợt chiếu (gán 1 lần khi tạo, không đổi). VD: REISSUE.
- `status` = trạng thái thời gian (auto-update theo cron). VD: NOW_SHOWING.
- 2 thuộc tính **độc lập về mặt nghiệp vụ** → không nên gộp vào 1 enum 12-state combinatoric.

### 4.3 Lifecycle 1 run — `MovieRunStatusScheduler`

```
   ┌───────────────┐  today >= startDate  ┌───────────────┐  today > endDate  ┌──────────┐
   │  SCHEDULED    │ ───────────────────► │  NOW_SHOWING  │ ────────────────► │  ENDED   │
   │ (chưa chiếu)  │                      │ (đang chiếu)  │                   │ (đã hết) │
   └───────────────┘                      └───────────────┘                   └──────────┘
```

File: `backend/src/main/java/com/cinex/module/movie/service/MovieRunStatusScheduler.java`

```java
@Scheduled(cron = "0 1 0 * * *")
@SchedulerLock(name = "movieRunStatusUpdate", lockAtLeastFor = "PT1M", lockAtMostFor = "PT10M")
@Transactional
public void updateMovieRunStatus() {
    LocalDate today = LocalDate.now();
    Set<Movie> affectedMovies = new HashSet<>();

    // 1. SCHEDULED → NOW_SHOWING
    List<MovieRun> toStart = movieRunRepository
            .findByStatusAndStartDateLessThanEqual(MovieRunStatus.SCHEDULED, today);
    for (MovieRun run : toStart) {
        if (!today.isAfter(run.getEndDate())) {  // edge: data lỗi startDate=today, endDate<today
            run.setStatus(MovieRunStatus.NOW_SHOWING);
            affectedMovies.add(run.getMovie());
        }
    }

    // 2. NOW_SHOWING → ENDED
    List<MovieRun> toEnd = movieRunRepository
            .findByStatusAndEndDateLessThan(MovieRunStatus.NOW_SHOWING, today);
    for (MovieRun run : toEnd) {
        run.setStatus(MovieRunStatus.ENDED);
        affectedMovies.add(run.getMovie());
    }

    // 3. Bonus: recompute Movie.status (derived)
    for (Movie movie : affectedMovies) {
        movieRunService.recomputeMovieStatus(movie);
    }
}
```

**Điểm cần chú ý:**
- `@SchedulerLock` (ShedLock) — khi deploy nhiều instance, chỉ 1 instance chạy job tại 1 thời điểm. Tránh 2 node cùng update → race condition. Xem `docs/backend/16-architectural-patterns.md` mục 5.
- `lockAtLeastFor = "PT1M"` — chống clock skew (đồng hồ node A nhanh hơn node B vài giây).
- `lockAtMostFor = "PT10M"` — nếu node lock xong rồi crash, lock tự release sau 10 phút.

### 4.4 Movie.status — Derived Field (Option B)

Sau refactor, **Movie KHÔNG còn `releaseDate/endDate`** ở vai trò lifecycle (releaseDate giờ chỉ là "ngày khởi chiếu gốc thế giới" - metadata). Nhưng vẫn giữ `Movie.status`.

**Vì sao giữ field này?** — Backward compatibility với DTO:

- `MovieResponse.status`, `MovieListResponse.status`, `FavoriteMovieResponse.status` đã expose ra FE
- FE dùng status để hiển thị badge "Đang chiếu" / "Sắp chiếu", filter "Phim đang chiếu" trên trang chủ
- Nếu drop hẳn → phải sửa nhiều DTO + FE + filter logic → diện ảnh hưởng rộng

**Giải pháp Option B:** Giữ field, **recompute từ runs** mỗi khi run thay đổi.

File: `MovieRunService.recomputeMovieStatus(Movie)`

```java
public void recomputeMovieStatus(Movie movie) {
    List<MovieRun> runs = movieRunRepository
            .findByMovieIdAndStorageStateNot(movie.getId(), StorageState.ARCHIVED);

    if (runs.isEmpty()) return;  // Không có run — giữ status cũ

    boolean hasNowShowing = runs.stream().anyMatch(r -> r.getStatus() == MovieRunStatus.NOW_SHOWING);
    boolean hasScheduled  = runs.stream().anyMatch(r -> r.getStatus() == MovieRunStatus.SCHEDULED);

    MovieStatus newStatus;
    if (hasNowShowing)      newStatus = MovieStatus.NOW_SHOWING;
    else if (hasScheduled)  newStatus = MovieStatus.COMING_SOON;
    else                    newStatus = MovieStatus.ENDED;

    if (movie.getStatus() != newStatus) {
        movie.setStatus(newStatus);
        movieRepository.save(movie);
    }
}
```

Quy tắc derive:
- Có ≥1 run NOW_SHOWING → Movie = NOW_SHOWING
- Không có NOW_SHOWING nhưng có SCHEDULED → Movie = COMING_SOON
- Tất cả run ENDED → Movie = ENDED
- Không có run nào → giữ nguyên (Movie chưa được lên lịch chiếu)

Gọi `recomputeMovieStatus` ở: `MovieRunService.create / update / archive` + cuối job scheduler. **Eventual consistency** — Movie.status được sync lại sau mỗi event.

### 4.5 Showtime.movie — Denormalized Backup

`Showtime` giờ link tới `MovieRun` (NOT NULL). Nhưng **vẫn giữ field `movie`** denormalized — copy của `movieRun.movie`.

```java
@Entity
public class Showtime extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "movie_id", nullable = false)
    private Movie movie;          // DENORMALIZED — invariant: == movieRun.movie

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "movie_run_id", nullable = false)
    private MovieRun movieRun;    // Nguồn truy vấn chính
    // ...
}
```

**Vì sao GIỮ field denormalized này?**

1. **Tránh break diện rộng:** rất nhiều query/report/statistics đang join `showtimes → movies` trực tiếp. Specification cũ (`hasShowtimeForMovie`), report doanh thu theo phim, filter homepage... đều dùng `showtime.movie_id`.
2. **Tối ưu query:** truy `showtime.movie.title` mà không cần JOIN qua movie_runs (giảm 1 bảng).
3. **Migration safe:** drop ngay sẽ làm app cũ (deploy chưa kịp restart) fail vì FK NOT NULL biến mất.

**Invariant bắt buộc:** `showtime.movie == showtime.movieRun.movie`. Service đảm bảo trong `createShowtime / updateShowtime` — luôn set 2 field cùng lúc.

```java
// ShowtimeService — invariant đảm bảo qua service code
MovieRun run = resolveMovieRun(movie, request.getMovieRunId());
showtime.setMovie(movie);
showtime.setMovieRun(run);  // run.getMovie() == movie GUARANTEED
```

Có thể drop ở C5+ sau khi audit hết các nơi đọc `showtime.movie` (có thể thay bằng `showtime.movieRun.movie`).

### 4.6 Migration 2-Phase — Pattern an toàn

**Bài toán:** Showtime cũ có `movie_id`. Schema mới cần `movie_run_id`. Migration 1-shot (drop + add NOT NULL) **NGUY HIỂM**:
- Backfill chưa kịp xong → NOT NULL fail → rollback toàn bộ deploy
- Bug trong logic backfill phát hiện sau khi đã alter schema → khó undo

**Giải pháp 2-phase** (Liquibase 051 + 052):

**Phase 1 (C1, changeset 051):**
```xml
<!-- Add column NULLABLE -->
<addColumn tableName="showtimes">
    <column name="movie_run_id" type="BIGINT"/>  <!-- nullable mặc định -->
</addColumn>

<!-- Backfill từ run của cùng movie -->
<sql>
    UPDATE s SET s.movie_run_id = (
        SELECT TOP 1 mr.id FROM movie_runs mr
        WHERE mr.movie_id = s.movie_id ORDER BY mr.start_date DESC
    )
    FROM showtimes s WHERE s.movie_run_id IS NULL;
</sql>

<!-- FK constraint (cho phép NULL — chưa NOT NULL) -->
<addForeignKeyConstraint ... />
```

→ Sau Phase 1: app có thể đọc/ghi `movie_run_id` (NULL hoặc value). Verify thủ công trong production trước khi sang Phase 2.

**Phase 2 (C2, changeset 052):**
```xml
<changeSet id="052-showtime-movie-run-id-not-null" author="cinex">
    <preConditions onFail="MARK_RAN" onFailMessage="...">
        <sqlCheck expectedResult="0">
            SELECT COUNT(*) FROM showtimes WHERE movie_run_id IS NULL
        </sqlCheck>
    </preConditions>
    <addNotNullConstraint tableName="showtimes" columnName="movie_run_id" columnDataType="BIGINT"/>
</changeSet>
```

→ `preConditions sqlCheck count=0` — chỉ alter NOT NULL nếu không còn row NULL. `onFail="MARK_RAN"` — nếu vẫn còn NULL (data rác hiếm gặp), không halt deploy mà ghi log + skip; admin fix tay rồi rerun changeset sau.

**Lợi ích:**
- Rollback Phase 2 dễ: chỉ ALTER `nullable = true` lại
- Phát hiện bug giữa 2 phase: rollback chỉ Phase 1 (drop column) — không mất data
- Production-safe: app deploy phase 1 chạy ổn rồi mới push phase 2

Xem doc kỹ hơn ở `docs/backend/16-architectural-patterns.md` mục 3.

### 4.7 Business Rules — MovieRunService

File: `backend/src/main/java/com/cinex/module/movie/service/MovieRunService.java`

| Rule | Vì sao | Code reference |
|---|---|---|
| Không 2 run overlap ngày của cùng movie | Nếu Avatar có run [01/05-30/06] và [15/06-15/07] → showtime ngày 20/06 thuộc run nào? Ambiguous | `ensureNoOverlap` + `MovieRunRepository.existsOverlap` |
| Không tạo run cho phim ARCHIVED | Phim đã xóa → tạo đợt chiếu vô nghĩa | `create` — check `movie.storageState == ARCHIVED` |
| Không đổi `movie` của run đã tồn tại | Data lineage: showtime đang trỏ run → đổi movie sẽ lệch invariant | `update` — check `run.movie.id == request.movieId` |
| Không archive run còn showtime SCHEDULED/ONGOING | Showtime "mồ côi" trỏ vào run đã ARCHIVED → user vẫn đặt vé được? | `archive` — `existsByMovieRunIdAndStatusIn(SCHEDULED, ONGOING)` |
| Cascade archive run khi archive movie | Movie archive → run vô nghĩa | `MovieService.deleteMovie` → `movieRunRepository.archiveByMovieId` |
| KHÔNG auto-restore run khi restore movie | Admin phải chọn cụ thể run nào restore (có thể chỉ muốn restore movie, không muốn chiếu lại) | `MovieService.restoreMovie` — comment explicit |

**Công thức overlap:** 2 khoảng `[a, b]` giao `[c, d]` ⇔ `a ≤ d AND c ≤ b`.

```java
// MovieRunRepository
@Query("SELECT COUNT(r) > 0 FROM MovieRun r " +
       "WHERE r.movie.id = :movieId " +
       "  AND r.storageState <> com.cinex.common.entity.StorageState.ARCHIVED " +
       "  AND r.id <> :excludeId " +
       "  AND r.startDate <= :end " +
       "  AND :start <= r.endDate")
boolean existsOverlap(@Param("movieId") Long movieId,
                      @Param("start") LocalDate start,
                      @Param("end") LocalDate end,
                      @Param("excludeId") Long excludeId);
```

`excludeId` để khi UPDATE 1 run, không tính chính nó là "overlap với chính nó".

### 4.8 API endpoints

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| `GET`    | `/api/movie-runs?movieId={id}` | Public | List runs của 1 phim, mới nhất ở đầu |
| `GET`    | `/api/movie-runs/{id}`         | Public | Chi tiết 1 run |
| `POST`   | `/api/movie-runs`              | ADMIN | Tạo run mới |
| `PUT`    | `/api/movie-runs/{id}`         | ADMIN | Sửa run |
| `DELETE` | `/api/movie-runs/{id}`         | ADMIN | Archive run |

Request mẫu tạo run:

```bash
curl -X POST http://localhost:8088/api/movie-runs \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "movieId": 42,
    "startDate": "2026-07-01",
    "endDate":   "2026-08-15",
    "runType":   "REISSUE",
    "notes":     "Bản 4K Remaster kỷ niệm 17 năm"
  }'
```

Response 200:

```json
{
  "success": true,
  "data": {
    "id": 101,
    "movieId": 42,
    "movieTitle": "Avatar",
    "startDate": "2026-07-01",
    "endDate":   "2026-08-15",
    "runType":   "REISSUE",
    "status":    "SCHEDULED",
    "notes":     "Bản 4K Remaster kỷ niệm 17 năm"
  }
}
```

### 4.9 Ví dụ thực tế — Avatar (2009 + 2026)

```
Movie #42 — "Avatar"
├── id: 42
├── title: "Avatar"
├── director: "James Cameron"
├── duration: 162
├── releaseDate: 2009-12-18   ← ngày khởi chiếu gốc thế giới
└── status: NOW_SHOWING        ← derived từ runs (vì run #102 đang chiếu)

   ↓ (1 movie ↔ N runs)

MovieRun #101                       MovieRun #102
├── movie_id: 42                    ├── movie_id: 42
├── startDate: 2009-12-18           ├── startDate: 2026-07-01
├── endDate:   2010-03-15           ├── endDate:   2026-08-15
├── runType: FIRST_RUN              ├── runType: REISSUE
├── status: ENDED                   ├── status: NOW_SHOWING
└── notes: null                     └── notes: "Bản 4K Remaster"
```

→ Chỉ **1 Movie #42** cho cả 2 đợt chiếu cách nhau 17 năm. Review/favorite/rating của user 2009 vẫn tích lũy đúng vào Movie #42, hiển thị xuyên suốt cả khi chiếu lại 2026.

### 4.10 So sánh trước/sau

| Aspect | Pattern cũ (1 Movie = 1 lifecycle) | Pattern mới (Movie + MovieRun) |
|---|---|---|
| Avatar 2009 + 4K 2026 | 2 Movie entity riêng → review/favorite tách biệt | 1 Movie + 2 MovieRun → review/favorite gộp đúng |
| Tạo phim mới chiếu | 1 INSERT Movie | 1 INSERT Movie + 1 INSERT MovieRun (auto khi admin set lịch chiếu) |
| Status admin override | Sửa `Movie.status` trực tiếp | Sửa `MovieRun.status` của đúng run → recompute Movie.status |
| Số bảng | `movies` (gộp metadata + lifecycle) | `movies` (metadata) + `movie_runs` (lifecycle) — chuẩn 3NF |
| Showtime conflict 2 đợt chiếu khác nhau | Không hỗ trợ | Validate startTime in `[run.startDate, run.endDate]` của run cụ thể |
| Mở rộng festival, sneak preview | Không có chỗ chứa | Tạo run thêm với runType = FESTIVAL/SPECIAL |

### 4.11 Validate Showtime trong `[run.startDate, run.endDate]`

`ShowtimeService.createShowtime / updateShowtime` gọi helper mới:

```java
private void validateShowtimeWithinMovieRun(MovieRun run, LocalDateTime startTime) {
    LocalDate showtimeDate = startTime.toLocalDate();
    if (showtimeDate.isBefore(run.getStartDate())) {
        throw new BusinessException(ErrorCode.INVALID_REQUEST,
            String.format("Suất chiếu phải nằm trong đợt chiếu [%s — %s]",
                run.getStartDate(), run.getEndDate()));
    }
    if (showtimeDate.isAfter(run.getEndDate())) {
        throw new BusinessException(ErrorCode.INVALID_REQUEST,
            String.format("Suất chiếu phải nằm trong đợt chiếu [%s — %s]",
                run.getStartDate(), run.getEndDate()));
    }
}
```

Thay thế hàm cũ `validateShowtimeWithinMovieLifecycle` (dùng `movie.releaseDate / endDate`). Pattern này chính xác hơn vì 1 phim có thể có nhiều đợt chiếu, validate phải gắn đúng đợt.

### 4.12 Auto-pick MovieRun — Strategy UX

Khi admin tạo showtime, nếu không truyền `movieRunId`, service tự pick:

```java
// ShowtimeService.resolveMovieRun
// Strategy: NOW_SHOWING ưu tiên > nearest SCHEDULED
```

- Phim có **1 run NOW_SHOWING** → pick run đó (admin tạo showtime "đặt vào lịch chiếu hiện tại")
- Phim có **2+ run NOW_SHOWING** (hiếm — nhiều đợt chồng) → pick run có `startDate` gần nhất
- Phim chỉ có run SCHEDULED → pick run sắp tới
- Không có run nào active → **throw lỗi**: "Phim X chưa có đợt chiếu nào. Vui lòng tạo đợt chiếu trước."

Admin nâng cao có thể **explicit** truyền `movieRunId` để override (vd muốn tạo showtime cho run festival cụ thể).

Xem pattern Auto-pick vs Explicit ở `docs/backend/16-architectural-patterns.md` mục 8.

---

### 3.5b Vòng đời Movie cũ — Showtime validate (chỉ tham khảo lịch sử)

> **Bị thay thế** bởi `validateShowtimeWithinMovieRun` ở Section 4.11. Code cũ:

```java
// PATTERN CŨ — KHÔNG dùng nữa
private void validateShowtimeWithinMovieLifecycle(Movie movie, LocalDateTime startTime) {
    LocalDate showtimeDate = startTime.toLocalDate();
    if (movie.getReleaseDate() != null && showtimeDate.isBefore(movie.getReleaseDate())) {
        throw new BusinessException(...);
    }
    if (movie.getEndDate() != null && showtimeDate.isAfter(movie.getEndDate())) {
        throw new BusinessException(...);
    }
}
```

Hạn chế: validate dùng `movie.releaseDate / endDate` — không phân biệt được phim có nhiều đợt chiếu khác nhau. Đã thay bằng validate theo run cụ thể.

---

### 3.6 Cascade soft-delete (Phase 4 — Movie → Reviews, Favorites)

**Bài toán:** Admin archive Movie. User vào trang phim → thấy review cũ, thấy phim trong "Yêu thích" → bấm vào phim đã ARCHIVED → 404 → UX tệ.

**Giải pháp CineX:** archive Movie → cascade xử lý dependencies — **asymmetric** (mỗi loại 1 chiến lược):
- **Reviews**: soft delete (ARCHIVED) → khi restore Movie thì unarchive lại
- **Favorites**: hard delete → không restore khi Movie restore
- **Notifications**: KHÔNG cascade (FK không trực tiếp đến Movie)

**Code:**
```java
// MovieService.deleteMovie + bulkDelete cùng gọi helper này
private void cascadeArchiveDependencies(Long movieId) {
    int reviewsArchived  = reviewRepository.archiveByMovieId(movieId);
    int favoritesDeleted = userFavoriteRepository.deleteByMovieId(movieId);
    if (reviewsArchived > 0 || favoritesDeleted > 0) {
        log.info("Cascade archive for movie {}: {} reviews archived, {} favorites deleted",
                 movieId, reviewsArchived, favoritesDeleted);
    }
}

// ReviewRepository — bulk soft delete
@Modifying
@Query("UPDATE Review r SET r.storageState = com.cinex.common.entity.StorageState.ARCHIVED " +
       "WHERE r.movie.id = :movieId AND r.storageState <> com.cinex.common.entity.StorageState.ARCHIVED")
int archiveByMovieId(@Param("movieId") Long movieId);

// Reverse — khi restore Movie
@Modifying
@Query("UPDATE Review r SET r.storageState = com.cinex.common.entity.StorageState.ACTIVE " +
       "WHERE r.movie.id = :movieId AND r.storageState = com.cinex.common.entity.StorageState.ARCHIVED")
int unarchiveByMovieId(@Param("movieId") Long movieId);

// UserFavoriteRepository — bulk HARD delete
@Modifying
@Query("DELETE FROM UserFavorite uf WHERE uf.movie.id = :movieId")
int deleteByMovieId(@Param("movieId") Long movieId);
```

**Luồng restore Movie:**
```java
@Transactional
@Auditable(action = "RESTORE_MOVIE", entityType = "Movie")
public MovieResponse restoreMovie(Long id) {
    movie.setStorageState(StorageState.ACTIVE);
    movieRepository.save(movie);

    // Reverse cascade: unarchive review. Favorite không restore (đã hard delete).
    int restored = reviewRepository.unarchiveByMovieId(id);
    if (restored > 0) {
        log.info("Restored {} reviews for movie {}", restored, movie.getTitle());
    }
}
```

**Sơ đồ asymmetric cascade:**

```
                    ┌──────────────────┐
                    │  deleteMovie(id) │
                    └────────┬─────────┘
                             │
            ┌────────────────┼────────────────┐
            v                v                v
   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
   │ Movie        │  │ Reviews      │  │ Favorites    │
   │ storageState │  │ storageState │  │ DELETE row   │
   │ = ARCHIVED   │  │ = ARCHIVED   │  │ (hard)       │
   └──────┬───────┘  └──────┬───────┘  └──────────────┘
          │                 │                  │
   restoreMovie     unarchiveByMovieId   (KHÔNG khôi phục
   reverse:         restore lại               được)
   ACTIVE           ACTIVE
```

**Tại sao @Modifying @Query thay vì load → save?**
- Load: 50 reviews → 50 UPDATE = 51 query
- @Modifying @Query: 1 UPDATE = 1 query
- Nhanh hơn 50x, tránh full memory load

---

### 3.7 N+1 Fix với @EntityGraph (Phase 3)

**Bài toán cũ:**
```java
// MovieRepository không có @EntityGraph
Page<Movie> findAll(Specification<Movie> spec, Pageable pageable);
```
List 20 phim → mỗi phim gọi `getGenres()` → bắn 1 query. Tổng: **1 + 20 = 21 query** (N+1).

**Giải pháp:**
```java
@Override
@EntityGraph(attributePaths = {"genres"})
Page<Movie> findAll(Specification<Movie> spec, Pageable pageable);
```

Hibernate sinh LEFT JOIN `movies + movie_genres + genres` trong **1 query**. Pageable vẫn hoạt động — Hibernate dùng subquery để paginate trước khi join.

**Lưu ý:** Tránh @EntityGraph cho many-to-many khi list LỚN (cartesian product). Với page size 10-50, JOIN FETCH vẫn nhanh hơn N+1. Nếu page size > 100 hoặc nhiều quan hệ many-to-many → cân nhắc `@BatchSize`.

---

### 3.8 Rating display 0 thay null (Mapper layer)

**Bài toán:** Phim chưa có review thì `rating = NULL` trong DB. FE hiển thị "—" hoặc "null sao" → UX tệ. Nhưng nếu set default `0` trong entity thì mất phân biệt "chưa ai đánh giá" vs "0 sao thật sự".

**Giải pháp:** Giữ NULL ở DB, convert 0 ở **Mapper layer** (DTO):
```java
// MovieMapper
@Mapping(target = "rating", source = "rating", qualifiedByName = "ratingOrZero")
MovieResponse toResponse(Movie movie);

@Named("ratingOrZero")
default BigDecimal ratingOrZero(BigDecimal rating) {
    return rating != null ? rating : BigDecimal.ZERO;
}
```

→ DB vẫn NULL (analytics phân biệt được "0 phim đánh giá"), FE thấy `0` (UX nhất quán). Kết hợp với COALESCE trong `hasRatingBetween` — filter "rating >= 7" vẫn loại phim NULL như mong đợi.

---

## 5. Sơ đồ luồng xử lý

### Tìm kiếm phim (Filter DTO + Specification)
```
GET /api/movies?keyword=Avengers&status=NOW_SHOWING&genreId=1&page=0&size=10
│
▼
Spring tự bind query params vào MovieFilter DTO
│
▼
MovieController.listMovies(MovieFilter filter, Pageable pageable)
│
▼
MovieService.listMovies(filter, pageable)
│
▼
MovieSpecification.fromFilter(filter)
│
├── includeDeleted = null → spec.and(notDeleted())
│     → WHERE (storage_state IS NULL OR storage_state <> 'ARCHIVED')
│
├── keyword = "Avengers" → spec.and(hasTitle("Avengers"))
│     → AND LOWER(title) LIKE '%avengers%'
│
├── status = NOW_SHOWING → spec.and(hasStatus(NOW_SHOWING))
│     → AND status = 'NOW_SHOWING'
│
├── genreId = 1 → spec.and(hasGenre(1))
│     → AND mg.genre_id = 1 (JOIN movie_genres)
│
▼
movieRepository.findAll(spec, pageable)
│
│  SQL sinh ra:
│  SELECT m.* FROM movies m
│  LEFT JOIN movie_genres mg ON m.id = mg.movie_id
│  WHERE (m.storage_state IS NULL OR m.storage_state <> 'ARCHIVED')
│    AND LOWER(m.title) LIKE '%avengers%'
│    AND m.status = 'NOW_SHOWING'
│    AND mg.genre_id = 1
│  ORDER BY m.created_at DESC OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY
│
▼
.map(movieMapper::toListResponse)  → chuyển entity → DTO rút gọn
│
▼
PageResponse.from(page) → wrap phân trang
```

### Tạo phim với genres
```
POST /api/movies (ADMIN)
Body: { "title": "Avengers", "duration": 150, "status": "NOW_SHOWING", "genreIds": [1, 5, 7] }
│
▼
MovieController.createMovie(MovieRequest)
│
▼
MovieService.createMovie(request)
│
├── resolveGenres([1, 5, 7])
│     → SELECT * FROM genres WHERE id IN (1, 5, 7)
│     → 3 Genre entities ✅
│
├── Movie.builder()...genres(Set<Genre>).build()
│
├── movieRepository.save(movie)
│     → INSERT INTO movies (...) VALUES (...)
│     → INSERT INTO movie_genres (movie_id, genre_id) VALUES (1,1), (1,5), (1,7)
│
└── movieMapper.toResponse(movie) → MovieResponse + Set<GenreResponse>
```

---

## 6. Khái niệm mới cần biết

### JpaSpecificationExecutor
- Interface thêm method `findAll(Specification<T>, Pageable)` vào Repository
- Cho phép build query WHERE động bằng Criteria API
- Repository chỉ cần `extends JpaSpecificationExecutor<Movie>` — không cần viết thêm code

### Criteria API (root, query, cb)
- `Root<Movie>` = đại diện bảng movies — `root.get("title")` = cột title
- `CriteriaBuilder` = tạo biểu thức: `cb.like()`, `cb.equal()`, `cb.and()`, `cb.or()`
- `CriteriaQuery` = câu SELECT (thường không cần dùng trực tiếp)
- Spring Specification wrap Criteria API cho dễ dùng hơn

### @JoinTable
- Chỉ định bảng join cho @ManyToMany
- `joinColumns`: FK từ bảng chính (movie_id)
- `inverseJoinColumns`: FK từ bảng kia (genre_id)
- JPA tự INSERT/DELETE trong bảng join khi set/clear collection

### FetchType.LAZY vs EAGER
- **LAZY** (mặc định nên dùng): chỉ query khi gọi getter → tránh N+1
- **EAGER**: query ngay khi load entity → dễ gây N+1 khi list
- Quy tắc: **@ManyToOne/@ManyToMany luôn LAZY**, chỉ EAGER khi có lý do rõ ràng

### @Named + qualifiedByName (MapStruct)
- Khi MapStruct không tự biết cách map (VD: Genre → String)
- `@Named("xxx")`: đặt tên cho method custom
- `qualifiedByName = "xxx"`: bảo MapStruct dùng method đó khi map field cụ thể

---

## 7. Annotation mới sử dụng

| Annotation | Tác dụng | Ví dụ |
|---|---|---|
| `@ManyToMany` | Quan hệ nhiều-nhiều | Movie ↔ Genre |
| `@JoinTable` | Chỉ định bảng join | movie_genres |
| `@JoinColumn` | Chỉ định cột FK trong bảng join | movie_id, genre_id |
| `@Enumerated(EnumType.STRING)` | Lưu enum dạng text trong DB | MovieStatus |
| `@Named("xxx")` | Đặt tên method cho MapStruct | `mapGenreNames()` |
| `@Mapping(qualifiedByName)` | Chỉ MapStruct dùng method cụ thể | `toListResponse()` |
| `@MappingTarget` | MapStruct update entity có sẵn | `GenreMapper.updateEntity()` |
| `@DeleteMapping` | HTTP DELETE | Xóa mềm phim |

---

## 8. SQL được sinh ra

```sql
-- Danh sách phim (có filter — với @EntityGraph load luôn genres trong 1 query)
-- Controller default sort: createdAt DESC; FE override: ?sort=rating,desc
SELECT m.*, g.*
FROM movies m
LEFT JOIN movie_genres mg ON m.id = mg.movie_id
LEFT JOIN genres g ON mg.genre_id = g.id
WHERE (m.storage_state IS NULL OR m.storage_state <> 'ARCHIVED')
  AND LOWER(m.title) LIKE '%avengers%'
  AND m.status = 'NOW_SHOWING'
  AND COALESCE(m.rating, 0) >= 7.0                              -- hasRatingBetween (J1)
  AND m.release_date >= '2026-01-01'                            -- hasReleaseDateBetween
  AND LOWER(m.director) LIKE '%russo%'                          -- hasDirectorLike
ORDER BY m.created_at DESC OFFSET 0 ROWS FETCH NEXT 20 ROWS ONLY;

-- Cascade archive khi delete (Phase 4)
UPDATE reviews SET storage_state = 'ARCHIVED'
  WHERE movie_id = 1 AND storage_state <> 'ARCHIVED';
DELETE FROM user_favorites WHERE movie_id = 1;

-- Đếm tổng (phân trang)
SELECT COUNT(*) FROM movies m
LEFT JOIN movie_genres mg ON m.id = mg.movie_id
WHERE ...;

-- Chi tiết phim
SELECT * FROM movies WHERE id = 1;
-- Lazy load genres khi gọi movie.getGenres():
SELECT g.* FROM genres g
JOIN movie_genres mg ON g.id = mg.genre_id
WHERE mg.movie_id = 1;

-- Tạo phim + genres
INSERT INTO movies (title, duration, status, ...) VALUES ('Avengers', 150, 'NOW_SHOWING', ...);
INSERT INTO movie_genres (movie_id, genre_id) VALUES (1, 1), (1, 5), (1, 7);

-- Sửa phim (cập nhật genres)
-- JPA xóa hết genre cũ → insert genre mới
DELETE FROM movie_genres WHERE movie_id = 1;
INSERT INTO movie_genres (movie_id, genre_id) VALUES (1, 1), (1, 3);
UPDATE movies SET title = '...', status = '...', version = version + 1 WHERE id = 1;

-- Xóa mềm (StorageState enum chỉ có ACTIVE/ARCHIVED — không có DELETED)
UPDATE movies SET storage_state = 'ARCHIVED', version = version + 1 WHERE id = 1;

-- Danh sách thể loại
SELECT * FROM genres WHERE (storage_state IS NULL OR storage_state <> 'ARCHIVED');

-- Tạo thể loại
INSERT INTO genres (name, description, version, ...) VALUES ('Thriller', 'Phim giật gân', 0, ...);
```

---

## 9. Request/Response mẫu

### GET /api/movies — Danh sách phim (có search + filter)
```bash
curl "http://localhost:8088/api/movies?keyword=Avengers&status=NOW_SHOWING&genreId=1&page=0&size=10"
```

**Response (200):**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "content": [
      {
        "id": 1,
        "title": "Avengers: Endgame",
        "posterUrl": "https://res.cloudinary.com/.../poster.jpg",
        "duration": 181,
        "rating": 8.4,
        "status": "NOW_SHOWING",
        "genres": ["Action", "Sci-Fi", "Adventure"]
      }
    ],
    "page": 0, "size": 10, "totalElements": 1, "totalPages": 1, "last": true
  }
}
```

### POST /api/movies — (Admin) Tạo phim
```bash
curl -X POST http://localhost:8088/api/movies \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Avengers: Endgame",
    "description": "The epic conclusion...",
    "duration": 181,
    "releaseDate": "2026-06-01",
    "director": "Russo Brothers",
    "cast": "Robert Downey Jr., Chris Evans",
    "language": "English",
    "status": "COMING_SOON",
    "genreIds": [1, 5, 7]
  }'
```

### POST /api/movies/{id}/poster — (Admin) Upload poster
```bash
curl -X POST http://localhost:8088/api/movies/1/poster \
  -H "Authorization: Bearer <admin_token>" \
  -F "file=@poster.jpg"
```

### DELETE /api/movies/{id} — (Admin) Xóa mềm
```bash
curl -X DELETE http://localhost:8088/api/movies/1 \
  -H "Authorization: Bearer <admin_token>"
```

### GET /api/genres — Danh sách thể loại
```bash
curl http://localhost:8088/api/genres
```

### POST /api/genres — (Admin) Thêm thể loại
```bash
curl -X POST http://localhost:8088/api/genres \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Thriller", "description": "Phim giật gân"}'
```

---

## 10. Câu hỏi tự kiểm tra

1. **Specification Pattern giải quyết vấn đề gì? Nếu không dùng thì phải viết bao nhiêu method cho 4 filter?**
   → Giải quyết vấn đề tổ hợp filter tăng theo cấp số nhân. 4 filter = 2^4 = 16 tổ hợp = 16 method. Specification: chỉ cần 4 method nhỏ + ghép `.and()`.

2. **Tại sao Movie.genres dùng Set mà không phải List?**
   → Set đảm bảo không trùng genre. Hibernate + @ManyToMany + List có bug xóa/insert lại toàn bộ bảng join khi thay đổi collection.

3. **FetchType.LAZY nghĩa là gì? Nếu dùng EAGER khi list 20 phim thì sao?**
   → LAZY: chỉ query genres khi gọi getGenres(). EAGER: tự động query genres cho MỖI phim → list 20 phim = 1 query phim + 20 query genres = 21 query (N+1 problem).

4. **Tại sao lưu MovieStatus bằng STRING chứ không phải ORDINAL?**
   → ORDINAL lưu số (0,1,2). Thêm enum ở giữa → số bị lệch → data cũ sai. STRING lưu text "NOW_SHOWING" → không bao giờ lệch.

5. **MapStruct gặp Set\<Genre\> → Set\<String\>, nó có tự map được không?**
   → KHÔNG. Phải viết custom `default` method + đánh dấu `@Named` + chỉ định `qualifiedByName` trong `@Mapping`.

6. **Khi archive Movie, tại sao Reviews soft-delete còn Favorites hard-delete?**
   → Review là **nội dung user tạo** (text + rating) — có giá trị, mất tiếc; khi restore Movie thì unarchive lại để FE hiển thị review cũ. Favorite chỉ là **cờ "đã thích"** — user có thể bấm tim lại trong 1 click, không cần lưu lịch sử. → Cascade asymmetric: phù hợp với bản chất từng loại data.

7. **Tại sao `hasRatingBetween` dùng `COALESCE(rating, 0)` thay vì so sánh trực tiếp?**
   → Phim chưa có review thì rating = NULL trong DB. SQL `NULL >= 7` = NULL (không phải FALSE), row bị loại khỏi WHERE. User filter "rating >= 0" mong đợi lấy hết phim — nhưng nếu không COALESCE thì phim NULL bị loại. COALESCE(rating, 0) → phim NULL coi như 0 → filter "≥ 0" trả về hết, filter "≥ 7" vẫn loại phim NULL (như mong đợi).

8. **Nếu MovieRepository không có `@EntityGraph(attributePaths = "genres")`, list 20 phim sẽ chạy bao nhiêu query?**
   → 1 query lấy 20 phim + 20 query lazy-load `getGenres()` cho mỗi phim = **21 query** (N+1 problem). Sau khi có @EntityGraph → Hibernate JOIN FETCH → **1 query duy nhất**.

9. **Filter của Movie nay có 11 field. Khi nào dừng thêm filter?**
   → Quy tắc: FE thực sự cần lọc trên UI thì thêm. "Phòng hờ — biết đâu sau này FE cần" → KHÔNG thêm (Interface Segregation Principle). Filter join sâu 4+ bảng → cân nhắc index hoặc denormalize cột, đừng để query chậm chỉ vì 1 filter ít dùng.

10. **Sort trên list movie nên dùng custom field `sortBy` trong DTO hay Spring Pageable built-in?**
    → **Spring Pageable built-in** (`?sort=rating,desc&sort=createdAt,desc`). Lý do: (1) Spring auto-parse, không phải viết switch case, (2) FE tự do combine nhiều cột, (3) đồng nhất với mọi list API, (4) Controller chỉ cần `@PageableDefault(sort=..., direction=DESC)` cho mặc định.

11. **Vì sao CineX tách Movie thành Movie + MovieRun thay vì cứ 1 Movie / 1 lifecycle?**
    → Pattern phẳng giả định "1 phim chỉ chiếu 1 lần". Sai với thực tế: Avatar 2009 + 4K 2026 = cùng phim, 2 đợt chiếu. Nếu tạo 2 Movie thì review/favorite/rating tách rời, user search "Avatar" thấy 2 entry trùng tên. Tách MovieRun ra cho phép 1 Movie có N run — metadata tích lũy thống nhất.

12. **Movie.status sau refactor giờ là derived field — vì sao không drop hẳn?**
    → Backward compatibility: DTO `MovieResponse / MovieListResponse / FavoriteMovieResponse` đã expose `status`, FE dùng filter "Đang chiếu" + badge. Drop ngay → sửa nhiều DTO + FE + filter logic, diện ảnh hưởng rộng. Option B: giữ field, recompute từ runs sau mỗi sự kiện (eventual consistency). Khi nào cần drop hẳn — refactor riêng, không gộp vào commit này.

13. **Vì sao Showtime giờ link cả `movie_id` (denormalized) lẫn `movie_run_id`?**
    → Showtime giờ logic chính trỏ tới run. Nhưng nhiều query/report cũ join `showtimes → movies` trực tiếp (statistics, filter homepage, mapper). Drop `movie_id` ngay sẽ break diện rộng. Giữ làm denormalized backup với invariant `showtime.movie == showtime.movieRun.movie` — service đảm bảo. Có thể drop sau khi audit hết usage.

14. **Migration `movie_run_id` chia 2 changeset (NULLABLE → NOT NULL) thay vì 1 — vì sao?**
    → Phase 1 (NULLABLE + backfill) cho phép verify data đúng trước khi alter NOT NULL. Nếu bug trong logic backfill, rollback chỉ phase 1 (drop column) — không mất data. Phase 2 (NOT NULL) còn có `preConditions sqlCheck count=0 + onFail MARK_RAN`: nếu vẫn còn NULL hiếm hoi, không halt deploy mà ghi log + skip; admin fix tay rồi rerun. Production-safe.

15. **2 khoảng `[a, b]` và `[c, d]` overlap khi nào?**
    → Khi `a ≤ d AND c ≤ b`. Áp dụng: chống MovieRun trùng ngày (cùng 1 phim không có 2 đợt chiếu chồng lên nhau), chống Showtime trùng giờ trong cùng room.

16. **Tại sao `MovieRunStatusScheduler` dùng `@SchedulerLock` mà `MovieStatusScheduler` cũ không cần?**
    → Khi deploy production có nhiều instance backend (HA), `@Scheduled` chạy trên CẢ 2 node cùng lúc → 2 transaction cùng UPDATE 1 row → race condition. ShedLock đảm bảo chỉ 1 instance chạy job tại 1 thời điểm. `MovieStatusScheduler` cũ thực ra cũng cần — nhưng giai đoạn đó CineX chưa multi-instance nên bug tiềm ẩn. Bài học: luôn `@SchedulerLock` cho mọi `@Scheduled` đụng vào DB shared.
