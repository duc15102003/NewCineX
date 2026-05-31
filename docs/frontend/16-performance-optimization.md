# Performance Optimization — Frontend

> Tối ưu performance React/Vite cho CineX: từ render performance đến bundle size đến network.

## 1. Mental model

Performance front-end có 3 nhóm:
- **Load**: bundle tải về, parse, execute
- **Runtime**: render component, re-render, animation
- **Network**: API call, image, cache

Đo bằng:
- **Core Web Vitals**: LCP (Largest Contentful Paint), FID/INP, CLS
- **React Profiler**: thời gian render component
- **Network tab**: số request, size, waterfall
- **Lighthouse**: tổng score 0-100

## 2. React Render Performance

### Avoid unnecessary re-render

**Vấn đề**: parent state đổi → toàn bộ children re-render dù props không đổi.

**React.memo** — bỏ qua re-render nếu props shallow-equal:
```tsx
const MovieCard = memo(({ movie }: { movie: Movie }) => {
  console.log("render", movie.id);
  return <Card>...</Card>;
});
```

**Cảnh báo**: nếu prop là object/array inline → mỗi render ref khác → memo vô dụng:
```tsx
// SAI
<MovieCard movie={{...m}} onClick={() => {}} />  // ref mới mỗi render

// ĐÚNG
const handleClick = useCallback(() => {...}, []);
<MovieCard movie={movie} onClick={handleClick} />
```

### useMemo — Cache giá trị tính toán

```tsx
function MovieList({ movies, query }) {
  const filtered = useMemo(
    () => movies.filter(m => m.title.toLowerCase().includes(query.toLowerCase())),
    [movies, query]
  );
  return <List items={filtered} />;
}
```

**Quy tắc dùng**:
- Tính toán đắt (filter list 10k items, parse JSON to)
- Cần stable reference cho deps hook khác

**KHÔNG dùng**:
- Tính toán nhanh (số học cơ bản)
- Object literal đơn giản
- Function chỉ gọi 1 chỗ

### useCallback — Cache function reference

```tsx
const handleClick = useCallback((id: number) => {
  doSomething(id);
}, [doSomething]);

<Child onClick={handleClick} />  // Child wrap memo → không re-render
```

Chỉ hữu ích khi:
- Function là prop cho component memo'd
- Function là deps của hook khác

## 3. Component Splitting + Lazy Loading

### Code Splitting per route
```tsx
import { lazy, Suspense } from "react";

const MoviesPage = lazy(() => import("./pages/MoviesPage"));
const BookingPage = lazy(() => import("./pages/BookingPage"));
const AdminPage = lazy(() => import("./pages/admin/AdminPage"));

function AppRouter() {
  return (
    <Routes>
      <Route path="/movies" element={
        <Suspense fallback={<PageSkeleton />}>
          <MoviesPage />
        </Suspense>
      } />
      <Route path="/booking/:id" element={
        <Suspense fallback={<PageSkeleton />}>
          <BookingPage />
        </Suspense>
      } />
      <Route path="/admin/*" element={
        <Suspense fallback={<PageSkeleton />}>
          <AdminPage />
        </Suspense>
      } />
    </Routes>
  );
}
```

Mỗi route thành chunk riêng → tải khi cần. Bundle initial nhỏ hơn nhiều.

### Per-route fallback
Mỗi route có loading riêng:
```tsx
<Route path="/booking/:id" element={
  <Suspense fallback={<BookingPageSkeleton />}>
    <BookingPage />
  </Suspense>
} />
```

UX tốt hơn 1 spinner toàn cục.

### Lazy library nặng
```tsx
// PDF export — chỉ load khi user click "Export"
const exportPDF = async (data) => {
  const { default: jsPDF } = await import("jspdf");
  const { autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF();
  autoTable(doc, { ... });
  doc.save("report.pdf");
};

<button onClick={exportPDF}>Export PDF</button>
```

jsPDF (~150KB) không load với bundle initial.

## 4. List Virtualization

### Vấn đề
Render 1000 movie cards → 1000 DOM node → trang chậm, scroll lag.

### Giải pháp: virtualization
Chỉ render những item đang visible. Item ngoài viewport → không render.

**react-window** (gọn):
```tsx
import { FixedSizeList } from "react-window";

function MovieList({ movies }) {
  return (
    <FixedSizeList
      height={600}
      itemCount={movies.length}
      itemSize={120}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>
          <MovieCard movie={movies[index]} />
        </div>
      )}
    </FixedSizeList>
  );
}
```

