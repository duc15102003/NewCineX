# Testing Frontend — Vitest + React Testing Library + MSW

> Hướng dẫn viết test cho React app CineX: unit test component, hook, integration test API.

---

## 🎯 PHẦN 0 — TẠI SAO cần test (đọc trước khi học cách viết)

### 0.1 Vấn đề: Code chạy ok, deploy xong bug — Tại sao?

**Câu chuyện đời thường:**

Bạn vừa làm xong feature "đặt vé". Test thủ công trên Chrome 5 lần, OK. Deploy production. Hôm sau:
- User báo: "Click đặt vé không có gì xảy ra" (Safari iOS — bạn không test)
- User báo: "Đặt 2 vé xong total ra 0đ" (voucher edge case — bạn quên test)
- User báo: "Refresh trang xong mất tất cả" (state không persist — bạn không nghĩ tới)

**Test thủ công có 4 vấn đề:**
1. **Không scale:** 100 feature × 10 case = 1000 test mỗi lần deploy → không khả thi
2. **Quên:** Sửa bug A xong, code khác break (regression) → bạn không tìm lại
3. **Chậm:** Mỗi lần test = mở browser, login, click, type → 5 phút/case
4. **Không cover edge case:** Bạn chỉ nghĩ ra happy path

**Automated test giải quyết:**
- Chạy 1000 test trong 30 giây
- Mỗi lần code thay đổi, CI tự chạy → bug phát hiện ngay
- Code thành "tài liệu sống": đọc test = hiểu component làm gì
- Refactor tự tin: test cover → refactor không sợ phá

### 0.2 Test Pyramid — 3 cấp test, dùng cấp nào?

```
            ┌──────────────┐
            │     E2E      │  ← 10% test, dùng Playwright/Cypress
            │  (chậm, đắt) │     Test flow user end-to-end
            ├──────────────┤
            │ Integration  │  ← 30% test, dùng RTL + MSW
            │  (vừa)       │     Test nhiều component + API mock
            ├──────────────┤
            │     Unit     │  ← 60% test, dùng Vitest
            │  (nhanh, rẻ) │     Test function/hook/component đơn lẻ
            └──────────────┘
```

| Cấp | Phù hợp | Tốc độ | Ví dụ CineX |
|---|---|---|---|
| **Unit** | Logic thuần (format price, calculate total) | <50ms/test | `formatPrice(100000)` → `"100.000đ"` |
| **Integration** | Component + API + Router | 200-500ms/test | LoginForm submit → API mock → redirect |
| **E2E** | Flow user thực sự | 5-30s/test | User mở web → đặt vé → thanh toán → check QR |

**Quy tắc:** 60% unit + 30% integration + 10% E2E. **KHÔNG ngược lại** (toàn E2E thì slow, flaky, deploy chậm).

### 0.3 Triết lý "Test as user, not as developer"

React Testing Library xây dựng theo triết lý này: **Test giống cách user dùng app, không phải cách code chạy bên trong.**

**❌ Test implementation detail (XẤU):**
```ts
// Test class CSS - dễ break khi refactor styling
expect(container.querySelector('.btn-primary')).toBeInTheDocument();

// Test internal state - dễ break khi refactor component
expect(wrapper.state('isLoading')).toBe(true);
```

**✅ Test behavior (TỐT):**
```ts
// Test cái user thấy
expect(screen.getByRole('button', { name: /đăng nhập/i })).toBeInTheDocument();

// Test cái user trải nghiệm
expect(screen.getByText(/đang xử lý/i)).toBeInTheDocument();
```

→ Refactor CSS/internal state → test vẫn pass. Refactor làm hỏng UX → test fail (đúng ý nghĩa).

### 0.4 AAA Pattern — Cấu trúc 1 test

Mỗi test viết theo 3 phần **Arrange → Act → Assert**:

```ts
it('should show error when password is empty', async () => {
  // ARRANGE — chuẩn bị
  const onSubmit = vi.fn();
  render(<LoginForm onSubmit={onSubmit} />);

  // ACT — thực hiện hành động
  await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com');
  await userEvent.click(screen.getByRole('button', { name: /đăng nhập/i }));

  // ASSERT — kiểm tra kết quả
  expect(screen.getByText(/password không được trống/i)).toBeInTheDocument();
  expect(onSubmit).not.toHaveBeenCalled();
});
```

**Đừng trộn lẫn:**
- Không assert giữa chừng (chỉ ở Act)
- Không thực hiện action ở Assert

### 0.5 Hello World test — Bắt đầu trong 5 phút

