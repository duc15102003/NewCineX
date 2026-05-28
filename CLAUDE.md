# CineX Team — Hướng dẫn đẩy code theo giai đoạn

## Cách dùng

Gõ: `đẩy giai đoạn X` (X = 2-10)

Claude sẽ tự động:
1. Checkout từng branch (long, dat, hai, duc)
2. Copy đúng file từ `/Users/vutuongan/cinex/` (repo gốc)
3. Commit với message phù hợp
4. Push lên GitHub

## Repo gốc (source code đầy đủ)
`/Users/vutuongan/cinex/`

## Repo team (đẩy theo giai đoạn)
`/Users/vutuongan/cinex-team/`

## Branches
- `main` — skeleton + docs
- `long` — Hoàng Long
- `dat` — Đạt
- `hai` — Hải
- `duc` — Đức

---

## KẾ HOẠCH 10 GIAI ĐOẠN

### Giai đoạn 1 ✅ (Đã đẩy)
**Tất cả**: Setup project, DB schema, config, layout skeleton

### Giai đoạn 2
**Long**: Đăng ký + Đăng nhập
- `frontend/src/features/auth/LoginPage.tsx`
- `frontend/src/features/auth/RegisterPage.tsx`
- `frontend/src/hooks/useAuth.ts`
- `frontend/src/utils/jwt.ts`
- Cập nhật `AppRouter.tsx` thêm route /login, /register

**Đạt**: Quản lý phim + Thể loại
- `frontend/src/features/admin/AdminMoviePage.tsx`
- `frontend/src/features/admin/AdminGenrePage.tsx`
- `frontend/src/hooks/useAdminMovies.ts`
- `frontend/src/hooks/useAdminGenres.ts`
- `frontend/src/hooks/useAdmin.ts` (barrel)
- `frontend/src/components/common/ConfirmDialog.tsx`
- `frontend/src/components/common/StatusDropdown.tsx`
- `frontend/src/components/admin/AdminLayout.tsx`
- `frontend/src/utils/labels.ts`
- `frontend/src/utils/colors.ts`
- Cập nhật `AppRouter.tsx` thêm route /admin/movies, /admin/genres

**Hải**: Quản lý phòng chiếu
- `frontend/src/features/admin/AdminRoomPage.tsx`
- `frontend/src/hooks/useAdminRooms.ts`
- `frontend/src/components/common/ConfirmDialog.tsx`
- `frontend/src/components/common/StatusDropdown.tsx`
- `frontend/src/components/admin/AdminLayout.tsx`
- `frontend/src/utils/labels.ts`
- Cập nhật `AppRouter.tsx` thêm route /admin/rooms

**Đức**: Quản lý phòng chiếu (giống Hải)
- Giống Hải — cùng module

### Giai đoạn 3
**Long**: Quên mật khẩu + Reset password
- `frontend/src/features/auth/ForgotPasswordPage.tsx`
- `frontend/src/features/auth/ResetPasswordPage.tsx`
- Cập nhật `AppRouter.tsx` thêm route /forgot-password, /reset-password

**Đạt**: Quản lý suất chiếu
- `frontend/src/features/admin/AdminShowtimePage.tsx`
- `frontend/src/hooks/useAdminShowtimes.ts`
- `frontend/src/components/common/PriceInput.tsx`
- Cập nhật `AppRouter.tsx` thêm route /admin/showtimes

**Hải**: Sơ đồ ghế (Seat Map Editor)
- `frontend/src/features/admin/SeatMapEditorPage.tsx`
- `frontend/src/hooks/useAdminSeatMap.ts`
- Cập nhật `AppRouter.tsx` thêm route /admin/rooms/:id/seats

**Đức**: Sơ đồ ghế (giống Hải)
- Giống Hải

### Giai đoạn 4
**Long**: Quản lý người dùng
- `frontend/src/features/admin/AdminUserPage.tsx`
- `frontend/src/hooks/useAdminUsers.ts`
- Cập nhật `AppRouter.tsx` thêm route /admin/users

**Đạt**: Phim yêu thích
- `frontend/src/features/movie/MovieDetailPage.tsx`
- `frontend/src/features/movie/MovieListPage.tsx`
- `frontend/src/components/movie/MovieCard.tsx`
- `frontend/src/components/movie/MovieGrid.tsx`
- `frontend/src/components/movie/SearchBar.tsx`
- `frontend/src/components/movie/GenreFilter.tsx`
- `frontend/src/hooks/useMovies.ts`
- `frontend/src/hooks/useFavorites.ts`
- `frontend/src/types/movie.ts`
- Cập nhật `AppRouter.tsx` thêm route /movies, /movies/:id, /favorites

**Hải**: Luồng đặt vé (chọn ghế + hold)
- `frontend/src/features/booking/SeatSelectionPage.tsx`
- `frontend/src/hooks/useBooking.ts`
- `frontend/src/hooks/useWebSocket.ts`
- `frontend/src/types/booking.ts`
- Cập nhật `AppRouter.tsx` thêm route /booking/seats/:showtimeId

