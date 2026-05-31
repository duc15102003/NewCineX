# React Router -- Dieu huong trang trong SPA

---

## 1. React Router la gi? SPA la gi?

### Website truyen thong (Multi Page App)

Tuong tuong ban vao website ban hang. Moi lan click "Trang chu", "San pham", "Lien he":
1. Trinh duyet gui request len server
2. Server tra ve **1 file HTML moi hoan toan**
3. Trinh duyet **tai lai toan bo trang** (trang trang → hien noi dung)

Giong nhu ban doc sach giay -- muon doc chuong 5, ban phai **lat lai tu dau**, roi lat tung trang den chuong 5.

### Single Page Application (SPA)

Voi React, tat ca chi co **1 file HTML duy nhat** (`index.html`). Khi click chuyen trang:
1. Trinh duyet **KHONG** gui request len server
2. React chi **thay doi component** dang hien thi (tat component cu, bat component moi)
3. URL tren thanh dia chi van doi (VD: `/movies` → `/login`), nhung trang **KHONG reload**

Giong nhu doc sach tren dien thoai -- ban vuot tay la chuyen chuong ngay lap tuc, khong can tai lai.

### React Router lam gi?

React Router la thu vien giup React biet:
- URL `/movies` → hien `MovieListPage`
- URL `/login` → hien `LoginPage`
- URL `/admin/rooms` → hien `AdminRoomPage`

Khong co React Router, React chi biet hien 1 component duy nhat -- khong the "chuyen trang".

---

## 2. BrowserRouter, Routes, Route -- Cau truc co ban

### Khai niem

| Component | Vai tro | Vi du doi thuong |
|---|---|---|
| `BrowserRouter` | "Nguoi quan ly" toan bo he thong routing | Giong ong truong ga, quan ly tat ca tuyen xe |
| `Routes` | "Bang lich trinh" chua tat ca tuyen | Giong bang thoi gian chuyen bay o san bay |
| `Route` | 1 tuyen cu the: URL nao → hien component nao | Giong 1 dong: "Chuyen 14:00 → Ha Noi" |

### Vi du don gian nhat

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'

function App() {
  return (
    <BrowserRouter>           {/* Bat dau quan ly routing */}
      <Routes>                {/* Bang lich trinh */}
        <Route path="/" element={<HomePage />} />
        {/*     ↑ URL      ↑ Component hien thi */}

        <Route path="/movies" element={<MovieListPage />} />
        <Route path="/login" element={<LoginPage />} />
      </Routes>
    </BrowserRouter>
  )
}
```

**Giai thich:**
- User truy cap `localhost:5173/` → React hien `<HomePage />`
- User truy cap `localhost:5173/movies` → React hien `<MovieListPage />`
- User truy cap `localhost:5173/login` → React hien `<LoginPage />`

Luu y: **Chi co 1 `BrowserRouter`** boc toan bo app. KHONG duoc dat nhieu `BrowserRouter` long nhau.

---

## 3. Layout Routes -- MainLayout vs AdminLayout

### Van de

Nhieu trang dung chung Header va Footer (trang chu, danh sach phim, dang nhap...). Neu viet Header + Footer trong moi trang → **lap code**.

### Giai phap: Layout Route

Layout Route la Route **khong co `path`**, chi co `element`. No boc cac Route con va cung cap giao dien chung (Header, Footer, Sidebar...).

```
+--------------------------------------------+
|  MainLayout                                |
|  +--------------------------------------+  |
|  |  Header (logo, menu, nut dang nhap)  |  |
|  +--------------------------------------+  |
|  |                                      |  |
|  |  <Outlet />  ← Trang con render day  |  |
|  |  (HomePage / MovieListPage / ...)    |  |
|  |                                      |  |
|  +--------------------------------------+  |
|  |  Footer (lien he, ban quyen)         |  |
|  +--------------------------------------+  |
+--------------------------------------------+
```

### Code thuc te: MainLayout

```tsx
// File: frontend/src/components/layout/MainLayout.tsx

