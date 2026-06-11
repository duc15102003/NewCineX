# Filter DTO + Specification Pattern -- Giải thích chi tiết cho người mới

---

## 1. Tổng quan: Bài toán tìm kiếm đồng

### Vấn đề thực tế

Hinh đúng bạn vào trang admin của rap phim CineX. Bạn cần tìm phim:
- Theo **tu khoa** ("Avengers")
- Theo **trạng thái** (đang chiếu / sắp chiếu)
- Theo **the loại** (hanh đồng / tinh cam)
- Theo **đang có suất chiếu** hay không
- Hoặc **ket hop** nhieu dieu kien cùng luc

FE gui request kiểu này:

```
GET /api/movies?keyword=Avengers&status=NOW_SHOWING&genreId=1&page=0&size=20
```

Câu hỏi: Backend viet code thế nào de xử lý **tất cả tổ hợp filter**?

### Cách SAI: Viet if-else hoặc nhieu method trong Repository

```java
// SAI -- Moi to hop filter = 1 method rieng
Page<Movie> findByTitleContaining(String title, Pageable p);
Page<Movie> findByStatus(MovieStatus status, Pageable p);
Page<Movie> findByTitleContainingAndStatus(String title, MovieStatus status, Pageable p);
Page<Movie> findByTitleContainingAndStatusAndGenresId(String title, MovieStatus status, Long genreId, Pageable p);
// ... con nhieu nua!
```

Nếu co **N** filter, so method cần viet là **2^N** (mỗi filter có the co hoặc không). Voi 5 filter, bạn cần 2^5 = **32 method**! Them 1 filter mới = so method **nhan đôi**.

### Cách ĐÚNG: Specification Pattern

Specification Pattern cho phep bạn **ghép các dieu kien WHERE đồng**, tuy vào filter nào co giá trị. Chi cần **1 method duy nhất** `findAll(spec, pageable)`.

```
FE gui query params --> Spring bind vao Filter DTO --> Specification.fromFilter() --> findAll(spec, pageable)
```

---

## 2. Specification Pattern là gì?

### Ví dụ đời thường: Lọc sản phẩm trên Shopee

Khi bạn vào Shopee tìm mua dien thoai:
1. Go "iPhone" vào o tìm kiếm --> **keyword**
2. Chon mục giá "5-10 trieu" --> **price range**
3. Chon thuong hieu "Apple" --> **brand**
4. Chon "4 sao tro lên" --> **rating**
5. Tick "Mien phi van chuyen" --> **free shipping**

Shopee không viet 32 ham khác nhau cho 5 bộ loc này. Ho **ghép tung dieu kien** lai với nhau:

```
SELECT * FROM products
WHERE name LIKE '%iPhone%'           -- keyword (co)
  AND price BETWEEN 5000000 AND 10000000  -- price range (co)
  AND brand = 'Apple'                -- brand (co)
  AND rating >= 4                    -- rating (co)
  AND free_shipping = true           -- free shipping (co)
```

Nếu bạn bộ tick "Mien phi van chuyen", đồng cuối bien mat. Nếu bạn không chon thuong hieu, đồng `brand = 'Apple'` bien mat. **Mới bộ loc là 1 khoi đọc lap, ghép vào hoặc bộ ra tuy y.**

Specification Pattern trong Spring làm chính xác dieu này: **mới bộ loc là 1 method nhỏ**, ghép lai bảng `.and()`.

### Định nghĩa chính thức

> **Specification Pattern** (thuoc nhom Behavioral): Tach rieng tung dieu kien truy vấn thanh các đối tượng (Specification) đọc lap. Cac đối tượng này co the **to hop** (AND, OR, NOT) de tạo truy vấn phức tạp, ma **không cần sửa code cũ**.

Trong Spring Data JPA, interface `Specification<T>` co 1 method duy nhất:

```java
Predicate toPredicate(Root<T> root, CriteriaQuery<?> query, CriteriaBuilder cb);
```

Ba tham so này là gì?
- **`root`**: Dai dien cho bảng (entity) đang query. `root.get("title")` = cột `title` trong bảng `movies`.
- **`query`**: Doi tuong CriteriaQuery, đúng khi cần subquery, distinct, group by.
- **`cb`** (CriteriaBuilder): Nha may tạo dieu kien. `cb.equal()` = `=`, `cb.like()` = `LIKE`, `cb.or()` = `OR`, v.v.

---

## 3. So sánh TRƯỚC và SAU khi dùng Specification

