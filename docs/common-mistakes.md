# 30 lỗi hay gặp khi code CineX + cách fix

> Mở rộng từ 10 lỗi gốc. Xem thêm:
> - [`backend/15-common-pitfalls.md`](backend/15-common-pitfalls.md) — Top 20 bug Spring chi tiết với code reproduce
> - [`frontend/15-react-pitfalls.md`](frontend/15-react-pitfalls.md) — Top 18 bug React/TS/Tailwind

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

**Quy tắc:** KHÔNG BAO GIỜ trả entity cho client. Luôn dùng Response DTO.

---

## 2. @ManyToOne fetch = EAGER → N+1 query

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

**Quy tắc:** @ManyToOne, @ManyToMany luôn dùng `LAZY`.

---

## 3. Thiếu @Transactional → data không nhất quán

```java
// ❌ SAI — không có @Transactional
public void holdSeats(request) {
    bookingRepository.save(booking);    // Bước 1: OK
    bookingSeatRepository.save(seat1);  // Bước 2: OK
    bookingSeatRepository.save(seat2);  // Bước 3: LỖI!
    // → Booking tạo rồi nhưng seat2 chưa tạo → data bất nhất quán!
}

// ✅ ĐÚNG — @Transactional: tất cả hoặc không
@Transactional
public void holdSeats(request) {
    bookingRepository.save(booking);
    bookingSeatRepository.save(seat1);
    bookingSeatRepository.save(seat2);  // LỖI → rollback TẤT CẢ → sạch sẽ
}
```

**Quy tắc:** Method nào ghi DB (save, update, delete) → phải có @Transactional.

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

**Quy tắc:** Changeset đã chạy = bất khả xâm phạm. Muốn thay đổi → tạo changeset mới.

---

## 6. Quên @EnableMethodSecurity → @PreAuthorize vô tác dụng

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

---

## 9. Lombok @Builder bỏ qua giá trị mặc định

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

---

## 10. GlobalExceptionHandler không log → bug biến mất

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

---

## 11. Self-invocation của `@Transactional`/`@Async`

`this.method()` bypass AOP proxy → annotation không activate.

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

**Fix**: inject self `@Lazy` hoặc tách bean. Chi tiết xem `backend/15-common-pitfalls.md` mục #1.

---

## 12. Quên `@EnableAsync` / `@EnableScheduling` / `@EnableJpaAuditing`

Annotation `@Async`, `@Scheduled`, `@CreatedDate` chỉ activate khi có `@Enable*` ở class config. Quên → annotation bị bỏ qua âm thầm.

```java
@SpringBootApplication
@EnableAsync
@EnableScheduling
@EnableJpaAuditing  // ← bắt buộc cho audit fields
public class CineXApplication { ... }
```

---

## 13. `@OneToMany` / `@ManyToOne` fetch type

`@ManyToOne` mặc định EAGER → mỗi lần load entity, Hibernate JOIN cả relationship → query nặng. `@OneToMany` mặc định LAZY → trở thành N+1 nếu loop access.

```java
@ManyToOne(fetch = FetchType.LAZY)  // ← override default
private User user;
```

**Quy ước**: TẤT CẢ relationship LAZY, fetch khi cần qua `@EntityGraph` hoặc `JOIN FETCH`.

---

## 14. Mock entity với `@Data` Lombok

```java
@Entity
@Data  // ❌ nguy hiểm
public class Movie extends BaseEntity {
    @ManyToMany private Set<Genre> genres;
}
```

3 vấn đề:
1. `toString()` bidirectional → stack overflow
2. `equals/hashCode` resolve lazy → N+1
3. hashCode đổi sau khi id assigned → Set lưu sai

**Fix**: `@Getter @Setter @NoArgsConstructor @AllArgsConstructor @SuperBuilder` thay `@Data`.

---

## 15. Tailwind dynamic class

```tsx
<span className={`bg-${color}-500`}>  // ❌ KHÔNG hoạt động
```

Tailwind scan compile-time bằng regex. `bg-${color}-500` là runtime → CSS không có rule.

**Fix**: map object:
```tsx
const COLORS = { red: "bg-red-500", green: "bg-green-500" };
<span className={COLORS[color]}>
```

---

## 16. Stale closure trong setInterval/setTimeout

```tsx
useEffect(() => {
  setInterval(() => {
    console.log(count);  // luôn log giá trị cũ
  }, 1000);
}, []);  // deps rỗng → capture count = 0 forever
```

**Fix**: functional setState (`setCount(c => c + 1)`) hoặc `useRef` giữ giá trị mới nhất.

---

## 17. WebSocket connect 2 lần trong React StrictMode

```tsx
useEffect(() => {
  const client = createStompClient();
  client.activate();
  // ❌ thiếu cleanup → connect 2 lần trong dev → ghost connection
}, []);
```

