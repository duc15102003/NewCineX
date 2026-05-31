# TypeScript Cơ bản — Type-safe JavaScript

---

## TypeScript là gì?

TypeScript = JavaScript + **kiểu dữ liệu** (types). Giúp phát hiện lỗi **lúc viết code** thay vì lúc chạy.

### Ví dụ đời thường
- JavaScript: gửi thư không ghi địa chỉ → đến nơi mới biết sai
- TypeScript: bưu điện kiểm tra địa chỉ TRƯỚC KHI gửi → sai thì sửa ngay

---

## Kiểu dữ liệu cơ bản

```tsx
// String
const title: string = 'Avengers';

// Number
const duration: number = 150;
const rating: number = 8.5;

// Boolean
const isAdmin: boolean = false;

// Array
const seatIds: number[] = [1, 2, 3];
const genres: string[] = ['Action', 'Sci-Fi'];

// Null / Undefined
const phone: string | null = null;        // có thể null
const avatar: string | undefined = undefined;
```

---

## Interface — Định nghĩa hình dạng object

```tsx
// Khai báo: object Movie phải có những field gì
interface Movie {
    id: number;
    title: string;
    duration: number;
    rating: number;
    posterUrl?: string;    // ? = optional (có thể không có)
    genres: Genre[];       // mảng Genre
}

interface Genre {
    id: number;
    name: string;
}

// Sử dụng
const movie: Movie = {
    id: 1,
    title: 'Avengers',
    duration: 150,
    rating: 8.5,
    genres: [{ id: 1, name: 'Action' }],
};

movie.title = 123;  // ❌ LỖI COMPILE: Type 'number' is not assignable to type 'string'
movie.xyz;           // ❌ LỖI: Property 'xyz' does not exist on type 'Movie'
```

### Tại sao cần Interface?

**Không có (JavaScript):**
```js
function MovieCard({ movie }) {
    return <h3>{movie.titl}</h3>;  // Typo "titl" → runtime bug, khó tìm
}
```

**Có Interface (TypeScript):**
```tsx
function MovieCard({ movie }: { movie: Movie }) {
    return <h3>{movie.titl}</h3>;  // ❌ LỖI COMPILE NGAY: Did you mean 'title'?
}
```

---

## Type vs Interface

```tsx
// Interface — cho object (dùng nhiều nhất)
interface Movie {
    id: number;
    title: string;
}

// Type — cho union, alias
type MovieStatus = 'COMING_SOON' | 'NOW_SHOWING' | 'ENDED';
// ↑ Chỉ chấp nhận 3 giá trị này, gõ sai → lỗi compile

type PaymentMethod = 'VNPAY' | 'MOMO' | 'CASH';

// Sử dụng
const status: MovieStatus = 'NOW_SHOWING';  // ✅
const status: MovieStatus = 'PLAYING';       // ❌ LỖI
```

---

## Generic — Kiểu tham số hóa

```tsx
// ApiResponse cho BẤT KỲ kiểu data nào
interface ApiResponse<T> {
    success: boolean;
    message: string;
    data: T;               // T = kiểu được truyền vào khi sử dụng
    timestamp: string;
}

// Sử dụng
type MovieResponse = ApiResponse<Movie>;
// → { success, message, data: Movie, timestamp }

type MovieListResponse = ApiResponse<PageResponse<Movie>>;
// → { success, message, data: { content: Movie[], page, size, ... }, timestamp }
```

```tsx
// useState với generic
const [movies, setMovies] = useState<Movie[]>([]);
//                                   ↑ mảng Movie

const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
//                                               ↑ string hoặc null
```

---

## Trong CineX — Định nghĩa types

```tsx
// src/types/movie.ts
export interface Movie {
    id: number;
    title: string;
    description: string;
    duration: number;
    releaseDate: string;
    posterUrl: string;
    trailerUrl: string;
    director: string;
    rating: number;
    status: MovieStatus;
    genres: Genre[];
}

export type MovieStatus = 'COMING_SOON' | 'NOW_SHOWING' | 'ENDED';

export interface Genre {
    id: number;
    name: string;
}

// src/types/booking.ts
export interface Booking {
    id: number;
    bookingCode: string;
    totalAmount: number;
    status: BookingStatus;
    showtime: ShowtimeInfo;
    seats: SeatInfo[];
    createdAt: string;
}

export type BookingStatus = 'HOLDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CANCELLED' | 'EXPIRED';

// src/types/auth.ts
export interface LoginRequest {
    username: string;
    password: string;
}

export interface AuthResponse {
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    expiresIn: number;
}

// src/types/api.ts
export interface ApiResponse<T> {
    success: boolean;
    message: string;
    data: T;
    timestamp: string;
}

export interface PageResponse<T> {
    content: T[];
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
    last: boolean;
}
```

### Dùng trong component

```tsx
import { Movie } from '../types/movie';
import { ApiResponse, PageResponse } from '../types/api';

function MovieListPage() {
    const { data } = useQuery<ApiResponse<PageResponse<Movie>>>({
        queryKey: ['movies'],
        queryFn: () => api.get('/api/movies').then(res => res.data),
    });

    const movies: Movie[] = data?.data.content || [];
    // ↑ TypeScript biết movies là mảng Movie
    // → IDE gợi ý: movies[0].title, movies[0].duration, ...
}
```

