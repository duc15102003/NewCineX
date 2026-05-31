# TypeScript Utility Types — Dạy từ đầu

> Các utility types built-in của TypeScript dùng khắp nơi trong React/CineX. Đọc xong file này, bạn sẽ tự tin với `Partial`, `Pick`, `Omit`, `Record`, `ReturnType`, ... và biết khi nào dùng cái nào.

## Mục lục

### Cơ bản (cốt lõi — dùng hàng ngày)
1. [Partial<T>](#1-partialt)
2. [Required<T>](#2-requiredt)
3. [Readonly<T>](#3-readonlyt)
4. [Pick<T, K>](#4-pickt-k)
5. [Omit<T, K>](#5-omitt-k)
6. [Record<K, V>](#6-recordk-v)

### Union/Intersection helpers
7. [Exclude<T, U>](#7-excludet-u)
8. [Extract<T, U>](#8-extractt-u)
9. [NonNullable<T>](#9-nonnullablet)

### Function helpers
10. [ReturnType<F>](#10-returntypef)
11. [Parameters<F>](#11-parametersf)
12. [Awaited<T>](#12-awaitedt)

### Type Narrowing (đi đôi với utility)
13. [typeof guard](#13-typeof-guard)
14. [instanceof guard](#14-instanceof-guard)
15. [in operator](#15-in-operator)
16. [Type predicate `is`](#16-type-predicate-is)
17. [Discriminated Union](#17-discriminated-union)

### Helpers nâng cao
18. [keyof T](#18-keyof-t)
19. [typeof variable](#19-typeof-variable)
20. [as const](#20-as-const)
21. [Template literal types](#21-template-literal-types)
22. [Conditional types + infer](#22-conditional-types--infer)
23. [Mapped types](#23-mapped-types)

### Tích hợp Zod
24. [z.infer<typeof schema>](#24-zinfertypeof-schema)

### Patterns thực tế CineX
25. [Patterns thực tế CineX](#25-patterns-thực-tế-cinex)

---

## 1. Partial<T>

### Là gì
Biến tất cả field của `T` thành **optional** (có thể vắng mặt).

### Ví dụ đời thường
Đơn đăng ký nhập học gốc bắt buộc điền 10 thông tin. Đơn "cập nhật thông tin" thì điền field nào cũng được, không bắt buộc cả 10 → đó là `Partial<DonDangKy>`.

### Cú pháp + Code mẫu
```typescript
interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
}

type UserUpdate = Partial<User>;
// = { id?: number; username?: string; email?: string; fullName?: string }

// Hợp lệ — chỉ gửi field cần đổi:
const update: UserUpdate = { email: "new@example.com" };
```

### Tại sao cần
Form "Cập nhật" thường cho phép user gửi 1 phần data. Tạo type tay sẽ duplicate `User` interface → vi phạm DRY. `Partial<User>` tự sinh.

### Ví dụ thực tế CineX
```typescript
// hooks/useAdminUsers.ts
export const useUpdateUser = () => {
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<User> }) =>
      api.patch(`/api/admin/users/${id}`, data),
  });
};

// Dùng:
updateUser.mutate({ id: 1, data: { email: "new@example.com" } });  // OK
updateUser.mutate({ id: 1, data: { fullName: "Vũ Tuấn An" } });   // OK
```

### Khi nào KHÔNG dùng
Form "Tạo mới" — bạn cần đảm bảo tất cả field bắt buộc có. Đừng dùng Partial cho create.

---

## 2. Required<T>

### Là gì
Ngược với Partial — biến tất cả optional field thành bắt buộc.

### Cú pháp
```typescript
interface PartialUser {
  id?: number;
  username?: string;
}

type FullUser = Required<PartialUser>;
// = { id: number; username: string }
```

### Khi nào dùng
Bạn nhận DTO từ API có field optional, nhưng ở 1 nhánh code bạn đã verify đầy đủ → ép thành Required để TS hiểu.

```typescript
function processUser(user: Required<PartialUser>) {
  user.username.toUpperCase();  // OK, không cần ?
}
```

---

## 3. Readonly<T>

### Là gì
Biến field thành immutable — không assign lại được.

### Cú pháp
```typescript
type FrozenUser = Readonly<User>;
const u: FrozenUser = { id: 1, username: "a", email: "", fullName: "" };
u.username = "b";  // ❌ Cannot assign to 'username' because it is a read-only property
```

### Ví dụ thực tế
Props component nên immutable:
```typescript
interface ButtonProps {
  label: string;
  onClick: () => void;
}

function Button(props: Readonly<ButtonProps>) {
  props.label = "X";  // ❌ TS chặn
}
```

React giả định props immutable, `Readonly` giúp TS enforce.

---

## 4. Pick<T, K>

### Là gì
Chọn 1 SUBSET field từ `T`.

### Ví dụ đời thường
Hồ sơ user có 20 trường. Trang danh sách chỉ cần `id`, `name`, `avatar` → `Pick<User, "id" | "name" | "avatar">`.

### Cú pháp
```typescript
interface Movie {
  id: number;
  title: string;
  posterUrl: string;
  description: string;
  duration: number;
  releaseDate: string;
  genres: Genre[];
}

type MovieListItem = Pick<Movie, "id" | "title" | "posterUrl">;
// = { id: number; title: string; posterUrl: string }
```

### Tại sao cần
- Response API list khác response detail → 2 type khác nhau.
- DTO chỉ trả field cần → giảm payload + bảo mật.

### Ví dụ thực tế CineX
```typescript
// types/movie.ts
export type MovieListItem = Pick<Movie, "id" | "title" | "posterUrl" | "averageRating">;
export type MovieDetail = Movie;  // full

// hooks/useMovies.ts
export const useMovies = () => useQuery<MovieListItem[]>({...});
export const useMovie = (id: number) => useQuery<MovieDetail>({...});
```

---

## 5. Omit<T, K>

### Là gì
Ngược Pick — bỏ 1 số field khỏi `T`.

### Ví dụ đời thường
Nhận hồ sơ ứng viên nhưng KHÔNG cho xem lương cũ → `Omit<HoSo, "luongCu">`.

### Cú pháp
```typescript
interface User {
  id: number;
  username: string;
  password: string;  // không bao giờ trả về client
  email: string;
}

type UserResponse = Omit<User, "password">;
// = { id: number; username: string; email: string }
```

### Ví dụ thực tế CineX
```typescript
// Khi tạo user, không có id (DB tự sinh)
type CreateUserRequest = Omit<User, "id" | "createdAt" | "updatedAt">;

// Khi update, không cho đổi username
type UpdateUserRequest = Partial<Omit<User, "id" | "username" | "createdAt">>;
```

### Pick vs Omit — khi nào dùng
- **Pick** khi danh sách field cần SHORT (chọn ít).
- **Omit** khi danh sách field cần dài, bạn chỉ muốn bỏ 1-2 cái.

```typescript
// User có 15 field. Cần 13 → dùng Omit
type UserSafe = Omit<User, "password" | "internalNote">;
```

---

## 6. Record<K, V>

### Là gì
Object với key thuộc `K`, value thuộc `V`.

### Ví dụ đời thường
Bảng tra cứu: mỗi từ → nghĩa. `Record<TuVung, NghiaTiengViet>`.

### Cú pháp
```typescript
type StatusLabel = Record<BookingStatus, string>;

const LABELS: StatusLabel = {
  HOLDING: "Đang giữ",
  CONFIRMED: "Đã xác nhận",
  CHECKED_IN: "Đã check-in",
  CANCELLED: "Đã hủy",
  EXPIRED: "Hết hạn",
};
```

### Tại sao cần
- TS bắt buộc bạn map đủ TẤT CẢ key của enum. Quên 1 case → compile error.
- Đảm bảo "exhaustive" — không miss case khi thêm status mới.

### Ví dụ thực tế CineX
```typescript
// utils/labels.ts
export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  HOLDING: "Đang giữ ghế",
  CONFIRMED: "Đã thanh toán",
  CHECKED_IN: "Đã check-in",
  CANCELLED: "Đã hủy",
  EXPIRED: "Hết hạn",
};

export const BOOKING_STATUS_COLORS: Record<BookingStatus, string> = {
  HOLDING: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  CONFIRMED: "bg-green-500/20 text-green-400 border-green-500/30",
  // ... bắt buộc đủ
};
```

Nếu thêm `BookingStatus.REFUNDED` vào enum → cả 2 object trên báo lỗi thiếu key → bạn thêm ngay, không quên.

### Record với key dynamic
```typescript
type ApiResponseMap = Record<string, ApiResponse>;
// = { [key: string]: ApiResponse }
```

Dùng cho dictionary có key tùy ý (như object normalize state).

---

## 7. Exclude<T, U>

### Là gì
Loại bỏ type khớp `U` khỏi union `T`.

### Cú pháp
```typescript
type Status = "active" | "inactive" | "pending" | "deleted";
type ActiveStatus = Exclude<Status, "deleted">;
// = "active" | "inactive" | "pending"
```

### Use case
```typescript
type Role = "admin" | "user" | "guest";
type AuthRole = Exclude<Role, "guest">;
// = "admin" | "user"

function checkAuth(role: AuthRole) { ... }  // guest không vào được
```

---

## 8. Extract<T, U>

### Là gì
Ngược Exclude — chỉ GIỮ type khớp `U`.

```typescript
type Status = "active" | "inactive" | "pending" | "deleted";
type FinalStatus = Extract<Status, "active" | "deleted">;
// = "active" | "deleted"
```

### Use case
```typescript
type Event = { type: "click"; x: number } | { type: "hover"; element: string } | { type: "scroll" };

type MouseEvent = Extract<Event, { type: "click" | "hover" }>;
```

---

## 9. NonNullable<T>

### Là gì
Loại bỏ `null` và `undefined` khỏi `T`.

```typescript
type MaybeString = string | null | undefined;
type SureString = NonNullable<MaybeString>;
// = string
```

### Use case
```typescript
function processName(name: string | undefined) {
  if (!name) return;
  // Trong nhánh này, name là string. Có thể explicit:
  const safeName: NonNullable<typeof name> = name;
}
```

---

## 10. ReturnType<F>

### Là gì
Lấy type return của function.

### Cú pháp
```typescript
function getUser(id: number) {
  return { id, username: "x", email: "y" };
}

type User = ReturnType<typeof getUser>;
// = { id: number; username: string; email: string }
```

### Tại sao cần
Khi function được type-inferred (không khai báo return type explicit), dùng `ReturnType` để lấy lại type → tránh duplicate.

### Ví dụ thực tế CineX
```typescript
// hooks/useAdminMovies.ts
export const useAdminMovies = () => {
  const list = useQuery({...});
  const create = useMutation({...});
  const update = useMutation({...});
  const remove = useMutation({...});

  return { list, create, update, remove };
};

// types tự sinh:
type AdminMoviesHook = ReturnType<typeof useAdminMovies>;
// = { list: UseQueryResult<...>; create: UseMutationResult<...>; ... }
```

Dùng để type prop khi truyền hook xuống child:
```typescript
function MovieDialog({ hook }: { hook: AdminMoviesHook }) { ... }
```

---

## 11. Parameters<F>

### Là gì
Lấy tuple type của parameters function.

```typescript
function createBooking(userId: number, showtimeId: number, seats: number[]) { ... }

type Params = Parameters<typeof createBooking>;
// = [userId: number, showtimeId: number, seats: number[]]
```

### Use case
```typescript
// Wrapper preserve signature
const loggedCreateBooking = (...args: Parameters<typeof createBooking>) => {
  console.log("calling createBooking", args);
  return createBooking(...args);
};
```

---

## 12. Awaited<T>

### Là gì
Unwrap `Promise<T>` → `T`.

```typescript
type P1 = Awaited<Promise<string>>;
// = string

type P2 = Awaited<Promise<Promise<number>>>;
// = number (unwrap đệ quy)
```

### Use case
```typescript
async function fetchUser(): Promise<User> { ... }

type UserData = Awaited<ReturnType<typeof fetchUser>>;
// = User
```

Combine với `ReturnType` để lấy type data từ async function.

---

## 13. typeof guard

### Là gì
Runtime check type bằng `typeof` operator → TS narrow type.

```typescript
function format(value: string | number) {
  if (typeof value === "string") {
    return value.toUpperCase();  // value: string
  }
  return value.toFixed(2);       // value: number
}
```

### Các typeof check
- `typeof x === "string"`
- `typeof x === "number"`
- `typeof x === "boolean"`
- `typeof x === "object"` (cẩn thận: array cũng là object)
- `typeof x === "function"`
- `typeof x === "undefined"`

---

## 14. instanceof guard

### Cú pháp
```typescript
function handle(err: unknown) {
  if (err instanceof AxiosError) {
    console.log(err.response?.status);  // err: AxiosError
  } else if (err instanceof Error) {
    console.log(err.message);            // err: Error
  } else {
    console.log("unknown error", err);   // err: unknown
  }
}
```

### Use case
Catch error trong axios interceptor.

---

## 15. in operator

### Cú pháp
```typescript
interface Movie { title: string; }
interface Showtime { startTime: Date; }

function describe(item: Movie | Showtime) {
  if ("startTime" in item) {
    item.startTime.toISOString();  // item: Showtime
  } else {
    item.title.toUpperCase();      // item: Movie
  }
}
```

Dùng khi 2 type có structure khác nhau, check field tồn tại.

---

## 16. Type predicate `is`

### Là gì
Function trả về `is T` để TS biết argument là T.

```typescript
interface Movie { title: string; genres: Genre[]; }
interface User { username: string; email: string; }

function isMovie(x: unknown): x is Movie {
  return (
    typeof x === "object" &&
    x !== null &&
    "title" in x &&
    "genres" in x
  );
}

function handle(item: Movie | User) {
  if (isMovie(item)) {
    item.title;     // item: Movie
  } else {
    item.username;  // item: User
  }
}
```

### Use case
Khi `in` không đủ rõ (nhiều field overlap), tự viết predicate.

---

## 17. Discriminated Union

### Là gì
Union với 1 field "kind" để TS narrow chính xác.

```typescript
type Result<T> =
  | { kind: "success"; data: T }
  | { kind: "error"; message: string };

function handle(r: Result<User>) {
  if (r.kind === "success") {
    r.data.username;   // OK — r: success branch
  } else {
    r.message;          // OK — r: error branch
  }
}
```

### Ví dụ thực tế CineX
```typescript
type AsyncState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: Error };

function MovieList() {
  const state: AsyncState<Movie[]> = useMovies();

  switch (state.status) {
    case "idle":     return <Empty />;
    case "loading":  return <Skeleton />;
    case "success":  return <List items={state.data} />;  // state: success branch
    case "error":    return <Error e={state.error} />;
  }
}
```

TS bắt bạn handle TẤT CẢ status — exhaustive check.

---

## 18. keyof T

### Là gì
Lấy union các key của `T`.

```typescript
interface User { id: number; username: string; email: string; }

type UserKeys = keyof User;
// = "id" | "username" | "email"
```

### Use case
Function chấp nhận tên field type-safe:
```typescript
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const u = { id: 1, username: "v" };
getProperty(u, "username");  // OK
getProperty(u, "fullName");  // ❌ Argument of type '"fullName"' is not assignable
```

---

## 19. typeof variable

### Là gì
Lấy TYPE từ VALUE.

```typescript
const config = {
  apiUrl: "http://localhost:8088",
  timeout: 10000,
  retries: 3,
};

type Config = typeof config;
// = { apiUrl: string; timeout: number; retries: number }
```

### Combine với keyof
```typescript
type ConfigKey = keyof typeof config;
// = "apiUrl" | "timeout" | "retries"
```

### Ví dụ CineX
```typescript
const MOVIE_STATUS = {
  COMING_SOON: "coming_soon",
  NOW_SHOWING: "now_showing",
  ENDED: "ended",
} as const;

type MovieStatusKey = keyof typeof MOVIE_STATUS;
// = "COMING_SOON" | "NOW_SHOWING" | "ENDED"

type MovieStatusValue = typeof MOVIE_STATUS[MovieStatusKey];
// = "coming_soon" | "now_showing" | "ended"
```

---

## 20. as const

### Là gì
Biến value thành **readonly literal** type.

### Cú pháp
```typescript
const status = "ACTIVE";
// type: string

const status2 = "ACTIVE" as const;
// type: "ACTIVE"  ← literal type

const arr = [1, 2, 3] as const;
// type: readonly [1, 2, 3]

const obj = { a: 1, b: "x" } as const;
// type: { readonly a: 1; readonly b: "x" }
```

### Use case
Tạo enum-like value với union literal type:
```typescript
const ROLES = ["admin", "user", "guest"] as const;
type Role = typeof ROLES[number];
// = "admin" | "user" | "guest"
```

---

## 21. Template literal types

### Là gì
Type-safe string với template.

```typescript
type Greeting = `Hello, ${string}`;
const g1: Greeting = "Hello, World";  // OK
const g2: Greeting = "Hi";             // ❌

type Route = `/api/${string}`;
const r1: Route = "/api/movies";  // OK

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";
type Endpoint = `${HttpMethod} ${Route}`;
// = "GET /api/${string}" | "POST /api/${string}" | ...

const e: Endpoint = "GET /api/movies";  // OK
const e2: Endpoint = "PATCH /api/users"; // ❌
```

### Use case
Type-safe event names:
```typescript
type EventName = `on${Capitalize<string>}`;
// "onClick", "onHover", etc.
```

---

## 22. Conditional types + infer

### Conditional type
```typescript
type IsString<T> = T extends string ? true : false;

type A = IsString<"hello">;  // true
type B = IsString<42>;       // false
```

### `infer` keyword
Trích xuất type bên trong:
```typescript
type ReturnType<F> = F extends (...args: any[]) => infer R ? R : never;

type FnReturn = ReturnType<() => string>;
// = string
```

### Ví dụ CineX
```typescript
// Lấy type từ Array
type ArrayElement<T> = T extends (infer E)[] ? E : never;

type MovieList = Movie[];
type MovieEl = ArrayElement<MovieList>;  // = Movie
```

---

## 23. Mapped types

### Cú pháp cơ bản
```typescript
type Optional<T> = { [K in keyof T]?: T[K] };
// Implement của Partial

type ReadonlyAll<T> = { readonly [K in keyof T]: T[K] };
// Implement của Readonly
```

### Mapped với rename (TS 4.1+)
```typescript
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

interface User { id: number; name: string; }

type UserGetters = Getters<User>;
// = { getId: () => number; getName: () => string }
```

### Use case
Tạo form errors type từ form data type:
```typescript
type FormErrors<T> = {
  [K in keyof T]?: string;
};

interface LoginForm { email: string; password: string; }
type LoginErrors = FormErrors<LoginForm>;
// = { email?: string; password?: string }
```

---

## 24. z.infer<typeof schema>

### Là gì
Lấy TS type tự động từ Zod schema → khỏi declare 2 lần.

### Cú pháp
```typescript
import { z } from "zod";

const userSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  age: z.number().int().positive(),
});

type User = z.infer<typeof userSchema>;
// = { username: string; email: string; age: number }
```

### Tại sao cần
Không có `z.infer`, bạn phải:
```typescript
// SAI — duplicate
type User = { username: string; email: string; age: number };
const userSchema = z.object({...});
```

Khi schema đổi (thêm field), bạn phải update cả `type` lẫn `schema` → dễ sync lệch.

### Ví dụ thực tế CineX
```typescript
// schemas/booking.ts
export const createBookingSchema = z.object({
  showtimeId: z.number().int().positive(),
  seatIds: z.array(z.number().int().positive()).min(1).max(8),
});

export type CreateBookingRequest = z.infer<typeof createBookingSchema>;

// Use:
const onSubmit = (data: CreateBookingRequest) => api.post(...);
```

Validate runtime + type compile-time từ 1 source.

---

## 25. Patterns thực tế CineX

### Pattern 1: API DTO 3-layer
```typescript
// Source of truth
interface User {
  id: number;
  username: string;
  email: string;
  password: string;  // never to client
  role: Role;
  createdAt: string;
  updatedAt: string;
}

// Response (bỏ password)
export type UserResponse = Omit<User, "password">;

// Create request (bỏ DB-generated fields)
export type CreateUserRequest = Omit<User, "id" | "createdAt" | "updatedAt" | "role">;

// Update request (partial)
export type UpdateUserRequest = Partial<
  Omit<User, "id" | "username" | "password" | "createdAt" | "updatedAt">
>;
```

### Pattern 2: List vs Detail
```typescript
export type MovieListItem = Pick<Movie,
  "id" | "title" | "posterUrl" | "averageRating" | "duration"
>;

export type MovieDetail = Movie;
```

### Pattern 3: Status label/color maps
```typescript
export const STATUS_LABELS: Record<BookingStatus, string> = { ... };
export const STATUS_COLORS: Record<BookingStatus, string> = { ... };
```

### Pattern 4: Hook return type inference
```typescript
export const useAdminMovies = () => { ... };
type Hook = ReturnType<typeof useAdminMovies>;

function MovieToolbar({ hook }: { hook: Hook }) { ... }
```

### Pattern 5: Async state discriminated union
```typescript
type AsyncState<T> =
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: string };
```

### Pattern 6: Zod schema → TS type
```typescript
const schema = z.object({...});
type Form = z.infer<typeof schema>;
```

### Pattern 7: Generic API response
```typescript
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// Use:
api.get<ApiResponse<MovieResponse[]>>("/api/movies");
```

---

## Bảng tổng hợp

| Utility | Dùng để | Ví dụ CineX |
|---|---|---|
| `Partial<T>` | Update DTO | `Partial<User>` cho PATCH |
| `Required<T>` | Force tất cả bắt buộc | Sau validate |
| `Readonly<T>` | Props immutable | Component props |
| `Pick<T, K>` | Subset field | `MovieListItem` |
| `Omit<T, K>` | Bỏ field | `Omit<User, "password">` |
| `Record<K, V>` | Dictionary | Status label map |
| `Exclude<T, U>` | Loại type | `Exclude<Role, "guest">` |
| `Extract<T, U>` | Giữ type | `Extract<Event, {kind: "click"}>` |
| `NonNullable<T>` | Bỏ null/undefined | Sau check tồn tại |
| `ReturnType<F>` | Type return | Hook return type |
| `Parameters<F>` | Tuple params | Wrapper preserve |
| `Awaited<T>` | Unwrap Promise | Data từ async |
| `keyof T` | Union key | Type-safe field name |
| `typeof variable` | Type từ value | Config inference |
| `as const` | Readonly literal | Enum-like array |
| `z.infer<typeof s>` | Type từ Zod | Schema-driven type |

---

## Câu hỏi tự kiểm tra

**Câu 1:** Khi nào dùng Pick, khi nào dùng Omit?

→ Pick khi list field cần SHORT (chọn ít). Omit khi list field cần dài, chỉ bỏ 1-2 cái.

**Câu 2:** `Record<BookingStatus, string>` khác `{ [k in BookingStatus]: string }` ở điểm nào?

→ Tương đương. `Record` là syntactic sugar cho mapped type.

**Câu 3:** Tại sao `as const` quan trọng khi tạo enum-like array?

→ Không `as const`, array type là `string[]`. Có `as const`, type thành `readonly ["a", "b", "c"]` → có thể `typeof[number]` để lấy union literal.

**Câu 4:** Khi nào dùng type predicate `is` thay vì `in` operator?

→ Khi check phức tạp (nhiều field cần verify, hoặc cần ép kiểu runtime data). Type predicate viết function 1 lần, dùng nhiều nơi.

**Câu 5:** Tại sao `z.infer<typeof schema>` tốt hơn declare type tay?

→ Single source of truth. Schema đổi → type tự đồng bộ → không sync lệch giữa validate runtime và type compile-time.

**Câu 6:** Tạo type `ApiResponse<T>` cho CineX nên đặt ở đâu?

→ `types/api.ts` hoặc `api/types.ts`. Import vào mọi hook/service — generic `T` chứa response data thực.

**Câu 7:** `Partial<Omit<User, "id">>` nghĩa là gì? Khi nào dùng?

→ Tất cả field của User trừ `id`, đều optional. Dùng cho PATCH endpoint — client gửi data update, không cần đầy đủ, không được đổi `id`.
