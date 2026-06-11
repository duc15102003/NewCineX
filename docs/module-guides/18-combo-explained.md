# Module Combo — Giải thích chi tiết

> **Module:** Combo (snack bundle)
> **Patterns chính:** Composition (has-many), JPA Cascade + orphanRemoval, Junction Entity với metadata, useFieldArray (react-hook-form), Live preview calculation
> **Đối tượng:** Sinh viên năm 4 CNTT, muốn hiểu sâu vì sao chọn `@OneToMany` thay vì `@ManyToMany`, và làm chủ form động trên FE

---

## 1. Tổng quan

### Combo là gì trong rạp chiếu?

Đi xem phim ở **CGV**, **Lotte**, **Galaxy** chắc bạn đã từng thấy mấy biển quảng cáo:

- **"Combo Romance — 159k"** = 2 bắp lớn + 2 nước ngọt → mua lẻ tốn ~200k
- **"Combo Family — 299k"** = 3 bắp + 4 nước + 1 hot dog → mua lẻ ~400k
- **"Combo Student — 99k"** = 1 bắp + 1 nước → mua lẻ 130k

Đó chính là **combo bundle**: rạp gom nhiều snack lại thành một gói có **giá ưu đãi** so với mua lẻ. Đây là chiêu marketing kinh điển:

- **Tâm lý khách:** Thấy "tiết kiệm 50k" thì cảm thấy lời, dù thực ra mình mua nhiều hơn ý định ban đầu
- **Rạp lợi:** Bán được nhiều món hơn / lần, tăng AOV (Average Order Value)
- **Vận hành nhanh:** POS chỉ cần scan 1 mã thay vì 4-5 snack riêng

### CineX phase 1: snack-only bundle

CineX chỉ implement **snack-only combo** (không bundle vé). Lý do:

- Bundle vé phức tạp hơn nhiều: phải gắn `showtime`, `seat`, có giờ hết hạn riêng
- Snack-only đủ dùng cho POS bán bắp nước
- Có thể mở rộng sau (thêm bảng `combo_seats` chẳng hạn)

**Vị trí combo trong flow CineX:**

```
USER FLOW (giai đoạn add-on khi đặt vé):
  Chọn ghế → Chọn combo (tùy chọn) → Thanh toán → Vé

POS FLOW (sau khi xem hoặc trước khi vào):
  Tới quầy → Quét QR combo → Trả tiền → Nhận bắp nước
```

### Bài toán dữ liệu — vì sao cần bảng riêng?

Mỗi combo:

- Gồm **nhiều snacks khác nhau** (bắp + nước + hot dog)
- Mỗi snack trong combo có **số lượng** (2 bắp, không phải 1)
- Có **giá cố định** (admin tự đặt, không tự tính từ snack)
- Có ảnh combo riêng (admin chụp gộp 2 bắp + 2 nước cho đẹp)

→ Đây là quan hệ **Many-to-Many với metadata** (quantity là metadata). Không thể dùng `@ManyToMany` trực tiếp được — phải dùng **junction entity**. Ta sẽ giải thích kỹ ở section 4.

### Bài toán "tiết kiệm bao nhiêu?"

Admin cần thấy ngay: combo `159k` thì so với mua lẻ `200k` → tiết kiệm `41k`. CineX implement:

- **BE:** trả thêm field `regularPrice` = SUM(snack.price × qty) trong `ComboResponse`
- **FE:** tính live khi admin nhập form — thay đổi snack/qty/price → tự tính `savings = regularPrice - combo.price`

Đây là pattern **live preview** rất hay áp dụng trong admin tools (Shopify, Stripe Dashboard...).

---

## 2. Files đã tạo

| File | Role | Pattern chính |
|---|---|---|
| `Combo.java` (entity) | Aggregate root, has-many ComboItem | Composition + Cascade ALL + orphanRemoval |
| `ComboItem.java` (entity) | Junction entity với quantity | Junction Entity (KHÔNG extends BaseEntity) |
| `ComboRepository.java` | JPA repository + EntityGraph | EntityGraph chống N+1 |
| `ComboService.java` | Business logic CRUD | Batch fetch + Replace pattern |
| `ComboController.java` | REST endpoints | `@PreAuthorize("hasRole('ADMIN')")` cho mutations |
| `ComboRequest.java` | Request DTO (validation) | Bean Validation `@Valid` cascade |
| `ComboResponse.java` | Response DTO (có `regularPrice`) | Builder Pattern |
| `ComboItemRequest.java` | Item DTO trong request | `@Min(1)` cho quantity |
| `ComboItemResponse.java` | Item DTO trong response | Builder Pattern |
| `057-create-combos-tables.xml` | Liquibase changelog | `ON DELETE CASCADE` cho combo_id FK |
| `AdminComboPage.tsx` | Page admin CRUD combo | useFieldArray (dynamic list) + Live preview |
| `useAdminCombos.ts` | Hook React Query | useSnacksOptions với staleTime 5 phút |

---

## 3. Schema chi tiết

### Bảng `combos` (metadata gốc)