**Fix**:
```tsx
useEffect(() => {
  const client = createStompClient();
  client.activate();
  return () => client.deactivate();
}, []);
```

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

**Fix**: dùng `axios.post` thẳng cho `/auth/refresh`, bypass interceptor.

---

## 19. Mutation success không invalidate query

```tsx
const mutation = useMutation({
  mutationFn: (data) => api.post("/movies", data),
  // ❌ Sau khi tạo thành công, list UI không cập nhật
});
```

**Fix**:
```tsx
const mutation = useMutation({
  mutationFn: (data) => api.post("/movies", data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["movies"] });
  },
});
```

---

## 20. Race condition khi đặt ghế

2 user click cùng ghế A1. Không có lock → cả 2 đều save → 2 booking cùng ghế.

**Fix kết hợp**:
1. Pessimistic Lock ở Service: `@Lock(PESSIMISTIC_WRITE)` khi check seat
2. UNIQUE constraint DB: `(showtime_id, seat_id)` WHERE `status IN ('HELD','BOOKED')`
3. Frontend optimistic UI + revert khi error

---

## 21. Idempotency Payment Callback

MoMo có thể gửi callback 2 lần (network retry). Code SAI:
```java
public void handleCallback(...) {
    payment.setStatus(SUCCESS);
    booking.setStatus(CONFIRMED);
    sendEmail();   // ← gửi 2 email!
}
```

**Fix**:
```java
public void handleCallback(...) {
    if (payment.getStatus() == SUCCESS) {
        return;  // ← đã xử lý, skip
    }
    payment.setStatus(SUCCESS);
    ...
}
```

---

## 22. JWT lưu localStorage XSS risk

```ts
localStorage.setItem("accessToken", token);  // ❌ XSS đọc được
```

**Mitigation**:
- CSP header
- KHÔNG `dangerouslySetInnerHTML` cho user input
- DOMPurify cho rich text
- React auto-escape JSX
- HttpOnly cookie thay localStorage (trade-off với CSRF)

---

## 23. Notification không invalidate sau mutation read

```tsx
const markAsReadMutation = useMutation({
  mutationFn: (id) => api.patch(`/notifications/${id}/read`),
  // ❌ Badge count không cập nhật
});
```

**Fix**: invalidate cả `notifications` và `unread-count`:
```ts
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["notifications"] });
  queryClient.invalidateQueries({ queryKey: ["unread-count"] });
}
```

---

## 24. Quên cleanup WebSocket subscription

```tsx
useEffect(() => {
  client.subscribe("/topic/showtime/10/seats", handler);
  // ❌ Không unsubscribe → leak khi unmount
}, []);
```

**Fix**:
```tsx
useEffect(() => {
  const sub = client.subscribe("/topic/showtime/10/seats", handler);
  return () => sub.unsubscribe();
}, []);
```

---

## 25. Trang protected redirect mất context

```tsx
function ProtectedRoute({ children }) {
  if (!isAuth) return <Navigate to="/login" />;  // ❌ Mất context "đang từ đâu"
  return children;
}
```

User login xong về `/` thay vì trang gốc.

**Fix**: lưu `state.from`:
```tsx
if (!isAuth) return <Navigate to="/login" state={{ from: location }} replace />;
// LoginPage đọc state.from sau khi login → navigate về đúng trang
```

---

## 26. Spec query không distinct → duplicate row

```java
Specification<Movie> spec = (root, query, cb) -> {
    root.join("genres");  // INNER JOIN → 1 movie có 3 genre → 3 row
    return cb.equal(...);
};
```

**Fix**: `query.distinct(true)` hoặc dùng `EXISTS` subquery thay JOIN.

---

## 27. Index không có cho cột query thường xuyên

Cột `bookings.user_id`, `bookings.showtime_id` không có index → list "vé của tôi" chạy full scan 100k row.

**Fix**: bổ sung index ở Liquibase:
```xml
<createIndex tableName="bookings" indexName="idx_bookings_user_created">
    <column name="user_id"/>
    <column name="created_at" descending="true"/>
</createIndex>
```

---

## 28. Bulk update không có `clearAutomatically`

```java
@Modifying
@Query("UPDATE Notification SET isRead = true WHERE userId = :id")
int markAllAsRead(Long id);
```

Sau UPDATE bulk, persistent context vẫn giữ entity cũ → query tiếp đọc stale data.

**Fix**: `@Modifying(clearAutomatically = true)`.

---

## 29. Token refresh race condition

5 widget gọi 5 API song song → 5 fail 401 → 5 refresh song song.

**Fix**: failedQueue pattern — chỉ 1 refresh, 4 request đợi token mới rồi retry.

---

## 30. `@Builder` skip BaseEntity fields

```java
User u = User.builder().id(1L).username("vanan").build();
// ❌ id() không exist nếu User extends BaseEntity
```

**Fix**: `@SuperBuilder` cho cả BaseEntity và subclass.
