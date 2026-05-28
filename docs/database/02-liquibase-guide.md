# Liquibase — Quản lý schema database chi tiết

## 1. Liquibase là gì?

Liquibase là công cụ **quản lý version cho database schema** (bảng, cột, index, ...).
Giống Git quản lý version code → Liquibase quản lý version DB.

### Ví dụ đời thường

**Không có Liquibase:** Thợ xây tự ý sửa nhà, không ghi chép. Ai muốn biết nhà đã sửa gì → không biết.
**Có Liquibase:** Mỗi lần sửa nhà → ghi vào sổ (changeset). Ai đọc sổ đều biết: ngày nào sửa gì, ai sửa.

### Tại sao không dùng `ddl-auto=update`?

| Vấn đề | ddl-auto=update | Liquibase |
|---|---|---|
| Xóa cột | Có thể xóa → **MẤT DATA** | Phải viết changeset rõ ràng |
| Track lịch sử | Không biết ai sửa gì | Bảng DATABASECHANGELOG ghi lại |
| Rollback | Không thể | Có thể rollback từng changeset |
| Team nhiều dev | Dev A thêm cột, Dev B không biết | Mỗi dev tạo changeset, merge qua Git |
| Production | **TUYỆT ĐỐI KHÔNG DÙNG** | An toàn, kiểm soát được |

**CineX dùng:** `ddl-auto=validate` — Hibernate chỉ **kiểm tra** schema khớp entity, KHÔNG tự sửa.

---

## 2. DATABASECHANGELOG — "Sổ ghi chép" của Liquibase

### Bảng này để làm gì?

Liquibase **tự tạo** bảng `DATABASECHANGELOG` trong DB khi chạy lần đầu. Bảng này ghi lại **mỗi changeset đã chạy**:

```
┌─────┬────────┬──────────────────────────────────────────────┬────────────────────┬──────────────────┐
│ ID  │ AUTHOR │ FILENAME                                     │ DATEEXECUTED       │ MD5SUM           │
├─────┼────────┼──────────────────────────────────────────────┼────────────────────┼──────────────────┤
│ 001 │ cinex  │ db/changelog/changes/001-create-users.xml    │ 2026-05-12 20:00   │ 8:abc123...      │
│ 002 │ cinex  │ db/changelog/changes/002-create-refresh.xml  │ 2026-05-12 20:00   │ 8:def456...      │
│ 003 │ cinex  │ db/changelog/changes/003-create-id-track.xml │ 2026-05-12 20:01   │ 8:ghi789...      │
│ ... │ ...    │ ...                                          │ ...                │ ...              │
│ 015 │ cinex  │ db/changelog/changes/015-create-password.xml │ 2026-05-20 14:00   │ 8:xyz999...      │
└─────┴────────┴──────────────────────────────────────────────┴────────────────────┴──────────────────┘
```

### Cách Liquibase dùng bảng này

```
Backend start (./gradlew bootRun)
    │
    ▼
Liquibase đọc db.changelog-master.xml → tìm 15 changeset files
    │
    ▼
Query: SELECT * FROM DATABASECHANGELOG
    │
    ▼
So sánh:
    001 → có trong DB → BỎ QUA ✅
    002 → có trong DB → BỎ QUA ✅
    ...
    013 → có trong DB → BỎ QUA ✅
    014 → CHƯA CÓ → CHẠY! (CREATE TABLE vouchers)
    015 → CHƯA CÓ → CHẠY! (CREATE TABLE password_reset_tokens)
    │
    ▼
Sau khi chạy xong → INSERT vào DATABASECHANGELOG:
    (014, cinex, ..., 2026-05-20, md5sum)
    (015, cinex, ..., 2026-05-20, md5sum)
    │
    ▼
Lần start tiếp theo: 014, 015 đã có → bỏ qua → KHÔNG chạy lại
```

### MD5SUM — Checksum chống sửa changeset đã chạy

```
MD5SUM = hash nội dung changeset file

Changeset 001 đã chạy với MD5SUM = "8:abc123"

Nếu ai đó SỬA file 001-create-users.xml:
    → Liquibase tính lại MD5SUM = "8:xyz999" (khác!)
    → So sánh với DB: "8:abc123" ≠ "8:xyz999"
    → LỖI: "Validation Failed: checksum mismatch for changeset 001"
    → Backend KHÔNG START!

Tại sao: vì changeset đã chạy rồi, DB đã thay đổi rồi.
Sửa file = nói dối "tôi chưa thay đổi gì" → nguy hiểm.
Muốn thay đổi → TẠO CHANGESET MỚI (016, 017, ...)
```

---

## 3. DATABASECHANGELOGLOCK — Chống chạy đồng thời

### Bảng này để làm gì?

