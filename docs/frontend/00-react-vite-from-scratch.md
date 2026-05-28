# Tạo dự án React + Vite + Tailwind từ đầu

> Hướng dẫn chi tiết từng bước, dành cho người chưa biết gì về React.
> Tất cả code mẫu lấy từ dự án CineX thực tế.

---

## Mục lục

1. [Cài đặt môi trường](#1-cai-dat-moi-truong)
2. [Tạo project Vite + React + TypeScript](#2-tao-project-vite--react--typescript)
3. [Cài Tailwind CSS 4](#3-cai-tailwind-css-4)
4. [Cài shadcn/ui](#4-cai-shadcnui)
5. [Cài dependencies dự án](#5-cai-dependencies-du-an)
6. [Cấu trúc folder dự án](#6-cau-truc-folder-du-an)
7. [Setup Axios + JWT interceptor](#7-setup-axios--jwt-interceptor)
8. [Setup React Router](#8-setup-react-router)
9. [Setup Zustand store (Auth)](#9-setup-zustand-store-auth)
10. [Tạo trang đầu tiên (Login)](#10-tao-trang-dau-tien-login)
11. [Chạy và test](#11-chay-va-test)

---

## 1. Cài đặt môi trường

### 1.1. Cài Node.js 20+

Node.js là **runtime** để chạy JavaScript ngoài trình duyệt. React cần Node.js để:
- Chạy dev server (Vite)
- Cài đặt thư viện qua npm
- Build code thành file tĩnh (HTML/CSS/JS) để deploy

**Cách 1: Dùng nvm (khuyên dùng)**

nvm (Node Version Manager) cho phép cài nhiều phiên bản Node.js và chuyển đổi dễ dàng:

```bash
# Cai nvm (macOS/Linux)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash

# Khoi dong lai terminal, sau do:
nvm install 20
nvm use 20
```

**Cách 2: Download trực tiếp**

Vào https://nodejs.org, tải bản LTS (Long Term Support) về cài.

### 1.2. Kiểm tra cài đặt

```bash
node -v   # Ket qua mong doi: v20.x.x tro len
npm -v    # Ket qua mong doi: 10.x.x tro len
```

> **npm là gì?** npm (Node Package Manager) là công cụ quản lý thư viện JavaScript.
> Khi bạn `npm install react`, npm sẽ tải React từ registry về folder `node_modules/`.

### 1.3. IDE: VS Code + Extensions

Tải VS Code tại https://code.visualstudio.com, sau đó cài các extension:

| Extension | Tác dụng |
|---|---|
| **ESLint** | Kiểm tra lỗi code JavaScript/TypeScript theo quy tắc |
| **Prettier** | Tự động format code cho đẹp, nhất quán |
| **Tailwind CSS IntelliSense** | Gợi ý class Tailwind khi gõ, xem preview màu sắc |
| **TypeScript Vue Plugin (Volar)** | Hỗ trợ TypeScript tốt hơn (dù không dùng Vue) |
| **Error Lens** | Hiển thị lỗi ngay trên dòng code, không cần hover |

> **Tại sao cần ESLint + Prettier?**
> - ESLint: tìm lỗi logic (biến chưa dùng, import thừa)
> - Prettier: format code (dấu chấm phẩy, tab/space, xuống dòng)
> - Hai công cụ bổ sung nhau: ESLint lo "đúng/sai", Prettier lo "đẹp/xấu"

---

## 2. Tạo project Vite + React + TypeScript

### 2.1. Tạo project

```bash
npm create vite@latest frontend -- --template react-ts
```

Giải thích từng phần:
- `npm create vite@latest` — chạy tool tạo project của Vite (phiên bản mới nhất)
- `frontend` — tên folder sẽ được tạo
- `--template react-ts` — dùng template React + TypeScript (thay vì JavaScript thường)

> **Tại sao dùng Vite thay vì Create React App (CRA)?**
> - CRA đã ngừng phát triển từ 2023, React chính thức khuyên dùng Vite
> - Vite khởi động dev server trong **vài trăm mili giây** (CRA mất vài giây)
> - Vite dùng ESBuild (viết bằng Go) để transform code, nhanh hơn Webpack 10-100 lần
> - Hot Module Replacement (HMR) của Vite cập nhật tức thì khi bạn sửa code

> **Tại sao TypeScript thay vì JavaScript?**
> - TypeScript = JavaScript + kiểu dữ liệu (type). Ví dụ: `name: string` thay vì chỉ `name`
> - Lỗi bị bắt ngay lúc viết code (compile-time) thay vì lúc chạy (runtime)
> - IDE gợi ý tốt hơn vì biết kiểu dữ liệu của mỗi biến
> - Dự án thực tế 90%+ dùng TypeScript

### 2.2. Cấu trúc folder sinh ra

```
frontend/
├── node_modules/          # Thu vien da cai (KHONG commit len git)
├── public/                # File tinh (favicon, hinh anh) — copy nguyen xi khi build
├── src/                   # Source code chinh
│   ├── assets/            # Hinh anh, font — Vite se toi uu (hash ten file, nen...)
│   ├── App.css            # CSS cho component App
│   ├── App.tsx            # Component goc (root component)
│   ├── index.css          # CSS toan cuc
│   ├── main.tsx           # Diem vao (entry point) — render App vao DOM
│   └── vite-env.d.ts      # Khai bao type cho Vite (import.meta.env)
├── index.html             # File HTML goc — Vite inject JS vao day
├── package.json           # Khai bao dependencies + scripts
├── tsconfig.json          # Cau hinh TypeScript goc
├── tsconfig.app.json      # Cau hinh TypeScript cho src/
├── tsconfig.node.json     # Cau hinh TypeScript cho vite.config.ts
├── vite.config.ts         # Cau hinh Vite (plugins, alias, port...)
└── eslint.config.js       # Cau hinh ESLint
```

### 2.3. Giải thích tsconfig.json

File `tsconfig.json` của CineX:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

Đây là **Project References** — tách cấu hình TypeScript thành 2 phần:
- `tsconfig.app.json`: cho code trong `src/` (chạy trên trình duyệt)
- `tsconfig.node.json`: cho `vite.config.ts` (chạy trên Node.js)

> **Tại sao tách?** Vì `vite.config.ts` chạy trên Node.js (cần `module: "esnext"`, truy cập file system),
> còn `src/` chạy trên trình duyệt (cần `jsx: "react-jsx"`, DOM API). Hai môi trường khác nhau
> nên cần cấu hình khác nhau.

File `tsconfig.app.json` của CineX:

```json
{
  "compilerOptions": {
    "target": "es2023",              // Compile ra ES2023 (trinh duyet hien dai deu ho tro)
    "lib": ["ES2023", "DOM", "DOM.Iterable"],  // API duoc dung: ES2023 + DOM
    "module": "esnext",              // Dung ES Modules (import/export)
    "jsx": "react-jsx",             // Tu dong import React (khong can 'import React from react')
    "paths": {
      "@/*": ["./src/*"]             // Path alias: @/components thay vi ../../components
    },
    "noUnusedLocals": true,          // Bao loi neu khai bao bien ma khong dung
    "noUnusedParameters": true       // Bao loi neu khai bao tham so ma khong dung
  },
  "include": ["src"]
}
```

> **Path alias là gì?**
> Thay vì viết `import Button from '../../../components/ui/button'`
> bạn viết `import Button from '@/components/ui/button'`
> Ngắn gọn hơn, không bị lỗi khi di chuyển file.

### 2.4. Giải thích vite.config.ts

File `vite.config.ts` của CineX:

```typescript
import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],  // Plugin React (JSX, HMR) + Tailwind CSS
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),  // Path alias cho Vite (tuong ung voi tsconfig)
    },
  },
  server: {
    port: 5173,  // Dev server chay tren port 5173
  },
})
```

> **Lưu ý quan trọng:** Path alias phải cấu hình ở **CẢ HAI nơi**:
> 1. `tsconfig.app.json` — để TypeScript hiểu `@/` nghĩa là gì
> 2. `vite.config.ts` — để Vite biết resolve `@/` khi build
> Nếu chỉ cấu hình 1 nơi, sẽ bị lỗi!

### 2.5. Cài đặt và chạy thử

```bash
cd frontend
npm install    # Tai tat ca dependencies ve node_modules/
npm run dev    # Khoi dong dev server
```

Mở trình duyệt tại http://localhost:5173 — bạn sẽ thấy trang mặc định của Vite.

> **`npm install` làm gì?**
> Đọc file `package.json`, tải tất cả thư viện (dependencies + devDependencies) về folder `node_modules/`.
> Đồng thời tạo file `package-lock.json` ghi lại phiên bản chính xác của từng thư viện.

---

## 3. Cài Tailwind CSS 4

### 3.1. Tailwind CSS là gì?

Tailwind CSS là framework CSS theo hướng **utility-first**. Thay vì viết CSS riêng:

```css
/* CSS truyen thong */
.btn-primary {
  background-color: #eab308;
  color: black;
  font-weight: 600;
  padding: 8px 16px;
  border-radius: 8px;
}
```

Bạn viết class trực tiếp trong HTML/JSX:

```jsx
{/* Tailwind — utility classes */}
<button className="bg-[#eab308] text-black font-semibold px-4 py-2 rounded-lg">
  Dat ve
</button>
```

> **Tại sao dùng Tailwind?**
> 1. **Không cần đặt tên class** — không mất thời gian nghĩ tên `.btn-primary-large-gold`
> 2. **Không bị xung đột CSS** — class utility không bao giờ đè lên nhau
> 3. **File CSS nhỏ** — Tailwind chỉ sinh CSS cho class bạn thực sự dùng
> 4. **Nhất quán** — spacing, màu sắc, font size đều từ hệ thống có sẵn

### 3.2. Cài đặt

Tailwind CSS 4 dùng **Vite plugin** (khác với v3 dùng PostCSS):

```bash
npm install tailwindcss @tailwindcss/vite
```

> **Tại sao 2 package?**
> - `tailwindcss`: engine chính (xử lý class, sinh CSS)
> - `@tailwindcss/vite`: plugin tích hợp vào Vite (tự động scan file, rebuild khi thay đổi)

### 3.3. Cấu hình vite.config.ts

Thêm plugin Tailwind:

```typescript
import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'  // <-- Import

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),  // <-- Them plugin
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

### 3.4. Cấu hình index.css

Thay toàn bộ nội dung `src/index.css` bằng:

```css
@import 'tailwindcss';
```

Dòng này nói với Tailwind: "Hãy inject tất cả utility classes vào đây."

> **Tailwind 4 vs Tailwind 3:**
> - v3: cần file `tailwind.config.js` + `postcss.config.js` + 3 directive (`@tailwind base/components/utilities`)
> - v4: chỉ cần `@import 'tailwindcss'` + Vite plugin. Đơn giản hơn nhiều!

### 3.5. Test Tailwind

Sửa file `src/App.tsx`:

```tsx
function App() {
  return (
    <div className="min-h-screen bg-red-500 flex items-center justify-center">
      <h1 className="text-4xl font-bold text-white">
        Tailwind dang hoat dong!
      </h1>
    </div>
  )
}

export default App
```

Chạy `npm run dev`, mở trình duyệt — nếu thấy nền đỏ và chữ trắng là thành công.

---

## 4. Cài shadcn/ui

### 4.1. shadcn/ui là gì?

shadcn/ui **KHÔNG PHẢI** là một npm package thông thường. Nó là **bộ sưu tập component** mà bạn **copy trực tiếp vào dự án**.

| Thư viện UI thông thường (Material UI, Ant Design) | shadcn/ui |
|---|---|
| Cài qua `npm install` | Copy code vào `src/components/ui/` |
| Code nằm trong `node_modules/`, KHÔNG sửa được | Code nằm trong dự án, TÙY CHỈNH thoải mái |
| Update = `npm update`, có thể break | Update = copy lại file mới, bạn quyết định |
| Bundle size lớn (import cả thư viện) | Chỉ có component bạn dùng |

> **Ví dụ thực tế:** Khi dùng Material UI, bạn bị "khóa" vào style của họ.
> Muốn đổi màu nền của Button? Phải đọc docs, override theme phức tạp.
> Với shadcn/ui, bạn mở file `components/ui/button.tsx` và sửa trực tiếp — vì nó là code của bạn.

### 4.2. Cài đặt

```bash
npx shadcn@latest init
```

Tool sẽ hỏi bạn một số câu hỏi:
- **Style:** `default` (Clean, minimal style)
- **Base color:** `neutral` (Màu nền trung tính)
- **CSS variables:** `yes` (Dùng CSS variables để dễ đổi theme)

Sau khi chạy xong, shadcn tạo ra:
- `src/components/ui/` — folder chứa component
- `src/lib/utils.ts` — hàm `cn()` ghép class name
- Cập nhật `tsconfig.json` với path alias

### 4.3. Thêm component

```bash
npx shadcn@latest add button card input dialog table select textarea badge
```

Mỗi lệnh `add` sẽ copy file component vào `src/components/ui/`. Ví dụ:
- `button.tsx` — Component Button với nhiều variant (default, destructive, outline, ghost)
- `card.tsx` — Component Card (Header, Content, Footer)
- `input.tsx` — Component Input đã style sẵn
- `dialog.tsx` — Component Modal/Dialog

### 4.4. Sử dụng component

```tsx
import { Button } from '@/components/ui/button'

function MyPage() {
  return (
    <div>
      {/* Variant mac dinh */}
      <Button>Dat ve</Button>

      {/* Variant destructive (mau do) */}
      <Button variant="destructive">Xoa</Button>

      {/* Variant outline */}
      <Button variant="outline">Huy</Button>

      {/* Variant ghost (trong suot) */}
      <Button variant="ghost">Chi tiet</Button>
    </div>
  )
}
```

> **Hàm `cn()` là gì?**
> ```typescript
> import { clsx } from 'clsx'
> import { twMerge } from 'tailwind-merge'
>
> export function cn(...inputs: ClassValue[]) {
>   return twMerge(clsx(inputs))
> }
> ```
> `cn()` ghép nhiều class name lại và **xử lý xung đột Tailwind**.
> Ví dụ: `cn('bg-red-500', 'bg-blue-500')` trả về `'bg-blue-500'` (class sau thắng).
> Nếu dùng string thường: `"bg-red-500 bg-blue-500"` — cả hai đều tồn tại, kết quả không đoán trước được.

---

## 5. Cài dependencies dự án

### 5.1. Cài tất cả cùng lúc

```bash
# Routing
npm install react-router-dom

# Data fetching + caching
npm install @tanstack/react-query

# State management
npm install zustand

# HTTP client
npm install axios

# Form + Validation
npm install react-hook-form @hookform/resolvers zod

# Icons
npm install lucide-react

# Toast notifications
npm install sonner

# Font
npm install @fontsource/inter
```

Hoặc cài tất cả trong 1 lệnh:

```bash
npm install react-router-dom @tanstack/react-query zustand axios react-hook-form @hookform/resolvers zod lucide-react sonner @fontsource/inter
```

### 5.2. Giải thích từng thư viện

| Thư viện | Dùng để làm gì | Ví dụ thực tế |
|---|---|---|
| **react-router-dom** | Định tuyến (chuyển trang) trong SPA | `/login` hiện trang Login, `/admin/movies` hiện trang quản lý phim |
| **@tanstack/react-query** | Gọi API + cache kết quả + tự động refetch | Gọi API lấy danh sách phim, cache 5 phút, tự động refetch khi focus tab |
| **zustand** | Quản lý state toàn cục (global state) | Lưu thông tin user đăng nhập, token JWT, giỏ hàng |
| **axios** | HTTP client (gọi API) | `axios.get('/api/movies')`, tự động đính JWT vào header |
| **react-hook-form** | Quản lý form (validation, submit, error) | Form đăng nhập: kiểm tra email hợp lệ, mật khẩu đủ dài |
| **@hookform/resolvers** | Kết nối react-hook-form với Zod | Để Zod schema làm validator cho react-hook-form |
| **zod** | Định nghĩa + validate schema dữ liệu | `z.string().email("Email khong hop le")` |
| **lucide-react** | Bộ icon SVG nhẹ, đẹp | Icon `<Search />`, `<Trash2 />`, `<Plus />` |
| **sonner** | Hiển thị toast notification | "Đăng nhập thành công!", "Đã xóa phim" |
| **@fontsource/inter** | Font Inter (self-hosted, không cần Google Fonts) | Font chữ chính của toàn bộ giao diện |

> **Tại sao TanStack Query thay vì chỉ dùng `useEffect` + `fetch`?**
>
> Với `useEffect` thường:
> ```tsx
> // Cach "tho" — phai tu quan ly loading, error, cache
> const [movies, setMovies] = useState([])
> const [loading, setLoading] = useState(true)
> const [error, setError] = useState(null)
>
> useEffect(() => {
>   fetch('/api/movies')
>     .then(res => res.json())
>     .then(data => { setMovies(data); setLoading(false) })
>     .catch(err => { setError(err); setLoading(false) })
> }, [])
> ```
>
> Với TanStack Query:
> ```tsx
> // TanStack Query — 1 dong, tu dong co loading, error, cache, refetch
> const { data: movies, isLoading, error } = useQuery({
>   queryKey: ['movies'],
>   queryFn: () => api.get('/api/movies').then(res => res.data),
> })
> ```

> **Tại sao Zustand thay vì Redux?**
> - Redux: nhiều boilerplate (action, reducer, dispatch, connect...) — phức tạp cho dự án vừa
> - Zustand: đơn giản, code ít, không cần Provider bọc toàn bộ app
> - CineX chỉ cần lưu auth state (user, token) → Zustand là đủ

> **Tại sao Zod thay vì Yup?**
> - Zod thiết kế cho TypeScript từ đầu (type-safe, infer type từ schema)
> - Yup thiết kế cho JavaScript, TypeScript support là "thêm vào sau"
> - Zod nhỏ hơn, nhanh hơn, API trực quan hơn

---

## 6. Cấu trúc folder dự án

### 6.1. Cấu trúc tổng thể

```
src/
├── api/
│   └── axios.ts              # HTTP client + JWT interceptor
│
├── features/                  # Trang theo module (feature-based)
│   ├── admin/                 # Cac trang admin
│   │   ├── movies/            # Quan ly phim
│   │   ├── rooms/             # Quan ly phong chieu
│   │   ├── showtimes/         # Quan ly suat chieu
│   │   └── ...
│   ├── auth/                  # Dang nhap, dang ky
│   │   ├── LoginPage.tsx
│   │   └── RegisterPage.tsx
│   └── user/                  # Trang nguoi dung
│       ├── HomePage.tsx
│       └── BookingPage.tsx
│
├── components/
│   ├── ui/                    # shadcn/ui components (Button, Input, Dialog...)
│   └── common/                # Component dung chung (ConfirmDialog, StatusDropdown...)
│
├── hooks/                     # Custom hooks
│   ├── useAdmin.ts            # Barrel file re-export hooks admin
│   ├── useAdminMovies.ts      # Hook CRUD phim
│   └── useAdminRooms.ts       # Hook CRUD phong chieu
│
├── store/                     # Zustand stores
│   └── authStore.ts           # Auth state (user, token, login/logout)
│
├── types/                     # TypeScript type definitions
│   ├── movie.ts               # Movie, MovieFilter, MovieRequest...
│   └── auth.ts                # LoginRequest, LoginResponse...
│
├── utils/                     # Utility functions
│   ├── labels.ts              # Format tien, ngay, trang thai...
│   └── colors.ts              # Mau sac theo trang thai
│
├── App.tsx                    # Root component + Router setup
├── main.tsx                   # Entry point — render App vao DOM
└── index.css                  # Tailwind CSS import + global styles
```

### 6.2. Tại sao cấu trúc như vậy?

**Feature-based (theo chức năng), KHÔNG PHẢI type-based (theo loại file)**

```
# SAI — type-based (kho tim file khi du an lon)
src/
├── components/
│   ├── MovieList.tsx        # 50 components lan lon trong 1 folder
│   ├── MovieForm.tsx
│   ├── RoomList.tsx
│   ├── LoginForm.tsx
│   └── ...
├── pages/
│   ├── MoviesPage.tsx
│   └── ...

# DUNG — feature-based (moi module tu quan ly file cua no)
src/
├── features/
│   ├── admin/movies/        # Tat ca ve phim nam cung 1 cho
│   │   ├── MoviesPage.tsx
│   │   ├── MovieForm.tsx
│   │   └── MovieList.tsx
│   └── auth/
│       └── LoginPage.tsx
```

> **Lợi ích thực tế:**
> - Khi sửa chức năng "Quản lý phim", bạn chỉ cần mở folder `features/admin/movies/`
> - Khi xóa chức năng, xóa cả folder — không sợ sót file
> - Team mỗi người làm 1 feature, không bị conflict git

**Hooks tách riêng khỏi component**

```
# SAI — goi API trong component
function MoviesPage() {
  const [movies, setMovies] = useState([])
  useEffect(() => {
    api.get('/api/movies').then(res => setMovies(res.data))  // Logic lan vao UI
  }, [])
}

# DUNG — component chi lo hien thi, hook lo du lieu
// hooks/useAdminMovies.ts
export function useMovies() {
  return useQuery({ queryKey: ['movies'], queryFn: fetchMovies })
}

// features/admin/movies/MoviesPage.tsx
function MoviesPage() {
  const { data: movies, isLoading } = useMovies()  // Component sach se
}
```

> **Đây là nguyên tắc Single Responsibility (SOLID):**
> - Component chỉ lo **hiển thị** (render UI)
> - Hook chỉ lo **dữ liệu** (gọi API, cache, mutation)
> - Utils chỉ lo **xử lý** (format tiền, ngày)

---

## 7. Setup Axios + JWT interceptor

### 7.1. JWT là gì?

JWT (JSON Web Token) là cách xác thực người dùng trong API:
1. User đăng nhập → server trả về **access token** (hết hạn nhanh, 15 phút) + **refresh token** (hết hạn chậm, 7 ngày)
2. Mỗi request, frontend gửi access token trong header `Authorization: Bearer <token>`
3. Server đọc token, biết ai đang gọi API

### 7.2. Code mẫu — api/axios.ts

```typescript
import axios from 'axios'

// Tao 1 instance Axios voi cau hinh chung
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8088',
  headers: {
    'Content-Type': 'application/json',
  },
})

// ============================================================
// REQUEST INTERCEPTOR — Tu dong gan JWT vao moi request
// ============================================================
// Truoc khi bat ky request nao gui di, interceptor se:
// 1. Lay token tu localStorage
// 2. Gan vao header Authorization
// → Developer khong can tu viet header moi lan goi API

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ============================================================
// RESPONSE INTERCEPTOR — Tu dong refresh token khi 401
// ============================================================
// Khi server tra 401 (token het han), interceptor se:
// 1. Goi API /auth/refresh de lay token moi
// 2. Luu token moi vao localStorage
// 3. Gui lai request ban dau voi token moi
// → User khong biet gi, trai nghiem muot ma

let isRefreshing = false
let failedQueue: { resolve: (token: string) => void; reject: (err: any) => void }[] = []

// Xu ly tat ca request dang cho (khi nhieu request cung bi 401)
const processQueue = (error: any, token: string | null) => {
  failedQueue.forEach((prom) => {
    if (token) {
      prom.resolve(token)
    } else {
      prom.reject(error)
    }
  })
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,  // Response thanh cong → tra ve binh thuong
  async (error) => {
    const originalRequest = error.config

    // Chi xu ly 401 (Unauthorized — token het han)
    // 403 (Forbidden — khong co quyen) thi KHONG refresh
    if (error.response?.status === 401 && !originalRequest._retry) {

      // Neu dang co request khac refresh roi → cho ket qua
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`
              resolve(api(originalRequest))
            },
            reject,
          })
        })
      }

      originalRequest._retry = true  // Danh dau da thu refresh
      isRefreshing = true

      const refreshToken = localStorage.getItem('refreshToken')

      if (!refreshToken) {
        forceLogout()
        return Promise.reject(error)
      }

      try {
        // Goi refresh API (dung axios MOI, khong qua interceptor de tranh vong lap)
        const res = await axios.post(
          `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8088'}/api/auth/refresh`,
          { refreshToken },
        )

        const newToken = res.data.data.accessToken
        const newRefreshToken = res.data.data.refreshToken

        localStorage.setItem('token', newToken)
        localStorage.setItem('refreshToken', newRefreshToken)

        // Gui lai request goc + tat ca request dang cho
        processQueue(null, newToken)
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        forceLogout()
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  },
)

function forceLogout() {
  localStorage.removeItem('token')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('user')
  window.location.href = '/login'
}

export default api
```

### 7.3. Giải thích luồng xử lý

```
User gọi API (vd: GET /api/movies)
        │
        ▼
[Request Interceptor]
  Lấy token từ localStorage
  Gắn header: Authorization: Bearer <token>
        │
        ▼
   GỬI REQUEST ──────► Server
        │                 │
        │            Response 200?
        │           /           \
        │         Yes            No (401)
        │          │              │
        ▼          ▼              ▼
[Response Interceptor]    [Response Interceptor]
   Trả về data             Gọi /auth/refresh
                                  │
                            Thành công?
                           /          \
                         Yes           No
                          │             │
                   Lưu token mới    forceLogout()
                   Gửi lại request   → /login
                   ban đầu
```

> **Tại sao cần `failedQueue`?**
> Hình dung: bạn đang ở trang admin, trang này gọi 5 API cùng lúc (phim, phòng, suất chiếu...).
> Token hết hạn → cả 5 đều bị 401. Nếu không có queue:
> - Cả 5 đều gọi /auth/refresh → 5 refresh token → server có thể reject 4 cái
> Với queue: chỉ request đầu tiên refresh, 4 request còn lại chờ → token mới → gửi lại cả 5.

---

## 8. Setup React Router

### 8.1. React Router là gì?

React là SPA (Single Page Application) — chỉ có 1 file `index.html`. React Router giúp "giả lập" nhiều trang:
- URL `/login` → hiện component `LoginPage`
- URL `/admin/movies` → hiện component `MoviesPage`
- Trình duyệt KHÔNG tải lại trang (không có request HTML mới), chỉ thay đổi component hiển thị

### 8.2. Code mẫu — App.tsx

```tsx
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { lazy, Suspense } from 'react'
import { useAuthStore } from '@/store/authStore'

// Lazy load — chi tai component khi can (giup trang load nhanh hon)
const LoginPage = lazy(() => import('@/features/auth/LoginPage'))
const RegisterPage = lazy(() => import('@/features/auth/RegisterPage'))
const AdminMoviesPage = lazy(() => import('@/features/admin/movies/MoviesPage'))
const HomePage = lazy(() => import('@/features/user/HomePage'))

// TanStack Query client — cau hinh cache toan cuc
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,  // Data "tuoi" trong 5 phut (khong refetch)
      retry: 1,                   // Loi thi thu lai 1 lan
    },
  },
})

// ============================================================
// Protected Route — Bao ve trang can dang nhap
// ============================================================
function ProtectedRoute({ requiredRole }: { requiredRole?: string }) {
  const { token, user } = useAuthStore()

  // Chua dang nhap → chuyen ve /login
  if (!token) {
    return <Navigate to="/login" replace />
  }

  // Dang nhap roi nhung khong du quyen
  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/" replace />
  }

  // Co quyen → render route con (Outlet)
  return <Outlet />
}

// ============================================================
// App — Root component
// ============================================================
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<div className="text-white">Dang tai...</div>}>
          <Routes>
            {/* === PUBLIC ROUTES === */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* === ADMIN ROUTES (can role ADMIN) === */}
            <Route element={<ProtectedRoute requiredRole="ADMIN" />}>
              <Route path="/admin/movies" element={<AdminMoviesPage />} />
              {/* Them cac route admin khac o day */}
            </Route>

            {/* === USER ROUTES (can dang nhap) === */}
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<HomePage />} />
              {/* Them cac route user khac o day */}
            </Route>
          </Routes>
        </Suspense>
        <Toaster richColors position="top-right" />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
```

### 8.3. Giải thích các khái niệm

**Public vs Protected Routes:**

```
/login, /register         → Ai cũng vào được (Public)
/                         → Phải đăng nhập (Protected)
/admin/*                  → Phải đăng nhập + role ADMIN (Protected + Role check)
```

**Code Splitting với `React.lazy()`:**

```tsx
// KHONG dung lazy — tat ca trang tai cung luc khi mo app
import LoginPage from '@/features/auth/LoginPage'      // 50KB
import AdminMoviesPage from '@/features/admin/MoviesPage'  // 100KB
import BookingPage from '@/features/user/BookingPage'    // 80KB
// → User mo trang Login phai tai 230KB (du chi can 50KB)

// DUNG lazy — chi tai khi can
const LoginPage = lazy(() => import('@/features/auth/LoginPage'))
// → User mo trang Login chi tai 50KB. Khi vao /admin/movies moi tai 100KB.
```

> **`<Outlet />` là gì?**
> Là "chỗ trống" (placeholder) để render route con. Khi bạn viết:
> ```tsx
> <Route element={<ProtectedRoute />}>
>   <Route path="/admin/movies" element={<MoviesPage />} />
> </Route>
> ```
> `ProtectedRoute` kiểm tra quyền xong, `<Outlet />` sẽ render `MoviesPage`.

**Layout pattern:**

```tsx
// AdminLayout.tsx — Layout chung cho tat ca trang admin
function AdminLayout() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />           {/* Menu ben trai */}
      <main className="flex-1">
        <Header />           {/* Header ben tren */}
        <Outlet />           {/* Day la noi trang con (MoviesPage, RoomsPage...) se hien */}
      </main>
    </div>
  )
}