Nếu bạn chưa viết test nào bao giờ, đây là test đầu tiên của bạn.

**Step 1:** Setup theo Section 1 bên dưới (cài deps + config vite).

**Step 2:** Tạo file `src/utils/labels.ts`:
```ts
export function formatPrice(amount: number): string {
  return amount.toLocaleString('vi-VN') + 'đ';
}
```

**Step 3:** Tạo file `src/utils/labels.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { formatPrice } from './labels';

describe('formatPrice', () => {
  it('formats positive amount', () => {
    expect(formatPrice(100000)).toBe('100.000đ');
  });

  it('formats zero', () => {
    expect(formatPrice(0)).toBe('0đ');
  });
});
```

**Step 4:** Chạy:
```bash
npm test
```

Terminal sẽ in:
```
✓ src/utils/labels.test.ts (2)
  ✓ formatPrice
    ✓ formats positive amount
    ✓ formats zero

Test Files  1 passed (1)
Tests       2 passed (2)
```

🎉 Chúc mừng! Bạn vừa viết test đầu tiên. Đọc tiếp các phần dưới để học test phức tạp hơn.

### 0.6 Mindset: TDD vs Test-After

**TDD (Test-Driven Development):**
1. Viết test FAIL trước
2. Code minimum để test PASS
3. Refactor
4. Lặp

**Test-After:**
1. Code feature xong
2. Viết test cover code đó

**CineX khuyến nghị:** Test-After cho component UI (khó TDD), TDD cho utility function (formatPrice, calculateBookingTotal).

**Lý do TDD khó cho UI:** UI thay đổi nhiều, viết test trước rồi sửa lại nhiều lần tốn công. Utility function spec rõ → TDD nhanh.

📚 **Đọc thêm:** [glossary.md#m](../glossary.md#m) (Memoization — test khi performance critical), [common-mistakes.md](../common-mistakes.md) (lỗi #19 `invalidateQueries` test được).

---

## 1. Setup

### Dependencies
```bash
npm install -D vitest @vitest/ui jsdom
npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event
npm install -D msw @mswjs/data
```

### vite.config.ts
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
```

### Setup file
```ts
// src/test/setup.ts
import "@testing-library/jest-dom";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => cleanup());
```

### Scripts
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

## 2. Vitest căn bản

### Test file naming
`MovieCard.test.tsx` hoặc `MovieCard.spec.tsx` cạnh `MovieCard.tsx`.

### Cấu trúc
```ts
import { describe, it, expect, beforeEach } from "vitest";

describe("formatPrice", () => {
  beforeEach(() => {
    // setup
  });

  it("should format VND correctly", () => {
    expect(formatPrice(100000)).toBe("100.000đ");
  });

  it("should handle 0", () => {
    expect(formatPrice(0)).toBe("0đ");
  });
});
```

### Assertions
```ts
expect(value).toBe(other);
expect(value).toEqual({ a: 1 });        // deep equal
expect(arr).toContain(item);
expect(arr).toHaveLength(3);
expect(fn).toHaveBeenCalled();
expect(fn).toHaveBeenCalledWith(1, "x");
expect(fn).toHaveBeenCalledTimes(2);
expect(async () => await fn()).rejects.toThrow();
```

## 3. React Testing Library — Component test

### Triết lý
"Test như user dùng" — query bằng text/role/label, không phải class/id internal.

### Component đơn giản
```tsx
// Button.tsx
export function Button({ onClick, children }: Props) {
  return <button onClick={onClick}>{children}</button>;
}

// Button.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);

    await userEvent.click(screen.getByRole("button"));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
```

### Queries (best → worst)
1. `getByRole` — accessible role (button, link, heading...)
2. `getByLabelText` — form input qua label
3. `getByPlaceholderText`
4. `getByText` — text visible
5. `getByDisplayValue` — input value
6. `getByAltText` — image alt
7. `getByTitle`
8. `getByTestId` — `data-testid` (cuối cùng, khi không có cách khác)

Variants:
- `getBy*` — throw nếu không tìm thấy
- `queryBy*` — return null nếu không có (dùng cho assert NOT exist)
- `findBy*` — async, đợi element xuất hiện (cho code async)
- `getAllBy*` — array

### Test form
```tsx
// LoginForm.tsx
function LoginForm({ onSubmit }) {
  return (
    <form onSubmit={...}>
      <label>
        Email
        <input type="email" name="email" />
      </label>
      <label>
        Password
        <input type="password" name="password" />
      </label>
      <button type="submit">Login</button>
    </form>
  );
}