---

## 1. Union Types — Một biến nhiều khả năng

Union Type = biến có thể là **một trong nhiều kiểu**. Dùng dấu `|` (pipe) để liệt kê.

### 1.1. Union cơ bản

```tsx
// Status chỉ chấp nhận 1 trong 2 giá trị
type Status = 'ACTIVE' | 'INACTIVE';

const userStatus: Status = 'ACTIVE';   // ✅
const userStatus: Status = 'DELETED';  // ❌ LỖI: Type '"DELETED"' is not assignable to type 'Status'

// Union nhiều giá trị (giống enum)
type BookingStatus = 'HOLDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CANCELLED' | 'EXPIRED';

// Union nhiều kiểu
type Id = string | number;
const movieId: Id = 1;        // ✅ number
const movieCode: Id = 'M001'; // ✅ string
const movieId: Id = true;     // ❌ LỖI
```

### Ví dụ đời thường

Một cái cốc có thể chứa:
- `cafe | tra | nuoc_loc` — không bao giờ chứa cả 3, chỉ 1 trong 3

```tsx
type Drink = 'cafe' | 'tra' | 'nuoc_loc';
const cup: Drink = 'cafe';  // ✅
const cup: Drink = 'bia';   // ❌ LỖI
```

### 1.2. Discriminated Union — Type "thông minh" tự phân biệt

Đây là **pattern cực quan trọng** trong TypeScript. Một field chung (gọi là **discriminator**) giúp TypeScript biết object đang ở "nhánh" nào.

```tsx
// Kết quả gọi API: hoặc thành công (có data), hoặc lỗi (có message)
type Result<T> =
  | { kind: 'success'; data: T }
  | { kind: 'error'; message: string };
//      ↑ kind là discriminator — TypeScript dựa vào đây để phân biệt

function handleResult(result: Result<Movie>) {
    if (result.kind === 'success') {
        console.log(result.data.title);
        // ↑ TypeScript BIẾT result có field `data: Movie`
        // → gợi ý .title, .duration, ...

        console.log(result.message);
        // ❌ LỖI: Property 'message' does not exist on type '{ kind: "success"; data: Movie }'
    } else {
        console.log(result.message);
        // ↑ TypeScript BIẾT result có field `message: string`

        console.log(result.data);
        // ❌ LỖI: Property 'data' does not exist
    }
}
```

### Ứng dụng CineX — Trạng thái thanh toán

```tsx
type PaymentResult =
  | { kind: 'PENDING'; paymentId: number }
  | { kind: 'SUCCESS'; paymentId: number; transactionId: string; paidAt: string }
  | { kind: 'FAILED'; paymentId: number; errorCode: string; errorMessage: string };

function renderPayment(result: PaymentResult) {
    switch (result.kind) {
        case 'PENDING':
            return <span>Đang xử lý #{result.paymentId}</span>;
        case 'SUCCESS':
            return <span>Đã thanh toán {result.transactionId} lúc {result.paidAt}</span>;
            //                          ↑ TypeScript biết SUCCESS có transactionId
        case 'FAILED':
            return <span>Lỗi {result.errorCode}: {result.errorMessage}</span>;
            //                ↑ TypeScript biết FAILED có errorCode
    }
}
```

### 1.3. So sánh Union vs Enum

| Tiêu chí | Union Type (`type X = 'A' \| 'B'`) | Enum (`enum X { A, B }`) |
|---|---|---|
| Khi compile | Bị xóa (chỉ tồn tại lúc viết) | Sinh ra object JavaScript thật |
| Bundle size | 0 byte | Có byte (vì enum thật) |
| So sánh | `if (x === 'ACTIVE')` | `if (x === Status.ACTIVE)` |
| Auto-complete | Có (IDE gợi ý 'ACTIVE', 'INACTIVE') | Có (gợi ý Status.ACTIVE) |
| JSON serialize | Tự nhiên (`"ACTIVE"`) | Phải dùng string enum |

**Quy ước CineX:** Frontend dùng **Union Type** (gọn nhẹ, khớp với JSON từ BE), không dùng `enum`.

---

## 2. Intersection Types — Gộp nhiều type

Intersection Type = object phải **có TẤT CẢ field** của các type được gộp. Dùng dấu `&` (and).

```tsx
interface User {
    id: number;
    username: string;
    email: string;
}

interface Token {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}

// AuthUser = User + Token
type AuthUser = User & Token;

const me: AuthUser = {
    id: 1,
    username: 'vanan',
    email: 'an@test.com',
    accessToken: 'eyJ...',
    refreshToken: 'eyJ...',
    expiresIn: 3600,
};
// ↑ Phải đủ TẤT CẢ field của User VÀ Token, thiếu 1 field → lỗi compile
```

### Ví dụ đời thường

Một người vừa là **sinh viên** vừa là **lập trình viên**:
- Có `studentId` (sinh viên)
- Có `companyName` (lập trình viên)
- Phải có CẢ HAI mới đủ

