# Module Loyalty — Giải thích chi tiết

## 1. Tổng quan

Module **Loyalty** là hệ thống điểm thưởng + hạng thành viên cho user. Mỗi lần khách
thanh toán booking thành công, hệ thống tự động cộng điểm theo tỉ lệ doanh thu — và
khi tích đủ một mức nhất định, user được nâng hạng thành viên (SILVER → GOLD →
PLATINUM). Đây là mô hình **chuẩn ngành rạp chiếu phim Việt Nam**: CGV có *CGV STAR
Card* (1.000đ doanh thu = 1 STAR), Lotte Cinema có *Lotte VIP Card* (cũng 1.000đ = 1
LP). CineX bê đúng pattern này nhưng làm bằng **Spring Boot + Spring Events** để minh
hoạ Observer Pattern thực tế.

### Bài toán Loyalty giải quyết

| Câu hỏi nghiệp vụ | Giải pháp kỹ thuật |
|---|---|
| Khi nào cộng điểm? | Sau khi `Payment.status = COMPLETED` (đã trừ tiền thật) |
| Cộng bao nhiêu? | `totalAmount * earn_rate` (đọc config, mặc định 1‰ = 1 point/1000đ) |
| Tier có tụt không? | **KHÔNG** — pattern CGV/Lotte: "hạng đã lên giữ trọn đời" |
| Khi user redeem (đổi điểm) thì sao? | Trừ `loyaltyPoints`, **KHÔNG** trừ `lifetimePoints` |
| Có thể double-earn không? | Không — idempotent check trên `(booking_id, EARN)` |
| Loyalty fail thì booking có rollback? | Không — booking độc lập, loyalty chỉ log error |

### Bốn tier thành viên

```
STANDARD ─── (0 điểm) ─── Member mới đăng ký
   ↓ ≥ 1.000 lifetime points
SILVER ───── (1.000đ × 1.000.000 doanh thu) ─── Khoảng 1 triệu chi tiêu
   ↓ ≥ 5.000 lifetime points
GOLD ─────── (5 triệu chi tiêu)
   ↓ ≥ 20.000 lifetime points
PLATINUM ─── (20 triệu chi tiêu — VIP)
```

Threshold đọc từ bảng `system_config` → admin có thể chỉnh runtime (giảm bar khi
khuyến mại Black Friday chẳng hạn) **không cần deploy lại code**. Đây là pattern
*Config-driven Business Rules* mà các sàn TMĐT lớn (Shopee, Tiki) đều dùng.

### Lifetime vs Balance — vì sao tách 2 trường?

CineX lưu **2 con số riêng biệt** trên `users`:
- `loyaltyPoints` (balance): số điểm hiện có, có thể giảm khi REDEEM
- `lifetimePoints`: tổng điểm đã từng kiếm, **chỉ tăng**

Nếu chỉ có `loyaltyPoints`, user đổi hết điểm sẽ tụt từ PLATINUM về STANDARD ngay
lập tức → **mất motivation, churn rate tăng**. Đây là bài học kinh điển ngành airline
loyalty (United Airlines từng làm sai, sau đó toàn ngành đổi sang lifetime-based
tier). CineX tránh sai lầm này từ đầu.

### Hai mặt: Earn (auto) và Redeem (sẽ tích hợp)

- **Earn**: hoàn toàn **tự động qua Observer** — user không bấm gì, payment xong là
  điểm tự cộng sau ~50ms (thời gian xử lý event listener).
- **Redeem**: gọi qua `LoyaltyService.redeem(userId, points)` — hiện chỉ có service,
  chưa nối vào booking flow. Sẽ làm ở pha sau (thêm field `pointsToRedeem` trong
  `BookingCreateRequest`).

### 3 pattern chính của module

1. **Observer Pattern (Spring Events)** — `PaymentCompletedEvent` → `LoyaltyEventListener`
2. **CQRS-lite** — `LoyaltyService` (write) tách riêng `LoyaltyQueryService` (read)
3. **Append-only Log** — `loyalty_transactions` không bao giờ UPDATE/DELETE

---

## 2. Danh sách files đã tạo/sửa

### Backend

