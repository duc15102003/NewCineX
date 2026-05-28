# Module Snack — Giải thích chi tiết

## 1. Tổng quan
Module Snack quản lý **menu đồ ăn** rạp phim (bắp rang, nước, combo) và **đồ ăn kèm đơn đặt vé**.

- Admin: CRUD menu đồ ăn (tên, giá, ảnh, danh mục)
- User: xem menu + chọn đồ ăn khi đặt vé

---

## 2. Danh sách files

| File | Tác dụng | Design Pattern |
|---|---|---|
| `entity/Snack.java` | Entity extends BaseEntity — name, price, imageUrl, category, available | Inheritance (BaseEntity) |
| `entity/BookingSnack.java` | Bảng liên kết (KHÔNG extends BaseEntity) — booking_id, snack_id, quantity, price | Join Table |
| `dto/SnackRequest.java` | name, description, price, imageUrl, category | DTO Pattern |
| `dto/SnackResponse.java` | Đầy đủ fields + storageState, createdAt, updatedAt | DTO Pattern |
| `repository/SnackRepository.java` | JpaSpecificationExecutor | Repository Pattern |
| `repository/BookingSnackRepository.java` | JpaRepository đơn giản | Repository Pattern |
| `mapper/SnackMapper.java` | MapStruct toResponse | Mapper Pattern |
| `service/SnackService.java` | CRUD + list available only for users | Service Layer |
| `controller/SnackController.java` | 5 endpoints (GET public, CUD admin) | MVC Controller |

---

## 3. Design Patterns đã áp dụng

### Specification Pattern — inline (Behavioral)
**Giải thích đời thường:** Menu nhà hàng chỉ hiện món còn phục vụ — không hiện món đã ngừng bán hoặc hết hàng. Specification là bộ lọc làm điều này tự động.

```java
// Specification inline trong service — không cần class riêng vì đơn giản
Specification<Snack> spec = (root, query, cb) -> cb.and(
    // Điều kiện 1: available = true (còn bán)
    cb.isTrue(root.get("available")),
    // Điều kiện 2: storageState IS NULL hoặc khác 'DELETED' (chưa bị xóa mềm)
    cb.or(
        cb.isNull(root.get("storageState")),
        cb.notEqual(root.get("storageState"), "DELETED")
    )
);
return snackRepository.findAll(spec, pageable);
```

**Tại sao `storageState IS NULL OR storageState != 'DELETED'`?**
Record mới tạo có `storageState = null` (chưa set), sau đó mới là "ACTIVE" hoặc "DELETED". Nếu chỉ check `!= 'DELETED'`, record có `storageState = null` vẫn pass — đúng nghiệp vụ.

### Snapshot Price Pattern
**Giải thích đời thường:** Bạn mua vé xe buýt tháng 5 giá 7.000đ. Tháng 6 xe tăng lên 9.000đ. Vé cũ của bạn vẫn ghi 7.000đ — đó là snapshot giá.

```java
// BookingSnack lưu price tại thời điểm đặt
bookingSnack.setPrice(snack.getPrice()); // snapshot!
// Sau này admin đổi snack.price → không ảnh hưởng bookingSnack.price đã lưu
```

### 2 Entity cho 2 mục đích
```
snacks (menu — admin quản lý)          booking_snacks (đã đặt — không đổi)
├── id: 1                              ├── id: 1
├── name: "Bắp rang lớn"              ├── booking_id: CX-001
├── price: 45000   ← có thể đổi       ├── snack_id: 1
├── available: true                    ├── quantity: 2
└── storageState: ACTIVE              └── price: 45000  ← snapshot, KHÔNG đổi
```

---

## 4. Sơ đồ luồng xử lý

### Luồng Admin tạo snack mới