### Khi nào dùng Intersection?

```tsx
// 1. Thêm field vào type có sẵn
type WithTimestamp<T> = T & { createdAt: string; updatedAt: string };

type MovieWithTimestamp = WithTimestamp<Movie>;
// = Movie + createdAt + updatedAt

// 2. Mixin behavior
type Clickable = { onClick: () => void };
type Hoverable = { onHover: () => void };
type Button = Clickable & Hoverable;
// → Button có cả onClick và onHover
```

### Cảnh báo: Conflict field type

Nếu hai type có cùng tên field nhưng kiểu **khác nhau**, kết quả là `never`:

```tsx
type A = { value: string };
type B = { value: number };
type C = A & B;

const x: C = { value: '1' };   // ❌ LỖI: value phải vừa string vừa number → never
const x: C = { value: 1 };     // ❌ LỖI tương tự
```

Hai field cùng tên nhưng kiểu **giống nhau hoặc compatible** thì ok.

---

## 3. Type Narrowing — 5 cách "thu hẹp" type

Narrowing = thu hẹp type **rộng** xuống type **hẹp hơn** dựa vào điều kiện kiểm tra. TypeScript đủ thông minh để hiểu sau `if`, type đã thu hẹp.

### 3.1. `typeof` guard

Dùng cho kiểu nguyên thủy (string, number, boolean, ...).

```tsx
function formatPrice(price: string | number): string {
    if (typeof price === 'string') {
        return price.toUpperCase();
        //     ↑ TypeScript biết price là string ở đây
    }
    return price.toLocaleString('vi-VN') + 'đ';
    //     ↑ TypeScript biết price là number ở đây
}
```

### 3.2. `instanceof` guard

Dùng cho class instance. Hay gặp khi catch error.

```tsx
import { AxiosError } from 'axios';

try {
    await api.post('/api/login', credentials);
} catch (err) {
    if (err instanceof AxiosError) {
        console.log(err.response?.status);
        //         ↑ TypeScript biết err có .response
    } else if (err instanceof Error) {
        console.log(err.message);
        //         ↑ TypeScript biết err có .message
    } else {
        console.log('Unknown error');
    }
}
```

### 3.3. `in` operator — Check field tồn tại

Dùng khi 2 object khác cấu trúc nhưng KHÔNG có discriminator.

```tsx
interface Movie {
    id: number;
    title: string;
    duration: number;
}

interface Showtime {
    id: number;
    startTime: string;
    seats: number[];
}

function describe(item: Movie | Showtime) {
    if ('seats' in item) {
        console.log(item.seats.length);
        //         ↑ TypeScript biết item là Showtime
    } else {
        console.log(item.title);
        //         ↑ TypeScript biết item là Movie
    }
}
```

### 3.4. Equality check với Discriminated Union

(Đã giới thiệu ở section 1.2.) — Check field discriminator để narrow.

```tsx
if (result.kind === 'success') { /* result là { kind: 'success'; data } */ }
```

### 3.5. Type Predicate — Hàm `is`

Tạo function trả về `x is T`. TypeScript sẽ tin tưởng và narrow theo function này.

```tsx
function isMovie(x: unknown): x is Movie {
    return (
        typeof x === 'object' &&
        x !== null &&
        'title' in x &&
        'duration' in x
    );
}

function process(data: unknown) {
    if (isMovie(data)) {
        console.log(data.title);
        //         ↑ TypeScript tin đây là Movie nhờ `x is Movie`
    }
}
```

### Ví dụ đời thường

Type predicate giống như **cô tiếp tân** check vé:
- "Người này có vé Movie" → cho vào phòng Movie
- Sau khi tiếp tân xác nhận, mọi người tin tưởng

---

## 4. `unknown` vs `any` vs `never`

Ba "kiểu đặc biệt" cần phân biệt rõ.

### 4.1. `any` — Tắt type check

```tsx
let value: any = 'hello';
value = 1;
value = { foo: 'bar' };
value.xyz.abc.qwe();  // ✅ Không lỗi compile (nhưng runtime crash!)
```

`any` là **anti-pattern**, dùng khi cùng đường (vd: migrate từ JS sang TS). **Tránh dùng** trong code mới.

### 4.2. `unknown` — Type-safe `any`

`unknown` chấp nhận MỌI giá trị nhưng **không cho phép dùng** trước khi narrow.

```tsx
let value: unknown = 'hello';
value = 1;
value = { foo: 'bar' };

value.toUpperCase();   // ❌ LỖI: Object is of type 'unknown'
value.xyz;             // ❌ LỖI

// Phải narrow trước
if (typeof value === 'string') {
    value.toUpperCase();  // ✅
}
```

**Khi nào dùng `unknown`?** Khi parse JSON, nhận data từ API mà chưa biết shape.

```tsx
async function fetchData(url: string): Promise<unknown> {
    const res = await fetch(url);
    return res.json();  // JSON.parse trả về unknown chuẩn
}

const data = await fetchData('/api/movies');
if (isMovie(data)) {
    console.log(data.title);
}
```

### 4.3. `never` — Không bao giờ xảy ra

