# Module Notification — Giải thích chi tiết

## 1. Tổng quan
Module Notification gửi **thông báo** cho user khi có sự kiện: thanh toán thành công, khuyến mãi, hệ thống.

- User: xem thông báo, đánh dấu đã đọc, badge số chưa đọc
- System: tự tạo notification khi payment completed (Observer pattern)

---

## 2. Danh sách files

| File | Tác dụng | Design Pattern |
|---|---|---|
| `entity/Notification.java` | Entity — userId, title, content, type, isRead, createdAt | Inheritance (BaseEntity) |
| `entity/NotificationType.java` | Constants: BOOKING, PROMOTION, SYSTEM | — |
| `dto/NotificationResponse.java` | id, title, content, type, isRead, createdAt | DTO Pattern |
| `repository/NotificationRepository.java` | findByUserId (sorted), countUnread, markAllAsRead (bulk JPQL) | Repository Pattern |
| `service/NotificationService.java` | getMyNotifications, markAsRead, markAllAsRead, createNotification | Service Layer |
| `controller/NotificationController.java` | 4 endpoints, @PreAuthorize("isAuthenticated()") trên class | MVC Controller |
| `event/PaymentCompletedEvent.java` | Event object chứa thông tin payment | Observer Pattern |
| `event/PaymentEventListener.java` | @EventListener nhận event → gọi createNotification | Observer Pattern |

---

## 3. Design Patterns đã áp dụng

### Observer Pattern (Behavioral)
**Giải thích đời thường:** Bạn subscribe channel YouTube → mỗi khi kênh đăng video mới, YouTube tự động gửi thông báo cho bạn. YouTube (Publisher) không biết bạn là ai — chỉ "phát sóng" sự kiện. Bạn (Subscriber) tự đăng ký nhận.

**Trong code:**
```
PaymentService (Publisher)      PaymentEventListener (Subscriber)
        |                                   |
        |-- publish PaymentCompletedEvent ->|
        |   (không cần biết ai nghe)        |-- handlePaymentCompleted()
        |                                   |   └─ notificationService.createNotification()
        |                                   |   └─ emailService.sendConfirmation() (tương lai)
```

```java
// PaymentService chỉ publish event — KHÔNG gọi NotificationService trực tiếp
applicationEventPublisher.publishEvent(new PaymentCompletedEvent(booking));

// PaymentEventListener lắng nghe và xử lý
@EventListener
public void handlePaymentCompleted(PaymentCompletedEvent event) {
    notificationService.createNotification(
        event.getUserId(),
        "Thanh toán thành công",
        "Vé " + event.getBookingCode() + " đã được xác nhận",
        NotificationType.BOOKING
    );
}
```

**Lợi ích Loose Coupling:** PaymentService KHÔNG import NotificationService. Muốn thêm "gửi email sau khi thanh toán" → chỉ thêm EmailEventListener, không sửa PaymentService.

### Bulk Update với @Modifying (Performance)
**Giải thích đời thường:** Giống gửi thông báo hàng loạt cho cả lớp — thay vì gõ tên từng người (100 lần), giáo viên đăng lên bảng thông báo chung (1 lần).

```java
// CHẬM: load 100 entity → set từng cái → save 100 lần = 101 queries
List<Notification> all = repo.findUnread(userId);
all.forEach(n -> n.setIsRead(true));
repo.saveAll(all); // 100 UPDATE queries!

// NHANH: 1 JPQL UPDATE = 1 query duy nhất
@Modifying
@Transactional
@Query("UPDATE Notification n SET n.isRead = true WHERE n.user.id = :userId AND n.isRead = false")
void markAllAsReadByUserId(Long userId);
```

### IDOR Prevention (Security)
**IDOR = Insecure Direct Object Reference** — lỗi cho phép user A truy cập/sửa dữ liệu của user B bằng cách đoán ID.

```java
// Ví dụ lỗi IDOR: PUT /api/notifications/999/read
// Nếu notification 999 thuộc user B nhưng user A gửi request → phải chặn!
public void markAsRead(Long notificationId, Long currentUserId) {
    Notification notification = repo.findById(notificationId)
        .orElseThrow(() -> new BusinessException(ENTITY_NOT_FOUND));

    // IDOR check: notification có thuộc user đang request không?
    if (!notification.getUser().getId().equals(currentUserId)) {
        throw new BusinessException(ErrorCode.FORBIDDEN);
        // Trả 403, không phải 404 (tránh leak thông tin)
    }
    notification.setIsRead(true);
    repo.save(notification);
}
```

---

## 4. Sơ đồ luồng xử lý

