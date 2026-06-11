# Quick Start — Rebuild CineX từ Zero

> **Đối tượng:** Người mới chưa biết gì về dự án, muốn clone về máy và chạy được trong vòng 30 phút. Giả định bạn đã cài JDK 21 + Node 20 + Docker.

---

## Bước 1 — Clone repo

```bash
git clone https://github.com/VuTuongAn/cinex.git
cd cinex
```

Cấu trúc sau khi clone:
```
cinex/
├── backend/              # Spring Boot 3.3 + Java 21
├── frontend/             # React 19 + TypeScript + Vite
├── docs/                 # Tài liệu chi tiết (75+ files)
├── docker-compose.yml    # SQL Server 2022 + Redis 7
└── README.md
```

---

## Bước 2 — Khởi động infrastructure (SQL Server + Redis)

```bash
docker compose up sqlserver redis -d
```

Đợi ~30 giây cho SQL Server ready. Verify:
```bash
docker ps | grep cinex
# Phải thấy 2 container chạy: cinex-sqlserver-1, cinex-redis-1
```

**Tạo database `cinex`** (chạy 1 lần đầu):
```bash
docker exec cinex-sqlserver-1 /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P 'CineX@2026' -C \
  -Q "CREATE DATABASE cinex"
```

---

## Bước 3 — Setup credentials local

Backend cần 3 credentials không có trong git: JWT secret (sinh tự động OK), Cloudinary, Mail.

### 3.1. Copy template
```bash
cp backend/src/main/resources/application-local.yml.example \
   backend/src/main/resources/application-local.yml
```

### 3.2. Đăng ký Mailtrap (BẮT BUỘC — 5 phút)
1. Vào https://mailtrap.io → Sign up free
2. Email Testing → My Inbox → Integration → chọn **SMTP**
3. Copy `Username` + `Password`
4. Mở `application-local.yml` (vừa copy ở 3.1) → thay vào block `spring.mail`:
   ```yaml
   spring:
     mail:
       host: sandbox.smtp.mailtrap.io
       port: 2525
       username: PASTE_HERE
       password: PASTE_HERE
   ```

### 3.3. Cloudinary (OPTIONAL — chỉ cần nếu test upload ảnh)
1. https://cloudinary.com → Sign up free
2. Dashboard → copy `API Key` + `API Secret`
3. Mở `application-local.yml` → thay block `cloudinary`:
   ```yaml
   cloudinary:
     api-key: PASTE_HERE
     api-secret: PASTE_HERE
   ```

> **Nếu không setup Cloudinary:** Upload ảnh sẽ fail nhưng các tính năng khác vẫn chạy bình thường (poster lấy URL placeholder từ seed).

---

## Bước 4 — Chạy backend

```bash
cd backend
./gradlew bootRun
```

Lần đầu sẽ mất ~5 phút (download dependencies). Sau đó ~10 giây / lần restart.

Liquibase tự động chạy **16 changelog**:
- 001-008: Tạo 27 tables + 50+ indexes + CHECK constraints
- 009-016: Seed data (5 chi nhánh, 14 users, 18 phim, 1920 ghế, 1000+ showtimes, snacks, combos, vouchers)
- 017: Fix encoding tiếng Việt

**Log thành công:**
```
Started CineXApplication in 7.13 seconds
Tomcat started on port 8088
```

**Test BE chạy:**
```bash
curl http://localhost:8088/api/health
# {"data":"ok","success":true}
```

**Mở Swagger UI:** http://localhost:8088/swagger-ui.html

---

## Bước 5 — Chạy frontend

Mở terminal mới (giữ BE đang chạy):
```bash
cd frontend
npm install     # lần đầu, ~3 phút
npm run dev     # khởi động Vite
```

**Log thành công:**
```
VITE v8.0  ready in 542 ms
➜ Local:   http://localhost:5173/
```

---

## Bước 6 — Login và khám phá

Mở **http://localhost:5173** trong browser.

### Tài khoản test (password chung: `CineX@2026`)

| Username | Role | Mô tả |
|---|---|---|
| `admin` | SUPER_ADMIN | Quản trị tổng, xem tất cả chi nhánh |
| `cinex.hn` | ADMIN | Quản lý CineX Hà Nội |
| `cinex.hp` | ADMIN | Quản lý CineX Hải Phòng |
| `cinex.qn` | ADMIN | Quản lý CineX Quảng Ninh |
| `cinex.dn` | ADMIN | Quản lý CineX Đà Nẵng |
| `cinex.hcm` | ADMIN | Quản lý CineX Hồ Chí Minh |
| `user01` → `user08` | USER | Khách hàng test với loyalty tier khác nhau |

