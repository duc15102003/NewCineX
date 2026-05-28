# Frontend hoạt động như thế nào? — Từ gốc đến ngọn

> Giải thích toàn bộ cơ chế: từ khi user mở trình duyệt → code chạy → UI hiện ra → gọi API → cập nhật giao diện. So sánh với Backend để dễ hiểu.

---

## 1. Frontend vs Backend — Chạy ở đâu?

```
┌─────────────────────────────────────────────────────────────┐
│                    TRÌNH DUYỆT (Client)                       │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ FRONTEND (React + TypeScript)                          │ │
│  │ • Hiển thị giao diện (HTML/CSS/JS)                     │ │
│  │ • Xử lý tương tác user (click, gõ, scroll)            │ │
│  │ • Gọi API lấy dữ liệu                                 │ │
│  │ • KHÔNG truy cập database trực tiếp                    │ │
│  └────────────────────────────────────────────────────────┘ │
│                         │ HTTP Request                       │
└─────────────────────────┼───────────────────────────────────┘
                          │
                    ══════╪═══════ INTERNET ══════════
                          │
┌─────────────────────────┼───────────────────────────────────┐
│                         │ HTTP Response                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ BACKEND (Spring Boot + Java)                           │ │
│  │ • Xử lý logic nghiệp vụ                               │ │
│  │ • Truy vấn database                                    │ │
│  │ • Xác thực, phân quyền                                 │ │
│  │ • Trả dữ liệu JSON                                    │ │
│  └────────────────────────────────────────────────────────┘ │
│                    SERVER (localhost:8088)                    │
└─────────────────────────────────────────────────────────────┘
```

### So sánh nhanh

| | Backend | Frontend |
|---|---|---|
| Chạy ở đâu? | Server (máy chủ) | Trình duyệt (máy user) |
| Ngôn ngữ | Java | JavaScript/TypeScript |
| Ai chạy code? | JVM | Trình duyệt (Chrome, Firefox, ...) |
| Truy cập DB? | Trực tiếp (JPA) | KHÔNG — phải gọi API |
| User thấy code? | KHÔNG (server giữ) | CÓ (F12 DevTools thấy hết) |
| Bảo mật? | Secret an toàn | KHÔNG lưu secret (user đọc được) |

---

## 2. Single Page Application (SPA) — Chỉ 1 trang HTML

### Web truyền thống vs SPA

```
WEB TRUYỀN THỐNG (Server-Side Rendering):
────────────────────────────────────────
User click "Phim" → Trình duyệt gửi request → Server trả HTML mới → Trang TRẮNG rồi load lại
User click "Đặt vé" → Trình duyệt gửi request → Server trả HTML mới → Trang TRẮNG rồi load lại
→ Mỗi lần chuyển trang = TẢI LẠI TOÀN BỘ (chậm, nhấp nháy)

SPA (React):
────────────
User mở web → Server trả 1 file HTML + 1 file JS lớn → XONGUser click "Phim" → JavaScript đổi nội dung → KHÔNG TẢI LẠI (tức thì)
User click "Đặt vé" → JavaScript đổi nội dung → KHÔNG TẢI LẠI (tức thì)
→ Chỉ tải lần đầu. Sau đó JS lo hết (nhanh, mượt)
```

### Ví dụ đời thường

| Web truyền thống | SPA (React) |
|---|---|
| Xem TV: mỗi kênh = bật TV lại | Xem Netflix: chuyển phim = click, không cần bật lại TV |
| Đổi trang = "tắt mở" trình duyệt | Đổi trang = "đổi nội dung" trong cùng trang |

### CineX là SPA

```html
<!-- index.html — FILE DUY NHẤT được server trả về -->
<body>
  <div id="root"></div>                    <!-- Container rỗng -->
  <script src="/src/main.tsx"></script>     <!-- JS sẽ fill nội dung vào #root -->
</body>
```

Mọi thứ user thấy (header, danh sách phim, form đặt vé, ...) đều được JavaScript **sinh ra động** bên trong `<div id="root">`.

---

## 3. Luồng khởi động — Từ URL đến giao diện

