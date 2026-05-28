# File cấu hình Frontend — Giải thích từ A đến Z

> Dành cho người mới, giải thích **tại sao có file này**, **bên trong có gì**, **sửa khi nào**.

---

## Tổng quan: Một project FE gồm những file gì?

```
frontend/
├── package.json            ← "Sổ tay" dự án: tên, script, dependencies
├── package-lock.json       ← "Hóa đơn chi tiết": phiên bản CHÍNH XÁC đã cài
├── node_modules/           ← Thư mục chứa code thư viện (KHÔNG commit Git)
├── index.html              ← File HTML duy nhất (Single Page App)
├── vite.config.ts          ← Cấu hình build tool (Vite)
├── tsconfig.json           ← Cấu hình TypeScript (file gốc)
├── tsconfig.app.json       ← TypeScript cho source code (src/)
├── tsconfig.node.json      ← TypeScript cho file config (vite.config.ts)
├── eslint.config.js        ← Cấu hình linter (kiểm tra lỗi code)
├── .prettierrc             ← Cấu hình formatter (format code đẹp)
├── .env.development        ← Biến môi trường (URL API, ...)
├── .gitignore              ← File/thư mục Git bỏ qua
├── nginx.conf              ← Cấu hình web server (chỉ dùng khi Docker)
└── src/                    ← Code ứng dụng thật
```

---

## 1. package.json — "Sổ tay" dự án

### Là gì?
File quan trọng nhất. Giống như `build.gradle` của Java. Mô tả dự án + liệt kê tất cả thư viện cần dùng.

### So sánh với BE (dễ hiểu hơn)

| Frontend (package.json) | Backend (build.gradle) |
|---|---|
| `"name": "frontend"` | `group = 'com.cinex'` |
| `"dependencies"` | `implementation '...'` |
| `"devDependencies"` | `testImplementation '...'` |
| `"scripts"` | `tasks.named('test')` |
| `npm install` | `./gradlew build` |
| `npm run dev` | `./gradlew bootRun` |

### Giải thích từng phần

```jsonc
{
  "name": "frontend",       // Tên project (tùy đặt, không ảnh hưởng code)
  "private": true,          // Không cho phát hành lên npm registry
                            // (npm là "kho" thư viện công cộng, mình không cần publish)
  "version": "0.0.0",      // Version project (đồ án không cần quan tâm)
  "type": "module",         // Dùng ES Module (import/export) thay vì CommonJS (require)
                            // ES Module là chuẩn mới, tất cả project mới đều dùng

  "scripts": {
    // CÁC LỆNH TẮT — chạy bằng: npm run <tên>
    "dev": "vite",                      // npm run dev → khởi chạy dev server (port 5173)
    "build": "tsc -b && vite build",    // npm run build → kiểm tra TypeScript + đóng gói production
    "lint": "eslint .",                 // npm run lint → kiểm tra lỗi code style
    "preview": "vite preview"           // npm run preview → xem production build local
  },

  "dependencies": {
    // THƯ VIỆN CHẠY TRONG PRODUCTION
    // Code ứng dụng import trực tiếp, user cuối cũng cần
    // Giống: implementation trong Gradle
    "react": "^19.2.5",                // ^ = cho phép update minor/patch (19.2.5 → 19.3.0 OK, 20.0.0 KHÔNG)
    "axios": "^1.16.0",
    // ... (đầy đủ đã giải thích ở docs/project/setup.md mục 7)
  },

  "devDependencies": {
    // THƯ VIỆN CHỈ DÙNG KHI LẬP TRÌNH
    // KHÔNG đi vào production bundle (user không download)
    // Giống: testImplementation, annotationProcessor trong Gradle
    "typescript": "~6.0.2",            // ~ = chỉ update patch (6.0.2 → 6.0.9 OK, 6.1.0 KHÔNG)
    "vite": "^8.0.10",
    "eslint": "^10.2.1",
    // ...
  }
}
```