### Khám phá flows chính

**Flow user (khách đặt vé):**
1. Login `user01`
2. Trang chủ → chọn rạp ở header (vd CineX Hà Nội)
3. Chọn 1 phim đang chiếu → bấm "Đặt vé"
4. Chọn ngày + suất → chọn ghế → "Giữ ghế"
5. Trang thanh toán → "Thanh toán bằng MoMo" → MoMo sandbox → "Thành công"
6. Trang ticket → check email Mailtrap inbox sẽ thấy email xác nhận kèm QR

**Flow admin (kiểm soát):**
1. Login `admin` → `/admin/dashboard`
2. Xem widget: doanh thu, top phim, top đợt chiếu, tỷ lệ lấp đầy
3. Sang `/admin/movies` → CRUD phim
4. `/admin/showtimes` → quản lý lịch chiếu
5. `/admin/bookings` → xem booking xuyên rạp

**Flow POS (bán vé tại quầy):**
1. Login `cinex.hn`
2. `/admin/ticket-pos` → chọn suất chiếu → chọn ghế → chọn phương thức (CASH/CARD_POS/TRANSFER) → "Xác nhận bán vé"

---

## Bước 7 — Reset database khi cần

Trong quá trình dev, nếu muốn reset toàn bộ data:

```bash
# Stop BE (Ctrl+C ở terminal chạy bootRun)
docker exec cinex-sqlserver-1 /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P 'CineX@2026' -C \
  -Q "DROP DATABASE IF EXISTS cinex; CREATE DATABASE cinex"

# Restart BE → Liquibase chạy lại 17 changelog từ đầu
cd backend && ./gradlew bootRun
```

---

## Lỗi thường gặp

### Lỗi 1: "Port 1433 already in use"
Đã có SQL Server khác chạy. Stop nó hoặc đổi port trong `docker-compose.yml`.

### Lỗi 2: "Could not resolve placeholder 'MAIL_USERNAME'"
Chưa copy `application-local.yml.example` → `application-local.yml` (xem Bước 3.1).

### Lỗi 3: "Authentication failed" khi MoMo redirect
MoMo sandbox keys mặc định OK. Nếu vẫn fail, kiểm tra `application-local.yml` có override `momo.access-key` không (thường KHÔNG cần — sandbox keys công khai).

### Lỗi 4: Email không tới Mailtrap
Xem `application-local.yml` `spring.mail.username/password` đã set đúng từ Mailtrap dashboard chưa. Restart BE sau khi đổi.

### Lỗi 5: FE báo "Network Error" khi login
BE chưa chạy hoặc CORS chặn. Kiểm tra `http://localhost:8088/api/health` có response không.

### Lỗi 6: Liquibase báo "checksum mismatch"
File changelog đã chạy bị sửa nội dung. KHÔNG được sửa file `001-017`, chỉ được thêm file mới `018+`. Nếu vô tình sửa, revert lại hoặc DROP DATABASE và init lại từ đầu.

---

## Tiếp theo đọc gì

- [docs/00-architecture-overview.md](./00-architecture-overview.md) — Kiến trúc tổng quan, multi-tenant, design patterns
- [docs/00-tech-stack.md](./00-tech-stack.md) — Inventory chi tiết các thư viện đang dùng
- [docs/backend/](./backend/) — Spring Boot, JPA, Security
- [docs/frontend/](./frontend/) — React, TypeScript, Tailwind
- [docs/module-guides/](./module-guides/) — Từng module business

---

## Lệnh "cheat sheet"

```bash
# Start infra
docker compose up sqlserver redis -d

# Stop infra
docker compose stop

# Reset DB
docker exec cinex-sqlserver-1 /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P 'CineX@2026' -C \
  -Q "DROP DATABASE IF EXISTS cinex; CREATE DATABASE cinex"

# Run BE
cd backend && ./gradlew bootRun

# Run FE
cd frontend && npm run dev

# Run BE production-mode
cd backend && ./gradlew bootJar
java -jar build/libs/cinex-*.jar --spring.profiles.active=prod

# Lint FE
cd frontend && npm run lint

# Format FE
cd frontend && npm run format

# Build FE production
cd frontend && npm run build
```
