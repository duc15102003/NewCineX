# Module Payment — Giải thích chi tiết

## 1. Tổng quan
Module Payment xử lý **thanh toán** cho booking — tạo payment, xử lý callback từ cổng thanh toán, xuất vé điện tử.

Giai đoạn đầu dùng **MockPaymentProcessor** (giả lập luôn thành công). Sau có thể thay bằng VNPay/Momo thật mà **không sửa code cũ** (Factory + Strategy pattern).

**3 pattern chính:**
- **Factory Pattern** — chọn đúng processor theo payment method
- **Strategy Pattern** — mỗi cổng xử lý theo cách riêng, cùng interface
- **Observer Pattern** — khi thanh toán xong, tự động trigger thêm hành động (email, notification)

---

## 2. Danh sách files đầy đủ

| File | Tác dụng | Design Pattern |
|---|---|---|
| `module/payment/entity/Payment.java` | Entity thanh toán, @OneToOne với Booking | BaseEntity, @OneToOne |
| `module/payment/entity/PaymentMethod.java` | Enum: VNPAY, CASH (sẽ thêm MOMO) | Enum Pattern |
| `module/payment/entity/PaymentStatus.java` | Enum: PENDING, COMPLETED, FAILED | Enum Pattern |
| `module/payment/dto/CreatePaymentRequest.java` | DTO tạo payment (bookingId, paymentMethod) | DTO + Validation |
| `module/payment/dto/PaymentResponse.java` | DTO trả về payment (id, status, paymentUrl...) | DTO + Builder |
| `module/payment/dto/TicketResponse.java` | DTO vé điện tử (movie, seats, QR code) | DTO + Builder |
| `module/payment/processor/PaymentProcessor.java` | Interface chung cho mọi cổng thanh toán | Strategy Pattern (interface) |
| `module/payment/processor/MockPaymentProcessor.java` | Giả lập VNPay, luôn thành công, dùng cho dev | Strategy (implementation) |
| `module/payment/processor/CashPaymentProcessor.java` | Thanh toán tiền mặt tại quầy | Strategy (implementation) |
| `module/payment/processor/PaymentProcessorFactory.java` | Chọn đúng processor theo method | Factory Pattern |
| `module/payment/repository/PaymentRepository.java` | JPA repository, query theo bookingId / transactionCode | Repository |
| `module/payment/service/PaymentService.java` | Business logic: createPayment, handleCallback | Service |
| `module/payment/service/TicketService.java` | Xuất vé điện tử + sinh QR code | Service |
| `module/payment/service/PaymentCompletedEvent.java` | Event object khi thanh toán thành công | Observer (Event) |
| `module/payment/service/PaymentEventListener.java` | Lắng nghe event → tạo notification | Observer (Listener) |
| `module/payment/controller/PaymentController.java` | 4 endpoints REST | Controller |

---

## 3. Luồng thanh toán — Tổng thể

```
User hold ghế (booking status = HOLDING)
    │
    ▼
POST /api/payments/create { bookingId: 1, paymentMethod: "VNPAY" }
    │
    ▼
PaymentService.createPayment()
    ├── 1. Check booking HOLDING + chưa có payment
    ├── 2. Factory chọn processor: "VNPAY" → MockPaymentProcessor
    ├── 3. idTrackerService.nextCodeWithDate("PAYMENT") → "PAY-20260520-001"
    ├── 4. processor.createPayment("PAY-20260520-001", 247500, "CineX Booking CX-...")
    │       └── Mock: return "http://localhost:8088/api/payments/callback?transactionCode=PAY-20260520-001&status=SUCCESS"
    ├── 5. INSERT Payment { booking, amount, method=VNPAY, transactionCode, status=PENDING }
    └── 6. Return PaymentResponse { paymentUrl: "http://..." }
    │
    ▼
FE redirect user đến paymentUrl
    │
    ▼
[Mock] User click link → trực tiếp gọi callback URL
[Thật] VNPay xử lý thanh toán → redirect về callback URL
    │
    ▼
GET /api/payments/callback?transactionCode=PAY-20260520-001&status=SUCCESS
    │
    ▼
PaymentService.handleCallback(params)
    ├── 1. Tìm Payment theo transactionCode
    ├── 2. Factory lấy processor cùng method
    ├── 3. processor.verifyCallback(params) → true (status=SUCCESS)
    ├── 4. Payment → COMPLETED, paidAt = now()
    ├── 5. Booking → CONFIRMED, confirmedAt = now()
    ├── 6. BookingSeats → BOOKED
    ├── 7. Publish PaymentCompletedEvent (Observer)
    │       └── PaymentEventListener (async):
    │               → notificationService.createNotification(userId, "Thanh toán thành công", ...)
    ├── 8. seatWebSocketService.notifySeatChanged(showtimeId, seatIds, "BOOKED")
    │       → Real-time: ghế từ HELD → BOOKED (đổi màu trên sơ đồ)
    └── 9. Return PaymentResponse { status: "COMPLETED" }
```

---

## 4. Design Patterns — Giải thích chi tiết

### 4.1 Factory Pattern — Chọn đúng processor

#### Pattern là gì?
Factory Pattern = "Nhà máy" — bạn đặt hàng loại sản phẩm, nhà máy tự chọn dây chuyền sản xuất phù hợp. Bạn không cần biết dây chuyền nào đang chạy.

