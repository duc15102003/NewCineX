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

---

## React Hooks nâng cao

### useRef — Giữ giá trị qua render

`useRef` tạo 1 "hộp" giữ value, KHÔNG trigger re-render khi đổi.

**3 use case chính**:

**1. Ref vào DOM**
```tsx
const inputRef = useRef<HTMLInputElement>(null);

useEffect(() => {
  inputRef.current?.focus();
}, []);

return <input ref={inputRef} />;
```

**2. Giữ value qua render mà không re-render**
```tsx
function Timer() {
  const intervalRef = useRef<NodeJS.Timeout>();
  const [count, setCount] = useState(0);

  useEffect(() => {
    intervalRef.current = setInterval(() => setCount(c => c + 1), 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  return <div>{count}</div>;
}
```

intervalRef KHÔNG trigger re-render khi đổi (state thì có).

**3. Lưu giá trị "trước" (previous value)**
```tsx
function PrevValueDemo({ value }: { value: number }) {
  const prevRef = useRef(value);

  useEffect(() => {
    prevRef.current = value;
  }, [value]);

  return <div>Hiện tại: {value}, Trước đó: {prevRef.current}</div>;
}
```

### useMemo — Cache giá trị tính toán

```tsx
function MovieList({ movies, query }: Props) {
  // Mỗi render tính lại expensive — chậm
  const filtered = movies.filter(m => m.title.toLowerCase().includes(query.toLowerCase()));

  // Chỉ tính lại khi movies/query đổi
  const filteredMemo = useMemo(
    () => movies.filter(m => m.title.toLowerCase().includes(query.toLowerCase())),
    [movies, query]
  );

  return <List items={filteredMemo} />;
}
```

**Quy tắc**: KHÔNG dùng useMemo bừa bãi. Chỉ khi:
- Tính toán thực sự đắt (lọc list lớn, parse JSON to)
- Hoặc cần stable reference cho dependency của hook khác

### useCallback — Cache function

```tsx
function Parent() {
  const [count, setCount] = useState(0);

  // SAI — function mới mỗi render → Child re-render thừa
  const handleClick = () => setCount(c => c + 1);

  // ĐÚNG — function stable, Child không re-render
  const handleClickMemo = useCallback(() => setCount(c => c + 1), []);

  return <Child onClick={handleClickMemo} />;
}

const Child = memo(({ onClick }: { onClick: () => void }) => {
  console.log("Child render");
  return <button onClick={onClick}>+</button>;
});
```

Chỉ hữu ích khi Child được wrap `memo()` hoặc là deps của hook khác.

### React.memo — Bỏ qua re-render nếu props không đổi

```tsx
const MovieCard = memo(function MovieCard({ movie }: { movie: Movie }) {
  console.log("Render MovieCard", movie.id);
  return <Card>...</Card>;
});
```

Parent re-render → MovieCard chỉ re-render nếu `movie` đổi (shallow compare).

**Cảnh báo**: shallow compare → nếu prop là object/array inline, mỗi render vẫn ref khác → memo không hiệu quả. Phải useMemo prop hoặc tách state.

---

## StrictMode — useEffect chạy 2 lần trong dev

```tsx
<StrictMode>
  <App />
</StrictMode>
```

React cố ý gọi `useEffect` 2 lần (mount → unmount → mount lại) trong dev để phát hiện effect không idempotent.

### Triệu chứng
```tsx
useEffect(() => {
  console.log("mount");
  return () => console.log("unmount");
}, []);

// Console dev:
// mount
// unmount
// mount  ← cố tình chạy lại
```

### Hệ quả
- WebSocket connect 2 lần
- API call 2 lần
- Counter init 2 lần

### Fix
**Đảm bảo cleanup** đúng để effect 2 lần vẫn an toàn:
```tsx
useEffect(() => {
  const client = createStompClient();
  client.activate();
  return () => client.deactivate();  // ← cleanup connection đầu trước khi tạo connection 2
}, []);
```

Production KHÔNG có StrictMode → chỉ chạy 1 lần. Nên không cần worry, miễn cleanup đúng.

---

## Rules of Hooks

