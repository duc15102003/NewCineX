# Module Seat — Giải thích chi tiết

## 1. Tổng quan
Module Seat quản lý **sơ đồ ghế** của từng phòng chiếu:
- Admin: sinh ghế tự động theo config (số hàng, số cột, hàng VIP, hàng couple), sửa loại/trạng thái ghế
- User: xem sơ đồ ghế dạng grid (để chọn ghế khi đặt vé)

**Bài toán:** Mỗi phòng chiếu có layout ghế khác nhau. Admin cần tạo sơ đồ ghế nhanh (không phải nhập từng ghế), FE cần dữ liệu dạng grid để render.

## 2. Danh sách files

| File | Tác dụng | Design Pattern |
|---|---|---|
| `module/seat/entity/Seat.java` | Entity ghế, @ManyToOne với Room | — |
| `module/seat/entity/SeatType.java` | Enum: STANDARD, VIP, COUPLE | Enum |
| `module/seat/entity/SeatStatus.java` | Enum: AVAILABLE, BROKEN | Enum |
| `module/seat/dto/SeatResponse.java` | DTO thông tin 1 ghế | DTO |
| `module/seat/dto/SeatGenerateRequest.java` | DTO config sinh ghế (rows, cols, vipRows, coupleRow) | DTO |
| `module/seat/dto/SeatMapResponse.java` | Sơ đồ ghế nhóm theo hàng | DTO |
| `module/seat/dto/UpdateSeatRequest.java` | DTO sửa ghế (type, status) | DTO |
| `module/seat/repository/SeatRepository.java` | Query + delete ghế theo roomId | Repository |
| `module/seat/mapper/SeatMapper.java` | Seat → SeatResponse (MapStruct) | Mapper |
| `module/seat/service/SeatService.java` | Generate seats, get seat map, update seat | Service |
| `module/seat/controller/SeatController.java` | 3 endpoints | Controller |

## 3. Design Patterns

### 3.1 Quan hệ N:1 (@ManyToOne) — Seat thuộc Room

```java
@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "room_id", nullable = false)
private Room room;
```

**Ví dụ đời thường:** 1 phòng chiếu có 120 ghế. Mỗi ghế "biết" mình thuộc phòng nào.

**Khác gì N:N (Movie ↔ Genre)?**

| | N:1 (Seat → Room) | N:N (Movie ↔ Genre) |
|---|---|---|
| Bảng join | KHÔNG cần — FK nằm trực tiếp trong bảng seats | CẦN bảng movie_genres |
| Annotation | `@ManyToOne` + `@JoinColumn` | `@ManyToMany` + `@JoinTable` |
| Chiều | 1 chiều: Seat biết Room, Room KHÔNG biết Seat | 2 chiều có thể |

**FetchType.LAZY quan trọng ở đây:**
```sql
-- Khi query 120 ghế của phòng 1:
SELECT * FROM seats WHERE room_id = 1   -- 1 query

-- Nếu EAGER: mỗi ghế tự load Room entity
SELECT * FROM rooms WHERE id = 1        -- lặp 120 lần! (N+1)

-- LAZY: chỉ query Room khi gọi seat.getRoom() → 0 query thêm nếu không cần
```

### 3.2 Batch Generate — Sinh nhiều entity cùng lúc

```java
// Sinh 120 ghế trong 1 transaction
List<Seat> seats = new ArrayList<>();
for (int row = 0; row < 10; row++) {
    for (int col = 1; col <= 12; col++) {
        seats.add(Seat.builder()...build());
    }
}
seatRepository.saveAll(seats);  // 1 lần saveAll thay vì 120 lần save
```

**Tại sao `saveAll` thay vì vòng lặp `save`?**
- `save()` 120 lần = 120 INSERT riêng lẻ → chậm
- `saveAll()` = Hibernate gom lại batch INSERT → nhanh hơn nhiều

### 3.3 LinkedHashMap — Giữ thứ tự hàng

```java
Map<String, List<SeatResponse>> seatMap = new LinkedHashMap<>();
```

- `HashMap`: không đảm bảo thứ tự → hàng B có thể trước hàng A
- `LinkedHashMap`: giữ thứ tự insert → A trước B trước C
- FE cần thứ tự đúng để render grid từ hàng đầu (A) đến hàng cuối (J)

## 4. Sơ đồ luồng xử lý

