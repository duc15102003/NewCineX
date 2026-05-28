# Module Review — Giải thích chi tiết

## 1. Tổng quan
Module Review cho phép user **đánh giá phim** sau khi xem — cho điểm (1-10) + viết comment. Rating phim tự cập nhật AVG sau mỗi thay đổi.

**Bài toán:**
- 1 user chỉ review 1 phim 1 lần (UNIQUE constraint)
- Chỉ chủ sở hữu mới sửa/xóa review (admin xóa được tất cả)
- Khi tạo/sửa/xóa review → movie.rating tự cập nhật = AVG(reviews.rating)

---

## 2. Danh sách files

| File | Tác dụng | Design Pattern |
|---|---|---|
| `entity/Review.java` | Entity @ManyToOne User + Movie, rating INT, comment NTEXT | Inheritance (BaseEntity) |
| `dto/ReviewRequest.java` | rating (@Min(1) @Max(10)), comment | DTO Pattern |
| `dto/ReviewResponse.java` | username, avatarUrl, movieTitle, rating, comment | DTO Pattern |
| `dto/ReviewFilter.java` | movieId, minRating, includeDeleted | DTO Pattern |
| `repository/ReviewRepository.java` | JpaSpecificationExecutor + AVG rating query | Repository Pattern |
| `specification/ReviewSpecification.java` | fromFilter: hasMovie, hasMinRating, notDeleted | Specification Pattern |
| `mapper/ReviewMapper.java` | MapStruct @Mapping nested (user.username, movie.title) | Mapper Pattern |
| `service/ReviewService.java` | CRUD + check unique + check ownership + updateMovieRating | Service Layer |
| `controller/ReviewController.java` | 4 endpoints, @PreAuthorize("isAuthenticated()") | MVC Controller |

---

## 3. Design Patterns đã áp dụng

### Specification Pattern (Behavioral)
**Giải thích đời thường:** Giống như bộ lọc tìm kiếm trên Shopee — bạn tick "5 sao", "có freeship", "dưới 100k" → Specification gộp tất cả điều kiện lại thành 1 câu query.

**Áp dụng:** `ReviewSpecification.fromFilter()` nhận `ReviewFilter` → tạo `Predicate` cho `movieId`, `minRating`, `notDeleted`.

**Tại sao dùng:**
- Không cần viết N method findByXxx cho từng tổ hợp filter
- Thêm điều kiện mới chỉ cần thêm vào Specification, không sửa code cũ

### Mapper Pattern (Structural)
**Giải thích:** MapStruct tự sinh code chuyển `Review` entity → `ReviewResponse` DTO. Đặc biệt có thể map nested: `review.user.username` → `response.username`.

```java
@Mapping(source = "user.username", target = "username")
@Mapping(source = "user.avatarUrl", target = "avatarUrl")
@Mapping(source = "movie.title", target = "movieTitle")
ReviewResponse toResponse(Review review);
```

### Ownership Check Pattern (Authorization)
**Giải thích đời thường:** Giống hộp thư — bạn chỉ được xóa thư của mình. Trừ bưu điện (admin) có chìa khóa tổng.

```java
if (!review.getUser().getId().equals(userId) && !SecurityUtil.hasRole("ADMIN")) {
    throw new BusinessException(ErrorCode.FORBIDDEN, "Not your review");
}
```

---

## 4. Sơ đồ luồng xử lý

### Luồng tạo review (POST /api/movies/{movieId}/reviews)

```
Client gửi POST /api/movies/1/reviews
    |
    v
[JwtAuthFilter] → xác thực token → lấy userId từ claims
    |
    v
[ReviewController.createReview()]
    |
    v
[ReviewService.createReview(movieId, userId, request)]
    |
    +---> [1] Check duplicate: reviewRepository.existsByUserIdAndMovieId(userId, movieId)
    |         └─ nếu TRUE → throw BusinessException(REVIEW_EXISTED) → 400
    |
    +---> [2] Load User: userRepository.findById(userId)
    |         └─ không tồn tại → throw ENTITY_NOT_FOUND → 404
    |
    +---> [3] Load Movie: movieRepository.findById(movieId)
    |         └─ không tồn tại → throw ENTITY_NOT_FOUND → 404
    |
    +---> [4] Build & Save Review:
    |         Review.builder()
    |           .user(user).movie(movie)
    |           .rating(request.getRating())
    |           .comment(request.getComment())
    |           .build()
    |         reviewRepository.save(review)
    |
    +---> [5] updateMovieRating(movieId)
    |         └─ reviewRepository.getAverageRatingByMovieId(movieId)
    |               SELECT AVG(CAST(rating AS FLOAT)) FROM reviews WHERE movie_id = 1
    |         └─ movie.setRating(avg) → movieRepository.save(movie)
    |
    v
[ReviewMapper.toResponse(review)] → ReviewResponse
    |
    v
ApiResponse<ReviewResponse> (201 Created)
```