// App.tsx
<Route element={<ProtectedRoute requiredRole="ADMIN" />}>
  <Route element={<AdminLayout />}>          {/* Boc tat ca trang admin */}
    <Route path="/admin/movies" element={<MoviesPage />} />
    <Route path="/admin/rooms" element={<RoomsPage />} />
  </Route>
</Route>
```

---

## 9. Setup Zustand store (Auth)

### 9.1. Tại sao cần global state?

Thông tin đăng nhập (user, token) cần được **nhiều component truy cập**:
- Header hiện tên user + avatar
- Sidebar hiện menu theo role
- API interceptor cần token để gắn vào header
- Mỗi trang admin cần kiểm tra quyền

Nếu không có global state, bạn phải **truyền props qua nhiều tầng** (prop drilling):

```
App → Header → UserMenu → AvatarButton (truyền user qua 4 tầng!)
```

Với Zustand, bất kỳ component nào cũng truy cập được:

```tsx
const user = useAuthStore((state) => state.user)  // Truy cap truc tiep, khong can props
```

### 9.2. Code mẫu — store/authStore.ts

```typescript
import { create } from 'zustand'

// Dinh nghia kieu du lieu cho User
interface User {
  username: string
  role: string
  avatarUrl?: string | null
}

// Dinh nghia state + actions
interface AuthState {
  token: string | null
  refreshToken: string | null
  user: User | null
  setAuth: (token: string, refreshToken: string, user: User) => void
  updateUser: (partial: Partial<User>) => void
  logout: () => void
  isLoggedIn: () => boolean
  isAdmin: () => boolean
}

