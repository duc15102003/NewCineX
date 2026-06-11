# Creational Patterns — Nhóm tạo đối tượng

> 5 pattern GoF cho bài toán **tạo object**: làm sao tạo linh hoạt, không phụ thuộc concrete class, dễ test, dễ extend.

| Pattern | Mục đích chính | CineX dùng ở đâu |
|---|---|---|
| **Singleton** | 1 class chỉ có 1 instance | Spring `@Service`, `@Repository` (scope mặc định) |
| **Factory Method** | Subclass quyết định tạo gì | `PaymentProcessorFactory` |
| **Abstract Factory** | Factory cho cả family object | (CineX chưa cần — ví dụ minh họa) |
| **Builder** | Build object phức tạp từng bước | Lombok `@Builder` mọi DTO/entity |
| **Prototype** | Clone object thay vì tạo mới | (ít dùng) |

---

## 1. Singleton

### Định nghĩa
Đảm bảo 1 class chỉ có **đúng 1 instance** trong toàn app, expose qua 1 access point global.

### Ví dụ đời thường
Tổng thống của 1 nước — chỉ có 1 người tại 1 thời điểm. Mọi văn bản chính phủ tham chiếu cùng 1 tổng thống.

### Class diagram
```
┌───────────────────┐
│ Singleton         │
├───────────────────┤
│ - instance: self  │ ← static
│ - Singleton()     │ ← private constructor
├───────────────────┤
│ + getInstance()   │ ← static accessor
└───────────────────┘
```

### Implementation 1: Eager (thread-safe by default)

```java
public class DatabaseConfig {
    private static final DatabaseConfig INSTANCE = new DatabaseConfig();

    private DatabaseConfig() { /* private constructor — không cho new */ }

    public static DatabaseConfig getInstance() {
        return INSTANCE;
    }
}
```

Pros: Thread-safe nhờ JVM class loader. Đơn giản.
Cons: Khởi tạo lúc load class (không lazy).

### Implementation 2: Lazy + double-checked locking

```java
public class HeavyConfig {
    private static volatile HeavyConfig instance;

    private HeavyConfig() { }

    public static HeavyConfig getInstance() {
        if (instance == null) {
            synchronized (HeavyConfig.class) {
                if (instance == null) {
                    instance = new HeavyConfig();
                }
            }
        }
        return instance;
    }
}
```

`volatile` ngăn JVM reorder write → đảm bảo các thread thấy instance đầy đủ khởi tạo.

### Implementation 3: Enum (best practice)

```java
public enum SingletonEnum {
    INSTANCE;

    public void doSomething() { ... }
}

// Dùng: SingletonEnum.INSTANCE.doSomething();
```

Pros: Thread-safe + serialization-safe + reflection-safe (chống hack).
Cons: Không lazy (eager init).

### Trong CineX — Spring quản lý Singleton

```java
@Service  // ← Spring scope mặc định = Singleton
public class BookingService { ... }

@Repository
public interface BookingRepository extends JpaRepository<Booking, Long> { }

@Component
public class JwtUtil { ... }
```

Mọi `@Service`, `@Repository`, `@Controller`, `@Component` mặc định scope **singleton** — Spring tạo 1 instance, inject vào nơi cần. KHÔNG cần code Singleton tay.

### Khi nào KHÔNG nên dùng Singleton?

- **Khi cần test:** Singleton tay → khó mock → test khó. Spring singleton dễ mock vì inject qua interface.
- **Khi state khác nhau cho mỗi request:** dùng `@Scope("request")` hoặc `@Scope("prototype")`.
- **Khi multi-thread share mutable state:** rất dễ race condition.

### Anti-pattern: Singleton là Global State

```java
public class GlobalConfig {
    public static int maxConnections = 10;  // ← mutable static = global state
}
```

`maxConnections` đổi ở 1 nơi → ảnh hưởng toàn app → khó debug. Singleton chuẩn phải IMMUTABLE.

---

## 2. Factory Method

### Định nghĩa
Định nghĩa interface tạo object, **subclass quyết định class cụ thể** nào được tạo. Tách caller khỏi `new` cụ thể.

### Ví dụ đời thường
Hãng pizza: "Pizza Factory" — bạn gọi "pizza hải sản" → nhà bếp tự chọn nguyên liệu + cách làm. Bạn KHÔNG cần biết bếp xài bột mì A hay B.

