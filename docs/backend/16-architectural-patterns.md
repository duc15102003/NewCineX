# Architectural Patterns — Lessons from CineX

> File này tổng hợp **9 pattern kỹ thuật** đã được áp dụng trong CineX, kèm bài học rút ra qua các refactor lớn. Mỗi pattern trình bày theo cấu trúc: **Bài toán → Giải pháp → Trade-off → Ví dụ trong CineX → Pitfall thường gặp**.
>
> Đây là các pattern **kiến trúc/migration/concurrency** — KHÔNG phải GoF design patterns (xem `docs/design-patterns/`). Pattern ở đây phục vụ tình huống production-thực-tế: schema evolution an toàn, multi-instance HA, eventual consistency, denormalization có chủ đích.

---

## 1. Denormalized Foreign Key Pattern

### Bài toán

SQL Server (và nhiều DB) cho phép **filtered/partial unique index** — index unique chỉ trên row thỏa điều kiện. VD: "1 ghế trong 1 suất chiếu chỉ có thể được HELD hoặc BOOKED bởi đúng 1 booking".

```sql
CREATE UNIQUE INDEX idx_booking_seats_unique_active
ON booking_seats (showtime_id, seat_id)
WHERE status IN ('HELD', 'BOOKED');
```

**Vấn đề:** Filtered index ở SQL Server **KHÔNG cho phép reference cột bảng khác**. Nếu `booking_seats` chỉ có FK `booking_id` → muốn unique theo `showtime_id` → phải JOIN sang `bookings` → SQL Server cấm.

→ Phải **copy** `showtime_id` xuống `booking_seats` thành cột denormalized.

### Giải pháp

1. Thêm cột `showtime_id` vào `booking_seats` (denormalized — copy từ `bookings.showtime_id`)
2. Service set giá trị **trực tiếp trong code Java** khi INSERT booking_seat
3. Tạo filtered unique index trên `(showtime_id, seat_id) WHERE status IN ('HELD','BOOKED')`
4. Invariant: `booking_seat.showtime_id == booking_seat.booking.showtime_id` luôn đúng

### Trade-off

| Lợi | Hại |
|---|---|
| DB-level constraint chống double-booking — race-condition-proof | Thêm 1 cột storage |
| Query "ghế nào đang chiếm trong showtime X" không cần JOIN | Phải maintain invariant ở code (bug tiềm ẩn nếu quên set) |
| Performance: index trực tiếp trên cột, không cần join | Migration phức tạp hơn (backfill cột mới) |

### Ví dụ trong CineX

File: `booking/entity/BookingSeat.java` — field `showtimeId` denormalized.

```java
@Entity
public class BookingSeat extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id", nullable = false)
    private Booking booking;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "seat_id", nullable = false)
    private Seat seat;

    // DENORMALIZED — copy từ booking.showtime.id để filtered unique index dùng được
    @Column(name = "showtime_id", nullable = false)
    private Long showtimeId;

    @Enumerated(EnumType.STRING)
    private BookingSeatStatus status;  // HELD / BOOKED / CANCELLED / EXPIRED
}
```

Service code:

```java
// BookingService.holdSeats — phải set showtimeId TRỰC TIẾP
BookingSeat bs = BookingSeat.builder()
        .booking(booking)
        .seat(seat)
        .showtimeId(booking.getShowtime().getId())  // <-- BẮT BUỘC
        .status(BookingSeatStatus.HELD)
        .build();
```

Tương tự ở CineX: `Showtime.movie` (denormalized backup từ `showtime.movieRun.movie` — xem `docs/module-guides/05-movie-explained.md` Section 4.5).

### Pitfall — Trigger AFTER INSERT KHÔNG cứu được NOT NULL

> **Bài học từ commit `c65be05` (fix bug "ghế vừa bị người khác đặt")**

Ban đầu nhóm thử dùng SQL trigger `AFTER INSERT` để tự fill `showtime_id` từ `booking.showtime_id`. Suy nghĩ: "App quên set cũng không sao, trigger fill hộ."

**SAI.** SQL Server check `NOT NULL` ngay tại INSERT statement, **TRƯỚC** khi AFTER INSERT trigger chạy. Hậu quả:

1. JPA INSERT booking_seats không có `showtime_id` → cột NULL → fail NOT NULL constraint
2. Exception bắn lên — DataIntegrityViolationException
3. Service catch generic exception → tưởng là partial unique index conflict → throw `SEAT_ALREADY_BOOKED`
4. FE hiển thị "Ghế vừa bị người khác đặt" — DÙ user là người duy nhất đang đặt!

**Bài học:**
- Denormalized column phải được app **set trực tiếp**, KHÔNG dựa vào trigger
- `DataIntegrityViolationException` là exception generic (bao gồm NOT NULL, UNIQUE, FK violations) — catch cụ thể từng loại để message FE chính xác
- AFTER INSERT trigger chỉ hữu ích cho audit/logging — KHÔNG cứu được constraint violation tại INSERT

---

## 2. Derived Status Pattern (Option A vs B)

### Bài toán

Sau khi tách `Movie` → `Movie + MovieRun`, `Movie.status` thực sự là **derived field** — có thể tính từ status của các MovieRun. Có 2 cách xử lý:

- **Option A:** Drop `Movie.status` hoàn toàn, mọi nơi gọi tự compute từ runs
- **Option B:** Giữ field, recompute sau mỗi event (create/update/archive run)

### Option A — Compute on-demand

```java
public MovieStatus computeStatus(Movie movie) {
    List<MovieRun> runs = movieRunRepository.findByMovieId(movie.getId());
    if (runs.stream().anyMatch(r -> r.getStatus() == NOW_SHOWING)) return NOW_SHOWING;
    if (runs.stream().anyMatch(r -> r.getStatus() == SCHEDULED))    return COMING_SOON;
    return ENDED;
}
```

**Lợi:** Single source of truth (runs) — không bao giờ stale.

**Hại:**
- Mỗi lần build DTO MovieResponse phải query runs → N+1 nguy hiểm khi list 50 phim
- DTO contract đổi: `status` không còn là field DB → FE filter "where status = NOW_SHOWING" phải gửi lên BE → BE phải build subquery complex
- Refactor toàn bộ MovieResponse, MovieListResponse, FavoriteMovieResponse, MovieMapper, MovieSpecification

### Option B — Materialized derived (CineX chọn)

Giữ `Movie.status` như field DB, recompute sau mỗi event làm thay đổi runs:

```java
public void recomputeMovieStatus(Movie movie) {
    List<MovieRun> runs = movieRunRepository
            .findByMovieIdAndStorageStateNot(movie.getId(), StorageState.ARCHIVED);
    if (runs.isEmpty()) return;

    MovieStatus newStatus = deriveFromRuns(runs);
    if (movie.getStatus() != newStatus) {
        movie.setStatus(newStatus);
        movieRepository.save(movie);
    }
}
```

Gọi ở: `MovieRunService.create / update / archive` + cuối job `MovieRunStatusScheduler`.

**Lợi:**
- Backward compat: DTO + FE + Specification cũ không đổi
- Query nhanh: `WHERE m.status = 'NOW_SHOWING'` dùng index có sẵn
- Migration không break diện rộng

**Hại:**
- Eventual consistency: giữa 2 event update, status có thể stale vài giây/phút
- Phải nhớ gọi `recomputeMovieStatus` ở MỌI nơi đổi run

### Trade-off

| Tiêu chí | Option A | Option B (CineX) |
|---|---|---|
| Consistency | Strong (immediate) | Eventual (~1 phút trễ nhất qua scheduler) |
| Performance query list | Chậm (N+1) hoặc complex subquery | Nhanh (index sẵn) |
| Migration cost | Cao — refactor DTO/Spec/FE | Thấp — chỉ thêm `recomputeMovieStatus` calls |
| Bug surface | An toàn (1 nguồn) | Cần discipline gọi recompute đúng chỗ |

### Khi nào dùng A, khi nào dùng B?

- **Option A**: derived value đơn giản, hiếm dùng trong filter/query
- **Option B**: derived value dùng trong filter/sort/badge tần suất cao, hoặc đã tồn tại trong API contract (backward compat)

Ví dụ khác trong CineX: `Movie.rating` cũng là Option B — recompute khi user post review, không tính on-demand.

---

## 3. 2-Phase Schema Migration

### Bài toán