| File | Tác dụng | Pattern |
|---|---|---|
| `module/loyalty/entity/LoyaltyTier.java` | Enum 4 hạng STANDARD/SILVER/GOLD/PLATINUM | Enum |
| `module/loyalty/entity/LoyaltyTransaction.java` | Log mỗi earn/redeem (immutable) | Append-only Log, BaseEntity |
| `module/loyalty/entity/LoyaltyTransactionType.java` | Enum EARN / REDEEM / ADJUST | Enum |
| `module/loyalty/service/LoyaltyService.java` | Write side: earn / redeem / calculateTier | Service, Config-driven |
| `module/loyalty/service/LoyaltyQueryService.java` | Read side: account + history | CQRS-lite |
| `module/loyalty/listener/LoyaltyEventListener.java` | Lắng nghe PaymentCompletedEvent | **Observer** |
| `module/loyalty/controller/LoyaltyController.java` | GET /api/loyalty/me, /me/transactions | REST |
| `module/loyalty/repository/LoyaltyTransactionRepository.java` | JPA Repository + EntityGraph | Repository |
| `module/loyalty/dto/LoyaltyAccountResponse.java` | DTO trạng thái account | DTO |
| `module/loyalty/dto/LoyaltyTransactionResponse.java` | DTO 1 dòng log | DTO |
| `module/auth/entity/User.java` (sửa) | Thêm 3 field: loyaltyPoints, lifetimePoints, tier | — |
| `module/payment/event/PaymentCompletedEvent.java` (đã có) | Event publish khi payment xong | Observer (subject side) |
| `db/changelog/changes/056-create-loyalty-tables.xml` | Schema + seed 6 config | Liquibase |

### Frontend

| File | Tác dụng |
|---|---|
| `features/loyalty/LoyaltyPage.tsx` | Trang xem điểm + lịch sử (user-facing) |
| `hooks/useLoyalty.ts` | 2 hook React Query: `useMyLoyalty`, `useMyLoyaltyTransactions` |

---

## 3. Schema database

### 3.1 Cột mới trên `users`

Liquibase changeSet `056-add-loyalty-columns-to-users`:

```sql
ALTER TABLE users ADD loyalty_points INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD lifetime_points INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD tier NVARCHAR(20) NOT NULL DEFAULT 'STANDARD';
```

**Vì sao thêm vào `users` chứ không tạo bảng `loyalty_account` riêng?**
- 1 user luôn có đúng 1 loyalty account → quan hệ 1-1 → nhúng cột vào parent là
  best practice (giảm 1 JOIN cho mọi query liên quan user).
- Lưu ý: pattern này chỉ đúng khi quan hệ là **strict 1-1 và luôn có** (chứ không
  phải optional 0-1). Loyalty đúng case này: ai cũng có account, mặc định 0 điểm
  STANDARD.

### 3.2 Bảng `loyalty_transactions`

Liquibase changeSet `056-create-loyalty-transactions-table`:

```sql
CREATE TABLE loyalty_transactions (
    id              BIGINT IDENTITY PRIMARY KEY,
    version         BIGINT DEFAULT 0,           -- BaseEntity (không thực sự dùng ở đây — log immutable)
    storage_state   NVARCHAR(20),
    created_by      NVARCHAR(50),
    updated_by      NVARCHAR(50),
    created_at      DATETIME2,
    updated_at      DATETIME2,

    user_id         BIGINT      NOT NULL,
    booking_id      BIGINT      NULL,            -- null cho REDEEM tự do / ADJUST
    transaction_type NVARCHAR(20) NOT NULL,      -- EARN / REDEEM / ADJUST
    points          INT         NOT NULL,        -- có thể âm (REDEEM)
    balance_after   INT         NOT NULL,        -- snapshot số dư SAU transaction
    reason          NVARCHAR(500)
);

CREATE INDEX idx_loyalty_tx_user ON loyalty_transactions(user_id);
CREATE INDEX idx_loyalty_tx_booking ON loyalty_transactions(booking_id);
```

### 3.3 Vì sao `points` là `INT` có thể âm?

Convention rõ ràng:
- `EARN` → `points > 0` (vd `+150`)
- `REDEEM` → `points < 0` (vd `-100`)
- `ADJUST` → có thể `±` tuỳ trường hợp (refund cộng dương, correction trừ âm)

**Lợi ích**: chỉ cần `SUM(points) WHERE user_id = ?` ra balance chính xác — không cần
phân biệt cộng/trừ trong query. Nếu lưu absolute value + cờ `direction` thì query sẽ
là `SUM(CASE WHEN direction='IN' THEN points ELSE -points END)` — phức tạp, dễ sai.

### 3.4 Vì sao có `balance_after`?

`balance_after` là **snapshot số dư SAU khi transaction này được ghi**. Lưu ngay từ
lúc INSERT, **không** tính lại khi đọc.

```
Lúc giao dịch:                    Lúc đọc statement:
EARN +150 → balanceAfter = 1150   FE chỉ cần SELECT, không phải SUM
REDEEM -100 → balanceAfter = 1050 → siêu nhanh, response < 50ms
EARN +200 → balanceAfter = 1250
```