```
Admin gửi POST /api/snacks
    |
    v
[JwtAuthFilter] → xác thực token + kiểm tra role ADMIN
    |
    v
[SnackController.createSnack(request)]
    |
    v
[SnackService.createSnack(request)]
    |
    +---> Validate: name không trùng? (optional business check)
    |
    +---> Build entity:
    |     Snack.builder()
    |       .name(request.getName())
    |       .price(request.getPrice())
    |       .description(request.getDescription())
    |       .imageUrl(request.getImageUrl())
    |       .category(request.getCategory())
    |       .available(true)  // mặc định available khi tạo
    |       .build()
    |
    +---> snackRepository.save(snack)
    |
    v
SnackMapper.toResponse(snack) → SnackResponse
    |
    v
ApiResponse<SnackResponse> (201 Created)
```

### Luồng User xem menu

```
User gửi GET /api/snacks?page=0&size=20
    |
    v
[SnackController.getSnacks()] — không cần token
    |
    v
[SnackService.getAvailableSnacks(pageable)]
    |
    +---> Build Specification:
    |     available = true AND storageState != 'DELETED'
    |
    +---> snackRepository.findAll(spec, pageable)
    |     → Chỉ trả snack còn bán, chưa bị xóa
    |
    v
Page<SnackResponse> → PageResponse<SnackResponse>
    |
    v
ApiResponse (200 OK)
```

### Luồng User đặt vé + chọn combo

```
User đặt vé và gửi snacks kèm theo
    |
    v
[BookingService.createBooking(request)]
    |
    request.snacks = [
      {snackId: 1, quantity: 2},   // Bắp rang × 2
      {snackId: 2, quantity: 3}    // Coca × 3
    ]
    |
    +---> Tạo Booking entity và lưu
    |
    +---> Với mỗi snack trong request:
    |     +---> Load Snack: snackRepository.findById(snackId)
    |     |     └─ not found → throw ENTITY_NOT_FOUND
    |     |
    |     +---> Check available: snack.isAvailable()
    |     |     └─ false → throw SNACK_NOT_AVAILABLE
    |     |
    |     +---> Tạo BookingSnack:
    |           BookingSnack.builder()
    |             .booking(booking)
    |             .snack(snack)
    |             .quantity(item.getQuantity())
    |             .price(snack.getPrice())  // ← SNAPSHOT!
    |             .build()
    |
    +---> Tính tổng tiền:
    |     totalAmount = seatTotal + snackTotal
    |     snackTotal = Σ (quantity × price)
    |
    v
Booking đã bao gồm snacks
```

### Luồng Admin restore snack đã xóa

```
Admin gửi POST /api/snacks/{id}/restore
    |
    v
[SnackService.restoreSnack(id)]
    |
    +---> Load snack kể cả đã xóa
    |     (findByIdIncludeDeleted — bỏ qua soft delete filter)
    |
    +---> snack.setStorageState("ACTIVE")
    +---> snack.setAvailable(true)
    +---> snackRepository.save(snack)
    |
    v
ApiResponse (200 OK, message: "Snack restored")
```

---

## 5. SQL được sinh ra

### SELECT menu cho user (chỉ available + active)
```sql
-- getAvailableSnacks() với Specification
SELECT *
FROM snacks
WHERE available = 1
  AND (storage_state IS NULL OR storage_state <> 'DELETED')
ORDER BY category, name
OFFSET 0 ROWS FETCH NEXT 20 ROWS ONLY
```

### SELECT menu cho admin (tất cả kể cả đã xóa)
```sql
-- Admin xem toàn bộ để quản lý
SELECT *
FROM snacks
ORDER BY created_at DESC
OFFSET 0 ROWS FETCH NEXT 20 ROWS ONLY
```

### INSERT snack mới
```sql
INSERT INTO snacks (name, description, price, image_url, category, available, storage_state, created_at, updated_at, version)
VALUES ('Combo Couple', 'Bắp rang + 2 nước', 99000, NULL, 'Combo', 1, NULL, GETDATE(), GETDATE(), 0)
```

