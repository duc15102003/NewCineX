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