**Ví dụ đời thường:**
```
Bạn vào Gong Cha gọi: "Trà sữa size L, ít đường, ít đá"
→ Nhân viên (Factory) nhận yêu cầu
→ Giao cho máy pha (Processor tương ứng)
→ Bạn không quan tâm là máy pha nào đang làm

Tương tự:
User gọi: "Thanh toán bằng VNPAY"
→ PaymentProcessorFactory nhận
→ Chọn MockPaymentProcessor (hiện tại) hoặc VNPayProcessor (production)
→ PaymentService không quan tâm processor nào đang xử lý
```

#### Cách Spring inject Map tự động

```java
// PaymentProcessorFactory.java
@Component
@RequiredArgsConstructor
public class PaymentProcessorFactory {

    // Spring tự inject Map<String, PaymentProcessor>
    // Key = tên @Component, Value = Bean instance
    private final Map<String, PaymentProcessor> processors;

    public PaymentProcessor getProcessor(PaymentMethod method) {
        PaymentProcessor processor = processors.get(method.name());
        if (processor == null) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Payment method not supported: " + method);
        }
        return processor;
    }
}
```

**Spring inject Map như thế nào?**

Khi Spring thấy `Map<String, PaymentProcessor>` trong constructor:
1. Tìm tất cả Bean implement `PaymentProcessor` trong container
2. Key = tên Bean (từ `@Component("tên")`)
3. Value = Bean instance (singleton)
4. Tạo Map và inject vào constructor

```
Spring container:
  Bean "VNPAY" = MockPaymentProcessor instance
  Bean "CASH"  = CashPaymentProcessor instance

Map<String, PaymentProcessor> processors = {
    "VNPAY": MockPaymentProcessor,
    "CASH":  CashPaymentProcessor
}

processors.get("VNPAY") → MockPaymentProcessor
processors.get("CASH")  → CashPaymentProcessor
processors.get("MOMO")  → null → throw BusinessException
```

#### So sánh: if-else vs Factory

**Cách xấu — dùng if-else:**
```java
// ❌ PaymentService.java — KHÔNG làm thế này
public PaymentResponse createPayment(CreatePaymentRequest request) {
    PaymentMethod method = request.getPaymentMethod();

    String paymentUrl;
    if (method == PaymentMethod.VNPAY) {
        // VNPay logic...
        paymentUrl = "https://sandbox.vnpayment.vn/paymentv2/...";
    } else if (method == PaymentMethod.MOMO) {
        // Momo logic...
        paymentUrl = "https://test-payment.momo.vn/...";
    } else if (method == PaymentMethod.CASH) {
        paymentUrl = null;
    } else {
        throw new RuntimeException("Unsupported method");
    }
    // ...
}
```

**Vấn đề với if-else:**
- Thêm ZALOPAY → phải vào sửa `PaymentService` → vi phạm **Open/Closed Principle** (class phải đóng với sửa đổi)
- `PaymentService` phình to, chứa logic của nhiều cổng → vi phạm **Single Responsibility**
- Test khó hơn: không thể test từng processor riêng lẻ
- Nếu logic mỗi cổng dài 50 dòng → method `createPayment` sẽ dài 150+ dòng

**Cách tốt — dùng Factory + Strategy:**
```java
// ✅ PaymentService.java — sạch, không biết cổng nào
PaymentProcessor processor = processorFactory.getProcessor(request.getPaymentMethod());
String paymentUrl = processor.createPayment(transactionCode, amount, description);
// PaymentService chỉ 3 dòng → gọn, dễ đọc, không thay đổi khi thêm cổng mới
```

**Thêm ZaloPay:**
```java
// Chỉ tạo 1 file mới — PaymentService KHÔNG SỬA
@Component("ZALOPAY")  // Tên key trong Map
@Slf4j
public class ZaloPayPaymentProcessor implements PaymentProcessor {

    @Override
    public String createPayment(String transactionCode, BigDecimal amount, String description) {
        // ZaloPay-specific logic...
        return "https://zalopay.vn/checkout?...";
    }

    @Override
    public boolean verifyCallback(Map<String, String> params) {
        // Verify ZaloPay signature...
        return checkSignature(params);
    }
}
// Xong! Spring tự thêm "ZALOPAY" vào Map → Factory tự biết → PaymentService không đổi
```

---

### 4.2 Strategy Pattern — Mỗi cổng xử lý theo cách riêng

#### Pattern là gì?
Strategy = "Chiến lược" — định nghĩa 1 gia đình thuật toán, đóng gói từng cái, cho phép dùng thay thế nhau. Client không cần biết thuật toán cụ thể đang dùng.

**Ví dụ đời thường:**
```
GPS điều hướng có nhiều chiến lược:
  - "Đường nhanh nhất" (Strategy A)
  - "Tránh cao tốc" (Strategy B)
  - "Tiết kiệm nhiên liệu" (Strategy C)

Bạn chọn chiến lược, GPS dùng nó để tính đường.
Khi bạn đổi chiến lược, GPS không cần viết lại từ đầu.

Tương tự:
  - MockPaymentProcessor (dev/test)
  - VNPayPaymentProcessor (production VNPay)
  - CashPaymentProcessor (tại quầy)
→ Cùng interface, logic khác nhau, dùng thay thế nhau
```

#### Interface — "Hợp đồng" chung

