# Creational Patterns — Nhóm tạo đối tượng

Các pattern này giải quyết bài toán: **tạo object như thế nào** cho linh hoạt, dễ mở rộng.

---

## 1. Builder Pattern

### Là gì?
Tạo object phức tạp **từng bước một**, thay vì constructor dài loằng ngoằng.

### Ví dụ đời thường
Đặt pizza: chọn đế → chọn sốt → chọn topping → chọn size. Từng bước, rõ ràng.
Thay vì: `new Pizza("thin", "tomato", "cheese,pepperoni", "large")` — không biết cái nào là cái gì.

### Không dùng Builder (khó đọc)
```java
User user = new User("vanan", "an@gmail.com", "$2a$10$xxx", "Vũ Tường An", "0912345678", null, Role.USER, true);
//                   username   email          password      fullName       phone       avatar   role     enabled
// 8 tham số — dễ nhầm thứ tự, dễ sai
```

### Dùng Builder (dễ đọc)
```java
User user = User.builder()
    .username("vanan")
    .email("an@gmail.com")
    .password(passwordEncoder.encode("123456"))
    .fullName("Vũ Tường An")
    .phone("0912345678")
    .role(Role.USER)
    .build();
// Rõ ràng từng field, không nhầm thứ tự
```

### Cách hoạt động
Lombok `@Builder` tự sinh class `UserBuilder` bên trong `User`.
Mỗi field có 1 method tên giống (`.username()`, `.email()`, ...).
Mỗi method trả về chính builder → cho phép gọi liên tiếp (method chaining).
`.build()` tạo object cuối cùng.

### Dùng ở đâu trong CineX
- `User.builder()` — tạo user khi register
- `ApiResponse.builder()` — tạo response chuẩn
- `AuthResponse.builder()` — tạo response chứa token
- `RefreshToken.builder()` — tạo refresh token

### Khi nào không cần?
Object ít field (1-2 field) → dùng constructor bình thường cho gọn.

---

## 2. Factory Pattern

### Là gì?
Factory **tạo đúng loại object** dựa trên input, mà người gọi không cần biết class cụ thể.

### Ví dụ đời thường
Nhà máy sản xuất xe:
- Đặt hàng "sedan" → nhà máy trả Toyota Camry
- Đặt hàng "SUV" → nhà máy trả Toyota Fortuner

Bạn chỉ nói "tôi muốn sedan", không cần biết nhà máy lắp ráp thế nào.

### Không dùng Factory (if-else dài)
```java
public PaymentResult processPayment(String method, Booking booking) {
    if (method.equals("VNPAY")) {
        // 50 dòng code xử lý VNPay
    } else if (method.equals("MOMO")) {
        // 50 dòng code xử lý Momo
    } else if (method.equals("CASH")) {
        // 20 dòng code xử lý tiền mặt
    }
    // Thêm ZaloPay → phải sửa method này, thêm else if
    // Method ngày càng dài, khó đọc
}
```

### Dùng Factory (mở rộng dễ) — Cách "lý thuyết" với switch
```java
// Interface chung — hợp đồng
public interface PaymentProcessor {
    PaymentResult process(Booking booking);
    boolean verify(Map<String, String> callback);
}

// Mỗi phương thức = 1 class riêng (tên dưới đây là ví dụ giả định để minh họa lý thuyết)
public class VNPayProcessor implements PaymentProcessor { ... }
public class MomoProcessor implements PaymentProcessor { ... }
public class CashProcessor implements PaymentProcessor { ... }

// Factory phiên bản "kinh điển" — dùng switch
public class PaymentProcessorFactory {
    public PaymentProcessor getProcessor(String method) {
        return switch (method) {
            case "VNPAY" -> vnPayProcessor;
            case "MOMO"  -> momoProcessor;
            case "CASH"  -> cashProcessor;
            default -> throw new BusinessException(ErrorCode.INVALID_REQUEST);
        };
    }
}

// Thêm phương thức mới:
// 1. Tạo class mới implements PaymentProcessor
// 2. Thêm 1 case vào Factory (vẫn phải sửa Factory — chưa thực sự Open/Closed 100%)
```

