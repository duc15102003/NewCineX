# CineX — Test Cases

Tài liệu liệt kê toàn bộ test cases cho hệ thống CineX, phân theo module.

---

## 1. AUTH — Đăng ký / Đăng nhập / Mật khẩu

### 1.1 Đăng ký (Register)

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 1.1.1 | Đăng ký thành công | username=testuser, email=test@mail.com, password=123456 | Tạo account, trả token | Cả hai |
| 1.1.2 | Username trống | username="" | "Tên đăng nhập là bắt buộc" | Cả hai |
| 1.1.3 | Username < 3 ký tự | username="ab" | "Tên đăng nhập từ 3-50 ký tự" | Cả hai |
| 1.1.4 | Username > 50 ký tự | username="a"x51 | "Tên đăng nhập từ 3-50 ký tự" | BE |
| 1.1.5 | Username đã tồn tại | username="admin" | "Tên đăng nhập đã được sử dụng" | BE |
| 1.1.6 | Email trống | email="" | "Email là bắt buộc" | Cả hai |
| 1.1.7 | Email sai format | email="abc" | "Email không hợp lệ" | Cả hai |
| 1.1.8 | Email đã tồn tại | email="admin@cinex.com" | "Email đã được sử dụng" | BE |
| 1.1.9 | Password < 6 ký tự | password="123" | "Mật khẩu từ 6-100 ký tự" | Cả hai |
| 1.1.10 | Confirm password không khớp | password≠confirmPassword | "Mật khẩu xác nhận không khớp" | FE (Zod) |
| 1.1.11 | Họ tên để trống | fullName="" | OK (optional) | Cả hai |

### 1.2 Đăng nhập (Login)

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 1.2.1 | Đăng nhập thành công | admin/123456 | Trả token + redirect | Cả hai |
| 1.2.2 | Username sai | wronguser/123456 | "Tên đăng nhập hoặc mật khẩu không đúng" | BE |
| 1.2.3 | Password sai | admin/wrongpass | "Tên đăng nhập hoặc mật khẩu không đúng" | BE |
| 1.2.4 | Account bị disabled | disabled_user/pass | "Tài khoản đã bị khóa" | BE |
| 1.2.5 | Username trống | ""/"" | "Tên đăng nhập là bắt buộc" | Cả hai |
| 1.2.6 | Sau login fetch avatarUrl | Login thành công | Header hiện avatar (không phải letter) | FE |

### 1.3 Đổi mật khẩu (Change Password)

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 1.3.1 | Đổi thành công | old=đúng, new=mới, confirm=mới | "Đổi mật khẩu thành công" | Cả hai |
| 1.3.2 | Mật khẩu cũ sai | old=sai | "Mật khẩu cũ không đúng" | BE |
| 1.3.3 | New ≠ Confirm | new≠confirm | "Mật khẩu mới và xác nhận mật khẩu không khớp" | Cả hai |
| 1.3.4 | New = Old | new=old | "Mật khẩu mới phải khác mật khẩu cũ" | BE |
| 1.3.5 | New < 6 ký tự | new="123" | "Mật khẩu từ 6-100 ký tự" | Cả hai |

### 1.4 Quên mật khẩu (Forgot/Reset Password)

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 1.4.1 | Gửi email reset | email tồn tại | Gửi email chứa link reset (Mailtrap) | BE |
| 1.4.2 | Email không tồn tại | email="notexist@x.com" | Vẫn trả success (tránh user enumeration) | BE |
| 1.4.3 | Token hết hạn (15 phút) | Token cũ | "Token đặt lại mật khẩu đã hết hạn" | BE |
| 1.4.4 | Token đã dùng | Token used=true | "Token đã được sử dụng" | BE |
| 1.4.5 | Password mới trùng cũ | new=old | "Mật khẩu mới phải khác mật khẩu cũ" | BE |

---

## 2. MOVIE — Quản lý phim

