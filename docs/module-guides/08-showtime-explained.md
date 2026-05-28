# Module Showtime — Giải thích chi tiết

## 1. Tổng quan
Module Showtime quản lý **suất chiếu**: phim nào chiếu ở phòng nào, ngày giờ nào, giá vé bao nhiêu.
- Admin: tạo/sửa/xóa suất chiếu
- User: xem danh sách suất chiếu theo phim + ngày, xem chi tiết (ghế trống)

**Bài toán chính:**
- Tự tính `endTime = startTime + movie.duration + buffer` (buffer đọc từ SystemConfig)
- Không cho tạo suất trùng giờ cùng phòng
- Không cho tạo suất trong quá khứ

## 2. Danh sách files

| File | Tác dụng |
|---|---|
| `entity/Showtime.java` | Entity @ManyToOne Movie + Room |
| `entity/ShowtimeStatus.java` | Enum: SCHEDULED, ONGOING, FINISHED, CANCELLED |
| `dto/ShowtimeFilter.java` | Filter DTO: movieId, roomId, date, status, includeDeleted |
| `dto/ShowtimeRequest.java` | DTO tạo/sửa suất chiếu |
| `dto/ShowtimeResponse.java` | DTO chi tiết (movie info, room info, prices, availableSeats) |
| `dto/ShowtimeListResponse.java` | DTO rút gọn cho danh sách |
| `repository/ShowtimeRepository.java` | JpaSpecificationExecutor + findConflictingShowtimes |
| `specification/ShowtimeSpecification.java` | Filter: movieId, roomId, date, status, notDeleted |
| `mapper/ShowtimeMapper.java` | MapStruct @Mapping nested fields (movie.title → movieTitle) |
| `service/ShowtimeService.java` | CRUD + check trùng giờ + tính endTime |
| `controller/ShowtimeController.java` | 6 endpoints |

## 3. Design Patterns / Kiến thức mới

### 3.1 Kiểm tra trùng giờ (Time Range Overlap)

Đây là bài toán kinh điển: 2 khoảng thời gian có giao nhau không?

```
Công thức: [A, B] và [C, D] giao nhau khi A < D AND C < B

Ví dụ: Suất mới 14:00-16:30, kiểm tra với suất cũ:
- Suất cũ 10:00-12:30 → 10:00 < 16:30 ✅ BUT 12:30 > 14:00 ❌ → KHÔNG trùng
- Suất cũ 13:00-15:00 → 13:00 < 16:30 ✅ AND 15:00 > 14:00 ✅ → TRÙNG!
- Suất cũ 16:00-18:00 → 16:00 < 16:30 ✅ AND 18:00 > 14:00 ✅ → TRÙNG!
- Suất cũ 17:00-19:00 → 17:00 < 16:30 ❌ → KHÔNG trùng
```

```java
// SQL kiểm tra trùng:
@Query("SELECT s FROM Showtime s WHERE s.room.id = :roomId " +
       "AND s.startTime < :endTime AND s.endTime > :startTime " +  // Công thức overlap
       "AND (s.storageState IS NULL OR s.storageState <> 'DELETED') " +
       "AND s.status <> 'CANCELLED'")
List<Showtime> findConflictingShowtimes(Long roomId, LocalDateTime startTime, LocalDateTime endTime);
```

### 3.2 Tính endTime từ SystemConfig

```java
// Đọc buffer từ SystemConfig (cấu hình động, không hardcode)
int bufferMinutes = systemConfigService.getInt("showtime.buffer_minutes", 15);
// → Nếu admin sửa config "showtime.buffer_minutes" = 20 → buffer tự đổi theo

LocalDateTime endTime = request.getStartTime()
    .plusMinutes(movie.getDuration())   // VD: 150 phút (phim Avengers)
    .plusMinutes(bufferMinutes);         // + 15 phút dọn phòng

// startTime: 14:00 → endTime: 14:00 + 150 + 15 = 16:45
```

### 3.3 MapStruct @Mapping nested fields

Showtime có Movie và Room (LAZY) — cần map nested fields:

```java
@Mapping(source = "movie.title", target = "movieTitle")
@Mapping(source = "room.name", target = "roomName")
@Mapping(source = "room.type", target = "roomType")
ShowtimeResponse toResponse(Showtime showtime);
```

MapStruct sinh code: `showtime.getMovie().getTitle()` → `response.setMovieTitle(...)`.
Vì Movie là LAZY → gọi `getMovie()` trigger query SQL (1 query duy nhất, không phải N+1 vì xử lý từng showtime).

### 3.4 Specification filter theo ngày

