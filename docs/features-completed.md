# CineX — Danh sách chức năng đã hoàn thành

---

## 1. Khách (Guest) — Chưa đăng nhập

### Xác thực tài khoản
- Đăng ký tài khoản (username, email, mật khẩu, họ tên)
- Đăng nhập (JWT access token + refresh token)
- Đăng nhập sai → toast lỗi chung chung "Thông tin đăng nhập không chính xác" (chống user enumeration)
- Quên mật khẩu (gửi email chứa link reset, hết hạn theo config)
- Đặt lại mật khẩu (nhập token + mật khẩu mới)
- Đã đăng nhập → vào /login hoặc /register → tự redirect về trang chủ

### Xem phim
- Trang chủ: phim đang chiếu (dựa trên suất chiếu thực tế), phim sắp ra mắt
- "Đang chiếu" = phim có suất chiếu chưa kết thúc (endTime >= now) — chuẩn rạp CGV/Lotte
- "Sắp chiếu" = admin set status COMING_SOON
- Danh sách phim: tìm kiếm theo tên, lọc theo thể loại
- Chi tiết phim: poster, trailer, thông tin, đánh giá, lịch chiếu
- Genre đã lưu trữ (ARCHIVED) ẩn khỏi user, chỉ hiện genre ACTIVE
- Xem đánh giá phim (danh sách review + điểm trung bình)

---

## 2. Người dùng (User) — Đã đăng nhập

### Quản lý tài khoản
- Xem hồ sơ cá nhân
- Cập nhật hồ sơ (họ tên, số điện thoại)
- Upload avatar (lưu Cloudinary)
- Đổi mật khẩu (kiểm tra mật khẩu cũ, mới phải khác cũ)
- Đăng xuất (revoke refresh token)
- Tự động làm mới token khi hết hạn (15 phút access, 7 ngày refresh)

### Đặt vé xem phim
- Chọn suất chiếu → xem sơ đồ ghế real-time (WebSocket STOMP)
- Hold ghế (giữ chỗ theo config, tối đa ghế/lần theo config, lock bi quan tránh race condition)
- Ghế hỏng (BROKEN) hiện đỏ, ghế đã bán hiện xám (cả ghế đơn + ghế đôi COUPLE đồng bộ)
- Không cho chọn ghế hỏng — FE disable + BE chặn nếu bypass
- Nhập mã voucher giảm giá (chọn từ danh sách hoặc nhập tay)
- Thanh toán online: MoMo Sandbox (cổng thật, môi trường test) — QR ví MoMo + ATM + Visa/Master
- Xác nhận đặt vé tự động sau thanh toán thành công
- Xem lịch sử đặt vé (phân trang, sắp xếp mới nhất)
- Xem chi tiết vé + mã QR
- Hủy vé (trước giờ chiếu X phút theo config, trả lại voucher, Payment → REFUNDED, gửi email)
- Nhận email vé có QR code inline sau thanh toán (design dark mode + gold)

### Yêu thích phim
- Thêm/bỏ yêu thích phim (icon trái tim trên trang chi tiết)
- Xem danh sách phim yêu thích

### Đánh giá phim
- Tạo đánh giá (chấm điểm 1-10 + bình luận)
- Xóa đánh giá của mình
- Điểm trung bình phim tự cập nhật sau tạo/xóa review

### Thông báo
- Nhận thông báo real-time qua WebSocket (bell icon + badge đỏ)
- Xem danh sách thông báo
- Đánh dấu đã đọc (từng cái hoặc tất cả)

---

## 3. Quản trị viên (Admin)

### Dashboard thống kê
- Tổng quan hôm nay: booking, doanh thu vé, doanh thu snack, tổng user, tổng phim
- Biểu đồ doanh thu theo ngày (Recharts AreaChart)
- Thống kê phim theo khoảng thời gian (filter 7/14/30 ngày hoặc tùy chọn)
- Thống kê đồ ăn theo khoảng thời gian
- Tỉ lệ lấp đầy ghế theo suất chiếu
- Thống kê KHÔNG tính vé đã hủy (booking CANCELLED + payment REFUNDED)
- Xuất báo cáo PDF (tiếng Việt có dấu, font Roboto, gộp nhiều bảng 1 file)
- Xuất báo cáo Excel (nhiều sections, merge cells, auto column width)
- Không có dữ liệu → toast "Không có dữ liệu để xuất"

### Quản lý thể loại phim
- CRUD thể loại (tạo, sửa, xem)
- Xóa mềm / khôi phục (đơn lẻ + hàng loạt)
- Tìm kiếm theo tên
- Genre đã lưu trữ: admin thấy (badge mờ + gạch ngang), user ẩn