```
User gõ: http://localhost:5173
         │
    ①    ▼
Trình duyệt → Vite dev server → trả index.html
         │
    ②    ▼
Trình duyệt đọc HTML → thấy <script src="/src/main.tsx">
         │
    ③    ▼
Vite compile main.tsx → JavaScript → trình duyệt chạy
         │
    ④    ▼
main.tsx thực thi:
┌──────────────────────────────────────────────────────────┐
│ createRoot(document.getElementById('root')!)              │
│   .render(<StrictMode><App /></StrictMode>)               │
│                                                          │
│ Giải thích:                                              │
│ • getElementById('root') → tìm <div id="root"> trong HTML│
│ • createRoot() → tạo "gốc" React tại div đó             │
│ • .render(<App />) → render component App vào đó         │
│ • StrictMode → check lỗi khi dev (không ảnh hưởng prod) │
└──────────────────────────────────────────────────────────┘
         │
    ⑤    ▼
App.tsx render:
┌──────────────────────────────────────────────────────────┐
│ <QueryClientProvider>    ← Cung cấp TanStack Query       │
│   <AppRouter />          ← Render Router                  │
│   <Toaster />            ← Container cho toast popup      │
│ </QueryClientProvider>                                    │
└──────────────────────────────────────────────────────────┘
         │
    ⑥    ▼
AppRouter.tsx kiểm tra URL hiện tại:
┌──────────────────────────────────────────────────────────┐
│ URL = "/" → render <HomePage />                           │
│ URL = "/movies" → render <MovieListPage />                │
│ URL = "/login" → render <LoginPage />                     │
│ URL = "/booking/5" → render <SeatSelectionPage id=5 />    │
└──────────────────────────────────────────────────────────┘
         │
    ⑦    ▼
Component render → sinh HTML → trình duyệt hiển thị UI
```

### So sánh với Backend

| FE (React) | BE (Spring Boot) |
|---|---|
| `main.tsx` | `CineXApplication.java (main)` |
| `createRoot().render(<App />)` | `SpringApplication.run()` |
| `App.tsx` (root component) | Spring Container (root) |
| `AppRouter` (match URL → component) | `DispatcherServlet` (match URL → controller) |
| `QueryClientProvider` (context) | ApplicationContext (container) |

---

## 4. Component — Khối xây dựng UI

### Component là gì?

**Function** trả về **JSX** (HTML trong JavaScript). Mỗi component = 1 phần giao diện **độc lập, tái sử dụng**.

```tsx
// Component = function trả về giao diện
function MovieCard({ title, poster, rating }) {
  return (
    <div className="rounded-lg shadow-md p-4">
      <img src={poster} alt={title} />
      <h3 className="font-bold">{title}</h3>
      <span>{rating}/10</span>
    </div>
  )
}
```

### Cây component (Component Tree)

```
App                              ← Gốc (root)
├── QueryClientProvider          ← Provider (cung cấp context)
├── AppRouter                    ← Router
│   └── HomePage                 ← Trang chủ
│       ├── Header               ← Header navigation
│       │   ├── Logo
│       │   ├── NavLinks
│       │   └── UserDropdown
│       ├── MovieGrid            ← Lưới phim
│       │   ├── MovieCard        ← Thẻ phim 1
│       │   ├── MovieCard        ← Thẻ phim 2
│       │   └── MovieCard        ← Thẻ phim 3
│       └── Footer
└── Toaster                      ← Toast notifications
```

### So sánh với BE

| FE (Component) | BE (Class) |
|---|---|
| `MovieCard` component | `MovieResponse` DTO |
| Component nhận props (dữ liệu) | Method nhận parameters |
| Component trả về JSX (giao diện) | Method trả về JSON (data) |
| Component lồng nhau (tree) | Class phụ thuộc nhau (DI) |
| Re-render khi data đổi | — |

---

## 5. JSX — HTML bên trong JavaScript

### JSX là gì?

Cú pháp đặc biệt cho phép viết **HTML bên trong JavaScript**. Trình duyệt KHÔNG hiểu JSX — Vite compile thành JavaScript thuần.

