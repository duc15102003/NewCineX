# Từ điển thuật ngữ CineX

Sắp xếp A-Z. Gặp thuật ngữ lạ → tra ở đây.

## A

| Thuật ngữ | Giải thích | Ví dụ trong CineX |
|---|---|---|
| **ACID** | 4 tính chất transaction: Atomicity (tất cả hoặc không), Consistency (dữ liệu luôn hợp lệ), Isolation (transaction không ảnh hưởng nhau), Durability (commit rồi không mất) | Hold 3 ghế: nếu ghế thứ 3 lỗi → rollback cả 3 (Atomicity) |
| **AOP** | Aspect-Oriented Programming — tách logic cắt ngang (logging, security) ra khỏi business logic | AuditLogService ghi log thay đổi entity |
| **API** | Application Programming Interface — giao diện để 2 hệ thống nói chuyện | FE gọi `GET /api/movies` → BE trả JSON |
| **Authentication** | Xác thực — "bạn là AI?" | Login bằng username/password → nhận JWT token |
| **Authorization** | Phân quyền — "bạn được phép làm gì?" | @PreAuthorize("hasRole('ADMIN')") |

## B

| Thuật ngữ | Giải thích | Ví dụ trong CineX |
|---|---|---|
| **Base64** | Mã hóa binary thành text (không phải encryption) | QR code ảnh PNG → Base64 string → FE hiển thị `<img src="data:image/png;base64,...">` |
| **BCrypt** | Thuật toán hash password 1 chiều, có salt + cost factor | "123456" → "$2a$10$N9qo8uLOi..." (không giải ngược được) |
| **Bean** | Object được Spring quản lý (tạo, inject, destroy) | @Service, @Repository, @Component đều là Bean |
| **Builder Pattern** | Tạo object phức tạp từng bước, rõ ràng hơn constructor | `Movie.builder().title("Avengers").duration(150).build()` |

## C

| Thuật ngữ | Giải thích | Ví dụ trong CineX |
|---|---|---|
| **Cache** | Bản copy dữ liệu ở nơi truy cập nhanh (RAM), tránh query DB mỗi lần | SystemConfigService dùng ConcurrentHashMap cache config |
| **Cache-aside** | Pattern: đọc cache trước → miss thì đọc DB → lưu cache | SystemConfigService.getInt("booking.max_seats", 8) |
| **CDN** | Content Delivery Network — mạng server phân tán, serve file tĩnh nhanh | Cloudinary có CDN → ảnh load nhanh toàn cầu |
| **Changeset** | 1 thay đổi DB trong Liquibase (tạo bảng, thêm cột, ...) | `001-create-users-table.xml` |
| **Container** | Docker: instance đang chạy từ image | `cinex-sqlserver-1` = container SQL Server |
| **CORS** | Cross-Origin Resource Sharing — cho phép FE (port 5173) gọi BE (port 8088) | SecurityConfig cho phép localhost:5173 |
| **CSRF** | Cross-Site Request Forgery — tấn công giả mạo request. Tắt khi dùng JWT (stateless) | `csrf(AbstractHttpConfigurer::disable)` |

## D

| Thuật ngữ | Giải thích | Ví dụ trong CineX |
|---|---|---|
| **DAO** | Data Access Object — tương tự Repository | UserRepository là DAO cho bảng users |
| **Dependency Injection** | Framework tự truyền dependency vào, không cần `new` thủ công | Constructor injection: `RequiredArgsConstructor` |
| **DTO** | Data Transfer Object — object chỉ chứa data, tách biệt entity với API response | MovieResponse (trả cho client) vs Movie (entity DB) |

## E-F

| Thuật ngữ | Giải thích | Ví dụ trong CineX |
|---|---|---|
| **Entity** | Object Java map với 1 bảng trong DB | `@Entity class Movie` → bảng `movies` |
| **Enum** | Tập hợp hằng số có tên — type-safe, compile-time check | `MovieStatus.NOW_SHOWING` thay vì String "NOW_SHOWING" |
| **Eager Loading** | Load quan hệ NGAY khi query entity chính → có thể gây N+1 | `@ManyToOne(fetch = EAGER)` — TRÁNH dùng |
| **Factory Pattern** | Class chuyên tạo object đúng loại theo input | PaymentProcessorFactory.getProcessor("VNPAY") |
| **FK** | Foreign Key — khóa ngoại, liên kết 2 bảng | `seats.room_id` → `rooms.id` |
| **Filter DTO** | Object chứa các tham số search/filter, type-safe | `MovieFilter { keyword, status, genreId, includeDeleted }` |

## G-H

| Thuật ngữ | Giải thích | Ví dụ trong CineX |
|---|---|---|
| **Hash** | Chuyển data thành chuỗi cố định, 1 chiều (không giải ngược) | BCrypt hash password |
| **Hibernate** | Implementation của JPA — ORM framework | Tự sinh SQL từ Java method `findByUsername()` |
| **Hook** | FE: function chạy trong lifecycle component | `useState`, `useEffect`, `useQuery` |

## I-J

