# Module User Favorites — Giải thích chi tiết

## 1. Tổng quan
Module Favorites cho phép user **lưu phim yêu thích** — bấm tim để lưu, xem lại danh sách phim đã lưu.

Đơn giản nhất trong tất cả module — bảng join 2 FK + 3 API.

---

## 2. Danh sách files

| File | Tác dụng | Design Pattern |
|---|---|---|
| `entity/UserFavorite.java` | Entity **extends BaseEntity** (Phase 4, changeset 047) — có đủ id/version/storageState/audit. Field nghiệp vụ: user, movie. UNIQUE(user+movie) | Join Table + BaseEntity |
| `dto/FavoriteMovieResponse.java` | movieId, title, posterUrl, duration, rating, status, favoritedAt | DTO Pattern |
| `repository/UserFavoriteRepository.java` | findByUserId (sorted), existsByUserIdAndMovieId, **deleteByMovieId** (cascade hard delete) | Repository Pattern |
| `service/UserFavoriteService.java` | addFavorite, removeFavorite, getMyFavorites, isFavorited | Service Layer |
| `controller/UserFavoriteController.java` | 3 endpoints, @PreAuthorize("isAuthenticated()") | MVC Controller |
| `db/changelog/changes/047-user-favorite-base-entity.xml` | Migration thêm version, storage_state, audit + backfill row cũ | Liquibase Changelog |

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

**Vẫn hard delete dù entity đã extends BaseEntity (Phase 4):**

Từ Phase 4, `UserFavorite` đã extends `BaseEntity` (changeset 047) → có sẵn cột `storage_state`. Tuy nhiên `removeFavorite()` **vẫn hard delete**, KHÔNG chuyển sang soft delete. Lý do:

| Tiêu chí | UX favorite toggle | Phù hợp với? |
|---|---|---|
| User bấm tim → bỏ tim → bấm lại | Phải xảy ra tức thì, không tích lũy row ẩn | Hard delete |
| Nếu soft delete | Mỗi lần unfavorite tạo 1 row ARCHIVED → bấm lại phải restore hay insert mới? | Phức tạp, không cần |
| Audit ai unfavorite khi nào? | KHÔNG cần (không phải hành động pháp lý) | Hard delete OK |
| Cần khôi phục lịch sử? | KHÔNG (user chủ động bỏ thích) | Hard delete OK |

**Tại sao vẫn extends BaseEntity nếu không dùng storageState?**

1. **Đồng nhất pattern toàn dự án** — mọi entity nghiệp vụ đều extends BaseEntity, dev không phải nhớ ngoại lệ.
2. **JPA Auditing tự set `createdBy`, `updatedAt`** — tương lai báo cáo "ai thích phim này" dùng được.
3. **Ready cho tương lai** — nếu sau này business yêu cầu "khôi phục danh sách yêu thích đã xóa nhầm", chỉ cần đổi service từ `delete()` sang `setStorageState(ARCHIVED)`, không cần migration thêm cột.

**So sánh với soft delete ở module khác:**

| Tiêu chí | Hard Delete (Favorites) | Soft Delete (Movies, Users) |
|---|---|---|
| Lý do xóa | User chủ động bỏ thích | Admin ẩn nội dung |
| Cần audit? | Không | Có (ai xóa? khi nào?) |
| Có thể khôi phục? | Không cần | Cần (restore) |
| Xóa lại sau = insert mới | Đúng | Sai (cần restore) |
| Phức tạp? | Đơn giản | Phức tạp hơn |

### Cascade khi Movie bị ARCHIVED (Phase 4 — Asymmetric)
**Bài toán:** Admin archive (soft-delete) Movie. User vẫn thấy phim này trong "Yêu thích của tôi" → bấm vào → 404 "phim không tồn tại" → UX tệ.

**Cách CineX xử lý:** Movie archive → **HARD DELETE** tất cả `UserFavorite` của phim đó. Đây là cascade **bất đối xứng** vì:
- Movie: soft delete (có thể restore)
- Favorite: hard delete (không restore)

```java
// MovieService.cascadeArchiveDependencies — gọi từ deleteMovie + bulkDelete
private void cascadeArchiveDependencies(Long movieId) {
    int reviewsArchived  = reviewRepository.archiveByMovieId(movieId);    // soft delete reviews
    int favoritesDeleted = userFavoriteRepository.deleteByMovieId(movieId); // HARD delete favorites
    // ...
}

// UserFavoriteRepository
@Modifying
@Query("DELETE FROM UserFavorite uf WHERE uf.movie.id = :movieId")
int deleteByMovieId(@Param("movieId") Long movieId);
```

**Khi restore Movie:** Reviews **unarchive lại** (ARCHIVED → ACTIVE), nhưng **favorites KHÔNG khôi phục** (đã hard delete).

```java
// MovieService.restoreMovie
@Transactional
public MovieResponse restoreMovie(Long id) {
    movie.setStorageState(StorageState.ACTIVE);
    int restored = reviewRepository.unarchiveByMovieId(id);  // reverse cascade
    // KHÔNG có favoriteRepository.???  — đã mất khi archive
    log.info("Restored {} reviews for movie {}", restored, movie.getTitle());
}
```

**Tại sao asymmetric (review restore, favorite không)?**

| Khía cạnh | Review | Favorite |
|---|---|---|
| Bản chất | Nội dung user tạo (text, rating) — có giá trị | Toggle UX — không nội dung |
| Mất đi có tiếc không? | CÓ — user mất công viết, mất rating | KHÔNG — chỉ là cờ "đã thích" |
| Khi restore Movie | Hợp lý hiện lại review cũ | User có thể bấm tim lại (1 click) |
| Tech | UPDATE `storage_state = 'ACTIVE'` | INSERT row mới khi user thích lại |