// Helper: doc user tu localStorage (xu ly truong hop JSON hong)
function parseUser(): User | null {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null')
  } catch {
    localStorage.removeItem('user')
    return null
  }
}

// Tao store
export const useAuthStore = create<AuthState>((set, get) => ({
  // === INITIAL STATE ===
  // Doc tu localStorage de giu trang thai khi reload trang
  token: localStorage.getItem('token'),
  refreshToken: localStorage.getItem('refreshToken'),
  user: parseUser(),

  // === ACTIONS ===

  // Goi khi dang nhap thanh cong
  setAuth: (token, refreshToken, user) => {
    localStorage.setItem('token', token)
    localStorage.setItem('refreshToken', refreshToken)
    localStorage.setItem('user', JSON.stringify(user))
    set({ token, refreshToken, user })  // Cap nhat state → re-render component
  },

  // Goi khi cap nhat 1 phan thong tin user (vd: doi avatar)
  updateUser: (partial) => {
    const current = get().user
    if (!current) return
    const updated = { ...current, ...partial }
    localStorage.setItem('user', JSON.stringify(updated))
    set({ user: updated })
  },

  // Goi khi dang xuat
  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
    set({ token: null, refreshToken: null, user: null })
  },

  // Computed values
  isLoggedIn: () => !!get().token,
  isAdmin: () => get().user?.role === 'ADMIN',
}))
```

### 9.3. Sử dụng trong component

```tsx
import { useAuthStore } from '@/store/authStore'