```tsx
// BẠN VIẾT (JSX):
function Welcome({ name }) {
  return <h1 className="text-xl">Hello, {name}!</h1>
}

// VITE COMPILE THÀNH (JavaScript thuần):
function Welcome({ name }) {
  return React.createElement('h1', { className: 'text-xl' }, 'Hello, ' + name + '!')
}

// TRÌNH DUYỆT NHẬN JavaScript thuần → render ra HTML thật:
// <h1 class="text-xl">Hello, Vũ!</h1>
```

### Quy tắc JSX (khác HTML thường)

| HTML thường | JSX | Lý do |
|---|---|---|
| `class="btn"` | `className="btn"` | `class` là từ khóa JS |
| `for="email"` | `htmlFor="email"` | `for` là từ khóa JS |
| `style="color: red"` | `style={{ color: 'red' }}` | Object thay vì string |
| `<img>` | `<img />` | Phải tự đóng tag |
| `onclick="fn()"` | `onClick={fn}` | camelCase + function reference |

### Biểu thức trong JSX

```tsx
function MovieCard({ movie }) {
  return (
    <div>
      {/* Biến */}
      <h3>{movie.title}</h3>

      {/* Điều kiện (if/else) */}
      {movie.rating > 8 && <span className="text-yellow-500">Hot!</span>}

      {/* Ternary (if ? a : b) */}
      <span>{movie.status === 'NOW_SHOWING' ? 'Đang chiếu' : 'Sắp chiếu'}</span>

      {/* Loop (map) */}
      {movie.genres.map(genre => (
        <span key={genre.id} className="badge">{genre.name}</span>
      ))}
    </div>
  )
}
```

---

## 6. State — Dữ liệu thay đổi → UI tự cập nhật

### State là gì?

**Biến đặc biệt** của React. Khi state thay đổi → React **tự động render lại** component → UI cập nhật.

### Ví dụ đời thường

State = **bảng điểm** trên sân bóng. Mỗi lần ghi bàn → bảng điểm tự update → khán giả thấy ngay.

Biến thường (let, const) = **ghi trên giấy nháp**. Thay đổi giá trị nhưng KHÔNG AI THẤY (UI không update).

### useState — State cục bộ (1 component)

```tsx
import { useState } from 'react'

function SeatSelection() {
  // Khai báo state: selectedSeats = giá trị hiện tại, setSelectedSeats = hàm thay đổi
  const [selectedSeats, setSelectedSeats] = useState<string[]>([])
  //                                                           ↑ giá trị ban đầu: mảng rỗng

  const handleSeatClick = (seatId: string) => {
    setSelectedSeats(prev => [...prev, seatId])  // Thêm ghế vào danh sách
    // → React tự render lại → UI hiện ghế đã chọn (màu xanh lá)
  }

  return (
    <div>
      <p>Đã chọn: {selectedSeats.length} ghế</p>
      {/* Khi selectedSeats thay đổi → dòng trên TỰ ĐỘNG cập nhật */}
    </div>
  )
}
```

### Khi nào state thay đổi → chuyện gì xảy ra?

```
1. User click ghế E5
       │
2.     ▼ handleSeatClick("E5")
       │
3.     ▼ setSelectedSeats([..., "E5"])  ← CẬP NHẬT STATE
       │
4.     ▼ React phát hiện state mới ≠ state cũ
       │
5.     ▼ React GỌI LẠI function SeatSelection() (re-render)
       │
6.     ▼ JSX trả về HTML mới (với ghế E5 đã highlight)
       │
7.     ▼ React so sánh HTML mới vs HTML cũ (Virtual DOM diffing)
       │
8.     ▼ Chỉ cập nhật PHẦN THAY ĐỔI trên DOM thật
       │
9.     ▼ User thấy ghế E5 đổi màu (CỰC NHANH, không reload trang)
```

### So sánh với BE

| FE (State + Re-render) | BE (Request/Response) |
|---|---|
| State thay đổi → UI tự cập nhật | Client gửi request → Server xử lý → trả response |
| Xảy ra trên trình duyệt (tức thì) | Qua network (có độ trễ) |
| React quyết định render lại | Client quyết định gọi lại |

---