### 2.1 Tạo phim

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 2.1.1 | Tạo thành công | title, duration, status đầy đủ | Phim mới ở đầu danh sách | Cả hai |
| 2.1.2 | Tên phim trống | title="" | "Tên phim là bắt buộc" | Cả hai |
| 2.1.3 | Tên phim > 200 ký tự | title="a"x201 | "Tối đa 200 ký tự" | Cả hai |
| 2.1.4 | Thời lượng = 0 | duration=0 | "Thời lượng phải > 0" / "Thời lượng phải ít nhất 1 phút" | Cả hai |
| 2.1.5 | Thời lượng âm | duration=-1 | Chặn bởi Input (không nhập được "-") | FE |
| 2.1.6 | Nhập chữ "e" vào thời lượng | duration="1e5" | Chặn bởi Input (không nhập được "e") | FE |
| 2.1.7 | ~~endDate < releaseDate~~ (DEPRECATED) | — | Lifecycle moved sang MovieRun.startDate/endDate; xem case 25.x | — |
| 2.1.8 | ~~Trạng thái trống~~ (DEPRECATED) | — | Status computed on-the-fly bởi MovieStatusComputer | — |
| 2.1.9 | Không chọn thể loại (UPDATED) | genreIds=[] hoặc null | "Phim phải có ít nhất 1 thể loại" | Cả hai |
| 2.1.10 | Đạo diễn > 100 ký tự | director="a"x101 | "Tối đa 100 ký tự" | Cả hai |
| 2.1.11 | Diễn viên > 500 ký tự | cast="a"x501 | "Tối đa 500 ký tự" | Cả hai |
| 2.1.12 | Thời lượng > 500 phút | duration=501 | "Thời lượng tối đa 500 phút (~8h)" | BE |
| 2.1.13 | Thời lượng = 500 (boundary) | duration=500 | OK (director's cut) | Cả hai |
| 2.1.14 | Trailer URL hợp lệ (YouTube) | trailer="https://youtu.be/abc" | OK | Cả hai |
| 2.1.15 | Trailer URL hợp lệ (Vimeo) | trailer="https://vimeo.com/123" | OK | Cả hai |
| 2.1.16 | Trailer URL trống (optional) | trailer="" | OK | Cả hai |
| 2.1.17 | Trailer URL random text | trailer="hello" | "Trailer URL phải là link YouTube hoặc Vimeo" | Cả hai |
| 2.1.18 | Trailer URL Dailymotion (không support) | trailer="https://dailymotion.com/x" | "Trailer URL phải là link YouTube hoặc Vimeo" | Cả hai |
| 2.1.19 | Trailer URL FTP scheme (phishing) | trailer="ftp://malware.com" | "Trailer URL phải là link YouTube hoặc Vimeo" | Cả hai |
| 2.1.20 | Rating âm | rating=-0.1 | "Điểm đánh giá phải từ 0 đến 10" | BE |
| 2.1.21 | Rating > 10 | rating=10.1 | "Điểm đánh giá phải từ 0 đến 10" | BE |
| 2.1.22 | Rating thang nhầm 100 | rating=100.0 | "Điểm đánh giá phải từ 0 đến 10" | BE |
| 2.1.23 | Rating null (phim chưa có review) | rating=null | OK | BE |
| 2.1.24 | Rating boundary 0.0 và 10.0 | rating=0.0 hoặc rating=10.0 | OK | BE |

### 2.2 Upload poster

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 2.2.1 | Upload JPG/PNG thành công | file.jpg < 5MB | Poster hiện trên bảng + Cloudinary | Cả hai |
| 2.2.2 | File không phải ảnh (BE check) | file.pdf | "Định dạng không hỗ trợ — chỉ chấp nhận JPG, PNG, WebP" | Cả hai |
| 2.2.3 | File > 5MB | big.jpg (6MB) | "Ảnh quá lớn (6.0MB) — tối đa 5MB" | Cả hai |
| 2.2.4 | Upload = action riêng | Click icon Upload trên table | Lưu ngay, không phụ thuộc form | FE |
| 2.2.5 | Upload GIF (không support) | anim.gif | "Định dạng không hỗ trợ — chỉ chấp nhận JPG, PNG, WebP" | Cả hai |
| 2.2.6 | Upload WebP | file.webp | OK (đồng bộ industry, browser support 95%+) | Cả hai |
| 2.2.7 | Magic bytes check (BE only) | file đổi ext .jpg nhưng nội dung .exe | "File không hợp lệ" — BE detect magic bytes | BE |

---

## 3. GENRE — Quản lý thể loại

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 3.1 | Tạo thành công | name="Kinh dị" | Thể loại mới ở đầu list | Cả hai |
| 3.2 | Tên trống | name="" | "Tên thể loại là bắt buộc" | Cả hai |
| 3.3 | Tên > 50 ký tự | name="a"x51 | "Tối đa 50 ký tự" | Cả hai |
| 3.4 | Tên trùng | name="Action" (đã có) | "Thể loại đã tồn tại" | BE |
| 3.5 | Mô tả > 255 ký tự | desc quá dài | "Mô tả tối đa 255 ký tự" / "Mô tả tối đa 500 ký tự" | Cả hai |
| 3.6 | Tạo thể loại → hiện trong form phim | Tạo "Tâm lý" → mở form phim | "Tâm lý" hiện trong MultiSelect | FE |
| 3.7 | Lưu trữ thể loại | Chọn → Trạng thái → Lưu trữ | storageState=ARCHIVED, badge cam | Cả hai |
| 3.8 | Khôi phục thể loại | Chọn → Trạng thái → Khôi phục | storageState=ACTIVE, badge xanh | Cả hai |
| 3.9 | Tên có khoảng trắng đầu/cuối | name="  Hài Hước  " | Save thành "Hài Hước" (auto trim) | BE |
| 3.10 | Tên chỉ khoảng trắng | name="   " | "Tên thể loại không được rỗng (chỉ có khoảng trắng)" | BE |
| 3.11 | Trùng case-insensitive (UPPER) | name="ACTION" khi đã có "Action" | "Thể loại 'ACTION' đã tồn tại (không phân biệt hoa thường)" | BE |
| 3.12 | Trùng case-insensitive (lower) | name="action" khi đã có "Action" | "Thể loại 'action' đã tồn tại (không phân biệt hoa thường)" | BE |
| 3.13 | Trùng sau khi trim | name="  Action  " khi đã có "Action" | Reject duplicate (đã trim trước check) | BE |
| 3.14 | Update đổi case của chính nó | "Action" → "action" | OK (chỉ đổi case của chính nó, không phải duplicate khác) | BE |
| 3.15 | Xoá thể loại có phim | "Hành động" có 12 phim active | "Thể loại đang được 12 phim sử dụng. Hãy xoá hoặc đổi thể loại của các phim trước khi xoá" | BE |
| 3.16 | Xoá thể loại 1 phim | "Tài liệu" có 1 phim | "Thể loại đang được 1 phim sử dụng..." | BE |
| 3.17 | Xoá thể loại 0 phim (đã archived all) | "Thử nghiệm" có 0 phim active | Xoá thành công (soft-delete) | Cả hai |
| 3.18 | Bulk delete fail-fast | Chọn 3 genres, 1 còn phim | Toàn bộ bulk fail với message count chính xác | BE |
| 3.19 | Update giữ nguyên tên → không check unique | Save lại với cùng tên | OK (skip unique check) | BE |

---

## 4. ROOM — Quản lý phòng chiếu

### 4.1 CRUD phòng

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 4.1.1 | Tạo phòng | name="Phòng 05", type=IMAX | Phòng mới, totalSeats=0 | Cả hai |
| 4.1.2 | Tên phòng trống | name="" | "Tên phòng là bắt buộc" | Cả hai |
| 4.1.3 | Tên phòng trùng | name="Phòng 01" | "Phòng chiếu đã tồn tại" | BE |
| 4.1.4 | Tên > 50 ký tự | name="a"x51 | "Tối đa 50 ký tự" | Cả hai |
| 4.1.5 | totalSeats readonly khi edit | Mở edit phòng | Hiện "80 ghế (cập nhật qua Tạo sơ đồ ghế)" | FE |
| 4.1.6 | Loại phòng badge màu | type=IMAX | Badge vàng gold | FE |

### 4.2 Generate Seats (Tạo sơ đồ ghế)

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 4.2.1 | Tạo thành công | 8 hàng × 10 cột, VIP=D,E | 80 ghế, D-E VIP | Cả hai |
| 4.2.2 | Số hàng = 0 | totalRows=0 | Nút Tạo ghế disabled | FE |
| 4.2.3 | Số cột lẻ + hàng đôi | 11 cột, couple=H | 5 đôi + 1 ghế thường (cột 11) | BE |
| 4.2.4 | VIP row ngoài range | vipRows=["Z"], totalRows=8 | "Hàng VIP ngoài phạm vi A-H" | BE |
| 4.2.5 | Hàng đã chọn VIP ẩn khỏi picker Couple | Chọn D=VIP | D không hiện trong Couple picker | FE |
| 4.2.6 | Giảm số hàng → xóa VIP/Couple ngoài range | 8→5 hàng, VIP=F | F bị xóa tự động | FE |

### 4.3 Seat Map Editor

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 4.3.1 | Click đổi loại ghế | Chọn VIP → click ghế A1 | A1 thành VIP (ring trắng = changed) | FE |
| 4.3.2 | Kéo chuột chọn nhiều | Drag qua 5 ghế | 5 ghế đổi loại | FE |
| 4.3.3 | COUPLE ghép cặp | Click COUPLE lên ghế B1 | B1+B2 cùng thành COUPLE | FE |
| 4.3.4 | COUPLE ghế lẻ cuối hàng | Click COUPLE lên ghế cuối (cột 11) | Không cho đổi (không có partner) | FE |
| 4.3.5 | Bỏ COUPLE → cả cặp đổi | Click VIP lên B1 (đang COUPLE) | B1+B2 cùng thành VIP | FE |
| 4.3.6 | COUPLE hiển thị gộp 2 ô | Pair B1-B2 COUPLE | 1 ô rộng 2 cột, label "1-2" | FE |
| 4.3.7 | Reset changes | Click Reset | Tất cả pending changes bị xóa | FE |
| 4.3.8 | Save bulk update | Lưu 10 thay đổi | API gom theo loại, gọi ít nhất | Cả hai |

---

## 5. SHOWTIME — Quản lý suất chiếu

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 5.1 | Tạo thành công | movie, room, startTime, basePrice | Suất chiếu mới | Cả hai |
| 5.2 | Phim trống | movieId=null | "Vui lòng chọn phim" | Cả hai |
| 5.3 | Giờ bắt đầu trống | startTime="" | "Giờ bắt đầu là bắt buộc" | Cả hai |
| 5.4 | Giá vé = 0 | basePrice=0 | "Giá vé phải ít nhất 1đ" | BE |
| 5.5 | Giá VIP < giá thường | base=100k, vip=50k | "Giá VIP phải lớn hơn hoặc bằng giá thường" | BE |
| 5.6 | Trùng giờ cùng phòng | Cùng room + overlapping time | "Suất chiếu bị trùng giờ" | BE |
| 5.7 | Sửa suất chiếu có booking | Update showtime có 3 vé đặt | "Không thể sửa suất chiếu đã có 3 vé đặt" | BE |
| 5.8 | PriceInput format | Nhập 75000 | Hiện "75.000đ" trên ô input | FE |
| 5.9 | Nhập "e" vào giá | Gõ "e" | Chặn, không nhập được | FE |
| 5.10 | Xoá suất status SCHEDULED | DELETE /showtimes/{id} status=SCHEDULED, không có booking | Soft-delete OK | BE |
| 5.11 | Xoá suất status ONGOING | DELETE status=ONGOING | "Chỉ có thể xoá suất chiếu đang ở trạng thái SCHEDULED" | BE |
| 5.12 | Xoá suất status FINISHED | DELETE status=FINISHED | "Suất FINISHED không thể xoá — giữ làm lịch sử" | BE |
| 5.13 | Xoá suất có booking active | DELETE status=SCHEDULED nhưng có 3 vé HOLDING/CONFIRMED | "Không thể xoá suất chiếu đã có 3 vé đặt. Hãy cancel suất chiếu (sẽ hoàn vé tự động) thay vì xoá" | BE |
| 5.14 | Bulk delete fail-fast | 3 suất, 1 ở status ONGOING | Toàn bộ bulk fail, không suất nào bị archive | BE |
| 5.15 | Tạo suất phòng MAINTENANCE | room.status=MAINTENANCE | "Phòng 'X' đang bảo trì — không thể tạo suất chiếu" | BE |

---

## 6. BOOKING — Đặt vé

### 6.1 Hold Seats (Giữ ghế)

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 6.1.1 | Giữ ghế thành công | 2 ghế, showtimeId hợp lệ | Booking HOLDING, hold 10 phút | Cả hai |
| 6.1.2 | Chọn > 8 ghế | 9 seatIds | "Tối đa 8 ghế mỗi lần đặt" | BE |
| 6.1.3 | Ghế đã bị đặt | seatId đã HELD/BOOKED | "Ghế đã được đặt hoặc đang giữ" | BE |
| 6.1.4 | Suất chiếu đã bắt đầu | startTime < now | "Suất chiếu đã bắt đầu" | BE |
| 6.1.5 | seatIds trùng lặp | [1, 1, 1] | Dedup → [1], tính tiền 1 ghế | BE |
| 6.1.6 | Ghế không tồn tại | seatId=99999 | "Một hoặc nhiều ghế không tồn tại" | BE |
| 6.1.7 | Voucher hợp lệ | voucherCode="SALE50" | Giảm giá, ghi nhận usedCount+1 | BE |
| 6.1.8 | Voucher hết hạn | expired voucher | "Voucher đã hết hạn hoặc chưa bắt đầu" | BE |
| 6.1.9 | Voucher đã dùng (1 user 1 lần) | Dùng lại voucher | "Bạn đã sử dụng voucher này" | BE |
| 6.1.10 | Guest click đặt vé | Chưa login → click "Đặt vé" | Hiện LoginPromptModal | FE |
| 6.1.11 | WebSocket real-time | User A giữ ghế | User B thấy ghế đổi màu đỏ real-time | Cả hai |

### 6.2 Confirm / Cancel / Check-in

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 6.2.1 | Confirm booking | bookingId HOLDING | Status → CONFIRMED | BE |
| 6.2.2 | Confirm đã hết hạn hold | Sau 10 phút | "Thời gian giữ ghế đã hết hạn" | BE |
| 6.2.3 | Cancel booking | bookingId CONFIRMED | Status → CANCELLED, ghế trả lại | BE |
| 6.2.4 | Cancel suất đã chiếu | Showtime đã qua | "Suất chiếu đã bắt đầu, không thể hủy" | BE |
| 6.2.5 | Check-in thành công | code="CX-VTA-004" | Status → CHECKED_IN | Cả hai |
| 6.2.6 | Check-in vé đã dùng | Vé CHECKED_IN | "Vé đã được sử dụng" | BE |
| 6.2.7 | Check-in vé chưa confirm | Vé HOLDING | "Vé chưa được xác nhận" | BE |
| 6.2.8 | Quét QR camera | Camera quét mã | Tự gọi check-in API | FE |
| 6.2.9 | FE TicketDetailPage hủy vé | Click Hủy vé → ConfirmDialog | Hiện dialog xác nhận, không dùng window.confirm | FE |
| 6.2.10 | Check-in suất đã CANCELLED | Staff scan vé khi suất CANCELLED | "Suất chiếu đã bị huỷ — không thể check-in. Hướng khách ra quầy refund" | BE |
| 6.2.11 | Check-in vé suất SCHEDULED (chưa bắt đầu) | Suất start_time = +30 phút | OK — vé CHECKED_IN (early check-in) | BE |
| 6.2.12 | Check-in vé suất ONGOING | Suất đang chiếu | OK — vé CHECKED_IN | BE |

---

## 7. PAYMENT — Thanh toán

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 7.1 | Tạo thanh toán | bookingId HOLDING, method=VNPAY | Payment PENDING, trả URL | BE |
| 7.2 | Thanh toán booking không phải của mình | bookingId của user khác | "Không phải đơn đặt vé của bạn" | BE |
| 7.3 | Booking đã thanh toán | Payment đã COMPLETED | "Đã có thanh toán cho đơn này" | BE |
| 7.4 | Callback thành công | transactionCode hợp lệ | Payment COMPLETED, Booking CONFIRMED | BE |
| 7.5 | Gửi email vé + QR | Callback success | Email có QR code inline gửi đến Mailtrap | BE |
| 7.6 | Xem payment booking khác | GET /payments/{bookingId} khác user | "Không phải đơn đặt vé của bạn" | BE |
| 7.7 | UI hiện đúng thời gian giữ | PaymentPage | "Vé sẽ được giữ trong vòng 10 phút" | FE |
| 7.8 | Callback amount khớp | amount=100000 = payment.amount | OK, payment COMPLETED | BE |
| 7.9 | Callback amount sai (fraud/glitch) | callback amount=50000 ≠ payment.amount=100000 | Payment FAILED, log AMOUNT_MISMATCH, throw "Số tiền callback không khớp với giao dịch" | BE |
| 7.10 | Callback không có field amount | params không có "amount" | Skip check, vẫn COMPLETED (mock/test mode) | BE |
| 7.11 | Callback amount không parse được | amount="abc" | Log warning, skip check, vẫn COMPLETED | BE |
| 7.12 | Idempotency callback | Gọi callback 2 lần cùng transactionCode | Lần 2 trả response cũ, không double-charge | BE |
| 7.13 | PaymentCleanupScheduler auto-fail | Payment PENDING > 30 phút (config) | Scheduler set status=FAILED, log "Auto-failed payment X kẹt PENDING > 30 phút" | BE |
| 7.14 | PaymentCleanupScheduler ShedLock | 2 instance chạy cùng | Chỉ 1 instance execute, instance khác skip | BE |
| 7.15 | Race condition booking đã CANCELLED | Callback đến khi booking CANCELLED | Payment COMPLETED + needsRefund=true, admin xử lý refund manual | BE |

---

## 8. VOUCHER — Quản lý khuyến mãi

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 8.1 | Tạo voucher PERCENTAGE | type=PERCENTAGE, value=20 | Voucher giảm 20% | Cả hai |
| 8.2 | PERCENTAGE > 100 | value=150 | "Phần trăm giảm giá không được vượt quá 100%" | Cả hai |
| 8.3 | FIXED_AMOUNT > minOrderAmount | fixed=100k, min=80k | "Giá trị giảm không được lớn hơn đơn tối thiểu" | Cả hai |
| 8.4 | maxDiscount > minOrderAmount | max=200k, min=100k | "Giảm tối đa không được lớn hơn đơn tối thiểu" | Cả hai |
| 8.5 | endDate < startDate | end < start | "Ngày kết thúc phải sau ngày bắt đầu" | Cả hai |
| 8.6 | Mã voucher trùng | code="SALE50" (đã có) | "Mã voucher đã tồn tại" | BE |
| 8.7 | Mã > 30 ký tự | code="a"x31 | "Tối đa 30 ký tự" | Cả hai |
| 8.8 | usageLimit = 0 | limit=0 | Không giới hạn lượt dùng | BE |
| 8.9 | usageLimit = null | limit=null | Không giới hạn lượt dùng | BE |
| 8.10 | Input PERCENTAGE → suffix "%" | discountType=PERCENTAGE | Ô nhập hiện suffix "%" thay "đ" | FE |
| 8.11 | Input FIXED → PriceInput "đ" | discountType=FIXED_AMOUNT | Ô nhập format "50.000đ" | FE |
| 8.12 | startDate/endDate required | Để trống | "Ngày bắt đầu là bắt buộc" | Cả hai |
| 8.13 | SUPER_ADMIN xem list → có cột "Phạm vi" | login super_admin | Hiện cột Phạm vi với badge GLOBAL/THEATER | FE |
| 8.14 | BRANCH_ADMIN xem list → KHÔNG cột "Phạm vi" | login admin.hn | Cột Phạm vi ẩn (admin đã ở scope CN mình) | FE |
| 8.15 | SUPER_ADMIN filter scope | Filter drawer | Hiện option Phạm vi GLOBAL/THEATER | FE |
| 8.16 | BRANCH_ADMIN filter scope | Filter drawer | Option Phạm vi ẩn | FE |
| 8.17 | BRANCH_ADMIN click voucher GLOBAL | code GLOBAL có icon Lock | Toast "Voucher toàn hệ thống chỉ SUPER_ADMIN sửa được", dialog KHÔNG mở | FE |
| 8.18 | BRANCH_ADMIN click voucher THEATER mình | code voucher của CN | Dialog edit mở bình thường | Cả hai |
| 8.19 | SUPER_ADMIN sửa voucher GLOBAL | login super | Dialog mở, sửa được | Cả hai |
| 8.20 | Voucher GLOBAL hiện cho BRANCH_ADMIN | Auto-scope filter | Vẫn thấy GLOBAL voucher trong list (apply cho CN) nhưng read-only | Cả hai |

---

## 9. SNACK — Quản lý đồ ăn

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 9.1 | Tạo đồ ăn | name, price, category | Đồ ăn mới, default available=true | Cả hai |
| 9.2 | Tên trống | name="" | "Tên là bắt buộc" | Cả hai |
| 9.3 | Tên > 100 ký tự | name="a"x101 | "Tối đa 100 ký tự" | Cả hai |
| 9.4 | Giá = 0 | price=0 | "Giá phải > 0" (FE) | FE |
| 9.5 | Danh mục là select | Mở form | 4 option: Bắp rang, Nước uống, Combo, Khác | FE |
| 9.6 | Upload ảnh = action riêng | Click icon Upload trên table | Chọn file → lưu Cloudinary ngay | FE |
| 9.7 | Danh mục badge có icon | Bắp rang | Icon Popcorn + badge vàng gold | FE |
| 9.8 | Trim name khi tạo | name="  Bắp Bơ  " | Lưu thành "Bắp Bơ" | BE |
| 9.9 | Reject all-space name | name="   " | "Tên đồ ăn không được rỗng" | BE |
| 9.10 | Case-insensitive duplicate | name="bắp bơ" khi đã có "Bắp Bơ" | "Đồ ăn 'bắp bơ' đã tồn tại trong chi nhánh này" | BE |
| 9.11 | Update đổi theaterId | PUT với theaterId khác | "Không thể đổi chi nhánh của đồ ăn" | BE |
| 9.12 | Xoá snack có combo ACTIVE dùng | Bắp Bơ đang trong 2 combo ACTIVE | "Đồ ăn 'Bắp Bơ' đang được 2 combo sử dụng. Hãy gỡ khỏi combo hoặc archive combo trước" | BE |
| 9.13 | Bulk delete fail-fast | 3 snack, 1 đang trong combo | Toàn bộ bulk fail | BE |

---

## 10. REVIEW — Đánh giá phim

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 10.1 | Tạo review thành công | rating=8, comment="Hay" | Review hiện trong list | Cả hai |
| 10.2 | Rating trống (0 sao) | rating=0 | Nút Gửi disabled | FE |
| 10.3 | Rating ngoài 1-10 | rating=11 | "Điểm tối đa là 10" | BE |
| 10.4 | Comment > 1000 ký tự | comment quá dài | "Bình luận tối đa 1000 ký tự" + counter | Cả hai |
| 10.5 | User đã review phim này | Tạo lại | "Bạn đã đánh giá phim này" | BE |
| 10.6 | Xóa review → tạo lại | Delete → Create | OK (unique constraint đã bỏ) | BE |
| 10.7 | Xóa review cuối → rating null | Xóa review duy nhất | movie.rating = null (không NPE) | BE |
| 10.8 | Chỉ chủ review mới xóa được | User A xóa review User B | "Không có quyền" (trừ admin) | BE |
| 10.9 | Guest không thấy form review | Chưa login | Form ẩn, chỉ hiện list | FE |

---

## 11. USER — Quản lý người dùng (Admin)

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 11.1 | Chỉnh sửa user thành công | fullName, phone, role, enabled | Cập nhật đúng | Cả hai |
| 11.2 | Disable user → không login được | enabled=false | Login → "Tài khoản đã bị khóa" | BE |
| 11.3 | Admin disable chính mình | Admin edit chính mình | "Không thể chỉnh sửa tài khoản của chính mình" | BE |
| 11.4 | Admin đổi role chính mình | Admin đổi role mình | "Không thể thay đổi vai trò của chính mình" | BE |
| 11.5 | Phone sai format | phone="abc" | "Số điện thoại không hợp lệ" | BE |
| 11.6 | Phone hợp lệ (0 hoặc +84) | phone="0901234567" / "+84901234567" | OK | Cả hai |
| 11.7 | Toggle enabled switch | Bật/tắt toggle | Hiện mô tả "Tài khoản bị khóa sẽ không thể đăng nhập" | FE |
| 11.8 | Disable SUPER_ADMIN cuối cùng | Hệ thống chỉ có 1 super_admin enabled, set enabled=false | "Không thể vô hiệu hoá SUPER_ADMIN cuối cùng. Hãy thăng cấp 1 user khác lên SUPER_ADMIN trước" | BE |
| 11.9 | Demote SUPER_ADMIN cuối cùng | Chỉ 1 super, đổi role ADMIN | "Không thể đổi vai trò SUPER_ADMIN cuối cùng..." | BE |
| 11.10 | Disable super khi còn super khác | 2 super enabled, disable 1 | OK | BE |
| 11.11 | Demote super khi còn super khác | 2 super, demote 1 thành USER | OK | BE |
| 11.12 | Promote user → SUPER_ADMIN | role USER → SUPER_ADMIN | OK, theaterId tự null | BE |

### Money Flow Critical Fixes

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| MF.1 | Voucher return khi payment FAIL | User hold seats + voucher SUMMER50 (usedCount+1) → payment FAIL callback | Booking CANCELLED + voucher.usedCount -1 + VoucherUsage entry deleted (khách dùng lại được voucher) | BE |
| MF.2 | Voucher giữ nguyên khi payment SUCCESS | Payment COMPLETED | usedCount giữ nguyên (đúng — đã consume vì có vé) | BE |
| MF.3 | Voucher return khi booking expire (HOLDING timeout) | Booking HOLDING > 10 phút → BookingCleanupScheduler | Voucher returned, seats released | BE |
| MF.4 | Voucher return khi user cancel CONFIRMED | User cancel booking đã pay | Booking CANCELLED + payment REFUNDED + voucher returned + seats AVAILABLE + email | BE |
| MF.5 | Cancel showtime SCHEDULED → cascade refund | POST /showtimes/{id}/cancel với showtime có 10 vé CONFIRMED | Showtime CANCELLED, 10 booking CANCELLED, 10 payment REFUNDED, 10 voucher returned (nếu có), 10 email gửi đi, WebSocket broadcast | BE |
| MF.6 | Cancel showtime ONGOING | Suất đang chiếu (force majeure) | OK, cascade refund | BE |
| MF.7 | Cancel showtime FINISHED | Suất đã chiếu xong | "Suất chiếu đã ở trạng thái FINISHED — không thể huỷ thêm" | BE |
| MF.8 | Cancel showtime CANCELLED | Idempotent | "Suất chiếu đã ở trạng thái CANCELLED — không thể huỷ thêm" | BE |
| MF.9 | Cancel showtime với 0 booking | Suất rỗng cancel | OK, cancelledBookings=0 | BE |
| MF.10 | Reason mặc định nếu body null | POST /cancel không có body | reason="Suất chiếu bị huỷ" default | BE |
| MF.11 | Check-in vé suất đã CANCELLED (sau cascade) | Khách đến trễ scan vé | "Suất chiếu đã bị huỷ" (case 6.2.10) | BE |
| MF.12 | RBAC BRANCH_ADMIN cancel showtime CN khác | admin.hn cancel showtime HCM | 403 Forbidden | BE |
| MF.13 | Pessimistic lock race: callback vs user cancel | 2 thread cùng lúc: callback COMPLETED + user cancel | Lock force serialize, thread thứ 2 đợi commit → đọc đúng status mới, không inconsistent | BE |
| MF.14 | NO_SHOW count tăng | Booking CONFIRMED qua endTime + 30 phút | user.noShowCount += 1, booking.status = NO_SHOW | BE |
| MF.15 | NO_SHOW block khách sau 3 lần | user.noShowCount = 3 | user.blockedUntil = now + 7 days (config) | BE |
| MF.16 | User blocked không hold seats được | user.blockedUntil > now → POST /bookings | "Tài khoản bị tạm khoá đặt vé đến {datetime} do nhiều lần không đến xem phim (NO_SHOW)" | BE |
| MF.17 | User blocked đã hết hạn | user.blockedUntil < now | Hold OK | BE |
| MF.18 | Manual refund admin | POST /admin/payments/{id}/refund payment COMPLETED | Refund triggered, payment status = REFUNDED, needsRefund=false | BE |
| MF.19 | Manual refund payment PENDING | Payment chưa COMPLETED | "Chỉ có thể refund payment ở trạng thái COMPLETED" | BE |
| MF.20 | Manual refund BRANCH_ADMIN cross-CN | admin.hn refund payment HCM | 403 Forbidden | BE |
| MF.21 | Manual refund reason default | Body null | reason="Manual refund by admin" | BE |
| MF.22 | NoShowScheduler counter-sale skip | Booking POS (user=null) | Skip user update, vẫn mark NO_SHOW booking | BE |

### Industry UX Features (Phase 2)

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| UX.1 | Payment retry sau FAIL | createPayment lần 2 với booking có payment FAILED cũ | Update record cũ với transactionCode mới + status PENDING, không tạo row mới | BE |
| UX.2 | Payment retry sau REFUNDED | createPayment lần 2 với booking REFUNDED | OK retry (status REFUNDED cho phép) | BE |
| UX.3 | Payment retry block PENDING | createPayment khi đã có payment PENDING | "Đơn đặt vé này đã có thanh toán đang xử lý" | BE |
| UX.4 | Payment retry block COMPLETED | createPayment khi đã có payment COMPLETED | "Đơn đặt vé này đã có thanh toán đã hoàn tất" | BE |
| UX.5 | Payment FAIL không cancel booking | MoMo callback FAIL | Payment FAILED, booking VẪN HOLDING, voucher giữ nguyên (cleanup scheduler sẽ expire sau 10 phút) | BE |
| UX.6 | Payment FAIL → retry → SUCCESS | FAIL MoMo → retry CASH → callback SUCCESS | Booking CONFIRMED, payment COMPLETED, voucher consumed đúng 1 lần | BE |
| UX.7 | NO_SHOW warning email 2/3 strike | user.noShowCount = 2 (threshold=3) | Email "Cảnh báo: bạn đã không đến xem phim 2 lần. Còn 1 lần sẽ bị khoá 7 ngày" | BE |
| UX.8 | NO_SHOW warning email không gửi nếu count < threshold-1 | user.noShowCount = 1 | Không gửi email | BE |
| UX.9 | NO_SHOW block không gửi warning | user.noShowCount = 3 (threshold) | Set blockedUntil, KHÔNG gửi warning email (đã quá muộn, không cần warn) | BE |
| UX.10 | ShowtimeReminderScheduler 1h trước | Booking CONFIRMED có showtime trong [now+60min, now+75min] | Email "Suất chiếu sắp đến — còn 1 giờ", bao gồm mã vé + phòng + rạp | BE |
| UX.11 | ShowtimeReminder skip CANCELLED showtime | Showtime CANCELLED trong window | Không gửi (đã cancel rồi) | BE |
| UX.12 | ShowtimeReminder skip counter-sale | Booking POS (user=null hoặc email=null) | Skip, không crash | BE |
| UX.13 | ShowtimeReminder window 15 phút | Scheduler chạy mỗi 15 phút | Mỗi booking gửi đúng 1 lần (window khớp fixedRate) | BE |
| UX.14 | Email infra @Async | Email không block transaction | sendNoShowWarningEmail chạy async thread riêng | BE |

### POS Snack — 16.x bổ sung

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 16.10 | Quantity > 100 mỗi item | quantity=101 | "Số lượng tối đa 100 mỗi item (anti-spam/DoS)" | BE |
| 16.11 | Quantity = 100 (boundary) | quantity=100 | OK | BE |
| 16.12 | Quantity = 1 (boundary min) | quantity=1 | OK | BE |

### System Config — 22.x bổ sung

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 22.5 | BRANCH_ADMIN truy cập config | login admin.hn, GET /configs | 403 Forbidden (chỉ SUPER_ADMIN) | BE |
| 22.6 | BRANCH_ADMIN update config | PUT /configs/{key} với BRANCH_ADMIN token | 403 Forbidden | BE |
| 22.7 | SUPER_ADMIN update config có audit log | PUT booking.hold_minutes=15 | Audit log entry: action=UPDATE_SYSTEM_CONFIG, entityType=SystemConfig, userId | BE |
| 22.8 | SUPER_ADMIN list configs | GET /configs với super token | 200 OK trả list | BE |

---

## 12. NOTIFICATION — Thông báo

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 12.1 | Thanh toán → tạo notification | Payment completed | Notification "Thanh toán thành công" | BE |
| 12.2 | Bell icon hiện unread count | 3 thông báo chưa đọc | Badge đỏ "3" trên bell | FE |
| 12.3 | Click notification → đánh dấu đã đọc | Click 1 notification | Dot vàng biến mất | FE |
| 12.4 | Đọc tất cả | Click "Đọc tất cả" | Tất cả hết dot vàng, badge biến mất | FE |
| 12.5 | Ownership check | User A đọc notification User B | "Không có quyền truy cập thông báo này" | BE |

---

## 13. PROFILE — Hồ sơ cá nhân

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 13.1 | Cập nhật họ tên | fullName="Nguyễn Văn A" | Cập nhật thành công | Cả hai |
| 13.2 | Upload avatar | Chọn ảnh JPG | Avatar hiện trên Header + Profile | Cả hai |
| 13.3 | Upload avatar → Header cập nhật ngay | Upload xong | authStore.updateUser({ avatarUrl }) | FE |
| 13.4 | Phone format +84 | phone="+84901234567" | OK (BE regex cho phép) | Cả hai |

---

## 14. UI / UX CHUNG

### 14.1 Design System

| # | Test Case | Expected |
|---|-----------|----------|
| 14.1.1 | Không có class `bg-gray-950/900/800`, `text-amber-*`, `bg-amber-*` | 0 class cũ |
| 14.1.2 | Input/Textarea default dark theme | `bg-[#0d2137] border-white/10 text-white focus:ring-[#eab308]` |
| 14.1.3 | Dialog default dark | `bg-[#0a1929] border-white/5 text-white rounded-xl` |
| 14.1.4 | Form grid 12 cột | col-span-12 (full), col-span-6 (half), col-span-4 (1/3) |
| 14.1.5 | Required field có dấu `*` đỏ | Tất cả label required có `<span className="text-red-400">*</span>` |
| 14.1.6 | PriceInput format | Nhập 100000 → hiện "100.000đ" |
| 14.1.7 | Number input chặn "e", "-", "+" | Gõ e/E/+/- → không nhập được |
| 14.1.8 | Date format fmtDate | "21/05/2026" |
| 14.1.9 | DateTime format fmtDateTime | "23:47 21/05/2026" |

### 14.2 Table

| # | Test Case | Expected |
|---|-----------|----------|
| 14.2.1 | Scroll ngang | Bảng quá rộng → cuộn được |
| 14.2.2 | Sticky cột đầu | Checkbox + tên cố định khi scroll |
| 14.2.3 | Sticky hover | Cột sticky đổi màu khi hover hàng (group-hover) |
| 14.2.4 | Empty state | Bảng trống → "Không có dữ liệu" |
| 14.2.5 | Sort mới nhất đầu | Tạo mới → hiện đầu danh sách (createdAt DESC) |
| 14.2.6 | Hover row | hover:bg-white/5 trên tất cả body rows |

### 14.3 Admin Layout

| # | Test Case | Expected |
|---|-----------|----------|
| 14.3.1 | Breadcrumb clickable | Click "Phòng chiếu" → quay lại /admin/rooms |
| 14.3.2 | Breadcrumb 3 cấp | Sơ đồ ghế: "Bảng điều khiển / Phòng chiếu / Sơ đồ ghế" |
| 14.3.3 | Sidebar collapse | Click chevron → sidebar thu nhỏ, tooltip hiện khi hover |
| 14.3.4 | Avatar dropdown | Click avatar → dropdown: Trang chủ, Hồ sơ, Vé, Yêu thích, Đăng xuất |
| 14.3.5 | Dashboard loading skeleton | Khi fetch → 4 card animate-pulse |
| 14.3.6 | Dashboard date filter | 7 ngày / 14 ngày / 30 ngày + date picker tự do |
| 14.3.7 | StatusDropdown | 1 nút "Trạng thái" → dropdown Lưu trữ (cam) + Khôi phục (xanh) |

### 14.4 Guest Experience

| # | Test Case | Expected |
|---|-----------|----------|
| 14.4.1 | Header guest | Nút "Đăng nhập" (outline vàng) + "Đăng ký" (solid vàng) |
| 14.4.2 | Guest click Đặt vé | LoginPromptModal hiện lên |
| 14.4.3 | HomePage guest sections | Banner thành viên + Trải nghiệm điện ảnh (chỉ guest) |
| 14.4.4 | MovieListPage tabs | "Đang chiếu" / "Sắp chiếu" tabs + URL sync |

---

## 15. EMAIL

| # | Test Case | Expected |
|---|-----------|----------|
| 15.1 | Email reset password | Gửi đến Mailtrap, có link + nút CTA |
| 15.2 | Email xác nhận vé | Gửi đến Mailtrap, có QR code inline + thông tin vé |
| 15.3 | QR code trong email | Ảnh QR 200x200 render đúng trong email client |

---

## 16. POS — Bán đồ ăn tại quầy

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 16.1 | Tạo đơn POS thành công | 2 bắp rang + 1 coca | SnackOrder tạo, orderCode sinh tự động | Cả hai |
| 16.2 | Giỏ hàng trống | Ấn Xác nhận khi giỏ trống | Nút Xác nhận disabled | FE |
| 16.3 | Tăng/giảm số lượng | Click +/- trên item | Số lượng thay đổi, tổng tiền cập nhật | FE |
| 16.4 | Xóa item khỏi giỏ | Click icon xóa | Item biến mất, tổng tiền giảm | FE |
| 16.5 | Giá snapshot tại thời điểm đặt | Admin đổi giá snack SAU khi đặt | Đơn cũ vẫn giữ giá cũ (Price Snapshot) | BE |
| 16.6 | Hiển thị snack available | Snack available=false | Không hiện trong grid POS | FE |
| 16.7 | Tổng tiền tính đúng | 2×50.000 + 1×30.000 | totalAmount = 130.000đ | Cả hai |
| 16.8 | Đơn hàng vừa tạo hiện đầu danh sách | Tạo đơn mới | Đơn mới nằm đầu trang Admin Orders | FE |

---

## 17. STATISTICS — Thống kê Dashboard

### 17.1 Overview (Tổng quan)

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 17.1.1 | Booking hôm nay | Có 6 booking CONFIRMED hôm nay | Card hiện "6" | Cả hai |
| 17.1.2 | Doanh thu vé hôm nay | Payment COMPLETED hôm nay tổng 2.5M | Card hiện "2.500.000đ" | Cả hai |
| 17.1.3 | Doanh thu snack hôm nay | SnackOrder hôm nay tổng 400K | Card hiện "400.000đ" | Cả hai |
| 17.1.4 | Tổng user/phim/phòng | 11 user, 29 phim, 4 phòng | Card hiện đúng | Cả hai |
| 17.1.5 | Không tính booking CANCELLED | Có booking CANCELLED hôm nay | Không tính vào todayBookings | BE |
| 17.1.6 | Không tính booking EXPIRED | Hold hết hạn | Không tính vào todayBookings | BE |
| 17.1.7 | Không tính snack order ARCHIVED | Đơn bị xóa mềm | Không tính vào todaySnackRevenue | BE |

### 17.2 Thống kê phim + đồ ăn (theo khoảng thời gian)

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 17.2.1 | Filter 7 ngày | Chọn "7 ngày" | Hiện phim/snack bán trong 7 ngày gần nhất | Cả hai |
| 17.2.2 | Filter 30 ngày | Chọn "30 ngày" | Hiện phim/snack bán trong 30 ngày | Cả hai |
| 17.2.3 | Filter ngày tùy chọn | from=20/05, to=25/05 | Chỉ hiện dữ liệu trong khoảng 20-25/05 | Cả hai |
| 17.2.4 | Filter ngày tương lai | from=28/05, to=29/05 | Bảng trống "Chưa có dữ liệu" | Cả hai |
| 17.2.5 | Không tính vé CANCELLED | Booking bị hủy | ticketCount không tính vé đã hủy | BE |
| 17.2.6 | Hiển thị toàn bộ (không limit 5) | 7 phim có dữ liệu | Hiện đủ 7 phim, title "Thống kê phim (7)" | FE |
| 17.2.7 | Sắp xếp theo số vé giảm dần | Phim A: 13 vé, Phim B: 11 vé | Phim A hiện trước Phim B | BE |
| 17.2.8 | Doanh thu tính đúng | 13 vé × 100K = 1.3M | revenue hiện "1.300.000đ" | Cả hai |

### 17.3 Biểu đồ doanh thu

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 17.3.1 | Biểu đồ theo filter | Chọn 7 ngày | Biểu đồ hiện 7 ngày doanh thu | Cả hai |
| 17.3.2 | Ngày không có doanh thu | 26/05 không có payment | Ngày đó không hiện trên chart (gap) | BE |
| 17.3.3 | Hover tooltip | Hover lên điểm dữ liệu | Hiện ngày + doanh thu format "1.500.000đ" | FE |
| 17.3.4 | Khoảng trống | Không có data | "Chưa có dữ liệu trong khoảng thời gian này" | FE |

### 17.4 Tỉ lệ lấp đầy ghế (Occupancy)

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 17.4.1 | Occupancy đúng | 80 ghế, 8 booked | Rate = 10.0% | BE |
| 17.4.2 | Không tính ghế booking CANCELLED | 10 ghế booked, 2 cancelled | Rate = (10-2)/80 = 10.0% | BE |
| 17.4.3 | Suất chưa có ai đặt | 0 booked | Rate = 0.0% | BE |

---

## 18. EXPORT — Xuất báo cáo PDF / Excel

### 18.1 Xuất PDF

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 18.1.1 | Xuất PDF có dữ liệu | Có phim + snack | 1 file PDF, 2 bảng (phim + đồ ăn) | FE |
| 18.1.2 | Xuất PDF chỉ có phim | Có phim, snack trống | 1 file PDF, 1 bảng (phim) | FE |
| 18.1.3 | Xuất PDF không có dữ liệu | Filter ngày tương lai | Toast đỏ "Không có dữ liệu để xuất" | FE |
| 18.1.4 | Tiếng Việt đúng dấu | Title "Báo cáo thống kê" | Hiển thị đầy đủ dấu (ă, ê, ơ, ư, đ) | FE |
| 18.1.5 | Header bảng in đậm | Cột "#, Tên, Số lượng, Doanh thu" | Font Roboto Bold, nền vàng gold | FE |
| 18.1.6 | Footer trang | PDF nhiều trang | Mỗi trang có "CineX — Trang 1/2" | FE |
| 18.1.7 | Tự động phân trang | Dữ liệu quá dài | Bảng tự xuống trang mới | FE |
| 18.1.8 | Subtitle hiện khoảng thời gian | Filter 20/05 - 27/05 | "Khoảng thời gian: 2026-05-20 đến 2026-05-27" | FE |
| 18.1.9 | Doanh thu format đúng | revenue=1500000 | Hiện "1.500.000đ" trong PDF | FE |

### 18.2 Xuất Excel

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 18.2.1 | Xuất Excel có dữ liệu | Có phim + snack | 1 file .xlsx, 2 sections | FE |
| 18.2.2 | Xuất Excel không có dữ liệu | Filter ngày tương lai | Toast đỏ "Không có dữ liệu để xuất" | FE |
| 18.2.3 | Title merge cells | Hàng đầu tiên | Title trải dài toàn bộ cột | FE |
| 18.2.4 | Section label merge | "Thống kê phim" | Label trải dài toàn bộ cột, ngăn cách 2 bảng | FE |
| 18.2.5 | Auto column width | Tên phim dài | Cột tự giãn theo nội dung | FE |
| 18.2.6 | Sheet name max 31 ký tự | Title dài | Tự cắt ≤ 31 ký tự (giới hạn Excel) | FE |
| 18.2.7 | Doanh thu format | revenue=1500000 | Hiện "1.500.000đ" | FE |
| 18.2.8 | Toast thành công | Xuất xong | Toast xanh "Xuất Excel thành công" | FE |

---

## 19. FAVORITE — Yêu thích phim

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 19.1 | Thêm yêu thích | Click icon tim trên MovieDetail | Tim đổi màu đỏ, toast "Đã thêm vào yêu thích" | Cả hai |
| 19.2 | Bỏ yêu thích | Click icon tim lần nữa | Tim trở về outline, toast "Đã bỏ yêu thích" | Cả hai |
| 19.3 | Trang Yêu thích | Vào /favorites | Hiện danh sách phim đã yêu thích | FE |
| 19.4 | Guest click yêu thích | Chưa login → click tim | Hiện LoginPromptModal | FE |
| 19.5 | Duplicate favorite | Gọi API thêm 2 lần cùng phim | Lần 2 trả lỗi hoặc bỏ qua | BE |

---

## 20. HỦY VÉ — Cancel Booking

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 20.1 | Hủy vé thành công | CONFIRMED + trước giờ chiếu > 1h | Booking CANCELLED, ghế trả lại | Cả hai |
| 20.2 | Hủy vé sát giờ chiếu | Trước giờ chiếu < 1h | Nút "Hủy vé" không hiện | FE |
| 20.3 | Hủy vé đã CHECK_IN | Vé đã check-in | "Không thể hủy vé đã check-in" | BE |
| 20.4 | Hủy vé có voucher | Booking dùng voucher SALE50 | usedCount giảm 1, voucher có thể dùng lại | BE |
| 20.5 | Email thông báo hủy | Hủy thành công | Gửi email xác nhận hủy đến Mailtrap | BE |
| 20.6 | WebSocket cập nhật ghế | User A hủy vé ghế B3, B4 | User B thấy ghế B3, B4 đổi về trống real-time | Cả hai |
| 20.7 | ConfirmDialog trước hủy | Click "Hủy vé" | Hiện dialog "Bạn có chắc muốn hủy vé này không?" | FE |
| 20.8 | Redirect sau hủy | Hủy xong | Redirect về /my-tickets | FE |

---

## 21. SHOWTIME — Buffer và trùng giờ

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 21.1 | Buffer 15 phút tự thêm | Phim 90 phút, chiếu 10:00 | endTime = 11:45 (90 + 15 buffer) | BE |
| 21.2 | Tạo suất trùng giờ | Phòng 01: 10:00-11:45, tạo mới 11:00 | "Phòng đã có suất chiếu trong khung giờ này" | BE |
| 21.3 | Tạo suất ngay sau buffer | Phòng 01: 10:00-11:45, tạo mới 11:45 | OK — không trùng (11:45 ≥ 11:45 kết thúc) | BE |
| 21.4 | Tạo suất xen giữa | Phòng 01: 10:00-11:45 và 14:00-15:45 | Tạo 12:00 → OK, tạo 11:30 → TRÙNG | BE |
| 21.5 | Sửa suất không trùng chính nó | Sửa suất 10:00 thành 10:15 | OK — loại trừ chính nó khi check conflict | BE |
| 21.6 | Buffer config động | Admin đổi showtime.buffer_minutes = 20 | Suất tiếp theo cần cách 20 phút | BE |
| 21.7 | 2 phòng khác nhau cùng giờ | Phòng 01: 10:00, Phòng 02: 10:00 | OK — khác phòng không conflict | BE |
| 21.8 | Suất chiếu trong quá khứ | startTime < now | "Không thể tạo suất chiếu trong quá khứ" | BE |
| 21.9 | Suất chiếu ARCHIVED không conflict | Suất cũ ARCHIVED 10:00-11:45, tạo mới 10:30 | OK — suất ARCHIVED không tính | BE |

---

## 22. SYSTEM CONFIG — Cấu hình hệ thống

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 22.1 | Đọc config từ cache | Gọi liên tục getInt("booking.max_seats") | Lần 1 đọc DB, lần 2+ đọc Redis cache | BE |
| 22.2 | Admin thay đổi config | Đổi booking.max_seats = 10 | Cache bị invalidate, giá trị mới = 10 | BE |
| 22.3 | Config default | Key chưa tồn tại | Trả giá trị default (VD: 8 cho max_seats) | BE |
| 22.4 | Config danh sách | GET /api/config | Trả tất cả key-value | BE (Admin) |

---

## 23. SECURITY — Bảo mật

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 23.1 | Access token hết hạn (15 phút) | Gọi API sau 15 phút | 401, FE tự gọi refresh token | Cả hai |
| 23.2 | Refresh token hợp lệ | POST /api/auth/refresh | Trả accessToken mới | BE |
| 23.3 | Refresh token hết hạn (7 ngày) | Sau 7 ngày | 401, redirect về login | Cả hai |
| 23.4 | User truy cập API Admin | GET /api/statistics (role=USER) | 403 Forbidden | BE |
| 23.5 | CORS từ domain lạ | Origin: evil.com | CORS blocked | BE |
| 23.6 | CORS từ localhost:5173 | Origin: localhost:5173 | OK | BE |
| 23.7 | API không cần auth | GET /api/movies | OK (không cần token) | BE |
| 23.8 | API cần auth | POST /api/bookings (không có token) | 401 Unauthorized | BE |
| 23.9 | JWT giả mạo | Token ký bằng key khác | 401 Unauthorized | BE |

---

---

## 24. THEATER — Quản lý chi nhánh (multi-tenant)

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 24.1 | Tạo theater | code=CNX-HN-VINCOM, name="CineX Vincom HN" | 201, hiển thị trong list | Cả hai |
| 24.2 | SUPER_ADMIN tạo theater | role=SUPER_ADMIN | OK | BE |
| 24.3 | BRANCH_ADMIN tạo theater | role=BRANCH_ADMIN | 403 Forbidden | BE |
| 24.4 | BRANCH_ADMIN xem theater khác | theater A token, GET /theaters/{B}/rooms | 403 — scope guard | BE |
| 24.5 | BRANCH_ADMIN xem theater của mình | theater A token, GET /theaters/{A}/rooms | OK | BE |
| 24.6 | SUPER_ADMIN xem mọi theater | role=SUPER_ADMIN, GET /theaters/{X}/rooms | OK với mọi X | BE |
| 24.7 | counter-sale theater scope | BRANCH_ADMIN A book showtimeId của theater B | 403 — derive showtime theater + check scope | BE |
| 24.8 | Trùng code theater | INSERT trùng code đã có ACTIVE | 400, unique constraint | BE |
| 24.9 | Soft delete theater còn rooms | Theater có active rooms → DELETE | "Không thể xoá chi nhánh đang có N phòng hoạt động" | BE |
| 24.10 | Soft delete theater còn showtime active | Theater có suất SCHEDULED/ONGOING | "Không thể xoá chi nhánh đang có N suất chiếu lên lịch hoặc đang chiếu" | BE |
| 24.11 | Soft delete theater còn booking active | Theater có booking HOLDING/CONFIRMED | "Không thể xoá chi nhánh đang có N vé giữ hoặc đã thanh toán" | BE |
| 24.12 | Hotline format đúng 1900xxx | hotline="1900123456" | OK | BE |
| 24.13 | Hotline format đúng 0xxx | hotline="0901234567" | OK | BE |
| 24.14 | Hotline rỗng (optional) | hotline="" | OK | BE |
| 24.15 | Hotline format sai | hotline="abc-123" hoặc "12345" | "Hotline phải dạng 1900xxxxxx hoặc 0xxxxxxxxx" | BE |
| 24.16 | Email format sai | email="abc@@def" | "Email không hợp lệ" | BE |
| 24.17 | Lat ngoài range | latitude=91.0 | "Vĩ độ phải từ -90 đến 90" | BE |
| 24.18 | Long ngoài range | longitude=181.0 | "Kinh độ phải từ -180 đến 180" | BE |
| 24.19 | Lat boundary | latitude=-90.0 hoặc 90.0 | OK | BE |
| 24.20 | Long boundary | longitude=-180.0 hoặc 180.0 | OK | BE |

### Room — 4.x bổ sung

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 4.20 | Trim name khi tạo | name="  Phòng 1  " | Lưu thành "Phòng 1" | BE |
| 4.21 | Reject all-space name | name="   " | "Tên phòng không được rỗng" | BE |
| 4.22 | Case-insensitive duplicate | name="phòng 1" khi đã có "Phòng 1" | "Phòng 'phòng 1' đã tồn tại trong chi nhánh này" | BE |
| 4.23 | Xoá phòng có booking active | Phòng có booking HOLDING/CONFIRMED | "Không thể xoá phòng đang có vé khách giữ hoặc đã thanh toán" | BE |
| 4.24 | Tạo showtime ở phòng MAINTENANCE | room.status=MAINTENANCE | "Phòng 'X' đang bảo trì — không thể tạo suất chiếu" | BE |
| 4.25 | Tạo showtime ở phòng INACTIVE | room.status=INACTIVE | "Phòng 'X' đang đóng — không thể tạo suất chiếu" | BE |
| 4.26 | totalSeats không cho admin set | POST /rooms với totalSeats=999 | Lưu thành 0, admin gen seat sau mới có số thật | BE |

---

## 25. MOVIE RUN — Đợt chiếu per-theater

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 25.1 | Tạo MovieRun FIRST_RUN | movieId=7, theaterId=1, start=01/06, end=31/07 | 201, status=SCHEDULED | BE |
| 25.2 | Status compute today < start | endDate=NULL, today < start | COMING_SOON | BE |
| 25.3 | Status compute trong range | start ≤ today ≤ end | NOW_SHOWING | BE |
| 25.4 | Status compute today > end | endDate != NULL, today > end | ENDED | BE |
| 25.5 | endDate NULL + today >= start | endDate=NULL, today >= start | NOW_SHOWING vĩnh viễn | BE |
| 25.6 | Tạo showtime ngoài range MovieRun | start=05/08, run end=31/07 | 400 "Đợt chiếu không bao trùm" | BE |
| 25.7 | Tạo REISSUE cho phim đã FIRST_RUN | Movie có #201 FIRST_RUN ENDED → tạo #401 REISSUE | 201, FIRST_RUN không touched | BE |
| 25.8 | Cross-theater status độc lập | Phim X ENDED tại HN, NOW_SHOWING tại SG | Trang chủ HN không hiện, SG hiện | Cả hai |
| 25.9 | MovieRunStatusScheduler 00:01 | run start=hôm nay | Tự update SCHEDULED → NOW_SHOWING | BE |
| 25.10 | Distributor reporting per-run | SUM bookings WHERE movie_run_id=201 | Doanh thu đúng đợt | BE |

---

## 26. PRICING RULES — Quy tắc giá động

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 26.1 | Tạo rule MORNING_DISCOUNT | HOUR_RANGE 8h-12h, multiplier 80 | 201, active | Cả hai |
| 26.2 | Áp rule giảm cho showtime 10h | basePrice=100k, áp rule 80% | effectivePrice=80k | BE |
| 26.3 | Áp 2 rule chain | basePrice=100k, MORNING 80% + STUDENT 90% | effectivePrice=72k | BE |
| 26.4 | Global rule áp mọi theater | theater_id=NULL, code=WEEKEND | Theater A,B,C đều áp | BE |
| 26.5 | Per-theater rule override global | code=WEEKEND global 120%, theater A 130% | Theater A áp 130%, theater B 120% | BE |
| 26.6 | Rule không match thời gian | showtime 14h, rule HOUR_RANGE 8-12 | Không áp | BE |
| 26.7 | FE hiển thị chip rule giảm | discountPercent=-20% | Chip xanh "-20%" | FE |
| 26.8 | FE ẨN chip rule tăng (surge) | discountPercent=+15% | KHÔNG hiển thị chip | FE |
| 26.9 | Gạch ngang giá gốc khi giảm | effective < base | basePrice gạch ngang | FE |
| 26.10 | Cache invalidation | Admin sửa rule, gọi pricingEngine.refresh() | Cache clear, giá mới ngay | BE |
| 26.11 | Schedule refresh 5 phút | Rule HOUR_RANGE 22h-24h, không có user activity | 22:01 tự reload, áp giá happy hour | BE |
| 26.12 | WYSIWYP end-to-end | Showtime price 100k FE, confirm payment | Charge đúng 100k | Cả hai |
| 26.13 | SUPER_ADMIN xem list → có cột "Phạm vi" | login super_admin | Hiện cột Phạm vi với badge GLOBAL/THEATER | FE |
| 26.14 | BRANCH_ADMIN xem list → KHÔNG cột "Phạm vi" | login admin.hn | Cột Phạm vi ẩn | FE |
| 26.15 | SUPER_ADMIN filter scope | Filter drawer | Hiện option Phạm vi | FE |
| 26.16 | BRANCH_ADMIN filter scope | Filter drawer | Option Phạm vi ẩn | FE |
| 26.17 | BRANCH_ADMIN click rule GLOBAL | code GLOBAL có icon Lock | Toast "Rule toàn hệ thống chỉ SUPER_ADMIN sửa được", dialog KHÔNG mở | FE |
| 26.18 | BRANCH_ADMIN click rule THEATER mình | code rule của CN | Dialog edit mở bình thường | Cả hai |
| 26.19 | SUPER_ADMIN sửa rule GLOBAL | login super | Dialog mở, sửa được | Cả hai |
| 26.20 | BE reject BRANCH_ADMIN update GLOBAL | API call manual với rule GLOBAL | 403 FORBIDDEN (defense in depth) | BE |

---

## 27. LOYALTY — Điểm thưởng

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 27.1 | Auto-create account khi register | User mới đăng ký | LoyaltyAccount tier=BRONZE, points=0 | BE |
| 27.2 | Earn points khi confirm booking | totalAmount=200k, tier BRONZE 1% | +2000 points | BE |
| 27.3 | Earn points cho GOLD tier | tier GOLD 1.5% rate, total=200k | +3000 points | BE |
| 27.4 | Lên tier khi đạt threshold | lifetime_points >= 50k (SILVER threshold) | Auto upgrade tier | BE |
| 27.5 | Redeem points → discount | redeem 1000 points = 10k discount | Trừ trong tổng booking | BE |
| 27.6 | Expire 12 tháng | Transaction EARN > 12 tháng | Scheduler tạo EXPIRE transaction | BE |
| 27.7 | LoyaltyExpirationScheduler chạy 00:30 | Cron job | Process mọi transaction quá hạn | BE |
| 27.8 | Earn không áp cho REJECTED booking | Booking status=REJECTED | Không cộng điểm | BE |
| 27.9 | Refund booking → revoke earn | Booking CANCELLED sau khi đã earn | Tạo ADJUST transaction âm | BE |
| 27.10 | History page user xem transaction | GET /api/loyalty/transactions | List EARN/REDEEM/EXPIRE | Cả hai |

---

## 28. COMBO — Combo bắp nước per-theater

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 28.1 | Tạo combo SOLO theater HN | 1 bắp + 1 coca, price=80k | 201 trong theater HN | BE |
| 28.2 | Combo per-theater isolation | Combo SOLO theater HN không xuất hiện trong list theater SG | OK | BE |
| 28.3 | Combo items khác theater (constraint) | combo theater HN, snack theater SG | Reject "Snack không thuộc theater combo" | BE |
| 28.4 | Snapshot combo price khi book | Combo 80k, sau đó admin sửa thành 90k | Booking cũ giữ 80k | BE |
| 28.5 | Tính tổng combo trong booking | 2 combo SOLO + 1 FAMILY | tổng = 2×80k + 210k = 370k | BE |
| 28.6 | Combo INACTIVE không hiện FE | combo.active=false | List user không hiện | FE |
| 28.7 | Admin Combo CRUD | Standard CRUD + filter | OK | Cả hai |
| 28.8 | Trim combo name | name="  Combo Family  " | Lưu thành "Combo Family" | BE |
| 28.9 | Reject all-space name | name="   " | "Tên combo không được rỗng" | BE |
| 28.10 | Case-insensitive duplicate name | name="combo family" khi đã có "Combo Family" | "Combo tên 'combo family' đã tồn tại trong chi nhánh này" | BE |
| 28.11 | Update đổi theaterId | PUT với theaterId khác | "Không thể đổi chi nhánh của combo" | BE |
| 28.12 | Combo bundle snack ARCHIVED | items có snack đã archive | "Snack 'X' đã archived — không thể đưa vào combo" | BE |
| 28.13 | Combo bundle snack unavailable | items có snack available=false | "Snack 'X' đang hết hàng (unavailable) — không thể đưa vào combo" | BE |

---

## 29. POS MULTI-PAYMENT — Đa phương thức tại quầy

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 29.1 | POS book bằng CASH | method=CASH, employee thu tiền | Booking CONFIRMED ngay, không qua gateway | BE |
| 29.2 | POS book bằng CARD_POS | method=CARD_POS, quẹt thẻ tại máy POS rạp | Booking CONFIRMED sau khi nhân viên xác nhận quẹt OK | BE |
| 29.3 | POS book bằng TRANSFER | method=TRANSFER, sinh QR ngân hàng | Booking CONFIRMED sau khi nhân viên check biên lai | BE |
| 29.4 | POS book bằng MOMO | method=MOMO, QR MoMo | Như user-facing flow | BE |
| 29.5 | POS dropdown 5 method | UI shows 5 option | OK | FE |
| 29.6 | CASH default cho POS | Mở dialog payment | CASH preselected | FE |
| 29.7 | BRANCH_ADMIN A book showtime của theater B | counter-sale endpoint | 403 theater scope | BE |
| 29.8 | POS book không có user (guest) | Customer info input by employee | Booking với customer snapshot, không link user | BE |
| 29.9 | POS check-in vé bán tại quầy | Scan QR | Preview → admit (nếu phim P/K) | Cả hai |
| 29.10 | POS reject T18 booking | Phim T18, customer trông trẻ | Bấm Reject → status=REJECTED + audit log | Cả hai |

---

## 30. VOUCHER — Mã giảm giá

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 30.1 | Tạo voucher PERCENTAGE | code=WELCOME20, value=20, max=50k | 201 | BE |
| 30.2 | Tạo voucher FIXED_AMOUNT | value=30000 | 201 | BE |
| 30.3 | Apply PERCENTAGE under cap | order=200k, 20% = 40k (< cap 50k) | discount=40k | BE |
| 30.4 | Apply PERCENTAGE hit cap | order=1M, 20% = 200k (> cap 50k) | discount=50k | BE |
| 30.5 | Apply FIXED_AMOUNT | order=200k, fixed=30k | discount=30k | BE |
| 30.6 | Min order amount không đạt | order=80k, min=100k | 400 "VOUCHER_MIN_ORDER_NOT_MET" | BE |
| 30.7 | Voucher chưa start | startDate=tomorrow | 400 "VOUCHER_NOT_STARTED" | BE |
| 30.8 | Voucher đã expire | endDate=yesterday | 400 "VOUCHER_EXPIRED" | BE |
| 30.9 | Usage limit reached | usedCount=usageLimit | 400 "VOUCHER_LIMIT_REACHED" | BE |
| 30.10 | User đã dùng | existsByVoucherIdAndUserId=true | 400 "VOUCHER_ALREADY_USED" | BE |
| 30.11 | Global voucher áp mọi theater | theater_id=NULL | Mọi rạp áp được | BE |
| 30.12 | Per-theater voucher | theater_id=1 | Chỉ rạp 1 áp | BE |
| 30.13 | Code global vs per-theater trùng | code=WELCOME global + WELCOME theater 1 | Cả 2 ACTIVE cùng lúc (filtered unique index) | BE |
| 30.14 | Concurrent use voucher 1 slot | 2 user đồng thời, limit=1 | 1 success, 1 fail OptimisticLockException | BE |
| 30.15 | VoucherCleanupScheduler 01:00 | Voucher endDate<now | Tự deactivate | BE |
| 30.16 | Validate trước confirm booking | POST /api/vouchers/validate | Trả discount + finalAmount preview | FE |

---

## 31. STAFF ROLE — Nhân viên quầy POS

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| ST.1 | Tạo user STAFF | POST /users role=STAFF, theaterId=1 | OK, user STAFF scope theater 1 | BE |
| ST.2 | STAFF không có theaterId | role=STAFF, theaterId=null | "STAFF phải được gán 1 chi nhánh" | BE |
| ST.3 | USER có theaterId | role=USER, theaterId=1 | "USER / SUPER_ADMIN không được gán chi nhánh" | BE |
| ST.4 | STAFF login → vào /admin | Login STAFF | OK qua canEnterAdminPanel guard | FE |
| ST.5 | STAFF chỉ thấy 4 menu | Login STAFF | Menu chỉ: Tổng quan, POS Đồ ăn, POS Bán vé, Quét vé | FE |
| ST.6 | STAFF KHÔNG thấy Phim/Phòng/Suất chiếu menu | Login STAFF | Menu ẩn (staffAllowed=false) | FE |
| ST.7 | STAFF gọi POS counter-sale | POST /bookings/counter-sale với STAFF token | OK (hierarchy hasRole STAFF) | BE |
| ST.8 | STAFF gọi POS snack-order | POST /snack-orders với STAFF token | OK | BE |
| ST.9 | STAFF gọi check-in | POST /bookings/check-in với STAFF token | OK | BE |
| ST.10 | STAFF gọi list bookings | GET /bookings (admin) với STAFF token | 403 (chỉ hasRole ADMIN trở lên) | BE |
| ST.11 | STAFF gọi update showtime | PUT /showtimes/{id} | 403 Forbidden | BE |
| ST.12 | STAFF gọi update room | PUT /rooms/{id} | 403 Forbidden | BE |
| ST.13 | STAFF gọi config | GET /configs | 403 Forbidden (SUPER_ADMIN only) | BE |
| ST.14 | STAFF scope theater | STAFF Hà Nội query suất | Filter override theaterId=HN, không thấy HCM | BE |
| ST.15 | STAFF POS sell cross-CN | STAFF HN counter-sale showtime của HCM | 403 requireAccessToTheater throw | BE |
| ST.16 | ADMIN xuống STAFF endpoint | ADMIN gọi /bookings/check-in | OK (role hierarchy: ADMIN > STAFF) | BE |
| ST.17 | SUPER_ADMIN xuống STAFF endpoint | SUPER_ADMIN gọi /snack-orders | OK | BE |
| ST.18 | Promote STAFF → ADMIN | PUT /users/{id} role STAFF→ADMIN | OK, theaterId giữ nguyên | BE |
| ST.19 | Demote ADMIN → STAFF | PUT /users/{id} role ADMIN→STAFF | OK (không phải SUPER_ADMIN cuối) | BE |
| ST.20 | Self-update role STAFF→ADMIN | STAFF tự update mình | "Không thể chỉnh sửa tài khoản của chính mình" | BE |

---

## 32. AGE RATING — 3-tier enforcement

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 31.1 | Phim P/K không cần confirm | needsAgeConfirm=false | Book luôn, không dialog | FE |
| 31.2 | Phim T13 hiện dialog confirm | User click giữ ghế | AgeConfirmDialog hiển thị | FE |
| 31.3 | User confirm tuổi T18 | Click "Tôi xác nhận đủ tuổi" | Tiếp tục flow giữ ghế | FE |
| 31.4 | Tier 2: user khai DOB < min age | User 17 tuổi book T18 | 400 "Yêu cầu từ 18 tuổi trở lên" | BE |
| 31.5 | Tier 2: user khai DOB OK | User 25 tuổi book T18 | OK | BE |
| 31.6 | Tier 2: user chưa khai DOB | dateOfBirth=NULL | Bypass tier 2 (chỉ tier 1 + tier 3 enforce) | BE |
| 31.7 | Tier 3: POS preview T18 booking | Scan QR vé T18 | Show preview card + 2 nút Admit/Reject | FE |
| 31.8 | Tier 3: Reject "không đủ tuổi" | Click Reject → reason=UNDER_AGE | status=REJECTED, audit log | BE |
| 31.9 | Tier 3: Admit P/K auto | Phim P/K | Auto admit, không show preview | FE |
| 31.10 | Chip CCCD trên QR ticket T13+ | Booking phim T18 | Hiển thị chip cam "Mang CCCD" | FE |
| 31.11 | Age C đã bỏ khỏi enum | Form tạo phim | Dropdown chỉ có P/K/T13/T16/T18 | FE |
| 31.12 | Migration 072 fix C → T18 | Phim cũ ageRating=C | UPDATE thành T18 | DB |

---

## 32. CACHING — Caffeine + Redis 2-tier

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 32.1 | Statistics endpoint cache 60s | Gọi 2 lần liên tiếp /api/statistics/overview | Lần 2 không hit DB (cache) | BE |
| 32.2 | Cache TTL 60s | Đợi 65s → gọi lại | Hit DB, miss cache | BE |
| 32.3 | PricingEngine L1 refresh | Admin sửa rule → pricingEngine.refresh() | L1 reload + L2 invalidate | BE |
| 32.4 | PricingEngine L2 cache key truncate HOUR | 4 showtime 14:00/14:15/14:30/14:45 | Cùng key, 1 compute thật + 3 hit | BE |
| 32.5 | Scheduled refresh 5 phút | Rule HOUR_RANGE 22h | 22:01 reload mặc dù user inactive | BE |
| 32.6 | Redis rate-limit login fail | 5 fail trong 15 phút | Lock 15 phút | BE |
| 32.7 | Redis rate-limit reset password | 30 attempts/IP/hour | Block IP | BE |
| 32.8 | Session blacklist khi logout | Logout → token thêm vào blacklist Redis | Token cũ → 401 | BE |
| 32.9 | Cache name không khai báo | @Cacheable("non-existent") | IllegalArgumentException startup | BE |
| 32.10 | Monitor hit rate Actuator | GET /actuator/caches/stats-top-movies | hitCount/missCount/hitRate | BE |

---

## 33. SHEDLOCK — Distributed lock cho @Scheduled

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 33.1 | Single instance acquire lock | 1 instance, cron 0 * * * * * | OK, run mỗi phút | BE |
| 33.2 | 2 instance không chạy trùng | Deploy 2 replica, scheduler cùng cron | Chỉ 1 instance run mỗi phút | BE |
| 33.3 | Instance A crash khi giữ lock | Lock chưa release | Sau lockAtMostFor (5p), instance B acquire | BE |
| 33.4 | usingDbTime() chống NTP drift | Instance A clock lệch 5s | Lock dùng GETDATE() DB → đồng bộ | BE |
| 33.5 | Bảng shedlock query | SELECT * FROM shedlock | Hiển thị name/lock_until/locked_by | DB |
| 33.6 | lockAtLeastFor ngắn quá | lockAtLeastFor < job duration | Vẫn OK (job giữ lock đến complete) | BE |
| 33.7 | lockAtMostFor ngắn hơn job | Job chạy 2 phút, lockAtMostFor=30s | Sau 30s lock release → instance B acquire → race | BE |

---

## 34. HTTP-ONLY COOKIE AUTH — Hybrid pattern

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 34.1 | Login set refresh cookie | POST /api/auth/login | Set-Cookie: refreshToken=...; HttpOnly | BE |
| 34.2 | Login KHÔNG trả refreshToken trong body | Login success | Body có accessToken, không có refreshToken | BE |
| 34.3 | Refresh từ cookie (không cần body) | POST /api/auth/refresh, body={} | OK, trả accessToken mới | BE |
| 34.4 | Refresh từ body fallback | Legacy client gửi refresh token trong body | Vẫn work (backward compat) | BE |
| 34.5 | Logout clear cookie | POST /api/auth/logout | Set-Cookie: refreshToken=; max-age=0 | BE |
| 34.6 | JS không đọc được refresh cookie | document.cookie | Không thấy refreshToken | FE |
| 34.7 | Axios `withCredentials: true` | Mọi request | Browser tự gửi cookie | FE |
| 34.8 | Refresh cookie Secure prod | app.cookie.secure=true | Cookie có flag Secure (chỉ HTTPS) | BE |
| 34.9 | SameSite=Lax | Cookie | Vẫn gửi với navigation cùng origin | BE |

---

## 35. OWASP HEADERS

| # | Test Case | Expected Header |
|---|-----------|-----------------|
| 35.1 | X-Frame-Options | `DENY` |
| 35.2 | X-Content-Type-Options | `nosniff` |
| 35.3 | Referrer-Policy | `same-origin` |
| 35.4 | Content-Security-Policy | `default-src 'self'; img-src 'self' Cloudinary MoMo CDN; frame-ancestors 'none'` |
| 35.5 | Strict-Transport-Security | `max-age=31536000; includeSubDomains` (chỉ HTTPS) |

---

---

## 36. SEAT REVAMP — Industry-standard (Option C)

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 36.1 | Generate Preset TWO_D | applyPresetForRoomType=true, roomTypeOverride=TWO_D | 120 positions, ~100 ghế bán (loại trừ aisle) | BE |
| 36.2 | Generate Preset IMAX | preset IMAX | 14×18, 2 deluxe rows F/G, 0 couple | BE |
| 36.3 | Generate Preset FOUR_DX | preset FOUR_DX | 8×10, không có COUPLE/SWEETBOX | BE |
| 36.4 | Generate Custom với VIP zone | vipZone {C-G × 4-9} | Chỉ 30 ghế trong zone là VIP, ngoài zone STANDARD | BE |
| 36.5 | VIP rowStart > rowEnd | vipZone rowStart=G, rowEnd=C | 400 "VIP rowStart phải <= rowEnd" | BE |
| 36.6 | Handicap position invalid | handicap row=Z (totalRows=10) | 400 "Handicap row 'Z' ngoài phạm vi A-J" | BE |
| 36.7 | Aisle col render khoảng trống | aisleCols=[4,9] | FE render AisleGap (không button), không tính totalSeats | Cả hai |
| 36.8 | Book ghế AISLE | Click vị trí isAisle | Chặn (toggleSeat return) | FE |
| 36.9 | Book ghế BLOCKED | Click ghế status=BLOCKED | 400 "Ghế bị chặn vĩnh viễn" | BE |
| 36.10 | Book ghế BROKEN | Click ghế status=BROKEN | 400 "Ghế đang bảo trì" | BE |
| 36.11 | SWEETBOX gộp 2 cột | Click 1 ghế SWEETBOX odd col | Cả cặp được chọn | FE |
| 36.12 | DELUXE single seat | Click ghế DELUXE | Chọn 1 ghế, giá vipPrice × 1.5 fallback | Cả hai |
| 36.13 | HANDICAP icon ♿ | Render ghế HANDICAP | Hiện ♿ thay số cột, màu green | FE |
| 36.14 | HANDICAP pricing inclusive | Book ghế HANDICAP | Tính basePrice (không phụ thu) | BE |
| 36.15 | SWEETBOX fallback price | sweetboxPrice=NULL trong showtime | BE tính couplePrice × 2 | BE |
| 36.16 | DELUXE fallback price | deluxePrice=NULL | BE tính vipPrice × 1.5 round half-up | BE |
| 36.17 | Override ưu tiên BLOCKED > AISLE | Position vừa aisleCols vừa blockedPositions | Status=BLOCKED, isAisle=true (cả 2 flag) | BE |
| 36.18 | Override ưu tiên HANDICAP > VIP | Handicap=B1, vipZone bao gồm B1 | seatType=HANDICAP | BE |
| 36.19 | Bulk update isAisle dimension | PUT bulk-update {seatIds, isAisle: true} | Đánh dấu lối đi, không đụng seatType | BE |
| 36.20 | Compliance NĐ 28/2012 | Mọi preset TWO_D/THREE_D/IMAX/FOUR_DX | Đều có ≥ 2 HANDICAP positions | BE |
| 36.21 | Seat Map Editor 9 tools | Open editor | 9 tool buttons: 6 types + BROKEN + BLOCKED + AISLE | FE |
| 36.22 | Generate Custom validation aisle col | aisleCols=[35] (totalCols=12) | 400 "Cột aisle 35 ngoài phạm vi 1-12" | BE |

---

## 37. CONFIG KEY ALIGNMENT — Migration 028 fix bug ẩn

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 37.1 | Auth login max attempts đọc đúng key | LoginRateLimitService sai 6 lần | Block sau lần 5 (auth.login_max_attempts) | BE |
| 37.2 | Loyalty earn rate đúng decimal | Booking 100.000đ | User nhận 100 điểm (rate 0.001) | BE |
| 37.3 | Loyalty tier silver | User lifetimePoints = 500 | Auto promote SILVER (loyalty.tier.silver_threshold) | BE |
| 37.4 | Loyalty redeem min | User 50 điểm redeem | "Cần tối thiểu 100 điểm" (loyalty.min_redeem_points) | BE |
| 37.5 | Loyalty redeem value | 200 điểm redeem | Voucher giảm 200.000đ (loyalty.redeem_value=1000) | BE |
| 37.6 | Reset password token TTL | Click link reset sau 15 phút | "Link hết hạn" (auth.reset_token_expiry_minutes) | BE |
| 37.7 | Check-in rate limit max | 1 IP fail check-in 60 lần | Block IP (checkin.max_fails_per_ip) | BE |
| 37.8 | Check-in block duration | IP bị block | Mở lại sau 15 phút (checkin.block_minutes) | BE |
| 37.9 | Email verify expiry | Click verify sau 24h | "Link hết hạn" (auth.email_verification_expiry_hours) | BE |
| 37.10 | Statistics default range | Dashboard không params | Lấy 7 ngày (statistics.default_range_days) | BE |
| 37.11 | Statistics max range | Query 400 ngày | 400 "Vượt quá 365 ngày" (statistics.max_range_days) | BE |
| 37.12 | Payment cleanup window | PENDING payment 31 phút | Scheduler đánh FAILED (payment.pending_cleanup_minutes) | BE |
| 37.13 | Admin sửa loyalty.earn_rate | UI đổi 0.001 → 0.002 | Booking 100.000đ tích 200 điểm (BE thực sự đọc key mới) | Cả hai |
| 37.14 | Admin sửa auth.login_max_attempts | UI đổi 5 → 3 | Block sau lần 3 ngay phiên login tiếp | Cả hai |
| 37.15 | Drop dead keys | SELECT * FROM system_config | Không còn auth.login_window_minutes, statistics.cache_ttl_seconds | BE |

---

## 38. NO_SHOW RESET ON CHECK-IN — Industry tha "vé bùng"

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 38.1 | Khách bùng 2 vé rồi check-in | noShowCount=2 → check-in vé mới | Reset noShowCount=0, blockedUntil=null | BE |
| 38.2 | Khách bị block check-in | noShowCount=3, blockedUntil=tương lai, check-in OK | Mở khoá: blockedUntil=null + count=0 | BE |
| 38.3 | Khách 0 bùng check-in | noShowCount=0 → check-in | Không log reset (không thay đổi) | BE |
| 38.4 | Counter-sale check-in (không user) | booking.user=null check-in | Không crash, không reset (skip) | BE |
| 38.5 | Reset audit log | Check-in user có count > 0 | Log "Reset noShowCount X → 0 cho user Y" | BE |

---

## 39. SHOWTIME REMINDER 24H — Slot mới

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 39.1 | Reminder 24h scheduler | Showtime trong 24h-25h, booking CONFIRMED | Email "1 ngày" gửi 1 lần duy nhất | BE |
| 39.2 | Reminder 24h skip CANCELLED showtime | Showtime CANCELLED trong window | Không gửi email | BE |
| 39.3 | Reminder 24h skip counter-sale | Booking.user=null | Skip (không có email) | BE |
| 39.4 | Reminder 24h + 1h cùng booking | Booking showtime 1h sau | Nhận email 1h, không nhận 24h (đã qua window) | BE |
| 39.5 | Booking đặt 12h trước showtime | Booking tạo, showtime 12h sau | Chỉ nhận reminder 1h (skip 24h) | BE |
| 39.6 | SchedulerLock multi-instance | 2 instance backend chạy 24h slot | Chỉ 1 instance gửi email (ShedLock) | BE |
| 39.7 | Window 1h chính xác | Showtime now+25h+1min | Skip (ngoài window now+24h..now+25h) | BE |

---

## 40. VAT 8% — Industry VAT-inclusive

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 40.1 | Booking 100k → VAT breakdown | total=100.000 | subtotal=92.593, vat=7.407, vatPercent=8 | BE |
| 40.2 | Booking 250k → breakdown | total=250.000 | subtotal=231.481, vat=18.519 | BE |
| 40.3 | Đổi config vat 8% → 10% | UPDATE pricing.vat_percent=10 | Booking mới: subtotal=total*100/110 | BE |
| 40.4 | Vé cũ giữ % cũ | Vé tạo trước khi đổi config | Hiển thị đúng vat_percent=8 (history-preserving) | BE |
| 40.5 | UI hiển thị breakdown | Mở TicketDetailPage | Có 3 dòng: Tạm tính + VAT (8%) + Tổng cộng | FE |
| 40.6 | UI PaymentPage breakdown | Mở thanh toán | Cùng 3 dòng | FE |
| 40.7 | Backfill booking cũ | SELECT * FROM booking | vat_percent=8, subtotal=ROUND(total*100/108), vat=total-subtotal | BE |
| 40.8 | Counter-sale có VAT | POS bán vé | Booking có đầy đủ subtotal/vat/percent | BE |

---

## 41. LOYALTY TIER DISCOUNT — Tự động giảm theo hạng

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 41.1 | STANDARD không giảm | user.tier=STANDARD, booking 100k | tierDiscount=0, total=100k | BE |
| 41.2 | SILVER giảm 3% | user.tier=SILVER, booking 100k | tierDiscount=3000, total=97k | BE |
| 41.3 | GOLD giảm 5% | user.tier=GOLD, booking 100k | tierDiscount=5000, total=95k | BE |
| 41.4 | PLATINUM giảm 10% | user.tier=PLATINUM, booking 100k | tierDiscount=10000, total=90k | BE |
| 41.5 | Counter-sale không tier | user=null | tierDiscount=0, tierAtBooking=null | BE |
| 41.6 | UI hiện ưu đãi hạng GOLD | TicketDetail user GOLD | Dòng "Ưu đãi hạng Vàng −5.000đ" màu xanh | FE |
| 41.7 | UI ẩn nếu STANDARD | TicketDetail user STANDARD | KHÔNG hiện dòng ưu đãi hạng | FE |
| 41.8 | Voucher stack trên tier | GOLD + voucher 10%, booking 100k | seatTotal=100k, tier=5k, afterTier=95k, voucher=9.5k, total=85.5k | BE |
| 41.9 | Admin đổi % silver | UPDATE silver_discount=5 | Booking mới SILVER giảm 5% | BE |
| 41.10 | History preserving | Vé GOLD cũ, đổi gold% 5→7 | Vé cũ giữ tier_discount đã lưu, không recalc | BE |

---

## 42. POINTS EXPIRY — FIFO batch tracking

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 42.1 | EARN tạo batch | Booking 100k tích 100 điểm | LoyaltyTx.expiresAt=+12 tháng, remainingPoints=100 | BE |
| 42.2 | REDEEM FIFO | User có 2 batch (cũ 50p, mới 100p) redeem 70p | Trừ batch cũ 50p hết, batch mới còn 80p | BE |
| 42.3 | EXPIRE batch hết hạn | Scheduler quét batch expires<now còn remaining | Tạo EXPIRE tx, trừ user.loyaltyPoints, remaining=0 | BE |
| 42.4 | Lifetime KHÔNG tụt | User PLATINUM expire 5000 điểm | lifetimePoints giữ nguyên, tier vẫn PLATINUM | BE |
| 42.5 | Cap floor 0 | User loyaltyPoints=10, batch expire 100 | loyaltyPoints=0 (max 0, không âm) | BE |
| 42.6 | Scheduler batch size 500 | 1000 batch hết hạn | Lần 1 xử lý 500, lần 2 (tích tắc sau) 500 còn lại | BE |
| 42.7 | ShedLock multi-instance | 2 instance chạy scheduler | Chỉ 1 instance xử lý, instance kia skip | BE |
| 42.8 | Skip non-EARN | Batch type=REDEEM | Không process (chỉ EARN có expires) | BE |
| 42.9 | Skip batch remaining=0 | Batch đã redeem hết | Scheduler không pick (WHERE remaining > 0) | BE |
| 42.10 | Admin đổi expiry months | UPDATE 12 → 6 | Booking mới: expiresAt = +6 tháng | BE |

---

## 43. GROUP BOOKING DISCOUNT — Event công ty

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 43.1 | < threshold không giảm | 9 ghế, threshold=10 | groupDiscount=0 | BE |
| 43.2 | = threshold giảm 5% | 10 ghế 100k, group 5% | groupDiscount=5000 (afterTier * 5%) | BE |
| 43.3 | > threshold giảm 5% | 15 ghế 150k | groupDiscount=7.500 | BE |
| 43.4 | Stack với tier | GOLD + 12 ghế 100k | tier=5k, after=95k, group=4.750 | BE |
| 43.5 | Stack với voucher | 10 ghế + voucher 10% | seat=100k, group=5k, after=95k, voucher=9.5k, total=85.5k | BE |
| 43.6 | Counter-sale có group | POS bán 12 vé event công ty | groupDiscount > 0 (POS vẫn áp) | BE |
| 43.7 | UI hiện group | TicketDetail booking 12 vé | Dòng "Giảm giá nhóm (12 vé) −5.000đ" xanh | FE |
| 43.8 | Admin tắt group (% = 0) | UPDATE percent=0 | Booking 20 vé KHÔNG giảm group | BE |
| 43.9 | max_seats < threshold | max_seats=8, threshold=10 | Khách không thể hold 10 vé → không trigger | BE |
| 43.10 | Order pipeline rõ | 10 vé 100k GOLD + voucher 10% | Order: seat → tier(5k) → group(4.75k) → voucher(9.025k) → total=81.225k | BE |

---

## 44. POST-SHOWTIME FEEDBACK — Email mời đánh giá

| # | Test Case | Input | Expected | BE/FE |
|---|-----------|-------|----------|-------|
| 44.1 | Scheduler 24h sau | Booking CHECKED_IN, showtime endTime 24h trước | Email "Cảm ơn bạn đã xem phim X" gửi 1 lần | BE |
| 44.2 | Skip NO_SHOW | Booking NO_SHOW, endTime 24h trước | KHÔNG gửi | BE |
| 44.3 | Skip CANCELLED | Booking CANCELLED | KHÔNG gửi | BE |
| 44.4 | Skip counter-sale | booking.user=null | KHÔNG gửi (không có email) | BE |
| 44.5 | Link review đúng phim | Email body có URL | href={frontend}/movies/{movieId} | BE |
| 44.6 | Window 1h chính xác | endTime 24h+1min trước | Skip (ngoài window) | BE |
| 44.7 | SchedulerLock | 2 instance chạy | Chỉ 1 instance gửi (postShowtimeFeedback lock) | BE |
| 44.8 | Subject email | endTime=2026-06-13 23:00 | Subject "CineX — Bạn thấy phim X thế nào?" | BE |
| 44.9 | Template Thymeleaf | Render OK | Có CTA gold "Đánh giá ngay" + mã vé monospace | BE |

---

*Tổng: 44 module, 360+ test cases. Cập nhật lần cuối: 14/06/2026 (Phase 2 industry features: VAT 8% + Loyalty tier discount + Points expiry 12 tháng FIFO + Group discount 10+ vé + Post-showtime feedback email).*