### INSERT booking_snack (khi đặt vé)
```sql
-- Mỗi snack item trong đơn đặt vé
INSERT INTO booking_snacks (booking_id, snack_id, quantity, price)
VALUES (101, 1, 2, 45000)
-- price = 45000 là snapshot, không link về snacks.price
```

### UPDATE soft delete snack
```sql
UPDATE snacks
SET storage_state = 'DELETED', available = 0, updated_at = GETDATE(), version = version + 1
WHERE id = 3
```

### SELECT lịch sử đồ ăn của 1 booking
```sql
SELECT bs.quantity, bs.price, s.name, s.category,
       (bs.quantity * bs.price) AS subtotal
FROM booking_snacks bs
JOIN snacks s ON bs.snack_id = s.id
WHERE bs.booking_id = 101
```

---

## 6. Annotation/API mới sử dụng

| Annotation | Tác dụng | Ví dụ |
|---|---|---|
| `@PreAuthorize("hasRole('ADMIN')")` | Chặn non-admin access endpoint | Trên createSnack, updateSnack, deleteSnack |
| `@DecimalMin("0.0")` | Validate price không âm | `@DecimalMin("0.0") private BigDecimal price` |
| `@NotNull` | Field bắt buộc, khác @NotBlank (dùng cho non-String) | `@NotNull private BigDecimal price` |
| `JpaSpecificationExecutor<T>` | Repository có thêm method findAll(Specification, Pageable) | `SnackRepository extends JpaSpecificationExecutor<Snack>` |
| `(root, query, cb) ->` | Lambda syntax cho Specification — root=entity, cb=CriteriaBuilder | Inline spec trong service |
| `cb.isTrue(root.get("available"))` | CriteriaBuilder: điều kiện = true | Trong Specification |
| `cb.and(...)` | Gộp nhiều điều kiện AND | `cb.and(cond1, cond2)` |
| `cb.or(...)` | Gộp nhiều điều kiện OR | `cb.or(isNull, notEqual)` |

---

## 7. Khái niệm cần biết

### 2 bảng phục vụ 2 mục đích
```
snacks (menu đồ ăn — admin quản lý)
├── Bắp rang lớn    — 45.000đ
├── Coca Cola        — 30.000đ
└── Combo Couple     — 99.000đ (bắp + 2 nước)

booking_snacks (đồ ăn kèm vé — user chọn khi đặt)
├── Booking CX-001: Bắp rang × 2 = 90.000đ
└── Booking CX-001: Coca × 1 = 30.000đ
```

### Snapshot price
```java
// BookingSnack lưu price tại thời điểm đặt
// Nếu admin đổi giá bắp rang 45k → 50k sau đó
// → Đơn cũ vẫn ghi 45k (không ảnh hưởng)
```

### List public chỉ hiện available + active
```java
// User chỉ thấy đồ ăn còn bán
Specification<Snack> spec = (root, query, cb) -> cb.and(
    cb.isTrue(root.get("available")),
    cb.or(cb.isNull(root.get("storageState")), cb.notEqual(root.get("storageState"), "DELETED"))
);
```

### Tại sao BookingSnack KHÔNG extends BaseEntity?
BaseEntity có `storageState`, `version`, `createdBy`, `updatedBy` — quá nặng cho bảng liên kết đơn giản. BookingSnack chỉ cần `booking_id`, `snack_id`, `quantity`, `price` — đủ rồi. Giữ entity nhẹ và đơn giản.

---

## 8. Request/Response mẫu

### GET /api/snacks — user xem menu (public)
```bash
curl -X GET "http://localhost:8088/api/snacks?page=0&size=20"
```

