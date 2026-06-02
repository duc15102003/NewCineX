# Module Booking — Giải thích chi tiết

## 1. Tổng quan
Module phức tạp nhất — xử lý **luồng đặt vé hoàn chỉnh**:
1. User chọn suất chiếu → chọn ghế → **hold 10 phút**
2. Thanh toán → **confirm** booking
3. Đến rạp → staff quét QR → **check-in**
4. Hết 10 phút không thanh toán → **tự động hủy** (scheduled task)

**Bài toán khó:** 2 user chọn cùng ghế cùng lúc → chỉ 1 người hold được (concurrency).

**Real-time:** Dùng **WebSocket (STOMP)** push cập nhật ghế cho tất cả user đang xem sơ đồ ghế:
- User A hold ghế E1 → Server push "E1 đã giữ" → User B thấy E1 đổi màu NGAY LẬP TỨC
- Booking expire → Server push "E1 trống" → tất cả user thấy ghế trả lại
- Không cần refresh trang, không cần polling

---

## 2. Danh sách files đầy đủ

| File | Tác dụng | Design Pattern |
|---|---|---|
| `module/booking/entity/Booking.java` | Entity đơn đặt vé (HOLDING→CONFIRMED→CHECKED_IN) | BaseEntity, @OneToMany cascade |
| `module/booking/entity/BookingSeat.java` | Entity chi tiết ghế trong đơn (snapshot price) | — |
| `module/booking/entity/BookingStatus.java` | Enum trạng thái booking | Enum Pattern |
| `module/booking/entity/BookingSeatStatus.java` | Enum trạng thái ghế trong booking | Enum Pattern |
| `module/booking/dto/HoldSeatsRequest.java` | DTO yêu cầu giữ ghế (showtimeId, seatIds, voucherCode) | DTO + Validation |
| `module/booking/dto/HoldSeatsResponse.java` | DTO trả về sau hold (bookingId, holdExpiry, seats) | DTO + Builder |
| `module/booking/dto/ConfirmBookingRequest.java` | DTO xác nhận booking (bookingId) | DTO + Validation |
| `module/booking/dto/BookingResponse.java` | DTO chi tiết booking đầy đủ | DTO + Builder |
| `module/booking/dto/BookingListResponse.java` | DTO rút gọn cho danh sách (không có seat detail) | DTO + Builder |
| `module/booking/dto/BookingSeatResponse.java` | DTO thông tin 1 ghế trong booking | DTO + Builder |
| `module/booking/dto/BookingFilter.java` | DTO filter danh sách booking (status, includeDeleted) | DTO |
| `module/booking/repository/BookingRepository.java` | JPA repository + JpaSpecificationExecutor | Repository + Specification |
| `module/booking/repository/BookingSeatRepository.java` | Custom query tìm ghế HELD/BOOKED | Repository + @Query |
| `module/booking/specification/BookingSpecification.java` | Build WHERE động theo user + status | Specification Pattern |
| `module/booking/service/BookingService.java` | Business logic: holdSeats, confirm, cancel, checkIn | Service |
| `module/booking/service/BookingCleanupScheduler.java` | Scheduled task dọn booking hết hạn mỗi 60s | Scheduled Task |
| `module/booking/service/SeatWebSocketService.java` | Push real-time cập nhật ghế qua WebSocket | Observer-like |
| `module/booking/controller/BookingController.java` | 7 endpoints REST | Controller |

---

## 3. Luồng đặt vé — State Machine

```
                    ┌─────────────┐
                    │   HOLDING   │ ← Hold ghế (10 phút)
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
      ┌──────────┐  ┌──────────┐  ┌──────────┐
      │CONFIRMED │  │ EXPIRED  │  │CANCELLED │
      │(đã TT)   │  │(hết hạn) │  │(user hủy)│
      └────┬─────┘  └──────────┘  └──────────┘
           │
      ┌────▼─────┐
      │CANCELLED │ ← User hủy sau khi confirm (trước giờ chiếu)
      └──────────┘
           │
      (nếu không hủy)
           ▼
      ┌──────────┐
      │CHECKED_IN│ ← Staff quét QR tại rạp
      └──────────┘
```

Quy tắc chuyển trạng thái (ai được làm gì):
- `HOLDING → CONFIRMED` — thanh toán xong (PaymentService.handleCallback)
- `HOLDING → EXPIRED` — hết 10 phút (BookingCleanupScheduler tự đổi)
- `HOLDING → CANCELLED` — user hủy chủ động
- `CONFIRMED → CANCELLED` — user hủy trước giờ chiếu
- `CONFIRMED → CHECKED_IN` — staff quét QR tại rạp

---

## 4. Design Patterns

### 4.1 Scheduled Task (@Scheduled)

**Pattern là gì?**
Cho phép Spring tự động gọi 1 method theo lịch — không cần client trigger, server tự chạy định kỳ.

**Ví dụ đời thường:**
Giống như đồng hồ hẹn giờ trong lò vi sóng — bạn set 3 phút, sau 3 phút lò tự tắt. Bạn không cần đứng canh, không cần bấm gì thêm.

```java
// BookingCleanupScheduler.java
@Scheduled(fixedRate = 60000)  // Chạy mỗi 60.000ms = 60 giây
@Transactional
public void cleanupExpiredHolds() {
    int holdMinutes = systemConfigService.getInt("booking.hold_minutes", 10);
    LocalDateTime expireBefore = LocalDateTime.now().minusMinutes(holdMinutes);

    List<Booking> expiredBookings = bookingRepository.findByStatusAndCreatedAtBefore(
            BookingStatus.HOLDING, expireBefore);

    for (Booking booking : expiredBookings) {
        booking.setStatus(BookingStatus.EXPIRED);
        booking.getBookingSeats().forEach(bs -> bs.setStatus(BookingSeatStatus.CANCELLED));
        bookingRepository.save(booking);

        // Real-time: ghế hết hạn → notify AVAILABLE cho tất cả user đang xem
        List<Long> seatIds = booking.getBookingSeats().stream()
                .map(bs -> bs.getSeat().getId()).toList();
        seatWebSocketService.notifySeatChanged(booking.getShowtime().getId(), seatIds, "AVAILABLE");
    }
}
```