## 7. Virtual DOM — Tại sao React nhanh?

### DOM là gì?

**D**ocument **O**bject **M**odel = cấu trúc cây HTML mà trình duyệt quản lý.

```
DOM Tree:
document
└── html
    ├── head (title, meta, ...)
    └── body
        └── div#root
            └── div.movie-grid
                ├── div.movie-card (Avengers)
                ├── div.movie-card (Spider-Man)
                └── div.movie-card (Batman)
```

**Vấn đề:** Thao tác DOM thật rất **CHẬM** (trình duyệt phải tính toán lại layout, repaint, ...).

### Virtual DOM — Bản nháp trước khi sửa DOM thật

```
STATE THAY ĐỔI
     │
     ▼
React render component → tạo Virtual DOM MỚI (JavaScript object, RẤT NHANH)
     │
     ▼
So sánh Virtual DOM mới vs Virtual DOM cũ (Diffing)
     │
     ▼
Tìm ra CHÍNH XÁC phần nào khác nhau
     │
     ▼
CHỈ cập nhật phần khác trên DOM thật (Reconciliation)
     │
     ▼
Trình duyệt chỉ repaint phần nhỏ → NHANH
```

### Ví dụ đời thường

| Không có Virtual DOM | Có Virtual DOM |
|---|---|
| Xây lại CẢ NGÔI NHÀ mỗi khi muốn sơn 1 bức tường | Chỉ sơn ĐÚng 1 bức tường cần sơn |
| Viết lại CẢ BÀI VĂN khi sửa 1 từ | Chỉ sửa ĐÚNG 1 từ bằng bút xóa |

### Trong CineX

User chọn thêm 1 ghế → React CHỈ cập nhật:
- 1 ô ghế đổi màu (xanh lá)
- 1 dòng text "Đã chọn: 3 ghế"
- 1 số tiền tổng

KHÔNG render lại: header, footer, sơ đồ 200 ghế khác, poster phim, ...

---

## 8. Props — Truyền dữ liệu giữa component

### Props là gì?

**Dữ liệu truyền từ component CHA → component CON.** Giống parameter của function.

```tsx
// CHA truyền props:
<MovieCard title="Avengers" rating={9.2} poster="/avengers.jpg" />

// CON nhận props:
function MovieCard({ title, rating, poster }) {
  return (
    <div>
      <img src={poster} />
      <h3>{title}</h3>       {/* "Avengers" */}
      <span>{rating}/10</span>  {/* "9.2/10" */}
    </div>
  )
}
```

### Ví dụ đời thường

Props = **đơn hàng** gửi cho nhà bếp:
- Khách (cha) viết: "1 phở bò, không hành, thêm giá"
- Bếp (con) nhận đơn → nấu theo yêu cầu
- Bếp KHÔNG được sửa đơn (props là **read-only**)

### Props vs State

| Props | State |
|---|---|
| Truyền từ CHA xuống CON | Thuộc về CHÍNH component đó |
| **Read-only** (con không sửa được) | **Mutable** (component tự sửa) |
| Giống: tham số hàm | Giống: biến cục bộ |
| Thay đổi khi cha re-render | Thay đổi khi gọi setState |

---

## 9. Routing — Chuyển trang không reload

### React Router hoạt động thế nào?

```tsx
// AppRouter.tsx
<BrowserRouter>           {/* Bật chế độ client-side routing */}
  <Routes>                {/* Container chứa tất cả route */}
    <Route path="/" element={<HomePage />} />
    <Route path="/movies" element={<MovieListPage />} />
    <Route path="/movies/:id" element={<MovieDetailPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/booking/:showtimeId" element={<SeatSelectionPage />} />
  </Routes>
</BrowserRouter>
```

### Luồng hoạt động

```
User click: <Link to="/movies/5">Xem chi tiết</Link>
     │
     ▼
React Router:
1. Thay đổi URL trên thanh địa chỉ → /movies/5 (History API)
2. KHÔNG gửi request lên server (KHÔNG reload trang!)
3. So sánh URL mới với danh sách Route
4. Match: path="/movies/:id" → id = 5
5. Render: <MovieDetailPage /> (thay thế component cũ)
     │
     ▼
MovieDetailPage render → gọi API lấy phim id=5 → hiện chi tiết
```

