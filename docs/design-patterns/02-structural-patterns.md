# Structural Patterns — Nhóm cấu trúc

Các pattern này giải quyết bài toán: **tổ chức code như thế nào** cho gọn gàng, tách biệt, dễ bảo trì.

---

## 1. DTO Pattern (Data Transfer Object)

### Là gì?
DTO là object chỉ dùng để **chuyển dữ liệu** giữa client và server. Không phải entity (entity map với bảng DB).

### Ví dụ đời thường
Đặt hàng Shopee: bạn điền **phiếu đặt hàng** (DTO) chỉ có tên, số lượng, địa chỉ.
Shopee không cho bạn thấy: giá nhập, kho hàng nào, lợi nhuận (entity).

### Không dùng DTO (lộ thông tin)
```json
// Trả entity thẳng cho client
{
    "id": 1,
    "username": "vanan",
    "password": "$2a$10$N9qo8uLO...",   // ← LỘ PASSWORD HASH!
    "storageState": null,                 // ← Client không cần biết
    "version": 3                          // ← Client không cần biết
}
```

### Dùng DTO (an toàn)
```json
// Trả DTO, chỉ chứa field client cần
{
    "id": 1,
    "username": "vanan",
    "email": "an@gmail.com",
    "fullName": "Vũ Tường An"
}
```

### Tại sao cần?
1. **Bảo mật:** Không lộ password hash, field nội bộ
2. **Linh hoạt:** Cùng entity `User`, trả DTO khác nhau cho list vs detail
3. **Validation:** Request DTO có `@NotBlank`, `@Email` — validate input
4. **Tách biệt:** Thêm cột DB không ảnh hưởng API response

### Dùng ở đâu: Tất cả module

---

## 2. Repository Pattern

### Là gì?
Repository **trừu tượng hóa việc truy vấn DB**. Service gọi repository, không viết SQL trực tiếp.

### Ví dụ đời thường
Thủ thư: bạn nói "cho tôi sách tên Clean Code". Thủ thư tự biết tìm ở kệ nào.

### Spring Data JPA tự sinh SQL

| Method name | SQL được sinh |
|---|---|
| `findByUsername("vanan")` | `SELECT * FROM users WHERE username = 'vanan'` |
| `existsByEmail("a@b.com")` | `SELECT COUNT(*) > 0 FROM users WHERE email = 'a@b.com'` |
| `findByRoleAndEnabledTrue(ADMIN)` | `SELECT * FROM users WHERE role = 'ADMIN' AND enabled = 1` |

Spring đọc tên method → tách từ → sinh SQL. Không viết 1 dòng SQL nào.

### Tại sao cần?
- **Không viết SQL:** Spring tự sinh
- **Đổi DB dễ:** SQL Server → PostgreSQL chỉ đổi driver
- **Type-safe:** Sai tên field → lỗi compile

### Dùng ở đâu: Tất cả module

---

## 3. Mapper Pattern (MapStruct)

### Là gì?
MapStruct **tự động sinh code** chuyển đổi Entity ↔ DTO lúc compile. Không cần viết `response.setTitle(entity.getTitle())` cho từng field.

### Ví dụ đời thường
Phiên dịch viên tự động: đưa bài tiếng Việt (Entity) → dịch ra tiếng Anh (DTO) tự động.

### Không dùng MapStruct (viết tay)
```java
public MovieResponse toResponse(Movie movie) {
    MovieResponse res = new MovieResponse();
    res.setId(movie.getId());
    res.setTitle(movie.getTitle());
    res.setDescription(movie.getDescription());
    res.setDuration(movie.getDuration());
    // 15 field → 15 dòng. Thêm field → quên set → BUG.
    return res;
}
```

### Dùng MapStruct (tự động)
```java
@Mapper(componentModel = "spring")
public interface MovieMapper {
    MovieResponse toResponse(Movie movie);
    // MapStruct TỰ SINH code cho tất cả field cùng tên. 0 dòng code.

    @Mapping(source = "genres", target = "genreNames")
    MovieDetailResponse toDetailResponse(Movie movie);
    // Field tên khác → chỉ định mapping
}
```

### So sánh

| Cách | Tốc độ | Khi nào lỗi | Thêm field |
|---|---|---|---|
| Viết tay | Nhanh | Runtime (quên set) | Thêm 1 dòng set |
| ModelMapper (reflection) | Chậm | Runtime | Tự động nhưng chậm |
| **MapStruct (code gen)** | **Nhanh như viết tay** | **Compile time** | **Tự động + nhanh** |

### Dùng ở đâu: Task 005+ (Movie, Room, Seat, Showtime, Booking, Payment)

---

## 4. Facade/Wrapper Pattern

### Là gì?
Bọc logic phức tạp bên trong, bên ngoài chỉ thấy interface đơn giản.

### Ví dụ đời thường
Điều khiển TV: 1 nút bật — bên trong bật nguồn + tín hiệu + loa.

### Trong CineX
`ApiResponse<T>` bọc mọi response cùng 1 format:
```json
{
    "success": true,
    "message": "OK",
    "data": { ... },
    "timestamp": "2026-05-12T10:00:00"
}
```
FE chỉ cần 1 cách xử lý cho tất cả API: check `success` là biết thành công hay thất bại.

### Dùng ở đâu: Tất cả API response
