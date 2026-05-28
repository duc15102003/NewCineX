# JavaScript — Ngôn ngữ lập trình của trình duyệt

> Đọc file này SAU `pre-01-html-css-basics.md`, TRƯỚC `00-typescript-basics.md`.

## JavaScript là gì?

JavaScript (JS) = ngôn ngữ lập trình **chạy trong trình duyệt** (Chrome, Firefox, Safari).

- **HTML** = cấu trúc trang (đoạn văn, nút bấm, ô nhập)
- **CSS** = trang trí (màu, font, bố cục)
- **JavaScript** = **hành vi** (bấm nút → chạy code → thay đổi trang)

**Ví dụ:** User bấm "Đặt vé" → JS gửi dữ liệu lên server → nhận kết quả → hiển thị QR code. Không có JS → trang web chỉ là văn bản tĩnh, không tương tác.

---

## 1. Biến (Variable) — lưu dữ liệu

```javascript
// const = hằng số, KHÔNG đổi sau khi gán
const username = "vanan"         // Chuỗi (string) — bọc trong ""
const age = 22                   // Số (number)
const isAdmin = false            // Đúng/sai (boolean) — true hoặc false

// let = biến, CÓ THỂ đổi sau
let count = 0
count = count + 1                // count = 1
count = 5                        // count = 5

// Tại sao 2 loại?
// const: dùng khi giá trị KHÔNG đổi (username, API URL, ...)
// let: dùng khi giá trị CÓ THỂ đổi (đếm số, trạng thái, ...)
// Quy tắc: ƯU TIÊN const, chỉ dùng let khi cần thay đổi
```

---

## 2. Kiểu dữ liệu (Data Types)

```javascript
// String — chuỗi ký tự
const name = "Vũ Tường An"
const greeting = `Xin chào ${name}`   // Template literal — chèn biến vào chuỗi
// greeting = "Xin chào Vũ Tường An"

// Number — số
const price = 75000
const rating = 8.5

// Boolean — đúng/sai
const isLoggedIn = true
const isExpired = false

// null — "không có gì" (chủ đích)
const avatar = null   // user chưa upload avatar

// undefined — "chưa gán giá trị"
let phone           // phone = undefined (khai báo nhưng chưa gán)

// Array — danh sách (mảng)
const genres = ["Action", "Horror", "Comedy"]
genres[0]           // "Action" (index bắt đầu từ 0)
genres.length       // 3

// Object — nhóm nhiều giá trị có tên
const movie = {
  title: "Avengers",
  duration: 181,
  rating: 8.5,
  genres: ["Action", "Sci-Fi"],
}
movie.title         // "Avengers"
movie.duration      // 181
```

---

## 3. Hàm (Function) — khối code tái sử dụng

```javascript
// Hàm truyền thống
function greet(name) {
  return "Xin chào " + name
}
greet("An")    // "Xin chào An"

// Arrow function — cách viết ngắn gọn hơn (React dùng nhiều)
const greet = (name) => {
  return "Xin chào " + name
}

// Arrow function 1 dòng — bỏ {} và return
const greet = (name) => "Xin chào " + name

// Hàm không tham số
const sayHello = () => "Hello!"

// Hàm nhiều tham số
const add = (a, b) => a + b
add(3, 5)     // 8
```

**Tại sao cần hàm?**
```javascript
// Không có hàm — lặp lại code
console.log("Xin chào An")
console.log("Xin chào Bình")
console.log("Xin chào Cường")

// Có hàm — viết 1 lần, dùng nhiều lần
const greet = (name) => console.log("Xin chào " + name)
greet("An")
greet("Bình")
greet("Cường")
```

---

## 4. Mảng (Array) — phương thức quan trọng

React dùng RẤT NHIỀU các phương thức mảng sau:

### .map() — biến đổi từng phần tử

```javascript
const prices = [75000, 100000, 150000]

// Nhân đôi mỗi giá
const doubled = prices.map((price) => price * 2)
// doubled = [150000, 200000, 300000]

// Ví dụ React: biến array phim → array component
const movies = ["Avengers", "John Wick", "Frozen"]
// movies.map((movie) => <MovieCard title={movie} />)
// → 3 MovieCard components
```

**Đọc:** "Với MỖI phần tử trong mảng, làm gì đó, trả về mảng mới."

### .filter() — lọc phần tử

```javascript
const movies = [
  { title: "Avengers", rating: 8.5 },
  { title: "Bad Movie", rating: 3.0 },
  { title: "John Wick", rating: 7.8 },
]

// Chỉ lấy phim rating >= 7
const goodMovies = movies.filter((movie) => movie.rating >= 7)
// goodMovies = [{ title: "Avengers", ... }, { title: "John Wick", ... }]
```