### So sánh với BE

| FE Routing (React Router) | BE Routing (Spring MVC) |
|---|---|
| Match URL → render Component | Match URL → gọi Controller method |
| Chạy trên trình duyệt | Chạy trên server |
| Không reload trang | Trả response JSON |
| `<Route path="/movies/:id">` | `@GetMapping("/movies/{id}")` |
| `useParams().id` | `@PathVariable Long id` |

---

## 10. Gọi API — Frontend nói chuyện với Backend

### Luồng hoàn chỉnh: User đăng nhập

```
①  User nhập username + password → click "Đăng nhập"
         │
②       ▼ React gọi: api.post('/api/auth/login', { username, password })
         │
③       ▼ Axios interceptor gắn header Content-Type: application/json
         │
④       ▼ HTTP Request gửi đi:
         │   POST http://localhost:8088/api/auth/login
         │   Body: {"username":"admin","password":"Admin@123"}
         │
         │ ═══════ NETWORK (localhost) ═══════
         │
⑤       ▼ Backend Spring Boot nhận request
         │   → AuthController.login()
         │   → AuthService.authenticate()
         │   → check DB, hash password, tạo JWT
         │
⑥       ▼ Backend trả response:
         │   {
         │     "success": true,
         │     "data": {
         │       "accessToken": "eyJhbGciOiJI...",
         │       "refreshToken": "abc123..."
         │     }
         │   }
         │
         │ ═══════ NETWORK ═══════
         │
⑦       ▼ Axios nhận response → trả về cho React
         │
⑧       ▼ React lưu token: authStore.setToken(accessToken)
         │   → localStorage.setItem('token', accessToken)
         │
⑨       ▼ Redirect đến trang chủ: navigate('/')
         │
⑩       ▼ Trang chủ render → Header hiện "Xin chào, admin"
```

### Axios — HTTP client

```tsx
// src/api/axios.ts
import axios from 'axios'

// Tạo instance axios với config mặc định
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,  // "http://localhost:8088"
  headers: { 'Content-Type': 'application/json' },
})

// REQUEST INTERCEPTOR: chạy TRƯỚC MỖI request gửi đi
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
    // → Mọi request tự có header: Authorization: Bearer eyJhbG...
    // → Backend đọc header này để biết ai đang gọi
  }
  return config
})

// RESPONSE INTERCEPTOR: chạy SAU MỖI response nhận về
api.interceptors.response.use(
  (response) => response,  // Thành công → trả về bình thường
  (error) => {
    if (error.response?.status === 401) {
      // Token hết hạn hoặc không hợp lệ
      localStorage.removeItem('token')    // Xóa token cũ
      window.location.href = '/login'     // Đá về trang login
    }
    return Promise.reject(error)
  },
)

export default api
```

### Ví dụ đời thường: Interceptor

Interceptor = **bảo vệ cổng**:
- **Request interceptor:** Trước khi ra ngoài (gửi request), bảo vệ gắn thẻ "nhân viên" (Bearer token) lên ngực bạn
- **Response interceptor:** Khi quay về, nếu có giấy "bị cấm" (401) → bảo vệ đưa bạn về phòng đăng ký lại (redirect /login)

---

## 11. TanStack Query — Quản lý dữ liệu từ server

### Vấn đề: Gọi API thuần rất phức tạp

```tsx
// ❌ Tự viết (phải xử lý nhiều thứ):
function MovieList() {
  const [movies, setMovies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    api.get('/api/movies')
      .then(res => setMovies(res.data.data))
      .catch(err => setError(err))
      .finally(() => setLoading(false))
  }, [])

  // Vẫn thiếu: retry khi lỗi, cache, refetch, loading skeleton, ...
}
```

### Giải pháp: TanStack Query

```tsx
// ✓ Dùng TanStack Query (tất cả đều có sẵn):
function MovieList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['movies'],                    // Cache key (giống cache key Redis)
    queryFn: () => api.get('/api/movies'),   // Hàm gọi API
  })

  // TỰ ĐỘNG có: loading state, error state, cache, retry, refetch, ...
}
```

