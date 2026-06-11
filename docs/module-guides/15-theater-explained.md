# Module Theater (Chi nhánh rạp) — Giải thích chi tiết

## 1. Tổng quan

Module `theater` quản lý **chi nhánh rạp vật lý** của CineX. Đây là một module mới được bổ sung trong giai đoạn refactor F1 để **đưa CineX từ mô hình "1 rạp giả định" sang mô hình "N chi nhánh thực tế"** — phù hợp với cách rạp lớn ngoài đời thật vận hành.

### Bài toán đặt ra

Ban đầu CineX chỉ có `Room` (phòng chiếu). Toàn bộ code ngầm hiểu "tất cả phòng đều thuộc về 1 rạp duy nhất". Mô hình này có vấn đề khi đối chiếu với thực tế:

| Hãng | Số chi nhánh (2026) | Cách tổ chức |
|---|---|---|
| CGV | ~80 trên toàn quốc | Mỗi chi nhánh 4-10 phòng, lịch chiếu riêng |
| Lotte Cinema | ~50 | Như trên |
| BHD Star | ~12 | Như trên |
| Galaxy | ~20 | Như trên |

Một số yêu cầu nghiệp vụ KHÔNG thể đáp ứng nếu chỉ có 1 rạp:

- User vào app thấy phim "Avatar 3" — nhưng phải hiện được suất chiếu **ở chi nhánh gần họ**, không phải tất cả suất ở mọi nơi.
- Báo cáo doanh thu phải group theo **chi nhánh** ("Lotte Mall Tây Hồ tháng này thu được bao nhiêu?").
- Khi 1 chi nhánh **đóng tạm thời** (sửa chữa) → các phòng/suất chiếu của chi nhánh đó phải tự động ẩn, không ảnh hưởng các chi nhánh còn lại.
- Admin có thể là **manager 1 chi nhánh** (tương lai mở rộng), chỉ thấy data của rạp họ quản lý.

### Trước/Sau refactor F1

```
TRƯỚC F1:
  Room (N) ─── Showtime (N) ─── Booking (N)
  (giả định 1 rạp duy nhất, không có entity Theater)

SAU F1:
  Theater (1) ─── Room (N) ─── Showtime (N) ─── Booking (N)
       │
       ├─ FK rooms.theater_id NOT NULL
       └─ Showtime/Booking gián tiếp thuộc 1 theater qua chain: showtime.room.theater
```

### Workflow phân biệt admin vs user

- **Admin**: CRUD chi nhánh giống các module khác (search, filter, archive, restore). Có **safety check**: không cho archive chi nhánh khi còn phòng đang hoạt động.
- **User (FE)**: lần đầu mở web → bị **modal force chọn chi nhánh** (không thể dismiss). Sau khi chọn, chi nhánh lưu vào `localStorage`. Mọi trang phim/suất chiếu/POS đều filter theo chi nhánh này. Đổi chi nhánh = click badge ở header → dropdown.

---

## 2. Danh sách files

| File | Tác dụng | Design pattern |
|---|---|---|
| `entity/Theater.java` | Entity chi nhánh (code, name, address, city, hotline, geo, status) | BaseEntity, Builder |
| `entity/TheaterStatus.java` | Enum: ACTIVE / MAINTENANCE / CLOSED | Enum (type-safe) |
| `dto/TheaterRequest.java` | Input DTO + Bean Validation (`@NotBlank`, `@Pattern`, `@Size`) | DTO |
| `dto/TheaterResponse.java` | Output DTO trả về cho FE | DTO + Builder |
| `dto/TheaterFilter.java` | Tham số search (keyword, city, status, includeDeleted) | Filter DTO |
| `mapper/TheaterMapper.java` | MapStruct chuyển entity ↔ response | Mapper |
| `repository/TheaterRepository.java` | JPA repo + `JpaSpecificationExecutor` | Repository |
| `specification/TheaterSpecification.java` | Build query động (`fromFilter`) | Specification |
| `service/TheaterService.java` | Business logic: CRUD + chặn archive khi còn room | Service Layer |
| `controller/TheaterController.java` | REST endpoints `/api/theaters` | Controller |
| `db/changelog/changes/054-create-theaters-table.xml` | Migration 4 changeset (2-phase) | Liquibase |
| `frontend/src/store/theaterStore.ts` | Zustand store persist localStorage | State Store |
| `frontend/src/components/theater/TheaterPickerModal.tsx` | Modal first-time chọn chi nhánh | Force Onboarding |
| `frontend/src/components/theater/TheaterSelector.tsx` | Badge header đổi chi nhánh | Dropdown |
| `frontend/src/hooks/useAdminTheaters.ts` | React Query hooks (list, create, update, bulk) | Hooks |
| `frontend/src/features/admin/AdminTheaterPage.tsx` | Trang admin CRUD | Page |

