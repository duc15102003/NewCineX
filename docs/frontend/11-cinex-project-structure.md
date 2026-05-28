# Cấu trúc Frontend CineX — Giải thích từng folder

## Toàn bộ cấu trúc

```
frontend/src/
│
├── main.tsx                    ← Điểm khởi đầu — render App vào index.html
├── App.tsx                     ← Bọc QueryClientProvider + Toaster + AppRouter
├── index.css                   ← Import Tailwind + font Inter
│
├── api/
│   └── axios.ts                ← HTTP client — baseURL, JWT interceptor, auto redirect 401
│
├── store/
│   └── authStore.ts            ← Zustand: token, refreshToken, user (username, role)
│
├── types/                      ← TypeScript interfaces (BE trả gì → FE định nghĩa kiểu gì)
│   ├── auth.ts                 ← LoginRequest, RegisterRequest, AuthResponse, ApiResponse
│   ├── movie.ts                ← MovieListItem, MovieDetail, Genre, ShowtimeItem, PageResponse
│   └── booking.ts              ← SeatItem, BookingDetail, PaymentResponse, TicketData, UserProfile
│
├── hooks/                      ← Custom hooks — gom logic gọi API + xử lý kết quả
│   ├── useAuth.ts              ← useLogin, useRegister, useLogout
│   ├── useMovies.ts            ← useMovies, useMovie, useGenres, useShowtimes
│   ├── useBooking.ts           ← useHoldSeats, useCreatePayment, useMyBookings, useProfile, ...
│   ├── useWebSocket.ts         ← useSeatWebSocket — real-time ghế thay đổi
│   └── useAdmin.ts             ← useOverviewStats, useAdminMovies, useCheckIn, ...
│
├── routes/
│   ├── AppRouter.tsx           ← Tất cả routes — public, protected, admin
│   ├── ProtectedRoute.tsx      ← Chưa login → redirect /login
│   └── AdminRoute.tsx          ← Không phải admin → redirect /
│
├── components/
│   ├── ui/                     ← shadcn/ui components (Button, Input, Card, Dialog, Table, ...)
│   ├── layout/                 ← Layout chung
│   │   ├── MainLayout.tsx      ← Header + Outlet + Footer (user pages)
│   │   ├── Header.tsx          ← Logo, nav, user dropdown, mobile hamburger
│   │   └── Footer.tsx          ← Copyright
│   ├── admin/
│   │   └── AdminLayout.tsx     ← Sidebar + topbar + Outlet (admin pages)
│   ├── common/
│   │   ├── Loading.tsx         ← Spinner loading
│   │   └── EmptyState.tsx      ← "Không có dữ liệu"
│   └── movie/
│       ├── MovieCard.tsx       ← Card hiển thị 1 phim (poster, title, rating)
│       ├── MovieGrid.tsx       ← Grid responsive chứa nhiều MovieCard
│       ├── SearchBar.tsx       ← Input tìm kiếm (debounce 300ms)
│       └── GenreFilter.tsx     ← Chip buttons lọc thể loại
│
├── features/                   ← Trang theo chức năng
│   ├── home/
│   │   └── HomePage.tsx        ← Trang chủ: hero + phim đang chiếu + sắp chiếu
│   ├── auth/
│   │   ├── LoginPage.tsx       ← Form đăng nhập (react-hook-form + zod)
│   │   └── RegisterPage.tsx    ← Form đăng ký
│   ├── movie/
│   │   ├── MovieListPage.tsx   ← Danh sách phim + search + filter + pagination
│   │   └── MovieDetailPage.tsx ← Chi tiết phim + trailer + suất chiếu theo ngày
│   ├── booking/
│   │   ├── SeatSelectionPage.tsx   ← Sơ đồ ghế + WebSocket real-time + hold
│   │   ├── PaymentPage.tsx         ← Chọn phương thức + thanh toán
│   │   ├── PaymentResultPage.tsx   ← Kết quả + QR code
│   │   ├── MyTicketsPage.tsx       ← Lịch sử vé
│   │   └── TicketDetailPage.tsx    ← Chi tiết vé + QR + hủy vé
│   ├── profile/
│   │   └── ProfilePage.tsx     ← Sửa thông tin + đổi mật khẩu
│   └── admin/
│       ├── DashboardPage.tsx   ← Thống kê + biểu đồ doanh thu
│       ├── AdminMoviePage.tsx  ← CRUD phim + upload poster
│       ├── AdminRoomPage.tsx   ← CRUD phòng + generate ghế
│       ├── AdminShowtimePage.tsx ← CRUD suất chiếu
│       ├── AdminUserPage.tsx   ← Quản lý user + đổi role
│       └── CheckInPage.tsx     ← Nhập mã booking → check-in
│
├── utils/
│   └── jwt.ts                  ← Decode JWT payload (lấy username, role)
│
└── lib/
    └── utils.ts                ← cn() helper — merge Tailwind classes
```

## Quy tắc tổ chức

### `features/` vs `components/`

```
features/ = TRANG (page) — mỗi URL = 1 file trong features/
    /login → features/auth/LoginPage.tsx
    /movies → features/movie/MovieListPage.tsx
    /admin/dashboard → features/admin/DashboardPage.tsx

components/ = KHỐI NHỎ tái sử dụng — dùng ở nhiều trang
    MovieCard → dùng ở HomePage + MovieListPage
    SearchBar → dùng ở MovieListPage + AdminMoviePage
    Button, Input → dùng ở mọi nơi
```

**Quy tắc:** Nếu component chỉ dùng ở 1 trang → để trong trang đó. Nếu dùng ở 2+ trang → tách ra `components/`.

### `hooks/` — Tại sao tách hook riêng?

```
KHÔNG tách:
    MovieListPage.tsx chứa:
        - State (keyword, genreId, page)
        - Gọi API (axios.get /api/movies)
        - Xử lý loading, error
        - Render UI
    → File 300+ dòng, khó đọc, khó test

CÓ tách:
    useMovies.ts → gom logic gọi API + cache
    MovieListPage.tsx → chỉ lo render UI + state
    → Mỗi file 50-100 dòng, rõ ràng
```

### `types/` — Tại sao cần TypeScript types?

```typescript
// Không có types:
const movie = response.data  // movie là gì? có field nào? IDE không biết

// Có types:
const movie: MovieDetail = response.data
movie.title    // ✅ IDE autocomplete, biết có field title
movie.xyz      // ❌ Compile error ngay — không có field xyz
```

## Luồng data trong FE

```
User action (click, type, submit)
    │
    ▼
Component (MovieListPage.tsx)
    │  gọi hook
    ▼
Custom Hook (useMovies.ts)
    │  gọi API qua TanStack Query
    ▼
Axios (api/axios.ts)
    │  HTTP request + JWT token
    ▼
Backend API (localhost:8088)
    │  response JSON
    ▼
TanStack Query cache
    │  data → hook return
    ▼
Component re-render → UI update
```
