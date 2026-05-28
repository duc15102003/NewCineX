# Module Room — Giải thích chi tiết

## 1. Tổng quan
Module Room quản lý **phòng chiếu** trong rạp phim:
- Admin: tạo/sửa/xóa phòng chiếu
- User: xem danh sách phòng (phục vụ cho chọn suất chiếu)

Mỗi phòng có: tên (VD: "Room 1"), loại (2D/3D/IMAX/4DX), tổng số ghế, trạng thái.

**Lưu ý:** Module này là "khung sườn" — ghế ngồi cụ thể sẽ làm ở task 007 (Seat).

## 2. Danh sách files

| File | Tác dụng | Design Pattern |
|---|---|---|
| `module/room/entity/Room.java` | Entity map bảng `rooms` | — |
| `module/room/entity/RoomType.java` | Enum loại phòng: TWO_D, THREE_D, IMAX, FOUR_DX | Enum |
| `module/room/entity/RoomStatus.java` | Enum trạng thái: ACTIVE, MAINTENANCE, INACTIVE | Enum |
| `module/room/dto/RoomRequest.java` | DTO tạo/sửa phòng (validation) | DTO |
| `module/room/dto/RoomResponse.java` | DTO trả thông tin phòng | DTO |
| `module/room/repository/RoomRepository.java` | Truy vấn bảng rooms | Repository |
| `module/room/mapper/RoomMapper.java` | Room → RoomResponse (MapStruct) | Mapper |
| `module/room/service/RoomService.java` | Business logic CRUD | Service |
| `module/room/controller/RoomController.java` | 5 REST endpoints | Controller |

## 3. Design Patterns

Task này chủ yếu **áp dụng lại** các pattern đã học:
- **Enum Pattern** — RoomType, RoomStatus (type-safe, EnumType.STRING)
- **DTO Pattern** — RoomRequest/RoomResponse tách biệt với entity
- **Mapper (MapStruct)** — tự sinh code Room → RoomResponse
- **Repository** — Spring Data JPA
- **Soft Delete** — storageState = "DELETED"

Không có pattern mới — task này giúp **thực hành lặp lại** quy trình tạo module CRUD chuẩn.

### Quy trình tạo module CRUD (áp dụng lại cho mọi module)

```
1. Đọc Liquibase → biết bảng có những cột gì
2. Tạo Entity + Enum → map đúng với bảng DB
3. Tạo DTO (Request + Response) → validation + tách biệt
4. Tạo Repository → khai báo query cần thiết
5. Tạo Mapper (MapStruct) → entity ↔ DTO
6. Tạo Service → business logic (check trùng, soft delete, ...)
7. Tạo Controller → nhận request → gọi service → trả ApiResponse
8. Thêm ErrorCode → mã lỗi riêng cho module
9. Cập nhật SecurityConfig → public/authenticated URLs
```

## 4. Sơ đồ luồng xử lý

### Tạo phòng mới (Admin)
```
POST /api/rooms (ADMIN)
Body: { "name": "Room 1", "type": "IMAX", "totalSeats": 200 }
│
▼
RoomController.createRoom(RoomRequest)
│
▼
RoomService.createRoom(request)
│
├── existsByName("Room 1") → false ✅
│   (nếu true → throw ROOM_EXISTED 409)
│
├── Room.builder()
│     .name("Room 1")
│     .type(RoomType.IMAX)
│     .totalSeats(200)
│     .status(RoomStatus.ACTIVE)  ← mặc định
│     .build()
│
├── roomRepository.save(room) → INSERT INTO rooms
│
└── roomMapper.toResponse(room) → RoomResponse
```

### Kiểm tra trùng tên khi sửa
```
PUT /api/rooms/1 { "name": "Room 2", ... }
│
▼
RoomService.updateRoom(1, request)
│
├── findRoomById(1) → Room { name: "Room 1" }
│
├── "Room 1" != "Room 2" → tên đổi → kiểm tra trùng
│   existsByName("Room 2") → true → ROOM_EXISTED 409!
│
│   Tại sao kiểm tra "tên đổi" trước?
│   → Nếu giữ nguyên tên "Room 1" mà vẫn check existsByName("Room 1")
│     → true (chính nó) → báo lỗi sai!
```

## 5. Khái niệm mới cần biết