### Class diagram
```
┌──────────────┐         ┌─────────────┐
│ Creator      │ creates │ Product     │
│              │────────▶│  (interface)│
│ + factory()  │         └──────┬──────┘
└──────┬───────┘                │
       │ extends                │ implements
       ▼                        ▼
┌──────────────┐         ┌─────────────┐
│ ConcreteCreat│ creates │ ConcreteProd│
└──────────────┘         └─────────────┘
```

### Code generic

```java
public interface Notification {
    void send(String to, String body);
}

public class EmailNotification implements Notification {
    public void send(String to, String body) { /* SMTP */ }
}

public class SmsNotification implements Notification {
    public void send(String to, String body) { /* Twilio */ }
}

public class PushNotification implements Notification {
    public void send(String to, String body) { /* FCM */ }
}

public class NotificationFactory {
    public static Notification create(NotificationType type) {
        return switch (type) {
            case EMAIL -> new EmailNotification();
            case SMS -> new SmsNotification();
            case PUSH -> new PushNotification();
        };
    }
}

// Caller không cần biết class cụ thể:
Notification n = NotificationFactory.create(NotificationType.EMAIL);
n.send("user@example.com", "Hello");
```

### Trong CineX — PaymentProcessorFactory

```java
@Component
@RequiredArgsConstructor
public class PaymentProcessorFactory {
    private final List<PaymentProcessor> processors;  // Spring inject mọi @Component

    public PaymentProcessor getProcessor(PaymentMethod method) {
        return processors.stream()
            .filter(p -> p.supports(method))
            .findFirst()
            .orElseThrow(() -> new BusinessException(ErrorCode.PAYMENT_METHOD_NOT_SUPPORTED));
    }
}

// Sử dụng trong PaymentService:
PaymentProcessor processor = factory.getProcessor(payment.getMethod());
processor.charge(payment);
```

`PaymentService` KHÔNG biết tồn tại `MoMoPaymentProcessor` hay `CashPaymentProcessor` — chỉ dùng interface.

### Trước khi có Factory (code xấu)

```java
public class PaymentService {
    public void process(Payment p) {
        if (p.getMethod() == PaymentMethod.MOMO) new MoMoClient().charge(p);
        else if (p.getMethod() == PaymentMethod.CASH) new CashHandler().process(p);
        // ...
    }
}
```

Mỗi lần thêm method → sửa class. Hard-coded `new` → khó test.

### Khi nào dùng Factory Method?

- Tạo object phức tạp (cần setup nhiều dependency)
- Loại object tạo phụ thuộc runtime parameter
- Muốn ẩn việc tạo (caller không cần biết constructor)

### Khi nào KHÔNG cần?

- Tạo object đơn giản (`new User(...)`) → đừng wrap factory
- Chỉ có 1 implementation → factory thừa

---

## 3. Abstract Factory

### Định nghĩa
Tạo **family** các object liên quan, không cần biết concrete class. Mở rộng của Factory Method — Factory tạo 1 thứ, Abstract Factory tạo nhiều thứ cùng family.

### Ví dụ đời thường
Cửa hàng nội thất — bạn chọn style "Bắc Âu" → tự động được bàn + ghế + đèn + giường THEO style Bắc Âu (consistent set). Chọn "Industrial" → set khác hoàn toàn.

### Class diagram
```
┌──────────────────────┐
│ AbstractFactory      │
├──────────────────────┤
│ createChair()        │
│ createTable()        │
│ createLamp()         │
└────────┬─────────────┘
         │
   ┌─────┴─────┐
   ▼           ▼
┌─────────┐ ┌─────────┐
│ NordicF │ │ IndustF │
└─────────┘ └─────────┘
```

### Code generic

```java
// Family: UI widgets cho 2 OS
public interface Button { void render(); }
public interface Checkbox { void render(); }

public class MacButton implements Button { public void render() { /* Mac style */ } }
public class WindowsButton implements Button { public void render() { /* Win style */ } }
public class MacCheckbox implements Checkbox { ... }
public class WindowsCheckbox implements Checkbox { ... }

public interface GuiFactory {
    Button createButton();
    Checkbox createCheckbox();
}

public class MacGuiFactory implements GuiFactory {
    public Button createButton() { return new MacButton(); }
    public Checkbox createCheckbox() { return new MacCheckbox(); }
}

public class WindowsGuiFactory implements GuiFactory {
    public Button createButton() { return new WindowsButton(); }
    public Checkbox createCheckbox() { return new WindowsCheckbox(); }
}

// App chỉ làm việc với abstraction
public class App {
    private final GuiFactory factory;
    public App(GuiFactory factory) { this.factory = factory; }

    public void render() {
        Button btn = factory.createButton();
        Checkbox cb = factory.createCheckbox();
        btn.render();
        cb.render();
    }
}
```