**Ví dụ timeline:**
```
14:00:00 — User A hold ghế E1, E2, E3 → Booking #1 tạo (HOLDING)
14:01:00 — Scheduler chạy → tìm HOLDING + createdAt < 13:51 → không có gì
14:02:00 — Scheduler chạy → tìm HOLDING + createdAt < 13:52 → không có gì
...
14:11:00 — Scheduler chạy → tìm HOLDING + createdAt < 14:01 → thấy Booking #1!
           → Booking #1 → EXPIRED
           → BookingSeats → CANCELLED
           → WebSocket push: E1, E2, E3 → AVAILABLE
           → User B đang xem sơ đồ ghế thấy E1, E2, E3 trống lại
```

#### fixedRate vs fixedDelay vs cron — khi nào dùng cái nào?

| Thuộc tính | Nghĩa | Ví dụ |
|---|---|---|
| `fixedRate = 60000` | Chạy MỖI 60s, tính từ lần chạy TRƯỚC BẮT ĐẦU | 14:00 → 14:01 → 14:02 (dù task chạy 30s hay 5s) |
| `fixedDelay = 60000` | Chạy sau 60s KỂ TỪ LÚC task TRƯỚC KẾT THÚC | 14:00 start → 14:00:30 end → 14:01:30 start tiếp |
| `cron = "0 * * * * *"` | Cron expression — lịch linh hoạt | "0 0 2 * * *" = 2h sáng mỗi ngày |

**Tại sao dùng fixedRate = 60000 cho cleanup?**
- Muốn check đều đặn mỗi phút, bất kể task chạy nhanh hay chậm
- Không cần chính xác đến giây (booking expire 10 phút, sai 1 phút không vấn đề)
- `fixedDelay` nguy hiểm hơn: nếu DB chậm, task mất 10s → lần tiếp theo bị trễ

**Ví dụ cron expression hay dùng:**
```
"0 * * * * *"      = mỗi phút đầu (giây 0)
"0 0 * * * *"      = mỗi giờ
"0 0 2 * * *"      = 2h sáng mỗi ngày
"0 0 12 * * MON"   = 12h trưa mỗi thứ 2
```

**@EnableScheduling để ở đâu?**
```java
// CineXApplication.java — class main
@SpringBootApplication
@EnableScheduling   // PHẢI có dòng này → nếu thiếu, tất cả @Scheduled không chạy
public class CineXApplication {
    public static void main(String[] args) {
        SpringApplication.run(CineXApplication.class, args);
    }
}
```

**Không có @EnableScheduling → @Scheduled hoàn toàn bị bỏ qua, không báo lỗi, chỉ im lặng không chạy → rất khó debug!**

---

### 4.2 Pessimistic vs Optimistic Lock — Concurrency khi hold ghế

**Bài toán:** 2 user A và B cùng lúc muốn giữ ghế E1 trong cùng suất chiếu.

```
User A: check E1 trống → ✅ → hold E1
User B: check E1 trống → ✅ → hold E1  ← Hai người check CÙNG LÚC → đều thấy trống!
                                           → Cả 2 đều hold được → BÁN TRÙNG!
```

Đây là **race condition** (điều kiện tranh chấp) — bài toán kinh điển trong hệ thống đặt vé.

#### So sánh 2 giải pháp

| Tiêu chí | Pessimistic Lock | Optimistic Lock |
|---|---|---|
| **Cơ chế** | Lock row DB trước khi đọc, giải phóng sau transaction | Thêm cột `version`, check version khi UPDATE |
| **SQL** | `SELECT ... FOR UPDATE` (lock hàng) | `UPDATE ... WHERE version = N` |
| **Tranh chấp** | User sau bị **block** (chờ lock) | User sau bị **rollback** (OptimisticLockException) |
| **Hiệu năng** | Chậm hơn (blocking) | Nhanh hơn (non-blocking) |
| **Phù hợp khi** | Tranh chấp thường xuyên, dữ liệu quan trọng | Tranh chấp ít, read nhiều hơn write |
| **Annotation JPA** | `@Lock(LockModeType.PESSIMISTIC_WRITE)` | `@Version` trên field entity |
| **Ví dụ đời thường** | Nhà vệ sinh có khóa cửa — vào được thì khóa, người sau phải chờ | Google Docs — ai save sau sẽ thấy conflict, phải resolve |

#### Cách CineX xử lý (không dùng lock — tại sao?)

Thay vì lock, CineX dùng **check-before-insert trong cùng transaction**:

```java
// BookingService.holdSeats()
@Transactional  // Đảm bảo check + insert là ATOMIC
public HoldSeatsResponse holdSeats(Long userId, HoldSeatsRequest request) {
    // Check ghế trống
    List<BookingSeat> occupied = bookingSeatRepository.findHeldOrBookedSeats(
            request.getShowtimeId(), request.getSeatIds());

    if (!occupied.isEmpty()) {
        throw new BusinessException(ErrorCode.SEAT_ALREADY_BOOKED, "Seats already taken: ...");
    }

    // Insert BookingSeat ngay trong cùng transaction
    // Nếu 2 user check cùng lúc → DB constraint UNIQUE bắt lỗi
    // Hoặc: user sau đến sẽ thấy ghế đã HELD từ user trước
    ...
}
```

**Tại sao approach này hoạt động?**
- SQL Server mặc định **Read Committed** isolation → transaction A commit → transaction B mới thấy dữ liệu mới
- 2 transaction kiểm tra ghế **song song** → có thể cùng thấy trống
- Nhưng chỉ 1 transaction INSERT thành công (do UNIQUE constraint trên `booking_seats`)
- Transaction còn lại → `DataIntegrityViolationException` → Spring bắt → trả lỗi cho user

