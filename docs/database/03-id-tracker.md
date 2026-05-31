# IdTracker — Sinh mã code tự động

## Là gì?
Bảng `id_tracker` lưu số sequence cho từng entity. Mỗi lần tạo record → lấy số tiếp → ghép thành mã code đẹp.

## Ví dụ đời thường
Máy bốc số ngân hàng: bấm nút → ra số tiếp theo (001, 002, 003...). Không bao giờ trùng.

## Cách hoạt động

```
Bảng id_tracker:
┌─────────────┬────────┬───────────────┐
│ entity_type │ prefix │ current_value │
├─────────────┼────────┼───────────────┤
│ BOOKING     │ VC     │ 42            │
│ USER        │ USR    │ 15            │
│ MOVIE       │ MOV    │ 8             │
└─────────────┴────────┴───────────────┘

Khi tạo booking mới:
  1. SELECT FROM id_tracker WHERE entity_type = 'BOOKING' FOR UPDATE (lock row)
  2. current_value: 42 → 43
  3. UPDATE id_tracker SET current_value = 43
  4. Code = "VC" + "-" + "20260512" + "-" + "043"
  → Kết quả: "VC-20260512-043"

Khi tạo user mới:
  1. current_value: 15 → 16
  2. Code = "USR" + "-" + "016"
  → Kết quả: "USR-016"
```

## Code Java

```java
// Sinh code có ngày (booking, payment)
String bookingCode = idTrackerService.nextCodeWithDate("BOOKING");
// → "VC-20260512-043"

// Sinh code không có ngày (user, movie, room)
String userCode = idTrackerService.nextCode("USER");
// → "USR-016"

// Chỉ lấy số
long seq = idTrackerService.nextValue("MOVIE");
// → 9
```

## Tại sao dùng Pessimistic Lock?

```
User A tạo booking     User B tạo booking (cùng lúc)
    │                       │
    ├─ SELECT ... FOR UPDATE (lock row BOOKING)
    │                       ├─ SELECT ... FOR UPDATE → PHẢI CHỜ
    ├─ current: 42 → 43    │
    ├─ COMMIT → mở lock    │
    │                       ├─ Được vào: current: 43 → 44
    │                       ├─ COMMIT
    │                       │
    Code: VC-043            Code: VC-044   ← KHÔNG TRÙNG
```

Nếu không lock → 2 request cùng đọc 42 → cùng +1 = 43 → **TRÙNG CODE**!

## Tại sao không dùng UUID?

| | UUID | IdTracker |
|---|---|---|
| Ví dụ | `550e8400-e29b-41d4-a716-446655440000` | `VC-20260512-043` |
| Độ dài | 36 ký tự | 17 ký tự |
| Đọc được | Không | Có (biết ngày đặt, số thứ tự) |
| Sắp xếp | Ngẫu nhiên | Theo thứ tự |
| Cho user | Khó nhớ | Dễ nhớ, dễ đọc qua điện thoại |

---

## Schema DDL

```sql
CREATE TABLE id_tracker (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    entity_type NVARCHAR(50) NOT NULL UNIQUE,
    prefix NVARCHAR(20) NOT NULL,
    current_value BIGINT NOT NULL DEFAULT 0,
    last_reset_date DATE,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    version BIGINT NOT NULL DEFAULT 0
);

INSERT INTO id_tracker (entity_type, prefix, current_value) VALUES
('BOOKING', 'CX', 0),
('INVOICE', 'INV', 0),
('USER', 'USR', 0);
```

---

## Code IdTrackerService đầy đủ

```java
@Service
@RequiredArgsConstructor
public class IdTrackerService {

    private final IdTrackerRepository repository;

    @Transactional
    public String nextCode(String entityType) {
        IdTracker tracker = repository.findByEntityTypeForUpdate(entityType)
            .orElseThrow(() -> new BusinessException(ErrorCode.TRACKER_NOT_FOUND));

        long next = tracker.getCurrentValue() + 1;
        tracker.setCurrentValue(next);

        return String.format("%s-%06d", tracker.getPrefix(), next);
    }

    @Transactional
    public String nextCodeWithDate(String entityType) {
        IdTracker tracker = repository.findByEntityTypeForUpdate(entityType)
            .orElseThrow(() -> new BusinessException(ErrorCode.TRACKER_NOT_FOUND));

        LocalDate today = LocalDate.now();
        if (!today.equals(tracker.getLastResetDate())) {
            tracker.setCurrentValue(0);
            tracker.setLastResetDate(today);
        }

        long next = tracker.getCurrentValue() + 1;
        tracker.setCurrentValue(next);

        String dateStr = today.format(DateTimeFormatter.BASIC_ISO_DATE);
        return String.format("%s-%s-%03d", tracker.getPrefix(), dateStr, next);
    }
}
```

### Repository với Pessimistic Lock

```java
public interface IdTrackerRepository extends JpaRepository<IdTracker, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @QueryHints({ @QueryHint(name = "javax.persistence.lock.timeout", value = "3000") })
    @Query("SELECT t FROM IdTracker t WHERE t.entityType = :type")
    Optional<IdTracker> findByEntityTypeForUpdate(@Param("type") String type);
}
```

---

## Tích hợp với BookingService

```java
@Transactional
public Booking createBooking(BookingRequest req) {
    String bookingCode = idTrackerService.nextCodeWithDate("BOOKING");
    // → "CX-20260524-001"

    Booking booking = Booking.builder()
        .bookingCode(bookingCode)
        .status(BookingStatus.HOLDING)
        .build();

    return bookingRepository.save(booking);
}
```

---

## Performance & Alternatives

### Bottleneck
IdTracker là single row → mọi request lock cùng row → bottleneck.
- 1 instance: ~500 req/s
- 10 instance share DB: vẫn ~500 req/s (single row lock)

### Khi nào dùng
**Có**: code đẹp cho user (vé, hóa đơn), throughput trung bình (<100 req/s).

**Không**: throughput cao, distributed multi-region.

### Alternatives
- **UUID v7** (2024+): sortable, time-based. Không bottleneck. Dài hơn.
- **SQL Server SEQUENCE**: `CREATE SEQUENCE`. DB-native, fast. Không reset theo ngày được.
- **Snowflake ID**: 64-bit, distributed. Twitter-scale.
- **Hi/Lo pattern**: allocate batch 100 ID/lần → 100x ít lock.

---

## Câu hỏi tự kiểm tra

**Câu 1**: Tại sao Pessimistic Lock thay vì Optimistic?

→ Pessimistic guarantee không conflict. Optimistic phải retry khi conflict — với throughput trung bình thì cũng OK, nhưng pessimistic đơn giản hơn cho case này.

**Câu 2**: Nếu transaction crash giữa chừng (sau khi increment, trước commit)?

→ Rollback → `current_value` về cũ → không có booking nào dùng code dở dang. Lock release tự động khi crash.

**Câu 3**: Tại sao IdTracker không phải bottleneck với CineX hiện tại?

→ CineX dự đoán ~10-50 booking/phút, không phải Shopee Sale Live. Single row lock đủ với throughput này.