```sql
CREATE TABLE combos (
    id              BIGINT IDENTITY PRIMARY KEY,
    version         BIGINT DEFAULT 0,
    storage_state   NVARCHAR(20),                   -- soft delete (ACTIVE/ARCHIVED)
    created_by      NVARCHAR(50),
    updated_by      NVARCHAR(50),
    created_at      DATETIME2,
    updated_at      DATETIME2,

    code            NVARCHAR(50) NOT NULL UNIQUE,   -- VD: COMBO-ROMANCE
    name            NVARCHAR(200) NOT NULL,         -- VD: Combo Romance
    description     NVARCHAR(500),
    image_url       NVARCHAR(500),
    price           DECIMAL(12,0) NOT NULL,         -- giá combo cố định
    active          BIT NOT NULL DEFAULT 1          -- true = đang bán
);

CREATE INDEX idx_combos_active ON combos(active);
```

### Bảng `combo_items` (junction table có metadata)

```sql
CREATE TABLE combo_items (
    id          BIGINT IDENTITY PRIMARY KEY,
    combo_id    BIGINT NOT NULL,
    snack_id    BIGINT NOT NULL,
    quantity    INT NOT NULL DEFAULT 1,             -- METADATA quan trọng

    CONSTRAINT fk_combo_items_combo
        FOREIGN KEY (combo_id) REFERENCES combos(id) ON DELETE CASCADE,
    CONSTRAINT fk_combo_items_snack
        FOREIGN KEY (snack_id) REFERENCES snacks(id)
);

CREATE INDEX idx_combo_items_combo ON combo_items(combo_id);
```

### Tại sao có field `quantity`?

Vì 1 combo có thể chứa **nhiều cùng 1 snack**: "2 bắp" = quantity 2, "4 nước" = quantity 4.

Nếu thiếu field này:
- Cách 1 (sai): Lưu 2 row riêng cho cùng snack → trùng lặp, khó query
- Cách 2 (sai): Lưu vào `quantity` trong snack → mỗi snack chỉ có 1 quantity, không thay đổi theo combo được

Field `quantity` chính là cái **biến `combo_items` thành junction entity** thay vì pure M:N.

### Tại sao `ON DELETE CASCADE` cho `combo_id`?

Khi xóa combo (cứng):
- combo_items không còn ý nghĩa (không có cha nào trỏ tới)
- DB phải có cơ chế dọn rác

Hai cách tiếp cận:

```
Cách A — Application-level (Service tự xóa):
  ComboService.delete(id) {
      comboItemRepository.deleteByComboId(id);     // xóa con trước
      comboRepository.deleteById(id);              // xóa cha
  }
  → Code dài, dễ quên, race condition

Cách B — Database-level (ON DELETE CASCADE):
  DELETE FROM combos WHERE id = 1;
  → DB tự xóa hết combo_items có combo_id = 1
  → Code ngắn, an toàn, atomic
```

CineX chọn **Cách B**. Bonus: JPA `orphanRemoval=true` + cascade ALL cũng làm tương tự ở mức ORM (xem section 5).

> **CHÚ Ý:** KHÔNG cascade cho `snack_id`. Nếu xóa snack thì combo phải báo lỗi, không được xóa lan sang combo (combo đang bán mà mất snack thì khách mua xong không có gì để giao).

---

## 4. Composition Pattern — has-many

### Composition là gì?

Trong OOP có 2 cách object chứa object khác:

```
Aggregation (yếu): Library has-many Book
  - Book tồn tại độc lập (cho mượn vẫn còn)
  - Đóng library, book chuyển sang library khác

Composition (mạnh): Car has-many Wheel
  - Wheel chỉ tồn tại trong Car
  - Vứt car đi → vứt luôn wheel
  - Wheel không di chuyển sang car khác
```

**Combo ↔ ComboItem là Composition:**

- `ComboItem` chỉ tồn tại trong `Combo` (không có combo cha thì nó vô nghĩa)
- Xóa combo → xóa luôn items
- ComboItem không di chuyển từ combo này sang combo khác (nếu cần đổi combo → tạo ComboItem mới)

### Code biểu diễn Composition

```java
// Combo.java
@OneToMany(mappedBy = "combo", cascade = CascadeType.ALL, orphanRemoval = true)
@Builder.Default
private List<ComboItem> items = new ArrayList<>();
```

Bộ ba ma thuật:
- `mappedBy = "combo"` — phía ComboItem mới giữ FK, Combo chỉ tham chiếu
- `cascade = CascadeType.ALL` — mọi thao tác trên Combo lan sang items (save, delete, merge...)
- `orphanRemoval = true` — item nào bị remove khỏi list → tự xóa khỏi DB

### Sơ đồ Composition

```
                    ┌────────────────────────────┐
                    │  Combo (Aggregate Root)    │
                    │  id, code, name, price...  │
                    │  items: List<ComboItem> ───┼──┐
                    └────────────────────────────┘  │
                                                    │ has-many
                                                    ▼
                ┌──────────────────────────┐  ┌──────────────────────────┐
                │  ComboItem (junction)    │  │  ComboItem (junction)    │
                │  combo → Combo (parent)  │  │  combo → Combo (parent)  │
                │  snack → Snack           │  │  snack → Snack           │
                │  quantity: 2 (bắp)       │  │  quantity: 2 (nước)      │
                └──────────────────────────┘  └──────────────────────────┘
                          │                              │
                          ▼ ref                          ▼ ref
                ┌──────────────────────┐      ┌──────────────────────┐
                │  Snack (independent) │      │  Snack (independent) │
                │  "Bắp lớn"           │      │  "Coca-cola lớn"     │
                └──────────────────────┘      └──────────────────────┘
```