### Ký hiệu version

```
"react": "^19.2.5"
          │ │ │ └── PATCH: fix bug (tự update)
          │ │ └──── MINOR: thêm tính năng (tự update nếu ^)
          │ └────── MAJOR: breaking change (KHÔNG tự update)
          └──────── ^: cho phép MINOR + PATCH update
                    ~: chỉ cho phép PATCH update
                    (không có): cố định chính xác version đó
```

### Khi nào sửa file này?
| Hành động | Lệnh | Tự sửa? |
|---|---|---|
| Cài thư viện mới | `npm install axios` | Tự thêm vào dependencies |
| Cài thư viện dev | `npm install -D eslint` | Tự thêm vào devDependencies |
| Gỡ thư viện | `npm uninstall axios` | Tự xóa khỏi file |
| Thêm script mới | Sửa tay mục `"scripts"` | Sửa tay |

---

## 2. package-lock.json — "Hóa đơn chi tiết"

### Là gì?
File **tự sinh** khi chạy `npm install`. Ghi lại version CHÍNH XÁC của mọi thư viện (kể cả sub-dependencies).

### Tại sao cần?

**Ví dụ đời thường:**
- `package.json` ghi: "Mua táo version ^2.0" (cho phép 2.0 → 2.9)
- Hôm nay bạn cài: npm download táo version 2.3
- Tuần sau bạn bè clone project: npm download táo version 2.5 (mới hơn)
- → **Code chạy khác nhau** vì version khác nhau!

`package-lock.json` giải quyết:
- Ghi rõ: "Đã cài táo CHÍNH XÁC version 2.3.1"
- Bạn bè clone → `npm install` đọc lock file → cài ĐÚNG 2.3.1
- → **Tất cả mọi người đều dùng cùng version** ✓

### So sánh BE

| FE | BE |
|---|---|
| `package-lock.json` | `gradle.lockfile` (ít dùng vì Gradle BOM đã fix version) |

### Bên trong có gì?

```jsonc
{
  "name": "frontend",
  "version": "0.0.0",
  "lockfileVersion": 3,          // Format version của lock file
  "packages": {
    "": { ... },                  // Project gốc (package.json)
    "node_modules/react": {       // Thư viện React
      "version": "19.2.5",       // VERSION CHÍNH XÁC (không có ^)
      "resolved": "https://registry.npmjs.org/react/-/react-19.2.5.tgz",  // URL download
      "integrity": "sha512-...", // Hash kiểm tra file không bị thay đổi (bảo mật)
    },
    "node_modules/axios": {
      "version": "1.16.0",
      "dependencies": {           // Sub-dependencies (thư viện mà axios cần)
        "follow-redirects": "^1.15.6",
        "form-data": "^4.0.0"
      }
    }
    // ... hàng nghìn dòng (mỗi sub-dependency đều được liệt kê)
  }
}
```

### Quy tắc quan trọng

| Việc | Đúng | Sai |
|---|---|---|
| Commit vào Git? | **CÓ** — để team cùng version | Không commit → mỗi người version khác |
| Sửa tay? | **KHÔNG BAO GIỜ** | Sửa tay → hỏng format, npm install lỗi |
| Xóa được không? | Được, nhưng phải `npm install` lại | Xóa rồi không install → lỗi |
| File to quá (5000+ dòng)? | **Bình thường** — không cần đọc | — |

### Khi nào file này thay đổi?
- Chạy `npm install` (cài mới hoặc cập nhật)
- Chạy `npm update` (update version)
- Xóa `node_modules` + `npm install` lại

---

## 3. node_modules/ — Thư mục chứa code thư viện

### Là gì?
Thư mục chứa TẤT CẢ code của thư viện đã cài. Khi bạn `import axios from 'axios'`, JavaScript tìm code trong `node_modules/axios/`.

### Tại sao to khủng khiếp? (200MB+)