### Luồng tự động tạo notification sau payment

```
[PaymentService.completePayment()]
    |
    +---> Cập nhật booking status → CONFIRMED
    +---> Cập nhật payment status → SUCCESS
    |
    +---> applicationEventPublisher.publishEvent(
    |         new PaymentCompletedEvent(
    |           userId, bookingId, bookingCode, totalAmount
    |         )
    |     )
    |
    v (Spring Event Bus — bất đồng bộ qua @Async, chạy trên thread riêng)
    |
[PaymentEventListener.handlePaymentCompleted(event)]
    |
    +---> notificationService.createNotification(
    |         userId,
    |         "Thanh toán thành công",
    |         "Vé CX-20260524-001 trị giá 250.000đ đã được xác nhận",
    |         NotificationType.BOOKING
    |     )
    |
    v
[NotificationRepository.save(notification)]
    |
INSERT INTO notifications (...) VALUES (...)
    |
    v
Notification lưu DB, user có badge mới
```

### Luồng user đọc thông báo (GET /api/notifications/me)

```
User gửi GET /api/notifications/me?page=0&size=10
    |
    v
[JwtAuthFilter] → lấy userId từ JWT
    |
    v
[NotificationController.getMyNotifications()]
    |
    v
[NotificationService.getMyNotifications(userId, pageable)]
    |
    +---> notificationRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable)
    |     SQL: SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC
    |
    v
Page<Notification> → Page<NotificationResponse>
    |
    v
ApiResponse<PageResponse<NotificationResponse>>
```

### Luồng đánh dấu đã đọc (PUT /api/notifications/{id}/read)

```
User gửi PUT /api/notifications/5/read
    |
    v
[NotificationController.markAsRead(id)]
    |
    v
[NotificationService.markAsRead(id, userId)]
    |
    +---> Load: notificationRepository.findById(5)
    |     └─ not found → throw ENTITY_NOT_FOUND (404)
    |
    +---> IDOR check: notification.userId == currentUserId?
    |     └─ KHÔNG → throw FORBIDDEN (403)
    |
    +---> notification.setIsRead(true)
    +---> notificationRepository.save(notification)
    |
    v
ApiResponse (200 OK)
```

### Luồng đánh dấu tất cả đã đọc (PUT /api/notifications/read-all)

```
User gửi PUT /api/notifications/read-all
    |
    v
[NotificationService.markAllAsRead(userId)]
    |
    +---> notificationRepository.markAllAsReadByUserId(userId)
    |     SQL: UPDATE notifications SET is_read = 1
    |          WHERE user_id = ? AND is_read = 0
    |     → 1 query duy nhất, không cần load entities!
    |
    v
ApiResponse (200 OK)
```

---

## 5. SQL được sinh ra

### INSERT notification (khi payment completed)
```sql
INSERT INTO notifications (user_id, title, content, type, is_read, created_at, updated_at, version)
VALUES (
  10,
  N'Thanh toán thành công',
  N'Vé CX-20260524-001 trị giá 250.000đ đã được xác nhận',
  'BOOKING',
  0,
  GETDATE(), GETDATE(), 0
)
```

### SELECT danh sách thông báo của user
```sql
-- findByUserIdOrderByCreatedAtDesc(userId, pageable)
SELECT *
FROM notifications
WHERE user_id = 10
ORDER BY created_at DESC
OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY
```

### SELECT số thông báo chưa đọc
```sql
-- countByUserIdAndIsReadFalse(userId)
SELECT COUNT(*)
FROM notifications
WHERE user_id = 10 AND is_read = 0
```

### UPDATE đánh dấu 1 notification đã đọc
```sql
UPDATE notifications
SET is_read = 1, updated_at = GETDATE(), version = version + 1
WHERE id = 5
```

### BULK UPDATE — đánh dấu tất cả đã đọc
```sql
-- @Modifying @Query — 1 query duy nhất thay vì N queries
UPDATE notifications
SET is_read = 1
WHERE user_id = 10 AND is_read = 0
```

So sánh performance:
- **Không dùng @Modifying:** load 50 record → 50 UPDATE queries = **51 queries**
- **Dùng @Modifying:** **1 query duy nhất** — nhanh hơn 50 lần!

---

## 6. Annotation/API mới sử dụng

