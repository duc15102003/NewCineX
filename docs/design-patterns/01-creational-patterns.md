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

### Dùng Factory (mở rộng dễ)
```java
// Interface chung — hợp đồng
public interface PaymentProcessor {
    PaymentResult process(Booking booking);
    boolean verify(Map<String, String> callback);
}

// Mỗi phương thức = 1 class riêng
public class VNPayProcessor implements PaymentProcessor { ... }
public class MomoProcessor implements PaymentProcessor { ... }
public class CashProcessor implements PaymentProcessor { ... }

// Factory — trả đúng processor
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

// Service — gọi factory, 1 dòng sạch sẽ
PaymentProcessor processor = factory.getProcessor(method);
return processor.process(booking);

// Thêm ZaloPay:
// 1. Tạo class ZaloPayProcessor implements PaymentProcessor
// 2. Thêm 1 case vào Factory
// KHÔNG sửa PaymentService → Open/Closed Principle
```

### Dùng ở đâu trong CineX
- `PaymentProcessorFactory` — tạo processor theo phương thức thanh toán (task 010)

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
