# Liquibase — Quản lý schema database

> **Cập nhật 2026-06-10:** Schema đã được consolidate từ 72 changesets evolution → **17 file sạch** theo domain. Tài liệu này phản ánh cấu trúc hiện tại.

---

## 1. Liquibase là gì? Tại sao dùng?

Liquibase là công cụ **versioned migration cho database schema** — tương tự cách Git versioned source code.

### So sánh với các cách khác

| Vấn đề | `ddl-auto=update` | SQL script tay | Liquibase |
|---|---|---|---|
| **Xóa cột** | Có thể xóa → MẤT DATA | Phải nhớ đã chạy chưa | Track tự động, idempotent |
| **Track lịch sử** | ❌ | ❌ (trừ khi tự đặt convention) | ✓ Bảng DATABASECHANGELOG |
| **Rollback** | ❌ | Phải viết SQL ngược tay | ✓ Tự sinh nếu khai báo `rollback` |
| **Multi-dev** | Conflict im lặng | Phải coordinate manual | Mỗi changeset có ID unique, fail-fast nếu trùng |
| **CI/CD production** | TUYỆT ĐỐI KHÔNG DÙNG | Risky | Industry standard |

**CineX:**
- `spring.jpa.hibernate.ddl-auto=validate` — Hibernate CHỈ verify schema khớp entity, không tự sửa
- `spring.liquibase.change-log=classpath:db/changelog/db.changelog-master.xml` — Liquibase tự run lúc startup

---

## 2. Cấu trúc thư mục

```
backend/src/main/resources/db/changelog/
├── db.changelog-master.xml           # Master file include 17 changelog
└── changes/
    ├── 001-core-tables.xml           # SCHEMA — users, theaters, auth tokens, system_config, ...
    ├── 002-catalog-tables.xml        # SCHEMA — genres, movies, movie_runs
    ├── 003-cinema-tables.xml         # SCHEMA — rooms, seats, showtimes, pricing_rules
    ├── 004-booking-tables.xml        # SCHEMA — bookings, booking_seats, payments
    ├── 005-pos-tables.xml            # SCHEMA — snacks, combos, snack_orders
    ├── 006-engagement-tables.xml     # SCHEMA — reviews, favorites, notifications, loyalty
    ├── 007-voucher-tables.xml        # SCHEMA — vouchers, voucher_usages
    ├── 008-check-constraints.xml     # SCHEMA — CHECK constraint cho 20+ enum columns
    ├── 009-seed-system-config.xml    # SEED — 21 config keys + 3 id_tracker prefixes
    ├── 010-seed-theaters.xml         # SEED — 5 chi nhánh HN/HP/QN/DN/HCM
    ├── 011-seed-users.xml            # SEED — admin tổng + 5 branch admins + 8 customers
    ├── 012-seed-genres.xml           # SEED — 15 thể loại phim
    ├── 013-seed-movies-and-runs.xml  # SEED — 18 phim + movie_genres + movie_runs đa dạng
    ├── 014-seed-rooms-seats-pricing.xml # SEED — 20 phòng + 1920 ghế + 5 pricing rules
    ├── 015-seed-snacks-combos.xml    # SEED — 40 snack + 15 combo per-theater
    ├── 016-seed-showtimes-vouchers.xml # SEED — ~1000 showtimes 14 ngày + 7 voucher
    └── 017-fix-system-config-encoding.xml # FIX-FORWARD — sửa encoding tiếng Việt
```

**Quy ước:** mỗi file = 1 domain. Số đầu là thứ tự apply (Liquibase đọc theo `<include>` order trong master).

---

## 3. Anatomy một changelog file

```xml
<?xml version="1.0" encoding="UTF-8"?>
<databaseChangeLog
        xmlns="http://www.liquibase.org/xml/ns/dbchangelog"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.liquibase.org/xml/ns/dbchangelog
        http://www.liquibase.org/xml/ns/dbchangelog/dbchangelog-latest.xsd">

    <!-- 1 file có nhiều changeSet, mỗi cái là 1 unit atomic -->
    <changeSet id="001-create-theaters" author="cinex">
        <createTable tableName="theaters">
            <column name="id" type="BIGINT" autoIncrement="true">
                <constraints primaryKey="true" nullable="false"/>
            </column>
            <column name="code" type="NVARCHAR(30)">
                <constraints nullable="false" unique="true"/>
            </column>
            <!-- ... -->
        </createTable>

        <createIndex tableName="theaters" indexName="idx_theaters_city">
            <column name="city"/>
        </createIndex>
    </changeSet>
</databaseChangeLog>
```

**Attribute quan trọng:**

| Attribute | Vai trò |
|---|---|
| `id` | Unique trong file + author. Liquibase dùng để detect đã apply chưa |
| `author` | Người tạo (convention: "cinex") |
| `runOnChange="true"` | Re-run mỗi khi nội dung file đổi (cho stored proc/views) |
| `failOnError="false"` | Tiếp tục dù changeset này fail |
| `context="dev"` | Chỉ chạy ở môi trường dev (qua `spring.liquibase.contexts=dev`) |

