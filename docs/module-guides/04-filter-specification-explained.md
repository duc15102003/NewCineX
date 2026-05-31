# Filter DTO + Specification Pattern -- Giai thich chi tiet cho nguoi moi

---

## 1. Tong quan: Bai toan tim kiem dong

### Van de thuc te

Hinh dung ban vao trang admin cua rap phim CineX. Ban can tim phim:
- Theo **tu khoa** ("Avengers")
- Theo **trang thai** (dang chieu / sap chieu)
- Theo **the loai** (hanh dong / tinh cam)
- Theo **dang co suat chieu** hay khong
- Hoac **ket hop** nhieu dieu kien cung luc

FE gui request kieu nay:

```
GET /api/movies?keyword=Avengers&status=NOW_SHOWING&genreId=1&page=0&size=20
```

Cau hoi: Backend viet code the nao de xu ly **tat ca to hop filter**?

### Cach SAI: Viet if-else hoac nhieu method trong Repository

```java
// SAI -- Moi to hop filter = 1 method rieng
Page<Movie> findByTitleContaining(String title, Pageable p);
Page<Movie> findByStatus(MovieStatus status, Pageable p);
Page<Movie> findByTitleContainingAndStatus(String title, MovieStatus status, Pageable p);
Page<Movie> findByTitleContainingAndStatusAndGenresId(String title, MovieStatus status, Long genreId, Pageable p);
// ... con nhieu nua!
```

Neu co **N** filter, so method can viet la **2^N** (moi filter co the co hoac khong). Voi 5 filter, ban can 2^5 = **32 method**! Them 1 filter moi = so method **nhan doi**.

### Cach DUNG: Specification Pattern

Specification Pattern cho phep ban **ghep cac dieu kien WHERE dong**, tuy vao filter nao co gia tri. Chi can **1 method duy nhat** `findAll(spec, pageable)`.

```
FE gui query params --> Spring bind vao Filter DTO --> Specification.fromFilter() --> findAll(spec, pageable)
```

---

## 2. Specification Pattern la gi?

### Vi du doi thuong: Loc san pham tren Shopee

Khi ban vao Shopee tim mua dien thoai:
1. Go "iPhone" vao o tim kiem --> **keyword**
2. Chon muc gia "5-10 trieu" --> **price range**
3. Chon thuong hieu "Apple" --> **brand**
4. Chon "4 sao tro len" --> **rating**
5. Tick "Mien phi van chuyen" --> **free shipping**

Shopee khong viet 32 ham khac nhau cho 5 bo loc nay. Ho **ghep tung dieu kien** lai voi nhau:

```
SELECT * FROM products
WHERE name LIKE '%iPhone%'           -- keyword (co)
  AND price BETWEEN 5000000 AND 10000000  -- price range (co)
  AND brand = 'Apple'                -- brand (co)
  AND rating >= 4                    -- rating (co)
  AND free_shipping = true           -- free shipping (co)
```

Neu ban bo tick "Mien phi van chuyen", dong cuoi bien mat. Neu ban khong chon thuong hieu, dong `brand = 'Apple'` bien mat. **Moi bo loc la 1 khoi doc lap, ghep vao hoac bo ra tuy y.**

Specification Pattern trong Spring lam chinh xac dieu nay: **moi bo loc la 1 method nho**, ghep lai bang `.and()`.

### Dinh nghia chinh thuc

> **Specification Pattern** (thuoc nhom Behavioral): Tach rieng tung dieu kien truy van thanh cac doi tuong (Specification) doc lap. Cac doi tuong nay co the **to hop** (AND, OR, NOT) de tao truy van phuc tap, ma **khong can sua code cu**.

Trong Spring Data JPA, interface `Specification<T>` co 1 method duy nhat:

```java
Predicate toPredicate(Root<T> root, CriteriaQuery<?> query, CriteriaBuilder cb);
```

Ba tham so nay la gi?
- **`root`**: Dai dien cho bang (entity) dang query. `root.get("title")` = cot `title` trong bang `movies`.
- **`query`**: Doi tuong CriteriaQuery, dung khi can subquery, distinct, group by.
- **`cb`** (CriteriaBuilder): Nha may tao dieu kien. `cb.equal()` = `=`, `cb.like()` = `LIKE`, `cb.or()` = `OR`, v.v.

---

## 3. So sanh TRUOC va SAU khi dung Specification

### TRUOC: 2^N method trong Repository (KHONG DUNG)

```java
// MovieRepository.java -- KHONG DUNG!
// Voi 5 filter (keyword, status, genreId, showing, includeDeleted) = 2^5 = 32 method!

// Chi keyword
Page<Movie> findByTitleContainingIgnoreCase(String keyword, Pageable p);

// Chi status
Page<Movie> findByStatus(MovieStatus status, Pageable p);

// keyword + status
Page<Movie> findByTitleContainingIgnoreCaseAndStatus(String keyword, MovieStatus status, Pageable p);

// keyword + genreId
Page<Movie> findByTitleContainingIgnoreCaseAndGenresId(String keyword, Long genreId, Pageable p);

// keyword + status + genreId
Page<Movie> findByTitleContainingIgnoreCaseAndStatusAndGenresId(
    String keyword, MovieStatus status, Long genreId, Pageable p);

// ... con 27 method nua!!!

// Service phai viet if-else de chon method nao:
public Page<Movie> list(String keyword, MovieStatus status, Long genreId, ...) {
    if (keyword != null && status != null && genreId != null) {
        return repo.findByTitleContainingIgnoreCaseAndStatusAndGenresId(keyword, status, genreId, p);
    } else if (keyword != null && status != null) {
        return repo.findByTitleContainingIgnoreCaseAndStatus(keyword, status, p);
    } else if (keyword != null) {
        return repo.findByTitleContainingIgnoreCase(keyword, p);
    }
    // ... 10+ nhanh if-else
}
```