Đổi schema large (vd: thêm cột NOT NULL FK liên kết bảng khác). Migration 1-shot:

```xml
<!-- DANGEROUS -->
<addColumn tableName="showtimes">
    <column name="movie_run_id" type="BIGINT">
        <constraints nullable="false"/>  <!-- NOT NULL ngay -->
    </column>
</addColumn>
```

→ Fail ngay vì row cũ chưa có giá trị. Phải backfill TRƯỚC khi NOT NULL. Nhưng nếu backfill + alter NOT NULL trong cùng changeset:

- Backfill sai → đã alter schema → rollback khó (mất data hoặc phải migrate ngược)
- Production có 2 phiên bản app chạy đồng thời (rolling deploy): app cũ INSERT row không có movie_run_id → fail

### Giải pháp 2-phase

**Phase 1** (changeset 051): add column **NULLABLE** + backfill + FK
**Phase 2** (changeset 052): alter **NOT NULL** với `preConditions sqlCheck`

```xml
<!-- 051-create-movie-runs-table.xml -->
<changeSet id="051-add-showtime-movie-run-id" author="cinex">
    <addColumn tableName="showtimes">
        <column name="movie_run_id" type="BIGINT"/>  <!-- NULLABLE -->
    </addColumn>

    <sql>
        UPDATE s SET s.movie_run_id = (
            SELECT TOP 1 mr.id FROM movie_runs mr
            WHERE mr.movie_id = s.movie_id ORDER BY mr.start_date DESC
        )
        FROM showtimes s WHERE s.movie_run_id IS NULL;
    </sql>

    <addForeignKeyConstraint baseTableName="showtimes" baseColumnNames="movie_run_id"
                             referencedTableName="movie_runs" referencedColumnNames="id"
                             constraintName="fk_showtimes_movie_run"/>
</changeSet>
```

```xml
<!-- 052-showtime-movie-run-not-null.xml -->
<changeSet id="052-showtime-movie-run-id-not-null" author="cinex">
    <preConditions onFail="MARK_RAN"
                   onFailMessage="Vẫn còn showtimes.movie_run_id NULL, bỏ qua NOT NULL.">
        <sqlCheck expectedResult="0">
            SELECT COUNT(*) FROM showtimes WHERE movie_run_id IS NULL
        </sqlCheck>
    </preConditions>
    <addNotNullConstraint tableName="showtimes" columnName="movie_run_id" columnDataType="BIGINT"/>
</changeSet>
```

### Trade-off

| Lợi | Hại |
|---|---|
| Rollback Phase 2 dễ: ALTER NULLABLE lại | 2 deploy thay vì 1 (chậm hơn 1 ngày-tuần) |
| Phát hiện bug giữa 2 phase: rollback chỉ Phase 1 | Phức tạp hơn — cần discipline |
| Production-safe: app verify Phase 1 ổn rồi push Phase 2 | Phải giữ code support cả 2 trạng thái (NULL OK + NOT NULL) trong khoảng giữa |
| `MARK_RAN` thay HALT khi sqlCheck fail — không block deploy | Admin phải nhận biết log để fix data rác |

### Khi nào dùng pattern này?

- **DÙNG**: đổi schema có dữ liệu thật, schema không nullable, có rolling deploy
- **KHÔNG cần**: dev/test env reset DB liên tục, schema mới hoàn toàn không backfill

### Ví dụ khác

- Đổi enum: phase 1 cho phép cả giá trị cũ + mới, phase 2 cleanup giá trị cũ
- Tách bảng: phase 1 dual-write (ghi cả bảng cũ và mới), phase 2 read từ bảng mới, phase 3 drop bảng cũ (3-phase)

---

## 4. Single Dialog 2-Modes (FE Pattern)

### Bài toán

Trang admin: bảng list runs của 1 phim, có nút "Thêm đợt chiếu". Click vào → mở **dialog tạo run**.

Cách 1 (nested dialog): Bảng nằm trong Dialog A, click "Thêm" → mở Dialog B (form) **chồng lên** Dialog A.

**Vấn đề nested dialog:**
- 2 modal stack → backdrop tối x2 → user khó nhận biết
- Phím Esc đóng dialog nào? React/Radix UI khó handle
- Mobile: 2 modal nhỏ + nested → UX tệ
- Animation transition rối loạn