import { Outlet } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'

export default function MainLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-[#051424] text-white">
      <Header />
      <main className="flex-1">
        <Outlet />    {/* ← Component con se duoc render o day */}
      </main>
      <Footer />
    </div>
  )
}
```

### AdminLayout khac gi MainLayout?

```
+--------------------------------------------+
|  AdminLayout                               |
|  +--------+-----------------------------+  |
|  |        |                             |  |
|  | Side-  |  <Outlet />                 |  |
|  | bar    |  (DashboardPage /           |  |
|  |        |   AdminMoviePage / ...)     |  |
|  | (menu) |                             |  |
|  |        |                             |  |
|  +--------+-----------------------------+  |
+--------------------------------------------+
```

- **MainLayout:** Header (tren) + Outlet (giua) + Footer (duoi) → cho trang cong khai
- **AdminLayout:** Sidebar (trai) + Outlet (phai) → cho trang quan tri

---

## 4. Outlet -- Cho hien thi component con

### Outlet la gi?

`Outlet` giong nhu **o trong trong 1 khung anh**. Khung anh (Layout) khong doi, nhung hinh ben trong (trang con) doi tuy theo URL.

```tsx
// Khi URL = "/" :
// MainLayout render → Header + <HomePage /> + Footer
//                               ↑ Outlet render component nay

// Khi URL = "/movies" :
// MainLayout render → Header + <MovieListPage /> + Footer
//                               ↑ Outlet doi sang component nay

// Khi URL = "/login" :
// MainLayout render → Header + <LoginPage /> + Footer
//                               ↑ Outlet lai doi sang component nay
```

**Header va Footer KHONG thay doi** -- chi phan Outlet thay doi. Day la loi ich chinh cua Layout Route: **khong tai lai phan chung**.

### Cach hoat dong ky thuat

```tsx
<Route element={<MainLayout />}>        {/* Layout cha -- co <Outlet /> */}
  <Route path="/" element={<HomePage />} />          {/* Con 1 */}
  <Route path="/movies" element={<MovieListPage />} /> {/* Con 2 */}
</Route>

// React Router thay: URL = "/movies" → match Route con thu 2
// → Render MainLayout, trong do <Outlet /> = <MovieListPage />
```

---

## 5. Nested Routes -- Duong dan long nhau

### Nested Routes la gi?

"Nested" nghia la **long nhau**. Route con nam trong Route cha, URL cua con = URL cha + URL con.

### Vi du tu CineX AppRouter

```tsx
// File: frontend/src/routes/AppRouter.tsx (dong 74-90)

{/* Route cha: AdminRoute kiem tra quyen */}
<Route element={<AdminRoute />}>
  {/* Route cha thu 2: AdminLayout cung cap sidebar */}
  <Route element={<AdminLayout />}>

    {/* Route con: URL = /admin */}
    <Route path="/admin" element={<DashboardPage />} />

    {/* Route con: URL = /admin/movies */}
    <Route path="/admin/movies" element={<AdminMoviePage />} />

    {/* Route con: URL = /admin/rooms */}
    <Route path="/admin/rooms" element={<AdminRoomPage />} />

    {/* Route con LONG SAU: URL = /admin/rooms/5/seats */}
    <Route path="/admin/rooms/:roomId/seats" element={<SeatMapEditorPage />} />

  </Route>
</Route>
```

### So do phan cap

```
/admin                → AdminRoute → AdminLayout → DashboardPage
/admin/movies         → AdminRoute → AdminLayout → AdminMoviePage
/admin/rooms          → AdminRoute → AdminLayout → AdminRoomPage
/admin/rooms/5/seats  → AdminRoute → AdminLayout → SeatMapEditorPage
                               ↑            ↑              ↑
                         Kiem tra      Render sidebar   Render noi dung
                         quyen ADMIN   + topbar         trong Outlet