**Van de:**
- Them 1 filter moi (VD: `language`) --> so method **nhan doi** (32 thanh 64)
- If-else trong Service phinh to khong kiem soat
- De copy-paste sai, kho maintain

### SAU: 1 method + Specification (DUNG)

```java
// MovieRepository.java -- Chi 1 dong!
public interface MovieRepository
    extends JpaRepository<Movie, Long>, JpaSpecificationExecutor<Movie> {
    // Khong can khai bao method nao! findAll(spec, pageable) co san.
}

// MovieService.java -- 3 dong!
public PageResponse<MovieListResponse> listMovies(MovieFilter filter, Pageable pageable) {
    var spec = MovieSpecification.fromFilter(filter);       // Build dieu kien tu filter
    Page<MovieListResponse> page = movieRepository.findAll(spec, pageable)  // Query
            .map(movieMapper::toListResponse);              // Chuyen sang DTO
    return PageResponse.from(page);
}
```

**Them 1 filter moi (`language`)**: chi them 1 field vao DTO + 1 method + 1 dong if. **Repository, Service, Controller khong sua gi.**

---

## 4. Cach viet Specification tung buoc

Lay `MovieSpecification` lam vi du. File: `backend/src/main/java/com/cinex/module/movie/specification/MovieSpecification.java`

### Buoc 1: Tao class utility voi constructor private

```java
public class MovieSpecification {

    private MovieSpecification() {}  // Khong cho tao instance (chi dung static method)
    // ...
}
```

**Tai sao constructor private?** Vi class nay chi chua cac method static (cong cu), khong can tao doi tuong. Giong nhu lop `Math` trong Java: ban goi `Math.abs()` chu khong bao gio `new Math()`.

### Buoc 2: Viet tung method filter nho

Moi method tra ve `Specification<Movie>` -- mot doi tuong bieu dien **1 dieu kien WHERE**.

#### hasTitle() -- Tim theo tu khoa

```java
public static Specification<Movie> hasTitle(String keyword) {
    return (root, query, cb) ->
            cb.like(cb.lower(root.get("title")), "%" + keyword.toLowerCase() + "%");
}
```

Giai thich:
- `root.get("title")` = cot `title` trong bang `movies`
- `cb.lower(...)` = ham `LOWER()` trong SQL, de tim khong phan biet hoa/thuong
- `cb.like(...)` = `LIKE` trong SQL
- `"%" + keyword + "%"` = tim chuoi chua keyword o bat ky vi tri nao

SQL sinh ra: `LOWER(m.title) LIKE '%avengers%'`

#### hasStatus() -- Loc theo trang thai

```java
public static Specification<Movie> hasStatus(MovieStatus status) {
    return (root, query, cb) ->
            cb.equal(root.get("status"), status);
}
```

SQL sinh ra: `m.status = 'NOW_SHOWING'`

#### hasGenre() -- Loc theo the loai (co JOIN)

```java
public static Specification<Movie> hasGenre(Long genreId) {
    return (root, query, cb) -> {
        var genreJoin = root.join("genres", JoinType.LEFT);
        return cb.equal(genreJoin.get("id"), genreId);
    };
}
```

Giai thich:
- `root.join("genres", JoinType.LEFT)` = `LEFT JOIN movie_genres mg ON m.id = mg.movie_id`
- `genreJoin.get("id")` = cot `id` cua bang `genres`
- Dung `LEFT JOIN` de phim khong co genre van tra ve (chi la khong match dieu kien)

SQL sinh ra: `LEFT JOIN movie_genres mg ON m.id = mg.movie_id ... AND mg.genre_id = 1`

#### notDeleted() -- Chi lay ban ghi chua xoa

```java
public static Specification<Movie> notDeleted() {
    return (root, query, cb) ->
            cb.or(
                    cb.isNull(root.get("storageState")),
                    cb.notEqual(root.get("storageState"), StorageState.ARCHIVED)
            );
}
```

**Day la phan QUAN TRONG nhat -- tai sao can `cb.or(isNull, notEqual)`?**

Xem phan 8 ben duoi de hieu chi tiet.

### Buoc 3: Viet fromFilter() -- ghep tat ca lai

```java
public static Specification<Movie> fromFilter(MovieFilter filter) {
    Specification<Movie> spec = Specification.where(null);  // Bat dau rong (WHERE TRUE)

    if (!Boolean.TRUE.equals(filter.getIncludeDeleted())) {
        spec = spec.and(notDeleted());
    }
    if (StringUtils.hasText(filter.getKeyword())) {
        spec = spec.and(hasTitle(filter.getKeyword()));
    }
    if (filter.getStatus() != null) {
        spec = spec.and(hasStatus(filter.getStatus()));
    }
    if (filter.getGenreId() != null) {
        spec = spec.and(hasGenre(filter.getGenreId()));
    }
    if (Boolean.TRUE.equals(filter.getShowing())) {
        spec = spec.and(hasActiveShowtimes());
    }
    return spec;
}
```

Giai thich tung dong:

1. `Specification.where(null)` -- Tao spec rong, tuong duong `WHERE TRUE`. Moi dieu kien se AND them vao.

2. Moi `if` kiem tra: **neu filter co gia tri thi ghep them dieu kien**. Neu FE khong gui `status` --> `filter.getStatus()` = null --> bo qua, khong them vao WHERE.

3. `spec.and(...)` -- Noi dieu kien moi vao cuoi. Giong nhu xep gach LEGO: moi vien gach la 1 dieu kien, xep bao nhieu tuy y.

**Vi du cu the:**

FE gui: `?keyword=Avengers&status=NOW_SHOWING` (khong gui genreId, khong gui showing)