### Giải pháp

**1 Dialog component, switch nội dung theo state `mode`:**

```tsx
type Mode = { kind: 'list' } | { kind: 'form'; editing?: MovieRun };

function MovieRunsDialog({ movieId, open, onClose }) {
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const runs = useMovieRuns(movieId);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        {mode.kind === 'list' ? (
          <>
            <DialogHeader>
              <DialogTitle>Đợt chiếu của phim</DialogTitle>
            </DialogHeader>
            <Table>...{/* list runs */}</Table>
            <Button onClick={() => setMode({ kind: 'form' })}>
              Thêm đợt chiếu
            </Button>
          </>
        ) : (
          <>
            <DialogHeader>
              <Button variant="ghost" onClick={() => setMode({ kind: 'list' })}>
                <ArrowLeft /> Quay lại
              </Button>
              <DialogTitle>
                {mode.editing ? 'Sửa đợt chiếu' : 'Thêm đợt chiếu'}
              </DialogTitle>
            </DialogHeader>
            <MovieRunForm
              initial={mode.editing}
              onSubmit={async (data) => {
                await save(data);
                setMode({ kind: 'list' });  // back to list, query auto-refetch
              }}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

### Trade-off

| Lợi | Hại |
|---|---|
| 1 backdrop, 1 modal — UX clean | Component lớn hơn (2 layout trong 1 file) |
| Animation transition giữa 2 mode dễ control | Phải maintain `mode` state |
| Mobile-friendly | Khi reload dialog, mode reset về list (có thể là feature) |
| Esc chỉ đóng 1 dialog — không ambiguous | |

### Ví dụ trong CineX

File: `frontend/src/features/admin/MovieRunsDialog.tsx`

Áp dụng cho mọi flow "list + create/edit" trong cùng dialog:
- MovieRunsDialog (chính)
- (Có thể adopt) ShowtimeGroupDialog, AdminGenreDialog...

### Khi nào KHÔNG nên dùng?

- Form rất nhỏ (1-2 field) → nên inline trong row (inline edit) thay vì mở form mode
- Cần xem list + form **đồng thời** (vd: drag-drop reorder) → split panel, không phải mode switch

---

## 5. ShedLock cho Scheduler trong Multi-Instance HA

### Bài toán

Production deploy 2+ backend instance (HA — high availability). Mỗi instance có Spring `@Scheduled` chạy cùng cron.

```java
@Scheduled(cron = "0 1 0 * * *")
public void updateMovieRunStatus() {
    // Cả Node A và Node B đều chạy lúc 00:01
}
```

→ 2 transaction cùng UPDATE 1 row → optimistic lock fail, hoặc 2 lần log "100 run chuyển status" (mỗi node 1 lần) — lãng phí + có thể race condition.

### Giải pháp — ShedLock

Library `net.javacrumbs:shedlock-spring` — distributed lock qua DB hoặc Redis.

```java
@Scheduled(cron = "0 1 0 * * *")
@SchedulerLock(
    name = "movieRunStatusUpdate",       // unique lock name
    lockAtLeastFor = "PT1M",              // giữ lock TỐI THIỂU 1 phút
    lockAtMostFor = "PT10M"               // release sau 10 phút nếu node die
)
@Transactional
public void updateMovieRunStatus() {
    // Chỉ 1 instance lấy được lock — chạy. Các instance khác skip.
}
```

ShedLock ghi vào bảng `shedlock` (tự tạo):

```
| name                    | lock_until           | locked_at            | locked_by |
| movieRunStatusUpdate    | 2026-06-08 00:11:00  | 2026-06-08 00:01:00  | node-A    |
```

Khi cron fire:
1. Node A INSERT/UPDATE row với `lock_until = now + 10min` (atomic)
2. Node B thử INSERT/UPDATE — fail vì row đã có `lock_until > now`
3. Node A chạy job, sau xong UPDATE `lock_until = max(now, locked_at + 1min)` (giữ lock tối thiểu 1 phút)

### Tham số quan trọng

- **`lockAtLeastFor`**: Chống clock skew. Nếu Node A xong sớm + release lock, Node B (clock chậm hơn vài giây) có thể vào sau và chạy lại job. Giữ lock tối thiểu để chống.
- **`lockAtMostFor`**: Nếu Node A crash giữa chừng (kill -9), lock không release tự nhiên. Sau `lockAtMostFor`, Node B có thể lấy lock chạy job thay.

### Trade-off

| Lợi | Hại |
|---|---|
| Job chạy đúng 1 lần dù có N instance | Thêm dependency + 1 bảng DB |
| Không cần "leader election" cluster | Lock contention nhẹ ở DB (1 row update/cron) |
| Chống job concurrent với chính nó (job chậm còn chạy, cron tiếp tục fire) | Phải pick `lockAtMostFor` đủ lớn (job có thể chạy lâu hơn ước tính) |

### Ví dụ trong CineX

- `MovieRunStatusScheduler` (cron daily 00:01)
- `BookingCleanupScheduler` (cron mỗi phút — clean up booking HOLDING hết hạn)

### Pitfall

- **Quên `@SchedulerLock`** khi multi-instance → bug âm thầm (job chạy 2 lần, có thể double-insert)
- **`lockAtMostFor` quá ngắn** → job đang chạy, lock release, instance khác cũng chạy → 2 lần
- **`lockAtMostFor` quá dài** → node crash, mọi node chờ lock release (vd 1 tiếng) → job pause

Quy tắc thumb: `lockAtMostFor = 2 × execution_time_p99`.

---

## 6. JPQL Bulk Update với `clearAutomatically = true`

### Bài toán

Cascade archive: 1 movie có 1000 reviews. Cách naive:

```java
List<Review> reviews = reviewRepository.findByMovieId(movieId);
for (Review r : reviews) {
    r.setStorageState(StorageState.ARCHIVED);
    reviewRepository.save(r);
}
```

→ 1 SELECT + 1000 UPDATE = 1001 query. SLOW + tốn memory.

### Giải pháp — JPQL bulk UPDATE

```java
@Modifying(clearAutomatically = true)
@Query("UPDATE Review r SET r.storageState = ARCHIVED " +
       "WHERE r.movie.id = :movieId AND r.storageState <> ARCHIVED")
