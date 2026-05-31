# Tailwind CSS — Viết CSS bằng utility classes

---

## Tailwind là gì?

Thay vì viết CSS trong file riêng, Tailwind cho phép viết style **trực tiếp trong HTML/JSX** bằng các class có sẵn.

### CSS truyền thống vs Tailwind

**CSS truyền thống:**
```css
/* styles.css */
.card {
    background-color: white;
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
.card-title {
    font-size: 18px;
    font-weight: bold;
    color: #333;
}
```
```html
<div class="card">
    <h3 class="card-title">Avengers</h3>
</div>
```

**Tailwind:**
```tsx
<div className="bg-white rounded-lg p-4 shadow-md">
    <h3 className="text-lg font-bold text-gray-800">Avengers</h3>
</div>
// Không cần file CSS riêng. Style viết ngay trong className.
```

---

## Các class thường dùng trong CineX

### Layout

```tsx
// Flexbox
<div className="flex items-center justify-between">  {/* ngang, căn giữa, 2 đầu */}
<div className="flex flex-col gap-4">                 {/* dọc, cách nhau 16px */}

// Grid
<div className="grid grid-cols-4 gap-4">              {/* 4 cột, cách 16px */}
<div className="grid grid-cols-1 md:grid-cols-3">     {/* mobile 1 cột, tablet 3 cột */}

// Container
<div className="max-w-7xl mx-auto px-4">              {/* max width + căn giữa + padding */}
```

### Spacing (margin, padding)

```
p-4  = padding 16px (tất cả)      m-4  = margin 16px
px-4 = padding ngang 16px          mx-4 = margin ngang
py-2 = padding dọc 8px             my-2 = margin dọc
pt-4 = padding top                  mb-4 = margin bottom
gap-4 = khoảng cách giữa flex/grid items

Quy tắc: số × 4px → p-1=4px, p-2=8px, p-4=16px, p-8=32px
```

### Typography

```tsx
<h1 className="text-3xl font-bold">CineX</h1>
<p className="text-sm text-gray-500">Mô tả phim</p>
<span className="text-amber-400 font-semibold">75.000 ₫</span>

// text-xs, text-sm, text-base, text-lg, text-xl, text-2xl, text-3xl
// font-normal, font-medium, font-semibold, font-bold
// text-gray-500, text-red-500, text-green-500, text-amber-400
```

### Colors

```tsx
// Background
<div className="bg-gray-950">     {/* nền tối (theme rạp phim) */}
<div className="bg-amber-500">    {/* nền vàng cam (nút chính) */}
<div className="bg-white">        {/* nền trắng */}

// Text
<span className="text-white">     {/* chữ trắng */}
<span className="text-gray-400">  {/* chữ xám nhạt */}
<span className="text-red-500">   {/* chữ đỏ (lỗi) */}
<span className="text-green-500"> {/* chữ xanh (thành công) */}

// Border
<div className="border border-gray-700 rounded-lg">
```

### Responsive

```tsx
// Mobile first: class mặc định cho mobile, thêm prefix cho màn hình lớn
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
//               mobile: 1 cột    tablet: 2 cột    desktop: 4 cột

// sm: ≥640px   md: ≥768px   lg: ≥1024px   xl: ≥1280px
```

### Hover, Focus

```tsx
<button className="bg-amber-500 hover:bg-amber-600 transition-colors">
    Đặt vé
</button>
// Bình thường: vàng cam. Hover: vàng cam đậm hơn. Chuyển màu mượt.

<input className="border border-gray-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200">
// Focus: viền vàng cam + ring
```

---

## Ví dụ thực tế trong CineX

### Movie Card

```tsx
function MovieCard({ movie }: { movie: Movie }) {
    return (
        <div className="bg-gray-900 rounded-lg overflow-hidden shadow-lg
                        hover:scale-105 transition-transform cursor-pointer">
            <img
                src={movie.posterUrl}
                alt={movie.title}
                className="w-full h-64 object-cover"
            />
            <div className="p-4">
                <h3 className="text-white font-bold text-lg truncate">
                    {movie.title}
                </h3>
                <div className="flex items-center gap-2 mt-2 text-sm text-gray-400">
                    <span>{movie.duration} phút</span>
                    <span>•</span>
                    <span className="text-amber-400">{movie.rating}/10</span>
                </div>
                <div className="flex gap-1 mt-2">
                    {movie.genres.map(g => (
                        <span key={g.id}
                              className="px-2 py-1 bg-gray-800 text-xs text-gray-300 rounded">
                            {g.name}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}
```

