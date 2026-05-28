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
│     └── QR = bookingCode (VD: VC-20260515-001)                  │
│     └── Vào "Vé của tôi" xem lại bất kỳ lúc nào               │
│                                                                 │
│  9. Đến rạp check-in                                            │
│     └── Đưa QR cho nhân viên quét                               │
│     └── POST /api/bookings/check-in?code=VC-20260515-001       │
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
