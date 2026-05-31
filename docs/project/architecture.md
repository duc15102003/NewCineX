# Kiến trúc hệ thống CineX — Giải thích chi tiết cho sinh viên

> Tài liệu này giải thích TOÀN BỘ kiến trúc phần mềm của CineX, từ tổng thể đến chi tiết từng lớp.
> Viết cho sinh viên chưa biết gì — đọc xong sẽ hiểu TẠI SAO code được tổ chức như vậy.

---

## 1. Kiến trúc tổng thể (System Architecture)

### Hệ thống CineX gồm những gì?

Hãy tưởng tượng CineX như một rạp chiếu phim thật:

| Thành phần | Vai trò | Ví dụ đời thường |
|---|---|---|
| **Frontend (React)** | Giao diện người dùng nhìn thấy | Quầy vé, bảng lịch chiếu, màn hình chọn ghế |
| **Backend (Spring Boot)** | Xử lý logic nghiệp vụ | Nhân viên phía sau quầy: kiểm tra ghế trống, tính tiền, xuất vé |
| **SQL Server** | Lưu trữ dữ liệu lâu dài | Kho hồ sơ: danh sách phim, thông tin khách, lịch sử đặt vé |
| **Redis** | Bộ nhớ đệm (cache) siêu nhanh | Bảng ghi nhớ tạm: "Ghế A1 đang được giữ 10 phút" |
| **Cloudinary** | Lưu trữ file ảnh/video | Kho poster phim, ảnh đại diện user |
| **WebSocket** | Giao tiếp thời gian thực | Loa thông báo: "Ghế A3 vừa được đặt!" — tất cả khách nghe được ngay |

### Sơ đồ tổng thể

```
                                    INTERNET
                                       |
                    +------------------+------------------+
                    |                                     |
              [React SPA]                          [Cloudinary CDN]
              Port 5173                            Lưu ảnh/poster
              - Trang chủ                          - cinex/posters/
              - Đặt vé                             - cinex/avatars/
              - Admin dashboard                    - cinex/snacks/
                    |
                    | HTTP REST (JSON)
                    | WebSocket (STOMP)
                    v
            +-------------------+
            |  Spring Boot API  |
            |    Port 8088      |
            |                   |
            |  JwtAuthFilter    |  <-- Mọi request đều đi qua đây trước
            |  SecurityConfig   |
            |  Controllers      |
            |  Services         |
            |  Repositories     |
            +--------+----------+
                     |
          +----------+----------+
          |                     |
    [SQL Server]           [Redis]
    Port 1433              Port 6379
    Lưu trữ chính:        Cache:
    - users                - JWT blacklist
    - movies               - System config
    - bookings             - Session data
    - payments
    - showtimes
```

### Luồng request điển hình

Khi user mở trang danh sách phim, đây là những gì xảy ra:

```
1. Browser gửi:  GET http://localhost:8088/api/movies?keyword=Avengers
                 Header: Authorization: Bearer eyJhbGci...

2. JwtAuthFilter:  Kiểm tra token → hợp lệ → set user vào SecurityContext
                   (Nếu không có token hoặc token sai → vẫn cho qua,
                    nhưng endpoint nào cần auth sẽ bị Spring Security chặn)

3. MovieController:  Nhận request → gọi movieService.listMovies(filter, pageable)
                     (Controller KHÔNG xử lý gì, chỉ điều phối)

4. MovieService:  Build Specification từ filter → gọi movieRepository.findAll(spec, pageable)
                  (Service chứa TOÀN BỘ business logic)

5. MovieRepository:  Spring Data JPA tự sinh SQL → gửi đến SQL Server
                     SELECT * FROM movies WHERE title LIKE '%Avengers%' AND storage_state != 'ARCHIVED'
                     ORDER BY created_at DESC OFFSET 0 ROWS FETCH NEXT 20 ROWS ONLY

6. SQL Server:  Thực thi query → trả về danh sách Movie entities

7. MovieMapper:  Chuyển Movie entity → MovieListResponse DTO (bỏ field nhạy cảm)

8. MovieController:  Bọc kết quả trong ApiResponse → trả JSON cho Browser

9. Browser nhận:
   {
     "success": true,
     "message": "OK",
     "data": {
       "content": [{ "id": 1, "title": "Avengers: Endgame", ... }],
       "page": 0, "size": 20, "totalElements": 5, "totalPages": 1
     },
     "timestamp": "2026-05-31T10:30:00Z"
   }
```

---

## 2. Layered Architecture — Kiến trúc phân lớp

### Tại sao cần phân lớp?

Hãy tưởng tượng bạn mở một quán phở:

- **Cách 1 (không phân lớp):** 1 người vừa tiếp khách, vừa nấu phở, vừa rửa bát, vừa tính tiền. Khi quán đông → loạn, sai sót, không ai thay thế được.

- **Cách 2 (có phân lớp):** Phân công rõ ràng:
  - Phục vụ (Controller): tiếp nhận order, mang phở ra bàn
  - Bếp (Service): nấu phở, pha nước dùng, thái thịt
  - Kho (Repository): lấy nguyên liệu từ tủ lạnh
  - Tủ lạnh (Database): nơi lưu trữ nguyên liệu

Khi cần đổi loại tủ lạnh (từ SQL Server sang PostgreSQL), bếp và phục vụ không cần biết. Chỉ kho (Repository) thay đổi.

### Sơ đồ các lớp

```
  HTTP Request (từ Browser)
        |
        v
  +---------------------+
  |    CONTROLLER        |  Lớp 1: Tiếp nhận request
  |  (MovieController)   |  - Nhận HTTP request
  |                      |  - Gọi Service xử lý
  |  CHỈ LÀM 3 VIỆC:    |  - Trả ApiResponse
  |  1. Nhận request     |
  |  2. Gọi service      |  KHÔNG chứa business logic
  |  3. Trả response     |  KHÔNG gọi repository
  +----------+-----------+
             |
             v
  +---------------------+
  |      SERVICE         |  Lớp 2: Xử lý nghiệp vụ
  |   (MovieService)     |  - Kiểm tra điều kiện (phim tồn tại? user có quyền?)
  |                      |  - Tính toán (giá vé, giảm giá, tổng tiền)
  |  CHỨA TOÀN BỘ       |  - Gọi Repository đọc/ghi DB
  |  BUSINESS LOGIC      |  - Gọi Mapper chuyển Entity <-> DTO
  |                      |  - Throw BusinessException khi lỗi
  +----------+-----------+
             |
             v
  +---------------------+
  |    REPOSITORY        |  Lớp 3: Truy vấn database
  | (MovieRepository)    |  - Interface extends JpaRepository
  |                      |  - Spring tự sinh SQL từ tên method
  |  KHÔNG CHỨA LOGIC   |  - Specification cho query phức tạp
  |  CHỈ TRUY VẤN DB    |  - Hoặc @Query cho JPQL tùy chỉnh
  +----------+-----------+
             |
             v
  +---------------------+
  |      ENTITY          |  Lớp 4: Ánh xạ bảng DB
  |      (Movie)         |  - Mỗi entity = 1 bảng
  |                      |  - Mỗi field = 1 cột
  |  EXTENDS BaseEntity  |  - JPA/Hibernate quản lý
  +----------+-----------+
             |
             v
  +---------------------+
  |    DATABASE          |  Lớp 5: Lưu trữ
  |   (SQL Server)       |  - Bảng movies, users, bookings, ...
  +---------------------+
```