`never` đại diện cho giá trị **không thể tồn tại**. Dùng trong 2 trường hợp:

**a) Function luôn throw (không return)**

```tsx
function throwError(message: string): never {
    throw new Error(message);
}
```

**b) Exhaustive check — đảm bảo đã xử lý hết case**

```tsx
type BookingStatus = 'HOLDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CANCELLED' | 'EXPIRED';

function getLabel(status: BookingStatus): string {
    switch (status) {
        case 'HOLDING':    return 'Đang giữ';
        case 'CONFIRMED':  return 'Đã đặt';
        case 'CHECKED_IN': return 'Đã vào rạp';
        case 'CANCELLED':  return 'Đã hủy';
        case 'EXPIRED':    return 'Hết hạn';
        default:
            // Nếu THIẾU 1 case ở trên, `status` sẽ KHÔNG phải never
            // → assignment dưới đây lỗi → buộc lập trình viên thêm case
            const _exhaustive: never = status;
            throw new Error(`Unhandled status: ${status}`);
    }
}
```

### Ví dụ đời thường

- `any`: thẻ vạn năng — vào được mọi cửa nhưng dễ lọt vào chỗ nguy hiểm
- `unknown`: thẻ "chờ xác minh" — vào được cửa nhưng phải scan kiểm tra trước
- `never`: thẻ "không tồn tại" — không có cửa nào nhận

---

## 5. `keyof T` và `typeof variable`

Hai toán tử rất mạnh để **lấy type từ thứ có sẵn**.

### 5.1. `keyof T` — Lấy tên các field

```tsx
interface User {
    id: number;
    username: string;
    email: string;
    phone: string;
}

type UserKey = keyof User;
// = 'id' | 'username' | 'email' | 'phone'

const key: UserKey = 'email';   // ✅
const key: UserKey = 'xyz';     // ❌ LỖI
```

### 5.2. `typeof variable` — Lấy type từ value

```tsx
const movieStatusLabels = {
    COMING_SOON:  'Sắp chiếu',
    NOW_SHOWING:  'Đang chiếu',
    ENDED:        'Đã kết thúc',
};

type Labels = typeof movieStatusLabels;
// = { COMING_SOON: string; NOW_SHOWING: string; ENDED: string }
```

### 5.3. Combine: `keyof typeof`

Pattern siêu hữu ích: tạo union type từ key của object.

```tsx
const movieStatusLabels = {
    COMING_SOON: 'Sắp chiếu',
    NOW_SHOWING: 'Đang chiếu',
    ENDED:       'Đã kết thúc',
} as const;

type MovieStatus = keyof typeof movieStatusLabels;
// = 'COMING_SOON' | 'NOW_SHOWING' | 'ENDED'

function getLabel(status: MovieStatus): string {
    return movieStatusLabels[status];
    //                       ↑ type-safe, không gõ nhầm
}
```

### 5.4. Use case: Form field name type-safe

```tsx
interface FormData {
    username: string;
    email: string;
    phone: string;
}

function setField(name: keyof FormData, value: string) {
    // name chỉ có thể là 'username' | 'email' | 'phone'
    console.log(name, value);
}

setField('email', 'a@b.com');  // ✅
setField('xyz', 'aaa');         // ❌ LỖI
```

---

## 6. `as const` — Readonly Literal

Mặc định TypeScript suy luận **type rộng** (string, number). `as const` giữ **giá trị chính xác** (literal type).

### 6.1. So sánh có/không `as const`

```tsx
const status = 'ACTIVE';
// → type: string (rộng — có thể gán bất kỳ string nào)

const status = 'ACTIVE' as const;
// → type: 'ACTIVE' (chỉ giá trị 'ACTIVE')

let s = status;  // type 'ACTIVE'
s = 'INACTIVE';  // ❌ LỖI
```

### 6.2. Với array

```tsx
const arr = [1, 2, 3];
// → type: number[]

const arr = [1, 2, 3] as const;
// → type: readonly [1, 2, 3]
// Không push được, không sửa được

arr.push(4);     // ❌ LỖI: Property 'push' does not exist
arr[0] = 10;     // ❌ LỖI: Cannot assign to '0'
```

### 6.3. Với object

```tsx
const config = {
    apiUrl: 'http://localhost:8088',
    timeout: 5000,
};
// → { apiUrl: string; timeout: number }

const config = {
    apiUrl: 'http://localhost:8088',
    timeout: 5000,
} as const;
// → { readonly apiUrl: 'http://localhost:8088'; readonly timeout: 5000 }
```

### 6.4. Khi nào dùng `as const`?

- **Tạo enum thay thế:** kết hợp `keyof typeof` để có union literal
- **Constant config:** đảm bảo không bị sửa
- **Tuple chính xác:** mảng có thứ tự + độ dài cố định

```tsx
// Ví dụ CineX: định nghĩa status + label trong 1 object
export const BOOKING_STATUS = {
    HOLDING:    { label: 'Đang giữ',  color: 'yellow' },
    CONFIRMED:  { label: 'Đã đặt',    color: 'green' },
    CANCELLED:  { label: 'Đã hủy',    color: 'red' },
} as const;

type BookingStatus = keyof typeof BOOKING_STATUS;
// = 'HOLDING' | 'CONFIRMED' | 'CANCELLED'
```

