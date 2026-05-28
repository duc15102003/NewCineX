# TypeScript Cơ bản — Type-safe JavaScript

---

## TypeScript là gì?

TypeScript = JavaScript + **kiểu dữ liệu** (types). Giúp phát hiện lỗi **lúc viết code** thay vì lúc chạy.

### Ví dụ đời thường
- JavaScript: gửi thư không ghi địa chỉ → đến nơi mới biết sai
- TypeScript: bưu điện kiểm tra địa chỉ TRƯỚC KHI gửi → sai thì sửa ngay

---

## Kiểu dữ liệu cơ bản

```tsx
// String
const title: string = 'Avengers';

// Number
const duration: number = 150;
const rating: number = 8.5;

// Boolean
const isAdmin: boolean = false;

// Array
const seatIds: number[] = [1, 2, 3];
const genres: string[] = ['Action', 'Sci-Fi'];

// Null / Undefined
const phone: string | null = null;        // có thể null
const avatar: string | undefined = undefined;
```

---

## Interface — Định nghĩa hình dạng object

```tsx
// Khai báo: object Movie phải có những field gì
interface Movie {
    id: number;
    title: string;
    duration: number;
    rating: number;
    posterUrl?: string;    // ? = optional (có thể không có)
    genres: Genre[];       // mảng Genre
}

interface Genre {
    id: number;
    name: string;
}

// Sử dụng
const movie: Movie = {
    id: 1,
    title: 'Avengers',
    duration: 150,
    rating: 8.5,
    genres: [{ id: 1, name: 'Action' }],
};

movie.title = 123;  // ❌ LỖI COMPILE: Type 'number' is not assignable to type 'string'
movie.xyz;           // ❌ LỖI: Property 'xyz' does not exist on type 'Movie'
```

### Tại sao cần Interface?

**Không có (JavaScript):**
```js
function MovieCard({ movie }) {
    return <h3>{movie.titl}</h3>;  // Typo "titl" → runtime bug, khó tìm
}
```

**Có Interface (TypeScript):**
```tsx
function MovieCard({ movie }: { movie: Movie }) {
    return <h3>{movie.titl}</h3>;  // ❌ LỖI COMPILE NGAY: Did you mean 'title'?
}
```

---

## Type vs Interface

```tsx
// Interface — cho object (dùng nhiều nhất)
interface Movie {
    id: number;
    title: string;
}

// Type — cho union, alias
type MovieStatus = 'COMING_SOON' | 'NOW_SHOWING' | 'ENDED';
// ↑ Chỉ chấp nhận 3 giá trị này, gõ sai → lỗi compile

type PaymentMethod = 'VNPAY' | 'MOMO' | 'CASH';

// Sử dụng
const status: MovieStatus = 'NOW_SHOWING';  // ✅
const status: MovieStatus = 'PLAYING';       // ❌ LỖI
```

---

## Generic — Kiểu tham số hóa

```tsx
// ApiResponse cho BẤT KỲ kiểu data nào
interface ApiResponse<T> {
    success: boolean;
    message: string;
    data: T;               // T = kiểu được truyền vào khi sử dụng
    timestamp: string;
}

// Sử dụng
type MovieResponse = ApiResponse<Movie>;
// → { success, message, data: Movie, timestamp }

type MovieListResponse = ApiResponse<PageResponse<Movie>>;
// → { success, message, data: { content: Movie[], page, size, ... }, timestamp }
```

```tsx
// useState với generic
const [movies, setMovies] = useState<Movie[]>([]);
//                                   ↑ mảng Movie

const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
//                                               ↑ string hoặc null
```

---

## Trong CineX — Định nghĩa types

```tsx
// src/types/movie.ts
export interface Movie {
    id: number;
    title: string;
    description: string;
    duration: number;
    releaseDate: string;
    posterUrl: string;
    trailerUrl: string;
    director: string;
    rating: number;
    status: MovieStatus;
    genres: Genre[];
}

export type MovieStatus = 'COMING_SOON' | 'NOW_SHOWING' | 'ENDED';

export interface Genre {
    id: number;
    name: string;
}

// src/types/booking.ts
export interface Booking {
    id: number;
    bookingCode: string;
    totalAmount: number;
    status: BookingStatus;
    showtime: ShowtimeInfo;
    seats: SeatInfo[];
    createdAt: string;
}

export type BookingStatus = 'HOLDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CANCELLED' | 'EXPIRED';

// src/types/auth.ts
export interface LoginRequest {
    username: string;
    password: string;
}

export interface AuthResponse {
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    expiresIn: number;
}

// src/types/api.ts
export interface ApiResponse<T> {
    success: boolean;
    message: string;
    data: T;
    timestamp: string;
}

export interface PageResponse<T> {
    content: T[];
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
    last: boolean;
}
```

### Dùng trong component

```tsx
import { Movie } from '../types/movie';
import { ApiResponse, PageResponse } from '../types/api';

function MovieListPage() {
    const { data } = useQuery<ApiResponse<PageResponse<Movie>>>({
        queryKey: ['movies'],
        queryFn: () => api.get('/api/movies').then(res => res.data),
    });

    const movies: Movie[] = data?.data.content || [];
    // ↑ TypeScript biết movies là mảng Movie
    // → IDE gợi ý: movies[0].title, movies[0].duration, ...
}
```