```java
// PaymentProcessor.java — interface = hợp đồng
public interface PaymentProcessor {

    /**
     * Tạo yêu cầu thanh toán → trả URL redirect (hoặc null nếu cash).
     */
    String createPayment(String transactionCode, BigDecimal amount, String description);

    /**
     * Xác nhận callback từ cổng thanh toán → trả true nếu thanh toán thành công.
     */
    boolean verifyCallback(Map<String, String> params);
}
```

**Giải thích:** Interface = "hợp đồng" giữa Service và Processor. Service ký hợp đồng "tôi cần createPayment() và verifyCallback()". Processor nào muốn hợp tác phải thực hiện đủ 2 phương thức đó.

#### Implementation 1 — MockPaymentProcessor (dev)

```java
@Component("VNPAY")  // Key trong Map của Factory
@Slf4j
public class MockPaymentProcessor implements PaymentProcessor {

    @Override
    public String createPayment(String transactionCode, BigDecimal amount, String description) {
        // Trả URL giả lập — khi FE gọi URL này sẽ trigger callback với status=SUCCESS
        String paymentUrl = "http://localhost:8088/api/payments/callback"
                + "?transactionCode=" + transactionCode
                + "&status=SUCCESS";
        log.info("Mock payment created: {} - {} VND - URL: {}", transactionCode, amount, paymentUrl);
        return paymentUrl;
    }

    @Override
    public boolean verifyCallback(Map<String, String> params) {
        // Mock: luôn thành công nếu status = SUCCESS
        return "SUCCESS".equals(params.get("status"));
    }
}
```

#### Implementation 2 — CashPaymentProcessor

```java
@Component("CASH")
@Slf4j
public class CashPaymentProcessor implements PaymentProcessor {

    @Override
    public String createPayment(String transactionCode, BigDecimal amount, String description) {
        // Cash: không có URL → admin xác nhận thủ công tại quầy
        log.info("Cash payment created: {} - {} VND", transactionCode, amount);
        return null;  // FE xử lý null → hiển thị "Vui lòng thanh toán tại quầy"
    }

    @Override
    public boolean verifyCallback(Map<String, String> params) {
        // Cash: luôn true khi admin gọi confirm (không có signature verification)
        return true;
    }
}
```

#### Sẽ thêm VNPay thật — không sửa code cũ

```java
// Khi deploy production, thay @Component("VNPAY") Mock → VNPay thật:
@Component("VNPAY")  // Cùng tên → ghi đè MockPaymentProcessor
@Slf4j
public class VNPayPaymentProcessor implements PaymentProcessor {

    @Value("${vnpay.tmn-code}")
    private String tmnCode;

    @Value("${vnpay.hash-secret}")
    private String hashSecret;

    @Override
    public String createPayment(String transactionCode, BigDecimal amount, String description) {
        // Build VNPay URL với hash signature...
        String vnpUrl = buildVNPayUrl(transactionCode, amount, description);
        return vnpUrl;  // Redirect user đến trang thanh toán VNPay thật
    }

    @Override
    public boolean verifyCallback(Map<String, String> params) {
        // Verify VNPay HMAC signature để xác nhận callback authentic
        String receivedHash = params.get("vnp_SecureHash");
        String computedHash = computeHmac(params, hashSecret);
        return receivedHash.equals(computedHash)
                && "00".equals(params.get("vnp_ResponseCode")); // 00 = thành công
    }
}
// PaymentService, PaymentProcessorFactory → KHÔNG SỬA DÒNG NÀO
```

---

### 4.3 Observer Pattern — Spring Events

#### Pattern là gì?
Observer = "Quan sát viên" — khi 1 sự kiện xảy ra (Subject), tất cả những ai đăng ký lắng nghe (Observer) đều được thông báo tự động. Subject không cần biết có bao nhiêu Observer hay họ làm gì.

**Ví dụ đời thường:**
```
YouTube Channel (Subject) — bạn đăng ký (Subscribe)
  → Channel upload video mới (Event xảy ra)
  → YouTube tự động thông báo TẤT CẢ subscriber
  → Channel không cần biết có bao nhiêu subscriber
  → Mỗi subscriber tự quyết định xem hay bỏ qua

Tương tự:
PaymentService (Subject) — publish PaymentCompletedEvent
  → PaymentEventListener (Observer) tự động chạy
  → PaymentService không biết có bao nhiêu listener
  → Thêm listener mới (gửi SMS, in hóa đơn) → PaymentService KHÔNG SỬA
```

#### Luồng từng bước

```
Bước 1: PaymentService publish event
├── payment.setStatus(COMPLETED)
├── booking.setStatus(CONFIRMED)
├── bookingRepository.save(booking)
└── eventPublisher.publishEvent(new PaymentCompletedEvent(this, payment))
    │
    │  (PaymentService xong, trả response cho user ngay)
    │
    ▼
Bước 2: Spring Event Bus nhận event
    │
    ▼
Bước 3: Spring tìm tất cả @EventListener cho PaymentCompletedEvent
    │
    ▼
Bước 4: PaymentEventListener.handlePaymentCompleted(event) chạy
    ├── @Async → chạy trên thread RIÊNG (không block response)
    ├── Lấy: bookingCode, userId từ event.getPayment()
    └── notificationService.createNotification(
            userId,
            "Thanh toán thành công",
            "Vé CX-20260520-001 đã được xác nhận. Chúc bạn xem phim vui vẻ!",
            NotificationType.BOOKING
        )
```