function Header() {
  const user = useAuthStore((state) => state.user)      // Chi lay user
  const logout = useAuthStore((state) => state.logout)   // Chi lay action logout

  return (
    <header>
      <span>Xin chao, {user?.username}</span>
      <button onClick={logout}>Dang xuat</button>
    </header>
  )
}
```

> **Tại sao dùng `(state) => state.user` thay vì `useAuthStore()`?**
> ```tsx
> // SAI — lay toan bo store → re-render khi BAT KY field nao thay doi
> const { user, token, logout } = useAuthStore()
>
> // DUNG — chi lay field can → chi re-render khi field DO thay doi
> const user = useAuthStore((state) => state.user)
> ```
> Đây gọi là **selector** — chỉ "đăng ký" lắng nghe 1 phần của store,
> tránh re-render không cần thiết (performance tốt hơn).

### 9.4. Persist to localStorage

Zustand store nằm trong **bộ nhớ RAM** — khi reload trang, state mất hết. Để giữ trạng thái:

CineX dùng cách **thủ công**: đọc từ localStorage khi khởi tạo, ghi vào localStorage khi thay đổi.

```typescript
// Khoi tao: doc tu localStorage
token: localStorage.getItem('token'),

// Khi thay doi: ghi vao localStorage
setAuth: (token, refreshToken, user) => {
  localStorage.setItem('token', token)       // Ghi
  set({ token, refreshToken, user })          // Cap nhat RAM
},
```

> **Cách khác:** Zustand có middleware `persist` tự động làm việc này:
> ```typescript
> import { persist } from 'zustand/middleware'
>
> const useAuthStore = create(
>   persist<AuthState>(
>     (set, get) => ({ /* ... */ }),
>     { name: 'auth-storage' }  // Key trong localStorage
>   )
> )
> ```
> CineX không dùng middleware vì muốn kiểm soát rõ ràng (chỉ lưu field cần thiết, xử lý lỗi JSON).

---

## 10. Tạo trang đầu tiên (Login)

### 10.1. Tạo type — types/auth.ts

```typescript
// Request gui len server
export interface LoginRequest {
  username: string
  password: string
}

