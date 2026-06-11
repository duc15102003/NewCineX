# Multi-Tenant Pattern trong CineX — Giải thích chi tiết

> Tài liệu này giải thích **toàn bộ** cách CineX quản lý dữ liệu đa chi nhánh (multi-tenant) — chuẩn industry rạp chiếu (Vista Cinema, CGV, AMC). Đọc xong em sẽ hiểu khi nào dùng SHARED, khi nào PER-THEATER, khi nào HYBRID + cách viết migration, service guard, FE scope.

---

## 1. Bối cảnh: tại sao multi-tenant phức tạp?

Một chuỗi rạp như CGV có **80+ chi nhánh** trên cả nước. Mỗi chi nhánh:
- Có phòng chiếu vật lý riêng
- Có nhân viên riêng (thu ngân, kỹ thuật)
- Có thể có giá vé khác nhau (HN vs Vĩnh Long)
- Có thể có menu snack khác nhau (đặc sản từng vùng)
- Phát hành phim cũng có thể chậm sớm khác nhau

Nhưng cùng lúc, **toàn bộ chuỗi share**:
- Catalog phim (Avatar 3 = 1 metadata duy nhất cho cả chuỗi)
- Voucher chiến dịch marketing toàn quốc
- Một số quy tắc giá nền

→ Hệ thống phải biết phân biệt **dữ liệu chung** vs **dữ liệu riêng** ngay từ schema.

---

## 2. Ba pattern scope

| Pattern | Schema | Khi nào dùng |
|---|---|---|
| **SHARED** | KHÔNG có `theater_id` | Catalog bất biến toàn chuỗi (Movie, Genre, Review) |
| **PER-THEATER (NOT NULL)** | `theater_id BIGINT NOT NULL` | Tài sản vận hành 1 rạp (Room, Snack, Combo, MovieRun) |
| **HYBRID (NULLABLE)** | `theater_id BIGINT NULLABLE` — NULL = global, NOT NULL = override | Có default toàn hệ NHƯNG cho phép từng rạp override (Voucher, PricingRule) |

### So sánh đời thường

- **SHARED** ≈ giáo trình toàn quốc — mọi trường đều dùng chung 1 bản
- **PER-THEATER** ≈ thời khóa biểu trường — mỗi trường có 1 cái riêng
- **HYBRID** ≈ chính sách học bổng — bộ giáo dục có default, mỗi trường có thể override

### Map CineX hiện tại

```
SHARED (9 entities):
  Movie, Genre, Review, UserFavorite, SystemConfig,
  AuditLog, LoyaltyTier, IdTracker, FavoriteMovie

PER-THEATER (6 entities — direct FK theater_id):
  Room, Snack, Combo, SnackOrder, MovieRun
  + Theater (root)

HYBRID (2 entities — NULLABLE theater_id):
  Voucher, PricingRule

DERIVED (qua chain FK — không có theater_id trực tiếp):
  Seat → Room.theater
  Showtime → Room.theater
  Booking → Showtime.room.theater
  Payment → Booking.showtime.room.theater
  BookingSeat, VoucherUsage, LoyaltyTransaction, etc.

OPTIONAL-THEATER:
  User (NULL = customer + SUPER_ADMIN; NOT NULL = branch ADMIN)
```

---

## 3. Pattern A — SHARED (KHÔNG có theater_id)

### Khi nào dùng

Dữ liệu là **danh tính bất biến** thuộc về **toàn chuỗi**, không phụ thuộc rạp nào:
- Movie (Avatar = Avatar dù bán ở rạp nào)
- Genre (Hành động, Tình cảm,... cố định)
- Review (user review phim, không review rạp)
- AuditLog (lịch sử toàn hệ, ai cũng có thể audit)

### Schema mẫu (Movie)

```java
@Entity
@Table(name = "movies")
public class Movie extends BaseEntity {
    @Column(nullable = false, length = 200)
    private String title;
    
    @Column(nullable = false)
    private Integer duration;  // phút
    
    @Column(length = 200)
    private String director;
    
    // KHÔNG có theater_id — phim là tài sản chung
}
```

### Service không cần scope

