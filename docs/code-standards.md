# CineX — Code Standards

Tiêu chí code review áp dụng cho **toàn bộ project** (BE + FE). Đây là **single source of truth** — CLAUDE.md có rule định tính, file này có **quantitative limits** + checklist mechanical.

> **Quy tắc vàng**: vi phạm bất kỳ rule nào dưới đây phải refactor hoặc note trong PR với lý do. Không "tạm thời" để đó.

---

## 1. Quantitative limits (BẮT BUỘC)

### Method / Function
| Tiêu chí | Limit | Lý do |
|---|---|---|
| Số tham số | **≤ 4** | > 4 → Parameter Object pattern |
| Độ dài body | **≤ 50 dòng** | > 50 → tách helper / Extract Method |
| Nesting depth | **≤ 3 cấp** | > 3 → guard clause / early return |
| Số trách nhiệm | **= 1** | Method tên có chữ "and" → tách |
| Return paths | **≤ 4** | > 4 → tách hoặc dùng strategy |

**Vi phạm điển hình đã gặp**:
- `BookingService.computePriceBreakdown` 6 params → refactor `PricingInput` record (Parameter Object)
- `BookingService.holdSeats` >100 dòng → đã tách thành helpers

### Class / Component
| Tiêu chí | Limit |
|---|---|
| Java class | **≤ 500 dòng** |
| React component | **≤ 300 dòng** |
| TypeScript module | **≤ 400 dòng** |
| Service responsibility | **= 1 domain** (BookingService chỉ xử lý booking) |
| Số public method | **≤ 15** (Service), **≤ 8** (Component) |

### Identifier
| Tiêu chí | Pattern |
|---|---|
| Class | `PascalCase` |
| Method/function | `camelCase`, động từ + đối tượng (`createBooking`, không `bookingCreator`) |
| Constant | `UPPER_SNAKE_CASE` |
| File JS/TS | `kebab-case.tsx` cho component, `camelCase.ts` cho hook/util |
| File Java | `PascalCase.java` |
| Variable | KHÔNG dùng tên 1 ký tự (trừ `i`, `j` trong loop) |

---

## 2. Backend (Java + Spring Boot)

### Architecture
- [ ] **Layered nghiêm**: Controller → Service → Repository. Controller KHÔNG inject Repository.
- [ ] **1 domain = 1 module** (`module/booking/`, `module/payment/`...)
- [ ] **Cross-module gọi qua Service**, KHÔNG qua Repository
- [ ] **No circular dependency** — module A depend B thì B không được depend A

### Controller
- [ ] Chỉ 3 việc: nhận request → gọi service → trả `ApiResponse<T>`
- [ ] `@PreAuthorize` cho mọi endpoint admin
- [ ] `@Auditable` cho action nhạy cảm (delete, role change, config update, refund)
- [ ] `@Valid` cho mọi `@RequestBody`
- [ ] Swagger `@Tag` + `@Operation` cho mọi endpoint
- [ ] URL convention: `/api/{module}/{action}`, danh từ số nhiều
- [ ] HTTP method đúng semantic (GET đọc, POST tạo, PUT sửa full, PATCH sửa partial)

### Service
- [ ] Public method có `@Transactional` (hoặc `readOnly = true` cho query)
- [ ] Lỗi nghiệp vụ → `throw BusinessException(ErrorCode.XXX, message)`, KHÔNG `return null`
- [ ] **NEVER catch generic Exception** trừ logging boundary
- [ ] Method tên rõ ràng (`createBooking`, không `process`, `handle`, `doStuff`)
- [ ] Constructor injection (KHÔNG `@Autowired` field)
- [ ] Defense in depth — validate ngay cả khi Controller đã guard

### Repository
- [ ] Method theo Spring Data convention: `findByXxx`, `existsByXxx`, `countByXxx`
- [ ] Query phức tạp dùng `@Query` JPQL hoặc Specification — **KHÔNG native SQL** trừ khi JPQL không đáp ứng
- [ ] Native query phải dùng `:param` (KHÔNG concat string → SQL injection)
- [ ] Lock: `@Lock(LockModeType.PESSIMISTIC_WRITE)` cho seat hold, booking confirm
- [ ] Index column được filter thường xuyên

### Entity
- [ ] Extends `BaseEntity` (id, version, storageState, createdAt, updatedAt)
- [ ] `@Enumerated(EnumType.STRING)` cho enum (KHÔNG ORDINAL)
- [ ] `@ManyToOne(fetch = FetchType.LAZY)` mặc định
- [ ] `@Column` ghi rõ `name`, `length`, `nullable`
- [ ] Soft delete: `storageState = ARCHIVED`, KHÔNG `DELETE FROM`
- [ ] Code tự sinh dùng `IdTrackerService.nextCodeWithDate("ENTITY_TYPE")` — entity type match seed DB