// Response tu server
export interface LoginResponse {
  accessToken: string
  refreshToken: string
  username: string
  role: string
}
```

### 10.2. Tạo hook — hooks/useAuth.ts

```typescript
import { useMutation } from '@tanstack/react-query'
import api from '@/api/axios'
import type { LoginRequest, LoginResponse } from '@/types/auth'
import { useAuthStore } from '@/store/authStore'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

export function useLogin() {
  const setAuth = useAuthStore((state) => state.setAuth)
  const navigate = useNavigate()

  return useMutation({
    // Ham goi API
    mutationFn: async (data: LoginRequest) => {
      const res = await api.post<{ data: LoginResponse }>('/api/auth/login', data)
      return res.data.data
    },

    // Thanh cong → luu token + chuyen trang
    onSuccess: (data) => {
      setAuth(data.accessToken, data.refreshToken, {
        username: data.username,
        role: data.role,
      })
      toast.success('Dang nhap thanh cong!')
      navigate(data.role === 'ADMIN' ? '/admin/movies' : '/')
    },

    // Loi → hien thong bao
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Dang nhap that bai'
      toast.error(message)
    },
  })
}
```

> **`useMutation` là gì?**
> - `useQuery` dùng cho **đọc dữ liệu** (GET) — tự động gọi, cache, refetch
> - `useMutation` dùng cho **thay đổi dữ liệu** (POST, PUT, DELETE) — gọi khi user click
> - `useMutation` trả về: `mutate()` (gọi API), `isPending` (đang chờ), `isError` (bị lỗi)

### 10.3. Tạo component — features/auth/LoginPage.tsx

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useLogin } from '@/hooks/useAuth'

// Zod schema — dinh nghia validation
const loginSchema = z.object({
  username: z.string().min(1, 'Vui long nhap ten dang nhap'),
  password: z.string().min(6, 'Mat khau toi thieu 6 ky tu'),
})

// Infer type tu schema (khong can viet lai interface)
type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  // React Hook Form — quan ly form state + validation
  const {
    register,     // Dang ky input voi form
    handleSubmit, // Boc ham submit (chi goi khi valid)
    formState: { errors },  // Loi validation
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),  // Ket noi Zod voi React Hook Form
  })

  // Hook goi API login
  const { mutate: login, isPending } = useLogin()

  // Khi user nhan Dang nhap
  const onSubmit = (data: LoginForm) => {
    login(data)  // Goi API
  }

  return (
    <div className="min-h-screen bg-[#051424] flex items-center justify-center">
      <div className="w-full max-w-md p-8 rounded-xl bg-[#0a1929] border border-white/5">
        <h1 className="text-2xl font-bold text-white text-center mb-8">
          Dang nhap CineX
        </h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Username */}
          <div>
            <label className="text-sm text-gray-300 mb-1 block">
              Ten dang nhap
            </label>
            <Input
              {...register('username')}
              placeholder="Nhap ten dang nhap"
              className="bg-[#0d2137] border-white/10 text-white"
            />
            {errors.username && (
              <p className="text-red-400 text-xs mt-1">
                {errors.username.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="text-sm text-gray-300 mb-1 block">
              Mat khau
            </label>
            <Input
              {...register('password')}
              type="password"
              placeholder="Nhap mat khau"
              className="bg-[#0d2137] border-white/10 text-white"
            />
            {errors.password && (
              <p className="text-red-400 text-xs mt-1">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={isPending}
            className="w-full bg-[#eab308] hover:bg-[#ca8a04] text-black font-semibold"
          >
            {isPending ? 'Dang xu ly...' : 'Dang nhap'}
          </Button>
        </form>
      </div>
    </div>
  )
}
```