### Junction Entity — vì sao KHÔNG extends BaseEntity?

```java
// ComboItem.java
@Entity
@Table(name = "combo_items")
public class ComboItem {              // ← KHÔNG extends BaseEntity

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "combo_id", nullable = false)
    private Combo combo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "snack_id", nullable = false)
    private Snack snack;

    @Column(nullable = false)
    @Builder.Default
    private Integer quantity = 1;
}
```

Tại sao **không** extends BaseEntity (vốn có `version`, `storageState`, `createdAt`, `createdBy`...)?

| Field BaseEntity | Có cần cho ComboItem? | Lý do |
|---|---|---|
| `version` (optimistic lock) | Không | Update combo → replace toàn bộ items (xem section 5), không có concurrency |
| `storageState` (soft delete) | Không | Life cycle theo combo cha. Xóa combo = xóa hết items |
| `createdAt`, `createdBy` | Không | Audit ở mức combo là đủ (admin nào tạo combo) |
| `updatedAt`, `updatedBy` | Không | Update item thực ra là replace, không có "edit history" cho item |

→ Junction entity nên là **lightweight**, chỉ giữ những gì thật sự cần.

### Khi nào dùng `@ManyToMany` trực tiếp?

So sánh 2 case trong CineX:

**Case A — `Movie ↔ Genre` (pure M:N, KHÔNG metadata):**

```java
// Movie.java
@ManyToMany
@JoinTable(
    name = "movie_genres",
    joinColumns = @JoinColumn(name = "movie_id"),
    inverseJoinColumns = @JoinColumn(name = "genre_id")
)
private Set<Genre> genres;
```

Bảng `movie_genres` chỉ có 2 cột `(movie_id, genre_id)` — KHÔNG có thông tin gì thêm. Hibernate tự quản, code clean.

**Case B — `Combo ↔ Snack` (M:N với metadata):**

```java
// Combo.java
@OneToMany(mappedBy = "combo", cascade = ALL, orphanRemoval = true)
private List<ComboItem> items;

// ComboItem.java (junction entity riêng)
@ManyToOne private Combo combo;
@ManyToOne private Snack snack;
private Integer quantity;            // ← METADATA
```

Bảng `combo_items` có `(combo_id, snack_id, quantity)` — quantity là metadata. Bắt buộc dùng junction entity vì `@ManyToMany` không support thêm cột.

### Quy tắc đơn giản

```
Có metadata trong bảng nối?
├── KHÔNG → @ManyToMany (Movie ↔ Genre, User ↔ Role)
└── CÓ    → Junction Entity riêng + @OneToMany (Combo ↔ Snack, Order ↔ Product)
```

### Bidirectional vs Unidirectional

CineX dùng **OneToMany 1 chiều** từ Combo (Combo.items → ComboItem có combo, nhưng Combo KHÔNG có method `Snack.getCombos()`).

Tại sao tránh **bidirectional** (Snack có `combos: List<ComboItem>`)?

1. **Infinite recursion khi serialize JSON:**
   ```
   Combo → items → ComboItem → snack → Snack → combos → ComboItem → ... ∞
   ```
   Phải dùng `@JsonIgnore` / `@JsonManagedReference` → phức tạp, dễ sai.

2. **equals/hashCode khó:**
   Nếu Snack có `combos` thì khi 2 snacks bằng nhau → phải so các combos → mà combo lại có snack → vòng lặp.

3. **Lazy loading trap:**
   `snack.getCombos()` thường không cần, nhưng nếu vô tình gọi ngoài transaction → `LazyInitializationException`.

→ Quy tắc CineX: **chỉ bidirectional khi thật sự cần** (VD: User ↔ Booking — cần lấy bookings của user). Mặc định unidirectional.

---

## 5. JPA Cascade + orphanRemoval — pháp thuật JPA

### Cascade là gì?

`Cascade` (lan truyền) = thao tác trên cha tự áp dụng cho con. CineX dùng `CascadeType.ALL` = bao gồm tất cả:

| Cascade type | Trigger |
|---|---|
| `PERSIST` | `save(combo)` → `save(items)` |
| `MERGE` | `merge(combo)` → `merge(items)` |
| `REMOVE` | `delete(combo)` → `delete(items)` |
| `REFRESH` | `refresh(combo)` → `refresh(items)` |
| `DETACH` | `detach(combo)` → `detach(items)` |

### Demo Cascade khi CREATE

```java
// ComboService.create()
Combo combo = Combo.builder()
        .code("COMBO-ROMANCE")
        .name("Combo Romance")
        .price(BigDecimal.valueOf(159000))
        .build();

for (ComboItemRequest itemReq : request.getItems()) {
    ComboItem item = ComboItem.builder()
            .combo(combo)                                    // gắn cha
            .snack(snackMap.get(itemReq.getSnackId()))
            .quantity(itemReq.getQuantity())
            .build();
    combo.getItems().add(item);                              // add vào list
}

comboRepository.save(combo);                                 // CHỈ save Combo
```

