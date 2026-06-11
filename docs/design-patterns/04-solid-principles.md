# SOLID Principles — 5 nguyên tắc thiết kế OOP

> Robert C. Martin (Uncle Bob) tổng hợp 5 nguyên tắc thiết kế class trong OOP. **SOLID** là viết tắt — học thuộc 5 chữ này, bạn viết code OOP tốt hơn 80% dev khác.

---

## TL;DR

| Chữ | Tên đầy đủ | Ý chính |
|---|---|---|
| **S** | Single Responsibility | Mỗi class chỉ làm 1 việc |
| **O** | Open/Closed | Mở để extend, đóng để modify |
| **L** | Liskov Substitution | Subclass thay thế parent không gãy |
| **I** | Interface Segregation | Nhiều interface nhỏ > 1 interface to |
| **D** | Dependency Inversion | Phụ thuộc abstraction, không phụ thuộc concrete |

---

## S — Single Responsibility Principle (SRP)

### Định nghĩa

> "A class should have only one reason to change." — Uncle Bob

Mỗi class chỉ chịu trách nhiệm về 1 thứ — nếu có 2 lý do để thay đổi class, tách thành 2 class.

### Ví dụ đời thường

Bếp trưởng nhà hàng — bếp trưởng chỉ nấu ăn, KHÔNG đi:
- Phục vụ (waiter)
- Tính tiền (cashier)
- Rửa bát (dishwasher)

4 vai trò → 4 người. Nếu 1 người gánh tất, mệt + dễ sai.

### Code XẤU (vi phạm SRP)

```java
public class UserService {

    public User register(RegisterRequest req) {
        // 1. Validate
        if (req.getEmail() == null || !req.getEmail().contains("@"))
            throw new IllegalArgumentException("Email invalid");

        // 2. Hash password
        String hashed = hashPassword(req.getPassword());

        // 3. Save DB
        User user = new User(req.getEmail(), hashed);
        Connection conn = DriverManager.getConnection("jdbc:...");
        PreparedStatement stmt = conn.prepareStatement("INSERT INTO users ...");
        stmt.execute();

        // 4. Send email
        Session session = Session.getInstance(props);
        Message msg = new MimeMessage(session);
        msg.setSubject("Welcome");
        Transport.send(msg);

        // 5. Log file
        FileWriter fw = new FileWriter("/var/log/app.log", true);
        fw.write("User registered: " + user.getEmail());
        fw.close();

        return user;
    }

    private String hashPassword(String plain) { ... }
}
```

**Có 5 lý do để class này thay đổi:**
1. Validation rule đổi → sửa class
2. Đổi thuật toán hash → sửa class
3. Đổi DB (MySQL → Postgres) → sửa class
4. Đổi cách gửi email → sửa class
5. Đổi log (File → Splunk) → sửa class

→ Vi phạm SRP nặng. Test khó (mock 5 thứ). Concurrent dev đụng nhau.

### Code TỐT (tuân thủ SRP)

```java
@Service @RequiredArgsConstructor
public class UserService {
    private final UserValidator validator;        // validation
    private final PasswordEncoder passwordEncoder; // hash
    private final UserRepository userRepository;   // DB access
    private final EmailService emailService;       // email
    private final AuditLogger auditLogger;         // log

    public User register(RegisterRequest req) {
        validator.validateRegistration(req);
        String hashed = passwordEncoder.encode(req.getPassword());
        User user = userRepository.save(new User(req.getEmail(), hashed));
        emailService.sendWelcome(user);
        auditLogger.logRegistration(user);
        return user;
    }
}
```

5 class với 5 trách nhiệm rõ ràng. Test từng cái dễ. Đổi DB chỉ sửa `UserRepository`.

### Trong CineX

- `BookingService` chỉ xử lý logic đặt vé
- `PaymentService` chỉ xử lý thanh toán
- `EmailService` chỉ gửi email
- `JwtUtil` chỉ generate/parse JWT
- `MovieMapper` chỉ map Entity ↔ DTO

→ Mỗi class < 300 dòng. Tách rõ ràng theo trách nhiệm.

