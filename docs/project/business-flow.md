# Luồng nghiệp vụ CineX

Tài liệu này mô tả **toàn bộ chức năng** và **luồng hoạt động** của hệ thống.

---

## Tổng quan hệ thống

CineX là hệ thống **đặt vé xem phim online**. Có 2 vai trò:
- **USER:** Xem phim, đặt vé, thanh toán, nhận QR code
- **ADMIN:** Quản lý phim, phòng chiếu, suất chiếu, booking, user

---

## Luồng USER — Đặt vé xem phim

```
┌─────────────────────────────────────────────────────────────────┐
│                        LUỒNG USER                               │
│                                                                 │
│  1. Đăng ký / Đăng nhập                                        │
│     └── POST /api/auth/register hoặc /api/auth/login            │
│     └── Nhận accessToken + refreshToken                         │
│                                                                 │
│  2. Xem danh sách phim                                          │
│     └── GET /api/movies?status=NOW_SHOWING                      │
│     └── Tìm kiếm theo tên, lọc theo thể loại                   │
│                                                                 │
│  3. Xem chi tiết phim                                           │
│     └── GET /api/movies/{id}                                    │
│     └── Poster, trailer, mô tả, thời lượng, rating             │
│                                                                 │
│  4. Chọn ngày + suất chiếu                                      │
│     └── GET /api/showtimes?movieId=1&date=2026-05-15            │
│     └── Hiện: giờ chiếu, phòng, giá vé, ghế trống              │
│                                                                 │
│  5. Chọn ghế                                                    │
│     └── GET /api/showtimes/{id}/seats                           │
│     └── Sơ đồ ghế: xanh=trống, đỏ=đã đặt, vàng=VIP            │
│     └── Chọn tối đa 8 ghế                                      │
│                                                                 │
│  6. Giữ ghế (hold 10 phút)                                     │
│     └── POST /api/bookings/hold { showtimeId, seatIds }         │
│     └── Hệ thống tạo booking status=HOLDING                    │
│     └── Bắt đầu countdown 10 phút                              │
│     └── Ghế chuyển sang "đang giữ" (người khác không chọn được) │
│                                                                 │
│  7. Thanh toán                                                  │
│     └── POST /api/payments/create { bookingId, method }         │
│     └── Phương thức: VNPay / Momo / Tại quầy                   │
│     └── Thành công → booking status=CONFIRMED                  │
│                                                                 │
│  8. Nhận QR code                                                │
│     └── Trang "Đặt vé thành công" hiện QR code                 │
│     └── QR = bookingCode (VD: CX-20260515-001)                  │
│     └── Vào "Vé của tôi" xem lại bất kỳ lúc nào               │
│                                                                 │
│  9. Đến rạp check-in                                            │
│     └── Đưa QR cho nhân viên quét                               │
│     └── POST /api/bookings/check-in?code=CX-20260515-001       │
│     └── Booking status=CHECKED_IN → phát vé cứng               │
│                                                                 │
│  Ngoài ra user có thể:                                          │
│  • Xem lịch sử vé: GET /api/bookings/me                        │
│  • Hủy vé (trước giờ chiếu): PUT /api/bookings/{id}/cancel     │
│  • Sửa profile: PUT /api/users/me                               │
│  • Đổi mật khẩu: PUT /api/users/me/password                    │
└─────────────────────────────────────────────────────────────────┘
```

### Sơ đồ trạng thái booking

```
                 ┌──────────┐
                 │ HOLDING  │ ← User vừa chọn ghế (10 phút)
                 └────┬─────┘
                      │
          ┌───────────┼───────────┐
          ▼           │           ▼
   ┌───────────┐      │    ┌──────────┐
   │ CONFIRMED │      │    │ EXPIRED  │ ← Quá 10 phút không thanh toán
   └─────┬─────┘      │    └──────────┘
         │            │
    ┌────┼────┐       │
    ▼    │    ▼       ▼
┌──────┐ │ ┌───────────┐
│CHECK │ │ │ CANCELLED │ ← User hoặc Admin hủy
│_IN   │ │ └───────────┘
└──────┘ │
```

### Hết hạn hold — Xử lý tự động

```
@Scheduled chạy mỗi phút:
  → Tìm booking HOLDING + tạo quá 10 phút
  → Đổi status = EXPIRED
  → Ghế trở lại trống
  → User khác có thể đặt
```