```
node_modules/
├── react/            ← Code thư viện React
├── axios/            ← Code thư viện Axios
│   └── node_modules/
│       ├── follow-redirects/   ← Axios cần thư viện này
│       └── form-data/          ← Axios cũng cần cái này
├── typescript/       ← TypeScript compiler
├── vite/             ← Vite build tool
│   └── node_modules/
│       ├── esbuild/            ← Vite cần esbuild
│       ├── rollup/             ← Vite cần rollup
│       └── ... (20+ sub-dependencies)
└── ... (hàng trăm thư mục)
```

Mỗi thư viện lại phụ thuộc vào thư viện khác → **dependency tree** rất sâu.

### Quy tắc

| Việc | Trả lời |
|---|---|
| Commit vào Git? | **TUYỆT ĐỐI KHÔNG** (quá to, `.gitignore` đã chặn) |
| Xóa được không? | **Được** — `npm install` sinh lại đầy đủ |
| Copy cho người khác? | **Không** — gửi `package.json` + `package-lock.json`, họ tự `npm install` |
| Sửa file bên trong? | **KHÔNG BAO GIỜ** — sẽ bị ghi đè khi install lại |

### Xóa + cài lại (khi gặp lỗi)

```bash
rm -rf node_modules
npm install
```

Giống như "format lại" — xóa sạch rồi cài lại từ đầu.

---

## 4. index.html — File HTML duy nhất

### Là gì?
Đây là file HTML **duy nhất** của toàn bộ ứng dụng. React là Single Page Application (SPA) — chỉ có 1 trang HTML, JavaScript làm mọi thứ còn lại.

### So sánh với web cũ

| Web truyền thống | React SPA |
|---|---|
| 10 trang = 10 file HTML | 10 trang = **1 file HTML** + JavaScript render |
| Click link → server trả HTML mới | Click link → JS đổi nội dung (không reload) |
| Mỗi lần chuyển trang = tải lại | Chuyển trang **tức thì** (đã có JS sẵn) |

### Giải thích code

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <!-- Favicon (icon tab trình duyệt) -->
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <!-- Responsive: zoom phù hợp mọi màn hình -->
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>frontend</title>
  </head>
  <body>
    <!-- CHỈ CÓ 1 THẺ DIV NÀY -->
    <!-- React sẽ render TOÀN BỘ ứng dụng vào đây -->
    <div id="root"></div>

    <!-- Load file TypeScript chính (Vite tự compile thành JS) -->
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### Luồng hoạt động

```
1. Trình duyệt tải index.html
2. Thấy <script src="/src/main.tsx">
3. Vite compile main.tsx → JavaScript
4. main.tsx gọi: ReactDOM.createRoot(document.getElementById('root'))
5. React render <App /> vào <div id="root">
6. App render Router → Router render đúng trang theo URL
7. User click link → Router đổi component → KHÔNG reload trang
```

### Khi nào sửa?
- Đổi `<title>` (tiêu đề tab)
- Thêm font Google, meta SEO, analytics script
- Thêm favicon
- **KHÔNG** thêm HTML nội dung ở đây (React lo phần đó)

---

## 5. vite.config.ts — Cấu hình Build Tool

### Vite là gì?

**Ví dụ đời thường:** Vite là "người phiên dịch + đóng gói". Code bạn viết (TypeScript, JSX, Tailwind) trình duyệt KHÔNG hiểu. Vite dịch thành JavaScript + CSS thuần mà trình duyệt hiểu.

| Chế độ | Vite làm gì |
|---|---|
| Dev (`npm run dev`) | Chạy server tại port 5173, dịch code **khi cần**, Hot Module Replacement (sửa code thấy ngay không cần F5) |
| Build (`npm run build`) | Đóng gói TẤT CẢ code thành vài file JS + CSS nhỏ gọn → deploy production |

### Giải thích code

