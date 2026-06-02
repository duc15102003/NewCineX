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
│ BOOKING     │ CX     │ 42            │
│ USER        │ USR    │ 15            │
│ MOVIE       │ MOV    │ 8             │
└─────────────┴────────┴───────────────┘

Khi tạo booking mới:
  1. SELECT FROM id_tracker WHERE entity_type = 'BOOKING' FOR UPDATE (lock row)
  2. current_value: 42 → 43
  3. UPDATE id_tracker SET current_value = 43
  4. Code = "CX" + "-" + "20260512" + "-" + "043"
  → Kết quả: "CX-20260512-043"

Khi tạo user mới:
  1. current_value: 15 → 16
  2. Code = "USR" + "-" + "016"
  → Kết quả: "USR-016"
```

## Code Java

```java
// Sinh code có ngày (booking, payment)
String bookingCode = idTrackerService.nextCodeWithDate("BOOKING");
// → "CX-20260512-043"

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
    Code: CX-043            Code: CX-044   ← KHÔNG TRÙNG
```

Nếu không lock → 2 request cùng đọc 42 → cùng +1 = 43 → **TRÙNG CODE**!

## Tại sao không dùng UUID?

| | UUID | IdTracker |
|---|---|---|
| Ví dụ | `550e8400-e29b-41d4-a716-446655440000` | `CX-20260512-043` |
| Độ dài | 36 ký tự | 17 ký tự |
| Đọc được | Không | Có (biết ngày đặt, số thứ tự) |
| Sắp xếp | Ngẫu nhiên | Theo thứ tự |
| Cho user | Khó nhớ | Dễ nhớ, dễ đọc qua điện thoại |

---

## Schema DDL

> Lưu ý: `IdTracker` KHÔNG extends `BaseEntity` — bảng này là hạ tầng nội bộ, không cần `version`, `storage_state`, `created_at`, `updated_at` như các entity nghiệp vụ. Chỉ giữ 5 cột tối thiểu.

```sql
CREATE TABLE id_tracker (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    entity_type NVARCHAR(50) NOT NULL UNIQUE,
    prefix NVARCHAR(10) NOT NULL,
    current_value BIGINT NOT NULL DEFAULT 0,
    description NVARCHAR(100)
);

-- Seed data khi khởi tạo DB (changelog 003-create-id-tracker-table.xml)
INSERT INTO id_tracker (entity_type, prefix, current_value, description) VALUES
('BOOKING',  'CX',  0, 'Booking code: CX-20260510-001'),
('PAYMENT',  'PAY', 0, 'Payment code: PAY-20260510-001'),
('USER',     'USR', 0, 'User code: USR-001'),
('MOVIE',    'MOV', 0, 'Movie code: MOV-001'),
('ROOM',     'RM',  0, 'Room code: RM-001'),
('GENRE',    'GNR', 0, 'Genre code: GNR-001'),
('SHOWTIME', 'ST',  0, 'Showtime code: ST-20260515-001');
```

---

## Code IdTrackerService đầy đủ

> Lưu ý: CineX format số thứ tự bằng `%03d` (3 chữ số, padding `0`) — VD `001`, `042`, `999`. Khi vượt 999 sẽ tự nới ra `1000`, `1001`... (định dạng `%03d` chỉ pad ở dưới ngưỡng, không chặn).
>
> Code KHÔNG có logic auto-reset theo ngày. Số `current_value` luôn tăng đơn điệu. Việc "có ngày" trong code chỉ là ghép chuỗi `yyyyMMdd` vào giữa prefix và số — không reset counter.

```java
@Service
@RequiredArgsConstructor
public class IdTrackerService {

    private final IdTrackerRepository idTrackerRepository;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyyMMdd");

    /**
     * Sinh code có ngày: VD "CX-20260510-001"
     * Dùng cho: booking, payment
     */
    @Transactional
    public String nextCodeWithDate(String entityType) {
        IdTracker tracker = getAndIncrement(entityType);
        String date = LocalDate.now().format(DATE_FMT);
        return String.format("%s-%s-%03d", tracker.getPrefix(), date, tracker.getCurrentValue());
    }

    /**
     * Sinh code không có ngày: VD "USR-001", "MOV-001"
     * Dùng cho: user, movie, room, ...
     */
    @Transactional
    public String nextCode(String entityType) {
        IdTracker tracker = getAndIncrement(entityType);
        return String.format("%s-%03d", tracker.getPrefix(), tracker.getCurrentValue());
    }

    /**
     * Lấy số tiếp theo (không format): VD 1, 2, 3, ...
     */
    @Transactional
    public long nextValue(String entityType) {
        IdTracker tracker = getAndIncrement(entityType);
        return tracker.getCurrentValue();
    }

    private IdTracker getAndIncrement(String entityType) {
        IdTracker tracker = idTrackerRepository.findByEntityType(entityType)
                .orElseThrow(() -> new IllegalArgumentException(
                        "IdTracker not found for entity type: " + entityType));
        tracker.setCurrentValue(tracker.getCurrentValue() + 1);
        return idTrackerRepository.save(tracker);
    }
}
```

### Repository với Pessimistic Lock

```java
public interface IdTrackerRepository extends JpaRepository<IdTracker, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<IdTracker> findByEntityType(String entityType);
}
```

> Spring Data JPA tự sinh JPQL từ tên method `findByEntityType` (derived query). Annotation `@Lock(PESSIMISTIC_WRITE)` ép Hibernate thêm `FOR UPDATE` vào câu SELECT → row id_tracker bị khóa cho tới khi transaction commit. Không cần viết `@Query` hay `@QueryHints` thủ công.

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