```
Specification.where(null)                    --> WHERE TRUE
  .and(notDeleted())                         --> AND (storage_state IS NULL OR storage_state <> 'ARCHIVED')
  .and(hasTitle("Avengers"))                 --> AND LOWER(title) LIKE '%avengers%'
  .and(hasStatus(NOW_SHOWING))               --> AND status = 'NOW_SHOWING'
  // genreId = null --> BO QUA
  // showing = null --> BO QUA
```

FE gui: `?genreId=1` (chi loc the loai, khong co keyword hay status)

```
Specification.where(null)                    --> WHERE TRUE
  .and(notDeleted())                         --> AND (storage_state IS NULL OR storage_state <> 'ARCHIVED')
  // keyword = null --> BO QUA
  // status = null --> BO QUA
  .and(hasGenre(1L))                         --> AND genre_id = 1
  // showing = null --> BO QUA
```

---

## 5. Filter DTO: Nhan params tu FE, type-safe

### Filter DTO la gi?

**DTO** (Data Transfer Object) la class chi chua **data**, khong chua logic. **Filter DTO** la DTO chuyen dung de chua cac tham so loc/tim kiem.

File: `backend/src/main/java/com/cinex/module/movie/dto/MovieFilter.java`

```java
@Getter
@Setter
public class MovieFilter {

    private String keyword;        // Tim theo ten phim
    private MovieStatus status;    // Loc theo trang thai (NOW_SHOWING, COMING_SOON, ...)
    private Long genreId;          // Loc theo the loai
    private Boolean includeDeleted;  // Hien ca phim da xoa?

    // true = phim co it nhat 1 suat chieu tu bay gio tro di (tab "Dang chieu")
    private Boolean showing;
}
```

### Tai sao dung Filter DTO ma khong dung @RequestParam?

So sanh 3 cach:

```java
// CACH 1: Nhieu @RequestParam -- them filter = sua SIGNATURE cua Controller + Service
@GetMapping
public ApiResponse list(
    @RequestParam(required = false) String keyword,
    @RequestParam(required = false) MovieStatus status,
    @RequestParam(required = false) Long genreId,
    @RequestParam(required = false) Boolean includeDeleted,
    @RequestParam(required = false) Boolean showing,
    Pageable pageable) { ... }
// Them "language" --> phai sua ca Controller + Service: them 1 param vao SIGNATURE

// CACH 2: Map<String, Object> -- khong type-safe
@GetMapping
public ApiResponse list(@RequestParam Map<String, Object> params, Pageable pageable) { ... }
// params.get("status") tra Object --> phai ep kieu --> de loi runtime
// Swagger khong biet Map chua key gi --> API docs trong

// CACH 3: Filter DTO -- TYPE-SAFE + LINH HOAT (du an dung cach nay)
@GetMapping
public ApiResponse list(MovieFilter filter, Pageable pageable) { ... }
// Them "language" --> chi them field vao DTO, Controller + Service KHONG DOI
// Swagger tu document tat ca fields
// IDE autocomplete: filter.getKeyword(), filter.getStatus(), ...
```

### Spring tu dong bind query params vao DTO nhu the nao?

Khi FE gui:
```
GET /api/movies?keyword=Avengers&status=NOW_SHOWING&genreId=1
```

Spring tu dong:
1. Tao doi tuong `new MovieFilter()`
2. Goi `filter.setKeyword("Avengers")`
3. Goi `filter.setStatus(MovieStatus.NOW_SHOWING)` (tu chuyen String thanh Enum!)
4. Goi `filter.setGenreId(1L)` (tu chuyen String "1" thanh Long)
5. `filter.getIncludeDeleted()` = `null` (vi FE khong gui param nay)
6. `filter.getShowing()` = `null`

**Khong can `@RequestParam`!** Spring Boot tu bind query params vao DTO object khi ten field KHOP voi ten param.

### Bang tong hop Filter DTO trong du an

| Module | Filter DTO | Fields | File |
|---|---|---|---|
| Movie | `MovieFilter` | keyword, status, genreId, includeDeleted, showing | `module/movie/dto/MovieFilter.java` |
| Genre | `GenreFilter` | keyword, includeDeleted | `module/movie/dto/GenreFilter.java` |
| Room | `RoomFilter` | keyword, type, status, includeDeleted | `module/room/dto/RoomFilter.java` |
| User | `UserFilter` | keyword, role, enabled, includeDeleted | `module/user/dto/UserFilter.java` |
| Booking | `BookingFilter` | keyword, status, includeDeleted | `module/booking/dto/BookingFilter.java` |
| Showtime | `ShowtimeFilter` | movieId, roomId, date, status, includeDeleted | `module/showtime/dto/ShowtimeFilter.java` |
| Snack | `SnackFilter` | keyword, includeDeleted | `module/snack/dto/SnackFilter.java` |
| Voucher | `VoucherFilter` | keyword, active, expired, includeDeleted | `module/voucher/dto/VoucherFilter.java` |
| Review | `ReviewFilter` | movieId, minRating, includeDeleted | `module/review/dto/ReviewFilter.java` |

---

## 6. Ghep Specification: spec.and() -- Chain Pattern

### Cach ghep hoat dong

`spec.and(dieuKienMoi)` tra ve **Specification moi** chua **ca dieu kien cu va dieu kien moi**. Day la **Immutable Chain** -- moi lan `.and()` tao doi tuong moi, khong sua doi tuong cu.

```
                                    Specification rong
                                          |
                         spec.and(notDeleted())
                                          |
              spec.and(hasTitle("Avengers"))
                                          |
    spec.and(hasStatus(NOW_SHOWING))
                                          |
                              Specification cuoi cung
                              (gom 3 dieu kien AND)
```