**So sánh với bank statement**: ngân hàng cũng làm vậy. Khi bạn xem app banking, mỗi
giao dịch hiển thị "Số dư còn lại: X" — đó là snapshot, không recompute mỗi lần mở
app. Nếu phải `SUM` toàn bộ history mỗi lần đọc, với user có 10.000 giao dịch → query
sẽ chậm dần theo thời gian.

**Trade-off**: nếu DB corrupt 1 record giữa chuỗi, `balance_after` các record sau sẽ
sai. Khắc phục: viết job `recomputeBalance(userId)` đọc toàn bộ log theo `createdAt`
ASC rồi cumulative sum → ghi lại `balance_after` (admin tool, ít khi chạy).

### 3.5 Seed 6 config

```sql
INSERT INTO system_config (config_key, config_value, description) VALUES
('loyalty.earn_rate',              '0.001',  N'1đ doanh thu = X points (0.001 = 1 point/1000đ)'),
('loyalty.redeem_value',           '1000',   N'1 point = X đồng khi redeem'),
('loyalty.min_redeem_points',      '100',    N'Tối thiểu mỗi lần đổi'),
('loyalty.tier.silver_threshold',  '1000',   N'Lifetime để lên SILVER'),
('loyalty.tier.gold_threshold',    '5000',   N'Lifetime để lên GOLD'),
('loyalty.tier.platinum_threshold','20000',  N'Lifetime để lên PLATINUM');
```

Admin vào trang `/admin/system-config` chỉnh `loyalty.earn_rate` từ `0.001` lên
`0.002` (double point Black Friday) → tất cả booking sau đó earn gấp đôi mà **không
cần restart backend**.

---

## 4. Observer Pattern — chi tiết

### 4.1 Spring ApplicationEvent là gì?

Spring có sẵn cơ chế **publish-subscribe** trong cùng JVM:
- **Publisher**: gọi `applicationEventPublisher.publishEvent(event)`
- **Subscriber**: class có `@EventListener` (hoặc `@TransactionalEventListener`)
- Spring tự routing event đến tất cả listener khớp kiểu

Đây là implementation của **Observer Pattern** (GoF Behavioral) ở mức framework. Khác
với Kafka/RabbitMQ ở chỗ: chỉ chạy trong 1 process, không persist event — nếu app
restart giữa lúc xử lý thì event mất. Tuy nhiên đủ cho loyalty (loss tolerance cao —
admin có thể adjust tay nếu sót).

### 4.2 `PaymentCompletedEvent` — Event đã có sẵn

Khi viết module Payment trước đó, đã định nghĩa:

```java
// module/payment/event/PaymentCompletedEvent.java
public class PaymentCompletedEvent extends ApplicationEvent {
    private final Payment payment;
    public PaymentCompletedEvent(Object source, Payment payment) {
        super(source);
        this.payment = payment;
    }
}
```

Trong `PaymentService.handlePaymentSuccess()`:
```java
booking.setStatus(BookingStatus.CONFIRMED);
payment.setStatus(PaymentStatus.COMPLETED);
// ... save ...
applicationEventPublisher.publishEvent(new PaymentCompletedEvent(this, payment));
```

PaymentService **không hề biết** ai sẽ lắng nghe. Hiện tại có 3 listener:
- `NotificationEventListener` → tạo Notification trong DB
- `EmailEventListener` → gửi email xác nhận
- `LoyaltyEventListener` → cộng điểm (mới thêm ở module này)

Thêm "cộng điểm" KHÔNG cần sửa một dòng nào trong `PaymentService` → **Open/Closed
Principle** đỉnh cao.

### 4.3 `LoyaltyEventListener` — 3 điểm quan trọng

```java
@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
@Transactional(propagation = Propagation.REQUIRES_NEW)
public void handlePaymentCompleted(PaymentCompletedEvent event) {
    Booking booking = event.getPayment().getBooking();
    try {
        int earned = loyaltyService.earnFromBooking(booking);
        if (earned > 0) log.info("Earned {} points for {}", earned, booking.getBookingCode());
    } catch (Exception e) {
        log.error("Failed to earn loyalty: {}", e.getMessage(), e);
    }
}
```

#### (1) `@TransactionalEventListener(phase = AFTER_COMMIT)`

Spring có 4 phase: `BEFORE_COMMIT`, `AFTER_COMMIT` ✓, `AFTER_ROLLBACK`,
`AFTER_COMPLETION`. Chọn `AFTER_COMMIT` vì:
- Nếu `BEFORE_COMMIT` → cộng điểm xong outer rollback → user có điểm mà không có
  booking → **inconsistent state**.
- `AFTER_COMMIT` chỉ trigger sau khi booking chắc chắn đã CONFIRMED → không có điểm "ảo".

So sánh với `@EventListener` thường: nó chạy **ngay khi publish** (vẫn trong outer
TX). Nếu outer rollback → side-effect cũng phải undo → không thể.