### Quy tắc 1: CHỈ gọi ở top level
```tsx
// SAI — gọi conditional
function MyComp({ user }: Props) {
  if (user) {
    const [name, setName] = useState(user.name);  // ❌
  }
}

// ĐÚNG
function MyComp({ user }: Props) {
  const [name, setName] = useState(user?.name ?? "");  // ✅
}
```

### Quy tắc 2: CHỈ gọi từ React function (hook hoặc component)
```tsx
// SAI — gọi từ helper function thường
function helperFn() {
  const [x, setX] = useState(0);  // ❌
}

// ĐÚNG — custom hook
function useCustomHook() {
  const [x, setX] = useState(0);  // ✅
}
```

### Tại sao
React giả định thứ tự hook CỐ ĐỊNH. Conditional hook → thứ tự đổi giữa các render → React track state sai → bug khó hiểu.

---

## Stale Closure — Bug Counter Timer

### Reproduce
```tsx
function Timer() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      console.log("count:", count);  // luôn log 0!
      setCount(count + 1);             // luôn set 1!
    }, 1000);
    return () => clearInterval(id);
  }, []);  // ← deps rỗng

  return <div>{count}</div>;
}
```

### Tại sao
`useEffect` chạy 1 lần với deps rỗng. Function trong setInterval **capture biến `count` lúc đó** (= 0). Mỗi tick dùng `count = 0`, set thành 1, không tăng tiếp.

### 3 cách fix

**Fix 1: Functional update**
```tsx
setCount(c => c + 1);  // không phụ thuộc count
```

**Fix 2: Deps đầy đủ**
```tsx
useEffect(() => {
  const id = setInterval(() => setCount(count + 1), 1000);
  return () => clearInterval(id);
}, [count]);  // chạy lại mỗi khi count đổi → re-create interval
```

Nhưng pattern này tạo + clear interval mỗi giây → tốn.

**Fix 3: useRef giữ giá trị mới nhất**
```tsx
const countRef = useRef(count);
useEffect(() => { countRef.current = count; }, [count]);

useEffect(() => {
  const id = setInterval(() => {
    console.log(countRef.current);  // luôn mới nhất
  }, 1000);
  return () => clearInterval(id);
}, []);
```

---

## Functional State Update

### Tại sao `setCount(count + 1)` 3 lần chỉ tăng 1
```tsx
const handler = () => {
  setCount(count + 1);   // count = 0 + 1 = 1
  setCount(count + 1);   // count = 0 + 1 = 1
  setCount(count + 1);   // count = 0 + 1 = 1
};
```

React batch state update. Trong handler, `count` vẫn là 0 (chưa re-render). 3 setCount cùng set 1 → cuối cùng 1.

### Fix với functional
```tsx
const handler = () => {
  setCount(c => c + 1);  // c = 0 → 1
  setCount(c => c + 1);  // c = 1 → 2
  setCount(c => c + 1);  // c = 2 → 3
};
```

React queue function, áp dụng tuần tự với value mới nhất.

---

## React 18 Batching

React 18+: **mọi** setState trong cùng tick được batch (kể cả trong setTimeout, Promise, event handler).

```tsx
setTimeout(() => {
  setCount(c => c + 1);
  setName("X");
  // → 1 re-render duy nhất (React 18)
  // React 17: 2 re-render
}, 0);
```

---

## Conditional Rendering Patterns

### Pattern 1: Ternary
```tsx
{isLoading ? <Spinner /> : <List />}
```

### Pattern 2: Short-circuit `&&`
```tsx
{user && <Welcome name={user.name} />}
```

Cảnh báo: `&&` với 0 (number) render `0`:
```tsx
{count && <p>...</p>}  // count = 0 → render "0" chữ
{count > 0 && <p>...</p>}  // ✅
```

### Pattern 3: Early return
```tsx
function MovieList({ data, isLoading, error }) {
  if (isLoading) return <Skeleton />;
  if (error) return <ErrorView e={error} />;
  if (!data?.length) return <Empty />;
  return <List items={data} />;
}
```

---

## Lists & Keys

### Quy tắc key
- Phải UNIQUE trong cùng list
- STABLE — không thay đổi giữa render
- KHÔNG dùng index trừ khi list không bao giờ đổi thứ tự

