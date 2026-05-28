# Filter DTO + Specification — Pattern thống nhất cho List API

## 1. Tổng quan

Tất cả list API trong dự án dùng **cùng 1 pattern**:

```
FE gửi query params → Spring bind vào Filter DTO → Specification.fromFilter() → findAll(spec, pageable)
```

| Module | Filter DTO | Specification | Filter fields |
|---|---|---|---|
| Movie | `MovieFilter` | `MovieSpecification` | keyword, status, genreId, includeDeleted |
| Genre | `GenreFilter` | `GenreSpecification` | keyword, includeDeleted |
| Room | `RoomFilter` | `RoomSpecification` | keyword, type, status, includeDeleted |

## 2. Tại sao dùng Filter DTO?

### So sánh 3 cách

```java
// ❌ Cách 1: Nhiều param rời — thêm filter = sửa signature tất cả nơi gọi
public Page<Movie> list(String keyword, MovieStatus status, Long genreId,
                        boolean includeDeleted, Pageable pageable)
// 5 params! Thêm "language" filter → phải sửa Service + Controller + tất cả nơi gọi

// ❌ Cách 2: Map<String, Object> — không type-safe
public Page<Movie> list(Map<String, Object> params)
// params.get("status") trả Object → phải cast → dễ lỗi runtime
// Swagger không biết Map chứa key gì → API docs trống

// ✅ Cách 3: Filter DTO — type-safe + linh hoạt
public Page<Movie> list(MovieFilter filter, Pageable pageable)
// Thêm "language" filter → chỉ thêm field vào DTO + 1 dòng if trong Specification
// Swagger tự document tất cả fields
// IDE autocomplete: filter.getKeyword(), filter.getStatus()
```

## 3. Cách hoạt động

### FE gửi request
```
GET /api/movies?keyword=Avengers&status=NOW_SHOWING&genreId=1&page=0&size=20
                │                 │                  │        │       │
                query params ─────┘──────────────────┘────────┘       │
                                                                      │
                pagination params ────────────────────────────────────┘
```

### Spring tự bind query params vào DTO
```java
// Controller — Spring tự tạo MovieFilter object + set fields từ query params
@GetMapping
public ApiResponse<...> listMovies(MovieFilter filter, Pageable pageable) {
    // filter.getKeyword() → "Avengers"
    // filter.getStatus() → MovieStatus.NOW_SHOWING
    // filter.getGenreId() → 1L
    // filter.getIncludeDeleted() → null (không truyền = null)
    // pageable.getPageNumber() → 0
    // pageable.getPageSize() → 20
}
```

**Không cần `@RequestParam` cho từng field!** Spring Boot tự bind query params vào DTO object nếu tên khớp.

### Specification build query từ Filter DTO
```java
public static Specification<Movie> fromFilter(MovieFilter filter) {
    Specification<Movie> spec = Specification.where(null); // Bắt đầu rỗng

    // Mỗi field: nếu có giá trị → ghép thêm điều kiện AND
    if (!Boolean.TRUE.equals(filter.getIncludeDeleted())) {
        spec = spec.and(notDeleted());
        // → WHERE (storage_state IS NULL OR storage_state <> 'DELETED')
    }
    if (StringUtils.hasText(filter.getKeyword())) {
        spec = spec.and(hasTitle(filter.getKeyword()));
        // → AND LOWER(title) LIKE '%avengers%'
    }
    if (filter.getStatus() != null) {
        spec = spec.and(hasStatus(filter.getStatus()));
        // → AND status = 'NOW_SHOWING'
    }
    if (filter.getGenreId() != null) {
        spec = spec.and(hasGenre(filter.getGenreId()));
        // → AND genre_id = 1 (JOIN movie_genres)
    }
    return spec;
}
```

### SQL cuối cùng
```sql
SELECT * FROM movies m
LEFT JOIN movie_genres mg ON m.id = mg.movie_id
WHERE (m.storage_state IS NULL OR m.storage_state <> 'DELETED')
  AND LOWER(m.title) LIKE '%avengers%'
  AND m.status = 'NOW_SHOWING'
  AND mg.genre_id = 1
ORDER BY m.id
OFFSET 0 ROWS FETCH NEXT 20 ROWS ONLY
```

## 4. Thêm filter mới — chỉ 3 bước

VD: Thêm filter "language" cho Movie.

**Bước 1:** Thêm field vào Filter DTO
```java
// MovieFilter.java
private String language;  // ← thêm 1 dòng
```

**Bước 2:** Thêm method trong Specification
```java
// MovieSpecification.java
public static Specification<Movie> hasLanguage(String language) {
    return (root, query, cb) -> cb.equal(root.get("language"), language);
}
```

**Bước 3:** Thêm 1 dòng if trong fromFilter
```java
if (StringUtils.hasText(filter.getLanguage())) {
    spec = spec.and(hasLanguage(filter.getLanguage()));
}
```

**Xong!** Controller và Service **không cần sửa gì** — vì signature nhận DTO, không đổi.

## 5. Về ClientContext

Dự án dùng **Spring Security + JPA Auditing** thay vì truyền ClientContext qua param:

```
Ai đang login?      → SecurityContextHolder (JwtAuthFilter set mỗi request)
Ai tạo/sửa record?  → @CreatedBy / @LastModifiedBy (JPA tự điền vào BaseEntity)
```

Tức là mỗi khi `save()`, JPA tự ghi `createdBy`, `updatedBy` mà không cần truyền param.

**Tại sao không truyền ClientContext qua param?**
- Spring Security đã giữ user info trong ThreadLocal → lấy ra bất kỳ đâu
- JPA Auditing tự điền → không cần code thủ công
- Truyền param → mọi method phải nhận thêm 1 tham số → verbose, dễ quên

**Nếu cần thêm info (IP, device)?**
→ Tạo Filter/Interceptor bắt 1 lần → set vào ThreadLocal → Service lấy ra khi cần.

## 6. Câu hỏi tự kiểm tra

1. **Filter DTO khác Map\<String, Object\> ở điểm nào?**
   → DTO có type safety (String keyword, MovieStatus status — IDE check lúc compile), Swagger tự document, validate được bằng @Valid. Map mất hết.

2. **Tại sao Spring tự bind query params vào DTO mà không cần @RequestParam?**
   → Spring Boot auto-bind: nếu method param là object (không phải String/int/...), Spring tạo instance rồi set field theo tên query param. `?keyword=abc` → `filter.setKeyword("abc")`.

3. **Thêm 1 filter mới cần sửa bao nhiêu file?**
   → Chỉ 1 file: Filter DTO (thêm field) + Specification (thêm method + if). Controller + Service không đổi.

4. **Tại sao dùng `Boolean.TRUE.equals(filter.getIncludeDeleted())` thay vì `filter.getIncludeDeleted()`?**
   → Vì `includeDeleted` là `Boolean` (wrapper), có thể null. `null == true` → NPE. `Boolean.TRUE.equals(null)` → false (safe).
