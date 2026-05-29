# CineX Team — Dự án cho team demo với thầy

## QUAN TRỌNG — ĐỌC TRƯỚC

- Đây là repo **cinex-team** — dùng để team demo với thầy
- **KHÔNG PHẢI** repo gốc cinex (repo gốc ở `/Users/vutuongan/cinex/`)
- **KHÔNG SỬA** repo gốc cinex khi làm việc ở đây
- Code gốc đầy đủ copy từ cinex sang, chỉ **ẩn/hiện chức năng** bằng comment

---

## Cách hoạt động

- **Backend**: full code, chạy đầy đủ tất cả API
- **Frontend**: full code, nhưng **ẩn tab chưa demo** bằng comment trong 2 file:
  1. `frontend/src/components/admin/AdminLayout.tsx` — sidebar quản trị
  2. `frontend/src/components/layout/Header.tsx` — header user
  3. `frontend/src/routes/AppRouter.tsx` — routes

## Cách bật/tắt chức năng

Khi thầy yêu cầu thêm chức năng → **bỏ comment** dòng tương ứng. Không cần code gì thêm.

### Sidebar quản trị (AdminLayout.tsx dòng ~15-28)

```tsx
// BẬT (đang hiện):
{ to: '/admin/genres', label: 'Thể loại', icon: Tags },
{ to: '/admin/movies', label: 'Phim', icon: Film },
{ to: '/admin/rooms', label: 'Phòng chiếu', icon: DoorOpen },
{ to: '/admin/showtimes', label: 'Suất chiếu', icon: Clock },
{ to: '/admin/users', label: 'Người dùng', icon: Users },

// TẮT (comment, bỏ comment khi cần):
// { to: '/admin', label: 'Tổng quan', icon: LayoutDashboard },         // Dashboard — Đức
// { to: '/admin/bookings', label: 'Đặt vé', icon: Ticket },            // QL booking — Long
// { to: '/admin/snacks', label: 'Đồ ăn', icon: Coffee },               // QL đồ ăn — Long
// { to: '/admin/vouchers', label: 'Khuyến mãi', icon: TicketPercent },  // Voucher — Hải
// { to: '/admin/pos', label: 'POS Đồ ăn', icon: Receipt },             // POS đồ ăn — Đạt
// { to: '/admin/ticket-pos', label: 'POS Bán vé', icon: Clapperboard },// POS vé — Hải
// { to: '/admin/check-in', label: 'Quét vé', icon: ScanLine },          // Check-in — Long
// { to: '/admin/configs', label: 'Cấu hình', icon: Settings },          // Config — Hải
```

### Avatar dropdown (AdminLayout.tsx dòng ~277-296)

```tsx
// BẬT:
Hồ sơ, Đăng xuất

// TẮT:
// Trang chủ
// Vé của tôi — Long
// Phim yêu thích — Đạt
```

### Header user (Header.tsx dòng ~38-44)

```tsx
// TẮT:
// Trang chủ
// Phim — Đạt
```

### Route /admin mặc định (AppRouter.tsx dòng ~76)

```tsx
// Hiện tại: /admin → AdminMoviePage (QL phim)
// Khi bật Dashboard: uncomment DashboardPage, comment AdminMoviePage
```

---

## Phân công team

| Người | Branch | Chức năng |
|---|---|---|
| **Long** | `long` | Auth (đăng ký, đăng nhập, quên MK), QL người dùng, QL đặt vé, QL đồ ăn, Check-in QR, Email vé |
| **Đạt** | `dat` | QL phim, QL thể loại, QL suất chiếu, Yêu thích, Đánh giá, Thông báo, POS đồ ăn, Trang chủ |
| **Hải** | `hai` | QL phòng, Sơ đồ ghế, Luồng đặt vé, Thanh toán MoMo, POS bán vé, Voucher, Cấu hình |
| **Đức** | `duc` | QL phòng, Sơ đồ ghế, Luồng đặt vé, Thanh toán MoMo, Thống kê, Dashboard, Export PDF/Excel |

---

## Lệnh khi user yêu cầu

### "bật chức năng XYZ"
→ Tìm dòng comment tương ứng trong AdminLayout.tsx / Header.tsx / AppRouter.tsx → bỏ comment → commit → push

### "tắt chức năng XYZ"
→ Comment lại dòng đó → commit → push

### "đẩy lên git"
→ `git add -A && git commit -m "..." && git push origin main`

### "đẩy cho branch X"
→ `git checkout X && ...copy file... && git commit && git push origin X`

---

## Chạy dự án

```bash
# 1. Docker
docker-compose up sqlserver redis -d

# 2. Tạo DB (lần đầu)
docker exec cinex-team-sqlserver-1 /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P 'CineX@2026' -C -Q "CREATE DATABASE cinex"

# 3. Backend
cd backend && ./gradlew bootRun

# 4. Frontend (terminal khác)
cd frontend && npm install && npm run dev
```

**Login**: `admin` / `Admin@123`
**URL**: http://localhost:5173 → trang login → đăng nhập → quản trị

---

## Trạng thái hiện tại

### Đang BẬT (demo được):
- Đăng ký, Đăng nhập, Quên mật khẩu
- QL Phim, QL Thể loại, QL Suất chiếu
- QL Phòng chiếu + Sơ đồ ghế
- QL Người dùng
- Hồ sơ cá nhân

### Đang TẮT (comment, chờ thầy yêu cầu):
- Dashboard thống kê
- QL Đặt vé, QL Đồ ăn
- Voucher, POS, Check-in
- Trang chủ user, Danh sách phim
- Yêu thích, Đánh giá, Thông báo
- Thanh toán MoMo, Export PDF/Excel
