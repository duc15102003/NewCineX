# Behavioral Patterns — Nhóm hành vi

> 11 pattern GoF cho bài toán **giao tiếp giữa các object** — phân chia trách nhiệm, message passing, encapsulate algorithm.

| Pattern | Mục đích | CineX dùng? |
|---|---|---|
| **Strategy** | Đổi thuật toán runtime | ✅ PaymentProcessor, PricingRuleMatcher |
| **Observer** | Pub/sub event | ✅ Spring Events (BookingCreated, PaymentCompleted) |
| **State** | Object đổi hành vi theo state | ✅ BookingStatus state machine |
| **Template Method** | Skeleton algorithm, subclass điền chi tiết | ✅ BaseEntity audit |
| **Chain of Responsibility** | Chuỗi handler xử lý request | ✅ Spring Filter chain |
| **Command** | Encapsulate request thành object | ✅ Spring Events implicit |
| **Iterator** | Duyệt collection mà không lộ internal | ✅ Java Iterable |
| **Mediator** | Object trung gian giảm coupling | (CineX chưa cần) |
| **Memento** | Capture state để undo | (CineX chưa cần) |
| **Visitor** | Thêm operation cho cấu trúc cố định | (CineX chưa cần) |
| **Interpreter** | Định nghĩa grammar + interpreter | (CineX chưa cần) |

---

## 1. Strategy

### Định nghĩa
Định nghĩa **family of algorithms**, encapsulate mỗi cái thành class, **đổi runtime**.

### Ví dụ đời thường
App Grab tính fare — có nhiều thuật toán: GrabBike, GrabCar, GrabPremium, GrabSurge. User chọn loại → app gọi đúng thuật toán.

### Class diagram
```
┌──────────┐  uses  ┌──────────────┐
│ Context  │───────▶│  Strategy    │
└──────────┘        │  (interface) │
                    └──────┬───────┘
                           │
                  ┌────────┼────────┐
                  ▼        ▼        ▼
              StrategyA StrategyB StrategyC
```

### Code generic

```java
public interface TaxStrategy {
    BigDecimal calculate(BigDecimal income);
}

public class VietnamTax implements TaxStrategy {
    public BigDecimal calculate(BigDecimal income) {
        // VN progressive tax
        return income.multiply(new BigDecimal("0.1"));
    }
}

public class UsaTax implements TaxStrategy {
    public BigDecimal calculate(BigDecimal income) {
        // US tax bracket
        return income.multiply(new BigDecimal("0.22"));
    }
}

public class SalaryService {
    private final TaxStrategy taxStrategy;

    public SalaryService(TaxStrategy taxStrategy) {
        this.taxStrategy = taxStrategy;
    }

    public BigDecimal netSalary(BigDecimal gross) {
        BigDecimal tax = taxStrategy.calculate(gross);
        return gross.subtract(tax);
    }
}

// Chọn runtime:
SalaryService vn = new SalaryService(new VietnamTax());
SalaryService us = new SalaryService(new UsaTax());
```

### Trong CineX

**Payment processor strategy:**
```java
public interface PaymentProcessor {
    boolean supports(PaymentMethod method);
    void charge(Payment payment);
}

@Component public class MoMoPaymentProcessor implements PaymentProcessor { ... }
@Component public class CashPaymentProcessor implements PaymentProcessor { ... }
@Component public class CardPosPaymentProcessor implements PaymentProcessor { ... }
@Component public class TransferPaymentProcessor implements PaymentProcessor { ... }
@Component public class VnpayPaymentProcessor implements PaymentProcessor { ... }
```

`PaymentService` gọi đúng strategy theo `payment.method`.

**Pricing rule matcher strategy:**
```java
public class PricingRuleMatcher {
    public static boolean matches(PricingRule rule, LocalDateTime start) {
        return switch (rule.getRuleType()) {
            case DAY_OF_WEEK -> matchesDayOfWeek(rule, start);
            case HOUR_RANGE  -> matchesHourRange(rule, start);
            case DATE_RANGE  -> matchesDateRange(rule, start);
            case COMPOSITE   -> matchesAll(rule, start);
        };
    }
}
```