### Generate ghế cho phòng
```
POST /api/rooms/1/seats/generate (ADMIN)
Body: { "totalRows": 10, "totalCols": 12, "vipRows": ["E","F","G"], "coupleRow": "J" }
│
▼
SeatController.generateSeats(roomId=1, request)
│
▼
SeatService.generateSeats(1, request)
│
├── 1. findRoomById(1) → Room "Room 1" ✅
│
├── 2. Xóa ghế cũ (nếu có)
│      DELETE FROM seats WHERE room_id = 1
│
├── 3. Sinh ghế mới:
│      Hàng A (row=0): col 1→12 → A1, A2, ..., A12 (STANDARD)
│      Hàng B (row=1): col 1→12 → B1, B2, ..., B12 (STANDARD)
│      ...
│      Hàng E (row=4): col 1→12 → E1, E2, ..., E12 (VIP) ← vipRows
│      Hàng F (row=5): col 1→12 → F1, F2, ..., F12 (VIP)
│      Hàng G (row=6): col 1→12 → G1, G2, ..., G12 (VIP)
│      ...
│      Hàng J (row=9): col 1→12 → J1, J2, ..., J12 (COUPLE) ← coupleRow
│
│      Tổng: 10 × 12 = 120 ghế
│
├── 4. seatRepository.saveAll(120 seats) → batch INSERT
│
├── 5. room.setTotalSeats(120) → UPDATE rooms
│
└── 6. Trả SeatMapResponse (sơ đồ nhóm theo hàng)
```

### FE render grid từ SeatMapResponse
```
Response:
{
  "seatMap": {
    "A": [{"seatNumber":"A1","seatType":"STANDARD"}, {"seatNumber":"A2",...}, ...],
    "B": [...],
    "E": [{"seatNumber":"E1","seatType":"VIP"}, ...],     ← ghế VIP (màu vàng)
    "J": [{"seatNumber":"J1","seatType":"COUPLE"}, ...]   ← ghế đôi (màu hồng)
  }
}

FE render:
    1   2   3   4   5   6   7   8   9  10  11  12
A  [□] [□] [□] [□] [□] [□] [□] [□] [□] [□] [□] [□]  ← STANDARD
B  [□] [□] [□] [□] [□] [□] [□] [□] [□] [□] [□] [□]
C  [□] [□] [□] [□] [□] [□] [□] [□] [□] [□] [□] [□]
D  [□] [□] [□] [□] [□] [□] [□] [□] [□] [□] [□] [□]
E  [★] [★] [★] [★] [★] [★] [★] [★] [★] [★] [★] [★]  ← VIP
F  [★] [★] [★] [★] [★] [★] [★] [★] [★] [★] [★] [★]
G  [★] [★] [★] [★] [★] [★] [★] [★] [★] [★] [★] [★]
H  [□] [□] [□] [□] [□] [□] [□] [□] [□] [□] [□] [□]
I  [□] [□] [□] [□] [□] [□] [□] [□] [□] [□] [□] [□]
J  [♥♥] [♥♥] [♥♥] [♥♥] [♥♥] [♥♥]                    ← COUPLE (2 cột/ghế)

                    === MÀN HÌNH ===
```

## 5. Khái niệm mới cần biết

### @ManyToOne vs @ManyToMany
- `@ManyToOne`: nhiều Seat thuộc 1 Room → FK `room_id` nằm trong bảng seats
- `@ManyToMany`: nhiều Movie có nhiều Genre → cần bảng join movie_genres
- **Quy tắc:** Nếu 1 entity chỉ thuộc 1 entity khác → dùng @ManyToOne (không cần bảng join)

### @Modifying (Spring Data JPA)
```java
@Modifying
@Query("UPDATE Seat s SET s.storageState = 'DELETED' WHERE s.room.id = :roomId AND (s.storageState IS NULL OR s.storageState <> 'DELETED')")
void softDeleteByRoomId(Long roomId);
```
- Mặc định Spring Data JPA coi mọi `@Query` là SELECT
- UPDATE/DELETE query phải thêm `@Modifying` → Spring biết đây là write query
- Thiếu `@Modifying` → runtime error
- Dùng **soft delete** (UPDATE storageState) thay vì hard delete (DELETE FROM) → giữ audit trail

### computeIfAbsent (Java Map)
```java
seatMap.computeIfAbsent(seat.getRowLabel(), k -> new ArrayList<>())
       .add(seatMapper.toResponse(seat));
```
- Nếu key "A" chưa có → tạo ArrayList mới → put vào map → add ghế
- Nếu key "A" đã có → lấy ArrayList có sẵn → add ghế
- Viết gọn thay vì:
```java
if (!seatMap.containsKey("A")) {
    seatMap.put("A", new ArrayList<>());
}
seatMap.get("A").add(seat);
```