Chạy Mac → inject `MacGuiFactory`. Chạy Windows → inject `WindowsGuiFactory`. UI tự đồng bộ style.

### CineX chưa cần Abstract Factory (cảnh báo over-engineering)

CineX chưa có case cần family objects. Nếu sau này có:
- Theme builder (dark theme set vs light theme set) → ok
- Multi-tenant per-region (region VN dùng MoMo + VietQR; region US dùng Stripe + ACH) → có thể cần

### Phân biệt Factory Method vs Abstract Factory

| Factory Method | Abstract Factory |
|---|---|
| Tạo 1 loại object | Tạo nhiều loại liên quan (family) |
| 1 method | Nhiều method |
| Hierarchy: Creator + Product | Hierarchy: AbstractFactory + Family of Products |
| `PaymentProcessorFactory.create(MOMO)` | `GuiFactory.createButton() + .createCheckbox() + .createMenu()` |

---

## 4. Builder

### Định nghĩa
Tạo object phức tạp **từng bước**, tách khỏi đại diện. Dùng khi constructor có quá nhiều tham số.

### Ví dụ đời thường
Đặt burger ở Burger King:
- Chọn loại bánh (whole wheat / sesame / pretzel)
- Chọn thịt (beef / chicken / veggie)
- Chọn rau (lettuce / tomato / pickle / onion)
- Chọn sốt (mayo / ketchup / mustard / BBQ)

Từng bước. Không cần nói liền 1 câu `burger("wheat", "beef", "lettuce,tomato", "mayo")` — quên thứ tự là sai.

### Code XẤU (constructor explosion)

```java
public User(String username, String email, String password, String fullName,
            String phone, String avatar, LocalDate dob, Role role, boolean enabled,
            String address, String city, String country, String zipCode) {
    // 13 tham số!
}

// Caller phải nhớ thứ tự:
new User("vanan", "an@x.com", "hashed", "Vũ Tường An", "0912...", null,
         LocalDate.of(2000,1,1), Role.USER, true, "123 Lê Lợi", "HN", "VN", "100000");
// Đổi thứ tự 2 tham số String? → bug runtime, compile vẫn pass
```

### Code TỐT — Builder Pattern

```java
public class User {
    private String username, email, password, fullName, phone;
    private LocalDate dob;
    private Role role;
    // ... 

    private User() { } // hidden

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private User user = new User();

        public Builder username(String v) { user.username = v; return this; }
        public Builder email(String v) { user.email = v; return this; }
        public Builder password(String v) { user.password = v; return this; }
        public Builder fullName(String v) { user.fullName = v; return this; }
        public Builder phone(String v) { user.phone = v; return this; }
        public Builder dob(LocalDate v) { user.dob = v; return this; }
        public Builder role(Role v) { user.role = v; return this; }

        public User build() {
            // Validate ở đây
            if (user.username == null) throw new IllegalStateException("username required");
            return user;
        }
    }
}

// Sử dụng — readable, không nhầm thứ tự:
User user = User.builder()
    .username("vanan")
    .email("an@x.com")
    .password(encode("123456"))
    .fullName("Vũ Tường An")
    .role(Role.USER)
    .build();
```

### Lombok @Builder — sinh code tự động

```java
@Builder
@Getter
public class User {
    private String username;
    private String email;
    // ...
}
```

Lombok sinh inner class `UserBuilder` đúng pattern trên. Không phải viết tay.

### Variants

#### 4.1. Step Builder — bắt buộc thứ tự (fluent step)

```java
User.builder()
    .firstStep()  // require username
        .username("vanan")
    .secondStep()  // require email
        .email("an@x.com")
    .optionalStep()  // optional
        .phone("0912...")
    .build();
```

Phức tạp hơn @Builder thường, nhưng compile-time bắt buộc bước nào trước bước nào.

#### 4.2. @Builder(toBuilder = true) — clone with modification