### Khi nào dùng Strategy?
- Nhiều thuật toán làm cùng việc nhưng cách khác
- Cần đổi runtime
- Tránh if-else dài (replace conditional with polymorphism)

### Khi nào KHÔNG cần?
- Chỉ 1 thuật toán → Strategy thừa
- Thuật toán không bao giờ đổi → hardcode

### Strategy vs State

| Strategy | State |
|---|---|
| Đổi thuật toán bởi caller | Object tự đổi state |
| Stateless | Stateful, có history |
| Vd: payment method | Vd: booking status flow |

---

## 2. Observer (Pub/Sub)

### Định nghĩa
Khi 1 object đổi state, **tự động thông báo** mọi observer phụ thuộc.

### Ví dụ đời thường
YouTube subscribe — bạn sub kênh A → channel A upload video mới → YouTube đẩy notification về bạn. Channel A KHÔNG biết bạn là ai, chỉ gọi `notifySubscribers()`.

### Class diagram
```
┌──────────────┐          ┌──────────────┐
│ Subject      │ notifies │ Observer     │
│ - observers  │─────────▶│ + update()   │
│ + subscribe()│ (many)   └──────────────┘
│ + notify()   │                 ▲
└──────────────┘                 │ implements
                        ┌────────┴────────┐
                   EmailNotif       PushNotif
```

### Code generic

```java
public interface Observer {
    void onEvent(String event);
}

public class EventBus {
    private List<Observer> observers = new ArrayList<>();

    public void subscribe(Observer o) { observers.add(o); }

    public void publish(String event) {
        for (Observer o : observers) o.onEvent(event);
    }
}

public class EmailNotifier implements Observer {
    public void onEvent(String event) { /* send email */ }
}

public class PushNotifier implements Observer {
    public void onEvent(String event) { /* FCM push */ }
}

// Setup:
EventBus bus = new EventBus();
bus.subscribe(new EmailNotifier());
bus.subscribe(new PushNotifier());
bus.publish("USER_REGISTERED");  // cả 2 chạy
```

### Trong CineX — Spring Events

```java
// Event class
public class PaymentCompletedEvent {
    private final Payment payment;
    public PaymentCompletedEvent(Payment p) { this.payment = p; }
    public Payment getPayment() { return payment; }
}

// Publisher
@Service @RequiredArgsConstructor
public class PaymentService {
    private final ApplicationEventPublisher publisher;

    @Transactional
    public void completePayment(Payment p) {
        // ... process ...
        publisher.publishEvent(new PaymentCompletedEvent(p));  // ← publish
    }
}

// Listeners (n cái — Spring scan tự động)
@Component
public class NotificationListener {
    @EventListener
    @Async
    public void onPayment(PaymentCompletedEvent event) { /* create notification */ }
}

@Component
public class EmailListener {
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    public void sendReceipt(PaymentCompletedEvent event) { /* send email */ }
}

@Component
public class LoyaltyListener {
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void earnPoints(PaymentCompletedEvent event) { /* +loyalty points */ }
}
```

**Lợi ích:** `PaymentService` KHÔNG biết có những listener nào. Thêm tính năng mới → tạo listener mới, không touch publisher.

### `@TransactionalEventListener(AFTER_COMMIT)` — pattern quan trọng

Đảm bảo listener chỉ chạy SAU khi transaction commit thành công. Tránh:
- Gửi email rồi transaction rollback → user nhận email cho booking không tồn tại
- Trừ điểm loyalty rồi rollback → user mất điểm vô lý

### Khi nào dùng Observer?
- Side effects nhiều, không liên quan business chính
- Decouple producer/consumer
- Plugin architecture