**Khi nào nên dùng Pessimistic Lock thật sự?**
- Hệ thống vé sự kiện lớn (concert, World Cup) — tranh chấp cực cao
- Thêm `@Lock(LockModeType.PESSIMISTIC_WRITE)` vào query findHeldOrBookedSeats
- SQL: `SELECT bs.* FROM booking_seats bs ... WITH (UPDLOCK, ROWLOCK)` (SQL Server)

---

### 4.3 @OneToMany với cascade và orphanRemoval

```java
// Booking.java
@OneToMany(mappedBy = "booking", cascade = CascadeType.ALL, orphanRemoval = true)
@Builder.Default
private List<BookingSeat> bookingSeats = new ArrayList<>();
```

**cascade = CascadeType.ALL nghĩa là gì?**

"Cascade" = "thác nước" — hành động trên cha tự động lan xuống con.

```
CascadeType.ALL bao gồm:
  PERSIST  → save(booking) → tự động save tất cả bookingSeats
  MERGE    → update booking → tự động update bookingSeats
  REMOVE   → delete booking → tự động delete bookingSeats
  REFRESH  → refresh booking → tự động refresh bookingSeats
  DETACH   → detach booking → tự động detach bookingSeats
```

**Ví dụ đời thường:** Giống như bạn xóa 1 đơn hàng → hệ thống tự xóa luôn tất cả chi tiết đơn hàng. Không cần xóa từng dòng bằng tay.

**orphanRemoval = true nghĩa là gì?**
- "Orphan" = "mồ côi" — BookingSeat không còn thuộc Booking nào
- Nếu bạn làm `booking.getBookingSeats().remove(bs)` → BookingSeat bị xóa khỏi DB luôn
- Không có orphanRemoval → BookingSeat vẫn tồn tại trong DB dù bị remove khỏi collection → dữ liệu rác!

```java
// VÍ DỤ: Xóa 1 ghế khỏi booking
booking.getBookingSeats().removeIf(bs -> bs.getSeat().getId().equals(seatId));
// orphanRemoval = true → JPA tự DELETE FROM booking_seats WHERE id = ?
// orphanRemoval = false → KHÔNG xóa → dữ liệu rác trong DB
```

**@Builder.Default — tại sao cần?**
```java
// Không có @Builder.Default:
Booking booking = Booking.builder().user(user)...build();
booking.getBookingSeats(); // → NullPointerException! Vì Lombok Builder không tự khởi tạo

// Có @Builder.Default:
@Builder.Default
private List<BookingSeat> bookingSeats = new ArrayList<>();
// → Dù dùng Builder, list vẫn được khởi tạo = new ArrayList<>()
```

---

### 4.4 IdTrackerService — Sinh mã booking unique

```java
String bookingCode = idTrackerService.nextCodeWithDate("BOOKING");
// → "CX-20260520-001", "CX-20260520-002", ...
// CX = prefix từ config, 20260520 = ngày hôm nay, 001 = số thứ tự tăng dần trong ngày
// Ngày hôm sau reset về 001
```

**Tại sao không dùng ID tự tăng (1, 2, 3...)?**
- ID số dễ đoán → user có thể đoán booking của người khác
- Code dạng "CX-20260520-001" → đẹp, có ý nghĩa, dễ đọc khi in vé
- Có ngày trong code → dễ tra cứu ("vé ngày 20/5 mã bao nhiêu?")

---

### 4.5 QR Code (ZXing)

```java
// BookingController.java — endpoint /api/bookings/{id}/qr
String qrBase64 = qrCodeService.generateQrCodeBase64(booking.getBookingCode(), 300);
// bookingCode: "CX-20260520-001" → mã hóa thành QR 300x300 pixel
// Trả về chuỗi Base64

// Frontend hiển thị:
// <img src="data:image/png;base64,iVBORw0KGgo..." />
```

**Staff quét QR → lấy được bookingCode → gọi POST /api/bookings/check-in?code=CX-20260520-001**

---

## 5. Sơ đồ luồng chi tiết

### 5.1 holdSeats — Giữ ghế