---

## 3. Schema chi tiết — migration 054

File: `db/changelog/changes/054-create-theaters-table.xml`

Migration dùng **pattern 2-phase**: thêm cột mới NULLABLE → backfill data → ALTER NOT NULL. Đây là cách an toàn để thêm FK NOT NULL vào bảng đã có data.

### Changeset 1: Tạo bảng `theaters`

```xml
<createTable tableName="theaters">
    <column name="id" type="BIGINT" autoIncrement="true">
        <constraints primaryKey="true" nullable="false"/>
    </column>
    <!-- BaseEntity columns: version, storage_state, created_by, ... -->
    <column name="code" type="NVARCHAR(30)">
        <constraints nullable="false" unique="true"/>
    </column>
    <column name="name" type="NVARCHAR(200)"><constraints nullable="false"/></column>
    <column name="address" type="NVARCHAR(500)"><constraints nullable="false"/></column>
    <column name="city" type="NVARCHAR(100)"><constraints nullable="false"/></column>
    <column name="hotline" type="NVARCHAR(30)"/>
    <column name="email" type="NVARCHAR(100)"/>
    <column name="latitude" type="DECIMAL(9,6)"/>
    <column name="longitude" type="DECIMAL(9,6)"/>
    <column name="status" type="NVARCHAR(20)" defaultValue="ACTIVE">
        <constraints nullable="false"/>
    </column>
</createTable>
<createIndex tableName="theaters" indexName="idx_theaters_city">
    <column name="city"/>
</createIndex>
```

**Index `idx_theaters_city`:** User filter "rạp ở Hà Nội" rất phổ biến. Không index → full scan. Có index B-tree → lookup O(log N).

**`DECIMAL(9,6)` cho toạ độ:** đủ chính xác ~10 cm. KHÔNG dùng `FLOAT`/`DOUBLE` vì sai số floating-point khiến 2 toạ độ "bằng nhau" so sánh ra khác.

### Changeset 2: Seed 1 chi nhánh default

```sql
INSERT INTO theaters (code, name, address, city, hotline, email, status, ...)
VALUES (
    'CNX-DEFAULT',
    N'CineX — Chi nhánh chính',
    N'Số 1, Đại Cồ Việt, Hai Bà Trưng, Hà Nội',
    N'Hà Nội',
    N'1900-CINEX', 'info@cinex.vn', 'ACTIVE', ...
);
```

**Mục đích:** chuẩn bị 1 record để backfill cột `rooms.theater_id`. Nếu không có row nào trong `theaters`, không thể UPDATE `rooms.theater_id` về 1 giá trị hợp lệ.

### Changeset 3: Thêm `rooms.theater_id` NULLABLE + backfill

```xml
<addColumn tableName="rooms">
    <column name="theater_id" type="BIGINT"/>
</addColumn>

<sql>
UPDATE rooms
SET theater_id = (SELECT TOP 1 id FROM theaters WHERE code = 'CNX-DEFAULT')
WHERE theater_id IS NULL;
</sql>
```

**Vì sao thêm NULLABLE trước, không NOT NULL ngay?**

Nếu thêm `NOT NULL` luôn → DB không cho thực thi vì các row hiện tại đều có `theater_id = NULL` (vi phạm constraint). 2-phase tránh được lỗi này:

```
Phase 1: ADD COLUMN theater_id (nullable) → tất cả row có NULL (OK)
Phase 2: UPDATE ... SET theater_id = 1     → backfill, không còn NULL
Phase 3: ALTER NOT NULL                    → constraint pass vì 0 NULL
```

### Changeset 4: ALTER NOT NULL + FK + Index

```xml
<preConditions onFail="HALT">
    <sqlCheck expectedResult="0">
        SELECT COUNT(*) FROM rooms WHERE theater_id IS NULL
    </sqlCheck>
</preConditions>
<addNotNullConstraint tableName="rooms" columnName="theater_id" columnDataType="BIGINT"/>
<addForeignKeyConstraint baseTableName="rooms" baseColumnNames="theater_id"
                         referencedTableName="theaters" referencedColumnNames="id"
                         constraintName="fk_rooms_theater"/>
<createIndex tableName="rooms" indexName="idx_rooms_theater">
    <column name="theater_id"/>
</createIndex>
```

**`preConditions`:** Liquibase chạy SQL check trước. Nếu count NULL != 0 → **HALT** dừng migration. Safety net: nếu changeset 3 lỗi backfill → changeset 4 không phá DB.

**Index `idx_rooms_theater`:** Query `SELECT * FROM rooms WHERE theater_id = ?` rất phổ biến — index để O(log N).

### Trade-off CASCADE FK

Không set `onDelete=CASCADE` → mặc định `NO ACTION`. Xoá theater khi còn `rooms.theater_id = X` → DB throw FK violation. Đây là **hành vi đúng**: tránh xoá nhầm theater khiến hàng loạt room mồ côi. Thực ra CineX dùng soft delete (`storageState = ARCHIVED`), không bao giờ `DELETE FROM theaters` — cấm CASCADE chỉ là lớp phòng thủ phụ.

---

## 4. Pattern Multi-Branch Lite — không phải Multi-Tenant

### Multi-Tenant SaaS (full) khác gì?

Trong các SaaS như Slack/Shopify, **1 user thuộc về 1 tenant cố định**. Mọi data scope theo `tenant_id`, append vào MỌI query. Có thể dùng schema/DB riêng để cách ly cứng.

CineX **KHÔNG** phải multi-tenant đúng nghĩa:

| Đặc điểm | Multi-Tenant SaaS | CineX Multi-Branch |
|---|---|---|
| User thuộc về 1 tenant? | Có (cố định) | Không — user đi nhiều chi nhánh |
| Data cách ly cứng? | Có (schema riêng) | Không (1 DB chung, filter mềm) |
| Tenant_id append MỌI query? | Có | Không — chỉ Showtime/Movie filter |
| Admin thấy cross-tenant? | Hiếm | Có — báo cáo tất cả chi nhánh |

CineX chọn pattern này vì:
1. **User nature**: khách có thể đi xem Hà Nội tuần này, TP.HCM tuần sau.
2. **Booking history**: user xem toàn bộ lịch sử ở mọi chi nhánh.
3. **Đơn giản code**: chỉ Showtime/Movie filter scope theo theaterId. Bảng `users`, `bookings` không cần `theater_id`.

### Pattern này phổ biến trong ngành

| Ngành | Ví dụ | Cách scope |
|---|---|---|
| Rạp chiếu phim | CGV, Lotte | Theater_id ở Room |
| Chuỗi F&B | Highlands, Phúc Long | Branch_id ở MenuItem, Order |
| Bán lẻ | Circle K | Store_id ở Inventory, Sale |
| Khách sạn chuỗi | Marriott | Hotel_id ở RoomAvailability |

Điểm chung: **sản phẩm/dịch vụ vật lý gắn địa điểm** → branch_id ở entity gắn địa điểm. Customer di động → không gắn branch_id.

### Cách CineX scope query

```
"Phim đang chiếu ở Hà Nội"
  → MovieSpecification.hasActiveShowtimes(theaterId=5)
  → EXISTS subquery JOIN showtime → room → theater (id=5)

"Lịch chiếu Avatar tại chi nhánh 5"
  → ShowtimeService.list(movieId=10, theaterId=5)
  → WHERE showtime.movie_id = 10 AND showtime.room.theater.id = 5
```