#### Code chi tiết

```java
// Bước 1: Event object — "phong bì" chứa thông tin
// PaymentCompletedEvent.java
@Getter
public class PaymentCompletedEvent extends ApplicationEvent {

    private final Payment payment;  // Chứa thông tin payment để listener dùng

    public PaymentCompletedEvent(Object source, Payment payment) {
        super(source);
        this.payment = payment;
    }
}
```

```java
// Bước 2: Publisher — PaymentService.java
@Service
@RequiredArgsConstructor
public class PaymentService {

    private final ApplicationEventPublisher eventPublisher;  // Spring inject

    public PaymentResponse handleCallback(Map<String, String> params) {
        // ... xử lý payment ...

        if (success) {
            // Publish event — như bấm "gửi thông báo" cho tất cả subscriber
            eventPublisher.publishEvent(new PaymentCompletedEvent(this, payment));
            // PaymentService KHÔNG BIẾT ai sẽ nhận event này
            // → loose coupling: PaymentService độc lập hoàn toàn
        }
        // Return response ngay, KHÔNG chờ listener xong
        return toPaymentResponse(payment, null);
    }
}
```

```java
// Bước 3: Listener — PaymentEventListener.java
@Component
@RequiredArgsConstructor
@Slf4j
public class PaymentEventListener {

    private final NotificationService notificationService;

    @Async           // Chạy trên thread riêng (Spring TaskExecutor)
    @EventListener   // "Đăng ký" lắng nghe PaymentCompletedEvent
    public void handlePaymentCompleted(PaymentCompletedEvent event) {
        Payment payment = event.getPayment();
        String bookingCode = payment.getBooking().getBookingCode();
        Long userId = payment.getBooking().getUser().getId();

        notificationService.createNotification(
                userId,
                "Thanh toán thành công",
                "Vé " + bookingCode + " đã được xác nhận. Chúc bạn xem phim vui vẻ!",
                NotificationType.BOOKING
        );

        log.info("Payment completed → notification created for booking {}", bookingCode);
    }
}
```

#### @Async — tại sao quan trọng?

```
KHÔNG có @Async (synchronous):
  handleCallback() gọi handlePaymentCompleted() → chờ gửi notification xong → return response

  Timeline: [Payment logic: 50ms] [Notification: 200ms] → User chờ 250ms

  Nếu NotificationService lỗi → handleCallback() cũng rollback → Payment FAILED!
  (Dù VNPay đã thu tiền rồi → RẤT NGUY HIỂM)

CÓ @Async:
  handleCallback() publish event → return response NGAY (50ms)
  Thread riêng: handlePaymentCompleted() chạy ngầm → tạo notification (200ms)

  Timeline: [Payment logic: 50ms] → User nhận response
                                  (ngầm) [Notification: 200ms]

  Nếu Notification lỗi → Payment đã COMMITTED → không bị rollback
  User vẫn nhận được response "Payment completed" đúng
```

**Để @Async hoạt động, cần `@EnableAsync` trên class main:**
```java
@SpringBootApplication
@EnableScheduling
@EnableAsync      // PHẢI có → @Async mới chạy trên thread riêng
public class CineXApplication { ... }
```

#### Sức mạnh của Observer: thêm hành động mới không cần sửa PaymentService

Giả sử product owner yêu cầu: "Sau khi thanh toán, gửi SMS xác nhận và ghi audit log"

```java
// Chỉ thêm 2 listener mới — PaymentService KHÔNG SỬA:

// Listener 2: Gửi SMS
@Component
@Slf4j
public class PaymentSmsListener {
    @Async
    @EventListener
    public void handlePaymentCompleted(PaymentCompletedEvent event) {
        String phone = event.getPayment().getBooking().getUser().getPhone();
        smsService.send(phone, "Dat ve thanh cong. Ma ve: " + event.getPayment().getBooking().getBookingCode());
    }
}

// Listener 3: Audit log
@Component
@Slf4j
public class PaymentAuditListener {
    @EventListener
    public void handlePaymentCompleted(PaymentCompletedEvent event) {
        auditService.log("PAYMENT_COMPLETED", event.getPayment().getTransactionCode());
    }
}
// Xong! PaymentService không đổi 1 dòng nào
```

---

### 4.4 @OneToOne — Quan hệ 1-1

```java
// Payment.java
@OneToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "booking_id", nullable = false, unique = true)
private Booking booking;
```

**@OneToOne khác @ManyToOne thế nào?**

| Tiêu chí | @ManyToOne | @OneToOne |
|---|---|---|
| **Quan hệ** | Nhiều-1: nhiều Booking cùng 1 User | 1-1: 1 Payment = 1 Booking |
| **FK có UNIQUE không?** | Không (nhiều row cùng FK) | Có: `unique = true` (mỗi FK chỉ xuất hiện 1 lần) |
| **Ví dụ** | Nhiều đơn hàng cùng 1 khách | 1 người 1 số CMND |
| **SQL sinh ra** | `booking.user_id` (nhiều booking cùng user_id) | `payment.booking_id UNIQUE` (1 booking chỉ có 1 payment) |