Khi `findAll(spec, pageable)` duoc goi, Spring/Hibernate duyet qua chuoi nay va sinh ra SQL:

```sql
WHERE (storage_state IS NULL OR storage_state <> 'ARCHIVED')
  AND LOWER(title) LIKE '%avengers%'
  AND status = 'NOW_SHOWING'
```

### Co the dung .or() khong?

Co! Ngoai `.and()`, Spring Specification con ho tro:
- `.or(spec2)` -- ghep bang OR
- `Specification.not(spec)` -- dao nguoc dieu kien

Vi du trong `UserSpecification.hasKeyword()`:

```java
public static Specification<User> hasKeyword(String keyword) {
    return (root, query, cb) -> {
        String pattern = "%" + keyword.toLowerCase() + "%";
        return cb.or(                         // OR giua 3 dieu kien
                cb.like(cb.lower(root.get("username")), pattern),
                cb.like(cb.lower(root.get("email")), pattern),
                cb.like(cb.lower(root.get("fullName")), pattern)
        );
    };
}
```

SQL sinh ra: `(LOWER(username) LIKE '%vanan%' OR LOWER(email) LIKE '%vanan%' OR LOWER(full_name) LIKE '%vanan%')`

User go "vanan" --> tim trong **ca 3 field** cung luc.

---

## 7. JpaSpecificationExecutor: findAll(spec, pageable)

### Repository chi can them 1 dong

```java
public interface MovieRepository
    extends JpaRepository<Movie, Long>,           // CRUD co ban: save, findById, delete, ...
            JpaSpecificationExecutor<Movie> {      // <-- THEM DONG NAY
    // Khong can khai bao method nao!
}
```

**`JpaSpecificationExecutor<T>`** la interface cua Spring Data JPA, cung cap san cac method:

| Method | Tac dung | Tuong duong SQL |
|---|---|---|
| `findAll(Specification)` | Tim tat ca thoa dieu kien | `SELECT * FROM movies WHERE ...` |
| `findAll(Specification, Pageable)` | Tim + phan trang + sap xep | `... ORDER BY ... OFFSET ... FETCH ...` |
| `findAll(Specification, Sort)` | Tim + sap xep (khong phan trang) | `... ORDER BY ...` |
| `findOne(Specification)` | Tim 1 ban ghi | `... FETCH FIRST 1 ROW ONLY` |
| `count(Specification)` | Dem so luong | `SELECT COUNT(*) FROM movies WHERE ...` |
| `exists(Specification)` | Co ton tai khong | `SELECT CASE WHEN COUNT > 0 ...` |

**Ban KHONG can viet bat ky method nao trong Repository.** Chi can `extends JpaSpecificationExecutor<Movie>` la co tat ca.

### Luong du lieu toan bo

```
Controller                     Service                         Repository              Database
    |                             |                                |                      |
    | MovieFilter filter          |                                |                      |
    | Pageable pageable           |                                |                      |
    |-----> listMovies(filter, pageable)                           |                      |
    |                             |                                |                      |
    |                   MovieSpecification.fromFilter(filter)       |                      |
    |                   = spec (Specification<Movie>)              |                      |
    |                             |                                |                      |
    |                             |---> findAll(spec, pageable) ---|                      |
    |                             |                                |--- SQL query ------->|
    |                             |                                |<-- Result set -------|
    |                             |<-- Page<Movie> ----------------|                      |
    |                             |                                |                      |
    |                   page.map(movieMapper::toListResponse)      |                      |
    |                   = Page<MovieListResponse>                  |                      |
    |                             |                                |                      |
    |<--- PageResponse.from(page) |                                |                      |
```

---

## 8. Xu ly NULL storageState: cb.or(isNull, notEqual) -- Tai sao can?

Day la phan **nhieu nguoi bi nham nhat**.

### Van de

Trong `BaseEntity`, field `storageState` co gia tri mac dinh:

```java
private StorageState storageState = StorageState.ACTIVE;
```

Nhung trong database, co truong hop `storage_state` la **NULL** (VD: data cu truoc khi them field nay, hoac insert truc tiep vao DB).

### Neu chi dung `cb.notEqual()` thi sao?

```java
// SAI!
public static Specification<Movie> notDeleted() {
    return (root, query, cb) ->
            cb.notEqual(root.get("storageState"), StorageState.ARCHIVED);
}
```

SQL sinh ra: `WHERE storage_state <> 'ARCHIVED'`

**Van de**: Trong SQL, `NULL <> 'ARCHIVED'` = **NULL** (khong phai TRUE!). Do la SQL three-valued logic:
- `NULL = 'ARCHIVED'` --> `NULL` (khong phai FALSE)
- `NULL <> 'ARCHIVED'` --> `NULL` (khong phai TRUE)
- `NULL` trong WHERE clause --> row **bi loai** (chi giu row co gia tri TRUE)

Ket qua: **Ban ghi co `storage_state = NULL` bi loai ra**, mac du no KHONG bi xoa!

### Cach dung: cb.or(isNull, notEqual)

```java
// DUNG!
public static Specification<Movie> notDeleted() {
    return (root, query, cb) ->
            cb.or(
                    cb.isNull(root.get("storageState")),                    // NULL --> giu lai
                    cb.notEqual(root.get("storageState"), StorageState.ARCHIVED)  // Khong phai ARCHIVED --> giu lai
            );
}
```

SQL sinh ra: `WHERE (storage_state IS NULL OR storage_state <> 'ARCHIVED')`

Bang truth table:

| storage_state | `IS NULL` | `<> 'ARCHIVED'` | `IS NULL OR <> 'ARCHIVED'` | Ket qua |
|---|---|---|---|---|
| `NULL` | TRUE | NULL | **TRUE** | Giu lai |
| `'ACTIVE'` | FALSE | TRUE | **TRUE** | Giu lai |
| `'ARCHIVED'` | FALSE | FALSE | **FALSE** | Loai bo |