#### (2) `@Transactional(propagation = REQUIRES_NEW)`

Sau khi outer TX commit, listener chạy **ngoài transaction**. Nếu save không có
TX → throw `TransactionRequiredException`. `REQUIRES_NEW` ép tạo TX mới hoàn toàn:

```
[Outer TX: Payment]                  [New TX: Loyalty]
  save Payment       BEGIN              BEGIN
  save Booking                          save User (bump points)
  publishEvent()                        save LoyaltyTransaction
  COMMIT             ──── trigger ────► COMMIT
```

5 propagation phổ biến: `REQUIRED` (default — join nếu có), `REQUIRES_NEW` ✓ (luôn
tạo mới), `MANDATORY` (bắt buộc có outer), `SUPPORTS`, `NOT_SUPPORTED`.

#### (3) `try-catch toàn bộ method`

Không throw lại vì: outer TX đã commit, không rollback được nữa; loyalty fail là
**non-critical** (user vẫn có vé). Pattern **Best-effort delivery** — log để admin
investigate, không lan lỗi ra ngoài.

### 4.4 Sơ đồ luồng đầy đủ

```
┌────────────────────┐  POST /api/payment/momo/callback
│ MoMo Webhook       │  (provider notify success)
└──────────┬─────────┘
           │
           ▼
┌────────────────────────────────────────────────────────────┐
│ PaymentService.handlePaymentSuccess()                      │
│                                                             │
│  [Outer TX BEGIN]                                          │
│   1. payment.setStatus(COMPLETED)                          │
│   2. booking.setStatus(CONFIRMED)                          │
│   3. paymentRepo.save(payment)                             │
│   4. bookingRepo.save(booking)                             │
│   5. publishEvent(new PaymentCompletedEvent(this, payment))│
│  [Outer TX COMMIT] ──────────────────────────┐             │
└────────────────────────────────────────────┐ │             │
                                             │ │             │
   AFTER_COMMIT phase                        │ │             │
   ┌─────────────────────────────────────────┴─┴─────┐       │
   │ Spring dispatch event to all listeners (parallel)│       │
   │                                                  │       │
   │ ┌──────────────────┐  ┌──────────────────┐     │       │
   │ │NotificationEvent │  │EmailEventListener│     │       │
   │ │Listener          │  │                  │     │       │
   │ │(tạo Notification)│  │(gửi mail)        │     │       │
   │ └──────────────────┘  └──────────────────┘     │       │
   │                                                  │       │
   │ ┌────────────────────────────────────────────┐  │       │
   │ │ LoyaltyEventListener.handlePaymentCompleted │  │       │
   │ │                                            │  │       │
   │ │ [New TX BEGIN — REQUIRES_NEW]              │  │       │
   │ │  loyaltyService.earnFromBooking(booking)   │  │       │
   │ │   ├─ check idempotent                      │  │       │
   │ │   ├─ calc points = total * earn_rate       │  │       │
   │ │   ├─ user.points += points                 │  │       │
   │ │   ├─ user.lifetime += points               │  │       │
   │ │   ├─ user.tier = calculateTier(lifetime)   │  │       │
   │ │   ├─ save user                              │  │       │
   │ │   └─ save LoyaltyTransaction (log)         │  │       │
   │ │ [New TX COMMIT]                             │  │       │
   │ └────────────────────────────────────────────┘  │       │
   └──────────────────────────────────────────────────┘
```

### 4.5 So sánh: gọi trực tiếp vs publish event

**❌ Tight coupling:** PaymentService phải inject `LoyaltyService`, `EmailService`,
`NotificationService`, `SmsService`... mỗi side-effect mới = sửa PaymentService (vi
phạm OCP). 1 side-effect fail → rollback booking → khách mất ghế dù đã trả tiền.
Test phải mock 4-5 service không liên quan core logic.

**✅ Observer:** PaymentService chỉ inject `ApplicationEventPublisher`. Mỗi side-effect
là 1 listener class riêng → SRP. Thêm mới → tạo file mới → OCP. Test chỉ mock
publisher. Listener fail (bug, network) → không rollback booking.

---

## 5. CQRS-lite — Tách Query và Command Service

### 5.1 CQRS là gì?

**CQRS** = Command Query Responsibility Segregation. Bertrand Meyer (cha đẻ Eiffel)
đề xuất: **một method nên hoặc đọc, hoặc ghi — không cả hai**. Greg Young mở rộng
thành: thậm chí nên có 2 service class riêng cho 2 loại thao tác.

CineX dùng **CQRS-lite** (lite vì không tách database read/write, chỉ tách service
class):