```sql
-- @ManyToOne (bookings.user_id) — không unique
-- Nhiều booking cùng user_id → OK
INSERT INTO bookings (user_id, ...) VALUES (5, ...);  -- booking 1
INSERT INTO bookings (user_id, ...) VALUES (5, ...);  -- booking 2 (same user)

-- @OneToOne (payments.booking_id UNIQUE)
-- DB tự tạo UNIQUE constraint
-- ALTER TABLE payments ADD CONSTRAINT UQ_booking_id UNIQUE (booking_id)
INSERT INTO payments (booking_id, ...) VALUES (1, ...);  -- OK
INSERT INTO payments (booking_id, ...) VALUES (1, ...);  -- ERROR: Duplicate entry '1' for key 'UQ_booking_id'
```

**Tại sao 1 Booking chỉ có 1 Payment?**
Vì payment là "bằng chứng thanh toán" cho đơn đặt vé. 1 đơn chỉ cần 1 bằng chứng. Nếu cần thanh toán lại → tạo booking mới, không tạo payment mới cho booking cũ.

**Trong code, PaymentService cũng check thêm:**
```java
// Double check trước khi tạo payment
if (paymentRepository.findByBookingId(booking.getId()).isPresent()) {
    throw new BusinessException(ErrorCode.INVALID_REQUEST, "Payment already exists for this booking");
}
// DB constraint là safety net, code check là defense-in-depth
```

---

## 5. Sơ đồ luồng chi tiết

### 5.1 createPayment — Tạo payment

```
POST /api/payments/create
Body: { "bookingId": 1, "paymentMethod": "VNPAY" }
│
▼
[JwtAuthFilter] Xác thực JWT
│
▼
PaymentController.createPayment(@Valid CreatePaymentRequest)
│ → getCurrentUserId() → userId = 5
│
▼
PaymentService.createPayment(userId=5, request) [@Transactional]
│
├── 1. bookingRepository.findById(1) → Booking
│     → Không tìm thấy → throw BOOKING_NOT_FOUND (404)
│
├── 2. Check quyền: booking.user.id == 5?
│     → Không khớp → throw FORBIDDEN (403)
│
├── 3. Check trạng thái: booking.status == HOLDING?
│     → Không phải HOLDING → throw INVALID_REQUEST (400)
│     VD: CONFIRMED → "Booking is not in HOLDING status"
│
├── 4. Check đã có payment chưa:
│     paymentRepository.findByBookingId(1)
│     → Đã có → throw INVALID_REQUEST "Payment already exists"
│
├── 5. Factory chọn processor:
│     processorFactory.getProcessor(PaymentMethod.VNPAY)
│     → processors.get("VNPAY") → MockPaymentProcessor
│
├── 6. Sinh transactionCode:
│     idTrackerService.nextCodeWithDate("PAYMENT") → "PAY-20260520-001"
│
├── 7. Processor tạo payment URL:
│     processor.createPayment("PAY-20260520-001", 247500, "CineX Booking CX-20260520-001")
│     → Mock: "http://localhost:8088/api/payments/callback?transactionCode=PAY-20260520-001&status=SUCCESS"
│
├── 8. Lưu Payment:
│     Payment { booking, amount=247500, method=VNPAY,
│               transactionCode="PAY-20260520-001", status=PENDING }
│     paymentRepository.save(payment)
│     → INSERT INTO payments (booking_id, amount, method, transaction_code, status, ...)
│
└── 9. Return PaymentResponse { paymentUrl: "http://..." }
```

### 5.2 handleCallback — Xử lý callback

```
GET /api/payments/callback?transactionCode=PAY-20260520-001&status=SUCCESS
│
▼
PaymentController.paymentCallback(@RequestParam Map<String,String> params)
│ → params = { "transactionCode": "PAY-20260520-001", "status": "SUCCESS" }
│
▼
PaymentService.handleCallback(params) [@Transactional]
│
├── 1. transactionCode = params.get("transactionCode") = "PAY-20260520-001"
│
├── 2. paymentRepository.findByTransactionCode("PAY-20260520-001") → Payment
│     → Không tìm thấy → throw PAYMENT_NOT_FOUND (404)
│
├── 3. Check đã xử lý chưa: payment.status == PENDING?
│     → Đã COMPLETED → throw INVALID_REQUEST "Payment already processed"
│     (Tránh VNPay gửi callback 2 lần — điều thường xảy ra!)
│
├── 4. Factory lấy processor theo method của payment:
│     processorFactory.getProcessor(payment.getMethod())  // VNPAY
│
├── 5. processor.verifyCallback(params)
│     → Mock: "SUCCESS".equals(params.get("status")) → true
│     → VNPay thật: verify HMAC signature
│
├── 6. success = true:
│     payment.status = COMPLETED, payment.paidAt = now()
│     booking.status = CONFIRMED, booking.confirmedAt = now()
│     booking.bookingSeats.forEach → status = BOOKED
│     bookingRepository.save(booking)
│     → UPDATE payments SET status='COMPLETED', paid_at=... WHERE id=?
│     → UPDATE bookings SET status='CONFIRMED', confirmed_at=... WHERE id=?
│     → UPDATE booking_seats SET status='BOOKED' WHERE id=? (× số ghế)
│
├── 7. Publish event:
│     eventPublisher.publishEvent(new PaymentCompletedEvent(this, payment))
│     → PaymentEventListener nhận (async thread riêng):
│         → notificationService.createNotification(userId, "Thanh toán thành công", ...)
│
├── 8. Real-time:
│     seatWebSocketService.notifySeatChanged(showtimeId, seatIds, "BOOKED")
│     → STOMP push: ghế E1, E2, A1 → BOOKED (màu đỏ trên sơ đồ)
│
└── 9. paymentRepository.save(payment)
    Return PaymentResponse { status: "COMPLETED" }
```