### DTO
- [ ] Mỗi endpoint có DTO riêng: `XxxRequest` (input), `XxxResponse` (output), `XxxFilter` (search)
- [ ] **KHÔNG trả entity raw cho client** (lộ field nhạy cảm như `password`, `passwordHash`)
- [ ] Request DTO có Bean Validation: `@NotBlank`, `@Email`, `@Size`, `@Min`, `@Max`
- [ ] Response DTO dùng `@Builder` để dễ tạo
- [ ] List trả về `PageResponse<T>` nếu cần phân trang
- [ ] Mapper: dùng MapStruct, KHÔNG manual mapping trừ trường hợp đặc biệt

### Validation matrix
- [ ] Tier price phải ≤ tier liền trên (deluxe ≤ sweetbox? — tuỳ business)
- [ ] Date range: from ≤ to
- [ ] Numeric range: min ≤ max
- [ ] Role × theaterId consistency (STAFF/ADMIN phải có, USER/SUPER_ADMIN null)
- [ ] Cross-module invariant ở Service (combo.theater == snack.theater)

### Exception handling
- [ ] `ErrorCode` enum — mỗi loại lỗi 1 entry
- [ ] `GlobalExceptionHandler` bắt mọi exception, trả `ApiResponse` chuẩn
- [ ] **NEVER lộ stack trace cho client**
- [ ] Log `log.warn` cho lỗi nghiệp vụ, `log.error` cho lỗi hệ thống

### Config / Magic numbers
- [ ] Cấu hình động → `system_config` (key như `booking.hold_minutes`)
- [ ] Hằng số tĩnh → `private static final` trong class
- [ ] Default value cho config: `getInt(key, fallback)`, fallback phải hợp lý
- [ ] **KHÔNG hardcode magic numbers** (15, 10, 80000, "STUDENT_HN")
- [ ] Comment ghi rõ ý nghĩa nếu number không obvious

### Liquibase
- [ ] Mỗi changeset có `id` unique + `author="cinex"`
- [ ] **NEVER sửa changeset đã chạy** → tạo changeset mới để alter
- [ ] File trong `changes/` đánh số tăng dần (`038-x.xml`)
- [ ] Thêm `<include>` vào `db.changelog-master.xml`
- [ ] Schema check trước khi viết INSERT (column tồn tại?)
- [ ] Idempotent: `IF NOT EXISTS` cho INSERT (rerun an toàn)

### Import
- [ ] **KHÔNG dùng FQN inline** (`com.cinex.module...`) ở field/param/throw — phải import lên đầu file
- [ ] KHÔNG `import *` (wildcard)
- [ ] Import groups: java.* → javax.* → org.* → com.cinex.* (mỗi group cách 1 dòng)

---

## 3. Frontend (React + TypeScript)

### Component
- [ ] **KHÔNG `any`** — type rõ ràng
- [ ] **KHÔNG `as unknown as ...`** — refactor type
- [ ] Component < 300 dòng (vượt → tách dialog/form/section)
- [ ] **1 component = 1 trách nhiệm** (UI hoặc state, không cả 2 khi lớn)
- [ ] Props interface có JSDoc comment
- [ ] Hook tách file riêng nếu logic > 10 dòng

### State management
- [ ] Server state → React Query (`useQuery`, `useMutation`)
- [ ] Global state → Zustand store
- [ ] Form state → react-hook-form (KHÔNG `useState` cho form 3+ field)
- [ ] Component-local state → `useState`
- [ ] **KHÔNG gọi `api.get/post` trực tiếp trong component** — phải qua hook

### Data fetching
- [ ] Hook đặt trong `hooks/useXxx.ts`
- [ ] Query key chuẩn: `['admin', 'movies', params]`
- [ ] Mutation có `onSuccess` invalidate query + toast success
- [ ] Mutation có `onError` toast error (lấy message từ `getErrorMessage(e, fallback)`)
- [ ] Retry policy: `retry: 1` mặc định, `retry: false` cho payment/booking (idempotency)

### Form
- [ ] react-hook-form + validation rules
- [ ] Mỗi field có error message rõ ràng tiếng Việt
- [ ] Submit button disabled khi `isPending`
- [ ] Loading state hiển thị (`Loader2 animate-spin`)
- [ ] Cancel button bên trái, Submit bên phải

### UI states (ĐỦ 5 trạng thái cho mọi feature)
- [ ] **Loading**: skeleton hoặc spinner
- [ ] **Empty**: icon + message + CTA "Thêm X đầu tiên"
- [ ] **Error**: toast + inline message
- [ ] **Success**: toast `sonner`
- [ ] **Disabled**: visual khác biệt + cursor-not-allowed