**Bảng quyết định cascade — pattern chung trong CineX:**

| Action | Cascade target | Loại cascade |
|---|---|---|
| Archive Movie | Reviews của Movie | Soft delete (archive) — có thể restore |
| Archive Movie | Favorites của Movie | Hard delete — không restore |
| Archive Movie | Notifications | KHÔNG cascade (FK không trực tiếp) |
| Archive User | Bookings của User | KHÔNG cascade (giữ lịch sử) |
| Archive User | Reviews của User | KHÔNG cascade (review vẫn hợp lệ) |

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
-- UserFavorite giờ extends BaseEntity → có thêm version/storage_state/audit
INSERT INTO user_favorites (
  user_id, movie_id,
  version, storage_state, created_at, updated_at, created_by, updated_by
)
VALUES (
  10, 1,
  0, 'ACTIVE', GETDATE(), GETDATE(), 'vanan', 'vanan'
)
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

### Cascade hard-delete khi archive Movie (Phase 4)
```sql
-- MovieService.deleteMovie(123) → cascade:
-- 1) Archive movie (soft)
UPDATE movies SET storage_state = 'ARCHIVED', version = version + 1
WHERE id = 123;

-- 2) Archive reviews (soft — có thể restore)
UPDATE reviews SET storage_state = 'ARCHIVED'
WHERE movie_id = 123 AND storage_state <> 'ARCHIVED';

-- 3) HARD DELETE favorites (KHÔNG restore được)
DELETE FROM user_favorites WHERE movie_id = 123;
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
5. **UserFavorite có extends BaseEntity không? Tại sao?** → **CÓ** (từ Phase 4, changeset 047). Lý do dù không soft-delete: (1) đồng nhất pattern toàn dự án, (2) JPA Auditing tự set `createdBy/updatedAt` — báo cáo dùng được, (3) ready cho tương lai nếu cần khôi phục lịch sử yêu thích (chỉ cần đổi `delete()` sang `setStorageState(ARCHIVED)`, không migration thêm). **Vẫn hard delete khi user unfavorite** — UX toggle phải nhanh, không cần audit.
6. **Tại sao khi archive Movie thì favorite hard delete, còn review thì soft delete?** → Review là nội dung user tạo (text, rating) — có giá trị, mất đi tiếc; khi restore Movie thì unarchive lại review để hiện lại. Favorite chỉ là cờ "đã thích" — user có thể bấm tim lại trong 1 click; không cần restore.
7. **Khi user gọi DELETE /api/movies/123/favorite, SQL chạy là gì?** → 2 query: (1) SELECT `findByUserIdAndMovieId(10, 123)` để check ownership + lấy entity (cho phép trả lỗi rõ ràng nếu không có), (2) `DELETE FROM user_favorites WHERE id = ?`. Có thể tối ưu thành 1 query `DELETE WHERE user_id = ? AND movie_id = ?` nhưng mất khả năng phân biệt 404 vs success.

---

## 10. Bổ sung — Endpoint `isFavorited` cho Frontend

### Vấn đề
Trang detail phim cần hiển thị icon trái tim ❤️ (đã thích) hoặc 🤍 (chưa thích). FE cần biết status hiện tại.

Cách SAI: query toàn bộ favorites list → check movie có trong list không. Tốn data.

Cách ĐÚNG: endpoint nhẹ trả `{ isFavorited: boolean }`.

### Endpoint
```java
@GetMapping("/movies/{id}/favorited")
@PreAuthorize("isAuthenticated()")
public ApiResponse<FavoriteStatusResponse> isFavorited(
    @PathVariable Long id,
    Authentication auth
) {
    Long userId = ((CustomUserDetails) auth.getPrincipal()).getId();
    boolean favorited = favoriteRepository.existsByUserIdAndMovieId(userId, id);
    return ApiResponse.success(new FavoriteStatusResponse(favorited));
}
```

### Repository
```java
boolean existsByUserIdAndMovieId(Long userId, Long movieId);
```

Spring Data sinh: `SELECT COUNT(*) > 0 FROM user_favorites WHERE user_id = ? AND movie_id = ?`. Có index `(user_id, movie_id)` → cực nhanh.

### Frontend
```tsx
const { data } = useQuery({
  queryKey: ["favorite-status", movieId],
  queryFn: () => api.get(`/api/movies/${movieId}/favorited`).then(r => r.data.data),
  enabled: !!token,
});

<button onClick={() => toggle.mutate(data?.isFavorited)}>
  {data?.isFavorited ? <HeartFilled /> : <Heart />}
</button>
```

### Bulk check cho list page
List phim hiển thị 20 card với icon yêu thích → KHÔNG gọi 20 endpoint riêng:

```java
@PostMapping("/me/favorites/check")
public ApiResponse<Map<Long, Boolean>> checkBulk(
    @RequestBody List<Long> movieIds,
    Authentication auth
) {
    Long userId = ((CustomUserDetails) auth.getPrincipal()).getId();
    Set<Long> favoritedIds = favoriteRepository.findFavoritedMovieIds(userId, movieIds);
    Map<Long, Boolean> result = movieIds.stream()
        .collect(Collectors.toMap(id -> id, favoritedIds::contains));
    return ApiResponse.success(result);
}

@Query("SELECT f.movie.id FROM UserFavorite f WHERE f.user.id = :userId AND f.movie.id IN :movieIds")
Set<Long> findFavoritedMovieIds(Long userId, List<Long> movieIds);
```

1 query thay vì N → giảm latency.

### Invalidate sau toggle
```tsx
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["favorite-status", movieId] });
  queryClient.invalidateQueries({ queryKey: ["favorites"] });
}
```