```

Moi URL phai "di qua" tat ca Route cha:
1. `AdminRoute` kiem tra quyen -- khong phai ADMIN → bi da ve trang chu
2. `AdminLayout` render sidebar -- tat ca trang admin deu co sidebar
3. Component con render trong `<Outlet />` cua AdminLayout

---

## 6. useParams, useNavigate, useSearchParams

### 6.1. useParams -- Lay tham so tu URL

**Van de:** URL `/movies/42` -- lam sao biet user muon xem phim co ID = 42?

```tsx
// Route khai bao: <Route path="/movies/:id" element={<MovieDetailPage />} />
//                                      ↑ :id la tham so dong (dynamic parameter)

import { useParams } from 'react-router-dom'

function MovieDetailPage() {
  const { id } = useParams()
  // URL = /movies/42 → id = "42" (luon la string!)
  // URL = /movies/99 → id = "99"

  // Dung id de goi API lay chi tiet phim
  const { data: movie } = useQuery({
    queryKey: ['movie', id],
    queryFn: () => api.get(`/api/movies/${id}`),
  })

  return <h1>{movie?.title}</h1>
}
```

**Luu y quan trong:** `useParams()` tra ve **string**, khong phai number. Neu can number, phai chuyen doi: `Number(id)` hoac `parseInt(id)`.

### Vi du CineX: SeatMapEditorPage

```tsx
// Route: <Route path="/admin/rooms/:roomId/seats" element={<SeatMapEditorPage />} />
// URL:   /admin/rooms/5/seats

const { roomId } = useParams()
// roomId = "5"
```

### 6.2. useNavigate -- Chuyen trang bang code

**Van de:** Sau khi dang nhap thanh cong, muon tu dong chuyen ve trang chu -- khong the dung `<Link>` vi khong co click.

```tsx
import { useNavigate } from 'react-router-dom'

function LoginPage() {
  const navigate = useNavigate()

  const onSubmit = async (data) => {
    await api.post('/api/auth/login', data)
    // Dang nhap thanh cong → chuyen ve trang chu
    navigate('/')
    // Hoac chuyen ve trang truoc do:
    // navigate(-1)  // Giong nut Back tren trinh duyet
  }
}
```

**Cac cach dung navigate:**

```tsx
navigate('/movies')          // Chuyen den /movies
navigate('/movies/42')       // Chuyen den /movies/42
navigate(-1)                 // Quay lai trang truoc (Back)
navigate(-2)                 // Quay lai 2 trang truoc
navigate('/', { replace: true })  // Chuyen den / va KHONG luu trang hien tai vao lich su
```

**`replace: true` nghia la gi?**

Binh thuong, navigate them 1 trang vao lich su trinh duyet (lich su: A → B → C). Voi `replace: true`, trang hien tai bi **thay the** (lich su: A → B, C thay cho B).

Dung khi: Sau khi login xong, khong muon user bam Back quay lai trang login.

### 6.3. useSearchParams -- Lay query string tu URL

**Query string** la phan sau dau `?` trong URL: `/movies?genre=action&page=2`

```tsx
import { useSearchParams } from 'react-router-dom'

function MovieListPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const genre = searchParams.get('genre')   // "action"
  const page = searchParams.get('page')     // "2"

  // Thay doi query string (khong reload trang)
  function nextPage() {
    setSearchParams({ genre: 'action', page: '3' })
    // URL doi thanh: /movies?genre=action&page=3
  }
}
```

**Khi nao dung useSearchParams?**
- Filter/search tren trang danh sach (loc theo the loai, trang thai...)
- Phan trang (page=1, page=2...)
- Luu trang thai tren URL de share duoc link (gui ban link `/movies?genre=action` → ban thay luon danh sach phim hanh dong)

---

## 7. Code Splitting -- React.lazy() + Suspense

### Van de: File JavaScript qua lon

Khi build React app, tat ca component duoc gop thanh **1 file JavaScript** (goi la "bundle"). App cang lon → bundle cang to → user tai lau hoi dau.

```
Khong co code splitting:
bundle.js = 2MB (chua TAT CA trang: home, movies, login, admin, ...)
→ User vao trang chu phai tai 2MB, du chi can trang chu (200KB)
```

### Giai phap: Lazy Loading

"Lazy" nghia la "luoi" -- chi tai khi can. Thay vi tai het 1 lan, chia nho thanh nhieu file va **chi tai file nao khi user vao trang do**.

```
Co code splitting:
main.js = 200KB (chi chua code chung: React, Router, Header)
home.js = 50KB  (tai khi vao /)
movies.js = 80KB (tai khi vao /movies)
admin.js = 150KB (tai khi vao /admin)
→ User vao trang chu chi tai 200KB + 50KB = 250KB (thay vi 2MB)
```

### Cach dung: React.lazy() + Suspense

```tsx
import { lazy, Suspense } from 'react'