### Design system tokens
- [ ] **KHÔNG hardcode hex** ngoài design tokens (CLAUDE.md mục Color palette)
- [ ] Background card: `bg-[#201b11]`
- [ ] Border: `border-[#3f382d]` (chính), `border-white/10` (phụ)
- [ ] Accent: `bg-[#ffc107]`, hover `bg-[#e6ac06]`
- [ ] Title: `text-amber-50`, body `text-white`, gray `text-gray-300/400`
- [ ] **KHÔNG dùng** `bg-gray-9xx`, `text-amber-400`, hex Public Dark Blue cũ

### Button sizing (UI density admin)
| Use case | Class |
|---|---|
| Primary toolbar (Thêm mới, Lưu) | `h-9 px-4 text-sm font-semibold rounded-lg` |
| Inline row action | `h-7 px-2 text-xs rounded-md` |
| Icon-only | `h-8 w-8 p-0 rounded-md` |
| CTA public (Đặt vé) | `h-11 px-6 text-base font-semibold rounded-lg` |
| **CẤM** | `h-12`, `h-14`, `text-base font-bold` cho admin |

### Labels / Status
- [ ] Mọi label text/status tập trung ở `utils/labels.ts`
- [ ] Mọi status color ở `utils/colors.ts`
- [ ] **KHÔNG khai báo lại constant** trong page
- [ ] Status badge pattern: `bg-{color}/10 text-{color} border-{color}/30`

### Performance
- [ ] Search input debounce 400ms qua `useDebouncedValue`
- [ ] `useMemo` chỗ có cost thực (KHÔNG mọi computation)
- [ ] `useCallback` cho callback truyền vào `useEffect` deps
- [ ] Lazy load route admin (`React.lazy + Suspense`)
- [ ] Image Cloudinary với transform (`?w_400&f_auto`)

### Accessibility (a11y)
- [ ] Semantic HTML (`<button>` không `<div onClick>`)
- [ ] `aria-label` cho icon-only button
- [ ] Keyboard navigation đủ trên dialog/dropdown/calendar
- [ ] Focus visible với `focus-visible:ring-2`
- [ ] Color không phải kênh duy nhất truyền info (kèm icon/text)

### Vietnamese UI
- [ ] **Mọi text user-facing tiếng Việt** có dấu
- [ ] KHÔNG mix tiếng Anh ("Apply" → "Áp dụng", "Submit" → "Lưu")
- [ ] Format tiền: `amount.toLocaleString('vi-VN') + 'đ'`
- [ ] Format ngày: `fmtDate()`, `fmtDateTime()` từ `utils/labels.ts`
- [ ] KHÔNG name-drop brand rạp (Vista/CGV/Lotte) trong UI hint

---

## 4. Cross-cutting (BE + FE)

### Comment
- [ ] Comment giải thích **TẠI SAO**, không **CÁI GÌ** (code tự nói)
- [ ] Khi áp design pattern → ghi tên pattern và lý do
- [ ] Comment Vietnamese OK, identifier English
- [ ] KHÔNG comment dead code — xoá luôn

### Test
- [ ] Mỗi feature mới có **test cases markdown** liệt kê:
  - Happy path
  - Edge case (empty, max, overflow, negative)
  - Concurrency case (race, double-click, retry)
  - Permission case (each role)
- [ ] BE: dùng JUnit5 + Mockito + Testcontainers (đã setup)
- [ ] FE: dùng vitest (chưa setup — Phase 2)

### Industry pattern
- [ ] **Apply** pattern rạp thực tế (Vista/Cinetixx/CGV/Lotte) cho UX/business logic
- [ ] **KHÔNG name-drop** brand trong comment/UI text → marketing-speak
- [ ] Reference brand được trong **commit message** để future-me biết source

### Git
- [ ] Commit message format: `type(scope): short summary` (vd `fix(loyalty): cap-aware redeem`)
- [ ] Body giải thích root cause + fix approach
- [ ] Co-Authored-By footer khi pair với Claude
- [ ] **NEVER force push to main**
- [ ] **NEVER skip hooks** (--no-verify) trừ khi user yêu cầu

---

## 5. Anti-patterns ĐÃ GẶP (đừng làm lại)

### BE
- ❌ Method 6+ params → ✅ Parameter Object (`PricingInput`)
- ❌ FQN inline `com.cinex.xxx` → ✅ import lên đầu file
- ❌ Throw `RuntimeException` chung chung → ✅ `BusinessException(ErrorCode.X, message)`
- ❌ `MoMo error code 22 generic` → ✅ pre-check min/max trước khi gọi API
- ❌ Skip cap khi redeem (lệch với preview) → ✅ Cap-aware ở cả 2 method
- ❌ Auto-fill default cho seat tier không tồn tại → ✅ Check `roomSeatTypes.contains()` TRƯỚC input
- ❌ Brand-name "(CGV/Lotte)" trong code comment → ✅ ghi intent, bỏ name
- ❌ `passwordHash` builder field sai tên (đúng là `password`) → ✅ check entity trước khi viết