---

## Luồng ADMIN — Quản lý hệ thống

```
┌─────────────────────────────────────────────────────────────────┐
│                        LUỒNG ADMIN                              │
│                                                                 │
│  Quản lý phim:                                                  │
│  ├── GET    /api/movies          → Xem danh sách phim           │
│  ├── POST   /api/movies          → Thêm phim mới                │
│  ├── PUT    /api/movies/{id}     → Sửa phim                     │
│  ├── DELETE /api/movies/{id}     → Xóa phim (soft delete)       │
│  ├── GET    /api/genres          → Xem thể loại                 │
│  └── POST   /api/genres          → Thêm thể loại                │
│                                                                 │
│  Quản lý phòng chiếu:                                           │
│  ├── GET    /api/rooms           → Xem danh sách phòng          │
│  ├── POST   /api/rooms           → Thêm phòng (2D/3D/IMAX)     │
│  ├── PUT    /api/rooms/{id}      → Sửa phòng                    │
│  └── POST   /api/rooms/{id}/seats/generate                      │
│       └── Tự sinh sơ đồ ghế (10 hàng × 12 cột, hàng VIP, ...)  │
│                                                                 │
│  Quản lý suất chiếu:                                            │
│  ├── GET    /api/showtimes       → Xem danh sách suất chiếu     │
│  ├── POST   /api/showtimes       → Tạo suất chiếu mới           │
│  │    └── Chọn phim + phòng + giờ + giá vé                      │
│  │    └── Hệ thống kiểm tra trùng giờ phòng                     │
│  │    └── Tự tính endTime = startTime + duration + 15 phút      │
│  ├── PUT    /api/showtimes/{id}  → Sửa suất chiếu               │
│  └── DELETE /api/showtimes/{id}  → Hủy suất chiếu               │
│                                                                 │
│  Quản lý booking:                                               │
│  ├── GET    /api/admin/bookings  → Xem tất cả booking           │
│  └── POST   /api/bookings/check-in?code=xxx                     │
│       └── Nhân viên quét QR → verify → phát vé cứng             │
│                                                                 │
│  Quản lý user:                                                  │
│  ├── GET    /api/users           → Xem danh sách user           │
│  ├── PUT    /api/users/{id}/role → Đổi role (USER ↔ ADMIN)      │
│  └── PUT    /api/users/{id}/disable → Vô hiệu hóa tài khoản    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Danh sách API đầy đủ

### Auth (public)
| Method | URL | Mô tả |
|---|---|---|
| POST | `/api/auth/register` | Đăng ký |
| POST | `/api/auth/login` | Đăng nhập |
| POST | `/api/auth/refresh` | Refresh token |

### User (cần đăng nhập)
| Method | URL | Mô tả | Role |
|---|---|---|---|
| GET | `/api/users/me` | Xem profile | USER |
| PUT | `/api/users/me` | Sửa profile | USER |
| PUT | `/api/users/me/password` | Đổi mật khẩu | USER |
| GET | `/api/users` | Danh sách user | ADMIN |
| PUT | `/api/users/{id}/role` | Đổi role | ADMIN |

### Movie (public đọc, admin ghi)
| Method | URL | Mô tả | Role |
|---|---|---|---|
| GET | `/api/movies` | Danh sách phim | Public |
| GET | `/api/movies/{id}` | Chi tiết phim | Public |
| POST | `/api/movies` | Thêm phim | ADMIN |
| PUT | `/api/movies/{id}` | Sửa phim | ADMIN |
| DELETE | `/api/movies/{id}` | Xóa phim | ADMIN |
| GET | `/api/genres` | Danh sách thể loại | Public |
| POST | `/api/genres` | Thêm thể loại | ADMIN |

### Room & Seat (admin)
| Method | URL | Mô tả | Role |
|---|---|---|---|
| GET | `/api/rooms` | Danh sách phòng | Public |
| POST | `/api/rooms` | Thêm phòng | ADMIN |
| PUT | `/api/rooms/{id}` | Sửa phòng | ADMIN |
| GET | `/api/rooms/{id}/seats` | Sơ đồ ghế | Public |
| POST | `/api/rooms/{id}/seats/generate` | Sinh ghế | ADMIN |

### Showtime
| Method | URL | Mô tả | Role |
|---|---|---|---|
| GET | `/api/showtimes` | Danh sách suất chiếu | Public |
| GET | `/api/showtimes/{id}` | Chi tiết suất chiếu | Public |
| POST | `/api/showtimes` | Tạo suất chiếu | ADMIN |
| PUT | `/api/showtimes/{id}` | Sửa suất chiếu | ADMIN |

### Booking (cần đăng nhập)
| Method | URL | Mô tả | Role |
|---|---|---|---|
| GET | `/api/showtimes/{id}/seats` | Sơ đồ ghế + trạng thái | USER |
| POST | `/api/bookings/hold` | Giữ ghế 10 phút | USER |
| POST | `/api/bookings/confirm` | Xác nhận đặt vé | USER |
| GET | `/api/bookings/me` | Vé của tôi | USER |
| GET | `/api/bookings/{id}` | Chi tiết vé | USER |
| PUT | `/api/bookings/{id}/cancel` | Hủy vé | USER |
| POST | `/api/bookings/check-in` | Quét QR check-in | ADMIN |

### Payment
| Method | URL | Mô tả | Role |
|---|---|---|---|
| POST | `/api/payments/create` | Tạo thanh toán | USER |
| GET | `/api/payments/callback` | Callback từ VNPay | Public |
| GET | `/api/payments/{bookingId}` | Trạng thái thanh toán | USER |

### Health (public)
| Method | URL | Mô tả |
|---|---|---|
| GET | `/api/health` | Kiểm tra hệ thống |

---

## Sequence Diagram chi tiết — 6 luồng cốt lõi

### 1. Đăng ký + Login + Refresh Token

```
Client                    Backend                     DB
  |                         |                          |
  | POST /api/auth/register |                          |
  | {username, email, pwd}  |                          |
  |------------------------>|                          |
  |                         | validate input           |
  |                         | check existsByUsername   |
  |                         |------------------------->|
  |                         |<-------------------------|
  |                         | BCrypt.encode(pwd)       |
  |                         | INSERT users             |
  |                         |------------------------->|
  |                         |<-------------------------|
  |                         | INSERT user_roles        |
  |                         |------------------------->|
  |<-----------------------| {accessToken,            |
  |   201 Created           |  refreshToken}          |
  |                         |                          |
  | Lưu cả 2 token          |                          |
  | localStorage            |                          |
  |                         |                          |
  | === 15 phút sau ===     |                          |
  | GET /api/movies         |                          |
  | Authorization: Bearer.. |                          |
  |------------------------>|                          |
  |                         | JWT expired              |
  |<-----------------------| 401                       |
  |                         |                          |
  | POST /api/auth/refresh  |                          |
  | {refreshToken}          |                          |
  |------------------------>|                          |
  |                         | verify refreshToken      |
  |                         | check chưa revoke        |
  |                         |------------------------->|
  |                         |<-------------------------|
  |                         | gen accessToken mới       |
  |                         | (rotation) gen refresh mới |
  |                         | revoke refresh cũ        |
  |                         |------------------------->|
  |<-----------------------| {accessToken,            |
  |                         |  refreshToken}          |
  | Update localStorage     |                          |
  | Retry original request  |                          |
  |------------------------>|                          |
  |<-----------------------| 200 OK                    |
