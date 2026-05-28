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
