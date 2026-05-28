# HTML & CSS — Nền tảng trang web

> Đọc file này TRƯỚC KHI đọc bất kỳ file nào khác về Frontend.

## HTML là gì?

**HTML** (HyperText Markup Language) = ngôn ngữ **mô tả cấu trúc** trang web.

**Ví dụ đời thường:** HTML giống **bản vẽ kiến trúc** của ngôi nhà — nói "ở đây là phòng khách, ở đây là phòng ngủ, ở đây là cửa". Nhưng chưa nói màu tường, kiểu nội thất (đó là CSS).

### Cấu trúc cơ bản

```html
<!DOCTYPE html>
<html>
  <head>
    <title>CineX — Đặt vé xem phim</title>
    <!-- head = thông tin về trang, không hiển thị trên màn hình -->
  </head>
  <body>
    <!-- body = nội dung hiển thị trên màn hình -->
    <h1>Xin chào CineX!</h1>
    <p>Hệ thống đặt vé xem phim online.</p>
    <button>Đặt vé ngay</button>
  </body>
</html>
```

Mở file này bằng trình duyệt (Chrome/Firefox) → thấy tiêu đề + đoạn văn + nút bấm.

### Các thẻ HTML phổ biến

```
Thẻ = tag = cặp ngoặc nhọn bao nội dung

<h1>Tiêu đề lớn nhất</h1>         ← Heading level 1 (to nhất)
<h2>Tiêu đề nhỏ hơn</h2>          ← Heading level 2
<p>Đoạn văn bản</p>                ← Paragraph
<a href="/movies">Xem phim</a>     ← Link (bấm vào chuyển trang)
<img src="poster.jpg" />           ← Ảnh (không có thẻ đóng)
<button>Bấm tôi</button>           ← Nút bấm
<input type="text" />              ← Ô nhập liệu (username, password, ...)
<div>...</div>                      ← Hộp chứa (nhóm nhiều thẻ lại)
<span>nhỏ</span>                   ← Nhóm inline (không xuống dòng)

<ul>                                ← Danh sách
  <li>Action</li>
  <li>Horror</li>
  <li>Comedy</li>
</ul>

<form>                              ← Form gửi dữ liệu
  <input type="text" />
  <button type="submit">Gửi</button>
</form>
```

### Attribute (thuộc tính)

```html
<a href="/movies" class="nav-link">Xem phim</a>
     │              │
     │              └── class = tên CSS để styling
     └── href = URL khi bấm vào link

<img src="poster.jpg" alt="Avengers poster" width="200" />
      │                 │                    │
      │                 │                    └── chiều rộng 200px
      │                 └── text thay thế nếu ảnh không load
      └── đường dẫn ảnh

<input type="password" placeholder="Nhập mật khẩu" />
        │                │
        │                └── text gợi ý (biến mất khi gõ)
        └── loại input (password = ẩn ký tự)
```

---

## CSS là gì?

**CSS** (Cascading Style Sheets) = ngôn ngữ **trang trí** trang web — màu sắc, font chữ, khoảng cách, bố cục.

**Ví dụ:** HTML = xây nhà thô. CSS = sơn tường, lát gạch, treo rèm.

### Cách viết CSS truyền thống

```css
/* Chọn thẻ h1 → đổi màu đỏ, cỡ chữ 32px */
h1 {
  color: red;
  font-size: 32px;
}

/* Chọn tất cả thẻ có class="card" → bo góc, đổ bóng */
.card {
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  padding: 16px;      /* khoảng cách BÊN TRONG */
  margin: 8px;         /* khoảng cách BÊN NGOÀI */
}

/* Chọn thẻ có id="header" */
#header {
  background-color: black;
  color: white;
}
```

### Box Model — mọi thẻ HTML là 1 hộp

```
┌─────────────────────────── margin (khoảng cách BÊN NGOÀI) ─────┐
│  ┌──────────────────────── border (viền) ─────────────────────┐  │
│  │  ┌───────────────────── padding (khoảng cách BÊN TRONG) ─┐ │  │
│  │  │                                                         │ │  │
│  │  │              NỘI DUNG (text, ảnh, ...)                 │ │  │
│  │  │                                                         │ │  │
│  │  └─────────────────────────────────────────────────────────┘ │  │
│  └─────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘

padding = đệm bên trong (nội dung cách viền bao nhiêu)
margin  = lề bên ngoài (hộp này cách hộp khác bao nhiêu)
border  = viền (đường kẻ bao quanh)
```

### Flexbox — xếp các phần tử theo hàng/cột

```css
.header {
  display: flex;             /* Bật flexbox */
  justify-content: space-between;  /* Dàn đều 2 bên */
  align-items: center;       /* Canh giữa theo chiều dọc */
}
```

```
display: flex → xếp con theo hàng ngang (mặc định)

┌─────────────────────────────────────────────┐
│  [Logo CineX]              [Nav] [Login]    │  ← justify-content: space-between
└─────────────────────────────────────────────┘
   ↑ bên trái                     ↑ bên phải

flex-direction: column → xếp theo cột dọc

┌──────────┐
│  Item 1  │
│  Item 2  │
│  Item 3  │
└──────────┘
```

### Responsive — tự động co giãn theo màn hình

```css
/* Mặc định: 4 cột */
.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);  /* 4 cột bằng nhau */
}

/* Màn hình nhỏ hơn 768px (tablet): 2 cột */
@media (max-width: 768px) {
  .grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Màn hình nhỏ hơn 480px (điện thoại): 1 cột */
@media (max-width: 480px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
```

### Tại sao CineX dùng Tailwind thay vì CSS truyền thống?

```html
<!-- CSS truyền thống: viết CSS riêng -->
<style>
  .btn { padding: 8px 16px; background: #f59e0b; border-radius: 8px; }
</style>
<button class="btn">Đặt vé</button>

<!-- Tailwind: viết CSS trực tiếp trong class -->
<button class="px-4 py-2 bg-amber-500 rounded-lg">Đặt vé</button>
```

Tailwind = viết CSS bằng tên class ngắn gọn, không cần tạo file CSS riêng.
`px-4` = padding left+right 16px, `py-2` = padding top+bottom 8px, `bg-amber-500` = màu vàng cam.

---

## Tóm lại

```
HTML = cấu trúc (xương sống)     → <h1>, <p>, <button>, <div>
CSS  = trang trí (da thịt)       → màu, font, spacing, layout
JS   = hành vi (não)              → click → chạy code → thay đổi trang

Trình duyệt đọc HTML → dựng cấu trúc → áp CSS → chạy JS → hiển thị
```