```

**Edge case**:
- Username đã tồn tại → 400 `USERNAME_TAKEN`
- Email đã tồn tại → 400 `EMAIL_TAKEN`
- Password không đủ mạnh (< 8 char, không có số) → 400 validation
- Refresh token expired (> 7 ngày) → 401 → FE chuyển trang Login
- Refresh token đã revoke (bị logout / detect reuse) → 401 + xóa localStorage

### 2. Hold ghế — Race Condition

```
User A                    Backend                  User B
  |                          |                       |
  | mở /booking/showtime/10  |                       |
  | SUBSCRIBE WS topic       |                       |
  |     /topic/showtime/10/seats                    |
  |------------------------->|                       |
  |                          |     mở booking page   |
  |                          |<-- SUBSCRIBE WS -----|
  |                          |                       |
  | click ghế A1 (UI vàng)   |                       |
  | POST /api/bookings       |                       |
  |   {showtimeId, [A1]}     | click A1 cùng lúc    |
  |------------------------->| POST /api/bookings   |
  |                          | <------------------- |
  |                          |                       |
  |                          | === RACE: 2 request   |
  |                          | đến cùng lúc ===     |
  |                          |                       |
  |                          | Thread 1: BEGIN TRX  |
  |                          | SELECT ghế A1        |
  |                          | (PESSIMISTIC_WRITE)  |
  |                          |   ↓                   |
  |                          |   A1 status:          |
  |                          |   AVAILABLE          |
  |                          | INSERT booking + seat|
  |                          | UPDATE seat HELD     |
  |                          | COMMIT               |
  |                          | publish WS event     |
  |<------------------------|                       |
  |   201 + booking detail   |                       |
  |  WS: seats={A1: HELD}    | --- broadcast WS --->|
  |                          |                       |
  |                          | Thread 2 đợi lock A1 |
  |                          | lock released        |
  |                          | SELECT A1 status:    |
  |                          |   HELD ← đã có B đặt |
  |                          | THROW SEAT_TAKEN     |
  |                          | ROLLBACK             |
  |                          |--------------------->|
  |                          |   409 SEAT_TAKEN      |
  |                          |                       |
  |                          |                       | UI: revert A1
  |                          |                       | toast "ghế đã có người"
  |                          |                       | WS update A1=HELD