int archiveByMovieId(@Param("movieId") Long movieId);
```

1 query duy nhất, return số row updated. Nhanh hơn 1000x.

### Vì sao cần `clearAutomatically = true`?

JPA có **first-level cache** (Persistence Context) — cache entity đã load trong transaction.

Sequence:
1. Service load `Review #5` → entity vào Persistence Context, status = ACTIVE
2. Service gọi `archiveByMovieId(42)` — JPQL UPDATE direct vào DB
3. Service gọi `reviewRepository.findById(5)` — JPA TRẢ ENTITY CŨ TRONG CACHE (status = ACTIVE) — vì cache không biết DB đã update!

→ Bug! Cache stale.

`clearAutomatically = true` bảo JPA: sau khi UPDATE thành công, **clear Persistence Context** → lần findById tiếp theo query lại DB → trả status mới ARCHIVED.

### Trade-off

| Lợi | Hại |
|---|---|
| Nhanh hơn N+1 save 100-1000x | Clear cache TOÀN BỘ entity (không chỉ Review) — entity khác phải reload nếu dùng lại |
| Atomic ở DB level | Mất @PreUpdate / Auditable listener (vì không qua entity lifecycle) |
| Tránh memory full khi nhiều row | Phải explicit ghi `<>` ARCHIVED để idempotent |

### Pitfall

**Quên `clearAutomatically`** → bug "tôi đã xóa rồi mà sao status vẫn ACTIVE?" trong cùng transaction. Hay xảy ra khi:
- Bulk update + sau đó load lại entity để build DTO response
- Bulk update + sau đó check condition trên entity vừa update

Quy tắc: **MỌI `@Modifying` đụng entity có thể đang trong cache → bật `clearAutomatically = true`**.

### Ví dụ trong CineX

- `ReviewRepository.archiveByMovieId` / `unarchiveByMovieId` (cascade Movie archive)
- `UserFavoriteRepository.deleteByMovieId` (cascade hard delete)
- `MovieRunRepository.archiveByMovieId` (cascade Movie archive sang runs)

---

## 7. Overlap Check Formula

### Bài toán

