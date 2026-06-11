# Structural Patterns — Nhóm cấu trúc

> 7 pattern GoF cho bài toán **tổ chức class/object** — làm sao kết hợp chúng để tạo cấu trúc lớn hơn mà vẫn linh hoạt.

| Pattern | Mục đích | CineX dùng? |
|---|---|---|
| **Adapter** | Map interface A → interface B | ✅ Cloudinary adapter |
| **Bridge** | Tách abstraction khỏi implementation | (CineX chưa cần) |
| **Composite** | Cấu trúc tree, đối xử node lá + nhánh như nhau | (CineX chưa cần) |
| **Decorator** | Thêm behavior runtime mà không sửa class | ✅ Spring `@Transactional` proxy |
| **Facade** | Giao diện đơn giản che hệ thống phức tạp | ✅ `ApiResponse<T>` |
| **Flyweight** | Share object để tiết kiệm memory | (CineX chưa cần) |
| **Proxy** | Đại diện điều khiển access | ✅ Spring AOP, JPA Lazy proxy |
| **DTO** | Data transfer (extension GoF) | ✅ Mọi module |
| **Repository** | Trừu tượng hóa data access | ✅ Mọi module |

---

## 1. Adapter

### Định nghĩa
Convert interface của class A sang interface mà client expect (interface B). Như adapter sạc — chuyển AC 220V → DC 5V cho điện thoại.

### Ví dụ đời thường
Du lịch Mỹ với phích cắm châu Âu — bạn cần adapter A↔B. Phích KHÔNG đổi, ổ điện KHÔNG đổi — chỉ thêm 1 thiết bị trung gian.

### Class diagram
```
┌──────────┐  expects  ┌──────────────┐
│ Client   │──────────▶│ TargetIface  │
└──────────┘           └──────┬───────┘
                              │ implements
                              ▼
                       ┌──────────────┐  wraps  ┌──────────────┐
                       │ Adapter      │────────▶│ Adaptee      │
                       └──────────────┘         │ (3rd party)  │
                                                └──────────────┘
```

### Code generic

```java
// Interface client expect
public interface FileStorage {
    String upload(byte[] data, String filename);
    void delete(String fileId);
}

// Third-party API (KHÔNG sửa được — Cloudinary SDK)
public class CloudinaryClient {
    public CloudinaryResponse uploadFile(InputStream stream, Map<String, Object> options) { ... }
    public CloudinaryResponse destroy(String publicId, Map<String, Object> options) { ... }
}

// Adapter — kết nối 2 interface
@Component
public class CloudinaryStorageAdapter implements FileStorage {
    private final CloudinaryClient cloudinary;

    public String upload(byte[] data, String filename) {
        InputStream stream = new ByteArrayInputStream(data);
        Map<String, Object> options = Map.of("public_id", filename, "folder", "cinex");
        CloudinaryResponse resp = cloudinary.uploadFile(stream, options);
        return resp.getSecureUrl();
    }

    public void delete(String fileId) {
        cloudinary.destroy(fileId, Map.of());
    }
}

// Client làm việc với abstraction:
@Service
public class MovieService {
    private final FileStorage storage;  // không biết Cloudinary tồn tại

    public void uploadPoster(byte[] image) {
        String url = storage.upload(image, "poster-" + id);
        movie.setPosterUrl(url);
    }
}
```

Đổi từ Cloudinary → AWS S3: tạo `S3StorageAdapter implements FileStorage`. `MovieService` KHÔNG touch.

### Trong CineX
- `CloudinaryService` adapt SDK Cloudinary 3rd party → interface gọn cho upload poster/avatar/snack
- `MoMoPaymentProcessor` adapt MoMo SDK → `PaymentProcessor` interface

### Khi nào dùng?
- Tích hợp 3rd party library (KHÔNG sửa được code SDK)
- Muốn isolate code app khỏi changes của SDK

### Anti-pattern
Adapter quá mỏng (just passthrough mọi method) → wraps thừa thãi. Adapter có ý nghĩa khi có map/translation logic.

---

## 2. Bridge

### Định nghĩa
Tách **abstraction** khỏi **implementation** để cả 2 có thể vary độc lập. Tránh class explosion khi có 2 dimension biến đổi.

### Ví dụ đời thường
Điều khiển TV: bạn có 4 loại điều khiển (universal, smart, basic, voice) × 5 hãng TV (Sony, Samsung, LG, TCL, Sharp) = 20 combination. Nếu mỗi combination 1 class → 20 class. Bridge tách:
- Abstraction: RemoteControl (4 loại)
- Implementation: TvDevice (5 hãng)
→ 4 + 5 = 9 class.