```

**Pattern bảo vệ**:
- Pessimistic Lock trên Seat khi check + update (Spring `@Lock(PESSIMISTIC_WRITE)`)
- UNIQUE constraint `(showtime_id, seat_id)` ở bảng `booking_seats` với điều kiện `status = HELD/BOOKED` → DB tự reject duplicate
- Frontend optimistic UI → revert nếu BE reject

### 3. Payment Callback từ MoMo

```
User                Browser           CineX BE         MoMo Server
 |                     |                  |                |
 | click "Thanh toán"  |                  |                |
 |-------------------->|                  |                |
 |                     | POST /api/payments               |
 |                     |   {bookingId, "MOMO"}            |
 |                     |----------------->|                |
 |                     |                  | tạo Payment    |
 |                     |                  | status=PENDING |
 |                     |                  | request MoMo   |
 |                     |                  | API gen URL    |
 |                     |                  |--------------->|
 |                     |                  |<---------------|
 |                     |                  | paymentUrl     |
 |                     |<-----------------|                |
 |                     | {paymentUrl}     |                |
 |                     | location.href =  |                |
 |                     |   paymentUrl     |                |
 |                     |------------------------------------>|
 |                     |                                    |
 |                     |    User nhập OTP/PIN/quét QR     |
 |<------------------------- MoMo UI -----------------------|
 |    thành công       |                                    |
 |                     |                                    |
 |                     |   === 2 callback song song ===     |
 |                     |                                    |
 |                     |   IPN (server-to-server, đáng tin):|
 |                     |   POST /api/payments/callback      |
 |                     |   {orderId, signature, ...}        |
 |                     |                  |<----------------|
 |                     |                  | verify signature|
 |                     |                  | check signature OK |
 |                     |                  | UPDATE Payment  |
 |                     |                  |   status=SUCCESS|
 |                     |                  | UPDATE Booking  |
 |                     |                  |   status=CONFIRMED|
 |                     |                  | publish event   |
 |                     |                  |   → email, notif|
 |                     |                  |   → WebSocket   |
 |                     |                  |-->|             |
 |                     |                                    |
 |                     |   Return URL (browser redirect):   |
 |                     |   GET /payment/result?status=...   |
 |                     |<-----------------------------------|
 |                     | PaymentResultPage                  |
 |                     | GET /api/bookings/{code}/status    |
 |                     |----------------->|                  |
 |                     |                  | đọc DB (IPN đã update) |
 |                     |<-----------------|                  |
 |                     | CONFIRMED        |                  |
 |<--------------------|                                    |
 |  hiển thị vé + QR    |                                    |