```ts
import path from 'path'                    // Module Node.js xử lý đường dẫn file
import { defineConfig } from 'vite'        // Hàm giúp TypeScript hiểu config
import react from '@vitejs/plugin-react'   // Plugin: dịch JSX/TSX → JS
import tailwindcss from '@tailwindcss/vite' // Plugin: xử lý Tailwind utility classes

export default defineConfig({
  plugins: [
    react(),         // BẮT BUỘC: không có → không dịch được <div className="...">
    tailwindcss(),   // BẮT BUỘC: không có → class "bg-blue-500" không hoạt động
  ],
  resolve: {
    alias: {
      // PATH ALIAS: @/ = src/
      // Thay vì: import { Button } from '../../../components/ui/button'
      // Viết:    import { Button } from '@/components/ui/button'
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,      // Dev server chạy ở port này
  },
})
```

### Khi nào sửa?
- Thêm plugin mới (VD: thêm SVG loader)
- Đổi port dev server
- Thêm path alias mới
- Cấu hình proxy (gọi API không cần CORS trong dev)

---

## 6. tsconfig.json — TypeScript Config (file gốc)

### TypeScript là gì?

**Ví dụ đời thường:** TypeScript = JavaScript + "kiểm tra chính tả". JavaScript cho phép bạn viết bất kỳ thứ gì (kể cả sai), chỉ phát hiện lỗi khi CHẠY. TypeScript phát hiện lỗi NGAY KHI VIẾT.

```ts
// JavaScript: không báo lỗi, crash khi chạy
function add(a, b) { return a + b }
add("hello", 5)  // → "hello5" 😱 (nối string thay vì cộng số)

// TypeScript: báo lỗi NGAY khi viết
function add(a: number, b: number): number { return a + b }
add("hello", 5)  // ❌ LỖI: "hello" is not a number
```

### Tại sao có 3 file tsconfig?

```
tsconfig.json           ← File GỐC: chỉ trỏ đến 2 file con
├── tsconfig.app.json   ← Config cho SOURCE CODE (src/)
└── tsconfig.node.json  ← Config cho FILE CẤU HÌNH (vite.config.ts)
```

**Tại sao tách?** Vì source code (chạy trong trình duyệt) và file config (chạy trong Node.js) cần config khác nhau:

| | tsconfig.app.json (Browser) | tsconfig.node.json (Node.js) |
|---|---|---|
| Dùng cho | `src/**/*.tsx` | `vite.config.ts` |
| Có DOM? | Co (window, document) | Không |
| Có JSX? | Co (React component) | Không |
| Module type | ESNext | ESNext |

### tsconfig.json (file gốc)

```jsonc
{
  "files": [],                              // Không compile gì trực tiếp
  "references": [                           // Trỏ đến 2 file con
    { "path": "./tsconfig.app.json" },      // Config cho src/
    { "path": "./tsconfig.node.json" }      // Config cho vite.config.ts
  ]
}
```

### tsconfig.app.json (cho source code)

```jsonc
{
  "compilerOptions": {
    // ═══════════ OUTPUT ═══════════
    "target": "es2023",       // Compile ra JavaScript phiên bản 2023
                              // (trình duyệt hiện đại đều hỗ trợ)
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
                              // Thư viện type sẵn có:
                              // ES2023 = Array, Map, Promise, ...
                              // DOM = document, window, HTMLElement, ...
                              // DOM.Iterable = NodeList.forEach, ...
    "module": "esnext",       // Dùng import/export (không phải require)
    "noEmit": true,           // KHÔNG xuất file JS (Vite lo phần đó)
                              // TypeScript CHỈ kiểm tra lỗi, không compile

    // ═══════════ JSX ═══════════
    "jsx": "react-jsx",       // Transform mới: không cần "import React from 'react'"
                              // Tự thêm import khi gặp JSX

    // ═══════════ MODULE ═══════════
    "moduleResolution": "bundler",  // Cách tìm module: để Vite xử lý
    "allowImportingTsExtensions": true,  // Cho import file.ts (không cần bỏ extension)
    "verbatimModuleSyntax": true,   // Giữ nguyên import/export syntax
    "skipLibCheck": true,           // Bỏ qua kiểm tra type trong node_modules (nhanh hơn)

    // ═══════════ PATH ALIAS ═══════════
    "paths": {
      "@/*": ["./src/*"]      // @/components/Button → ./src/components/Button
                              // PHẢI khớp với alias trong vite.config.ts
    },

    // ═══════════ KIỂM TRA CHẶT ═══════════
    "noUnusedLocals": true,           // Lỗi nếu khai báo biến mà không dùng
    "noUnusedParameters": true,       // Lỗi nếu tham số hàm không dùng
    "noFallthroughCasesInSwitch": true, // Lỗi nếu switch case thiếu break
    "erasableSyntaxOnly": true        // Chỉ cho phép syntax mà có thể "xóa" khi compile
  },
  "include": ["src"]         // CHỈ kiểm tra file trong thư mục src/
}
```