### Quy tắc BẮT BUỘC giữa các lớp

```
  Controller ──> Service ──> Repository ──> Database
       |              |
       |              +──> Mapper (MapStruct)
       |              +──> Specification (query động)
       |
       +──> SecurityService (lấy user đang đăng nhập)
```

**KHÔNG ĐƯỢC VI PHẠM:**
- Controller KHÔNG gọi Repository (bỏ qua Service = bỏ qua business logic)
- Service KHÔNG gọi Controller (ngược chiều = vòng lặp phụ thuộc)
- Repository KHÔNG chứa business logic (Repository chỉ biết lấy data, không biết "nên" làm gì)

---

### 2.1. Controller — Lớp tiếp nhận

Controller giống như **nhân viên lễ tân** ở khách sạn: tiếp nhận yêu cầu của khách, chuyển cho bộ phận xử lý, rồi trả kết quả lại cho khách. Lễ tân KHÔNG tự đi nấu ăn, KHÔNG tự đi dọn phòng.

**Quy tắc: Controller CHỈ làm 3 việc:**
1. Nhận request (parse params, body, headers)
2. Gọi Service xử lý
3. Trả `ApiResponse<T>`

**Ví dụ thực tế trong CineX** — file `module/movie/controller/MovieController.java`:

```java
@RestController                      // Đánh dấu class này là REST Controller
@RequestMapping("/api/movies")       // Tất cả endpoint bắt đầu bằng /api/movies
@RequiredArgsConstructor             // Lombok tự tạo constructor inject MovieService
@Tag(name = "Movie")                 // Swagger: gom nhóm API trên Swagger UI
public class MovieController {

    private final MovieService movieService;   // Inject Service, KHÔNG inject Repository

    @GetMapping
    @Operation(summary = "List movies with search and filter")
    public ApiResponse<PageResponse<MovieListResponse>> listMovies(
            MovieFilter filter,                                           // Spring tự bind query params
            @PageableDefault(size = 20, sort = "createdAt",
                direction = Sort.Direction.DESC) Pageable pageable) {
        return ApiResponse.ok(movieService.listMovies(filter, pageable)); // Chỉ gọi service + trả response
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")        // Chỉ ADMIN mới gọi được
    @Operation(summary = "(Admin) Create a new movie")
    public ApiResponse<MovieResponse> createMovie(@Valid @RequestBody MovieRequest request) {
        return ApiResponse.ok("Movie created", movieService.createMovie(request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> deleteMovie(@PathVariable Long id) {
        movieService.deleteMovie(id);
        return ApiResponse.ok("Movie deleted", null);
    }
}
```

**Chú ý:** Không có dòng code nào trong Controller kiểm tra "phim có tồn tại không", "user có quyền xóa không" — tất cả nằm trong Service.

---

### 2.2. Service — Lớp xử lý nghiệp vụ

Service giống như **đầu bếp** trong nhà hàng: nhận order từ phục vụ, quyết định nấu gì, kiểm tra nguyên liệu, nấu xong thì giao. Đầu bếp là người DUY NHẤT quyết định "có nấu được món này không" (business logic).

**Quy tắc:**
- Mỗi Service quản lý 1 domain (MovieService chỉ xử lý phim, BookingService chỉ xử lý đặt vé)
- Mọi method đọc DB dùng `@Transactional(readOnly = true)` (tối ưu performance)
- Mọi method ghi DB dùng `@Transactional` (đảm bảo ACID — hoặc thành công hết, hoặc rollback hết)
- Khi có lỗi nghiệp vụ → throw `BusinessException(ErrorCode.XXX)`, KHÔNG return null

**Ví dụ thực tế** — file `module/movie/service/MovieService.java`:

```java
@Service                             // Đánh dấu class này là Spring Service Bean
@RequiredArgsConstructor             // Lombok: tự tạo constructor với tất cả field final
@Slf4j                               // Lombok: tự tạo biến log (log.info, log.warn, log.error)
public class MovieService {

    private final MovieRepository movieRepository;       // Truy vấn DB
    private final GenreRepository genreRepository;       // Truy vấn thể loại
    private final MovieMapper movieMapper;               // Chuyển Entity <-> DTO
    private final FileUploadService fileUploadService;   // Upload ảnh lên Cloudinary

    // readOnly = true: Hibernate KHÔNG theo dõi thay đổi entity → nhanh hơn
    @Transactional(readOnly = true)
    public PageResponse<MovieListResponse> listMovies(MovieFilter filter, Pageable pageable) {
        var spec = MovieSpecification.fromFilter(filter);     // Build query WHERE động
        Page<MovieListResponse> page = movieRepository.findAll(spec, pageable)
                .map(movieMapper::toListResponse);             // Entity -> DTO
        return PageResponse.from(page);
    }

    @Transactional
    public MovieResponse createMovie(MovieRequest request) {
        // Business rule: ngày kết thúc phải sau ngày phát hành
        if (request.getEndDate() != null && request.getReleaseDate() != null
                && request.getEndDate().isBefore(request.getReleaseDate())) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Ngày kết thúc chiếu phải sau ngày phát hành");
        }

        Movie movie = Movie.builder()     // Builder pattern: tạo entity
                .title(request.getTitle())
                .duration(request.getDuration())
                .status(request.getStatus())
                .genres(resolveGenres(request.getGenreIds()))
                .build();

        movie = movieRepository.save(movie);    // Lưu vào DB
        log.info("Created movie: {}", movie.getTitle());
        return movieMapper.toResponse(movie);   // Trả DTO (không trả entity)
    }
}
```

**Giải thích `@Transactional`:**
Tưởng tượng bạn chuyển tiền từ tài khoản A sang B:
1. Trừ tiền A: 1.000.000 → 900.000
2. Cộng tiền B: 500.000 → 600.000

Nếu bước 2 lỗi mà bước 1 đã xong → tiền biến mất! `@Transactional` đảm bảo: nếu bất kỳ bước nào lỗi, TẤT CẢ đều rollback (A vẫn giữ 1.000.000). Đây gọi là tính **Atomicity** trong ACID.

---

### 2.3. Repository — Lớp truy vấn database

Repository giống như **nhân viên kho** trong siêu thị: bạn bảo "lấy cho tôi 20 hộp sữa Vinamilk" → nhân viên kho đi lấy, bạn không cần biết sữa nằm ở kệ nào, tầng mấy.

CineX dùng **3 loại Repository** tùy tình huống:

#### Loại 1: JpaRepository — CRUD đơn giản

Dùng khi chỉ cần Create/Read/Update/Delete 1 entity. Spring Data JPA **tự sinh SQL** từ tên method.

File `module/movie/repository/MovieRepository.java`:

```java
// Chỉ cần khai báo interface — Spring TỰ ĐỘNG tạo implementation class
public interface MovieRepository
        extends JpaRepository<Movie, Long>,              // CRUD cơ bản: save, findById, delete, ...
                JpaSpecificationExecutor<Movie> {         // Hỗ trợ query WHERE động (Specification)
    // Không cần viết gì thêm!
    // JpaRepository đã cung cấp: save(), findById(), findAll(), delete(), count(), ...
}
```

Spring sinh SQL tự động khi bạn khai báo method:

| Method trong Repository | SQL được sinh ra |
|---|---|
| `findById(1L)` | `SELECT * FROM movies WHERE id = 1` |
| `findByTitle("Avengers")` | `SELECT * FROM movies WHERE title = 'Avengers'` |
| `existsByEmail("a@b.com")` | `SELECT COUNT(*) > 0 FROM users WHERE email = 'a@b.com'` |
| `countByStatus("ACTIVE")` | `SELECT COUNT(*) FROM movies WHERE status = 'ACTIVE'` |
| `findAll(spec, pageable)` | `SELECT * FROM movies WHERE <spec> ORDER BY <sort> OFFSET x ROWS FETCH NEXT y ROWS ONLY` |

#### Loại 2: JpaRepository + JpaSpecificationExecutor — Query động

Khi cần filter/search với nhiều điều kiện tùy chọn (user có thể search theo tên, hoặc theo thể loại, hoặc cả hai, hoặc không điều kiện nào). Xem chi tiết ở phần Specification Pattern bên dưới.

#### Loại 3: Standalone @Repository — Query phức tạp

Khi cần JOIN nhiều bảng, thống kê, báo cáo — không thuộc 1 entity cụ thể nào.

File `module/statistics/repository/StatisticsRepository.java`:

```java
@Repository      // Đánh dấu là Repository Bean (KHÔNG extends JpaRepository)
public class StatisticsRepository {

    @PersistenceContext                        // Inject EntityManager (chuẩn JPA, thread-safe)
    private EntityManager em;

    public BigDecimal sumTodayRevenue(LocalDateTime start, LocalDateTime end) {
        // JPQL: giống SQL nhưng dùng tên Entity/field Java thay vì tên bảng/cột
        return (BigDecimal) em.createQuery(
                "SELECT COALESCE(SUM(p.amount), 0) FROM Payment p " +
                "WHERE p.status = 'COMPLETED' " +
                "AND p.paidAt >= :start AND p.paidAt < :end")
            .setParameter("start", start)
            .setParameter("end", end)
            .getSingleResult();
    }
}
```

**Tại sao cần Standalone Repository?**
- JpaRepository = 1 interface quản lý 1 entity (MovieRepository quản lý Movie)
- Thống kê cần JOIN nhiều bảng (Booking + Payment + Showtime + Movie) → không thuộc entity nào
- Nếu nhét query thống kê vào BookingRepository → vi phạm Single Responsibility

---

### 2.4. Entity — Lớp ánh xạ bảng database

Entity giống như **bản thiết kế** cho 1 bảng trong database. Mỗi Entity class = 1 bảng, mỗi field = 1 cột.

#### BaseEntity — Class cha của TẤT CẢ entity

Mọi bảng trong CineX đều có các cột chung: id, version, trạng thái xóa, ai tạo, ai sửa, lúc nào. Thay vì copy-paste 7 field này vào 15 entity, ta tạo 1 class cha:

File `common/entity/BaseEntity.java`:

```java
@MappedSuperclass                                // JPA: class này KHÔNG tạo bảng riêng, chỉ cho kế thừa
@EntityListeners(AuditingEntityListener.class)   // Tự động ghi createdAt, updatedAt, createdBy, updatedBy
@Getter @Setter
public abstract class BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)   // Auto-increment (1, 2, 3, ...)
    private Long id;

    @Version                                               // Optimistic Lock: tránh 2 người sửa cùng lúc
    private Long version;

    @Enumerated(EnumType.STRING)                           // Lưu "ACTIVE"/"ARCHIVED" chữ (không phải số)
    @Column(name = "storage_state", length = 20)
    private StorageState storageState = StorageState.ACTIVE;   // Mặc định = ACTIVE

    @CreatedBy @Column(updatable = false)                  // Ai tạo (username), không cho sửa
    private String createdBy;

    @LastModifiedBy                                        // Ai sửa lần cuối
    private String updatedBy;

    @CreatedDate @Column(updatable = false)                // Tạo lúc nào
    private LocalDateTime createdAt;

    @LastModifiedDate                                      // Sửa lần cuối lúc nào
    private LocalDateTime updatedAt;
}
```

#### Entity con kế thừa BaseEntity

File `module/movie/entity/Movie.java`:

```java
@Entity                          // JPA: class này là entity, map với bảng DB
@Table(name = "movies")          // Bảng trong DB tên "movies"
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class Movie extends BaseEntity {    // Kế thừa: id, version, storageState, audit fields

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false)
    private Integer duration;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MovieStatus status;             // Enum: NOW_SHOWING, COMING_SOON, ENDED

    @ManyToMany(fetch = FetchType.LAZY)     // LAZY: không load genres ngay, chỉ load khi gọi getGenres()
    @JoinTable(name = "movie_genres",       // Bảng trung gian cho quan hệ N:N
            joinColumns = @JoinColumn(name = "movie_id"),
            inverseJoinColumns = @JoinColumn(name = "genre_id"))
    @Builder.Default
    private Set<Genre> genres = new HashSet<>();   // Set (không trùng), không phải List
}
```

**Tại sao Movie extends BaseEntity mà KHÔNG override bất kỳ method nào?**
→ Đây là nguyên tắc **Liskov Substitution** (chữ L trong SOLID): class con chỉ THÊM field/method, KHÔNG thay đổi hành vi của class cha. Movie thêm `title`, `duration`, ... nhưng `id`, `version`, `storageState` vẫn hoạt động y hệt BaseEntity.

---

## 3. Nguyên tắc SOLID — Áp dụng cụ thể trong CineX

SOLID là 5 nguyên tắc thiết kế giúp code dễ bảo trì, dễ mở rộng. Đây không phải lý thuyết suông — mỗi nguyên tắc đều được áp dụng thực tế trong CineX.

### 3.1. S — Single Responsibility (Mỗi class chỉ 1 trách nhiệm)

> "Một class chỉ nên có 1 lý do để thay đổi"

**Ví dụ đời thường:** Trong bệnh viện, bác sĩ khám bệnh, y tá tiêm thuốc, dược sĩ phát thuốc. Nếu 1 người làm cả 3 → sai sót, quá tải.