Hibernate tự sinh ra (với cascade ALL):

```sql
INSERT INTO combos (code, name, price, ...) VALUES ('COMBO-ROMANCE', ...);
-- combo.id = 5

-- Cascade PERSIST tự chạy:
INSERT INTO combo_items (combo_id, snack_id, quantity) VALUES (5, 1, 2);
INSERT INTO combo_items (combo_id, snack_id, quantity) VALUES (5, 3, 2);
```

→ **1 dòng code `save(combo)` = N+1 INSERT**.

### orphanRemoval = sát thủ thầm lặng

`orphanRemoval=true` có nghĩa: **item nào bị remove khỏi collection → tự DELETE từ DB**.

```java
combo.getItems().remove(0);                                  // remove item đầu
comboRepository.save(combo);
```

Sinh ra:

```sql
DELETE FROM combo_items WHERE id = 17;
```

So sánh với cascade `REMOVE`:
- `cascade=REMOVE`: chỉ chạy khi `delete(combo)` (xóa cả combo)
- `orphanRemoval=true`: chạy khi item bị remove khỏi list, dù combo vẫn còn

### Replace pattern khi UPDATE — đỉnh cao của orphanRemoval

```java
// ComboService.update() — Excerpt
@Transactional
public ComboResponse update(Long id, ComboRequest request) {
    Combo combo = findOrThrow(id);

    // Update scalar fields
    combo.setName(request.getName());
    combo.setPrice(request.getPrice());

    // Replace items: clear cũ + add mới.
    // orphanRemoval=true → JPA tự xoá items cũ.
    combo.getItems().clear();                                // ← magic
    for (ComboItemRequest itemReq : request.getItems()) {
        ComboItem item = ComboItem.builder()
                .combo(combo)
                .snack(snackMap.get(itemReq.getSnackId()))
                .quantity(itemReq.getQuantity())
                .build();
        combo.getItems().add(item);
    }

    comboRepository.save(combo);                             // 1 save, JPA lo phần còn lại
    return toResponse(combo);
}
```

Hibernate sinh ra:

```sql
-- 1. Xóa toàn bộ items cũ (orphanRemoval)
DELETE FROM combo_items WHERE combo_id = 5;

-- 2. Update combo
UPDATE combos SET name = ?, price = ? WHERE id = 5 AND version = 0;

-- 3. Insert items mới (cascade PERSIST)
INSERT INTO combo_items (combo_id, snack_id, quantity) VALUES (5, ?, ?);
INSERT INTO combo_items (combo_id, snack_id, quantity) VALUES (5, ?, ?);
INSERT INTO combo_items (combo_id, snack_id, quantity) VALUES (5, ?, ?);
```

### Anti-pattern: Update từng item thủ công

Nếu KHÔNG dùng orphanRemoval, phải làm tay:

```java
// ❌ DON'T — Dài dòng, dễ sai
@Transactional
public ComboResponse updateManual(Long id, ComboRequest request) {
    Combo combo = findOrThrow(id);
    Map<Long, ComboItemRequest> newItemMap = ...; // index by snackId

    // 1. Xóa items không còn trong request
    Iterator<ComboItem> iter = combo.getItems().iterator();
    while (iter.hasNext()) {
        ComboItem item = iter.next();
        if (!newItemMap.containsKey(item.getSnack().getId())) {
            comboItemRepository.delete(item);                // explicit delete
            iter.remove();
        }
    }

    // 2. Update items đã có
    for (ComboItem item : combo.getItems()) {
        ComboItemRequest req = newItemMap.get(item.getSnack().getId());
        if (req != null) {
            item.setQuantity(req.getQuantity());
        }
    }

    // 3. Thêm items mới
    Set<Long> existingSnackIds = combo.getItems().stream()
            .map(i -> i.getSnack().getId()).collect(Collectors.toSet());
    for (ComboItemRequest req : request.getItems()) {
        if (!existingSnackIds.contains(req.getSnackId())) {
            ComboItem newItem = ComboItem.builder()...build();
            comboItemRepository.save(newItem);               // explicit save
            combo.getItems().add(newItem);
        }
    }

    comboRepository.save(combo);
    return toResponse(combo);
}
```

→ Replace pattern (clear + add) ngắn hơn 70%, ít bug hơn, dễ đọc hơn. Đánh đổi: thêm vài SQL DELETE/INSERT (acceptable cho combo size nhỏ ~5-10 items).

---

## 6. Service Logic + Validation

### Batch fetch snacks — chống N+1 từ phía service

```java
// ComboService.loadSnacks()
private Map<Long, Snack> loadSnacks(List<ComboItemRequest> items) {
    List<Long> snackIds = items.stream()
            .map(ComboItemRequest::getSnackId)
            .distinct()
            .toList();

    List<Snack> snacks = snackRepository.findAllById(snackIds);

    if (snacks.size() != snackIds.size()) {
        throw new BusinessException(ErrorCode.NOT_FOUND, "Một hoặc nhiều snack không tồn tại");
    }

    return snacks.stream().collect(Collectors.toMap(Snack::getId, s -> s));
}
```