// THONG THUONG: import binh thuong (tai ngay khi app khoi dong)
import HomePage from '@/features/home/HomePage'

// LAZY: chi tai khi component duoc render lan dau
const HomePage = lazy(() => import('@/features/home/HomePage'))
//                   ↑ Ham () => import(...) chi chay khi can
```

`Suspense` la component boc ben ngoai, hien thi "dang tai..." trong khi cho lazy component tai xong:

```tsx
<Suspense fallback={<Loading />}>
  {/* Khi HomePage chua tai xong, hien <Loading /> */}
  {/* Khi tai xong, hien <HomePage /> */}
  <Routes>
    <Route path="/" element={<HomePage />} />
  </Routes>
</Suspense>
```

### Code thuc te tu CineX AppRouter

```tsx
// File: frontend/src/routes/AppRouter.tsx (dong 1-41)

import { lazy, Suspense } from 'react'
import Loading from '@/components/common/Loading'

// Lazy load -- moi trang la 1 "chunk" rieng biet
const HomePage = lazy(() => import('@/features/home/HomePage'))
const LoginPage = lazy(() => import('@/features/auth/LoginPage'))
const RegisterPage = lazy(() => import('@/features/auth/RegisterPage'))
const MovieListPage = lazy(() => import('@/features/movie/MovieListPage'))
const MovieDetailPage = lazy(() => import('@/features/movie/MovieDetailPage'))
// ... cac trang khac

// Admin -- chunk rieng (chi tai khi admin dang nhap)
const AdminLayout = lazy(() => import('@/components/admin/AdminLayout'))
const DashboardPage = lazy(() => import('@/features/admin/DashboardPage'))
const AdminMoviePage = lazy(() => import('@/features/admin/AdminMoviePage'))
// ... cac trang admin khac

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
        {/* ↑ Toan bo app duoc boc trong Suspense */}
        {/* Bat ky trang nao chua tai xong → hien <Loading /> */}
        <Routes>
          {/* ... cac Route ... */}
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
```

**Luu y:** CineX dat `<Suspense>` boc TOAN BO `<Routes>`. Co nghia la bat ky trang lazy nao chua tai xong deu hien `<Loading />`. Cach nay don gian nhung co nhuoc diem: chuyen trang nao cung thay loading (du chi 0.1 giay).

---

## 8. Protected Routes -- Bao ve trang can dang nhap

### Van de

Mot so trang chi nguoi dung da dang nhap moi duoc vao (VD: dat ve, thanh toan, trang admin). Neu chua dang nhap ma truy cap `/booking/seats/1` → phai chuyen ve `/login`.

### ProtectedRoute -- Chan user chua dang nhap

```tsx
// File: frontend/src/routes/ProtectedRoute.tsx

import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

export default function ProtectedRoute() {
  const { isLoggedIn } = useAuthStore()

  if (!isLoggedIn()) {
    // Chua dang nhap → redirect ve /login
    // replace = true: thay the trang hien tai trong lich su
    //                  (khong luu /booking vao lich su)
    return <Navigate to="/login" replace />
  }

  // Da dang nhap → cho di tiep (render Outlet = component con)
  return <Outlet />
}
```

### AdminRoute -- Chan user khong phai ADMIN

```tsx
// File: frontend/src/routes/AdminRoute.tsx

