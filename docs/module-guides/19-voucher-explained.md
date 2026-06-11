# Module Voucher — Mã giảm giá

> Module quản lý voucher (mã giảm giá) cho CineX: tạo/sửa/xóa voucher, validate khi user áp dụng, tính discount, track lịch sử dùng.

---

## 1. Tổng quan

**Bài toán:** Rạp muốn tung khuyến mãi:
- Voucher chung toàn hệ thống ("WELCOME20" — giảm 20% mọi rạp)
- Voucher riêng từng chi nhánh ("HN-OPENING" — chỉ rạp HN)
- Voucher giảm theo % (`PERCENTAGE`) — có cap max
- Voucher giảm số tiền cố định (`FIXED_AMOUNT`)
- Giới hạn số lượt dùng tổng (`usageLimit`) và 1 user 1 lần
- Áp dụng theo thời gian (start/end date)
- Min order amount (chỉ áp dụng cho đơn từ X trở lên)

**Pattern:** Strategy (DiscountType) + Multi-tenant (theater nullable) + Concurrency control (usedCount).

---

## 2. Files liên quan

| File | Vai trò |
|---|---|
| `module/voucher/entity/Voucher.java` | Entity chính |
| `module/voucher/entity/DiscountType.java` | Enum PERCENTAGE / FIXED_AMOUNT |
| `module/voucher/entity/VoucherUsage.java` | Lịch sử dùng (user × voucher × booking) |
| `module/voucher/dto/VoucherRequest.java` | Admin create/update body |
| `module/voucher/dto/VoucherResponse.java` | Admin list/detail response |
| `module/voucher/dto/ValidateVoucherResponse.java` | Response cho user khi validate code |
| `module/voucher/dto/VoucherFilter.java` | Filter search admin |
| `module/voucher/service/VoucherService.java` | Business logic chính |
| `module/voucher/service/VoucherCleanupScheduler.java` | Auto-expire voucher hết hạn |
| `module/voucher/specification/VoucherSpecification.java` | Dynamic filter |
| `module/voucher/controller/VoucherController.java` | REST endpoints |
| `module/voucher/repository/VoucherRepository.java` | JPA repo |
| `module/voucher/repository/VoucherUsageRepository.java` | Lịch sử dùng |
| `module/voucher/mapper/VoucherMapper.java` | MapStruct |

---

## 3. Entity Voucher — chi tiết field

```java
@Entity
@Table(name = "vouchers")
public class Voucher extends BaseEntity {
    @ManyToOne(fetch = LAZY)
    private Theater theater;          // NULL = global

    private String code;              // unique theo scope (global vs per-theater)
    private String description;

    @Enumerated(EnumType.STRING)
    private DiscountType discountType;  // PERCENTAGE / FIXED_AMOUNT

    private BigDecimal discountValue;   // 20 nếu PERCENTAGE; 50000 nếu FIXED
    private BigDecimal minOrderAmount;  // 0 = áp dụng mọi đơn
    private BigDecimal maxDiscount;     // cap khi PERCENTAGE (vd 100k)
    private Integer usageLimit;         // null = unlimited
    private Integer usedCount;          // counter dùng, optimistic lock chống race
    private LocalDateTime startDate;
    private LocalDateTime endDate;
    private boolean active;
}
```

### Field semantics

| Field | Khi PERCENTAGE | Khi FIXED_AMOUNT |
|---|---|---|
| `discountValue` | % giảm (vd 20 = giảm 20%) | Số tiền giảm (vd 50000đ) |
| `maxDiscount` | Cap max (vd 100k — đơn 1M giảm 20% = 200k → cap 100k) | Bỏ qua (FIXED đã cố định) |

### Multi-tenant uniqueness

Migration 064 tạo filtered unique index:
```sql
CREATE UNIQUE INDEX UQ_vouchers_global_code
ON vouchers(code) WHERE theater_id IS NULL AND storage_state = 'ACTIVE';

CREATE UNIQUE INDEX UQ_vouchers_theater_code
ON vouchers(theater_id, code) WHERE theater_id IS NOT NULL AND storage_state = 'ACTIVE';
```

→ Code `WELCOME` global duy nhất. Code `HN-OPENING` per-theater có thể trùng giữa rạp HN và SG (mỗi rạp có riêng).

---

## 4. Design Patterns

### 4.1. Strategy (DiscountType)

```java
public BigDecimal calculateDiscount(Voucher voucher, BigDecimal orderAmount) {
    BigDecimal discount;
    if (voucher.getDiscountType() == DiscountType.PERCENTAGE) {
        discount = orderAmount.multiply(voucher.getDiscountValue())
                              .divide(BigDecimal.valueOf(100), 0, RoundingMode.DOWN);
        if (voucher.getMaxDiscount() != null && discount.compareTo(voucher.getMaxDiscount()) > 0) {
            discount = voucher.getMaxDiscount();  // cap
        }
    } else {  // FIXED_AMOUNT
        discount = voucher.getDiscountValue();
    }
    // Discount không vượt order amount (tránh âm)
    return discount.min(orderAmount);
}
```