### TRƯỚC: 2^N method trong Repository (KHÔNG DÙNG)

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
- Them 1 filter mới (VD: `language`) --> so method **nhan đôi** (32 thanh 64)
- If-else trong Service phinh to không kiem soat
- De copy-paste sai, kho maintain

### SAU: 1 method + Specification (ĐÚNG)

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

**Them 1 filter mới (`language`)**: chi thêm 1 field vào DTO + 1 method + 1 đồng if. **Repository, Service, Controller không sửa gì.**

---

## 4. Cách viết Specification từng bước

Lay `MovieSpecification` làm ví dụ. File: `backend/src/main/java/com/cinex/module/movie/specification/MovieSpecification.java`

### Bước 1: Tạo class utility với constructor private

```java
public class MovieSpecification {

    private MovieSpecification() {}  // Khong cho tao instance (chi dung static method)
    // ...
}
```

**Tại sao constructor private?** Vì class này chi chua các method static (công cụ), không cần tạo đối tượng. Giong như lop `Math` trong Java: bạn goi `Math.abs()` chu không bao giờ `new Math()`.

### Bước 2: Viết từng method filter nhỏ

Mới method trả về `Specification<Movie>` -- một đối tượng bieu dien **1 dieu kien WHERE**.

#### hasTitle() -- Tìm theo từ khóa

```java
public static Specification<Movie> hasTitle(String keyword) {
    return (root, query, cb) ->
            cb.like(cb.lower(root.get("title")), "%" + keyword.toLowerCase() + "%");
}
```

Giải thích:
- `root.get("title")` = cột `title` trong bảng `movies`
- `cb.lower(...)` = ham `LOWER()` trong SQL, de tìm không phân biệt hoa/thuong
- `cb.like(...)` = `LIKE` trong SQL
- `"%" + keyword + "%"` = tìm chuoi chua keyword o bất kỳ vị trí nào

SQL sinh ra: `LOWER(m.title) LIKE '%avengers%'`

#### hasStatus() -- Lọc theo trạng thái

```java
public static Specification<Movie> hasStatus(MovieStatus status) {
    return (root, query, cb) ->
            cb.equal(root.get("status"), status);
}
```

SQL sinh ra: `m.status = 'NOW_SHOWING'`

#### hasGenre() -- Lọc theo thể loại (có JOIN)

```java
public static Specification<Movie> hasGenre(Long genreId) {
    return (root, query, cb) -> {
        var genreJoin = root.join("genres", JoinType.LEFT);
        return cb.equal(genreJoin.get("id"), genreId);
    };
}
```

Giải thích:
- `root.join("genres", JoinType.LEFT)` = `LEFT JOIN movie_genres mg ON m.id = mg.movie_id`
- `genreJoin.get("id")` = cột `id` của bảng `genres`
- Dùng `LEFT JOIN` de phim không co genre van trả về (chi là không match dieu kien)

SQL sinh ra: `LEFT JOIN movie_genres mg ON m.id = mg.movie_id ... AND mg.genre_id = 1`

#### notDeleted() -- Chỉ lấy bản ghi chưa xóa

```java
public static Specification<Movie> notDeleted() {
    return (root, query, cb) ->
            cb.or(
                    cb.isNull(root.get("storageState")),
                    cb.notEqual(root.get("storageState"), StorageState.ARCHIVED)
            );
}
```

**Day là phần QUAN TRONG nhất -- tại sao cần `cb.or(isNull, notEqual)`?**

Xem phần 8 bên dưới de hieu chi tiết.

### Bước 3: Viết fromFilter() -- ghép tất cả lại

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

Giải thích tung đồng:

1. `Specification.where(null)` -- Tao spec rộng, tuong duong `WHERE TRUE`. Mới dieu kien sẽ AND thêm vào.

2. Mới `if` kiểm tra: **nếu filter co giá trị thì ghép thêm dieu kien**. Nếu FE không gui `status` --> `filter.getStatus()` = null --> bộ qua, không thêm vào WHERE.

3. `spec.and(...)` -- Nói dieu kien mới vào cuối. Giong như xep gach LEGO: mới vien gach là 1 dieu kien, xep bao nhieu tuy y.

**Ví dụ cũ the:**

FE gui: `?keyword=Avengers&status=NOW_SHOWING` (không gui genreId, không gui showing)