---

## 4. DATABASECHANGELOG — "Sổ ghi chép"

Liquibase tự tạo bảng `DATABASECHANGELOG` trong DB lúc chạy lần đầu, ghi lại mọi changeset đã apply:

```
┌────────────────────────┬────────┬──────────────────────────────────────────┬──────────────────────────┬──────────────────────┐
│ ID                     │ AUTHOR │ FILENAME                                 │ DATEEXECUTED             │ MD5SUM               │
├────────────────────────┼────────┼──────────────────────────────────────────┼──────────────────────────┼──────────────────────┤
│ 001-create-theaters    │ cinex  │ db/changelog/changes/001-core-tables.xml │ 2026-06-10 22:31:15.567  │ 9:abc123...          │
│ 001-create-users       │ cinex  │ db/changelog/changes/001-core-tables.xml │ 2026-06-10 22:31:15.789  │ 9:def456...          │
│ ...                    │ ...    │ ...                                      │ ...                      │ ...                  │
└────────────────────────┴────────┴──────────────────────────────────────────┴──────────────────────────┴──────────────────────┘
```

**MD5SUM** = checksum của nội dung changeset. Liquibase verify lúc run:
- File hash khớp → SKIP (đã apply rồi)
- File hash không khớp → throw `ValidationFailedException`

**→ Quy tắc vàng:** **TUYỆT ĐỐI KHÔNG sửa nội dung changeset đã apply**. Thay vào đó thêm changeset mới (fix-forward pattern — xem mục 7).

---

## 5. Lý do consolidate 72 → 17 file

### Vấn đề ban đầu

Dự án evolution qua nhiều giai đoạn, mỗi feature/refactor sinh ra 1-2 changeset:
- 001-create-users-table
- 002-create-refresh-tokens
- ... (60 changeset đầu)
- 060-add-user-theater-and-super-admin-role (add column theater_id vào users)
- 061-add-snack-theater-id (rename + index lại)
- 066-movie-run-per-theater (refactor lớn)
- 070-add-booking-theater-id
- 071-add-user-date-of-birth
- 072-migrate-age-rating-c-to-t18

**Tổng cộng 72 file** — pain points:
- Khó đọc: muốn hiểu schema hiện tại phải đọc 72 file rồi mental-merge
- Dev mới onboard: ngợp
- DB mới: phải chạy 72 migration mất 30+ giây startup time
- Track history: chỉ cần xem git log của file, không cần lưu trong DB migration

### Quyết định: consolidate

Lúc dev project + không có production DB cần preserve → **safe to wipe and re-init**.

**Cách làm:** xóa toàn bộ 72 file → viết lại 8 file SCHEMA + 9 file SEED + FIX, gom theo domain.

### Khi nào KHÔNG nên consolidate?

- **Có production DB đang chạy** → consolidate sẽ phá DB. Phải dùng `<changeSetIgnore>` hoặc `liquibase.databasechangelog` manual hack
- **Team nhiều dev cùng pull/merge** → có thể có dev đang dùng schema cũ

CineX là dự án dev local → wipe-and-rebuild OK. Production cần strategy khác (xem `docs/database/consolidation-strategy.md`).

---

## 6. Một số "gotcha" thường gặp

### 6.1. SQL Server NVARCHAR cần `N'...'` prefix cho Unicode

```xml
<!-- SAI — tiếng Việt mất dấu khi lưu vào NVARCHAR -->
<sql>INSERT INTO genres (name) VALUES ('Hành động');</sql>

<!-- ĐÚNG — N' báo SQL Server đây là Unicode literal -->
<sql>INSERT INTO genres (name) VALUES (N'Hành động');</sql>
```

CineX đã từng bị (commit `3415e29` fix file 017): seed `system_config` quên `N'` → description bị "S? phút gi? gh?".

### 6.2. `splitStatements="false"` cho T-SQL có biến local

Liquibase mặc định split SQL theo `;` thành nhiều statement → mỗi statement chạy độc lập. T-SQL biến local `@today` declared ở statement 1 KHÔNG tồn tại ở statement sau:

```xml
<!-- SAI — DECLARE và INSERT bị tách → @today không recognize -->
<sql>
    DECLARE @today DATE = CAST(GETDATE() AS DATE);
    INSERT INTO movie_runs (start_date) VALUES (@today);
</sql>

<!-- ĐÚNG — cả block 1 batch -->
<sql splitStatements="false" endDelimiter="GO">
    DECLARE @today DATE = CAST(GETDATE() AS DATE);
    INSERT INTO movie_runs (start_date) VALUES (@today);
</sql>
```

### 6.3. XML escape `&`, `<`, `>`

