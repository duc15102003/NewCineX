# ERD — Mô hình quan hệ dữ liệu CineX

## 1. Sơ đồ tổng quan

```
┌──────────────┐       ┌──────────────────┐       ┌──────────────┐
│    users     │       │  refresh_tokens  │       │    genres    │
├──────────────┤       ├──────────────────┤       ├──────────────┤
│ PK id        │──┐    │ PK id            │       │ PK id        │
│    username  │  │    │ FK userId ───────│───┐   │    name      │
│    email     │  │    │    token         │   │   │    description│
│    password  │  │    │    expiryDate    │   │   └──────────────┘
│    fullName  │  │    │    revoked       │   │          │
│    phone     │  │    └──────────────────┘   │          │ N:N
│    avatarUrl │  │                           │          │
│    role      │  │                           │   ┌──────────────┐
│    enabled   │  │                           │   │ movie_genres │
│    createdBy │  │                           │   ├──────────────┤
│    updatedBy │  │                           │   │ FK movieId   │──┐
│    createdAt │  │                           │   │ FK genreId   │  │
│    updatedAt │  │                           │   └──────────────┘  │
└──────────────┘  │                           │                     │
       │          │                           │                     │
       │          │    ┌──────────────┐       │   ┌──────────────┐  │
       │          │    │           │       │   │   movies     │──┘
       │          │    ├──────────────┤       │   ├──────────────┤
       │          │    │ PK id        │──┐    │   │ PK id        │
       │          │    │    name      │  │    │   │    title     │
       │          │    │    type      │  │    │   │    description│
       │          │    │    totalSeats│  │    │   │    duration  │
       │          │    │    status    │  │    │   │    releaseDate│
       │          │    │    createdBy │  │    │   │    endDate   │
       │          │    │    updatedBy │  │    │   │    posterUrl │
       │          │    │    createdAt │  │    │   │    trailerUrl│
       │          │    │    updatedAt │  │    │   │    director  │
       │          │    └──────────────┘  │    │   │    cast      │
       │          │           │          │    │   │    language  │
       │          │           │ 1:N      │    │   │    rating   │
       │          │           │          │    │   │    status    │
       │          │    ┌──────────────┐  │    │   │    createdBy │
       │          │    │    seats     │  │    │   │    updatedBy │
       │          │    ├──────────────┤  │    │   │    createdAt │
       │          │    │ PK id        │  │    │   │    updatedAt │
       │          │    │ FK roomId ───│──┘    │   └──────────────┘
       │          │    │    rowLabel  │       │          │
       │          │    │    colNumber │       │          │
       │          │    │    seatNumber│       │          │
       │          │    │    seatType  │       │          │
       │          │    │    status    │       │          │
       │          │    └──────────────┘       │          │
       │          │           │               │          │
       │          │           │               │          │
       │          │           │               │   ┌──────────────┐
       │          │           │               │   │  showtimes   │
       │          │           │               │   ├──────────────┤
       │          │           │               │   │ PK id        │
       │          │           │               │   │ FK movieId ──│──┘
       │          │           │               │   │ FK roomId ───│──── rooms
       │          │           │               │   │    startTime │
       │          │           │               │   │    endTime   │
       │          │           │               │   │    basePrice │
       │          │           │               │   │    vipPrice  │
       │          │           │               │   │    couplePrice│
       │          │           │               │   │    status    │
       │          │           │               │   │    createdBy │
       │          │           │               │   │    updatedBy │
       │          │           │               │   │    createdAt │
       │          │           │               │   │    updatedAt │
       │          │           │               │   └──────────────┘
       │          │           │               │          │
       │          │           │               │          │
       │          │           │               │   ┌──────────────┐
       │   1:N    │           │               └──▶│  bookings    │
       │          │           │                   ├──────────────┤
       └──────────│───────────│───────────────────│ PK id        │
                  │           │                   │ FK userId ───│──── users
                  │           │                   │ FK showtimeId│──── showtimes
                  │           │                   │    totalAmount│
                  │           │                   │    status    │
                  │           │                   │    bookingCode│
                  │           │                   │    createdBy │
                  │           │                   │    updatedBy │
                  │           │                   │    createdAt │
                  │           │                   │    confirmedAt│
                  │           │                   │    cancelledAt│
                  │           │                   │    updatedAt │
                  │           │                   └──────────────┘
                  │           │                          │
                  │           │                          │ 1:N
                  │           │                          │
                  │           │                   ┌──────────────┐
                  │           │                   │booking_seats │
                  │           │                   ├──────────────┤
                  │           │                   │ PK id        │
                  │           │                   │ FK bookingId │──── bookings
                  │           └───────────────────│ FK seatId ───│──── seats
                  │                               │    price     │
                  │                               │    status    │
                  │                               └──────────────┘
                  │
                  │                               ┌──────────────┐
                  │                               │  payments    │
                  │                               ├──────────────┤
                  │                               │ PK id        │
                  └───────────────────────────────│ FK bookingId │──── bookings (1:1)
                                                  │    amount    │
                                                  │    method    │
                                                  │    transactionCode│
                                                  │    status    │
                                                  │    paidAt    │
                                                  │    createdBy │
                                                  │    updatedBy │
                                                  │    createdAt │
                                                  │    updatedAt │
                                                  └──────────────┘
```