### Anti-pattern: God class

```java
public class AppManager {
    public void doEverything() { ... }
    public void handleAllRequests() { ... }
    public void manageUsersBookingsPaymentsEmails() { ... }
}
```

Triệu chứng: 1 file 3000+ dòng, 50+ method, inject 15+ dependency.

### Khi nào KHÔNG nên tách quá?

- Class < 100 dòng + 1 trách nhiệm rõ ràng → đừng tách thêm
- Tách quá → nano-services hell, mỗi class 5 dòng → đọc khó vì phải nhảy qua 20 file

**Rule of thumb:** Tách khi 1 class có > 1 lý do để thay đổi. Đếm số "actor" (kế toán, dev frontend, dev backend, ops, security) — mỗi actor là 1 lý do.

---

## O — Open/Closed Principle (OCP)

### Định nghĩa

> "Software entities should be open for extension, but closed for modification." — Bertrand Meyer

Code đã viết → KHÔNG sửa. Thêm tính năng → viết thêm class mới.

### Ví dụ đời thường

Ổ cắm điện — bạn cắm thêm thiết bị mới (extension) mà KHÔNG cần đập tường lắp lại dây (modification).

### Code XẤU (vi phạm OCP)

```java
public class PaymentService {
    public void processPayment(Payment payment) {
        if (payment.getMethod() == PaymentMethod.MOMO) {
            momoClient.charge(payment);
        } else if (payment.getMethod() == PaymentMethod.VNPAY) {
            vnpayClient.charge(payment);
        } else if (payment.getMethod() == PaymentMethod.CASH) {
            // POS cash logic
        }
        // Thêm ZaloPay → SỬA class này → vi phạm OCP
    }
}
```

Thêm 1 payment method → sửa `processPayment()` → risk break MOMO/VNPAY hiện tại. Test phải retest cả 4.

### Code TỐT (tuân thủ OCP — Strategy Pattern)

```java
public interface PaymentProcessor {
    boolean supports(PaymentMethod method);
    void charge(Payment payment);
}

@Component
public class MoMoPaymentProcessor implements PaymentProcessor {
    public boolean supports(PaymentMethod m) { return m == PaymentMethod.MOMO; }
    public void charge(Payment p) { /* MoMo logic */ }
}

@Component
public class CashPaymentProcessor implements PaymentProcessor {
    public boolean supports(PaymentMethod m) { return m == PaymentMethod.CASH; }
    public void charge(Payment p) { /* Cash logic */ }
}

@Service @RequiredArgsConstructor
public class PaymentService {
    private final List<PaymentProcessor> processors;  // Spring inject mọi processor

    public void processPayment(Payment payment) {
        PaymentProcessor processor = processors.stream()
            .filter(p -> p.supports(payment.getMethod()))
            .findFirst()
            .orElseThrow(() -> new BusinessException(ErrorCode.PAYMENT_METHOD_NOT_SUPPORTED));
        processor.charge(payment);
    }
}
```

Thêm ZaloPay → tạo `ZaloPayProcessor implements PaymentProcessor` → Spring tự pick up → `PaymentService` KHÔNG SỬA.

### Trong CineX

- `PaymentProcessor` + 5 implementations (MoMo, VNPAY, CASH, CARD_POS, TRANSFER)
- `PricingRuleMatcher` — strategy theo `PricingRuleType` (DAY_OF_WEEK / HOUR_RANGE / DATE_RANGE / COMPOSITE)
- `*Specification` (MovieSpec, BookingSpec) — thêm filter mới → thêm predicate, không sửa Service

### Khi nào KHÔNG cần OCP?

- Code prototype/script throwaway
- 1 lần thay đổi duy nhất rồi không bao giờ đụng
- Đoán future không chắc → đừng over-engineer

**Rule of thumb:** Khi thấy mình đang viết if-else dài để phân loại behavior → có thể cần Strategy/OCP.

---

## L — Liskov Substitution Principle (LSP)

### Định nghĩa

> "Subtypes must be substitutable for their base types." — Barbara Liskov