### Luồng xóa review (DELETE /api/movies/{movieId}/reviews/{reviewId})

```
Client gửi DELETE /api/movies/1/reviews/5
    |
    v
[ReviewController.deleteReview(movieId, reviewId)]
    |
    v
[ReviewService.deleteReview(reviewId, userId)]
    |
    +---> Load review: reviewRepository.findById(reviewId)
    |
    +---> Ownership check:
    |         review.getUser().getId() == userId?
    |         ├─ CÓ → cho phép xóa
    |         └─ KHÔNG → SecurityUtil.hasRole("ADMIN")?
    |                     ├─ CÓ (admin) → cho phép xóa
    |                     └─ KHÔNG → throw FORBIDDEN (403)
    |
    +---> Soft delete: review.setStorageState("DELETED")
    |
    +---> updateMovieRating(movieId)
    |         └─ Tính lại AVG sau khi review bị xóa
    |
    v
ApiResponse (200 OK, message: "Review deleted")
```

### Luồng cập nhật review (PUT /api/movies/{movieId}/reviews/{reviewId})

```
Client gửi PUT /api/movies/1/reviews/5
    |
    v
[ReviewService.updateReview(reviewId, userId, request)]
    |
    +---> Load review
    +---> Ownership check (chỉ chủ mới sửa được, admin không sửa thay)
    +---> Update fields: rating, comment
    +---> reviewRepository.save(review)
    +---> updateMovieRating(movieId) → tính lại AVG
    v
ReviewResponse mới
```

---

## 5. SQL được sinh ra

### INSERT khi tạo review mới
```sql
INSERT INTO reviews (user_id, movie_id, rating, comment, storage_state, created_at, updated_at, version)
VALUES (?, ?, ?, ?, 'ACTIVE', GETDATE(), GETDATE(), 0)
```

### SELECT danh sách review của 1 phim
```sql
-- reviewRepository.findAll(spec, pageable) với spec: movieId = 1, storageState != DELETED
SELECT r.*, u.username, u.avatar_url, m.title
FROM reviews r
JOIN users u ON r.user_id = u.id
JOIN movies m ON r.movie_id = m.id
WHERE r.movie_id = 1
  AND (r.storage_state IS NULL OR r.storage_state <> 'DELETED')
ORDER BY r.created_at DESC
OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY
```

### AVG rating — câu query quan trọng nhất
```sql
-- ReviewRepository.getAverageRatingByMovieId(movieId)
-- JPQL: SELECT AVG(CAST(r.rating AS double)) FROM Review r WHERE r.movie.id = :movieId AND r.storageState <> 'DELETED'
SELECT AVG(CAST(r.rating AS FLOAT))
FROM reviews r
WHERE r.movie_id = 1
  AND (r.storage_state IS NULL OR r.storage_state <> 'DELETED')
```

Kết quả ví dụ: nếu có 3 review điểm 7, 8, 9 → AVG = 8.0 → `movies.rating` được cập nhật thành 8.0.

### UPDATE soft delete review
```sql
UPDATE reviews
SET storage_state = 'DELETED', updated_at = GETDATE(), version = version + 1
WHERE id = 5
```

### UPDATE movie rating sau khi có review mới
```sql
UPDATE movies
SET rating = 8.0, updated_at = GETDATE(), version = version + 1
WHERE id = 1
```

### UNIQUE constraint check
```sql
-- existsByUserIdAndMovieId(userId, movieId)
SELECT CASE WHEN COUNT(*) > 0 THEN 1 ELSE 0 END
FROM reviews
WHERE user_id = 10 AND movie_id = 1
  AND (storage_state IS NULL OR storage_state <> 'DELETED')
```