### Khi nào sửa?
- Thêm path alias mới (nhớ sửa cả `vite.config.ts`)
- Tắt/bật strict check
- Thêm type cho thư viện (`"types": [...]`)
- Thường **KHÔNG cần sửa** — config mặc định đã tốt

---

## 7. eslint.config.js — Linter (kiểm tra lỗi code)

### ESLint là gì?

**Ví dụ đời thường:** ESLint = "giáo viên chấm bài". Đọc code của bạn → chỉ ra lỗi logic, bug tiềm ẩn, style không nhất quán.

```ts
// ESLint cảnh báo:
const x = 5       // ⚠️ 'x' is assigned but never used
if (x = 5) {}     // ❌ Unexpected assignment in if condition (== hay =?)
useEffect(() => {
  fetchData(id)    // ⚠️ React Hook useEffect has missing dependency: 'id'
}, [])
```

### So sánh BE

| FE (ESLint) | BE (Java compiler + IDE) |
|---|---|
| Kiểm tra logic + style | Java compiler đã kiểm tra cơ bản |
| Chạy riêng: `npm run lint` | IDE (IntelliJ) warning real-time |
| Cấu hình bằng file | IDE settings |

### Giải thích code

```js
import js from '@eslint/js'                    // Rule JS cơ bản (no-unused-vars, no-undef, ...)
import globals from 'globals'                  // Biến global (window, document, console, ...)
import reactHooks from 'eslint-plugin-react-hooks'  // Rule cho React Hooks
import reactRefresh from 'eslint-plugin-react-refresh'  // Rule cho Vite HMR
import tseslint from 'typescript-eslint'       // Rule cho TypeScript
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),     // BỎ QUA thư mục dist/ (output build, không cần lint)
  {
    files: ['**/*.{ts,tsx}'],  // CHỈ lint file TypeScript/TSX
    extends: [
      js.configs.recommended,           // Rule JS cơ bản
      tseslint.configs.recommended,     // Rule TypeScript
      reactHooks.configs.flat.recommended,  // Rule Hooks (dependency array, ...)
      reactRefresh.configs.vite,        // Rule Vite Fast Refresh
    ],
    languageOptions: {
      globals: globals.browser,  // Cho phép dùng window, document, fetch, ... không báo lỗi
    },
  },
])
```

### Khi nào sửa?
- Thêm rule mới (VD: cấm console.log trong production)
- Tắt rule phiền (VD: cho phép `any` type)
- Thêm thư mục ignore

---

## 8. .prettierrc — Formatter (format code đẹp)

### Prettier là gì?

**Ví dụ đời thường:** Prettier = "thợ dọn phòng". Không quan tâm code ĐÚNG hay SAI, chỉ làm cho code NHẤT QUÁN + DỄ ĐỌC.

```ts
// Trước Prettier (mỗi người viết 1 kiểu):
const x = "hello";
const y = 'world'
const arr = [1,2,3,]
const obj = {a:1,    b:2}

// Sau Prettier (ai cũng giống nhau):
const x = 'hello'
const y = 'world'
const arr = [1, 2, 3]
const obj = { a: 1, b: 2 }
```

