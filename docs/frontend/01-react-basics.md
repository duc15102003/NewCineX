# React Cơ bản — Từ zero đến hiểu

---

## React là gì?

React là thư viện JavaScript để **xây dựng giao diện người dùng** (UI). Thay vì viết HTML thuần, bạn viết **component** — khối giao diện có thể tái sử dụng.

### Ví dụ đời thường
Xây nhà bằng gạch: mỗi viên gạch (component) có hình dạng riêng, ghép lại thành bức tường (trang web).
- Viên gạch `Header` → thanh điều hướng
- Viên gạch `MovieCard` → thẻ hiển thị phim
- Viên gạch `SeatMap` → sơ đồ ghế

### React khác HTML thuần thế nào?

**HTML thuần:**
```html
<!-- Muốn hiện 100 phim → viết 100 thẻ div -->
<div class="movie">Avengers</div>
<div class="movie">Spider-Man</div>
<div class="movie">Batman</div>
<!-- ... 97 cái nữa. Thay đổi 1 chỗ → sửa 100 chỗ -->
```

**React:**
```tsx
// Viết 1 component, dùng cho 100 phim
function MovieCard({ title, poster }) {
    return (
        <div className="movie">
            <img src={poster} />
            <h3>{title}</h3>
        </div>
    );
}

// Dùng lại 100 lần, mỗi lần truyền data khác
{movies.map(movie => <MovieCard title={movie.title} poster={movie.poster} />)}
```

---

## Component — Khối xây dựng giao diện

### Component là gì?
Một **function** trả về JSX (HTML trong JavaScript). Mỗi component = 1 phần giao diện.

```tsx
// Component đơn giản nhất
function Hello() {
    return <h1>Xin chào CineX!</h1>;
}

// Sử dụng
<Hello />  // → hiện "Xin chào CineX!"
```

### Props — Dữ liệu truyền vào component

```tsx
// Props giống tham số của function
function MovieCard({ title, duration, rating }) {
    return (
        <div className="card">
            <h3>{title}</h3>
            <p>{duration} phút</p>
            <p>Đánh giá: {rating}/10</p>
        </div>
    );
}

// Truyền props khi sử dụng
<MovieCard title="Avengers" duration={150} rating={8.5} />
<MovieCard title="Spider-Man" duration={120} rating={7.8} />
// Cùng 1 component, data khác nhau → giao diện khác nhau
```

### TypeScript Props — Khai báo kiểu cho props

```tsx
// Khai báo interface cho props (TypeScript)
interface MovieCardProps {
    title: string;
    duration: number;
    rating: number;
    posterUrl?: string;  // ? = optional, có thể không truyền
}

function MovieCard({ title, duration, rating, posterUrl }: MovieCardProps) {
    return (
        <div className="card">
            <h3>{title}</h3>
            <p>{duration} phút | {rating}/10</p>
            {posterUrl && <img src={posterUrl} />}
            {/* ↑ posterUrl có giá trị → hiện ảnh. Không có → không hiện */}
        </div>
    );
}
```

### Children — Nội dung bên trong component

```tsx
// Component bọc nội dung
function Card({ title, children }) {
    return (
        <div className="card">
            <h3>{title}</h3>
            <div className="card-body">
                {children}  {/* ← nội dung bên trong <Card>...</Card> */}
            </div>
        </div>
    );
}

// Sử dụng
<Card title="Thông tin phim">
    <p>Avengers: Endgame</p>    {/* ← children */}
    <p>Thời lượng: 150 phút</p> {/* ← children */}
</Card>
```

---

## JSX — HTML trong JavaScript

### JSX là gì?
Cú pháp cho phép viết HTML **bên trong** JavaScript. React compile JSX → JavaScript thuần.

### Khác biệt JSX vs HTML

| HTML | JSX | Lý do |
|---|---|---|
| `class="btn"` | `className="btn"` | `class` là từ khóa JavaScript |
| `for="email"` | `htmlFor="email"` | `for` là từ khóa JavaScript |
| `style="color: red"` | `style={{ color: 'red' }}` | Style là object, không phải string |
| `onclick="fn()"` | `onClick={fn}` | camelCase, truyền function |

### Biểu thức trong JSX

