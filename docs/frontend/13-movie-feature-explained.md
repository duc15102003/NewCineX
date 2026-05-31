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

---

## 8. Hooks đầy đủ cho Movie Feature

```ts
// hooks/useMovies.ts
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/axios";

export const useMovies = (params: MovieFilter) => {
  return useQuery({
    queryKey: ["movies", params],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<PageResponse<Movie>>>(
        "/api/movies",
        { params }
      );
      return data.data;
    },
    placeholderData: (prev) => prev,  // giữ data cũ khi đổi page
  });
};

export const useMovie = (id: number) => {
  return useQuery({
    queryKey: ["movies", id],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Movie>>(`/api/movies/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
};

export const useGenres = () => {
  return useQuery({
    queryKey: ["genres"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Genre[]>>("/api/genres");
      return data.data;
    },
    staleTime: 1000 * 60 * 60,  // 1 giờ — genres ít đổi
  });
};

export const useShowtimes = (movieId: number, date: string) => {
  return useQuery({
    queryKey: ["showtimes", movieId, date],
    queryFn: async () => {
      const { data } = await api.get(`/api/movies/${movieId}/showtimes`, {
        params: { date },
      });
      return data.data;
    },
    enabled: !!movieId && !!date,
  });
};

export const useReviews = (movieId: number, page = 0) => {
  return useQuery({
    queryKey: ["reviews", movieId, page],
    queryFn: async () => {
      const { data } = await api.get(`/api/movies/${movieId}/reviews`, {
        params: { page, size: 10 },
      });
      return data.data;
    },
  });
};

