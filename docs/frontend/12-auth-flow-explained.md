# Auth Flow trong Frontend — Giải thích chi tiết

## 1. Tổng quan

Auth flow = luồng xác thực: từ đăng nhập → lưu token → gắn token vào mọi request → refresh khi hết hạn → logout.

**Ví dụ đời thường:**
- **Login** = vào công ty → bảo vệ cấp thẻ nhân viên (token)
- **Gọi API** = vào phòng họp → quẹt thẻ (gắn token vào header)
- **Token hết hạn** = thẻ hết hạn → đến bảo vệ đổi thẻ mới (refresh token)
- **Logout** = trả thẻ → bảo vệ hủy (revoke token)

## 2. Luồng đăng nhập — từng bước

```
User nhập username + password → bấm "Đăng nhập"
    │
    ▼
LoginPage.tsx: react-hook-form validate → gọi useLogin().mutate(data)
    │
    ▼
useLogin() hook:
    │  api.post('/api/auth/login', { username, password })
    │  → Backend verify → trả { accessToken, refreshToken, expiresIn }
    │
    ▼
Decode JWT: jwtDecode(accessToken) → { sub: "vanan", role: "USER" }
    │
    ▼
authStore.setAuth(token, refreshToken, { username, role })
    │  → localStorage.setItem('token', 'eyJhbG...')
    │  → localStorage.setItem('refreshToken', '550e8400-...')
    │  → localStorage.setItem('user', '{"username":"vanan","role":"USER"}')
    │  → Zustand state update → tất cả component dùng useAuthStore re-render
    │
    ▼
navigate('/') → redirect về trang chủ
    │
    ▼
Header re-render: thấy user !== null → hiện "vanan" + dropdown thay vì "Đăng nhập"
```

## 3. JWT Interceptor — tự động gắn token

```typescript
// api/axios.ts — mọi request FE gửi đều đi qua đây

// Interceptor REQUEST: trước khi gửi → gắn token vào header
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token')
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
        //  ↑ Mọi request đều có header: Authorization: Bearer eyJhbG...
        //    Backend JwtAuthFilter đọc header này → biết user là ai
    }
    return config
})

// Interceptor RESPONSE: khi nhận response lỗi 401
api.interceptors.response.use(
    (response) => response,  // Thành công → trả về bình thường
    (error) => {
        if (error.response?.status === 401) {
            // Token hết hạn hoặc sai → xóa token + redirect login
            localStorage.removeItem('token')
            window.location.href = '/login'
        }
        return Promise.reject(error)
    }
)
```

**Tại sao cần interceptor?**
```
Không có interceptor:
    // Mỗi lần gọi API phải tự gắn token
    api.get('/api/movies', { headers: { Authorization: `Bearer ${token}` } })
    api.get('/api/bookings/me', { headers: { Authorization: `Bearer ${token}` } })
    api.post('/api/bookings/hold', data, { headers: { Authorization: `Bearer ${token}` } })
    // → Lặp lại 50 lần cho 50 API calls → DỄ QUÊN

Có interceptor:
    // Viết 1 lần, tự động cho TẤT CẢ requests
    api.get('/api/movies')         // ← tự có header Authorization
    api.get('/api/bookings/me')    // ← tự có header Authorization
    api.post('/api/bookings/hold') // ← tự có header Authorization
```

## 4. ProtectedRoute — chặn trang cần login

```
User chưa login → vào /profile → chuyện gì xảy ra?

Trong AppRouter.tsx:
    <Route element={<ProtectedRoute />}>         ← Bọc ngoài
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/my-tickets" element={<MyTicketsPage />} />
        <Route path="/booking/seats/:id" element={<SeatSelectionPage />} />
    </Route>
```

```typescript
// ProtectedRoute.tsx
export default function ProtectedRoute() {
    const { isLoggedIn } = useAuthStore()

    if (!isLoggedIn()) {
        return <Navigate to="/login" replace />
        // ↑ Chưa login → redirect sang /login
        // replace: thay thế history (bấm Back không quay lại trang bị chặn)
    }

    return <Outlet />
    // ↑ Đã login → render children (ProfilePage, MyTicketsPage, ...)
}
```