| Class | Trách nhiệm | Method |
|---|---|---|
| `LoyaltyService` | **Command** (mutation) | `earnFromBooking()`, `redeem()`, `calculateTier()` |
| `LoyaltyQueryService` | **Query** (read) | `getAccountByUsername()`, `getTransactionsByUsername()` |

### 5.2 Vì sao tách?

#### Lý do 1: SOLID — Single Responsibility

`LoyaltyService` chỉ lo tính toán + ghi log. `LoyaltyQueryService` chỉ lo lookup +
map DTO + tính progress. Khi cần sửa logic earn (vd thêm bonus tier-based) → chỉ đụng
file write. Khi cần sửa DTO format cho FE → chỉ đụng file read.

#### Lý do 2: Performance khác nhau

Write side: phải có transaction strict (locking, atomicity).
Read side: có thể chạy `@Transactional(readOnly = true)` → Spring/Hibernate optimize:
- Skip flush dirty check (không có entity nào cần persist)
- Hint cho connection pool dùng read-replica nếu setup
- Flush mode = MANUAL

Trên dataset lớn, query với `readOnly = true` có thể nhanh hơn 20-30% so với default.

#### Lý do 3: Dễ test

```java
// Test write logic không cần mock dependencies của query side
@Test
void earnFromBooking_shouldSkipIfAlreadyEarned() {
    LoyaltyService service = new LoyaltyService(userRepo, txRepo, configService);
    // ... không cần mock LoyaltyQueryService
}
```

### 5.3 Controller chỉ inject Service nào cần

```java
@RestController
@RequestMapping("/api/loyalty")
public class LoyaltyController {
    private final LoyaltyQueryService loyaltyQueryService; // CHỈ inject query
    // KHÔNG inject LoyaltyService — vì controller không có endpoint mutation
}
```

Redeem được gọi từ `BookingService` (sẽ làm), không qua REST trực tiếp → an toàn
hơn (user không thể spam REDEEM endpoint).

### 5.4 `@Transactional(readOnly = true)` chi tiết

```java
@Transactional(readOnly = true)
public LoyaltyAccountResponse getAccountByUsername(String username) {
    User user = userRepository.findByUsername(username).orElseThrow(...);
    LoyaltyTier nextTier = nextTier(user.getTier());
    // ... không có save/update ...
    return LoyaltyAccountResponse.builder()...build();
}
```

Lợi ích cụ thể với Hibernate:
1. **Flush mode = MANUAL**: không tự flush khi commit → tránh UPDATE thừa cho dirty
   entity (vd entity được modify trong helper method).
2. **Hint level**: connection pool có thể routing đến read replica (HikariCP +
   AbstractRoutingDataSource).
3. **JDBC driver hint**: vài driver (PostgreSQL JDBC) chuyển sang chế độ read-only
   tại connection level.

---

## 6. Append-only Log Pattern

### 6.1 Định nghĩa

**Append-only Log** = mỗi thao tác thay đổi state được ghi như 1 record MỚI, **không
bao giờ UPDATE hoặc DELETE** record cũ. Tổng state hiện tại = phép cộng/áp dụng tuần
tự toàn bộ log từ đầu.

Ví dụ thực tế:
- **Git**: mỗi commit là 1 record mới, không bao giờ sửa commit cũ
- **Kafka**: messages immutable, chỉ ghi thêm
- **Bank ledger**: mỗi transaction là 1 dòng, balance là sum của tất cả
- **Event Sourcing**: pattern tổng quát hoá ý tưởng này

### 6.2 Áp dụng trong Loyalty

```java
@Entity
@Table(name = "loyalty_transactions")
public class LoyaltyTransaction extends BaseEntity {
    // CHỈ có constructor + setter cho lúc tạo
    // Sau khi save, không có business method nào sửa các field
    // Không có repo method nào UPDATE/DELETE
}
```

Repository:
```java
public interface LoyaltyTransactionRepository extends JpaRepository<LoyaltyTransaction, Long> {
    Page<LoyaltyTransaction> findByUserIdOrderByCreatedAtDesc(...);
    boolean existsByBookingIdAndTransactionType(...);
    // KHÔNG có deleteBy*, updateBy*
}
```

`BaseEntity` có sẵn `version` (optimistic lock) và `storageState` — nhưng với log
này chúng **không được dùng** (không có flow sửa). Hơi waste schema nhưng đổi lại
consistency với các entity khác trong codebase.

### 6.3 Lợi ích thực tế

**Audit toàn vẹn**: khi user khiếu nại "tôi mất 200 điểm không rõ nguyên nhân",
admin query `SELECT * FROM loyalty_transactions WHERE user_id = ? ORDER BY
created_at DESC` — mỗi dòng là 1 sự kiện nguyên thuỷ, không bị overwrite, tìm
được nguyên nhân chính xác.