export const useToggleFavorite = (movieId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (isFavorited: boolean) => {
      if (isFavorited) {
        await api.delete(`/api/users/me/favorites/${movieId}`);
      } else {
        await api.post(`/api/users/me/favorites/${movieId}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
      queryClient.invalidateQueries({ queryKey: ["movie-favorited", movieId] });
    },
  });
};
```

---

## 9. URL Sync với useSearchParams

User search "avengers" → URL: `/movies?q=avengers`. User chia sẻ link → người khác mở thấy ngay kết quả.

```tsx
import { useSearchParams } from "react-router-dom";

function MovieListPage() {
  const [params, setParams] = useSearchParams();

  const filter: MovieFilter = {
    keyword: params.get("q") ?? "",
    genreId: params.get("genre") ? Number(params.get("genre")) : undefined,
    page: Number(params.get("page") ?? 0),
  };

  const { data } = useMovies(filter);

  const updateFilter = (next: Partial<MovieFilter>) => {
    const merged = { ...filter, ...next, page: 0 };  // reset page khi đổi filter
    setParams(
      Object.fromEntries(
        Object.entries(merged).filter(([_, v]) => v !== undefined && v !== "")
      )
    );
  };

  return (
    <>
      <input
        value={filter.keyword}
        onChange={(e) => updateFilter({ keyword: e.target.value })}
      />
      <select
        value={filter.genreId ?? ""}
        onChange={(e) => updateFilter({ genreId: Number(e.target.value) })}
      >
        ...
      </select>
      <MovieGrid movies={data?.content ?? []} />
      <Pagination
        current={data?.number ?? 0}
        total={data?.totalPages ?? 0}
        onChange={(page) => updateFilter({ page })}
      />
    </>
  );
}
```

---

## 10. UI States — Loading / Empty / Error

```tsx
function MovieListContent({ filter }) {
  const { data, isLoading, error } = useMovies(filter);

  if (isLoading) return <MovieGridSkeleton count={12} />;
  if (error) return <ErrorView error={error} onRetry={refetch} />;
  if (!data?.content.length) return <EmptyState query={filter.keyword} />;
  return <MovieGrid movies={data.content} />;
}

function MovieGridSkeleton({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl bg-[#0a1929] p-4">
          <div className="h-48 bg-white/5 animate-pulse rounded-md mb-3" />
          <div className="h-4 bg-white/5 animate-pulse rounded w-3/4 mb-2" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ query }) {
  return (
    <div className="text-center py-12 text-gray-400">
      <FilmIcon className="mx-auto mb-3 size-12" />
      <p>Không tìm thấy phim nào{query && ` với từ khóa "${query}"`}</p>
    </div>
  );
}
```

---

## 11. MovieDetailPage chi tiết

```tsx
function MovieDetailPage() {
  const { id } = useParams();
  const movieId = Number(id);
  const { data: movie, isLoading } = useMovie(movieId);
  const [selectedDate, setSelectedDate] = useState(new Date());

  if (isLoading) return <MovieDetailSkeleton />;
  if (!movie) return <NotFound />;

  return (
    <div>
      {/* Hero section */}
      <section className="relative h-96">
        <img src={movie.backdropUrl} className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#051424] to-transparent" />
        <div className="relative z-10 max-w-screen-xl mx-auto p-8">
          <h1 className="text-4xl font-bold">{movie.title}</h1>
          <p className="text-gray-300 mt-2">{movie.description}</p>
          <FavoriteButton movieId={movieId} />
        </div>
      </section>

      {/* Tabs */}
      <Tabs defaultValue="showtimes">
        <TabsList>
          <TabsTrigger value="showtimes">Suất chiếu</TabsTrigger>
          <TabsTrigger value="trailer">Trailer</TabsTrigger>
          <TabsTrigger value="reviews">Đánh giá ({movie.reviewCount})</TabsTrigger>
        </TabsList>

        <TabsContent value="showtimes">
          <DateSelector value={selectedDate} onChange={setSelectedDate} />
          <ShowtimeList movieId={movieId} date={selectedDate} />
        </TabsContent>

        <TabsContent value="trailer">
          <TrailerPlayer url={movie.trailerUrl} />
        </TabsContent>

        <TabsContent value="reviews">
          <ReviewList movieId={movieId} />
          <ReviewForm movieId={movieId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

## 12. Favorite Movie Pattern

### Hiển thị icon "đã thích"
```tsx
function FavoriteButton({ movieId }: { movieId: number }) {
  const { data: status } = useQuery({
    queryKey: ["movie-favorited", movieId],
    queryFn: () => api.get(`/api/movies/${movieId}/favorited`).then(r => r.data.data),
    enabled: useAuthStore.getState().isAuthenticated,
  });

  const toggle = useToggleFavorite(movieId);

  return (
    <button onClick={() => toggle.mutate(!!status?.isFavorited)}>
      {status?.isFavorited ? <HeartFilledIcon /> : <HeartIcon />}
    </button>
  );
}
```

### Page Favorites
```tsx
function FavoritesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["favorites"],
    queryFn: () => api.get("/api/users/me/favorites").then(r => r.data.data),
  });

  if (isLoading) return <Skeleton />;
  if (!data?.length) return <EmptyState text="Bạn chưa có phim yêu thích" />;
  return <MovieGrid movies={data} />;
}
```

---

## 13. Câu hỏi tự kiểm tra mở rộng

**Câu 5**: `placeholderData: (prev) => prev` để làm gì?

→ Khi đổi page hoặc filter, giữ data cũ hiển thị (không flash empty) → UX mượt như infinite scroll.

**Câu 6**: useSearchParams khác useState ở điểm nào?

→ useSearchParams sync state với URL query. Refresh giữ filter. Share link giữ filter. useState mất hết khi refresh.

**Câu 7**: Tại sao `staleTime: 1000 * 60 * 60` cho useGenres?

→ Genres ít đổi (admin hiếm thêm). Cache 1 giờ → giảm gọi API liên tục.

**Câu 8**: `enabled: !!movieId` — tại sao cần?

→ TanStack Query chạy ngay khi mount. Nếu `movieId` chưa có (URL chưa parse xong) → query với `undefined` → API lỗi. `enabled: false` skip query cho đến khi có id.