**Response thành công (200):**
```json
{
  "success": true,
  "data": {
    "content": [
      {
        "id": 1,
        "name": "Bắp rang lớn",
        "description": "Bắp rang bơ size lớn",
        "price": 45000,
        "imageUrl": "https://cdn.cinex.vn/snacks/popcorn-large.jpg",
        "category": "Đồ ăn",
        "available": true,
        "createdAt": "2026-01-01T00:00:00"
      },
      {
        "id": 3,
        "name": "Combo Couple",
        "description": "1 bắp lớn + 2 nước ngọt",
        "price": 99000,
        "imageUrl": null,
        "category": "Combo",
        "available": true,
        "createdAt": "2026-01-01T00:00:00"
      }
    ],
    "totalElements": 3,
    "totalPages": 1,
    "page": 0,
    "size": 20
  }
}
```

### POST /api/snacks — admin tạo snack
```bash
curl -X POST http://localhost:8088/api/snacks \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Combo Couple",
    "description": "1 bắp lớn + 2 nước ngọt",
    "price": 99000,
    "category": "Combo",
    "imageUrl": null
  }'
```

**Response thành công (201):**
```json
{
  "success": true,
  "data": {
    "id": 3,
    "name": "Combo Couple",
    "description": "1 bắp lớn + 2 nước ngọt",
    "price": 99000,
    "category": "Combo",
    "available": true,
    "storageState": null,
    "createdAt": "2026-05-24T10:00:00"
  }
}
```

**Response lỗi — không phải admin (403):**
```json
{
  "success": false,
  "errorCode": "FORBIDDEN",
  "message": "Access denied"
}
```

**Response lỗi — thiếu field bắt buộc (400):**
```json
{
  "success": false,
  "errorCode": "VALIDATION_ERROR",
  "message": "name: must not be blank; price: must not be null"
}
```

### PUT /api/snacks/{id} — admin cập nhật snack
```bash
curl -X PUT http://localhost:8088/api/snacks/1 \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bắp rang lớn (mới)",
    "price": 50000,
    "category": "Đồ ăn",
    "available": true
  }'
```

**Response thành công (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Bắp rang lớn (mới)",
    "price": 50000,
    "available": true,
    "updatedAt": "2026-05-24T11:00:00"
  }
}
```

### DELETE /api/snacks/{id} — admin xóa snack (soft delete)
```bash
curl -X DELETE http://localhost:8088/api/snacks/1 \
  -H "Authorization: Bearer <admin_token>"
```

**Response thành công (200):**
```json
{
  "success": true,
  "message": "Snack deleted successfully"
}
```

### POST /api/snacks/{id}/restore — admin khôi phục snack
```bash
curl -X POST http://localhost:8088/api/snacks/1/restore \
  -H "Authorization: Bearer <admin_token>"
```

**Response thành công (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Bắp rang lớn",
    "available": true,
    "storageState": "ACTIVE"
  }
}
```

**Response lỗi — snack không tồn tại (404):**
```json
{
  "success": false,
  "errorCode": "ENTITY_NOT_FOUND",
  "message": "Snack không tồn tại"
}
```

---

## 9. Câu hỏi tự kiểm tra

1. **BookingSnack extends BaseEntity không?** → Không, vì là bảng liên kết đơn giản — chỉ cần 4 field (booking_id, snack_id, quantity, price), không cần audit trail nặng.
2. **Tại sao lưu price trong BookingSnack?** → Snapshot giá tại thời điểm đặt. Admin đổi giá sau không ảnh hưởng đơn cũ — đảm bảo tính toàn vẹn lịch sử giao dịch.
3. **User thấy đồ ăn admin đã xóa mềm không?** → Không, list filter `storageState IS NULL OR storageState != DELETED` kết hợp `available = true`.
4. **Tại sao Specification inline trong service thay vì tạo class riêng?** → Vì điều kiện đơn giản và chỉ dùng 1 chỗ. Nếu dùng nhiều nơi hoặc phức tạp hơn → nên tách thành `SnackSpecification.java`.
5. **Admin đổi giá snack từ 45k lên 50k. Đơn đặt vé cũ hiển thị giá bao nhiêu?** → Vẫn 45k, vì BookingSnack đã lưu snapshot price = 45k tại thời điểm đặt.