```
Specification.where(null)                    --> WHERE TRUE
  .and(notDeleted())                         --> AND (storage_state IS NULL OR storage_state <> 'ARCHIVED')
  .and(hasTitle("Avengers"))                 --> AND LOWER(title) LIKE '%avengers%'
  .and(hasStatus(NOW_SHOWING))               --> AND status = 'NOW_SHOWING'
  // genreId = null --> BO QUA
  // showing = null --> BO QUA
```

FE gui: `?genreId=1` (chi loc the loại, không co keyword hay status)

```
Specification.where(null)                    --> WHERE TRUE
  .and(notDeleted())                         --> AND (storage_state IS NULL OR storage_state <> 'ARCHIVED')
  // keyword = null --> BO QUA
  // status = null --> BO QUA
  .and(hasGenre(1L))                         --> AND genre_id = 1
  // showing = null --> BO QUA
```

---

## 5. Filter DTO: Nhận params từ FE, type-safe

### Filter DTO là gì?

**DTO** (Data Transfer Object) là class chi chua **data**, không chua logic. **Filter DTO** là DTO chuyen đúng de chua các tham so loc/tìm kiếm.

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

### Tại sao dùng Filter DTO mà không dùng @RequestParam?

So sánh 3 cách:

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

### Spring tự động bind query params vào DTO như thế nào?

Khi FE gui:
```
GET /api/movies?keyword=Avengers&status=NOW_SHOWING&genreId=1
```

Spring tu đồng:
1. Tao đối tượng `new MovieFilter()`
2. Goi `filter.setKeyword("Avengers")`
3. Goi `filter.setStatus(MovieStatus.NOW_SHOWING)` (tu chuyen String thanh Enum!)
4. Goi `filter.setGenreId(1L)` (tu chuyen String "1" thanh Long)
5. `filter.getIncludeDeleted()` = `null` (vì FE không gui param này)
6. `filter.getShowing()` = `null`

**Không cần `@RequestParam`!** Spring Boot tu bind query params vào DTO object khi tên field KHOP với tên param.

### Bảng tổng hợp Filter DTO trong dự án (cập nhật Phase 4a)