### Quản lý phim
- CRUD phim (tên, thời lượng, ngày chiếu, ngày kết thúc, mô tả, đạo diễn, diễn viên, ngôn ngữ, thể loại)
- Upload poster phim lên Cloudinary (action riêng, không nằm trong form)
- Lọc theo: tên, trạng thái, thể loại
- Xóa mềm / khôi phục (đơn lẻ + hàng loạt)
- Admin form edit: hiện cả genre ARCHIVED "(đã lưu trữ)" để bỏ chọn

### Quản lý phòng chiếu
- CRUD phòng (tên, loại: 2D/3D/IMAX/4DX)
- Tạo sơ đồ ghế tự động (hàng × cột, chọn hàng VIP, hàng đôi)
- Editor sơ đồ ghế: click/drag đổi loại ghế (thường/VIP/đôi/hỏng), save hàng loạt
- Ghế hỏng (BROKEN): admin đánh dấu đỏ, đổi loại ghế → tự khôi phục AVAILABLE
- Ghế đôi tự ghép cặp (2 ghế liền nhau)
- Chú thích ghế đồng bộ: Thường → VIP → Đôi → Hỏng (+ Đã thay đổi ở editor)
- Xóa mềm / khôi phục

### Quản lý suất chiếu
- CRUD suất chiếu (phim, phòng, giờ bắt đầu, giá thường/VIP/đôi)
- Tự tính giờ kết thúc = giờ bắt đầu + thời lượng phim + buffer vệ sinh (config động)
- Kiểm tra trùng giờ cùng phòng (thuật toán giao khoảng thời gian)
- Validate giá: thường ≤ VIP ≤ đôi (BE + FE)
- Không cho tạo suất chiếu trong quá khứ
- Không cho sửa suất đã có vé đặt
- Lọc theo: phim, phòng, ngày, trạng thái

### Quản lý người dùng
- Danh sách user (tìm kiếm, lọc role/trạng thái)
- Sửa thông tin user (họ tên, phone, role, enabled)
- Khóa/mở khóa tài khoản (enabled toggle)
- Không cho admin tự sửa role/disable chính mình

### Quản lý đặt vé
- Danh sách tất cả booking (lọc theo user, phim, suất, trạng thái)
- Xem chi tiết booking
- Check-in bằng quét mã QR camera hoặc nhập mã thủ công

### Quản lý đồ ăn (Snack)
- CRUD đồ ăn (tên, giá, danh mục: Bắp rang/Nước uống/Combo/Khác)
- Upload ảnh snack lên Cloudinary
- Xóa mềm / khôi phục (đơn lẻ + hàng loạt)

### POS Đồ ăn — Bán đồ ăn tại quầy
- Grid đồ ăn (click để thêm vào giỏ)
- Giỏ hàng: tăng/giảm số lượng, xóa item
- Xác nhận đơn hàng (tạo SnackOrder + items, sinh mã đơn tự động)
- Giá snapshot: lưu giá tại thời điểm đặt, không bị ảnh hưởng khi admin đổi giá sau

### POS Bán vé — Bán vé tại quầy cho khách vãng lai
- Chọn suất chiếu hôm nay (chỉ hiện suất còn đặt được, ẩn suất đã quá cutoff)
- Sơ đồ ghế: render theo hàng, COUPLE gộp, ghế hỏng đỏ, đã bán xám
- Chọn ghế → tính tiền tự động (breakdown Thường/VIP/Đôi)
- Xác nhận bán vé → Booking CONFIRMED + Payment CASH COMPLETED ngay lập tức
- Khách vãng lai không cần tài khoản (user_id = null)
- Ghế cập nhật real-time qua WebSocket
- Màn hình + chú thích đồng bộ với user SeatSelection + admin SeatMapEditor

### Quản lý voucher (mã giảm giá)
- CRUD voucher (mã, loại: phần trăm/cố định, giá trị, đơn tối thiểu, giảm tối đa, giới hạn lượt dùng, ngày bắt đầu/kết thúc)
- Validate: phần trăm ≤ 100%, giá trị giảm ≤ đơn tối thiểu, ngày kết thúc > bắt đầu
- Xóa mềm / khôi phục (đơn lẻ + hàng loạt)
- Voucher hết hạn tự archive (scheduler mỗi 5 phút)