```java
@Service
public class MovieService {
    public Page<MovieResponse> listMovies(MovieFilter filter, Pageable pageable) {
        // Branch ADMIN cũng thấy được mọi phim (catalog chung)
        return movieRepository.findAll(spec, pageable).map(movieMapper::toResponse);
    }
}
```

---

## 4. Pattern B — PER-THEATER (NOT NULL)

### Khi nào dùng

Dữ liệu là **tài sản vận hành** của 1 rạp cụ thể, **không thể** thuộc về nhiều rạp:
- Room (phòng chiếu vật lý — chỉ ở 1 rạp)
- Snack (menu snack riêng theo rạp — CGV HN khác CGV HCM)
- Combo (bundle snack theo menu rạp)
- SnackOrder (đơn POS thuộc 1 quầy bán hàng = 1 rạp)
- MovieRun (đợt chiếu — mỗi rạp tự quyết startDate/endDate)

### Schema mẫu (Snack)

```java
@Entity
@Table(name = "snacks")
public class Snack extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "theater_id", nullable = false)
    private Theater theater;
    
    @Column(nullable = false, length = 100)
    private String name;
    
    @Column(nullable = false, precision = 12, scale = 0)
    private BigDecimal price;
}
```

### Migration pattern 3-bước (snack)

```xml
<!-- Step 1: Add column NULLABLE -->
<changeSet id="061-add-snack-theater-id-column">
    <addColumn tableName="snacks">
        <column name="theater_id" type="BIGINT"/>
    </addColumn>
</changeSet>

<!-- Step 2: Backfill — gán mọi row hiện có về 1 theater default -->
<changeSet id="061-backfill-snack-theater">
    <sql>
        UPDATE snacks
        SET theater_id = (SELECT TOP 1 id FROM theaters WHERE code = 'CNX-DEFAULT')
        WHERE theater_id IS NULL;
    </sql>
</changeSet>

<!-- Step 3: NOT NULL + FK + index -->
<changeSet id="061-snack-theater-not-null-fk">
    <addNotNullConstraint tableName="snacks" columnName="theater_id" columnDataType="BIGINT"/>
    <addForeignKeyConstraint baseTableName="snacks" baseColumnNames="theater_id"
                             referencedTableName="theaters" referencedColumnNames="id"
                             constraintName="fk_snacks_theater_id"/>
    <createIndex tableName="snacks" indexName="idx_snacks_theater_id">
        <column name="theater_id"/>
    </createIndex>
</changeSet>
```

**Tại sao 3-bước?** Nếu ALTER TABLE ... ADD COLUMN ... NOT NULL ngay → fail vì rows cũ chưa có giá trị. Phải:
1. Thêm cột NULLABLE → không fail
2. UPDATE backfill mọi rows → ai cũng có giá trị
3. ALTER NOT NULL → fail safe

### Service auto-scope branch ADMIN

```java
@Transactional(readOnly = true)
public Page<SnackResponse> listSnacksAdmin(SnackFilter filter, Pageable pageable) {
    // [Multi-tenant key] Branch ADMIN: ép theaterId từ JWT
    Long scopedTheaterId = securityService.getCurrentUserTheaterId();
    if (scopedTheaterId != null) {
        filter.setTheaterId(scopedTheaterId);  // override request input
    }
    // SUPER_ADMIN: scopedTheaterId == null → không filter → thấy mọi rạp
    return snackRepository.findAll(SnackSpecification.fromFilter(filter), pageable)
            .map(snackMapper::toResponse);
}
```

→ **Branch ADMIN không thể vô tình hay cố ý xem snack của rạp khác** — vì service override request.

### Cross-resource guard

Khi update/delete/upload-image cho snack:

```java
@Transactional
public SnackResponse updateSnack(Long id, SnackRequest request) {
    Snack snack = snackRepository.findById(id)
            .orElseThrow(() -> new BusinessException(ErrorCode.SNACK_NOT_FOUND));
    
    // [Guard] Branch ADMIN không sửa được snack của rạp khác
    securityService.requireAccessToTheater(snack.getTheater().getId());
    
    snack.setName(request.getName());
    // ... chỉ cho đổi field thường, KHÔNG cho đổi theater
}
```

### Cross-theater snack guard (Combo example)