Chống trùng khoảng thời gian:
- 2 showtime trong cùng room không được chồng giờ
- 2 MovieRun của cùng movie không được chồng ngày
- 2 voucher campaign không được chồng đợt áp dụng

### Công thức

2 khoảng đóng `[a, b]` và `[c, d]` overlap (giao khác rỗng) ⇔

```
a ≤ d  AND  c ≤ b
```

**Tại sao công thức này đúng?**

Phủ định: KHÔNG overlap khi `[a,b]` hoàn toàn TRƯỚC `[c,d]` HOẶC hoàn toàn SAU.

- Hoàn toàn trước: `b < c`
- Hoàn toàn sau: `a > d`

Negation (overlap):
```
NOT (b < c OR a > d)
= NOT(b < c) AND NOT(a > d)
= b >= c AND a <= d
= c <= b AND a <= d
```

Đây là công thức **half-open** với `<=` (overlap khi chạm biên cũng tính). Muốn strict (chạm biên không tính): đổi `<` thay `<=`.

### Ví dụ trong CineX

**MovieRun overlap check** (`MovieRunRepository.existsOverlap`):

```java
@Query("SELECT COUNT(r) > 0 FROM MovieRun r " +
       "WHERE r.movie.id = :movieId " +
       "  AND r.storageState <> ARCHIVED " +
       "  AND r.id <> :excludeId " +
       "  AND r.startDate <= :end " +     // a ≤ d
       "  AND :start <= r.endDate")        // c ≤ b
boolean existsOverlap(Long movieId, LocalDate start, LocalDate end, Long excludeId);
```

`excludeId` để UPDATE chính run đó không bị tính overlap với chính nó.

**Showtime conflict trong room** — tương tự nhưng theo giờ thay vì ngày:

```sql
SELECT COUNT(*) > 0 FROM showtimes
WHERE room_id = ?
  AND status <> 'CANCELLED'
  AND start_time <= ?     -- new slot end
  AND ? <= slot_end_time  -- new slot start
```

### Trade-off

| Approach | Lợi | Hại |
|---|---|---|
| Check ở app | Linh hoạt | Race condition: 2 request đồng thời, cả 2 check qua, cả 2 insert |
| Check ở DB constraint (exclude constraint Postgres) | Atomic | SQL Server không có `EXCLUDE` constraint native — phải dùng trigger hoặc app-level lock |

CineX dùng app-level check + transaction isolation `READ_COMMITTED` (default) — đủ với traffic dự kiến. Khi scale → cân nhắc pessimistic lock trên row movie/room.

---

## 8. Auto-pick FK Strategy (UX vs Explicit)

### Bài toán

Admin tạo showtime cho phim X. Phim X có 2 đợt chiếu (FIRST_RUN ENDED + REISSUE NOW_SHOWING). Showtime phải link tới MovieRun nào?

- **Explicit mode:** Bắt admin chọn run từ dropdown. Chính xác nhưng phiền — 90% case chỉ có 1 run active.
- **Default mode:** Service tự pick. UX nhanh nhưng đôi khi sai (admin muốn run cụ thể).

### Giải pháp — Hybrid

API nhận `movieId` (bắt buộc) + `movieRunId` (optional):

```java
public ShowtimeResponse createShowtime(ShowtimeRequest request) {
    Movie movie = movieRepository.findById(request.getMovieId()).orElseThrow();
    MovieRun run = resolveMovieRun(movie, request.getMovieRunId());
    // ... create showtime với run
}

private MovieRun resolveMovieRun(Movie movie, Long requestedRunId) {
    if (requestedRunId != null) {
        // Explicit: admin truyền cụ thể
        MovieRun run = movieRunRepository.findById(requestedRunId).orElseThrow();
        if (!run.getMovie().getId().equals(movie.getId())) {
            throw new BusinessException("MovieRun không thuộc movie này");
        }
        return run;
    }
    // Auto-pick: NOW_SHOWING ưu tiên > nearest SCHEDULED
    return autoPickRun(movie);
}

private MovieRun autoPickRun(Movie movie) {
    List<MovieRun> nowShowing = movieRunRepository
            .findByMovieIdAndStatusOrderByStartDateDesc(movie.getId(), NOW_SHOWING);
    if (!nowShowing.isEmpty()) return nowShowing.get(0);

    List<MovieRun> scheduled = movieRunRepository
            .findByMovieIdAndStatusOrderByStartDateAsc(movie.getId(), SCHEDULED);
    if (!scheduled.isEmpty()) return scheduled.get(0);

    throw new BusinessException("Phim '" + movie.getTitle()
        + "' chưa có đợt chiếu nào active. Vui lòng tạo đợt chiếu trước.");
}
```