Class con thay thế class cha mà code dùng cha vẫn chạy đúng. KHÔNG được break expectation.

### Ví dụ đời thường

Bạn thuê thợ điện. Bất kỳ thợ điện nào (Mr A, Mr B, Mr C) đến nhà — đều phải sửa được mạch điện theo tiêu chuẩn. Nếu Mr C đến và nói "tôi chỉ sửa được dây màu xanh" → vi phạm LSP — không thay thế được thợ điện chung.

### Code XẤU (vi phạm LSP — class kinh điển Rectangle/Square)

```java
public class Rectangle {
    protected int width, height;
    public void setWidth(int w) { this.width = w; }
    public void setHeight(int h) { this.height = h; }
    public int getArea() { return width * height; }
}

public class Square extends Rectangle {
    @Override
    public void setWidth(int w) {
        this.width = w;
        this.height = w;  // ép square: width = height
    }
    @Override
    public void setHeight(int h) {
        this.width = h;
        this.height = h;
    }
}

public void test(Rectangle r) {
    r.setWidth(5);
    r.setHeight(10);
    assert r.getArea() == 50;  // ← FAIL nếu r là Square (area = 100)
}
```

Square là Rectangle về toán học, nhưng KHÔNG thể substitute trong code → vi phạm LSP.

### Code TỐT (tuân thủ LSP)

```java
public interface Shape {
    int getArea();
}

public class Rectangle implements Shape {
    private final int width, height;
    public Rectangle(int w, int h) { this.width = w; this.height = h; }
    public int getArea() { return width * height; }
}

public class Square implements Shape {
    private final int side;
    public Square(int side) { this.side = side; }
    public int getArea() { return side * side; }
}
```

Cả 2 implement `Shape`, không kế thừa lẫn nhau → substitute ở mức Shape.

### Trong CineX

- `BaseEntity` chỉ thêm field chung (id, version, audit) — entity con KHÔNG override behavior → tuân thủ LSP
- `PaymentProcessor` implementations — ai cũng implement `charge()` đúng contract (throw nếu fail, không return null)

### Anti-pattern phổ biến: NotImplementedException

```java
public class ReadOnlyList<T> extends ArrayList<T> {
    @Override
    public boolean add(T element) {
        throw new UnsupportedOperationException("Read-only!");  // ← vi phạm LSP
    }
}
```

Code expect `List.add()` work → gặp `ReadOnlyList` → crash. Java's `Collections.unmodifiableList()` cũng vi phạm LSP — đó là tradeoff của Java collections.

### Rule of thumb để check LSP

- Precondition: subclass KHÔNG được strict hơn parent (KHÔNG được require thêm điều kiện)
- Postcondition: subclass KHÔNG được weak hơn parent (KHÔNG được trả ít kết quả hơn)
- Invariant: thuộc tính bất biến của parent phải giữ ở subclass

---

## I — Interface Segregation Principle (ISP)

### Định nghĩa

> "Clients should not be forced to depend on interfaces they don't use." — Uncle Bob

Interface to → client phải implement method không cần → tách interface nhỏ ra.

### Ví dụ đời thường

Máy đa năng (in + copy + scan + fax + email). Bạn chỉ cần PRINT.
- Mua máy đa năng → trả tiền cho 5 chức năng, hỏng 1 cái cả máy chậm
- Mua máy chỉ in → đúng nhu cầu

### Code XẤU (vi phạm ISP)

```java
public interface Worker {
    void work();
    void eat();
    void sleep();
}

public class Human implements Worker {
    public void work() { ... }
    public void eat() { ... }
    public void sleep() { ... }
}

public class Robot implements Worker {
    public void work() { ... }
    public void eat() {
        throw new UnsupportedOperationException("Robot doesn't eat!");
    }
    public void sleep() {
        throw new UnsupportedOperationException("Robot doesn't sleep!");
    }
}
```

Robot bị FORCE implement `eat()` và `sleep()` → vô nghĩa + vi phạm LSP luôn.

### Code TỐT (tuân thủ ISP — tách interface)

