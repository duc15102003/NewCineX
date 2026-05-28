# Module User Favorites — Giải thích chi tiết

## 1. Tổng quan
Module Favorites cho phép user **lưu phim yêu thích** — bấm tim để lưu, xem lại danh sách phim đã lưu.

Đơn giản nhất trong tất cả module — bảng join 2 FK + 3 API.

---

## 2. Danh sách files

| File | Tác dụng | Design Pattern |
|---|---|---|
| `entity/UserFavorite.java` | Entity — user_id, movie_id, createdAt. UNIQUE(user+movie) | Join Table |
| `dto/FavoriteMovieResponse.java` | movieId, title, posterUrl, duration, rating, status, favoritedAt | DTO Pattern |
| `repository/UserFavoriteRepository.java` | findByUserId (sorted), existsByUserIdAndMovieId | Repository Pattern |
| `service/UserFavoriteService.java` | addFavorite, removeFavorite, getMyFavorites, isFavorited | Service Layer |
| `controller/UserFavoriteController.java` | 3 endpoints, @PreAuthorize("isAuthenticated()") | MVC Controller |

---

## 3. Design Patterns đã áp dụng

### Toggle Pattern — 2 endpoints riêng biệt (RESTful)
**Giải thích đời thường:** Đèn nhà bạn có công tắc BẬT và công tắc TẮT riêng biệt — không phải bấm chung 1 nút (toggle). REST API chuẩn cũng vậy.

```
POST   /api/movies/{id}/favorite  → BẬT (thêm vào yêu thích)
DELETE /api/movies/{id}/favorite  → TẮT (bỏ khỏi yêu thích)
```

**Tại sao KHÔNG dùng 1 endpoint toggle?**
- Toggle: gọi 1 lần → thêm, gọi lần 2 → xóa → khó predict
- REST chuẩn: POST = tạo resource, DELETE = xóa resource → dễ đọc, dễ hiểu
- Idempotent: DELETE 2 lần → lần 2 trả 404 (rõ ràng), không side effect ẩn

### Hard Delete — phù hợp với bảng quan hệ đơn giản
**Giải thích đời thường:** Khi bạn bỏ like một bài đăng Facebook — Facebook không lưu lại "record đã từng like". Họ xóa thẳng. Không cần audit trail cho hành động này.

```java
// Hard delete — xóa hẳn khỏi DB
public void removeFavorite(Long movieId, Long userId) {
    UserFavorite favorite = favoriteRepository
        .findByUserIdAndMovieId(userId, movieId)
        .orElseThrow(() -> new BusinessException(ENTITY_NOT_FOUND, "Phim không có trong danh sách yêu thích"));

    favoriteRepository.delete(favorite); // xóa thẳng, không soft delete
}
```

**So sánh với soft delete ở module khác:**

| Tiêu chí | Hard Delete (Favorites) | Soft Delete (Movies, Users) |
|---|---|---|
| Lý do xóa | User chủ động bỏ thích | Admin ẩn nội dung |
| Cần audit? | Không | Có (ai xóa? khi nào?) |
| Có thể khôi phục? | Không cần | Cần (restore) |
| Xóa lại sau = insert mới | Đúng | Sai (cần restore) |
| Phức tạp? | Đơn giản | Phức tạp hơn |

### UNIQUE Constraint — 2 lớp bảo vệ
**Giải thích:** Giống cửa khóa (code check) + chuỗi bảo hiểm (DB constraint). Cả 2 đều ngăn trùng lặp.

```java
// Lớp 1: Check trong code → trả lỗi đẹp, message rõ ràng
if (favoriteRepository.existsByUserIdAndMovieId(userId, movieId)) {
    throw new BusinessException(ErrorCode.INVALID_REQUEST, "Movie already in favorites");
}

// Lớp 2: DB UNIQUE constraint → bắt race condition
// Trong migration Liquibase:
// <addUniqueConstraint tableName="user_favorites"
//   columnNames="user_id, movie_id"
//   constraintName="uq_user_favorites_user_movie"/>
```

**Tại sao cần cả 2?**
- Code check: trả lỗi 400 với message thân thiện
- DB constraint: phòng thủ cuối — khi 2 request đến đồng thời (race condition), code check cùng pass nhưng DB chỉ cho 1 insert