### Khi nào KHÔNG?
- Cần result của listener → Observer fire-and-forget, không return
- Listener phải sync chạy → dùng method call thường

---

## 3. State

### Định nghĩa
Object đổi **behavior theo state hiện tại** — như có nhiều class khác nhau theo state.

### Ví dụ đời thường
ATM:
- State READY: cho nhập thẻ
- State CARD_INSERTED: cho nhập PIN
- State PIN_VERIFIED: cho chọn rút tiền
- State OUT_OF_CASH: từ chối withdraw

Cùng action `withdraw()` — behavior khác theo state.

### Class diagram
```
┌──────────────┐  has-a  ┌──────────────┐
│ Context      │────────▶│  State       │
│ - state      │         │  (interface) │
│ + setState() │         └──────┬───────┘
└──────────────┘                │
                       ┌────────┼────────┐
                       ▼        ▼        ▼
                    StateA  StateB  StateC
```

### Trong CineX — Booking state machine

```java
public enum BookingStatus {
    HOLDING,       // user vừa chọn ghế (TTL 10 phút)
    CONFIRMED,     // thanh toán xong
    CHECKED_IN,    // đã quẹt vé vào rạp
    EXPIRED,       // HOLDING quá hạn
    CANCELLED,     // user/admin hủy
    REJECTED       // POS từ chối vì không đủ tuổi
}
```

Transitions hợp lệ:
```
HOLDING ──confirm──▶ CONFIRMED ──checkIn──▶ CHECKED_IN
   │                    │
   │ timeout            │ cancel
   ▼                    ▼
EXPIRED              CANCELLED

CONFIRMED ──reject──▶ REJECTED (POS từ chối age)
```

Service enforce:
```java
public Booking confirmBooking(Long id) {
    Booking b = bookingRepository.findById(id).orElseThrow();
    if (b.getStatus() != BookingStatus.HOLDING)
        throw new BusinessException(ErrorCode.INVALID_BOOKING_STATUS);
    b.setStatus(BookingStatus.CONFIRMED);
    return bookingRepository.save(b);
}
```

### State vs Strategy
- **Strategy:** thuật toán đổi bởi caller (chọn cách thanh toán)
- **State:** object tự đổi state nội bộ (booking tự chuyển HOLDING → CONFIRMED)

### Khi nào dùng?
- Object có lifecycle rõ ràng nhiều state
- Behavior khác nhau rõ rệt theo state
- Cần audit transition (log từ state nào → state nào)

---

## 4. Template Method

### Định nghĩa
Định nghĩa **skeleton** của algorithm trong base class, subclass điền chi tiết. "Đừng gọi tôi, tôi gọi bạn" (Hollywood principle).

### Ví dụ đời thường
Quy trình pha cà phê:
1. Đun nước → bước chung
2. Bỏ bột → khác nhau (Americano vs Latte)
3. Đổ ra ly → bước chung
4. Thêm topping → khác nhau

Class cha định nghĩa 4 bước; subclass override bước 2 và 4.

### Code generic

```java
public abstract class Beverage {
    public final void prepare() {  // ← Template Method (final, không cho override)
        boilWater();
        brew();          // hook 1
        pourInCup();
        addCondiments(); // hook 2
    }

    protected void boilWater() { System.out.println("Đun nước"); }
    protected void pourInCup() { System.out.println("Đổ ra ly"); }

    protected abstract void brew();
    protected abstract void addCondiments();
}

public class Tea extends Beverage {
    protected void brew() { System.out.println("Pha trà"); }
    protected void addCondiments() { System.out.println("Thêm chanh"); }
}

public class Coffee extends Beverage {
    protected void brew() { System.out.println("Pha cà phê"); }
    protected void addCondiments() { System.out.println("Thêm sữa"); }
}
```

### Trong CineX — BaseEntity audit