### Tại sao không dùng index
```tsx
// Initial: [{name: "A"}, {name: "B"}]
{items.map((item, i) => <Item key={i} value={item.name} defaultValue={item.name} />)}

// User xóa A:
// New: [{name: "B"}]
// React: key=0 đổi từ "A" sang "B" → reuse component → defaultValue cũ giữ lại
```

Dùng `key={item.id}` → React track đúng identity.

---

## useId, useTransition, useDeferredValue (React 18)

### useId — Sinh ID unique
```tsx
const id = useId();
return (
  <>
    <label htmlFor={id}>Email</label>
    <input id={id} />
  </>
);
```

SSR-safe, không cần Math.random().

### useTransition — Mark update không gấp
```tsx
const [isPending, startTransition] = useTransition();

const handleSearch = (q: string) => {
  setQuery(q);  // urgent — type ngay
  startTransition(() => {
    setResults(filterLargeList(q));  // không urgent — có thể delay
  });
};
```

UI không freeze khi filter list lớn.

### useDeferredValue — Lùi việc render value
```tsx
const deferredQuery = useDeferredValue(query);
const results = useMemo(() => filterLargeList(deferredQuery), [deferredQuery]);
```

---

## Fragment — Wrap không thêm DOM

```tsx
// JSX yêu cầu 1 root element
return (
  <>
    <h1>Title</h1>
    <p>Body</p>
  </>
);

// Cú pháp dài (nếu cần key)
return (
  <Fragment key={id}>...</Fragment>
);
```

---

## Portal — Render escape parent

Modal cần escape `overflow: hidden` của parent:
```tsx
import { createPortal } from "react-dom";

function Modal({ children }: Props) {
  return createPortal(
    <div className="fixed inset-0 z-50 ...">{children}</div>,
    document.body
  );
}
```

Component sống trong React tree nhưng DOM render vào `body` → không bị clip.

---

## Error Boundaries

```tsx
class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error(error, info);
  }

  render() {
    if (this.state.hasError) return <Fallback />;
    return this.props.children;
  }
}
```

Catch error trong children. App-level: bọc `<App />`, route-level: bọc từng route.

---

## Common Pitfalls

1. **Dep array thiếu**: useEffect chạy với value cũ → stale closure
2. **Dep array có object/array inline**: re-create mỗi render → useEffect chạy liên tục
3. **Quên cleanup**: setTimeout/setInterval/WebSocket leak
4. **State update sau unmount**: warning + memory leak
5. **Mutate state trực tiếp**: `state.items.push(x); setState(state)` → React không detect change

---

## Câu hỏi tự kiểm tra

**Câu 1**: Khi nào dùng useState vs useRef?

→ useState: value cần trigger re-render khi đổi. useRef: value chỉ cần giữ lại, không trigger re-render (DOM ref, timer ID, previous value).

**Câu 2**: Vì sao `setCount(count + 1)` 3 lần chỉ tăng 1?

→ React batch state. Trong cùng handler, `count` vẫn là value cũ (chưa re-render). 3 lần setCount cùng set 1 value → cuối cùng 1. Fix bằng functional `setCount(c => c + 1)`.

**Câu 3**: StrictMode chạy useEffect 2 lần — có cần fix code?

→ Không cần "fix" — cần đảm bảo CLEANUP đúng. Production không có StrictMode. Nếu effect 2 lần gây bug → effect không idempotent → cần sửa cleanup.

**Câu 4**: Khi nào dùng useMemo và useCallback?

→ Chỉ khi (1) tính toán đắt, (2) cần stable reference cho deps hook khác, (3) prop cho component memo'd. KHÔNG dùng bừa bãi — overhead memo > saving.

**Câu 5**: Vì sao key trong list không nên là index?

→ Index không gắn với identity item. Khi item bị xóa/thêm/sort, key đổi → React track sai → state component sai, animation sai.

**Câu 6**: stale closure trong setInterval xảy ra khi nào? 3 cách fix?

→ useEffect deps rỗng, function bên trong capture biến lúc đó → tick sau dùng giá trị cũ. Fix: (1) functional update, (2) deps đầy đủ, (3) useRef giữ giá trị mới.