```java
public interface Workable { void work(); }
public interface Eatable { void eat(); }
public interface Sleepable { void sleep(); }

public class Human implements Workable, Eatable, Sleepable { ... }
public class Robot implements Workable { ... }  // chỉ work()
```

### Trong CineX

- `JpaRepository` thừa kế nhiều interface nhỏ (`PagingAndSortingRepository`, `CrudRepository`, `QueryByExampleExecutor`) — bạn dùng đúng cái cần
- `UserDetailsService` chỉ 1 method `loadUserByUsername` — interface nhỏ gọn

### Khi nào KHÔNG tách quá?

- Interface 5-7 method liên quan chặt chẽ → giữ là ok
- Tách quá → 20 interface 1 method → quản lý ác mộng

**Rule of thumb:** Khi 1 client implement interface mà phải throw `UnsupportedOperationException` → cần tách.

---

## D — Dependency Inversion Principle (DIP)

### Định nghĩa

> "High-level modules should not depend on low-level modules. Both should depend on abstractions."

Module cao cấp (Service) KHÔNG được phụ thuộc trực tiếp module thấp (Repository, External API). Cả 2 phụ thuộc abstraction (interface).

### Ví dụ đời thường

Bóng đèn cắm vào đui đèn (chuẩn E27). KHÔNG hàn cứng bóng đèn vào trần nhà.
- Đui đèn = abstraction
- Bóng đèn = implementation cụ thể
- Trần nhà = high-level module

Thay bóng (LED, sợi đốt, compact) → chỉ thay bóng, KHÔNG đập trần.

### Code XẤU (vi phạm DIP)

```java
public class OrderService {
    private MySqlOrderRepository repo = new MySqlOrderRepository();  // ← phụ thuộc concrete
    private SmtpEmailSender emailer = new SmtpEmailSender();          // ← phụ thuộc concrete

    public void placeOrder(Order order) {
        repo.save(order);
        emailer.send(order.getEmail(), "Order placed");
    }
}
```

Đổi MySQL → Postgres → sửa import + sửa class. Test phải mở thật MySQL.

### Code TỐT (tuân thủ DIP)

```java
public interface OrderRepository { void save(Order order); }
public interface EmailSender { void send(String to, String body); }

@Service @RequiredArgsConstructor
public class OrderService {
    private final OrderRepository repo;
    private final EmailSender emailer;

    public void placeOrder(Order order) {
        repo.save(order);
        emailer.send(order.getEmail(), "Order placed");
    }
}

@Repository
public class MySqlOrderRepository implements OrderRepository { ... }

@Component
public class SmtpEmailSender implements EmailSender { ... }
```

Đổi DB → chỉ thêm `PostgresOrderRepository implements OrderRepository`. `OrderService` không touch.

### Spring Boot enforce DIP

Spring DI framework chính là implementation của DIP:
- `@Autowired` / constructor injection inject INTERFACE, not concrete
- Spring tự chọn `@Component` matching interface

### Trong CineX

- `UserDetailsService` (interface) implemented by `CustomUserDetailsService`
- `PasswordEncoder` (interface) implemented by `BCryptPasswordEncoder`
- `PaymentProcessor` (interface) — 5 implementations
- Controller inject `SecurityService` (interface), không inject `UserRepository` trực tiếp

### Anti-pattern: Service inject Repository xuyên module

```java
@Service
public class BookingService {
    private final BookingRepository bookingRepo;
    private final PaymentRepository paymentRepo;  // ← vi phạm: cross-module via Repo
    private final EmailRepository emailRepo;
}
```

Cross-module phải qua Service:
```java
@Service
public class BookingService {
    private final BookingRepository bookingRepo;       // same module — OK
    private final PaymentService paymentService;       // cross-module via Service
    private final EmailService emailService;
}
```

---

## So sánh 5 nguyên tắc

| Nguyên tắc | Trả lời câu hỏi gì? | Pattern liên quan |
|---|---|---|
| **S**RP | Class này có nhiều trách nhiệm không? | Tách class |
| **O**CP | Thêm feature có phải sửa code cũ? | Strategy, Template Method |
| **L**SP | Subclass thay thế parent OK không? | Inheritance đúng cách |
| **I**SP | Client phải implement method không dùng? | Tách interface |
| **D**IP | Code cấp cao có phụ thuộc cấp thấp? | DI, abstraction |