### Seat Map

```tsx
function SeatButton({ seat, isSelected, isBooked, onToggle }) {
    const baseClass = "w-8 h-8 rounded text-xs font-bold transition-colors";

    const colorClass =
        isBooked   ? "bg-red-500 text-white cursor-not-allowed" :   // đã đặt
        isSelected ? "bg-green-500 text-white" :                     // đang chọn
        seat.type === 'VIP'    ? "bg-yellow-500 text-black hover:bg-yellow-400" :
        seat.type === 'COUPLE' ? "bg-purple-500 text-white hover:bg-purple-400" :
                                 "bg-gray-600 text-white hover:bg-gray-500";  // thường

    return (
        <button
            className={`${baseClass} ${colorClass}`}
            disabled={isBooked}
            onClick={() => onToggle(seat)}
        >
            {seat.seatNumber}
        </button>
    );
}
```

---

## 6. Arbitrary values — Cú pháp `[value]`

CineX dùng nhiều hex màu cụ thể (`#eab308`, `#0a1929`...) không có sẵn trong palette mặc định của Tailwind. Giải pháp: arbitrary value.

```tsx
<div className="bg-[#0a1929] text-[#eab308] border-[#ffffff10]">
  Surface card với gold accent
</div>

<div className="w-[37px] h-[37px] grid-cols-[200px_1fr_100px]">
  Width/height/grid kích thước cụ thể không có trong scale
</div>
```

So sánh với extend Tailwind config:
```js
// tailwind.config.js (v3) hoặc CSS variables (v4)
theme: {
  extend: {
    colors: {
      'cinex-bg': '#051424',
      'cinex-surface': '#0a1929',
      'cinex-gold': '#eab308',
    }
  }
}
// Dùng: bg-cinex-bg text-cinex-gold
```

**Khi nào dùng `[value]`** vs **token**:
- 1-2 chỗ: arbitrary nhanh, không cần config.
- Dùng nhiều/định kỳ: extract thành token để đổi 1 chỗ, nhất quán.

**Cảnh báo**: arbitrary không có IntelliSense gợi ý → typo `bg-[#eab309]` không báo lỗi.

---

## 7. Dynamic class — Lỗi #1 với người mới

```tsx
// SAI — Tailwind không scan được string dynamic
function Badge({ color }: { color: "red" | "green" | "blue" }) {
  return <span className={`bg-${color}-500 text-${color}-100`}>...</span>;
  //                       ^^^^^^^^^^^^^^ class này KHÔNG có trong CSS bundle
}
```

**Tại sao**: Tailwind compile-time scan source code bằng regex để tìm class. `bg-${color}-500` là expression runtime → Tailwind không match → CSS không có rule → class không có hiệu lực.

**3 cách fix**:

**Cách 1 — Map object (best practice)**:
```tsx
const COLOR_MAP = {
  red: "bg-red-500 text-red-100",
  green: "bg-green-500 text-green-100",
  blue: "bg-blue-500 text-blue-100",
} as const;

function Badge({ color }: { color: keyof typeof COLOR_MAP }) {
  return <span className={COLOR_MAP[color]}>...</span>;
}
```

Class full được viết literal trong source → Tailwind scan thấy → CSS có rule.

**Cách 2 — Safelist trong config**:
```js
// tailwind.config.js
module.exports = {
  safelist: [
    {
      pattern: /bg-(red|green|blue)-(100|500|900)/,
    },
  ],
};
```

Buộc Tailwind generate những class này dù không xuất hiện trong source. Bundle CSS lớn hơn.

**Cách 3 — Inline style (escape hatch)**:
```tsx
<span style={{ backgroundColor: color === "red" ? "#ef4444" : "#22c55e" }}>
```

Mất utility class nhưng work runtime.

**Pattern CineX cho status badge**:
```tsx
// utils/colors.ts
export const STATUS_COLORS: Record<BookingStatus, string> = {
  HOLDING: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  CONFIRMED: "bg-green-500/20 text-green-400 border-green-500/30",
  CANCELLED: "bg-red-500/20 text-red-400 border-red-500/30",
};

<span className={`px-2 py-1 text-xs rounded border ${STATUS_COLORS[booking.status]}`}>
  {STATUS_LABELS[booking.status]}
</span>
```