**Recompute khi cần**: nếu `users.loyalty_points` bị corrupt (bug race condition),
chạy `SUM(points) FROM loyalty_transactions WHERE user_id = ?` → set lại balance.
Log là **single source of truth**.

**`balance_after` vs recompute on read**: nếu mỗi lần đọc statement đều `SELECT
SUM(points) WHERE created_at <= tx.created_at` cho mỗi dòng → N² query. CineX
snapshot ngay lúc write → đọc O(1). Trade-off OK vì log immutable.

### 6.4 So sánh với anti-pattern UPDATE

Cách sai: bảng `loyalty_account(user_id, points)`, mỗi lần earn/redeem là
`UPDATE points = points + X`. Vấn đề: không biết user từng có bao nhiêu, tại sao
tăng/giảm, khi nào, ai trigger. CineX dùng cả 2: `users.loyalty_points` (cache
nhanh) + `loyalty_transactions` (log đầy đủ) — giữ đồng bộ trong cùng transaction.

---

## 7. Earn logic — chi tiết

```java
@Transactional
public int earnFromBooking(Booking booking) {
    if (booking.getUser() == null) return 0;                              // (1) POS sale
    if (loyaltyTransactionRepository.existsByBookingIdAndTransactionType(
            booking.getId(), LoyaltyTransactionType.EARN)) return 0;      // (2) idempotent

    BigDecimal earnRate = readDecimalConfig("loyalty.earn_rate", "0.001");// (3) config-driven
    int pointsEarned = booking.getTotalAmount()
            .multiply(earnRate).setScale(0, RoundingMode.DOWN).intValue();
    if (pointsEarned <= 0) return 0;

    User fresh = userRepository.findById(booking.getUser().getId())       // (4) re-fetch
            .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "..."));

    int newBalance = fresh.getLoyaltyPoints() + pointsEarned;
    int newLifetime = fresh.getLifetimePoints() + pointsEarned;
    fresh.setLoyaltyPoints(newBalance);
    fresh.setLifetimePoints(newLifetime);
    fresh.setTier(calculateTier(newLifetime));                            // (5) auto-upgrade
    userRepository.save(fresh);

    loyaltyTransactionRepository.save(LoyaltyTransaction.builder()
            .user(fresh).booking(booking)
            .transactionType(LoyaltyTransactionType.EARN)
            .points(pointsEarned).balanceAfter(newBalance)
            .reason("Booking " + booking.getBookingCode()).build());
    return pointsEarned;
}
```

### 7.1 Idempotent check (2) — chống double-earn

Event có thể fire 2 lần: webhook MoMo retry sau timeout, admin trigger manual,
Spring restart giữa chừng. Không check → user nhận điểm gấp đôi → loss ngân sách.
Index trên `booking_id` → query O(log n).

### 7.2 Re-fetch User (4) — bump optimistic lock

`booking.user` trong event có thể là entity stale (load lúc booking tạo — giờ user
đã thay đổi điểm từ booking song song khác). Dùng entity stale + save → throw
`OptimisticLockException` (version mismatch). Re-fetch đảm bảo version mới nhất.

### 7.3 Tier auto-upgrade (5)

`calculateTier(newLifetime)` chỉ phụ thuộc `lifetimePoints` — luôn tăng → tier
**monotonic** (không thể tụt). Không cần check "tier mới có > tier cũ không".

### 7.4 BigDecimal (3) thay vì double

Tiền tệ + tỉ lệ phải chính xác tuyệt đối. `double` sai số floating-point:
```
123456 * 0.001 (double) = 123.45599999999998  // sai
123456 * 0.001 (BigDecimal, DOWN scale 0) = 123  // chính xác
```
`RoundingMode.DOWN` = truncate (cắt thập phân) — user chỉ nhận điểm nguyên.

### 7.5 POS counter sale (1)

Vé bán ở quầy có khi khách không account → `booking.user = null` → không earn.

---

## 8. Redeem logic

```java
@Transactional
public BigDecimal redeem(Long userId, int pointsToRedeem) {
    int minRedeem = systemConfigService.getInt("loyalty.min_redeem_points", 100);
    if (pointsToRedeem < minRedeem)
        throw new BusinessException(INVALID_REQUEST, "Tối thiểu " + minRedeem);

    User user = userRepository.findById(userId).orElseThrow(...);
    if (user.getLoyaltyPoints() < pointsToRedeem)
        throw new BusinessException(INVALID_REQUEST, "Không đủ điểm");

    long redeemValue = systemConfigService.getLong("loyalty.redeem_value", 1000);
    BigDecimal discountAmount = BigDecimal.valueOf((long) pointsToRedeem * redeemValue);

    int newBalance = user.getLoyaltyPoints() - pointsToRedeem;
    user.setLoyaltyPoints(newBalance);
    // KHÔNG trừ lifetime — tier giữ nguyên
    userRepository.save(user);

    loyaltyTransactionRepository.save(LoyaltyTransaction.builder()
            .user(user).transactionType(LoyaltyTransactionType.REDEEM)
            .points(-pointsToRedeem).balanceAfter(newBalance)
            .reason("Đổi " + pointsToRedeem + " điểm = " + discountAmount + "đ").build());
    return discountAmount;
}
```

