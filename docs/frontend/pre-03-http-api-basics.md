# HTTP & API — FE nói chuyện với BE thế nào

> Đọc file này SAU `pre-02-javascript-essentials.md`, TRƯỚC `07-axios-api.md`.

## 1. Tại sao FE cần gọi BE?

```
FE (trình duyệt)                    BE (server)
├── Hiển thị giao diện               ├── Lưu dữ liệu (database)
├── User tương tác (click, gõ)       ├── Xử lý logic (giá vé, giữ ghế)
└── KHÔNG có database                └── Trả dữ liệu cho FE

FE cần phim đang chiếu → hỏi BE → BE query DB → trả danh sách phim → FE hiển thị
```

**Ví dụ đời thường:**
- FE = **nhân viên quầy** — tiếp khách, nhận order
- BE = **bếp** — nấu ăn, lấy nguyên liệu từ kho (database)
- HTTP = **phiếu order** — nhân viên viết order gửi xuống bếp, bếp gửi món lên

---

## 2. HTTP là gì?

**HTTP** (HyperText Transfer Protocol) = **quy tắc giao tiếp** giữa FE và BE.

Mỗi lần FE cần dữ liệu → gửi **HTTP Request** → BE xử lý → trả **HTTP Response**.

### Request (FE gửi)

```
POST /api/auth/login HTTP/1.1        ← Method + URL
Host: localhost:8088                  ← Server nào
Content-Type: application/json        ← Dữ liệu gửi dạng JSON
Authorization: Bearer eyJhbG...       ← Token xác thực (nếu cần)

{                                     ← Body (dữ liệu gửi)
  "username": "vanan",
  "password": "123456"
}
```

### Response (BE trả)

```
HTTP/1.1 200 OK                       ← Status code
Content-Type: application/json

{                                     ← Body (dữ liệu trả)
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbG...",
    "refreshToken": "550e8400-..."
  }
}
```

---

## 3. HTTP Methods — 4 loại hành động

| Method | Hành động | Ví dụ | Body? |
|---|---|---|---|
| **GET** | **Đọc** dữ liệu | Xem danh sách phim | Không |
| **POST** | **Tạo** dữ liệu mới | Đăng ký tài khoản, đặt vé | Có |
| **PUT** | **Sửa** dữ liệu | Cập nhật profile | Có |
| **DELETE** | **Xóa** dữ liệu | Xóa phim, hủy vé | Không |

```
GET    /api/movies           → "Cho tôi danh sách phim"
GET    /api/movies/1         → "Cho tôi chi tiết phim ID 1"
POST   /api/auth/login       → "Tôi muốn đăng nhập, đây là username/password"
PUT    /api/users/me         → "Tôi muốn sửa profile, đây là data mới"
DELETE /api/movies/1         → "Xóa phim ID 1"
```

---

## 4. Status Code — BE báo kết quả

| Code | Ý nghĩa | Ví dụ |
|---|---|---|
| **200** | OK — thành công | Lấy phim thành công |
| **201** | Created — tạo thành công | Đăng ký tài khoản xong |
| **400** | Bad Request — gửi sai | Thiếu username, email sai format |
| **401** | Unauthorized — chưa login | Gọi API cần token mà không có |
| **403** | Forbidden — không có quyền | User thường gọi API admin |
| **404** | Not Found — không tìm thấy | Phim ID 999 không tồn tại |
| **409** | Conflict — trùng | Username đã tồn tại |
| **500** | Server Error — lỗi server | Bug code BE, DB disconnect |

**Quy tắc nhớ:**
- `2xx` = thành công ✅
- `4xx` = lỗi do FE/user (gửi sai, thiếu token, ...) ❌
- `5xx` = lỗi do BE (bug, server down) 💀

---

## 5. JSON — format dữ liệu

**JSON** (JavaScript Object Notation) = format text để truyền dữ liệu giữa FE ↔ BE.

```json
{
  "id": 1,
  "title": "Avengers: Endgame",
  "duration": 181,
  "rating": 8.5,
  "genres": ["Action", "Sci-Fi"],
  "nowShowing": true,
  "director": null
}
```

**Quy tắc JSON:**
- Key **phải** bọc trong `""` (khác JS object không cần)
- Value: string (`""`), number, boolean (`true/false`), null, array (`[]`), object (`{}`)
- Không có function, không có comment
- FE gửi JSON → BE parse. BE trả JSON → FE parse.

---

## 6. REST API — quy ước đặt tên URL