---

## 7. `as` Type Assertion — Ép kiểu

`as` báo TypeScript: "Tin tôi đi, biến này có kiểu X". **Chỉ compile-time**, không có runtime check.

### 7.1. Cú pháp

```tsx
const value: unknown = 'hello';
const len = (value as string).length;
//                ↑ Ép value thành string
```

### 7.2. Khi nào dùng?

**Đúng cách:**
- Sau khi narrow nhưng TypeScript không hiểu
- DOM element: `document.getElementById('foo') as HTMLInputElement`

```tsx
// querySelector trả Element | null, ép thành HTMLInputElement
const input = document.querySelector('#username') as HTMLInputElement;
input.value = 'vanan';
//    ↑ HTMLInputElement có .value, Element thì không
```

### 7.3. Anti-pattern: `as any as X`

```tsx
const data = response as any as Movie;
// ❌ ANTI-PATTERN: ép qua any để bypass type check
```

Khi bạn viết `as any as X` nghĩa là bạn đang **giấu lỗi** chứ không phải sửa lỗi. Nên:
- Sửa type gốc cho đúng
- Hoặc dùng type predicate để runtime check

### Cảnh báo

`as` **không kiểm tra runtime**. Nếu giá trị thật KHÔNG khớp, code sẽ crash khi chạy.

```tsx
const value: unknown = 123;
const str = value as string;
str.toUpperCase();
// ✅ Compile OK
// ❌ Runtime crash: str.toUpperCase is not a function
```

---

## 8. Function Types

### 8.1. Type cho function

```tsx
// Cách 1: dùng type alias
type Handler = (event: MouseEvent) => void;

const onClick: Handler = (e) => {
    console.log(e.clientX);
};

// Cách 2: inline
const onClick: (e: MouseEvent) => void = (e) => { /* ... */ };
```

### 8.2. Async function

Hàm async **luôn trả Promise**.

```tsx
type Fetcher<T> = () => Promise<T>;

const fetchMovies: Fetcher<Movie[]> = async () => {
    const res = await api.get('/api/movies');
    return res.data.data.content;
};

// Tương đương viết bằng inline
async function fetchMovies(): Promise<Movie[]> {
    const res = await api.get('/api/movies');
    return res.data.data.content;
}
```

### 8.3. Optional parameter

```tsx
// `?` = optional
function greet(name: string, age?: number) {
    if (age !== undefined) {
        console.log(`${name} - ${age} tuổi`);
    } else {
        console.log(name);
    }
}

greet('An');         // ✅
greet('An', 25);     // ✅
```

### 8.4. Default parameter (TypeScript tự suy ra type)

```tsx
function paginate(page = 1, size = 20) {
    // ↑ TypeScript suy ra page: number, size: number (từ default value)
    return { page, size };
}

paginate();          // ✅ page=1, size=20
paginate(2);         // ✅
paginate(2, 'big');  // ❌ LỖI: 'big' is not a number
```

### 8.5. Rest parameter

```tsx
function sum(...nums: number[]): number {
    return nums.reduce((a, b) => a + b, 0);
}

sum(1, 2, 3);  // ✅ 6
```

---

## 9. Generic Functions

Generic = "viết hàm 1 lần, dùng với nhiều type". Giống **biến số `x` trong toán**.

### 9.1. Generic cơ bản

```tsx
function identity<T>(x: T): T {
    return x;
}

const a = identity<string>('hello');   // T = string
const b = identity<number>(123);        // T = number
const c = identity('hello');            // T tự suy = string
```

### 9.2. Generic với Constraint (`extends`)

```tsx
// T phải có field `id: number`
function getId<T extends { id: number }>(x: T): number {
    return x.id;
}

const movieId = getId({ id: 1, title: 'A' });    // ✅ T = Movie-like
const noId    = getId({ title: 'A' });           // ❌ LỖI: thiếu id
```

### 9.3. Default Generic

```tsx
function createState<T = string>(initial: T): { value: T } {
    return { value: initial };
}

const a = createState('hello');       // T = string (mặc định)
const b = createState<number>(123);   // T = number (chỉ định)
```

### 9.4. Multiple generics

```tsx
function pair<K, V>(key: K, value: V): { key: K; value: V } {
    return { key, value };
}

const p = pair('id', 1);
// → { key: string, value: number }
```

### 9.5. Ví dụ CineX: useQuery

`useQuery` của react-query nhận generic để biết shape của data trả về.

```tsx
const { data } = useQuery<ApiResponse<Movie>>({
    queryKey: ['movie', id],
    queryFn: () => api.get(`/api/movies/${id}`).then(r => r.data),
});

data?.data.title;   // ✅ TypeScript biết data là ApiResponse<Movie>
data?.xyz;          // ❌ LỖI
```

---

## 10. Generic Constraints

`extends` trong generic không có nghĩa là kế thừa class. Nó có nghĩa **"T phải tương thích với type bên phải"**.

### 10.1. `T extends keyof U`