**Áp dụng trong CineX:**

| Layer | Trách nhiệm DUY NHẤT | File ví dụ |
|---|---|---|
| Controller | Nhận request → gọi service → trả response | `MovieController.java` |
| Service | Chứa business logic | `MovieService.java` |
| Repository | Truy vấn database | `MovieRepository.java` |
| Mapper | Chuyển Entity <-> DTO | `MovieMapper.java` |
| Specification | Build query WHERE động | `MovieSpecification.java` |
| SecurityService | Lấy thông tin user đang đăng nhập | `SecurityService.java` |

**Vi phạm thường gặp (ĐỪNG làm thế này):**

```java
// SAI: Controller chứa business logic
@PostMapping
public ApiResponse<MovieResponse> createMovie(@RequestBody MovieRequest request) {
    // Controller đang làm việc của Service!
    if (movieRepository.existsByTitle(request.getTitle())) {   // Gọi repository trực tiếp
        throw new BusinessException(ErrorCode.MOVIE_EXISTED);  // Logic kiểm tra
    }
    Movie movie = new Movie();
    movie.setTitle(request.getTitle());                        // Mapping thủ công
    movieRepository.save(movie);                               // Gọi repository trực tiếp
    return ApiResponse.ok(movie);                              // Trả entity thẳng (lộ field nhạy cảm)
}
```

```java
// ĐÚNG: Controller chỉ điều phối, logic nằm trong Service
@PostMapping
public ApiResponse<MovieResponse> createMovie(@Valid @RequestBody MovieRequest request) {
    return ApiResponse.ok("Movie created", movieService.createMovie(request));
}
```

### 3.2. O — Open/Closed (Mở để mở rộng, đóng để sửa đổi)

> "Thêm tính năng mới bằng cách TẠO code mới, KHÔNG SỬA code cũ"

**Ví dụ đời thường:** Ổ cắm điện — bạn muốn dùng thêm quạt → cắm vào ổ cắm, KHÔNG cần đục tường kéo dây mới.

**Áp dụng trong CineX — Thanh toán:**

Hiện tại CineX hỗ trợ: VNPay, MoMo, Tiền mặt. Muốn thêm ZaloPay:

```java
// ĐÚNG: Tạo class mới, KHÔNG sửa code cũ
// File mới: module/payment/processor/ZaloPayPaymentProcessor.java
@Component("ZALOPAY")
public class ZaloPayPaymentProcessor implements PaymentProcessor {
    @Override
    public String createPayment(String code, BigDecimal amount, String desc) { ... }
    @Override
    public boolean verifyCallback(Map<String, String> params) { ... }
}
// Done! PaymentProcessorFactory tự tìm thấy "ZALOPAY" vì Spring inject tự động.
// KHÔNG SỬA PaymentService, KHÔNG SỬA PaymentProcessorFactory.
```

```java
// SAI: Thêm ZaloPay bằng cách sửa code cũ (if-else)
public String createPayment(PaymentMethod method, ...) {
    if (method == VNPAY) { ... }
    else if (method == MOMO) { ... }
    else if (method == ZALOPAY) { ... }   // Sửa code cũ mỗi lần thêm → dễ bug
}
```

### 3.3. L — Liskov Substitution (Class con thay thế được class cha)

> "Mọi nơi dùng class cha đều có thể thay bằng class con mà không bị lỗi"

**Ví dụ đời thường:** Bạn có remote TV đa năng. Đổi từ Samsung sang LG → remote vẫn hoạt động (nút tắt vẫn tắt, nút tăng volume vẫn tăng).

**Áp dụng trong CineX:**

- `Movie extends BaseEntity`: Movie thêm field `title`, `duration`, ... nhưng KHÔNG override `getId()`, `getStorageState()`, ... Mọi code dùng `BaseEntity` đều hoạt động đúng với `Movie`.

- `PaymentProcessor` interface: `VNPayProcessor`, `MoMoProcessor`, `CashProcessor` — tất cả đều implement `createPayment()` và `verifyCallback()`. `PaymentService` gọi `processor.createPayment(...)` mà không cần biết đang dùng cổng nào.

### 3.4. I — Interface Segregation (Tách interface nhỏ)

> "Đừng ép class implement method mà nó không cần"

**Ví dụ đời thường:** Máy in 3-in-1 (in + scan + fax). Nếu bạn chỉ cần in, tại sao phải mua máy 3-in-1?

**Áp dụng trong CineX:**

- `MovieRepository` chỉ extends `JpaRepository` + `JpaSpecificationExecutor` — đúng 2 interface cần dùng, không thêm gì thừa.
- `PaymentProcessor` chỉ có 2 method: `createPayment()` và `verifyCallback()` — mỗi cổng thanh toán CHỈ CẦN implement 2 method này.

### 3.5. D — Dependency Inversion (Phụ thuộc vào abstraction, không phải implementation)

> "Module cấp cao không nên phụ thuộc module cấp thấp. Cả hai nên phụ thuộc vào abstraction."

**Ví dụ đời thường:** Bạn gọi xe qua Grab (abstraction). Bạn không cần biết tài xế tên gì, lái xe gì (implementation). Đổi tài xế → bạn vẫn được đón.

**Áp dụng trong CineX:**

```
Controller ──inject──> MovieService (class cụ thể, nhưng đây là abstraction layer cho business logic)
                            |
                            inject──> MovieRepository (interface — Spring tạo implementation tự động)
                            inject──> MovieMapper (interface — MapStruct tạo implementation lúc compile)
```

**Vi phạm thường gặp (ĐỪNG làm):**

```java
// SAI: Controller inject Repository trực tiếp → bỏ qua Service layer
@RestController
public class MovieController {
    private final MovieRepository movieRepository;   // Vi phạm D: Controller phụ thuộc Repository
}
```

```java
// ĐÚNG: Controller inject Service → Service inject Repository
@RestController
public class MovieController {
    private final MovieService movieService;         // Controller chỉ biết Service (abstraction)
}
```

---

## 4. Package by Feature — Tổ chức code theo tính năng

### Tại sao KHÔNG dùng Package by Layer?

Có 2 cách tổ chức code:

**Cách 1: Package by Layer (KHÔNG dùng)**
```
com.cinex/
├── controller/
│   ├── MovieController.java
│   ├── BookingController.java
│   ├── PaymentController.java
│   └── UserController.java
├── service/
│   ├── MovieService.java
│   ├── BookingService.java
│   ├── PaymentService.java
│   └── UserService.java
├── repository/
│   ├── MovieRepository.java
│   ├── BookingRepository.java
│   ├── PaymentRepository.java
│   └── UserRepository.java
└── entity/
    ├── Movie.java
    ├── Booking.java
    ├── Payment.java
    └── User.java
```

**Nhược điểm:** Khi sửa tính năng "Đặt vé", bạn phải nhảy qua 4 folder khác nhau (controller/, service/, repository/, entity/). Dự án lớn → mỗi folder có 20-30 file → tìm mệt.