---

## 4. Sơ đồ luồng xử lý

### Luồng addFavorite (POST /api/movies/{movieId}/favorite)

```
User gửi POST /api/movies/1/favorite
    |
    v
[JwtAuthFilter] → xác thực token → lấy userId = 10
    |
    v
[UserFavoriteController.addFavorite(movieId = 1)]
    |
    v
[UserFavoriteService.addFavorite(movieId=1, userId=10)]
    |
    +---> [1] Check duplicate:
    |         favoriteRepository.existsByUserIdAndMovieId(10, 1)
    |         └─ TRUE → throw BusinessException(INVALID_REQUEST)
    |                   → 400 "Movie already in favorites"
    |
    +---> [2] Load movie: movieRepository.findById(1)
    |         └─ not found → throw ENTITY_NOT_FOUND → 404
    |
    +---> [3] Load user: userRepository.getReferenceById(10)
    |         (proxy — không query DB, chỉ set FK)
    |
    +---> [4] Build & Save:
    |         UserFavorite.builder()
    |           .user(user)
    |           .movie(movie)
    |           .build()
    |         favoriteRepository.save(favorite)
    |
    v
ApiResponse (200, message: "Added to favorites")
```

### Luồng removeFavorite (DELETE /api/movies/{movieId}/favorite)

```
User gửi DELETE /api/movies/1/favorite
    |
    v
[UserFavoriteController.removeFavorite(movieId = 1)]
    |
    v
[UserFavoriteService.removeFavorite(movieId=1, userId=10)]
    |
    +---> [1] Tìm record:
    |         favoriteRepository.findByUserIdAndMovieId(10, 1)
    |         └─ not found → throw ENTITY_NOT_FOUND → 404
    |                        (không thể xóa thứ không tồn tại)
    |
    +---> [2] Hard delete:
    |         favoriteRepository.delete(favorite)
    |         SQL: DELETE FROM user_favorites WHERE id = ?
    |
    v
ApiResponse (200, message: "Removed from favorites")
```

### Luồng getMyFavorites (GET /api/users/me/favorites)

```
User gửi GET /api/users/me/favorites?page=0&size=20
    |
    v
[UserFavoriteController.getMyFavorites(pageable)]
    |
    v
[UserFavoriteService.getMyFavorites(userId=10, pageable)]
    |
    +---> favoriteRepository.findByUserIdOrderByCreatedAtDesc(10, pageable)
    |     SQL: SELECT uf.*, m.*
    |          FROM user_favorites uf
    |          JOIN movies m ON uf.movie_id = m.id
    |          WHERE uf.user_id = 10
    |          ORDER BY uf.created_at DESC
    |          OFFSET 0 ROWS FETCH NEXT 20 ROWS ONLY
    |
    +---> Map sang FavoriteMovieResponse:
    |         movieId, title, posterUrl, duration,
    |         rating, status, favoritedAt (= uf.createdAt)
    |
    v
PageResponse<FavoriteMovieResponse>
```

### URL Design — tại sao 2 base path khác nhau

```
/api/movies/{movieId}/favorite   → action TRÊN PHIM (thêm/bỏ thích 1 phim cụ thể)
/api/users/me/favorites          → data CỦA USER (danh sách phim user đã thích)

Ví dụ đời thường:
  /api/products/123/review       → viết review cho sản phẩm 123
  /api/users/me/reviews          → tất cả review tôi đã viết

Nguyên tắc REST:
  Sub-resource của movie: /movies/{id}/favorite
  Sub-resource của user:  /users/me/favorites
```

---

## 5. SQL được sinh ra

### INSERT khi thêm yêu thích
```sql
INSERT INTO user_favorites (user_id, movie_id, created_at)
VALUES (10, 1, GETDATE())
```

### DELETE khi bỏ yêu thích (HARD DELETE)
```sql
-- Khác hẳn soft delete — xóa thẳng khỏi bảng
DELETE FROM user_favorites
WHERE id = 55
-- Không có UPDATE storage_state!
```