### FE
- ❌ Hardcode "15 phút" trong code → ✅ `usePublicConfigNumber('ticket.arrive_early_minutes', 15)`
- ❌ `truncate + flex items-center` cùng element → ✅ tách thành flex row với `truncate min-w-0` span
- ❌ Sticky `bottom-4` cho panel cao → ✅ 2-col desktop + mobile bottom CTA mỏng
- ❌ "Kết hợp (AND)" dùng từ boolean logic → ✅ "Nhiều điều kiện cùng lúc" + tooltip
- ❌ `STUDENT_HN` to bold gold ngang tên → ✅ tên primary, mã subtitle mono gray
- ❌ Cùng icon `FileDown` cho 2 nút khác chức năng → ✅ `FileText` (PDF) + `Sheet` (Excel)
- ❌ Component `>any>` cast → ✅ refactor type
- ❌ "Tại quầy" message cho đơn 0đ → ✅ auto-confirm bypass payment

### Cross-cutting
- ❌ Schema sai (giả định column tồn tại) → ✅ check schema trước khi viết SQL
- ❌ Migration SQL không idempotent → ✅ `IF NOT EXISTS`
- ❌ Method tên duplicate ở 2 nơi → ✅ single source of truth
- ❌ Edit/Update behavior khác Preview/Compute → ✅ logic alignment giữa 2 method
- ❌ Thêm enum value mà QUÊN update DB CHECK constraint → ✅ enum + entity + migration go-together trong cùng PR. Gặp 2 lần (036 DRAFT, 039 STAFF). Đặc biệt với:
  - `role`, `status`, `type`, `method`, `tier` — luôn check CHECK constraint khi thêm value mới
  - Pattern fix: drop CHECK cũ → recreate với danh sách đầy đủ
  - Audit cách: `grep -hE "CHECK \([a-z_]+ IN \(" changes/` rồi cross-ref với enum class

### Quy trình thêm enum value an toàn

1. Thêm value vào enum Java
2. Grep `chk_{table_name}_{column_name}` trong migrations → tìm CHECK hiện tại
3. Tạo migration mới: DROP CHECK + CREATE CHECK với danh sách đầy đủ
4. Add `<include>` vào master
5. Test: tạo record với value mới → INSERT phải pass
6. Commit cả 3 thay đổi trong cùng PR (enum + migration + code dùng value)

---

## 6. PR Review Checklist

Trước khi merge PR (hoặc trước khi báo "done" cho user):

### Functional
- [ ] BE compile (`./gradlew compileJava`) — exit=0
- [ ] FE type-check (`npx tsc --noEmit`) — exit=0
- [ ] Test cases markdown đã viết
- [ ] Happy path đã test manual
- [ ] Edge case nghĩ ra ≥ 3 case

### Code quality
- [ ] Không method >50 dòng / >4 params
- [ ] Không class >500 dòng / component >300 dòng
- [ ] Không `any`, `unknown as`, FQN inline
- [ ] Không hardcode magic number
- [ ] Không brand-name trong code/UI
- [ ] Comment giải thích WHY ≠ WHAT

### UX
- [ ] Đủ 5 states (Loading/Empty/Error/Success/Disabled)
- [ ] Tiếng Việt có dấu
- [ ] Mobile responsive
- [ ] Accessibility cơ bản (aria, keyboard)
- [ ] Button sizing đúng convention

### Data
- [ ] Soft delete (KHÔNG `DELETE`)
- [ ] Sort default `createdAt DESC`
- [ ] DTO (không leak entity raw)
- [ ] Validation BE + FE
- [ ] Config-driven (không magic)

### Security
- [ ] `@PreAuthorize` đúng role
- [ ] `@Auditable` cho action nhạy cảm
- [ ] Input sanitize qua Bean Validation
- [ ] Cross-tenant guard (theater scope)
- [ ] No leak nhạy cảm (password, token, secrets)

---

## 7. Cập nhật file này

Khi gặp anti-pattern mới hoặc rule mới:
1. Thêm vào mục tương ứng
2. Add vào **Section 5** với cặp ❌/✅
3. Commit với message `docs(standards): add rule about XXX`
4. Tell future-me trong commit body lý do thêm rule

> **Mục tiêu cuối**: file này = compiled experience của project. Dev mới đọc 1 lần, code không vi phạm rule.