### Class diagram
```
┌────────────────┐       has-a       ┌──────────────┐
│ RemoteControl  │──────────────────▶│ TvDevice     │
│  (abstraction) │                   │ (impl iface) │
└────────┬───────┘                   └──────┬───────┘
         │ extends                          │ implements
   ┌─────┴──────┐                    ┌──────┴───────┐
   ▼            ▼                    ▼              ▼
SmartRemote BasicRemote          SonyTv       SamsungTv
```

### Code generic

```java
public interface TvDevice {
    void powerOn();
    void setChannel(int ch);
    void setVolume(int v);
}

public class SonyTv implements TvDevice {
    public void powerOn() { /* Sony API */ }
    public void setChannel(int ch) { /* Sony way */ }
    public void setVolume(int v) { /* Sony way */ }
}

public class SamsungTv implements TvDevice { ... }

public abstract class RemoteControl {
    protected TvDevice tv;  // ← Bridge: ref tới implementation

    public RemoteControl(TvDevice tv) { this.tv = tv; }

    public abstract void pressPower();
}

public class BasicRemote extends RemoteControl {
    public BasicRemote(TvDevice tv) { super(tv); }
    public void pressPower() { tv.powerOn(); }
}

public class SmartRemote extends RemoteControl {
    public SmartRemote(TvDevice tv) { super(tv); }
    public void pressPower() {
        tv.powerOn();
        tv.setChannel(1);  // smart: tự bật channel 1
    }
    public void voiceCommand(String cmd) { /* AI */ }
}

// Mix-and-match runtime:
RemoteControl r1 = new BasicRemote(new SonyTv());
RemoteControl r2 = new SmartRemote(new SamsungTv());
```

### CineX chưa cần Bridge
CineX không có 2 dimension biến đổi rõ rệt. Pattern này phổ biến hơn trong game (Character × Weapon), graphic (Shape × Renderer SVG/Canvas/WebGL).

---

## 3. Composite

### Định nghĩa
Cấu trúc object thành tree — đối xử **node lá** và **node nhánh** như nhau qua chung 1 interface.

### Ví dụ đời thường
Thư mục file:
- Folder chứa file + folder con (đệ quy)
- Operation `size()`: file → trả size; folder → trả tổng size con
- Operation `delete()`: file → xóa file; folder → xóa đệ quy

Client gọi `node.size()` không cần biết folder hay file.

### Class diagram
```
┌──────────────┐
│ Component    │
│ + operation()│
└──────┬───────┘
       │
   ┌───┴────┐
   ▼        ▼
┌──────┐  ┌──────────────┐
│ Leaf │  │ Composite    │
└──────┘  │ - children   │
          │ + add(child) │
          └──────────────┘
```

### Code

```java
public interface FileNode {
    int getSize();
    String getName();
}

public class File implements FileNode {
    private String name;
    private int size;
    public File(String n, int s) { name = n; size = s; }
    public int getSize() { return size; }
    public String getName() { return name; }
}

public class Folder implements FileNode {
    private String name;
    private List<FileNode> children = new ArrayList<>();

    public Folder(String name) { this.name = name; }
    public void add(FileNode node) { children.add(node); }

    public int getSize() {
        return children.stream().mapToInt(FileNode::getSize).sum();
    }
    public String getName() { return name; }
}

// Tạo tree:
Folder root = new Folder("root");
root.add(new File("a.txt", 100));
Folder sub = new Folder("sub");
sub.add(new File("b.txt", 200));
sub.add(new File("c.txt", 300));
root.add(sub);

root.getSize();  // 600 (tự gộp lá + nhánh)
```

### CineX có thể dùng đâu?
- Combo gồm Snacks → tổng giá combo có thể tính qua Composite
- Menu tree (CineX hiện đơn cấp, nhưng nếu cần submenu → Composite)

### Khi nào KHÔNG cần?
- Cấu trúc flat (list), không tree → list bình thường đủ

---

## 4. Decorator

### Định nghĩa
Thêm behavior cho object **runtime** mà không sửa class gốc. Wrap object trong "lớp áo" thêm chức năng.

### Ví dụ đời thường
Pizza base + thêm topping:
- Pizza thường — 50k
- Pizza + phô mai — 50k + 10k = 60k
- Pizza + phô mai + xúc xích — 60k + 15k = 75k

Mỗi topping wrap pizza trước nó + thêm giá.

### Class diagram
```
┌──────────────┐
│ Component    │
│ + cost()     │
└──────┬───────┘
       │
   ┌───┴────┐
   ▼        ▼
┌──────┐ ┌──────────────┐
│Base  │ │ Decorator    │
└──────┘ │ - wrappee    │
         │ + cost()     │
         └──────┬───────┘
                │
        ┌───────┴────────┐
        ▼                ▼
   CheeseDecor      SausageDecor
```