### 10.4. Luồng xử lý Login

```
User nhập username + password
            │
            ▼
     [React Hook Form]
  Validate bằng Zod schema
    username không rỗng?
    password >= 6 ký tự?
            │
      Valid?
     /       \
   No         Yes
    │          │
Hiện lỗi    Gọi login(data)
dỏ input         │
                 ▼
          [useLogin hook]
    mutate → api.post('/api/auth/login')
                 │
                 ▼
       [Request Interceptor]
    (Chưa có token → không gắn)
                 │
                 ▼
           SERVER XỬ LÝ
    Check username/password
                 │
           Đúng / Sai?
          /          \
        Đúng          Sai
         │              │
    Trả 200 +       Trả 401
    tokens + user   "Sai mật khẩu"
         │              │
         ▼              ▼
   [onSuccess]     [onError]
   setAuth()       toast.error()
   toast.success()
   navigate('/admin')
```

---

## 11. Chạy và test

### 11.1. Chạy backend

```bash
# Terminal 1: Chay database
cd /Users/vutuongan/cinex && docker-compose up sqlserver redis -d

# Terminal 2: Chay backend
cd /Users/vutuongan/cinex/backend && ./gradlew bootRun
```

Đợi đến khi thấy log:
```
Started CinexApplication in X.XX seconds
```