Combo chỉ chứa snack cùng theater:

```java
private Map<Long, Snack> loadSnacks(List<ComboItemRequest> items, Long expectedTheaterId) {
    List<Long> snackIds = items.stream().map(ComboItemRequest::getSnackId).toList();
    List<Snack> snacks = snackRepository.findAllById(snackIds);
    
    for (Snack s : snacks) {
        if (!s.getTheater().getId().equals(expectedTheaterId)) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                "Snack '" + s.getName() + "' không thuộc chi nhánh của combo");
        }
    }
    return snacks.stream().collect(Collectors.toMap(Snack::getId, s -> s));
}
```

→ Chống admin HN nhỡ tay tạo combo có snack HCM.

---

## 5. Pattern C — HYBRID (NULLABLE theater_id)

### Khi nào dùng

Khi industry có:
- **Default chung toàn hệ** mà 90% rạp dùng (tiết kiệm setup)
- **+ override theo rạp** cho 10% rạp đặc thù (HN cao cấp, vùng quê rẻ)

Ví dụ:
- **Voucher**: `SUMMER2026` global cho toàn hệ + `AEON_HCM_OPENING` riêng AEON HCM
- **PricingRule**: weekend +20% global default + weekend +30% riêng CGV Royal HN

### Schema mẫu (Voucher)

```java
@Entity
@Table(name = "vouchers")
public class Voucher extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "theater_id")  // NULLABLE — không có nullable=false
    private Theater theater;
    
    @Column(nullable = false, length = 30)
    private String code;
    // ...
}
```

### Filtered Unique Index — đặc biệt SQL Server

Vì code có thể trùng giữa global vs theater-specific (VD `WELCOME10` global + `WELCOME10` riêng theater A), unique constraint thông thường `UNIQUE(code)` sẽ fail. Cần **filtered unique index**:

```xml
<!-- 2 index riêng cho 2 scope -->
<changeSet id="064-create-voucher-global-unique">
    <sql>
        CREATE UNIQUE INDEX uq_voucher_global_code
        ON vouchers(code)
        WHERE theater_id IS NULL    -- chỉ áp khi global
    </sql>
</changeSet>

<changeSet id="064-create-voucher-theater-unique">
    <sql>
        CREATE UNIQUE INDEX uq_voucher_theater_code
        ON vouchers(code, theater_id)
        WHERE theater_id IS NOT NULL  -- chỉ áp khi theater-specific
    </sql>
</changeSet>
```

Kết quả:
- `WELCOME10` global → unique trong scope global (chỉ 1 cái)
- `WELCOME10` ở theater 5 → unique trong scope (theater 5, code)
- 2 cái cùng tồn tại được — vì chúng ở 2 scope khác nhau

### Resolution rule — Theater-specific WIN

Khi user nhập `WELCOME10` tại theater 5:

```java
private Voucher resolveVoucherByCode(String code, Long theaterId) {
    // Bước 1: tìm theater-specific TRƯỚC
    if (theaterId != null) {
        var specific = voucherRepository.findFirstByCodeAndTheaterId(code, theaterId);
        if (specific.isPresent()) return specific.get();  // → ưu tiên
    }
    // Bước 2: fallback global
    return voucherRepository.findFirstByCodeAndTheaterIsNull(code).orElse(null);
}
```

→ Pattern **"more specific wins"** chuẩn industry (như CSS, như AWS IAM).

### Validate + reject cross-theater

```java
public ValidateVoucherResponse validateVoucher(String code, BigDecimal amount, 
                                                Long userId, Long bookingTheaterId) {
    Voucher voucher = resolveVoucherByCode(code, bookingTheaterId);
    
    if (voucher == null) {
        // Voucher KHÔNG tồn tại ở scope nào áp được
        if (voucherRepository.existsByCode(code)) {
            // Tồn tại nhưng ở theater khác → reject rõ ràng
            return invalid("Voucher không áp dụng cho chi nhánh hiện tại");
        }
        return invalid("Mã voucher không tồn tại");
    }
    // ... check active, expired, usage limit, etc.
}
```

→ User nhận message **rõ ràng** thay vì chung chung "không hợp lệ".

### Pricing Engine — Override resolution