// LoginForm.test.tsx
it("submits form with credentials", async () => {
  const onSubmit = vi.fn();
  render(<LoginForm onSubmit={onSubmit} />);

  await userEvent.type(screen.getByLabelText(/email/i), "vanan@example.com");
  await userEvent.type(screen.getByLabelText(/password/i), "secret123");
  await userEvent.click(screen.getByRole("button", { name: /login/i }));

  expect(onSubmit).toHaveBeenCalledWith({
    email: "vanan@example.com",
    password: "secret123",
  });
});
```

### Test async state
```tsx
it("shows loading then content", async () => {
  render(<MovieList />);

  // Initial loading
  expect(screen.getByText(/đang tải/i)).toBeInTheDocument();

  // Wait for data
  expect(await screen.findByText("Avengers")).toBeInTheDocument();
  expect(screen.queryByText(/đang tải/i)).not.toBeInTheDocument();
});
```

## 4. Test Hook

### renderHook
```ts
import { renderHook, act } from "@testing-library/react";

it("useCounter increments", () => {
  const { result } = renderHook(() => useCounter(0));

  expect(result.current.count).toBe(0);

  act(() => result.current.increment());

  expect(result.current.count).toBe(1);
});
```

### Hook dùng React Query
```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const createWrapper = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

it("useMovies returns data", async () => {
  const { result } = renderHook(() => useMovies(), { wrapper: createWrapper() });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(result.current.data).toHaveLength(10);
});
```

## 5. MSW — Mock API

### Vấn đề
Test component gọi API → cần mock response. Mock `fetch`/`axios` trực tiếp tốn code lặp.

### MSW (Mock Service Worker)
Intercept request ở network layer → component dùng API thật, MSW trả response giả.

### Setup handlers
```ts
// src/test/mocks/handlers.ts
import { http, HttpResponse } from "msw";

export const handlers = [
  http.get("/api/movies", () => {
    return HttpResponse.json({
      success: true,
      data: {
        content: [
          { id: 1, title: "Avengers", posterUrl: "..." },
          { id: 2, title: "Joker", posterUrl: "..." },
        ],
        totalPages: 1,
      },
    });
  }),

  http.post("/api/bookings", async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(
      { success: true, data: { id: 1, status: "HOLDING", ...body } },
      { status: 201 }
    );
  }),

  http.get("/api/movies/:id", ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: { id: Number(params.id), title: `Movie ${params.id}` },
    });
  }),
];
```

### Setup server
```ts
// src/test/mocks/server.ts
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
```

### Wire vào test setup
```ts
// src/test/setup.ts
import { server } from "./mocks/server";
import { beforeAll, afterEach, afterAll } from "vitest";

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Override per-test
```ts
it("handles 500 error", async () => {
  server.use(
    http.get("/api/movies", () => HttpResponse.json({ message: "Server error" }, { status: 500 }))
  );

  render(<MovieList />, { wrapper: createWrapper() });

  expect(await screen.findByText(/có lỗi xảy ra/i)).toBeInTheDocument();
});
```

## 6. Test Component dùng React Router

```tsx
import { MemoryRouter, Routes, Route } from "react-router-dom";

const renderWithRouter = (initialPath: string) => {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/movies/:id" element={<MovieDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
};

it("renders movie detail", async () => {
  renderWithRouter("/movies/1");
  expect(await screen.findByText("Movie 1")).toBeInTheDocument();
});
```

## 7. Test Zustand Store

```ts
import { useAuthStore } from "@/store/authStore";

describe("authStore", () => {
  beforeEach(() => {
    useAuthStore.setState({ token: null, user: null });
  });

  it("login sets token and user", () => {
    useAuthStore.getState().login("token123", { id: 1, username: "vanan" });

    expect(useAuthStore.getState().token).toBe("token123");
    expect(useAuthStore.getState().user?.username).toBe("vanan");
  });

  it("logout clears state", () => {
    useAuthStore.setState({ token: "x", user: { id: 1 } });
    useAuthStore.getState().logout();

    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
```

## 8. Snapshot testing (dùng vừa phải)

```ts
it("renders correctly", () => {
  const { container } = render(<MovieCard movie={mockMovie} />);
  expect(container).toMatchSnapshot();
});
```

Lần đầu chạy: tạo file `.snap`. Lần sau: so sánh. Đổi UI → cập nhật snapshot bằng `vitest -u`.

**Cảnh báo**: snapshot dễ "chai cứng" — đổi text nhỏ là fail. Dùng ít, ưu tiên assertion cụ thể.