```java
// FE gửi: ?date=2026-05-20
// Cần tìm suất chiếu có startTime trong ngày 20/05:
public static Specification<Showtime> onDate(LocalDate date) {
    return (root, query, cb) -> {
        LocalDateTime dayStart = date.atStartOfDay();           // 2026-05-20 00:00:00
        LocalDateTime dayEnd = date.plusDays(1).atStartOfDay();  // 2026-05-21 00:00:00
        return cb.and(
            cb.greaterThanOrEqualTo(root.get("startTime"), dayStart),  // >= 00:00
            cb.lessThan(root.get("startTime"), dayEnd)                  // < ngày hôm sau
        );
    };
}
// SQL: WHERE start_time >= '2026-05-20 00:00:00' AND start_time < '2026-05-21 00:00:00'
```

## 4. Sơ đồ luồng xử lý

### Tạo suất chiếu
```
POST /api/showtimes (ADMIN)
Body: { "movieId": 1, "roomId": 2, "startTime": "2026-05-25T14:00", "basePrice": 75000, ... }
│
▼
ShowtimeService.createShowtime(request)
│
├── 1. Tìm Movie (id=1) → "Avengers" (duration=150 phút) ✅
├── 2. Tìm Room (id=2) → "Room IMAX" ✅
│
├── 3. startTime = 14:00, check quá khứ → 14:00 > now ✅
│
├── 4. Tính endTime:
│      = 14:00 + 150 phút (phim) + 15 phút (buffer từ SystemConfig)
│      = 16:45
│
├── 5. Check trùng giờ Room IMAX:
│      SELECT FROM showtimes WHERE room_id=2
│        AND start_time < '16:45' AND end_time > '14:00'
│      → Không có suất nào → OK ✅
│      (nếu có → throw SHOWTIME_CONFLICT 409)
│
├── 6. Save showtime (status = SCHEDULED)
│
└── 7. Trả ShowtimeResponse (movie info + room info + prices + availableSeats)
```

## 5. SQL được sinh ra

```sql
-- Danh sách suất chiếu (filter movieId + date)
SELECT s.* FROM showtimes s
WHERE s.movie_id = 1
  AND s.start_time >= '2026-05-20 00:00:00'
  AND s.start_time < '2026-05-21 00:00:00'
  AND (s.storage_state IS NULL OR s.storage_state <> 'DELETED')
ORDER BY s.start_time
OFFSET 0 ROWS FETCH NEXT 20 ROWS ONLY;

-- Kiểm tra trùng giờ
SELECT s.* FROM showtimes s
WHERE s.room_id = 2
  AND s.start_time < '2026-05-25 16:45:00'
  AND s.end_time > '2026-05-25 14:00:00'
  AND (s.storage_state IS NULL OR s.storage_state <> 'DELETED')
  AND s.status <> 'CANCELLED';

-- Tạo suất chiếu
INSERT INTO showtimes (movie_id, room_id, start_time, end_time,
       base_price, vip_price, couple_price, status, version, ...)
VALUES (1, 2, '2026-05-25 14:00', '2026-05-25 16:45',
       75000, 100000, 150000, 'SCHEDULED', 0, ...);
```

## 6. Request/Response mẫu

### GET /api/showtimes?movieId=1&date=2026-05-25
```bash
curl "http://localhost:8088/api/showtimes?movieId=1&date=2026-05-25"
```

```json
{
  "success": true,
  "data": {
    "content": [
      {
        "id": 1, "movieTitle": "Avengers", "roomName": "Room IMAX", "roomType": "IMAX",
        "startTime": "2026-05-25T09:00", "endTime": "2026-05-25T11:45",
        "basePrice": 75000, "status": "SCHEDULED"
      },
      {
        "id": 2, "movieTitle": "Avengers", "roomName": "Room 1", "roomType": "TWO_D",
        "startTime": "2026-05-25T14:00", "endTime": "2026-05-25T16:45",
        "basePrice": 60000, "status": "SCHEDULED"
      }
    ],
    "page": 0, "size": 20, "totalElements": 2
  }
}
```

### POST /api/showtimes — Tạo suất (lỗi trùng giờ)
```json
{"success": false, "message": "Room 'Room IMAX' already has a showtime during this time"}
// HTTP 409 Conflict
```

## 7. Câu hỏi tự kiểm tra

1. **Công thức kiểm tra 2 khoảng thời gian giao nhau là gì?**
   → [A,B] giao [C,D] khi A < D AND C < B. Áp dụng: suất mới startTime < suất cũ endTime AND suất cũ startTime < suất mới endTime.

2. **Tại sao buffer minutes đọc từ SystemConfig thay vì hardcode?**
   → Admin có thể đổi buffer (VD: 15→20 phút) mà không cần sửa code + restart server.

3. **Khi update suất chiếu, kiểm tra trùng giờ có vấn đề gì?**
   → Phải loại trừ chính nó (`conflicts.removeIf(s -> s.getId().equals(id))`), nếu không tự trùng với chính mình.