import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

export default function AdminRoute() {
  const { isLoggedIn, isAdmin } = useAuthStore()

  // Buoc 1: Kiem tra dang nhap
  if (!isLoggedIn()) {
    return <Navigate to="/login" replace />
  }

  // Buoc 2: Kiem tra quyen ADMIN
  if (!isAdmin()) {
    return <Navigate to="/" replace />
    // Khong phai admin → day ve trang chu (khong cho vao /admin)
  }

  // Da dang nhap + la ADMIN → cho vao
  return <Outlet />
}
```

### Cach su dung trong Router

```tsx
// File: frontend/src/routes/AppRouter.tsx (dong 62-69, 74-91)

{/* Nhom trang can dang nhap (bat ky user nao) */}
<Route element={<ProtectedRoute />}>
  {/*  ↑ Tat ca Route con phai qua ProtectedRoute truoc */}
  <Route path="/booking/seats/:showtimeId" element={<SeatSelectionPage />} />
  <Route path="/payment/:bookingId" element={<PaymentPage />} />
  <Route path="/my-tickets" element={<MyTicketsPage />} />
  <Route path="/profile" element={<ProfilePage />} />
</Route>

{/* Nhom trang ADMIN -- can dang nhap + quyen ADMIN */}
<Route element={<AdminRoute />}>
  <Route element={<AdminLayout />}>
    <Route path="/admin" element={<DashboardPage />} />
    <Route path="/admin/movies" element={<AdminMoviePage />} />
    {/* ... */}
  </Route>
</Route>
```

### So do luong kiem tra quyen

```
User truy cap /admin/movies
        ↓
    AdminRoute: isLoggedIn()?
        ↓
  ┌── KHONG → Navigate to="/login"
  │
  └── CO → isAdmin()?
              ↓
        ┌── KHONG → Navigate to="/"
        │
        └── CO → <Outlet /> → AdminLayout → AdminMoviePage
```

---

## 9. Link vs Navigate Component

### Link -- Nguoi dung click de chuyen trang

```tsx
import { Link } from 'react-router-dom'

// DUNG: Dung <Link> thay cho <a href>
<Link to="/movies">Danh sach phim</Link>

// SAI: Dung <a href> trong React app
<a href="/movies">Danh sach phim</a>
// ↑ Trinh duyet se RELOAD toan bo trang (mat state, cham)
```

**Tai sao KHONG dung `<a href>`?**

| | `<a href="/movies">` | `<Link to="/movies">` |
|---|---|---|
| Reload trang? | CO -- tai lai toan bo HTML, CSS, JS | KHONG -- chi doi component |
| Mat state? | CO -- tat ca useState, store bi reset | KHONG -- state duoc giu nguyen |
| Toc do | Cham (1-3 giay) | Nhanh (tuc thi) |
| Khi nao dung? | Link ra ngoai app (VD: google.com) | Chuyen trang trong app |

### Navigate -- Tu dong chuyen trang (khong can click)

```tsx
import { Navigate } from 'react-router-dom'

// Navigate la COMPONENT, khong phai ham
// Khi React render <Navigate />, trinh duyet tu dong chuyen trang

// Vi du: User da dang nhap ma vao trang login → day ve trang chu
function LoginPage() {
  const isLoggedIn = useAuthStore(s => s.isLoggedIn)

  if (isLoggedIn()) {
    return <Navigate to="/" replace />
    // ↑ Render component nay = tu dong chuyen sang /
  }

  return <form>...</form>
}
```

### useNavigate (ham) vs Navigate (component)

```tsx
// useNavigate: dung trong event handler (onClick, onSubmit, callback...)
const navigate = useNavigate()
const onLogin = () => {
  // ... goi API ...
  navigate('/')  // Chuyen trang sau khi xu ly xong
}

