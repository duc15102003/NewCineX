# Feature Movie trong FE — Giải thích chi tiết

## 1. Tổng quan

Feature Movie gồm 3 trang:
- **Trang chủ** (`/`) — hero banner + grid phim đang chiếu + sắp chiếu
- **Danh sách phim** (`/movies`) — search + filter thể loại + pagination
- **Chi tiết phim** (`/movies/:id`) — poster + trailer + suất chiếu theo ngày

## 2. Luồng data: User mở danh sách phim

```
User mở /movies
    │
    ▼
AppRouter match → render MovieListPage.tsx
    │
    ▼
MovieListPage khởi tạo state:
    keyword = ""           (ô tìm kiếm)
    genreId = null         (filter thể loại)
    page = 0               (phân trang)
    │
    ▼
useMovies({ keyword, genreId, status: "NOW_SHOWING", page }) gọi API
    │  queryKey: ['movies', { keyword, status, genreId, page }]
    │  TanStack Query check cache → miss → gọi API
    │
    ▼
Axios: GET http://localhost:8088/api/movies?status=NOW_SHOWING&page=0&size=20
    │  (interceptor tự gắn JWT token nếu có)
    │
    ▼
Backend: MovieController → MovieService → MovieSpecification → DB
    │  Response JSON: { success: true, data: { content: [...], totalPages: 3 } }
    │
    ▼
TanStack Query lưu cache + trả data cho component
    │
    ▼
MovieListPage re-render:
    ├── SearchBar (input tìm kiếm)
    ├── GenreFilter (chip buttons: Tất cả, Action, Horror, ...)
    ├── MovieGrid → map movies → MovieCard × 20
    └── Pagination (Trước | Trang 1/3 | Sau)
```

## 3. Debounce — không gọi API mỗi ký tự

```
User gõ "Ave" → 3 ký tự → NẾU không debounce:
    Gõ "A"   → API call 1: ?keyword=A
    Gõ "Av"  → API call 2: ?keyword=Av
    Gõ "Ave" → API call 3: ?keyword=Ave
    → 3 API calls trong 0.3 giây → lãng phí!

CÓ debounce 300ms:
    Gõ "A"   → chờ...
    Gõ "Av"  → chờ... (reset timer)
    Gõ "Ave" → chờ 300ms... → API call: ?keyword=Ave
    → CHỈ 1 API call → tiết kiệm!
```

```typescript
// SearchBar.tsx
const [localValue, setLocalValue] = useState(value)

useEffect(() => {
    const timer = setTimeout(() => {
        onChange(localValue)  // Sau 300ms mới gọi
    }, 300)
    return () => clearTimeout(timer)  // User gõ tiếp → hủy timer cũ
}, [localValue])
```

## 4. MovieCard — component tái sử dụng

```
MovieCard nhận 1 prop: movie (MovieListItem)
    │
    ├── Poster (ảnh hoặc "No Poster")
    ├── Badge trạng thái (Đang chiếu = xanh, Sắp chiếu = cam)
    ├── Title (truncate nếu dài)
    ├── Duration + Rating (icon Clock + Star)
    └── Genres (chip, max 3)

Bọc trong <Link to={`/movies/${movie.id}`}> → click → navigate chi tiết
```

**Tại sao tách component?**
```
MovieCard dùng ở:
    1. HomePage → section "Đang chiếu"
    2. HomePage → section "Sắp chiếu"
    3. MovieListPage → grid kết quả search

Nếu không tách → viết 3 lần cùng code → vi phạm DRY
Tách → viết 1 lần, dùng 3 nơi
```

## 5. Chi tiết phim + Suất chiếu theo ngày

```
User mở /movies/1
    │
    ▼
MovieDetailPage:
    ├── useMovie(1) → GET /api/movies/1 → chi tiết phim
    │
    ├── Render: poster, title, genres, duration, rating, director, cast, description
    │
    ├── Trailer (nếu có trailerUrl):
    │   <iframe src="https://youtube.com/embed/xxx" />
    │   → Nhúng video YouTube trực tiếp
    │
    └── Suất chiếu:
        ├── Date selector: 7 buttons (Hôm nay, Ngày mai, ..., +6 ngày)
        │   selectedDate = "2026-05-24" (mặc định hôm nay)
        │
        ├── useShowtimes(movieId=1, date="2026-05-24")
        │   → GET /api/showtimes?movieId=1&date=2026-05-24
        │   → [{ id:1, startTime:"14:00", roomName:"IMAX", basePrice:75000 }, ...]
        │
        └── Grid suất chiếu:
            ┌─────────────────────────────────────────┐
            │ 14:00 - 16:45  |  Room IMAX  |  [Đặt vé] │
            │ 19:00 - 21:45  |  Room 1     |  [Đặt vé] │
            └─────────────────────────────────────────┘
            Click "Đặt vé" → navigate /booking/seats/{showtimeId}
```

## 6. TanStack Query cache — tại sao nhanh

```
User mở /movies → API call → cache ['movies', { status: "NOW_SHOWING", page: 0 }]
User mở /movies/1 → API call → cache ['movie', 1]
User bấm Back → /movies → KHÔNG gọi API → đọc từ cache → render NGAY!

Tại sao:
    queryKey = ['movies', { status, page }]
    TanStack Query check: "key này đã có trong cache chưa?"
    → Có + chưa stale → trả cache ngay (0ms)
    → Có + đã stale → trả cache ngay + background refetch
    → Không có → gọi API
```

## 7. Câu hỏi tự kiểm tra

1. **Debounce 300ms nghĩa là gì?** → Chờ user ngừng gõ 300ms mới gọi API. Gõ liên tục → chỉ gọi 1 lần cuối.

2. **TanStack Query cache hoạt động thế nào?** → queryKey = key cache. Cùng key → trả cache, không gọi API lại. User back/forward → instant.

3. **MovieCard là component — tại sao tách riêng?** → Dùng ở 3 nơi (HomePage × 2 + MovieListPage). Tách = viết 1 lần, dùng 3 nơi.

4. **Suất chiếu thay đổi khi chọn ngày khác → gọi API mới không?** → Có, useShowtimes(movieId, date) có queryKey chứa date → đổi date = key mới = gọi API mới.