```tsx
function getValue<T, K extends keyof T>(obj: T, key: K): T[K] {
    return obj[key];
}

const movie: Movie = { id: 1, title: 'A', duration: 120, /* ... */ };

const title    = getValue(movie, 'title');     // ✅ type: string
const duration = getValue(movie, 'duration');  // ✅ type: number
const xyz      = getValue(movie, 'xyz');       // ❌ LỖI: 'xyz' không phải keyof Movie
```

### 10.2. Implement Pick

(Tham khảo file utility types, đây chỉ là minh hoạ constraint.)

```tsx
function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
    const result = {} as Pick<T, K>;
    for (const key of keys) {
        result[key] = obj[key];
    }
    return result;
}

const summary = pick(movie, ['id', 'title']);
// → type: { id: number; title: string }
```

### 10.3. `T extends string`

```tsx
function uppercase<T extends string>(s: T): Uppercase<T> {
    return s.toUpperCase() as Uppercase<T>;
}

const a = uppercase('hello');
// type: 'HELLO' (literal!)
```

---

## 11. Template Literal Types — Type cho string pattern

Template literal type cho phép tạo type **string theo mẫu**.

### 11.1. Cơ bản

```tsx
type Greeting = `Hello, ${string}`;

const a: Greeting = 'Hello, An';      // ✅
const b: Greeting = 'Hi, An';          // ❌ LỖI
```

### 11.2. Combine với union

```tsx
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
type Endpoint   = '/movies' | '/bookings' | '/users';

type ApiRoute = `${HttpMethod} ${Endpoint}`;
// = 'GET /movies' | 'GET /bookings' | 'GET /users'
//  | 'POST /movies' | 'POST /bookings' | ...
//  | (12 combinations)

const route: ApiRoute = 'GET /movies';     // ✅
const route: ApiRoute = 'PATCH /movies';   // ❌ LỖI
```

### 11.3. Use case: Type-safe routes

```tsx
type Route =
    | '/'
    | '/login'
    | `/movies/${number}`
    | `/bookings/${string}`;

function navigate(route: Route) {
    window.location.href = route;
}

navigate('/movies/123');           // ✅
navigate('/bookings/BK-001');      // ✅
navigate('/xyz');                  // ❌ LỖI
```

### 11.4. Built-in helpers

```tsx
type A = Uppercase<'hello'>;   // 'HELLO'
type B = Lowercase<'HELLO'>;   // 'hello'
type C = Capitalize<'hello'>;  // 'Hello'
type D = Uncapitalize<'Hello'>;// 'hello'
```

---

## 12. Conditional Types — `T extends U ? X : Y`

Conditional type = **if-else cho type**.

### 12.1. Cú pháp

```tsx
type IsString<T> = T extends string ? 'yes' : 'no';

type A = IsString<'hello'>;   // 'yes'
type B = IsString<123>;       // 'no'
```

### 12.2. Implement Exclude

```tsx
type MyExclude<T, U> = T extends U ? never : T;

type A = MyExclude<'a' | 'b' | 'c', 'b'>;
// = 'a' | 'c'
//
// Cách hoạt động (distributive):
//   'a' extends 'b' ? never : 'a' → 'a'
//   'b' extends 'b' ? never : 'b' → never
//   'c' extends 'b' ? never : 'c' → 'c'
//   Union: 'a' | never | 'c' = 'a' | 'c'
```

### 12.3. `infer` keyword — "Lấy type ra"

`infer` cho phép TypeScript **đoán type** trong nhánh extends rồi đặt tên cho nó.

```tsx
// Lấy return type của function
type ReturnType<F> = F extends (...args: any[]) => infer R ? R : never;

type A = ReturnType<() => string>;        // string
type B = ReturnType<() => Promise<number>>; // Promise<number>

// Lấy element type của array
type ElementOf<A> = A extends (infer E)[] ? E : never;

type C = ElementOf<Movie[]>;   // Movie
type D = ElementOf<string[]>;  // string
```

### Ví dụ đời thường

`infer` giống như **"điền vào chỗ trống"**: "Nếu T có dạng `Hộp<X>`, gọi X là cái-gì-đó-trong-hộp."

---

## 13. Mapped Types — Biến đổi từng field của type

Mapped type = "lặp qua từng field của T và biến đổi".

### 13.1. Cú pháp

```tsx
// Tự implement Partial
type MyPartial<T> = { [K in keyof T]?: T[K] };

type PartialMovie = MyPartial<Movie>;
// = { id?: number; title?: string; duration?: number; ... }
```

### 13.2. Tự implement Readonly

```tsx
type MyReadonly<T> = { readonly [K in keyof T]: T[K] };

type ReadonlyMovie = MyReadonly<Movie>;
const m: ReadonlyMovie = { id: 1, /* ... */ };
m.title = 'X';   // ❌ LỖI: Cannot assign to 'title' because it is a read-only property
```

### 13.3. Rename keys với `as`

```tsx
type Getters<T> = {
    [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

interface User {
    id: number;
    name: string;
}

type UserGetters = Getters<User>;
// = {
//   getId: () => number;
//   getName: () => string;
// }
```

