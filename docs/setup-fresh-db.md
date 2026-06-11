# CineX — Setup Fresh Database

Hướng dẫn xóa DB cũ và init lại từ đầu với schema + seed data mới (chuẩn industry).

---

## 1. Xóa DB cũ

```bash
# Vào SQL Server container đang chạy
docker exec -it cinex-sqlserver-1 /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P 'CineX@2026' -C \
  -Q "DROP DATABASE IF EXISTS cinex"

# Tạo lại DB rỗng
docker exec -it cinex-sqlserver-1 /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P 'CineX@2026' -C \
  -Q "CREATE DATABASE cinex"
```

**Nếu container chưa chạy:**
```bash
cd /Users/vutuongan/cinex
docker-compose up sqlserver redis -d
# Chờ ~30s rồi chạy 2 lệnh trên
```

---

## 2. Chạy Liquibase init schema + seed data

```bash
cd /Users/vutuongan/cinex/backend
./gradlew bootRun
```

Liquibase tự chạy 16 changelog (8 schema + 8 seed) khi BE start:
- **001-008**: tạo 26 tables + 30+ foreign keys + 50+ indexes + CHECK constraints
- **009-016**: seed 5 chi nhánh + 14 users + 18 phim + 1920 ghế + 1000+ showtimes

Log thành công sẽ hiện:
```
Successfully released change log lock
Started CineXApplication in X.X seconds
```

---

## 3. Tài khoản test

**Password chung cho TẤT CẢ: `CineX@2026`**

### Quản trị viên

| Username | Email | Role | Chi nhánh |
|---|---|---|---|
| `admin` | admin@cinex.vn | SUPER_ADMIN | Tất cả |
| `cinex.hn` | admin.hn@cinex.vn | ADMIN | Hà Nội |
| `cinex.hp` | admin.hp@cinex.vn | ADMIN | Hải Phòng |
| `cinex.qn` | admin.qn@cinex.vn | ADMIN | Quảng Ninh |
| `cinex.dn` | admin.dn@cinex.vn | ADMIN | Đà Nẵng |
| `cinex.hcm` | admin.hcm@cinex.vn | ADMIN | Hồ Chí Minh |

### Khách hàng (USER) — kiểm thử loyalty + booking

| Username | Họ tên | Tier | Loyalty |
|---|---|---|---|
| `user01` | Nguyễn Văn An | STANDARD | 450 |
| `user02` | Trần Thị Bình | SILVER | 1,200 |
| `user03` | Lê Quốc Cường | GOLD | 2,500 |
| `user04` | Phạm Tiến Dũng | STANDARD | 80 |
| `user05` | Hoàng Thị Lan | PLATINUM | 5,500 |
| `user06` | Vũ Hoàng Minh | STANDARD | 0 (chưa verify email) |
| `user07` | Đỗ Mỹ Hương | SILVER | 750 |
| `user08` | Bùi Văn Long | STANDARD | 0 (mới 21 tuổi) |

---

## 4. Data sẵn có

| Module | Số lượng | Ghi chú |
|---|---|---|
| Chi nhánh | 5 | HN, HP, QN, DN, HCM (địa chỉ Vincom thực tế + GPS) |
| Phòng | 20 | 4 phòng/chi nhánh (1 IMAX, 1 3D, 2 TWO_D) |
| Ghế | 1,920 | 96 ghế/phòng (72 STANDARD + 12 VIP + 12 COUPLE) |
| Phim | 18 | Bom tấn quốc tế + phim Việt + arthouse + trẻ em |
| Thể loại | 15 | Hành động, Tâm lý, Hoạt hình, Kinh dị, ... |
| MovieRun | ~50 | NOW_SHOWING + COMING_SOON + ENDED + REISSUE + FESTIVAL |
| Showtimes | ~1000+ | 14 ngày tới, 3 ca/ngày (10h, 14h30, 19h30) |
| Snack | 40 | 8 món × 5 chi nhánh |
| Combo | 15 | SOLO/COUPLE/FAMILY × 5 chi nhánh |
| Pricing Rules | 5 | Suất sáng -20%, Thứ 3 -30%, Weekend +20% (ẩn), Giờ vàng +15% (ẩn), HN học sinh -10% |
| Voucher | 7 | 5 global + 2 per-theater |

---

## 5. Việc cần làm sau khi BE chạy

### 5.1. Upload ảnh thực tế

Database seed dùng `PLACEHOLDER_POSTER_URL` / `PLACEHOLDER_TRAILER_URL` / `PLACEHOLDER_IMAGE_URL` cho mọi field ảnh và video. Cần thay bằng URL thật:

**Option A — Upload qua admin UI** (đơn giản):
1. Vào `/admin/movies` → click row phim → tab "Upload poster" → chọn file
2. Tương tự `/admin/snacks` và `/admin/combos`

**Option B — Update SQL trực tiếp** (nhanh nếu bạn có Cloudinary URLs):
```sql
UPDATE movies SET poster_url = N'https://res.cloudinary.com/.../avatar3.jpg'
WHERE title = N'Avatar 3: Lửa và Tro';

UPDATE movies SET trailer_url = N'https://youtube.com/watch?v=...'
WHERE title = N'Avatar 3: Lửa và Tro';
```

### 5.2. Đổi password mặc định (nếu deploy thật)

```bash
# Login admin → vào /profile → đổi password
# Hoặc update trực tiếp DB với BCrypt hash mới
```

---

## 6. Khi cần reset lại từ đầu

```bash
# 1. Stop BE (Ctrl+C trong terminal đang chạy bootRun)
# 2. Xóa DB
docker exec cinex-sqlserver-1 /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P 'CineX@2026' -C \
  -Q "DROP DATABASE cinex; CREATE DATABASE cinex"
# 3. Chạy lại BE
cd /Users/vutuongan/cinex/backend && ./gradlew bootRun
```

Liquibase sẽ chạy lại toàn bộ 16 changelog → DB y hệt như lần đầu.

---

## 7. Phát triển sau này — thêm changelog mới

Sau khi setup xong, KHÔNG sửa file `001-016` (đã chạy ở mọi instance dev).
Thêm file mới với prefix `017+`:

```bash
backend/src/main/resources/db/changelog/changes/017-add-new-feature.xml
```

Update master changelog:
```xml
<!-- backend/src/main/resources/db/changelog/db.changelog-master.xml -->
<include file="db/changelog/changes/017-add-new-feature.xml"/>
```

Restart BE → Liquibase tự chạy changeset mới.