---

## 6. Annotation/API mới sử dụng

| Annotation | Tác dụng | Ví dụ |
|---|---|---|
| `@Min(1) @Max(10)` | Validate giá trị số nằm trong khoảng | `@Min(1) @Max(10) private Integer rating` |
| `@JpaSpecificationExecutor<T>` | Cho phép repo dùng Specification để query động | `extends JpaSpecificationExecutor<Review>` |
| `@Query` (Spring Data) | Viết JPQL tùy chỉnh trực tiếp trên method | `@Query("SELECT AVG(...) FROM Review r WHERE ...")` |
| `@PreAuthorize("isAuthenticated()")` | Chặn request nếu chưa đăng nhập (method/class level) | Trên `ReviewController` class |
| `@Mapping(source, target)` | MapStruct: map field từ nguồn sang đích khác tên | `@Mapping(source="user.username", target="username")` |
| `SecurityUtil.hasRole("ADMIN")` | Kiểm tra role trong SecurityContext hiện tại | Trong ownership check của service |

---

## 7. Kiến thức áp dụng

### UNIQUE constraint (1 user = 1 review/phim)
```java
// DB: UNIQUE(user_id, movie_id)
// Service check trước khi insert:
if (reviewRepository.existsByUserIdAndMovieId(userId, movieId)) {
    throw new BusinessException(ErrorCode.REVIEW_EXISTED, "Already reviewed");
}
```

**Tại sao check 2 lớp?** Vừa check trong code (trả lỗi đẹp) vừa có UNIQUE ở DB (phòng race condition khi 2 request đến đồng thời).

### Auto update AVG rating
```java
// Sau mỗi create/update/delete review → tính lại AVG
private void updateMovieRating(Long movieId) {
    Double avg = reviewRepository.getAverageRatingByMovieId(movieId);
    // SQL: SELECT AVG(CAST(rating AS FLOAT)) FROM reviews WHERE movie_id = ?
    movie.setRating(BigDecimal.valueOf(avg != null ? avg : 0.0));
    movieRepository.save(movie);
}
```

**Trường hợp đặc biệt:** Nếu tất cả review bị xóa → AVG trả về `null` → xử lý null-safe → rating = 0.0.

### Ownership check (chủ review mới sửa/xóa)
```java
if (!review.getUser().getId().equals(userId) && !SecurityUtil.hasRole("ADMIN")) {
    throw new BusinessException(ErrorCode.FORBIDDEN, "Not your review");
}
```

---

## 8. Request/Response mẫu

### GET /api/movies/{movieId}/reviews — danh sách review
```bash
# Không cần token — public API
curl -X GET "http://localhost:8088/api/movies/1/reviews?page=0&size=10&minRating=7"
```

**Response thành công (200):**
```json
{
  "success": true,
  "data": {
    "content": [
      {
        "id": 3,
        "username": "vanan",
        "avatarUrl": null,
        "movieId": 1,
        "movieTitle": "Avengers: Endgame",
        "rating": 9,
        "comment": "Xuất sắc! Cảnh cuối rất cảm động.",
        "createdAt": "2026-05-24T10:00:00"
      },
      {
        "id": 2,
        "username": "john_doe",
        "avatarUrl": "https://cdn.cinex.vn/avatars/john.jpg",
        "movieId": 1,
        "movieTitle": "Avengers: Endgame",
        "rating": 8,
        "comment": "Phim hay nhưng hơi dài.",
        "createdAt": "2026-05-23T15:30:00"
      }
    ],
    "totalElements": 2,
    "totalPages": 1,
    "page": 0,
    "size": 10
  }
}
```

### POST /api/movies/{movieId}/reviews — tạo review
```bash
curl -X POST http://localhost:8088/api/movies/1/reviews \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"rating": 8, "comment": "Phim hay lắm!"}'
```

**Response thành công (201):**
```json
{
  "success": true,
  "data": {
    "id": 4,
    "username": "vanan",
    "avatarUrl": null,
    "movieId": 1,
    "movieTitle": "Avengers: Endgame",
    "rating": 8,
    "comment": "Phim hay lắm!",
    "createdAt": "2026-05-24T12:00:00"
  }
}
```