**Đức**: Luồng đặt vé (giống Hải)
- Giống Hải

### Giai đoạn 5
**Long**: Quản lý đồ ăn (Snack)
- `frontend/src/features/admin/AdminSnackPage.tsx`
- `frontend/src/hooks/useAdminSnacks.ts`
- Cập nhật `AppRouter.tsx` thêm route /admin/snacks

**Đạt**: Đánh giá phim
- `frontend/src/components/movie/ReviewSection.tsx`
- `frontend/src/hooks/useReviews.ts`
- Cập nhật MovieDetailPage thêm ReviewSection

**Hải**: Thanh toán MoMo
- `frontend/src/features/booking/PaymentPage.tsx`
- `frontend/src/features/booking/PaymentResultPage.tsx`
- Cập nhật `AppRouter.tsx` thêm route /payment/:bookingId, /payment/result

**Đức**: Thanh toán MoMo (giống Hải)
- Giống Hải

### Giai đoạn 6
**Long**: Quản lý đặt vé (Admin)
- `frontend/src/features/admin/AdminBookingPage.tsx`
- `frontend/src/hooks/useAdminBookings.ts`
- Cập nhật `AppRouter.tsx` thêm route /admin/bookings

**Đạt**: Thông báo (WebSocket real-time)
- `frontend/src/hooks/useNotifications.ts`
- `frontend/src/hooks/useNotificationWebSocket.ts`
- Cập nhật Header.tsx thêm bell icon + notification dropdown

**Hải**: POS bán vé tại quầy
- `frontend/src/features/admin/TicketPOSPage.tsx`
- Cập nhật `AppRouter.tsx` thêm route /admin/ticket-pos

**Đức**: Thống kê Dashboard
- `frontend/src/features/admin/DashboardPage.tsx`
- `frontend/src/hooks/useStatistics.ts`
- Cập nhật `AppRouter.tsx` thêm route /admin (dashboard)

### Giai đoạn 7
**Long**: Check-in QR
- `frontend/src/features/admin/CheckInPage.tsx`
- Cập nhật `AppRouter.tsx` thêm route /admin/check-in

**Đạt**: POS đồ ăn
- `frontend/src/features/admin/POSPage.tsx`
- Cập nhật `AppRouter.tsx` thêm route /admin/pos

**Hải**: Voucher
- `frontend/src/features/admin/AdminVoucherPage.tsx`
- `frontend/src/hooks/useAdminVouchers.ts`
- Cập nhật `AppRouter.tsx` thêm route /admin/vouchers

**Đức**: Xuất PDF/Excel
- `frontend/src/utils/export.ts`
- `frontend/src/utils/roboto-font.ts`
- `frontend/public/fonts/Roboto-Regular.ttf`
- `frontend/public/fonts/Roboto-Bold.ttf`
- Cập nhật DashboardPage thêm nút xuất

### Giai đoạn 8
**Long**: Email vé + hủy vé
- `frontend/src/features/booking/TicketDetailPage.tsx`
- `frontend/src/features/booking/MyTicketsPage.tsx`
- Cập nhật `AppRouter.tsx` thêm route /my-tickets, /my-tickets/:id

**Đạt**: Trang chủ + danh sách phim
- `frontend/src/features/home/HomePage.tsx` (full version)
- Cập nhật HomePage hiện phim đang chiếu + sắp chiếu

**Hải**: Cấu hình hệ thống
- `frontend/src/features/admin/AdminConfigPage.tsx`
- Cập nhật `AppRouter.tsx` thêm route /admin/configs

**Đức**: Biểu đồ doanh thu (Recharts)
- Cập nhật DashboardPage thêm AreaChart + filter ngày

### Giai đoạn 9
**Tất cả**: Clean code + profile page
- `frontend/src/features/profile/ProfilePage.tsx`
- Clean imports, fix types
- Cập nhật `AppRouter.tsx` thêm route /profile

### Giai đoạn 10
**Tất cả**: Demo hoàn chỉnh
- Merge tất cả vào 1 codebase hoàn chỉnh
- Test end-to-end
- Fix bug cuối

---

## QUY TẮC KHI ĐẨY CODE

1. **Mỗi giai đoạn phải BUILD + CHẠY được** — không được lỗi
2. **Copy file từ repo gốc** `/Users/vutuongan/cinex/` — không viết lại
3. **AppRouter.tsx phải cập nhật** mỗi khi thêm route mới
4. **Commit message** ghi rõ: "Tuần X: tên chức năng"
5. **Push từng branch** sau khi commit
6. **Không push branch `main`** chứa full code — main chỉ có skeleton + docs
7. **Kiểm tra build** trước khi push: `cd frontend && npx tsc --noEmit`

## CẤU TRÚC COMMIT MESSAGE

```
Tuần X: Tên chức năng chính

- Chi tiết 1
- Chi tiết 2
- Chi tiết 3
```

## LỆNH PUSH

```bash
cd /Users/vutuongan/cinex-team
git checkout <branch>
git add -A
git commit -m "Tuần X: ..."
git push origin <branch>
```