JOIN chỉ khi cần. FE chủ động gửi `theaterId` từ Zustand store.

---

## 5. Service Layer — SOLID + Aggregate Root

### Cascade safety: chặn archive khi còn room ACTIVE

File: `service/TheaterService.java:106-121`

```java
@Transactional
@Auditable(action = "ARCHIVE_THEATER", entityType = "Theater")
public void archive(Long id) {
    Theater theater = findOrThrow(id);

    // Chặn xoá khi chi nhánh còn room ACTIVE — tránh "mồ côi" room.
    long activeRooms = roomRepository.countByTheaterIdAndStorageStateNot(id, StorageState.ARCHIVED);
    if (activeRooms > 0) {
        throw new BusinessException(ErrorCode.INVALID_REQUEST,
                "Không thể xoá chi nhánh đang có " + activeRooms + " phòng hoạt động");
    }

    theater.setStorageState(StorageState.ARCHIVED);
    theaterRepository.save(theater);
    log.info("Archived theater id={}", id);
}
```

**Vì sao cần check trước?**

Nếu không check → admin archive theater #5 → các Room thuộc theater #5 vẫn còn `storageState = ACTIVE` → User vẫn thấy showtime/phim ở chi nhánh đã đóng. Inconsistency!

**Tại sao không CASCADE archive tự động?**

Lý do là **explicit > implicit**: admin phải tự archive Room trước, sau đó archive Theater. Tránh tình huống click 1 cái mất toàn bộ data mà không nhận ra. Pattern này gọi là **"fail loud, fail early"**.

**Phương thức Repository được gọi:**

`RoomRepository.countByTheaterIdAndStorageStateNot(id, StorageState.ARCHIVED)`

- Spring Data tự sinh JPQL từ tên method → không cần viết SQL.
- Đếm room không thuộc trạng thái ARCHIVED ở theater này.
- Tương đương: `SELECT COUNT(*) FROM rooms WHERE theater_id = ? AND storage_state != 'ARCHIVED'`.

### Update — KHÔNG cho đổi `code`

File: `service/TheaterService.java:84-91`

```java
if (!theater.getCode().equals(request.getCode())) {
    throw new BusinessException(ErrorCode.INVALID_REQUEST,
            "Không thể đổi mã chi nhánh — vui lòng tạo chi nhánh mới");
}
```

**Vì sao?**

`code` là **business identifier** (như slug URL). Nếu cho đổi:
- Các ticket/booking đã in có code rạp → reference break.
- Phiếu/email cũ tham chiếu code cũ → lộn data.

Đổi `code` = tạo entity mới (immutable business key). Đây là pattern chuẩn của **Domain-Driven Design**.

### Aggregate Root — Theater là root

Trong DDD:
- **Aggregate Root** = entity "cửa ngõ" mà các code khác phải đi qua để truy cập aggregate.
- CineX: Theater là root của (Room, Showtime, Booking) — nhưng JPA của CineX **không enforce strict aggregate** (Room/Showtime có repository riêng).

CineX dùng **Aggregate Lite**:
- Theater có **kiểm soát lifecycle Room**: không cho archive nếu còn room ACTIVE.
- Room/Showtime vẫn có repository riêng cho CRUD performance — nhưng cross-cutting concern (archive) phải qua TheaterService.

### Specification cho filter

File: `specification/TheaterSpecification.java`

```java
public static Specification<Theater> fromFilter(TheaterFilter filter) {
    Specification<Theater> spec = Specification.where(null);

    if (!Boolean.TRUE.equals(filter.getIncludeDeleted())) {
        spec = spec.and(notArchived());
    }
    if (StringUtils.hasText(filter.getKeyword())) {
        spec = spec.and(hasKeyword(filter.getKeyword()));
    }
    if (StringUtils.hasText(filter.getCity())) {
        spec = spec.and(hasCity(filter.getCity()));
    }
    if (filter.getStatus() != null) {
        spec = spec.and(hasStatus(filter.getStatus()));
    }
    return spec;
}
```

**Open/Closed Principle**: thêm filter `country` mới → chỉ cần thêm `hasCountry()` method và 1 dòng `.and()`. KHÔNG sửa filter cũ. Code cũ vẫn chạy đúng.