### 5.3 generateTicket — Xuất vé điện tử

```
GET /api/bookings/{bookingId}/ticket
Header: Authorization: Bearer <token>
│
▼
PaymentController.getTicket(bookingId=1)
│ → getCurrentUserId() → userId = 5
│
▼
TicketService.generateTicket(userId=5, bookingId=1) [@Transactional(readOnly=true)]
│
├── 1. bookingRepository.findById(1) → Booking (+ lazy load showtime, movie, room, seats)
│
├── 2. Check quyền: booking.user.id == 5?
│
├── 3. Check trạng thái:
│     status IN (CONFIRMED, CHECKED_IN)?
│     → HOLDING/EXPIRED → throw INVALID_REQUEST "Ticket only available for confirmed bookings"
│
├── 4. paymentRepository.findByBookingId(1) → Payment (nullable)
│
├── 5. Map booking → BookingSeatResponse list
│     (seatNumber, seatType, price, status)
│
├── 6. Sinh QR:
│     qrCodeService.generateQrCodeBase64("CX-20260520-001", 300)
│     → ZXing encode → PNG 300x300 → Base64 string
│
└── 7. Return TicketResponse {
          bookingCode, movieTitle, moviePosterUrl,
          startTime, endTime, roomName, roomType,
          seats: [...], totalAmount,
          paymentMethod: "VNPAY",
          qrCodeBase64: "iVBORw0KGgo..."
        }
```

---

## 6. SQL được sinh ra

### Tạo payment

```sql
-- Check đã có payment chưa
SELECT * FROM payments WHERE booking_id = 1;

-- INSERT payment mới
INSERT INTO payments (booking_id, amount, method, transaction_code, status, version, created_at, updated_at)
VALUES (1, 247500, 'VNPAY', 'PAY-20260520-001', 'PENDING', 0, now(), now());
```

### Callback thành công — cập nhật chuỗi

```sql
-- Tìm payment theo transactionCode
SELECT * FROM payments WHERE transaction_code = 'PAY-20260520-001';

-- Cập nhật payment
UPDATE payments
SET status = 'COMPLETED',
    paid_at = '2026-05-20T14:05:30',
    version = version + 1,
    updated_at = now()
WHERE id = 1;

-- Cập nhật booking
UPDATE bookings
SET status = 'CONFIRMED',
    confirmed_at = '2026-05-20T14:05:30',
    version = version + 1,
    updated_at = now()
WHERE id = 1;

-- Cập nhật từng booking_seat (cascade từ booking)
UPDATE booking_seats SET status = 'BOOKED' WHERE id = 101;
UPDATE booking_seats SET status = 'BOOKED' WHERE id = 102;
UPDATE booking_seats SET status = 'BOOKED' WHERE id = 103;
```

### Xuất vé điện tử

```sql
-- Load booking (lazy load showtime, movie, room)
SELECT * FROM bookings WHERE id = 1;

-- Lazy load showtime khi access booking.getShowtime()
SELECT s.* FROM showtimes s WHERE s.id = 1;

-- Lazy load movie khi access showtime.getMovie()
SELECT m.* FROM movies m WHERE m.id = 5;

-- Lazy load room khi access showtime.getRoom()
SELECT r.* FROM rooms r WHERE r.id = 2;

-- Lazy load bookingSeats khi access booking.getBookingSeats()
SELECT bs.*, seat.* FROM booking_seats bs
JOIN seats seat ON bs.seat_id = seat.id
WHERE bs.booking_id = 1;

-- Load payment
SELECT * FROM payments WHERE booking_id = 1;
```

---

## 7. Request/Response mẫu — TẤT CẢ 4 endpoints

### 7.1 POST /api/payments/create — Tạo payment

```bash
curl -X POST http://localhost:8088/api/payments/create \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"bookingId": 1, "paymentMethod": "VNPAY"}'
```

**Response (200) — Mock VNPAY:**
```json
{
  "success": true,
  "message": "Payment created",
  "data": {
    "id": 1,
    "bookingId": 1,
    "bookingCode": "CX-20260520-001",
    "amount": 247500,
    "method": "VNPAY",
    "transactionCode": "PAY-20260520-001",
    "status": "PENDING",
    "paymentUrl": "http://localhost:8088/api/payments/callback?transactionCode=PAY-20260520-001&status=SUCCESS",
    "paidAt": null,
    "createdAt": "2026-05-20T14:00:30",
    "updatedAt": "2026-05-20T14:00:30"
  }
}
```

**Response (200) — CASH (không có URL):**
```json
{
  "success": true,
  "data": {
    "method": "CASH",
    "status": "PENDING",
    "paymentUrl": null,
    ...
  }
}
```

**Response lỗi — booking không phải HOLDING:**
```json
{
  "success": false,
  "message": "Booking is not in HOLDING status",
  "errorCode": "INVALID_REQUEST"
}
```