## 2. Chi tiết từng bảng

### `users` — Người dùng

| Cột | Kiểu | Ràng buộc | Mô tả |
|---|---|---|---|
| id | BIGINT | PK, auto-increment | Khóa chính |
| username | NVARCHAR(50) | NOT NULL, UNIQUE | Tên đăng nhập |
| email | NVARCHAR(100) | NOT NULL, UNIQUE | Email |
| password | NVARCHAR(255) | NOT NULL | Hash BCrypt (KHÔNG lưu plain text) |
| fullName | NVARCHAR(100) | | Họ tên đầy đủ |
| phone | NVARCHAR(20) | | Số điện thoại |
| avatarUrl | NVARCHAR(500) | | URL ảnh đại diện |
| role | NVARCHAR(20) | NOT NULL, default 'USER' | Vai trò: USER / ADMIN |
| enabled | BIT | NOT NULL, default 1 | Tài khoản có hoạt động không |
| version | BIGINT | default 0 | Optimistic locking (BaseEntity) |
| storage_state | NVARCHAR(20) | | Trạng thái: ACTIVE / ARCHIVED / DELETED (BaseEntity) |
| createdBy | NVARCHAR(50) | | Ai tạo (tự điền từ JWT) |
| updatedBy | NVARCHAR(50) | | Ai sửa cuối (tự điền từ JWT) |
| createdAt | DATETIME2 | | Thời điểm tạo (tự điền) |
| updatedAt | DATETIME2 | | Thời điểm sửa cuối (tự điền) |

### `refresh_tokens` — Refresh token (để cấp lại access token)

| Cột | Kiểu | Ràng buộc | Mô tả |
|---|---|---|---|
| id | BIGINT | PK | |
| userId | BIGINT | FK → users.id | Token của user nào |
| token | NVARCHAR(255) | NOT NULL, UNIQUE | Chuỗi token (UUID) |
| expiryDate | DATETIME2 | NOT NULL | Hết hạn lúc nào |
| revoked | BIT | NOT NULL, default 0 | Đã thu hồi chưa (logout → revoke) |

**Quan hệ:** users 1 ──── N refresh_tokens (1 user có nhiều refresh token, VD: login trên nhiều thiết bị)

### `genres` — Thể loại phim

| Cột | Kiểu | Ràng buộc | Mô tả |
|---|---|---|---|
| id | BIGINT | PK, auto-increment | Khóa chính |
| name | NVARCHAR(50) | NOT NULL, UNIQUE | Tên thể loại (Hành động, Kinh dị, ...) |
| description | NVARCHAR(255) | | Mô tả |
| version | BIGINT | default 0 | Optimistic locking (BaseEntity) |
| storage_state | NVARCHAR(20) | | ACTIVE / ARCHIVED / DELETED (BaseEntity) |
| createdBy | NVARCHAR(50) | | Ai tạo (tự điền từ JWT) |
| updatedBy | NVARCHAR(50) | | Ai sửa cuối (tự điền từ JWT) |
| createdAt | DATETIME2 | | Thời điểm tạo (tự điền) |
| updatedAt | DATETIME2 | | Thời điểm sửa cuối (tự điền) |