```tsx
function MovieInfo({ movie }) {
    return (
        <div>
            {/* Biến */}
            <h3>{movie.title}</h3>

            {/* Biểu thức tính toán */}
            <p>Thời lượng: {Math.floor(movie.duration / 60)}h {movie.duration % 60}m</p>

            {/* Điều kiện (ternary) */}
            <span>{movie.rating >= 8 ? '⭐ Đề xuất' : 'Bình thường'}</span>

            {/* Điều kiện (&&) */}
            {movie.trailerUrl && <a href={movie.trailerUrl}>Xem trailer</a>}

            {/* Map danh sách */}
            <ul>
                {movie.genres.map(genre => (
                    <li key={genre.id}>{genre.name}</li>
                ))}
            </ul>
        </div>
    );
}
```

---

## State — Dữ liệu thay đổi theo thời gian

### useState — Quản lý state cơ bản

```tsx
import { useState } from 'react';

function Counter() {
    const [count, setCount] = useState(0);
    //     ↑ giá trị  ↑ hàm cập nhật  ↑ giá trị ban đầu

    return (
        <div>
            <p>Đã chọn {count} ghế</p>
            <button onClick={() => setCount(count + 1)}>Thêm ghế</button>
            <button onClick={() => setCount(0)}>Reset</button>
        </div>
    );
}
// Click "Thêm ghế" → count: 0 → 1 → 2 → 3
// React TỰ RENDER LẠI component khi state thay đổi
```

### State phức tạp hơn

```tsx
function SeatSelector() {
    const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
    // ↑ mảng ghế đã chọn, ban đầu rỗng

    const toggleSeat = (seatId: string) => {
        setSelectedSeats(prev => {
            if (prev.includes(seatId)) {
                return prev.filter(id => id !== seatId); // bỏ chọn
            }
            if (prev.length >= 8) {
                alert('Tối đa 8 ghế!');
                return prev; // không thêm
            }
            return [...prev, seatId]; // thêm ghế
        });
    };

    return (
        <div>
            <p>Đã chọn: {selectedSeats.join(', ')}</p>
            <button onClick={() => toggleSeat('E5')}>Ghế E5</button>
            <button onClick={() => toggleSeat('E6')}>Ghế E6</button>
        </div>
    );
}
```

### Quy tắc state
1. **Không sửa state trực tiếp:** `count = 5` ❌ → `setCount(5)` ✅
2. **State bất đồng bộ:** `setCount(count + 1)` ngay sau vẫn thấy giá trị cũ
3. **Mỗi render = 1 snapshot:** State không thay đổi trong 1 lần render

---

## useEffect — Chạy code khi component thay đổi

### Là gì?
Chạy "side effect" — code **ngoài** việc render UI (gọi API, đăng ký sự kiện, timer, ...).

### Ví dụ đời thường
- Render UI = vẽ tranh
- useEffect = sau khi vẽ xong, gọi điện báo khách hàng (side effect)

### Cú pháp

```tsx
useEffect(() => {
    // Code chạy sau khi render
    return () => {
        // Cleanup: chạy khi component bị hủy (optional)
    };
}, [dependencies]);
//  ↑ mảng phụ thuộc: effect chạy lại KHI nào
```

### Các dạng useEffect

```tsx
// 1. Chạy MỖI LẦN render (không nên dùng)
useEffect(() => {
    console.log('Render!');
});

// 2. Chạy 1 LẦN khi component mount ([] rỗng)
useEffect(() => {
    loadMovies(); // gọi API lần đầu
}, []);

// 3. Chạy khi dependency thay đổi
useEffect(() => {
    loadShowtimes(movieId, date); // gọi lại API khi movieId hoặc date đổi
}, [movieId, date]);

// 4. Có cleanup (timer, subscription)
useEffect(() => {
    const timer = setInterval(() => setSeconds(s => s - 1), 1000);
    return () => clearInterval(timer); // cleanup khi component unmount
}, []);
```

### Trong CineX — Countdown hold ghế

