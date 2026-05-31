# Deployment Backend — Production

> File này hướng dẫn deploy CineX backend lên server production từ A-Z. File `project/deploy-guide.md` đã có hướng dẫn tổng quát; file này focus phần backend (Dockerfile, env vars, systemd, monitoring).

## 1. Dockerfile production

### Multi-stage build
```dockerfile
# Stage 1: Build
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /app

COPY gradle gradle
COPY gradlew settings.gradle build.gradle ./
RUN ./gradlew --version

COPY src src
RUN ./gradlew clean bootJar -x test --no-daemon

# Stage 2: Runtime
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

RUN addgroup -S cinex && adduser -S cinex -G cinex
USER cinex

COPY --from=builder --chown=cinex:cinex /app/build/libs/*.jar app.jar

EXPOSE 8088
HEALTHCHECK --interval=30s --timeout=3s --start-period=60s \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8088/actuator/health || exit 1

ENV JAVA_OPTS="-Xms512m -Xmx1024m -XX:+UseG1GC -XX:+UseStringDeduplication"
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
```

Giải thích:
- **Multi-stage**: Stage 1 JDK 21 build, Stage 2 JRE 21 (nhỏ hơn ~200MB). Image final ~250MB thay vì ~500MB.
- **Non-root user**: `cinex` user, không phải `root` → security best practice. Nếu container compromise, hacker chỉ có quyền user cinex.
- **HEALTHCHECK**: Docker tự check Actuator endpoint mỗi 30s. Nếu fail → container restart.
- **JAVA_OPTS**: G1GC + string dedup, heap 512MB-1GB phù hợp dự án vừa.

### Build và push
```bash
docker build -t registry.example.com/cinex-backend:1.0.0 .
docker push registry.example.com/cinex-backend:1.0.0
```

## 2. Environment Variables

### Tách config theo môi trường
```yaml
# application.yml — common
spring:
  application:
    name: cinex

---
# application-dev.yml
spring:
  config.activate.on-profile: dev
  datasource:
    url: jdbc:sqlserver://localhost:1433;databaseName=cinex
    username: sa
    password: CineX@2026
  jpa.show-sql: true
logging.level.root: INFO

---
# application-prod.yml
spring:
  config.activate.on-profile: prod
  datasource:
    url: ${DB_URL}
    username: ${DB_USER}
    password: ${DB_PASSWORD}
  jpa.show-sql: false
logging.level.root: WARN
```

### Set env trong production
```bash
# .env.production (KHÔNG commit vào git)
SPRING_PROFILES_ACTIVE=prod
DB_URL=jdbc:sqlserver://db.cinex.vn:1433;databaseName=cinex;encrypt=true
DB_USER=cinex_app
DB_PASSWORD=<secret>
JWT_SECRET=<openssl rand -base64 32>
JWT_EXPIRATION=900000
JWT_REFRESH_EXPIRATION=604800000
REDIS_HOST=redis.cinex.vn
REDIS_PORT=6379
REDIS_PASSWORD=<secret>
CLOUDINARY_CLOUD_NAME=cinex
CLOUDINARY_API_KEY=<key>
CLOUDINARY_API_SECRET=<secret>
MOMO_PARTNER_CODE=MOMO_PROD_XXX
MOMO_ACCESS_KEY=<key>
MOMO_SECRET_KEY=<secret>
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USERNAME=apikey
SMTP_PASSWORD=<sendgrid-api-key>
```

### Docker compose production
```yaml
# docker-compose.prod.yml
version: "3.9"
services:
  backend:
    image: registry.example.com/cinex-backend:1.0.0
    restart: unless-stopped
    env_file: .env.production
    ports:
      - "127.0.0.1:8088:8088"
    networks:
      - cinex_net
    depends_on:
      sqlserver:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:8088/actuator/health"]
      interval: 30s
      timeout: 3s
      start_period: 60s
      retries: 3
    deploy:
      resources:
        limits:
          cpus: "2.0"
          memory: 1.5G
        reservations:
          memory: 512M

  sqlserver:
    image: mcr.microsoft.com/mssql/server:2022-latest
    restart: unless-stopped
    environment:
      ACCEPT_EULA: "Y"
      MSSQL_SA_PASSWORD: ${DB_PASSWORD}
    volumes:
      - sqlserver_data:/var/opt/mssql
    ports:
      - "127.0.0.1:1433:1433"
    networks:
      - cinex_net
    healthcheck:
      test: /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P "$$MSSQL_SA_PASSWORD" -Q "SELECT 1"
      interval: 30s
      retries: 5
      start_period: 60s

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD} --appendonly yes
    volumes:
      - redis_data:/data
    networks:
      - cinex_net
    healthcheck:
      test: redis-cli -a ${REDIS_PASSWORD} ping
      interval: 30s

volumes:
  sqlserver_data:
  redis_data:

networks:
  cinex_net:
    driver: bridge
```

`127.0.0.1:8088:8088` → chỉ bind localhost. Nginx ở host gọi qua localhost. Tránh expose DB/Redis ra internet.

