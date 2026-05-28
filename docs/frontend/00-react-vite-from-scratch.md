# Tao du an React + Vite + Tailwind tu dau

> Huong dan chi tiet tung buoc, danh cho nguoi chua biet gi ve React.
> Tat ca code mau lay tu du an CineX thuc te.

---

## Muc luc

1. [Cai dat moi truong](#1-cai-dat-moi-truong)
2. [Tao project Vite + React + TypeScript](#2-tao-project-vite--react--typescript)
3. [Cai Tailwind CSS 4](#3-cai-tailwind-css-4)
4. [Cai shadcn/ui](#4-cai-shadcnui)
5. [Cai dependencies du an](#5-cai-dependencies-du-an)
6. [Cau truc folder du an](#6-cau-truc-folder-du-an)
7. [Setup Axios + JWT interceptor](#7-setup-axios--jwt-interceptor)
8. [Setup React Router](#8-setup-react-router)
9. [Setup Zustand store (Auth)](#9-setup-zustand-store-auth)
10. [Tao trang dau tien (Login)](#10-tao-trang-dau-tien-login)
11. [Chay va test](#11-chay-va-test)

---

## 1. Cai dat moi truong

### 1.1. Cai Node.js 20+

Node.js la **runtime** de chay JavaScript ngoai trinh duyet. React can Node.js de:
- Chay dev server (Vite)
- Cai dat thu vien qua npm
- Build code thanh file tinh (HTML/CSS/JS) de deploy

**Cach 1: Dung nvm (khuyen dung)**

nvm (Node Version Manager) cho phep cai nhieu phien ban Node.js va chuyen doi de dang:

```bash
# Cai nvm (macOS/Linux)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash

# Khoi dong lai terminal, sau do:
nvm install 20
nvm use 20
```

**Cach 2: Download truc tiep**

Vao https://nodejs.org, tai ban LTS (Long Term Support) ve cai.

### 1.2. Kiem tra cai dat

```bash
node -v   # Ket qua mong doi: v20.x.x tro len
npm -v    # Ket qua mong doi: 10.x.x tro len
```

> **npm la gi?** npm (Node Package Manager) la cong cu quan ly thu vien JavaScript.
> Khi ban `npm install react`, npm se tai React tu registry ve folder `node_modules/`.

### 1.3. IDE: VS Code + Extensions

Tai VS Code tai https://code.visualstudio.com, sau do cai cac extension:

| Extension | Tac dung |
|---|---|
| **ESLint** | Kiem tra loi code JavaScript/TypeScript theo quy tac |
| **Prettier** | Tu dong format code cho dep, nhat quan |
| **Tailwind CSS IntelliSense** | Goi y class Tailwind khi go, xem preview mau sac |
| **TypeScript Vue Plugin (Volar)** | Ho tro TypeScript tot hon (du khong dung Vue) |
| **Error Lens** | Hien thi loi ngay tren dong code, khong can hover |

> **Tai sao can ESLint + Prettier?**
> - ESLint: tim loi logic (bien chua dung, import thua)
> - Prettier: format code (dau cham phay, tab/space, xuong dong)
> - Hai cong cu bo sung nhau: ESLint lo "dung/sai", Prettier lo "dep/xau"

---

## 2. Tao project Vite + React + TypeScript

### 2.1. Tao project

```bash
npm create vite@latest frontend -- --template react-ts
```

Giai thich tung phan:
- `npm create vite@latest` — chay tool tao project cua Vite (phien ban moi nhat)
- `frontend` — ten folder se duoc tao
- `--template react-ts` — dung template React + TypeScript (thay vi JavaScript thuong)

> **Tai sao dung Vite thay vi Create React App (CRA)?**
> - CRA da ngung phat trien tu 2023, React chinh thuc khuyen dung Vite
> - Vite khoi dong dev server trong **vai tram mili giay** (CRA mat vai giay)
> - Vite dung ESBuild (viet bang Go) de transform code, nhanh hon Webpack 10-100 lan
> - Hot Module Replacement (HMR) cua Vite cap nhat tuc thi khi ban sua code

> **Tai sao TypeScript thay vi JavaScript?**
> - TypeScript = JavaScript + kieu du lieu (type). Vi du: `name: string` thay vi chi `name`
> - Loi bi bat ngay luc viet code (compile-time) thay vi luc chay (runtime)
> - IDE goi y tot hon vi biet kieu du lieu cua moi bien
> - Du an thuc te 90%+ dung TypeScript

### 2.2. Cau truc folder sinh ra

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

### 2.3. Giai thich tsconfig.json

File `tsconfig.json` cua CineX:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

Day la **Project References** — tach cau hinh TypeScript thanh 2 phan:
- `tsconfig.app.json`: cho code trong `src/` (chay tren trinh duyet)
- `tsconfig.node.json`: cho `vite.config.ts` (chay tren Node.js)

> **Tai sao tach?** Vi `vite.config.ts` chay tren Node.js (can `module: "esnext"`, truy cap file system),
> con `src/` chay tren trinh duyet (can `jsx: "react-jsx"`, DOM API). Hai moi truong khac nhau
> nen can cau hinh khac nhau.

File `tsconfig.app.json` cua CineX:

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

> **Path alias la gi?**
> Thay vi viet `import Button from '../../../components/ui/button'`
> ban viet `import Button from '@/components/ui/button'`
> Ngan gon hon, khong bi loi khi di chuyen file.

### 2.4. Giai thich vite.config.ts

File `vite.config.ts` cua CineX:

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

> **Luu y quan trong:** Path alias phai cau hinh o **CA HAI noi**:
> 1. `tsconfig.app.json` — de TypeScript hieu `@/` nghia la gi
> 2. `vite.config.ts` — de Vite biet resolve `@/` khi build
> Neu chi cau hinh 1 noi, se bi loi!

### 2.5. Cai dat va chay thu

```bash
cd frontend
npm install    # Tai tat ca dependencies ve node_modules/
npm run dev    # Khoi dong dev server
```

Mo trinh duyet tai http://localhost:5173 — ban se thay trang mac dinh cua Vite.

> **`npm install` lam gi?**
> Doc file `package.json`, tai tat ca thu vien (dependencies + devDependencies) ve folder `node_modules/`.
> Dong thoi tao file `package-lock.json` ghi lai phien ban chinh xac cua tung thu vien.

---

## 3. Cai Tailwind CSS 4

### 3.1. Tailwind CSS la gi?

Tailwind CSS la framework CSS theo huong **utility-first**. Thay vi viet CSS rieng:

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

Ban viet class truc tiep trong HTML/JSX:

```jsx
{/* Tailwind — utility classes */}
<button className="bg-[#eab308] text-black font-semibold px-4 py-2 rounded-lg">
  Dat ve
</button>
```

> **Tai sao dung Tailwind?**
> 1. **Khong can dat ten class** — khong mat thoi gian nghi ten `.btn-primary-large-gold`
> 2. **Khong bi xung dot CSS** — class utility khong bao gio de len nhau
> 3. **File CSS nho** — Tailwind chi sinh CSS cho class ban thuc su dung
> 4. **Nhat quan** — spacing, mau sac, font size deu tu he thong co san

### 3.2. Cai dat

Tailwind CSS 4 dung **Vite plugin** (khac voi v3 dung PostCSS):

```bash
npm install tailwindcss @tailwindcss/vite
```

> **Tai sao 2 package?**
> - `tailwindcss`: engine chinh (xử ly class, sinh CSS)
> - `@tailwindcss/vite`: plugin tich hop vao Vite (tu dong scan file, rebuild khi thay doi)

### 3.3. Cau hinh vite.config.ts

Them plugin Tailwind:

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

### 3.4. Cau hinh index.css

Thay toan bo noi dung `src/index.css` bang:

```css
@import 'tailwindcss';
```

Dong nay noi voi Tailwind: "Hay inject tat ca utility classes vao day."

> **Tailwind 4 vs Tailwind 3:**
> - v3: can file `tailwind.config.js` + `postcss.config.js` + 3 directive (`@tailwind base/components/utilities`)
> - v4: chi can `@import 'tailwindcss'` + Vite plugin. Don gian hon nhieu!

### 3.5. Test Tailwind

Sua file `src/App.tsx`:

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

Chay `npm run dev`, mo trinh duyet — neu thay nen do va chu trang la thanh cong.

---

## 4. Cai shadcn/ui

### 4.1. shadcn/ui la gi?

shadcn/ui **KHONG PHAI** la mot npm package thong thuong. No la **bo suu tap component** ma ban **copy truc tiep vao du an**.

| Thu vien UI thong thuong (Material UI, Ant Design) | shadcn/ui |
|---|---|
| Cai qua `npm install` | Copy code vao `src/components/ui/` |
| Code nam trong `node_modules/`, KHONG sua duoc | Code nam trong du an, TUY CHINH thoai mai |
| Update = `npm update`, co the break | Update = copy lai file moi, ban quyet dinh |
| Bundle size lon (import ca thu vien) | Chi co component ban dung |

> **Vi du thuc te:** Khi dung Material UI, ban bi "khoa" vao style cua ho.
> Muon doi mau nen cua Button? Phai doc docs, override theme phuc tap.
> Voi shadcn/ui, ban mo file `components/ui/button.tsx` va sua truc tiep — vi no la code cua ban.

### 4.2. Cai dat

```bash
npx shadcn@latest init
```

Tool se hoi ban mot so cau hoi:
- **Style:** `default` (Clean, minimal style)
- **Base color:** `neutral` (Mau nen trung tinh)
- **CSS variables:** `yes` (Dung CSS variables de de doi theme)

Sau khi chay xong, shadcn tao ra:
- `src/components/ui/` — folder chua component
- `src/lib/utils.ts` — ham `cn()` ghep class name
- Cap nhat `tsconfig.json` voi path alias

### 4.3. Them component

```bash
npx shadcn@latest add button card input dialog table select textarea badge
```

Moi lenh `add` se copy file component vao `src/components/ui/`. Vi du:
- `button.tsx` — Component Button voi nhieu variant (default, destructive, outline, ghost)
- `card.tsx` — Component Card (Header, Content, Footer)
- `input.tsx` — Component Input da style san
- `dialog.tsx` — Component Modal/Dialog

### 4.4. Su dung component

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

> **Ham `cn()` la gi?**
> ```typescript
> import { clsx } from 'clsx'
> import { twMerge } from 'tailwind-merge'
>
> export function cn(...inputs: ClassValue[]) {
>   return twMerge(clsx(inputs))
> }
> ```
> `cn()` ghep nhieu class name lai va **xu ly xung dot Tailwind**.
> Vi du: `cn('bg-red-500', 'bg-blue-500')` tra ve `'bg-blue-500'` (class sau thang).
> Neu dung string thuong: `"bg-red-500 bg-blue-500"` — ca hai deu ton tai, ket qua khong doan truoc duoc.

---

## 5. Cai dependencies du an

### 5.1. Cai tat ca cung luc

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

Hoac cai tat ca trong 1 lenh:

```bash
npm install react-router-dom @tanstack/react-query zustand axios react-hook-form @hookform/resolvers zod lucide-react sonner @fontsource/inter
```

### 5.2. Giai thich tung thu vien

| Thu vien | Dung de lam gi | Vi du thuc te |
|---|---|---|
| **react-router-dom** | Dinh tuyen (chuyen trang) trong SPA | `/login` hien trang Login, `/admin/movies` hien trang quan ly phim |
| **@tanstack/react-query** | Goi API + cache ket qua + tu dong refetch | Goi API lay danh sach phim, cache 5 phut, tu dong refetch khi focus tab |
| **zustand** | Quan ly state toan cuc (global state) | Luu thong tin user dang nhap, token JWT, gio hang |
| **axios** | HTTP client (goi API) | `axios.get('/api/movies')`, tu dong dinh JWT vao header |
| **react-hook-form** | Quan ly form (validation, submit, error) | Form dang nhap: kiem tra email hop le, mat khau du dai |
| **@hookform/resolvers** | Ket noi react-hook-form voi Zod | De Zod schema lam validator cho react-hook-form |
| **zod** | Dinh nghia + validate schema du lieu | `z.string().email("Email khong hop le")` |
| **lucide-react** | Bo icon SVG nhe, dep | Icon `<Search />`, `<Trash2 />`, `<Plus />` |
| **sonner** | Hien thi toast notification | "Dang nhap thanh cong!", "Da xoa phim" |
| **@fontsource/inter** | Font Inter (self-hosted, khong can Google Fonts) | Font chu chinh cua toan bo giao dien |

> **Tai sao TanStack Query thay vi chi dung `useEffect` + `fetch`?**
>
> Voi `useEffect` thuong:
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
> Voi TanStack Query:
> ```tsx
> // TanStack Query — 1 dong, tu dong co loading, error, cache, refetch
> const { data: movies, isLoading, error } = useQuery({
>   queryKey: ['movies'],
>   queryFn: () => api.get('/api/movies').then(res => res.data),
> })
> ```

> **Tai sao Zustand thay vi Redux?**
> - Redux: nhieu boilerplate (action, reducer, dispatch, connect...) — phuc tap cho du an vua
> - Zustand: don gian, code it, khong can Provider boc toan bo app
> - CineX chi can luu auth state (user, token) → Zustand la du

> **Tai sao Zod thay vi Yup?**
> - Zod thiet ke cho TypeScript tu dau (type-safe, infer type tu schema)
> - Yup thiet ke cho JavaScript, TypeScript support la "them vao sau"
> - Zod nho hon, nhanh hon, API truc quan hon

---

## 6. Cau truc folder du an

### 6.1. Cau truc tong the

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

### 6.2. Tai sao cau truc nhu vay?

**Feature-based (theo chuc nang), KHONG PHAI type-based (theo loai file)**

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

> **Loi ich thuc te:**
> - Khi sua chuc nang "Quan ly phim", ban chi can mo folder `features/admin/movies/`
> - Khi xoa chuc nang, xoa ca folder — khong so sot file
> - Team moi nguoi lam 1 feature, khong bi conflict git

**Hooks tach rieng khoi component**

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

> **Day la nguyen tac Single Responsibility (SOLID):**
> - Component chi lo **hien thi** (render UI)
> - Hook chi lo **du lieu** (goi API, cache, mutation)
> - Utils chi lo **xu ly** (format tien, ngay)

---

## 7. Setup Axios + JWT interceptor

### 7.1. JWT la gi?

JWT (JSON Web Token) la cach xac thuc nguoi dung trong API:
1. User dang nhap → server tra ve **access token** (het han nhanh, 15 phut) + **refresh token** (het han cham, 7 ngay)
2. Moi request, frontend gui access token trong header `Authorization: Bearer <token>`
3. Server doc token, biet ai dang goi API

### 7.2. Code mau — api/axios.ts

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

### 7.3. Giai thich luong xu ly

```
User goi API (vd: GET /api/movies)
        │
        ▼
[Request Interceptor]
  Lay token tu localStorage
  Gan header: Authorization: Bearer <token>
        │
        ▼
   GUI REQUEST ──────► Server
        │                 │
        │            Response 200?
        │           /           \
        │         Yes            No (401)
        │          │              │
        ▼          ▼              ▼
[Response Interceptor]    [Response Interceptor]
   Tra ve data             Goi /auth/refresh
                                  │
                            Thanh cong?
                           /          \
                         Yes           No
                          │             │
                   Luu token moi    forceLogout()
                   Gui lai request   → /login
                   ban dau
```

> **Tai sao can `failedQueue`?**
> Hinh dung: ban dang o trang admin, trang nay goi 5 API cung luc (phim, phong, suat chieu...).
> Token het han → ca 5 deu bi 401. Neu khong co queue:
> - Ca 5 deu goi /auth/refresh → 5 refresh token → server co the reject 4 cai
> Voi queue: chi request dau tien refresh, 4 request con lai cho → token moi → gui lai ca 5.

---

## 8. Setup React Router

### 8.1. React Router la gi?

React la SPA (Single Page Application) — chi co 1 file `index.html`. React Router giup "gia lap" nhieu trang:
- URL `/login` → hien component `LoginPage`
- URL `/admin/movies` → hien component `MoviesPage`
- Trinh duyet KHONG tai lai trang (khong co request HTML moi), chi thay doi component hien thi

### 8.2. Code mau — App.tsx

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

### 8.3. Giai thich cac khai niem

**Public vs Protected Routes:**

```
/login, /register         → Ai cung vao duoc (Public)
/                         → Phai dang nhap (Protected)
/admin/*                  → Phai dang nhap + role ADMIN (Protected + Role check)
```

**Code Splitting voi `React.lazy()`:**

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

> **`<Outlet />` la gi?**
> La "cho trong" (placeholder) de render route con. Khi ban viet:
> ```tsx
> <Route element={<ProtectedRoute />}>
>   <Route path="/admin/movies" element={<MoviesPage />} />
> </Route>
> ```
> `ProtectedRoute` kiem tra quyen xong, `<Outlet />` se render `MoviesPage`.

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

### 9.1. Tai sao can global state?

Thong tin dang nhap (user, token) can duoc **nhieu component truy cap**:
- Header hien ten user + avatar
- Sidebar hien menu theo role
- API interceptor can token de gan vao header
- Moi trang admin can kiem tra quyen

Neu khong co global state, ban phai **truyen props qua nhieu tang** (prop drilling):

```
App → Header → UserMenu → AvatarButton (truyen user qua 4 tang!)
```

Voi Zustand, bat ky component nao cung truy cap duoc:

```tsx
const user = useAuthStore((state) => state.user)  // Truy cap truc tiep, khong can props
```

### 9.2. Code mau — store/authStore.ts

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

### 9.3. Su dung trong component

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

> **Tai sao dung `(state) => state.user` thay vi `useAuthStore()`?**
> ```tsx
> // SAI — lay toan bo store → re-render khi BAT KY field nao thay doi
> const { user, token, logout } = useAuthStore()
>
> // DUNG — chi lay field can → chi re-render khi field DO thay doi
> const user = useAuthStore((state) => state.user)
> ```
> Day goi la **selector** — chi "dang ky" lang nghe 1 phan cua store,
> tranh re-render khong can thiet (performance tot hon).

### 9.4. Persist to localStorage

Zustand store nam trong **bo nho RAM** — khi reload trang, state mat het. De giu trang thai:

CineX dung cach **thu cong**: doc tu localStorage khi khoi tao, ghi vao localStorage khi thay doi.

```typescript
// Khoi tao: doc tu localStorage
token: localStorage.getItem('token'),

// Khi thay doi: ghi vao localStorage
setAuth: (token, refreshToken, user) => {
  localStorage.setItem('token', token)       // Ghi
  set({ token, refreshToken, user })          // Cap nhat RAM
},
```

> **Cach khac:** Zustand co middleware `persist` tu dong lam viec nay:
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
> CineX khong dung middleware vi muon kiem soat ro rang (chi luu field can thiet, xu ly loi JSON).

---

## 10. Tao trang dau tien (Login)

### 10.1. Tao type — types/auth.ts

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

### 10.2. Tao hook — hooks/useAuth.ts

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

> **`useMutation` la gi?**
> - `useQuery` dung cho **doc du lieu** (GET) — tu dong goi, cache, refetch
> - `useMutation` dung cho **thay doi du lieu** (POST, PUT, DELETE) — goi khi user click
> - `useMutation` tra ve: `mutate()` (goi API), `isPending` (dang cho), `isError` (bi loi)

### 10.3. Tao component — features/auth/LoginPage.tsx

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

### 10.4. Luong xu ly Login

```
User nhap username + password
            │
            ▼
     [React Hook Form]
  Validate bang Zod schema
    username khong rong?
    password >= 6 ky tu?
            │
      Valid?
     /       \
   No         Yes
    │          │
Hien loi    Goi login(data)
do input         │
                 ▼
          [useLogin hook]
    mutate → api.post('/api/auth/login')
                 │
                 ▼
       [Request Interceptor]
    (Chua co token → khong gan)
                 │
                 ▼
           SERVER XU LY
    Check username/password
                 │
           Dung / Sai?
          /          \
        Dung          Sai
         │              │
    Tra 200 +       Tra 401
    tokens + user   "Sai mat khau"
         │              │
         ▼              ▼
   [onSuccess]     [onError]
   setAuth()       toast.error()
   toast.success()
   navigate('/admin')
```

---

## 11. Chay va test

### 11.1. Chay backend

```bash
# Terminal 1: Chay database
cd /Users/vutuongan/cinex && docker-compose up sqlserver redis -d

# Terminal 2: Chay backend
cd /Users/vutuongan/cinex/backend && ./gradlew bootRun
```

Doi den khi thay log:
```
Started CinexApplication in X.XX seconds
```

### 11.2. Chay frontend

```bash
# Terminal 3: Chay frontend
cd /Users/vutuongan/cinex/frontend && npm run dev
```

Ket qua:
```
  VITE v8.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
```

### 11.3. Test tren trinh duyet

1. Mo http://localhost:5173/login
2. Nhap username va password
3. Nhan "Dang nhap"
4. Neu thanh cong → chuyen sang trang admin/home + toast "Dang nhap thanh cong!"
5. Neu sai → toast do "Sai mat khau"

### 11.4. Kiem tra voi DevTools

Mo trinh duyet → F12 (Developer Tools):

**Tab Network:**
- Tim request `login` → xem Request Payload va Response
- Status 200 = thanh cong, 401 = sai thong tin

**Tab Application → Local Storage:**
- Sau khi dang nhap thanh cong, kiem tra:
  - `token` — access token (chuoi JWT dai)
  - `refreshToken` — refresh token
  - `user` — JSON chua username va role

**Tab Console:**
- Xem co loi JavaScript nao khong
- Cac loi thuong gap: CORS (backend chua cho phep frontend goi), Network Error (backend chua chay)

### 11.5. Loi thuong gap va cach fix

| Loi | Nguyen nhan | Cach fix |
|---|---|---|
| `Network Error` | Backend chua chay hoac sai port | Kiem tra backend chay tren port 8088 |
| `CORS error` | Backend chua cau hinh CORS | Them `@CrossOrigin` hoac cau hinh `SecurityFilterChain` |
| `404 Not Found` | Sai URL API | Kiem tra URL trong axios.ts va controller backend |
| `401 Unauthorized` | Sai username/password | Kiem tra tai khoan trong database |
| Trang trang, khong hien gi | Loi JavaScript | Mo Console (F12) de xem loi |
| Tailwind class khong co tac dung | Chua cau hinh Tailwind | Kiem tra `@import 'tailwindcss'` trong index.css |

---

## Tong ket

Sau khi hoan thanh 11 buoc tren, ban da co:

| Thanh phan | Cong cu | Trang thai |
|---|---|---|
| Build tool | Vite | Khoi dong nhanh, HMR |
| UI framework | React 19 + TypeScript | Type-safe |
| Styling | Tailwind CSS 4 | Utility-first |
| UI components | shadcn/ui | Copy code, tuy chinh thoai mai |
| Routing | React Router 7 | Code splitting, Protected routes |
| Data fetching | TanStack Query + Axios | Cache, auto refetch, JWT interceptor |
| State management | Zustand | Don gian, persist localStorage |
| Form + Validation | React Hook Form + Zod | Type-safe validation |
| Notifications | Sonner | Toast dep, nhieu variant |

**Buoc tiep theo:** Doc cac file docs khac trong `/docs/frontend/` de hieu sau tung thu vien:
- `01-react-basics.md` — Co ban ve React (component, props, state)
- `02-react-router.md` — Chi tiet ve routing
- `03-tanstack-query.md` — Chi tiet ve data fetching
- `04-zustand-state.md` — Chi tiet ve state management
- `06-form-validation.md` — Chi tiet ve form + Zod