## 9. Coverage

```json
{
  "scripts": {
    "test:coverage": "vitest run --coverage"
  }
}
```

vite.config.ts:
```ts
test: {
  coverage: {
    provider: "v8",
    reporter: ["text", "html", "lcov"],
    include: ["src/**/*.{ts,tsx}"],
    exclude: [
      "src/**/*.test.{ts,tsx}",
      "src/**/*.d.ts",
      "src/main.tsx",
    ],
  },
},
```

Target hợp lý:
- Utility/Hook: 80-90%
- Component: 60-70%
- Page integration: 40-50% (E2E quan trọng hơn)

## 10. E2E với Playwright (bonus)

### Setup
```bash
npm install -D @playwright/test
npx playwright install
```

### Test mẫu
```ts
// e2e/login.spec.ts
import { test, expect } from "@playwright/test";

test("user can login and see movies", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /đăng nhập/i }).click();

  await page.getByLabel(/email/i).fill("vanan@example.com");
  await page.getByLabel(/mật khẩu/i).fill("password123");
  await page.getByRole("button", { name: /đăng nhập/i }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByText(/xin chào/i)).toBeVisible();
});
```

E2E chạy chậm (~10s/test) → ít test thôi, chỉ flow critical.

## 11. Best practices

### Test what matters
- Logic phức tạp (price calc, validation, state machine)
- User interaction (click, type, submit)
- Async data flow (loading, success, error)
- Edge cases (empty, error, slow network)

### Avoid
- Test implementation detail (`expect(component.state.x).toBe(...)`)
- Test 3rd-party library (đã có test riêng)
- Snapshot mọi nơi (chai cứng)

### Naming
```ts
// SAI
it("test 1", ...);

// ĐÚNG — mô tả behavior
it("should show error when password is empty", ...);
it("should disable submit while loading", ...);
```

### Setup factories
```ts
// src/test/factories.ts
export const mockMovie = (override = {}) => ({
  id: 1,
  title: "Avengers",
  posterUrl: "https://...",
  duration: 180,
  ...override,
});

// Use:
const movie = mockMovie({ title: "Joker" });
```

## 12. Câu hỏi tự kiểm tra

**Câu 1**: Tại sao prefer `getByRole` thay vì `getByTestId`?

→ `getByRole` test như screen reader user — tự nhiên, accessibility tốt. `getByTestId` = implementation detail, dễ break khi refactor.

**Câu 2**: MSW khác `vi.mock("axios")` thế nào?

→ MSW intercept ở network layer → component dùng axios bình thường, không cần biết bị mock. Mock axios tay → phải mock từng method, không realistic. MSW dùng được cho cả test + dev (mock BE chưa có).

**Câu 3**: Test async data → dùng `getByText` hay `findByText`?

→ `findByText` cho async (đợi element xuất hiện). `getByText` throw ngay nếu chưa có → fail.

**Câu 4**: Snapshot test khi nào nên dùng?

→ Component output ổn định, ít thay đổi (icon library, format constant). Tránh cho component thường refactor.

**Câu 5**: Coverage 100% có ý nghĩa gì?

→ Mọi dòng code chạy qua test ÍT NHẤT 1 LẦN. KHÔNG đảm bảo:
- Assertion đúng
- Edge case cover
- UX hoạt động đúng

→ Quality test quan trọng hơn quantity.

**Câu 6 (mới)**: Test Pyramid 60/30/10 — nếu bạn đảo ngược (10 unit / 30 integration / 60 E2E) thì hậu quả?

→ E2E chạy 5-30s/test. 100 E2E test = 50 phút chạy CI. Developer chờ feedback lâu → bypass test. E2E flaky (network, timing) → false positive nhiều. Test pyramid đảo ngược = **Ice Cream Cone Anti-pattern**, làm CI chậm & dev mất niềm tin.

**Câu 7 (mới)**: AAA pattern — nếu bạn assert giữa Act (vd assert sau mỗi click) thì hậu quả?

→ Test trở nên dài, khó đọc, mỗi test cover nhiều thứ cùng lúc → khi fail không biết bước nào sai. Đúng: 1 test = 1 behavior = 1 Assert block. Cần test nhiều bước → tách thành nhiều `it()`.

**Câu 8 (mới)**: Tại sao test hook React Query phải có `QueryClientProvider` wrapper?

→ `useQuery` cần đọc QueryClient từ context. Không có Provider → throw "No QueryClient set". Phải tạo `wrapper` với `QueryClientProvider` mỗi test, hoặc factory helper `createWrapper()` reuse.

