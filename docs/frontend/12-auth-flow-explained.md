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

---

## 6. Refresh Token Flow chi tiết

### Vấn đề
Access token expire 15 phút. User đang dùng app — không thể bắt họ login lại mỗi 15 phút.

### Giải pháp
Refresh token sống lâu hơn (7 ngày), dùng để xin access token mới khi cũ expire.

### Axios interceptor xử lý 401
```ts
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = localStorage.getItem("refreshToken");
        const { data } = await axios.post(
          `${API_URL}/api/auth/refresh`,
          { refreshToken }
        );  // ← dùng axios thẳng, KHÔNG dùng `api` (tránh infinite loop)

        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);

        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);  // retry request gốc
      } catch (refreshErr) {
        // Refresh fail (token expired/revoked) → logout
        localStorage.clear();
        window.location.href = "/login";
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(error);
  }
);
```

### Sơ đồ
```
Request → 401 → interceptor:
  ├─ POST /auth/refresh (axios thẳng)
  ├─ thành công → lưu token mới → retry request gốc
  └─ thất bại → clear localStorage → redirect /login
```

---

## 7. failedQueue — Race Condition khi nhiều request fail cùng lúc

### Vấn đề
User vào dashboard, 5 widget gọi 5 API song song → cả 5 fail 401 cùng lúc → 5 refresh request đồng thời → server overload.

### Giải pháp queue
```ts
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((p) => {
    if (error) p.reject(error);
    else if (token) p.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        // Đợi refresh đang chạy
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        localStorage.setItem("accessToken", data.accessToken);
        processQueue(null, data.accessToken);  // resolve tất cả request đang đợi
        return api(original);
      } catch (err) {
        processQueue(err, null);  // reject tất cả
        localStorage.clear();
        window.location.href = "/login";
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
```

Chỉ 1 refresh chạy, 4 request còn lại đợi → khi xong, retry tất cả với token mới.

---

## 8. XSS vs CSRF — Trade-off Storage

### localStorage (CineX dùng)
- ✅ Đơn giản, đa tab share
- ❌ XSS đọc được: hacker inject `<script>` → đọc `localStorage.getItem('accessToken')` → gửi về server hacker

### HttpOnly Cookie
- ✅ XSS không đọc được (HttpOnly = chỉ HTTP, JS không truy cập)
- ❌ CSRF risk: hacker dụ user click link → cookie tự gửi → action thực hiện
- ❌ Phức tạp: cần backend set cookie + CORS cấu hình `credentials: include`

### Vì sao CineX chọn localStorage
- Đơn giản dev/setup
- XSS phòng bằng CSP + sanitize input + React tự escape JSX
- App SPA + JWT Bearer thay vì cookie session

### Mitigation XSS
- Content Security Policy header:
  ```
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'
  ```
- KHÔNG render HTML từ user input bằng `dangerouslySetInnerHTML`
- DOMPurify cho rich text editor
- Validate input mọi nơi

---

## 9. Multi-tab Logout Sync

### Vấn đề
User mở 3 tab CineX. Logout ở tab 1 → tab 2, 3 không biết, vẫn login.

### Fix: `storage` event
```ts
useEffect(() => {
  const handler = (e: StorageEvent) => {
    if (e.key === "accessToken" && e.newValue === null) {
      // Tab khác đã logout
      useAuthStore.getState().logout();
      navigate("/login");
    }
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}, []);
```

`storage` event chỉ fire ở tab KHÁC khi localStorage đổi. Tab nào logout → tab khác nhận event → tự sync logout.

---

## 10. Redirect After Login

### Vấn đề
User vào `/admin/movies` → chưa login → redirect `/login` → đăng nhập xong → trang chủ. Mất context.

### Pattern lưu `from`
```tsx
// ProtectedRoute
function ProtectedRoute({ children }: { children: ReactNode }) {
  const isAuth = useAuthStore(s => !!s.token);
  const location = useLocation();

  if (!isAuth) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

// LoginPage
function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname ?? "/";

  const onSuccess = () => {
    navigate(from, { replace: true });
  };
}
```

User đăng nhập xong sẽ về đúng trang ban đầu.

---

## 11. Token Expiration Pre-check

### Thay vì đợi 401, check `exp` trước khi gọi API
```ts
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

api.interceptors.request.use(async (config) => {
  const token = localStorage.getItem("accessToken");
  if (token && isTokenExpired(token)) {
    await refreshAccessToken();
  }
  config.headers.Authorization = `Bearer ${localStorage.getItem("accessToken")}`;
  return config;
});
```

Pros: tránh round-trip 401. Cons: clock skew giữa client và server → check không chính xác → vẫn cần handle 401 ở response.

---

## 12. State Diagram Auth

```
        ┌──────────────┐
        │ LOGGED_OUT   │ ← khởi tạo, hoặc logout
        └──────┬───────┘
               │ login()
               ▼
        ┌──────────────┐
        │ LOGGING_IN   │ ← đang gọi API /login
        └──────┬───────┘
               │ success
               ▼
        ┌──────────────┐
        │  LOGGED_IN   │←─────┐
        └──────┬───────┘      │
               │ token expire │ refresh success
               ▼              │
        ┌──────────────┐      │
        │  REFRESHING  │──────┘
        └──────┬───────┘
               │ refresh fail
               ▼
        ┌──────────────┐
        │  LOGGED_OUT  │
        └──────────────┘
```

---

## 13. Câu hỏi tự kiểm tra mở rộng

**Câu 6**: Tại sao refresh token interceptor PHẢI dùng `axios.post` thẳng thay vì instance `api`?

→ Nếu dùng `api`, request `/auth/refresh` cũng đi qua interceptor → cũng có thể bị 401 (vd refresh token expired) → trigger refresh lại → infinite loop. Dùng axios thẳng để bypass interceptor.

**Câu 7**: failedQueue giải quyết vấn đề gì? Không có failedQueue điều gì xảy ra?

→ Race condition khi nhiều API call 401 cùng lúc. Không có queue → 5 request fail → 5 refresh song song → server xử lý 5 lần, có thể trả 5 token khác nhau (rotation) → conflict. Queue đảm bảo chỉ 1 refresh, 4 còn lại đợi.

**Câu 8**: Logout ở tab 1, làm sao tab 2 biết để cũng logout?

→ `window.storage` event. Khi localStorage đổi ở tab 1, tab 2 (3, 4...) nhận event → đọc state mới → tự logout. Tab gốc KHÔNG nhận event (chỉ tab khác).

**Câu 9**: localStorage có rủi ro XSS. Vì sao CineX vẫn chọn?

→ Trade-off với simplicity. Mitigation: CSP, sanitize input, React auto-escape, không `dangerouslySetInnerHTML`. HttpOnly cookie chống XSS nhưng tăng độ phức tạp + CSRF risk.

**Câu 10**: User vào `/admin/movies` → chưa login → redirect /login → login xong cần về đâu?

→ Về `/admin/movies`. Pattern: ProtectedRoute redirect kèm `state: { from: location }`. LoginPage đọc `state.from` → navigate sau login. Không có pattern này → user phải tự navigate lại → UX kém.