Pricing phức tạp hơn vì rule có CODE và rule cùng code thì override:

```java
public BigDecimal applyModifiers(BigDecimal basePrice, LocalDateTime showtimeStart, Long theaterId) {
    // Step 1: filter rules có scope phù hợp
    List<PricingRule> applicable = activeRules.stream()
        .filter(r -> r.getTheater() == null  // global rules
                  || (theaterId != null && theaterId.equals(r.getTheater().getId())))  // hoặc theater-specific
        .filter(r -> PricingRuleMatcher.matches(r, showtimeStart))
        .toList();

    // Step 2: override resolution — same code → theater-specific WIN
    Map<String, PricingRule> effective = new LinkedHashMap<>();
    for (PricingRule rule : applicable) {
        PricingRule existing = effective.get(rule.getCode());
        if (existing == null) {
            effective.put(rule.getCode(), rule);
        } else if (existing.getTheater() == null && rule.getTheater() != null) {
            // Replace global bằng theater-specific
            effective.put(rule.getCode(), rule);
        }
    }

    // Step 3: chain multiplier (different code → all stack)
    BigDecimal total = basePrice;
    for (PricingRule rule : effective.values()) {
        BigDecimal ratio = rule.getMultiplierPercent().divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP);
        total = total.multiply(ratio);
    }
    return total.setScale(0, RoundingMode.HALF_UP);
}
```

VD theater 5 có rule `WEEKEND +30%` override, global có `WEEKEND +20%` + `PRIME-TIME +15%`:
- Tại theater 5: dùng `WEEKEND +30%` (override) + `PRIME-TIME +15%` (kế thừa) → 1.30 × 1.15
- Tại theater khác: dùng `WEEKEND +20%` + `PRIME-TIME +15%` → 1.20 × 1.15

---

## 6. Pattern D — Cross-Product Backfill (MovieRun đặc biệt)

MovieRun là case **khó nhất** vì chuyển từ shared → per-theater **CÓ DATA hiện hữu**. Phải nhân bản cross-product.

### 5-step migration

```xml
<!-- Step 1: Add column NULLABLE -->
<changeSet id="066-add-movie-run-theater-id-column">
    <addColumn tableName="movie_runs">
        <column name="theater_id" type="BIGINT"/>
    </addColumn>
</changeSet>

<!-- Step 2: Cross-product — mỗi run global × mỗi theater = new row per-theater -->
<changeSet id="066-cross-product-movie-runs">
    <sql>
        INSERT INTO movie_runs (movie_id, theater_id, start_date, end_date, run_type, ...)
        SELECT mr.movie_id, t.id, mr.start_date, mr.end_date, mr.run_type, ...
        FROM movie_runs mr
        CROSS JOIN theaters t
        WHERE mr.theater_id IS NULL;
    </sql>
</changeSet>

<!-- Step 3: Remap showtimes — chuyển FK từ old global → new per-theater theo room.theater -->
<changeSet id="066-remap-showtime-movie-run-id">
    <sql>
        UPDATE st SET st.movie_run_id = new_mr.id
        FROM showtimes st
        INNER JOIN rooms r ON r.id = st.room_id
        INNER JOIN movie_runs old_mr ON old_mr.id = st.movie_run_id AND old_mr.theater_id IS NULL
        INNER JOIN movie_runs new_mr
            ON new_mr.movie_id = old_mr.movie_id
           AND new_mr.theater_id = r.theater_id
           AND new_mr.start_date = old_mr.start_date
           AND new_mr.run_type = old_mr.run_type;
    </sql>
</changeSet>

<!-- Step 4: Delete orphan old global rows -->
<changeSet id="066-delete-global-movie-runs">
    <sql>DELETE FROM movie_runs WHERE theater_id IS NULL</sql>
</changeSet>

<!-- Step 5: NOT NULL + FK + unique -->
<changeSet id="066-movie-run-theater-not-null-fk">
    <addNotNullConstraint .../>
    <addForeignKeyConstraint .../>
</changeSet>
```

### Showtime cross-theater guard