| Annotation | Tác dụng | Ví dụ |
|---|---|---|
| `@EventListener` | Method sẽ được gọi khi Spring publish event cùng loại | `@EventListener void handle(PaymentCompletedEvent e)` |
| `@Modifying` | Báo Spring đây là query UPDATE/DELETE, không phải SELECT | Kết hợp với `@Query` trên method |
| `@Transactional` trên @Modifying | Bulk update cần transaction riêng (không dùng readOnly) | `@Transactional @Modifying @Query(...)` |
| `@Query(...)` | Viết JPQL tùy chỉnh — UPDATE, SELECT với logic phức tạp | `@Query("UPDATE Notification n SET n.isRead = true WHERE ...")` |
| `@PreAuthorize("isAuthenticated()")` | Đặt trên class Controller — áp dụng cho tất cả method | `@PreAuthorize("isAuthenticated()") class NotificationController` |
| `ApplicationEventPublisher` | Bean Spring để publish event | `eventPublisher.publishEvent(new PaymentCompletedEvent(...))` |
| `getReferenceById(id)` | Tạo proxy entity (không query DB) để set FK | `userRepository.getReferenceById(userId)` — tiết kiệm 1 SELECT |

---

## 7. Khái niệm cần biết

### @Modifying — tại sao cần?
Spring Data mặc định cho rằng `@Query` là SELECT. Khi bạn viết UPDATE/DELETE, phải thêm `@Modifying` để báo Spring "đây không phải SELECT — không cache kết quả, flush và clear EntityManager".

```java
// Thiếu @Modifying → Spring throw InvalidDataAccessApiUsageException
@Query("UPDATE Notification n SET n.isRead = true WHERE n.user.id = :userId")
void markAllAsReadByUserId(Long userId); // LỖI!

// Đúng:
@Modifying
@Query("UPDATE Notification n SET n.isRead = true WHERE n.user.id = :userId")
void markAllAsReadByUserId(Long userId); // OK
```

### getReferenceById() vs findById()
```java
// findById → SELECT * FROM users WHERE id = 10 (query thật)
User user = userRepository.findById(userId).orElseThrow(...);

// getReferenceById → tạo proxy, KHÔNG query DB
// Chỉ dùng để set FK — khi save notification, Hibernate tự biết FK là 10
User user = userRepository.getReferenceById(userId);
notification.setUser(user); // chỉ lưu FK, không cần load toàn bộ User
```

### Spring Events trong CineX — bất đồng bộ qua @Async

**Mặc định Spring**, `@EventListener` chạy **đồng bộ** trong cùng thread và cùng transaction với publisher → nếu listener lỗi thì transaction rollback luôn (cả payment).

**Trong CineX**, `PaymentEventListener.handlePaymentCompleted()` được đánh dấu `@Async @EventListener` (xem `payment/listener/PaymentEventListener.java:39-40`). Hệ quả:

- PaymentService publish event → **return ngay** (không chờ listener).
- Listener chạy trên **thread riêng** lấy từ pool của `TaskExecutor`.
- Listener gửi email (chậm) hoặc tạo notification → **không block response** trả về client.
- Nếu listener lỗi (vd SMTP timeout) → **payment vẫn thành công**, transaction payment đã commit từ trước.

**Điều kiện để @Async hoạt động:** class `CineXApplication` phải có `@EnableAsync` — nếu thiếu, annotation `@Async` bị bỏ qua âm thầm, listener lại chạy đồng bộ.

**Cảnh báo race condition:** vì `@Async` chạy trên thread khác, listener có thể chạy **trước khi** transaction của PaymentService commit xong → query DB thấy data cũ. Nếu cần đợi commit trước, đổi sang `@TransactionalEventListener(phase = AFTER_COMMIT)` thay cho `@EventListener` thường (chi tiết xem [10-payment-explained.md](10-payment-explained.md) mục @Async).

### Bulk update (markAllAsRead)
```java
// Thay vì load 100 notification → set isRead = true → save 100 lần
// Dùng 1 JPQL UPDATE query:
@Modifying
@Query("UPDATE Notification n SET n.isRead = true WHERE n.user.id = :userId AND n.isRead = false")
void markAllAsReadByUserId(Long userId);
// → 1 query thay vì 100 queries
```

### Internal API (createNotification)
```java
// Không có endpoint public — chỉ gọi từ service khác
public void createNotification(Long userId, String title, String content, String type) {
    Notification notification = Notification.builder()
        .user(userRepository.getReferenceById(userId))
        .title(title).content(content).type(type)
        .build();
    notificationRepository.save(notification);
}
```

### Tích hợp Observer Pattern
```java
// PaymentEventListener tự động tạo notification khi payment thành công
@EventListener
public void handlePaymentCompleted(PaymentCompletedEvent event) {
    notificationService.createNotification(
        event.getUserId(),
        "Thanh toán thành công",
        "Vé " + event.getBookingCode() + " đã xác nhận",
        NotificationType.BOOKING
    );
}
// PaymentService KHÔNG biết NotificationService → loose coupling
```