Vì sao quan trọng?

```
❌ Bad: Loop từng snackId, mỗi cái 1 query
  for (item : items) {
      Snack s = snackRepository.findById(item.getSnackId())...;  // N queries
  }

✅ Good: Batch fetch 1 query với WHERE IN
  findAllById([1, 3, 5, 7]) → SELECT * FROM snacks WHERE id IN (1,3,5,7)
```

Combo có 5 items → tiết kiệm từ 5 query xuống 1 query (gấp 5 lần).

### Validation cascade với `@Valid`

```java
// ComboRequest.java
@Valid                                                       // ← cascade validation
@NotEmpty(message = "Combo phải có ít nhất 1 snack")
private List<ComboItemRequest> items;
```

Khi controller có `@Valid @RequestBody ComboRequest`:
- `code` được validate `@NotBlank`, `@Pattern`
- `price` được validate `@DecimalMin`
- `items` được validate `@NotEmpty`
- **Vì có `@Valid` ở field items** → mỗi `ComboItemRequest` trong list cũng được validate (`@NotNull snackId`, `@Min(1) quantity`)

Không có `@Valid` thì item nested KHÔNG được validate → bug khó tìm.

### Business rule: cấm đổi code khi update

```java
if (!combo.getCode().equals(request.getCode())) {
    throw new BusinessException(ErrorCode.INVALID_REQUEST,
            "Không thể đổi mã combo — vui lòng tạo combo mới");
}
```

Lý do:
- `code` là **business primary key** — POS / báo cáo / khách hàng nhớ mã này
- Đổi `COMBO-ROMANCE` thành `COMBO-LOVE` → kế toán không hiểu báo cáo
- → Nếu cần đổi code → archive combo cũ + tạo combo mới

Đây là pattern phổ biến: **technical PK** (id auto-increment) ≠ **business PK** (code do người đặt, ổn định).

### Compute `regularPrice` trong response

```java
BigDecimal regularPrice = combo.getItems().stream()
        .map(i -> i.getSnack().getPrice().multiply(BigDecimal.valueOf(i.getQuantity())))
        .reduce(BigDecimal.ZERO, BigDecimal::add);
```

Reduce từ list snack:
- Bắp lớn `60.000đ` × 2 = `120.000đ`
- Coca lớn `40.000đ` × 2 = `80.000đ`
- → `regularPrice = 200.000đ`

FE so với `combo.price = 159.000đ` → tiết kiệm `41.000đ`.

> **Tại sao tính ở BE, không tính ở FE?**
>
> FE đã có thông tin để tính (snack.price + quantity), nhưng:
> - **Đồng nhất:** Public API trả `regularPrice` → FE chỉ display, không tính logic
> - **Cache friendly:** Nếu FE cache combo → cache luôn cả `regularPrice`, không phải tính lại
> - **Mobile-friendly:** App mobile dùng cùng API, không phải duplicate logic

---

## 7. EntityGraph chống N+1

### N+1 problem là gì?

Giả sử có **20 combos**, mỗi combo có **3 items**, mỗi item ref **1 snack**.

```java
// Không có EntityGraph, fetch lazy mặc định
List<Combo> combos = comboRepository.findAll();      // Query 1

for (Combo c : combos) {
    System.out.println(c.getName());                 // OK, đã có
    for (ComboItem i : c.getItems()) {               // Query +1 (lazy load items)
        System.out.println(i.getSnack().getName());  // Query +1 (lazy load snack)
    }
}
```

Tổng số query:
```
1 (list combos)
+ 20 (lazy load items mỗi combo)
+ 60 (lazy load snack mỗi item: 20 × 3)
= 81 queries
```

→ 1 request /api/combos → DB nhận 81 query. Production load 100 RPS → 8100 query/s → DB chết.

### EntityGraph — fix bằng 1 dòng

```java
// ComboRepository.java
@EntityGraph(attributePaths = {"items", "items.snack"})
@Override
Optional<Combo> findById(Long id);

@EntityGraph(attributePaths = {"items", "items.snack"})
List<Combo> findByActiveTrueAndStorageStateNotOrderByPriceAsc(StorageState excludeState);
```

JPA sinh ra:

```sql
SELECT c.*, ci.*, s.*
FROM combos c
LEFT JOIN combo_items ci ON ci.combo_id = c.id
LEFT JOIN snacks s ON s.id = ci.snack_id
WHERE c.active = 1 AND c.storage_state != 'ARCHIVED'
ORDER BY c.price ASC;
```

→ Chỉ **1 query** load hết. 81 → 1, x81 lần nhanh hơn.

### Trade-off của EntityGraph

| Hoàn cảnh | Có EntityGraph | Không EntityGraph |
|---|---|---|
| Cần items + snack | ✅ 1 query | ❌ N+1 query |
| Chỉ cần combo metadata | ⚠ Vẫn JOIN (waste) | ✅ 1 query nhẹ |

→ EntityGraph dùng cho **method đặc thù**, không bật toàn cục. CineX bật cho `findById` (admin xem chi tiết) và `findByActiveTrue...` (public list), KHÔNG bật cho `findAll(pageable)` (admin list có thể có flag để bật/tắt fetch items).

---