---

## Case study: Refactor 1 service tuân thủ SOLID

### Before — code xấu

```java
public class BookingService {
    public Booking createBooking(BookingRequest req) {
        // SRP fail: validate, business, DB, email tất trong 1 method
        if (req.getSeatIds().size() > 8) throw new RuntimeException("Max 8 seats");

        // OCP fail: thêm payment method → sửa if-else
        if (req.getPaymentMethod() == PaymentMethod.MOMO) {
            // call MoMo
        } else if (req.getPaymentMethod() == PaymentMethod.CASH) {
            // cash logic
        }

        // DIP fail: phụ thuộc concrete
        Connection conn = DriverManager.getConnection("jdbc:...");

        SmtpClient.send("...");

        return booking;
    }
}
```

### After — SOLID-compliant

```java
@Service
@RequiredArgsConstructor
public class BookingService {
    private final BookingValidator validator;            // SRP — tách validation
    private final BookingRepository bookingRepository;   // DIP — abstraction
    private final SeatHoldService seatHoldService;       // SRP — tách hold logic
    private final List<PaymentProcessor> paymentProcessors;  // OCP — open for extension
    private final ApplicationEventPublisher events;      // SRP — tách side effects

    @Transactional
    public Booking createBooking(BookingRequest req) {
        validator.validate(req);                              // SRP
        seatHoldService.holdSeats(req.getShowtimeId(), req.getSeatIds());
        Booking booking = bookingRepository.save(buildBooking(req));
        getProcessor(req.getPaymentMethod()).charge(booking); // OCP via Strategy
        events.publishEvent(new BookingCreatedEvent(booking)); // SRP — email async
        return booking;
    }

    private PaymentProcessor getProcessor(PaymentMethod method) {
        return paymentProcessors.stream()
            .filter(p -> p.supports(method))
            .findFirst().orElseThrow();
    }
}
```

5 nguyên tắc đều được tuân thủ:
- SRP: tách validate, hold, save, charge, email
- OCP: thêm payment → tạo `*Processor` mới
- LSP: mọi PaymentProcessor implementation work as expected
- ISP: PaymentProcessor interface chỉ `supports()` + `charge()`
- DIP: inject abstraction qua Spring

---

## Câu hỏi tự kiểm tra

1. **SRP nói "1 class 1 việc" — vậy `UserService` có nhiều method `register/login/updateProfile/changePassword` có vi phạm không?**
   → Không. SRP là 1 lý do thay đổi, không phải 1 method. Cả 4 method đều liên quan user lifecycle → cùng actor (Auth team) quản lý → OK.

2. **OCP nói "đóng để modify" — vậy fix bug có vi phạm không?**
   → Không. OCP là cho new feature. Fix bug có thể (và NÊN) sửa code cũ.

3. **LSP — `LinkedList extends ArrayList` có vi phạm không?**
   → Sai khái niệm: cả 2 đều implement `List`. Không kế thừa lẫn nhau. Đúng LSP.

4. **ISP — Spring `JpaRepository` rất to (20+ method) — có vi phạm ISP không?**
   → Có, nhưng tradeoff. Nếu chỉ cần `findById` mà phải implement 20 method → vi phạm. Spring giải quyết bằng `default method` + repo tự sinh proxy → không phải implement tay.

5. **DIP vs Dependency Injection — khác gì?**
   → DIP là nguyên tắc (depend on abstraction). DI là kỹ thuật (Spring inject bean). Spring DI implement DIP.

6. **Khi nào KHÔNG tuân thủ SOLID?**
   → Throwaway script, prototype, hackathon. SOLID có cost (nhiều class, indirection). Cho production code lâu dài thì xứng đáng.

7. **Tại sao SOLID quan trọng cho team work?**
   → SRP/OCP → ít conflict khi merge. DIP → mock dễ → test parallel. ISP → API rõ ràng → onboarding nhanh.
