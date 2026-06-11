# Từ điển thuật ngữ CineX

> **Sắp xếp A-Z.** Gặp thuật ngữ lạ → tra ở đây.
> Term có biểu tượng **⚠️** = thuật ngữ HAY gây bug — đọc kỹ.
> Mỗi entry có **💡 Cách nhớ nhanh** cho thuật ngữ phức tạp.

---

## 🆘 SOS Cheatsheet — 12 thuật ngữ HAY gặp khi DEBUG

Khi gặp bug, 80% trường hợp là 1 trong 12 thuật ngữ này. Đọc kỹ trước, đỡ mất giờ tra Google.

| Khi nào gặp | Thuật ngữ | Tra sâu |
|---|---|---|
| Lỗi `LazyInitializationException` | [Lazy Loading](#l-m), [Session](#r-s) | [backend/15](backend/15-common-pitfalls.md) |
| Query nhiều bất thường (10s mới ra) | [N+1 Problem](#n-o) | [database/01](database/01-database-techniques.md) |
| FE gọi BE bị block CORS | [CORS](#c) | [backend/03](backend/03-security.md) |
| 2 user cùng đặt 1 ghế | [Race Condition](#r-s), [Pessimistic Lock](#p-q) | [module-guides/09](module-guides/09-booking-explained.md) |
| `@Transactional` không chạy | [Self-Invocation](#r-s), [Proxy](#p-q) | [backend/15](backend/15-common-pitfalls.md) |
| `useEffect` không thấy giá trị mới | [Stale Closure](#r-s) | [frontend/15](frontend/15-react-pitfalls.md) |
| Component render 2 lần (dev mode) | [Strict Mode](#r-s) | [frontend/15](frontend/15-react-pitfalls.md) |
| MoMo callback không khớp | [HMAC](#g-h), [IPN](#i-j), [Idempotent](#i-j) | [module-guides/10](module-guides/10-payment-explained.md) |
| App vừa khởi động bị crash | [Circular Dependency](#c) | [backend/15](backend/15-common-pitfalls.md) |
| `@PreAuthorize` không chặn được | [Method Security](#l-m) | [backend/03](backend/03-security.md) |
| Redis cache đang ấm bỗng cold | [Cache Stampede](#c) | [backend/08](backend/08-redis.md) |
| Tailwind class biến mất khi build prod | [Dynamic Class](#d) | [frontend/15](frontend/15-react-pitfalls.md) |

---

## 📚 Từ điển A-Z

## A

| Thuật ngữ | Giải thích | Ví dụ trong CineX |
|---|---|---|
| **ACID** | 4 tính chất transaction: **A**tomicity (tất cả hoặc không), **C**onsistency (dữ liệu luôn hợp lệ), **I**solation (transaction không ảnh hưởng nhau), **D**urability (commit rồi không mất). **💡 Nhớ:** "Tất cả xong hoặc tất cả roll lại." | Hold 3 ghế: nếu ghế thứ 3 lỗi → rollback cả 3 (Atomicity) |
| **AOP** | Aspect-Oriented Programming — tách logic cắt ngang (logging, security, transaction) ra khỏi business logic, dùng **Proxy** bọc method gốc. **💡 Nhớ:** "Đeo áo choàng cho method." | `@Transactional`, `@PreAuthorize`, AuditLogService |
| **API** | Application Programming Interface — giao diện để 2 hệ thống nói chuyện | FE gọi `GET /api/movies` → BE trả JSON |
| **Atomicity** | Tất cả thao tác trong transaction phải thành công, nếu 1 cái lỗi → rollback toàn bộ | Hold 3 ghế: ghế #3 lỗi → ghế #1 & #2 cũng được trả lại |
| **Authentication** | Xác thực — "**bạn là AI?**" | Login bằng username/password → nhận JWT token |
| **Authorization** | Phân quyền — "**bạn được phép làm gì?**" | `@PreAuthorize("hasRole('ADMIN')")` |

## B

| Thuật ngữ | Giải thích | Ví dụ trong CineX |
|---|---|---|
| **B-tree** | Cấu trúc index DB: cây cân bằng, search/insert/delete O(log n). **💡 Nhớ:** "Mục lục sách: tra Z là biết ngay trang 999, không cần đọc từ đầu." | Mọi index trong CineX dùng B-tree (mặc định SQL Server) |
| **Base64** | Mã hóa binary → text (KHÔNG phải encryption — ai cũng decode được) | QR code PNG → Base64 string → FE hiển thị `<img src="data:image/png;base64,...">` |
| **BCrypt** | Thuật toán hash password 1 chiều, có salt + cost factor (số lần băm) | "123456" → "$2a$10$N9qo8uLOi..." (10 = cost factor) |
| **Bean** | Object được Spring quản lý (tạo, inject, destroy) | `@Service`, `@Repository`, `@Component` đều là Bean |
| **BigDecimal** | Kiểu số chính xác cao (không có sai số làm tròn như `double`). **💡 Nhớ:** "Tiền dùng BigDecimal, đừng dùng double." | `Booking.totalAmount BigDecimal` lưu giá tiền |
| **Builder Pattern** | Tạo object phức tạp từng bước, rõ ràng hơn constructor có 10 tham số | `Movie.builder().title("Avengers").duration(150).build()` |

## C

| Thuật ngữ | Giải thích | Ví dụ trong CineX |
|---|---|---|
| **Cache** | Bản copy dữ liệu ở nơi truy cập nhanh (RAM), tránh query DB mỗi lần | `SystemConfigService` dùng ConcurrentHashMap cache config |
| **Cache-aside** | Pattern: đọc cache trước → miss thì đọc DB → lưu cache. **💡 Nhớ:** "Hỏi tủ lạnh trước, không có mới ra siêu thị." | `SystemConfigService.getInt("booking.max_seats", 8)` |
| **⚠️ Cache Stampede** | Cache vừa hết hạn, 1000 request cùng miss → cùng query DB → DB sập. **💡 Cách tránh:** lock + early refresh + jitter TTL. | Nếu cache showtime hot vừa expire, 1000 user vào cùng lúc query DB → bottleneck |
| **CDN** | Content Delivery Network — mạng server phân tán, serve file tĩnh nhanh | Cloudinary có CDN → ảnh load nhanh toàn cầu |
| **CGLIB** | Thư viện sinh proxy bằng cách extend class (đối với class không có interface). Spring dùng CGLIB khi class không implement interface nào. | Service không có interface → Spring proxy bằng CGLIB |
| **Changeset** | 1 thay đổi DB trong Liquibase (tạo bảng, thêm cột...) | `001-create-users-table.xml` |
| **⚠️ Circular Dependency** | A inject B, B inject A → Spring không tạo được Bean nào trước → crash khi khởi động. **💡 Cách fix:** đổi sang `@Lazy`, hoặc tách module. | `AService` inject `BService`, `BService` inject `AService` → BeanCurrentlyInCreationException |
| **Classpath** | Danh sách thư mục/JAR mà JVM tìm để load class. **💡 Nhớ:** "Đường đi tìm file `.class`." | `application.yml` phải nằm trong classpath để Spring đọc |
| **Code Smell** | Dấu hiệu code xấu (chưa phải bug nhưng khó maintain) | Method 500 dòng, biến tên `x`/`y`, copy-paste 3 nơi |
| **Connection Pool** | Tập hợp connection DB sẵn sàng (mở 1 lần, dùng nhiều), tránh mở/đóng connection mỗi query. **💡 Nhớ:** "Bể bơi connection — múc lên dùng xong trả lại." | HikariCP (default Spring Boot) — pool size 10 |
| **⚠️ CORS** | Cross-Origin Resource Sharing — trình duyệt CHẶN FE gọi BE khác origin trừ khi BE trả header `Access-Control-Allow-Origin`. **💡 Nhớ:** "Hàng xóm sang nhà phải bấm chuông trước." | FE `localhost:5173` gọi BE `localhost:8088` → BE phải allow origin này |
| **CSRF** | Cross-Site Request Forgery — kẻ tấn công lừa trình duyệt user gửi request đã login. **Tắt khi dùng JWT** (stateless, không có cookie session). | `csrf(AbstractHttpConfigurer::disable)` trong SecurityConfig |
| **CSP** | Content Security Policy — header HTTP chặn XSS bằng cách giới hạn script nguồn nào được chạy | `Content-Security-Policy: script-src 'self'` |

## D

| Thuật ngữ | Giải thích | Ví dụ trong CineX |
|---|---|---|
| **DAO** | Data Access Object — tương tự Repository (tên cũ) | `UserRepository` là DAO cho bảng `users` |
| **⚠️ Deadlock** | 2+ transaction giữ lock và cùng chờ nhau → kẹt vĩnh viễn. **💡 Tránh:** luôn lock theo cùng thứ tự (vd: theo seat ID tăng dần). | Booking A lock ghế 1 chờ ghế 2, Booking B lock ghế 2 chờ ghế 1 → kẹt |
| **Dependency Injection** | Framework tự truyền dependency vào constructor, không cần `new` thủ công | `@RequiredArgsConstructor` Lombok tạo constructor + Spring inject |
| **Dirty Checking** | Hibernate tự phát hiện entity bị sửa trong transaction → tự UPDATE khi commit. **💡 Nhớ:** "Không cần gọi `save()`, Hibernate tự nhớ." | `movie.setTitle("X")` → cuối transaction tự `UPDATE movies SET title='X'` |
| **DRY** | Don't Repeat Yourself — không lặp code | Extract `BaseService.findOrThrow(id, ErrorCode.NOT_FOUND)` |
| **DTO** | Data Transfer Object — object chỉ chứa data, tách entity với API response | `MovieResponse` (trả client) vs `Movie` (entity DB) |
| **⚠️ Dynamic Class (Tailwind)** | Tailwind JIT chỉ giữ class nó "nhìn thấy" trong source. Code `bg-${color}-500` → KHÔNG sinh CSS → class biến mất khi build prod. **💡 Tránh:** dùng map `colorMap[type]` hoặc safelist trong tailwind.config. | `bg-${status}-500` build prod mất màu |

## E

| Thuật ngữ | Giải thích | Ví dụ trong CineX |
|---|---|---|
| **⚠️ Eager Loading** | Load quan hệ NGAY khi query entity chính → có thể gây N+1 nếu để default. **💡 Mặc định nên là LAZY.** | `@ManyToOne(fetch = EAGER)` — TRÁNH dùng nếu không thực sự cần |
| **Encapsulation** | Đóng gói: ẩn data, lộ method (private field + public getter/setter) | `private String password;` + `public String getPassword()` |
| **Entity** | Object Java map với 1 bảng trong DB | `@Entity class Movie` → bảng `movies` |
| **Enum** | Tập hợp hằng số có tên — type-safe, compile-time check | `MovieStatus.NOW_SHOWING` thay vì String "NOW_SHOWING" |

## F

| Thuật ngữ | Giải thích | Ví dụ trong CineX |
|---|---|---|
| **Factory Pattern** | Class chuyên tạo object đúng loại theo input | `PaymentProcessorFactory.getProcessor("MOMO")` |
| **Filter (Spring)** | Class chạy TRƯỚC controller, can thiệp request/response (vd: kiểm tra JWT). **💡 Nhớ:** "Bảo vệ cổng — xét giấy trước khi vào." | `JwtAuthFilter` đọc header `Authorization` |
| **Filter DTO** | Object chứa các tham số search/filter, type-safe | `MovieFilter { keyword, status, genreId, includeDeleted }` |
| **FK** | Foreign Key — khóa ngoại, liên kết 2 bảng | `seats.room_id` → `rooms.id` |
| **Flyway** | Tool quản lý DB migration (alternative của Liquibase). CineX dùng Liquibase. | — |

## G-H

| Thuật ngữ | Giải thích | Ví dụ trong CineX |
|---|---|---|
| **GC** | Garbage Collection — JVM tự thu hồi RAM không còn ai tham chiếu. **💡 Nhớ:** "Lao công JVM dọn rác." | Object hết scope → GC thu hồi |
| **Generic** | Java/TS: kiểu type biến (vd `List<T>`) — viết 1 class dùng cho nhiều type | `ApiResponse<T>` dùng cho mọi loại response |
| **Hash** | Chuyển data thành chuỗi cố định, 1 chiều (không giải ngược) | BCrypt hash password |
| **Hibernate** | Implementation của JPA — ORM framework | Tự sinh SQL từ Java method `findByUsername()` |
| **HMAC** | Hash-based Message Authentication Code — hash + secret key, dùng để verify 2 bên có cùng key. **💡 Nhớ:** "Hash có mật khẩu — chỉ ai biết key mới fake được." | MoMo callback gửi HMAC, CineX verify bằng `partnerCode` secret |
| **Hook (React)** | Function chạy trong lifecycle component, bắt đầu bằng `use*` | `useState`, `useEffect`, `useQuery` |
| **HTTP Upgrade** | Header HTTP đặc biệt nâng cấp connection từ HTTP → WebSocket. **💡 Nhớ:** "Bắt đầu nói chuyện qua HTTP, hứa hẹn rồi chuyển sang TCP raw." | WebSocket handshake: client gửi `Upgrade: websocket` → server `101 Switching Protocols` |

## I

| Thuật ngữ | Giải thích | Ví dụ trong CineX |
|---|---|---|
| **⚠️ Idempotent** | Gọi 1 lần hay 100 lần kết quả giống nhau. **💡 Quan trọng:** payment callback PHẢI idempotent (MoMo có thể retry). | PUT/DELETE idempotent. POST KHÔNG. Payment callback handler check `if (already_processed) return;` |
| **Image** | Docker: file read-only chứa OS + app, bản thiết kế | `mcr.microsoft.com/mssql/server:2022-latest` |
| **Index** | DB: cấu trúc B-tree giúp tìm kiếm nhanh (mục lục sách) | `idx_bookings_user_id` trên cột `user_id` |
| **Inheritance** | Class con kế thừa class cha | `Movie extends BaseEntity` |
| **IoC** | Inversion of Control — framework quản lý object, không phải dev | Spring Container tạo + inject Bean |
| **IPN** | Instant Payment Notification — webhook payment gateway gửi BE khi giao dịch xong. **💡 Nhớ:** "Server-to-server thông báo, không qua trình duyệt user." | MoMo IPN gọi `POST /api/payments/momo/callback` |

## J

| Thuật ngữ | Giải thích | Ví dụ trong CineX |
|---|---|---|
| **JIT** | Just-In-Time compilation — JVM compile bytecode → native code lúc runtime cho method hot | JVM tối ưu `MovieService.search()` sau N lần gọi |
| **JPA** | Java Persistence API — chuẩn ORM cho Java | `@Entity`, `@ManyToOne`, `@Query` |
| **JPQL** | JPA Query Language — SQL cho entity (dùng tên class, không tên bảng) | `SELECT m FROM Movie m WHERE m.title LIKE :keyword` |
| **JSON** | JavaScript Object Notation — format data phổ biến cho API | `{"username": "vanan", "role": "USER"}` |
| **JWT** | JSON Web Token — token xác thực stateless, 3 phần: Header.Payload.Signature | `eyJhbGci...` gửi trong `Authorization: Bearer ...` |

## L-M

| Thuật ngữ | Giải thích | Ví dụ trong CineX |
|---|---|---|
| **⚠️ Lazy Loading** | Chỉ load quan hệ khi GỌI getter, không load sẵn. Hibernate dùng **Proxy** để delay load. **💡 Cẩn thận:** ngoài transaction → `LazyInitializationException`. | `@ManyToOne(fetch = LAZY)` — mặc định nên dùng |
| **⚠️ LazyInitializationException** | Gọi getter quan hệ LAZY sau khi transaction đã đóng → Hibernate không còn session → throw. **💡 Fix:** dùng `@Transactional`, hoặc `JOIN FETCH`, hoặc DTO projection. | Trả Entity ra Controller → JSON serialize gọi getter → throw |
| **Liquibase** | Quản lý version cho DB schema | `001-create-users-table.xml` → tự chạy khi start |
| **Liskov Substitution** | Class con có thể thay thế class cha không phá behavior. **💡 Vi phạm:** `CashPaymentProcessor.generateQrCode() throw UnsupportedOperationException()`. | `PaymentProcessor` các implementation phải hoạt động đúng |
| **Long Polling** | FE gọi BE liên tục mỗi vài giây để check data mới. **💡 So với WebSocket:** đơn giản hơn nhưng tốn tài nguyên hơn. | Cách CŨ trước khi có WebSocket — CineX không dùng |
| **MapStruct** | Thư viện tự sinh code mapping entity ↔ DTO lúc compile (không runtime reflection → nhanh) | `UserMapper.toProfileResponse(user)` |
| **ManyToOne** | Quan hệ nhiều-một: nhiều Seat thuộc 1 Room | `@ManyToOne Room room` trong Seat entity |
| **ManyToMany** | Quan hệ nhiều-nhiều: Movie ↔ Genre qua bảng join | `movie_genres` join table |
| **MDC** | Mapped Diagnostic Context — ThreadLocal lưu correlationId cho mọi log dòng cùng request. **💡 Nhớ:** "Mỗi log đều mang ID request gốc." | Log `[req-abc123] User logged in` → trace toàn bộ flow request `req-abc123` |
| **Memoization** | Cache kết quả function theo input → input giống nhau không tính lại | React `useMemo`, `useCallback` |
| **Method Security** | Spring Security: phân quyền cấp method (`@PreAuthorize`) thay vì cấp URL pattern | `@PreAuthorize("hasRole('ADMIN')")` trên service method |
| **Middleware** | Code chạy giữa request và response | `JwtAuthFilter` = middleware kiểm tra token |
| **Migration** | Thay đổi DB schema có version control | Liquibase changeset |
| **Multipart** | HTTP: gửi file upload (không phải JSON) | `Content-Type: multipart/form-data` cho upload avatar |

## N-O

| Thuật ngữ | Giải thích | Ví dụ trong CineX |
|---|---|---|
| **⚠️ N+1 Problem** | Query 1 lần lấy list → N lần lấy quan hệ cho mỗi item. **💡 Nhớ:** "1 query lấy danh sách, N query lấy chi tiết — chậm N lần." **Fix:** `JOIN FETCH`, `@EntityGraph`, DTO projection. | List 20 phim + EAGER genre → 1 + 20 = 21 queries |
| **ORM** | Object-Relational Mapping — map Java object ↔ DB table | Hibernate: `Movie.java` ↔ bảng `movies` |
| **OOP** | Object-Oriented Programming — 4 trụ: Encapsulation, Inheritance, Polymorphism, Abstraction | Toàn bộ Java code CineX |
| **⚠️ Optimistic Lock** | Kiểm tra `@Version` khi save — nếu version đổi → lỗi `OptimisticLockException`. **💡 Khi nào dùng:** ít conflict, đọc nhiều ghi ít. **So với Pessimistic:** Optimistic nhanh hơn nếu ít conflict. | `@Version Long version` trong BaseEntity |
| **OWASP** | Tổ chức nghiên cứu lỗ hổng bảo mật web. OWASP Top 10 = 10 lỗ hổng nguy hiểm nhất. | Injection, XSS, Broken Auth... |

## P-Q

| Thuật ngữ | Giải thích | Ví dụ trong CineX |
|---|---|---|
| **Pagination** | Chia kết quả thành trang (page 0, size 20) | `GET /api/movies?page=0&size=20` → `PageResponse` |
| **⚠️ Pessimistic Lock** | Lock row DB khi đọc — thread khác phải chờ. **💡 Khi nào dùng:** nhiều conflict (vd hold ghế). **So với Optimistic:** chậm hơn nhưng tránh được race condition hoàn toàn. | `@Lock(PESSIMISTIC_WRITE)` khi hold ghế |
| **PK** | Primary Key — khóa chính, unique + not null | `id BIGINT IDENTITY` |
| **Polymorphism** | Cùng 1 method tên, nhiều implementation khác nhau | `PaymentProcessor.process()` — MoMo vs Cash implement khác |
| **⚠️ Proxy (Spring)** | Object wrapper Spring tự tạo bọc Bean → mọi call qua Proxy mới chạy được `@Transactional`, `@PreAuthorize`. **💡 Quan trọng:** gọi `this.method()` trong cùng class BỎ QUA Proxy → annotation không chạy (xem **Self-Invocation**). | Service có `@Transactional` → Spring tạo Proxy bọc lại |

## R-S

| Thuật ngữ | Giải thích | Ví dụ trong CineX |
|---|---|---|
| **⚠️ Race Condition** | 2+ thread đồng thời ghi cùng data → kết quả không đoán trước. **💡 Nhớ:** "Đua xe vào ô cuối — ai đến trước thắng, người sau bị mất chỗ." | 2 user cùng hold ghế E1 cùng micro-giây → nếu không lock thì 2 cùng thắng → trùng booking |
| **Reflection** | Java: code đọc/sửa class/method lúc runtime (không cần compile-time). **💡 Chậm hơn** code thường, dùng cho framework (Spring, Hibernate, Jackson). | Jackson deserialize JSON → Object bằng reflection |
| **REST** | Representational State Transfer — kiến trúc API dùng HTTP methods | GET (đọc), POST (tạo), PUT (sửa), DELETE (xóa) |
| **Rollback** | Hoàn tác transaction — như chưa có gì xảy ra | Hold ghế lỗi → rollback → ghế trống lại |
| **Salt** | Chuỗi random thêm vào password trước khi hash → cùng password ra hash khác nhau | BCrypt tự sinh salt mỗi lần hash |
| **⚠️ Self-Invocation** | Gọi `this.method()` trong cùng class → BỎ QUA Spring Proxy → `@Transactional`/`@Async`/`@Cacheable` KHÔNG chạy. **💡 Fix:** tách method sang class khác, hoặc inject `self` (proxy reference). | `class A { @Transactional void m1() {} void m2() { this.m1(); } }` → `m1` không có transaction khi gọi từ `m2` |
| **Session (Hibernate)** | Phiên làm việc với DB, mở khi vào `@Transactional`, đóng khi out. Ngoài session không gọi được LAZY getter. | `LazyInitializationException` xảy ra khi session đã đóng |
| **Side Effect (React)** | Tác dụng phụ ngoài render: API call, subscription, timer. Phải đặt trong `useEffect`. | `useEffect(() => { fetchMovies(); }, [])` |
| **Singleton** | 1 class chỉ có 1 instance duy nhất | Spring Bean mặc định là Singleton |
| **Soft Delete** | Xóa mềm: set `storageState = "DELETED"`, data vẫn trong DB | Xóa phim → `storageState = "DELETED"` → khôi phục được |
| **SOLID** | 5 nguyên tắc thiết kế: **S**ingle Responsibility, **O**pen/Closed, **L**iskov, **I**nterface Segregation, **D**ependency Inversion. **💡 Nhớ:** "Mỗi class 1 việc, mở rộng đừng sửa, con thay được cha, interface nhỏ, phụ thuộc abstraction." | Xem [design-patterns/04-solid-principles.md](design-patterns/04-solid-principles.md) |
| **SPA** | Single Page Application — FE chỉ có 1 file HTML, JS render nội dung | React app: `index.html` + JS bundle |
| **Specification** | JPA: build query WHERE động, ghép filter tùy ý | `MovieSpecification.fromFilter(filter)` |
| **⚠️ SQL Injection** | Hacker chèn SQL độc vào input → BE chạy SQL hỗn loạn. **💡 Tránh:** dùng parameter binding (JPA tự làm), KHÔNG concat string SQL. | Sai: `"WHERE name = '" + input + "'"` (hacker nhập `' OR 1=1--`) |
| **⚠️ Stale Closure (React)** | `useEffect`/`setTimeout` "nhớ" giá trị state cũ vì closure capture lúc render. **💡 Fix:** dùng `useRef`, hoặc thêm dep vào dep array. | `setInterval(() => console.log(count), 1000)` luôn log `0` |
| **⚠️ Stale Data (TanStack Query)** | Data cũ trong cache khác data mới ở server. **💡 Fix:** `queryClient.invalidateQueries(['movies'])` sau mutation. | Tạo movie xong list không refresh |
| **Stateless** | Server KHÔNG lưu session — mỗi request tự gửi token | JWT authentication = stateless |
| **⚠️ Strict Mode (React)** | Dev mode: React render component 2 lần để phát hiện side effect không sạch. **💡 Không phải bug** — chỉ có ở dev, prod chạy 1 lần. | `useEffect` chạy 2 lần khi dev — đừng panic |
| **Stream (Java)** | API xử lý collection theo functional style: `list.stream().filter().map().collect()` | `movies.stream().filter(m -> m.getStatus() == NOW_SHOWING).toList()` |

## T

| Thuật ngữ | Giải thích | Ví dụ trong CineX |
|---|---|---|
| **ThreadLocal** | Java: mỗi thread có bản copy riêng của biến | `SecurityContextHolder` dùng ThreadLocal → mỗi request biết user là ai |
| **Thread Pool** | Tập hợp thread sẵn sàng (mở 1 lần, dùng nhiều), tránh tạo thread mới mỗi request | Tomcat thread pool default size 200 |
| **Throttle** | Giới hạn tần suất gọi function (vd: tối đa 1 lần/giây) | Search input: throttle 300ms để giảm API call |
| **Transaction** | Nhóm operations chạy cùng nhau: tất cả thành công hoặc tất cả rollback | `@Transactional` trên Service methods |
| **TTL** | Time To Live — thời gian cache/token hết hạn | Access token TTL = 15 phút |
| **Type Erasure** | Java generic chỉ tồn tại compile-time, runtime bị xóa → `List<String>` và `List<Integer>` runtime là cùng `List` | `if (obj instanceof List<String>)` KHÔNG compile được |

## U-V

| Thuật ngữ | Giải thích | Ví dụ trong CineX |
|---|---|---|
| **UUID** | Universally Unique Identifier — string 36 ký tự random, gần như không trùng | `550e8400-e29b-41d4-a716-446655440000`. CineX KHÔNG dùng — dùng IdTracker `CX-20260520-001` |
| **Validation** | Kiểm tra dữ liệu đầu vào: `@NotBlank`, `@Email`, `@Min`, `@Max` | `@NotBlank @Email String email` trong RegisterRequest |
| **Volume (Docker)** | Ổ cứng ảo ngoài container, giữ data khi container xóa | `sqlserver-data` volume giữ database files |

## W-X-Y

| Thuật ngữ | Giải thích | Ví dụ trong CineX |
|---|---|---|
| **Webhook** | URL public BE expose để hệ thống ngoài gọi vào (vd payment gateway callback) | `POST /api/payments/momo/callback` |
| **WebSocket** | Connection 2 chiều giữa client-server, không phải request-response. **💡 Nhớ:** "Như điện thoại — gọi 1 lần, nói lại nhiều lần." | `/ws-cinex` STOMP endpoint cho seat sync real-time |
| **⚠️ XSS** | Cross-Site Scripting — hacker inject JavaScript vào trang web (qua input không escape). **💡 Tránh:** React tự escape `{value}`, nhưng `dangerouslySetInnerHTML` thì KHÔNG. | Nếu render `<div dangerouslySetInnerHTML={{__html: userInput}}>` → XSS risk |
| **YAGNI** | You Aren't Gonna Need It — đừng code feature trước khi cần | Không viết "phòng hờ" method 1 năm mới dùng |

---

## 🎯 Cheatsheet: "Khi gặp X, đọc Y"

| Triệu chứng | Đọc thuật ngữ | Đọc file |
|---|---|---|
| `LazyInitializationException` ở Controller | Lazy Loading, Session, ThreadLocal | [backend/02](backend/02-jpa-hibernate.md) |
| API query 5s mới ra | N+1, Eager Loading | [database/01](database/01-database-techniques.md) |
| FE bị block CORS | CORS, CSRF | [backend/03](backend/03-security.md) |
| 2 user cùng đặt 1 ghế | Race Condition, Pessimistic Lock, Optimistic Lock | [module-guides/09](module-guides/09-booking-explained.md) |
| `@Transactional` không rollback | Self-Invocation, Proxy, AOP | [backend/15](backend/15-common-pitfalls.md) |
| `useEffect` count luôn = 0 | Stale Closure, Memoization | [frontend/15](frontend/15-react-pitfalls.md) |
| Component render 2 lần dev | Strict Mode, Side Effect | [frontend/15](frontend/15-react-pitfalls.md) |
| Payment callback xử lý 2 lần | Idempotent, Webhook, IPN | [module-guides/10](module-guides/10-payment-explained.md) |
| App crash khi start | Circular Dependency, IoC | [backend/15](backend/15-common-pitfalls.md) |
| Cache hết hạn → DB sập | Cache Stampede, Cache-aside, TTL | [backend/08](backend/08-redis.md) |
| Tailwind class biến mất prod | Dynamic Class | [frontend/15](frontend/15-react-pitfalls.md) |
| Hacker chèn SQL độc | SQL Injection, Parameter Binding | [backend/03](backend/03-security.md) |
| Input XSS qua chat box | XSS, CSP | [backend/03](backend/03-security.md) |

---

## 🆕 Bổ sung 2026-06 — Thuật ngữ mới sau refactor

| Thuật ngữ | Giải thích | Ví dụ trong CineX |
|---|---|---|
| **MovieRun** | "Đợt chiếu phim tại 1 rạp" — entity per-theater chứa lifecycle (startDate/endDate/runType). 1 phim có nhiều MovieRun cho từng đợt FIRST_RUN/REISSUE/FESTIVAL ở từng rạp riêng. **💡 Nhớ:** giống "hợp đồng phát hành" giữa distributor và rạp. | `module/movie/entity/MovieRun.java` — xem [explainer/movie-run.md](explainer/movie-run.md) |
| **MovieRunType** | Enum 4 giá trị: FIRST_RUN (lần đầu công chiếu), REISSUE (chiếu lại), FESTIVAL (liên hoan), SPECIAL (đặc biệt). Distributor commission khác nhau theo loại. | Avatar 3 có MovieRun FIRST_RUN và REISSUE Giáng Sinh |
| **MovieStatusComputer** | Service compute status `Movie` runtime dựa trên (movieId, theaterId, today) — vì Movie.status đã bị drop trong refactor, status derived từ MovieRun list. | `module/movie/service/MovieStatusComputer.java` |
| **Multi-tenant per-theater** | Pattern entity có `theater_id NOT NULL` (rooms/seats/snacks/combos) — data isolation theo chi nhánh. Khác multi-tenant database (mỗi tenant 1 DB). | Snack thuộc theater HN không thấy ở theater SG |
| **Global rule fallback** | Pattern entity có `theater_id NULLABLE` — NULL = áp dụng toàn hệ thống. Per-theater override global cùng `code`. | pricing_rules, vouchers |
| **PricingEngine** | Service áp pricing rules động cho giá vé. 2-tier cache: in-process activeRules + Caffeine effectiveRulesCache (key truncate đến HOUR). | `module/pricing/service/PricingEngine.java` — xem [explainer/pricing-engine.md](explainer/pricing-engine.md) |
| **PricingRuleMatcher** | Strategy pattern — switch theo `PricingRuleType` (DAY_OF_WEEK/HOUR_RANGE/DATE_RANGE/COMPOSITE) | `module/pricing/strategy/PricingRuleMatcher.java` |
| **What You See Is What You Pay (WYSIWYP)** | Chuẩn industry: giá hiển thị = giá thanh toán cuối cùng. Pháp lý: Luật BVNTD + Nghị định 13/2023. **Fix:** ShowtimeResponse expose `effectivePrice` + `basePrice`. | `module/showtime/service/ShowtimeService.toListResponseWithPricing` |
| **Hide surge badge** | Chuẩn rạp VN (CGV/Lotte/BHD): chỉ hiển thị chip cho rule giảm (discountPercent<0), ẨN chip tăng (peak surge). Tránh anchoring "bị chặt chém". | `frontend/src/components/common/PriceWithRules.tsx` |
| **HttpOnly cookie** ⚠️ | Refresh token lưu cookie với flag HttpOnly → JS KHÔNG đọc được → chống XSS theft. Pattern hybrid Auth0/Cognito (access token localStorage 15p + refresh cookie 7d). | `module/auth/util/RefreshTokenCookieUtil.java` — xem [explainer/security-hardening.md](explainer/security-hardening.md) |
| **CSP (Content Security Policy)** | HTTP header chỉ định nguồn được phép load script/img/style — chống XSS injection. CineX whitelist Cloudinary + MoMo CDN. | `common/config/SecurityConfig.java` headers().contentSecurityPolicy() |
| **HSTS (Strict-Transport-Security)** | Header force browser dùng HTTPS — sau lần đầu HTTPS, browser từ chối HTTP requests. max-age 1 năm + includeSubDomains. | `SecurityConfig` headers().httpStrictTransportSecurity() |
| **JSON strict mode** | `spring.jackson.deserialization.fail-on-unknown-properties=true` → client gửi field không khai trong DTO → throw 400. Chống mass-assignment risk. | `application.yml` |
| **ShedLock** | Distributed lock cho `@Scheduled` đa instance — chỉ 1 instance chạy 1 lần. Dùng bảng `shedlock` qua JDBC provider. | `module/booking/service/BookingCleanupScheduler.java` — xem [backend/18](backend/18-shedlock.md) |
| **`@SchedulerLock`** | Annotation đánh dấu scheduled method cần lock. Params: `name` (unique), `lockAtMostFor` (max hold), `lockAtLeastFor` (min hold). | `@SchedulerLock(name = "booking-cleanup", lockAtMostFor = "PT5M")` |
| **Theater scope (multi-tenant guard)** | Pattern check `SecurityService.requireAccessToTheater(theaterId)` — BRANCH_ADMIN chỉ access theater trong JWT scope. SUPER_ADMIN qua được. | `BookingController.counterSale` |
| **Age Rating C dropped** ⚠️ | Theo TT 25/2024/BVHTTDL: C không phải mức tuổi mà là "cấm phát hành" → bỏ khỏi enum CineX. Còn lại P/K/T13/T16/T18. | Migration 072 UPDATE age_rating='T18' WHERE='C' |
| **3-tier age enforcement** | (1) FE confirm dialog (2) BE auto-block khi user khai DOB (3) POS reject vật lý tại cổng + status REJECTED. | Xem [explainer/age-rating.md](explainer/age-rating.md) |
| **`BookingStatus.REJECTED`** | State mới (khác CANCELLED) cho booking bị POS từ chối check-in (vd không đủ tuổi). Policy: không hoàn tiền. | `BookingService.rejectCheckIn` |
| **`Booking.theater` snapshot** | Field `theater_id` trực tiếp trên booking — immutable từ lúc tạo, không chase qua showtime → room → theater. Cho reporting cross-theater chính xác. | `module/booking/entity/Booking.java` |
| **POS multi-payment** | POS hỗ trợ 5 method: MOMO/CASH/CARD_POS/TRANSFER/VNPAY. CASH default cho POS, CARD_POS cho quẹt thẻ tại quầy, TRANSFER cho chuyển khoản QR. | `module/payment/processor/*PaymentProcessor.java` |
| **Caffeine + Redis 2-tier** | L1 Caffeine in-process (statistics 60s, pricing engine) + L2 Redis cross-instance (rate-limit, blacklist). KHÔNG cascade L1→L2 cho cùng data. | Xem [explainer/caching-strategy.md](explainer/caching-strategy.md) |
| **Liquibase fix-forward** ⚠️ | KHÔNG sửa changeset đã chạy (checksum error). Sửa = tạo changeset mới UPDATE/ALTER fix điều cần. | Migration 017-fix-system-config-encoding.xml fix lỗi N' prefix |
| **Liquibase splitStatements=false** ⚠️ | Khi changeset có T-SQL với DECLARE/CURSOR/WHILE/IF block, set `<sql splitStatements="false" endDelimiter="GO">` để Liquibase KHÔNG split SQL theo `;`. | Migration seed showtimes |
| **N' prefix (Unicode SQL Server)** ⚠️ | Tiếng Việt có dấu trong SQL Server CHARSET Latin1 phải prefix `N'...'` → chuyển sang NVARCHAR. Thiếu → mất dấu. | INSERT INTO snacks ... VALUES (N'Bắp rang bơ', ...) |
| **MapStruct compile-time** | Code generator chuyển Entity ↔ DTO tại compile, không reflection. 3-5x nhanh hơn ModelMapper. Cần `lombok-mapstruct-binding` để work với Lombok. | `module/movie/mapper/MovieMapper.java` — xem [backend/12](backend/12-mapstruct.md) |
| **`@TransactionalEventListener(AFTER_COMMIT)`** | Listener Spring Events chỉ chạy SAU khi DB commit thành công. Tránh side-effect khi rollback (gửi email rồi rollback). | `EmailEventListener.onBookingConfirmed` |
| **Force-init lazy proxy** | Pattern access `entity.getRelation().size()` trong transaction để force load → tránh `LazyInitializationException` ở @Async listener. | `PaymentService.completePayment` |
| **Hibernate validate (ddl-auto)** | `spring.jpa.hibernate.ddl-auto=validate` — Hibernate KHÔNG tự thay đổi schema, chỉ check entity vs DB. Schema do Liquibase quản. | `application.yml` |
| **`@Auditable` aspect** | AOP annotation đánh dấu method cần log vào `audit_logs`. Aspect đọc context (user, IP, action, status) tự ghi. | `BookingService.rejectCheckIn` |
| **SeatType (6 loại revamp)** | STANDARD/VIP/COUPLE/SWEETBOX/DELUXE/HANDICAP chuẩn industry CGV/Lotte/BHD. SWEETBOX cao cấp hơn COUPLE; DELUXE recliner cho Premium room; HANDICAP bắt buộc NĐ 28/2012. | `module/seat/entity/SeatType.java` |
| **SeatStatus BLOCKED** | Cố định (cột bê tông/lối thoát hiểm), khác BROKEN (tạm thời, có thể sửa). | `module/seat/entity/SeatStatus.java` |
| **`Seat.isAisle`** | Vị trí là LỐI ĐI giữa block ghế, không phải seat thật. Không cho book, không tính totalSeats. FE render khoảng trống. | `module/seat/entity/Seat.java` |
| **VIP zone** | Hình chữ nhật `(rowStart/rowEnd × colStart/colEnd)` — "sweet spot" giữa rạp, không phải toàn row như cũ. | `SeatGenerateRequest.ZoneRange` |
| **SeatLayoutPreset** | Helper sinh layout preset theo RoomType (TWO_D/THREE_D/IMAX/FOUR_DX). Admin 1 click có layout chuẩn industry. | `module/seat/service/SeatLayoutPreset.java` |
| **NĐ 28/2012** | Nghị định pháp lý VN — rạp chiếu phim phải có chỗ ngồi cho người khuyết tật. CineX enforce qua HANDICAP seat ở đầu hàng B của mọi preset. | Seat compliance |

---

## ✏️ Đóng góp thuật ngữ mới

Nếu bạn gặp thuật ngữ chưa có ở đây, thêm vào theo template:

```markdown
| **TermName** ⚠️ (nếu hay gây bug) | Giải thích 1-2 câu. **💡 Nhớ:** ví dụ đời thường. **Fix:** nếu là bug. | Ví dụ trong CineX |
```

**Tiêu chuẩn:**
- Giải thích ≤ 2 câu
- Có **💡 Nhớ nhanh** nếu khái niệm phức tạp
- Có **⚠️** prefix nếu thuật ngữ hay gây bug
- Ví dụ CineX phải có file/class thực tế