---

## 6. User Context Flow (FE) — Force Onboarding Pattern

### Zustand store + persist localStorage

File: `frontend/src/store/theaterStore.ts`

```typescript
const STORAGE_KEY = 'currentTheater'

function load(): CurrentTheater | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export const useTheaterStore = create<TheaterState>((set) => ({
  currentTheater: load(),

  setCurrentTheater: (t) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(t))
    set({ currentTheater: t })
  },

  clearCurrentTheater: () => {
    localStorage.removeItem(STORAGE_KEY)
    set({ currentTheater: null })
  },
}))
```

**Vì sao persist localStorage?**

User chọn chi nhánh 1 lần → phải nhớ lâu dài. Nếu chỉ giữ trong React state (RAM):
- Refresh page → mất → bị modal hỏi lại.
- Close tab → mất → lần sau vào lại hỏi.

`localStorage` persist qua refresh, tab close, browser restart. Chỉ mất khi user **manual clear browser data**.

**Vì sao wrap try-catch?**

`JSON.parse` có thể throw nếu data corrupt (user can thiệp DevTools). Try-catch → fallback xoá `localStorage` + trả null → user vào lại flow chọn chi nhánh, không crash app.

### Force onboarding modal

File: `TheaterPickerModal.tsx`

```typescript
const ROUTES_WITHOUT_THEATER = [
  '/login', '/register', '/forgot-password',
  '/reset-password', '/verify-email', '/payment/result',
]

export default function TheaterPickerModal() {
  const { currentTheater } = useTheaterStore()
  const location = useLocation()

  const skipOnThisRoute = ROUTES_WITHOUT_THEATER.some(p => location.pathname.startsWith(p))
  if (skipOnThisRoute || currentTheater) return null

  return <ModalContent />
}

function ModalContent() {
  // ...gọi useTheaterOptions() và render UI
}
```

**Vì sao tách subcomponent `ModalContent`?** Hook `useTheaterOptions()` gọi API `/api/theaters`. Nếu để hook ở component cha → mọi page render đều fire API (kể cả `/login` chưa có JWT → 401 loop). Tách subcomponent → hook chỉ chạy khi `ModalContent` thực sự mount.

**Vì sao backdrop KHÔNG có onClick dismiss?** Đây là **force onboarding**: user PHẢI chọn chi nhánh ít nhất 1 lần. Nếu cho dismiss → user click ngoài, modal đóng, vào trang phim thấy "không có suất chiếu" → confused.

**Lock scroll:** `document.body.style.overflow = 'hidden'` trong `useEffect`, restore khi unmount → focus user vào modal.

### Badge header (TheaterSelector)

Click-outside-to-close pattern:

```typescript
useEffect(() => {
  function handleClick(e: MouseEvent) {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setOpen(false)
    }
  }
  document.addEventListener('mousedown', handleClick)
  return () => document.removeEventListener('mousedown', handleClick)
}, [])
```

Gắn global listener, check target ngoài ref → đóng dropdown. Cleanup khi unmount để không leak listener.

### Filter theo theater trên trang user

**MovieListPage:**

```typescript
const { currentTheater } = useTheaterStore()
// ...
const params = tab === 'showing'
  ? { showing: true, theaterId: currentTheater?.id }
  : { ... }
```

Tab "Phim đang chiếu" → BE filter `hasActiveShowtimes(theaterId)`. User ở Hà Nội chỉ thấy phim có suất ở chi nhánh Hà Nội.

**MovieDetailPage:**

```typescript
const { currentTheater } = useTheaterStore()
const { data: showtimes = [] } = useShowtimes(movieId, selectedDate, currentTheater?.id)
```

Trang chi tiết phim chỉ load suất chiếu ở chi nhánh đang chọn.

**TicketPOSPage (admin):**

```typescript
queryKey: ['pos-showtimes', today, currentTheater?.id ?? 'all'],
queryFn: async () => {
  const params: Record<string, unknown> = { date: today }
  if (currentTheater?.id) params.theaterId = currentTheater.id
  // ...
}
```