### `movies` — Phim

| Cột | Kiểu | Ràng buộc | Mô tả |
|---|---|---|---|
| id | BIGINT | PK | |
| title | NVARCHAR(200) | NOT NULL | Tên phim |
| description | NTEXT | | Mô tả nội dung |
| duration | INT | NOT NULL | Thời lượng (phút) |
| releaseDate | DATE | | Ngày khởi chiếu |
| endDate | DATE | | Ngày kết thúc chiếu |
| posterUrl | NVARCHAR(500) | | URL poster phim |
| trailerUrl | NVARCHAR(500) | | URL trailer (YouTube, ...) |
| director | NVARCHAR(100) | | Đạo diễn |
| cast | NVARCHAR(500) | | Diễn viên (danh sách, phân cách bằng dấu phẩy) |
| language | NVARCHAR(50) | | Ngôn ngữ (Tiếng Việt, Phụ đề, ...) |
| rating | DECIMAL(3,1) | | Điểm đánh giá (0.0 - 10.0) |
| status | NVARCHAR(20) | NOT NULL | COMING_SOON / NOW_SHOWING / ENDED |
| version | BIGINT | default 0 | Optimistic locking (BaseEntity) |
| storage_state | NVARCHAR(20) | | ACTIVE / ARCHIVED / DELETED (BaseEntity) |
| createdBy | NVARCHAR(50) | | Ai tạo (BaseEntity) |
| updatedBy | NVARCHAR(50) | | Ai sửa cuối (BaseEntity) |
| createdAt | DATETIME2 | | Thời điểm tạo (BaseEntity) |
| updatedAt | DATETIME2 | | Thời điểm sửa cuối (BaseEntity) |

### `movie_genres` — Liên kết phim ↔ thể loại (nhiều-nhiều)

| Cột | Kiểu | Ràng buộc | Mô tả |
|---|---|---|---|
| movieId | BIGINT | FK → movies.id, PK | |
| genreId | BIGINT | FK → genres.id, PK | |

**Quan hệ:** movies N ──── N genres (1 phim có nhiều thể loại, 1 thể loại có nhiều phim)

**Ví dụ:**
```
Phim "Avengers" → Hành động, Khoa học viễn tưởng, Phiêu lưu
Phim "Conjuring" → Kinh dị, Bí ẩn
Thể loại "Hành động" → Avengers, John Wick, Fast & Furious, ...
```

### `rooms` — Phòng chiếu

| Cột | Kiểu | Ràng buộc | Mô tả |
|---|---|---|---|
| id | BIGINT | PK | |
| name | NVARCHAR(50) | NOT NULL, UNIQUE | Tên phòng (Phòng 1, Phòng IMAX, ...) |
| type | NVARCHAR(20) | NOT NULL | 2D / 3D / IMAX / 4DX |
| totalSeats | INT | NOT NULL | Tổng số ghế |
| status | NVARCHAR(20) | NOT NULL | ACTIVE / MAINTENANCE / INACTIVE |
| version | BIGINT | default 0 | Optimistic locking (BaseEntity) |
| storage_state | NVARCHAR(20) | | ACTIVE / ARCHIVED / DELETED (BaseEntity) |
| createdBy | NVARCHAR(50) | | Ai tạo (BaseEntity) |
| updatedBy | NVARCHAR(50) | | Ai sửa cuối (BaseEntity) |
| createdAt | DATETIME2 | | Thời điểm tạo (BaseEntity) |
| updatedAt | DATETIME2 | | Thời điểm sửa cuối (BaseEntity) |

### `seats` — Ghế ngồi