**Response lỗi — đã có payment:**
```json
{
  "success": false,
  "message": "Payment already exists for this booking",
  "errorCode": "INVALID_REQUEST"
}
```

---

### 7.2 GET /api/payments/callback — Callback từ cổng thanh toán

**Trong môi trường dev (Mock):**
```bash
# User click paymentUrl → browser gọi URL này
# Hoặc test trực tiếp bằng curl:
curl "http://localhost:8088/api/payments/callback?transactionCode=PAY-20260520-001&status=SUCCESS"
```

**Giả lập thất bại:**
```bash
curl "http://localhost:8088/api/payments/callback?transactionCode=PAY-20260520-001&status=FAILED"
```

**Response thành công (200):**
```json
{
  "success": true,
  "message": "Payment processed",
  "data": {
    "id": 1,
    "bookingId": 1,
    "bookingCode": "CX-20260520-001",
    "amount": 247500,
    "method": "VNPAY",
    "transactionCode": "PAY-20260520-001",
    "status": "COMPLETED",
    "paymentUrl": null,
    "paidAt": "2026-05-20T14:05:30",
    "createdAt": "2026-05-20T14:00:30",
    "updatedAt": "2026-05-20T14:05:30"
  }
}
```

**Response thất bại:**
```json
{
  "success": true,
  "data": {
    "status": "FAILED",
    "paidAt": null,
    ...
  }
}
```

**Response lỗi — callback 2 lần:**
```json
{
  "success": false,
  "message": "Payment already processed",
  "errorCode": "INVALID_REQUEST"
}
```

---

### 7.3 GET /api/payments/{bookingId} — Kiểm tra trạng thái payment

```bash
curl http://localhost:8088/api/payments/1 \
  -H "Authorization: Bearer <token>"
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "bookingId": 1,
    "bookingCode": "CX-20260520-001",
    "amount": 247500,
    "method": "VNPAY",
    "transactionCode": "PAY-20260520-001",
    "status": "COMPLETED",
    "paymentUrl": null,
    "paidAt": "2026-05-20T14:05:30",
    "createdAt": "2026-05-20T14:00:30"
  }
}
```

**Response lỗi — chưa có payment:**
```json
{
  "success": false,
  "message": "Payment not found",
  "errorCode": "PAYMENT_NOT_FOUND"
}
```

---

### 7.4 GET /api/bookings/{bookingId}/ticket — Vé điện tử + QR

```bash
curl http://localhost:8088/api/bookings/1/ticket \
  -H "Authorization: Bearer <token>"
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "bookingCode": "CX-20260520-001",
    "movieTitle": "Avengers: Endgame",
    "moviePosterUrl": "https://res.cloudinary.com/.../poster.jpg",
    "startTime": "2026-05-25T14:00:00",
    "endTime": "2026-05-25T17:01:00",
    "roomName": "Room IMAX",
    "roomType": "IMAX",
    "seats": [
      {"seatId": 10, "seatNumber": "E1", "seatType": "VIP", "price": 100000, "status": "BOOKED"},
      {"seatId": 11, "seatNumber": "E2", "seatType": "VIP", "price": 100000, "status": "BOOKED"},
      {"seatId": 12, "seatNumber": "A1", "seatType": "STANDARD", "price": 75000, "status": "BOOKED"}
    ],
    "totalAmount": 247500,
    "paymentMethod": "VNPAY",
    "qrCodeBase64": "iVBORw0KGgoAAAANSUhEUgAAASwAAAEsCA..."
  }
}
```

**Cách FE hiển thị QR:**
```html
<img
  src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUg..."
  alt="QR Code - CX-20260520-001"
  width="300"
  height="300"
/>
```

**Response lỗi — booking chưa confirm:**
```json
{
  "success": false,
  "message": "Ticket only available for confirmed bookings",
  "errorCode": "INVALID_REQUEST"
}
```

---

## 8. Khái niệm mới cần biết

### ApplicationEventPublisher
- Interface của Spring để publish event
- Inject vào Service: `private final ApplicationEventPublisher eventPublisher;`
- Gọi: `eventPublisher.publishEvent(new MyEvent(this, data));`
- Spring tìm tất cả `@EventListener` match với type của event → gọi

### @EventListener
- Đánh dấu method "tôi muốn lắng nghe event loại X"
- Spring tự nhận biết loại event từ **tham số của method**:
  ```java
  public void handlePaymentCompleted(PaymentCompletedEvent event)
  //                                 ↑ Spring biết: lắng nghe PaymentCompletedEvent
  ```
- Một listener có thể lắng nghe nhiều event:
  ```java
  @EventListener({PaymentCompletedEvent.class, PaymentFailedEvent.class})
  public void handleAnyPaymentChange(ApplicationEvent event) { ... }
  ```

### ApplicationEvent
- Class cha của mọi custom event trong Spring
- Bắt buộc extends ApplicationEvent và gọi `super(source)`
- `source` = object publish event (thường là `this`)
- Có thể chứa bất kỳ data nào cần truyền cho listener

### @Async + @EnableAsync
- `@Async`: method này chạy trên thread pool riêng (không phải thread của request)
- `@EnableAsync`: bật tính năng async trên app (đặt ở class main)
- Mặc định Spring tạo SimpleAsyncTaskExecutor (1 thread per task — không có pool)
- Production nên config ThreadPoolTaskExecutor:
  ```java
  @Bean
  public Executor taskExecutor() {
      ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
      executor.setCorePoolSize(5);   // 5 thread thường trực
      executor.setMaxPoolSize(20);   // Tối đa 20 thread
      executor.setQueueCapacity(100); // Hàng đợi 100 task
      return executor;
  }
  ```