**Câu 9 (mới)**: MSW có 2 mode: `setupServer` (Node, dùng cho test) và `setupWorker` (browser, dùng cho dev mock). Khi nào dùng cái nào?

→ Test (Vitest/Jest) chạy ở Node → `setupServer`. Dev local muốn mock BE chưa có → import MSW vào `main.tsx` chạy `setupWorker` → mock ở Service Worker layer. Cùng handler dùng được cả 2 nơi → DRY.

**Câu 10 (mới)**: Bạn viết test pass local nhưng fail CI. 3 nguyên nhân thường gặp?

→ (1) Time zone khác (CI UTC, local Asia/Saigon → date format khác). (2) Random seed khác (`Math.random()` → flaky). (3) Race condition giữa `act` và async update → dùng `await waitFor()`. Fix: mock `Date.now()`, seed random, dùng `findBy*` thay `getBy*` cho async.

---

## 13. Bài tập thực hành

### Bài 1: Test utility function (LEVEL 1 — 30 phút)

Viết test cho file `src/utils/labels.ts` cover các function:
- `formatPrice(100000)` → `'100.000đ'`
- `formatPrice(0)` → `'0đ'`
- `formatPrice(-50000)` → `'-50.000đ'` (edge case âm)
- `fmtDate('2026-05-20')` → `'20/05/2026'`
- `fmtDateTime('2026-05-20T23:47:00')` → `'23:47 20/05/2026'`

Yêu cầu: 100% line coverage cho file này.

### Bài 2: Test MovieCard component (LEVEL 2 — 60 phút)

Component `MovieCard` nhận props:
```tsx
type Props = {
  movie: { id: number; title: string; posterUrl: string; rating: number };
  onClick?: () => void;
};
```

Viết test:
1. Render title đúng
2. Hiển thị poster (img src đúng)
3. Hiển thị rating với 1 chữ số thập phân (`8.5`)
4. Click card → gọi `onClick` 1 lần
5. Không có `onClick` → click không crash

### Bài 3: Integration test LoginPage (LEVEL 3 — 120 phút)

Test full flow:
1. Form render với 2 input + 1 button
2. Submit form trống → hiện 2 error message
3. Submit email invalid → hiện error "email không hợp lệ"
4. Submit form valid + MSW mock API thành công → redirect `/dashboard`
5. Submit form valid + MSW mock API 401 → hiện toast "Sai email hoặc mật khẩu"

Yêu cầu: dùng MSW mock API, dùng `MemoryRouter` cho navigation, dùng `userEvent.type/click` (không dùng `fireEvent`).

### Bài 4: Test useBookingHold hook (LEVEL 4 — 90 phút)

Hook `useBookingHold` wrap mutation TanStack Query. Viết test:
1. Initial state: `isPending = false`, `data = null`
2. Call `mutate({ showtimeId: 1, seatIds: [10] })` → MSW mock trả booking
3. After success: `isSuccess = true`, `data.bookingId = 1`
4. Trigger error 409 (ghế đã đặt): `isError = true`, `error.message` đúng
5. `queryClient.invalidateQueries(['seats', 1])` được gọi sau success

### Bài 5: E2E booking flow (LEVEL 5 — 180 phút, BONUS)

Dùng Playwright:
1. Mở `localhost:5173`
2. Click "Đăng nhập" → fill `test@cinex.vn / password123` → submit
3. Verify redirect `/`
4. Click 1 movie → click 1 suất chiếu
5. Click ghế E1, E2 → click "Tiếp tục"
6. Verify trang payment hiện 2 ghế + total amount đúng
7. Screenshot kết quả

Yêu cầu: setup `playwright.config.ts` với baseURL `http://localhost:5173`, chạy test ở Chromium + Firefox + WebKit.

---

## 14. Liên kết tới khái niệm khác

- **AAA pattern + Why test:** Phần 0 ở trên
- **MSW vs vi.mock:** [glossary.md#m](../glossary.md#m) (cách phân biệt)
- **Coverage trap:** [common-mistakes.md](../common-mistakes.md) (coverage 100% không = bug-free)
- **Test pyramid scaling:** [frontend/16-performance-optimization.md](16-performance-optimization.md) (test performance)
- **CI integration:** [backend/13-deployment.md](../backend/13-deployment.md) (CI/CD pipeline)
- **MSW handlers reuse cho dev:** [frontend/07-axios-api.md](07-axios-api.md) (Axios + MSW dev mode)
