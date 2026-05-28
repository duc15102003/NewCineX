# Hướng dẫn Deploy dự án CineX lên Server

> Tài liệu này hướng dẫn chi tiết cách đưa dự án CineX từ máy local lên server thật, phục vụ cho việc demo đồ án hoặc chạy production.

---

## Mục lục

1. [Tổng quan các cách deploy](#1-tổng-quan-các-cách-deploy)
2. [Chuẩn bị server (VPS)](#2-chuẩn-bị-server-vps)
3. [Deploy bằng Docker Compose (chi tiết)](#3-deploy-bằng-docker-compose-chi-tiết)
4. [Cấu hình production](#4-cấu-hình-production)
5. [Nginx reverse proxy](#5-nginx-reverse-proxy)
6. [Database backup](#6-database-backup)
7. [Monitoring cơ bản](#7-monitoring-cơ-bản)
8. [Quy trình cập nhật (update)](#8-quy-trình-cập-nhật-update)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Tổng quan các cách deploy

Có 3 cách phổ biến để deploy một dự án web fullstack:

### Option A: Docker Compose (Khuyên dùng)

Đóng gói toàn bộ ứng dụng (backend, frontend, database, Redis) vào các container Docker, rồi chạy trên server bằng một lệnh duy nhất.

**Ưu điểm:**
- Một lệnh `docker-compose up` là chạy toàn bộ hệ thống
- Môi trường giống hệt nhau giữa dev và production (không còn "máy tao chạy được mà")
- Dễ rollback: quay lại image cũ nếu lỗi
- Dễ scale: thêm replica nếu cần

**Nhược điểm:**
- Cần học Docker (nhưng đáng học, vì ngoài đời ai cũng dùng)
- Tốn thêm RAM cho Docker daemon (~200MB)

### Option B: Deploy thủ công (JAR + Nginx)

Build backend thành file `.jar`, chạy trực tiếp bằng `java -jar`. Frontend build thành static files, serve bằng Nginx.

**Ưu điểm:**
- Không cần Docker, ít overhead hơn
- Dễ debug trực tiếp trên server

**Nhược điểm:**
- Phải cài Java, Node.js, SQL Server, Redis thủ công trên server
- Mỗi service quản lý riêng (systemd service), phức tạp
- Khó đảm bảo môi trường giống nhau giữa các máy

### Option C: Cloud Platform (Railway, Render, Heroku)

Dùng dịch vụ cloud để host, chỉ cần push code lên là tự deploy.

**Ưu điểm:**
- Không cần quản lý server, SSL tự động
- CI/CD sẵn: push code → tự build → tự deploy

**Nhược điểm:**
- Tốn tiền (free tier giới hạn, SQL Server thường không có sẵn)
- Ít kiểm soát cấu hình
- SQL Server khó tìm được cloud hỗ trợ miễn phí

### So sánh tổng hợp

| Tiêu chí | Docker Compose | Thủ công | Cloud Platform |
|---|---|---|---|
| Độ khó | Trung bình | Cao | Thấp |
| Chi phí | VPS ~100-200k/tháng | VPS ~100-200k/tháng | 0-500k/tháng |
| Kiểm soát | Cao | Cao | Thấp |
| Phù hợp đồ án | Tốt nhất | OK | Khó (SQL Server) |
| Học được gì | Docker, DevOps | Linux admin | Cloud services |

**Khuyến nghị:** Dùng **Option A (Docker Compose)** vì dự án CineX đã có sẵn Dockerfile và docker-compose.yml, và đây cũng là kỹ năng mà nhà tuyển dụng rất coi trọng.

---

## 2. Chuẩn bị server (VPS)

### 2.1. Yêu cầu tối thiểu

| Tài nguyên | Tối thiểu | Khuyên dùng |
|---|---|---|
| RAM | 2GB | 4GB |
| CPU | 1 vCPU | 2 vCPU |
| SSD | 20GB | 40GB |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| Băng thông | 1TB/tháng | Unlimited |

**Tại sao 2GB RAM là tối thiểu?**
- SQL Server cần ~500MB RAM tối thiểu
- Java (Spring Boot) cần ~256-512MB
- Redis cần ~50MB
- Nginx + Docker daemon cần ~200MB
- Tổng cộng khoảng 1.5GB, cần dư ~500MB cho OS

**Nơi mua VPS giá rẻ:**
- DigitalOcean: $12/tháng (2GB RAM)
- Vultr: $12/tháng (2GB RAM)
- Linode: $12/tháng (2GB RAM)
- Việt Nam: VNIS, Bizfly, TinoHost (~100-200k/tháng)

### 2.2. Cài Docker + Docker Compose trên Ubuntu 22.04

SSH vào server rồi chạy từng bước:

```bash
# Bước 1: Cập nhật hệ thống
# Tại sao: đảm bảo có bản vá bảo mật mới nhất
sudo apt update && sudo apt upgrade -y

# Bước 2: Cài các package cần thiết để apt dùng HTTPS
# Tại sao: Docker repository dùng HTTPS, cần các công cụ này
sudo apt install -y ca-certificates curl gnupg lsb-release

# Bước 3: Thêm Docker GPG key (xác thực nguồn cài đặt)
# Tại sao: đảm bảo package tải về đúng từ Docker, không bị giả mạo
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Bước 4: Thêm Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Bước 5: Cài Docker Engine + Docker Compose plugin
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Bước 6: Cho phép user hiện tại chạy Docker không cần sudo
# Tại sao: chạy sudo mỗi lần rất phiền, và không nên chạy app bằng root
sudo usermod -aG docker $USER

# Bước 7: Logout rồi login lại để group mới có hiệu lực
exit
# SSH lại vào server

# Bước 8: Kiểm tra Docker đã cài thành công
docker --version
docker compose version
```

### 2.3. Mở port trên firewall

```bash
# Ubuntu dùng UFW (Uncomplicated Firewall)
# Tại sao cần mở port: mặc định firewall chặn tất cả, phải cho phép cụ thể

sudo ufw allow 22/tcp    # SSH — nếu không mở cái này, sẽ bị lock out khỏi server!
sudo ufw allow 80/tcp    # HTTP — web thường
sudo ufw allow 443/tcp   # HTTPS — web mã hóa
sudo ufw enable           # Bật firewall

# Kiểm tra
sudo ufw status
```

**Lưu ý quan trọng:** KHÔNG mở port 1433 (SQL Server) và 6379 (Redis) ra ngoài internet. Các service này chỉ giao tiếp nội bộ trong Docker network, không cần expose ra ngoài. Mở ra ngoài = mời hacker vào database.

### 2.4. Tạo user non-root và cấu hình SSH key

```bash
# Trên server (đang login bằng root)

# Bước 1: Tạo user mới
# Tại sao: không nên chạy mọi thứ bằng root, vì lỡ bị hack thì hacker có full quyền
adduser cinex
usermod -aG sudo cinex
usermod -aG docker cinex

# Bước 2: Copy SSH key sang user mới
mkdir -p /home/cinex/.ssh
cp /root/.ssh/authorized_keys /home/cinex/.ssh/
chown -R cinex:cinex /home/cinex/.ssh
chmod 700 /home/cinex/.ssh
chmod 600 /home/cinex/.ssh/authorized_keys
```

```bash
# Trên máy local (máy của bạn)

# Tạo SSH key nếu chưa có
# Tại sao dùng SSH key: an toàn hơn password, không bị brute-force
ssh-keygen -t ed25519 -C "your_email@example.com"

# Copy public key lên server
ssh-copy-id cinex@YOUR_SERVER_IP

# Từ giờ SSH không cần nhập password nữa
ssh cinex@YOUR_SERVER_IP
```

---

## 3. Deploy bằng Docker Compose (chi tiết)

### 3.1. Dockerfile cho Backend (đã có sẵn)

File: `backend/Dockerfile`

```dockerfile
# ===== STAGE 1: BUILD =====
# Dùng JDK (có compiler) để build source code thành file .jar
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app

# Copy file cấu hình Gradle trước, cài dependencies trước
# Tại sao tách riêng: Docker cache layer — nếu code thay đổi nhưng dependencies
# không đổi, Docker sẽ dùng cache, không cần tải lại dependencies (tiết kiệm 2-5 phút)
COPY gradle gradle
COPY gradlew build.gradle settings.gradle ./
RUN chmod +x gradlew && ./gradlew dependencies --no-daemon

# Sau đó mới copy source code và build
COPY src src
RUN ./gradlew clean build -x test --no-daemon

# ===== STAGE 2: RUNTIME =====
# Dùng JRE (chỉ có runtime, không có compiler) — nhẹ hơn JDK rất nhiều
# Tại sao multi-stage: JDK image ~400MB, JRE image ~200MB
# Chỉ copy file .jar từ stage build sang, bỏ hết source code và build tools
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/build/libs/*.jar app.jar
EXPOSE 8088
ENTRYPOINT ["java", "-jar", "app.jar"]
```

**Giải thích Multi-stage Build:**

Hãy tưởng tượng bạn đang nấu ăn:
- **Stage 1 (Build):** Bạn cần bếp lớn, dao, thớt, nguyên liệu thô → đây là "nhà bếp" (JDK + Gradle + source code)
- **Stage 2 (Runtime):** Khi ăn, bạn chỉ cần đĩa + thức ăn đã nấu xong → đây là "bàn ăn" (JRE + file .jar)

Nếu không dùng multi-stage, Docker image sẽ chứa cả "nhà bếp" lẫn "bàn ăn" → image nặng ~800MB thay vì ~250MB.

### 3.2. Dockerfile cho Frontend (đã có sẵn)

File: `frontend/Dockerfile`

```dockerfile
# ===== STAGE 1: BUILD =====
# Dùng Node.js để build React app thành static HTML/CSS/JS
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci       # ci = clean install, đảm bảo cài đúng version trong lock file
COPY . .
RUN npm run build  # Output ra thư mục /app/dist

# ===== STAGE 2: SERVE =====
# Dùng Nginx (web server nhẹ, nhanh) để serve static files
# Tại sao không dùng Node.js serve: Nginx xử lý static files nhanh hơn 10x
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 3.3. docker-compose.prod.yml cho Production

Tạo file `docker-compose.prod.yml` ở thư mục gốc dự án. File này khác với `docker-compose.yml` (dùng cho dev) ở chỗ:
- Thêm `restart: always` (tự khởi động lại nếu crash)
- Không expose port database/Redis ra ngoài
- Dùng `.env` file cho secrets
- Thêm healthcheck
- Giới hạn tài nguyên (memory limit)

```yaml
services:
  sqlserver:
    image: mcr.microsoft.com/mssql/server:2022-latest
    environment:
      ACCEPT_EULA: "Y"
      MSSQL_SA_PASSWORD: "${DB_PASSWORD}"
    # KHÔNG expose port 1433 ra ngoài — chỉ giao tiếp nội bộ Docker network
    # Tại sao: database KHÔNG BAO GIỜ nên public ra internet
    volumes:
      - sqlserver-data:/var/opt/mssql  # Persistent volume — data không mất khi restart
    restart: always  # Tự restart nếu crash
    healthcheck:
      test: /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$${MSSQL_SA_PASSWORD}" -C -Q "SELECT 1"
      interval: 30s
      timeout: 10s
      retries: 5

  redis:
    image: redis:7-alpine
    # KHÔNG expose port 6379 ra ngoài
    volumes:
      - redis-data:/data  # Persist Redis data
    restart: always
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8088:8088"
    environment:
      SPRING_PROFILES_ACTIVE: prod
      DB_HOST: sqlserver
      DB_PORT: 1433
      DB_NAME: "${DB_NAME}"
      DB_USERNAME: "${DB_USERNAME}"
      DB_PASSWORD: "${DB_PASSWORD}"
      REDIS_HOST: redis
      REDIS_PORT: 6379
      JWT_SECRET: "${JWT_SECRET}"
      JWT_EXPIRATION: "${JWT_EXPIRATION:-900000}"
      JWT_REFRESH_EXPIRATION: "${JWT_REFRESH_EXPIRATION:-604800000}"
      FRONTEND_URL: "${FRONTEND_URL}"
      CLOUDINARY_CLOUD_NAME: "${CLOUDINARY_CLOUD_NAME}"
      CLOUDINARY_API_KEY: "${CLOUDINARY_API_KEY}"
      CLOUDINARY_API_SECRET: "${CLOUDINARY_API_SECRET}"
      MAIL_HOST: "${MAIL_HOST}"
      MAIL_PORT: "${MAIL_PORT}"
      MAIL_USERNAME: "${MAIL_USERNAME}"
      MAIL_PASSWORD: "${MAIL_PASSWORD}"
      # Giới hạn RAM cho JVM — tránh dùng hết RAM server
      JAVA_OPTS: "-Xms256m -Xmx512m"
    depends_on:
      sqlserver:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: always

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "80:80"
      - "443:443"
    volumes:
      # Mount nginx config và SSL certs từ host vào container
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf
      - ./nginx/ssl:/etc/nginx/ssl  # SSL certificates
    depends_on:
      - backend
    restart: always

volumes:
  sqlserver-data:   # Volume cho SQL Server — data được lưu ở đây
  redis-data:       # Volume cho Redis
```

**Giải thích Volume Persistence:**

Hãy tưởng tượng Docker container là một căn phòng trọ. Khi bạn dọn đi (xóa container), mọi đồ đạc trong phòng đều mất. **Volume** giống như một cái tủ sắt gắn vào tường — dù bạn dọn đi rồi quay lại phòng mới, tủ sắt vẫn còn đó với đồ bên trong.

Cụ thể:
- `sqlserver-data:/var/opt/mssql` → Dữ liệu SQL Server (users, bookings, movies...) được lưu trong volume `sqlserver-data`. Khi bạn chạy `docker-compose down` rồi `up` lại, data vẫn còn.
- Nếu chạy `docker-compose down -v` (thêm flag `-v`) → **XÓA CẢ VOLUME** → mất hết data. Cẩn thận!

### 3.4. File .env cho Production

Tạo file `.env` ở cùng thư mục với `docker-compose.prod.yml`:

```bash
# ===== DATABASE =====
DB_NAME=cinex
DB_USERNAME=sa
DB_PASSWORD=MatKhauCucManh@2026!

# ===== JWT =====
# QUAN TRỌNG: Phải generate random, đủ dài (256-bit / 32 bytes trở lên)
# Lệnh generate: openssl rand -base64 64
JWT_SECRET=THAY_BANG_CHUOI_RANDOM_DAI_64_KY_TU_TRO_LEN
JWT_EXPIRATION=900000
JWT_REFRESH_EXPIRATION=604800000

# ===== FRONTEND URL =====
# Dùng cho CORS — chỉ cho phép domain này gọi API
FRONTEND_URL=https://cinex.yourdomain.com

# ===== CLOUDINARY (upload ảnh) =====
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# ===== MAIL (gửi email xác nhận) =====
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your_email@gmail.com
MAIL_PASSWORD=your_app_password
```

**QUAN TRONG:** Thêm `.env` vào `.gitignore` để KHÔNG push secrets lên git:

```bash
echo ".env" >> .gitignore
```

**Generate JWT Secret an toàn:**

```bash
# Lệnh này tạo chuỗi random 64 bytes, encode base64
# Tại sao cần random: nếu dùng chuỗi đoán được (như "secret123"),
# hacker có thể giả mạo JWT token → truy cập account bất kỳ
openssl rand -base64 64
```

### 3.5. Các bước deploy

```bash
# ===== TRÊN MÁY LOCAL =====

# Bước 1: Push code lên Git
git add .
git commit -m "chore: add production docker compose"
git push origin main

# ===== TRÊN SERVER =====

# Bước 2: Clone project
cd /home/cinex
git clone https://github.com/your-username/cinex.git
cd cinex

# Bước 3: Tạo file .env (copy nội dung ở trên, thay giá trị thật)
nano .env

# Bước 4: Tạo database lần đầu
# Chạy SQL Server trước
docker compose -f docker-compose.prod.yml up -d sqlserver
# Đợi ~30 giây cho SQL Server khởi động
sleep 30
# Tạo database
docker exec cinex-sqlserver-1 /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P 'MatKhauCucManh@2026!' -C \
  -Q "CREATE DATABASE cinex"

# Bước 5: Chạy toàn bộ hệ thống
docker compose -f docker-compose.prod.yml up -d --build

# Bước 6: Kiểm tra tất cả container đang chạy
docker compose -f docker-compose.prod.yml ps

# Bước 7: Xem log backend (kiểm tra có lỗi không)
docker compose -f docker-compose.prod.yml logs -f backend
# Nhấn Ctrl+C để thoát xem log

# Bước 8: Test thử
curl http://localhost:8088/api/health
curl http://localhost  # Frontend
```

---

## 4. Cấu hình Production

### 4.1. application-prod.yml

Tạo file `backend/src/main/resources/application-prod.yml` — cấu hình riêng cho production, khác dev ở nhiều điểm:

```yaml
spring:
  datasource:
    url: jdbc:sqlserver://${DB_HOST}:${DB_PORT};databaseName=${DB_NAME};encrypt=true;trustServerCertificate=true
    username: ${DB_USERNAME}
    password: ${DB_PASSWORD}
    driver-class-name: com.microsoft.sqlserver.jdbc.SQLServerDriver
    # Connection pool — giới hạn số kết nối đến DB
    hikari:
      maximum-pool-size: 10       # Tối đa 10 connection cùng lúc
      minimum-idle: 2             # Luôn giữ 2 connection sẵn
      connection-timeout: 30000   # Timeout 30s nếu không lấy được connection

  jpa:
    hibernate:
      ddl-auto: validate    # KHÔNG BAO GIỜ dùng update/create trên production!
      # Tại sao: ddl-auto=update có thể thay đổi schema DB không kiểm soát
      # Dùng Liquibase để quản lý schema thay đổi có kiểm soát
    show-sql: false          # Tắt log SQL — production không cần, giảm noise
    properties:
      hibernate:
        dialect: org.hibernate.dialect.SQLServerDialect
        format_sql: false    # Tắt format SQL — giảm log size

  liquibase:
    change-log: classpath:db/changelog/db.changelog-master.xml

  data:
    redis:
      host: ${REDIS_HOST}
      port: ${REDIS_PORT}

  mail:
    host: ${MAIL_HOST}
    port: ${MAIL_PORT}
    username: ${MAIL_USERNAME}
    password: ${MAIL_PASSWORD}
    properties:
      mail.smtp.auth: true
      mail.smtp.starttls.enable: true

# Log level: chỉ log WARN trở lên — production không cần DEBUG
# Tại sao: DEBUG log rất nhiều, tốn disk, khó tìm lỗi thật sự
logging:
  level:
    root: WARN
    com.cinex: INFO                     # Code của mình: log INFO
    org.springframework.security: WARN  # Security: chỉ log warning
    org.hibernate.SQL: WARN             # Tắt log SQL query
  file:
    name: /app/logs/cinex.log           # Ghi log ra file
  logback:
    rollingpolicy:
      max-file-size: 50MB              # Mỗi file log tối đa 50MB
      max-history: 7                    # Giữ 7 ngày log
```

**So sánh Dev vs Production:**

| Cấu hình | Dev | Production | Tại sao |
|---|---|---|---|
| `ddl-auto` | `validate` | `validate` | Dùng Liquibase quản lý schema |
| `show-sql` | `true` | `false` | Prod không cần xem SQL, giảm log |
| Log level | `DEBUG` | `WARN/INFO` | Debug quá nhiều log, tốn disk |
| Connection pool | Mặc định | Cấu hình rõ | Kiểm soát tài nguyên DB |
| Log file | Console | File + rotation | Dễ xem lại, không mất khi restart |

### 4.2. Environment Variables — Tại sao KHÔNG được hardcode secrets

```
SAI (hardcode):
  jwt.secret=mySecretKey123

ĐÚNG (environment variable):
  jwt.secret=${JWT_SECRET}
```

**Tại sao?**
1. **Bảo mật:** Nếu push code lên GitHub, ai cũng thấy secret → hack được hệ thống
2. **Linh hoạt:** Mỗi môi trường (dev/staging/prod) dùng secret khác nhau
3. **Thực tế:** 100% công ty ngoài đời đều dùng env vars hoặc secret manager (Vault, AWS Secrets Manager)

### 4.3. CORS cho domain production

Trong `application.yml`, giá trị `app.frontend-url` cần trỏ đến domain thật:

```yaml
# Dev:
app:
  frontend-url: http://localhost:5173

# Production (qua env var):
app:
  frontend-url: ${FRONTEND_URL:http://localhost:5173}
```

Khi deploy, set env var `FRONTEND_URL=https://cinex.yourdomain.com` để CORS chỉ cho phép domain đó gọi API.

### 4.4. HTTPS với Let's Encrypt

HTTPS mã hóa dữ liệu giữa browser và server. Không có HTTPS → password, JWT token bị lộ khi truyền qua mạng.

**Cách 1: Certbot (miễn phí, tự động)**

```bash
# Cài Certbot trên server
sudo apt install -y certbot

# Tạm dừng frontend container (vì certbot cần port 80)
docker compose -f docker-compose.prod.yml stop frontend

# Lấy certificate
sudo certbot certonly --standalone -d cinex.yourdomain.com

# Certificate sẽ ở: /etc/letsencrypt/live/cinex.yourdomain.com/
# Copy vào thư mục nginx/ssl
sudo cp /etc/letsencrypt/live/cinex.yourdomain.com/fullchain.pem ./nginx/ssl/
sudo cp /etc/letsencrypt/live/cinex.yourdomain.com/privkey.pem ./nginx/ssl/

# Khởi động lại frontend
docker compose -f docker-compose.prod.yml up -d frontend
```

**Cách 2: Cloudflare (đơn giản hơn)**

1. Đăng ký Cloudflare (miễn phí)
2. Trỏ domain về Cloudflare DNS
3. Bật "Flexible SSL" trong Cloudflare → HTTPS tự động
4. Không cần cài certbot trên server

---

## 5. Nginx Reverse Proxy

### 5.1. Tại sao cần Nginx?

Nginx đóng vai trò "người gác cổng":
- **Frontend:** Serve static files (HTML/CSS/JS) cực nhanh
- **Reverse proxy:** Chuyển tiếp request `/api/*` → backend:8088
- **SSL termination:** Xử lý HTTPS, backend không cần biết về SSL
- **Gzip compression:** Nén response, trang load nhanh hơn
- **WebSocket proxy:** Chuyển tiếp kết nối WebSocket

### 5.2. nginx.conf hoàn chỉnh cho Production

Tạo file `nginx/nginx.conf`:

```nginx
# Cấu hình upstream — định nghĩa backend server
# Tại sao dùng upstream: dễ thêm nhiều backend sau này (load balancing)
upstream backend_server {
    server backend:8088;
}

# ===== Redirect HTTP → HTTPS =====
# Tại sao: mọi request HTTP đều chuyển sang HTTPS để bảo mật
server {
    listen 80;
    server_name cinex.yourdomain.com;

    # Let's Encrypt challenge (dùng khi renew certificate)
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect tất cả request khác sang HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

# ===== HTTPS Server =====
server {
    listen 443 ssl;
    server_name cinex.yourdomain.com;

    # ----- SSL Certificate -----
    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    # Cấu hình SSL bảo mật (theo khuyến nghị Mozilla)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # ----- Gzip Compression -----
    # Tại sao: giảm kích thước response 60-80%, trang load nhanh hơn
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 256;

    # ----- Frontend: Static Files -----
    root /usr/share/nginx/html;
    index index.html;

    # SPA (Single Page Application) — mọi route đều trả về index.html
    # Tại sao: React Router xử lý routing phía client, Nginx chỉ cần serve index.html
    # Nếu không có try_files, truy cập /movies sẽ trả 404 vì không có file /movies trên server
    location / {
        try_files $uri $uri/ /index.html;

        # Cache static assets (JS/CSS/images) — browser không cần tải lại
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
            expires 30d;
            add_header Cache-Control "public, immutable";
        }
    }

    # ----- API: Proxy sang Backend -----
    # Mọi request /api/* được chuyển tiếp đến Spring Boot backend
    location /api/ {
        proxy_pass http://backend_server;

        # Giữ thông tin gốc của client (IP, host)
        # Tại sao: nếu không set, backend sẽ thấy IP = 172.x.x.x (IP Docker)
        # thay vì IP thật của user
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeout — tránh chờ mãi nếu backend bị treo
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # ----- WebSocket: Proxy sang Backend -----
    # Tại sao cần cấu hình riêng: WebSocket dùng protocol upgrade,
    # khác với HTTP thông thường. Nếu không set Upgrade header, kết nối WS sẽ fail.
    location /ws/ {
        proxy_pass http://backend_server;
        proxy_http_version 1.1;

        # 2 header quan trọng cho WebSocket
        proxy_set_header Upgrade $http_upgrade;      # Nâng cấp từ HTTP → WebSocket
        proxy_set_header Connection "upgrade";       # Giữ kết nối mở
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;

        # WebSocket timeout dài hơn (kết nối lâu dài)
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # ----- Swagger UI (chỉ bật khi cần debug, nên tắt trên production) -----
    location /swagger-ui/ {
        proxy_pass http://backend_server;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    location /v3/api-docs {
        proxy_pass http://backend_server;
        proxy_set_header Host $host;
    }
}
```

**Nếu chưa có SSL (dev/demo), dùng config đơn giản hơn:**

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://backend:8088;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws/ {
        proxy_pass http://backend:8088;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
    }
}
```

### 5.3. Sơ đồ luồng request

```
Client (Browser)
    │
    ▼
  Nginx (:80/:443)
    ├── /            → Serve static files (React app)
    ├── /movies      → try_files → /index.html (React Router xử lý)
    ├── /api/movies  → Proxy → Backend:8088/api/movies
    └── /ws/         → WebSocket Proxy → Backend:8088/ws/
```

---

## 6. Database Backup

### 6.1. Tại sao cần backup?

Database chứa toàn bộ dữ liệu quan trọng: users, bookings, payments. Nếu mất data (server hỏng, bị hack, lỡ xóa) mà không có backup → mất hết.

Quy tắc backup: **3-2-1 Rule**
- **3** bản copy data
- **2** loại storage khác nhau (local + cloud)
- **1** bản ở offsite (ngoài server)

### 6.2. Script backup SQL Server

Tạo file `scripts/backup-db.sh`:

```bash
#!/bin/bash

# ===== CẤU HÌNH =====
BACKUP_DIR="/home/cinex/backups"
DB_CONTAINER="cinex-sqlserver-1"    # Tên container SQL Server
DB_NAME="cinex"
DB_PASSWORD="MatKhauCucManh@2026!"  # Hoặc đọc từ .env
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="cinex_${DATE}.bak"
RETENTION_DAYS=7  # Giữ backup 7 ngày gần nhất

# ===== TẠO THƯ MỤC =====
mkdir -p ${BACKUP_DIR}

# ===== BACKUP =====
echo "[$(date)] Bắt đầu backup database ${DB_NAME}..."

# Chạy lệnh BACKUP DATABASE bên trong container SQL Server
docker exec ${DB_CONTAINER} /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "${DB_PASSWORD}" -C \
  -Q "BACKUP DATABASE [${DB_NAME}] TO DISK = N'/var/opt/mssql/backup/${BACKUP_FILE}' WITH FORMAT, COMPRESSION"

# Copy file backup từ container ra host
docker cp ${DB_CONTAINER}:/var/opt/mssql/backup/${BACKUP_FILE} ${BACKUP_DIR}/

# ===== DỌN DẸP FILE CŨ =====
# Xóa backup cũ hơn 7 ngày — tránh đầy disk
echo "[$(date)] Xóa backup cũ hơn ${RETENTION_DAYS} ngày..."
find ${BACKUP_DIR} -name "cinex_*.bak" -mtime +${RETENTION_DAYS} -delete

# ===== UPLOAD LÊN CLOUD (tùy chọn) =====
# Dùng rclone để upload lên Google Drive / S3
# Cài rclone: curl https://rclone.org/install.sh | sudo bash
# Cấu hình: rclone config (chọn Google Drive hoặc S3)
# rclone copy ${BACKUP_DIR}/${BACKUP_FILE} gdrive:cinex-backups/

echo "[$(date)] Backup hoàn tất: ${BACKUP_FILE}"
echo "[$(date)] Kích thước: $(du -h ${BACKUP_DIR}/${BACKUP_FILE} | cut -f1)"
```

Phân quyền và chạy thử:

```bash
chmod +x scripts/backup-db.sh
./scripts/backup-db.sh
```

### 6.3. Cron job backup tự động hàng ngày

```bash
# Mở cron editor
crontab -e

# Thêm dòng này: backup lúc 3 giờ sáng mỗi ngày
# Tại sao 3h sáng: ít traffic nhất, backup không ảnh hưởng performance
0 3 * * * /home/cinex/cinex/scripts/backup-db.sh >> /home/cinex/backups/backup.log 2>&1
```

**Giải thích cron expression:** `0 3 * * *`
```
┌───── phút (0-59)        → 0 (phút 0)
│ ┌─── giờ (0-23)         → 3 (3 giờ sáng)
│ │ ┌─ ngày trong tháng   → * (mỗi ngày)
│ │ │ ┌─ tháng            → * (mỗi tháng)
│ │ │ │ ┌─ ngày trong tuần → * (mỗi ngày)
0 3 * * *
```

### 6.4. Script restore (khôi phục) database

```bash
#!/bin/bash
# scripts/restore-db.sh
# Dùng khi cần khôi phục data từ backup

BACKUP_FILE=$1  # Truyền tên file backup qua argument
DB_CONTAINER="cinex-sqlserver-1"
DB_PASSWORD="MatKhauCucManh@2026!"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: ./restore-db.sh cinex_20260527_030000.bak"
    echo "Available backups:"
    ls -lh /home/cinex/backups/cinex_*.bak
    exit 1
fi

echo "CẢNH BÁO: Restore sẽ GHI ĐÈ toàn bộ database hiện tại!"
read -p "Bạn chắc chắn? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Đã hủy."
    exit 0
fi

# Copy file backup vào container
docker cp /home/cinex/backups/${BACKUP_FILE} ${DB_CONTAINER}:/var/opt/mssql/backup/

# Restore
docker exec ${DB_CONTAINER} /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "${DB_PASSWORD}" -C \
  -Q "RESTORE DATABASE [cinex] FROM DISK = N'/var/opt/mssql/backup/${BACKUP_FILE}' WITH REPLACE"

echo "Restore hoàn tất từ ${BACKUP_FILE}"
```

### 6.5. Nơi lưu backup

| Nơi lưu | Ưu điểm | Nhược điểm |
|---|---|---|
| Local server | Nhanh, dễ restore | Server hỏng = mất backup |
| Google Drive (rclone) | Miễn phí 15GB | Tốc độ upload chậm |
| AWS S3 | Bền, rẻ ($0.023/GB/tháng) | Cần setup IAM |
| Một VPS khác | Toàn quyền kiểm soát | Tốn thêm tiền VPS |

**Khuyến nghị cho đồ án:** Local + Google Drive là đủ.

---

## 7. Monitoring cơ bản

### 7.1. Xem log container

```bash
# Xem log backend (realtime, theo dõi liên tục)
docker compose -f docker-compose.prod.yml logs -f backend

# Xem 100 dòng log gần nhất
docker compose -f docker-compose.prod.yml logs --tail=100 backend

# Xem log tất cả services
docker compose -f docker-compose.prod.yml logs -f

# Xem log SQL Server (debug kết nối DB)
docker compose -f docker-compose.prod.yml logs -f sqlserver
```

### 7.2. Spring Boot Actuator

Actuator cung cấp các endpoint để kiểm tra "sức khỏe" của ứng dụng.

Thêm dependency vào `build.gradle` (nếu chưa có):

```gradle
implementation 'org.springframework.boot:spring-boot-starter-actuator'
```

Cấu hình trong `application-prod.yml`:

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics   # Chỉ expose các endpoint cần thiết
      base-path: /actuator
  endpoint:
    health:
      show-details: when-authorized    # Chỉ admin mới thấy chi tiết
```

Kiểm tra:

```bash
# Health check — backend có đang sống không?
curl http://localhost:8088/actuator/health
# Response: {"status":"UP"}

# Nếu DB hoặc Redis chết:
# Response: {"status":"DOWN","components":{"db":{"status":"DOWN"}}}
```

### 7.3. Kiểm tra tài nguyên server

```bash
# ===== DISK SPACE =====
# Tại sao quan trọng: disk đầy → database crash, log không ghi được
df -h
# Chú ý cột Use% — nếu > 80% thì cần dọn dẹp

# ===== MEMORY =====
# Tại sao: hết RAM → Linux OOM killer sẽ kill process (thường kill SQL Server trước)
free -h
# Hoặc xem RAM từng container:
docker stats --no-stream

# ===== CPU =====
top -bn1 | head -20

# ===== CONTAINER STATUS =====
# Kiểm tra tất cả container có đang chạy không
docker compose -f docker-compose.prod.yml ps
# Status phải là "Up" — nếu "Restarting" nghĩa là container bị crash liên tục
```

### 7.4. Script health check tự động

Tạo file `scripts/health-check.sh`:

```bash
#!/bin/bash
# Chạy mỗi 5 phút qua cron, gửi cảnh báo nếu service chết

BACKEND_URL="http://localhost:8088/actuator/health"
FRONTEND_URL="http://localhost"

# Kiểm tra backend
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" ${BACKEND_URL} --max-time 10)
if [ "$BACKEND_STATUS" != "200" ]; then
    echo "[$(date)] CẢNH BÁO: Backend KHÔNG phản hồi! Status: ${BACKEND_STATUS}" >> /home/cinex/backups/health.log
    # Tự động restart nếu cần
    docker compose -f /home/cinex/cinex/docker-compose.prod.yml restart backend
fi

# Kiểm tra frontend
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" ${FRONTEND_URL} --max-time 10)
if [ "$FRONTEND_STATUS" != "200" ]; then
    echo "[$(date)] CẢNH BÁO: Frontend KHÔNG phản hồi! Status: ${FRONTEND_STATUS}" >> /home/cinex/backups/health.log
    docker compose -f /home/cinex/cinex/docker-compose.prod.yml restart frontend
fi
```

Thêm vào cron:

```bash
# Chạy health check mỗi 5 phút
*/5 * * * * /home/cinex/cinex/scripts/health-check.sh
```

---

## 8. Quy trình cập nhật (Update)

### 8.1. Cập nhật thường (có downtime ~30 giây)

```bash
# Bước 1: SSH vào server
ssh cinex@YOUR_SERVER_IP

# Bước 2: Vào thư mục project
cd /home/cinex/cinex

# Bước 3: Pull code mới
git pull origin main

# Bước 4: Build lại image và restart
# --build: build lại Docker image từ code mới
# -d: chạy ngầm (detached mode)
docker compose -f docker-compose.prod.yml up -d --build

# Bước 5: Kiểm tra
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f backend
```

**Thời gian downtime:**
- Build image: 2-5 phút (nhưng service cũ vẫn chạy trong lúc build)
- Restart container: ~10-30 giây (downtime thực sự)

### 8.2. Cập nhật không downtime (nâng cao)

Nếu muốn KHÔNG có downtime (user không bị gián đoạn):

```bash
# Cách 1: Build image trước, restart sau
# Build image mới mà KHÔNG restart container đang chạy
docker compose -f docker-compose.prod.yml build backend

# Khi image sẵn sàng, restart chỉ mất vài giây
docker compose -f docker-compose.prod.yml up -d --no-build backend

# Cách 2: Blue-Green Deployment (phức tạp hơn)
# Chạy backend mới trên port khác, test OK rồi switch Nginx sang
# Phù hợp cho production thật, overkill cho đồ án
```

### 8.3. Rollback nếu lỗi

```bash
# Nếu version mới bị lỗi, quay lại version cũ:

# Cách 1: Checkout commit cũ
git log --oneline -5          # Xem 5 commit gần nhất
git checkout <commit-hash>    # Quay lại commit cũ
docker compose -f docker-compose.prod.yml up -d --build

# Cách 2: Dùng Docker image tag
# Khi build, tag image với version:
docker compose -f docker-compose.prod.yml build
docker tag cinex-backend cinex-backend:v1.0
# Khi cần rollback:
docker tag cinex-backend:v1.0 cinex-backend:latest
docker compose -f docker-compose.prod.yml up -d

# Cách 3: Git revert (an toàn nhất)
git revert HEAD    # Tạo commit mới đảo ngược commit lỗi
git push origin main
docker compose -f docker-compose.prod.yml up -d --build
```

### 8.4. Checklist trước khi update production

- [ ] Code đã test trên local/staging
- [ ] Backup database trước khi update: `./scripts/backup-db.sh`
- [ ] Kiểm tra Liquibase changelog nếu có thay đổi DB schema
- [ ] Đọc release notes / commit messages
- [ ] Chọn thời điểm ít traffic (đêm khuya, sáng sớm)
- [ ] Sau khi update: kiểm tra health endpoint, test thử vài API

---

## 9. Troubleshooting

### 9.1. Backend không start

**Triệu chứng:** Container `backend` status "Restarting" hoặc "Exited"

```bash
# Xem log chi tiết
docker compose -f docker-compose.prod.yml logs backend
```

**Nguyên nhân phổ biến:**

| Lỗi trong log | Nguyên nhân | Cách sửa |
|---|---|---|
| `Connection refused: sqlserver:1433` | SQL Server chưa sẵn sàng | Chờ 30-60s, SQL Server khởi động chậm. Kiểm tra `depends_on` + `healthcheck` |
| `Login failed for user 'sa'` | Sai password DB | Kiểm tra `DB_PASSWORD` trong `.env` |
| `Database 'cinex' does not exist` | Chưa tạo database | Chạy lệnh `CREATE DATABASE cinex` (xem phần 3.5) |
| `Address already in use: 8088` | Port 8088 đã bị chiếm | `lsof -i :8088` rồi kill process hoặc đổi port |
| `OutOfMemoryError` | Hết RAM | Tăng RAM server hoặc giảm `JAVA_OPTS: -Xmx256m` |
| `Liquibase checksum mismatch` | Đã sửa changeset đã chạy | Xem mục 9.5 |

### 9.2. Frontend trắng (blank page)

**Triệu chứng:** Truy cập website, trang trắng trơn, không hiển thị gì.

```bash
# Kiểm tra 1: Container frontend có chạy không?
docker compose -f docker-compose.prod.yml ps frontend

# Kiểm tra 2: Build frontend có thành công không?
docker compose -f docker-compose.prod.yml logs frontend

# Kiểm tra 3: Có file build output không?
docker exec cinex-frontend-1 ls /usr/share/nginx/html
# Phải thấy index.html, assets/...

# Kiểm tra 4: Nginx config có đúng không?
docker exec cinex-frontend-1 nginx -t
# Phải thấy: syntax is ok, test is successful
```

**Nguyên nhân phổ biến:**

| Vấn đề | Nguyên nhân | Cách sửa |
|---|---|---|
| Trang trắng, console báo 404 JS | Build output không đúng path | Kiểm tra `base` trong `vite.config.ts` |
| Trang trắng, không lỗi gì | `index.html` không có | Kiểm tra `npm run build` có output `dist/` |
| Trang hiển thị nhưng API lỗi | Nginx proxy sai | Kiểm tra `location /api/` trong nginx.conf |
| Trang hiển thị, refresh 404 | Thiếu `try_files` | Thêm `try_files $uri $uri/ /index.html;` |

### 9.3. WebSocket không kết nối

**Triệu chứng:** Thông báo realtime (notification) không hoạt động, console báo WebSocket connection failed.

**Kiểm tra:**

```bash
# Test WebSocket từ server (cài wscat nếu chưa có)
npm install -g wscat
wscat -c ws://localhost/ws/

# Nếu từ server OK nhưng từ bên ngoài KHÔNG OK → lỗi Nginx proxy
```

**Cách sửa:** Đảm bảo Nginx config có phần WebSocket proxy:

```nginx
location /ws/ {
    proxy_pass http://backend:8088;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;      # BẮT BUỘC
    proxy_set_header Connection "upgrade";       # BẮT BUỘC
    proxy_read_timeout 3600s;                    # Timeout dài cho WS
}
```

**Tại sao cần `Upgrade` và `Connection` header?**
WebSocket bắt đầu bằng HTTP request thường, rồi "nâng cấp" (upgrade) lên WebSocket protocol. Nếu Nginx không chuyển tiếp header Upgrade, backend không biết client muốn dùng WebSocket → connection fail.

### 9.4. Hết disk space

```bash
# Kiểm tra disk
df -h

# Docker images và containers chiếm nhiều disk nhất
# Dọn dẹp Docker (xóa images/containers không dùng)
docker system prune -a --volumes
# CẢNH BÁO: lệnh trên xóa TẤT CẢ images không đang dùng
# Chỉ chạy khi chắc chắn không cần images cũ

# Dọn dẹp an toàn hơn (chỉ xóa dangling)
docker image prune
docker container prune
docker volume prune

# Kiểm tra kích thước log
docker compose -f docker-compose.prod.yml logs backend | wc -l
# Nếu quá nhiều log, cấu hình log rotation:
```

Thêm log rotation cho Docker trong `/etc/docker/daemon.json`:

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "3"
  }
}
```

```bash
# Restart Docker daemon để áp dụng
sudo systemctl restart docker
```

### 9.5. Liquibase checksum mismatch

**Triệu chứng:** Backend không start, log báo:
```
Validation Failed: 1 change sets check sum was ...
```

**Nguyên nhân:** Ai đó đã sửa nội dung một changeset đã chạy trước đó. Liquibase lưu checksum của mỗi changeset, nếu nội dung thay đổi → checksum khác → báo lỗi.

**Cách sửa:**

```bash
# Cách 1: Clear checksum (an toàn nếu chỉ thay đổi format, không thay đổi logic)
docker exec cinex-sqlserver-1 /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "${DB_PASSWORD}" -C \
  -Q "UPDATE cinex.dbo.DATABASECHANGELOG SET MD5SUM = NULL WHERE ID = 'changeset-id-bi-loi'"

# Cách 2: Tạo changeset mới để sửa, KHÔNG sửa changeset cũ (best practice)
```

### 9.6. Container liên tục restart

```bash
# Xem lý do container exit
docker inspect cinex-backend-1 --format='{{.State.ExitCode}}'
# Exit code 137 = bị kill bởi OOM (hết RAM)
# Exit code 1 = lỗi ứng dụng (exception)

# Nếu OOM (exit code 137):
# - Tăng RAM server
# - Giảm memory limit trong docker-compose
# - Giảm JAVA_OPTS: -Xmx256m

# Nếu lỗi ứng dụng (exit code 1):
# Xem log để biết lỗi gì
docker compose -f docker-compose.prod.yml logs --tail=200 backend
```

---

## Tóm tắt quy trình deploy hoàn chỉnh

```
1. Mua VPS (2GB RAM, Ubuntu 22.04)
       │
2. Cài Docker + Docker Compose
       │
3. Clone code + tạo file .env
       │
4. Tạo database SQL Server
       │
5. docker compose -f docker-compose.prod.yml up -d --build
       │
6. Cấu hình domain DNS trỏ về IP server
       │
7. Cài SSL (Let's Encrypt hoặc Cloudflare)
       │
8. Setup cron backup database
       │
9. Setup health check monitoring
       │
   DONE — Website live tại https://cinex.yourdomain.com
```

**Khi cần update:**
```
git pull → docker compose build → docker compose up -d → kiểm tra log
```

**Khi có lỗi:**
```
docker logs → tìm nguyên nhân → sửa → rebuild → kiểm tra lại
```