### TanStack Query hoạt động thế nào?

```
Component mount (hiện lên màn hình)
     │
     ▼
useQuery kiểm tra cache: có data cho key ['movies'] không?
     │
     ├── CÓ cache (fresh) → trả data NGAY LẬP TỨC (0ms)
     │
     └── KHÔNG có / cache stale → gọi queryFn (API call)
              │
              ▼
         isLoading = true → hiện Skeleton
              │
              ▼
         API trả response
              │
              ▼
         Lưu vào cache (key: ['movies'])
              │
              ▼
         isLoading = false → hiện data
              │
              ▼
         Lần sau cùng key → lấy từ cache (KHÔNG gọi API lại)
```

### Ví dụ đời thường

TanStack Query = **tủ lạnh thông minh**:
- Lần đầu bạn muốn sữa → đi siêu thị mua (gọi API) → bỏ tủ lạnh (cache)
- Lần sau muốn sữa → mở tủ lạnh lấy ngay (cache hit) → KHÔNG cần đi siêu thị
- Sữa hết hạn (stale) → tự động đi mua lại (refetch)

### So sánh với BE

| FE (TanStack Query) | BE (Redis Cache) |
|---|---|
| Cache data trong memory trình duyệt | Cache data trong Redis server |
| Key: `['movies', { page: 1 }]` | Key: `"movies:page:1"` |
| Stale time: 5 phút | TTL: 5 phút |
| Tự refetch khi stale | Tự query DB khi cache miss |
| Invalidate khi mutation | Invalidate khi update entity |

---

## 12. Zustand — State toàn cục (Global State)

### Vấn đề: State cần chia sẻ giữa nhiều component

```
Header cần biết: user đang login không? (hiện tên / hiện nút login)
SeatPage cần biết: user đang login không? (cho đặt vé / redirect login)
ProfilePage cần biết: user info (hiện form edit)
→ Cả 3 component cần CÙNG dữ liệu (auth state)
```

### Zustand store

```tsx
// src/store/authStore.ts
import { create } from 'zustand'

interface AuthState {
  token: string | null
  setToken: (token: string | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  // STATE: dữ liệu
  token: localStorage.getItem('token'),  // Khởi tạo từ localStorage (giữ login khi F5)

  // ACTIONS: hàm thay đổi state
  setToken: (token) => {
    if (token) {
      localStorage.setItem('token', token)   // Lưu vào localStorage (persist)
    } else {
      localStorage.removeItem('token')
    }
    set({ token })  // Cập nhật state → tất cả component dùng store sẽ re-render
  },

  logout: () => {
    localStorage.removeItem('token')
    set({ token: null })  // Clear state → Header re-render (hiện nút Login)
  },
}))
```

### Cách dùng (bất kỳ component nào)

```tsx
function Header() {
  const { token, logout } = useAuthStore()  // Lấy state + action

  return (
    <header>
      {token ? (
        // Đã login → hiện tên + nút logout
        <button onClick={logout}>Đăng xuất</button>
      ) : (
        // Chưa login → hiện nút login
        <Link to="/login">Đăng nhập</Link>
      )}
    </header>
  )
}
```

### Luồng hoạt động

```
LoginPage: authStore.setToken("eyJhbG...")
     │
     ▼
Zustand cập nhật state: token = "eyJhbG..."
     │
     ▼
TẤT CẢ component đang dùng useAuthStore() → nhận state mới → re-render
     │
     ├── Header → thấy token !== null → hiện "Xin chào, admin" + nút Đăng xuất
     ├── ProtectedRoute → thấy token → cho vào trang
     └── Axios interceptor → đọc từ localStorage → gắn header
```

### So sánh với BE

| FE (Zustand Store) | BE (Spring Bean Singleton) |
|---|---|
| 1 store dùng chung cho cả app | 1 Bean dùng chung cho cả app |
| Lưu state (token, user info) | Lưu state (cache, config) |
| Thay đổi → component re-render | Thay đổi → (không tự notify) |
| `useAuthStore()` hook | `@Autowired AuthService` inject |