---

## 8. Group + Peer modifiers

### `group` — style child khi hover parent
```tsx
<div className="group relative">
  <img src={posterUrl} className="transition-transform group-hover:scale-105" />
  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-black/50">
    Overlay
  </div>
</div>
```

Khi hover container `group`, child có `group-hover:` activate.

### `peer` — style sibling
```tsx
<label className="flex items-center gap-2">
  <input type="checkbox" className="peer" />
  <span className="text-gray-400 peer-checked:text-[#eab308]">Tôi đồng ý</span>
</label>
```

Khi checkbox checked, sibling `span` chuyển màu gold.

### Đặt tên group nested
```tsx
<div className="group/card">
  <div className="group/badge">
    <span className="group-hover/card:text-white group-hover/badge:bg-red-500">
      ...
    </span>
  </div>
</div>
```

### Ví dụ CineX
`MovieCard`: hover → poster zoom + overlay hiển thị + title đổi màu. Tất cả từ class `group` trên container ngoài.

---

## 9. Animation + Transition

### Transition (state thay đổi mượt)
```tsx
<button className="bg-[#eab308] hover:bg-[#ca8a04] transition-colors duration-200 ease-in-out">
  Click
</button>
```

Property phổ biến:
- `transition-colors`: bg, text, border color
- `transition-transform`: scale, translate, rotate
- `transition-opacity`: opacity
- `transition-all`: tất cả (tốn perf, tránh)

Duration: `duration-75 / 100 / 150 / 200 / 300 / 500 / 700 / 1000`.

Timing: `ease-linear / ease-in / ease-out / ease-in-out`.

### Animation built-in
```tsx
<div className="animate-spin">⏳</div>           // Loading
<div className="animate-pulse">▓▓▓</div>          // Skeleton
<div className="animate-bounce">↓</div>           // Scroll hint
```

### Custom @keyframes
```js
// tailwind.config.js
theme: {
  extend: {
    animation: {
      'fade-in': 'fadeIn 0.3s ease-in',
    },
    keyframes: {
      fadeIn: {
        '0%': { opacity: 0 },
        '100%': { opacity: 1 },
      }
    }
  }
}
// Dùng: className="animate-fade-in"
```

### Ví dụ CineX skeleton loading
```tsx
<div className="rounded-xl border border-white/5 bg-[#0a1929] p-4">
  <div className="h-48 bg-white/5 animate-pulse rounded-md mb-3" />
  <div className="h-4 bg-white/5 animate-pulse rounded w-3/4 mb-2" />
  <div className="h-3 bg-white/5 animate-pulse rounded w-1/2" />
</div>
```

---

## 10. Transform — scale / translate / rotate

```tsx
<div className="hover:scale-105 transition-transform">  // phóng to 5%
<div className="-translate-y-1 hover:-translate-y-2">    // dịch lên
<div className="rotate-3 hover:rotate-0">                // nghiêng 3°
```

### Compose
```tsx
<div className="scale-110 rotate-6 translate-x-4">
  // áp dụng cùng lúc cả 3
</div>
```

### Ví dụ MovieCard lift
```tsx
<Link className="group block hover:-translate-y-1 transition-all duration-300">
  <img className="group-hover:scale-105 transition-transform" />
  <h3 className="group-hover:text-[#eab308] transition-colors">{title}</h3>
</Link>
```

---

## 11. Position + Z-index

### Position values
- `static`: default, theo flow
- `relative`: theo flow nhưng có thể offset
- `absolute`: ra khỏi flow, offset theo `relative` parent gần nhất
- `fixed`: theo viewport
- `sticky`: chuyển sang fixed khi scroll qua

### Sticky Header CineX
```tsx
<header className="sticky top-0 z-50 bg-[#051424]/80 backdrop-blur-md border-b border-white/5">
  ...
</header>
```

### Sticky column trong Table
```tsx
<table>
  <thead>
    <tr>
      <th className="sticky left-0 z-10 bg-[#0a1929]">Tên</th>
      <th>Email</th>
      ...
    </tr>
  </thead>
</table>
```

Khi cuộn ngang, cột "Tên" giữ nguyên.

### Z-index stacking pitfall
```
Modal (z-40) bị Header (z-50) che → user click không được button modal.
Fix: Modal z-50, Header z-40. Hoặc Portal render Modal vào `body` để escape stacking context.
```