| Module | Filter DTO | Fields chính | Đặc điểm |
|---|---|---|---|
| Movie | `MovieFilter` | keyword, status, genreId, director, cast, language, minDuration, maxDuration, **minRating/maxRating (COALESCE)**, releaseDateFrom/To, showing, hasActiveShowtimes, includeDeleted | 11 field — filter sâu cho FE list phim |
| Genre | `GenreFilter` | keyword, **hasMovies** (EXISTS subquery), includeDeleted | Filter genre còn liên kết phim hay không |
| Room | `RoomFilter` | keyword, type, status, includeDeleted | Enum filter |
| User | `UserFilter` | keyword (username/email/fullName/**phone**), role, enabled, createdFrom/To, includeDeleted | Keyword OR trên 4 field |
| Booking (admin) | `BookingFilter` | keyword, status, **userId, movieId, showtimeId, roomId, paymentMethod (EXISTS), minAmount/maxAmount, createdFrom/To, confirmedFrom/To**, includeDeleted | 11 field cho admin; user filter chỉ subset (KHÔNG có userId) |
| Showtime | `ShowtimeFilter` | movieId, roomId, date, status, includeDeleted | Date range với onDate() |
| Snack | `SnackFilter` | keyword, includeDeleted (publicFilter cho user) | 2 entry point |
| Voucher | `VoucherFilter` | keyword, active, **discountType**, **currentlyValid**, expired, minDiscount/maxDiscount, startDate/endDate range, **hasUsageLeft**, includeDeleted | Filter theo tính hợp lệ hiện tại |
| Review | `ReviewFilter` | movieId, userId, **minRating/maxRating**, **hasComment**, createdFrom/To, includeDeleted | Filter content quality |
| Payment | `PaymentFilter` **(MỚI)** | keyword, status, method, bookingId, userId, paidFrom/To, createdFrom/To, minAmount/maxAmount, includeDeleted | Filter doanh thu / báo cáo |
| Notification | `NotificationFilter` | type, isRead, createdFrom/To. **KHÔNG có userId** — chống IDOR | userId truyền riêng ở `fromFilter(filter, userId)` |

---

## 6. Ghép Specification: spec.and() -- Chain Pattern

### Cách ghép hoạt động

`spec.and(dieuKienMoi)` trả về **Specification mới** chua **cả dieu kien cũ và dieu kien mới**. Day là **Immutable Chain** -- mỗi lần `.and()` tạo đối tượng mới, không sửa đối tượng cũ.

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

Khi `findAll(spec, pageable)` được gọi, Spring/Hibernate duyet qua chuoi này và sinh ra SQL:

```sql
WHERE (storage_state IS NULL OR storage_state <> 'ARCHIVED')
  AND LOWER(title) LIKE '%avengers%'
  AND status = 'NOW_SHOWING'
```

### Co the đúng .or() không?

Co! Ngoai `.and()`, Spring Specification con ho tro:
- `.or(spec2)` -- ghép bảng OR
- `Specification.not(spec)` -- dao nguoc dieu kien

Ví dụ trong `UserSpecification.hasKeyword()`:

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

User go "vanan" --> tìm trong **cả 3 field** cùng luc.

---

## 7. JpaSpecificationExecutor: findAll(spec, pageable)

### Repository chi cần thêm 1 đồng

```java
public interface MovieRepository
    extends JpaRepository<Movie, Long>,           // CRUD co ban: save, findById, delete, ...
            JpaSpecificationExecutor<Movie> {      // <-- THEM DONG NAY
    // Khong can khai bao method nao!
}
```

**`JpaSpecificationExecutor<T>`** là interface của Spring Data JPA, cùng cấp san các method:

| Method | Tac đúng | Tuong duong SQL |
|---|---|---|
| `findAll(Specification)` | Tim tất cả thoa dieu kien | `SELECT * FROM movies WHERE ...` |
| `findAll(Specification, Pageable)` | Tim + phần trang + sắp xếp | `... ORDER BY ... OFFSET ... FETCH ...` |
| `findAll(Specification, Sort)` | Tim + sắp xếp (không phần trang) | `... ORDER BY ...` |
| `findOne(Specification)` | Tim 1 bạn ghi | `... FETCH FIRST 1 ROW ONLY` |
| `count(Specification)` | Dem số lượng | `SELECT COUNT(*) FROM movies WHERE ...` |
| `exists(Specification)` | Co ton tai không | `SELECT CASE WHEN COUNT > 0 ...` |

**Bạn KHONG cần viet bất kỳ method nào trong Repository.** Chi cần `extends JpaSpecificationExecutor<Movie>` là co tất cả.

### Luong dữ liệu toan bộ

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

## 8. Xử lý NULL storageState: cb.or(isNull, notEqual) -- Tại sao cần?

Day là phần **nhieu người bi nhằm nhất**.

### Van de

Trong `BaseEntity`, field `storageState` co giá trị mac dinh:

```java
private StorageState storageState = StorageState.ACTIVE;
```

Nhưng trong database, co truong hop `storage_state` là **NULL** (VD: data cũ trước khi thêm field này, hoặc insert trực tiếp vào DB).

### Nếu chi đúng `cb.notEqual()` thì sao?

```java
// SAI!
public static Specification<Movie> notDeleted() {
    return (root, query, cb) ->
            cb.notEqual(root.get("storageState"), StorageState.ARCHIVED);
}
```

SQL sinh ra: `WHERE storage_state <> 'ARCHIVED'`

**Van de**: Trong SQL, `NULL <> 'ARCHIVED'` = **NULL** (không phải TRUE!). Đó là SQL three-valued logic:
- `NULL = 'ARCHIVED'` --> `NULL` (không phải FALSE)
- `NULL <> 'ARCHIVED'` --> `NULL` (không phải TRUE)
- `NULL` trong WHERE clause --> row **bi loại** (chi giữ row co giá trị TRUE)

Ket qua: **Bạn ghi co `storage_state = NULL` bi loại ra**, mac du no KHONG bi xóa!

### Cách dùng: cb.or(isNull, notEqual)

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

Bảng truth table:

| storage_state | `IS NULL` | `<> 'ARCHIVED'` | `IS NULL OR <> 'ARCHIVED'` | Ket qua |
|---|---|---|---|---|
| `NULL` | TRUE | NULL | **TRUE** | Giữ lai |
| `'ACTIVE'` | FALSE | TRUE | **TRUE** | Giữ lai |
| `'ARCHIVED'` | FALSE | FALSE | **FALSE** | Loại bộ |

**Tất cả 9 Specification trong du an deu đúng pattern này** cho method `notDeleted()`. Day là loi phòng thu -- dam bao không bao giờ mat dữ liệu vì NULL.

---

## 9. EXISTS subquery cho phim "đang chiếu" (hasActiveShowtimes)

### Bài toán

Tab "Dang chiếu" trên trang chủ cần hien phim co **it nhất 1 suất chiếu chua kết thúc**. Không phải tất cả phim co status `NOW_SHOWING` deu đang chiếu -- co the suất cuối cùng đã kết thúc roi những admin chua đôi status.

Cách chính xác nhất: **Kiểm tra bảng `showtimes` xem co suất nào co `endTime >= now` không.**

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

### Tại sao đúng EXISTS thấy vì JOIN?

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

`EXISTS` cùng **nhanh hon JOIN** trong truong hop này vì database chi cần tìm **1 bạn ghi thoa man** là đúng ngày, không cần duyet het.

---

## 10. Code mau day du tu du an

### 10.1 MovieSpecification -- Day du nhất (co JOIN, subquery)

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

### 10.2 UserSpecification -- Tim keyword trên nhieu field

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

**Điểm hay:** Cung 1 Filter DTO những 2 entry point khác nhau cho 2 role. User luon bi gioi han boi `userId`, admin thì không.

### 10.5 ShowtimeSpecification -- Loc theo ngày (date range)

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

**Tại sao `< dayEnd` ma không phải `<= dayEnd`?** Vì đúng `<= 23:59:59` sẽ bộ sot các thoi điểm như `23:59:59.500`. Dùng `< ngay hom sau` bao phu **toan bộ** ngày hom này.

### 10.6 VoucherSpecification -- Loc theo thời gian (đã het han)

File: `backend/src/main/java/com/cinex/module/voucher/specification/VoucherSpecification.java`

```java
public static Specification<Voucher> isExpired() {
    return (root, query, cb) -> cb.lessThan(root.get("endDate"), LocalDateTime.now());
}
```

SQL: `WHERE end_date < '2026-05-31 14:30:00'`

### 10.7 SnackSpecification -- Filter công khai (chi snack available)

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

**Điểm hay:** Ngoai `fromFilter()` (cho admin), con co `publicFilter()` (cho user) với dieu kien cùng hon.

---

## 11. SQL sinh ra khi ghép nhieu filter

### Ví dụ 1: Movie -- keyword + status + genreId

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

### Ví dụ 2: Movie -- chi showing (co subquery)

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

### Ví dụ 3: User -- keyword tìm nhieu field + role

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

### Ví dụ 4: Booking -- admin tìm theo bookingCode

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

### Ví dụ 5: Showtime -- loc theo ngày + phim + phòng

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

## 12. Them filter mới vào hệ thống: Chi 2 buoc

### Ví dụ: Them filter "language" cho Movie

**Bước 1:** Them field vào Filter DTO

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

**Bước 2:** Them method + if trong Specification

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

**Xong!** Không cần sửa gì o:
- Controller -- van nhan `MovieFilter filter`, signature không đôi
- Service -- van goi `MovieSpecification.fromFilter(filter)`, không đôi
- Repository -- van đúng `findAll(spec, pageable)`, không đôi
- Frontend -- chi cần thêm `&language=vi` vào query params

**Day là nguyên tắc Open/Closed Principle (OCP):** Mo cho viec mo rộng (thêm filter), đồng cho viec sửa đôi (không sửa code cũ).

### So sánh với cách không đúng Specification

| | Không đúng Specification | Dùng Specification |
|---|---|---|
| Them filter mới | Sửa Controller (thêm param) + Service (thêm if-else) + Repository (thêm method) = **3 file** | Sửa DTO (thêm field) + Specification (thêm method + if) = **1-2 file** |
| So method trong Repository | 2^N (N = so filter) | **0** (đúng findAll co san) |
| Controller signature | Thay đôi mỗi lần thêm filter | **Không đôi** (nhan DTO) |

---

## 13. Câu hỏi tự kiểm tra

### Câu 1: Tại sao `Specification.where(null)` ma không phải `Specification.where(notDeleted())`?

> **Tra loi:** `where(null)` tạo spec rộng (WHERE TRUE), de mới dieu kien tiếp theo được ghép từ đó. Nếu bắt đầu bảng `where(notDeleted())`, thì khi `includeDeleted = true`, bạn không co cách BO dieu kien `notDeleted` ra. Bắt đầu rộng + ghép co dieu kien = linh hoat hon.

### Câu 2: Nếu bộ `cb.isNull(root.get("storageState"))` trong `notDeleted()`, điều gì xay ra?

> **Tra loi:** Bạn ghi co `storage_state = NULL` trong database sẽ **bi loại khoi ket qua**, mac du chúng KHONG bi xóa. Vì trong SQL, `NULL <> 'ARCHIVED'` = NULL (không phải TRUE), nên WHERE clause loại đồng đó. Day là loi đó SQL three-valued logic.

### Câu 3: Tại sao đúng `Boolean.TRUE.equals(filter.getIncludeDeleted())` thấy vì `filter.getIncludeDeleted() == true`?

> **Tra loi:** Vì `includeDeleted` kiểu `Boolean` (wrapper class), co the là `null`. Nếu `null == true` --> **NullPointerException** vì Java unbox null thanh boolean. `Boolean.TRUE.equals(null)` --> trả về `false` an toàn, không bao giờ NullPointerException.

### Câu 4: BookingSpecification co 2 method `fromFilter` và `fromAdminFilter`. Tại sao không đúng 1 method chúng?

> **Tra loi:** Vì logic khác nhau về mat bao mat:
> - User **BAT BUOC** chi xem booking của mình --> `Specification.where(hasUser(userId))` là điểm bắt đầu
> - Admin xem TAT CA booking --> `Specification.where(null)` là điểm bắt đầu
>
> Nếu ghép chúng, de quen truyen userId cho user --> **lo data** (user xem được booking người khác). Tach rieng = dam bao compiler bật loi nếu thieu userId.

### Câu 5: Nếu FE gui `GET /api/movies` không co bất kỳ query param nào, SQL sinh ra là gì?

> **Tra loi:** Tất cả field trong MovieFilter deu là `null`, nên không co `if` nào match (tru `notDeleted` vì `includeDeleted = null` --> `!Boolean.TRUE.equals(null)` = true). SQL chi co:
> ```sql
> SELECT * FROM movies
> WHERE (storage_state IS NULL OR storage_state <> 'ARCHIVED')
> ORDER BY created_at DESC
> OFFSET 0 ROWS FETCH NEXT 20 ROWS ONLY
> ```
> Tuc là: **lay tất cả phim chua xóa, phần trang 20 bạn ghi/trang.**

### Câu 6: Tại sao `hasActiveShowtimes()` đúng EXISTS subquery thấy vì JOIN bảng showtimes?

> **Tra loi:** JOIN sẽ gay **trung lap ket qua** -- 1 phim co 5 suất chiếu sẽ trả về 5 đồng. EXISTS chi tra TRUE/FALSE nên mới phim chi xuat hien 1 lan. Ngoai ra, EXISTS **nhanh hon** vì database chi cần tìm 1 bạn ghi thoa man là đúng, không duyet het bảng.

### Câu 7: Trong ShowtimeSpecification, method `onDate()` đúng `lessThan(startTime, dayEnd)` thấy vì `lessThanOrEqualTo`. Tại sao?

> **Tra loi:** Vì `dayEnd = date.plusDays(1).atStartOfDay()` = 00:00:00 ngày hom sâu. Nếu đúng `<=`, thì suất chiếu bắt đầu luc đúng 00:00:00 ngày hom sâu cùng được tính vào ngày hom này -- sai. Dùng `<` thì chi lay các suất trong ngày hom này (00:00:00.000 --> 23:59:59.999...).

---

## Bảng tổng hợp Specification trong du an

| Module | Specification | Ky thuat đặc biệt | File |
|---|---|---|---|
| Movie | `MovieSpecification` | JOIN (genre), EXISTS subquery (showtime) | `module/movie/specification/MovieSpecification.java` |
| Genre | `GenreSpecification` | LIKE (name) | `module/movie/specification/GenreSpecification.java` |
| Room | `RoomSpecification` | Nhieu enum filter (type, status) | `module/room/specification/RoomSpecification.java` |
| User | `UserSpecification` | OR trên nhieu field (username, email, fullName) | `module/user/specification/UserSpecification.java` |
| Booking | `BookingSpecification` | 2 entry point (user vs admin), navigate relation (user.id) | `module/booking/specification/BookingSpecification.java` |
| Showtime | `ShowtimeSpecification` | Date range (onDate), navigate relation (movie.id, room.id) | `module/showtime/specification/ShowtimeSpecification.java` |
| Snack | `SnackSpecification` | publicFilter() rieng cho user, OR keyword (name, category) | `module/snack/specification/SnackSpecification.java` |
| Voucher | `VoucherSpecification` | So sánh thời gian (isExpired), OR keyword (code, description) | `module/voucher/specification/VoucherSpecification.java` |
| Review | `ReviewSpecification` | So sánh (>=) rating, navigate relation (movie.id) | `module/review/specification/ReviewSpecification.java` |