```java
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
public abstract class BaseEntity {
    @Id @GeneratedValue
    private Long id;

    @Version
    private Long version;

    @CreatedDate
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;

    @Enumerated(EnumType.STRING)
    private StorageState storageState = StorageState.ACTIVE;
    // ...
}

// Subclass chỉ thêm field riêng
@Entity
public class Movie extends BaseEntity {
    private String title;
    private Integer duration;
    // không cần khai báo lại id, version, audit
}
```

Skeleton: id/version/audit chung. Subclass chỉ điền field riêng.

### Template Method vs Strategy
- Template Method: skeleton ở base class, subclass thay đổi step (inheritance)
- Strategy: thuật toán tách thành class riêng, swap qua composition

Template Method khó test (inheritance) → modern code prefer Strategy.

---

## 5. Chain of Responsibility

### Định nghĩa
Chuỗi handler — mỗi handler xử lý hoặc pass cho handler kế tiếp.

### Ví dụ đời thường
Bộ phận khiếu nại công ty:
- Customer support (lv1) → giải quyết được? Done.
- Không → escalate manager (lv2)
- Không → escalate director (lv3)

Customer KHÔNG biết phải gặp ai trước — chỉ gọi "khiếu nại" → chain xử lý.

### Code generic

```java
public abstract class Handler {
    protected Handler next;
    public void setNext(Handler next) { this.next = next; }
    public abstract void handle(Request r);
}

public class AuthHandler extends Handler {
    public void handle(Request r) {
        if (!r.hasAuth()) { r.reject("Not authenticated"); return; }
        if (next != null) next.handle(r);
    }
}

public class RateLimitHandler extends Handler {
    public void handle(Request r) {
        if (overLimit(r)) { r.reject("Too many requests"); return; }
        if (next != null) next.handle(r);
    }
}

public class LoggingHandler extends Handler {
    public void handle(Request r) {
        log.info("Request: {}", r);
        if (next != null) next.handle(r);
    }
}

// Build chain:
Handler chain = new AuthHandler();
chain.setNext(new RateLimitHandler());
chain.setNext(new LoggingHandler());
chain.handle(request);
```

### Trong CineX — Spring Security Filter Chain

```
Request
   ↓
[CorsFilter] → preflight handle
   ↓
[RateLimitFilter] → reject nếu quá nhiều
   ↓
[JwtAuthFilter] → decode token, set Authentication
   ↓
[UsernamePasswordAuthFilter] → login endpoint
   ↓
[FilterSecurityInterceptor] → check @PreAuthorize
   ↓
Controller
```

Mỗi filter trong `SecurityFilterChain` là 1 Handler. Spring Security build chain qua `SecurityConfig.filterChain()`.

### Servlet Filter cũng là Chain

```java
public class RequestLoggingFilter implements Filter {
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain) {
        long start = System.currentTimeMillis();
        chain.doFilter(req, res);  // ← pass cho filter kế
        log.info("Request took {}ms", System.currentTimeMillis() - start);
    }
}
```

### Khi nào dùng?
- Nhiều bước xử lý độc lập có thể abort sớm
- Thứ tự xử lý matter
- Pluggable middleware (giống Express.js, Koa middleware)

---

## 6. Command

### Định nghĩa
Encapsulate **request thành object** — store, queue, log, undo.

### Ví dụ đời thường
Remote TV — mỗi nút là 1 command:
- Nút power → `PowerCommand`
- Nút channel up → `ChannelUpCommand`

Remote không biết TV làm gì — chỉ gọi `command.execute()`.

### Code generic

```java
public interface Command {
    void execute();
    void undo();
}

public class TurnOnLightCommand implements Command {
    private final Light light;
    public TurnOnLightCommand(Light l) { light = l; }
    public void execute() { light.turnOn(); }
    public void undo() { light.turnOff(); }
}

public class RemoteControl {
    private Command command;
    private Stack<Command> history = new Stack<>();

    public void setCommand(Command c) { command = c; }
    public void press() { command.execute(); history.push(command); }
    public void undo() { if (!history.isEmpty()) history.pop().undo(); }
}
```