## 8. FE useFieldArray Pattern — form động kiểu pro

### Bài toán: form danh sách item số lượng thay đổi

Khi admin tạo combo, không biết trước có bao nhiêu snacks (1, 2, 5, 10...). Form phải:
- Render N rows (mỗi row = 1 snack + qty)
- Có nút **+ Thêm snack** để append row
- Có nút **xóa** mỗi row
- Validate từng row
- Submit cả mảng items

### Cách 1 (manual) — quản state thuần React

```tsx
const [items, setItems] = useState([{ snackId: '', quantity: 1 }])

function addItem() {
  setItems([...items, { snackId: '', quantity: 1 }])
}

function removeItem(index) {
  setItems(items.filter((_, i) => i !== index))
}

function updateItem(index, field, value) {
  setItems(items.map((item, i) =>
    i === index ? { ...item, [field]: value } : item
  ))
}

// Validation thủ công
function validate() {
  const errors = items.map(i => ({
    snackId: !i.snackId ? 'Required' : null,
    quantity: i.quantity < 1 ? 'Min 1' : null,
  }))
  return errors
}
```

→ Vấn đề:
- Code dài, dễ sai khi update item index
- Validation phải tự build, không tích hợp react-hook-form
- Re-render toàn bộ list khi 1 field thay đổi (performance)

### Cách 2 (CineX) — useFieldArray

```tsx
import { useForm, useFieldArray } from 'react-hook-form'

const { register, control, handleSubmit, watch } = useForm<FormData>({
  defaultValues: { items: [{ snackId: '', quantity: 1 }] },
})

const { fields, append, remove } = useFieldArray({
  control,
  name: 'items',                                         // tên field trong FormData
})
```

Render:

```tsx
{fields.map((field, index) => (
  <div key={field.id} className="grid grid-cols-12 gap-2">
    <select {...register(`items.${index}.snackId`, { required: true, valueAsNumber: true })}>
      <option value="">-- Chọn snack --</option>
      {snacks.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
    <Input type="number" {...register(`items.${index}.quantity`, { required: true, min: 1 })} />
    <Button onClick={() => remove(index)}>Xóa</Button>
  </div>
))}

<Button onClick={() => append({ snackId: '', quantity: 1 })}>+ Thêm snack</Button>
```

### API useFieldArray

| Method | Tác dụng | Ví dụ |
|---|---|---|
| `fields` | Array hiện tại để map render | `fields.map((f, i) => ...)` |
| `append(value)` | Thêm cuối | `append({ snackId: '', quantity: 1 })` |
| `prepend(value)` | Thêm đầu | hiếm dùng |
| `remove(index)` | Xóa theo index | `remove(2)` |
| `move(from, to)` | Đổi vị trí (drag-drop) | hiếm dùng cho combo |
| `update(index, value)` | Update toàn bộ row | hiếm dùng |

### Magic của `field.id`

```tsx
{fields.map((field, index) => (
  <div key={field.id}>...</div>     // KEY là field.id (react-hook-form tự gen UUID)
))}
```

KHÔNG dùng `key={index}` vì khi remove giữa danh sách → key shift → React render sai (mất focus, sai state).

### Live preview calculation

```tsx
const watchedItems = watch('items')      // reactive, re-render khi items thay đổi
const watchedPrice = watch('price')

const regularPrice = watchedItems.reduce((sum, item) => {
  const snack = snacks.find(s => s.id === Number(item.snackId))
  return sum + (snack?.price ?? 0) * Number(item.quantity ?? 0)
}, 0)

const savings = regularPrice - Number(watchedPrice ?? 0)
```

Render:

```tsx
<div className="rounded-xl bg-[#2a2317]/40 p-3">
  <span>Tổng giá nếu mua lẻ:</span>
  <div>{formatVnd(regularPrice)}</div>

  {savings > 0 && watchedPrice > 0 && (
    <div className="text-green-400">Combo tiết kiệm {formatVnd(savings)}</div>
  )}
  {savings < 0 && watchedPrice > 0 && (
    <div className="text-red-400">⚠ Combo đắt hơn mua lẻ {formatVnd(-savings)}</div>
  )}
</div>
```

Pattern này gọi là **"computed values"** — derived từ form state, tự update khi form thay đổi. UX tuyệt vời cho admin:
- Đổi qty bắp từ 2 → 3 → thấy ngay "Tiết kiệm tăng từ 41k → 71k"
- Nhập giá combo = 250k mà tổng snack chỉ 200k → cảnh báo "Combo đắt hơn mua lẻ" ngay lập tức (admin nhập sai sẽ thấy)

### Sơ đồ luồng

```
User type "qty = 3" trong input
  │
  ▼
react-hook-form watch('items') trigger re-render
  │
  ▼
watchedItems = [{snackId: 1, qty: 3}, ...]   ← reactive
  │
  ▼
regularPrice = reduce(items) = SUM(snack.price × qty)
  │
  ▼
savings = regularPrice - watchedPrice
  │
  ▼
JSX render "Tiết kiệm Xk" hoặc "Đắt hơn Yk"
```

---

## 9. SQL được sinh ra

### CREATE combo