> Lưu ý: các tên `VNPayProcessor`, `MomoProcessor`, `CashProcessor` ở trên CHỈ là tên giả định để minh họa khái niệm. CineX thực tế dùng tên khác (xem phần dưới).

### CineX dùng cách khác — Spring Map injection (không switch)

CineX không dùng `switch`. Thay vào đó, Spring tự inject `Map<String, PaymentProcessor>` — key là tên bean (qua `@Component("TÊN")`), value là instance.

```java
// File thực tế: module/payment/processor/PaymentProcessor.java
public interface PaymentProcessor {
    String createPayment(String transactionCode, BigDecimal amount, String description);
    boolean verifyCallback(Map<String, String> params);
}

// File thực tế: module/payment/processor/MoMoPaymentProcessor.java
// Đăng ký bean với tên "VNPAY" do FE đang gửi paymentMethod=VNPAY
// (về kỹ thuật, processor này gọi MoMo API)
@Component("VNPAY")
public class MoMoPaymentProcessor implements PaymentProcessor { ... }

// File thực tế: module/payment/processor/CashPaymentProcessor.java
@Component("CASH")
public class CashPaymentProcessor implements PaymentProcessor { ... }

// File thực tế: module/payment/processor/PaymentProcessorFactory.java
@Component
@RequiredArgsConstructor
public class PaymentProcessorFactory {

    // Spring tự inject: {"VNPAY": MoMoPaymentProcessor, "CASH": CashPaymentProcessor}
    private final Map<String, PaymentProcessor> processors;

    public PaymentProcessor getProcessor(PaymentMethod method) {
        PaymentProcessor processor = processors.get(method.name());
        if (processor == null) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Phương thức thanh toán không được hỗ trợ: " + method);
        }
        return processor;
    }
}
```

Ưu điểm so với switch:
- Thêm processor mới → tạo class mới với `@Component("TÊN")` → Spring tự thêm vào Map → KHÔNG sửa `PaymentProcessorFactory` (thật sự Open/Closed).
- Không có khối switch dài, không lo quên `default`.

### Dùng ở đâu trong CineX
- `PaymentProcessorFactory` — tạo processor theo phương thức thanh toán.
- Hiện tại CineX có 2 implementation thực: `MoMoPaymentProcessor` (bean "VNPAY") và `CashPaymentProcessor` (bean "CASH"). Enum `PaymentMethod` còn 2 giá trị `MOMO` và `TRANSFER` chưa có processor riêng — có thể thêm sau mà không sửa Factory.

### Khi nào không cần?
Chỉ có 1-2 loại cố định, không mở rộng → dùng if-else đơn giản hơn.

---

## 3. Singleton Pattern

### Là gì?
Cả ứng dụng chỉ có **1 instance duy nhất** của class. Spring Bean mặc định là Singleton.

### Ví dụ đời thường
Cả trường chỉ có 1 hiệu trưởng. Ai cần gặp hiệu trưởng đều gặp cùng 1 người.

### Trong CineX
```java
@Service  // Spring tạo 1 instance AuthService DUY NHẤT
public class AuthService {
    // 1000 request cùng lúc → tất cả dùng CÙNG 1 instance
    // OK vì AuthService không có state (không có field thay đổi theo request)
}
```

### Tại sao Spring dùng Singleton?
- **Tiết kiệm RAM:** 1 instance thay vì tạo mới mỗi request
- **Nhanh:** Không tốn thời gian new object
- Tất cả `@Service`, `@Repository`, `@Controller`, `@Component` đều Singleton

### Khi nào không nên?
Object có state thay đổi theo request → dùng `@Scope("prototype")`.
Nhưng trong CineX: tất cả service đều stateless → Singleton OK.