```
POST /api/bookings/hold
Body: { "showtimeId": 1, "seatIds": [10, 11, 12], "voucherCode": "SUMMER10" }
│
▼
[JwtAuthFilter] Xác thực JWT → lấy username
│
▼
BookingController.holdSeats(@Valid HoldSeatsRequest)
│ → getCurrentUserId() → query DB lấy userId từ username
│
▼
BookingService.holdSeats(userId=5, request) [@Transactional]
│
├── 1. userRepository.findById(5) → User entity
│
├── 2. showtimeRepository.findById(1) → Showtime entity
│     └── Nếu không tồn tại → throw SHOWTIME_NOT_FOUND (404)
│
├── 3. Validate showtime chưa bắt đầu
│     └── showtime.startTime < now() → throw INVALID_REQUEST (400)
│
├── 4. Validate max seats: systemConfigService.getInt("booking.max_seats", 8)
│     └── request.seatIds.size() > 8 → throw INVALID_REQUEST (400)
│
├── 5. Check ghế trống:
│     bookingSeatRepository.findHeldOrBookedSeats(showtimeId=1, seatIds=[10,11,12])
│     SQL: SELECT bs.* FROM booking_seats bs
│          JOIN bookings b ON bs.booking_id = b.id
│          WHERE b.showtime_id = 1
│            AND bs.seat_id IN (10, 11, 12)
│            AND bs.status IN ('HELD', 'BOOKED')
│     → Nếu không rỗng → throw SEAT_ALREADY_BOOKED (409) "Seats already taken: E1, E2"
│
├── 6. seatRepository.findAllById([10,11,12]) → 3 Seat entities
│     → Nếu count != 3 → throw SEAT_NOT_FOUND (404)
│
├── 7. Tính tổng tiền theo loại ghế:
│     STANDARD → showtime.basePrice (75.000đ)
│     VIP      → showtime.vipPrice  (100.000đ)
│     COUPLE   → showtime.couplePrice (150.000đ)
│     totalAmount = 75.000 + 100.000 + 100.000 = 275.000đ
│
├── 8. Áp dụng voucher (nếu có "SUMMER10"):
│     voucherService.validateVoucher("SUMMER10", 275.000, userId=5)
│     → discountAmount = 27.500 (10%)
│     → totalAmount = 275.000 - 27.500 = 247.500đ
│
├── 9. Sinh bookingCode: idTrackerService.nextCodeWithDate("BOOKING")
│     → "CX-20260520-001"
│
├── 10. Tạo Booking entity:
│      status = HOLDING, bookingCode = "CX-20260520-001", totalAmount = 247.500đ
│      bookingRepository.save(booking)
│      → INSERT INTO bookings (user_id, showtime_id, total_amount, status, booking_code, ...)
│
├── 11. Tạo 3 BookingSeat entities (lặp qua seats):
│      BookingSeat.builder().booking(b).seat(s).price(p).status(HELD).build()
│      bookingSeatRepository.save(bs) × 3
│      → INSERT INTO booking_seats (booking_id, seat_id, price, status) × 3
│
├── 12. seatWebSocketService.notifySeatChanged(showtimeId=1, [10,11,12], "HELD")
│      → STOMP message đến topic /topic/seats/1
│      → Tất cả FE đang xem suất chiếu 1 nhận được: ghế 10,11,12 đổi sang HELD (màu vàng)
│
└── 13. Return HoldSeatsResponse {
          bookingId: 1, bookingCode: "CX-20260520-001",
          holdExpiry: "2026-05-20T14:10:00",  ← createdAt + 10 phút
          totalAmount: 247500,
          seats: [{ seatId:10, seatNumber:"E1", seatType:"VIP", price:100000, status:"HELD" }, ...]
        }
```

### 5.2 confirmBooking — Xác nhận sau thanh toán

```
POST /api/bookings/confirm
Body: { "bookingId": 1 }
│
▼
BookingService.confirmBooking(userId=5, request) [@Transactional]
│
├── 1. bookingRepository.findById(1) → Booking entity
│
├── 2. Check quyền: booking.user.id == 5?
│     → Không khớp → throw FORBIDDEN (403) "Not your booking"
│
├── 3. Check trạng thái: booking.status == HOLDING?
│     → Không phải → throw INVALID_REQUEST (400) "Booking is not in HOLDING status, current: EXPIRED"
│
├── 4. Check hết hạn hold:
│     holdMinutes = systemConfigService.getInt("booking.hold_minutes", 10)
│     booking.createdAt + 10 phút < now()?
│     → Hết hạn → throw BOOKING_EXPIRED (400) "Hold has expired"
│
├── 5. Đổi trạng thái:
│     booking.status = CONFIRMED
│     booking.confirmedAt = now()
│     booking.bookingSeats.forEach → status = BOOKED
│     bookingRepository.save(booking)
│     → UPDATE bookings SET status='CONFIRMED', confirmed_at=... WHERE id=1
│     → UPDATE booking_seats SET status='BOOKED' WHERE booking_id=1
│
└── 6. Return BookingResponse (chi tiết đầy đủ)
```

**Lưu ý:** Trong luồng thực tế, confirmBooking thường được gọi BỞI PaymentService sau khi xử lý callback — không phải user gọi trực tiếp. Endpoint này vẫn public để hỗ trợ flow đặc biệt.

### 5.3 cancelBooking — Hủy vé

```
PUT /api/bookings/{id}/cancel
Header: Authorization: Bearer <token>
│
▼
BookingService.cancelBooking(userId=5, bookingId=1) [@Transactional]
│
├── 1. bookingRepository.findById(1) → Booking
│
├── 2. Check quyền: booking.user.id == userId
│
├── 3. Check trạng thái:
│     Chỉ cho phép hủy: HOLDING hoặc CONFIRMED
│     → EXPIRED, CANCELLED, CHECKED_IN → throw INVALID_REQUEST (400)
│
├── 4. Check thời hạn hủy (config-driven):
│     cancelBeforeMinutes = systemConfigService.getInt("booking.cancel_before_minutes", 60)
│     deadline = booking.showtime.startTime - cancelBeforeMinutes
│     now() > deadline?
│     → Quá hạn → throw INVALID_REQUEST
│       "Chỉ được hủy vé trước 60 phút khi suất chiếu bắt đầu"
│     (Rule: user phải hủy TRƯỚC X phút khi suất chiếu bắt đầu — mặc định 60 phút.
│      Giá trị X đọc từ bảng system_config, có thể chỉnh runtime không cần deploy lại.)
│
├── 5. Đổi trạng thái booking + seats:
│     booking.status = CANCELLED
│     booking.cancelledAt = now()
│     booking.bookingSeats.forEach → status = CANCELLED
│     bookingRepository.save(booking)
│
├── 6. Refund Payment (nếu đã thanh toán):
│     paymentRepository.findByBookingId(bookingId).ifPresent(payment -> {
│         if (payment.status == COMPLETED) {
│             payment.status = REFUNDED  // KHÔNG xóa, chỉ đổi trạng thái
│             paymentRepository.save(payment)
│         }
│     })
│     → UPDATE payments SET status='REFUNDED' WHERE booking_id=?
│     → Doanh thu báo cáo loại bỏ vé đã hủy (chỉ tính COMPLETED, không tính REFUNDED).
│
├── 7. Trả lại voucher (nếu đã dùng):
│     usages = voucherUsageRepository.findByBookingId(bookingId)
│     foreach usage:
│         voucher.usedCount -= 1   // giảm bộ đếm "đã dùng"
│         voucherUsageRepository.delete(usage)  // xóa bản ghi sử dụng
│     → User được dùng lại voucher đó cho lần đặt sau.
│
├── 8. Real-time: ghế trả lại
│     seatWebSocketService.notifySeatChanged(showtimeId, seatIds, "AVAILABLE")
│     → Tất cả user đang xem sơ đồ ghế thấy ghế trống lại
│
├── 9. Gửi email thông báo hủy (async):
│     emailService.sendCancellationEmail(
│         email,
│         booking.bookingCode,
│         movieTitle,
│         formattedTotalAmount  // VD "247.500đ"
│     )
│     → Mail nội dung: "Vé CX-... đã hủy thành công, hoàn tiền sẽ xử lý trong 3-5 ngày."
│
└── 10. Return BookingResponse (status = CANCELLED)
```