### @Builder.Default
```java
@Builder.Default
private RoomStatus status = RoomStatus.ACTIVE;
```
- Khi dùng `@Builder`, Lombok **bỏ qua** giá trị mặc định của field
- `Room.builder().name("Room 1").build()` → status = **null** (không phải ACTIVE!)
- `@Builder.Default` bảo Lombok: "nếu không set, dùng giá trị mặc định"
- → `Room.builder().name("Room 1").build()` → status = **ACTIVE** ✅

### Kiểm tra trùng tên khi UPDATE
```java
// Sai: luôn check → báo lỗi khi giữ nguyên tên (vì tìm thấy chính nó)
if (roomRepository.existsByName(request.getName())) { throw... }

// Đúng: chỉ check khi tên thay đổi
if (!room.getName().equals(request.getName()) && roomRepository.existsByName(request.getName())) {
    throw...
}
```
Đây là lỗi phổ biến khi viết API update — nhớ kiểm tra "có đổi giá trị không" trước khi check unique.

## 6. Annotation mới sử dụng

Không có annotation mới — task này dùng lại tất cả annotation đã học từ task 004-005.

## 7. SQL được sinh ra

```sql
-- Danh sách phòng (filter soft delete bằng Java)
SELECT * FROM rooms

-- Chi tiết phòng
SELECT * FROM rooms WHERE id = 1

-- Kiểm tra trùng tên
SELECT COUNT(*) FROM rooms WHERE name = 'Room 1'

-- Tạo phòng
INSERT INTO rooms (name, type, total_seats, status, version, created_by, created_at, updated_at)
VALUES ('Room 1', 'IMAX', 200, 'ACTIVE', 0, 'admin', GETDATE(), GETDATE())

-- Sửa phòng
UPDATE rooms SET name = 'Room 1 VIP', type = 'FOUR_DX', total_seats = 100,
       version = version + 1, updated_by = 'admin', updated_at = GETDATE()
WHERE id = 1 AND version = 0

-- Xóa mềm
UPDATE rooms SET storage_state = 'DELETED', version = version + 1
WHERE id = 1 AND version = 0
```

## 8. Request/Response mẫu

### GET /api/rooms — Danh sách phòng
```bash
curl http://localhost:8088/api/rooms
```

**Response (200):**
```json
{
  "success": true,
  "message": "OK",
  "data": [
    { "id": 1, "name": "Room 1", "type": "TWO_D", "totalSeats": 120, "status": "ACTIVE" },
    { "id": 2, "name": "Room 2", "type": "IMAX", "totalSeats": 200, "status": "ACTIVE" },
    { "id": 3, "name": "Room 3", "type": "FOUR_DX", "totalSeats": 80, "status": "MAINTENANCE" }
  ]
}
```

### POST /api/rooms — (Admin) Tạo phòng
```bash
curl -X POST http://localhost:8088/api/rooms \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Room 4", "type": "THREE_D", "totalSeats": 150}'
```

### PUT /api/rooms/{id} — (Admin) Sửa phòng
```bash
curl -X PUT http://localhost:8088/api/rooms/1 \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Room 1 VIP", "type": "IMAX", "totalSeats": 200, "status": "ACTIVE"}'
```

**Response lỗi — trùng tên (409):**
```json
{"success": false, "message": "Room 'Room 2' already exists"}
```

### DELETE /api/rooms/{id} — (Admin) Xóa mềm
```bash
curl -X DELETE http://localhost:8088/api/rooms/1 \
  -H "Authorization: Bearer <admin_token>"
```

## 9. Câu hỏi tự kiểm tra

1. **Tại sao cần `@Builder.Default` cho field status?**
   → Vì Lombok @Builder bỏ qua giá trị mặc định. Không có `@Builder.Default` → `Room.builder().build()` → status = null → lỗi DB (NOT NULL constraint).

2. **Khi sửa phòng, giữ nguyên tên "Room 1" mà vẫn check `existsByName("Room 1")` thì sao?**
   → Trả true (vì chính nó tồn tại) → báo lỗi "trùng tên" sai. Phải kiểm tra `!room.getName().equals(request.getName())` trước.

3. **Soft delete phòng, nhưng phòng đó đang có suất chiếu thì sao?**
   → Cần kiểm tra ở task Showtime sau — nếu phòng còn suất chiếu chưa kết thúc thì không cho xóa.

4. **Tại sao RoomType dùng TWO_D thay vì 2D?**
   → Java enum không cho bắt đầu bằng số. `2D` là tên biến không hợp lệ → dùng `TWO_D`.