### Strategy: NOW_SHOWING > SCHEDULED

- Showtime mới tạo thường là **chiếu trong vài ngày tới** → nằm trong run NOW_SHOWING đang chạy
- Nếu phim chưa khởi chiếu (chỉ có SCHEDULED) → pick run sắp tới
- Không bao giờ pick run ENDED — không tạo showtime cho đợt đã hết

### Trade-off

| Approach | UX | Chính xác |
|---|---|---|
| Pure explicit | Phiền | 100% admin control |
| Pure auto | Nhanh | Sai khi phim có 2+ run active |
| **Hybrid (CineX)** | Nhanh 90% case, explicit khi cần | Chính xác cao + admin override được |

### Ví dụ khác

- Default address pick khi checkout: pick address `is_default = true` nếu user không chọn cụ thể
- Default voucher: nếu nhiều voucher applicable, pick voucher giảm nhiều nhất

### Pitfall

- **Auto-pick mơ hồ** → admin tạo nhầm showtime cho FIRST_RUN ENDED → confusion. **Fix:** auto-pick có rule rõ ràng + log lựa chọn để admin verify
- **FE không show** run được pick → admin không biết. **Fix:** Response include `movieRunId + runType` để FE confirm

---

## 9. Application-local.yml Pattern (Spring profiles)

### Bài toán

Spring config có secret (DB password, Cloudinary key, JWT secret). Yêu cầu mâu thuẫn:

- **Dev local:** muốn config full để chạy `./gradlew bootRun` không phải set env
- **Production:** secret từ environment variable / vault, KHÔNG commit lên git
- **Git history:** secret commit nhầm → khó xóa khỏi history → leak vĩnh viễn

### Giải pháp — 3-file overlay

```
src/main/resources/
├── application.yml              # base config, require env (FAIL nếu thiếu)
├── application-dev.yml          # placeholder cho dev (vd: db.url localhost:1433)
└── application-local.yml        # GITIGNORED — secret thật ở local
```

**`application.yml`** (commit lên git):

```yaml
spring:
  config:
    import: optional:classpath:application-local.yml
  datasource:
    url: ${DB_URL}                    # FAIL nếu thiếu env
    username: ${DB_USERNAME}
    password: ${DB_PASSWORD}
  profiles:
    active: ${SPRING_PROFILES_ACTIVE:dev}

cloudinary:
  cloud-name: ${CLOUDINARY_CLOUD_NAME}
  api-key:    ${CLOUDINARY_API_KEY}
  api-secret: ${CLOUDINARY_API_SECRET}
```

**`application-dev.yml`** (commit lên git):

```yaml
# Placeholder + default cho dev local
spring:
  datasource:
    url: jdbc:sqlserver://localhost:1433;databaseName=cinex;encrypt=true;trustServerCertificate=true
    username: sa
    # password: KHÔNG để ở đây — đặt trong application-local.yml
```

**`application-local.yml`** (gitignored — `.gitignore: application-local.yml`):

```yaml
spring:
  datasource:
    password: CineX@2026   # local secret thật

cloudinary:
  cloud-name: dxxx
  api-key:    "123456789012345"
  api-secret: "abc...xyz"

jwt:
  secret: my-local-jwt-secret-256-bits
```

**`.gitignore`**:
```
src/main/resources/application-local.yml
```

### Cách Spring resolve

1. Spring load `application.yml` — gặp `spring.config.import: optional:classpath:application-local.yml`
2. Nếu file `application-local.yml` tồn tại (dev local) → load + override
3. Nếu không tồn tại (production) → skip (optional: → không fail)
4. Resolve `${DB_PASSWORD}` từ env var hệ thống (production set qua docker-compose / K8s secret)

### Trade-off