DOM chỉ có ~10 card thay vì 1000.

**TanStack Virtual** (mới hơn, có grid support):
```tsx
import { useVirtualizer } from "@tanstack/react-virtual";

const rowVirtualizer = useVirtualizer({
  count: movies.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 120,
});
```

## 5. Image Optimization

### Lazy loading
```tsx
<img src={poster} loading="lazy" alt={movie.title} />
```

Browser tự load ảnh khi sắp vào viewport. Tiết kiệm bandwidth.

### Responsive images
```tsx
<img
  src="https://cloudinary.../movie-poster.jpg"
  srcSet="
    https://cloudinary.../w_400/movie-poster.jpg 400w,
    https://cloudinary.../w_800/movie-poster.jpg 800w,
    https://cloudinary.../w_1200/movie-poster.jpg 1200w
  "
  sizes="(max-width: 768px) 400px, (max-width: 1200px) 800px, 1200px"
/>
```

Browser chọn size phù hợp viewport → mobile không tải 4K.

### Cloudinary transform on-the-fly
```tsx
const optimizedUrl = (url: string, w: number) =>
  url.replace("/upload/", `/upload/w_${w},f_auto,q_auto/`);

<img src={optimizedUrl(poster, 400)} />
```

`f_auto` → WebP/AVIF nếu browser support. `q_auto` → quality tự động.

### Placeholder blur
```tsx
const [loaded, setLoaded] = useState(false);

<div className="relative">
  <img
    src={lowResUrl}
    className={`absolute inset-0 blur-md ${loaded ? "opacity-0" : "opacity-100"}`}
  />
  <img
    src={fullUrl}
    onLoad={() => setLoaded(true)}
    className={`transition-opacity ${loaded ? "opacity-100" : "opacity-0"}`}
  />
</div>
```

## 6. Network Optimization

### TanStack Query — Cache mạnh mẽ
```ts
useQuery({
  queryKey: ["movies"],
  queryFn: fetchMovies,
  staleTime: 1000 * 60 * 5,    // 5 phút cache fresh
  gcTime: 1000 * 60 * 30,       // 30 phút giữ trong memory
  refetchOnWindowFocus: false,  // không refetch mỗi lần back tab
});
```

### Prefetch on hover
```tsx
function MovieCard({ movie }) {
  const queryClient = useQueryClient();

  const prefetchDetail = () => {
    queryClient.prefetchQuery({
      queryKey: ["movies", movie.id],
      queryFn: () => api.get(`/api/movies/${movie.id}`),
    });
  };

  return (
    <Link to={`/movies/${movie.id}`} onMouseEnter={prefetchDetail}>
      ...
    </Link>
  );
}
```

User hover → prefetch. Click → data sẵn có → trang load instant.

### Debounce search
```tsx
const [query, setQuery] = useState("");
const debouncedQuery = useDebounce(query, 300);

const { data } = useQuery({
  queryKey: ["movies", debouncedQuery],
  queryFn: () => searchMovies(debouncedQuery),
  enabled: debouncedQuery.length >= 2,
});
```

Gõ "Avengers" → chỉ gọi API 1 lần sau 300ms ngừng gõ, không phải mỗi ký tự.

## 7. Bundle Size

### Phân tích bundle
```bash
npm run build -- --report
# hoặc
npx vite-bundle-visualizer
```

Hiển thị tree-map các chunk → biết library nào nặng.

### Common offenders
- **Moment.js**: 70KB → thay bằng `date-fns` hoặc native `Intl.DateTimeFormat`
- **Lodash full**: 70KB → import từng function: `import debounce from "lodash/debounce"`
- **react-icons full**: import từng icon: `import { FilmIcon } from "react-icons/lu"`

### Tree-shaking checklist
- ESM modules (`import/export`) tree-shake được, CommonJS không
- Side-effect free packages tốt hơn
- `package.json` có `"sideEffects": false`

### Vite manual chunks
```ts
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          tanstack: ["@tanstack/react-query"],
          ui: ["@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu"],
          pdf: ["jspdf", "jspdf-autotable"],
        },
      },
    },
  },
});
```

Chia chunk theo library → vendor chunk cache lâu hơn (rare change).

## 8. CSS Performance

### Tailwind purge
Vite + Tailwind tự purge unused class trong build. CSS bundle final chỉ chứa class thực dùng → 2-10KB thay vì 4MB.