### Trong CineX — Spring Events implicit Command

```java
publisher.publishEvent(new PaymentCompletedEvent(payment));
```

Event là 1 Command — encapsulate "đã hoàn tất payment" → listener xử lý. Có thể queue (`@Async`), log, retry.

### Trong CineX — Job queue (future)

Nếu CineX thêm queue (RabbitMQ/Kafka):
```java
public class SendEmailCommand implements Command {
    private final String to;
    private final String template;
    public void execute() { emailService.send(to, template); }
}

queue.publish(new SendEmailCommand("user@x.com", "welcome"));
```

### Khi nào dùng?
- Queue/schedule action
- Undo/redo
- Macro (combine multiple commands)
- Distributed task

---

## 7. Iterator

### Định nghĩa
Cách duyệt qua collection mà **không lộ internal structure**.

### Trong Java — Iterable interface

```java
public interface Iterable<T> {
    Iterator<T> iterator();
}

public interface Iterator<T> {
    boolean hasNext();
    T next();
}

// Tự định nghĩa:
public class BookCollection implements Iterable<Book> {
    private Book[] books;
    public Iterator<Book> iterator() {
        return new Iterator<Book>() {
            private int idx = 0;
            public boolean hasNext() { return idx < books.length; }
            public Book next() { return books[idx++]; }
        };
    }
}

// Client dùng for-each:
for (Book b : bookCollection) { ... }
```

### Iterator nội tại

Stream API là dạng evolved của Iterator:
```java
bookCollection.stream()
    .filter(b -> b.getYear() > 2020)
    .forEach(...);
```

### Khi nào tự viết Iterator?
- Cấu trúc dữ liệu custom (tree, graph)
- Iteration order phức tạp (DFS, BFS)

CineX hiếm khi cần — `List`, `Set`, `Map` JDK đủ.

---

## 8. Mediator

### Định nghĩa
Object trung gian quản lý giao tiếp giữa nhiều object → giảm coupling.

### Ví dụ đời thường
Tháp kiểm soát không lưu — máy bay KHÔNG nói với nhau, chỉ nói với tháp. Tháp điều phối hạ cánh.

### Code generic

```java
public interface AirportMediator {
    void requestLanding(Plane plane);
}

public class TowerControl implements AirportMediator {
    private final List<Plane> queue = new ArrayList<>();
    public void requestLanding(Plane plane) {
        if (queue.isEmpty()) plane.land();
        else queue.add(plane);
    }
}

public class Plane {
    private AirportMediator tower;
    public void land() { tower.requestLanding(this); }
}
```

### CineX chưa cần Mediator
CineX dùng Event Bus (Observer) cho decoupling — đủ rồi. Mediator phù hợp UI components nhiều widget tương tác (form lớn).

---

## 9. Memento

### Định nghĩa
Capture state object để **restore later** (undo).

### Ví dụ đời thường
Save game — chụp snapshot toàn bộ inventory/level/position → load lại sau.

### Code

```java
public class TextEditor {
    private String content = "";
    public void type(String s) { content += s; }
    public String getContent() { return content; }
    public Memento save() { return new Memento(content); }
    public void restore(Memento m) { content = m.getState(); }

    public static class Memento {
        private final String state;
        public Memento(String s) { state = s; }
        public String getState() { return state; }
    }
}

// Sử dụng:
TextEditor e = new TextEditor();
e.type("Hello ");
Memento save1 = e.save();
e.type("World");
e.restore(save1);  // content = "Hello "
```

### CineX chưa cần Memento
Hủy booking là transition state (CANCELLED), không phải undo. Memento phù hợp document editor, game.

---

## 10. Visitor

### Định nghĩa
Thêm operation mới cho cấu trúc cố định mà không sửa class.

### Code generic