```tsx
function HoldCountdown({ holdExpiry }: { holdExpiry: Date }) {
    const [secondsLeft, setSecondsLeft] = useState(600); // 10 phút = 600 giây

    useEffect(() => {
        const timer = setInterval(() => {
            const diff = Math.floor((holdExpiry.getTime() - Date.now()) / 1000);
            if (diff <= 0) {
                clearInterval(timer);
                alert('Hết thời gian giữ ghế!');
                window.location.href = '/'; // redirect về trang chủ
            }
            setSecondsLeft(diff);
        }, 1000);

        return () => clearInterval(timer); // cleanup khi rời trang
    }, [holdExpiry]);

    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;

    return (
        <div className="text-red-500 font-bold">
            Còn {minutes}:{seconds.toString().padStart(2, '0')} để thanh toán
        </div>
    );
}
```

---

## Conditional Rendering — Render có điều kiện

```tsx
function BookingStatus({ status }: { status: string }) {
    // Cách 1: Ternary (2 trường hợp)
    return (
        <span className={status === 'CONFIRMED' ? 'text-green-500' : 'text-red-500'}>
            {status === 'CONFIRMED' ? 'Đã xác nhận' : 'Chưa xác nhận'}
        </span>
    );

    // Cách 2: && (hiện hoặc không hiện)
    return (
        <div>
            {status === 'HOLDING' && <p>Đang giữ ghế...</p>}
            {status === 'CONFIRMED' && <p>Đã thanh toán ✅</p>}
            {status === 'CANCELLED' && <p>Đã hủy ❌</p>}
        </div>
    );

    // Cách 3: Switch-case (nhiều trường hợp)
    const statusMap: Record<string, { text: string; color: string }> = {
        HOLDING: { text: 'Đang giữ ghế', color: 'text-yellow-500' },
        CONFIRMED: { text: 'Đã xác nhận', color: 'text-green-500' },
        CHECKED_IN: { text: 'Đã check-in', color: 'text-blue-500' },
        CANCELLED: { text: 'Đã hủy', color: 'text-red-500' },
        EXPIRED: { text: 'Hết hạn', color: 'text-gray-500' },
    };
    const { text, color } = statusMap[status] || { text: status, color: '' };
    return <span className={color}>{text}</span>;
}
```

---

## List Rendering — Render danh sách

```tsx
function MovieList({ movies }: { movies: Movie[] }) {
    // Rỗng → hiện thông báo
    if (movies.length === 0) {
        return <p className="text-gray-500">Không có phim nào</p>;
    }

    return (
        <div className="grid grid-cols-4 gap-4">
            {movies.map(movie => (
                <MovieCard
                    key={movie.id}  // ← key BẮT BUỘC, unique, để React biết phần tử nào thay đổi
                    title={movie.title}
                    duration={movie.duration}
                    rating={movie.rating}
                />
            ))}
        </div>
    );
}
```

### Tại sao cần `key`?
```
Không có key:
  React thêm phim mới → render LẠI TẤT CẢ 100 phim → chậm

Có key:
  React thêm phim mới → chỉ render 1 phim mới → nhanh
  React biết phim nào thay đổi, phim nào giữ nguyên nhờ key
```

**Quy tắc key:** Dùng `id` từ DB, KHÔNG dùng index mảng (vì index thay đổi khi sắp xếp/xóa).

---

## Event Handling — Xử lý sự kiện

```tsx
function LoginForm() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    // Xử lý submit form
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault(); // ← QUAN TRỌNG: ngăn form reload trang
        console.log('Login:', username, password);
        // gọi API login...
    };

    return (
        <form onSubmit={handleSubmit}>
            <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                // ↑ mỗi ký tự gõ → cập nhật state → React render lại input
                placeholder="Username"
            />
            <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
            />
            <button type="submit">Đăng nhập</button>
        </form>
    );
}
```

---

## Component Lifecycle — Vòng đời component

```
1. MOUNT (tạo lần đầu)
   → Component xuất hiện trên màn hình
   → useEffect(() => {...}, []) chạy
   → VD: Mở trang danh sách phim → gọi API lấy phim

2. UPDATE (state/props thay đổi)
   → React render lại component
   → useEffect(() => {...}, [dependency]) chạy nếu dependency thay đổi
   → VD: User chọn thể loại khác → gọi lại API

3. UNMOUNT (bị xóa khỏi màn hình)
   → Cleanup function trong useEffect chạy
   → VD: Rời trang chọn ghế → clearInterval countdown timer
```