4 điểm cốt lõi:
- **Validate min**: `min_redeem_points = 100` → chống spam đổi 1 điểm/lần (tốn DB).
- **KHÔNG trừ lifetime**: line `setLifetimePoints` **không xuất hiện** trong `redeem()`
  → tier giữ nguyên (đặc trưng pattern CGV/Lotte).
- **`points = -pointsToRedeem`**: lưu âm để `SUM(points)` ra balance đúng.
- **`booking = null`**: redeem hiện "tự do" → đổi voucher dùng sau. Khi tích hợp
  booking flow sẽ gắn `booking_id` (biết redeem cho booking nào).

---

## 9. Frontend — LoyaltyPage UX

### 9.1 Tier card gradient

```tsx
const TIER_COLORS = {
  STANDARD: 'from-gray-500 to-gray-700',   // xám đậm — neutral
  SILVER:   'from-gray-300 to-gray-500',   // xám sáng — kim loại bạc
  GOLD:     'from-yellow-400 to-yellow-600', // vàng — kim loại vàng
  PLATINUM: 'from-purple-400 to-purple-600', // tím — premium/luxury
}

<div className={`rounded-2xl p-6 bg-gradient-to-br ${TIER_COLORS[account.tier]}`}>
```

Pattern industry: PLATINUM dùng tím/đen (luxury vibe) — user nhận ra ngay mình ở
hạng nào.

### 9.2 Progress bar đến next tier

```tsx
const progressPercent = Math.min(100,
  Math.round((account.lifetimePoints / account.nextTierThreshold) * 100))
```

Tính dựa trên **lifetimePoints** (không phải loyaltyPoints) — vì tier xác định bởi
lifetime. Hiển thị "Còn X điểm lên SILVER" → gamification, tạo motivation. Khi đạt
PLATINUM → `nextTier = null` → hiển thị "Bạn đã đạt hạng cao nhất 🎉".

### 9.3 Transaction history

```tsx
<div className={tx.points > 0 ? 'text-green-400' : 'text-orange-400'}>
  {tx.points > 0 ? <ArrowUp /> : <ArrowDown />}
  {tx.points > 0 ? '+' : ''}{tx.points.toLocaleString('vi-VN')}
</div>
```

`points` có dấu (+/-) sẵn → JS in ra `-100` tự động có dấu trừ; chỉ cần prepend `+`
cho positive. Xanh = earn, cam = redeem — pattern UX chuẩn (giống bank app).
`toLocaleString('vi-VN')` ra dấu chấm phân cách (`12.345`) — chuẩn VN.

### 9.4 React Query hook

```ts
export function useMyLoyalty() {
  return useQuery({ queryKey: ['loyalty', 'me'], queryFn: ... })
}
```

`queryKey: ['loyalty', 'me']` → cache theo key. Khi earn/redeem ở nơi khác:
`queryClient.invalidateQueries({ queryKey: ['loyalty'] })` → toàn bộ refetch.

---

## 10. Request / Response mẫu

### GET /api/loyalty/me

```bash
curl http://localhost:8088/api/loyalty/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9..."
```

Response:
```json
{
  "code": 0,
  "message": "OK",
  "data": {
    "loyaltyPoints": 350,
    "lifetimePoints": 1250,
    "tier": "SILVER",
    "nextTier": "GOLD",
    "nextTierThreshold": 5000,
    "pointsToNextTier": 3750
  }
}
```

### GET /api/loyalty/me/transactions

```bash
curl "http://localhost:8088/api/loyalty/me/transactions?page=0&size=10" \
  -H "Authorization: Bearer ..."
```

Response:
```json
{
  "code": 0,
  "message": "OK",
  "data": {
    "content": [
      {
        "id": 102,
        "transactionType": "EARN",
        "points": 150,
        "balanceAfter": 350,
        "reason": "Booking BKG-260609-001",
        "bookingCode": "BKG-260609-001",
        "createdAt": "2026-06-09T10:23:45"
      },
      {
        "id": 101,
        "transactionType": "REDEEM",
        "points": -100,
        "balanceAfter": 200,
        "reason": "Đổi 100 điểm = 100000đ",
        "bookingCode": null,
        "createdAt": "2026-06-08T18:30:12"
      }
    ],
    "totalElements": 12,
    "totalPages": 2,
    "size": 10,
    "number": 0
  }
}
```