```java
private MovieRun resolveMovieRun(Movie movie, Long requestedRunId, Long roomTheaterId) {
    if (requestedRunId != null) {
        MovieRun run = movieRunRepository.findById(requestedRunId)...;
        
        // Cross-theater guard
        if (!run.getTheater().getId().equals(roomTheaterId)) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                "Đợt chiếu không thuộc chi nhánh của phòng đã chọn");
        }
        return run;
    }
    
    // Auto-pick: filter theo theater của phòng
    return movieRunRepository
        .findByMovieIdAndTheaterIdAndStorageStateNotOrderByStartDateDesc(
            movie.getId(), roomTheaterId, StorageState.ARCHIVED)
        .stream()
        // ... ưu tiên NOW_SHOWING, fallback SCHEDULED
        .findFirst().orElseThrow(...);
}
```

---

## 7. Pattern FE — Multi-tenant UI

### `adminTheaterStore` (Zustand)

```typescript
// frontend/src/store/adminTheaterStore.ts
interface AdminTheaterStore {
  currentTheater: Theater | null  // null = SUPER_ADMIN xem "Tất cả"
  setCurrentTheater: (t: Theater | null) => void
}
```

→ Dropdown chi nhánh ở top-bar admin update store này. Mọi admin page consume.

### Scope resolution pattern

```typescript
const { currentTheater: adminTheater } = useAdminTheaterStore()
const { user, isBranchAdmin } = useAuthStore()
const userTheaterId = user?.theaterId ?? null
const scopedTheaterId = adminTheater?.id ?? (isBranchAdmin() ? userTheaterId : null)
const branchLocked = isBranchAdmin()
```

→ Branch admin: **luôn** scopedTheaterId = userTheaterId, không cho đổi.
→ SUPER_ADMIN: scopedTheaterId từ dropdown (có thể null = "Tất cả").

### Grouped view khi xem "Tất cả"

```typescript
const showGrouped = !adminTheater && !branchLocked
const groupedItems = useMemo(
  () => (showGrouped ? groupByTheater(items as any) : null),
  [items, showGrouped],
)

// Render
{showGrouped && groupedItems?.map(group => (
  <React.Fragment key={group.theaterId}>
    <TheaterGroupHeaderRow ... />
    {group.items.map(renderRow)}
  </React.Fragment>
))}
```

### Form với scope radio (Hybrid pattern)

```tsx
{/* Voucher / PricingRule có scope radio */}
<div className="grid grid-cols-2 gap-2">
  <label>
    <input type="radio" value="GLOBAL" {...register('scope')} 
           disabled={branchLocked || !!editingItem} />
    <Globe2 /> Toàn hệ thống
  </label>
  <label>
    <input type="radio" value="THEATER" {...register('scope')} 
           disabled={!!editingItem} />
    <Building2 /> Chi nhánh cụ thể
  </label>
</div>

{watchedScope === 'THEATER' && (
  <select {...register('theaterId')} disabled={branchLocked}>
    {theaters.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
  </select>
)}
```

### Chained dropdown (Per-theater pattern)

```tsx
{/* Combo form: theater select → snack list filter theo theater */}
const watchedTheaterId = watch('theaterId')
const { data: snacks } = useSnacksOptions(watchedTheaterId)  // hook enabled khi có theaterId

useEffect(() => {
  if (formTheaterId !== lastTheaterId) {
    setValue('items', [{ snackId: '', quantity: 1 }])  // reset items khi đổi rạp
    setLastTheaterId(formTheaterId)
  }
}, [formTheaterId])
```

---

## 8. Decision Tree — Pattern nào dùng cho entity mới?

```
Bắt đầu: entity mới
│
├─ Là tài sản chung toàn chuỗi, không phụ thuộc rạp?
│   → SHARED (no theater_id)
│   VD: Genre, Review, AuditLog
│
├─ Thuộc về 1 rạp duy nhất, không thể là global?
│   → PER-THEATER (theater_id NOT NULL)
│   VD: Room, Snack, Combo, MovieRun
│
├─ Có default toàn hệ + cho phép override theo rạp?
│   → HYBRID (theater_id NULLABLE) + filtered unique index
│   VD: Voucher, PricingRule
│
└─ Có thể derive theater qua relation chain?
    → DERIVED (không cần theater_id riêng)
    VD: Booking → Showtime → Room → Theater
```

