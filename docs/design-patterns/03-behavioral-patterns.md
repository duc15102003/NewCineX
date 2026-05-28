# Behavioral Patterns — Nhóm hành vi

Các pattern này giải quyết bài toán: **các object tương tác với nhau như thế nào**.

---

## 1. Template Method Pattern

### Là gì?
Class cha định nghĩa **khung sườn**, class con chỉ **override phần khác biệt**.

### Ví dụ đời thường
Pha đồ uống: đun nước (giống) → cho nguyên liệu (khác: trà/cà phê) → rót ra cốc (giống).

### Không dùng (lặp code)
```java
// MovieService viết CRUD
public Movie findById(Long id) {
    return movieRepo.findById(id).orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
}

// RoomService viết LẠI y chang
public Room findById(Long id) {
    return roomRepo.findById(id).orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
}
// 8 module → viết lại 8 lần cùng 1 code
```

### Dùng Template Method (viết 1 lần)
```java
public abstract class BaseService<E extends BaseEntity, ID> {
    protected abstract JpaRepository<E, ID> getRepository(); // class con override

    public E findById(ID id) {
        return getRepository().findById(id)
            .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    }
    public void softDelete(ID id) {
        E entity = findById(id);
        entity.setStorageState("DELETED");
        getRepository().save(entity);
    }
}

// MovieService — chỉ cần 3 dòng
public class MovieService extends BaseService<Movie, Long> {
    @Override
    protected JpaRepository<Movie, Long> getRepository() { return movieRepository; }
}
```

### Lưu ý
> Ví dụ trên là **minh họa lý thuyết**. Trong CineX thực tế, BaseService đã được bỏ vì mỗi module cần logic CRUD khác nhau (mapper khác, filter khác). Thay vào đó dùng **Filter DTO + Specification** pattern thống nhất cho tất cả list API.

---

## 2. Strategy Pattern

### Là gì?
Định nghĩa **nhiều cách thực hiện** cùng 1 hành động, chọn cách nào lúc runtime.

### Ví dụ đời thường
Đi du lịch: xe buýt (rẻ, chậm) / taxi (đắt, nhanh) / xe máy (trung bình). Cùng đích đến, cách đi khác.

### Trong CineX — Tính giá vé
```java
public interface PricingStrategy {
    BigDecimal calculatePrice(BigDecimal basePrice, Showtime showtime, Seat seat);
}

public class WeekendPricing implements PricingStrategy {
    public BigDecimal calculatePrice(BigDecimal basePrice, Showtime showtime, Seat seat) {
        if (DateTimeUtil.isWeekend(showtime.getStartTime().toLocalDate())) {
            return MoneyUtil.applyMultiplier(basePrice, 1.2); // ×1.2 cuối tuần
        }
        return basePrice;
    }
}

public class EveningPricing implements PricingStrategy {
    public BigDecimal calculatePrice(BigDecimal basePrice, Showtime showtime, Seat seat) {
        if (DateTimeUtil.isEveningShow(showtime.getStartTime())) {
            return MoneyUtil.applyMultiplier(basePrice, 1.1); // ×1.1 suất tối
        }
        return basePrice;
    }
}

// Ghép nhiều strategy
BigDecimal price = basePrice; // 75.000
for (PricingStrategy strategy : strategies) {
    price = strategy.calculatePrice(price, showtime, seat);
}
// → 75.000 × 1.2 (cuối tuần) × 1.1 (suất tối) = 99.000
```

### Factory vs Strategy — khác gì?

| | Factory | Strategy |
|---|---|---|
| Mục đích | **Tạo** đúng loại object | **Chọn** đúng thuật toán |
| Kết quả | Trả về object mới | Thực hiện logic, trả kết quả |

### Dùng ở đâu: Task 008-010 (pricing, payment)

---

## 3. Observer Pattern (Spring Events)

### Là gì?
Khi có sự kiện xảy ra, **tự động thông báo** cho tất cả "người đăng ký" mà không cần biết họ là ai.

### Ví dụ đời thường
YouTube: đăng video mới → tự động thông báo cho tất cả subscriber. YouTuber không cần biết ai đang subscribe.

### Không dùng Observer (coupling chặt)
```java
public class BookingService {
    private final EmailService emailService;
    private final NotificationService notifService;
    private final AuditLogService auditService;

    public void confirmBooking(Long bookingId) {
        // ... confirm logic ...
        emailService.sendConfirmation(booking);     // phải gọi thủ công
        notifService.createNotification(booking);   // phải gọi thủ công
        auditService.logAction("CONFIRMED");        // phải gọi thủ công
        // Thêm SMS → phải sửa BookingService
    }
}
```

### Dùng Observer (decouple)
```java
// BookingService — chỉ publish event
public void confirmBooking(Long bookingId) {
    // ... confirm logic ...
    eventPublisher.publishEvent(new BookingConfirmedEvent(booking));
    // XONG. Không biết ai sẽ xử lý.
}

// Listener riêng — tự nghe event
@EventListener
public void onBookingConfirmed(BookingConfirmedEvent event) {
    emailService.sendConfirmation(event.getBooking());
}

// Thêm SMS → tạo SmsListener (file mới), KHÔNG sửa BookingService
```

