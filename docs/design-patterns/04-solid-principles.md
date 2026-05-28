# SOLID & Nguyên tắc thiết kế

7 nguyên tắc giúp code **dễ đọc, dễ sửa, dễ mở rộng**. Mỗi nguyên tắc có ví dụ thực tế trong CineX.

---

## S — Single Responsibility (Một trách nhiệm)

### Là gì?
Mỗi class chỉ làm **1 việc**, chỉ có **1 lý do** để thay đổi.

### Ví dụ đời thường
Nhà hàng: đầu bếp nấu ăn, phục vụ bưng đồ, thu ngân tính tiền. Mỗi người 1 việc.
Nếu đầu bếp vừa nấu vừa bưng vừa tính tiền → làm không tốt việc nào cả.

### Trong CineX

**SAI — 1 class làm nhiều việc:**
```java
public class MovieController {
    public Movie createMovie(MovieRequest req) {
        // Validate input ← không phải việc controller
        if (req.getTitle() == null) throw ...;

        // Query DB ← không phải việc controller
        if (movieRepo.existsByTitle(req.getTitle())) throw ...;

        // Business logic ← không phải việc controller
        Movie movie = new Movie();
        movie.setTitle(req.getTitle());
        movieRepo.save(movie);

        // Gửi email thông báo ← hoàn toàn không phải việc controller
        emailService.send("New movie: " + movie.getTitle());

        return movie;
    }
}
```

**ĐÚNG — Mỗi class 1 việc:**
```java
// Controller: CHỈ nhận request + trả response
@RestController
public class MovieController {
    public ApiResponse<MovieResponse> createMovie(@Valid @RequestBody MovieRequest req) {
        return ApiResponse.ok(movieService.createMovie(req));
    }
}

// Service: CHỈ xử lý business logic
@Service
public class MovieService {
    public MovieResponse createMovie(MovieRequest req) {
        if (movieRepo.existsByTitle(req.getTitle())) throw ...;
        Movie movie = movieMapper.toEntity(req);
        movieRepo.save(movie);
        eventPublisher.publishEvent(new MovieCreatedEvent(movie)); // decouple email
        return movieMapper.toResponse(movie);
    }
}

// Validation: DTO tự validate bằng @NotBlank, @Size
// Email: Listener riêng nghe MovieCreatedEvent
```

---

## O — Open/Closed (Mở/Đóng)

### Là gì?
**Mở** để mở rộng (thêm tính năng mới), **đóng** để sửa đổi (không sửa code cũ).

### Ví dụ đời thường
Ổ cắm điện: cắm thêm thiết bị mới (mở rộng) mà không cần đập tường thay dây điện (sửa đổi).

### Trong CineX — Payment

**SAI — Thêm method mới phải sửa code cũ:**
```java
public PaymentResult process(String method, Booking booking) {
    if (method.equals("VNPAY")) { ... }
    else if (method.equals("MOMO")) { ... }
    // Thêm ZaloPay → PHẢI sửa method này, thêm else if
}
```

**ĐÚNG — Thêm mà không sửa:**
```java
// Interface (đóng — không sửa)
public interface PaymentProcessor {
    PaymentResult process(Booking booking);
}

// Implementation (mở — thêm class mới)
public class VNPayProcessor implements PaymentProcessor { ... }
public class MomoProcessor implements PaymentProcessor { ... }
public class ZaloPayProcessor implements PaymentProcessor { ... }  // ← THÊM MỚI
// PaymentService KHÔNG bị sửa
```

---

## L — Liskov Substitution (Thay thế)

### Là gì?
Class con có thể **thay thế** class cha mà chương trình vẫn chạy đúng.

### Trong CineX
```java
// PaymentProcessor interface — class con thay thế được
PaymentProcessor processor = new MockPaymentProcessor();   // OK
PaymentProcessor processor = new CashPaymentProcessor();   // OK — thay thế, vẫn chạy đúng
processor.createPayment(code, amount, desc);               // Cả 2 đều hoạt động
```

---

## I — Interface Segregation (Tách interface)

### Là gì?
Interface nhỏ, **chuyên biệt**. Không ép class implement method không cần.

### Ví dụ đời thường
Điều khiển TV: chỉ có nút bật/tắt, chuyển kênh, tăng/giảm âm.
Không nhồi thêm nút: gọi điện, chụp ảnh, duyệt web.

### Trong CineX

**SAI — Interface quá lớn:**
```java
public interface PaymentProcessor {
    PaymentResult process(Booking booking);
    boolean verify(Map<String, String> callback);
    void sendReceipt(Payment payment);         // ← CashProcessor không cần
    String generateQrCode(Payment payment);    // ← VNPayProcessor không cần
}
```

**ĐÚNG — Interface nhỏ:**
```java
public interface PaymentProcessor {
    PaymentResult process(Booking booking);
    boolean verify(Map<String, String> callback);
}
// Chỉ 2 method mà TẤT CẢ processor đều cần
```

---

## D — Dependency Inversion (Đảo ngược phụ thuộc)

### Là gì?
Code phụ thuộc vào **abstraction** (interface), không phụ thuộc vào implementation cụ thể.

### Ví dụ đời thường
Ổ cắm USB: laptop phụ thuộc vào chuẩn USB (interface), không phụ thuộc vào chuột Logitech cụ thể. Đổi chuột Dell cũng cắm được.

### Trong CineX

**SAI — Phụ thuộc vào class cụ thể:**
```java
public class PaymentService {
    private final VNPayProcessor processor;  // ← coupling chặt vào VNPay
    // Muốn đổi sang Momo → phải sửa class này
}
```

**ĐÚNG — Phụ thuộc vào interface:**
```java
public class PaymentService {
    private final PaymentProcessor processor;  // ← interface
    // VNPay, Momo, ZaloPay đều implement PaymentProcessor
    // Đổi implementation mà PaymentService KHÔNG bị sửa
}
```

---

## DRY — Don't Repeat Yourself

### Là gì?
Không viết lại code đã có. Lặp 2 lần → tách ra chung.

### Trong CineX
```
BaseEntity   → id, version, storageState, audit — dùng cho 8 entity
Specification.notDeleted() → filter soft delete — dùng cho mọi module
ApiResponse  → format response chuẩn — dùng cho mọi API
Filter DTO   → nhận search/filter params — pattern dùng cho mọi list API
```

**Nếu không DRY:** 8 entity × 7 field BaseEntity = 56 field viết lại. Sửa 1 chỗ → sửa 8 chỗ.

---

## KISS — Keep It Simple, Stupid

### Là gì?
Giữ code **đơn giản nhất** có thể. Không over-engineering.

### Trong CineX
```java
// KISS ✅ — đơn giản, dễ hiểu
public String formatVND(long amount) {
    return VND_FORMAT.format(amount) + " ₫";
}

// Over-engineering ❌ — quá phức tạp cho 1 việc đơn giản
public class CurrencyFormatterFactory {
    public CurrencyFormatter getFormatter(String currency) {
        return switch (currency) {
            case "VND" -> new VNDFormatter();
            case "USD" -> new USDFormatter();
            // Chỉ dùng VND → không cần Factory + Strategy cho currency
        };
    }
}
```

**Quy tắc:** Chỉ dùng pattern khi **thật sự cần**. 3 dòng if-else tốt hơn 1 Factory pattern cho 2 case.