POS (Point of Sale — quầy vé) bán vé phải scope theo chi nhánh nhân viên đang đứng. Không thể nhân viên ở Hà Nội lại bán vé chi nhánh TP.HCM.

---

## 7. BE Filter Cross-Module — MovieSpecification

File: `module/movie/specification/MovieSpecification.java:121-141`

```java
public static Specification<Movie> hasActiveShowtimes(Long theaterId) {
    return (root, query, cb) -> {
        Subquery<Long> sub = query.subquery(Long.class);
        Root<Showtime> showtime = sub.from(Showtime.class);
        sub.select(cb.literal(1L));

        var conditions = new ArrayList<Predicate>();
        conditions.add(cb.equal(showtime.get("movie"), root));
        conditions.add(cb.greaterThanOrEqualTo(showtime.get("endTime"), LocalDateTime.now()));
        conditions.add(cb.or(
                cb.isNull(showtime.get("storageState")),
                cb.notEqual(showtime.get("storageState"), StorageState.ARCHIVED)
        ));
        if (theaterId != null) {
            // JOIN chain: showtime.room.theater.id
            conditions.add(cb.equal(showtime.get("room").get("theater").get("id"), theaterId));
        }
        sub.where(conditions.toArray(new Predicate[0]));
        return cb.exists(sub);
    };
}
```

### Phân tích JOIN chain

`showtime.get("room").get("theater").get("id")` — đây là **path traversal** trong JPA Criteria API. Tương đương SQL:

```sql
EXISTS (
    SELECT 1 FROM showtimes s
    JOIN rooms r ON s.room_id = r.id
    JOIN theaters t ON r.theater_id = t.id
    WHERE s.movie_id = movie.id
      AND s.end_time >= NOW()
      AND s.storage_state != 'ARCHIVED'
      AND t.id = :theaterId
)
```

JPA tự sinh JOIN từ chain `.get()`. Không phải viết SQL manual.

### Hai method khác nhau

```java
// "Phim ĐANG có suất chiếu tại chi nhánh X" (endTime >= now)
hasActiveShowtimes(Long theaterId)

// "Phim CÓ suất tại chi nhánh X bất kể đã chiếu chưa"
hasShowtimesAtTheater(Long theaterId)
```

**Use case khác nhau:**
- `hasActiveShowtimes`: trang user "Phim đang chiếu" — phải có suất chưa kết thúc.
- `hasShowtimesAtTheater`: trang admin báo cáo "Tổng số phim đã chiếu tại chi nhánh X trong tháng" — lấy cả suất đã hết.

---

## 8. SQL được sinh ra (Hibernate)

### List theaters với filter

`theaterRepository.findAll(spec, pageable)` với filter `{keyword="lotte", city="Hà Nội", status=ACTIVE}`:

```sql
SELECT t.* FROM theaters t
WHERE (t.storage_state IS NULL OR t.storage_state != 'ARCHIVED')
  AND (LOWER(t.name) LIKE '%lotte%'
       OR LOWER(t.code) LIKE '%lotte%'
       OR LOWER(t.address) LIKE '%lotte%')
  AND t.city = N'Hà Nội'
  AND t.status = 'ACTIVE'
ORDER BY t.created_at DESC
OFFSET 0 ROWS FETCH NEXT 20 ROWS ONLY
```

### Count rooms (cascade check)

`roomRepository.countByTheaterIdAndStorageStateNot(5, ARCHIVED)`:

```sql
SELECT COUNT(r.id) FROM rooms r
WHERE r.theater_id = 5
  AND r.storage_state != 'ARCHIVED'
```

### Movie filter theo theater

`MovieSpecification.hasActiveShowtimes(5)`:

```sql
SELECT m.* FROM movies m
WHERE EXISTS (
    SELECT 1 FROM showtimes s
    INNER JOIN rooms r ON s.room_id = r.id
    INNER JOIN theaters t ON r.theater_id = t.id
    WHERE s.movie_id = m.id
      AND s.end_time >= GETDATE()
      AND (s.storage_state IS NULL OR s.storage_state != 'ARCHIVED')
      AND t.id = 5
)
```