## 6. Annotation mới sử dụng

| Annotation | Tác dụng | Ví dụ |
|---|---|---|
| `@ManyToOne(fetch=LAZY)` | Quan hệ nhiều-một, lazy load | Seat → Room |
| `@JoinColumn(name="room_id")` | Chỉ định cột FK | Seat.room |
| `@Modifying` | Đánh dấu query DELETE/UPDATE | SeatRepository.softDeleteByRoomId() |
| `@Max(26)` | Validation giá trị tối đa | SeatGenerateRequest.totalRows |

## 7. SQL được sinh ra

```sql
-- Sơ đồ ghế phòng 1 (sắp xếp theo hàng + cột)
SELECT * FROM seats WHERE room_id = 1 ORDER BY row_label ASC, col_number ASC

-- Xóa ghế cũ trước khi generate
DELETE FROM seats WHERE room_id = 1

-- Generate 120 ghế (batch insert)
INSERT INTO seats (room_id, row_label, col_number, seat_number, seat_type, status, version, created_by, created_at, updated_at)
VALUES (1, 'A', 1, 'A1', 'STANDARD', 'AVAILABLE', 0, 'admin', GETDATE(), GETDATE()),
       (1, 'A', 2, 'A2', 'STANDARD', 'AVAILABLE', 0, 'admin', GETDATE(), GETDATE()),
       ...
       (1, 'E', 1, 'E1', 'VIP', 'AVAILABLE', ...),
       ...
       (1, 'J', 1, 'J1', 'COUPLE', 'AVAILABLE', ...)

-- Cập nhật totalSeats
UPDATE rooms SET total_seats = 120, version = version + 1 WHERE id = 1

-- Sửa ghế
UPDATE seats SET seat_type = 'VIP', version = version + 1 WHERE id = 5
```

## 8. Request/Response mẫu

### GET /api/rooms/{roomId}/seats — Sơ đồ ghế
```bash
curl http://localhost:8088/api/rooms/1/seats
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "roomId": 1,
    "roomName": "Room 1",
    "totalSeats": 120,
    "seatMap": {
      "A": [
        {"id": 1, "rowLabel": "A", "colNumber": 1, "seatNumber": "A1", "seatType": "STANDARD", "status": "AVAILABLE"},
        {"id": 2, "rowLabel": "A", "colNumber": 2, "seatNumber": "A2", "seatType": "STANDARD", "status": "AVAILABLE"}
      ],
      "E": [
        {"id": 49, "rowLabel": "E", "colNumber": 1, "seatNumber": "E1", "seatType": "VIP", "status": "AVAILABLE"}
      ],
      "J": [
        {"id": 109, "rowLabel": "J", "colNumber": 1, "seatNumber": "J1", "seatType": "COUPLE", "status": "AVAILABLE"}
      ]
    }
  }
}
```

### POST /api/rooms/{roomId}/seats/generate — (Admin) Sinh ghế
```bash
curl -X POST http://localhost:8088/api/rooms/1/seats/generate \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"totalRows": 10, "totalCols": 12, "vipRows": ["E","F","G"], "coupleRow": "J"}'
```

### PUT /api/seats/{id} — (Admin) Sửa ghế
```bash
curl -X PUT http://localhost:8088/api/seats/5 \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"seatType": "VIP", "status": "BROKEN"}'
```

## 9. Câu hỏi tự kiểm tra

1. **Tại sao generate seats xóa hết ghế cũ rồi tạo mới, thay vì chỉ thêm ghế thiếu?**
   → Vì admin có thể đổi layout hoàn toàn (VD: từ 10×12 sang 8×15). Xóa hết + tạo mới đơn giản hơn và đảm bảo đúng layout. Nếu phòng đã có suất chiếu → cần check trước (sẽ làm ở task Showtime).

2. **LinkedHashMap khác HashMap ở điểm nào? Tại sao cần ở đây?**
   → LinkedHashMap giữ thứ tự insert, HashMap không. FE cần render hàng A trước B trước C → phải giữ thứ tự.

3. **Nếu bỏ `@Modifying` ở method softDeleteByRoomId thì sao?**
   → Spring coi đó là SELECT query → lỗi runtime vì kết quả DELETE không thể map thành entity.

4. **`saveAll(120 seats)` nhanh hơn `save()` 120 lần vì sao?**
   → `saveAll` gom nhiều INSERT thành 1 batch → ít round-trip đến DB. `save` 120 lần = 120 round-trip riêng lẻ.