### Avoid `transition-all`
```tsx
<div className="transition-all">  // ❌ transition mọi property → tốn GPU
<div className="transition-colors">  // ✅ chỉ color
```

### Use transform thay vì position
```tsx
// SAI — repaint
<div style={{ left: x }}>

// ĐÚNG — GPU compositing
<div style={{ transform: `translateX(${x}px)` }}>
```

## 9. JavaScript Performance

### Defer non-critical
```tsx
// Critical (above-fold)
<Hero />
<Navbar />

// Defer (below-fold) — lazy
const Footer = lazy(() => import("./Footer"));
<Suspense fallback={null}><Footer /></Suspense>
```

### Web Workers cho computation nặng
```ts
// worker.ts
self.addEventListener("message", (e) => {
  const result = heavyCompute(e.data);
  self.postMessage(result);
});

// Component
const worker = new Worker(new URL("./worker.ts", import.meta.url));
worker.postMessage(largeData);
worker.onmessage = (e) => setResult(e.data);
```

Main thread không block → UI vẫn mượt.

### requestIdleCallback
```ts
requestIdleCallback(() => {
  // chạy khi browser rảnh
  analyticsTrack(...);
});
```

## 10. Measure & Monitor

### React DevTools Profiler
1. Mở React DevTools
2. Tab Profiler → Record
3. Tương tác trang
4. Stop → xem flame graph

Tìm component render nhiều/lâu → focus optimize.

### Lighthouse
```bash
npx lighthouse https://cinex.vn --view
```

Score 0-100 cho Performance, Accessibility, Best Practices, SEO. Mục tiêu ≥ 90.

### Web Vitals
```ts
// main.tsx
import { onLCP, onINP, onCLS } from "web-vitals";

onLCP(console.log);  // Largest Contentful Paint < 2.5s good
onINP(console.log);  // Interaction to Next Paint < 200ms good
onCLS(console.log);  // Cumulative Layout Shift < 0.1 good
```

Gửi data lên analytics để track real users.

### Sentry Performance
```ts
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "...",
  integrations: [new Sentry.BrowserTracing()],
  tracesSampleRate: 0.1,
});
```

Track API latency, render time per route.

## 11. Cảnh báo Anti-patterns

### KHÔNG memo bừa bãi
```tsx
// SAI — memo overhead > saving
const Title = memo(({ text }) => <h1>{text}</h1>);
```

Component đơn giản, render nhanh → memo overhead lớn hơn. Chỉ memo khi:
- Render đắt (filter list, parse, ...)
- Re-render thường xuyên mà props không đổi

### KHÔNG useState cho computed value
```tsx
// SAI
const [filtered, setFiltered] = useState([]);
useEffect(() => {
  setFiltered(movies.filter(...));  // ← extra render
}, [movies]);

// ĐÚNG
const filtered = useMemo(() => movies.filter(...), [movies]);
```

### KHÔNG inline object trong dep array
```tsx
// SAI — re-run useEffect mỗi render
useEffect(() => {
  fetchData(config);
}, [{ url, method }]);  // ← object mới mỗi render

// ĐÚNG
useEffect(() => {
  fetchData({ url, method });
}, [url, method]);
```

## 12. Câu hỏi tự kiểm tra

**Câu 1**: useMemo và useCallback luôn cải thiện performance — đúng hay sai?

→ Sai. Có overhead (memory + check deps). Chỉ dùng khi đo thấy bottleneck thực. Bừa bãi → tệ hơn không dùng.

**Câu 2**: Code splitting per route khác lazy hoá component thường thế nào?

→ Per route: dùng `lazy()` + `Suspense` ở Router level, mỗi route 1 chunk. Component thường: lazy library nặng (PDF, chart) chỉ khi user trigger.

**Câu 3**: Khi nào nên virtualize list?

→ List > 100 item, scroll. Mobile thì > 50. Item phức tạp (nhiều DOM node) thì threshold thấp hơn.

**Câu 4**: Web Vitals LCP, INP, CLS đo gì?

→ LCP: ảnh/text lớn nhất hiển thị trong bao lâu (load speed). INP: phản hồi tương tác (button click → UI update). CLS: layout shift unexpected (UX khó chịu khi click bị nhảy).

**Câu 5**: Bundle initial 2MB. Cách nào giảm xuống 500KB?

→ (1) Code splitting per route, (2) lazy library nặng (PDF, chart), (3) tree-shake (import lodash từng function), (4) manual chunks chia vendor, (5) dynamic import.