`EXISTS` thay vì `IN`/`JOIN DISTINCT`: chỉ cần biết "có ít nhất 1 suất" → DB short-circuit, performance tốt hơn.

---

## 9. Request/Response mẫu

### POST `/api/theaters` (admin tạo chi nhánh)

**Request:**

```bash
curl -X POST http://localhost:8088/api/theaters \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "code": "CNX-HN-LOTTE",
    "name": "CineX Hà Nội — Lotte Mall Tây Hồ",
    "address": "683 Lạc Long Quân, Tây Hồ, Hà Nội",
    "city": "Hà Nội",
    "hotline": "024-1234-5678",
    "email": "hn-lotte@cinex.vn",
    "latitude": 21.071234,
    "longitude": 105.823456,
    "status": "ACTIVE"
  }'
```

**Response success:**

```json
{
  "success": true,
  "message": "Tạo chi nhánh thành công",
  "data": {
    "id": 2,
    "storageState": "ACTIVE",
    "code": "CNX-HN-LOTTE",
    "name": "CineX Hà Nội — Lotte Mall Tây Hồ",
    "address": "683 Lạc Long Quân, Tây Hồ, Hà Nội",
    "city": "Hà Nội",
    "hotline": "024-1234-5678",
    "email": "hn-lotte@cinex.vn",
    "latitude": 21.071234,
    "longitude": 105.823456,
    "status": "ACTIVE",
    "createdAt": "2026-06-09T10:30:00",
    "updatedAt": "2026-06-09T10:30:00"
  }
}
```

**Response error — code trùng:**

```json
{
  "success": false,
  "message": "Mã chi nhánh đã tồn tại: CNX-HN-LOTTE",
  "data": null
}
```

**Response error — validation:**

```json
{
  "success": false,
  "message": "Mã chỉ gồm chữ hoa, số, dấu gạch ngang",
  "data": null
}
```

### GET `/api/theaters?city=Hà Nội`

**Request:**

```bash
curl "http://localhost:8088/api/theaters?city=H%C3%A0%20N%E1%BB%99i&status=ACTIVE&size=20"
```

**Response:**

```json
{
  "success": true,
  "message": null,
  "data": {
    "content": [
      {
        "id": 2,
        "code": "CNX-HN-LOTTE",
        "name": "CineX Hà Nội — Lotte Mall Tây Hồ",
        "city": "Hà Nội",
        "status": "ACTIVE",
        ...
      },
      {
        "id": 3,
        "code": "CNX-HN-AEON",
        "name": "CineX Hà Nội — AEON Mall Long Biên",
        ...
      }
    ],
    "totalElements": 2,
    "totalPages": 1,
    "page": 0,
    "size": 20
  }
}
```

### DELETE `/api/theaters/2` — success case

**Request:**

```bash
curl -X DELETE http://localhost:8088/api/theaters/2 \
  -H "Authorization: Bearer eyJhbGc..."
```

**Response:**

```json
{
  "success": true,
  "message": "Đã lưu trữ chi nhánh",
  "data": null
}
```

### DELETE `/api/theaters/2` — error case (còn room ACTIVE)

```json
{
  "success": false,
  "message": "Không thể xoá chi nhánh đang có 5 phòng hoạt động",
  "data": null
}
```

Sau khi admin nhận lỗi này → flow đúng là vào trang Room, archive từng phòng của theater #2 → quay lại archive theater.

---

## 10. Câu hỏi tự kiểm tra

Sau khi đọc xong, thử trả lời 7 câu này để chắc rằng bạn đã hiểu:

1. **Tại sao FK `theater_id` đặt trên `Room` mà không đặt trực tiếp trên `Showtime`?**
   *Gợi ý:* nghĩ đến tính chất "1 phòng vật lý không thể thuộc 2 chi nhánh". Showtime gián tiếp thừa hưởng theater qua chain showtime → room → theater. Nếu đặt cả ở Showtime → duplicate, dễ inconsistent (showtime.theater_id != room.theater_id).