### 13.4. Filter field theo điều kiện

```tsx
// Chỉ giữ field có type string
type StringFields<T> = {
    [K in keyof T as T[K] extends string ? K : never]: T[K];
};

interface User {
    id: number;
    name: string;
    email: string;
    age: number;
}

type StringOnly = StringFields<User>;
// = { name: string; email: string }
```

---

## 14. Index Signature

Index signature = "object có **bất kỳ key string nào** trỏ tới value type T".

```tsx
type Dict = { [key: string]: number };

const d: Dict = {
    apple: 1,
    banana: 2,
    cherry: 3,
};

d.xyz;  // type: number (nhưng runtime là undefined!)
```

### 14.1. Tương đương với Record

```tsx
type Dict = Record<string, number>;
// Y hệt `{ [key: string]: number }`
```

### 14.2. Cảnh báo với `noUncheckedIndexedAccess`

Nếu tsconfig bật `noUncheckedIndexedAccess`, type sẽ chính xác hơn:

```tsx
type Dict = { [key: string]: number };
const d: Dict = { a: 1 };

const x = d.xyz;
// Không bật: type number (sai, vì runtime là undefined)
// Có bật:    type number | undefined (đúng!)
```

**Khuyến nghị:** bật `noUncheckedIndexedAccess` trong dự án mới để tránh bug `Cannot read property of undefined`.

---

## 15. tsconfig.json — Strict Options

`strict: true` bật toàn bộ chế độ nghiêm ngặt. Bao gồm nhiều flag con.

### 15.1. Các flag quan trọng

| Flag | Tác dụng | Khuyến nghị |
|---|---|---|
| `strict` | Bật tất cả flag bên dưới | ✅ ON |
| `strictNullChecks` | `null`/`undefined` phải xử lý explicit | ✅ ON |
| `noImplicitAny` | Cấm khai báo biến không có type | ✅ ON |
| `strictFunctionTypes` | Kiểm tra type tham số function strict hơn | ✅ ON |
| `strictBindCallApply` | `bind/call/apply` check type | ✅ ON |
| `strictPropertyInitialization` | Field class phải khởi tạo trong constructor | ✅ ON |
| `noImplicitThis` | `this` phải có type | ✅ ON |
| `alwaysStrict` | Tự thêm `'use strict'` mọi file | ✅ ON |

### 15.2. Flag bổ sung (không nằm trong `strict`)

| Flag | Tác dụng |
|---|---|
| `noUncheckedIndexedAccess` | `obj[key]` trả `T \| undefined` (như section 14) |
| `exactOptionalPropertyTypes` | Phân biệt missing và explicit undefined |
| `noImplicitReturns` | Mọi nhánh phải return |
| `noFallthroughCasesInSwitch` | Switch case phải break/return |
| `noUnusedLocals` | Cảnh báo biến local không dùng |
| `noUnusedParameters` | Cảnh báo tham số không dùng |

### 15.3. So sánh: `strictNullChecks` OFF vs ON

**OFF:**
```tsx
const user: User = null;        // ✅ (chấp nhận null vô tội vạ)
const name: string = undefined; // ✅
```

**ON:**
```tsx
const user: User = null;          // ❌ LỖI
const user: User | null = null;    // ✅ phải khai báo rõ
```

### 15.4. `exactOptionalPropertyTypes` — Phân biệt missing và undefined

```tsx
interface User {
    name?: string;
}

// OFF (mặc định)
const u: User = { name: undefined };  // ✅

// ON
const u: User = { name: undefined };  // ❌ LỖI: phải dùng `{}` thay vì `{ name: undefined }`
const u: User = {};                    // ✅
```

---

## 16. Type Inference — TypeScript đoán type khi nào?

TypeScript thông minh — **đoán được** type mà không cần khai báo explicit.

### 16.1. `const` vs `let`

```tsx
let x = 1;
// type: number (rộng — vì let có thể đổi)
x = 2;       // ✅
x = 'a';     // ❌

const y = 1;
// type: 1 (literal — vì const không đổi)

const z = 'ACTIVE';
// type: 'ACTIVE' (literal string)
```

### 16.2. Return type của function

```tsx
function add(a: number, b: number) {
    return a + b;
}
// Return type tự suy = number, không cần khai báo
```

### 16.3. Array

```tsx
const nums = [1, 2, 3];
// type: number[]

const mixed = [1, 'a', true];
// type: (string | number | boolean)[]
```

### 16.4. Object

```tsx
const movie = {
    id: 1,
    title: 'A',
};
// type: { id: number; title: string }
```

### 16.5. Khi nào nên khai báo EXPLICIT?

**Khi viết "public API"** (function/hook export):
- Người khác cần biết rõ contract
- Tránh inference đổi nếu sửa implementation

```tsx
// ❌ Không tốt — inference có thể đổi
export function useUser() {
    const [data, setData] = useState(null);
    return { data, setData };
}

// ✅ Tốt — contract rõ ràng
export function useUser(): { data: User | null; setData: (u: User | null) => void } {
    const [data, setData] = useState<User | null>(null);
    return { data, setData };
}
```

---