### Code generic

```java
public interface Pizza {
    int cost();
    String description();
}

public class PlainPizza implements Pizza {
    public int cost() { return 50_000; }
    public String description() { return "Pizza"; }
}

public abstract class PizzaDecorator implements Pizza {
    protected Pizza wrappee;
    public PizzaDecorator(Pizza p) { wrappee = p; }
}

public class CheeseDecorator extends PizzaDecorator {
    public CheeseDecorator(Pizza p) { super(p); }
    public int cost() { return wrappee.cost() + 10_000; }
    public String description() { return wrappee.description() + " + phô mai"; }
}

public class SausageDecorator extends PizzaDecorator {
    public SausageDecorator(Pizza p) { super(p); }
    public int cost() { return wrappee.cost() + 15_000; }
    public String description() { return wrappee.description() + " + xúc xích"; }
}

// Build runtime — nested:
Pizza myPizza = new SausageDecorator(new CheeseDecorator(new PlainPizza()));
myPizza.cost();          // 75000
myPizza.description();   // "Pizza + phô mai + xúc xích"
```

### Trong CineX — Spring @Transactional là Decorator

```java
@Service
public class BookingService {
    @Transactional  // ← Spring sinh proxy decorator
    public Booking createBooking(...) {
        // logic
    }
}
```

Spring runtime sinh `BookingService$$Proxy`:
```
proxy.createBooking() {
    begin transaction;       // ← decoration added
    try {
        result = real.createBooking();
        commit;              // ← decoration added
        return result;
    } catch (Exception e) {
        rollback;            // ← decoration added
        throw e;
    }
}
```

Bạn KHÔNG thấy code transaction trong service — Decorator (proxy) thêm runtime.

### Decorator vs Inheritance

| Decorator | Inheritance |
|---|---|
| Compose runtime | Compose compile-time |
| Mix nhiều combination | Hard-coded subclass |
| Pizza + cheese + sausage + bacon = 1 class composition runtime | Phải có class `CheeseSausageBaconPizza` |

### Khi nào dùng?
- Nhiều combination feature (n features × m base = n×m → Decorator scale tốt hơn)
- Add feature mà không sửa class gốc (OCP)

---

## 5. Facade

### Định nghĩa
Cung cấp **interface đơn giản** che giấu hệ thống phức tạp bên trong. "Bộ mặt" đẹp ra ngoài, phức tạp ẩn bên trong.

### Ví dụ đời thường
Khởi động xe ô tô — bạn xoay chìa khóa (1 động tác). Bên trong: bơm xăng, bugi đánh lửa, piston nén, máy phát điện, ECU... 100+ component phối hợp.

### Code generic

```java
// Subsystems (phức tạp)
class CpuSystem { void freeze() { ... } void execute(int addr) { ... } }
class MemorySystem { void load(int addr, byte[] data) { ... } }
class DiskSystem { byte[] read(long sector, int size) { ... } }

// Facade
public class ComputerFacade {
    private final CpuSystem cpu = new CpuSystem();
    private final MemorySystem mem = new MemorySystem();
    private final DiskSystem disk = new DiskSystem();

    public void start() {  // 1 method gọi cho client
        cpu.freeze();
        byte[] bootData = disk.read(0, 1024);
        mem.load(0, bootData);
        cpu.execute(0);
    }
}

// Client:
new ComputerFacade().start();  // không cần biết CPU/RAM/Disk
```

### Trong CineX — ApiResponse<T> là Facade

```java
public class ApiResponse<T> {
    private boolean success;
    private String message;
    private String errorCode;
    private T data;

    public static <T> ApiResponse<T> ok(T data) { ... }
    public static <T> ApiResponse<T> error(String code, String msg) { ... }
}
```

Mọi response client nhận đều cùng format → FE chỉ xử lý 1 schema. Bên trong service có thể throw exception, return Optional, có complex logic — facade unify lại.

### Trong CineX — SecurityService
```java
@Service
public class SecurityService {
    public Long getCurrentUserId() { ... }
    public boolean isAdmin() { ... }
    public void requireAccessToTheater(Long theaterId) { ... }
}
```

Che giấu phức tạp của SecurityContextHolder + Authentication + UserDetails + JWT.

### Khi nào dùng?
- Module có nhiều subsystem phức tạp, client chỉ cần 1-2 operation
- Onboard dev mới — facade dễ học hơn 10 class internal

---

## 6. Flyweight