### Dùng ở đâu: Task 009, 010 (Booking confirmed → email, notification)

---

## 4. State Pattern

### Là gì?
Quản lý **trạng thái** của object, mỗi trạng thái chỉ cho phép chuyển sang một số trạng thái nhất định.

### Ví dụ đời thường
Đèn giao thông: Đỏ → Xanh → Vàng → Đỏ. Không thể nhảy Đỏ → Vàng.

### Trong CineX — Booking Status
```
HOLDING → CONFIRMED → CHECKED_IN
       → EXPIRED
       → CANCELLED

Hợp lệ:    HOLDING → CONFIRMED ✅
Không hợp lệ: CHECKED_IN → HOLDING ❌
              CANCELLED → CONFIRMED ❌
```

### Dùng ở đâu: Task 009 (Booking status flow)

---

## 5. Filter Pattern (Chain of Responsibility)

### Là gì?
Request đi qua **chuỗi bộ lọc**, mỗi filter kiểm tra 1 thứ. Pass hết → đến Controller.

### Ví dụ đời thường
Vào sân bay: kiểm tra vé → kiểm tra hộ chiếu → kiểm tra hành lý → lên máy bay.

### Trong CineX
```
Request → CorsFilter (kiểm tra origin)
       → JwtAuthFilter (kiểm tra token)
       → AuthorizationFilter (kiểm tra quyền)
       → Controller (xử lý)
```

### Dùng ở đâu: Security (JwtAuthFilter)

---

## 6. Specification Pattern — Tìm kiếm động

### Là gì?
Cho phép **ghép nhiều điều kiện tìm kiếm** linh hoạt, không cần viết hàng chục method repository.

### Ví dụ đời thường
Batdongsan.com: ☑ Quận 7 + ☑ 2 phòng ngủ + ☑ Dưới 10 triệu.
Mỗi checkbox = 1 Specification. Tick nhiều = ghép nhiều Specification.

### Không dùng Specification (nổ tổ hợp)
```java
public interface MovieRepository {
    List<Movie> findByTitle(String title);
    List<Movie> findByGenre(String genre);
    List<Movie> findByStatus(String status);
    List<Movie> findByTitleAndGenre(String title, String genre);
    List<Movie> findByTitleAndStatus(String title, String status);
    List<Movie> findByTitleAndGenreAndStatus(String t, String g, String s);
    // 3 điều kiện → 7 method. 5 điều kiện → 31 method!
}
```

### Dùng Specification (ghép linh hoạt)
```java
public class MovieSpecification {
    public static Specification<Movie> titleContains(String keyword) {
        return (root, query, cb) ->
            cb.like(cb.lower(root.get("title")), "%" + keyword.toLowerCase() + "%");
    }
    public static Specification<Movie> hasGenre(Long genreId) {
        return (root, query, cb) -> {
            Join<Movie, Genre> genres = root.join("genres");
            return cb.equal(genres.get("id"), genreId);
        };
    }
    public static Specification<Movie> hasStatus(String status) {
        return (root, query, cb) -> cb.equal(root.get("status"), status);
    }
}

// Service — ghép tùy ý
Specification<Movie> spec = Specification.where(null);
if (keyword != null) spec = spec.and(MovieSpecification.titleContains(keyword));
if (genreId != null) spec = spec.and(MovieSpecification.hasGenre(genreId));
if (status != null)  spec = spec.and(MovieSpecification.hasStatus(status));
return movieRepository.findAll(spec, pageable);
// 10 điều kiện → 10 method đơn giản. Ghép tùy ý.
```

### Dùng ở đâu: Task 005 (Movie search + filter)

---

## 7. Enum Pattern

### Là gì?
Dùng enum thay vì String cho tập giá trị cố định. Sai giá trị → lỗi compile, không lỗi runtime.

### Ví dụ đời thường
Đèn giao thông: chỉ có ĐỎ, VÀNG, XANH. Dùng String ai đó gõ "xanh lá" → hệ thống không hiểu.

### Dùng String (dễ sai)
```java
movie.setStatus("NOW_SHIOWING"); // typo → bug, compile vẫn pass
```

### Dùng Enum (không thể sai)
```java
movie.setStatus(MovieStatus.NOW_SHOWING); // IDE gợi ý, không thể sai
movie.setStatus(MovieStatus.NOW_SHIOWING); // LỖI COMPILE NGAY
```

### Enum trong CineX

| Enum | Giá trị |
|---|---|
| `Role` | USER, ADMIN |
| `MovieStatus` | COMING_SOON, NOW_SHOWING, ENDED |
| `BookingStatus` | HOLDING, CONFIRMED, CHECKED_IN, CANCELLED, EXPIRED |
| `PaymentMethod` | VNPAY, MOMO, CASH |
| `SeatType` | STANDARD, VIP, COUPLE |

### Luôn dùng `@Enumerated(EnumType.STRING)`, KHÔNG dùng `ORDINAL`
- STRING lưu "NOW_SHOWING" → đọc DB hiểu ngay
- ORDINAL lưu số 0, 1, 2 → thêm enum ở giữa sai hết thứ tự

### Dùng ở đâu: Tất cả entity có trạng thái