### Transaction + Event: Chú ý quan trọng

```
Vấn đề tinh tế:
  handleCallback() có @Transactional
  Bên trong publish event
  Listener @Async chạy ngay

  Nhưng: @Async listener chạy trên thread khác
  → Có thể listener chạy TRƯỚC khi transaction commit!
  → Listener query DB tìm booking → CHƯA thấy status=CONFIRMED (chưa commit)

Giải pháp: @TransactionalEventListener(phase = AFTER_COMMIT)
  @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
  public void handlePaymentCompleted(PaymentCompletedEvent event) {
      // Chỉ chạy SAU KHI transaction commit xong
      // Đảm bảo listener thấy data đã được lưu
  }

CineX hiện tại dùng @EventListener thông thường + @Async.
Trong môi trường dev (mock), thứ tự không quan trọng.
Production nên dùng @TransactionalEventListener.
```

### Strategy vs Template Method — phân biệt

```
Strategy Pattern:
  - Behavior được inject từ ngoài vào
  - Thay đổi behavior = đổi object (inject processor khác)
  - Ví dụ: PaymentProcessorFactory inject đúng Processor

Template Method Pattern:
  - Behavior được định nghĩa trong class cha
  - Subclass override từng bước cụ thể
  - Ví dụ: BaseService<T> có template createEntity() = validate + save + audit
           MovieService override validate(), BookingService override validate()
```

---

## 9. Annotation mới sử dụng

| Annotation | Tác dụng | Ví dụ trong code |
|---|---|---|
| `@OneToOne` | Quan hệ 1-1 giữa 2 entity | `Payment.booking` |
| `@JoinColumn(unique=true)` | FK + UNIQUE constraint (1 booking 1 payment) | `payments.booking_id` |
| `@Component("VNPAY")` | Đăng ký Bean với tên cụ thể vào Spring container | `MockPaymentProcessor` |
| `@EventListener` | Lắng nghe Spring Application Event | `handlePaymentCompleted()` |
| `@Async` | Chạy method trên thread pool riêng (non-blocking) | `handlePaymentCompleted()` |
| `@EnableAsync` | Bật tính năng @Async trên toàn app | `CineXApplication.java` |
| `@RequestParam Map<String, String>` | Nhận tất cả query params dưới dạng Map | `paymentCallback()` |
| `@Builder.Default` | Giá trị mặc định cho field khi dùng Lombok Builder | `status = PENDING` |

---

## 10. Câu hỏi tự kiểm tra

1. **Factory Pattern: Spring inject `Map<String, PaymentProcessor>` từ đâu?**
   → Từ tất cả Bean implement `PaymentProcessor` trong container. Key = tên `@Component` ("VNPAY", "CASH"). Spring tự gom lại thành Map và inject vào constructor của `PaymentProcessorFactory`.

2. **Thêm cổng ZaloPay → cần sửa bao nhiêu file?**
   → Chỉ 1 file mới: tạo `ZaloPayPaymentProcessor implements PaymentProcessor` với `@Component("ZALOPAY")`. Factory, Service, Controller KHÔNG SỬA gì cả. Thêm `ZALOPAY` vào enum `PaymentMethod`.

3. **@Async trên EventListener để làm gì? Không có @Async thì chuyện gì xảy ra?**
   → `@Async`: listener chạy trên thread riêng → user nhận response ngay sau khi payment complete, không chờ gửi notification. Không có `@Async` → user chờ gửi notification xong mới nhận response. Nguy hiểm hơn: nếu NotificationService lỗi → transaction rollback → Payment FAILED dù tiền đã bị trừ.

4. **Tại sao callback là GET không phải POST?**
   → Vì VNPay/cổng thanh toán **redirect browser** về callback URL sau khi user thanh toán. Browser redirect = GET request. Server không thể gửi POST redirect từ cổng thanh toán về app của mình.

5. **@OneToOne và `unique=true` khác gì @ManyToOne?**
   → `@OneToOne` kết hợp `unique=true` trên `@JoinColumn` tạo UNIQUE constraint trong DB → mỗi `booking_id` chỉ xuất hiện 1 lần trong bảng `payments`. `@ManyToOne` không có UNIQUE → nhiều payment cùng booking_id được phép (bán vé nhiều lần cho 1 booking — không chấp nhận được).

6. **Observer Pattern: thêm "gửi SMS sau thanh toán" → cần sửa PaymentService không?**
   → Không. Chỉ tạo thêm class `PaymentSmsListener` với `@Component` + `@EventListener` + `@Async`. Spring tự tìm và gọi listener này khi `PaymentCompletedEvent` được publish. `PaymentService` không thay đổi 1 dòng.

7. **Nếu VNPay gửi callback 2 lần (điều thường xảy ra), hệ thống xử lý thế nào?**
   → `handleCallback()` kiểm tra `payment.status == PENDING` trước khi xử lý. Lần 2 thấy status đã là `COMPLETED` → throw `INVALID_REQUEST "Payment already processed"`. Booking không bị confirm 2 lần, notification không bị gửi 2 lần.
