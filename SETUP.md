# Setup cinex-team — Không dùng Docker

Hướng dẫn cho team clone code về máy cá nhân (Windows / Mac) và chạy **không cần Docker**. Bạn cài SQL Server + Redis native, BE + FE chạy thẳng.

---

## 1. Cài phần mềm chung (Windows + Mac)

| Phần mềm | Version | Mục đích |
|---|---|---|
| **Git** | 2.x+ | Clone source |
| **Java JDK** | **21+** | Compile + chạy Spring Boot 3 |
| **Node.js** | **20+** | Chạy Vite + React |
| **npm** | đi kèm Node | Cài deps FE |

### Java 21

- **Windows**: download Adoptium Temurin 21 → https://adoptium.net/temurin/releases/?version=21 → tick `Set JAVA_HOME` + `Add to PATH` khi cài
- **Mac**: `brew install --cask temurin@21`

Verify: `java --version` → openjdk 21.x.x

### Node 20

- **Windows**: https://nodejs.org → LTS v20 → installer
- **Mac**: `brew install node@20 && brew link node@20`

Verify: `node --version` → v20.x.x

---

## 2. Cài SQL Server (chỉ Windows)

> ⚠️ **Mac không có SQL Server native**. Mac team phải dùng Docker chỉ cho DB (xem mục 6 — Mac).

### Windows — SQL Server Developer Edition (FREE)

1. Download: https://www.microsoft.com/sql-server/sql-server-downloads → **Developer** → Install
2. Khi cài: chọn **Basic** → Accept → đợi cài xong (~5 phút)
3. Cài thêm **SSMS** (GUI): https://aka.ms/ssmsfullsetup

### Bật Mixed Mode (cho phép login bằng sa)

1. Mở SSMS → Connect server `localhost` (Windows Authentication)
2. Right-click server → **Properties** → tab **Security**:
   - Chọn **SQL Server and Windows Authentication mode**
3. Mở **Security → Logins → sa** → Properties:
   - Tab **General**: Password = `CineX@2026`
   - Tab **Status**: Login = **Enabled**
4. Right-click server → **Restart**

### Bật TCP/IP port 1433

1. Mở **SQL Server Configuration Manager** (cài kèm SQL Server)
2. **SQL Server Network Configuration → Protocols for MSSQLSERVER**:
   - Right-click **TCP/IP** → **Enable**
   - Properties → tab **IP Addresses** → kéo xuống **IPAll**:
     - TCP Dynamic Ports: **xóa rỗng**
     - TCP Port: **1433**
3. **SQL Server Services** → right-click **SQL Server (MSSQLSERVER)** → **Restart**

### Tạo database `cinex_team`

Mở SSMS New Query hoặc PowerShell:

```sql
CREATE DATABASE cinex_team;
```

```powershell
sqlcmd -S localhost -U sa -P "CineX@2026" -Q "CREATE DATABASE cinex_team"
```

---

## 3. Cài Redis

### Windows — Memurai (Redis-compatible)

1. Download: https://www.memurai.com/get-memurai → Developer Edition (free)
2. Cài xong tự đăng ký Windows Service, chạy ngầm
3. Verify: `memurai-cli ping` → PONG

### Mac — Homebrew

```bash
brew install redis
brew services start redis      # auto start
redis-cli ping                 # PONG
```

---

## 4. Clone + Cài deps + Chạy

### Bước 1: Clone

```bash
git clone https://github.com/VuTuongAn/cinex-team.git
cd cinex-team
```

> ⚠️ Tránh đặt vào path có dấu cách hoặc tiếng Việt (Gradle/npm có thể lỗi).

### Bước 2: Backend (terminal 1)

```bash
# Mac / Git Bash Windows
cd backend
./gradlew bootRun

# Windows PowerShell / CMD
cd backend
gradlew.bat bootRun
```

Lần đầu Gradle download deps ~3-5 phút. Khi thấy:

```
Started CineXApplication in 8.x seconds
```

→ BE chạy tại http://localhost:**8089** (cinex-team dùng port 8089, khác cinex 8088).

Liquibase tự tạo schema + apply migration `040-cinex-team-minimal-seed.xml` xóa data khuyến mãi/loyalty.

Verify: http://localhost:8089/api/health → `{"success":true,"data":"UP"}`