```java
public interface Shape {
    void accept(ShapeVisitor visitor);
}

public class Circle implements Shape {
    private double radius;
    public void accept(ShapeVisitor v) { v.visit(this); }
    public double getRadius() { return radius; }
}

public class Square implements Shape {
    private double side;
    public void accept(ShapeVisitor v) { v.visit(this); }
    public double getSide() { return side; }
}

public interface ShapeVisitor {
    void visit(Circle c);
    void visit(Square s);
}

public class AreaCalculator implements ShapeVisitor {
    private double total;
    public void visit(Circle c) { total += Math.PI * c.getRadius() * c.getRadius(); }
    public void visit(Square s) { total += s.getSide() * s.getSide(); }
}

// Thêm operation mới (PerimeterCalculator) → tạo class visitor mới, KHÔNG sửa Shape
```

### CineX chưa cần Visitor
Pattern phức tạp, ít dùng. Phù hợp AST compiler, complex hierarchy.

---

## 11. Interpreter

Đặc biệt — dùng cho language/grammar. CineX không dùng. Bỏ qua.

---

## So sánh tổng

| Pattern | Bài toán | CineX |
|---|---|---|
| Strategy | Đổi thuật toán runtime | PaymentProcessor, PricingRuleMatcher |
| Observer | Pub/sub event | Spring Events |
| State | Object đổi behavior theo state | BookingStatus |
| Template Method | Skeleton + hook | BaseEntity |
| Chain of Resp | Pipeline xử lý | Spring Security filter |
| Command | Encapsulate request | Spring Events (implicit) |
| Iterator | Duyệt collection | Java Iterable |
| Mediator | Trung gian | Chưa cần |
| Memento | Undo state | Chưa cần |
| Visitor | Operation cho hierarchy | Chưa cần |
| Interpreter | Parse grammar | Chưa cần |

---

## So sánh Strategy / State / Template Method

3 pattern dễ nhầm:

| Pattern | Cách triển khai | Khi đổi behavior |
|---|---|---|
| Strategy | Composition (interface + classes) | Caller chọn |
| State | Composition + tự đổi reference | Object tự đổi |
| Template Method | Inheritance (abstract method) | Subclass override |

---

## Câu hỏi tự kiểm tra

1. **Khi nào dùng Observer thay vì method call thường?**
   → Khi nhiều listener không liên quan business chính (notification, logging, metrics) → decouple.

2. **`@TransactionalEventListener(AFTER_COMMIT)` khác `@EventListener`?**
   → `@EventListener` chạy ngay khi publish (trong transaction). `AFTER_COMMIT` chỉ chạy sau khi DB commit thành công — tránh side-effect khi rollback.

3. **State khác Strategy ở đâu?**
   → State: object tự transition. Strategy: caller pick.

4. **Template Method có downside gì?**
   → Inheritance → coupling chặt. Đổi base class ảnh hưởng nhiều subclass. Modern code prefer Strategy.

5. **Chain of Responsibility khác Pipeline?**
   → Pipeline mọi step chạy. Chain có thể abort sớm (handler return). Tuy nhiên trong thực tế dùng lẫn nhau.

6. **Spring Events có `@Async` — tại sao quan trọng?**
   → Tránh block publisher. Email/notification tốn 1-5s → không nên giữ transaction lâu.

7. **Khi nào KHÔNG dùng Observer?**
   → Cần result từ listener (gọi method thường + nhận return). Chain quá phức tạp (nhiều event chained) → debug khó.

8. **Visitor có thay được switch-case?**
   → Có, khi muốn add operation mới mà không sửa enum/class. Tradeoff: phức tạp + double dispatch.

9. **Memento và Snapshot DB khác gì?**
   → Memento ở memory cho object. Snapshot DB persist file/storage. Concept tương tự, scope khác.

10. **Mediator vs Facade khác gì?**
    → Facade simplify subsystem cho client ngoài. Mediator quản lý giao tiếp giữa các peer (object cùng cấp) bên trong.