### Ownership check (IDOR prevention)
```java
// markAsRead kiểm tra notification thuộc đúng user
if (!notification.getUser().getId().equals(userId)) {
    throw new BusinessException(ErrorCode.FORBIDDEN);
}
// Tránh: user A đánh dấu notification user B đã đọc
```

---

## 8. Request/Response mẫu

### GET /api/notifications/me — danh sách thông báo
```bash
curl -X GET "http://localhost:8088/api/notifications/me?page=0&size=10" \
  -H "Authorization: Bearer <token>"
```

**Response thành công (200):**
```json
{
  "success": true,
  "data": {
    "content": [
      {
        "id": 3,
        "title": "Thanh toán thành công",
        "content": "Vé CX-20260524-001 trị giá 250.000đ đã được xác nhận",
        "type": "BOOKING",
        "isRead": false,
        "createdAt": "2026-05-24T10:30:00"
      },
      {
        "id": 2,
        "title": "Khuyến mãi tháng 5",
        "content": "Giảm 20% vé xem phim cuối tuần",
        "type": "PROMOTION",
        "isRead": true,
        "createdAt": "2026-05-20T09:00:00"
      }
    ],
    "totalElements": 5,
    "totalPages": 1,
    "page": 0,
    "size": 10
  }
}
```

**Response lỗi — chưa đăng nhập (401):**
```json
{
  "success": false,
  "errorCode": "UNAUTHORIZED",
  "message": "Vui lòng đăng nhập để xem thông báo"
}
```

### GET /api/notifications/me/unread-count — đếm chưa đọc
```bash
curl -X GET http://localhost:8088/api/notifications/me/unread-count \
  -H "Authorization: Bearer <token>"
```

**Response thành công (200):**
```json
{
  "success": true,
  "data": 3
}
```

### PUT /api/notifications/{id}/read — đánh dấu 1 thông báo đã đọc
```bash
curl -X PUT http://localhost:8088/api/notifications/3/read \
  -H "Authorization: Bearer <token>"
```

**Response thành công (200):**
```json
{
  "success": true,
  "message": "Notification marked as read"
}
```

**Response lỗi — không phải của mình (403):**
```json
{
  "success": false,
  "errorCode": "FORBIDDEN",
  "message": "Bạn không có quyền đọc thông báo này"
}
```

**Response lỗi — không tìm thấy (404):**
```json
{
  "success": false,
  "errorCode": "ENTITY_NOT_FOUND",
  "message": "Notification không tồn tại"
}
```

### PUT /api/notifications/read-all — đánh dấu tất cả đã đọc
```bash
curl -X PUT http://localhost:8088/api/notifications/read-all \
  -H "Authorization: Bearer <token>"
```

**Response thành công (200):**
```json
{
  "success": true,
  "message": "All notifications marked as read"
}
```

---

## 9. Câu hỏi tự kiểm tra

1. **markAllAsRead dùng bulk JPQL thay vì load từng record vì sao?** → 1 query thay vì N queries (N = số notification chưa đọc). Nhanh hơn nhiều khi user có 100+ notification tồn đọng.
2. **createNotification là internal API — sao không có endpoint?** → Notification do hệ thống tự tạo (khi payment completed, booking confirmed), không phải user tự gửi thông báo cho mình.
3. **NotificationType dùng static String thay vì enum vì sao?** → Linh hoạt hơn: thêm type mới không cần sửa enum class và không cần migration DB. Enum thích hợp khi giá trị fixed và ít thay đổi.
4. **Tại sao không trả 404 khi user cố đọc notification của người khác?** → Trả 403 FORBIDDEN thay vì 404 NOT_FOUND. Lý do: 404 vô tình "leak" thông tin — user biết ID đó có tồn tại. 403 an toàn hơn: chỉ báo "không có quyền" mà không tiết lộ gì thêm.
5. **Spring Event mặc định chạy đồng bộ hay bất đồng bộ? CineX dùng cách nào?** → Mặc định Spring là **đồng bộ** — listener cùng thread, cùng transaction với publisher; listener lỗi sẽ rollback luôn payment. Riêng CineX đánh dấu `PaymentEventListener.handlePaymentCompleted` bằng `@Async @EventListener` để chạy **bất đồng bộ trên thread riêng** — gửi email/notification thất bại không ảnh hưởng payment. Điều kiện: class main phải có `@EnableAsync`, nếu không `@Async` bị bỏ qua âm thầm và lại chạy đồng bộ.