### SQL được sinh ra

`findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(0, 10))` với `@EntityGraph`:
```sql
SELECT lt.*, b.id, b.booking_code, b.total_amount, ...
FROM loyalty_transactions lt
LEFT OUTER JOIN bookings b ON lt.booking_id = b.id
WHERE lt.user_id = ?
ORDER BY lt.created_at DESC
OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY;
```

`@EntityGraph(attributePaths = {"booking"})` → JOIN booking trong cùng query → khi
mapper gọi `tx.getBooking().getBookingCode()`, **không** trigger thêm select.

---

## 11. Câu hỏi tự kiểm tra

1. **Tại sao `@Transactional(propagation = REQUIRES_NEW)` bắt buộc trong
   `LoyaltyEventListener`?** (Gợi ý: outer transaction đã commit ở phase
   AFTER_COMMIT, save không có TX sẽ throw `TransactionRequiredException`.)

2. **Nếu MoMo webhook bị retry 3 lần (network timeout), user có nhận điểm gấp 3
   không?** (Gợi ý: check `existsByBookingIdAndTransactionType` trong
   `earnFromBooking`.)

3. **Khi `balance_after` của record cũ bị sai do bug DB, làm thế nào để recompute?**
   (Gợi ý: `SUM(points)` theo `created_at` ASC, cumulative — append-only log cho
   phép.)

4. **Vì sao tách `LoyaltyService` và `LoyaltyQueryService` khi cả 2 đều thao tác
   `loyalty_transactions`?** (Gợi ý: CQRS-lite, SRP, Spring optimize cho readOnly.)

5. **Nếu admin chỉnh `loyalty.earn_rate` từ `0.001` lên `0.002` lúc 14:00, booking
   xảy ra lúc 13:59 (payment xong lúc 14:01) earn theo rate cũ hay mới?** (Gợi ý:
   `earnFromBooking` đọc config tại thời điểm chạy — rate mới.)

6. **Có thể bypass tier downgrade bằng cách REDEEM hết điểm rồi EARN lại không?**
   (Gợi ý: lifetime chỉ tăng — REDEEM không động vào lifetime. Tier dựa trên
   lifetime → không thể tụt.)

7. **Tại sao Controller chỉ inject `LoyaltyQueryService` mà không inject
   `LoyaltyService`?** (Gợi ý: redeem chỉ được trigger từ booking flow nội bộ,
   không cho user gọi REST trực tiếp để tránh spam + race với booking.)

8. **`@TransactionalEventListener(AFTER_COMMIT)` khác `@EventListener` thế nào về
   thời điểm chạy?** (Gợi ý: `@EventListener` chạy ngay khi publish — vẫn trong
   outer TX → nếu outer rollback thì side-effect cũng phải rollback. AFTER_COMMIT
   chỉ chạy sau commit thành công.)

---

## 12. Tóm tắt design decisions

| Quyết định | Lý do | Alternative bị loại |
|---|---|---|
| Observer (Spring Events) | Loose coupling, OCP | Gọi trực tiếp → tight coupling |
| `@TransactionalEventListener(AFTER_COMMIT)` | Tránh earn cho booking bị rollback | `@EventListener` chạy trong outer TX |
| `Propagation.REQUIRES_NEW` | Outer TX đã commit | Không có TX → save fail |
| Lifetime tách khỏi balance | Tier không tụt khi redeem | 1 cột points → tier không stable |
| `balance_after` snapshot | O(1) read | Recompute SUM → O(n²) |
| `points INT` có thể âm | `SUM(points)` ra balance | Cột `direction` → query phức tạp |
| CQRS-lite tách service | SRP, readOnly optimize | 1 service all-in-one |
| Append-only log | Audit + recompute | UPDATE trên 1 row account |
| Config-driven (system_config) | Admin chỉnh runtime | Hardcode → cần deploy |
| Idempotent check `(booking_id, EARN)` | Chống double-earn | Tin tưởng event chỉ fire 1 lần |
| Re-fetch User | Bump optimistic version | Entity stale → OptimisticLockException |
| Try-catch toàn listener | Loyalty fail không ảnh hưởng booking | Throw → swallow vô ích |
| Controller chỉ inject QueryService | Redeem qua booking flow | REST endpoint redeem → spam-able |

---

**Module Loyalty hoàn thành.** Phần tích hợp Redeem vào BookingService sẽ làm ở task
sau — hiện đã có đủ infrastructure để mở rộng mà không cần sửa code đã viết.