// Navigate: dung trong JSX (render co dieu kien)
if (!isLoggedIn()) {
  return <Navigate to="/login" />
  // Tu dong chuyen trang khi component render
}
```

**Quy tac don gian:**
- Can chuyen trang khi **render** (khong co su kien) → dung `<Navigate />`
- Can chuyen trang khi **co su kien** (click, submit, API thanh cong) → dung `useNavigate()`

---

## 10. Code thuc te tu CineX: AppRouter.tsx

```tsx
// File: frontend/src/routes/AppRouter.tsx

import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import MainLayout from '@/components/layout/MainLayout'
import ProtectedRoute from './ProtectedRoute'
import AdminRoute from './AdminRoute'
import Loading from '@/components/common/Loading'

// =============== LAZY LOAD ===============
// Trang public
const HomePage = lazy(() => import('@/features/home/HomePage'))
const LoginPage = lazy(() => import('@/features/auth/LoginPage'))
const RegisterPage = lazy(() => import('@/features/auth/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('@/features/auth/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/features/auth/ResetPasswordPage'))
const MovieListPage = lazy(() => import('@/features/movie/MovieListPage'))
const MovieDetailPage = lazy(() => import('@/features/movie/MovieDetailPage'))
const SeatSelectionPage = lazy(() => import('@/features/booking/SeatSelectionPage'))
const PaymentPage = lazy(() => import('@/features/booking/PaymentPage'))
const PaymentResultPage = lazy(() => import('@/features/booking/PaymentResultPage'))
const MyTicketsPage = lazy(() => import('@/features/booking/MyTicketsPage'))
const TicketDetailPage = lazy(() => import('@/features/booking/TicketDetailPage'))
const ProfilePage = lazy(() => import('@/features/profile/ProfilePage'))
const FavoritesPage = lazy(() => import('@/features/favorite/FavoritesPage'))

// Trang admin (chunk rieng)
const AdminLayout = lazy(() => import('@/components/admin/AdminLayout'))
const DashboardPage = lazy(() => import('@/features/admin/DashboardPage'))
const AdminMoviePage = lazy(() => import('@/features/admin/AdminMoviePage'))
const AdminRoomPage = lazy(() => import('@/features/admin/AdminRoomPage'))
const SeatMapEditorPage = lazy(() => import('@/features/admin/SeatMapEditorPage'))
const AdminShowtimePage = lazy(() => import('@/features/admin/AdminShowtimePage'))
// ... cac trang admin khac

const NotFoundPage = lazy(() => import('@/features/common/NotFoundPage'))

// =============== ROUTER ===============
export default function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
        <Routes>

          {/* ====== NHOM 1: TRANG PUBLIC (co Header + Footer) ====== */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/movies" element={<MovieListPage />} />
            <Route path="/movies/:id" element={<MovieDetailPage />} />

            {/* Payment result -- public vi redirect tu cong thanh toan */}
            <Route path="/payment/result" element={<PaymentResultPage />} />

            {/* ====== NHOM 2: TRANG CAN DANG NHAP ====== */}
            <Route element={<ProtectedRoute />}>
              <Route path="/booking/seats/:showtimeId" element={<SeatSelectionPage />} />
              <Route path="/payment/:bookingId" element={<PaymentPage />} />
              <Route path="/my-tickets" element={<MyTicketsPage />} />
              <Route path="/my-tickets/:id" element={<TicketDetailPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/favorites" element={<FavoritesPage />} />
            </Route>
          </Route>

          {/* ====== NHOM 3: TRANG ADMIN (co Sidebar, can quyen ADMIN) ====== */}
          <Route element={<AdminRoute />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<DashboardPage />} />
              <Route path="/admin/movies" element={<AdminMoviePage />} />
              <Route path="/admin/rooms" element={<AdminRoomPage />} />
              <Route path="/admin/rooms/:roomId/seats" element={<SeatMapEditorPage />} />
              <Route path="/admin/showtimes" element={<AdminShowtimePage />} />
              {/* ... cac trang admin khac */}
            </Route>
          </Route>

          {/* ====== 404 -- URL khong ton tai ====== */}
          <Route element={<MainLayout />}>
            <Route path="*" element={<NotFoundPage />} />
          </Route>

        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
```

### Phan tich cau truc

```
BrowserRouter
  └── Suspense (hien Loading khi lazy component chua tai)
       └── Routes
            ├── MainLayout (Header + Footer)
            │    ├── / → HomePage
            │    ├── /login → LoginPage
            │    ├── /register → RegisterPage
            │    ├── /movies → MovieListPage
            │    ├── /movies/:id → MovieDetailPage
            │    │
            │    └── ProtectedRoute (can dang nhap)
            │         ├── /booking/seats/:showtimeId → SeatSelectionPage
            │         ├── /payment/:bookingId → PaymentPage
            │         ├── /my-tickets → MyTicketsPage
            │         └── /profile → ProfilePage
            │
            ├── AdminRoute (can dang nhap + ADMIN)
            │    └── AdminLayout (Sidebar)
            │         ├── /admin → DashboardPage
            │         ├── /admin/movies → AdminMoviePage
            │         ├── /admin/rooms → AdminRoomPage
            │         └── /admin/rooms/:roomId/seats → SeatMapEditorPage
            │
            └── MainLayout
                 └── * → NotFoundPage (404)
```

**Diem dang chu y:**
1. **AdminRoute nam NGOAI MainLayout** -- trang admin co layout rieng (AdminLayout voi sidebar), khong dung Header/Footer cua MainLayout
2. **ProtectedRoute nam TRONG MainLayout** -- trang can dang nhap van co Header/Footer
3. **`path="*"`** -- bat tat ca URL khong khop voi cac Route o tren → hien trang 404
4. **`/payment/result` la public** -- vi khi thanh toan online, cong thanh toan redirect ve URL nay. Neu la protected, user co the bi mat session (token het han) → khong vao duoc trang ket qua

---

## 11. Cau hoi tu kiem tra

**Cau 1:** Neu ban xoa `<Suspense fallback={<Loading />}>` khoi AppRouter, dieu gi xay ra khi user truy cap trang?

> Goi y: React se bao loi. Khi dung `lazy()`, BAT BUOC phai co `<Suspense>` boc ben ngoai. Neu khong, React khong biet hien gi trong khi cho component tai xong → crash.

**Cau 2:** User chua dang nhap ma truy cap `/admin/movies`. Dieu gi xay ra theo thu tu?

> Goi y: React Router match `/admin/movies` → di qua `AdminRoute` → `isLoggedIn()` tra ve false → render `<Navigate to="/login" replace />` → trinh duyet chuyen sang `/login`. User KHONG BAO GIO thay duoc trang AdminMoviePage.

**Cau 3:** Tai sao CineX dung `<Link to="/movies">` thay vi `<a href="/movies">`? Neu doi sang `<a href>` thi user thay gi?

> Goi y: `<a href>` khien trinh duyet **reload toan bo trang** (trang trang 1 giay, mat het state trong Zustand store, mat trang thai filter/search). `<Link>` chi doi component ma khong reload → nhanh va giu state.

**Cau 4:** Trong CineX, `MovieDetailPage` dung `useParams()` de lay `id` tu URL `/movies/:id`. Kieu du lieu cua `id` la gi? Neu can dung no lam so, phai lam gi?

> Goi y: `id` luon la **string** (VD: `"42"`, khong phai `42`). Neu can number, phai chuyen doi: `Number(id)` hoac `parseInt(id, 10)`. Neu khong chuyen, phep so sanh `id === 42` se tra ve `false` (vi `"42" !== 42`).

**Cau 5:** Tai sao trang `/payment/result` nam NGOAI `ProtectedRoute` (la public), du no lien quan den thanh toan (can dang nhap)?

> Goi y: Sau khi thanh toan online, cong thanh toan (VNPay, MoMo...) redirect trinh duyet ve URL `/payment/result?...`. Qua trinh redirect nay co the khien session/token bi mat. Neu trang nay la protected, user se bi day ve `/login` thay vi thay ket qua thanh toan → trai nghiem xau. De la public de dam bao user luon thay duoc ket qua.