Thêm `BUY_ONE_GET_ONE` → mở rộng switch hoặc tách Strategy class (CineX hiện chấp nhận if-else cho 2 type).

### 4.2. Multi-tenant scope resolution

```java
// Search voucher cho user tại theater X:
// - Voucher của theater X
// - + Voucher global (theater_id NULL)
public Page<ValidateVoucherResponse> getAvailableVouchers(BigDecimal orderAmount, Long theaterId, ...) {
    Specification<Voucher> spec = Specification.where(...)
        .and((root, q, cb) -> cb.or(
            cb.isNull(root.get("theater")),
            cb.equal(root.get("theater").get("id"), theaterId)
        ));
    ...
}
```

### 4.3. Optimistic concurrency (usedCount)

```java
@Transactional
public void useVoucherByCode(String code, User user, Booking booking, Long theaterId) {
    Voucher voucher = voucherRepository.findByCodeAndTheater(code, theaterId)
        .orElseThrow(() -> new BusinessException(ErrorCode.VOUCHER_NOT_FOUND));

    if (voucher.getUsageLimit() != null && voucher.getUsedCount() >= voucher.getUsageLimit())
        throw new BusinessException(ErrorCode.VOUCHER_LIMIT_REACHED);

    voucher.setUsedCount(voucher.getUsedCount() + 1);  // @Version detect conflict
    voucherRepository.save(voucher);

    voucherUsageRepository.save(VoucherUsage.builder()
        .voucher(voucher).user(user).booking(booking)
        .usedAt(LocalDateTime.now()).build());
}
```

`@Version` từ `BaseEntity` → 2 user đồng thời dùng cùng voucher → 1 fail với `OptimisticLockException` → giả lại lần dùng.

### 4.4. Scheduled cleanup

```java
@Component
@RequiredArgsConstructor
public class VoucherCleanupScheduler {
    @Scheduled(cron = "0 0 1 * * *")  // 01:00 mỗi ngày
    @SchedulerLock(name = "voucher-cleanup", lockAtMostFor = "PT10M")
    public void deactivateExpired() {
        voucherRepository.deactivateExpired(LocalDateTime.now());
    }
}
```

ShedLock chống chạy trùng nếu deploy multi-instance.

---

## 5. Validation logic

`validateVoucher(code, orderAmount, userId)` check theo thứ tự:

```java
public ValidateVoucherResponse validateVoucher(String code, BigDecimal orderAmount, Long userId) {
    Voucher voucher = findByCodeOrThrow(code);

    LocalDateTime now = LocalDateTime.now();
    // 1. active flag
    if (!voucher.isActive()) throw new BusinessException("VOUCHER_INACTIVE");
    // 2. date range
    if (now.isBefore(voucher.getStartDate())) throw new BusinessException("VOUCHER_NOT_STARTED");
    if (now.isAfter(voucher.getEndDate()))    throw new BusinessException("VOUCHER_EXPIRED");
    // 3. min order
    if (orderAmount.compareTo(voucher.getMinOrderAmount()) < 0)
        throw new BusinessException("VOUCHER_MIN_ORDER_NOT_MET");
    // 4. usage limit
    if (voucher.getUsageLimit() != null && voucher.getUsedCount() >= voucher.getUsageLimit())
        throw new BusinessException("VOUCHER_LIMIT_REACHED");
    // 5. user đã dùng chưa
    if (voucherUsageRepository.existsByVoucherIdAndUserId(voucher.getId(), userId))
        throw new BusinessException("VOUCHER_ALREADY_USED");

    BigDecimal discount = calculateDiscount(voucher, orderAmount);
    return ValidateVoucherResponse.builder()
        .voucherId(voucher.getId())
        .code(voucher.getCode())
        .discountAmount(discount)
        .finalAmount(orderAmount.subtract(discount))
        .build();
}
```

---

## 6. REST endpoints

### Admin (`ADMIN` role)

| Method | URL | Mục đích |
|---|---|---|
| `GET /api/vouchers` | List + filter | Phân trang, sort default `createdAt DESC` |
| `GET /api/vouchers/{id}` | Detail | |
| `POST /api/vouchers` | Tạo mới | Validate trùng code trong scope |
| `PUT /api/vouchers/{id}` | Sửa | |
| `DELETE /api/vouchers/{id}` | Soft delete | Set `storageState=ARCHIVED` |
| `POST /api/vouchers/{id}/restore` | Khôi phục | |
| `POST /api/vouchers/bulk-delete` | Xóa nhiều | |
| `POST /api/vouchers/bulk-restore` | Khôi phục nhiều | |

### User-facing

| Method | URL | Mục đích |
|---|---|---|
| `GET /api/vouchers/available` | List voucher có thể dùng | Filter theo orderAmount + theaterId |
| `POST /api/vouchers/validate` | Validate code khi user nhập | Trả discount preview |

---

## 7. Sơ đồ luồng