**Tat ca 9 Specification trong du an deu dung pattern nay** cho method `notDeleted()`. Day la loi phong thu -- dam bao khong bao gio mat du lieu vi NULL.

---

## 9. EXISTS subquery cho phim "dang chieu" (hasActiveShowtimes)

### Bai toan

Tab "Dang chieu" tren trang chu can hien phim co **it nhat 1 suat chieu chua ket thuc**. Khong phai tat ca phim co status `NOW_SHOWING` deu dang chieu -- co the suat cuoi cung da ket thuc roi nhung admin chua doi status.

Cach chinh xac nhat: **Kiem tra bang `showtimes` xem co suat nao co `endTime >= now` khong.**

### Code

```java
/**
 * Phim "dang chieu" = EXISTS suat chieu chua ket thuc (endTime >= now).
 *
 * Tai sao dung endTime thay vi startTime?
 * - startTime >= now: suat dang chieu do (startTime < now < endTime) bi loai
 * - endTime >= now: suat dang chieu do VAN TINH --> phim khong bien mat giua chung
 *
 * VD: Suat 10:00-11:30, bay gio 11:00
 * - startTime >= now --> FALSE (10:00 < 11:00) --> phim bien mat khi dang chieu!
 * - endTime >= now   --> TRUE (11:30 >= 11:00)  --> phim van hien cho den 11:30
 */
public static Specification<Movie> hasActiveShowtimes() {
    return (root, query, cb) -> {
        // Buoc 1: Tao subquery -- "co ton tai suat chieu nao...?"
        Subquery<Long> sub = query.subquery(Long.class);
        Root<Showtime> showtime = sub.from(Showtime.class);
        sub.select(cb.literal(1L));     // SELECT 1 (chi can biet co hay khong)

        // Buoc 2: Dieu kien cua subquery
        sub.where(
                // Suat chieu thuoc ve phim nay
                cb.equal(showtime.get("movie"), root),
                // Suat chieu chua ket thuc
                cb.greaterThanOrEqualTo(showtime.get("endTime"), LocalDateTime.now()),
                // Suat chieu chua bi xoa
                cb.or(
                        cb.isNull(showtime.get("storageState")),
                        cb.notEqual(showtime.get("storageState"), StorageState.ARCHIVED)
                )
        );

        // Buoc 3: EXISTS -- co it nhat 1 suat thoa man la TRUE
        return cb.exists(sub);
    };
}
```

### SQL sinh ra

```sql
SELECT m.* FROM movies m
WHERE ...                                    -- cac dieu kien khac (notDeleted, keyword, ...)
  AND EXISTS (
      SELECT 1 FROM showtimes s
      WHERE s.movie_id = m.id                -- suat chieu thuoc phim nay
        AND s.end_time >= '2026-05-31 14:30' -- chua ket thuc
        AND (s.storage_state IS NULL OR s.storage_state <> 'ARCHIVED')  -- chua xoa
  )
```

### Tai sao dung EXISTS thay vi JOIN?

```sql
-- JOIN: Co the tra ve TRUNG LAP (1 phim co 5 suat --> tra 5 dong)
SELECT m.* FROM movies m
JOIN showtimes s ON s.movie_id = m.id
WHERE s.end_time >= NOW()
-- --> Phim "Avengers" co 5 suat chua ket thuc --> tra ve 5 dong trung!

-- EXISTS: Chi tra ve 1 lan (co hay khong? TRUE/FALSE)
SELECT m.* FROM movies m
WHERE EXISTS (SELECT 1 FROM showtimes s WHERE s.movie_id = m.id AND s.end_time >= NOW())
-- --> Phim "Avengers" chi tra ve 1 dong, du co 100 suat chieu
```

`EXISTS` cung **nhanh hon JOIN** trong truong hop nay vi database chi can tim **1 ban ghi thoa man** la dung ngay, khong can duyet het.

---

## 10. Code mau day du tu du an

### 10.1 MovieSpecification -- Day du nhat (co JOIN, subquery)

File: `backend/src/main/java/com/cinex/module/movie/specification/MovieSpecification.java`

```java
public class MovieSpecification {
    private MovieSpecification() {}

    public static Specification<Movie> fromFilter(MovieFilter filter) {
        Specification<Movie> spec = Specification.where(null);

        if (!Boolean.TRUE.equals(filter.getIncludeDeleted())) {
            spec = spec.and(notDeleted());
        }
        if (StringUtils.hasText(filter.getKeyword())) {
            spec = spec.and(hasTitle(filter.getKeyword()));
        }
        if (filter.getStatus() != null) {
            spec = spec.and(hasStatus(filter.getStatus()));
        }
        if (filter.getGenreId() != null) {
            spec = spec.and(hasGenre(filter.getGenreId()));
        }
        if (Boolean.TRUE.equals(filter.getShowing())) {
            spec = spec.and(hasActiveShowtimes());
        }
        return spec;
    }

    // LIKE: tim theo ten, khong phan biet hoa thuong
    public static Specification<Movie> hasTitle(String keyword) { ... }

    // EQUAL: so sanh enum
    public static Specification<Movie> hasStatus(MovieStatus status) { ... }

    // JOIN: join bang trung gian movie_genres
    public static Specification<Movie> hasGenre(Long genreId) { ... }

    // OR(IS NULL, NOT EQUAL): xu ly NULL + soft delete
    public static Specification<Movie> notDeleted() { ... }

    // EXISTS SUBQUERY: kiem tra ton tai suat chieu
    public static Specification<Movie> hasActiveShowtimes() { ... }
}
```

### 10.2 UserSpecification -- Tim keyword tren nhieu field