| Cột | Kiểu | Ràng buộc | Mô tả |
|---|---|---|---|
| id | BIGINT | PK | |
| roomId | BIGINT | FK → rooms.id | Ghế thuộc phòng nào |
| rowLabel | NVARCHAR(5) | NOT NULL | Hàng: A, B, C, ..., J |
| colNumber | INT | NOT NULL | Cột: 1, 2, 3, ..., 15 |
| seatNumber | NVARCHAR(10) | NOT NULL | Mã ghế: "A1", "B5", "VIP-E3" |
| seatType | NVARCHAR(20) | NOT NULL | STANDARD / VIP / COUPLE |
| status | NVARCHAR(20) | NOT NULL | AVAILABLE / BROKEN |
| version | BIGINT | default 0 | Optimistic locking (BaseEntity) |
| storage_state | NVARCHAR(20) | | ACTIVE / ARCHIVED / DELETED (BaseEntity) |
| createdBy | NVARCHAR(50) | | Ai tạo (BaseEntity) |
| updatedBy | NVARCHAR(50) | | Ai sửa cuối (BaseEntity) |
| createdAt | DATETIME2 | | Thời điểm tạo (BaseEntity) |
| updatedAt | DATETIME2 | | Thời điểm sửa cuối (BaseEntity) |

**Quan hệ:** rooms 1 ──── N seats (1 phòng có nhiều ghế)

**Ví dụ sơ đồ ghế phòng chiếu:**
```
          MÀN HÌNH
   1  2  3  4  5  6  7  8  9  10
A  O  O  O  O  O  O  O  O  O  O    ← STANDARD
B  O  O  O  O  O  O  O  O  O  O    ← STANDARD
C  O  O  O  O  O  O  O  O  O  O    ← STANDARD
D  O  O  O  O  O  O  O  O  O  O    ← STANDARD
E  ★  ★  ★  ★  ★  ★  ★  ★  ★  ★    ← VIP
F  ★  ★  ★  ★  ★  ★  ★  ★  ★  ★    ← VIP
G  ★  ★  ★  ★  ★  ★  ★  ★  ★  ★    ← VIP
H  O  O  O  O  O  O  O  O  O  O    ← STANDARD
I  O  O  O  O  O  O  O  O  O  O    ← STANDARD
J  ♥♥  ♥♥  ♥♥  ♥♥  ♥♥              ← COUPLE (mỗi cặp = 2 cột)

O = Standard    ★ = VIP    ♥♥ = Couple
```

### `showtimes` — Suất chiếu

| Cột | Kiểu | Ràng buộc | Mô tả |
|---|---|---|---|
| id | BIGINT | PK | |
| movieId | BIGINT | FK → movies.id | Chiếu phim nào |
| roomId | BIGINT | FK → rooms.id | Chiếu ở phòng nào |
| startTime | DATETIME2 | NOT NULL | Bắt đầu lúc nào |
| endTime | DATETIME2 | NOT NULL | Kết thúc lúc nào (tự tính = startTime + duration + 15 phút dọn dẹp) |
| basePrice | DECIMAL(12,0) | NOT NULL | Giá vé ghế thường (VNĐ) |
| vipPrice | DECIMAL(12,0) | NOT NULL | Giá vé ghế VIP |
| couplePrice | DECIMAL(12,0) | NOT NULL | Giá vé ghế couple |
| status | NVARCHAR(20) | NOT NULL | SCHEDULED / ONGOING / FINISHED / CANCELLED |
| version | BIGINT | default 0 | Optimistic locking (BaseEntity) |
| storage_state | NVARCHAR(20) | | ACTIVE / ARCHIVED / DELETED (BaseEntity) |
| createdBy | NVARCHAR(50) | | Ai tạo (BaseEntity) |
| updatedBy | NVARCHAR(50) | | Ai sửa cuối (BaseEntity) |
| createdAt | DATETIME2 | | Thời điểm tạo (BaseEntity) |
| updatedAt | DATETIME2 | | Thời điểm sửa cuối (BaseEntity) |