## 3. Nginx Reverse Proxy

```nginx
# /etc/nginx/sites-available/cinex
upstream cinex_backend {
    server 127.0.0.1:8088;
    keepalive 32;
}

server {
    listen 80;
    server_name api.cinex.vn;

    # Redirect HTTP → HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.cinex.vn;

    ssl_certificate /etc/letsencrypt/live/api.cinex.vn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.cinex.vn/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Logs
    access_log /var/log/nginx/cinex_access.log;
    error_log /var/log/nginx/cinex_error.log warn;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=cinex_api:10m rate=30r/s;

    # Body size cho upload
    client_max_body_size 10M;

    # API endpoints
    location /api/ {
        limit_req zone=cinex_api burst=50 nodelay;

        proxy_pass http://cinex_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_read_timeout 60s;
        proxy_connect_timeout 5s;
    }

    # WebSocket cho realtime seat
    location /ws-cinex {
        proxy_pass http://cinex_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;

        proxy_read_timeout 3600s;  # 1 giờ — WS idle không drop
        proxy_send_timeout 3600s;
    }

    # Block access actuator từ ngoài
    location /actuator/ {
        allow 127.0.0.1;
        deny all;
    }
}
```

Enable + reload:
```bash
sudo ln -s /etc/nginx/sites-available/cinex /etc/nginx/sites-enabled/
sudo nginx -t  # test config
sudo systemctl reload nginx
```

## 4. SSL với Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.cinex.vn -d www.cinex.vn

# Auto-renew cron
sudo systemctl status certbot.timer
```

Certbot tự thêm SSL config vào Nginx, set cron renew mỗi 60 ngày.

## 5. Database Migration không downtime

### Backward-compatible changes (safe)
- Thêm cột nullable
- Thêm bảng mới
- Thêm index
- Thêm enum value mới

→ Liquibase chạy trực tiếp, app cũ vẫn work.

### Breaking changes (cần multi-step)
- Đổi tên cột
- Đổi kiểu data
- Xóa cột

→ 3 bước:
1. **Migration 1** (compat): Thêm cột mới, code đọc/ghi CẢ 2 cột
2. **Deploy code mới** dùng cột mới
3. **Migration 2**: Xóa cột cũ sau khi xác nhận không còn ai dùng

### Backup trước migration
```bash
docker exec sqlserver /opt/mssql-tools/bin/sqlcmd \
    -S localhost -U sa -P "$DB_PASSWORD" \
    -Q "BACKUP DATABASE cinex TO DISK = '/backups/cinex-$(date +%Y%m%d-%H%M).bak'"
```

## 6. Systemd Service (alternative Docker)

```ini
# /etc/systemd/system/cinex.service
[Unit]
Description=CineX Backend
After=network.target sqlserver.service redis.service
Wants=sqlserver.service redis.service

[Service]
Type=simple
User=cinex
Group=cinex
WorkingDirectory=/opt/cinex
EnvironmentFile=/opt/cinex/.env.production
ExecStart=/usr/bin/java -Xms512m -Xmx1024m -jar /opt/cinex/app.jar
Restart=on-failure
RestartSec=10s
StandardOutput=append:/var/log/cinex/app.log
StandardError=append:/var/log/cinex/error.log

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now cinex
sudo systemctl status cinex
sudo journalctl -u cinex -f
```

## 7. CI/CD với GitHub Actions

```yaml
# .github/workflows/deploy-backend.yml
name: Deploy Backend

on:
  push:
    branches: [main]
    paths: ['backend/**']

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up JDK 21
        uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'

      - name: Build
        working-directory: backend
        run: ./gradlew clean bootJar -x test

      - name: Run tests
        working-directory: backend
        run: ./gradlew test

      - name: Login to Registry
        uses: docker/login-action@v3
        with:
          registry: registry.example.com
          username: ${{ secrets.REGISTRY_USER }}
          password: ${{ secrets.REGISTRY_PASSWORD }}

      - name: Build + push Docker image
        uses: docker/build-push-action@v5
        with:
          context: backend
          push: true
          tags: registry.example.com/cinex-backend:${{ github.sha }}

      - name: Deploy to VPS
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /opt/cinex
            sed -i "s|cinex-backend:.*|cinex-backend:${{ github.sha }}|" docker-compose.prod.yml
            docker compose -f docker-compose.prod.yml pull backend
            docker compose -f docker-compose.prod.yml up -d backend
            docker image prune -f
```

GitHub Secrets cần set:
- `REGISTRY_USER`, `REGISTRY_PASSWORD`
- `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`

## 8. Rolling Update (blue-green minimal)

### Khái niệm
- **Blue** = production hiện tại
- **Green** = phiên bản mới deploy
- Switch traffic từ Blue → Green khi Green ready

### Implement đơn giản với Docker
```yaml
# docker-compose.prod.yml
services:
  backend-blue:
    image: cinex-backend:1.0.0
    ports: ["8088:8088"]

  backend-green:
    image: cinex-backend:1.1.0
    ports: ["8089:8088"]