File: `backend/src/main/java/com/cinex/module/user/specification/UserSpecification.java`

```java
public class UserSpecification {
    private UserSpecification() {}

    public static Specification<User> fromFilter(UserFilter filter) {
        Specification<User> spec = Specification.where(null);

        if (!Boolean.TRUE.equals(filter.getIncludeDeleted())) {
            spec = spec.and(notDeleted());
        }
        if (StringUtils.hasText(filter.getKeyword())) {
            spec = spec.and(hasKeyword(filter.getKeyword()));
        }
        if (filter.getRole() != null) {
            spec = spec.and(hasRole(filter.getRole()));
        }
        if (filter.getEnabled() != null) {
            spec = spec.and(isEnabled(filter.getEnabled()));
        }
        return spec;
    }

    // OR tren nhieu field: tim "vanan" trong username, email, fullName cung luc
    public static Specification<User> hasKeyword(String keyword) {
        return (root, query, cb) -> {
            String pattern = "%" + keyword.toLowerCase() + "%";
            return cb.or(
                    cb.like(cb.lower(root.get("username")), pattern),
                    cb.like(cb.lower(root.get("email")), pattern),
                    cb.like(cb.lower(root.get("fullName")), pattern)
            );
        };
    }

    // EQUAL: so sanh enum Role
    public static Specification<User> hasRole(Role role) {
        return (root, query, cb) -> cb.equal(root.get("role"), role);
    }

    // EQUAL: so sanh boolean
    public static Specification<User> isEnabled(boolean enabled) {
        return (root, query, cb) -> cb.equal(root.get("enabled"), enabled);
    }
}
```

### 10.3 RoomSpecification -- Nhieu enum filter

File: `backend/src/main/java/com/cinex/module/room/specification/RoomSpecification.java`

```java
public class RoomSpecification {
    private RoomSpecification() {}

    public static Specification<Room> fromFilter(RoomFilter filter) {
        Specification<Room> spec = Specification.where(null);

        if (!Boolean.TRUE.equals(filter.getIncludeDeleted())) {
            spec = spec.and(notDeleted());
        }
        if (StringUtils.hasText(filter.getKeyword())) {
            spec = spec.and(hasName(filter.getKeyword()));
        }
        if (filter.getType() != null) {
            spec = spec.and(hasType(filter.getType()));         // Loc theo RoomType (IMAX, 3D, ...)
        }
        if (filter.getStatus() != null) {
            spec = spec.and(hasStatus(filter.getStatus()));     // Loc theo RoomStatus (ACTIVE, MAINTENANCE)
        }
        return spec;
    }
}
```

### 10.4 BookingSpecification -- 2 entry point (user vs admin)

File: `backend/src/main/java/com/cinex/module/booking/specification/BookingSpecification.java`

```java
public class BookingSpecification {
    private BookingSpecification() {}

    // User chi xem booking cua MINH --> bat buoc loc theo userId
    public static Specification<Booking> fromFilter(BookingFilter filter, Long userId) {
        Specification<Booking> spec = Specification.where(hasUser(userId));  // BAT BUOC co userId
        if (!Boolean.TRUE.equals(filter.getIncludeDeleted())) {
            spec = spec.and(notDeleted());
        }
        if (filter.getStatus() != null) {
            spec = spec.and(hasStatus(filter.getStatus()));
        }
        return spec;
    }

    // Admin xem TAT CA booking --> khong loc userId
    public static Specification<Booking> fromAdminFilter(BookingFilter filter) {
        Specification<Booking> spec = Specification.where(null);  // Khong co userId
        if (!Boolean.TRUE.equals(filter.getIncludeDeleted())) {
            spec = spec.and(notDeleted());
        }
        if (filter.getStatus() != null) {
            spec = spec.and(hasStatus(filter.getStatus()));
        }
        if (filter.getKeyword() != null && !filter.getKeyword().isBlank()) {
            spec = spec.and(hasKeyword(filter.getKeyword()));   // Admin tim theo bookingCode, username
        }
        return spec;
    }

    // Navigate quan he: booking --> user --> id
    public static Specification<Booking> hasUser(Long userId) {
        return (root, query, cb) -> cb.equal(root.get("user").get("id"), userId);
    }
}
```

**Diem hay:** Cung 1 Filter DTO nhung 2 entry point khac nhau cho 2 role. User luon bi gioi han boi `userId`, admin thi khong.

### 10.5 ShowtimeSpecification -- Loc theo ngay (date range)

File: `backend/src/main/java/com/cinex/module/showtime/specification/ShowtimeSpecification.java`

```java
// Loc suat chieu theo ngay: startTime trong khoang [00:00, 23:59:59] cua ngay do
public static Specification<Showtime> onDate(LocalDate date) {
    return (root, query, cb) -> {
        LocalDateTime dayStart = date.atStartOfDay();                // 2026-05-31 00:00:00
        LocalDateTime dayEnd = date.plusDays(1).atStartOfDay();      // 2026-06-01 00:00:00
        return cb.and(
                cb.greaterThanOrEqualTo(root.get("startTime"), dayStart),  // >= 00:00
                cb.lessThan(root.get("startTime"), dayEnd)                  // < ngay hom sau
        );
    };
}
```

SQL: `WHERE start_time >= '2026-05-31 00:00:00' AND start_time < '2026-06-01 00:00:00'`

**Tai sao `< dayEnd` ma khong phai `<= dayEnd`?** Vi dung `<= 23:59:59` se bo sot cac thoi diem nhu `23:59:59.500`. Dung `< ngay hom sau` bao phu **toan bo** ngay hom nay.

### 10.6 VoucherSpecification -- Loc theo thoi gian (da het han)

File: `backend/src/main/java/com/cinex/module/voucher/specification/VoucherSpecification.java`