### Cấu hình hệ thống (6 config động)
| Key | Default | Mô tả |
|---|---|---|
| `booking.hold_minutes` | 10 | Thời gian giữ ghế khi đặt vé (phút) |
| `booking.max_seats` | 8 | Tối đa số ghế mỗi lần đặt vé |
| `booking.cutoff_after_start_minutes` | 15 | Cho đặt vé trong X phút sau khi suất chiếu bắt đầu |
| `booking.cancel_before_minutes` | 60 | Hủy vé trước X phút khi suất chiếu bắt đầu |
| `showtime.buffer_minutes` | 15 | Thời gian vệ sinh phòng giữa 2 suất chiếu (phút) |
| `auth.reset_token_expiry_minutes` | 15 | Token đặt lại mật khẩu hết hạn sau X phút |

Tất cả đọc từ DB + cache Redis, admin thay đổi trên UI mà không cần sửa code.

---

## 4. Hệ thống (System) — Chạy tự động ngầm

### Scheduled Tasks
| Tác vụ | Chu kỳ | Mô tả |
|---|---|---|
| BookingCleanupScheduler | 1 phút | Dọn booking HOLDING hết hạn → EXPIRED, trả ghế, gửi WebSocket |
| VoucherCleanupScheduler | 5 phút | Archive voucher hết hạn |

### WebSocket Real-time
| Kênh | Mô tả |
|---|---|
| `/topic/showtime/{id}/seats` | Cập nhật ghế khi hold/book/cancel/expire |
| `/topic/notifications/{userId}` | Thông báo mới cho user |

### Email tự động (design dark mode + gold đồng bộ)
| Loại | Trigger |
|---|---|
| Email reset mật khẩu | User click "Quên mật khẩu" |
| Email xác nhận vé + QR code | Thanh toán thành công |
| Email xác nhận hủy vé | User hủy vé |

### Observer Pattern (Spring Events)
| Sự kiện | Hành động |
|---|---|
| PaymentCompletedEvent | Tạo notification + gửi email xác nhận vé |

### Hủy vé — Flow hoàn chỉnh
```
User hủy vé
  → Booking.status = CANCELLED
  → BookingSeat.status = CANCELLED
  → Payment.status = REFUNDED (doanh thu không tính)
  → Voucher usedCount - 1 (trả lại)
  → Ghế trả lại (WebSocket real-time)
  → Email xác nhận hủy
```

---

## 5. Bảo mật & Clean Code

### Bảo mật
- JWT access token (15 phút) + refresh token (7 ngày)
- Login sai → message chung chung (chống user enumeration)
- Interceptor FE: login/register 401 không trigger refresh token
- CORS config từ `${app.frontend-url}` (không hardcode localhost)
- Ghế BROKEN: FE disable + BE chặn nếu bypass
- Admin không tự sửa role/disable chính mình
- Soft delete (ARCHIVED) — không xóa thật dữ liệu

### Clean Code
- Không còn hardcode business logic — tất cả config động từ system_config
- Frontend URL config từ application.yml (`${app.frontend-url}`)
- Repository pattern đúng: Service không chứa EntityManager
- Type safety: bỏ `any` → proper TypeScript types
- Duplicate code gộp lại (export logic, PageResponse interface)
- Màu sắc ghế đồng bộ 3 nơi (user, admin editor, admin POS):
  - Thường = xanh lá, VIP = vàng, Đôi = tím, Đang chọn = gold
  - Đã bán = xám (cả ghế đơn + ghế đôi), Hỏng = đỏ
- Chú thích ghế đồng bộ thứ tự: Thường → VIP → Đôi → Đang chọn → Đã bán → Hỏng
- Màn hình CSS đồng bộ (gradient gold) ở cả 3 trang ghế
- MoMo Sandbox tích hợp: HMAC-SHA256, payWithMethod (QR + ATM + Visa)
- `getErrorMessage()` helper — xử lý lỗi API type-safe, giảm `any` từ 90 → 23

---

## Tổng kết kỹ thuật

| Hạng mục | Số lượng |
|---|---|
| Trang Frontend | 30 trang |
| Module Backend | 17 module |
| API Endpoints | 100+ endpoints |
| Scheduled Tasks | 2 (booking cleanup, voucher archive) |
| WebSocket Channels | 2 (seats, notifications) |
| Email Templates | 3 (reset password, booking confirm, booking cancel) |
| System Config | 6 config động |
| Design Patterns | 20 patterns (Factory, Strategy, Observer, State Machine, Specification, ...) |
| Cổng thanh toán | MoMo Sandbox (payWithMethod: QR + ATM + Visa) |
| Database Tables | 15+ bảng (30 Liquibase migrations) |
| Test Cases | 200+ test cases (23 module) |
| Documentation | 60+ file docs (tiếng Việt có dấu) |