### Giải thích config

```jsonc
{
  "semi": false,              // KHÔNG dùng dấu ; cuối dòng
                              // VD: const x = 5   (thay vì const x = 5;)
                              // Lý do: JavaScript tự thêm ; (ASI), viết không ; sạch hơn

  "singleQuote": true,        // Dùng nháy đơn 'hello' thay vì nháy kép "hello"
                              // Lý do: gõ ít hơn 1 phím (không cần Shift)

  "trailingComma": "all",     // Dấu , cuối cùng trong array/object
                              // VD: [1, 2, 3,]  ← có , sau 3
                              // Lý do: git diff sạch hơn khi thêm item mới

  "tabWidth": 2,              // 1 tab = 2 spaces (chuẩn FE, BE thường dùng 4)
  "printWidth": 80            // Tối đa 80 ký tự/dòng → xuống dòng nếu dài hơn
}
```

### ESLint vs Prettier — Khác gì?

| ESLint | Prettier |
|---|---|
| Kiểm tra **logic** (bug, unused var) | Chỉ format **style** (spacing, quotes) |
| Có thể TẮT rule | Không có rule — 1 cách duy nhất |
| Báo lỗi ❌ | Tự sửa code |
| Chạy: `npm run lint` | Chạy: tự động khi save (IDE) |

Kết hợp: `eslint-config-prettier` tắt ESLint rules về style → để Prettier lo.

---

## 9. .env.development — Biến môi trường

### Là gì?
File chứa các giá trị **thay đổi tùy môi trường** (dev/staging/production).

```bash
VITE_API_BASE_URL=http://localhost:8088
```

### Tại sao cần?

| Môi trường | API URL |
|---|---|
| Dev (laptop) | `http://localhost:8088` |
| Staging (test) | `https://api-staging.cinex.com` |
| Production (thật) | `https://api.cinex.com` |

Không hardcode URL trong code → đổi file `.env` là xong, không sửa code.

### Quy tắc Vite

| Quy tắc | Giải thích |
|---|---|
| Tiền tố `VITE_` bắt buộc | Biến KHÔNG có `VITE_` sẽ bị ẩn (bảo mật) |
| Truy cập trong code | `import.meta.env.VITE_API_BASE_URL` |
| File `.env.development` | Dùng khi `npm run dev` |
| File `.env.production` | Dùng khi `npm run build` |
| File `.env` | Dùng cho MỌI môi trường (fallback) |

### Cách dùng trong code

```ts
// src/api/axios.ts
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,  // → "http://localhost:8088"
})
```

### BẢO MẬT

```bash
# ❌ NGUY HIỂM — KHÔNG BAO GIỜ đặt secret ở FE:
VITE_SECRET_KEY=abc123        # User có thể đọc được trong browser DevTools!

# ✅ AN TOÀN — secret chỉ đặt ở BE:
# (file .env của BE, không phải FE)
JWT_SECRET=abc123             # Chỉ server biết
```

**Tại sao?** Mọi thứ có tiền tố `VITE_` sẽ được nhúng VÀO JavaScript → user mở DevTools → đọc được. Chỉ đặt thông tin CÔNG KHAI (URL, tên app, ...).

---

## 10. .gitignore — File Git bỏ qua

### Là gì?
Liệt kê file/thư mục mà Git **KHÔNG track** (không commit, không push).

### Giải thích

```bash
# Log files (sinh ra khi có lỗi, không cần lưu)
logs
*.log
npm-debug.log*

# Dependencies (200MB+, ai cần thì tự npm install)
node_modules

# Build output (sinh lại được bằng npm run build)
dist
dist-ssr

# File local (chỉ dùng trên máy bạn)
*.local

# IDE settings (mỗi người dùng IDE khác nhau)
.vscode/*
.idea
.DS_Store              # File ẩn macOS tự tạo
```