```java
public static Specification<Voucher> isExpired() {
    return (root, query, cb) -> cb.lessThan(root.get("endDate"), LocalDateTime.now());
}
```

SQL: `WHERE end_date < '2026-05-31 14:30:00'`

### 10.7 SnackSpecification -- Filter cong khai (chi snack available)

File: `backend/src/main/java/com/cinex/module/snack/specification/SnackSpecification.java`

```java
// Filter danh cho user (khong phai admin): chi snack con hang + chua xoa
public static Specification<Snack> publicFilter() {
    return (root, query, cb) ->
            cb.and(
                    cb.isTrue(root.get("available")),
                    cb.or(
                            cb.isNull(root.get("storageState")),
                            cb.notEqual(root.get("storageState"), StorageState.ARCHIVED)
                    )
            );
}
```

**Diem hay:** Ngoai `fromFilter()` (cho admin), con co `publicFilter()` (cho user) voi dieu kien cung hon.

---

## 11. SQL sinh ra khi ghep nhieu filter

### Vi du 1: Movie -- keyword + status + genreId

Request: `GET /api/movies?keyword=Avengers&status=NOW_SHOWING&genreId=1&page=0&size=20`

```sql
SELECT m.*
FROM movies m
LEFT JOIN movie_genres mg ON m.id = mg.movie_id
LEFT JOIN genres g ON mg.genre_id = g.id
WHERE (m.storage_state IS NULL OR m.storage_state <> 'ARCHIVED')    -- notDeleted()
  AND LOWER(m.title) LIKE '%avengers%'                               -- hasTitle("Avengers")
  AND m.status = 'NOW_SHOWING'                                       -- hasStatus(NOW_SHOWING)
  AND g.id = 1                                                       -- hasGenre(1)
ORDER BY m.created_at DESC                                           -- @PageableDefault(sort = "createdAt", direction = DESC)
OFFSET 0 ROWS FETCH NEXT 20 ROWS ONLY                               -- page=0, size=20
```

### Vi du 2: Movie -- chi showing (co subquery)

Request: `GET /api/movies?showing=true`

```sql
SELECT m.*
FROM movies m
WHERE (m.storage_state IS NULL OR m.storage_state <> 'ARCHIVED')
  AND EXISTS (
      SELECT 1 FROM showtimes s
      WHERE s.movie_id = m.id
        AND s.end_time >= '2026-05-31 14:30:00'
        AND (s.storage_state IS NULL OR s.storage_state <> 'ARCHIVED')
  )
ORDER BY m.created_at DESC
OFFSET 0 ROWS FETCH NEXT 20 ROWS ONLY
```

### Vi du 3: User -- keyword tim nhieu field + role

Request: `GET /api/users?keyword=vanan&role=ADMIN`

```sql
SELECT u.*
FROM users u
WHERE (u.storage_state IS NULL OR u.storage_state <> 'ARCHIVED')
  AND (
      LOWER(u.username) LIKE '%vanan%'
      OR LOWER(u.email) LIKE '%vanan%'
      OR LOWER(u.full_name) LIKE '%vanan%'
  )
  AND u.role = 'ADMIN'
ORDER BY u.created_at DESC
```

### Vi du 4: Booking -- admin tim theo bookingCode

Request: `GET /api/admin/bookings?keyword=BK20260531&status=CONFIRMED`

```sql
SELECT b.*
FROM bookings b
WHERE (b.storage_state IS NULL OR b.storage_state <> 'ARCHIVED')
  AND b.status = 'CONFIRMED'
  AND (
      LOWER(b.booking_code) LIKE '%bk20260531%'
      OR LOWER(b.username) LIKE '%bk20260531%'
  )
ORDER BY b.created_at DESC
```

### Vi du 5: Showtime -- loc theo ngay + phim + phong

Request: `GET /api/showtimes?movieId=5&roomId=2&date=2026-06-01`

```sql
SELECT s.*
FROM showtimes s
WHERE (s.storage_state IS NULL OR s.storage_state <> 'ARCHIVED')
  AND s.movie_id = 5
  AND s.room_id = 2
  AND s.start_time >= '2026-06-01 00:00:00'
  AND s.start_time < '2026-06-02 00:00:00'
ORDER BY s.created_at DESC
```

---

## 12. Them filter moi vao he thong: Chi 2 buoc

### Vi du: Them filter "language" cho Movie

**Buoc 1:** Them field vao Filter DTO

```java
// MovieFilter.java
@Getter
@Setter
public class MovieFilter {
    private String keyword;
    private MovieStatus status;
    private Long genreId;
    private Boolean includeDeleted;
    private Boolean showing;
    private String language;          // <-- THEM 1 DONG NAY
}
```

**Buoc 2:** Them method + if trong Specification

```java
// MovieSpecification.java

// Them method moi
public static Specification<Movie> hasLanguage(String language) {
    return (root, query, cb) -> cb.equal(root.get("language"), language);
}

// Them 1 dong if vao fromFilter()
public static Specification<Movie> fromFilter(MovieFilter filter) {
    Specification<Movie> spec = Specification.where(null);
    // ... cac if cu giu nguyen ...
    if (StringUtils.hasText(filter.getLanguage())) {          // <-- THEM 1 DONG NAY
        spec = spec.and(hasLanguage(filter.getLanguage()));   // <-- THEM 1 DONG NAY
    }
    return spec;
}
```

**Xong!** Khong can sua gi o:
- Controller -- van nhan `MovieFilter filter`, signature khong doi
- Service -- van goi `MovieSpecification.fromFilter(filter)`, khong doi
- Repository -- van dung `findAll(spec, pageable)`, khong doi
- Frontend -- chi can them `&language=vi` vao query params

**Day la nguyen tac Open/Closed Principle (OCP):** Mo cho viec mo rong (them filter), dong cho viec sua doi (khong sua code cu).

