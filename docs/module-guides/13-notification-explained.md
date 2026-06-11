# Module Notification — Giải thích chi tiết

## 1. Tổng quan
Module Notification gửi **thông báo** cho user khi có sự kiện: thanh toán thành công, khuyến mãi, hệ thống.

- User: xem thông báo, đánh dấu đã đọc, badge số chưa đọc
- System: tự tạo notification khi payment completed (Observer pattern)

---

## 2. Danh sách files

| File | Tác dụng | Design Pattern |
|---|---|---|
| `module/notification/entity/Notification.java` | Entity **extends BaseEntity** (refactor changeset 046). Có đủ `id`, `version` (Optimistic Lock), `storageState` (Soft Delete), audit `createdBy/updatedBy/createdAt/updatedAt`. Field nghiệp vụ: `user`, `title`, `content`, `type` (String), `isRead`. | Inheritance (BaseEntity) |
| `module/notification/entity/NotificationType.java` | Constants: BOOKING, PROMOTION, SYSTEM (dùng dạng `String` chứ không phải enum) | — |
| `module/notification/dto/NotificationFilter.java` | type, isRead, createdFrom, createdTo. **KHÔNG có userId** — lấy từ SecurityContext để chống IDOR. | Filter DTO |
| `module/notification/dto/NotificationResponse.java` | id, title, content, type, isRead, createdAt | DTO Pattern |
| `module/notification/specification/NotificationSpecification.java` | `fromFilter(filter, userId)` — userId là param BẮT BUỘC, không nằm trong DTO. | Specification |
| `module/notification/repository/NotificationRepository.java` | findByUserId, countUnread, markAllAsRead (bulk JPQL), `deleteReadOlderThan`, `deleteOlderThan` | Repository + JpaSpecificationExecutor |
| `module/notification/service/NotificationService.java` | listNotifications (filter), markAsRead, markAllAsRead, createNotification (push WebSocket per-user) | Service Layer |
| `module/notification/service/NotificationCleanupScheduler.java` | **MỚI** — cron 04:00 mỗi ngày, dọn notification đã đọc >90 ngày + tất cả >180 ngày. @SchedulerLock. | Scheduled + Distributed Lock |
| `module/notification/controller/NotificationController.java` | 4 endpoints, @PreAuthorize("isAuthenticated()") trên class | MVC Controller |
| `module/payment/event/PaymentCompletedEvent.java` | Event object — extends `ApplicationEvent`, chỉ chứa field `Payment payment` (lấy mọi thông tin booking/user từ đây) | Observer Pattern |
| `module/payment/listener/PaymentEventListener.java` | @Async @EventListener — nhận event → tạo notification + gửi email + sinh QR | Observer Pattern |
| `db/changelog/changes/046-notification-base-entity.xml` | Migration thêm cột version, storage_state, created_by, updated_by, updated_at + backfill row cũ. | Liquibase Changelog |
| `db/changelog/changes/039-idx-notifications-user-isread.xml` | Compound index `(user_id, is_read, created_at DESC)` cho inbox + badge "chưa đọc". | Index Tuning |

> **Lưu ý kiến trúc:** `PaymentCompletedEvent` và `PaymentEventListener` THUỘC module `payment` (xem path `module/payment/event/` và `module/payment/listener/`), KHÔNG thuộc module `notification`. Lý do: event là "phát thanh viên" của module payment; module notification chỉ là 1 trong nhiều subscriber. Nếu để event trong module notification thì coupling ngược lại — payment phải import notification để publish event.

> **Refactor lớn (Phase 4-5):** Trước đây `Notification` tự khai báo `@Id` + `createdAt` thủ công, KHÔNG extends BaseEntity → khác pattern toàn dự án (không có version, không audit, không soft-delete được). Changeset `046-notification-base-entity` đưa entity này về cùng pattern. Migration safe: (1) add nullable columns + default cho row mới, (2) backfill row cũ (`version=0`, `storage_state='ACTIVE'`, `updated_at=created_at`, `created_by/updated_by='system'`), (3) add NOT NULL constraint cho `version` + `storage_state`.

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
// Constructor: PaymentCompletedEvent(Object source, Payment payment)
applicationEventPublisher.publishEvent(new PaymentCompletedEvent(this, payment));