---

## 13. Tailwind CSS — Style bằng class

### CSS truyền thống vs Tailwind

```tsx
// ❌ CSS truyền thống: viết file .css riêng
// styles.css:
// .movie-card { border-radius: 8px; padding: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
// .movie-title { font-size: 18px; font-weight: bold; color: #1a1a1a; }
// → Phải đặt tên class, mở file khác, dễ conflict tên

// ✓ Tailwind: viết class trực tiếp trong JSX
<div className="rounded-lg p-4 shadow-md">
  <h3 className="text-lg font-bold text-gray-900">{title}</h3>
</div>
// → Không cần file CSS riêng, không conflict, đọc là hiểu
```

### Đọc Tailwind class

```
className="rounded-lg p-4 shadow-md text-lg font-bold text-gray-900"
            │          │    │         │        │         │
            │          │    │         │        │         └── color: #111827
            │          │    │         │        └── font-weight: 700
            │          │    │         └── font-size: 18px
            │          │    └── box-shadow: ...
            │          └── padding: 16px (4 * 4px)
            └── border-radius: 8px
```

### Tại sao dùng Tailwind?

| CSS truyền thống | Tailwind |
|---|---|
| Mở 2 file (JS + CSS) | 1 file duy nhất |
| Đặt tên class (đau đầu) | Dùng class có sẵn |
| File CSS ngày càng to | Chỉ generate class đã dùng |
| Dễ conflict tên class | Không thể conflict |
| Sửa 1 chỗ ảnh hưởng nhiều nơi | Scope trong component |

---

## 14. Luồng dữ liệu tổng thể trong CineX

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (Trình duyệt)                       │
│                                                                 │
│  ┌──── Zustand Store ────┐    ┌──── TanStack Query Cache ────┐  │
│  │ • token               │    │ • ['movies']: [...phim]       │  │
│  │ • user info           │    │ • ['movie', 5]: {chi tiết}    │  │
│  │ (auth state)          │    │ • ['showtimes', 5]: [...]     │  │
│  └───────────┬───────────┘    │ (server data cache)           │  │
│              │                └──────────────┬────────────────┘  │
│              │                               │                   │
│  ┌─────────────▼───────────────────────────────▼──────────────┐  │
│  │                    COMPONENTS                               │  │
│  │                                                            │  │
│  │  Header ← đọc Zustand (token → hiện tên/nút login)        │  │
│  │  MovieList ← đọc Query Cache (movies → render grid)       │  │
│  │  SeatMap ← đọc Query Cache (seats → render sơ đồ)         │  │
│  │           + useState local (selectedSeats → highlight)     │  │
│  │                                                            │  │
│  └───────────────────────────────┬────────────────────────────┘  │
│                                  ▼ Axios (khi cần data mới)      │
│                                  │ • request interceptor: +token │
│                                  │ • response interceptor: 401→login│
└──────────────────────────────────┼───────────────────────────────┘
                                   │
                           HTTP Request/Response
                                   │
┌──────────────────────────────────┼───────────────────────────────┐
│                                  │                               │
│              BACKEND (localhost:8088)                            │
│              Spring Boot + SQL Server + Redis                    │
└──────────────────────────────────────────────────────────────────┘
```

### Khi nào dùng cái gì?

| Loại dữ liệu | Lưu ở đâu | Ví dụ |
|---|---|---|
| Server data (từ API) | TanStack Query cache | Danh sách phim, suất chiếu, vé |
| Auth state | Zustand + localStorage | Token, username, role |
| UI state (tạm thời) | useState (local) | Ghế đang chọn, modal open/close |
| Form data | react-hook-form | Input đang nhập, validation errors |

---

## 15. Build Production — Đóng gói deploy

### Dev vs Production

```bash
# DEV: nhanh, có hot reload, code chưa optimize
npm run dev
→ Vite dev server chạy, compile khi cần, file chưa nén

# PRODUCTION: optimize, nén, chia nhỏ file
npm run build
→ Tạo thư mục dist/ chứa HTML/JS/CSS đã optimize
```

### npm run build làm gì?

```
1. TypeScript kiểm tra lỗi type (tsc -b)
       │