```sql
-- 1. INSERT vào combos (parent)
INSERT INTO combos (code, name, description, image_url, price, active, version, storage_state, created_at, created_by)
VALUES ('COMBO-ROMANCE', 'Combo Romance', '2 bắp + 2 nước', 'https://...', 159000, 1, 0, 'ACTIVE', GETDATE(), 'admin');
-- combo.id = 5

-- 2. Cascade PERSIST → batch INSERT combo_items
INSERT INTO combo_items (combo_id, snack_id, quantity) VALUES (5, 1, 2);
INSERT INTO combo_items (combo_id, snack_id, quantity) VALUES (5, 3, 2);
```

### UPDATE combo (Replace pattern)

```sql
-- 1. Load combo + items (EntityGraph JOIN FETCH)
SELECT c.*, ci.*, s.*
FROM combos c
LEFT JOIN combo_items ci ON ci.combo_id = c.id
LEFT JOIN snacks s ON s.id = ci.snack_id
WHERE c.id = 5;

-- 2. orphanRemoval xóa items cũ (sau clear() trong code)
DELETE FROM combo_items WHERE id = 17;
DELETE FROM combo_items WHERE id = 18;

-- 3. UPDATE combo (kèm version check)
UPDATE combos
SET name = 'Combo Romance Plus', price = 179000, version = 1
WHERE id = 5 AND version = 0;

-- 4. INSERT items mới
INSERT INTO combo_items (combo_id, snack_id, quantity) VALUES (5, 1, 2);
INSERT INTO combo_items (combo_id, snack_id, quantity) VALUES (5, 3, 2);
INSERT INTO combo_items (combo_id, snack_id, quantity) VALUES (5, 7, 1);
```

### DELETE combo (cứng — không phải soft archive)

```sql
-- Cascade từ DB FK ON DELETE CASCADE
DELETE FROM combos WHERE id = 5;
-- Tự động → DELETE FROM combo_items WHERE combo_id = 5;
```

---

## 10. Request/Response mẫu

### Tạo combo

```bash
curl -X POST http://localhost:8088/api/combos \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "code": "COMBO-ROMANCE",
    "name": "Combo Romance",
    "description": "2 bắp lớn + 2 nước Coca lớn",
    "imageUrl": "https://res.cloudinary.com/cinex/image/upload/combo-romance.jpg",
    "price": 159000,
    "active": true,
    "items": [
      { "snackId": 1, "quantity": 2 },
      { "snackId": 3, "quantity": 2 }
    ]
  }'
```

Response (201):

```json
{
  "code": "OK",
  "message": "Tạo combo thành công",
  "data": {
    "id": 5,
    "storageState": "ACTIVE",
    "code": "COMBO-ROMANCE",
    "name": "Combo Romance",
    "description": "2 bắp lớn + 2 nước Coca lớn",
    "imageUrl": "https://res.cloudinary.com/cinex/image/upload/combo-romance.jpg",
    "price": 159000,
    "active": true,
    "items": [
      {
        "id": 17,
        "snackId": 1,
        "snackName": "Bắp lớn",
        "snackImageUrl": "https://...",
        "snackPrice": 60000,
        "quantity": 2
      },
      {
        "id": 18,
        "snackId": 3,
        "snackName": "Coca lớn",
        "snackImageUrl": "https://...",
        "snackPrice": 40000,
        "quantity": 2
      }
    ],
    "regularPrice": 200000,
    "createdAt": "2026-06-09T09:30:00",
    "updatedAt": "2026-06-09T09:30:00"
  }
}
```

→ FE tính: `savings = 200000 - 159000 = 41000` → hiển thị "Tiết kiệm 41.000đ".

### List combo public (cho POS / booking add-on)

```bash
curl http://localhost:8088/api/combos/public
```

Response:

```json
{
  "code": "OK",
  "data": [
    {
      "id": 5,
      "code": "COMBO-ROMANCE",
      "name": "Combo Romance",
      "price": 159000,
      "regularPrice": 200000,
      "items": [...]
    },
    {
      "id": 6,
      "code": "COMBO-FAMILY",
      "name": "Combo Family",
      "price": 299000,
      "regularPrice": 400000,
      "items": [...]
    }
  ]
}
```

→ Sort theo `price ASC` (rẻ trước, đắt sau).

### Archive (soft delete)

```bash
curl -X DELETE http://localhost:8088/api/combos/5 \
  -H "Authorization: Bearer eyJhbGc..."
```

```json
{
  "code": "OK",
  "message": "Đã lưu trữ combo"
}
```

→ DB chỉ set `storage_state = 'ARCHIVED'`, KHÔNG xóa thật. Endpoint public không trả combo này nữa.

### Error: code đã tồn tại

```bash
# Tạo trùng code
curl -X POST http://localhost:8088/api/combos -d '{"code": "COMBO-ROMANCE", ...}'
```

```json
{
  "code": "INVALID_REQUEST",
  "message": "Mã combo đã tồn tại: COMBO-ROMANCE",
  "data": null
}
```

### Error: snackId không tồn tại

```json
{
  "code": "NOT_FOUND",
  "message": "Một hoặc nhiều snack không tồn tại",
  "data": null
}
```

### Error: validation fail

