# Testing Frontend — Vitest + React Testing Library + MSW

> Hướng dẫn viết test cho React app CineX: unit test component, hook, integration test API.

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