### SELECT kiểm tra đã thích chưa
```sql
-- existsByUserIdAndMovieId(userId, movieId)
SELECT CASE WHEN COUNT(*) > 0 THEN 1 ELSE 0 END
FROM user_favorites
WHERE user_id = 10 AND movie_id = 1
```

### SELECT danh sách phim yêu thích của user
```sql
-- findByUserIdOrderByCreatedAtDesc(userId, pageable)
SELECT
    uf.id,
    uf.created_at AS favorited_at,
    m.id AS movie_id,
    m.title,
    m.poster_url,
    m.duration,
    m.rating,
    m.status
FROM user_favorites uf
JOIN movies m ON uf.movie_id = m.id
WHERE uf.user_id = 10
ORDER BY uf.created_at DESC
OFFSET 0 ROWS FETCH NEXT 20 ROWS ONLY
```

### UNIQUE constraint trong Liquibase migration
```sql
-- Được tạo trong migration changeset
ALTER TABLE user_favorites
ADD CONSTRAINT uq_user_favorites_user_movie
UNIQUE (user_id, movie_id);
```

---

## 6. Annotation/API mới sử dụng

| Annotation / Method | Tác dụng | Ví dụ |
|---|---|---|
| `@PreAuthorize("isAuthenticated()")` | Đặt trên class — tất cả endpoint đều yêu cầu đăng nhập | `@PreAuthorize("isAuthenticated()") class UserFavoriteController` |
| `repository.delete(entity)` | Hard delete — xóa thẳng khỏi DB, không soft delete | `favoriteRepository.delete(favorite)` |
| `existsByUserIdAndMovieId()` | Spring Data tự sinh query EXISTS dựa theo tên method | `boolean exists = repo.existsByUserIdAndMovieId(userId, movieId)` |
| `findByUserIdAndMovieId()` | Spring Data tự sinh query WHERE userId = ? AND movieId = ? | `Optional<UserFavorite> fav = repo.findByUserIdAndMovieId(10, 1)` |
| `@Table(uniqueConstraints)` | Khai báo UNIQUE constraint trên entity | `@UniqueConstraint(columnNames = {"user_id", "movie_id"})` |
| `getReferenceById(id)` | Tạo proxy entity (không SELECT DB) để set FK | Tiết kiệm 1 SELECT khi chỉ cần set user FK |

---

## 7. Kiến thức áp dụng

### Toggle pattern (thêm/bỏ)
```
POST /api/movies/1/favorite    → thêm vào yêu thích
DELETE /api/movies/1/favorite  → bỏ khỏi yêu thích

Không dùng 1 endpoint toggle vì:
- REST chuẩn: POST = tạo, DELETE = xóa
- Dễ hiểu hơn "gọi 1 endpoint, lần 1 thêm, lần 2 xóa"
```

### Check duplicate trước khi thêm
```java
if (favoriteRepository.existsByUserIdAndMovieId(userId, movieId)) {
    throw new BusinessException(ErrorCode.INVALID_REQUEST, "Movie already in favorites");
}
```

### Hard delete (không soft delete)
```java
// Favorites dùng hard delete (repository.delete) thay vì soft delete
// Lý do: bảng join đơn giản, không cần audit trail
// User bỏ thích → xóa row → thích lại → insert row mới
```

### URL design
```
GET    /api/users/me/favorites           → danh sách phim yêu thích (thuộc user)
POST   /api/movies/{movieId}/favorite    → thêm (action trên movie)
DELETE /api/movies/{movieId}/favorite    → bỏ (action trên movie)

2 base path khác nhau vì:
- GET favorites: thuộc về user (/users/me/...)
- POST/DELETE: action trên movie (/movies/{id}/...)
```

### UNIQUE constraint — DB level vs Code level

**DB level** (Liquibase migration):
```xml
<addUniqueConstraint
    tableName="user_favorites"
    columnNames="user_id, movie_id"
    constraintName="uq_user_favorites_user_movie"/>
```
- Bảo vệ ở tầng thấp nhất
- Không thể bypass dù code có bug
- Bắt race condition

**Code level** (service check):
```java
if (favoriteRepository.existsByUserIdAndMovieId(userId, movieId)) {
    throw new BusinessException(ErrorCode.INVALID_REQUEST, "Movie already in favorites");
}
```
- Trả error message thân thiện, có errorCode
- UX tốt hơn là để DB exception lộ ra

