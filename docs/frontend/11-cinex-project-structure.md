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

---

## Naming Convention chi tiết

| Đối tượng | Convention | Ví dụ |
|---|---|---|
| Component | PascalCase | `MovieCard.tsx`, `BookingDialog.tsx` |
| Hook | camelCase, prefix `use` | `useMovies.ts`, `useAdminMovies.ts` |
| Utility function | camelCase | `formatDate.ts`, `validateEmail.ts` |
| Constant | UPPER_SNAKE_CASE | `MAX_SEATS = 8`, `API_BASE_URL` |
| Type/Interface | PascalCase | `Movie`, `BookingRequest` |
| Enum | PascalCase + member UPPER | `BookingStatus.HOLDING` |
| File chứa component | PascalCase | `MovieCard.tsx` |
| File khác | camelCase | `axios.ts`, `labels.ts` |
| Folder feature | kebab-case | `admin-movies/`, `seat-selection/` |

---

## Barrel Files Pattern

### Vấn đề
```ts
// Page phải import từ nhiều file
import { useMovies } from "@/hooks/useAdminMovies";
import { useGenres } from "@/hooks/useAdminGenres";
import { useRooms } from "@/hooks/useAdminRooms";
```

### Giải pháp: barrel file
```ts
// hooks/useAdmin.ts (barrel)
export * from "./useAdminMovies";
export * from "./useAdminGenres";
export * from "./useAdminRooms";

// Page:
import { useMovies, useGenres, useRooms } from "@/hooks/useAdmin";
```

CineX dùng `useAdmin.ts` re-export từ domain file riêng.

### Trade-off
- ✅ Import gọn
- ❌ Tree-shaking có thể bị ảnh hưởng nếu barrel không sạch
- ❌ Circular dependency dễ xảy ra

---

## Khi nào tách Component

### Rule of three
Code lặp lại 3 lần → tách component.

### Size threshold
- < 100 dòng: 1 file OK
- 100-300 dòng: cân nhắc tách sub-component cùng file
- > 300 dòng: BẮT BUỘC tách

### Single Responsibility
Component làm 2 việc trở lên → tách:
```tsx
// SAI — 1 component vừa list vừa filter vừa CRUD
function AdminMovies() {
  // 500 dòng filter logic + list + dialog tạo + dialog sửa + dialog xóa
}

// ĐÚNG — tách
function AdminMoviesPage() {
  return <>
    <MovieFilter />
    <MovieTable />
    <CreateMovieDialog />
    <EditMovieDialog />
    <DeleteConfirmDialog />
  </>;
}
```

---

## Import Order

Quy ước (top → bottom):
```ts
// 1. External libraries
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

// 2. Internal absolute imports (@)
import { api } from "@/api/axios";
import { useAuthStore } from "@/store/authStore";
import type { Movie } from "@/types/movie";

// 3. Relative imports
import { MovieCard } from "./MovieCard";
import { fmtDate } from "../utils/labels";

// 4. Type-only imports cuối
import type { FC } from "react";
```

Tool ESLint plugin `eslint-plugin-import` auto-sort.

---

## Cross-feature Import

### Rule: feature KHÔNG import feature khác trực tiếp

```ts
// SAI
// features/booking/BookingPage.tsx
import { MovieCard } from "@/features/movies/MovieCard";  // ❌

// ĐÚNG: tách MovieCard ra components/ chung
import { MovieCard } from "@/components/MovieCard";  // ✅
```

Component dùng chung 2+ feature → đặt ở `components/`.

---

## Shared Types vs Feature Types

```
src/
├── types/                      ← chung, import được mọi nơi
│   ├── api.ts                  (ApiResponse<T>, PageResponse<T>)
│   ├── user.ts                 (User, Role)
│   └── movie.ts                (Movie, Genre)
└── features/booking/
    └── types.ts                ← riêng cho booking feature
        (BookingFilterState, SeatSelectionMode)
```

Types thuộc domain chính → `types/`. Types chỉ feature dùng → `features/X/types.ts`.

---

## Cấu trúc 1 Feature folder

Ví dụ `features/admin-movies/`:
```
admin-movies/
├── AdminMoviesPage.tsx          ← entry point
├── components/
│   ├── MovieFilter.tsx
│   ├── MovieTable.tsx
│   ├── MovieRowActions.tsx
│   ├── CreateMovieDialog.tsx
│   ├── EditMovieDialog.tsx
│   └── PosterUploadButton.tsx
├── hooks/                       ← hooks chỉ dùng trong feature này
│   └── useMovieFilters.ts
├── types.ts                     ← types feature
└── constants.ts                 ← const feature
```

Hook query/mutation API → ở `hooks/useAdminMovies.ts` (chung), không nằm trong feature folder.

---

## Circular Dependency

### Xảy ra khi
```
hooks/useAuth.ts → store/authStore.ts → api/axios.ts → hooks/useAuth.ts (cycle!)
```

### Triệu chứng
- Build warning "Circular dependency detected"
- Runtime: 1 module được load partial → undefined import
- Hard to debug

### Fix
- Tách chung ra module thứ 3 không depend ngược
- Lazy import: `import("...")` dynamic
- Tránh helper function gọi qua nhiều layer

### Detect
Tool `madge`:
```bash
npx madge --circular src/
```

---

## Constants Folder

```
src/utils/
├── labels.ts                    ← status labels, format dates
├── colors.ts                    ← status colors, theme tokens
└── constants.ts                 ← MAX_SEATS, HOLD_MINUTES
```

Quy ước CineX: `labels.ts` và `colors.ts` tập trung, KHÔNG khai báo local trong page.

---

## Public assets

```
public/                          ← Vite serve nguyên xi
├── favicon.svg
├── og-image.png
└── robots.txt
```

Truy cập qua `/favicon.svg`, không qua import.

```
src/assets/                      ← import qua bundler, hash filename
├── logo.svg
└── hero-bg.jpg
```

Import: `import logo from "@/assets/logo.svg"`.