## 17. Utility Types — Xem chi tiết file riêng

`Partial<T>`, `Pick<T, K>`, `Omit<T, K>`, `Record<K, V>`, `ReturnType<F>`, ... là **built-in utility types** rất hay dùng.

Xem chi tiết và ví dụ CineX ở: **`pre-04-typescript-utility-types.md`**.

---

## 18. Code thực tế CineX — Tổng hợp

### 18.1. Hook trả về với type đầy đủ

```tsx
import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { api } from '../api/axios';
import type { Movie } from '../types/movie';
import type { ApiResponse } from '../types/api';

interface UseMovieResult {
    movie: Movie | undefined;
    isLoading: boolean;
    error: Error | null;
    refetch: () => void;
}

export function useMovie(id: number): UseMovieResult {
    const query: UseQueryResult<ApiResponse<Movie>, Error> = useQuery({
        queryKey: ['movie', id],
        queryFn: () => api.get(`/api/movies/${id}`).then(r => r.data),
    });

    return {
        movie: query.data?.data,
        isLoading: query.isLoading,
        error: query.error,
        refetch: () => query.refetch(),
    };
}
```

### 18.2. Form data type với react-hook-form

```tsx
import { useForm } from 'react-hook-form';

interface MovieFormData {
    title: string;
    description: string;
    duration: number;
    releaseDate: string;
    director: string;
    genreIds: number[];
}

function MovieForm() {
    const { register, handleSubmit, formState: { errors } } = useForm<MovieFormData>({
        defaultValues: {
            title: '',
            description: '',
            duration: 90,
            releaseDate: '',
            director: '',
            genreIds: [],
        },
    });

    const onSubmit = (data: MovieFormData) => {
        // data đã được TypeScript validate đầy đủ
        console.log(data.title);     // ✅ string
        console.log(data.duration);  // ✅ number
        console.log(data.xyz);        // ❌ LỖI
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)}>
            <input {...register('title', { required: true })} />
            {errors.title && <span>Bắt buộc</span>}
        </form>
    );
}
```

### 18.3. API response type với generic ApiResponse

```tsx
// Tất cả API trả ApiResponse<T>
async function fetchMovie(id: number): Promise<Movie> {
    const res = await api.get<ApiResponse<Movie>>(`/api/movies/${id}`);
    return res.data.data;
    //         ↑ res.data là ApiResponse<Movie>
    //         ↑ res.data.data là Movie
}

async function fetchMovies(params: MovieFilter): Promise<PageResponse<Movie>> {
    const res = await api.get<ApiResponse<PageResponse<Movie>>>('/api/movies', { params });
    return res.data.data;
}
```

### 18.4. Discriminated Union trong action reducer

```tsx
type CartAction =
    | { type: 'ADD_SEAT'; seatId: number }
    | { type: 'REMOVE_SEAT'; seatId: number }
    | { type: 'ADD_SNACK'; snackId: number; quantity: number }
    | { type: 'CLEAR' };

function cartReducer(state: CartState, action: CartAction): CartState {
    switch (action.type) {
        case 'ADD_SEAT':
            return { ...state, seats: [...state.seats, action.seatId] };
            //                                          ↑ TypeScript biết có seatId
        case 'REMOVE_SEAT':
            return { ...state, seats: state.seats.filter(id => id !== action.seatId) };
        case 'ADD_SNACK':
            return { ...state, snacks: [...state.snacks, { id: action.snackId, quantity: action.quantity }] };
            //                                                                 ↑ TypeScript biết có quantity
        case 'CLEAR':
            return { ...state, seats: [], snacks: [] };
        default:
            const _exhaustive: never = action;
            //   ↑ Nếu thêm action mới mà quên xử lý → lỗi compile ở đây
            return state;
    }
}
```

---

## 19. Câu hỏi tự kiểm tra

1. **Discriminated Union là gì?** Cho ví dụ `Result<T>` thành công/thất bại và giải thích vì sao TypeScript "biết" sau `if (r.kind === 'success')` thì `r` có field `data`.

2. **Phân biệt `unknown`, `any`, `never`.** Khi parse JSON từ `fetch`, nên dùng cái nào? Tại sao? Viết hàm `safeParse<T>(json: string, isT: (x: unknown) => x is T): T | null`.

3. **Vì sao `keyof typeof` được dùng nhiều với `as const`?** Cho object `BOOKING_STATUS_COLOR` với 5 key, tạo type `BookingStatus` chỉ chấp nhận 5 key đó mà KHÔNG khai báo type thủ công.

4. **Conditional + `infer`.** Viết type `Awaited<T>` tự implement: nếu T là `Promise<U>` thì trả về U, ngược lại trả về T. Test với `Awaited<Promise<Movie>>` và `Awaited<number>`.

5. **`noUncheckedIndexedAccess` ảnh hưởng gì?** Khi bật flag này, code sau cần sửa thế nào?
   ```tsx
   const labels: Record<string, string> = { ACTIVE: 'Hoạt động' };
   function getLabel(key: string): string {
       return labels[key].toUpperCase();   // Sau khi bật flag, dòng này lỗi gì?
   }
   ```