**Nên có cả 2** — code check cho UX, DB constraint cho safety.

---

## 8. Request/Response mẫu

### POST /api/movies/{movieId}/favorite — thêm yêu thích
```bash
curl -X POST http://localhost:8088/api/movies/1/favorite \
  -H "Authorization: Bearer <token>"
```

**Response thành công (200):**
```json
{
  "success": true,
  "message": "Added to favorites"
}
```

**Response lỗi — đã thích rồi (400):**
```json
{
  "success": false,
  "errorCode": "INVALID_REQUEST",
  "message": "Movie already in favorites"
}
```

**Response lỗi — phim không tồn tại (404):**
```json
{
  "success": false,
  "errorCode": "ENTITY_NOT_FOUND",
  "message": "Phim không tồn tại"
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

### DELETE /api/movies/{movieId}/favorite — bỏ yêu thích
```bash
curl -X DELETE http://localhost:8088/api/movies/1/favorite \
  -H "Authorization: Bearer <token>"
```

**Response thành công (200):**
```json
{
  "success": true,
  "message": "Removed from favorites"
}
```

**Response lỗi — phim không có trong danh sách yêu thích (404):**
```json
{
  "success": false,
  "errorCode": "ENTITY_NOT_FOUND",
  "message": "Phim không có trong danh sách yêu thích của bạn"
}
```

### GET /api/users/me/favorites — danh sách phim yêu thích
```bash
curl -X GET "http://localhost:8088/api/users/me/favorites?page=0&size=20" \
  -H "Authorization: Bearer <token>"
```

**Response thành công (200):**
```json
{
  "success": true,
  "data": {
    "content": [
      {
        "movieId": 5,
        "title": "Avengers: Endgame",
        "posterUrl": "https://cdn.cinex.vn/posters/avengers-endgame.jpg",
        "duration": 181,
        "rating": 8.5,
        "status": "NOW_SHOWING",
        "favoritedAt": "2026-05-24T10:00:00"
      },
      {
        "movieId": 2,
        "title": "Interstellar",
        "posterUrl": "https://cdn.cinex.vn/posters/interstellar.jpg",
        "duration": 169,
        "rating": 9.0,
        "status": "COMING_SOON",
        "favoritedAt": "2026-05-20T08:30:00"
      }
    ],
    "totalElements": 2,
    "totalPages": 1,
    "page": 0,
    "size": 20
  }
}
```

**Response khi chưa có phim yêu thích (200 — empty):**
```json
{
  "success": true,
  "data": {
    "content": [],
    "totalElements": 0,
    "totalPages": 0,
    "page": 0,
    "size": 20
  }
}
```

---

## 9. Câu hỏi tự kiểm tra

1. **Favorites dùng hard delete hay soft delete? Tại sao?** → Hard delete. Vì đây là bảng join đơn giản không cần audit trail. User bỏ thích → xóa row. Thích lại → insert row mới. Không cần lưu lịch sử "đã từng thích".
2. **Tại sao POST ở /api/movies/{id}/favorite mà GET ở /api/users/me/favorites?** → POST/DELETE là action trên movie resource. GET là data thuộc về user resource. Hai base path phản ánh đúng ownership của resource trong REST.
3. **1 user thích 1 phim 2 lần thì sao?** → Lỗi 400 "Movie already in favorites" do service check trước khi insert. Nếu race condition qua check → DB UNIQUE constraint bắt lỗi → Spring trả lỗi 500 có thể catch và xử lý.
4. **UNIQUE constraint nên đặt ở DB hay chỉ check trong code thôi?** → Nên đặt cả 2. Code check: UX tốt, error message thân thiện. DB constraint: bảo vệ khỏi race condition và code bug — lớp phòng thủ cuối cùng không thể bypass.
5. **UserFavorite có extends BaseEntity không? Tại sao?** → Tùy design. Nếu extends BaseEntity thì có thêm version, storageState (không dùng), createdBy, updatedBy (thừa). Bảng join đơn giản có thể chỉ cần user_id, movie_id, created_at là đủ — giữ entity gọn nhẹ.