### Định nghĩa
Share object có state chung để tiết kiệm memory. Tách state thành **intrinsic** (share) + **extrinsic** (per-instance).

### Ví dụ đời thường
Trận đánh game có 1000 lính — mỗi lính có model 3D + texture + animation (intrinsic, share) + position + health (extrinsic, riêng).

Nếu mỗi lính clone full model → 1000 × 100MB = 100GB RAM. Flyweight: 1 model + 1000 lightweight reference + position.

### Code

```java
public class CharacterType {  // intrinsic (heavy, share)
    private String model3D;
    private String texture;
    private Animation animation;
    public CharacterType(...) { /* load 3D model */ }
    public void render(int x, int y, int health) { ... }
}

public class CharacterTypeFactory {
    private static Map<String, CharacterType> types = new HashMap<>();
    public static CharacterType get(String name) {
        return types.computeIfAbsent(name, k -> new CharacterType(...));
    }
}

public class Soldier {  // extrinsic (light, riêng)
    private int x, y, health;
    private CharacterType type;  // ← share

    public Soldier(String typeName, int x, int y) {
        this.type = CharacterTypeFactory.get(typeName);
        this.x = x; this.y = y; this.health = 100;
    }
    public void render() { type.render(x, y, health); }
}
```

### CineX chưa cần Flyweight
CineX scale hiện tại không phải vấn đề memory. Pattern này hữu ích cho game engine, ASCII rendering với hàng triệu glyph.

---

## 7. Proxy

### Định nghĩa
Object đại diện cho object khác — kiểm soát access tới object thật.

### 4 loại Proxy

| Loại | Mục đích | Ví dụ |
|---|---|---|
| **Virtual** | Lazy load object đắt | JPA `@OneToMany(LAZY)` |
| **Protection** | Kiểm tra quyền | Spring Security |
| **Remote** | Đại diện cho object trên server khác | RMI, gRPC client stub |
| **Smart** | Add behavior (logging, caching) | Spring AOP `@Cacheable` |

### Code generic — Protection Proxy

```java
public interface DocumentService {
    String readDocument(Long id);
}

public class RealDocumentService implements DocumentService {
    public String readDocument(Long id) {
        return database.find(id);  // expensive
    }
}

public class SecureDocumentProxy implements DocumentService {
    private final RealDocumentService real = new RealDocumentService();
    private final SecurityContext security;

    public String readDocument(Long id) {
        if (!security.hasPermission("READ", id))
            throw new AccessDeniedException();
        return real.readDocument(id);  // delegate
    }
}
```

Client gọi `proxy.readDocument(123)` → check quyền → delegate.

### Trong CineX

#### 7.1. JPA Lazy proxy

```java
@Entity
public class Booking {
    @ManyToOne(fetch = FetchType.LAZY)
    private User user;  // ← Hibernate inject lazy proxy
}

Booking b = bookingRepo.findById(1L).get();
b.getUser();  // ← proxy chưa load user
b.getUser().getFullName();  // ← LÚC NÀY mới query DB
```

Hibernate sinh `User$HibernateProxy$abc123` extends User → đè `getFullName()` → trigger SQL.

**Lazy proxy gotcha:**
```java
@Transactional
public Booking find(Long id) { return bookingRepo.findById(id).get(); }

// Bên ngoài transaction:
Booking b = service.find(1L);
b.getUser().getFullName();  // ← LazyInitializationException
```

Session đóng → proxy không có session để query → exception. Fix: `JOIN FETCH` hoặc force-init trong transaction.

#### 7.2. Spring AOP proxy (`@Transactional`, `@Async`, `@Cacheable`)

`@Service` → Spring sinh proxy class wrap real bean.

```
Caller → proxy → (apply aspect) → real bean
```

Sample aspect cho `@Cacheable`:
```
proxy.method(args) {
    if (cache.has(args)) return cache.get(args);
    result = real.method(args);
    cache.put(args, result);
    return result;
}
```

#### 7.3. Spring Data Repository proxy

```java
public interface MovieRepository extends JpaRepository<Movie, Long> {
    List<Movie> findByTitleContaining(String title);
}
```

Không viết implementation! Spring runtime sinh proxy `MovieRepository$Proxy` implement bằng cách parse method name → sinh JPQL.

### Khi nào dùng Proxy?
- Lazy initialization (object đắt)
- Access control
- Caching
- Logging/monitoring
- Remote object access

---

## 8. DTO (Data Transfer Object) — CineX extension

### Định nghĩa
Object **chỉ chứa data**, không có behavior, dùng để transfer giữa các tầng (Controller ↔ Service ↔ Client).