**Quan hệ:**
- movies 1 ──── N showtimes (1 phim có nhiều suất chiếu)
- rooms 1 ──── N showtimes (1 phòng có nhiều suất chiếu, nhưng không trùng giờ)

**Ví dụ:**
```
Phim "Avengers" (150 phút):
  - Suất 1: Phòng 1, 09:00 → 11:45 (150 phút + 15 phút dọn), giá 75.000đ / 100.000đ / 150.000đ
  - Suất 2: Phòng 2, 14:00 → 16:45, giá 90.000đ / 120.000đ / 180.000đ
  - Suất 3: Phòng 1, 19:00 → 21:45, giá 90.000đ / 120.000đ / 180.000đ
```

### `bookings` — Đơn đặt vé

| Cột | Kiểu | Ràng buộc | Mô tả |
|---|---|---|---|
| id | BIGINT | PK | |
| userId | BIGINT | FK → users.id | Ai đặt |
| showtimeId | BIGINT | FK → showtimes.id | Đặt suất nào |
| totalAmount | DECIMAL(12,0) | NOT NULL | Tổng tiền |
| status | NVARCHAR(20) | NOT NULL | HOLDING / CONFIRMED / CANCELLED / EXPIRED |
| bookingCode | NVARCHAR(30) | NOT NULL, UNIQUE | Mã vé: "VC-20260515-001" |
| confirmedAt | DATETIME2 | | Thời điểm xác nhận |
| cancelledAt | DATETIME2 | | Thời điểm hủy |
| version | BIGINT | default 0 | Optimistic locking (BaseEntity) |
| storage_state | NVARCHAR(20) | | ACTIVE / ARCHIVED / DELETED (BaseEntity) |
| createdBy | NVARCHAR(50) | | Ai tạo (BaseEntity) |
| updatedBy | NVARCHAR(50) | | Ai sửa cuối (BaseEntity) |
| createdAt | DATETIME2 | | Thời điểm tạo (BaseEntity) |
| updatedAt | DATETIME2 | | Thời điểm sửa cuối (BaseEntity) |

**Quan hệ:**
- users 1 ──── N bookings (1 user đặt nhiều vé)
- showtimes 1 ──── N bookings (1 suất chiếu có nhiều đơn đặt)

### `booking_seats` — Chi tiết ghế trong đơn đặt

| Cột | Kiểu | Ràng buộc | Mô tả |
|---|---|---|---|
| id | BIGINT | PK | |
| bookingId | BIGINT | FK → bookings.id | Thuộc đơn đặt nào |
| seatId | BIGINT | FK → seats.id | Ghế nào |
| price | DECIMAL(12,0) | NOT NULL | Giá của ghế này (tại thời điểm đặt) |
| status | NVARCHAR(20) | NOT NULL | HELD / BOOKED / CANCELLED |

**Quan hệ:**
- bookings 1 ──── N booking_seats (1 đơn đặt có nhiều ghế)
- seats 1 ──── N booking_seats (1 ghế có thể xuất hiện trong nhiều đơn, nhưng chỉ 1 đơn CONFIRMED cho mỗi suất chiếu)

**Tại sao tách riêng bảng `booking_seats`?**
- 1 đơn có thể đặt nhiều ghế (VD: đặt 4 ghế cho nhóm bạn)
- Mỗi ghế có giá khác nhau (VIP đắt hơn Standard)
- Có thể hủy từng ghế riêng (tùy business rule)
- Lưu giá tại thời điểm đặt (giá có thể thay đổi sau)

### `payments` — Thanh toán