```xml
<!-- SAI — XML parser fail -->
<sql>INSERT INTO movies (title) VALUES (N'Tom & Jerry');</sql>

<!-- ĐÚNG — escape -->
<sql>INSERT INTO movies (title) VALUES (N'Tom &amp; Jerry');</sql>

<!-- Hoặc bọc trong CDATA -->
<sql><![CDATA[
    INSERT INTO movies (title) VALUES (N'Tom & Jerry');
]]></sql>
```

### 6.4. SQL Server filtered unique index — phải dùng raw SQL

Liquibase không có abstraction cho filtered unique index. Phải dùng `<sql>`:

```xml
<changeSet id="004-create-booking-seats" author="cinex">
    <!-- ... createTable ... -->
    <sql>
        CREATE UNIQUE INDEX uq_booking_seats_active
        ON booking_seats(showtime_id, seat_id)
        WHERE status IN ('HELD', 'BOOKED');
    </sql>
</changeSet>
```

### 6.5. CHECK constraint multi-line — phải dùng raw SQL

```xml
<sql>
    ALTER TABLE snack_order_items
    ADD CONSTRAINT chk_snack_order_item_xor
    CHECK ((snack_id IS NOT NULL AND combo_id IS NULL)
        OR (snack_id IS NULL AND combo_id IS NOT NULL));
</sql>
```

---

## 7. Fix-forward pattern khi data bị bug

**Tình huống:** Đã wipe DB + apply 017 changeset. Phát hiện file 009 có bug (vd thiếu `N'` prefix cho tiếng Việt).

**KHÔNG được:** sửa file 009 → checksum mismatch → Liquibase throw `ValidationFailedException`.

**Pattern đúng (fix-forward):**
1. File 009 giữ NGUYÊN (data insert ban đầu bị bug)
2. Thêm file mới `017-fix-system-config-encoding.xml`:
   ```xml
   <changeSet id="017-fix-system-config-encoding" author="cinex">
       <sql splitStatements="false" endDelimiter="GO">
           UPDATE system_config SET description = N'Số phút giữ ghế chờ thanh toán'
           WHERE config_key = 'booking.hold_minutes';
           -- ...
       </sql>
   </changeSet>
   ```
3. Update master `db.changelog-master.xml` include thêm 017
4. Restart BE → Liquibase apply 017 → UPDATE chạy đúng với `N'` → data fix

**Net effect cho dev mới wipe DB:**
- 009 insert data bị bug (description sai encoding)
- 017 ngay sau UPDATE đúng
- Kết quả cuối: data sạch

Đây là pattern Liquibase official khuyên — KHÔNG bao giờ sửa nội dung apply đã chạy.

---

## 8. Khi nào nên thêm changeset mới?

| Thay đổi | Changeset cần |
|---|---|
| Thêm cột | `<addColumn>` |
| Đổi tên cột | `<renameColumn>` + `<sql>` cập nhật data nếu cần |
| Đổi kiểu cột | `<modifyDataType>` (cẩn thận data loss) |
| Thêm index | `<createIndex>` |
| Thêm FK | `<addForeignKeyConstraint>` |
| Sửa data hiện có | `<sql>UPDATE ...</sql>` |
| Insert seed mới | `<sql>INSERT ...</sql>` hoặc `<insert>` |
| Drop column/table | `<dropColumn>` / `<dropTable>` (cảnh báo: irreversible nếu không rollback) |

### Quy tắc đặt tên file mới

- Format: `NNN-description-kebab-case.xml`
- `NNN` = số tiếp theo (017 hiện tại → 018 tiếp theo)
- Description ngắn gọn: `018-add-user-phone-verified.xml`, `019-fix-snack-prices.xml`

### Steps thêm migration:

1. Tạo file `backend/src/main/resources/db/changelog/changes/NNN-something.xml`
2. Update `db.changelog-master.xml`:
   ```xml
   <include file="db/changelog/changes/NNN-something.xml"/>
   ```
3. Restart BE → Liquibase tự apply

---

## 9. Lệnh CLI hữu ích (debug)

Liquibase tích hợp Spring Boot tự chạy lúc startup. Nhưng khi debug, dùng CLI:

```bash
# Status — xem migrations nào chưa apply
./gradlew liquibaseStatus

# Validate — verify checksum
./gradlew liquibaseValidate

# Rollback 1 changeset cuối
./gradlew liquibaseRollbackCount -PliquibaseCommandValue=1

# Drop all + reapply (nguy hiểm production)
./gradlew liquibaseDropAll
./gradlew liquibaseUpdate
```

---

## 10. Tham khảo thêm

- [Liquibase official docs](https://docs.liquibase.com/) — Reference XML tags + best practices
- [SQL Server T-SQL syntax](https://learn.microsoft.com/sql/t-sql/language-reference) — Cho seed scripts phức tạp
- [docs/setup-fresh-db.md](../setup-fresh-db.md) — Hướng dẫn wipe + init DB