**Các bước phụ (6, 7, 9) bắt buộc phải có** vì hủy vé KHÔNG chỉ là đổi status booking — còn liên quan tài chính (refund), khuyến mãi (voucher) và trải nghiệm user (email). Nếu bỏ bước 6 thì doanh thu hiển thị SAI (vẫn tính vé đã hủy). Bỏ bước 7 thì user dùng voucher 1 lần xong hủy → "mất" voucher mặc dù chưa thực sự dùng.

### 5.4 checkIn — Quét QR tại rạp

```
POST /api/bookings/check-in?code=CX-20260520-001
Header: Authorization: Bearer <admin_token>
Header: (yêu cầu ROLE_ADMIN — @PreAuthorize("hasRole('ADMIN')"))
│
▼
BookingService.checkIn("CX-20260520-001") [@Transactional]
│
├── 1. bookingRepository.findByBookingCode("CX-20260520-001") → Booking
│     SQL: SELECT * FROM bookings WHERE booking_code = 'CX-20260520-001'
│     → Không tìm thấy → throw BOOKING_NOT_FOUND "Booking not found: CX-20260520-001"
│
├── 2. Check đã check-in rồi chưa:
│     booking.status == CHECKED_IN?
│     → Rồi → throw INVALID_REQUEST "Ticket already used"
│     (Tránh trường hợp scan QR 2 lần)
│
├── 3. Check đúng trạng thái:
│     booking.status != CONFIRMED?
│     → throw INVALID_REQUEST "Booking is not confirmed, status: HOLDING"
│
├── 4. Đổi trạng thái:
│     booking.status = CHECKED_IN
│     bookingRepository.save(booking)
│     → UPDATE bookings SET status='CHECKED_IN', version=version+1 WHERE id=1
│
└── 5. Return BookingResponse (status = CHECKED_IN)
```

### 5.5 BookingCleanupScheduler — Dọn hàng loạt

```
[Spring Scheduler] Mỗi 60 giây:
│
▼
BookingCleanupScheduler.cleanupExpiredHolds() [@Transactional]
│
├── 1. Đọc config: holdMinutes = systemConfigService.getInt("booking.hold_minutes", 10)
│
├── 2. Tính ngưỡng hết hạn:
│     expireBefore = now() - 10 phút
│     VD: now=14:11:30 → expireBefore=14:01:30
│
├── 3. Query booking hết hạn:
│     bookingRepository.findByStatusAndCreatedAtBefore(HOLDING, 14:01:30)
│     SQL: SELECT * FROM bookings
│          WHERE status = 'HOLDING'
│            AND created_at < '2026-05-20T14:01:30'
│
├── 4. Với mỗi booking hết hạn:
│     booking.status = EXPIRED
│     booking.bookingSeats → status = CANCELLED
│     bookingRepository.save(booking)
│     → UPDATE bookings SET status='EXPIRED' WHERE id=?
│     → UPDATE booking_seats SET status='CANCELLED' WHERE booking_id=?
│
├── 5. Real-time: push AVAILABLE cho từng booking
│     seatWebSocketService.notifySeatChanged(showtimeId, seatIds, "AVAILABLE")
│
└── 6. Log: "Cleaned up N expired bookings"
```

---

## 6. SQL được sinh ra

### Hold ghế — check ghế trống

```sql
-- findHeldOrBookedSeats(showtimeId=1, seatIds=[10,11,12])
SELECT bs.*
FROM booking_seats bs
JOIN bookings b ON bs.booking_id = b.id
WHERE b.showtime_id = 1
  AND bs.seat_id IN (10, 11, 12)
  AND bs.status IN ('HELD', 'BOOKED');
-- Nếu trả về rows → ghế đã bị giữ → throw SEAT_ALREADY_BOOKED
```

### Hold ghế — tạo booking

```sql
-- INSERT booking
INSERT INTO bookings (user_id, showtime_id, total_amount, status, booking_code, version, created_at, updated_at)
VALUES (5, 1, 247500, 'HOLDING', 'CX-20260520-001', 0, '2026-05-20T14:00:00', '2026-05-20T14:00:00');

-- INSERT 3 booking_seats (1 cho mỗi ghế)
INSERT INTO booking_seats (booking_id, seat_id, price, status)
VALUES (1, 10, 100000, 'HELD');
INSERT INTO booking_seats (booking_id, seat_id, price, status)
VALUES (1, 11, 100000, 'HELD');
INSERT INTO booking_seats (booking_id, seat_id, price, status)
VALUES (1, 12, 75000, 'HELD');
```

### Confirm booking

```sql
-- Đổi booking status
UPDATE bookings
SET status = 'CONFIRMED', confirmed_at = '2026-05-20T14:05:00',
    version = version + 1, updated_at = now()
WHERE id = 1;

-- Đổi tất cả booking_seats sang BOOKED
-- Hibernate dùng cascade → update từng row:
UPDATE booking_seats SET status = 'BOOKED' WHERE id = 101;
UPDATE booking_seats SET status = 'BOOKED' WHERE id = 102;
UPDATE booking_seats SET status = 'BOOKED' WHERE id = 103;
```

