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