---

## 9. Checklist khi thêm entity multi-tenant mới

### Backend
- [ ] Migration 3-bước (NULLABLE → backfill → NOT NULL + FK + index)
- [ ] Entity: `@ManyToOne Theater theater` + JoinColumn(nullable=false)
- [ ] Request: `Long theaterId` + `@NotNull`
- [ ] Response: `theaterId`, `theaterName`, `theaterCity`
- [ ] Filter (nếu có): `Long theaterId`
- [ ] Specification: `hasTheater(theaterId)` predicate
- [ ] Repository: `findByTheaterId` helper (cho list)
- [ ] Service:
  - [ ] Inject `SecurityService` + `TheaterRepository`
  - [ ] List: auto-scope branch ADMIN từ JWT
  - [ ] Create: scope theaterId từ JWT (override request)
  - [ ] Update: không cho đổi theaterId
  - [ ] Delete/Restore: `requireScopeAccess(entity)` guard
- [ ] Mapper: `@Mapping(target="theaterId", source="theater.id")`
- [ ] Controller: `@RequestParam Long theaterId` cho list
- [ ] (Nếu cross-resource) Guard "tất cả related entities phải cùng theater"

### Frontend
- [ ] Hook: expose `theaterId/theaterName/theaterCity` trong interface
- [ ] Hook list: accept `theaterId` param
- [ ] Page admin:
  - [ ] Consume `useAdminTheaterStore` + `useAuthStore`
  - [ ] Tính `scopedTheaterId`, `branchLocked`
  - [ ] Pass `theaterId` to list hook
  - [ ] Grouped view khi `showGrouped`
  - [ ] Form: select theater (locked cho branch admin)
  - [ ] (Per-theater entity) Cột "Chi nhánh" hiển thị theaterName

### Hybrid riêng
- [ ] Filtered unique index (global + theater-specific)
- [ ] Resolution rule documented (theater-specific WIN)
- [ ] Cross-theater reject message rõ ràng
- [ ] Form: radio Global vs Theater (lock branch admin = THEATER)

---

## 10. Khái niệm mới em cần biết

### Filtered Unique Index
SQL Server cho phép index unique chỉ áp dụng cho 1 subset rows (filter bởi `WHERE`). Khác với UNIQUE constraint thông thường áp dụng cho mọi row. Có ích cho HYBRID pattern.

**MySQL không hỗ trợ** filtered index như SQL Server. Nếu chuyển DB cần dùng cách khác (vd sentinel value `theater_id = 0` cho global — anti-pattern).

### Cross-Product (CROSS JOIN)
Sinh ra TẤT CẢ tổ hợp 2 bảng. Dùng cho migration nhân bản 1 row cho mỗi theater. Cẩn thận: 1000 rows × 100 theaters = 100k rows (có thể nặng).

### Pessimistic Lock vs Optimistic Lock
- **Optimistic** (`@Version` trên BaseEntity): cho phép đọc song song, conflict khi save → retry
- **Pessimistic** (`@Lock(PESSIMISTIC_WRITE)`): lock row khi đọc, block thread khác

Hold seat dùng pessimistic; rule update dùng optimistic.

### Resolution Order — "Most Specific Wins"
Chuẩn industry (CSS specificity, AWS IAM policy):
- Theater-specific rule áp dụng trước global
- Same code → override hoàn toàn (không stack)
- Different code → stack/chain

---

## 11. Anti-patterns — ĐỪNG làm

| ❌ ĐỪNG | ✅ THAY VÀO |
|---|---|
| FE filter theaterId rồi pass lên BE | BE auto-scope branch admin từ JWT (FE chỉ là gợi ý) |
| Soft delete bằng cách check `active=false` chỗ này, `storage_state=ARCHIVED` chỗ khác | Thống nhất 1 cách: BaseEntity.storageState = ARCHIVED |
| Pricing rule global có sentinel `theater_id = 0` | NULLABLE + filtered index |
| Movie + 1 cột `release_date` + 1 cột `end_date` | MovieRun riêng (re-release, festival, sneak preview) |
| Trả entity thẳng cho FE | Response DTO + Mapper |
| Hardcode magic number `holdMinutes = 10` | `systemConfigService.getInt("booking.hold_minutes", 10)` |
| Branch ADMIN có thể vô tình xem rạp khác | Service auto-scope từ JWT, **bỏ qua** request input |