```

Nginx switch upstream:
```bash
# 1. Deploy green
docker compose up -d backend-green
# wait healthcheck pass

# 2. Update nginx upstream
sed -i 's|127.0.0.1:8088|127.0.0.1:8089|' /etc/nginx/sites-available/cinex
nginx -t && systemctl reload nginx

# 3. Verify green OK 5 phút

# 4. Stop blue
docker compose stop backend-blue
```

Downtime = 0 cho user (Nginx reload không drop connection).

## 9. Backup Strategy 3-2-1

- **3** copy của data
- **2** loại storage khác nhau
- **1** copy off-site

```bash
#!/bin/bash
# /opt/cinex/backup.sh

DATE=$(date +%Y%m%d-%H%M)
BACKUP_DIR=/var/backups/cinex

# 1. DB
docker exec sqlserver /opt/mssql-tools/bin/sqlcmd \
    -S localhost -U sa -P "$DB_PASSWORD" \
    -Q "BACKUP DATABASE cinex TO DISK = '/var/opt/mssql/backups/cinex-$DATE.bak' WITH COMPRESSION"

docker cp sqlserver:/var/opt/mssql/backups/cinex-$DATE.bak $BACKUP_DIR/

# 2. Uploads (nếu lưu local)
tar czf $BACKUP_DIR/uploads-$DATE.tar.gz /opt/cinex/uploads/

# 3. Configs
cp /opt/cinex/.env.production $BACKUP_DIR/env-$DATE.bak
cp /etc/nginx/sites-available/cinex $BACKUP_DIR/nginx-$DATE.conf

# 4. Upload to S3/B2 (off-site)
aws s3 cp $BACKUP_DIR/cinex-$DATE.bak s3://cinex-backups/db/

# 5. Cleanup local > 30 ngày
find $BACKUP_DIR -name "cinex-*.bak" -mtime +30 -delete
```

Cron:
```cron
0 2 * * * /opt/cinex/backup.sh > /var/log/cinex-backup.log 2>&1
```

## 10. Rollback procedure

### Rollback code
```bash
# Lấy image tag cũ
PREV_TAG=$(docker image ls cinex-backend --format '{{.Tag}}' | sort -rV | sed -n '2p')

# Update compose
sed -i "s|cinex-backend:.*|cinex-backend:$PREV_TAG|" docker-compose.prod.yml
docker compose up -d backend
```

### Rollback DB
Liquibase rollback nếu có changeset rollback định nghĩa:
```bash
docker exec backend liquibase rollbackCount 1
```

Nếu không có rollback script → restore từ backup:
```bash
docker exec sqlserver /opt/mssql-tools/bin/sqlcmd \
    -S localhost -U sa -P "$DB_PASSWORD" \
    -Q "RESTORE DATABASE cinex FROM DISK = '/var/opt/mssql/backups/cinex-20260524-0200.bak' WITH REPLACE"
```

## 11. Production checklist

Trước go-live:
- [ ] HTTPS với SSL valid
- [ ] DB password mạnh (16+ char random)
- [ ] JWT secret 256-bit (`openssl rand -base64 32`)
- [ ] Firewall: chỉ mở 80, 443, 22 ra ngoài
- [ ] SSH key, disable password login
- [ ] Backup hàng ngày + test restore 1 lần/tháng
- [ ] Log rotation (logrotate)
- [ ] Healthcheck endpoint + monitoring
- [ ] Rate limiting cho login/refresh
- [ ] CORS chỉ cho domain FE
- [ ] Disable actuator endpoints (`/env`, `/heapdump`) hoặc bảo vệ
- [ ] Disable Swagger UI production (hoặc bảo vệ basic auth)
- [ ] Spring profile = `prod`
- [ ] Logging level WARN (giảm noise)
- [ ] Connection pool sizing
- [ ] JVM heap phù hợp (-Xmx)
- [ ] DB index review

## 12. Câu hỏi tự kiểm tra

**Câu 1**: Tại sao multi-stage Dockerfile?

→ Stage build cần JDK + Gradle (lớn). Stage runtime chỉ cần JRE. Image final nhỏ hơn ~50%, security surface giảm.

**Câu 2**: Tại sao bind `127.0.0.1:8088:8088` thay vì `8088:8088`?

→ `127.0.0.1` chỉ bind localhost → không expose ra internet. Nginx ở host gọi vào qua localhost. Tránh hacker scan port 8088 trực tiếp.

**Câu 3**: Rolling update có downtime không?

→ Gần 0. Nginx reload không drop existing connection. New request route sang green sau khi reload.

**Câu 4**: Nếu deploy mới fail, rollback bao lâu?

→ Vài giây (sed + docker compose up). Tệ hơn: restore DB backup (vài phút).

**Câu 5**: Tại sao backup phải off-site?

→ DC mất điện/cháy/hỏng disk → mất TẤT CẢ. Off-site (S3 region khác) → recover được.