2. **Khi user đi du lịch Hà Nội → TP.HCM, làm sao đổi chi nhánh? Data cũ ở Hà Nội (booking history) còn xem được không?**
   *Gợi ý:* click TheaterSelector ở header → chọn chi nhánh TP.HCM → `setCurrentTheater()` → localStorage update. Booking history KHÔNG bị filter theo `currentTheater` (vì booking đã thuộc chi nhánh nào là cố định) — vẫn xem được toàn bộ.

3. **Nếu admin DELETE thật (DROP CASCADE) Room, có ảnh hưởng Theater không?**
   *Gợi ý:* không — FK `rooms.theater_id` chỉ buộc room phải tham chiếu đến 1 theater hợp lệ. Xoá child không ảnh hưởng parent. Ngược lại, xoá Theater (parent) sẽ bị FK chặn vì Room còn tham chiếu.

4. **Vì sao migration 054 không gộp luôn 4 changeset thành 1?**
   *Gợi ý:* nếu 1 changeset có cả CREATE TABLE + ALTER NOT NULL → giữa chừng có row NULL → fail toàn bộ. Tách 4 changeset → mỗi cái atomic, có thể rollback từng phần. Pattern 2-phase là chuẩn industry cho thêm NOT NULL column vào bảng có data.

5. **Nếu user xoá `localStorage.currentTheater` qua DevTools rồi reload — chuyện gì xảy ra?**
   *Gợi ý:* `load()` trả `null` → `currentTheater = null` → `TheaterPickerModal` render → user buộc chọn lại. Đây là **graceful degradation**, không crash app.

6. **Tại sao `code` không cho đổi trong update?**
   *Gợi ý:* `code` là business identifier, có thể đã in trên vé/email/SMS. Đổi code → reference cũ trỏ tới giá trị không tồn tại. Pattern immutable business key của DDD.

7. **Vì sao `useTheaterOptions` có `staleTime: 5 * 60 * 1000` (5 phút)?**
   *Gợi ý:* danh sách chi nhánh ít thay đổi (vài tháng/lần admin thêm rạp mới). React Query cache 5 phút → giảm 95% API call. Khi admin tạo theater mới, mutation `useCreateTheater` invalidate `['theaters', 'options']` → force refetch ngay.

---

## Tổng kết các pattern đã áp dụng

| Pattern | Vị trí | Lợi ích chính |
|---|---|---|
| **2-phase migration** | `054-create-theaters-table.xml` | Thêm NOT NULL column an toàn vào bảng có data |
| **Aggregate Root Lite** | `TheaterService.archive()` | Cascade safety, parent kiểm soát lifecycle child |
| **Specification** | `TheaterSpecification.fromFilter` | Filter động, mở rộng dễ (Open/Closed) |
| **Force Onboarding** | `TheaterPickerModal` (no dismiss) | Bắt user qua bước thiết yếu trước khi xem nội dung |
| **Persistent State Store** | `theaterStore.ts` + localStorage | Chọn 1 lần, dùng nhiều session |
| **Multi-Branch Lite** | Showtime filter theo `room.theater.id` | Scope mềm, không phải full multi-tenant |
| **Immutable Business Key** | Cấm update `code` | Tránh break reference của ticket/email cũ |
| **Subcomponent for Lazy Hook** | `ModalContent` trong PickerModal | API chỉ gọi khi thực sự cần render |
| **Click-outside-to-close** | `TheaterSelector` ref + listener | UX chuẩn cho dropdown |
| **JPA Criteria Path Traversal** | `showtime.get("room").get("theater")` | Sinh JOIN tự động, không viết SQL manual |

---

**Khi nào KHÔNG nên dùng pattern này?**

- **Hệ thống chỉ 1 chi nhánh đơn lẻ** → không cần `Theater` entity, làm phức tạp thừa.
- **SaaS true multi-tenant** (mỗi tenant cách ly hoàn toàn) → cần `tenant_id` ở MỌI bảng + row-level security, không phải Multi-Branch Lite.
- **Khi cần force user-tenant binding** (user A KHÔNG được thấy data của tenant B) → cần thêm Spring Security expression `@PreAuthorize("@theaterSecurity.canAccess(#id)")`, CineX hiện không có vì user là khách hàng đa địa điểm.
