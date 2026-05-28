# React Router — Điều hướng trang

---

## React Router là gì?

React là **Single Page App** (SPA) — chỉ có 1 file HTML. React Router giúp chuyển trang **không reload** trình duyệt.

### Ví dụ đời thường
- Website truyền thống: click link → trình duyệt tải trang mới (chờ 1-2 giây)
- SPA + Router: click link → React đổi component hiển thị (tức thì, không chờ)

---

## Cấu hình Router cho CineX

```tsx
// src/routes/AppRouter.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';

export default function AppRouter() {
    return (
        <BrowserRouter>
            <Routes>
                {/* Layout chung: Header + Footer bọc tất cả trang */}
                <Route element={<MainLayout />}>

                    {/* Trang public — ai cũng vào được */}
                    <Route path="/" element={<HomePage />} />
                    <Route path="/movies" element={<MovieListPage />} />
                    <Route path="/movies/:id" element={<MovieDetailPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />

                    {/* Trang cần đăng nhập */}
                    <Route element={<ProtectedRoute />}>
                        <Route path="/booking/:showtimeId" element={<SeatSelectionPage />} />
                        <Route path="/payment/:bookingId" element={<PaymentPage />} />
                        <Route path="/payment/result" element={<PaymentResultPage />} />
                        <Route path="/my-tickets" element={<MyTicketsPage />} />
                        <Route path="/my-tickets/:id" element={<TicketDetailPage />} />
                        <Route path="/profile" element={<ProfilePage />} />
                    </Route>
                </Route>

                {/* Layout admin — riêng cho admin */}
                <Route element={<AdminRoute />}>
                    <Route path="/admin" element={<AdminLayout />}>
                        <Route index element={<DashboardPage />} />
                        <Route path="movies" element={<AdminMovieListPage />} />
                        <Route path="rooms" element={<AdminRoomListPage />} />
                        <Route path="showtimes" element={<AdminShowtimeListPage />} />
                        <Route path="bookings" element={<AdminBookingListPage />} />
                        <Route path="users" element={<AdminUserListPage />} />
                        <Route path="check-in" element={<CheckInPage />} />
                    </Route>
                </Route>

                {/* 404 */}
                <Route path="*" element={<NotFoundPage />} />
            </Routes>
        </BrowserRouter>
    );
}
```

---

## Nested Routes & Layout — Bọc layout chung

```tsx
// MainLayout.tsx — Header + Footer bọc tất cả trang
import { Outlet } from 'react-router-dom';

function MainLayout() {
    return (
        <div>
            <Header />          {/* Hiện trên MỌI trang */}
            <main>
                <Outlet />      {/* ← Trang con render ở đây */}
            </main>
            <Footer />          {/* Hiện trên MỌI trang */}
        </div>
    );
}

// Khi user vào /movies:
// MainLayout render → Header + MovieListPage (Outlet) + Footer
// Khi user vào /login:
// MainLayout render → Header + LoginPage (Outlet) + Footer
```

---

## URL Parameters — Tham số trong URL

```tsx
// Route: /movies/:id
// URL:   /movies/42

import { useParams } from 'react-router-dom';

function MovieDetailPage() {
    const { id } = useParams();  // id = "42"

    const { data: movie } = useQuery({
        queryKey: ['movie', id],
        queryFn: () => api.get(`/api/movies/${id}`),
    });

    return <h1>{movie?.title}</h1>;
}
```

---

## Navigate — Chuyển trang bằng code

```tsx
import { useNavigate } from 'react-router-dom';

function BookingSummary({ showtimeId }) {
    const navigate = useNavigate();

    const handleBooking = () => {
        // Gọi API hold ghế...
        // Thành công → chuyển sang trang thanh toán
        navigate(`/payment/${bookingId}`);
    };

    return <button onClick={handleBooking}>Đặt vé</button>;
}
```

---

## Link — Chuyển trang bằng click

```tsx
import { Link } from 'react-router-dom';

function Header() {
    return (
        <nav>
            {/* Link thay cho <a href> — không reload trang */}
            <Link to="/">Trang chủ</Link>
            <Link to="/movies">Phim</Link>
            <Link to="/my-tickets">Vé của tôi</Link>
        </nav>
    );
}
```

---

## ProtectedRoute — Chặn user chưa đăng nhập

```tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

function ProtectedRoute() {
    const token = useAuthStore(state => state.token);

    if (!token) {
        // Chưa login → redirect về /login
        return <Navigate to="/login" replace />;
    }

    // Đã login → render trang con
    return <Outlet />;
}

// AdminRoute — chỉ cho ADMIN
function AdminRoute() {
    const { token, role } = useAuthStore();

    if (!token) return <Navigate to="/login" replace />;
    if (role !== 'ADMIN') return <Navigate to="/" replace />;

    return <Outlet />;
}
```
