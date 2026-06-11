# 30 lỗi hay gặp khi code CineX + cách fix

> **Mục tiêu:** mỗi lỗi đều giải thích **TẠI SAO sai** + **TÁC HẠI** + **CÁCH FIX**.
> Đọc 1 lần để hiểu, đọc lại khi gặp bug.

**Tài liệu sâu hơn:**
- [`backend/15-common-pitfalls.md`](backend/15-common-pitfalls.md) — Top 20 bug Spring chi tiết với code reproduce + giải thích cơ chế Proxy/Lazy/Lifecycle
- [`frontend/15-react-pitfalls.md`](frontend/15-react-pitfalls.md) — Top 18 bug React/TS/Tailwind
- [`glossary.md`](glossary.md) — Tra thuật ngữ (Race Condition, N+1, Stale Closure...)

---

## 🚨 3 lỗi PHẢI tránh ngay tuần đầu tiên

Người mới hay vướng 3 lỗi này trước, vì chúng "vô hình" — code compile, app chạy, nhưng dữ liệu sai / chậm / lộ thông tin. Mỗi lỗi đều nằm trong danh sách 30 lỗi bên dưới (số trong ngoặc).

| # | Lỗi | Triệu chứng | Đọc mục |
|---|---|---|---|
| 🔴 1 | **Trả Entity thẳng cho client** | API trả về password hash | #1 |
| 🟠 2 | **`@ManyToOne fetch = EAGER`** | List 20 phim mất 5 giây | #2 + #13 |
| 🟡 3 | **Thiếu `@Transactional` ở method ghi DB** | Booking lưu 1 nửa rồi crash → dữ liệu rác | #3 |

**Cách check nhanh:**
```bash
# Có entity nào leak ra controller không?
grep -rn "ResponseEntity<.*Entity" backend/src/main/java/com/cinex/

# Có @ManyToOne nào EAGER không?
grep -rn "fetch = FetchType.EAGER" backend/src/main/java/com/cinex/

# Có service method ghi DB nào thiếu @Transactional không?
# (xem manual: file Service nào có save/delete/update mà không có @Transactional trên method)
```

---

## 🗂️ Phân loại 30 lỗi theo nhóm

| Nhóm | Số lỗi | Tác hại |
|---|---|---|
| 🔴 **Bảo mật** (lộ data, lỗ hổng) | 1, 6, 22 | Hacker exploit, GDPR vi phạm |
| 🟠 **Performance** (chậm) | 2, 4, 13, 26, 27 | API chậm, user bỏ đi |
| 🟡 **Data integrity** (sai dữ liệu) | 3, 5, 7, 11, 12, 14, 20, 21, 28 | Booking trùng, vé bị lặp, money loss |
| 🟢 **UX & Logic** (UI/code) | 8, 9, 10, 15, 16, 17, 18, 19, 23, 24, 25, 29, 30 | User confused, dev mất giờ debug |

---

## 1. Trả Entity thẳng cho client → LỘ PASSWORD

```java
// ❌ SAI
@GetMapping("/me")
public User getProfile() {
    return userRepository.findById(userId);
    // Response chứa: password hash, version, storageState, ...
}

// ✅ ĐÚNG — dùng DTO
@GetMapping("/me")
public UserProfileResponse getProfile() {
    return userMapper.toProfileResponse(user);
    // Response chỉ có: id, username, email, fullName, role
}
```

🤔 **Tại sao sai?** Jackson serialize toàn bộ field public của Entity (kể cả `password`, `version`, `storageState`). Entity là object DB, không phải object API.

🎯 **Tác hại:** Lộ password hash → hacker có thể brute force offline. Vi phạm GDPR. Lộ business logic (status enum, internal flags).

📚 **Đọc thêm:** [backend/15-common-pitfalls.md](backend/15-common-pitfalls.md) mục "Entity Leak", [design-patterns/02-structural-patterns.md](design-patterns/02-structural-patterns.md) (DTO).

**Quy tắc:** KHÔNG BAO GIỜ trả entity cho client. Luôn dùng Response DTO.

---

## 2. `@ManyToOne fetch = EAGER` → N+1 query

```java
// ❌ SAI — load Room cho MỖI seat khi list
@ManyToOne(fetch = FetchType.EAGER)
private Room room;
// List 120 ghế = 1 query seats + 120 query rooms = 121 queries!

// ✅ ĐÚNG — LAZY, chỉ query Room khi cần
@ManyToOne(fetch = FetchType.LAZY)
private Room room;
// List 120 ghế = 1 query seats
// Gọi seat.getRoom() mới query Room (chỉ khi cần)
```

🤔 **Tại sao sai?** EAGER nghĩa là "load luôn quan hệ khi load entity chính". Khi list 120 ghế, Hibernate phải JOIN hoặc query thêm để load Room cho từng ghế → N+1 query.

🎯 **Tác hại:** API list mất 5-10 giây thay vì 100ms. DB load 100% CPU. Production scale down toàn bộ service.

