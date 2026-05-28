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
| `module/movie/repository/MovieRepository.java` | JpaSpecificationExecutor | Repository + Specification |
| `module/movie/repository/GenreRepository.java` | CRUD thể loại | Repository |
| `module/movie/specification/MovieSpecification.java` | Build query WHERE động | Specification Pattern |
| `module/movie/mapper/MovieMapper.java` | Movie ↔ DTO (xử lý N:N) | Mapper (MapStruct) |
| `module/movie/mapper/GenreMapper.java` | Genre ↔ DTO | Mapper (MapStruct) |
| `module/movie/service/MovieService.java` | CRUD + search + upload poster | Service |
| `module/movie/service/GenreService.java` | List + create genre | Service |
| `module/movie/controller/MovieController.java` | 6 endpoints phim | Controller |
| `module/movie/controller/GenreController.java` | 2 endpoints thể loại | Controller |

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
- `MovieListResponse.genres = Set<String>` (chỉ tên)

#### Trường hợp 1: Set\<Genre\> → Set\<GenreResponse\>

```java
@Mapper(componentModel = "spring", uses = GenreMapper.class)
public interface MovieMapper {
    MovieResponse toResponse(Movie movie);
}
```

`uses = GenreMapper.class` → MapStruct biết: khi cần chuyển Genre → GenreResponse, gọi `GenreMapper.toResponse()`. Code sinh ra:

```java
// MovieMapperImpl.java (auto-generated)
@Autowired
private GenreMapper genreMapper;

protected Set<GenreResponse> genreSetToGenreResponseSet(Set<Genre> set) {
    Set<GenreResponse> result = new LinkedHashSet<>();
    for (Genre genre : set) {
        result.add(genreMapper.toResponse(genre));  // Gọi GenreMapper
    }
    return result;
}
```

#### Trường hợp 2: Set\<Genre\> → Set\<String\>

MapStruct KHÔNG tự biết cách chuyển Genre → String. Phải viết custom method:

```java
@Mapping(source = "genres", target = "genres", qualifiedByName = "genreNames")
MovieListResponse toListResponse(Movie movie);

@Named("genreNames")
default Set<String> mapGenreNames(Set<Genre> genres) {
    if (genres == null) return Set.of();
    return genres.stream()
        .map(Genre::getName)
        .collect(Collectors.toSet());
}
```

- `@Named("genreNames")` đánh dấu method này có tên "genreNames"
- `qualifiedByName = "genreNames"` → khi map field genres, gọi method có tên đó
- `default` method: Java cho phép viết method có body trong interface (từ Java 8)

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

## 4. Sơ đồ luồng xử lý

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
│     → WHERE (storage_state IS NULL OR storage_state <> 'DELETED')
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
│  WHERE (m.storage_state IS NULL OR m.storage_state <> 'DELETED')
│    AND LOWER(m.title) LIKE '%avengers%'
│    AND m.status = 'NOW_SHOWING'
│    AND mg.genre_id = 1
│  ORDER BY m.id OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY
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

## 5. Khái niệm mới cần biết

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

## 6. Annotation mới sử dụng

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

## 7. SQL được sinh ra

```sql
-- Danh sách phim (có filter)
SELECT m.* FROM movies m
LEFT JOIN movie_genres mg ON m.id = mg.movie_id
WHERE (m.storage_state IS NULL OR m.storage_state <> 'DELETED')
  AND LOWER(m.title) LIKE '%avengers%'
  AND m.status = 'NOW_SHOWING'
  AND mg.genre_id = 1
ORDER BY m.id OFFSET 0 ROWS FETCH NEXT 20 ROWS ONLY;

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

-- Xóa mềm
UPDATE movies SET storage_state = 'DELETED', version = version + 1 WHERE id = 1;

-- Danh sách thể loại
SELECT * FROM genres WHERE (storage_state IS NULL OR storage_state <> 'DELETED');

-- Tạo thể loại
INSERT INTO genres (name, description, version, ...) VALUES ('Thriller', 'Phim giật gân', 0, ...);
```

---

## 8. Request/Response mẫu

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

## 9. Câu hỏi tự kiểm tra

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