```
Luồng:
    /profile → ProtectedRoute kiểm tra token
        ├── Có token → render ProfilePage ✅
        └── Không token → redirect /login ❌

    /admin → AdminRoute kiểm tra token + role
        ├── Token + role ADMIN → render admin pages ✅
        ├── Token + role USER → redirect / ❌
        └── Không token → redirect /login ❌
```

## 5. Zustand authStore — lưu state auth

```typescript
// store/authStore.ts

interface AuthState {
    token: string | null          // JWT access token
    refreshToken: string | null   // Refresh token (dùng khi access hết hạn)
    user: { username, role } | null  // User info từ JWT payload

    setAuth(token, refreshToken, user)  // Login thành công → lưu tất cả
    logout()                             // Xóa tất cả → redirect login
    isLoggedIn()                         // token !== null
    isAdmin()                            // user?.role === 'ADMIN'
}
```

**Tại sao dùng Zustand + localStorage?**

```
Zustand (RAM):
    → Nhanh, component re-render ngay khi state đổi
    → MẤT khi refresh trang (F5)

localStorage (Disk):
    → Chậm hơn nhưng KHÔNG MẤT khi refresh
    → User đóng tab → mở lại → vẫn login

Kết hợp:
    Login → lưu CẢ HAI (Zustand + localStorage)
    App khởi động → Zustand đọc từ localStorage → khôi phục state
    → User refresh trang → vẫn login ✅
```

## 6. Luồng đăng xuất

```
User click "Đăng xuất" (Header dropdown)
    │
    ▼
useLogout() hook:
    │  1. api.post('/api/auth/logout')  ← Gọi BE revoke refresh token
    │  2. authStore.logout()             ← Xóa Zustand state + localStorage
    │  3. toast.success('Đã đăng xuất')
    │  4. navigate('/login')             ← Redirect về login
    │
    ▼
Header re-render: user === null → hiện nút "Đăng nhập" thay vì dropdown
```

## 7. Decode JWT — lấy thông tin user

```
JWT token: eyJhbGciOiJIUzM4NCJ9.eyJyb2xlIjoiVVNFUiIsInN1YiI6InZhbmFuIn0.xxx

Decode phần giữa (payload — Base64):
{
    "sub": "vanan",        ← username
    "role": "USER",        ← vai trò
    "iat": 1716206400,     ← issued at
    "exp": 1716207300      ← expires at (15 phút sau)
}
```

```typescript
// utils/jwt.ts — decode JWT không cần thư viện
export function jwtDecode(token: string) {
    const base64Url = token.split('.')[1]       // Lấy phần giữa
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(atob(base64)...)
    return JSON.parse(jsonPayload)              // { sub: "vanan", role: "USER" }
}
```

**Tại sao decode ở FE?**
→ FE cần biết username + role ngay sau login để hiển thị trên Header + kiểm tra quyền admin.
→ Không cần gọi thêm API `/api/users/me` — thông tin đã có trong token.

## 8. Câu hỏi tự kiểm tra

1. **Token lưu ở đâu? Tại sao lưu cả Zustand lẫn localStorage?**
   → Zustand (nhanh, re-render) + localStorage (persist qua refresh). Khởi động đọc từ localStorage.

2. **Interceptor là gì? Tại sao cần?**
   → Code chạy trước mọi request (gắn token) / sau mọi response (bắt 401). Viết 1 lần, áp dụng cho 50+ API calls.

3. **User refresh trang (F5) → có bị logout không?**
   → Không, vì token lưu localStorage. Zustand khởi tạo đọc từ localStorage.

4. **ProtectedRoute hoạt động thế nào?**
   → Check `isLoggedIn()`. Có token → render children. Không token → redirect /login.

5. **JWT payload ai cũng đọc được — có an toàn không?**
   → Payload không mã hóa (chỉ Base64). Nhưng không ai SỬA được vì không có secret key tạo signature. FE chỉ đọc, không sửa.