```java
User updated = existingUser.toBuilder()
    .fullName("Tên mới")
    .build();
```

Lombok sinh `toBuilder()` → clone instance + cho modify field cụ thể.

### Trong CineX

Hầu hết DTO/entity dùng `@Builder`:
- `User.builder()`
- `Movie.builder()`
- `Booking.builder()`
- `ApiResponse.builder()`
- `AuthResponse.builder()`

### Khi nào KHÔNG cần Builder?

- Object 1-2 field → constructor ngắn gọn hơn
- Tất cả field bắt buộc → constructor + validation tốt hơn
- Immutable record với ít field → Java `record` đủ

```java
public record Point(int x, int y) { }  // không cần builder
```

---

## 5. Prototype

### Định nghĩa
Clone object có sẵn thay vì `new` mới. Hữu ích khi tạo object tốn kém (query DB, network, computation).

### Ví dụ đời thường
Photocopy — bạn có 1 bản gốc, scan 100 bản giống hệt. KHÔNG cần đánh máy lại từ đầu.

### Code

```java
public class Movie implements Cloneable {
    private String title;
    private List<String> genres = new ArrayList<>();

    @Override
    public Movie clone() {
        try {
            Movie copy = (Movie) super.clone();
            copy.genres = new ArrayList<>(this.genres);  // deep copy list
            return copy;
        } catch (CloneNotSupportedException e) {
            throw new AssertionError(e);
        }
    }
}

// Sử dụng:
Movie template = new Movie("Action Template", List.of("Action"));
Movie movie1 = template.clone();
movie1.setTitle("John Wick 5");
Movie movie2 = template.clone();
movie2.setTitle("Fast 12");
```

### Shallow vs Deep clone

- **Shallow**: `super.clone()` copy field, nhưng field reference vẫn point cùng object → sửa list ở clone ảnh hưởng original
- **Deep**: clone tất reference field — như example trên

### CineX hiếm khi cần

CineX dùng JPA Entity — clone entity dễ break (id duplicate, version conflict). Pattern này phổ biến hơn trong game dev (clone enemy template), graphic editor (clone shape).

### Alternative: Copy constructor

```java
public Movie(Movie other) {
    this.title = other.title;
    this.genres = new ArrayList<>(other.genres);
}

Movie copy = new Movie(original);
```

Đơn giản hơn `Cloneable` interface (Cloneable có nhiều gotcha).

---

## So sánh nhanh

| Pattern | Bài toán | CineX dùng? |
|---|---|---|
| Singleton | 1 instance toàn app | ✅ Spring quản lý mặc định |
| Factory Method | Tách caller khỏi `new` cụ thể | ✅ PaymentProcessorFactory |
| Abstract Factory | Tạo family related objects | ❌ chưa cần |
| Builder | Object phức tạp, nhiều field | ✅ Lombok @Builder mọi nơi |
| Prototype | Clone object đắt | ❌ ít dùng |

---

## Câu hỏi tự kiểm tra

1. **Tại sao Spring `@Service` mặc định singleton, không phải prototype?**
   → Vì service stateless — gọi method nào cũng vậy. Singleton tiết kiệm memory + tăng performance. Prototype dùng khi cần state riêng mỗi inject (vd `@Scope("request")` cho session data).

2. **Builder và constructor cái nào nên dùng?**
   → Field ≤ 3 + bắt buộc tất → constructor. Field ≥ 4 hoặc nhiều optional → Builder.

3. **Factory Method khác Abstract Factory ở đâu?**
   → Factory Method tạo 1 product. Abstract Factory tạo nhiều product cùng family.

4. **Tại sao Singleton enum được khuyến khích nhất?**
   → Thread-safe, serialization-safe, reflection-proof (không bị hack qua reflection để tạo instance thứ 2).

5. **Prototype có vấn đề gì với JPA Entity?**
   → Clone entity → `id` duplicate → save bị conflict UNIQUE constraint. Hoặc detach từ Persistence Context → bug runtime.

6. **`new` operator có gì xấu mà phải dùng Factory?**
   → `new` ràng buộc class cụ thể. Khó test (không mock được `new`). Vi phạm OCP nếu sau này thay class.

7. **Lombok @Builder có downside gì?**
   → Builder sinh không validate required field — phải tự check trong `build()`. Cảnh báo: builder cho phép tạo object thiếu field bắt buộc.
