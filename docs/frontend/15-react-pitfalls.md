# 15 — React/TypeScript/Tailwind Pitfalls (Top 18 bug hay gặp ở CineX)

> File này tổng hợp 18 bug **rất hay gặp** khi viết React + TypeScript + Tailwind + TanStack Query + Zustand + Axios.
> Mỗi bug đều có: code reproduce → tại sao xảy ra → cách phát hiện → 3 cách fix.
>
> Đối tượng: sinh viên đang làm CineX, đã đọc qua các file `01-*.md` đến `14-*.md`.

---

## Mục lục

1. [useEffect chạy 2 lần ở dev (React StrictMode)](#1-useeffect-chạy-2-lần-ở-dev-react-strictmode)
2. [Stale closure trong setInterval (booking countdown)](#2-stale-closure-trong-setinterval-booking-countdown)
3. [Tailwind dynamic class `bg-${color}-500` không hoạt động](#3-tailwind-dynamic-class-bg-color-500-không-hoạt-động)
4. [`setCount(count + 1)` 3 lần chỉ tăng 1 (batching)](#4-setcountcount--1-3-lần-chỉ-tăng-1-batching)
5. [Index làm `key` trong list — bug reconciliation](#5-index-làm-key-trong-list--bug-reconciliation)
6. [Input `type="number"` trả về string](#6-input-typenumber-trả-về-string)
7. [useEffect thiếu dep hoặc dep object inline → infinite loop](#7-useeffect-thiếu-dep-hoặc-dep-object-inline--infinite-loop)
8. [Gọi hook trong điều kiện `if (x) useState(...)`](#8-gọi-hook-trong-điều-kiện-if-x-usestate)
9. [Closure trong `queryFn` TanStack Query capture state cũ](#9-closure-trong-queryfn-tanstack-query-capture-state-cũ)
10. [Mutation success không invalidate query → UI không refresh](#10-mutation-success-không-invalidate-query--ui-không-refresh)
11. [Zustand selector trả object inline → re-render mỗi lần](#11-zustand-selector-trả-object-inline--re-render-mỗi-lần)
12. [WebSocket connect 2 lần ở dev (StrictMode) — ghost connection](#12-websocket-connect-2-lần-ở-dev-strictmode--ghost-connection)
13. [Axios interceptor infinite loop khi `/auth/refresh` cũng 401](#13-axios-interceptor-infinite-loop-khi-authrefresh-cũng-401)
14. [`useState(fetchData())` chạy mỗi render — quên lazy init](#14-usestatefetchdata-chạy-mỗi-render--quên-lazy-init)
15. [`useNavigate` gọi trong render thay vì handler/effect](#15-usenavigate-gọi-trong-render-thay-vì-handlereffect)
16. [React Query `refetchOnWindowFocus` gây surprise refetch](#16-react-query-refetchonwindowfocus-gây-surprise-refetch)
17. [Date so sánh `===` không work](#17-date-so-sánh--không-work)
18. [Quên `forwardRef` khi component wrap input](#18-quên-forwardref-khi-component-wrap-input)
19. [Bảng tổng kết Triệu chứng → Fix](#bảng-tổng-kết-triệu-chứng--fix)
20. [Câu hỏi tự kiểm tra](#câu-hỏi-tự-kiểm-tra)

---

## 1. useEffect chạy 2 lần ở dev (React StrictMode)

### Tên bug + triệu chứng
Khi chạy `npm run dev`, mọi `useEffect` đều **chạy 2 lần liên tiếp**. Hậu quả:
- API gọi 2 lần → 2 dòng booking được tạo trong DB.
- `console.log("mounted")` in ra 2 lần.
- WebSocket mở 2 connection.
- Animation chạy lặp.

Sinh viên thường hoảng và tưởng code mình sai.

### Code reproduce

```tsx
// src/features/booking/BookingPage.tsx
import { useEffect } from "react";
import { api } from "@/api/axios";

export function BookingPage() {
  useEffect(() => {
    console.log("[BookingPage] mounted");
    api.post("/bookings/hold", { seatId: "A1" });
  }, []);

  return <div>Booking</div>;
}
```

Mở DevTools Console, bạn sẽ thấy:

```
[BookingPage] mounted
[BookingPage] mounted
```

Và backend log cho thấy 2 booking HOLDING được tạo.

### Tại sao xảy ra
`main.tsx` của Vite bật `<React.StrictMode>` mặc định. Từ React 18, StrictMode **cố tình** mount → unmount → mount lại mỗi component ở dev để bạn **phát hiện sớm** các effect không cleanup được.

Đây **không phải bug** — đây là *feature*. Production build (sau khi `npm run build`) **không** có hành vi này.

### Cách phát hiện
- **DevTools Components tab**: thấy component mount/unmount 2 lần liên tiếp.
- **Console**: bất kỳ `console.log` trong effect đều in 2 lần.
- **Network tab**: 2 request giống hệt nhau cách nhau vài ms.
- **Backend log**: 2 row được tạo trong DB cùng giây.

### 3 cách fix

**Cách 1 — Hiểu là không cần fix (cho effect idempotent):**

```tsx
useEffect(() => {
  // Chỉ là log → chạy 2 lần không sao
  console.log("mounted");
}, []);
```

**Cách 2 — Cleanup đúng cách (effect có side-effect):**

```tsx
useEffect(() => {
  const controller = new AbortController();
  api.post("/bookings/hold", { seatId: "A1" }, { signal: controller.signal });

  return () => controller.abort(); // Hủy request khi unmount
}, []);
```

**Cách 3 — Dùng cờ `useRef` để chỉ chạy 1 lần (chỉ khi thật sự cần):**

```tsx
const didRun = useRef(false);
useEffect(() => {
  if (didRun.current) return;
  didRun.current = true;
  api.post("/bookings/hold", { seatId: "A1" });
}, []);
```

> Cảnh báo: cách 3 là **anti-pattern** trong đa số trường hợp. Chỉ dùng khi action thật sự "chỉ chạy 1 lần đời" (ví dụ track analytics page view). Với booking, hãy dùng TanStack Query `useMutation` thay vì gọi raw `api.post` trong effect.

---

## 2. Stale closure trong setInterval (booking countdown)

### Tên bug + triệu chứng
Trang booking có countdown "Còn 5:00 để thanh toán". Sau khi state `seconds` xuống vài giây, **countdown đứng yên** hoặc reset về giá trị cũ liên tục.

### Code reproduce

```tsx
// src/features/booking/Countdown.tsx
import { useEffect, useState } from "react";

export function Countdown({ initial }: { initial: number }) {
  const [seconds, setSeconds] = useState(initial);

  useEffect(() => {
    const id = setInterval(() => {
      // BUG: `seconds` luôn = initial vì closure
      setSeconds(seconds - 1);
    }, 1000);
    return () => clearInterval(id);
  }, []); // ← deps rỗng

  return <span>{seconds}s</span>;
}
```

Khi mount với `initial = 300`, mỗi giây setState gọi `setSeconds(300 - 1) = 299` → component re-render → mãi mãi hiện `299`.

### Tại sao xảy ra
`useEffect(..., [])` chỉ chạy 1 lần. Callback `setInterval` capture biến `seconds` **tại thời điểm mount**, lúc đó `seconds = 300`. Render sau, `seconds` mới đã là `299` nhưng closure cũ vẫn nhìn thấy `300` (cũ). Đây gọi là **stale closure**.

### Cách phát hiện
- **Console.log trong interval**: in ra `seconds` luôn giữ giá trị ban đầu, không đổi.
- **React DevTools**: state hiển thị đúng giảm dần nhưng UI đứng → dấu hiệu setState bị gọi với giá trị cố định.
- **ESLint `react-hooks/exhaustive-deps`**: sẽ cảnh báo "missing dependency: 'seconds'".

### 3 cách fix

**Cách 1 — Functional setState (ngắn nhất, an toàn nhất):**

```tsx
useEffect(() => {
  const id = setInterval(() => {
    setSeconds(prev => prev - 1); // ← luôn nhận giá trị mới nhất
  }, 1000);
  return () => clearInterval(id);
}, []);
```

**Cách 2 — Đưa `seconds` vào deps (gây tạo interval mới mỗi giây, không khuyến nghị):**

```tsx
useEffect(() => {
  const id = setInterval(() => setSeconds(seconds - 1), 1000);
  return () => clearInterval(id);
}, [seconds]); // ← interval bị tạo lại mỗi tick, tốn tài nguyên
```

**Cách 3 — Dùng `useRef` lưu giá trị mới nhất:**

```tsx
const secondsRef = useRef(initial);
const [, force] = useState(0);

useEffect(() => {
  const id = setInterval(() => {
    secondsRef.current -= 1;
    force(n => n + 1); // Trigger re-render
  }, 1000);
  return () => clearInterval(id);
}, []);

return <span>{secondsRef.current}s</span>;
```

> Khuyến nghị CineX: dùng **Cách 1** cho countdown. Cách 3 chỉ áp dụng cho game/animation cần tránh re-render.

---

## 3. Tailwind dynamic class `bg-${color}-500` không hoạt động

### Tên bug + triệu chứng
Bạn viết badge trạng thái:

```tsx
<span className={`bg-${color}-500/20 text-${color}-400`}>{label}</span>
```

Khi chạy: **không có màu nào hiển thị**, badge trắng trơn. Console không lỗi gì.

### Code reproduce

```tsx
// src/components/StatusBadge.tsx
type Props = { color: "green" | "red" | "yellow"; label: string };

export function StatusBadge({ color, label }: Props) {
  // BUG: Tailwind không thấy chuỗi này khi build
  return (
    <span className={`px-2 py-1 rounded bg-${color}-500/20 text-${color}-400`}>
      {label}
    </span>
  );
}
```

### Tại sao xảy ra
Tailwind dùng **JIT compiler** quét code **tĩnh** (text trong file `.tsx`) để tìm các class. Nó tìm chuỗi `"bg-green-500"`, `"bg-red-500"` literal trong source code.

Khi bạn viết `` `bg-${color}-500` ``, Tailwind chỉ thấy mảnh `"bg-"` và `"-500"` — **không** thấy chuỗi `"bg-green-500"` hoàn chỉnh. Vì vậy CSS class này không được generate vào file output → browser không có rule này.

### Cách phát hiện
- **DevTools Elements**: inspect element thấy `class="bg-green-500/20"` nhưng **Computed** styles không có `background-color`.
- **Search source CSS** (build output): `Cmd+F` "bg-green-500" trong file `assets/index-*.css` → không tìm thấy.
- **Build log**: không có cảnh báo (nguy hiểm vì không biết là sai).

### 3 cách fix

**Cách 1 — Map object (khuyến nghị, type-safe):**

```tsx
const COLOR_MAP = {
  green: "bg-green-500/20 text-green-400 border-green-500/30",
  red: "bg-red-500/20 text-red-400 border-red-500/30",
  yellow: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
} as const;

export function StatusBadge({ color, label }: Props) {
  return <span className={`px-2 py-1 rounded border ${COLOR_MAP[color]}`}>{label}</span>;
}
```

CineX đã đi theo hướng này — xem `utils/colors.ts`.

**Cách 2 — Safelist trong `tailwind.config.js`:**

```js
// tailwind.config.js
export default {
  content: ["./src/**/*.{ts,tsx}"],
  safelist: [
    { pattern: /bg-(red|green|yellow|blue)-(400|500)\/20/ },
    { pattern: /text-(red|green|yellow|blue)-400/ },
  ],
};
```

> Nhược điểm: file CSS phình to vì nhiều class không dùng tới được generate.

**Cách 3 — `clsx` + literal mappings:**

```tsx
import clsx from "clsx";

const isGreen = color === "green";
const isRed = color === "red";

<span
  className={clsx(
    "px-2 py-1 rounded",
    isGreen && "bg-green-500/20 text-green-400",
    isRed && "bg-red-500/20 text-red-400"
  )}
/>
```

---

## 4. `setCount(count + 1)` 3 lần chỉ tăng 1 (batching)

### Tên bug + triệu chứng
Bạn muốn tăng `count` lên 3 trong một lần click, nhưng nó chỉ tăng 1:

```tsx
function increment3() {
  setCount(count + 1);
  setCount(count + 1);
  setCount(count + 1);
}
```

Click vào button → count chỉ tăng từ 0 → 1, không phải 0 → 3.

### Code reproduce

```tsx
import { useState } from "react";

export function Counter() {
  const [count, setCount] = useState(0);

  function increment3() {
    setCount(count + 1); // count = 0 → setCount(1)
    setCount(count + 1); // count = 0 vẫn → setCount(1)
    setCount(count + 1); // count = 0 vẫn → setCount(1)
  }

  return (
    <div>
      <span>{count}</span>
      <button onClick={increment3}>+3</button>
    </div>
  );
}
```

### Tại sao xảy ra
React **batch** các setState trong cùng event handler để chỉ re-render 1 lần. Trong cùng lượt handler:
- `count` vẫn là giá trị cũ (= 0).
- 3 lần `setCount(count + 1)` đều xếp hàng giá trị `1`.
- React render với `count = 1`.

Đây không phải bug của React — đây là tối ưu performance.

### Cách phát hiện
- **Console.log(count) sau setState**: vẫn in giá trị cũ.
- **React DevTools Profiler**: thấy chỉ 1 lần re-render dù gọi 3 setState.
- **State 1 sau click thay vì 3**: dấu hiệu rõ nhất.

### 3 cách fix

**Cách 1 — Functional setState (chính xác nhất):**

```tsx
function increment3() {
  setCount(c => c + 1); // c = 0 → return 1
  setCount(c => c + 1); // c = 1 → return 2
  setCount(c => c + 1); // c = 2 → return 3
}
```

React nối tiếp callback với giá trị **vừa update** xong.

**Cách 2 — Tính trước rồi setState 1 lần:**

```tsx
function increment3() {
  setCount(count + 3);
}
```

**Cách 3 — Dùng `useReducer` cho logic phức tạp:**

```tsx
const [count, dispatch] = useReducer((s: number, a: "inc") => s + 1, 0);

function increment3() {
  dispatch("inc");
  dispatch("inc");
  dispatch("inc"); // → 3
}
```

> Quy tắc vàng: **mọi khi setState mới phụ thuộc state cũ, dùng functional form `setX(prev => ...)`**.

---

## 5. Index làm `key` trong list — bug reconciliation

### Tên bug + triệu chứng
Trang ghế có danh sách selected seats. Khi user click **xóa ghế ở giữa**, input ghi chú của ghế **cuối cùng** bị mất, hoặc state animation lệch sang ghế khác.

### Code reproduce

```tsx
type Seat = { id: string; row: string; col: number };

export function SeatList({ seats }: { seats: Seat[] }) {
  return (
    <ul>
      {seats.map((seat, index) => (
        // BUG: key là index
        <li key={index}>
          <SeatItem seat={seat} />
        </li>
      ))}
    </ul>
  );
}

function SeatItem({ seat }: { seat: Seat }) {
  const [note, setNote] = useState("");
  return (
    <div>
      <span>{seat.row}{seat.col}</span>
      <input value={note} onChange={e => setNote(e.target.value)} />
    </div>
  );
}
```

Có 3 ghế `[A1, A2, A3]`. User gõ note `"VIP"` vào A2. User xóa A1. Mảng còn `[A2, A3]`. Note `"VIP"` giờ hiển thị ở vị trí của **A2** nhưng input nội dung lại nằm trên **A3** (vì state component cũ ở index 1 đã được tái sử dụng).

### Tại sao xảy ra
React dùng `key` để biết DOM nào ứng với item nào. Khi `key = index`:
- Trước: `[key=0: A1] [key=1: A2] [key=2: A3]`
- Sau khi xóa A1: `[key=0: A2] [key=1: A3]`

React thấy `key=0` vẫn tồn tại → giữ DOM cũ → component instance cũ giữ nguyên state. Kết quả: state `note = "VIP"` (vốn của A2 trước đây ở index 1) giờ thuộc về **A2 ở index 0** mới — nhưng input value `note` thật ra vẫn là giá trị cũ thuộc instance khác.

### Cách phát hiện
- **React DevTools**: state của một component không tương ứng với prop hiển thị.
- **Animation reset không đúng**: enter/leave animation áp dụng nhầm item.
- **Input giữ giá trị cũ** dù prop thay đổi.

### 3 cách fix

**Cách 1 — Dùng ID stable của data (chuẩn nhất):**

```tsx
{seats.map(seat => (
  <li key={seat.id}> {/* ← UUID/PK từ DB */}
    <SeatItem seat={seat} />
  </li>
))}
```

**Cách 2 — Tạo key composite nếu không có ID:**

```tsx
{seats.map(seat => (
  <li key={`${seat.row}-${seat.col}`}>
    <SeatItem seat={seat} />
  </li>
))}
```

**Cách 3 — Dùng `crypto.randomUUID()` khi tạo item (chỉ khi item không có ID):**

```tsx
const [items, setItems] = useState(() =>
  initialItems.map(i => ({ ...i, _key: crypto.randomUUID() }))
);

{items.map(i => <li key={i._key}>{i.name}</li>)}
```

> Quy tắc vàng: chỉ dùng `index` làm key khi danh sách **không thay đổi thứ tự, không thêm/xóa giữa, item không có state riêng**.

---

## 6. Input `type="number"` trả về string

### Tên bug + triệu chứng
Form Tạo phòng có ô "Số ghế tối đa". User nhập `100`, gửi BE thì BE trả lỗi `"Failed to deserialize: expected number, got string"`. Hoặc tính tổng tiền `total = price * quantity` ra `"500050005000"` thay vì `15000`.

### Code reproduce

```tsx
export function PriceForm() {
  const [price, setPrice] = useState(0);
  const [quantity, setQuantity] = useState(0);

  return (
    <div>
      <input
        type="number"
        value={price}
        onChange={e => setPrice(e.target.value as unknown as number)} // BUG
      />
      <input
        type="number"
        value={quantity}
        onChange={e => setQuantity(e.target.value as unknown as number)}
      />
      <div>Total: {price * quantity}</div>
    </div>
  );
}
```

`e.target.value` là **string**, ép kiểu bằng `as` chỉ qua mặt TypeScript chứ runtime vẫn là string. `"5000" * "3" = 15000` (vì JS auto coerce với `*`), nhưng `"5000" + "3" = "50003"`.

### Tại sao xảy ra
HTML spec định nghĩa mọi `input.value` là **string**, bất kể `type`. JavaScript auto-coerce trong nhiều phép toán nhưng:
- `+` ưu tiên nối chuỗi nếu có ít nhất 1 operand là string.
- Gửi qua JSON, BE Spring nhận `"5000"` thay vì `5000` → fail validation `@Min(0) Long`.

### Cách phát hiện
- **`typeof price === "string"`** sau khi gõ.
- **Network tab**: body request có `"price": "5000"` (có dấu nháy) thay vì `"price": 5000`.
- **BE log**: `Cannot deserialize value of type java.lang.Long from String "5000"`.

### 3 cách fix

**Cách 1 — `valueAsNumber` (HTML5, gọn nhất):**

```tsx
<input
  type="number"
  value={price}
  onChange={e => setPrice(e.target.valueAsNumber || 0)}
/>
```

Nếu user xóa hết, `valueAsNumber` trả `NaN` → dùng `|| 0` để fallback.

**Cách 2 — Parse thủ công:**

```tsx
<input
  type="number"
  value={price}
  onChange={e => {
    const n = Number(e.target.value);
    if (!isNaN(n)) setPrice(n);
  }}
/>
```

**Cách 3 — Dùng component PriceInput riêng (CineX cách chính):**

```tsx
// src/components/PriceInput.tsx
type Props = { value: number; onChange: (v: number) => void };

export function PriceInput({ value, onChange }: Props) {
  return (
    <input
      type="text"
      inputMode="numeric"
      value={value.toLocaleString("vi-VN") + "đ"}
      onChange={e => {
        const raw = e.target.value.replace(/[^\d]/g, "");
        onChange(Number(raw) || 0);
      }}
    />
  );
}
```

> Bonus: chặn ký tự `e`, `-`, `+` (HTML number cho phép scientific notation):
>
> ```tsx
> <input
>   type="number"
>   onKeyDown={e => ["e", "E", "-", "+"].includes(e.key) && e.preventDefault()}
> />
> ```

---

## 7. useEffect thiếu dep hoặc dep object inline → infinite loop

### Tên bug + triệu chứng
Mở trang Movie List, tab Network spam request liên tục, CPU 100%, tab chậm dần và treo. Hoặc dữ liệu hiển thị **luôn cũ** dù state đã đổi.

### Code reproduce (infinite loop)

```tsx
import { useEffect, useState } from "react";

export function MovieList() {
  const [movies, setMovies] = useState([]);

  useEffect(() => {
    api.get("/movies", { params: { sort: "createdAt" } }).then(r => setMovies(r.data));
  }, [{ sort: "createdAt" }]); // ← BUG: object inline mỗi render là instance mới

  return <div>{movies.length}</div>;
}
```

### Code reproduce (stale)

```tsx
export function MovieList({ keyword }: { keyword: string }) {
  const [movies, setMovies] = useState([]);

  useEffect(() => {
    api.get("/movies", { params: { keyword } }).then(r => setMovies(r.data));
  }, []); // ← BUG: thiếu `keyword` trong deps
}
```

Khi user gõ tìm kiếm, `keyword` đổi nhưng effect không chạy lại → vẫn hiển thị kết quả cũ.

### Tại sao xảy ra
React so sánh deps bằng **`Object.is`** (giống `===`). Mỗi render, object literal `{ sort: "createdAt" }` là **instance mới** → khác instance cũ → effect chạy lại → setState → render → object mới → loop.

Ngược lại, nếu thiếu dep → React không biết khi nào chạy lại → closure giữ giá trị cũ → stale.

### Cách phát hiện
- **Network tab**: hàng trăm request `/movies` mỗi giây.
- **ESLint `react-hooks/exhaustive-deps`**: cảnh báo missing/extra deps.
- **React DevTools Profiler**: số lần render cao bất thường.

### 3 cách fix

**Cách 1 — `useMemo` cho object:**

```tsx
const params = useMemo(() => ({ sort: "createdAt", keyword }), [keyword]);

useEffect(() => {
  api.get("/movies", { params }).then(r => setMovies(r.data));
}, [params]);
```

**Cách 2 — Đưa primitive vào deps:**

```tsx
useEffect(() => {
  api.get("/movies", { params: { sort: "createdAt", keyword } }).then(r => setMovies(r.data));
}, [keyword]); // ← chỉ phụ thuộc keyword string
```

**Cách 3 — Dùng TanStack Query (giải pháp tốt nhất cho CineX):**

```tsx
const { data: movies } = useQuery({
  queryKey: ["movies", keyword],
  queryFn: () => api.get("/movies", { params: { keyword } }).then(r => r.data),
});
```

> Query key gồm string/primitive → React Query tự so sánh chuẩn, không cần `useMemo`.

---

## 8. Gọi hook trong điều kiện `if (x) useState(...)`

### Tên bug + triệu chứng
Console báo:
```
React Hook "useState" is called conditionally. React Hooks must be called in the exact same order in every component render.
```
Hoặc tệ hơn: state nhảy lung tung giữa các render, không lỗi nhưng UI sai.

### Code reproduce

```tsx
export function UserPanel({ isLoggedIn }: { isLoggedIn: boolean }) {
  if (!isLoggedIn) return <Login />;

  // BUG: hook nằm sau early return
  const [tab, setTab] = useState("profile");

  return <Tabs value={tab} onChange={setTab} />;
}
```

Hoặc:

```tsx
export function Form({ mode }: { mode: "create" | "edit" }) {
  if (mode === "edit") {
    const { data } = useQuery({ queryKey: ["x"], queryFn: fetchX }); // BUG
  }
  // ...
}
```

### Tại sao xảy ra
React identify state của từng hook bằng **thứ tự gọi**. Render 1 gọi `useState` → React lưu state vào slot #0. Render 2 nếu skip → slot #0 chuyển thành state của hook khác → corrupt.

Đây là **Rules of Hooks** số 1: *Only call hooks at the top level*.

### Cách phát hiện
- **Console warning đỏ** "Hook called conditionally".
- **ESLint `react-hooks/rules-of-hooks`**: bắt 100% trường hợp.
- **Bug khó hiểu**: state component biến mất hoặc bị share giữa các component.

### 3 cách fix

**Cách 1 — Đưa tất cả hook lên trước early return:**

```tsx
export function UserPanel({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [tab, setTab] = useState("profile"); // ← luôn gọi

  if (!isLoggedIn) return <Login />;
  return <Tabs value={tab} onChange={setTab} />;
}
```

**Cách 2 — Tách component con:**

```tsx
export function UserPanel({ isLoggedIn }: { isLoggedIn: boolean }) {
  if (!isLoggedIn) return <Login />;
  return <LoggedInPanel />; // hooks nằm trong đây
}

function LoggedInPanel() {
  const [tab, setTab] = useState("profile");
  return <Tabs value={tab} onChange={setTab} />;
}
```

**Cách 3 — `enabled` option cho query:**

```tsx
export function Form({ mode, id }: { mode: "create" | "edit"; id?: string }) {
  const { data } = useQuery({
    queryKey: ["item", id],
    queryFn: () => fetchItem(id!),
    enabled: mode === "edit" && !!id, // ← không gọi nếu false
  });
}
```

---

## 9. Closure trong queryFn TanStack Query capture state cũ

### Tên bug + triệu chứng
Dropdown filter `genre` thay đổi nhưng kết quả API **vẫn dùng genre cũ** dù bạn thấy `queryKey` đã đổi.

### Code reproduce

```tsx
export function MovieList() {
  const [genre, setGenre] = useState("all");

  const fetchMovies = () => api.get("/movies", { params: { genre } }).then(r => r.data);

  const { data } = useQuery({
    queryKey: ["movies"], // BUG 1: key không đổi
    queryFn: fetchMovies,
  });

  // ...
}
```

Hoặc cách khác:

```tsx
const { data } = useQuery({
  queryKey: ["movies", genre],
  queryFn: () => {
    // BUG 2: dùng biến từ closure cũ
    return api.get("/movies", { params: { genre } }).then(r => r.data);
  },
});
```

Trường hợp 2 thực ra **OK** vì queryKey đổi → queryFn tạo lại → closure mới. Nhưng nếu bạn dùng `useCallback` ổn định queryFn thì lại stale:

```tsx
const queryFn = useCallback(
  () => api.get("/movies", { params: { genre } }).then(r => r.data),
  [] // BUG: thiếu `genre`
);

const { data } = useQuery({ queryKey: ["movies", genre], queryFn });
```

### Tại sao xảy ra
TanStack Query gọi `queryFn` mỗi khi `queryKey` đổi. Nhưng **bản thân queryFn** là function tạo từ render cũ → capture biến `genre` cũ → request sai params.

### Cách phát hiện
- **Network tab**: request có param `genre=all` dù state `genre = "action"`.
- **React Query DevTools**: queryKey đúng nhưng response không khớp.
- **`console.log("queryFn called with", genre)`**: in ra giá trị cũ.

### 3 cách fix

**Cách 1 — Truyền tham số qua queryFn context:**

```tsx
const { data } = useQuery({
  queryKey: ["movies", genre],
  queryFn: ({ queryKey }) => {
    const [, g] = queryKey;
    return api.get("/movies", { params: { genre: g } }).then(r => r.data);
  },
});
```

**Cách 2 — Đưa queryFn inline (không `useCallback`):**

```tsx
const { data } = useQuery({
  queryKey: ["movies", genre],
  queryFn: () => api.get("/movies", { params: { genre } }).then(r => r.data),
});
```

Mỗi render queryFn được tạo lại → closure mới → đúng. React Query không re-run queryFn chỉ vì function identity đổi (chỉ dựa vào queryKey).

**Cách 3 — Custom hook factory:**

```tsx
function useMovies(genre: string) {
  return useQuery({
    queryKey: ["movies", genre],
    queryFn: () => api.get("/movies", { params: { genre } }).then(r => r.data),
  });
}

// Page:
const { data } = useMovies(genre);
```

---

## 10. Mutation success không invalidate query → UI không refresh

### Tên bug + triệu chứng
User bấm "Tạo phim" → dialog đóng, toast hiện "Thành công", nhưng bảng **vẫn hiển thị danh sách cũ** không có phim vừa tạo. Phải F5 mới thấy.

### Code reproduce

```tsx
export function useCreateMovie() {
  return useMutation({
    mutationFn: (data: MovieCreate) => api.post("/movies", data),
    onSuccess: () => {
      toast.success("Tạo phim thành công");
      // BUG: thiếu invalidateQueries
    },
  });
}
```

### Tại sao xảy ra
TanStack Query cache dữ liệu theo `queryKey`. Khi mutation thành công, cache **không tự động** invalidate vì Query không biết mutation này liên quan gì. Bạn phải báo cho nó.

### Cách phát hiện
- **React Query DevTools**: query `["movies"]` vẫn ở trạng thái `fresh` với data cũ.
- **Network tab**: không có request GET `/movies` mới sau khi POST thành công.
- **UI cũ**: row mới không xuất hiện.

### 3 cách fix

**Cách 1 — `invalidateQueries` (chuẩn nhất):**

```tsx
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useCreateMovie() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: MovieCreate) => api.post("/movies", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["movies"] });
      toast.success("Tạo phim thành công");
    },
  });
}
```

Tất cả query bắt đầu bằng `["movies", ...]` sẽ refetch.

**Cách 2 — `setQueryData` (optimistic, không refetch):**

```tsx
onSuccess: (newMovie) => {
  qc.setQueryData<Movie[]>(["movies"], (old = []) => [newMovie, ...old]);
  toast.success("Tạo phim thành công");
}
```

Nhanh hơn (không gọi GET), nhưng nguy hiểm nếu BE thêm field khác (audit, computed).

**Cách 3 — Optimistic update + rollback:**

```tsx
return useMutation({
  mutationFn: (data: MovieCreate) => api.post("/movies", data),
  onMutate: async (data) => {
    await qc.cancelQueries({ queryKey: ["movies"] });
    const prev = qc.getQueryData<Movie[]>(["movies"]);
    qc.setQueryData<Movie[]>(["movies"], (old = []) => [{ ...data, id: "tmp" } as Movie, ...old]);
    return { prev };
  },
  onError: (_err, _vars, ctx) => {
    qc.setQueryData(["movies"], ctx?.prev); // rollback
  },
  onSettled: () => qc.invalidateQueries({ queryKey: ["movies"] }),
});
```

> CineX khuyến nghị Cách 1 cho 90% trường hợp. Cách 3 chỉ dùng cho UX critical (like button, comment).

---

## 11. Zustand selector trả object inline → re-render mỗi lần

### Tên bug + triệu chứng
Một component có dùng Zustand store re-render **mọi lúc** dù state liên quan không đổi. Hoặc gặp warning:
```
The result of getSnapshot should be cached to avoid an infinite loop
```

### Code reproduce

```tsx
// store/authStore.ts
import { create } from "zustand";

type AuthStore = {
  user: User | null;
  token: string | null;
  isAdmin: boolean;
  setUser: (u: User) => void;
};

export const useAuth = create<AuthStore>(/* ... */);

// Component
function Header() {
  // BUG: object inline → reference mới mỗi render
  const { user, token } = useAuth(s => ({ user: s.user, token: s.token }));
  return <div>{user?.name}</div>;
}
```

### Tại sao xảy ra
Zustand so sánh **strict equality (`===`)** với output selector. Object literal mới mỗi lần → không bằng object lần trước → trigger re-render → render lại → object mới → loop (hoặc ít nhất là re-render thừa).

### Cách phát hiện
- **React DevTools Profiler**: component render nhiều lần dù props/state hiển thị không đổi.
- **Console warning** "infinite loop in getSnapshot".
- **`useEffect(() => console.log("render"))`** in liên tục.

### 3 cách fix

**Cách 1 — `shallow` equality (Zustand v4):**

```tsx
import { shallow } from "zustand/shallow";

const { user, token } = useAuth(
  s => ({ user: s.user, token: s.token }),
  shallow
);
```

**Cách 2 — Tách selector primitive:**

```tsx
const user = useAuth(s => s.user);
const token = useAuth(s => s.token);
```

Mỗi selector trả primitive/reference stable → React chỉ re-render khi đúng phần đó đổi.

**Cách 3 — `useShallow` helper (Zustand v4.4+):**

```tsx
import { useShallow } from "zustand/react/shallow";

const { user, token } = useAuth(
  useShallow(s => ({ user: s.user, token: s.token }))
);
```

> Quy tắc CineX: với store chỉ cần 1-2 field, dùng **Cách 2** (selector primitive). Với form nhiều field, dùng **Cách 3**.

---

## 12. WebSocket connect 2 lần ở dev (StrictMode) — ghost connection

### Tên bug + triệu chứng
Trang seat map (realtime) ở dev nhận **mỗi event 2 lần**. Backend log thấy 2 connection từ cùng client. Sau khi rời trang, vẫn còn 1 connection sống (ghost).

### Code reproduce

```tsx
import { useEffect } from "react";

export function SeatMap({ showtimeId }: { showtimeId: string }) {
  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:8088/ws/showtime/${showtimeId}`);
    ws.onmessage = e => console.log("[seat]", e.data);
    // BUG: thiếu cleanup
  }, [showtimeId]);

  return <div>...</div>;
}
```

Ở dev, StrictMode mount → unmount → mount lại:
- Mount lần 1: tạo WS-1.
- Unmount: **không** đóng WS-1 (vì thiếu cleanup) → ghost.
- Mount lần 2: tạo WS-2.

Sau đó user nhận event 2 lần (từ cả WS-1 và WS-2).

### Tại sao xảy ra
StrictMode kiểm tra effect có cleanup không. Effect không return cleanup → resource leak. WebSocket vẫn duy trì connection dù component không còn trên màn hình.

### Cách phát hiện
- **Backend log**: 2 line `WebSocket connected: clientId=xxx` cách nhau ms.
- **Browser DevTools Network → WS tab**: thấy 2 connection.
- **Mỗi event in console 2 lần.**

### 3 cách fix

**Cách 1 — Cleanup đúng cách:**

```tsx
useEffect(() => {
  const ws = new WebSocket(`ws://localhost:8088/ws/showtime/${showtimeId}`);
  ws.onmessage = e => console.log("[seat]", e.data);

  return () => {
    ws.close(); // ← đóng khi unmount
  };
}, [showtimeId]);
```

**Cách 2 — Dùng `useRef` flag (chỉ tạo 1 lần đời, tránh hẳn StrictMode):**

```tsx
const wsRef = useRef<WebSocket | null>(null);

useEffect(() => {
  if (wsRef.current) return; // đã connect rồi → skip
  wsRef.current = new WebSocket(`ws://...`);
  wsRef.current.onmessage = e => console.log(e.data);

  return () => {
    wsRef.current?.close();
    wsRef.current = null;
  };
}, []);
```

**Cách 3 — Dùng thư viện chuyên dụng (`react-use-websocket`):**

```tsx
import useWebSocket from "react-use-websocket";

const { lastMessage } = useWebSocket(`ws://localhost:8088/ws/showtime/${showtimeId}`);
useEffect(() => {
  if (lastMessage) console.log(lastMessage.data);
}, [lastMessage]);
```

Lib tự xử lý reconnect, cleanup, dedupe trong StrictMode.

> Quy tắc CineX: **luôn cleanup** effect tạo resource (WS, interval, subscription, observer). Đây là test xem code bạn có "đúng kiểu React" không.

---

## 13. Axios interceptor infinite loop khi `/auth/refresh` cũng 401

### Tên bug + triệu chứng
Token hết hạn → 1 request đầu tiên bị 401 → interceptor gọi `/auth/refresh` → refresh cũng 401 → interceptor lại gọi `/auth/refresh` → vòng lặp 100% CPU, hàng nghìn request /auth/refresh trong 1 giây.

### Code reproduce

```tsx
// src/api/axios.ts
import axios from "axios";

export const api = axios.create({ baseURL: "/api" });

api.interceptors.response.use(
  res => res,
  async err => {
    if (err.response?.status === 401) {
      // BUG: dùng `api` (đã có interceptor) → loop
      const { data } = await api.post("/auth/refresh");
      localStorage.setItem("token", data.token);
      return api(err.config); // retry
    }
    throw err;
  }
);
```

Khi refresh token cũng hết hạn → BE trả 401 → interceptor lại bắt → gọi `/auth/refresh` lần 2 → vô tận.

### Tại sao xảy ra
Interceptor áp dụng cho **mọi** request gửi qua instance `api`. Khi gọi `api.post("/auth/refresh")`, request này cũng đi qua interceptor → bắt 401 → loop.

### Cách phát hiện
- **Network tab**: hàng trăm request `/auth/refresh` trong 1 giây.
- **CPU 100%**.
- **Browser treo** sau vài giây.

### 3 cách fix

**Cách 1 — Dùng `axios.post` thẳng (không qua interceptor):**

```tsx
api.interceptors.response.use(
  res => res,
  async err => {
    if (err.response?.status === 401 && !err.config._retry) {
      err.config._retry = true;
      // Dùng axios raw, không qua `api` instance
      const { data } = await axios.post("/api/auth/refresh", {}, {
        baseURL: api.defaults.baseURL,
      });
      localStorage.setItem("token", data.token);
      err.config.headers.Authorization = `Bearer ${data.token}`;
      return api(err.config);
    }
    throw err;
  }
);
```

**Cách 2 — Cờ `_retry` trên config (chống retry vô hạn):**

```tsx
if (err.response?.status === 401 && !err.config._retry) {
  err.config._retry = true; // ← chỉ retry 1 lần
  // ...
}
```

**Cách 3 — Skip interceptor với header riêng:**

```tsx
api.interceptors.request.use(req => {
  if (req.headers["X-Skip-Auth"]) {
    delete req.headers["X-Skip-Auth"];
    return req;
  }
  // ...
});

// Khi gọi refresh:
await api.post("/auth/refresh", {}, { headers: { "X-Skip-Auth": "1" } });
```

> Kết hợp Cách 1 + Cách 2 là an toàn nhất. Nếu refresh fail → redirect `/login`:
>
> ```tsx
> try {
>   const { data } = await axios.post(...);
>   // ...
> } catch {
>   localStorage.removeItem("token");
>   window.location.href = "/login";
> }
> ```

---

## 14. `useState(fetchData())` chạy mỗi render — quên lazy init

### Tên bug + triệu chứng
Một component có heavy computation hoặc `localStorage` parse trong initial state khiến **mỗi render đều chạy lại** computation đó. CPU cao, hoặc localStorage bị đọc thừa.

### Code reproduce

```tsx
import { useState } from "react";

export function CartPage() {
  // BUG: parseInitialCart chạy MỖI RENDER, không chỉ render đầu
  const [cart, setCart] = useState(parseInitialCart());

  // ...
}

function parseInitialCart(): CartItem[] {
  console.log("[parseInitialCart] called"); // ← in mỗi render
  const raw = localStorage.getItem("cart");
  return raw ? JSON.parse(raw) : [];
}
```

### Tại sao xảy ra
`useState(value)` nhận **giá trị**. Mỗi render, biểu thức `parseInitialCart()` được **tính** (gọi function) trước rồi truyền vào. React chỉ dùng giá trị đó ở render đầu, nhưng function **vẫn được gọi** mỗi render — phí.

Khi cha re-render, con re-render → useState đánh giá lại argument → parse lại localStorage → tốn CPU và có thể gây bug nếu function có side-effect.

### Cách phát hiện
- **Console.log trong initial function**: in nhiều lần thay vì 1 lần.
- **React Profiler**: render time cao bất thường.
- **localStorage được đọc liên tục** (xem qua DevTools → Storage events).

### 3 cách fix

**Cách 1 — Lazy initializer (truyền function):**

```tsx
const [cart, setCart] = useState(() => parseInitialCart());
// ↑ React chỉ gọi function 1 lần ở mount
```

**Cách 2 — Dùng `useMemo` cho computed value:**

```tsx
const initial = useMemo(() => parseInitialCart(), []);
const [cart, setCart] = useState(initial);
```

(ít gọn hơn Cách 1, không khuyến nghị)

**Cách 3 — `useEffect` + setState (cho data async):**

```tsx
const [cart, setCart] = useState<CartItem[]>([]);

useEffect(() => {
  const raw = localStorage.getItem("cart");
  if (raw) setCart(JSON.parse(raw));
}, []);
```

> Cách 1 là chuẩn cho mọi initial state cần compute/parse. Cách 3 dành cho async (fetch API).

---

## 15. `useNavigate` gọi trong render thay vì handler/effect

### Tên bug + triệu chứng
Console báo:
```
Cannot update a component (Router) while rendering a different component (Page).
```
Hoặc trang redirect bị vòng lặp `/login → /home → /login`.

### Code reproduce

```tsx
import { useNavigate } from "react-router-dom";

export function ProtectedPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // BUG: navigate ngay trong render
  if (!user) navigate("/login");

  return <div>Welcome {user?.name}</div>;
}
```

### Tại sao xảy ra
Render phase phải **pure** — không được trigger setState/side effect. `navigate()` thay đổi route state → trigger re-render component khác → React phát hiện và warning.

### Cách phát hiện
- **Console warning** "Cannot update a component while rendering".
- **Vòng lặp redirect** trong URL bar.
- **Performance bad** do render → navigate → render lặp.

### 3 cách fix

**Cách 1 — Trong `useEffect`:**

```tsx
export function ProtectedPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) navigate("/login");
  }, [user, navigate]);

  if (!user) return null; // tránh render UI lỡ
  return <div>Welcome {user.name}</div>;
}
```

**Cách 2 — `<Navigate>` declarative:**

```tsx
import { Navigate } from "react-router-dom";

export function ProtectedPage() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <div>Welcome {user.name}</div>;
}
```

**Cách 3 — Route guard wrapper:**

```tsx
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// routes:
<Route path="/account" element={<RequireAuth><AccountPage /></RequireAuth>} />
```

> CineX khuyến nghị **Cách 3** vì có thể reuse cho mọi route cần auth.

---

## 16. React Query refetchOnWindowFocus gây surprise refetch

### Tên bug + triệu chứng
User đang xem trang booking, switch sang tab khác trả lời tin nhắn, quay lại → form bị reset, dữ liệu chớp nháy, hoặc state local mất.

### Code reproduce

```tsx
const { data: booking } = useQuery({
  queryKey: ["booking", id],
  queryFn: () => api.get(`/bookings/${id}`).then(r => r.data),
});

// Khi quay lại tab → query auto refetch → component re-render
// Form không controlled bằng data → bị reset
```

### Tại sao xảy ra
TanStack Query mặc định `refetchOnWindowFocus: true` để giữ data fresh. Mặc định này tốt cho **list page** nhưng **xấu** cho:
- Form đang nhập dở.
- Trang booking có countdown.
- Trang xem chi tiết không cần refresh.

### Cách phát hiện
- **Network tab**: thấy request GET ngay khi focus tab.
- **Form bị clear** sau khi switch tab.
- **Countdown reset** về giá trị mới.

### 3 cách fix

**Cách 1 — Tắt cho query cụ thể:**

```tsx
const { data: booking } = useQuery({
  queryKey: ["booking", id],
  queryFn: () => api.get(`/bookings/${id}`).then(r => r.data),
  refetchOnWindowFocus: false,
});
```

**Cách 2 — Tắt global trong QueryClient:**

```tsx
// src/main.tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});
```

**Cách 3 — `staleTime` cao (data coi như fresh lâu hơn):**

```tsx
useQuery({
  queryKey: ["booking", id],
  queryFn: () => api.get(`/bookings/${id}`).then(r => r.data),
  staleTime: 5 * 60_000, // 5 phút
});
```

> CineX khuyến nghị: tắt global `refetchOnWindowFocus`, bật riêng cho trang list cần realtime.

---

## 17. Date so sánh `===` không work

### Tên bug + triệu chứng
Bạn check 2 ngày bằng nhau để filter showtime hôm nay:

```tsx
const today = new Date();
const showtimeDate = new Date("2026-05-31");
if (today === showtimeDate) { /* không bao giờ chạy */ }
```

Hoặc `useEffect` deps có `Date` → infinite loop.

### Code reproduce

```tsx
export function ShowtimeList({ showtimes }: { showtimes: Showtime[] }) {
  const today = new Date(); // BUG 1: new Date mỗi render
  const todayShowtimes = showtimes.filter(s =>
    new Date(s.date) === today // BUG 2: === so sánh reference
  );

  useEffect(() => {
    console.log("today changed");
  }, [today]); // BUG 3: today luôn mới → effect chạy mỗi render

  return <div>{todayShowtimes.length}</div>;
}
```

### Tại sao xảy ra
`Date` là **object**. JavaScript `===` so sánh **reference**, không so sánh giá trị. Hai object tạo riêng dù có cùng timestamp vẫn không `===` nhau.

`new Date()` cũng tạo object mới mỗi lần → reference khác.

### Cách phát hiện
- **`console.log(date1 === date2)`** trả false dù in ra giống nhau.
- **Effect chạy infinite** khi deps có Date.
- **Filter return mảng rỗng** dù dữ liệu có.

### 3 cách fix

**Cách 1 — `.getTime()` (so sánh timestamp):**

```tsx
if (today.getTime() === showtimeDate.getTime()) { /* OK */ }
```

Nhưng so sánh "cùng ngày" cần normalize:

```tsx
function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
```

**Cách 2 — String ISO format:**

```tsx
const todayStr = new Date().toISOString().slice(0, 10); // "2026-05-31"
const showStr = new Date(s.date).toISOString().slice(0, 10);
if (todayStr === showStr) { /* OK, string === string */ }
```

**Cách 3 — Thư viện `date-fns`:**

```tsx
import { isSameDay, startOfToday } from "date-fns";

const today = startOfToday();
const matches = showtimes.filter(s => isSameDay(new Date(s.date), today));
```

> Bonus về `useEffect` deps:
>
> ```tsx
> // Thay vì:
> useEffect(() => { ... }, [new Date()]); // BAD
> // Dùng:
> const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
> useEffect(() => { ... }, [todayStr]);
> ```

---

## 18. Quên `forwardRef` khi component wrap input

### Tên bug + triệu chứng
Bạn tạo component `<CinexInput>` để chuẩn hóa style. Khi dùng với `react-hook-form`:

```tsx
const { register } = useForm();
<CinexInput {...register("email")} />
```

Form không lấy được value, validation không hoạt động. Console warning:
```
Function components cannot be given refs. Attempts to access this ref will fail.
```

### Code reproduce

```tsx
// BUG: không có forwardRef
export function CinexInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="bg-[#0d2137] border border-white/10 rounded-md px-3 py-2 text-white"
    />
  );
}
```

`register("email")` trả về `{ ref, onChange, onBlur, name }`. Spread vào `CinexInput` thì `ref` rơi vào function component → React reject.

### Tại sao xảy ra
Function component **không nhận ref** mặc định (vì không phải DOM node). Phải dùng `forwardRef` để forward ref xuống DOM thật bên trong.

### Cách phát hiện
- **Console warning** "Function components cannot be given refs".
- **Form không submit value** đúng.
- **`ref.current` luôn null** khi gọi từ parent.

### 3 cách fix

**Cách 1 — `forwardRef`:**

```tsx
import { forwardRef } from "react";

type Props = React.InputHTMLAttributes<HTMLInputElement>;

export const CinexInput = forwardRef<HTMLInputElement, Props>((props, ref) => {
  return (
    <input
      ref={ref}
      {...props}
      className="bg-[#0d2137] border border-white/10 rounded-md px-3 py-2 text-white"
    />
  );
});

CinexInput.displayName = "CinexInput"; // tốt cho devtools
```

**Cách 2 — Truyền ref qua prop khác (workaround):**

```tsx
type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  inputRef?: React.Ref<HTMLInputElement>;
};

export function CinexInput({ inputRef, ...props }: Props) {
  return <input ref={inputRef} {...props} className="..." />;
}

// Dùng:
<CinexInput inputRef={el => /* ... */} />
```

> Không tương thích với `react-hook-form register()` → không khuyến nghị.

**Cách 3 — React 19+ ref as prop:**

```tsx
// React 19 cho phép `ref` là prop bình thường
export function CinexInput({ ref, ...props }: Props & { ref?: React.Ref<HTMLInputElement> }) {
  return <input ref={ref} {...props} className="..." />;
}
```

> Nếu dự án dùng React 18 (CineX hiện tại) → dùng **Cách 1**. Khi nâng cấp React 19 mới chuyển Cách 3.

---

## Bảng tổng kết Triệu chứng → Fix

| # | Triệu chứng | Nguyên nhân | Fix nhanh |
|---|---|---|---|
| 1 | Effect chạy 2 lần ở dev | React StrictMode | Cleanup, hoặc kệ (production OK) |
| 2 | Countdown đứng yên ở giá trị `initial-1` | Stale closure trong `setInterval` | `setSeconds(prev => prev - 1)` |
| 3 | Tailwind class động không có màu | JIT không thấy class literal | Map object `{ green: "bg-green-..." }` |
| 4 | `setCount` 3 lần chỉ tăng 1 | State batching | `setCount(c => c + 1)` |
| 5 | Xóa item giữa list → input lệch | `key={index}` | `key={item.id}` |
| 6 | BE báo "string instead of number" | `e.target.value` luôn là string | `e.target.valueAsNumber` |
| 7 | Spam request, CPU 100% | Object inline trong deps | `useMemo` hoặc primitive deps |
| 8 | "Hook called conditionally" | Hook sau early return | Đưa hook lên top |
| 9 | Query trả data với filter cũ | Closure trong queryFn cũ | Đọc từ `queryKey` param |
| 10 | Tạo xong row không hiện | Quên `invalidateQueries` | `qc.invalidateQueries({queryKey})` |
| 11 | Component re-render liên tục | Selector trả object inline | `useShallow` hoặc tách primitive |
| 12 | WS nhận event 2 lần ở dev | Thiếu cleanup hoặc useRef flag | `return () => ws.close()` |
| 13 | Refresh token spam vô hạn | Interceptor catch chính nó | `axios.post` raw + `_retry` flag |
| 14 | `parseInitialCart` chạy mỗi render | useState argument không lazy | `useState(() => parse())` |
| 15 | "Cannot update component while rendering" | `navigate()` trong render | `useEffect` hoặc `<Navigate>` |
| 16 | Form reset khi switch tab | `refetchOnWindowFocus: true` | Tắt option hoặc set `staleTime` |
| 17 | `date1 === date2` luôn false | Object reference equality | `.getTime()` hoặc `date-fns` |
| 18 | "Function components cannot be given refs" | Quên `forwardRef` | `forwardRef<HTMLInputElement, Props>` |

---

## Câu hỏi tự kiểm tra

> Trả lời được hết 5 câu là bạn đã thấm — không trả lời được câu nào hãy đọc lại bug tương ứng.

1. **Tại sao `setSeconds(prev => prev - 1)` trong setInterval lại đúng, còn `setSeconds(seconds - 1)` lại sai dù trông giống nhau?**
   *(Gợi ý: closure capture biến tại thời điểm tạo function. Functional form đọc state mới nhất từ React.)*

2. **Tại sao `<span className={'bg-${color}-500'}>` không hiển thị màu dù tên class tạo ra đúng cú pháp Tailwind?**
   *(Gợi ý: JIT compiler quét code text tĩnh, không evaluate template literal runtime.)*

3. **Khi nào nên dùng `index` làm `key` trong `.map()`? Khi nào cấm dùng?**
   *(Gợi ý: list cố định, không thêm/xóa giữa, item không state riêng → OK. Còn lại dùng ID stable.)*

4. **Mutation `useCreateMovie` thành công nhưng bảng vẫn cũ. Hãy mô tả 2 cách fix và đánh đổi giữa chúng.**
   *(Gợi ý: `invalidateQueries` (đơn giản, có thêm request GET) vs `setQueryData` (nhanh, có rủi ro stale field).)*

5. **Giải thích vì sao `useState(parseCart())` tệ về hiệu năng, và sửa lại đúng cách. Khi nào nên dùng `useEffect` thay vì `useState` lazy init cho initial data?**
   *(Gợi ý: function bị gọi mỗi render → CPU phí. Lazy `useState(() => parseCart())` chạy 1 lần. Khi data async hoặc cần re-fetch theo deps → dùng `useEffect`.)*

---

> Đọc xong file này, bạn nên print bảng tổng kết và dán bên cạnh máy. 90% bug React của sinh viên là 18 bug ở trên — gặp lần đầu tra cứu, lần thứ hai gặp lại thì đã quen tay.