**Cách 2: Package by Feature (CineX dùng cách này)**
```
com.cinex/
├── common/                  # Thành phần dùng chung
│   ├── config/              # Cấu hình: Security, CORS, Redis, OpenAPI, WebSocket
│   ├── entity/              # BaseEntity, StorageState, IdTracker
│   ├── exception/           # ErrorCode, BusinessException, GlobalExceptionHandler
│   ├── response/            # ApiResponse<T>, PageResponse<T>
│   ├── service/             # SecurityService, EmailService, FileUploadService
│   └── util/                # DateTimeUtil, MoneyUtil, StringUtil
├── security/                # JWT: JwtUtil, JwtAuthFilter, CustomUserDetailsService
└── module/                  # Mỗi tính năng = 1 package độc lập
    ├── movie/               # Tất cả code liên quan đến phim — NẰM 1 CHỖ
    │   ├── controller/      #   MovieController.java
    │   ├── service/         #   MovieService.java
    │   ├── repository/      #   MovieRepository.java
    │   ├── entity/          #   Movie.java, Genre.java, MovieStatus.java
    │   ├── dto/             #   MovieRequest.java, MovieResponse.java, MovieFilter.java
    │   ├── mapper/          #   MovieMapper.java
    │   └── specification/   #   MovieSpecification.java
    ├── booking/             # Tất cả code đặt vé
    ├── payment/             # Tất cả code thanh toán
    ├── showtime/            # Suất chiếu
    ├── room/                # Phòng chiếu
    ├── seat/                # Ghế ngồi
    ├── user/                # Quản lý user
    ├── auth/                # Đăng nhập, đăng ký
    ├── snack/               # Đồ ăn/uống
    ├── voucher/             # Mã giảm giá
    ├── review/              # Đánh giá phim
    ├── notification/        # Thông báo
    ├── favorite/            # Phim yêu thích
    ├── statistics/          # Thống kê/báo cáo
    ├── config/              # Cấu hình hệ thống (system_config)
    └── audit/               # Nhật ký hoạt động
```

**Ưu điểm:**
- Sửa tính năng "Phim" → chỉ cần mở folder `module/movie/` — mọi thứ liên quan nằm 1 chỗ
- Thêm module mới → copy cấu trúc `module/movie/`, đổi tên → xong
- Xóa module → xóa 1 folder, code khác không ảnh hưởng
- Dễ phân chia công việc trong team: "bạn A làm module movie, bạn B làm module booking"

---

## 5. Cross-cutting Concerns — Thành phần dùng chung

Cross-cutting concerns là những thứ MỌI module đều cần, nhưng không thuộc riêng module nào. Giống như hệ thống điện, nước, phòng cháy trong tòa nhà — mọi tầng đều cần, nhưng không thuộc riêng tầng nào.

### 5.1. ApiResponse<T> — Chuẩn hóa mọi response

**Vấn đề:** Nếu mỗi API trả format khác nhau, Frontend phải viết code xử lý riêng cho từng API.

**Giải pháp:** Mọi API đều trả cùng 1 format:

```json
// Thành công
{
  "success": true,
  "message": "Movie created",
  "data": { "id": 1, "title": "Avengers" },
  "timestamp": "2026-05-31T10:30:00Z"
}

// Lỗi
{
  "success": false,
  "message": "Không tìm thấy phim",
  "data": null,
  "timestamp": "2026-05-31T10:30:00Z"
}
```

Frontend chỉ cần check `response.success` → đúng thì dùng `response.data`, sai thì hiện `response.message`.

File `common/response/ApiResponse.java`:

```java
@Getter @Builder @AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)   // Nếu data = null → không gửi field "data" trong JSON
public class ApiResponse<T> {
    private boolean success;
    private String message;
    private T data;                          // T = generic: có thể là Movie, User, List<Booking>, ...
    @Builder.Default
    private Instant timestamp = Instant.now();

    // Factory methods — dùng thay vì constructor dài dòng
    public static <T> ApiResponse<T> ok(T data) { ... }
    public static <T> ApiResponse<T> ok(String message, T data) { ... }
    public static <T> ApiResponse<T> error(String message) { ... }
}
```

`PageResponse<T>` cũng tương tự — chuẩn hóa response phân trang:

```java
@Getter @Builder @AllArgsConstructor
public class PageResponse<T> {
    private List<T> content;       // Danh sách items trang hiện tại
    private int page;              // Trang hiện tại (bắt đầu từ 0)
    private int size;              // Số items mỗi trang
    private long totalElements;    // Tổng số items
    private int totalPages;        // Tổng số trang
    private boolean last;          // Có phải trang cuối không?

    // Chuyển từ Spring Page<T> sang PageResponse<T>
    public static <T> PageResponse<T> from(Page<T> page) { ... }
}
```

### 5.2. GlobalExceptionHandler + ErrorCode — Xử lý lỗi tập trung

**Vấn đề:** Nếu mỗi Controller tự try-catch → code lặp lại, format lỗi không thống nhất, có khi lộ stack trace cho client (bảo mật kém).

**Giải pháp:** 1 class duy nhất bắt TẤT CẢ exception trong toàn bộ ứng dụng:

File `common/exception/GlobalExceptionHandler.java`:

```java
@RestControllerAdvice     // Spring tự động bắt exception từ MỌI Controller
@Slf4j
public class GlobalExceptionHandler {

    // Lỗi nghiệp vụ (user gây ra): trả HTTP status tương ứng
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusinessException(BusinessException ex) {
        ErrorCode errorCode = ex.getErrorCode();
        return ResponseEntity
                .status(errorCode.getHttpStatus())           // 400, 404, 409, ...
                .body(ApiResponse.error(ex.getMessage()));   // Message tiếng Việt
    }

    // Lỗi validation (DTO không hợp lệ): trả 400 + chi tiết field nào sai
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                .reduce((a, b) -> a + "; " + b)
                .orElse("Validation failed");
        return ResponseEntity.badRequest().body(ApiResponse.error(message));
    }

    // Lỗi hệ thống (bug, DB down, ...): log stack trace + trả 500 generic message
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGeneral(Exception ex) {
        log.error("Unexpected error", ex);     // Log đầy đủ stack trace cho developer debug
        return ResponseEntity.status(500)
                .body(ApiResponse.error("Đã xảy ra lỗi không mong muốn"));   // Client chỉ thấy message chung
        // KHÔNG BAO GIỜ trả stack trace cho client → lộ code, lộ thông tin DB
    }
}
```

File `common/exception/ErrorCode.java` — Enum quản lý tất cả mã lỗi:

```java
@Getter @RequiredArgsConstructor
public enum ErrorCode {
    UNCATEGORIZED     (9999, "Đã xảy ra lỗi không mong muốn",         HttpStatus.INTERNAL_SERVER_ERROR),
    INVALID_REQUEST   (1000, "Yêu cầu không hợp lệ",                   HttpStatus.BAD_REQUEST),
    UNAUTHORIZED      (1001, "Chưa đăng nhập",                          HttpStatus.UNAUTHORIZED),
    USER_NOT_FOUND    (1005, "Không tìm thấy người dùng",              HttpStatus.NOT_FOUND),
    MOVIE_NOT_FOUND   (2003, "Không tìm thấy phim",                    HttpStatus.NOT_FOUND),
    SEAT_ALREADY_BOOKED(5003, "Ghế đã được đặt hoặc đang giữ",        HttpStatus.CONFLICT),
    // ... thêm lỗi mới → thêm 1 dòng vào đây, không sửa code khác
    ;
    private final int code;
    private final String message;
    private final HttpStatus httpStatus;
}
```

### 5.3. BaseEntity — Audit, Version, Soft Delete

Đã giải thích chi tiết ở mục 2.4. Tóm tắt 3 tính năng quan trọng:

| Tính năng | Field | Giải thích |
|---|---|---|
| **Audit** | `createdBy`, `updatedBy`, `createdAt`, `updatedAt` | Tự động ghi ai tạo/sửa, lúc nào. Dùng `@CreatedDate`, `@LastModifiedDate` + `AuditingEntityListener` |
| **Optimistic Lock** | `version` | Khi 2 admin cùng sửa 1 phim, version giúp phát hiện xung đột. Người save sau sẽ bị lỗi `OptimisticLockException` thay vì ghi đè mất data |
| **Soft Delete** | `storageState` | Xóa mềm: đổi trạng thái sang `ARCHIVED`, KHÔNG xóa thật khỏi DB. Có thể khôi phục bất kỳ lúc nào |

### 5.4. SecurityService — Abstraction cho xác thực

Controller cần biết "ai đang gọi API này" nhưng KHÔNG nên gọi `UserRepository` trực tiếp (vi phạm Dependency Inversion). Giải pháp: tạo `SecurityService` làm trung gian:

```java
@Service
@RequiredArgsConstructor
public class SecurityService {
    private final UserRepository userRepository;

    public Long getCurrentUserId() { ... }       // Lấy userId đang đăng nhập
    public User getCurrentUser() { ... }          // Lấy User entity đang đăng nhập
    public Long getCurrentUserIdOrNull() { ... }  // Lấy userId hoặc null (cho API public)
}
```

Bất kỳ Service nào cần biết user hiện tại → inject `SecurityService`, KHÔNG inject `UserRepository`.

---

## 6. Design Patterns — Tổng hợp 20 Patterns đã áp dụng

### Nhóm Creational (Tạo đối tượng)

| # | Pattern | Giải thích | File áp dụng |
|---|---|---|---|
| 1 | **Builder** | Tạo object phức tạp bằng cách gọi `.field1().field2().build()` thay vì constructor 10 tham số. Lombok `@Builder` tự sinh code. | `ApiResponse.java`, `Movie.java`, `User.java` |
| 2 | **Factory** | `PaymentProcessorFactory` nhận `PaymentMethod` (VNPAY/MOMO/CASH) → trả đúng processor tương ứng. Spring tự inject Map<String, PaymentProcessor>. | `payment/processor/PaymentProcessorFactory.java` |
| 3 | **Singleton** | Mỗi Spring Bean mặc định là singleton — chỉ có 1 instance duy nhất trong toàn app. `MovieService`, `MovieRepository`, ... đều là singleton. | Tất cả `@Service`, `@Component`, `@Repository` |

### Nhóm Structural (Cấu trúc)

| # | Pattern | Giải thích | File áp dụng |
|---|---|---|---|
| 4 | **DTO (Data Transfer Object)** | Tách biệt data gửi/nhận với entity. `MovieRequest` (input) không có `id`, `MovieResponse` (output) không có `password`. Entity không bao giờ lộ ra client. | `module/*/dto/` |
| 5 | **Facade/Wrapper** | `ApiResponse<T>` bọc mọi response trong 1 format chuẩn. Client chỉ cần check `success` là biết thành công hay thất bại — không cần hiểu cấu trúc bên trong. | `common/response/ApiResponse.java` |
| 6 | **Repository** | Interface trừu tượng hóa truy vấn DB. Service gọi `movieRepository.findById()` — không cần biết bên dưới là SQL Server, PostgreSQL hay Oracle. | `module/*/repository/` |
| 7 | **Mapper (MapStruct)** | Interface khai báo `toResponse(Entity)` → MapStruct TỰ SINH code chuyển đổi lúc compile. Nhanh hơn reflection (ModelMapper), an toàn hơn viết tay (không quên field). | `module/*/mapper/` |
| 8 | **Inheritance (BaseEntity)** | Class cha chứa 7 field dùng chung (id, version, audit, ...). 15 entity con kế thừa → không copy-paste, sửa 1 chỗ thì tất cả được cập nhật. | `common/entity/BaseEntity.java` |

### Nhóm Behavioral (Hành vi)

| # | Pattern | Giải thích | File áp dụng |
|---|---|---|---|
| 9 | **Strategy** | `PaymentProcessor` interface — mỗi cổng thanh toán implement logic khác nhau. `PaymentService` gọi cùng interface, không biết/quan tâm đang dùng cổng nào. | `payment/processor/PaymentProcessor.java` |
| 10 | **Observer (Spring Events)** | Khi thanh toán thành công, `PaymentService` publish `PaymentCompletedEvent`. `PaymentEventListener` lắng nghe → gửi email + tạo notification. Thêm hành động mới → thêm listener, KHÔNG sửa `PaymentService`. | `payment/event/PaymentCompletedEvent.java`, `payment/listener/PaymentEventListener.java` |
| 11 | **State Machine** | Booking có trạng thái: `HOLDING → CONFIRMED → CHECKED_IN`. Không thể nhảy từ `HOLDING` sang `CHECKED_IN` (phải qua `CONFIRMED` trước). Mỗi trạng thái chỉ cho phép chuyển sang một số trạng thái nhất định. | `booking/entity/BookingStatus.java` |
| 12 | **Specification** | Build query WHERE động: nếu user search theo tên → thêm `WHERE title LIKE`, nếu filter theo thể loại → thêm `JOIN genres`. Ghép tùy ý bằng `.and()`, `.or()`. | `module/*/specification/` |
| 13 | **Chain of Responsibility (Filter)** | `JwtAuthFilter` chạy TRƯỚC mọi request → kiểm tra JWT token → set SecurityContext. Controller không cần viết code auth. Có thể thêm filter mới (rate limit, logging) mà không sửa filter cũ. | `security/JwtAuthFilter.java` |
| 14 | **Template Method** | `BaseEntity` định nghĩa "khung" cho mọi entity (id, audit, ...). Entity con chỉ thêm field riêng. Lifecycle (create → audit → save) do framework quản lý theo template cố định. | `common/entity/BaseEntity.java` |

### Nhóm khác (Infrastructure / Cross-cutting)

