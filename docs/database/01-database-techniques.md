# Database — Kỹ thuật cơ sở dữ liệu

---

## 1. Optimistic Locking (@Version)

### Là gì?
2 người sửa cùng 1 record cùng lúc → người save **sau** bị lỗi thay vì ghi đè im lặng.

### Ví dụ đời thường
Google Docs: 2 người edit cùng file → người save sau được cảnh báo "conflict".

### Cách hoạt động
```
Người A đọc movie (version=5)
Người B đọc movie (version=5)
Người A save → UPDATE ... WHERE id=1 AND version=5 → OK, version thành 6
Người B save → UPDATE ... WHERE id=1 AND version=5 → 0 rows (version đã là 6) → LỖI
```

```java
@Version
private Long version; // BaseEntity — tất cả entity đều có
```

### Dùng khi: Ít conflict (sửa profile, sửa phim)

---

## 2. Pessimistic Locking

### Là gì?
**Khóa row trong DB** ngay khi đọc, người khác phải chờ.

### Ví dụ đời thường
Phòng thay đồ: 1 người vào → khóa cửa → người khác đứng ngoài chờ.

### Trong CineX — Chọn ghế
```
User A chọn ghế E5 → SELECT ... FOR UPDATE (LOCK) → khóa row E5
User B chọn ghế E5 → SELECT ... FOR UPDATE → PHẢI CHỜ
User A tạo booking → COMMIT → mở khóa
User B được vào → kiểm tra: ghế đã HELD → trả lỗi "Ghế đã được chọn"
```

```java
@Lock(LockModeType.PESSIMISTIC_WRITE)
List<Seat> findByIdIn(List<Long> ids);
```

### Dùng khi: Nhiều conflict (chọn ghế, thanh toán)

### So sánh

| | Optimistic | Pessimistic |
|---|---|---|
| Khóa khi | Save (cuối) | Đọc (ngay đầu) |
| Ai chờ | Không ai, conflict → lỗi | Người thứ 2 CHỜ |
| Performance | Nhanh | Chậm hơn |
| Dùng khi | Ít conflict | Nhiều conflict |

---

## 3. Transaction (ACID)

### Là gì?
Nhóm thao tác hoặc **tất cả thành công** hoặc **tất cả rollback**, không nửa vời.

### Ví dụ đời thường
Chuyển tiền: trừ A + cộng B phải cùng thành công. Trừ A mà cộng B lỗi → hoàn tiền A.

### ACID

| Chữ | Nghĩa | Ví dụ |
|---|---|---|
| **A** — Atomicity | Tất cả hoặc không | Hold 3 ghế, ghế 3 trùng → rollback cả 3 |
| **C** — Consistency | DB luôn hợp lệ | Tổng ghế trống + đã đặt = tổng ghế phòng |
| **I** — Isolation | Transaction không thấy nhau | User A hold ghế → User B không thấy "nửa hold" |
| **D** — Durability | Commit xong không mất | Server crash → khởi động lại vẫn còn booking |

```java
@Transactional // tất cả trong method = 1 transaction
public Booking holdSeats(Long userId, HoldSeatsRequest request) {
    // Nếu bất kỳ bước nào lỗi → rollback tất cả
}
```

---

## 4. Soft Delete

### Là gì?
Xóa = **đổi trạng thái**, không DELETE thật. Data vẫn còn, có thể khôi phục.

### Ví dụ đời thường
Thùng rác máy tính: xóa file → vào thùng rác (chưa mất hẳn).

```java
// ĐÚNG
movie.setStorageState("DELETED"); // data vẫn còn

// SAI
movieRepo.deleteById(id); // MẤT VĨNH VIỄN
```

---

## 5. N+1 Problem

### Là gì?
Load danh sách entity có quan hệ → JPA chạy **1 query danh sách + N query quan hệ** = N+1 query.

### Ví dụ đời thường
Hỏi lớp trưởng "danh sách 40 học sinh" (1 câu) → hỏi TỪNG NGƯỜI "điểm toán?" (40 câu) = 41 câu.

### Bị N+1
```java
List<Movie> movies = movieRepo.findAll(); // 1 query
for (Movie m : movies) {
    m.getGenres(); // MỖI phim 1 query → 20 phim = 21 query!
}
```

### Fix N+1
```java
// Cách 1: JOIN FETCH
@Query("SELECT m FROM Movie m JOIN FETCH m.genres")
List<Movie> findAllWithGenres(); // 1 query DUY NHẤT

// Cách 2: @EntityGraph
@EntityGraph(attributePaths = {"genres"})
List<Movie> findAll(); // Spring tự JOIN
```

---

## 6. Lazy vs Eager Loading

### Là gì?
- **Lazy:** Chỉ load quan hệ **khi gọi getter** (mặc định cho @OneToMany, @ManyToMany)
- **Eager:** Load **ngay lập tức** (mặc định cho @ManyToOne, @OneToOne)

### Ví dụ đời thường
- Lazy: Mở Netflix → chỉ thấy thumbnail. Click → mới load video.
- Eager: Mở Netflix → tự tải TẤT CẢ video → rất chậm.

### Lỗi thường gặp: LazyInitializationException
```java
Movie movie = movieService.findById(id); // Transaction đóng
movie.getGenres(); // LỖI! Lazy load nhưng transaction đã đóng

// Fix: load trong Service (trong transaction)
@Transactional(readOnly = true)
public MovieResponse getMovie(Long id) {
    Movie movie = findById(id);
    movie.getGenres().size(); // force load trong transaction
    return movieMapper.toResponse(movie);
}
```

### Quy tắc: Mặc định Lazy, khi cần → JOIN FETCH

---

## 7. Pagination — Phân trang

### Là gì?
Danh sách nhiều record → chia thành **từng trang**, mỗi trang 10-20 record.

### Ví dụ đời thường
Google: 1 triệu kết quả nhưng chỉ hiện 10/trang.

```java
@GetMapping("/movies")
public ApiResponse<PageResponse<MovieResponse>> getMovies(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "10") int size) {

    Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
    Page<Movie> movies = movieRepo.findAll(pageable);
    return ApiResponse.ok(PageResponse.from(movies));
}
```

Response:
```json
{
    "content": [ ... 10 phim ... ],
    "page": 0,
    "size": 10,
    "totalElements": 156,
    "totalPages": 16,
    "last": false
}
```

SQL: `SELECT * FROM movies ORDER BY created_at DESC OFFSET 20 ROWS FETCH NEXT 10 ROWS ONLY`