### Cleanup scheduler

```sql
-- Tìm booking hết hạn
SELECT * FROM bookings
WHERE status = 'HOLDING'
  AND created_at < '2026-05-20T14:01:30';

-- Đổi từng booking → EXPIRED
UPDATE bookings SET status = 'EXPIRED', version = version+1 WHERE id = ?;

-- Đổi booking_seats → CANCELLED
UPDATE booking_seats SET status = 'CANCELLED' WHERE id = ?;
-- (lặp cho từng seat trong booking)
```

### Check-in tại rạp

```sql
-- Tìm theo bookingCode
SELECT * FROM bookings WHERE booking_code = 'CX-20260520-001';

-- Đổi sang CHECKED_IN
UPDATE bookings
SET status = 'CHECKED_IN', version = version + 1, updated_at = now()
WHERE id = 1;
```

### Danh sách booking của user (Specification)

```sql
-- getMyBookings(userId=5, filter={status=CONFIRMED})
SELECT b.*
FROM bookings b
WHERE b.user_id = 5
  AND (b.storage_state IS NULL OR b.storage_state <> 'ARCHIVED')
  AND b.status = 'CONFIRMED'
ORDER BY b.created_at DESC
OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY;

-- Đếm tổng (cho phân trang)
SELECT COUNT(*) FROM bookings b
WHERE b.user_id = 5
  AND (b.storage_state IS NULL OR b.storage_state <> 'ARCHIVED')
  AND b.status = 'CONFIRMED';
```

---

## 7. Request/Response mẫu — TẤT CẢ 7 endpoints

### 7.1 POST /api/bookings/hold — Giữ ghế

```bash
curl -X POST http://localhost:8088/api/bookings/hold \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "showtimeId": 1,
    "seatIds": [10, 11, 12],
    "voucherCode": "SUMMER10"
  }'
```

**Response (200):**
```json
{
  "success": true,
  "message": "Seats held",
  "data": {
    "bookingId": 1,
    "bookingCode": "CX-20260520-001",
    "holdExpiry": "2026-05-20T14:10:00",
    "totalAmount": 247500,
    "seats": [
      {"seatId": 10, "seatNumber": "E1", "seatType": "VIP", "price": 100000, "status": "HELD"},
      {"seatId": 11, "seatNumber": "E2", "seatType": "VIP", "price": 100000, "status": "HELD"},
      {"seatId": 12, "seatNumber": "A1", "seatType": "STANDARD", "price": 75000, "status": "HELD"}
    ]
  }
}
```

**Response lỗi — ghế đã bị giữ (409 / 400):**
```json
{
  "success": false,
  "message": "Seats already taken: E1, E2",
  "errorCode": "SEAT_ALREADY_BOOKED"
}
```

**Response lỗi — quá số ghế tối đa:**
```json
{
  "success": false,
  "message": "Maximum 8 seats per booking",
  "errorCode": "INVALID_REQUEST"
}
```

---

### 7.2 POST /api/bookings/confirm — Xác nhận booking

```bash
curl -X POST http://localhost:8088/api/bookings/confirm \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"bookingId": 1}'
```

**Response (200):**
```json
{
  "success": true,
  "message": "Booking confirmed",
  "data": {
    "id": 1,
    "bookingCode": "CX-20260520-001",
    "status": "CONFIRMED",
    "movieTitle": "Avengers: Endgame",
    "moviePosterUrl": "https://...",
    "showtimeId": 1,
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
    "confirmedAt": "2026-05-20T14:05:00",
    "cancelledAt": null,
    "createdAt": "2026-05-20T14:00:00",
    "updatedAt": "2026-05-20T14:05:00"
  }
}
```

**Response lỗi — hết hạn hold:**
```json
{
  "success": false,
  "message": "Hold has expired",
  "errorCode": "BOOKING_EXPIRED"
}
```

---

### 7.3 GET /api/bookings/me — Danh sách vé của tôi

```bash
# Lấy tất cả vé, trang 0
curl "http://localhost:8088/api/bookings/me?page=0&size=10" \
  -H "Authorization: Bearer <token>"

# Lọc theo trạng thái
curl "http://localhost:8088/api/bookings/me?status=CONFIRMED&page=0&size=10" \
  -H "Authorization: Bearer <token>"
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "content": [
      {
        "id": 1,
        "bookingCode": "CX-20260520-001",
        "status": "CONFIRMED",
        "movieTitle": "Avengers: Endgame",
        "moviePosterUrl": "https://...",
        "startTime": "2026-05-25T14:00:00",
        "roomName": "Room IMAX",
        "totalAmount": 247500,
        "seatCount": 3,
        "createdAt": "2026-05-20T14:00:00"
      }
    ],
    "page": 0, "size": 10, "totalElements": 1, "totalPages": 1, "last": true
  }
}
```

---

### 7.4 GET /api/bookings/{id} — Chi tiết vé

```bash
curl http://localhost:8088/api/bookings/1 \
  -H "Authorization: Bearer <token>"
```

**Response:** Giống confirmBooking response ở trên (đầy đủ chi tiết ghế).

**Response lỗi — không phải vé của mình:**
```json
{
  "success": false,
  "message": "Not your booking",
  "errorCode": "FORBIDDEN"
}
```

---

### 7.5 PUT /api/bookings/{id}/cancel — Hủy vé

```bash
curl -X PUT http://localhost:8088/api/bookings/1/cancel \
  -H "Authorization: Bearer <token>"
```

**Response (200):**
```json
{
  "success": true,
  "message": "Booking cancelled",
  "data": {
    "id": 1,
    "bookingCode": "CX-20260520-001",
    "status": "CANCELLED",
    "cancelledAt": "2026-05-20T14:08:00",
    ...
  }
}
```