---

## 12. Responsive — Mobile-first

### Breakpoints (default)
- `sm:` ≥640px
- `md:` ≥768px
- `lg:` ≥1024px
- `xl:` ≥1280px
- `2xl:` ≥1536px

### Mobile-first pattern
```tsx
<div className="
  grid-cols-2          // mobile: 2 cột
  md:grid-cols-3       // tablet: 3 cột
  lg:grid-cols-4       // desktop: 4 cột
  xl:grid-cols-5       // wide: 5 cột
">
```

Viết style mobile DEFAULT, override với prefix.

### Hide/show theo size
```tsx
<div className="block lg:hidden">  // Chỉ mobile/tablet
<div className="hidden lg:block">  // Chỉ desktop
```

### Ví dụ SeatMap CineX
```tsx
<div className="grid gap-1 grid-cols-8 md:grid-cols-12">
  {seats.map(seat => <SeatButton key={seat.id} {...} />)}
</div>
```

Mobile: 8 ghế/hàng (nhỏ hơn). Desktop: 12 ghế/hàng.

### Container queries (Tailwind v4)
```tsx
<div className="@container">
  <div className="@md:flex-row flex-col">
    Layout đổi dựa vào container, không phải viewport
  </div>
</div>
```

---

## 13. cn() utility — Ghép class an toàn

### Vấn đề
```tsx
<Button className="p-2 bg-red-500" />  // mặc định
// Caller muốn override: <Button className="p-4 bg-blue-500" />

// Naive ghép:
<button className={`p-2 bg-red-500 ${className}`} />
// Result: "p-2 bg-red-500 p-4 bg-blue-500"
// → cả 2 class p-* tồn tại, CSS thắng phụ thuộc thứ tự trong bundle → unpredictable
```

### `cn()` = `clsx` + `tailwind-merge`
```ts
// lib/utils.ts
import { clsx, ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- `clsx`: ghép conditional class, lọc falsy
- `twMerge`: resolve conflict Tailwind (`p-2 p-4` → `p-4`)

### Use
```tsx
<button className={cn(
  "p-2 bg-red-500",           // base
  isActive && "ring-2",       // conditional
  disabled && "opacity-50",
  className                     // caller override
)} />
```

Result hợp lý, không duplicate, override predictable.

---

## 14. Pseudo-elements — `before:` / `after:`

```tsx
<span className="relative pl-4 before:content-[''] before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-2 before:h-2 before:bg-green-500 before:rounded-full">
  Đang hoạt động
</span>
```

Tạo dot indicator bên trái không cần thêm element.

### Cảnh báo
`content-['']` bắt buộc (rỗng) để `::before`/`::after` render. Nếu `content` không khai báo → element không xuất hiện.

---

## 15. State variants

### Vị trí trong list
- `first:` — element đầu tiên
- `last:` — cuối
- `odd:` / `even:` — lẻ/chẵn (1-indexed)

```tsx
<table>
  <tbody>
    {rows.map(row => (
      <tr className="even:bg-white/5">  // hàng chẵn có nền nhẹ
        ...
      </tr>
    ))}
  </tbody>