**Response lỗi — đã review rồi (400):**
```json
{
  "success": false,
  "errorCode": "REVIEW_EXISTED",
  "message": "Bạn đã đánh giá phim này rồi"
}
```

**Response lỗi — chưa đăng nhập (401):**
```json
{
  "success": false,
  "errorCode": "UNAUTHORIZED",
  "message": "Vui lòng đăng nhập"
}
```

**Response lỗi — rating không hợp lệ (400):**
```json
{
  "success": false,
  "errorCode": "VALIDATION_ERROR",
  "message": "rating: must be between 1 and 10"
}
```

### PUT /api/movies/{movieId}/reviews/{reviewId} — sửa review
```bash
curl -X PUT http://localhost:8088/api/movies/1/reviews/4 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"rating": 9, "comment": "Xem lại lần 2 thấy hay hơn!"}'
```

**Response thành công (200):**
```json
{
  "success": true,
  "data": {
    "id": 4,
    "username": "vanan",
    "rating": 9,
    "comment": "Xem lại lần 2 thấy hay hơn!",
    "createdAt": "2026-05-24T12:00:00"
  }
}
```

**Response lỗi — không phải chủ review (403):**
```json
{
  "success": false,
  "errorCode": "FORBIDDEN",
  "message": "Bạn không có quyền sửa review này"
}
```

### DELETE /api/movies/{movieId}/reviews/{reviewId} — xóa review
```bash
# User xóa review của mình
curl -X DELETE http://localhost:8088/api/movies/1/reviews/4 \
  -H "Authorization: Bearer <token>"

# Admin xóa review bất kỳ
curl -X DELETE http://localhost:8088/api/movies/1/reviews/4 \
  -H "Authorization: Bearer <admin_token>"
```

**Response thành công (200):**
```json
{
  "success": true,
  "message": "Review deleted successfully"
}
```

**Response lỗi — không phải chủ và không phải admin (403):**
```json
{
  "success": false,
  "errorCode": "FORBIDDEN",
  "message": "Bạn không có quyền xóa review này"
}
```

---

## 9. Khái niệm cần biết

### AVG() trong SQL
- `AVG(rating)` tính trung bình tất cả giá trị không NULL
- Nếu không có row nào → trả về NULL (cần xử lý trong Java)
- `CAST(rating AS FLOAT)` đảm bảo kết quả là số thực, không bị làm tròn

### Race condition trong check unique
**Tình huống:** User A và User B cùng gửi review cho phim 1 vào đúng lúc nhau:
1. A check → không có review → pass
2. B check → không có review → pass
3. A insert thành công
4. B insert thành công → vi phạm UNIQUE constraint → DB throw lỗi!

**Giải pháp:** Ngoài check trong code, DB vẫn có `UNIQUE(user_id, movie_id)` làm lớp bảo vệ cuối. Spring sẽ bắt `DataIntegrityViolationException` và trả lỗi phù hợp.

### Tại sao không cache AVG rating?
Mỗi lần review thay đổi đều cập nhật ngay. Nếu cache AVG, phải invalidate cache sau mỗi thay đổi — phức tạp hơn mà không cần thiết ở scale nhỏ.

---

## 10. Câu hỏi tự kiểm tra

1. **Tại sao cần UNIQUE(user_id, movie_id)?** → Tránh 1 user spam nhiều review cho 1 phim, đảm bảo rating phản ánh đúng ý kiến nhiều người.
2. **Xóa review → movie.rating có thay đổi không?** → Có, `updateMovieRating()` được gọi sau mỗi thao tác create/update/delete để tính lại AVG.
3. **Admin xóa review người khác được không?** → Được, service check `SecurityUtil.hasRole("ADMIN")` — admin có quyền xóa tất cả.
4. **Nếu tất cả review bị xóa, movie.rating về bao nhiêu?** → AVG trả NULL → code xử lý null-safe → rating = 0.0. Quan trọng phải handle null!
5. **Tại sao updateReview chỉ owner sửa được, còn deleteReview admin cũng xóa được?** → Nghiệp vụ: admin có quyền kiểm duyệt và xóa nội dung vi phạm, nhưng không nên sửa nội dung của người khác (ảnh hưởng tính toàn vẹn review).