**Response lỗi — suất chiếu đã bắt đầu:**
```json
{
  "success": false,
  "message": "Showtime has already started, cannot cancel",
  "errorCode": "INVALID_REQUEST"
}
```

---

### 7.6 POST /api/bookings/check-in?code=... — Check-in (Admin)

```bash
curl -X POST "http://localhost:8088/api/bookings/check-in?code=CX-20260520-001" \
  -H "Authorization: Bearer <admin_token>"
```

**Response (200):**
```json
{
  "success": true,
  "message": "Checked in",
  "data": {
    "id": 1,
    "bookingCode": "CX-20260520-001",
    "status": "CHECKED_IN",
    ...
  }
}
```

**Response lỗi — vé đã quét rồi:**
```json
{
  "success": false,
  "message": "Ticket already used",
  "errorCode": "INVALID_REQUEST"
}
```

**Response lỗi — không phải ADMIN (403 Forbidden):**
```json
{
  "success": false,
  "message": "Access Denied",
  "errorCode": "FORBIDDEN"
}
```

---

### 7.7 GET /api/bookings/{id}/qr — Lấy QR Code

```bash
curl http://localhost:8088/api/bookings/1/qr \
  -H "Authorization: Bearer <token>"
```

**Response (200):**
```json
{
  "success": true,
  "data": "iVBORw0KGgoAAAANSUhEUgAAASwAAAEsCAYAA..."
}
```

Frontend dùng base64 string này để hiển thị QR:
```html
<img src="data:image/png;base64,iVBORw0KGgo..." alt="QR Code" />
```

---

## 8. Khái niệm mới cần biết

### @Transactional — Bảo vệ tính nhất quán

```
Ví dụ đời thường: Chuyển tiền ngân hàng
  - Trừ tài khoản A: -100.000đ
  - Cộng tài khoản B: +100.000đ
  → Hoặc cả 2 thành công, hoặc cả 2 thất bại (không có "trừ xong chưa cộng")
  → Đây là ACID Transaction

Trong holdSeats():
  - Tạo Booking
  - Tạo 3 BookingSeats
  → Nếu tạo BookingSeat thứ 3 lỗi → 2 cái trước cũng bị rollback
  → Không có trường hợp "booking tạo xong mà thiếu ghế"
```

### Race Condition — Điều kiện tranh chấp

```
Ví dụ đời thường: 2 người cùng mua vé tàu cuối cùng online
  - Người A: check còn 1 vé → ✅
  - Người B: check còn 1 vé → ✅ (cùng lúc với A!)
  - Người A: mua → thành công
  - Người B: mua → lỗi (vé đã hết) hoặc bán trùng!

Hệ thống giải quyết bằng:
  - DB UNIQUE constraint → chỉ 1 INSERT thành công
  - Pessimistic Lock → chỉ 1 transaction đọc được row tại 1 thời điểm
  - Queue (Kafka) → serialize request → xử lý tuần tự (production)
```

### WebSocket (STOMP) — Real-time

```
HTTP thông thường:  Client hỏi → Server trả lời → kết thúc
                    (Client phải hỏi lại để biết có gì mới)

WebSocket:          Kết nối 1 lần, kênh 2 chiều mở mãi
                    Server push dữ liệu bất cứ lúc nào

STOMP (Simple Text Oriented Messaging Protocol):
    - Giao thức messaging trên WebSocket
    - Subscribe topic: /topic/seats/1 → nhận update khi có ghế thay đổi ở suất chiếu 1
    - Server publish: seatWebSocketService.notifySeatChanged() → tất cả subscriber nhận được
```

---

## 9. Annotation mới sử dụng

| Annotation | Tác dụng | Ví dụ trong code |
|---|---|---|
| `@Scheduled(fixedRate=60000)` | Chạy method mỗi 60 giây | `cleanupExpiredHolds()` |
| `@EnableScheduling` | Bật tính năng Scheduled trên toàn ứng dụng | `CineXApplication.java` |
| `@OneToMany(cascade=ALL)` | Quan hệ 1-nhiều, cascade tất cả operation | `Booking.bookingSeats` |
| `@OneToMany(orphanRemoval=true)` | Xóa entity con khi bị remove khỏi collection | `Booking.bookingSeats` |
| `@Builder.Default` | Khởi tạo default value khi dùng Lombok Builder | `bookingSeats = new ArrayList<>()` |
| `@PreAuthorize("hasRole('ADMIN')")` | Bảo vệ endpoint, chỉ ADMIN mới gọi được | `checkIn()` |
| `@RequestParam` | Lấy query parameter từ URL | `?code=CX-20260520-001` |
| `@PageableDefault(size=10)` | Giá trị mặc định cho phân trang | `getMyBookings()` |
| `@Lock(PESSIMISTIC_WRITE)` | Lock row DB (để dùng sau, hiện tại chưa áp dụng) | BookingSeatRepository |

---

## 10. Câu hỏi tự kiểm tra

1. **Hold ghế 10 phút, nếu không thanh toán thì sao?**
   → BookingCleanupScheduler chạy mỗi phút, tìm HOLDING + createdAt < 10 phút trước → đổi EXPIRED + BookingSeats → CANCELLED → ghế trả lại. WebSocket push AVAILABLE → tất cả user xem sơ đồ ghế thấy ngay.

2. **2 user hold cùng ghế cùng lúc thì sao?**
   → `findHeldOrBookedSeats()` check trong cùng `@Transactional`. SQL Server đảm bảo: transaction commit trước sẽ insert BookingSeat. Transaction sau khi check lại hoặc vi phạm UNIQUE constraint → throw SEAT_ALREADY_BOOKED.

3. **Tại sao lưu price trong BookingSeat thay vì lấy từ Showtime?**
   → "Snapshot price" — giá tại thời điểm đặt. Nếu admin đổi giá sau → vé cũ không bị ảnh hưởng. Giống hóa đơn siêu thị: in giá tại thời điểm mua, không thay đổi khi cửa hàng tăng giá.