| Lợi | Hại |
|---|---|
| Dev không phải set env mỗi lần restart | Phải nhớ tạo `application-local.yml` lần đầu setup |
| Production fail-fast nếu thiếu env (không bao giờ chạy với password rỗng) | 3 file nhiều hơn 1 file |
| Secret không lên git vĩnh viễn | Phải document cho dev mới biết tạo file |
| Override dễ — bật/tắt feature qua local file | |

### Ví dụ trong CineX

File `backend/src/main/resources/application.yml`:

```yaml
spring:
  config:
    import: optional:classpath:application-local.yml
```

Setup guide cho dev mới: `docs/project/setup.md` — bước "Tạo `application-local.yml` từ template `application-local.example.yml`".

### Pattern liên quan — `optional:`

Prefix `optional:` cho phép import file không tồn tại mà không fail. Hữu ích cho:
- Config file riêng từng dev
- Feature flag file: `optional:classpath:feature-flags.yml`
- Module config nhỏ tách riêng: `optional:classpath:redis-cache.yml`

### Pitfall

- **Quên `.gitignore`** → commit secret lên git lần đầu. Fix: setup `.gitignore` TRƯỚC khi tạo `application-local.yml`
- **Không có `optional:`** → production thiếu file → app crash startup. Phải đúng prefix `optional:`
- **Override sai thứ tự** → secret bị placeholder dev override (priority Spring config rất tricky). Quy tắc: profile-specific (`application-dev.yml`) và local file (`application-local.yml`) BOTH override `application.yml`. Tham khảo doc Spring "External Config" để hiểu thứ tự ưu tiên đầy đủ.

---

## Tóm tắt — Khi nào dùng pattern nào?

| Tình huống | Pattern |
|---|---|
| Filtered unique index cần cột bảng khác | 1. Denormalized FK |
| Derived value đã có trong API contract | 2. Derived Status (Option B) |
| Đổi schema có data thật, schema không nullable | 3. 2-Phase Migration |
| List + create/edit form cùng dialog | 4. Single Dialog 2-Modes |
| `@Scheduled` trong multi-instance | 5. ShedLock |
| Bulk UPDATE entity có thể đang trong cache | 6. JPQL `clearAutomatically` |
| Chống trùng khoảng thời gian | 7. Overlap formula `a ≤ d AND c ≤ b` |
| FK link 1-vài, 90% case rõ ràng | 8. Auto-pick + Explicit override |
| Spring secret dev vs production | 9. application-local.yml |

## Tham khảo trong CineX

- Pattern 1: `docs/module-guides/09-booking-explained.md` (BookingSeat.showtimeId)
- Pattern 2, 5, 7, 8: `docs/module-guides/05-movie-explained.md` Section 4 (MovieRun refactor)
- Pattern 3: `db/changelog/changes/051-create-movie-runs-table.xml` + `052-...not-null.xml`
- Pattern 4: `frontend/src/features/admin/MovieRunsDialog.tsx`
- Pattern 6: `module/review/repository/ReviewRepository.java` (`archiveByMovieId`)
- Pattern 9: `backend/src/main/resources/application.yml` + setup guide

## Bài tập tự kiểm tra

1. Vì sao filtered unique index ở SQL Server không reference được cột bảng khác? Nếu cần, làm sao?
2. So sánh Option A (drop field, compute on-demand) vs Option B (giữ field, recompute) — khi nào A tốt hơn?
3. 2-phase migration có 1 phase "verify ngoài Liquibase" giữa Phase 1 và Phase 2. Verify cái gì cụ thể?
4. ShedLock dùng `lockAtLeastFor = "PT5S"` đủ chưa nếu clock skew của cluster có thể tới 30 giây?
5. `@Modifying` không có `clearAutomatically = true` — viết test case demo bug stale cache.
6. Voucher campaign overlap check: `[a,b]` chạm biên `[b,c]` — có tính overlap không? Tùy business — viết SQL cho cả 2 trường hợp.
7. Auto-pick MovieRun chọn NOW_SHOWING ưu tiên > SCHEDULED. Phim có 2 run NOW_SHOWING cùng lúc — pick run nào? Tại sao?
8. Tại sao `optional:` prefix cần thiết cho `application-local.yml`? Bỏ đi có vấn đề gì?