📚 **Đọc thêm:** [database/01-database-techniques.md](database/01-database-techniques.md) (N+1), [glossary.md#n-o](glossary.md#n-o) (Eager vs Lazy).

**Quy tắc:** `@ManyToOne`, `@ManyToMany`, `@OneToMany` luôn dùng `LAZY`. Cần load relationship → dùng `JOIN FETCH` hoặc `@EntityGraph`.

---

## 3. Thiếu `@Transactional` → data không nhất quán

```java
// ❌ SAI — không có @Transactional
public void holdSeats(request) {
    bookingRepository.save(booking);    // Bước 1: OK
    bookingSeatRepository.save(seat1);  // Bước 2: OK
    bookingSeatRepository.save(seat2);  // Bước 3: LỖI!
    // → Booking tạo rồi nhưng seat2 chưa tạo → data bất nhất!
}

// ✅ ĐÚNG — @Transactional: tất cả hoặc không
@Transactional
public void holdSeats(request) {
    bookingRepository.save(booking);
    bookingSeatRepository.save(seat1);
    bookingSeatRepository.save(seat2);  // LỖI → rollback TẤT CẢ → sạch sẽ
}
```

🤔 **Tại sao sai?** Mỗi lời gọi `save()` riêng lẻ là 1 transaction implicit (default JPA). Bước 1 đã commit, bước 3 fail không thể rollback bước 1.

🎯 **Tác hại:** Booking ghost (có booking nhưng không có seat). User trả tiền nhưng không có vé. Data rác trong DB.

📚 **Đọc thêm:** [backend/04-spring-features.md](backend/04-spring-features.md) (@Transactional), [glossary.md#a](glossary.md#a) (ACID).

**Quy tắc:** Method nào ghi DB (save, update, delete) → phải có `@Transactional`. Method chỉ đọc → `@Transactional(readOnly = true)` (nhanh hơn).

---

## 4. Filter soft delete bằng Java thay vì SQL

```java
// ❌ SAI — load TẤT CẢ rồi filter bằng Java
public List<Room> listRooms() {
    return roomRepository.findAll().stream()
        .filter(r -> !"DELETED".equals(r.getStorageState()))
        .toList();
    // 10.000 rows → load hết → bỏ 9.900 → lãng phí!
}

// ✅ ĐÚNG — filter ở SQL, DB chỉ trả row cần
public Page<Room> listRooms(RoomFilter filter, Pageable pageable) {
    var spec = RoomSpecification.fromFilter(filter);
    return roomRepository.findAll(spec, pageable);
    // SQL: WHERE storage_state <> 'ARCHIVED' → DB trả 100 rows
}
```

🤔 **Tại sao sai?** Filter bằng Java = load hết về RAM rồi loại bỏ. DB index không được tận dụng. Network transfer thừa.

🎯 **Tác hại:** Backend RAM cạn (10k rows × n bytes), GC liên tục, API chậm 10x. Scale lên 1M rows → app crash.

📚 **Đọc thêm:** [module-guides/04-filter-specification-explained.md](module-guides/04-filter-specification-explained.md).

**Quy tắc:** Filter, search, sort luôn làm ở SQL (Specification), không load hết rồi xử lý Java.

---

## 5. Sửa Liquibase changeset đã chạy → checksum error

```
Lỗi: Validation Failed: checksum mismatch for changeset 001

Nguyên nhân: Sửa file 001-create-users-table.xml sau khi đã chạy
Liquibase tính lại MD5SUM → khác với DB → lỗi

Fix: KHÔNG sửa file cũ → tạo changeset MỚI
     Hoặc: UPDATE DATABASECHANGELOG SET MD5SUM = NULL WHERE ID = '001'
```

🤔 **Tại sao sai?** Liquibase track changeset bằng MD5 hash. Sửa file = hash đổi = Liquibase không biết file này đã chạy hay chưa → từ chối.

🎯 **Tác hại:** Production deploy fail. Team khác pull về không start được app.

📚 **Đọc thêm:** [database/02-liquibase-guide.md](database/02-liquibase-guide.md).

**Quy tắc:** Changeset đã chạy = bất khả xâm phạm. Muốn thay đổi → tạo changeset mới.

---

## 6. Quên `@EnableMethodSecurity` → `@PreAuthorize` vô tác dụng

```java
// ❌ SAI — thiếu @EnableMethodSecurity
@Configuration
@EnableWebSecurity
public class SecurityConfig { ... }

// @PreAuthorize("hasRole('ADMIN')") → BỊ BỎ QUA → user thường gọi API admin → LỖ HỔNG!

// ✅ ĐÚNG
@Configuration
@EnableWebSecurity
@EnableMethodSecurity    // ← PHẢI CÓ
public class SecurityConfig { ... }
```

🤔 **Tại sao sai?** `@PreAuthorize` là AOP, cần Spring đăng ký AspectJ proxy để hoạt động. `@EnableMethodSecurity` chính là cái đăng ký đó. Không có nó, annotation thành comment vô nghĩa.

🎯 **Tác hại:** USER thường gọi được API delete user. **Lỗ hổng nghiêm trọng — privilege escalation.**

📚 **Đọc thêm:** [backend/03-security.md](backend/03-security.md), [glossary.md#l-m](glossary.md#l-m) (Method Security).

---

## 7. Check unique khi UPDATE → báo trùng với chính nó

```java
// ❌ SAI — giữ nguyên tên "Room 1" → existsByName("Room 1") = true → báo lỗi sai!
public void updateRoom(Long id, RoomRequest request) {
    if (roomRepository.existsByName(request.getName())) {
        throw new BusinessException(ErrorCode.ROOM_EXISTED);
    }
}

// ✅ ĐÚNG — kiểm tra tên có ĐỔI không trước
public void updateRoom(Long id, RoomRequest request) {
    Room room = roomRepository.findById(id);
    if (!room.getName().equals(request.getName())    // Tên đổi?
        && roomRepository.existsByName(request.getName())) {  // Tên mới bị trùng?
        throw new BusinessException(ErrorCode.ROOM_EXISTED);
    }
}
```

🤔 **Tại sao sai?** `existsByName` tìm cả chính record đang update. Logic check unique sai chỗ.

🎯 **Tác hại:** User không thể edit (chỉ đổi mô tả, giữ nguyên tên) → báo "đã tồn tại". UX rất bí.

**Quy tắc thay thế:** Dùng `existsByNameAndIdNot(name, id)` cho gọn:
```java
if (roomRepository.existsByNameAndIdNot(request.getName(), id)) {
    throw new BusinessException(ErrorCode.ROOM_EXISTED);
}
```

---

## 8. YAML duplicate key → crash khi start

```yaml
# ❌ SAI — 2 lần "spring:" → DuplicateKeyException
spring:
  profiles:
    active: dev

spring:                    # ← TRÙNG KEY!
  servlet:
    multipart:
      max-file-size: 5MB

# ✅ ĐÚNG — gộp vào 1 block
spring:
  profiles:
    active: dev
  servlet:
    multipart:
      max-file-size: 5MB
```

🤔 **Tại sao sai?** YAML là cây dict, không phải list. Cùng key ở cùng level = ghi đè, hoặc parser từ chối.

🎯 **Tác hại:** App không start được. Stack trace dài 200 dòng, người mới không biết tìm dòng nào.

📚 **Đọc thêm:** [backend/01-spring-boot-basics.md](backend/01-spring-boot-basics.md).

---

## 9. Lombok `@Builder` bỏ qua giá trị mặc định

```java
// ❌ SAI — @Builder bỏ qua default value
@Builder
public class Room {
    private RoomStatus status = RoomStatus.ACTIVE;
}
Room.builder().name("Room 1").build();  // status = NULL!

// ✅ ĐÚNG — thêm @Builder.Default
@Builder
public class Room {
    @Builder.Default
    private RoomStatus status = RoomStatus.ACTIVE;
}
Room.builder().name("Room 1").build();  // status = ACTIVE ✅
```

🤔 **Tại sao sai?** Lombok `@Builder` sinh constructor mới, KHÔNG gọi field initializer của class. Phải `@Builder.Default` để Lombok hiểu "field này có default".

🎯 **Tác hại:** Room tạo ra với `status = null` → vào DB lỗi NOT NULL constraint (hoặc tệ hơn, vẫn lưu được nhưng app sau đó crash khi đọc).

📚 **Đọc thêm:** [backend/05-lombok.md](backend/05-lombok.md).

---

## 10. `GlobalExceptionHandler` không log → bug biến mất

```java
// ❌ SAI — exception bị nuốt, không log
@ExceptionHandler(Exception.class)
public ResponseEntity<ApiResponse<Void>> handleGeneral(Exception ex) {
    return ResponseEntity.status(500).body(ApiResponse.error("Unexpected error"));
    // Không biết lỗi gì, ở đâu, stack trace nào → không debug được!
}

// ✅ ĐÚNG — log stack trace
@ExceptionHandler(Exception.class)
public ResponseEntity<ApiResponse<Void>> handleGeneral(Exception ex) {
    log.error("Unexpected error", ex);   // ← Log đầy đủ stack trace
    return ResponseEntity.status(500).body(ApiResponse.error("Unexpected error"));
}
```

🤔 **Tại sao sai?** Catch exception mà không log = che giấu bug. Không biết bug nào đang xảy ra trong production.

🎯 **Tác hại:** User báo "lỗi 500" — dev không biết bug gì, ở đâu, lúc nào. Bug tồn tại nhiều tháng không phát hiện.

📚 **Đọc thêm:** [backend/14-observability.md](backend/14-observability.md) (logging best practice).

---

## 11. Self-invocation của `@Transactional`/`@Async` → AOP không hoạt động

```java
@Service
public class PaymentService {
    public void payAndAudit() {
        this.audit("...");  // ❌ Không trong transaction
    }

    @Transactional
    public void audit(String msg) { ... }
}
```

🤔 **Tại sao sai?** Spring `@Transactional` hoạt động qua **Proxy**: Spring tạo 1 class wrapper bọc bean của bạn, mọi call NGOÀI vào đều qua proxy. Nhưng `this.audit()` gọi trực tiếp instance gốc → bỏ qua proxy → annotation vô hiệu.

🎯 **Tác hại:** Transaction không có thật. Khi crash, không rollback. Data bất nhất.

📚 **Đọc thêm:** [backend/15-common-pitfalls.md](backend/15-common-pitfalls.md) mục "Self-Invocation Proxy Bypass" (giải thích Proxy chi tiết), [glossary.md#r-s](glossary.md#r-s) (Self-Invocation).

**Fix:** inject `self` bằng `@Lazy`, hoặc tách method sang class khác.

---

## 12. Quên `@EnableAsync` / `@EnableScheduling` / `@EnableJpaAuditing`

```java
@SpringBootApplication
@EnableAsync           // ← bắt buộc cho @Async
@EnableScheduling      // ← bắt buộc cho @Scheduled
@EnableJpaAuditing     // ← bắt buộc cho @CreatedDate, @LastModifiedDate
public class CineXApplication { ... }
```

🤔 **Tại sao sai?** Annotation `@Async`, `@Scheduled`, `@CreatedDate` chỉ activate khi có `@Enable*`. Quên → annotation bị bỏ qua âm thầm (không cảnh báo!).

🎯 **Tác hại:** Scheduler không chạy (BookingCleanupScheduler im lìm → ghế HOLDING không expire → user khác không đặt được). `@Async` method chạy sync chậm UI.

📚 **Đọc thêm:** [backend/04-spring-features.md](backend/04-spring-features.md).

---

## 13. `@OneToMany` / `@ManyToOne` fetch type mặc định khác nhau

🤔 **Tại sao quan trọng?** Mỗi quan hệ có default khác:
- `@ManyToOne` → EAGER (mặc định Hibernate) — **rất nguy hiểm**
- `@OneToMany` → LAZY — an toàn hơn nhưng vẫn N+1 nếu loop access
- `@ManyToMany` → LAZY
- `@OneToOne` → EAGER

```java
@ManyToOne(fetch = FetchType.LAZY)  // ← override default
private User user;
```

🎯 **Tác hại:** Bug N+1 ẩn. List Movie load hết Genre / Director / ... EAGER → query nổ ra.

**Quy ước:** TẤT CẢ relationship đều LAZY, fetch khi cần qua `@EntityGraph` hoặc `JOIN FETCH`.

📚 **Đọc thêm:** [backend/02-jpa-hibernate.md](backend/02-jpa-hibernate.md).

---

## 14. Mock entity với `@Data` Lombok

```java
@Entity
@Data  // ❌ nguy hiểm
public class Movie extends BaseEntity {
    @ManyToMany private Set<Genre> genres;
}
```

🤔 **Tại sao sai?** `@Data` sinh `toString()`, `equals()`, `hashCode()` dùng TẤT CẢ field — bao gồm cả LAZY collection.

3 hệ quả:
1. `toString()` bidirectional Movie ↔ Genre → stack overflow
2. `equals/hashCode` resolve lazy → N+1
3. `hashCode` đổi sau khi id assigned → `Set` lưu sai

🎯 **Tác hại:** StackOverflowError khi log, hashCode collisions trong Set khiến `contains()` trả false dù element đã có.

**Fix:** `@Getter @Setter @NoArgsConstructor @AllArgsConstructor @SuperBuilder` thay `@Data`.

📚 **Đọc thêm:** [backend/05-lombok.md](backend/05-lombok.md).

---

## 15. Tailwind dynamic class

```tsx
<span className={`bg-${color}-500`}>  // ❌ KHÔNG hoạt động
```

🤔 **Tại sao sai?** Tailwind JIT scan source code compile-time bằng regex. `bg-${color}-500` không match pattern cố định → JIT KHÔNG sinh CSS rule này → class biến mất khi build prod.

🎯 **Tác hại:** Dev mode (Vite full Tailwind) thấy ok. Build prod → mất màu, layout vỡ.

**Fix:** map object:
```tsx
const COLORS = { red: "bg-red-500", green: "bg-green-500" };
<span className={COLORS[color]}>
```

Hoặc safelist trong `tailwind.config.js`.

📚 **Đọc thêm:** [frontend/15-react-pitfalls.md](frontend/15-react-pitfalls.md), [glossary.md#d](glossary.md#d) (Dynamic Class).

---

## 16. Stale closure trong `setInterval`/`setTimeout`

```tsx
useEffect(() => {
  setInterval(() => {
    console.log(count);  // luôn log giá trị cũ
  }, 1000);
}, []);  // deps rỗng → capture count = 0 forever
```

🤔 **Tại sao sai?** JavaScript closure capture biến lúc function được tạo. `useEffect(() => {}, [])` chỉ chạy lần đầu → closure giữ `count = 0` vĩnh viễn dù state đã update.

🎯 **Tác hại:** Counter UI hiển thị `5` nhưng log ra `0`. Timer-based logic dùng giá trị stale → bug khó debug.

**Fix:** functional setState `setCount(c => c + 1)` hoặc `useRef` giữ giá trị mới nhất.

📚 **Đọc thêm:** [frontend/15-react-pitfalls.md](frontend/15-react-pitfalls.md), [glossary.md#r-s](glossary.md#r-s) (Stale Closure).

---

## 17. WebSocket connect 2 lần trong React StrictMode

```tsx
useEffect(() => {
  const client = createStompClient();
  client.activate();
  // ❌ thiếu cleanup → connect 2 lần trong dev → ghost connection
}, []);
```

🤔 **Tại sao sai?** React StrictMode (dev mode) cố tình mount → unmount → mount lại để phát hiện side effect không sạch. Không có cleanup → 2 connection cùng tồn tại.

🎯 **Tác hại:** WebSocket nhận 2 lần mỗi message. Subscription leak. Memory leak.

**Fix:**
```tsx
useEffect(() => {
  const client = createStompClient();
  client.activate();
  return () => client.deactivate();
}, []);
```

📚 **Đọc thêm:** [glossary.md#r-s](glossary.md#r-s) (Strict Mode), [frontend/15-react-pitfalls.md](frontend/15-react-pitfalls.md).

---

## 18. Axios refresh token infinite loop

```ts
api.interceptors.response.use(null, async (err) => {
  if (err.response?.status === 401) {
    await api.post("/auth/refresh", {...});  // ❌ Cũng dùng `api`
    // → /auth/refresh cũng có thể 401 → trigger refresh → infinite loop
  }
});
```

🤔 **Tại sao sai?** Interceptor catch 401, gọi `/auth/refresh` qua chính `api` đã setup interceptor. Nếu refresh cũng 401 (token hỏng), interceptor lại trigger refresh → vòng lặp.

🎯 **Tác hại:** Browser tab treo, CPU 100%. User phải force close.

**Fix:** dùng `axios.post` thẳng cho `/auth/refresh`, bypass interceptor.

📚 **Đọc thêm:** [frontend/07-axios-api.md](frontend/07-axios-api.md), [frontend/12-auth-flow-explained.md](frontend/12-auth-flow-explained.md).

---

## 19. Mutation success không invalidate query

```tsx
const mutation = useMutation({
  mutationFn: (data) => api.post("/movies", data),
  // ❌ Sau khi tạo thành công, list UI không cập nhật
});
```

🤔 **Tại sao sai?** TanStack Query cache list `["movies"]` không tự biết "có movie mới" → vẫn trả cache cũ.

🎯 **Tác hại:** User tạo movie xong nhìn list không thấy → tưởng bug, tạo lại → trùng.

**Fix:**
```tsx
const mutation = useMutation({
  mutationFn: (data) => api.post("/movies", data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["movies"] });
  },
});
```

📚 **Đọc thêm:** [frontend/03-tanstack-query.md](frontend/03-tanstack-query.md).

---

## 20. Race condition khi đặt ghế

🤔 **Tại sao xảy ra?** 2 user cùng click ghế A1 trong micro-giây. Cả 2 thread đọc DB thấy ghế trống → cả 2 save → 2 booking cùng ghế.

🎯 **Tác hại:** 2 user trả tiền cùng ghế. Đến rạp xảy ra ẩu đả. CineX phải refund + đền bù.

**Fix kết hợp (defense in depth):**
1. **Pessimistic Lock ở Service:** `@Lock(PESSIMISTIC_WRITE)` khi check seat
2. **UNIQUE constraint DB:** `(showtime_id, seat_id)` WHERE `status IN ('HELD','BOOKED')` — backup nếu lock fail
3. **Frontend optimistic UI + revert khi error**

📚 **Đọc thêm:** [module-guides/09-booking-explained.md](module-guides/09-booking-explained.md), [database/01-database-techniques.md](database/01-database-techniques.md), [glossary.md#r-s](glossary.md#r-s) (Race Condition).

---

## 21. Idempotency Payment Callback

🤔 **Tại sao xảy ra?** MoMo gửi callback qua HTTP. Network không tin cậy → MoMo retry sau timeout → BE nhận callback 2 lần.

Code SAI:
```java
public void handleCallback(...) {
    payment.setStatus(SUCCESS);
    booking.setStatus(CONFIRMED);
    sendEmail();   // ← gửi 2 email!
}
```

🎯 **Tác hại:** User nhận 2 email vé. Notification gửi 2 lần. Nếu logic phức tạp hơn (vd: cộng điểm thưởng) → cộng đôi → loss tiền.

**Fix:**
```java
public void handleCallback(...) {
    if (payment.getStatus() == SUCCESS) {
        return;  // ← đã xử lý, skip
    }
    payment.setStatus(SUCCESS);
    ...
}
```

📚 **Đọc thêm:** [module-guides/10-payment-explained.md](module-guides/10-payment-explained.md), [glossary.md#i](glossary.md#i) (Idempotent, IPN).

---

## 22. JWT lưu `localStorage` XSS risk

```ts
localStorage.setItem("accessToken", token);  // ❌ XSS đọc được
```

🤔 **Tại sao sai?** `localStorage` accessible từ JavaScript. Nếu trang bị inject script (XSS), hacker đọc token → giả mạo user.

🎯 **Tác hại:** Account takeover. Hacker mua vé bằng tiền user.

**Mitigation (defense in depth):**
- CSP header chặn script lạ
- KHÔNG `dangerouslySetInnerHTML` cho user input
- DOMPurify cho rich text
- React auto-escape JSX (sẵn rồi, đừng bypass)
- HttpOnly cookie thay localStorage (trade-off với CSRF)

📚 **Đọc thêm:** [backend/03-security.md](backend/03-security.md), [glossary.md#w-x-y](glossary.md#w-x-y) (XSS).

---

## 23. Notification không invalidate sau mutation read

```tsx
const markAsReadMutation = useMutation({
  mutationFn: (id) => api.patch(`/notifications/${id}/read`),
  // ❌ Badge count không cập nhật
});
```

🤔 **Tại sao sai?** Đánh dấu read nhưng không invalidate query `["unread-count"]` → badge vẫn hiển thị số cũ.

🎯 **Tác hại:** UX confused. User click notification → đọc xong vẫn thấy badge "5 unread".

**Fix:** invalidate cả `notifications` và `unread-count`:
```ts
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["notifications"] });
  queryClient.invalidateQueries({ queryKey: ["unread-count"] });
}
```

📚 **Đọc thêm:** [module-guides/13-notification-explained.md](module-guides/13-notification-explained.md).

---

## 24. Quên cleanup WebSocket subscription

```tsx
useEffect(() => {
  client.subscribe("/topic/showtime/10/seats", handler);
  // ❌ Không unsubscribe → leak khi unmount
}, []);
```

🤔 **Tại sao sai?** Component unmount nhưng subscription vẫn tồn tại trong STOMP client → handler vẫn được gọi → setState component đã unmount → React warning.

🎯 **Tác hại:** Memory leak. Console warning "Can't perform React state update on unmounted component". Bug khó tìm.

**Fix:**
```tsx
useEffect(() => {
  const sub = client.subscribe("/topic/showtime/10/seats", handler);
  return () => sub.unsubscribe();
}, []);
```

📚 **Đọc thêm:** [frontend/14-booking-websocket-explained.md](frontend/14-booking-websocket-explained.md).

---

## 25. Trang protected redirect mất context

```tsx
function ProtectedRoute({ children }) {
  if (!isAuth) return <Navigate to="/login" />;  // ❌ Mất context "đang từ đâu"
  return children;
}
```

🤔 **Tại sao sai?** User đang ở `/booking/123` → bị đá về `/login` → đăng nhập xong về `/` thay vì `/booking/123`. Trải nghiệm tệ.

🎯 **Tác hại:** User mất context, phải tìm lại trang đang xem. Conversion rate giảm.

**Fix:** lưu `state.from`:
```tsx
if (!isAuth) return <Navigate to="/login" state={{ from: location }} replace />;
// LoginPage đọc state.from sau khi login → navigate về đúng trang
```

📚 **Đọc thêm:** [frontend/12-auth-flow-explained.md](frontend/12-auth-flow-explained.md).

---

## 26. Spec query không `distinct` → duplicate row

```java
Specification<Movie> spec = (root, query, cb) -> {
    root.join("genres");  // INNER JOIN → 1 movie có 3 genre → 3 row
    return cb.equal(...);
};
```

🤔 **Tại sao sai?** JOIN với bảng nhiều-nhiều nhân row. Movie A có 3 genre → query trả 3 row Movie A.

🎯 **Tác hại:** API list trả 100 movie nhưng nhìn ra 250 row (vì duplicate). Pagination sai. User confused.

**Fix:** `query.distinct(true)` hoặc dùng `EXISTS` subquery thay JOIN.

📚 **Đọc thêm:** [module-guides/04-filter-specification-explained.md](module-guides/04-filter-specification-explained.md).

---

## 27. Index không có cho cột query thường xuyên

🤔 **Tại sao sai?** Cột `bookings.user_id`, `bookings.showtime_id` không có index → query `WHERE user_id = ?` chạy full table scan.

🎯 **Tác hại:** List "vé của tôi" chạy 5 giây với 100k row. Production scale lên 1M row → 50 giây → timeout.

**Fix:** bổ sung index ở Liquibase:
```xml
<createIndex tableName="bookings" indexName="idx_bookings_user_created">
    <column name="user_id"/>
    <column name="created_at" descending="true"/>
</createIndex>
```

📚 **Đọc thêm:** [database/01-database-techniques.md](database/01-database-techniques.md), [glossary.md#b](glossary.md#b) (B-tree).

---

## 28. Bulk update không có `clearAutomatically`

```java
@Modifying
@Query("UPDATE Notification SET isRead = true WHERE userId = :id")
int markAllAsRead(Long id);
```

🤔 **Tại sao sai?** Sau bulk UPDATE, Hibernate persistent context vẫn giữ entity cũ (chưa biết DB đã đổi) → query tiếp đọc stale data trong cùng transaction.

🎯 **Tác hại:** Mark all as read xong, code đọc lại notification thấy vẫn `isRead = false`. Logic dựa trên đó bị sai.

**Fix:** `@Modifying(clearAutomatically = true)` → clear context sau update.

📚 **Đọc thêm:** [module-guides/13-notification-explained.md](module-guides/13-notification-explained.md).

---

## 29. Token refresh race condition

🤔 **Tại sao xảy ra?** 5 widget gọi 5 API song song → 5 fail 401 → 5 interceptor cùng trigger refresh → 5 request `/auth/refresh` song song.

🎯 **Tác hại:** 4 trong 5 refresh fail (server rotate token). User bị đăng xuất giả lập. UX tệ.

**Fix:** `failedQueue` pattern — chỉ 1 refresh chạy, 4 request đợi token mới rồi retry:
```ts
let isRefreshing = false;
let failedQueue: Array<() => void> = [];

api.interceptors.response.use(null, async (err) => {
  if (err.response?.status === 401) {
    if (isRefreshing) {
      return new Promise(resolve => failedQueue.push(resolve));
    }
    isRefreshing = true;
    await axios.post("/auth/refresh", ...);
    isRefreshing = false;
    failedQueue.forEach(cb => cb());
    failedQueue = [];
  }
});
```

📚 **Đọc thêm:** [frontend/12-auth-flow-explained.md](frontend/12-auth-flow-explained.md).

---

## 30. `@Builder` skip BaseEntity fields

```java
User u = User.builder().id(1L).username("vanan").build();
// ❌ id() không exist nếu User extends BaseEntity
```

🤔 **Tại sao sai?** `@Builder` chỉ sinh setter cho field của class hiện tại, KHÔNG kế thừa field từ class cha (`BaseEntity.id`).

🎯 **Tác hại:** Test viết `User.builder().id(1L)` → compile error. Hoặc nếu Lombok generate được mà run sai → test fail confusing.

**Fix:** `@SuperBuilder` thay `@Builder` cho cả `BaseEntity` và subclass.

📚 **Đọc thêm:** [backend/05-lombok.md](backend/05-lombok.md).

---

## 📋 Checklist trước khi commit

Trước khi commit, đọc qua list này 30 giây:

- [ ] **Bảo mật:** Có trả Entity nào ra Controller không? (`grep "ResponseEntity<.*Entity"`)
- [ ] **Performance:** Có `fetch = EAGER` mới không? (`grep "FetchType.EAGER"`)
- [ ] **Data integrity:** Method service mới ghi DB có `@Transactional` không?
- [ ] **Security annotation:** Endpoint admin có `@PreAuthorize` không?
- [ ] **Liquibase:** Có sửa changeset cũ không? (chỉ tạo changeset mới)
- [ ] **Bulk update:** Có `@Modifying(clearAutomatically = true)` không?
- [ ] **FE mutation:** Có `invalidateQueries` cho list liên quan không?
- [ ] **WebSocket/setInterval:** Có cleanup return trong `useEffect` không?
- [ ] **Tailwind:** Có dùng dynamic class `bg-${...}` không? (dùng map)
- [ ] **Index:** Cột query thường xuyên có index không?

---

## 🎓 Câu hỏi tự kiểm tra

1. Tại sao `@ManyToOne` mặc định EAGER lại nguy hiểm hơn `@OneToMany` LAZY?
2. Self-invocation `this.method()` bypass Proxy — giải thích bằng ví dụ đời thường tại sao Spring Proxy không can thiệp được?
3. Tại sao Liquibase tính MD5 hash cho changeset? Nếu không tính thì hệ quả là gì?
4. Race condition khi đặt ghế: tại sao 1 mình Pessimistic Lock chưa đủ, cần thêm UNIQUE constraint DB?
5. Payment callback idempotent — nếu MoMo gửi 3 lần callback (do retry), code phải đảm bảo điều gì?
6. JWT lưu localStorage có risk XSS, lưu HttpOnly cookie có risk gì? Trade-off?
7. TanStack Query `invalidateQueries` khác `setQueryData` ở chỗ nào? Khi nào dùng cái nào?
8. Tailwind JIT scan source code — nếu bạn build trên CI và dev local thấy class ok nhưng CI build mất, có thể là lý do gì?
9. Stale closure trong `setInterval`: dùng `useRef` và dùng functional setState khác nhau ở chỗ nào về mặt lý thuyết?
10. Bulk UPDATE qua `@Query` không `clearAutomatically`: trong cùng transaction, đọc lại entity trả về cũ — tại sao? Persistent Context là gì?

**Đáp án:** Tự tra trong các file `*-explained.md` tương ứng (mỗi câu đều có link "Đọc thêm" phía trên).

---

## 🆕 Bổ sung 2026-06 — Pitfall mới gặp khi refactor

### 29. Liquibase T-SQL `splitStatements` mặc định = true

**Triệu chứng:** Migration chứa block T-SQL với DECLARE/CURSOR/WHILE/IF → fail "Must declare the scalar variable @today" hoặc "syntax incorrect".

**Nguyên nhân:** Liquibase mặc định split SQL theo `;` → biến local DECLARE chỉ valid trong 1 statement → split → mất biến.

**Sai:**
```xml
<changeSet id="seed-showtimes" author="cinex">
    <sql>
        DECLARE @today DATETIME2 = GETDATE();
        DECLARE @movieId BIGINT = 1;
        INSERT INTO showtimes (movie_id, start_time, ...)
        VALUES (@movieId, DATEADD(DAY, 1, @today), ...);
    </sql>
</changeSet>
```

Liquibase split thành 3 statement riêng → `@today` không tồn tại ở statement INSERT.

**Đúng:**
```xml
<changeSet id="seed-showtimes" author="cinex">
    <sql splitStatements="false" endDelimiter="GO">
        DECLARE @today DATETIME2 = GETDATE();
        DECLARE @movieId BIGINT = 1;
        INSERT INTO showtimes (movie_id, start_time, ...)
        VALUES (@movieId, DATEADD(DAY, 1, @today), ...);
    </sql>
</changeSet>
```

**Khi nào cần `splitStatements="false"`?**
- T-SQL DECLARE local variable
- T-SQL CURSOR
- T-SQL WHILE / IF block
- Stored procedure body

**Đọc thêm:** [database/02-liquibase-guide.md](database/02-liquibase-guide.md) mục "SQL Server gotchas".

### 30. Vietnamese encoding mất dấu trong SQL Server (thiếu `N'` prefix)

**Triệu chứng:** INSERT data tiếng Việt → query ra "B?p rang b?" thay vì "Bắp rang bơ". Hoặc "B¿p rang b¿".

**Nguyên nhân:** SQL Server default collation Latin1 → string literal không có prefix `N` → ép sang VARCHAR (1 byte) → mất Unicode → dấu thành `?`.

**Sai:**
```xml
<sql>
    INSERT INTO snacks (name, description, price)
    VALUES ('Bắp rang bơ', 'Snack truyền thống', 50000);
</sql>
```

→ DB lưu `'B?p rang b?'`.

**Đúng:**
```xml
<sql>
    INSERT INTO snacks (name, description, price)
    VALUES (N'Bắp rang bơ', N'Snack truyền thống', 50000);
</sql>
```

`N'...'` báo SQL Server: "đây là Unicode literal" → DB lưu đầy đủ.

**Lưu ý:**
- Cột phải là `NVARCHAR` (không phải `VARCHAR`) để chứa Unicode
- `N'` prefix phải apply CHO MỌI string literal tiếng Việt
- Liquibase migration fix-forward: tạo changeset mới `UPDATE ... SET col = N'value' WHERE id = X`, KHÔNG sửa changeset cũ

**Migration mẫu fix encoding:** `017-fix-system-config-encoding.xml`

### 31. XML escape ký tự đặc biệt trong Liquibase changeset

**Triệu chứng:** Build fail "The reference to entity 'Jerry' must end with the ';' delimiter."

**Nguyên nhân:** Ký tự `&` trong XML content được interpret là entity reference (vd `&amp;`, `&lt;`). Chữ tự do `&` raw → XML parser fail.

**Sai:**
```xml
<sql>
    INSERT INTO movies (title) VALUES (N'Tom & Jerry');
</sql>
```

XML parser thấy `& Jerry` → tìm `;` để đóng entity → fail.

**Đúng:**
```xml
<sql>
    INSERT INTO movies (title) VALUES (N'Tom &amp; Jerry');
</sql>
```

**5 ký tự cần escape trong XML:**
| Ký tự | Escape |
|---|---|
| `&` | `&amp;` |
| `<` | `&lt;` |
| `>` | `&gt;` |
| `"` | `&quot;` (trong attribute) |
| `'` | `&apos;` (trong attribute) |

**Alternative:** dùng `<![CDATA[...]]>` để bao quanh raw SQL:
```xml
<sql><![CDATA[
    INSERT INTO movies (title) VALUES (N'Tom & Jerry');
]]></sql>
```

### 32. Cache name không khai báo trong `CacheManager`

**Triệu chứng:** App start OK, gọi endpoint có `@Cacheable` → `IllegalArgumentException: Cannot find cache named 'stats-top-movie-runs' for ...`.

**Nguyên nhân:** Spring `@Cacheable("name")` ref tới cache name. `CacheManager` chỉ biết các cache đăng ký trong config. Quên thêm → runtime fail.

**Sai:**
```java
@Configuration
@EnableCaching
public class CacheConfig {
    @Bean
    public CacheManager cacheManager() {
        return new CaffeineCacheManager(
            "stats-overview",
            "stats-revenue"
            // ← QUÊN "stats-top-movie-runs"
        );
    }
}

@Service
public class StatisticsService {
    @Cacheable("stats-top-movie-runs")  // ← runtime fail
    public List<TopMovieRun> getTopMovieRuns(...) { ... }
}
```

**Đúng:**
```java
@Bean
public CacheManager cacheManager() {
    CaffeineCacheManager manager = new CaffeineCacheManager(
        "stats-overview",
        "stats-revenue",
        "stats-top-movie-runs",  // ← thêm
        "stats-occupancy"
    );
    manager.setCaffeine(Caffeine.newBuilder()
        .expireAfterWrite(Duration.ofSeconds(60))
        .maximumSize(100));
    return manager;
}
```

**Alternative:** dùng `CaffeineCacheManager` với `setCacheNames(Set)` hoặc bật `setAllowNullValues(false)` + dynamic creation.

**Khi nào hay quên?** Thêm `@Cacheable` mới vào service nhưng quên update config. Convention: TIM `@Cacheable` qua `grep` trước khi thêm cache mới.

**Đọc thêm:** [explainer/caching-strategy.md](explainer/caching-strategy.md).

---

## 🆕 Checklist khi sửa Liquibase migration (cập nhật 2026-06)

Trước khi commit Liquibase changeset:

- [ ] String tiếng Việt có prefix `N'...'` không?
- [ ] Cột chứa tiếng Việt khai `NVARCHAR` (không phải `VARCHAR`)?
- [ ] Ký tự `&`, `<`, `>` trong XML có escape không?
- [ ] Block T-SQL DECLARE/CURSOR có `splitStatements="false" endDelimiter="GO"` không?
- [ ] Changeset id unique?
- [ ] Đã chạy `./gradlew bootRun` local để verify migration applies không?
- [ ] Nếu sửa changeset cũ → KHÔNG sửa, tạo changeset MỚI để fix-forward
- [ ] CHECK constraint enum được thêm cho field enum mới?
- [ ] FK quan trọng có index cho cột FK không?