### Bước 3: Frontend (terminal 2)

```bash
cd frontend
npm install      # lần đầu, ~2-3 phút
npm run dev
```

→ FE chạy tại http://localhost:**5174**

---

## 5. Đăng nhập

Tài khoản seed (Liquibase tự seed lần đầu):

| Username | Password | Role |
|---|---|---|
| `admin` | `CineX@2026` | SUPER_ADMIN (single-theater mode → cũng bị scope HN) |
| `cinex.hn` | `CineX@2026` | ADMIN HN (mặc định team demo dùng tài khoản này) |
| `user01` → `user08` | `CineX@2026` | USER (8 khách hàng demo) |

cinex.hn sau khi login:
- Landing `/admin/genres` (Thể loại)
- Sidebar 5 mục: Thể loại / Phim / Phòng chiếu / Suất chiếu / Người dùng
- Tạo + lưu trữ được phim + thể loại (BE đã mở RBAC cho ADMIN)
- Data rooms/showtimes/users tự động scope CN Hà Nội

---

## 6. Mac team — chỉ DB qua Docker (vì không có SQL Server native)

Mac không có SQL Server native. Chỉ chạy SQL Server + Redis trong container, BE + FE vẫn native:

```bash
# 1. Cài Docker Desktop: https://www.docker.com/products/docker-desktop/
# 2. Chạy DB + Redis container
cd cinex-team
docker compose up sqlserver redis -d

# 3. Tạo DB
docker exec cinex-team-sqlserver /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P 'CineX@2026' -C -Q "CREATE DATABASE cinex_team"

# 4. BE — cần override port DB sang 1434 (docker compose expose 1434:1433)
cd backend
DB_PORT=1434 REDIS_PORT=6380 ./gradlew bootRun

# 5. FE — terminal mới
cd frontend && npm install && npm run dev
```

---

## 7. Lỗi thường gặp

### `Cannot open database "cinex_team" requested by the login`
→ Chưa tạo DB. Chạy `CREATE DATABASE cinex_team` qua SSMS hoặc sqlcmd.

### `Login failed for user 'sa'`
→ Mixed Mode chưa bật hoặc sa user disabled. Xem mục 2.

### Port 1433 / 8089 / 5174 / 6379 đã bị chiếm
**Windows:**
```powershell
netstat -ano | findstr :1433
taskkill /PID <pid> /F
```
**Mac:**
```bash
lsof -ti:1433 | xargs kill -9
```

### Hibernate `Cannot open database` trong khi BE đang start
→ SQL Server chưa Mixed Mode → BE không login được. Quay lại mục 2 setup Mixed Mode + sa.

### Migration 040 fail `Invalid object name 'loyalty_point_batches'`
→ Đã fix ở commit `39d0f80`. Pull code mới nhất.

### `gradlew` không chạy trên PowerShell
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```
Hoặc dùng `.\gradlew.bat`.

### `npm install` chậm / timeout
```bash
npm config set registry https://registry.npmmirror.com
rm -rf node_modules package-lock.json
npm install
```

### Antivirus chặn Gradle / npm (Windows)
Add thư mục `cinex-team/` vào exclusion list của Windows Defender / Kaspersky.

---

## 8. Reset DB từ đầu

```sql
-- SSMS
DROP DATABASE cinex_team;
CREATE DATABASE cinex_team;
```

```powershell
-- sqlcmd
sqlcmd -S localhost -U sa -P "CineX@2026" -Q "DROP DATABASE cinex_team; CREATE DATABASE cinex_team"
```

Chạy lại `./gradlew bootRun` → Liquibase tự seed lại 40 changesets.

---

## 9. Ports tổng kết

| Service | Port | Khác cinex |
|---|---|---|
| Backend | **8089** | cinex 8088 |
| Frontend | **5174** | cinex 5173 |
| SQL Server | 1433 (native Win) / 1434 (Mac Docker) | cinex 1433 / 1433 |
| Redis | 6379 (native) / 6380 (Mac Docker) | cinex 6379 / 6379 |
| Database name | `cinex_team` | cinex `cinex` |

→ 2 dự án có thể chạy song song trên cùng máy (Windows: cùng SQL instance 1433, khác DB name; Mac: container riêng).