### Tại sao quan trọng?
Nếu KHÔNG có `.gitignore`:
- Push `node_modules/` lên Git → repo nặng 200MB+
- Push `.env` có secret → lộ mật khẩu
- Push `dist/` → conflict liên tục (mỗi lần build lại khác)

---

## 11. nginx.conf — Web Server (chỉ dùng Docker production)

### Là gì?
Khi deploy production, không dùng Vite dev server nữa. Dùng **Nginx** — web server chuyên nghiệp, serve file tĩnh (HTML/JS/CSS).

### Khi nào dùng?
- `npm run dev` → Vite dev server (chỉ local)
- Docker production → Nginx serve `dist/` (đã build)

### Bạn KHÔNG cần quan tâm file này cho đến khi deploy.

---

## 12. Luồng hoạt động tổng thể

```
BẠN VIẾT CODE (TypeScript + JSX + Tailwind)
        │
        ▼
┌─── npm run dev ───┐
│                   │
│  Vite Dev Server  │
│  ├── TypeScript → JavaScript (tsc kiểm tra, Vite compile)
│  ├── JSX → React.createElement() (plugin react)
│  ├── Tailwind class → CSS (plugin tailwindcss)
│  ├── import từ node_modules/ → bundle
│  └── Serve tại http://localhost:5173
│                   │
└───────────────────┘
        │
        ▼
TRÌNH DUYỆT NHẬN:
├── index.html (1 file)
├── main.js (code app, đã compile)
└── style.css (Tailwind compiled)
        │
        ▼
REACT RENDER:
├── main.tsx → createRoot → <App />
├── App.tsx → QueryClientProvider + Router + Toaster
├── Router → match URL → render đúng page
└── Page → gọi API (axios) → hiện data
```

---

## 13. So sánh toàn bộ với Backend

| Khái niệm | Backend (Java/Gradle) | Frontend (TS/npm) |
|---|---|---|
| File khai báo dependency | `build.gradle` | `package.json` |
| Lock file | (Gradle BOM) | `package-lock.json` |
| Thư mục thư viện | `.gradle/caches/` | `node_modules/` |
| Cài thư viện | `./gradlew build` | `npm install` |
| Chạy dev | `./gradlew bootRun` | `npm run dev` |
| Build production | `./gradlew build` → JAR | `npm run build` → dist/ |
| Kiểm tra lỗi | Java compiler | TypeScript + ESLint |
| Format code | IntelliJ settings | Prettier |
| Biến môi trường | `application-dev.yml` | `.env.development` |
| File ignore | `.gitignore` | `.gitignore` |
| Entry point | `CineXApplication.java` | `main.tsx` |
| Config | `application.yml` | `vite.config.ts` |

---

## 14. Câu hỏi thường gặp

### "npm install" vs "npm ci" khác gì?

| `npm install` | `npm ci` |
|---|---|
| Đọc `package.json` | Đọc `package-lock.json` |
| Có thể update version nhỏ | Cài CHÍNH XÁC version trong lock |
| Dùng khi phát triển | Dùng trong CI/CD, Docker |
| Sửa lock file nếu cần | KHÔNG sửa lock file |

### Xóa node_modules có sao không?
**Không sao.** `npm install` tải lại đầy đủ. Làm khi:
- Lỗi lạ không giải thích được
- Update thư viện bị conflict
- Ổ cứng đầy, muốn dọn

### Tại sao mỗi lần npm install lại thay đổi package-lock.json?
Vì npm kiểm tra version mới nhất phù hợp với `^`. Nếu có patch mới → update lock file. Commit thay đổi này bình thường.

### dependencies vs devDependencies quan trọng không?
**Quan trọng khi build production:**
- `devDependencies` KHÔNG được đóng gói vào bundle cuối cùng
- User KHÔNG download ESLint, TypeScript, Prettier
- Chỉ download code từ `dependencies` (React, Axios, ...)

→ Bundle nhỏ hơn = web nhanh hơn.