---

## 12. TODO còn lại trong CineX (sau audit)

Các MAJOR finding chưa fix — em có thể làm khi rảnh:

### MAJOR-1: Tách Create/Edit dialog thành component riêng
File > 600 dòng cần tách:
- `AdminRoomPage.tsx` (744 dòng) → tách `RoomFormDialog`
- `AdminShowtimePage.tsx` (682 dòng) → tách `ShowtimeFormDialog`
- `AdminVoucherPage.tsx` (669 dòng) → tách `VoucherFormDialog`

**Pattern:**
```tsx
// AdminVoucherPage.tsx (rút gọn còn ~400 dòng — toolbar + table + lifecycle)
<VoucherFormDialog
  open={dialogOpen}
  onClose={() => setDialogOpen(false)}
  editingItem={editingItem}
  scopedTheaterId={scopedTheaterId}
  branchLocked={branchLocked}
  onSuccess={...}
/>
```

### MAJOR-2: Magic number — extract constants
Tạo `frontend/src/utils/constants.ts`:
```ts
export const ADMIN_LIST_PAGE_SIZE = 50
export const PUBLIC_LIST_PAGE_SIZE = 10
export const BOOKING_HOLD_BUFFER_SECONDS = 15
export const VOUCHER_OPTIONS_PAGE_SIZE = 100
```

Tìm và thay thế `size: 50`, `size: 100` rải rác trong page admin.

### MAJOR-3: editingItem: any → typed
Đã fix 2 file (AdminSnackPage, AdminGenrePage) làm mẫu. Còn lại 5 file:
- AdminRoomPage, AdminMoviePage, AdminShowtimePage, AdminUserPage, AdminBookingPage

Pattern:
```tsx
// Trước
const [editingItem, setEditingItem] = useState<any>(null)

// Sau
import type { AdminRoom } from '@/hooks/useAdminRooms'
const [editingItem, setEditingItem] = useState<AdminRoom | null>(null)
```

---

## 13. Câu hỏi tự kiểm tra

1. Nếu **bỏ** auto-scope JWT trong `SnackService.listSnacksAdmin()`, branch ADMIN HN có xem được snack HCM không? Tại sao đó là lỗ hổng security?

2. Tại sao filtered unique index của Voucher cần **2 cái** thay vì 1 cái `UNIQUE(code, theater_id)` thông thường?

3. Khi user nhập voucher code `WELCOME10` tại theater 5 và DB có:
   - Global voucher `WELCOME10` (giảm 10%)
   - Theater 5 voucher `WELCOME10` (giảm 20%)
   - Theater 3 voucher `WELCOME10` (giảm 30%)
   → Hệ thống áp voucher nào? Nếu user book tại theater 7 thì sao?

4. Migration cross-product MovieRun có 1 phim đang chiếu chỉ ở 5 rạp, sau cross-product với 80 theaters → tạo 80 rows. Hậu quả? Cách fix?

5. PricingEngine resolution: theater 5 có rule `WEEKEND +30%` override + `PRIME-TIME +25%` riêng. Global có `WEEKEND +20%` + `PRIME-TIME +15%` + `TET +50%`. Tính multiplier cuối tại showtime 20h thứ 7 ngày Tết tại theater 5?

6. Nếu FE quên pass `theaterId` khi user áp voucher trong booking flow, voucher theater-specific có hoạt động không?

7. So sánh: SHARED catalog (Movie) vs PER-THEATER snack — về ngữ nghĩa, performance, UX, business decision tốc độ.

8. Tại sao `User.theater_id` là OPTIONAL (NULLABLE) thay vì NOT NULL hoặc bỏ hẳn?

---

## Tham khảo
- Vista Cinema FilmAtSite documentation (Vista Group Integration API)
- AWS IAM policy resolution (specific overrides general)
- CSS specificity rules
- CineX module code: `module/{voucher,pricing,movie,snack,combo}/` 
- Liquibase changelogs: `db/changelog/changes/061-066-*`