| Cột | Kiểu | Ràng buộc | Mô tả |
|---|---|---|---|
| id | BIGINT | PK | |
| bookingId | BIGINT | FK → bookings.id, UNIQUE | Thanh toán cho đơn nào (1 đơn = 1 thanh toán) |
| amount | DECIMAL(12,0) | NOT NULL | Số tiền thanh toán |
| method | NVARCHAR(20) | NOT NULL | VNPAY / MOMO / CASH |
| transactionCode | NVARCHAR(100) | | Mã giao dịch từ cổng thanh toán |
| status | NVARCHAR(20) | NOT NULL | PENDING / COMPLETED / FAILED / REFUNDED |
| paidAt | DATETIME2 | | Thời điểm thanh toán thành công |
| version | BIGINT | default 0 | Optimistic locking (BaseEntity) |
| storage_state | NVARCHAR(20) | | ACTIVE / ARCHIVED / DELETED (BaseEntity) |
| createdBy | NVARCHAR(50) | | Ai tạo (BaseEntity) |
| updatedBy | NVARCHAR(50) | | Ai sửa cuối (BaseEntity) |
| createdAt | DATETIME2 | | Thời điểm tạo (BaseEntity) |
| updatedAt | DATETIME2 | | Thời điểm sửa cuối (BaseEntity) |

**Quan hệ:** bookings 1 ──── 1 payments (1 đơn đặt = 1 thanh toán)

### `vouchers` — Mã giảm giá

| Cột | Kiểu | Ràng buộc | Mô tả |
|---|---|---|---|
| id | BIGINT | PK | |
| code | NVARCHAR(30) | NOT NULL, UNIQUE | Mã voucher (VD: "KHAI_TRUONG_50") |
| description | NVARCHAR(255) | | Mô tả |
| discountType | NVARCHAR(20) | NOT NULL | PERCENTAGE / FIXED_AMOUNT |
| discountValue | DECIMAL(12,0) | NOT NULL | Giá trị giảm (20 = 20% hoặc 20.000đ) |
| minOrderAmount | DECIMAL(12,0) | default 0 | Đơn tối thiểu |
| maxDiscount | DECIMAL(12,0) | | Giảm tối đa (cho PERCENTAGE) |
| usageLimit | INT | | Tổng lượt dùng (null = không giới hạn) |
| usedCount | INT | default 0 | Đã dùng bao nhiêu lần |
| startDate | DATETIME2 | NOT NULL | Bắt đầu hiệu lực |
| endDate | DATETIME2 | NOT NULL | Hết hạn |
| active | BIT | default true | Admin bật/tắt |
| + BaseEntity fields | | | |

### `voucher_usages` — Lịch sử dùng voucher

| Cột | Kiểu | Ràng buộc | Mô tả |
|---|---|---|---|
| id | BIGINT | PK | |
| voucherId | BIGINT | FK → vouchers.id | Voucher nào |
| userId | BIGINT | FK → users.id | User nào dùng |
| bookingId | BIGINT | FK → bookings.id | Dùng cho đơn nào |
| usedAt | DATETIME2 | NOT NULL | Dùng lúc nào |

**Ràng buộc:** UNIQUE(voucherId, userId) — 1 user chỉ dùng 1 voucher 1 lần.

### `password_reset_tokens` — Token reset mật khẩu

| Cột | Kiểu | Ràng buộc | Mô tả |
|---|---|---|---|
| id | BIGINT | PK | |
| userId | BIGINT | FK → users.id | Token của user nào |
| token | NVARCHAR(255) | NOT NULL, UNIQUE | UUID token |
| expiryDate | DATETIME2 | NOT NULL | Hết hạn (15 phút) |
| used | BIT | default false | Đã dùng chưa (1 lần) |
| createdAt | DATETIME2 | | |

### `reviews` — Đánh giá phim

| Cột | Kiểu | Ràng buộc | Mô tả |
|---|---|---|---|
| id | BIGINT | PK | |
| user_id | BIGINT | FK → users.id | Ai đánh giá |
| movie_id | BIGINT | FK → movies.id | Đánh giá phim nào |
| rating | INT | NOT NULL | Điểm 1-10 |
| comment | NTEXT | | Nội dung review |
| + BaseEntity fields | | | version, storageState, audit |

**Ràng buộc:** UNIQUE(user_id, movie_id) — 1 user review 1 phim 1 lần.

### `snacks` — Menu đồ ăn rạp