```

**Quan trọng**:
- IPN (Instant Payment Notification) là server-to-server từ MoMo về BE → có signature → tin được.
- Return URL là browser redirect → hacker fake được → FE PHẢI query API status, không trust URL.
- IPN có thể đến trước/sau Return URL → FE poll vài lần nếu Pending.
- Idempotency: MoMo có thể gửi IPN 2 lần → BE check `if (payment.status == SUCCESS) return` để skip xử lý duplicate.

### 4. Cancel + Refund

```
User                CineX BE              MoMo
 |                     |                      |
 | POST /bookings/.../ |                      |
 |   cancel            |                      |
 |-------------------->|                      |
 |                     | check điều kiện:     |
 |                     |  - chưa CHECKED_IN   |
 |                     |  - showtime > 2h     |
 |                     | UPDATE Booking       |
 |                     |   status=CANCELLED   |
 |                     | UPDATE BookingSeat   |
 |                     |   status=AVAILABLE   |
 |                     | nếu đã thanh toán:   |
 |                     |   tính refund_amount |
 |                     |   = giá × 80%        |
 |                     |   gọi MoMo refund API|
 |                     |----------->          |
 |                     |<-----------          |
 |                     | refund OK            |
 |                     | UPDATE Payment       |
 |                     |   status=REFUNDED    |
 |                     | UPDATE Voucher       |
 |                     |   usage_count -= 1   |
 |                     | publish event:       |
 |                     |   - WebSocket seats  |
 |                     |   - email refund     |
 |<------------------- | 200 OK               |
```

**Edge case**:
- Đã CHECKED_IN → 400 `CANNOT_CANCEL_CHECKED_IN`
- Còn < 2h trước showtime → 400 hoặc refund 0%
- Booking chưa thanh toán (HOLDING) → chỉ release seat, không refund

### 5. POS — Nhân viên bán vé tại quầy

```
NV CSKH              CineX BE
 |                      |
 | search showtime đang |
 | chiếu hôm nay        |
 | GET /api/showtimes   |
 |   ?date=2026-05-24   |
 |--------------------->|
 |<---------------------|
 | chọn showtime        |
 | hiển thị seat map    |
 | GET /seats?showtimeId|
 |--------------------->|
 |<---------------------|
 | chọn ghế A1, A2      |
 | nhập SĐT khách (optional) |
 | chọn method=CASH     |
 | POST /bookings/pos    |
 |   {showtimeId, seats,|
 |    phoneNumber,       |
 |    method:"CASH",     |
 |    cashier:"NV01"}    |
 |--------------------->|
 |                      | tạo Booking trực tiếp CONFIRMED
 |                      | user=null (khách vãng lai)
 |                      | tạo Payment status=SUCCESS
 |                      | tạo BookingSeat=BOOKED
 |                      | in vé + QR
 |<---------------------|
 | in vé giấy           |