2.     ▼ Vite build:
       │
3.     ▼ Bundle: gộp hàng trăm file .tsx thành vài file .js
       │
4.     ▼ Tree-shaking: xóa code KHÔNG DÙNG (VD: icon không import)
       │
5.     ▼ Minify: xóa khoảng trắng, đổi tên biến ngắn (a,b,c)
       │
6.     ▼ Code-splitting: chia thành chunks (load khi cần)
       │
7.     ▼ Kết quả: thư mục dist/
              ├── index.html (< 1KB)
              ├── assets/
              │   ├── index-a1b2c3.js (≈300KB — code app)
              │   ├── vendor-d4e5f6.js (≈200KB — thư viện React, ...)
              │   └── index-g7h8i9.css (≈50KB — Tailwind compiled)
              └── favicon.svg
```

### So sánh với BE

| FE `npm run build` | BE `./gradlew build` |
|---|---|
| Tạo dist/ (HTML/JS/CSS tĩnh) | Tạo JAR (Java bytecode) |
| Serve bằng Nginx/CDN | Chạy bằng `java -jar` |
| User download JS về trình duyệt | Code ở trên server, user không thấy |
| ~500KB total | ~50MB JAR |

---

## 16. Tổng kết — Bản đồ kiến thức FE

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND STACK                                │
│                                                                     │
│  package.json ──→ npm install ──→ node_modules/                     │
│       │                                                             │
│       ▼                                                             │
│  Vite (build tool)                                                  │
│  ├── Plugin: React (compile JSX)                                    │
│  ├── Plugin: Tailwind (compile CSS)                                 │
│  ├── Dev server: HMR (Hot Module Replacement)                       │
│  └── Build: bundle + minify + split → dist/                        │
│       │                                                             │
│       ▼                                                             │
│  TypeScript (type safety) → compile → JavaScript                    │
│       │                                                             │
│       ▼                                                             │
│  React (UI framework)                                               │
│  ├── Component: function → JSX → UI                                 │
│  ├── State: useState (local) + Zustand (global)                     │
│  ├── Props: cha → con (read-only)                                   │
│  ├── Virtual DOM: diff → update phần thay đổi                       │
│  └── Re-render: state/props đổi → UI tự update                     │
│       │                                                             │
│       ▼                                                             │
│  React Router (routing)                                             │
│  └── URL → match Route → render Component (không reload)            │
│       │                                                             │
│       ▼                                                             │
│  Data Layer                                                         │
│  ├── Axios: HTTP client + interceptors (token, 401)                 │
│  ├── TanStack Query: cache server data, auto refetch                │
│  └── Zustand: global state (auth, UI)                               │
│       │                                                             │
│       ▼                                                             │
│  UI Layer                                                           │
│  ├── Tailwind CSS: utility classes (không viết CSS riêng)           │
│  ├── Components: Button, Card, Dialog, Table, ... (shadcn-style)    │
│  ├── Sonner: toast notification                                     │
│  ├── Lucide: icons                                                  │
│  └── Recharts: biểu đồ                                             │
│                                                                     │
│  Forms                                                              │
│  ├── react-hook-form: quản lý form state                            │
│  └── Zod: validation schema                                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 17. Câu hỏi tự kiểm tra

1. **SPA là gì?** Tại sao React chỉ cần 1 file HTML? Chuyện gì xảy ra khi user click link?

2. **Virtual DOM giải quyết vấn đề gì?** Nếu không có Virtual DOM, mỗi lần state đổi thì sao?

3. **State vs Props khác nhau thế nào?** Khi nào dùng useState, khi nào dùng props?

4. **Tại sao cần Zustand?** Không dùng Zustand thì truyền token cho Header như thế nào? (Prop drilling)

5. **Axios interceptor hoạt động thế nào?** Token được gắn vào request ở đâu? Khi nào user bị đá về /login?

6. **TanStack Query cache hoạt động thế nào?** Nếu 3 component cùng gọi useQuery(['movies']), API bị gọi mấy lần?

7. **npm run build tạo ra gì?** Tại sao file production nhỏ hơn nhiều so với code dev?