| Cột | Kiểu | Ràng buộc | Mô tả |
|---|---|---|---|
| id | BIGINT | PK | |
| name | NVARCHAR(100) | NOT NULL | Tên (Bắp rang, Coca, Combo) |
| description | NVARCHAR(255) | | Mô tả |
| price | DECIMAL(12,0) | NOT NULL | Giá (VNĐ) |
| image_url | NVARCHAR(500) | | Ảnh |
| category | NVARCHAR(50) | | Danh mục (Đồ ăn, Nước, Combo) |
| available | BIT | default true | Còn bán không |
| + BaseEntity fields | | | |

### `booking_snacks` — Đồ ăn kèm đơn đặt vé

| Cột | Kiểu | Ràng buộc | Mô tả |
|---|---|---|---|
| id | BIGINT | PK | |
| booking_id | BIGINT | FK → bookings.id | Đơn đặt nào |
| snack_id | BIGINT | FK → snacks.id | Món nào |
| quantity | INT | NOT NULL | Số lượng |
| price | DECIMAL(12,0) | NOT NULL | Giá tại thời điểm đặt |

### `notifications` — Thông báo

| Cột | Kiểu | Ràng buộc | Mô tả |
|---|---|---|---|
| id | BIGINT | PK | |
| user_id | BIGINT | FK → users.id | Gửi cho user nào |
| title | NVARCHAR(200) | NOT NULL | Tiêu đề |
| content | NTEXT | | Nội dung |
| type | NVARCHAR(30) | NOT NULL | BOOKING / PROMOTION / SYSTEM |
| is_read | BIT | default false | Đã đọc chưa |
| created_at | DATETIME2 | | |

### `user_favorites` — Phim yêu thích

| Cột | Kiểu | Ràng buộc | Mô tả |
|---|---|---|---|
| id | BIGINT | PK | |
| user_id | BIGINT | FK → users.id | User nào |
| movie_id | BIGINT | FK → movies.id | Phim nào |
| created_at | DATETIME2 | | Thích lúc nào |

**Ràng buộc:** UNIQUE(user_id, movie_id) — 1 user thích 1 phim 1 lần.

## 3. Tổng kết quan hệ

```
users ─────1:N──── refresh_tokens
  │
  ├────────1:N──── bookings ────1:1──── payments
  │                    │
  │                    ├──1:N──── booking_seats ────N:1──── seats ────N:1──── rooms
  │                    │
  │                    ├──N:1──── showtimes ────N:1──── movies ────N:N──── genres
  │                    │                          │                  (qua movie_genres)
  │                    │                          └──N:1──── rooms
  │                    │
  │                    ├──N:1──── voucher_usages ────N:1──── vouchers
  │                    │
  │                    └──1:N──── booking_snacks ────N:1──── snacks
  │
  ├────────1:N──── reviews ────N:1──── movies
  ├────────1:N──── user_favorites ────N:1──── movies
  ├────────1:N──── notifications
  └────────1:N──── password_reset_tokens
```

| Quan hệ | Kiểu | Giải thích |
|---|---|---|
| users → refresh_tokens | 1:N | 1 user có nhiều refresh token (nhiều thiết bị) |
| users → bookings | 1:N | 1 user đặt nhiều vé |
| users → password_reset_tokens | 1:N | 1 user có thể request reset nhiều lần |
| movies → genres | N:N | 1 phim nhiều thể loại, 1 thể loại nhiều phim |
| movies → showtimes | 1:N | 1 phim có nhiều suất chiếu |
| rooms → showtimes | 1:N | 1 phòng có nhiều suất chiếu (khác giờ) |
| rooms → seats | 1:N | 1 phòng có nhiều ghế |
| showtimes → bookings | 1:N | 1 suất chiếu có nhiều đơn đặt |
| bookings → booking_seats | 1:N | 1 đơn đặt có nhiều ghế |
| bookings → payments | 1:1 | 1 đơn đặt = 1 thanh toán |
| bookings → voucher_usages | 1:N | 1 đơn có thể dùng voucher |
| vouchers → voucher_usages | 1:N | 1 voucher dùng bởi nhiều user |
| seats → booking_seats | 1:N | 1 ghế xuất hiện nhiều đơn (khác suất chiếu) |
| bookings → booking_snacks | 1:N | 1 đơn có thể mua nhiều đồ ăn |
| snacks → booking_snacks | 1:N | 1 món bán cho nhiều đơn |
| users → reviews | 1:N | 1 user đánh giá nhiều phim |
| movies → reviews | 1:N | 1 phim có nhiều đánh giá |
| users → user_favorites | 1:N | 1 user thích nhiều phim |
| movies → user_favorites | 1:N | 1 phim được nhiều user thích |
| users → notifications | 1:N | 1 user có nhiều thông báo |