### .find() — tìm 1 phần tử

```javascript
const users = [
  { id: 1, name: "An" },
  { id: 2, name: "Bình" },
]

const user = users.find((u) => u.id === 2)
// user = { id: 2, name: "Bình" }
```

---

## 5. Destructuring — rút trích giá trị

```javascript
// Object destructuring — lấy field ra biến
const movie = { title: "Avengers", duration: 181, rating: 8.5 }

// Cách cũ:
const title = movie.title
const duration = movie.duration

// Destructuring (cách mới, ngắn gọn):
const { title, duration, rating } = movie
// title = "Avengers", duration = 181, rating = 8.5

// Array destructuring
const [first, second] = ["Action", "Horror"]
// first = "Action", second = "Horror"

// React dùng array destructuring cho useState:
const [count, setCount] = useState(0)
// count = giá trị hiện tại (0)
// setCount = hàm để đổi giá trị
```

---

## 6. Spread operator (...) — sao chép + mở rộng

```javascript
// Sao chép array
const genres = ["Action", "Horror"]
const moreGenres = [...genres, "Comedy"]
// moreGenres = ["Action", "Horror", "Comedy"]
// genres KHÔNG bị thay đổi

// Sao chép object + thay đổi 1 field
const movie = { title: "Avengers", rating: 7.0 }
const updated = { ...movie, rating: 8.5 }
// updated = { title: "Avengers", rating: 8.5 }
// movie KHÔNG bị thay đổi (immutable)

// React dùng spread RẤT NHIỀU:
setMovies((prev) => [...prev, newMovie])
// prev = danh sách phim cũ
// [...prev, newMovie] = danh sách cũ + phim mới
```

---

## 7. Async/Await — chờ kết quả từ server

Khi FE gọi API → phải **chờ** server trả kết quả (mạng chậm = chờ lâu).

```javascript
// ❌ KHÔNG async — code chạy tiếp không chờ
const data = fetch("/api/movies")    // Gửi request
console.log(data)                     // undefined! Chưa có kết quả

// ✅ CÓ async/await — chờ xong mới chạy tiếp
const fetchMovies = async () => {
  const response = await fetch("/api/movies")   // Chờ server trả về
  const data = await response.json()             // Chờ parse JSON
  console.log(data)                               // Có kết quả ✅
}

// Xử lý lỗi
const fetchMovies = async () => {
  try {
    const response = await fetch("/api/movies")
    const data = await response.json()
    return data
  } catch (error) {
    console.log("Lỗi:", error.message)  // Mất mạng, server down, ...
  }
}
```

**Ví dụ đời thường:**
- `await` = đặt cơm trên app → **chờ** shipper giao → nhận cơm → ăn
- Không có `await` = đặt cơm → ăn ngay → CHƯA CÓ CƠM! Lỗi

---

## 8. Callback & Arrow function trong sự kiện

```javascript
// Khi user bấm nút → chạy hàm
<button onClick={() => alert("Bạn đã bấm!")}>Bấm tôi</button>
//       │         │
//       │         └── Arrow function = code chạy khi click
//       └── onClick = sự kiện "bấm"

// Sự kiện phổ biến:
// onClick      → bấm
// onChange     → gõ chữ trong input
// onSubmit    → gửi form
// onMouseEnter → di chuột vào
```

---

## 9. Import / Export — chia code thành file

```javascript
// utils/format.js — EXPORT (xuất) hàm ra ngoài
export const formatPrice = (price) => {
  return price.toLocaleString("vi-VN") + "đ"
}

// MovieCard.js — IMPORT (nhập) hàm từ file khác
import { formatPrice } from "./utils/format"

formatPrice(75000)   // "75.000đ"
```

```
Tại sao cần import/export?
    1 file 5000 dòng → KHÔNG ai đọc nổi
    Chia thành 50 file × 100 dòng → dễ đọc, dễ tìm, dễ sửa
    File A cần dùng hàm từ file B → import
```

---

## 10. Tóm lại — cần nhớ gì trước khi học React

| Khái niệm | Ví dụ | React dùng ở đâu |
|---|---|---|
| `const` / `let` | `const name = "An"` | Khai báo biến, state |
| Arrow function | `(x) => x * 2` | Component, event handler |
| `.map()` | `items.map(i => <Item />)` | Render danh sách |
| Destructuring | `const { title } = movie` | Props, state |
| Spread `...` | `{...movie, rating: 9}` | Update state immutable |
| `async/await` | `await fetch(url)` | Gọi API |
| `import/export` | `import X from './X'` | Tổ chức code |
| Template literal | `` `Hello ${name}` `` | Chèn biến vào chuỗi |