```json
{
  "code": "VALIDATION_FAILED",
  "data": {
    "code": "Mã chỉ chữ hoa, số, gạch ngang",
    "items[0].quantity": "Số lượng phải ít nhất 1",
    "items": "Combo phải có ít nhất 1 snack"
  }
}
```

---

## 11. Câu hỏi tự kiểm tra

### Câu 1 — Tại sao `ComboItem` KHÔNG extends `BaseEntity`?

> Vì ComboItem là **junction entity lightweight** trong relationship Composition. Life cycle của nó hoàn toàn theo combo cha:
> - Không cần `version` (update combo = replace toàn bộ items, không concurrency conflict)
> - Không cần `storageState` (xóa combo = xóa hết items, không có "soft delete" riêng cho item)
> - Không cần `createdAt`/`createdBy` (audit ở mức combo cha là đủ)
>
> Junction entity nên là minimal — chỉ giữ FK + metadata (quantity). Thêm BaseEntity sẽ thừa cột, thừa logic.

### Câu 2 — Nếu xóa Snack đang được dùng trong combo, có lỗi không?

> **Có lỗi.** FK `fk_combo_items_snack` (snack_id) **KHÔNG** có `ON DELETE CASCADE`. Khi `DELETE FROM snacks WHERE id = 3`, DB sẽ throw FK constraint violation.
>
> Đây là **chủ ý**: snack đang bán trong combo mà mất → combo bán xong không có gì để giao cho khách. Nên CineX dùng `soft delete` cho snack (`storageState = ARCHIVED`) thay vì hard delete. Khi snack archived, vẫn còn trong DB → combo vẫn link được, chỉ là không bán snack đơn lẻ nữa.

### Câu 3 — Nếu set `orphanRemoval = false` trong `Combo.items`, `update()` có vấn đề gì?

> `combo.getItems().clear()` chỉ remove khỏi collection trong memory, JPA sẽ **KHÔNG** xóa khỏi DB. Items cũ vẫn nằm lì trong `combo_items` với `combo_id` = combo đang update.
>
> Khi add items mới + save → DB có 2 set items (cũ orphan + mới). Sau đó `findById(id)` load lại sẽ thấy items "ma" → bug nặng.
>
> Fix: hoặc bật `orphanRemoval=true`, hoặc tự `comboItemRepository.deleteByComboId(id)` trước khi add mới (manual).

### Câu 4 — Nếu bỏ `@EntityGraph` ở `findByActiveTrue...`, gọi `/api/combos/public` với 50 combos sẽ tốn bao nhiêu query?

> ```
> 1 (list combos)
> + 50 (lazy load items mỗi combo, mỗi cái 1 query)
> + ~200 (giả sử mỗi combo có ~4 snacks → 4 × 50 = 200 lazy load snack)
> = ~251 queries
> ```
> Với EntityGraph: **1 query** dùng LEFT JOIN. Tăng performance hơn **250 lần**.

### Câu 5 — Tại sao Combo dùng `@OneToMany` thay vì `@ManyToMany` với Snack?

> Vì cần lưu **metadata `quantity`** trong bảng nối (combo_items). `@ManyToMany` chỉ tự tạo bảng nối với 2 cột FK (combo_id, snack_id) — không thể thêm cột `quantity` được.
>
> Khi có metadata → bắt buộc tách thành **junction entity riêng** (ComboItem) + `@OneToMany` từ Combo + `@ManyToOne` từ ComboItem ngược lại tới cả Combo và Snack.
>
> So sánh trong CineX:
> - `Movie ↔ Genre` (KHÔNG metadata) → dùng `@ManyToMany` + bảng `movie_genres` (chỉ 2 cột FK)
> - `Combo ↔ Snack` (CÓ quantity) → dùng junction entity + `@OneToMany`

### Câu 6 — `useFieldArray` đang dùng `key={field.id}`. Nếu đổi thành `key={index}` thì sao?

> React sẽ nhầm khi `remove(index)` ở giữa danh sách:
> - Trước remove: items = [A(key=0), B(key=1), C(key=2)]
> - Sau `remove(1)`: items = [A(key=0), C(key=1)]
> - React thấy "key=1 vẫn còn" → KHÔNG re-render row 1 → input vẫn hiển thị data của B (thực tế đã thành C)
> - Mất focus, sai state, có thể submit nhầm
>
> `field.id` là UUID tự sinh, **stable** — remove giữa list không bị shift. Quy tắc chung: trong list dynamic, luôn dùng stable ID làm key, không bao giờ dùng index.

### Câu 7 — Tại sao tính `regularPrice` ở BE thay vì FE?

> 1. **Đồng nhất:** Mọi client (web, mobile, POS) gọi cùng API → cùng `regularPrice`. Nếu để FE tính, mỗi platform phải duplicate logic → dễ lệch (web hiển thị 200k, mobile hiển thị 195k vì bug)
> 2. **Cache-friendly:** Server cache combo response → cache luôn `regularPrice`. FE không phải re-compute mỗi render
> 3. **Source of truth:** BE đã có snack.price, biết quantity → tính một lần ở BE rồi gửi xuống là single source. FE chỉ display.
>
> Exception: FE **vẫn tính lại** trong form admin (live preview) — đó là cho UX nhập liệu, không phải source of truth.