### So sanh voi cach khong dung Specification

| | Khong dung Specification | Dung Specification |
|---|---|---|
| Them filter moi | Sua Controller (them param) + Service (them if-else) + Repository (them method) = **3 file** | Sua DTO (them field) + Specification (them method + if) = **1-2 file** |
| So method trong Repository | 2^N (N = so filter) | **0** (dung findAll co san) |
| Controller signature | Thay doi moi lan them filter | **Khong doi** (nhan DTO) |

---

## 13. Cau hoi tu kiem tra

### Cau 1: Tai sao `Specification.where(null)` ma khong phai `Specification.where(notDeleted())`?

> **Tra loi:** `where(null)` tao spec rong (WHERE TRUE), de moi dieu kien tiep theo duoc ghep tu do. Neu bat dau bang `where(notDeleted())`, thi khi `includeDeleted = true`, ban khong co cach BO dieu kien `notDeleted` ra. Bat dau rong + ghep co dieu kien = linh hoat hon.

### Cau 2: Neu bo `cb.isNull(root.get("storageState"))` trong `notDeleted()`, dieu gi xay ra?

> **Tra loi:** Ban ghi co `storage_state = NULL` trong database se **bi loai khoi ket qua**, mac du chung KHONG bi xoa. Vi trong SQL, `NULL <> 'ARCHIVED'` = NULL (khong phai TRUE), nen WHERE clause loai dong do. Day la loi do SQL three-valued logic.

### Cau 3: Tai sao dung `Boolean.TRUE.equals(filter.getIncludeDeleted())` thay vi `filter.getIncludeDeleted() == true`?

> **Tra loi:** Vi `includeDeleted` kieu `Boolean` (wrapper class), co the la `null`. Neu `null == true` --> **NullPointerException** vi Java unbox null thanh boolean. `Boolean.TRUE.equals(null)` --> tra ve `false` an toan, khong bao gio NullPointerException.

### Cau 4: BookingSpecification co 2 method `fromFilter` va `fromAdminFilter`. Tai sao khong dung 1 method chung?

> **Tra loi:** Vi logic khac nhau ve mat bao mat:
> - User **BAT BUOC** chi xem booking cua minh --> `Specification.where(hasUser(userId))` la diem bat dau
> - Admin xem TAT CA booking --> `Specification.where(null)` la diem bat dau
>
> Neu gop chung, de quen truyen userId cho user --> **lo data** (user xem duoc booking nguoi khac). Tach rieng = dam bao compiler bat loi neu thieu userId.

### Cau 5: Neu FE gui `GET /api/movies` khong co bat ky query param nao, SQL sinh ra la gi?

> **Tra loi:** Tat ca field trong MovieFilter deu la `null`, nen khong co `if` nao match (tru `notDeleted` vi `includeDeleted = null` --> `!Boolean.TRUE.equals(null)` = true). SQL chi co:
> ```sql
> SELECT * FROM movies
> WHERE (storage_state IS NULL OR storage_state <> 'ARCHIVED')
> ORDER BY created_at DESC
> OFFSET 0 ROWS FETCH NEXT 20 ROWS ONLY
> ```
> Tuc la: **lay tat ca phim chua xoa, phan trang 20 ban ghi/trang.**

### Cau 6: Tai sao `hasActiveShowtimes()` dung EXISTS subquery thay vi JOIN bang showtimes?

> **Tra loi:** JOIN se gay **trung lap ket qua** -- 1 phim co 5 suat chieu se tra ve 5 dong. EXISTS chi tra TRUE/FALSE nen moi phim chi xuat hien 1 lan. Ngoai ra, EXISTS **nhanh hon** vi database chi can tim 1 ban ghi thoa man la dung, khong duyet het bang.

### Cau 7: Trong ShowtimeSpecification, method `onDate()` dung `lessThan(startTime, dayEnd)` thay vi `lessThanOrEqualTo`. Tai sao?

> **Tra loi:** Vi `dayEnd = date.plusDays(1).atStartOfDay()` = 00:00:00 ngay hom sau. Neu dung `<=`, thi suat chieu bat dau luc dung 00:00:00 ngay hom sau cung duoc tinh vao ngay hom nay -- sai. Dung `<` thi chi lay cac suat trong ngay hom nay (00:00:00.000 --> 23:59:59.999...).

---

## Bang tong hop Specification trong du an

| Module | Specification | Ky thuat dac biet | File |
|---|---|---|---|
| Movie | `MovieSpecification` | JOIN (genre), EXISTS subquery (showtime) | `module/movie/specification/MovieSpecification.java` |
| Genre | `GenreSpecification` | LIKE (name) | `module/movie/specification/GenreSpecification.java` |
| Room | `RoomSpecification` | Nhieu enum filter (type, status) | `module/room/specification/RoomSpecification.java` |
| User | `UserSpecification` | OR tren nhieu field (username, email, fullName) | `module/user/specification/UserSpecification.java` |
| Booking | `BookingSpecification` | 2 entry point (user vs admin), navigate relation (user.id) | `module/booking/specification/BookingSpecification.java` |
| Showtime | `ShowtimeSpecification` | Date range (onDate), navigate relation (movie.id, room.id) | `module/showtime/specification/ShowtimeSpecification.java` |
| Snack | `SnackSpecification` | publicFilter() rieng cho user, OR keyword (name, category) | `module/snack/specification/SnackSpecification.java` |
| Voucher | `VoucherSpecification` | So sanh thoi gian (isExpired), OR keyword (code, description) | `module/voucher/specification/VoucherSpecification.java` |
| Review | `ReviewSpecification` | So sanh (>=) rating, navigate relation (movie.id) | `module/review/specification/ReviewSpecification.java` |