## 4. Luồng đặt vé (mapping với ERD)

```
Bước 1: User xem phim
  → SELECT FROM movies JOIN movie_genres JOIN genres

Bước 2: User chọn suất chiếu
  → SELECT FROM showtimes WHERE movieId = ? AND startTime BETWEEN ? AND ?

Bước 3: User xem sơ đồ ghế
  → SELECT FROM seats WHERE roomId = ?
  → LEFT JOIN booking_seats (WHERE bookingId IN đơn HOLDING/CONFIRMED của suất này)
  → Ghế nào có booking_seats → đã đặt/đang giữ, còn lại → trống

Bước 4: User giữ ghế (hold)
  → INSERT bookings (status = HOLDING, hết hạn 10 phút)
  → INSERT booking_seats (status = HELD)
  → Các user khác sẽ thấy ghế này "đang giữ"

Bước 5: User thanh toán
  → INSERT payments (status = PENDING)
  → Gọi cổng thanh toán (VNPay/Momo)
  → Callback thành công → UPDATE payments (status = COMPLETED)
  → UPDATE bookings (status = CONFIRMED)
  → UPDATE booking_seats (status = BOOKED)

Bước 6: Hết hạn hold (không thanh toán)
  → Scheduled job chạy mỗi phút
  → UPDATE bookings SET status = EXPIRED WHERE status = HOLDING AND createdAt < 10 phút trước
  → UPDATE booking_seats SET status = CANCELLED
  → Ghế trở lại trống
```

## 5. Các field chung từ BaseEntity

Tất cả bảng nghiệp vụ đều `extends BaseEntity`. Chỉ 3 bảng **KHÔNG** extends:
- `refresh_tokens` — bảng kỹ thuật, có field riêng (expiryDate, revoked)
- `movie_genres` — bảng liên kết thuần (chỉ có 2 FK, không cần audit)
- `booking_seats` — bảng liên kết chi tiết (có price, status riêng)

Các bảng **CÓ** extends BaseEntity: `users`, `genres`, `movies`, `rooms`, `seats`, `showtimes`, `bookings`, `payments`

```java
public abstract class BaseEntity {
    Long id;                    // PK, tự tăng
    Long version;               // Optimistic locking (@Version)
    String storageState;        // Trạng thái lưu trữ: ACTIVE / ARCHIVED / DELETED
    String createdBy;           // Ai tạo (tự lấy từ JWT)
    String updatedBy;           // Ai sửa cuối (tự lấy từ JWT)
    LocalDateTime createdAt;    // Tạo lúc nào (tự điền)
    LocalDateTime updatedAt;    // Sửa lúc nào (tự điền)
}
```

| Field | Tác dụng |
|---|---|
| `version` | **Optimistic Locking:** mỗi lần save, version +1. Nếu 2 người sửa cùng lúc cùng record → người save sau sẽ bị lỗi `OptimisticLockException` thay vì ghi đè im lặng |
| `storageState` | **Soft Delete:** xóa record = set `storageState = 'ARCHIVED'`. Data vẫn còn trong DB, có thể khôi phục. Production không bao giờ DELETE thật. Enum chỉ có 2 giá trị: `ACTIVE` (mặc định) và `ARCHIVED` (đã xóa mềm) |

Nhờ JPA Auditing + `AuditorAware`, 4 field `createdBy/updatedBy/createdAt/updatedAt` được **tự động điền** mỗi khi save entity, không cần code thủ công.
