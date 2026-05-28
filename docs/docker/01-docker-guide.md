# Docker — Hướng dẫn từ zero đến thực tế

## Mục lục
1. [Docker là gì?](#1-docker-là-gì)
2. [Docker vs Máy ảo (VM)](#2-docker-vs-máy-ảo-vm)
3. [Cài đặt Docker](#3-cài-đặt-docker)
4. [Thuật ngữ Docker](#4-thuật-ngữ-docker)
5. [Image — Bản thiết kế](#5-image--bản-thiết-kế)
6. [Container — Cái đang chạy](#6-container--cái-đang-chạy)
7. [Dockerfile — Hướng dẫn build image](#7-dockerfile--hướng-dẫn-build-image)
8. [Docker Compose — Chạy nhiều container](#8-docker-compose--chạy-nhiều-container)
9. [Volume — Giữ data](#9-volume--giữ-data)
10. [Network — Container nói chuyện với nhau](#10-network--container-nói-chuyện-với-nhau)
11. [Layer & Cache — Tại sao build lần 2 nhanh hơn](#11-layer--cache--tại-sao-build-lần-2-nhanh-hơn)
12. [Lệnh Docker thường dùng](#12-lệnh-docker-thường-dùng)
13. [Thực hành: Setup CineX từ zero](#13-thực-hành-setup-cinex-từ-zero)
14. [Debug khi lỗi](#14-debug-khi-lỗi)
15. [Ví dụ thực tế ngoài CineX](#15-ví-dụ-thực-tế-ngoài-cinex)
16. [Best Practices](#16-best-practices)
17. [Câu hỏi thường gặp](#17-câu-hỏi-thường-gặp)

---

## 1. Docker là gì?

Docker là công cụ **đóng gói ứng dụng + tất cả thứ nó cần** (ngôn ngữ, thư viện, config) vào 1 "hộp" gọi là **container**. Ai có Docker đều chạy được, không cần cài thêm gì.

### Ví dụ đời thường

**Không có Docker — gửi công thức nấu ăn:**
```
Bạn: "Cài Java 21, SQL Server 2022, Redis 7, Node 20, cấu hình biến môi trường..."
Bạn bè: "Java tôi cài 17, SQL Server tôi dùng 2019, Redis tôi không có..."
→ Mỗi người 1 môi trường → chạy lỗi → mất nửa ngày debug "tại sao máy tôi không chạy?"
```

**Có Docker — gửi hộp cơm hoàn chỉnh:**
```
Bạn: "Clone code → docker-compose up → xong"
Bạn bè: "OK, chạy được."
→ Ai cũng cùng môi trường → 0 lỗi cấu hình
```

### Tại sao cần Docker cho CineX?

```
Dự án CineX cần:
├── SQL Server 2022    ← database
├── Redis 7            ← cache
├── Java 21            ← backend
└── Node 20            ← frontend

Không Docker: cài 4 thứ, sai version 1 cái = lỗi
Có Docker: 1 lệnh docker-compose up = tất cả tự chạy
```

---

## 2. Docker vs Máy ảo (VM)

### Máy ảo (VMware, VirtualBox)

```
┌─────────────────────────────────┐
│          Máy vật lý (host)      │
├─────────────────────────────────┤
│      Hệ điều hành host          │  ← macOS / Windows
├─────────────────────────────────┤
│        Hypervisor               │  ← VMware / VirtualBox
├────────────┬────────────────────┤
│   VM 1     │    VM 2            │
│ ┌────────┐ │ ┌────────────────┐ │
│ │Guest OS│ │ │   Guest OS     │ │  ← Mỗi VM cài NGUYÊN 1 hệ điều hành (2-10GB)
│ │Ubuntu  │ │ │   Windows      │ │
│ ├────────┤ │ ├────────────────┤ │
│ │  App   │ │ │     App        │ │
│ └────────┘ │ └────────────────┘ │
└────────────┴────────────────────┘

Nhược điểm:
- Mỗi VM = 1 hệ điều hành riêng → tốn 2-10GB RAM
- Khởi động chậm (phải boot OS)
- Nặng, chậm
```

### Docker Container

```
┌─────────────────────────────────┐
│          Máy vật lý (host)      │
├─────────────────────────────────┤
│      Hệ điều hành host          │  ← macOS / Windows / Linux
├─────────────────────────────────┤
│        Docker Engine            │  ← Thay thế Hypervisor
├────────────┬────────────────────┤
│Container 1 │  Container 2       │
│ ┌────────┐ │ ┌────────────────┐ │
│ │  App   │ │ │     App        │ │  ← KHÔNG có Guest OS → nhẹ hơn nhiều
│ │SQL Srvr│ │ │   Redis        │ │
│ └────────┘ │ └────────────────┘ │
└────────────┴────────────────────┘

Ưu điểm:
- KHÔNG cần OS riêng → container chỉ 50-200MB (thay vì 2-10GB)
- Khởi động trong 1-2 giây (thay vì 30-60 giây)
- Nhẹ: chạy 10 container dễ dàng (10 VM thì máy chết)
```

### So sánh nhanh

| | Máy ảo (VM) | Docker Container |
|---|---|---|
| Kích thước | 2-10 GB | 50-200 MB |
| Khởi động | 30-60 giây | 1-2 giây |
| RAM | Tốn nhiều (mỗi VM = 1 OS) | Ít (chia sẻ OS host) |
| Cách ly | Hoàn toàn (OS riêng) | Cách ly process (chia sẻ kernel) |
| Dùng khi | Cần OS khác nhau | Chạy ứng dụng, dev, deploy |

---

## 3. Cài đặt Docker

### macOS
```bash
# Cách 1: Tải Docker Desktop (GUI)
# Vào https://www.docker.com/products/docker-desktop/ → Download for Mac

# Cách 2: Homebrew
brew install --cask docker

# Sau khi cài → mở Docker Desktop từ Applications
# Chờ icon 🐳 trên menu bar → "Docker Desktop is running"

# Verify
docker --version    # Docker version 24.x
docker-compose --version  # Docker Compose version v2.x
```

### Windows
```bash
# 1. Bật WSL2 (Windows Subsystem for Linux):
#    Settings → Apps → Optional Features → Windows Subsystem for Linux
#    Hoặc: wsl --install (PowerShell admin)

# 2. Tải Docker Desktop:
#    https://www.docker.com/products/docker-desktop/ → Download for Windows

# 3. Cài → restart máy → mở Docker Desktop

# 4. Verify (PowerShell/CMD)
docker --version
docker-compose --version
```

### Linux (Ubuntu)
```bash
# Cài Docker Engine (không cần Docker Desktop)
sudo apt update
sudo apt install docker.io docker-compose-v2 -y

# Cho phép chạy docker không cần sudo
sudo usermod -aG docker $USER
# Logout → login lại

# Verify
docker --version
docker compose version
```

### Kiểm tra cài đúng chưa
```bash
# Chạy container test
docker run hello-world

# Kết quả mong đợi:
# Hello from Docker!
# This message shows that your installation appears to be working correctly.
```

---

## 4. Thuật ngữ Docker

```
┌──────────────────────────────────────────────────────────┐
│                    Docker Hub (Registry)                   │
│    Kho chứa image (giống GitHub cho code)                │
│    VD: mcr.microsoft.com/mssql/server:2022-latest        │
└──────────────┬───────────────────────────────────────────┘
               │ docker pull (download)
               ▼
┌──────────────────────────────────────────────────────────┐
│                    Image (Bản thiết kế)                   │
│    File read-only, chứa OS + app + config                │
│    Giống file ISO cài Windows — chưa chạy                │
│    VD: mssql/server:2022-latest (~700MB)                 │
└──────────────┬───────────────────────────────────────────┘
               │ docker run (tạo + chạy)
               ▼
┌──────────────────────────────────────────────────────────┐
│                   Container (Đang chạy)                   │
│    Instance (bản đang chạy) tạo từ image                 │
│    1 image → tạo nhiều container (nhiều instance)        │
│                                                          │
│    Ví dụ: Khuôn bánh (image) → đúc ra nhiều chiếc bánh  │
│    Khuôn bánh = 1 cái. Chiếc bánh = bao nhiêu cũng được │
│    Mỗi chiếc bánh = 1 instance = 1 container             │
│                                                          │
│    Image SQL Server (bản thiết kế)                       │
│        ├── cinex-sqlserver    (instance 1, port 1433)    │
│        ├── test-sqlserver     (instance 2, port 1434)    │
│        └── demo-sqlserver     (instance 3, port 1435)    │
│                                                          │
│    Giống Java: class User = khuôn, new User() = instance │
└──────────────────────────────────────────────────────────┘
               │
               │ mount (gắn)
               ▼
┌──────────────────────────────────────────────────────────┐
│                    Volume (Lưu data)                      │
│    Data tồn tại khi container bị xóa                     │
│    VD: sqlserver-data (chứa database files)              │
└──────────────────────────────────────────────────────────┘
```

| Thuật ngữ | Ví dụ đời thường | Docker |
|---|---|---|
| **Registry** | App Store | Docker Hub — kho image |
| **Image** | File ISO cài Windows | Bản thiết kế, read-only |
| **Container** | Máy tính đang chạy Windows | Instance đang chạy từ image |
| **Dockerfile** | Công thức nấu ăn | Script build image từ code |
| **docker-compose** | Menu nhà hàng (nhiều món) | Chạy nhiều container cùng lúc |
| **Volume** | USB lưu data | Data tồn tại khi container xóa |
| **Port mapping** | Chuyển tiếp cuộc gọi | Map port máy host → container |
| **Network** | Mạng LAN nội bộ | Container nói chuyện với nhau |

---

## 5. Image — Bản thiết kế

### Image là gì?

```
Image = OS tối giản + ứng dụng + config
      = Tất cả thứ cần để chạy, đóng gói lại

VD: Image SQL Server = Linux Alpine + SQL Server binary + config mặc định
    Dung lượng: ~700MB (nhỏ hơn nhiều so với cài SQL Server trên Windows ~2GB)
```

### Tên image

```
mcr.microsoft.com / mssql/server : 2022-latest
│                    │               │
Registry            Tên image        Tag (version)
(Microsoft)         (SQL Server)     (phiên bản 2022)

redis : 7-alpine
│         │
Tên       Tag
(Redis)   (version 7, Alpine Linux — bản nhẹ)
```

### Lệnh image cơ bản

```bash
# Tải image từ Docker Hub (tự động tải khi docker run nếu chưa có)
docker pull redis:7-alpine

# Xem danh sách image đã tải
docker images
# REPOSITORY                       TAG            SIZE
# mcr.microsoft.com/mssql/server   2022-latest    683MB
# redis                            7-alpine       30MB
# eclipse-temurin                  21-jre         218MB

# Xóa image không dùng
docker rmi redis:7-alpine

# Xóa TẤT CẢ image không dùng (giải phóng disk)
docker image prune -a
```

### Image phổ biến

| Image | Dùng cho | Dung lượng |
|---|---|---|
| `mcr.microsoft.com/mssql/server:2022-latest` | SQL Server | ~700MB |
| `redis:7-alpine` | Redis cache | ~30MB |
| `eclipse-temurin:21-jdk` | Java 21 (build) | ~400MB |
| `eclipse-temurin:21-jre` | Java 21 (chạy) | ~218MB |
| `node:20-alpine` | Node.js 20 | ~180MB |
| `nginx:alpine` | Web server | ~20MB |
| `postgres:16` | PostgreSQL | ~400MB |
| `mysql:8` | MySQL | ~560MB |
| `mongo:7` | MongoDB | ~700MB |

---

## 6. Container — Cái đang chạy

### Vòng đời container

```
Image                  Container
  │                       │
  ├── docker run ────────▶ Created → Started (Running)
  │                                     │
  │                        docker stop  │  docker start
  │                                     ▼
  │                                  Stopped
  │                                     │
  │                        docker rm    │
  │                                     ▼
  │                                  Removed (xóa)
  │
  │   docker run = docker create + docker start (gộp 2 bước)
```

### Lệnh container cơ bản

```bash
# Tạo + chạy container (lệnh dùng nhiều nhất)
docker run -d --name my-redis -p 6379:6379 redis:7-alpine
#          │   │              │              │
#          │   │              │              Image
#          │   │              Port mapping: host:container
#          │   Đặt tên container
#          Chạy background (detached)

# Xem container đang chạy
docker ps
# CONTAINER ID   IMAGE              NAMES         STATUS          PORTS
# abc123         redis:7-alpine     my-redis      Up 5 minutes    0.0.0.0:6379->6379

# Xem TẤT CẢ container (kể cả stopped)
docker ps -a

# Dừng container
docker stop my-redis

# Xóa container
docker rm my-redis

# Dừng + xóa luôn
docker rm -f my-redis

# Chạy lệnh TRONG container
docker exec -it my-redis sh
# -i: interactive (nhập input)
# -t: terminal (hiện output đẹp)
# sh: mở shell (hoặc bash nếu image có)

# Xem log
docker logs my-redis           # Log đến hiện tại
docker logs -f my-redis        # Follow (realtime, Ctrl+C để thoát)
docker logs --tail 50 my-redis # 50 dòng cuối

# Xem resource usage (CPU, RAM)
docker stats
```

### Ví dụ: Chạy SQL Server bằng 1 lệnh

```bash
docker run -d \
  --name cinex-sqlserver \
  -e "ACCEPT_EULA=Y" \
  -e "MSSQL_SA_PASSWORD=CineX@2026" \
  -p 1433:1433 \
  -v sqlserver-data:/var/opt/mssql \
  mcr.microsoft.com/mssql/server:2022-latest

# Giải thích:
# -d                    → chạy background
# --name cinex-sqlserver → đặt tên
# -e "KEY=VALUE"        → biến môi trường (config SQL Server)
# -p 1433:1433          → map port host:container
# -v sqlserver-data:... → mount volume (giữ data)
# mcr.microsoft.com/... → image SQL Server

# Sau 10-15 giây, SQL Server sẵn sàng
# Connect bằng: localhost:1433, user: sa, password: CineX@2026
```

---

## 7. Dockerfile — Hướng dẫn build image

### Dockerfile là gì?

```
Dockerfile = công thức nấu ăn
Mỗi dòng = 1 bước
Docker đọc từ trên xuống, chạy từng bước → tạo ra image
```

### Dockerfile cho CineX Backend

```dockerfile
# ===== Stage 1: BUILD (dùng JDK có compiler) =====
FROM eclipse-temurin:21-jdk AS build
# ↑ Bắt đầu từ image Java 21 JDK (400MB, có javac compiler)
# AS build: đặt tên stage này = "build" (dùng tham chiếu sau)

WORKDIR /app
# ↑ Tạo thư mục /app trong container, mọi lệnh sau chạy tại đây
# Giống "cd /app" nhưng tạo luôn nếu chưa có

# Copy file build config TRƯỚC (tận dụng cache — giải thích ở mục 11)
COPY gradle gradle
COPY gradlew build.gradle settings.gradle ./
# ↑ Copy từ máy host → vào container

# Download dependencies (chỉ chạy lại khi build.gradle thay đổi)
RUN chmod +x gradlew && ./gradlew dependencies --no-daemon
# ↑ RUN = chạy lệnh trong container lúc build
# chmod +x: cấp quyền execute cho gradlew
# dependencies: chỉ tải thư viện, chưa build code

# Copy source code (thay đổi thường xuyên → để SAU dependencies)
COPY src src

# Build ra file JAR
RUN ./gradlew clean build -x test --no-daemon
# ↑ Kết quả: /app/build/libs/cinex-0.0.1-SNAPSHOT.jar


# ===== Stage 2: RUN (dùng JRE nhẹ hơn, không cần compiler) =====
FROM eclipse-temurin:21-jre
# ↑ Image mới, chỉ có JRE (218MB, KHÔNG có javac)
# Stage 1 bị bỏ → image cuối chỉ chứa stage 2

WORKDIR /app

# Copy file JAR từ stage "build" sang stage này
COPY --from=build /app/build/libs/*.jar app.jar
# ↑ --from=build: lấy file từ stage 1
# Chỉ copy 1 file JAR (~50MB), bỏ hết source code + dependencies

EXPOSE 8088
# ↑ Ghi chú port (documentation), KHÔNG tự mở port
# Phải dùng -p 8088:8088 khi docker run mới mở thật

ENTRYPOINT ["java", "-jar", "app.jar"]
# ↑ Lệnh chạy khi container start
# = java -jar app.jar
```

**Tại sao 2 stage (Multi-stage build)?**
```
Stage 1 (build): JDK 400MB + source code + dependencies = ~800MB
Stage 2 (run):   JRE 218MB + 1 file JAR 50MB            = ~270MB
                                                            ↑
                                              Image cuối chỉ 270MB thay vì 800MB!
```

### Dockerfile cho CineX Frontend

```dockerfile
# Stage 1: Build React app
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci                          # Cài dependencies (tương tự npm install nhưng dùng lock file)
COPY . .
RUN npm run build                   # Build ra folder dist/

# Stage 2: Serve bằng Nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# ↑ Copy folder build output vào thư mục Nginx serve
EXPOSE 80
# Nginx tự chạy khi container start (đã config trong image)
```

### Các lệnh Dockerfile phổ biến

| Lệnh | Tác dụng | Ví dụ |
|---|---|---|
| `FROM` | Image gốc để bắt đầu | `FROM node:20-alpine` |
| `WORKDIR` | Set thư mục làm việc | `WORKDIR /app` |
| `COPY` | Copy file từ host → container | `COPY package.json ./` |
| `RUN` | Chạy lệnh lúc BUILD | `RUN npm install` |
| `CMD` | Lệnh chạy khi container START | `CMD ["node", "server.js"]` |
| `ENTRYPOINT` | Giống CMD nhưng không bị override | `ENTRYPOINT ["java", "-jar"]` |
| `EXPOSE` | Ghi chú port (documentation) | `EXPOSE 8088` |
| `ENV` | Set biến môi trường | `ENV NODE_ENV=production` |
| `ARG` | Biến dùng lúc build (không có lúc run) | `ARG JAR_FILE=app.jar` |

### CMD vs ENTRYPOINT

```dockerfile
# CMD — có thể override khi docker run
CMD ["node", "server.js"]
docker run my-app              # → chạy node server.js
docker run my-app bash         # → chạy bash (override CMD)

# ENTRYPOINT — không bị override
ENTRYPOINT ["java", "-jar", "app.jar"]
docker run my-app              # → chạy java -jar app.jar
docker run my-app bash         # → chạy java -jar app.jar bash (nối thêm)
```

---

## 8. Docker Compose — Chạy nhiều container

### Tại sao cần Docker Compose?

```bash
# Không có Compose — phải chạy từng container, tự quản lý network
docker run -d --name sqlserver -e ... -p 1433:1433 mssql/server:2022
docker run -d --name redis -p 6379:6379 redis:7-alpine
docker run -d --name backend -p 8088:8088 --link sqlserver --link redis my-backend
docker run -d --name frontend -p 5173:80 --link backend my-frontend

# 4 lệnh dài, khó nhớ, dễ sai. Thêm service → thêm lệnh.

# Có Compose — 1 lệnh chạy tất cả
docker-compose up -d
# Docker đọc docker-compose.yml → tạo tất cả container + network + volume
```

### docker-compose.yml của CineX (giải thích chi tiết)

```yaml
# docker-compose.yml

# version không cần từ Docker Compose v2+

services:
  # ======== Service 1: SQL Server ========
  sqlserver:
    image: mcr.microsoft.com/mssql/server:2022-latest
    # ↑ Image từ Microsoft Container Registry
    # Docker tự download nếu chưa có (lần đầu ~700MB)

    container_name: cinex-sqlserver
    # ↑ Đặt tên container (mặc định = tên-folder_tên-service_1)

    environment:
      ACCEPT_EULA: "Y"               # Đồng ý license Microsoft (bắt buộc)
      MSSQL_SA_PASSWORD: "CineX@2026" # Password user SA
    # ↑ environment = biến môi trường truyền vào container
    # Giống -e khi docker run

    ports:
      - "1433:1433"
    # ↑ Port mapping: máy-host:container
    # localhost:1433 (máy bạn) → chuyển vào → container:1433 (SQL Server)
    # Giống chuyển tiếp cuộc gọi: gọi số 1433 → chuyển đến phòng SQL Server

    volumes:
      - sqlserver-data:/var/opt/mssql
    # ↑ Mount volume: data SQL Server lưu ở volume "sqlserver-data"
    # Container bị xóa → data vẫn còn (giống USB)

    restart: unless-stopped
    # ↑ Tự restart nếu crash, KHÔNG restart nếu user dừng thủ công

    healthcheck:
      test: /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "CineX@2026" -C -Q "SELECT 1"
      interval: 10s
      retries: 10
      start_period: 30s
    # ↑ Kiểm tra SQL Server đã sẵn sàng chưa
    # Mỗi 10 giây chạy lệnh SELECT 1, thử 10 lần, chờ 30 giây trước khi bắt đầu check
    # Các service phụ thuộc (backend) chờ healthcheck OK mới start

  # ======== Service 2: Redis ========
  redis:
    image: redis:7-alpine
    # ↑ Redis 7, Alpine Linux (bản nhẹ ~30MB thay vì ~100MB)
    container_name: cinex-redis
    ports:
      - "6379:6379"
    restart: unless-stopped

  # ======== Service 3: Backend (Spring Boot) ========
  backend:
    build:
      context: ./backend
    # ↑ KHÔNG dùng image có sẵn → build từ Dockerfile trong folder ./backend
    # Docker Compose tự chạy: docker build -t cinex-backend ./backend

    container_name: cinex-backend
    ports:
      - "8088:8088"

    environment:
      # Tên service = hostname trong Docker network
      DB_HOST: sqlserver            # ← KHÔNG phải localhost!
      DB_PORT: 1433                 #    Trong Docker, container gọi nhau bằng TÊN SERVICE
      DB_NAME: cinex
      DB_USERNAME: sa
      DB_PASSWORD: "CineX@2026"
      REDIS_HOST: redis             # ← Tên service redis = hostname
      REDIS_PORT: 6379
      CLOUDINARY_CLOUD_NAME: ${CLOUDINARY_CLOUD_NAME}  # Đọc từ file .env
      CLOUDINARY_API_KEY: ${CLOUDINARY_API_KEY}
      CLOUDINARY_API_SECRET: ${CLOUDINARY_API_SECRET}

    depends_on:
      sqlserver:
        condition: service_healthy  # Chờ SQL Server healthcheck OK
      redis:
        condition: service_started
    # ↑ depends_on: backend chỉ start SAU KHI sqlserver + redis đã ready
    # Không có depends_on → backend start trước → connect DB fail

    restart: unless-stopped

  # ======== Service 4: Frontend (React + Nginx) ========
  frontend:
    build:
      context: ./frontend
    container_name: cinex-frontend
    ports:
      - "5173:80"
    # ↑ FE build ra HTML/JS tĩnh → serve bằng Nginx (port 80)
    # Map ra 5173 trên máy host → truy cập http://localhost:5173
    depends_on:
      - backend
    restart: unless-stopped

# ======== Volumes ========
volumes:
  sqlserver-data:
  # ↑ Khai báo volume
  # Docker tự tạo + quản lý
  # Data nằm ở: /var/lib/docker/volumes/cinex_sqlserver-data/_data (Linux)
```

### Lệnh Docker Compose

```bash
# Chạy tất cả (background)
docker-compose up -d

# Chạy chỉ SQL Server + Redis (dev: backend chạy bằng ./gradlew bootRun)
docker-compose up sqlserver redis -d

# Chạy + build lại image (khi code thay đổi)
docker-compose up --build -d

# Dừng tất cả
docker-compose down

# Dừng + xóa volume (RESET DB — cẩn thận!)
docker-compose down -v

# Xem trạng thái
docker-compose ps

# Xem log tất cả service
docker-compose logs

# Xem log 1 service (follow)
docker-compose logs -f backend

# Restart 1 service
docker-compose restart backend

# Build lại image 1 service (không restart)
docker-compose build backend
```

---

## 9. Volume — Giữ data

### Vấn đề: Container là tạm thời

```
Container = process chạy trong sandbox
Container bị xóa → TẤT CẢ data bên trong MẤT

VD: SQL Server chạy trong container, bạn tạo 100 bảng + 1 triệu records
    docker-compose down → container xóa → DATABASE MẤT HẾT!
```

### Giải pháp: Volume

```
Volume = ổ cứng ảo nằm NGOÀI container
Container mount volume → đọc/ghi data vào volume
Container bị xóa → volume VẪN CÒN → data an toàn

┌───────────────────┐
│    Container      │
│  SQL Server       │──── mount ────▶ ┌──────────────┐
│  /var/opt/mssql   │                 │   Volume     │
└───────────────────┘                 │ sqlserver-data│
                                      │ (data files) │
docker-compose down                   └──────────────┘
Container bị XÓA                      Volume VẪN CÒN ✅

docker-compose up
Container MỚI ─── mount ────▶ Volume CŨ → DATA VẪN CÒN ✅
```

### 3 loại Volume

```yaml
# 1. Named Volume (Docker quản lý) — dùng cho production
volumes:
  - sqlserver-data:/var/opt/mssql
# Docker lưu ở: /var/lib/docker/volumes/sqlserver-data/_data
# Ưu: Docker quản lý, backup dễ, cross-platform

# 2. Bind Mount (map folder host) — dùng cho dev
volumes:
  - ./my-data:/var/opt/mssql
# Map thẳng folder ./my-data trên máy host
# Ưu: dễ xem file, dễ edit
# Nhược: path phụ thuộc OS (Mac vs Windows vs Linux)

# 3. Anonymous Volume (tạm) — ít dùng
volumes:
  - /var/opt/mssql
# Docker tự tạo volume random
# Khó quản lý, thường dùng cho data tạm
```

### Lệnh Volume

```bash
# Xem danh sách volume
docker volume ls
# DRIVER    VOLUME NAME
# local     cinex_sqlserver-data

# Xem chi tiết volume
docker volume inspect cinex_sqlserver-data
# Mountpoint: /var/lib/docker/volumes/cinex_sqlserver-data/_data

# Xóa volume (MẤT DATA!)
docker volume rm cinex_sqlserver-data

# Xóa TẤT CẢ volume không dùng
docker volume prune
```

---

## 10. Network — Container nói chuyện với nhau

### Vấn đề

```
Backend cần connect đến SQL Server
Nếu cả 2 chạy trên máy host → dùng localhost:1433
Nhưng trong Docker → mỗi container = 1 "máy" riêng → localhost = chính nó!

Backend container gọi localhost:1433 → tìm SQL Server TRONG chính backend → không có → lỗi!
```

### Giải pháp: Docker Network

```
Docker Compose tự tạo network cho tất cả service.
Mỗi service = 1 hostname trên network đó.

┌─────────────────── Docker Network: cinex_default ───────────────────┐
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐           │
│  │  sqlserver    │    │    redis     │    │   backend    │           │
│  │  (hostname)   │    │  (hostname)  │    │  (hostname)  │           │
│  │  port 1433    │    │  port 6379   │    │  port 8088   │           │
│  └──────────────┘    └──────────────┘    └──────────────┘           │
│         ▲                    ▲                                        │
│         │                    │                                        │
│         └──── backend gọi: "sqlserver:1433" ──── OK! ✅             │
│                              └── backend gọi: "redis:6379" ── OK! ✅│
└──────────────────────────────────────────────────────────────────────┘

Bên ngoài (máy host):
  localhost:1433 → forward vào sqlserver container (nhờ ports mapping)
  localhost:8088 → forward vào backend container
```

### Tóm lại

| Gọi từ đâu | Gọi SQL Server bằng | Lý do |
|---|---|---|
| Máy host (DBeaver, SSMS) | `localhost:1433` | Port mapping host → container |
| Backend container | `sqlserver:1433` | Docker network, tên service = hostname |
| Frontend container | `backend:8088` | Cùng Docker network |

Đó là lý do trong `docker-compose.yml`:
```yaml
environment:
  DB_HOST: sqlserver    # ← KHÔNG phải localhost
  REDIS_HOST: redis     # ← KHÔNG phải localhost
```

---

## 11. Layer & Cache — Tại sao build lần 2 nhanh hơn

### Image được tạo từ nhiều layer

```
Mỗi lệnh trong Dockerfile = 1 layer
Docker cache mỗi layer
Nếu lệnh + input KHÔNG đổi → dùng cache (skip)

Dockerfile:
FROM eclipse-temurin:21-jdk     ──▶ Layer 1 (base image)
COPY gradlew build.gradle ./    ──▶ Layer 2 (build files)
RUN ./gradlew dependencies      ──▶ Layer 3 (dependencies ~200MB)
COPY src src                    ──▶ Layer 4 (source code)
RUN ./gradlew build             ──▶ Layer 5 (compile)
```

### Build lần 1 (chậm — tải hết)

```
Layer 1: FROM eclipse-temurin:21-jdk    → Download 400MB
Layer 2: COPY build.gradle              → Copy file
Layer 3: RUN gradlew dependencies       → Download dependencies 200MB
Layer 4: COPY src                       → Copy source code
Layer 5: RUN gradlew build              → Compile
Tổng: ~5-10 phút
```

### Build lần 2 — chỉ sửa code (nhanh — dùng cache)

```
Layer 1: FROM eclipse-temurin:21-jdk    → CACHED ✅ (không đổi)
Layer 2: COPY build.gradle              → CACHED ✅ (build.gradle không đổi)
Layer 3: RUN gradlew dependencies       → CACHED ✅ (dependencies không đổi)
Layer 4: COPY src                       → CHANGED! (code đổi) → chạy lại
Layer 5: RUN gradlew build              → Chạy lại (vì layer 4 đổi)
Tổng: ~30 giây (chỉ compile, không download)
```

### Tại sao COPY build.gradle TRƯỚC COPY src?

```dockerfile
# ✅ ĐÚNG — tận dụng cache
COPY gradlew build.gradle ./      # Layer 2 — ít khi đổi
RUN ./gradlew dependencies        # Layer 3 — cache 200MB dependencies
COPY src src                      # Layer 4 — đổi thường xuyên
RUN ./gradlew build               # Layer 5

# ❌ SAI — mỗi lần sửa code = download lại dependencies
COPY . .                          # Layer 2 — bất kỳ file nào đổi → layer này đổi
RUN ./gradlew dependencies        # Layer 3 — PHẢI chạy lại (vì layer 2 đổi)
RUN ./gradlew build               # Layer 4 — PHẢI chạy lại
# → Mỗi lần sửa 1 dòng code = download lại 200MB dependencies!
```

**Quy tắc:** File ít thay đổi COPY trước, file thay đổi thường xuyên COPY sau.

---

## 12. Lệnh Docker thường dùng

### Cheat Sheet

```bash
# ===== IMAGE =====
docker images                        # Danh sách image
docker pull redis:7-alpine           # Tải image
docker rmi redis:7-alpine            # Xóa image
docker image prune -a                # Xóa image không dùng

# ===== CONTAINER =====
docker ps                            # Container đang chạy
docker ps -a                         # Tất cả container (kể cả stopped)
docker run -d --name x -p 80:80 img  # Tạo + chạy container
docker start container_name          # Start container đã stop
docker stop container_name           # Dừng container
docker restart container_name        # Restart
docker rm container_name             # Xóa container (phải stop trước)
docker rm -f container_name          # Force xóa (kể cả đang chạy)

# ===== LOG & DEBUG =====
docker logs container_name           # Xem log
docker logs -f container_name        # Follow log (realtime)
docker logs --tail 100 container_name # 100 dòng cuối
docker exec -it container_name bash  # Mở shell trong container
docker inspect container_name        # Xem chi tiết (IP, ports, volumes, ...)
docker stats                         # CPU, RAM realtime

# ===== COMPOSE =====
docker-compose up -d                 # Chạy tất cả (background)
docker-compose up sqlserver redis -d # Chạy 1 số service
docker-compose up --build -d         # Build lại + chạy
docker-compose down                  # Dừng + xóa container
docker-compose down -v               # Dừng + xóa container + volume
docker-compose ps                    # Trạng thái
docker-compose logs -f backend       # Log 1 service
docker-compose restart backend       # Restart 1 service
docker-compose build backend         # Build lại image 1 service

# ===== CLEANUP =====
docker system prune                  # Xóa tất cả không dùng (container, image, network)
docker system prune -a               # Xóa kể cả image không dùng
docker system df                     # Xem disk usage
```

---

## 13. Thực hành: Setup CineX từ zero

### Bước 1: Cài Docker Desktop

```bash
# Mac
brew install --cask docker
# Mở Docker Desktop → chờ icon 🐳 trên menu bar

# Verify
docker --version
```

### Bước 2: Clone project

```bash
git clone https://github.com/VuTuongAn/cinex.git
cd cinex
```

### Bước 3: Chạy SQL Server + Redis

```bash
# Chạy 2 service DB (backend chạy bằng Gradle, không cần Docker)
docker-compose up sqlserver redis -d

# Lần đầu: Docker tải image (~700MB SQL Server + ~30MB Redis)
# Chờ 30 giây cho SQL Server khởi động
```

### Bước 4: Kiểm tra container đang chạy

```bash
docker ps

# Kết quả mong đợi:
# NAMES              IMAGE                                     STATUS          PORTS
# cinex-sqlserver    mcr.microsoft.com/mssql/server:2022       Up 30 seconds   0.0.0.0:1433->1433
# cinex-redis        redis:7-alpine                            Up 30 seconds   0.0.0.0:6379->6379
```

### Bước 5: Tạo database

```bash
# Chờ SQL Server sẵn sàng (30 giây sau khi up)
docker exec cinex-sqlserver /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P 'CineX@2026' -C \
  -Q "CREATE DATABASE cinex"

# Verify
docker exec cinex-sqlserver /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P 'CineX@2026' -C \
  -Q "SELECT name FROM sys.databases"

# Kết quả: thấy "cinex" trong danh sách
```

### Bước 6: Chạy backend

```bash
cd backend
./gradlew bootRun

# Liquibase tự tạo bảng trong database cinex
# Server chạy ở http://localhost:8088
```

### Bước 7: Test

```bash
# Health check
curl http://localhost:8088/api/health

# Swagger UI
open http://localhost:8088/swagger-ui.html
```

### Bước 8: Khi xong — dừng

```bash
# Dừng backend: Ctrl+C

# Dừng Docker
docker-compose down        # Giữ data
# hoặc
docker-compose down -v     # Xóa data (reset DB)
```

---

## 14. Debug khi lỗi

### Lỗi 1: Docker Desktop chưa chạy

```bash
$ docker-compose up -d
# Cannot connect to the Docker daemon at unix:///var/run/docker.sock

# Fix: Mở Docker Desktop → chờ icon 🐳 xuất hiện
```

### Lỗi 2: Port bị chiếm

```bash
$ docker-compose up -d
# Error: Bind for 0.0.0.0:1433 failed: port is already allocated

# Nguyên nhân: SQL Server đã chạy trên máy host (hoặc container cũ)

# Fix 1: Tắt SQL Server trên máy host
# Fix 2: Đổi port trong docker-compose.yml
ports:
  - "1434:1433"   # Dùng port 1434 thay vì 1433
# Fix 3: Xóa container cũ
docker rm -f $(docker ps -aq)
```

### Lỗi 3: Container start rồi tắt ngay

```bash
$ docker ps    # Không thấy container

$ docker ps -a # Thấy STATUS = Exited (1)

# Xem log để biết lỗi gì:
$ docker logs cinex-sqlserver

# Lỗi thường gặp:
# 1. Password quá yếu → SQL Server yêu cầu password mạnh (chữ hoa + thường + số + ký tự đặc biệt)
# 2. Thiếu ACCEPT_EULA=Y
# 3. Không đủ RAM (SQL Server cần ít nhất 2GB)
```

### Lỗi 4: Backend không connect được DB

```bash
# Log backend: Connection refused to localhost:1433

# Nguyên nhân 1: Backend chạy TRONG Docker → phải dùng tên service
DB_HOST: sqlserver    # KHÔNG phải localhost

# Nguyên nhân 2: Backend chạy NGOÀI Docker (./gradlew bootRun) → dùng localhost
DB_HOST: localhost    # Vì connect từ máy host vào container qua port mapping

# Nguyên nhân 3: SQL Server chưa ready → chờ 30 giây sau khi docker-compose up
```

### Lỗi 5: Image pull fail

```bash
# Error: pull access denied, repository does not exist

# Fix 1: Check tên image đúng chưa
# Fix 2: Login Docker Hub (nếu image private)
docker login

# Fix 3: Network issue → check internet
```

### Lỗi 6: Disk đầy

```bash
# Error: no space left on device

# Xem disk usage
docker system df

# Dọn dẹp
docker system prune -a     # Xóa image + container không dùng
docker volume prune         # Xóa volume không dùng
```

---

## 15. Ví dụ thực tế ngoài CineX

### Chạy MySQL + phpMyAdmin (1 phút)

```yaml
# docker-compose.yml
services:
  mysql:
    image: mysql:8
    environment:
      MYSQL_ROOT_PASSWORD: root123
      MYSQL_DATABASE: mydb
    ports:
      - "3306:3306"

  phpmyadmin:
    image: phpmyadmin/phpmyadmin
    environment:
      PMA_HOST: mysql
    ports:
      - "8080:80"
    depends_on:
      - mysql
```

```bash
docker-compose up -d
# → Mở http://localhost:8080 → phpMyAdmin giao diện quản lý MySQL
```

### Chạy PostgreSQL + pgAdmin

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: mydb
    ports:
      - "5432:5432"

  pgadmin:
    image: dpage/pgadmin4
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@test.com
      PGADMIN_DEFAULT_PASSWORD: admin
    ports:
      - "5050:80"
```

### Chạy MongoDB + Mongo Express

```yaml
services:
  mongo:
    image: mongo:7
    ports:
      - "27017:27017"

  mongo-express:
    image: mongo-express
    environment:
      ME_CONFIG_MONGODB_URL: mongodb://mongo:27017/
    ports:
      - "8081:8081"
    depends_on:
      - mongo
```

### Chạy Elasticsearch + Kibana (Full-text search)

```yaml
services:
  elasticsearch:
    image: elasticsearch:8.12.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports:
      - "9200:9200"

  kibana:
    image: kibana:8.12.0
    ports:
      - "5601:5601"
    depends_on:
      - elasticsearch
```

### Chạy RabbitMQ (Message Queue)

```yaml
services:
  rabbitmq:
    image: rabbitmq:3-management
    ports:
      - "5672:5672"     # AMQP
      - "15672:15672"   # Management UI
    # → http://localhost:15672 (user: guest, pass: guest)
```

---

## 16. Best Practices

### Dockerfile

```dockerfile
# ✅ Dùng image cụ thể (có tag version)
FROM node:20-alpine

# ❌ Dùng latest → version thay đổi → build khác nhau
FROM node:latest

# ✅ Multi-stage build (image nhỏ hơn)
FROM node:20 AS build
RUN npm run build
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html

# ❌ Single stage (image to, chứa cả devDependencies)
FROM node:20
RUN npm install && npm run build
# Image chứa cả source code + node_modules → 1GB+

# ✅ File ít đổi COPY trước (tận dụng cache)
COPY package.json ./
RUN npm install
COPY src src

# ❌ COPY tất cả trước (mất cache)
COPY . .
RUN npm install

# ✅ Dùng .dockerignore (bỏ file không cần)
# .dockerignore:
# node_modules
# .git
# *.md
```

### Docker Compose

```yaml
# ✅ Đặt restart policy
restart: unless-stopped

# ✅ Dùng healthcheck cho database
healthcheck:
  test: ["CMD", "pg_isready"]
  interval: 10s
  retries: 5

# ✅ Dùng depends_on + condition
depends_on:
  db:
    condition: service_healthy

# ✅ Dùng .env file cho secrets (KHÔNG hardcode trong yml)
environment:
  DB_PASSWORD: ${DB_PASSWORD}

# ❌ Hardcode secrets
environment:
  DB_PASSWORD: "MySecretPassword123"
```

### Security

```bash
# ✅ Dùng .env file + .gitignore
echo "DB_PASSWORD=CineX@2026" > .env
echo ".env" >> .gitignore

# ❌ Commit secrets vào git
# docker-compose.yml chứa password → push lên GitHub → lộ

# ✅ Dùng non-root user trong container
# Dockerfile:
RUN adduser --disabled-password appuser
USER appuser

# ❌ Chạy container bằng root (mặc định)
# Nếu container bị hack → attacker có root access
```

---

## 17. Câu hỏi thường gặp

**1. Docker Desktop có mất phí không?**
→ Miễn phí cho cá nhân + công ty < 250 người. Doanh nghiệp lớn mất phí $5-24/user/tháng.

**2. Docker có chạy được trên máy yếu không?**
→ Tối thiểu 4GB RAM (SQL Server cần 2GB). 8GB RAM chạy thoải mái. 16GB+ chạy nhiều container.

**3. Container tắt thì data mất không?**
→ Nếu dùng Volume thì KHÔNG mất. Nếu không có Volume thì MẤT.

**4. Docker có thay thế được việc cài phần mềm không?**
→ Cho dev/test: CÓ. Cho production: phần lớn dự án deploy bằng Docker + Kubernetes.

**5. Khác gì giữa `docker-compose down` và `docker-compose stop`?**
→ `stop`: dừng container, giữ nguyên. `down`: dừng + XÓA container + network. Data trong volume vẫn còn trừ khi dùng `-v`.

**6. Tại sao backend dùng `sqlserver` làm DB_HOST thay vì `localhost`?**
→ Trong Docker network, mỗi container là 1 "máy" riêng. `localhost` = chính container đó. `sqlserver` = hostname của container SQL Server trên cùng network.

**7. Có cần Docker cho production không?**
→ Hầu hết dự án hiện đại: CÓ. Deploy lên AWS ECS, Google Cloud Run, Azure Container Instances đều dùng Docker image.

**8. Docker Compose vs Kubernetes?**
→ Compose: chạy trên 1 máy (dev, small project). Kubernetes: chạy trên nhiều máy (scale, auto-healing, load balancing). Compose đủ cho đồ án.

**9. Làm sao biết container đang chiếm bao nhiêu tài nguyên?**
```bash
docker stats
# CONTAINER     CPU %   MEM USAGE / LIMIT     NET I/O
# sqlserver     2.5%    512MiB / 4GiB         1.2kB / 500B
# redis         0.1%    8MiB / 4GiB           0B / 0B
```

**10. Làm sao backup database trong Docker?**
```bash
# SQL Server backup
docker exec cinex-sqlserver /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P 'CineX@2026' -C \
  -Q "BACKUP DATABASE cinex TO DISK='/var/opt/mssql/backup/cinex.bak'"

# Copy file backup ra máy host
docker cp cinex-sqlserver:/var/opt/mssql/backup/cinex.bak ./cinex-backup.bak
```