```

**Khác biệt POS vs Online**:
- POS: không HOLDING (skip thẳng CONFIRMED), không cần payment URL.
- POS: user nullable (khách không cần tài khoản).
- POS: thanh toán CASH hoặc TRANSFER (không qua cổng online).
- POS: cần track `cashier` để báo cáo doanh thu theo nhân viên.

### 6. Check-in Quét QR

```
NV cổng vào         CineX BE
 |                      |
 | mở /admin/checkin    |
 | bật camera html5-qrcode |
 |                      |
 | khách đưa QR         |
 | quét được "CX-20260524-001" |
 | POST /bookings/CX-.../check-in |
 |--------------------->|
 |                      | tìm Booking by bookingCode
 |                      | check status == CONFIRMED
 |                      | check showtime.startTime > now - 30 phút
 |                      |    (cho phép vào sớm 30')
 |                      | check chưa CHECKED_IN trước
 |                      | UPDATE Booking status=CHECKED_IN
 |                      | UPDATE Booking checkedInAt=now
 |                      | UPDATE Booking checkedInBy=cashier
 |<---------------------|
 | hiển thị info:       |
 |   "Phòng A3, ghế A1, A2"
 |   "Ngày sinh khách: ..."
 | NV cho khách vào     |
```

**Edge case**:
- QR không hợp lệ (random) → 404
- Booking CANCELLED → 400 `BOOKING_NOT_VALID`
- Đã CHECKED_IN trước → 400 `ALREADY_CHECKED_IN` (chống vé giả)
- Showtime đã quá 30' → vẫn cho vào nhưng warn "muộn"
- Showtime quá sớm (> 30' trước) → 400 `TOO_EARLY`

---

## Luồng Guest (chưa đăng nhập)

Guest **CÓ** thể:
- Xem trang chủ, list phim, detail phim
- Xem showtime của phim
- Đọc review

Guest **KHÔNG** thể:
- Đặt vé (redirect /login)
- Yêu thích phim (redirect /login)
- Viết review (redirect /login)

Code FE:
```tsx
const navigate = useNavigate();
const isAuthenticated = useAuthStore(s => !!s.token);

const handleBook = () => {
  if (!isAuthenticated) {
    navigate("/login", { state: { from: location.pathname } });
    return;
  }
  navigate("/booking");
};
```

---

## Luồng Voucher

```
User chọn ghế (total = 200.000đ)
   ↓
Nhập code voucher "SUMMER2026"
   ↓
POST /api/vouchers/validate
   { code, orderAmount: 200000 }
   ↓
BE check:
   - Voucher tồn tại + chưa expire
   - Số lần dùng < usage_limit
   - User chưa dùng voucher này
   - orderAmount >= min_order (vd 100.000đ)
   - Áp dụng được method=MOMO (nếu rule giới hạn)
   ↓
Tính discount:
   - percent_discount = 20% → discount = min(40.000đ, max_discount)
   - max_discount = 50.000đ → final discount = 40.000đ
   ↓
Trả { valid: true, discountAmount: 40000, finalAmount: 160000 }
   ↓
FE hiển thị "Giảm 40.000đ, còn 160.000đ"
   ↓
User confirm → POST /bookings
   { ..., voucherCode: "SUMMER2026" }
   ↓
BE: tạo Booking với discountAmount = 40000
   tạo VoucherUsage record
   tăng voucher.usage_count
```

**Edge case**:
- Voucher hết hạn → 400 `VOUCHER_EXPIRED`
- Voucher đạt usage_limit → 400 `VOUCHER_EXHAUSTED`
- User đã dùng voucher này → 400 `VOUCHER_ALREADY_USED`
- orderAmount < min_order → 400 `ORDER_AMOUNT_TOO_LOW`

---

## State Machine Booking đầy đủ

```
            ┌──────────────┐
            │   HOLDING    │ ← user click ghế, chưa thanh toán
            │ expires_at   │
            │ +10 phút     │
            └──┬───────┬───┘
               │       │
        thanh toán  expired/cancel
               │       │
               ▼       ▼
        ┌──────────┐  ┌──────────┐
        │CONFIRMED │  │CANCELLED │ ← hoặc EXPIRED
        └────┬─────┘  └──────────┘
             │
          check-in
             │
             ▼
        ┌──────────┐
        │CHECKED_IN│
        └──────────┘
```

> **Lưu ý**: `BookingStatus` enum chỉ có 5 giá trị: HOLDING, CONFIRMED, CHECKED_IN, CANCELLED, EXPIRED. Việc hoàn tiền (refund) được track ở `PaymentStatus`, không phải BookingStatus.

**Validation transition**:
- HOLDING → CONFIRMED: chỉ khi payment SUCCESS
- HOLDING → CANCELLED: user tự cancel hoặc scheduler expire
- HOLDING → EXPIRED: scheduler dọn booking quá hạn
- CONFIRMED → CHECKED_IN: NV quét QR, chưa quá 30' sau showtime
- CONFIRMED → CANCELLED: cancel sau khi đã thanh toán (refund track ở PaymentStatus)

Code:
```java
public void transitionTo(Booking booking, BookingStatus newStatus) {
    BookingStatus current = booking.getStatus();
    if (!ALLOWED_TRANSITIONS.get(current).contains(newStatus)) {
        throw new BusinessException(ErrorCode.INVALID_STATE_TRANSITION);
    }
    booking.setStatus(newStatus);
}
```

---

## Failure Scenarios

| Tình huống | Hậu quả | Phục hồi |
|---|---|---|
| Server crash khi đang HOLDING | Booking treo HOLDING vĩnh viễn | `BookingCleanupScheduler` chạy 1 phút/lần, expire booking quá hạn |
| MoMo callback 2 lần | Update lặp | Idempotent check `if status == SUCCESS return` |
| MoMo callback không đến | Booking HOLDING vĩnh viễn | FE poll status, tự expire sau 10 phút |
| Nginx timeout 60s khi user thanh toán | User redirect bị 504 | IPN vẫn đến BE qua kênh riêng → status đúng → FE poll vẫn thấy |
| User đóng tab giữa lúc HOLDING | Ghế chiếm 10 phút | Scheduler tự release sau 10 phút |
| User refresh trang sau khi click ghế | Booking đã HOLDING | Hiển thị booking pending + countdown |
| 2 user cùng cuối cùng click 1 ghế | Race condition | Pessimistic lock + UNIQUE constraint → user thứ 2 lỗi 409 |