| # | Pattern | Giải thích | File áp dụng |
|---|---|---|---|
| 15 | **Soft Delete** | Xóa = đổi `storageState` sang `ARCHIVED`, KHÔNG `DELETE FROM` thật. Data vẫn còn trong DB, có thể khôi phục. Mọi query list đều filter `WHERE storageState != 'ARCHIVED'`. | `BaseEntity.storageState`, `StorageState.java` |
| 16 | **Sequence (IdTracker)** | Sinh mã code tự động: `BK-20260531-001`, `USR-002`. Dùng bảng `id_tracker` lưu số hiện tại → mỗi lần gọi `nextCode()` tăng lên 1. Thread-safe nhờ `@Transactional`. | `common/entity/tracker/IdTrackerService.java` |
| 17 | **Scheduled Task** | `BookingCleanupScheduler` chạy mỗi 60 giây → tìm booking `HOLDING` quá 10 phút → chuyển sang `EXPIRED`. Giống nhân viên đi kiểm tra ghế đã hold quá lâu. | `booking/service/BookingCleanupScheduler.java` |
| 18 | **Config Table** | Bảng `system_config` lưu cấu hình động (hold_minutes, max_seats). Admin có thể đổi mà không cần restart server. `SystemConfigService` cache trong `ConcurrentHashMap` để đọc nhanh. | `config/service/SystemConfigService.java` |
| 19 | **Method Security** | `@PreAuthorize("hasRole('ADMIN')")` trên method → Spring kiểm tra role trước khi gọi method. Nếu user không phải ADMIN → trả 403 Forbidden mà code trong method không chạy. | `MovieController.java`, `RoomController.java` |
| 20 | **Enum Type-safe** | `BookingStatus`, `PaymentMethod`, `MovieStatus`, `Role`, `ErrorCode` — tất cả dùng enum thay vì String. Nếu viết sai tên → compile error ngay (thay vì runtime bug khó tìm). | `module/*/entity/` |

---

## 7. So sánh: Code KHÔNG theo kiến trúc vs CÓ kiến trúc

### Ví dụ 1: API tạo phim

**TRƯỚC — Không theo kiến trúc (tất cả nhét vào Controller):**

```java
@PostMapping("/api/movies")
public Map<String, Object> createMovie(@RequestBody Map<String, Object> body) {
    // Controller đang làm quá nhiều thứ:
    String title = (String) body.get("title");                     // Parse thủ công, không type-safe
    if (title == null || title.isEmpty()) {                         // Validation thủ công
        Map<String, Object> error = new HashMap<>();
        error.put("error", "Title is required");
        return error;                                               // Format response không thống nhất
    }

    // Gọi repository trực tiếp trong controller
    Movie movie = new Movie();
    movie.setTitle(title);
    movie.setDuration((Integer) body.get("duration"));              // Có thể ClassCastException
    movie.setStorageState(StorageState.ACTIVE);                     // Logic nghiệp vụ trong controller
    movie.setCreatedAt(LocalDateTime.now());                        // Audit thủ công, dễ quên
    entityManager.persist(movie);                                    // Gọi EntityManager trực tiếp

    Map<String, Object> result = new HashMap<>();                   // Response format khác với API khác
    result.put("id", movie.getId());
    result.put("title", movie.getTitle());
    result.put("password", movie.getCreatedBy());                   // Có thể vô tình trả field nhạy cảm
    return result;
}
```

**Vấn đề:**
- 1 method làm 5 việc: parse, validate, logic, query DB, format response
- Không có error handling thống nhất
- Response format khác nhau giữa các API
- Dễ lộ field nhạy cảm (trả entity thẳng)
- Không có audit tự động
- Test cực kỳ khó (phải mock HTTP request)

**SAU — Có kiến trúc (5 file, mỗi file 1 trách nhiệm):**

```java
// 1. DTO: Khai báo input + validation (MovieRequest.java)
public class MovieRequest {
    @NotBlank(message = "Tên phim không được trống")
    private String title;
    @Min(value = 1, message = "Thời lượng phải > 0")
    private Integer duration;
}

// 2. Controller: Chỉ điều phối (MovieController.java)
@PostMapping
@PreAuthorize("hasRole('ADMIN')")
public ApiResponse<MovieResponse> createMovie(@Valid @RequestBody MovieRequest request) {
    return ApiResponse.ok("Movie created", movieService.createMovie(request));
}

// 3. Service: Business logic (MovieService.java)
@Transactional
public MovieResponse createMovie(MovieRequest request) {
    Movie movie = Movie.builder()
            .title(request.getTitle())
            .duration(request.getDuration())
            .build();                              // BaseEntity tự set storageState, audit
    movie = movieRepository.save(movie);
    return movieMapper.toResponse(movie);          // Mapper chỉ trả field an toàn
}

// 4. Repository: Truy vấn DB (MovieRepository.java)
public interface MovieRepository extends JpaRepository<Movie, Long> {}

// 5. Mapper: Chuyển đổi an toàn (MovieMapper.java)
@Mapper(componentModel = "spring")
public interface MovieMapper {
    MovieResponse toResponse(Movie movie);         // Chỉ map field trong MovieResponse, bỏ field nhạy cảm
}
```

**Ưu điểm:**
- Mỗi file 1 trách nhiệm → dễ đọc, dễ sửa, dễ test
- Validation tự động (`@Valid` + annotation trên DTO)
- Error handling tự động (GlobalExceptionHandler bắt mọi exception)
- Response format thống nhất (ApiResponse)
- Audit tự động (BaseEntity + AuditingEntityListener)
- Không lộ field nhạy cảm (Mapper chỉ map field cần thiết)

### Ví dụ 2: Xử lý thanh toán

**TRƯỚC — if-else cho mỗi cổng thanh toán:**

```java
public String processPayment(String method, BigDecimal amount) {
    if (method.equals("VNPAY")) {
        // 50 dòng code VNPay...
    } else if (method.equals("MOMO")) {
        // 50 dòng code MoMo...
    } else if (method.equals("CASH")) {
        // 30 dòng code Cash...
    }
    // Thêm ZaloPay → sửa file này → 200 dòng → 1 file khổng lồ
    // Ai đó sửa MoMo → có thể vô tình ảnh hưởng VNPay (cùng file)
}
```

**SAU — Strategy + Factory pattern:**

```java
// Interface (PaymentProcessor.java) — 2 method, clean
public interface PaymentProcessor {
    String createPayment(String code, BigDecimal amount, String desc);
    boolean verifyCallback(Map<String, String> params);
}

// Mỗi cổng = 1 file riêng, không ảnh hưởng nhau
@Component("VNPAY")  public class VNPayProcessor implements PaymentProcessor { ... }
@Component("MOMO")   public class MoMoProcessor implements PaymentProcessor { ... }
@Component("CASH")   public class CashProcessor implements PaymentProcessor { ... }

// Factory tự tìm đúng processor
@Component
public class PaymentProcessorFactory {
    private final Map<String, PaymentProcessor> processors;  // Spring inject tự động
    public PaymentProcessor getProcessor(PaymentMethod method) {
        return processors.get(method.name());                 // VNPAY → VNPayProcessor
    }
}

// Service gọi: không cần biết cổng nào
PaymentProcessor processor = factory.getProcessor(paymentMethod);
String url = processor.createPayment(code, amount, desc);

// Thêm ZaloPay → tạo 1 file mới ZaloPayProcessor.java → DONE, KHÔNG sửa code cũ
```