4. **@EnableScheduling để ở đâu? Thiếu thì sao?**
   → Class main `CineXApplication.java`. Thiếu → @Scheduled im lặng không chạy, không báo lỗi → booking hết hạn không được dọn → ghế bị chiếm mãi → user không book được.

5. **cascade = CascadeType.ALL và orphanRemoval khác nhau thế nào?**
   → `cascade`: hành động trên cha (save/delete) lan xuống con. `orphanRemoval`: khi remove entity con khỏi collection trong Java → tự xóa trong DB. Dùng cả 2: xóa Booking → xóa luôn BookingSeats (cascade REMOVE); bỏ 1 seat khỏi list → xóa seat đó (orphanRemoval).

6. **fixedRate = 60000 và fixedDelay = 60000 khác nhau thế nào?**
   → `fixedRate`: bắt đầu task mới sau 60s kể từ lần task TRƯỚC BẮT ĐẦU (bất kể task mất bao lâu). `fixedDelay`: bắt đầu task mới sau 60s kể từ lúc task TRƯỚC KẾT THÚC. Nếu task cleanup mất 5s: fixedRate → chu kỳ đúng 60s; fixedDelay → chu kỳ 65s.

7. **Tại sao sơ đồ ghế cần WebSocket? Polling có được không?**
   → Polling: FE gọi API mỗi 3s để check → 1000 user = 1000 × 20 req/phút = 20.000 req/phút → tốn server. WebSocket: 1 kết nối mở sẵn, server push khi có thay đổi → 0 req khi không có gì → hiệu quả hơn rất nhiều. Ngoài ra, trải nghiệm user tốt hơn: thấy ghế đổi màu ngay tức thì, không cần chờ 3s polling.

---

## 11. Bổ sung — UNIQUE Constraint chống race condition

Code Service dùng check + insert pattern. Để defense in depth, bổ sung UNIQUE constraint DB. Liquibase changeset:

```xml
<changeSet id="add-booking-seats-unique" author="cinex">
    <sql>
        CREATE UNIQUE INDEX uk_booking_seat_active
        ON booking_seats (showtime_id, seat_id)
        WHERE status IN ('HELD', 'BOOKED');
    </sql>
    <rollback>
        DROP INDEX uk_booking_seat_active ON booking_seats;
    </rollback>
</changeSet>
```

**Filtered index** chỉ apply cho row HELD/BOOKED → row EXPIRED/CANCELLED không bị block.

Race condition kịch bản:
```
T1: SELECT seat A1 status → AVAILABLE
T2: SELECT seat A1 status → AVAILABLE
T1: INSERT booking_seats (showtime_id=10, seat_id=100, status=HELD) → OK
T2: INSERT booking_seats (showtime_id=10, seat_id=100, status=HELD) → DataIntegrityViolationException
```

Code catch:
```java
@Transactional
public Booking createBooking(BookingRequest req) {
    try {
        // ... check + save
    } catch (DataIntegrityViolationException e) {
        throw new BusinessException(ErrorCode.SEAT_TAKEN);
    }
}
```

DB cuối cùng quyết định → không có 2 booking cùng ghế dù race.

## 12. Bổ sung — WebSocket Setup chi tiết

### Server config
```java
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws-cinex")
            .setAllowedOriginPatterns("http://localhost:5173", "https://app.cinex.vn")
            .withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // In-memory broker (đơn giản cho single instance)
        registry.enableSimpleBroker("/topic", "/queue");

        // Client gửi tới /app/* → @MessageMapping handler
        registry.setApplicationDestinationPrefixes("/app");

        // User-specific destination
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(jwtChannelInterceptor);
    }
}
```

### JWT Channel Interceptor (auth WebSocket)
```java
@Component
@RequiredArgsConstructor
public class JwtChannelInterceptor implements ChannelInterceptor {

    private final JwtUtil jwtUtil;
    private final CustomUserDetailsService userDetailsService;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);

        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            String authHeader = accessor.getFirstNativeHeader("Authorization");
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                String token = authHeader.substring(7);
                String username = jwtUtil.extractUsername(token);
                UserDetails user = userDetailsService.loadUserByUsername(username);

                if (jwtUtil.isTokenValid(token, user)) {
                    UsernamePasswordAuthenticationToken auth =
                        new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());
                    accessor.setUser(auth);
                }
            }
        }
        return message;
    }
}
```

### Service publish event
```java
@Service
@RequiredArgsConstructor
public class BookingService {
    private final SimpMessagingTemplate messagingTemplate;

    @Transactional
    public Booking createBooking(BookingRequest req) {
        Booking booking = doCreateBooking(req);

        // Broadcast tới mọi user đang xem showtime này
        SeatUpdateMessage msg = new SeatUpdateMessage(
            booking.getShowtime().getId(),
            booking.getBookingSeats().stream()
                .map(bs -> Map.of("seatId", bs.getSeat().getId(), "status", "HELD"))
                .toList()
        );
        messagingTemplate.convertAndSend(
            "/topic/showtime/" + booking.getShowtime().getId() + "/seats",
            msg
        );

        return booking;
    }
}
```

### FE subscribe
```ts
useEffect(() => {
  const client = new Client({
    webSocketFactory: () => new SockJS(`${API_URL}/ws-cinex`),
    connectHeaders: { Authorization: `Bearer ${token}` },
    onConnect: () => {
      client.subscribe(`/topic/showtime/${showtimeId}/seats`, (msg) => {
        const update: SeatUpdateMessage = JSON.parse(msg.body);
        update.seats.forEach(s => setSeatStatus(s.seatId, s.status));
      });
    },
  });
  client.activate();
  return () => client.deactivate();
}, [showtimeId]);
```