Khi Liquibase chạy, nó **lock** bảng này để đảm bảo **chỉ 1 instance chạy migration tại 1 thời điểm**.

```
┌────┬────────┬────────────────────┬─────────────────────┐
│ ID │ LOCKED │ LOCKGRANTED        │ LOCKEDBY            │
├────┼────────┼────────────────────┼─────────────────────┤
│ 1  │ true   │ 2026-05-20 14:00   │ MacBook-Air (ip)    │
└────┴────────┴────────────────────┴─────────────────────┘
```

### Tại sao cần lock?

```
Tình huống: 2 server start cùng lúc (scale 2 instances)

KHÔNG có lock:
    Server A: CREATE TABLE vouchers     ← đang chạy
    Server B: CREATE TABLE vouchers     ← cũng chạy → LỖI: table already exists!

CÓ lock:
    Server A: LOCK → CREATE TABLE vouchers → UNLOCK
    Server B: chờ... → lock available → check DATABASECHANGELOG → 014 đã chạy → BỎ QUA ✅
```

### Lỗi thường gặp: Lock bị kẹt

```
Tình huống: backend crash giữa chừng migration → lock KHÔNG được release
Lần start tiếp: "Waiting for changelog lock..."  → chờ mãi

Fix:
-- Chạy SQL thủ công:
UPDATE DATABASECHANGELOGLOCK SET LOCKED = 0 WHERE ID = 1
-- Hoặc:
DELETE FROM DATABASECHANGELOGLOCK
```

---

## 4. Team nhiều dev — Xung đột changeset

### Tình huống: 2 dev cùng tạo file 016

```
Dev A: tạo 016-create-reviews-table.xml → push lên Git
Dev B: tạo 016-create-comments-table.xml → push lên Git

→ Git merge conflict! (2 file cùng tên 016-...)
  hoặc cả 2 đều thêm dòng <include file="016-..."> vào master.xml
```

### Giải pháp: Quy tắc đặt tên

**Cách 1: Đặt tên theo chức năng (khuyến khích)**

```
Dev A: 016-create-reviews-table.xml     (changeset id="016-reviews")
Dev B: 016-create-comments-table.xml    (changeset id="016-comments")
```

- Tên file khác nhau → không conflict
- Changeset id KHÁC nhau → Liquibase coi là 2 changeset độc lập
- Cả 2 đều thêm vào `master.xml`, thứ tự nào cũng được (không phụ thuộc nhau)

**Cách 2: Dùng timestamp thay vì số thứ tự**

```
Dev A: 20260520-1400-create-reviews.xml
Dev B: 20260520-1530-create-comments.xml
```

- Timestamp không bao giờ trùng → không conflict

**Cách 3: Dùng prefix theo module**

```
Dev A: review-001-create-table.xml
Dev B: comment-001-create-table.xml
```

### Trường hợp xấu: cùng changeset id

```
Dev A tạo: <changeSet id="016" author="cinex"> CREATE TABLE reviews
Dev B tạo: <changeSet id="016" author="cinex"> CREATE TABLE comments

Server A chạy trước → DATABASECHANGELOG ghi: id=016, file=016-reviews
Server B kéo code → Liquibase thấy: id=016 đã chạy (theo DB)
    nhưng file khác (016-comments vs 016-reviews)
    → LỖI: checksum mismatch hoặc file mismatch!
```

**Quy tắc:** Changeset `id + author + filename` phải UNIQUE. Nếu 2 dev cùng id → lỗi khi merge.

### Workflow đúng cho team

```
1. Dev A kéo code mới nhất: git pull
2. Xem changeset cuối: 015-create-password-reset-tokens.xml
3. Tạo changeset MỚI: 016-create-reviews-table.xml
4. Thêm vào master.xml
5. Commit + Push
6. Dev B kéo code: git pull → thấy changeset 016 mới
7. Dev B tạo changeset: 017-create-comments-table.xml
8. → KHÔNG BAO GIỜ trùng số

Nếu cả 2 cùng tạo 016 (chưa pull):
    → Git merge conflict ở master.xml → resolve thủ công
    → 1 người đổi thành 017
```

---

## 5. Cấu trúc file CineX hiện tại

```
db/changelog/
├── db.changelog-master.xml          ← Include tất cả file con
└── changes/
    ├── 001-create-users-table.xml
    ├── 002-create-refresh-tokens-table.xml
    ├── 003-create-id-tracker-table.xml
    ├── 004-create-system-config-table.xml
    ├── 005-create-audit-log-table.xml
    ├── 006-create-genres-table.xml
    ├── 007-create-movies-table.xml      + movie_genres (join table)
    ├── 008-create-rooms-table.xml
    ├── 009-create-seats-table.xml       + FK + index
    ├── 010-create-showtimes-table.xml   + FK + indexes
    ├── 011-create-bookings-table.xml    + booking_seats
    ├── 012-create-payments-table.xml
    ├── 013-seed-default-data.xml        ← Admin account + 10 genres + IdTracker + SystemConfig
    ├── 014-create-vouchers-table.xml    + voucher_usages
    └── 015-create-password-reset-tokens-table.xml
```