### 11.2. Chạy frontend

```bash
# Terminal 3: Chay frontend
cd /Users/vutuongan/cinex/frontend && npm run dev
```

Kết quả:
```
  VITE v8.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
```

### 11.3. Test trên trình duyệt

1. Mở http://localhost:5173/login
2. Nhập username và password
3. Nhấn "Đăng nhập"
4. Nếu thành công → chuyển sang trang admin/home + toast "Đăng nhập thành công!"
5. Nếu sai → toast đỏ "Sai mật khẩu"

### 11.4. Kiểm tra với DevTools

Mở trình duyệt → F12 (Developer Tools):

**Tab Network:**
- Tìm request `login` → xem Request Payload và Response
- Status 200 = thành công, 401 = sai thông tin

**Tab Application → Local Storage:**
- Sau khi đăng nhập thành công, kiểm tra:
  - `token` — access token (chuỗi JWT dài)
  - `refreshToken` — refresh token
  - `user` — JSON chứa username và role

**Tab Console:**
- Xem có lỗi JavaScript nào không
- Các lỗi thường gặp: CORS (backend chưa cho phép frontend gọi), Network Error (backend chưa chạy)

### 11.5. Lỗi thường gặp và cách fix

| Lỗi | Nguyên nhân | Cách fix |
|---|---|---|
| `Network Error` | Backend chưa chạy hoặc sai port | Kiểm tra backend chạy trên port 8088 |
| `CORS error` | Backend chưa cấu hình CORS | Thêm `@CrossOrigin` hoặc cấu hình `SecurityFilterChain` |
| `404 Not Found` | Sai URL API | Kiểm tra URL trong axios.ts và controller backend |
| `401 Unauthorized` | Sai username/password | Kiểm tra tài khoản trong database |
| Trang trắng, không hiện gì | Lỗi JavaScript | Mở Console (F12) để xem lỗi |
| Tailwind class không có tác dụng | Chưa cấu hình Tailwind | Kiểm tra `@import 'tailwindcss'` trong index.css |

---

## Tổng kết

Sau khi hoàn thành 11 bước trên, bạn đã có:

| Thành phần | Công cụ | Trạng thái |
|---|---|---|
| Build tool | Vite | Khởi động nhanh, HMR |
| UI framework | React 19 + TypeScript | Type-safe |
| Styling | Tailwind CSS 4 | Utility-first |
| UI components | shadcn/ui | Copy code, tùy chỉnh thoải mái |
| Routing | React Router 7 | Code splitting, Protected routes |
| Data fetching | TanStack Query + Axios | Cache, auto refetch, JWT interceptor |
| State management | Zustand | Đơn giản, persist localStorage |
| Form + Validation | React Hook Form + Zod | Type-safe validation |
| Notifications | Sonner | Toast đẹp, nhiều variant |

**Bước tiếp theo:** Đọc các file docs khác trong `/docs/frontend/` để hiểu sâu từng thư viện:
- `01-react-basics.md` — Cơ bản về React (component, props, state)
- `02-react-router.md` — Chi tiết về routing
- `03-tanstack-query.md` — Chi tiết về data fetching
- `04-zustand-state.md` — Chi tiết về state management
- `06-form-validation.md` — Chi tiết về form + Zod