</table>
```

### State input
- `disabled:`, `checked:`, `placeholder:`, `required:`, `focus:`, `focus-within:`

```tsx
<input className="
  border border-white/10
  focus:ring-2 focus:ring-[#eab308] focus:border-transparent
  disabled:opacity-50 disabled:cursor-not-allowed
  placeholder:text-gray-500
" />
```

---

## 16. Tailwind v4 vs v3

### Thay đổi lớn v4

| | v3 | v4 |
|---|---|---|
| Config | `tailwind.config.js` JavaScript | `@theme` trong CSS file |
| PostCSS | Phải config postcss.config.js | Plugin tự setup |
| Browser support | IE 11+ | Safari 16.4+ (modern) |
| Bundle size | Lớn hơn | Nhỏ hơn (oxidate engine Rust) |
| @apply | Vẫn dùng | Vẫn dùng nhưng cảnh báo |

### Migration ngắn
```css
/* v4 — global.css */
@import "tailwindcss";

@theme {
  --color-cinex-bg: #051424;
  --color-cinex-gold: #eab308;
  --font-family-sans: "Inter", sans-serif;
}
```

→ Tự động sinh class `bg-cinex-bg`, `text-cinex-gold`.

CineX dùng v4. Sinh viên đọc tutorial v3 trên Internet cần biết khác biệt.

---

## 17. CSS Specificity — Cảnh báo

### shadcn vs Tailwind class
shadcn component có sẵn class default. Khi truyền `className` từ ngoài → ghi đè default. Nhưng nếu CSS được load sau, có thể override.

### `!important` của Tailwind
```tsx
<div className="!bg-red-500">  // !important
```

Dùng khi cần thắng class khác mà không sửa được.

### Best practice
Luôn dùng `cn()` để merge → để `tailwind-merge` resolve conflict thay vì dùng `!important`.

---

## 18. Color token CineX (theo CLAUDE.md)

```
nền chính         bg-[#051424]
surface/card      bg-[#0a1929]
input/nested      bg-[#0d2137]
gold accent       bg-[#eab308] / text-[#eab308]
gold hover        hover:bg-[#ca8a04]
border nhẹ        border-white/5
border input      border-white/10
row hover         hover:bg-white/5
thành công        text-green-400, bg-green-500/20
lỗi/hủy           text-red-400, bg-red-500/20
```

KHÔNG dùng `bg-gray-950`, `bg-amber-500` — không khớp design system.

---

## 19. Common patterns CineX

### Card
```tsx
<div className="rounded-xl border border-white/5 bg-[#0a1929] p-6">
```

### Input
```tsx
<input className="
  bg-[#0d2137] border border-white/10 rounded-md px-3 py-2
  focus:ring-1 focus:ring-[#eab308] focus:border-transparent
  text-white placeholder:text-gray-500
" />
```

### Button Gold (primary)
```tsx
<button className="
  bg-[#eab308] hover:bg-[#ca8a04]
  text-black font-semibold rounded-xl px-4 py-2
  transition-colors disabled:opacity-50
">
```

### Button Ghost
```tsx
<button className="
  border border-[#eab308] text-[#eab308]
  hover:bg-[#eab308]/10 rounded-xl px-4 py-2
">
```

### Badge trạng thái
```tsx
<span className="text-xs px-2 py-1 rounded border bg-green-500/20 text-green-400 border-green-500/30">
  Hoạt động
</span>
```

### Table
```tsx
<div className="rounded-xl border border-white/5 overflow-hidden">
  <table className="w-full">
    <thead className="bg-[#0a1929]">
      <tr className="border-b border-white/5">
        <th className="text-left p-3">Tên</th>
      </tr>
    </thead>
    <tbody>
      <tr className="border-b border-white/5 hover:bg-white/5">
        <td className="p-3">...</td>
      </tr>
    </tbody>
  </table>
</div>
```

---

## 20. Câu hỏi tự kiểm tra

**Câu 1**: `bg-${color}-500` không hoạt động. Tại sao và 3 cách fix?

→ Tailwind scan compile-time bằng regex, không evaluate runtime expression. Fix: (1) map object với class literal, (2) safelist config, (3) inline style.

**Câu 2**: `cn()` giải quyết vấn đề gì mà ghép chuỗi naive không giải quyết được?

→ Conflict resolution. `p-2 p-4` cả 2 class tồn tại → CSS thắng phụ thuộc thứ tự không predictable. `cn()` dùng `tailwind-merge` → loại class trùng property, giữ class cuối → kết quả ổn định.

**Câu 3**: Khi nào dùng `sticky` thay vì `fixed`?

→ Sticky giữ position khi scroll qua, nhưng vẫn theo flow của parent (rời ra khi parent cuộn hết). Fixed ra khỏi flow hoàn toàn theo viewport. Sticky dùng cho header trang, column table cuộn ngang.

**Câu 4**: Tại sao `before:content-['']` bắt buộc khi muốn vẽ dot/icon bằng pseudo-element?

→ Pseudo-element `::before`/`::after` chỉ render nếu có `content`. Tailwind shorthand `before:content-['']` set content rỗng để element xuất hiện.

**Câu 5**: Trong CineX dùng nền `bg-[#051424]` cho body, `bg-[#0a1929]` cho card, `bg-[#0d2137]` cho input. Tại sao 3 màu thay vì 1?

→ Tạo độ sâu thị giác — card "nổi" lên trên body, input "lõm" vào trong card. 3 lớp giúp UI dễ scan, mắt phân biệt được hierarchy. Nếu dùng 1 màu, mọi thứ phẳng → khó nhìn.