---

## 6. Hướng dẫn thao tác

### Thêm bảng mới

```bash
# 1. Tạo file changeset
# Xem số thứ tự cuối: 015 → tạo 016
touch backend/src/main/resources/db/changelog/changes/016-create-xxx-table.xml

# 2. Viết nội dung (copy template từ file có sẵn)

# 3. Thêm vào master.xml
<include file="db/changelog/changes/016-create-xxx-table.xml"/>

# 4. Restart backend → Liquibase tự chạy
```

### Thêm cột vào bảng có sẵn

```xml
<!-- KHÔNG sửa file cũ, tạo file MỚI -->
<changeSet id="016" author="cinex">
    <addColumn tableName="users">
        <column name="phone_verified" type="BIT" defaultValueBoolean="false"/>
    </addColumn>
</changeSet>
```

### Tạo index

```xml
<changeSet id="017" author="cinex">
    <createIndex tableName="bookings" indexName="idx_bookings_status">
        <column name="status"/>
    </createIndex>
</changeSet>
```

### Insert seed data

```xml
<changeSet id="018" author="cinex">
    <insert tableName="system_config">
        <column name="config_key" value="booking.max_cancel_minutes"/>
        <column name="config_value" value="60"/>
        <column name="description" value="Số phút trước suất chiếu cho phép hủy"/>
    </insert>
</changeSet>
```

---

## 7. Quy tắc quan trọng

| Quy tắc | Giải thích | Vi phạm thì sao |
|---|---|---|
| **KHÔNG SỬA changeset đã chạy** | Liquibase check MD5SUM | Lỗi checksum → backend không start |
| **id + author + filename unique** | Liquibase nhận diện changeset | Trùng → lỗi hoặc bỏ qua sai |
| **Số thứ tự tăng dần** | Chạy theo thứ tự | Nhảy số = OK, trùng số = conflict |
| **1 changeset = 1 thay đổi logic** | Dễ rollback, dễ đọc | Gộp nhiều → rollback khó |
| **Luôn git pull trước khi tạo changeset** | Tránh trùng số | Trùng → merge conflict |
| **KHÔNG dùng `<dropColumn>` tùy tiện** | Mất data | Nên rename/archive thay vì xóa |

---

## 8. Reset DB (chạy lại từ đầu)

```bash
# Docker — xóa volume
docker-compose down -v
docker-compose up sqlserver redis -d
# Chờ 30 giây
docker exec cinex-sqlserver-1 /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P 'CineX@2026' -C -Q "CREATE DATABASE cinex"
./gradlew bootRun
# → Liquibase tạo lại TẤT CẢ bảng từ changeset 001-015

# SQL Server cài trực tiếp
# Chạy: DROP DATABASE cinex; CREATE DATABASE cinex;
# → ./gradlew bootRun
```

---

## 9. Câu hỏi thường gặp

**1. Sửa changeset đã chạy → lỗi checksum → fix thế nào?**
```sql
-- Cách 1: Clear checksum (Liquibase tính lại)
UPDATE DATABASECHANGELOG SET MD5SUM = NULL WHERE ID = '016'

-- Cách 2: Xóa record → Liquibase chạy lại changeset đó
DELETE FROM DATABASECHANGELOG WHERE ID = '016'
-- ⚠️ Cẩn thận: changeset sẽ chạy lại → nếu là CREATE TABLE → lỗi "table exists"
```

**2. Muốn đổi tên cột đã tạo → làm thế nào?**
```xml
<!-- Tạo changeset MỚI, KHÔNG sửa file cũ -->
<changeSet id="017" author="cinex">
    <renameColumn tableName="users" oldColumnName="full_name" newColumnName="display_name"
                  columnDataType="NVARCHAR(100)"/>
</changeSet>
```

**3. Lock bị kẹt → backend chờ mãi?**
```sql
UPDATE DATABASECHANGELOGLOCK SET LOCKED = 0 WHERE ID = 1
```

**4. 2 dev cùng tạo changeset 016 → ai sửa?**
→ Dev push sau sửa thành 017. Luôn `git pull` trước khi tạo changeset mới.

**5. Có thể rollback changeset không?**
→ Có, nếu changeset có `<rollback>`. VD:
```xml
<changeSet id="016" author="cinex">
    <createTable tableName="reviews">...</createTable>
    <rollback>
        <dropTable tableName="reviews"/>
    </rollback>
</changeSet>
```
Chạy rollback: `./gradlew liquibase rollbackCount -PliquibaseCommandValue=1`