**REST** = quy ước: URL đặt tên theo **danh từ** (resource), method HTTP quyết định **hành động**.

```
URL = danh từ (cái gì)
Method = động từ (làm gì)

GET    /api/movies          → Đọc danh sách movies
GET    /api/movies/1        → Đọc 1 movie (ID=1)
POST   /api/movies          → Tạo movie mới
PUT    /api/movies/1        → Sửa movie ID=1
DELETE /api/movies/1        → Xóa movie ID=1

KHÔNG đặt:
❌ GET /api/getMovies
❌ POST /api/createMovie
❌ GET /api/deleteMovie/1
→ Method HTTP đã nói "đọc/tạo/sửa/xóa" rồi, URL không cần lặp lại
```

### URL lồng (nested resource)

```
GET /api/movies/1/reviews       → Reviews CỦA phim 1
POST /api/rooms/3/seats/generate → Generate ghế CHO phòng 3
GET /api/showtimes?movieId=1&date=2026-05-24  → Suất chiếu theo phim + ngày
```

---

## 7. CineX API — FE gọi BE thế nào

### Bước 1: FE gửi request bằng Axios

```javascript
// Axios = thư viện HTTP client (giống fetch() nhưng tiện hơn)

import api from '@/api/axios'

// GET — lấy danh sách phim
const response = await api.get('/api/movies')
const movies = response.data.data.content  // Array phim

// POST — đăng nhập
const response = await api.post('/api/auth/login', {
  username: 'vanan',
  password: '123456',
})
const token = response.data.data.accessToken
```

### Bước 2: Axios interceptor tự gắn token

```
Mỗi request FE gửi đi:
    ┌──────────────────────────────────────────────┐
    │ GET /api/bookings/me                          │ ← URL
    │ Authorization: Bearer eyJhbGciOiJIUzM4NCJ9.. │ ← Token (interceptor tự gắn)
    │ Content-Type: application/json                 │
    └──────────────────────────────────────────────┘

Interceptor = "nhân viên kiểm tra" — mỗi request đi qua → tự gắn token
User KHÔNG cần tự gắn token mỗi lần gọi API
```

### Bước 3: BE xử lý + trả response

```json
// BE trả về format chuẩn CineX:
{
  "success": true,          // Thành công hay thất bại
  "message": "OK",          // Thông báo
  "data": { ... },          // Dữ liệu thực tế
  "timestamp": "2026-05-24T10:00:00Z"
}

// Lỗi:
{
  "success": false,
  "message": "Invalid username or password"   // FE hiển thị cho user
}
```

---

## 8. Ví dụ thực tế: Luồng đăng nhập

```
1. User gõ username: "vanan", password: "123456" → bấm "Đăng nhập"

2. FE gửi:
   POST http://localhost:8088/api/auth/login
   Body: { "username": "vanan", "password": "123456" }

3. BE nhận → kiểm tra DB:
   - Username tồn tại? ✅
   - Password đúng? BCrypt.matches("123456", hash) ✅
   - Account enabled? ✅

4. BE trả:
   HTTP 200 OK
   {
     "success": true,
     "data": {
       "accessToken": "eyJhbG...",    ← FE lưu vào localStorage
       "refreshToken": "550e8400-...",
       "expiresIn": 900               ← 15 phút
     }
   }

5. FE nhận → lưu token → redirect trang chủ → header hiện "vanan"

6. Sau đó gọi API khác:
   GET http://localhost:8088/api/bookings/me
   Header: Authorization: Bearer eyJhbG...    ← Token tự gắn bởi interceptor
   → BE đọc token → biết user là "vanan" → trả booking của vanan
```

---

## 9. Tóm lại

| Khái niệm | Giải thích 1 dòng |
|---|---|
| **HTTP** | Quy tắc giao tiếp FE ↔ BE (request → response) |
| **GET/POST/PUT/DELETE** | 4 hành động: đọc / tạo / sửa / xóa |
| **Status code** | 200=OK, 400=sai, 401=chưa login, 404=không thấy, 500=lỗi server |
| **JSON** | Format text truyền dữ liệu (key-value, giống JS object) |
| **REST** | URL = danh từ (/movies), method = động từ (GET/POST) |
| **Axios** | Thư viện gọi HTTP (tiện hơn fetch) |
| **Interceptor** | Code chạy trước mọi request (gắn token) / sau mọi response (bắt lỗi 401) |
| **Token** | Chuỗi JWT, gắn vào header để BE biết "user này là ai" |