---

## 8. Frontend Architecture

### Tổng quan

```
frontend/src/
├── api/axios.ts                     # HTTP client + JWT interceptor (tự gắn token vào mọi request)
├── features/                        # Trang theo module (admin/movies, admin/rooms, ...)
├── components/                      # Component dùng chung (ConfirmDialog, StatusDropdown, ...)
├── hooks/                           # Custom hooks — TẤT CẢ API call nằm ở đây
│   ├── useAdmin.ts                  # Barrel file: re-export từ các domain hooks
│   ├── useAdminMovies.ts            # Query/mutation cho Movie
│   ├── useAdminRooms.ts             # Query/mutation cho Room
│   └── ...
├── store/                           # Zustand stores (global state)
├── routes/                          # React Router config
├── types/                           # TypeScript types/interfaces
└── utils/                           # Utility functions
    ├── labels.ts                    # fmtDate(), fmtDateTime(), format tiền VNĐ
    └── colors.ts                    # Màu sắc theo trạng thái (ACTIVE → xanh, CANCELLED → đỏ)
```

### Luồng dữ liệu Frontend

```
  Page Component          Hook (useAdminMovies)        API (axios)         Backend
       |                        |                         |                   |
       | gọi useMovies()        |                         |                   |
       +----------------------->|                         |                   |
       |                        | useQuery("movies", ...) |                   |
       |                        +------------------------>|                   |
       |                        |                         | GET /api/movies   |
       |                        |                         +------------------>|
       |                        |                         |<--- JSON ---------|
       |                        |<--- data, isLoading ----|                   |
       |<--- render data -------|                         |                   |
```

**Quy tắc Frontend:**
- Page component KHÔNG gọi `api.get()` trực tiếp → phải qua hooks
- Hook file quản lý 1 domain: `useAdminMovies.ts` chỉ có API liên quan phim
- Màu sắc, format ngày/tiền → import từ `utils/`, KHÔNG viết inline
- Component > 300 dòng → tách dialog, form thành component riêng

---

## 9. Database Migration với Liquibase

### Tại sao không dùng `ddl-auto=update`?

| | `ddl-auto=update` | Liquibase |
|---|---|---|
| Tự tạo bảng | Co, nhung co the xoa cot, mat data | Co, qua changelog XML ro rang |
| Track lich su | Khong | Co (bang `DATABASECHANGELOG`) |
| Rollback | Khong | Co |
| Team nhieu dev | De conflict | Moi dev tao file changelog rieng |
| Production | **KHONG AN TOAN** | An toan, kiem soat duoc |

### Cach hoat dong

1. Khi Backend start → Liquibase doc `db.changelog-master.xml`
2. So sanh voi bang `DATABASECHANGELOG` trong DB (da chay nhung changeset nao?)
3. Chay cac changeset **chua chay** → tao/sua bang
4. Ghi lai vao `DATABASECHANGELOG`

### Them bang moi

1. Tao file `db/changelog/changes/002-create-xxx-table.xml`
2. Them dong `<include file="...002..."/>` vao `db.changelog-master.xml`
3. Restart Backend → Liquibase tu chay

---

## 10. Authentication Flow (Luong xac thuc)

### Dang nhap

```
Client                          Backend
  |                                |
  +-- POST /api/auth/login ------->|
  |   { username, password }       |
  |                                +-- Tim user trong DB
  |                                +-- BCrypt.matches(password, hash)
  |                                +-- Neu dung -> JwtUtil.generateToken(username)
  |<--- { token: "eyJ..." } ------+
  |                                |
  +-- Luu token vao localStorage   |
```

### Goi API co xac thuc

```
Client                          Backend
  |                                |
  +-- GET /api/movies ------------>|  Header: Authorization: Bearer eyJ...
  |                                |
  |                                +-- JwtAuthFilter:
  |                                |   1. Lay token tu header "Authorization"
  |                                |   2. jwtUtil.extractUsername(token)
  |                                |   3. userDetailsService.loadByUsername(username)
  |                                |   4. jwtUtil.isTokenValid(token, username)
  |                                |   5. Set SecurityContext (da xac thuc)
  |                                |
  |                                +-- Controller xu ly request binh thuong
  |<--- { success: true, data } ---+
```

**JWT (JSON Web Token) la gi?**
Tuong tuong JWT nhu the can cuoc cong dan: khi ban vao toa nha, bao ve kiem tra the → xac dinh ban la ai, co quyen vao khong. The nay do cong an cap (server tao token), bao ve chi kiem tra (verify), khong can goi dien hoi cong an moi lan.

---

## 11. Cau hoi tu kiem tra

Sau khi doc xong tai lieu, hay tu tra loi cac cau hoi sau:

1. **Controller co nen goi Repository truc tiep khong? Tai sao?**
   → Khong. Vi bo qua Service = bo qua business logic (validation, authorization, ...).

2. **Neu bo `@Transactional` khoi method `createBooking()` (hold 3 ghe), ghe thu 3 loi thi dieu gi xay ra?**
   → 2 ghe dau da luu vao DB, ghe thu 3 loi → data khong nhat quan. Voi `@Transactional` → ca 3 rollback.

3. **Tai sao dung `ApiResponse<T>` boc moi response thay vi tra entity thang?**
   → (1) Format thong nhat cho FE, (2) Khong lo field nhay cam (password, ...), (3) Them metadata (success, message, timestamp).

4. **Them cong thanh toan ZaloPay can sua nhung file nao?**
   → Chi tao 1 file moi `ZaloPayPaymentProcessor.java` implement `PaymentProcessor`. KHONG sua bat ky file nao khac (Open/Closed Principle).

5. **Tai sao CineX to chuc code theo module/ (Package by Feature) thay vi controller/, service/ (Package by Layer)?**
   → Khi sua tinh nang "Phim" → moi file lien quan nam trong `module/movie/` → de tim, de sua. Package by Layer phai nhay qua 4-5 folder khac nhau.

6. **`@Version` trong BaseEntity dung de lam gi?**
   → Optimistic Locking: khi 2 admin cung sua 1 phim, nguoi save sau se bi loi (version khong khop) thay vi ghi de mat data cua nguoi save truoc.

7. **Tai sao `BookingCleanupScheduler` can thiet? Neu khong co thi sao?**
   → Ghe se bi "hold" vinh vien: user chon ghe nhung khong thanh toan → ghe bi khoa → khong ai dat duoc → mat doanh thu.