// PaymentEventListener lắng nghe và xử lý
@Async
@EventListener
public void handlePaymentCompleted(PaymentCompletedEvent event) {
    Payment payment = event.getPayment();
    Booking booking = payment.getBooking();
    String bookingCode = booking.getBookingCode();

    // POS bán vé khách vãng lai: booking.user == null → skip
    if (booking.getUser() == null) return;

    Long userId = booking.getUser().getId();
    notificationService.createNotification(
        userId,
        "Thanh toán thành công",
        "Vé " + bookingCode + " đã được xác nhận. Chúc bạn xem phim vui vẻ!",
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

### IDOR Prevention trong Filter (Phase 4)
**Vấn đề mở rộng:** API list `/api/notifications/me` cho phép FE filter (theo `type`, `isRead`, `createdFrom`, `createdTo`...). Nếu để `userId` trong `NotificationFilter` DTO và Spring tự bind từ query param, user A có thể gửi `?userId=99` → đọc lén inbox của user 99.

**Giải pháp CineX:** `NotificationFilter` cố tình **KHÔNG có field `userId`**. Trong Specification:

```java
// NotificationFilter.java — chỉ có 4 field, KHÔNG có userId
@Getter @Setter
public class NotificationFilter {
    private String type;
    private Boolean isRead;
    private LocalDateTime createdFrom;
    private LocalDateTime createdTo;
}

// NotificationSpecification.fromFilter — userId TRUYỀN RIÊNG, không từ DTO
public static Specification<Notification> fromFilter(NotificationFilter filter, Long userId) {
    Specification<Notification> spec = Specification.where(hasUser(userId)).and(notDeleted());
    // ... if(type) ... if(isRead) ... if(createdBetween) ...
}

// NotificationService.listNotifications — userId lấy từ SecurityContext ở Controller
public Page<NotificationResponse> listNotifications(Long userId, NotificationFilter filter, Pageable pageable) {
    var spec = NotificationSpecification.fromFilter(filter, userId);
    return notificationRepository.findAll(spec, pageable).map(this::toResponse);
}
```

Compiler **bật lỗi nếu thiếu userId** → không lập trình viên nào quên check. Khác với pattern `BookingSpecification` (admin) nơi userId nằm trong filter — admin được phép filter theo userId người khác.

### WebSocket Per-User Destination (Phase 4 — Security)
**Vấn đề:** Trước đây CineX dùng `convertAndSend("/topic/user/{username}/notifications", payload)`. Đây là **broadcast** — bất kỳ ai biết username (rất dễ đoán) cũng có thể subscribe `/topic/user/<victim>/notifications` và đọc lén notification real-time của nạn nhân → **IDOR qua WebSocket**.

**Giải pháp:** `convertAndSendToUser(username, destination, payload)`. Spring tự route message tới session WebSocket có Principal khớp username — không user khác nào tự subscribe được.

```java
// NotificationService.createNotification — push WebSocket sau khi save
simpMessagingTemplate.convertAndSendToUser(
    user.getUsername(),
    "/queue/notifications",
    toResponse(saved)
);

// FE subscribe: stomp.subscribe("/user/queue/notifications", callback)
//                                ^^^^^ prefix /user — Spring tự thay bằng sessionId nội bộ
```

**Cơ chế bên trong:**
```
1. FE subscribe "/user/queue/notifications"
   → Spring nhận, lookup Principal của session này (vd "vanan")
   → Map nội bộ: "/user/<sessionId>/queue/notifications"

2. BE gọi convertAndSendToUser("vanan", "/queue/notifications", payload)
   → Spring lookup tất cả sessionId có Principal="vanan"
   → Gửi tới đích nội bộ "/user/<sessionId>/queue/notifications"
   → Chỉ session của vanan nhận được
```

**Yêu cầu config (đã có sẵn trong WebSocketConfig):**
```java
@Override
public void configureMessageBroker(MessageBrokerRegistry config) {
    config.enableSimpleBroker("/topic", "/queue");
    config.setUserDestinationPrefix("/user");  // BẮT BUỘC cho convertAndSendToUser
}
```

**Cross-ref:** Chi tiết về STOMP Principal binding (FE phải gửi JWT trong `connectHeaders` khi STOMP CONNECT) xem [03-security.md mục WebSocket Authentication](../core-knowledge/03-security.md).

### NotificationCleanupScheduler (Phase 4 — Maintenance)
**Bài toán:** Mỗi booking/payment/voucher đều sinh notification. Sau vài tháng → bảng `notifications` phình to (hàng triệu dòng), query inbox chậm dần, backup tốn dung lượng.

**Chính sách dọn (2 mốc):**
- **>90 ngày + đã đọc** → xóa cứng. User đã xem, không có lý do giữ.
- **>180 ngày** (kể cả chưa đọc) → vẫn xóa. 6 tháng không động vào tức là tài khoản bỏ rơi hoặc spam.

**Code:**
```java
@Component @RequiredArgsConstructor @Slf4j
public class NotificationCleanupScheduler {
    private static final int DAYS_KEEP_READ = 90;
    private static final int DAYS_KEEP_ALL  = 180;

    private final NotificationRepository notificationRepository;

    // Cron "giây phút giờ ngày tháng thứ" = 04:00:00 mỗi ngày
    // Chọn 04:00 vì giờ rảnh, ít traffic, không đụng scheduler khác (00:00, 02:00)
    @Scheduled(cron = "0 0 4 * * *")
    @SchedulerLock(name = "notificationCleanup",
                   lockAtLeastFor = "PT1M", lockAtMostFor = "PT10M")
    @Transactional
    public void cleanupOldNotifications() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime readCutoff = now.minusDays(DAYS_KEEP_READ);
        LocalDateTime allCutoff  = now.minusDays(DAYS_KEEP_ALL);

        // Bước 1: xóa cực cũ trước (giảm row mà bước 2 phải quét)
        int deletedAll = notificationRepository.deleteOlderThan(allCutoff);
        // Bước 2: xóa đã đọc + cũ hơn 90 ngày
        int deletedRead = notificationRepository.deleteReadOlderThan(readCutoff);

        log.info("Notification cleanup: deleted {} old (>{}d) + {} read-old (>{}d)",
                 deletedAll, DAYS_KEEP_ALL, deletedRead, DAYS_KEEP_READ);
    }
}
```

**Repository:**
```java
@Modifying
@Query("DELETE FROM Notification n WHERE n.createdAt < :before AND n.isRead = true")
int deleteReadOlderThan(@Param("before") LocalDateTime before);

@Modifying
@Query("DELETE FROM Notification n WHERE n.createdAt < :before")
int deleteOlderThan(@Param("before") LocalDateTime before);
```

**@SchedulerLock (ShedLock) là gì?**
Khi deploy nhiều instance (rolling update / 2 server load-balance), không có lock thì **mọi instance** đều chạy `@Scheduled` lúc 04:00 → 2-3 query DELETE chạy đồng thời → deadlock SQL Server hoặc query trùng. ShedLock dùng bảng `shedlock` trong DB làm distributed lock — chỉ 1 instance giành được, instance khác skip.

- `lockAtLeastFor = "PT1M"`: giữ lock tối thiểu 1 phút (tránh trường hợp instance A xong nhanh quá rồi instance B chạy lại).
- `lockAtMostFor = "PT10M"`: lock tự release sau 10 phút (phòng instance crash).

---

## 4. Sơ đồ luồng xử lý

### Luồng tự động tạo notification sau payment

```
[PaymentService.handleCallback()]
    |
    +---> Cập nhật booking status → CONFIRMED
    +---> Cập nhật payment status → COMPLETED
    |
    +---> applicationEventPublisher.publishEvent(
    |         new PaymentCompletedEvent(this, payment)
    |         // ApplicationEvent constructor: source + Payment object
    |         // Mọi thông tin booking/user/showtime → đọc qua payment.getBooking()
    |     )
    |
    v (Spring Event Bus — bất đồng bộ qua @Async, chạy trên thread riêng)
    |
[PaymentEventListener.handlePaymentCompleted(event)]
    |
    +---> Payment payment = event.getPayment()
    +---> Booking booking = payment.getBooking()
    +---> if (booking.getUser() == null) return;  // POS khách vãng lai → skip
    +---> Long userId = booking.getUser().getId()
    |
    +---> notificationService.createNotification(
    |         userId,
    |         "Thanh toán thành công",
    |         "Vé " + booking.getBookingCode() + " đã được xác nhận",
    |         NotificationType.BOOKING
    |     )
    |
    +---> byte[] qrCode = qrCodeService.generateQrCode(bookingCode, 200)
    +---> emailService.sendBookingConfirmationEmail(email, bookingCode, ...)
    |
    v
[NotificationRepository.save(notification)]
    |
INSERT INTO notifications (...) VALUES (...)
    |
    v
Notification lưu DB, user có badge mới + email vé có QR
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
-- Notification giờ ĐÃ extends BaseEntity → có version / storage_state / audit
INSERT INTO notifications (
  user_id, title, content, type, is_read,
  version, storage_state, created_at, updated_at, created_by, updated_by
)
VALUES (
  10,
  N'Thanh toán thành công',
  N'Vé CX-20260524-001 trị giá 250.000đ đã được xác nhận',
  'BOOKING',
  0,
  0,            -- version (Optimistic Lock)
  'ACTIVE',     -- storage_state (Soft Delete)
  GETDATE(), GETDATE(),
  'system', 'system'   -- audit (createdBy/updatedBy do JpaAuditing tự set)
)
```

### List có filter (Phase 4)
```sql
-- NotificationSpecification.fromFilter(filter, userId=10) với type=BOOKING, isRead=false
-- userId LẤY TỪ SecurityContext, KHÔNG từ query param → chống IDOR
SELECT n.*
FROM notifications n
WHERE n.user_id = 10                                            -- hasUser(userId) BẮT BUỘC
  AND (n.storage_state IS NULL OR n.storage_state <> 'ARCHIVED') -- notDeleted()
  AND n.type = 'BOOKING'                                         -- if filter.type
  AND n.is_read = 0                                              -- if filter.isRead
  AND n.created_at >= '2026-05-01 00:00:00'                      -- if createdFrom
  AND n.created_at <= '2026-05-31 23:59:59'                      -- if createdTo
ORDER BY n.created_at DESC
OFFSET 0 ROWS FETCH NEXT 20 ROWS ONLY
-- Index dùng: idx_notifications_user_isread (user_id, is_read, created_at DESC)
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
-- Notification KHÔNG có version / updated_at → UPDATE chỉ field is_read
UPDATE notifications
SET is_read = 1
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

### Cleanup Scheduler (chạy lúc 04:00 hằng ngày)
```sql
-- Bước 1: xóa CỰC CŨ (kể cả chưa đọc) — chạy trước để giảm rows bước 2 phải quét
DELETE FROM notifications
WHERE created_at < '2025-12-08 04:00:00';   -- now() - 180 ngày

-- Bước 2: xóa đã đọc + cũ hơn 90 ngày
DELETE FROM notifications
WHERE created_at < '2026-03-10 04:00:00'    -- now() - 90 ngày
  AND is_read = 1;
```

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
| `SimpMessagingTemplate.convertAndSendToUser(user, dest, payload)` | Push WebSocket tới Principal cụ thể, không phải broadcast topic | `template.convertAndSendToUser("vanan", "/queue/notifications", dto)` |
| `@SchedulerLock` (ShedLock) | Distributed lock — đảm bảo chỉ 1 instance chạy `@Scheduled` khi deploy nhiều node | `@SchedulerLock(name="x", lockAtLeastFor="PT1M", lockAtMostFor="PT10M")` |
| `setUserDestinationPrefix("/user")` (WebSocketConfig) | Bật user-destination — Spring dịch `/user/queue/x` → `/user/<sessionId>/queue/x` | Bắt buộc cho `convertAndSendToUser` hoạt động |

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
@Async
@EventListener
public void handlePaymentCompleted(PaymentCompletedEvent event) {
    Payment payment = event.getPayment();
    Booking booking = payment.getBooking();
    if (booking.getUser() == null) return;  // skip POS khách vãng lai

    notificationService.createNotification(
        booking.getUser().getId(),
        "Thanh toán thành công",
        "Vé " + booking.getBookingCode() + " đã xác nhận",
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
6. **Tại sao `NotificationFilter` không có field `userId`?** → Để chống IDOR. Nếu có, user A gửi `?userId=99` sẽ đọc inbox user 99. Đặt userId làm **param riêng** của `fromFilter(filter, userId)` và lấy từ SecurityContext ở controller → compiler bật lỗi nếu dev quên, FE không bao giờ tự gửi userId được.
7. **Điểm khác giữa `convertAndSend("/topic/user/.../notifications")` và `convertAndSendToUser(...)`?** → `/topic` là broadcast — ai biết destination đều subscribe được (IDOR). `convertAndSendToUser` route theo Principal session — Spring tự dịch sang đích nội bộ `/user/<sessionId>/queue/...` mà chỉ session đúng Principal mới nhận. Cần config `setUserDestinationPrefix("/user")`.
8. **Tại sao cleanup chạy 04:00 thay vì 00:00?** → Tránh đụng các scheduler khác (cleanup booking, restore showtime, daily report) thường đặt 00:00 hoặc 02:00. 04:00 ít traffic + ít cạnh tranh I/O.
9. **Tại sao xóa CỰC CŨ trước rồi mới xóa ĐÃ ĐỌC cũ hơn 90 ngày?** → Bước 1 xóa khoảng lớn hơn (>180 ngày, mọi trạng thái), giảm số row mà bước 2 phải quét. Ngược lại sẽ quét chồng → tốn I/O.
10. **`@SchedulerLock` cần thiết khi nào?** → Khi deploy >= 2 instance (rolling update, load-balance). Không có lock thì cả 2 chạy `@Scheduled` cùng lúc → 2 lần DELETE đồng thời, deadlock hoặc query trùng. ShedLock dùng bảng DB làm distributed lock — chỉ 1 instance giành được.