| Thuật ngữ | Giải thích | Ví dụ trong CineX |
|---|---|---|
| **Image** | Docker: file read-only chứa OS + app, bản thiết kế | `mcr.microsoft.com/mssql/server:2022-latest` |
| **Index** | DB: cấu trúc giúp tìm kiếm nhanh (như mục lục sách) | `idx_bookings_user_id` trên cột user_id |
| **IoC** | Inversion of Control — framework quản lý object, không phải dev | Spring Container tạo + inject Bean |
| **JPA** | Java Persistence API — chuẩn ORM cho Java | `@Entity`, `@ManyToOne`, `@Query` |
| **JPQL** | JPA Query Language — SQL cho entity (dùng tên class, không tên bảng) | `SELECT m FROM Movie m WHERE m.title LIKE :keyword` |
| **JSON** | JavaScript Object Notation — format data phổ biến cho API | `{"username": "vanan", "role": "USER"}` |
| **JWT** | JSON Web Token — token xác thực stateless, 3 phần: Header.Payload.Signature | `eyJhbGci...` gửi trong header `Authorization: Bearer ...` |

## L-M

| Thuật ngữ | Giải thích | Ví dụ trong CineX |
|---|---|---|
| **Lazy Loading** | Chỉ load quan hệ khi GỌI getter, không load sẵn | `@ManyToOne(fetch = LAZY)` — mặc định nên dùng |
| **Liquibase** | Quản lý version cho DB schema (bảng, cột, index) | `001-create-users-table.xml` → tự chạy khi start |
| **MapStruct** | Thư viện tự sinh code mapping entity ↔ DTO lúc compile | `UserMapper.toProfileResponse(user)` |
| **ManyToOne** | Quan hệ nhiều-một: nhiều Seat thuộc 1 Room | `@ManyToOne Room room` trong Seat entity |
| **ManyToMany** | Quan hệ nhiều-nhiều: Movie ↔ Genre qua bảng join | `movie_genres` join table |
| **Middleware** | Code chạy giữa request và response | JwtAuthFilter = middleware kiểm tra token |
| **Migration** | Thay đổi DB schema có version control | Liquibase changeset |
| **Multipart** | HTTP: gửi file upload (không phải JSON) | `Content-Type: multipart/form-data` cho upload avatar |

## N-O

| Thuật ngữ | Giải thích | Ví dụ trong CineX |
|---|---|---|
| **N+1 Problem** | Query 1 lần lấy list → N lần lấy quan hệ cho mỗi item | List 20 phim + EAGER genre → 1 + 20 = 21 queries |
| **ORM** | Object-Relational Mapping — map Java object ↔ DB table | Hibernate: `Movie.java` ↔ bảng `movies` |
| **Optimistic Lock** | Kiểm tra version khi save — nếu version đổi → lỗi conflict | `@Version Long version` trong BaseEntity |

## P-Q

| Thuật ngữ | Giải thích | Ví dụ trong CineX |
|---|---|---|
| **Pagination** | Chia kết quả thành trang (page 0, size 20) | `GET /api/movies?page=0&size=20` → PageResponse |
| **Pessimistic Lock** | Lock row DB khi đọc — thread khác phải chờ | `@Lock(PESSIMISTIC_WRITE)` khi hold ghế |
| **PK** | Primary Key — khóa chính, unique + not null | `id BIGINT IDENTITY` |

## R-S

| Thuật ngữ | Giải thích | Ví dụ trong CineX |
|---|---|---|
| **REST** | Representational State Transfer — kiến trúc API dùng HTTP methods | GET (đọc), POST (tạo), PUT (sửa), DELETE (xóa) |
| **Rollback** | Hoàn tác transaction — như chưa có gì xảy ra | Hold ghế lỗi → rollback → ghế trống lại |
| **Salt** | Chuỗi random thêm vào password trước khi hash → cùng password ra hash khác nhau | BCrypt tự sinh salt mỗi lần hash |
| **Singleton** | 1 class chỉ có 1 instance duy nhất | Spring Bean mặc định là Singleton |
| **Soft Delete** | Xóa mềm: set `storageState = "DELETED"`, data vẫn trong DB | Xóa phim → `storageState = "DELETED"` → khôi phục được |
| **SPA** | Single Page Application — FE chỉ có 1 file HTML, JS render nội dung | React app: `index.html` + JS bundle |
| **Specification** | JPA: build query WHERE động, ghép filter tùy ý | `MovieSpecification.fromFilter(filter)` |
| **Stateless** | Server KHÔNG lưu session — mỗi request tự gửi token | JWT authentication = stateless |

## T-V

| Thuật ngữ | Giải thích | Ví dụ trong CineX |
|---|---|---|
| **ThreadLocal** | Java: mỗi thread có bản copy riêng của biến | SecurityContextHolder dùng ThreadLocal → mỗi request biết user là ai |
| **Transaction** | Nhóm operations chạy cùng nhau: tất cả thành công hoặc tất cả rollback | `@Transactional` trên Service methods |
| **TTL** | Time To Live — thời gian cache/token hết hạn | Access token TTL = 15 phút |
| **Volume** | Docker: ổ cứng ảo ngoài container, giữ data khi container xóa | `sqlserver-data` volume giữ database files |