```
User checkout:
  ┌─────────────────────────────────────────────────────────┐
  │ FE BookingPage                                          │
  │  - User chọn ghế + snack → tổng amount                  │
  │  - GET /api/vouchers/available?orderAmount=X&theaterId=Y│
  │  - Hiển thị list voucher applicable                     │
  │  - User chọn 1 voucher                                  │
  │  - POST /api/vouchers/validate { code, orderAmount }    │
  │  - BE trả: discount + finalAmount                       │
  │  - FE update tổng tiền                                  │
  │  - User confirm thanh toán                              │
  │  - POST /api/bookings/confirm { ..., voucherCode }      │
  └────────────────────┬────────────────────────────────────┘
                       │
  ┌────────────────────▼────────────────────────────────────┐
  │ BookingService.confirmBooking                           │
  │  - Validate booking                                     │
  │  - Apply voucher: voucherService.useVoucherByCode(...)  │
  │     - check 5 condition                                 │
  │     - increment usedCount (@Version protect)            │
  │     - insert VoucherUsage                               │
  │  - Save booking với discount applied                    │
  │  - Process payment                                      │
  │  - Publish BookingConfirmedEvent                        │
  └─────────────────────────────────────────────────────────┘
```

---

## 8. Request/Response mẫu

### 8.1. Admin tạo voucher

```bash
curl -X POST http://localhost:8088/api/vouchers \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "WELCOME20",
    "description": "Voucher chào mừng tân thành viên",
    "discountType": "PERCENTAGE",
    "discountValue": 20,
    "minOrderAmount": 100000,
    "maxDiscount": 50000,
    "usageLimit": 1000,
    "startDate": "2026-06-01T00:00:00",
    "endDate": "2026-12-31T23:59:59",
    "active": true,
    "theaterId": null
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "id": 12,
    "code": "WELCOME20",
    "discountType": "PERCENTAGE",
    "discountValue": 20,
    "minOrderAmount": 100000,
    "maxDiscount": 50000,
    "usageLimit": 1000,
    "usedCount": 0,
    "startDate": "2026-06-01T00:00:00",
    "endDate": "2026-12-31T23:59:59",
    "active": true,
    "theaterId": null,
    "theaterName": null
  }
}
```

### 8.2. User validate voucher

```bash
curl -X POST http://localhost:8088/api/vouchers/validate \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "WELCOME20",
    "orderAmount": 250000
  }'
```

Response success:
```json
{
  "success": true,
  "data": {
    "voucherId": 12,
    "code": "WELCOME20",
    "discountAmount": 50000,
    "finalAmount": 200000
  }
}
```

Response error (đã dùng):
```json
{
  "success": false,
  "errorCode": "VOUCHER_ALREADY_USED",
  "message": "Bạn đã dùng voucher này rồi"
}
```

---

## 9. Anti-pattern tránh

### 9.1. ❌ Quên `@Transactional` ở `useVoucherByCode`

```java
public void useVoucherByCode(String code, ...) {  // ← thiếu @Transactional
    Voucher v = ...;
    v.setUsedCount(v.getUsedCount() + 1);
    voucherRepository.save(v);
    voucherUsageRepository.save(usage);  // ← nếu fail, usedCount đã tăng!
}
```

### 9.2. ❌ Không filter active voucher trong query

```java
@Query("SELECT v FROM Voucher v WHERE v.code = ?1")  // ← bỏ sót check
```

Return cả ARCHIVED → user thấy voucher đã xóa.

### 9.3. ❌ Validate dùng floating point

```java
if (orderAmount.doubleValue() < voucher.getMinOrderAmount().doubleValue()) ...  // ← lệch số nhỏ
```

→ Dùng `BigDecimal.compareTo()`.

### 9.4. ❌ Không cap discount khi PERCENTAGE

```java
discount = orderAmount * 0.5;  // 50% — không cap
// Order 10M → discount 5M → cháy ngân sách marketing
```

→ Luôn check `maxDiscount` cho PERCENTAGE voucher.

---

## 10. Câu hỏi tự kiểm tra

1. **Tại sao `theater_id NULL` = global voucher?**
   → Convention multi-tenant: NULL nghĩa "không thuộc rạp nào" = áp dụng mọi rạp.

2. **Tại sao cần `@Version` cho `usedCount`?**
   → 2 user đồng thời dùng voucher còn 1 slot → optimistic lock detect → 1 user fail, retry hoặc thông báo hết.

3. **PERCENTAGE 20% có `maxDiscount=100k` — đơn 1M giảm bao nhiêu?**
   → 1M × 20% = 200k → cap → giảm 100k.

4. **User dùng voucher xong hủy booking → có phải refund voucher không?**
   → Phải. Decrement `usedCount` + xóa `VoucherUsage`. CineX hiện chưa implement (xem TODO trong BookingService.cancelBooking).

5. **Code voucher có phân biệt hoa thường không?**
   → DB collation default `Latin1_General_CS_AS` (case-sensitive) → CÓ. Convention: lưu UPPERCASE.

6. **Tại sao validate trong BookingService, không trong VoucherController?**
   → Validate riêng (POST /validate) cho preview UI. Apply trong BookingService.confirmBooking để guarantee transaction + state consistency.