### Tại sao cần?
- **Bảo mật:** Không expose entity field nhạy cảm (password hash, version, audit)
- **Linh hoạt:** 1 entity → nhiều DTO (list view vs detail view)
- **Validation:** Request DTO có `@NotBlank`, `@Email` — tách validation khỏi entity
- **Decoupling:** Đổi entity schema không break API response

### Code XẤU (trả entity)

```java
@GetMapping("/api/users/{id}")
public User get(@PathVariable Long id) {
    return userRepo.findById(id).orElseThrow();
}
```

Response leak:
```json
{
  "id": 1,
  "username": "vanan",
  "password": "$2a$10$N9qo8...",   // ← LỘ password hash!
  "version": 3,
  "storageState": "ACTIVE",
  "createdAt": "...",
  "auditFields": "..."
}
```

### Code TỐT (DTO)

```java
@Getter @Builder
public class UserResponse {
    private Long id;
    private String username;
    private String email;
    private String fullName;
    private String avatarUrl;
    // KHÔNG có password, version, storageState
}

@GetMapping("/api/users/{id}")
public ApiResponse<UserResponse> get(@PathVariable Long id) {
    User user = userService.findById(id);
    return ApiResponse.ok(userMapper.toResponse(user));
}
```

### CineX DTO naming convention

| Suffix | Mục đích |
|---|---|
| `*Request` | Input từ client (POST/PUT body) |
| `*Response` | Output cho client |
| `*Filter` | Query params cho list endpoint |
| `*ListResponse` | Item trong list (light, ít field) |
| `*DetailResponse` | Detail view (full field) |

Ví dụ: `MovieCreateRequest`, `MovieResponse`, `MovieListResponse`, `MovieFilter`.

---

## 9. Repository — Domain abstraction

### Định nghĩa
Trừu tượng hóa data access — Service KHÔNG biết DB nào (SQL/NoSQL/in-memory).

### Spring Data JPA Repository

```java
public interface MovieRepository extends JpaRepository<Movie, Long>, JpaSpecificationExecutor<Movie> {
    Optional<Movie> findByCode(String code);
    List<Movie> findByGenresContaining(Genre genre);
    boolean existsByTitleIgnoreCase(String title);
}
```

Spring sinh proxy implement tự động dựa vào method name. Bạn KHÔNG viết SQL.

### Trong CineX
Mọi entity có repository: `MovieRepository`, `BookingRepository`, `UserRepository`...

### Khi nào KHÔNG đủ JPA Repository?
- Query phức tạp → dùng `@Query` JPQL hoặc `Specification`
- Bulk update → `@Modifying @Query`
- Performance critical → native query với `@Query(nativeQuery = true)`

---

## So sánh nhanh

| Pattern | Bài toán | CineX |
|---|---|---|
| Adapter | 3rd party SDK | Cloudinary, MoMo |
| Bridge | 2 dimension vary | Chưa cần |
| Composite | Tree structure | Chưa cần |
| Decorator | Add feature runtime | `@Transactional` proxy |
| Facade | Đơn giản hóa subsystem | `ApiResponse`, `SecurityService` |
| Flyweight | Save memory | Chưa cần |
| Proxy | Control access | JPA Lazy, Spring AOP |
| DTO | Tách layer | Mọi module |
| Repository | Abstract DB | Mọi module |

---

## Câu hỏi tự kiểm tra

1. **Decorator và Proxy khác gì?**
   → Decorator add behavior, đa lớp wrap; Proxy thường 1 lớp, focus control access (security, lazy load).

2. **Tại sao DTO không nên có behavior?**
   → DTO = transfer only. Có behavior → mix logic với data → khó test, vi phạm SRP. Behavior nên ở Service.

3. **Adapter và Facade khác gì?**
   → Adapter chuyển interface A → B (1-to-1). Facade đơn giản hóa nhiều subsystem (many-to-1).

4. **Spring proxy có downside gì?**
   → 1) Method `private`/`final` không proxy được. 2) Self-invocation không trigger aspect (gọi `this.method()` bypass proxy). 3) Stack trace dài thêm 1-2 frame.

5. **Lazy proxy JPA có vấn đề gì?**
   → `LazyInitializationException` khi access bên ngoài Session. Fix: `JOIN FETCH`, `@EntityGraph`, force-init, hoặc convert sang DTO trong transaction.

6. **Khi nào KHÔNG dùng Repository pattern?**
   → Script throwaway. Đối với app production, luôn nên có Repository để testable.

7. **Composite có cần cho Combo trong CineX?**
   → Hiện chưa. Combo là flat list snacks, không nested. Nếu sau này có "combo của combo" → cân nhắc Composite.
