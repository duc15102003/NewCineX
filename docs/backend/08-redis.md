# Redis — Bộ nhớ đệm siêu tốc

---

## 1. Redis là gì?

**Redis** (Remote Dictionary Server) là một **database lưu trữ hoàn toàn trong RAM** (bộ nhớ), không phải trên ổ cứng như SQL Server hay MySQL. Vì đọc/ghi RAM nhanh hơn ổ cứng rất nhiều lần, Redis có tốc độ cực kỳ cao.

### Ví dụ đời thường: Tủ lạnh vs Siêu thị

Hãy tưởng tượng bạn nấu ăn:

- **Không có Redis (chỉ có SQL Server):** Mỗi lần cần trứng, bạn phải **lái xe ra siêu thị** mua. Mất 15-20 phút mỗi lần. Nếu nấu 5 món cần trứng, bạn phải đi siêu thị 5 lần.
- **Có Redis:** Bạn mua trứng **1 lần**, bỏ vào **tủ lạnh** (cache). 4 lần sau chỉ cần mở tủ lạnh lấy ra, mất 5 giây.

**Tủ lạnh = Redis.** Lưu tạm những thứ hay dùng, lấy ra cực nhanh. Nhưng tủ lạnh có giới hạn dung lượng và thức ăn sẽ hết hạn (TTL) — giống hệt Redis.

### So sánh tốc độ thực tế

| Tiêu chí | SQL Server (Database) | Redis (Cache) |
|---|---|---|
| Lưu ở đâu | Ổ cứng (HDD/SSD) | RAM (bộ nhớ) |
| Tốc độ đọc | ~5-50ms | ~0.1-1ms |
| Nhanh hơn | — | **50-100 lần** |
| Dữ liệu khi tắt máy | Vẫn còn (persistent) | Mất hết (volatile) |
| Dung lượng | Hàng trăm GB+ | Vài GB (giới hạn RAM) |

> **Giải thích ms:** 1 giây = 1000 millisecond (ms). SQL Server mất 10ms nghĩa là 1 giây xử lý được ~100 request. Redis mất 0.5ms nghĩa là 1 giây xử lý được ~2000 request. Khác biệt cực lớn khi có nhiều người dùng đồng thời.

---

## 2. Redis lưu ở đâu? + TCP là gì?

> **2 câu hỏi sinh viên hay nhầm:** "TCP có phải là nơi Redis lưu data không?" và "Redis nằm ở chỗ nào trong máy mình?". Phần này giải đáp luôn.

### 2.1 TCP — chỉ là cách 2 chương trình nói chuyện

**TCP** (Transmission Control Protocol) là **giao thức** truyền data qua mạng, KHÔNG phải nơi lưu trữ gì cả.

#### Ví dụ đời thường

TCP giống **gọi điện thoại có xác nhận**:
- A gọi B → B nghe máy "alo" → A nói → B "ừ tôi nghe rồi" → A nói tiếp...
- Nếu mất tín hiệu → 1 trong 2 phát hiện ngay
- Đảm bảo data đến **đúng thứ tự, không mất gói**

Đối lập: UDP giống **bắn loa thông báo** — bắn ra rồi thôi, không biết ai nghe được, không xác nhận.

#### TCP trong CineX

| Giao tiếp | Giao thức | Port |
|---|---|---|
| Browser ↔ Backend (HTTP/HTTPS) | TCP | 8088 |
| Backend ↔ SQL Server | TCP | 1433 |
| Backend ↔ Redis | TCP | **6379** |

Khi `BookingService` gọi `redis.opsForValue().increment(key)`, behind the scenes:
1. Spring tạo **TCP connection** đến Redis tại `localhost:6379`
2. Gửi lệnh `INCR login:fail:vanan` qua connection đó
3. Nhận kết quả về

Không cần hiểu sâu TCP — chỉ cần biết "qua TCP" = "qua mạng" = chậm hơn truy cập biến trong RAM cùng tiến trình.

### 2.2 Redis lưu data ở đâu?

Có **3 tầng** cần phân biệt:

```
┌─────────────────────────────────────────────────────────────────┐
│  Tầng 1: Máy tính của bạn (MacBook / Windows)                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Tầng 2: Docker container "cinex-redis-1"                 │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  Tầng 3: Redis process (đang chạy)                  │  │  │
│  │  │  ┌───────────────────────────────────────────────┐  │  │  │
│  │  │  │  RAM của Redis process:                       │  │  │  │
│  │  │  │  ┌───────────────────────────────────────┐    │  │  │  │
│  │  │  │  │  login:fail:vanan = "3"  (TTL 847s)   │    │  │  │  │
│  │  │  │  │  login:fail:thuy  = "1"  (TTL 600s)   │    │  │  │  │
│  │  │  │  │  ...                                  │    │  │  │  │
│  │  │  │  └───────────────────────────────────────┘    │  │  │  │
│  │  │  │  ← Data thực tế NẰM Ở ĐÂY                     │  │  │  │
│  │  │  └───────────────────────────────────────────────┘  │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │       ↑ Container lắng nghe port 6379                     │  │
│  └───────────────────────────────────────────────────────────┘  │
│       ↑ Docker forward port 6379 ra ngoài (host)                │
└─────────────────────────────────────────────────────────────────┘
```

#### Giải thích từng tầng

- **Tầng 1 — Máy tính**: máy host (MacBook / PC) chạy macOS/Windows/Linux. Docker Desktop được cài trên đó.
- **Tầng 2 — Docker container `cinex-redis-1`**: "máy ảo siêu nhẹ" chứa 1 chương trình kèm môi trường (Linux Alpine + Redis binary). Khai báo trong `docker-compose.yml`:
  ```yaml
  redis:
    image: redis:7-alpine     # Image (template) Redis v7 trên Alpine Linux
    ports:
      - "6379:6379"           # Cổng container 6379 → cổng máy host 6379
  ```
- **Tầng 3 — Redis process**: bên trong container có 1 chương trình `redis-server` đang chạy. Đây là "process" — giống Word/Chrome đang mở, nhưng là server không có UI.
- **RAM của Redis process**: chỗ data thực sự lưu. `SET key value` ghi vào HashMap **trong RAM của chính process redis-server**, KHÔNG phải RAM của Java app.

### 2.3 So sánh với ConcurrentHashMap

```
SystemConfig (HashMap) — CÙNG process với code:
┌──────────────────────────────────────────┐
│ Process 1: Java backend (port 8088)      │
│   ┌──────────────────────────────────┐   │
│   │  RAM của Java process            │   │
│   │  ConcurrentHashMap cache:        │   │
│   │    booking.max_seats → "8"       │   │
│   │    booking.hold_minutes → "10"   │   │
│   └──────────────────────────────────┘   │
└──────────────────────────────────────────┘

LoginRateLimit (Redis) — process KHÁC:
┌──────────────────────────────────────────┐
│ Process 1: Java backend (port 8088)      │
│   AuthService gọi sang Redis qua TCP     │
└──────────────────────────┬───────────────┘
                           │ TCP port 6379
                           ▼
┌──────────────────────────────────────────┐
│ Process 2: Redis server (port 6379)      │
│   ┌──────────────────────────────────┐   │
│   │  RAM của Redis process           │   │
│   │  Key-value:                      │   │
│   │    login:fail:vanan → "3"        │   │
│   └──────────────────────────────────┘   │
└──────────────────────────────────────────┘
```

→ Đây là **lý do Redis chậm hơn HashMap**: HashMap = đọc biến trong process Java (~0.001ms). Redis = đi qua mạng TCP sang process khác (~1ms), kèm chi phí serialize/deserialize data.

### 2.4 Kiểm tra Redis trong máy bạn

```bash
# 1. Liệt kê container đang chạy
docker ps
# Sẽ thấy dòng tương tự:
# CONTAINER ID   IMAGE              PORTS                    NAMES
# abc123         redis:7-alpine     0.0.0.0:6379->6379/tcp   cinex-redis-1
#                                   ↑ Forward port host:container

# 2. Vào Redis CLI trong container
docker exec -it cinex-redis-1 redis-cli

# 3. Xem data thực tế
127.0.0.1:6379> KEYS *              # Liệt kê tất cả key
1) "login:fail:vanan"
2) "login:fail:thuy"

127.0.0.1:6379> GET login:fail:vanan
"3"

127.0.0.1:6379> TTL login:fail:vanan
(integer) 847                       # Còn 847 giây = ~14 phút trước khi tự xóa

# 4. Xem Redis đang dùng bao nhiêu RAM
127.0.0.1:6379> INFO memory
used_memory_human:1.20M             # Redis đang chiếm 1.2 MB RAM
```

### 2.5 Tóm tắt

| Câu hỏi | Trả lời ngắn |
|---|---|
| **TCP** là gì? | Giao thức truyền data qua mạng có xác nhận, KHÔNG phải nơi lưu trữ |
| **Redis** lưu ở đâu? | Trong **RAM** của 1 **process `redis-server`** chạy trong **Docker container** trên máy bạn (localhost) |
| Có giống HashMap không? | Cùng nguyên lý "lưu key-value trong RAM", nhưng **khác process** → Java app phải gọi qua TCP để truy cập |
| Tại sao chậm hơn HashMap? | Mỗi lần đọc/ghi phải đi qua TCP (dù localhost vẫn qua TCP stack) + serialize/deserialize |
| Tắt máy thì data còn không? | Mặc định **mất hết** (RAM volatile). Redis có option `save to disk` (RDB/AOF) để persistent, nhưng CineX không bật |

---

## 3. Tại sao CineX cần Redis?

### Bài toán thực tế

Bảng `system_config` lưu các cấu hình hệ thống:

| config_key | config_value | Ý nghĩa |
|---|---|---|
| `booking.hold_minutes` | `10` | Giữ ghế tối đa 10 phút |
| `booking.max_seats` | `8` | Tối đa 8 ghế/lần đặt |
| `booking.cleanup_cron` | `0 * * * * *` | Dọn ghế hết hạn mỗi phút |

Mỗi khi user đặt vé, hệ thống cần đọc `max_seats` để kiểm tra "có đặt quá 8 ghế không?". Mỗi phút, scheduler cần đọc `hold_minutes` để biết "ghế nào giữ quá 10 phút rồi?".

**Không có cache:** Nếu 100 user đồng thời hold ghế:
```
User 1 → SELECT * FROM system_config WHERE key = 'max_seats'  → 10ms
User 2 → SELECT * FROM system_config WHERE key = 'max_seats'  → 10ms
User 3 → SELECT * FROM system_config WHERE key = 'max_seats'  → 10ms
...
User 100 → SELECT * FROM system_config WHERE key = 'max_seats' → 10ms
= 100 query giống hệt nhau, tốn 1 giây tổng cộng
```

**Có cache:** Query DB **1 lần duy nhất**, lưu kết quả vào cache. 99 lần sau đọc cache:
```
User 1 → Cache MISS → đọc DB (10ms) → lưu cache
User 2 → Cache HIT → đọc cache (0.5ms)
User 3 → Cache HIT → đọc cache (0.5ms)
...
User 100 → Cache HIT → đọc cache (0.5ms)
= 1 query DB + 99 lần đọc cache, tốn ~60ms tổng cộng
```

**Nhanh hơn ~16 lần** chỉ với 100 user. Khi có 10.000 user, sự khác biệt còn khủng khiếp hơn.

### Dùng Redis cho gì trong CineX?

| Tính năng | Cách dùng | Trạng thái |
|---|---|---|
| **Rate limit login** | Counter `login:fail:{username}` đếm lần fail, TTL 15 phút, block sau 5 lần | ✅ Đã làm — `LoginRateLimitService` |
| **System config cache** | Lưu config vào cache để đọc nhanh | ⚠️ Dùng `ConcurrentHashMap` (in-memory) — KHÔNG dùng Redis. Xem section 6. |
| Cache movie list | Cache trang chủ (TTL 5 phút) | ❌ Chưa làm (có thể thêm khi traffic tăng) |
| Hold seat qua Redis | Thay HELD trong DB | ❌ Chưa làm |

> **Quan trọng để phân biệt:** CineX có 2 chỗ cache, dùng 2 công nghệ khác nhau:
> - **SystemConfig** → `ConcurrentHashMap` (in-memory) — nhanh nhất nhưng KHÔNG share giữa nhiều instance backend.
> - **LoginRateLimit** → Redis — chậm hơn HashMap chút (qua network), NHƯNG nhiều instance backend share chung counter → attacker không thể "vòng" qua các BE để vượt limit.
>
> Xem [Section 8](#8-hashmap-vs-redis--khi-nào-dùng-cái-nào) để hiểu **tại sao chọn HashMap cho config và Redis cho rate limit** — đây là kiến thức cốt lõi khi defend đồ án.

---

## 4. Cài đặt Redis bằng Docker

CineX chạy Redis trong Docker container, không cần cài Redis trực tiếp lên máy.

```bash
# Chạy Redis cùng SQL Server
cd /Users/vutuongan/cinex && docker-compose up redis -d
```

Trong `docker-compose.yml`, Redis được cấu hình:

```yaml
redis:
  image: redis:7-alpine    # Image nhẹ nhất (~30MB)
  ports:
    - "6379:6379"           # Port mặc định của Redis
```

> **redis:7-alpine là gì?**
> - `redis:7` = Redis phiên bản 7 (mới nhất, ổn định)
> - `alpine` = dựa trên Alpine Linux, image cực nhẹ (~30MB thay vì ~130MB bản thường)
> - Giống như mua phiên bản "gọn nhẹ" thay vì "full options" — đủ dùng và tiết kiệm tài nguyên

### Kiểm tra Redis đã chạy chưa

```bash
# Vào Redis CLI trong container
docker exec -it cinex-redis-1 redis-cli

# Thử lệnh PING
127.0.0.1:6379> PING
PONG                        # Nếu thấy PONG = Redis đang chạy OK

# Thử lưu và đọc 1 giá trị
127.0.0.1:6379> SET hello "xin chao"
OK
127.0.0.1:6379> GET hello
"xin chao"

# Thoát
127.0.0.1:6379> EXIT
```

---

## 5. Cấu hình Spring Data Redis

### Bước 1: Thêm dependency (build.gradle)

```groovy
// Trong block dependencies
implementation 'org.springframework.boot:spring-boot-starter-data-redis'
```

> Spring Boot Starter Redis bao gồm sẵn: Lettuce (client kết nối Redis), Spring Data Redis (API thao tác Redis), và auto-configuration.

### Bước 2: Cấu hình kết nối (application.yml)

```yaml
spring:
  data:
    redis:
      host: ${REDIS_HOST:localhost}   # Địa chỉ Redis server
      port: ${REDIS_PORT:6379}        # Port mặc định
```

> **`${REDIS_HOST:localhost}` nghĩa là gì?**
> - Đọc biến môi trường `REDIS_HOST`
> - Nếu không có → dùng giá trị mặc định `localhost`
> - Khi deploy lên server thật, chỉ cần set `REDIS_HOST=redis.myserver.com`, không sửa code

### Bước 3: Cấu hình RedisTemplate (RedisConfig.java)

Spring Boot tự tạo `RedisTemplate` mặc định, nhưng nó dùng **Java Serialization** (lưu dữ liệu dạng binary, đọc không được). Ta cần config lại để lưu dạng **JSON** (đọc được, debug dễ).

```
File: backend/src/main/java/com/cinex/common/config/RedisConfig.java
```

```java
@Configuration    // Đánh dấu đây là class cấu hình Spring
public class RedisConfig {

    @Bean         // Đăng ký RedisTemplate vào Spring Container
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory connectionFactory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();

        // Kết nối tới Redis server (host + port từ application.yml)
        template.setConnectionFactory(connectionFactory);

        // Key lưu dạng String (VD: "config:booking.hold_minutes")
        template.setKeySerializer(new StringRedisSerializer());
        template.setHashKeySerializer(new StringRedisSerializer());

        // Value lưu dạng JSON (VD: {"configKey":"hold_minutes","configValue":"10"})
        template.setValueSerializer(new GenericJackson2JsonRedisSerializer());
        template.setHashValueSerializer(new GenericJackson2JsonRedisSerializer());

        return template;
    }
}
```

**Tại sao cần config Serializer?**

| Serializer | Dữ liệu trong Redis | Đọc được không? |
|---|---|---|
| Mặc định (JdkSerializationRedisSerializer) | `\xac\xed\x00\x05t\x00\x0210` | Không, binary lộn xộn |
| StringRedisSerializer (key) | `"config:booking.hold_minutes"` | Dễ đọc |
| GenericJackson2JsonRedisSerializer (value) | `{"value": 10}` | Dễ đọc, dễ debug |

> **Mẹo debug:** Vào Redis CLI gõ `KEYS *` sẽ thấy tất cả key đang lưu. Nếu key là binary bạn sẽ không biết key nào là key nào.

---

## 6. Cache-aside Pattern — Chiến lược cache của CineX

### Pattern là gì?

**Cache-aside** (hay còn gọi **Lazy Loading**) là chiến lược cache phổ biến nhất. Ý tưởng:

1. Khi cần đọc dữ liệu → **kiểm tra cache trước**
2. Nếu cache **CÓ** (cache HIT) → trả về ngay, không cần đọc DB
3. Nếu cache **KHÔNG CÓ** (cache MISS) → đọc DB → lưu vào cache → trả về
4. Khi dữ liệu bị sửa → **xóa cache** (invalidate) → lần đọc sau sẽ đọc DB mới

### Sơ đồ luồng xử lý

```
                    ┌─────────────┐
                    │  Application│
                    │  (Service)  │
                    └──────┬──────┘
                           │
                    1. Đọc config
                           │
                    ┌──────▼──────┐
                    │    Cache    │
                    │ (HashMap)   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │                         │
        Cache HIT                 Cache MISS
        (có data)                 (không có)
              │                         │
              ▼                         ▼
        2a. Trả về ngay          2b. Đọc Database
        (< 0.001ms)                    │
                                       ▼
                                 3. Lưu vào Cache
                                       │
                                       ▼
                                 4. Trả về
                                 (~10ms lần đầu)


=== KHI ADMIN SỬA CONFIG ===

    ┌──────────────┐         ┌─────────┐         ┌──────────┐
    │ Admin sửa    │────────>│   DB    │────────>│  Cache   │
    │ config value │  Lưu DB │         │ Cập nhật│ put(k,v) │
    └──────────────┘         └─────────┘         └──────────┘
                                                       │
                                               Lần đọc sau
                                               trả giá trị mới
```

### Ví dụ đời thường

Giống **menu quán ăn dán trên tường**:
- Khách hỏi giá món A → nhìn menu trên tường (cache HIT) → trả lời ngay
- Menu chưa dán lên (cache MISS) → vào bếp hỏi đầu bếp (query DB) → ghi lên tường (lưu cache) → trả lời khách
- Chủ quán đổi giá → **xé menu cũ** (invalidate cache) → in menu mới dán lên (update cache)

---

## 7. Code thực tế: SystemConfigService

```
File: backend/src/main/java/com/cinex/module/config/service/SystemConfigService.java
```

### Phân tích từng phần

#### Phần 1: Cache storage — ConcurrentHashMap

```java
@Service
@RequiredArgsConstructor
@Slf4j
public class SystemConfigService {

    private final SystemConfigRepository systemConfigRepository;

    // Cache in-memory: key -> value
    private final ConcurrentHashMap<String, String> cache = new ConcurrentHashMap<>();
```

**ConcurrentHashMap là gì?**
- Giống `HashMap` (lưu key-value), nhưng **an toàn khi nhiều thread đọc/ghi đồng thời**
- Tại sao cần? Vì 100 user có thể đọc config cùng lúc (100 thread). HashMap thường sẽ lỗi khi nhiều thread cùng truy cập
- Ví dụ: 100 người cùng mở tủ lạnh lấy đồ. Tủ lạnh thường (HashMap) chỉ cho 1 người mở. Tủ lạnh đặc biệt (ConcurrentHashMap) cho nhiều người mở cùng lúc mà không hỏng cửa

> **Lưu ý:** CineX hiện dùng ConcurrentHashMap (cache nằm trong RAM của ứng dụng Java) thay vì Redis để cache config. Đây là lựa chọn đơn giản và đủ tốt cho single-server. Nếu sau này chạy nhiều server (load balancing), mỗi server có cache riêng → cần chuyển sang Redis để tất cả server dùng chung cache.

#### Phần 2: Load cache khi khởi động — @PostConstruct

```java
@PostConstruct
public void loadAll() {
    List<SystemConfig> configs = systemConfigRepository.findAll();
    cache.clear();
    configs.forEach(c -> cache.put(c.getConfigKey(), c.getConfigValue()));
    log.info("Loaded {} system configs into cache", configs.size());
}
```

**`@PostConstruct` là gì?**
- Annotation đánh dấu "chạy method này **ngay sau** khi Spring tạo xong bean"
- Thứ tự: Constructor → Inject dependencies → `@PostConstruct`
- Ở đây: khi server khởi động → đọc **toàn bộ** `system_config` từ DB → nhét vào cache
- Nhờ vậy, từ giây phút đầu tiên server chạy, mọi request đọc config đều đọc từ cache

**Luồng chi tiết:**
```
Server khởi động
    → Spring tạo SystemConfigService
    → Inject SystemConfigRepository
    → Gọi loadAll()
    → SELECT * FROM system_config  (1 query duy nhất)
    → cache.put("booking.hold_minutes", "10")
    → cache.put("booking.max_seats", "8")
    → cache.put("booking.cleanup_cron", "0 * * * * *")
    → Log: "Loaded 3 system configs into cache"
    → Server sẵn sàng nhận request
```

#### Phần 3: Đọc config — getString(), getInt(), getBoolean()

```java
public String getString(String key, String defaultValue) {
    return cache.getOrDefault(key, defaultValue);
}

public int getInt(String key, int defaultValue) {
    String value = cache.get(key);
    if (value == null) return defaultValue;
    try {
        return Integer.parseInt(value);
    } catch (NumberFormatException e) {
        log.warn("Config key '{}' value '{}' is not a valid integer, using default {}",
                 key, value, defaultValue);
        return defaultValue;
    }
}
```

**Tại sao cần defaultValue?**
- Phòng trường hợp config chưa có trong DB (admin quên tạo)
- Code gọi: `getInt("booking.max_seats", 8)` → nếu DB không có key này → trả về 8
- An toàn hơn nhiều so với return null → NullPointerException → server crash

**Tại sao try-catch NumberFormatException?**
- Config value luôn lưu dạng String trong DB ("10", "true", "abc")
- Nếu admin lỡ nhập `max_seats = "mười"` → `Integer.parseInt("mười")` sẽ throw exception
- Catch lại → log cảnh báo → trả default value → server không crash

**Ví dụ cách BookingService gọi:**
```java
// Trong BookingService.holdSeats()
int maxSeats = systemConfigService.getInt("booking.max_seats", 8);
if (seatIds.size() > maxSeats) {
    throw new BusinessException(ErrorCode.MAX_SEATS_EXCEEDED);
}
// Đọc từ ConcurrentHashMap → < 0.001ms
// Nếu đọc DB mỗi lần → 10ms × 100 user = 1 giây tổng cộng
```

#### Phần 4: Cập nhật config — updateConfig()

```java
@Transactional
public void updateConfig(String key, String value) {
    SystemConfig config = systemConfigRepository.findByConfigKey(key)
            .orElseGet(() -> SystemConfig.builder().configKey(key).build());
    config.setConfigValue(value);
    systemConfigRepository.save(config);     // 1. Lưu DB trước (source of truth)
    cache.put(key, value);                   // 2. Cập nhật cache sau
    log.info("Config updated: {} = {}", key, value);
}
```

**Luồng chi tiết:**
```
Admin gọi API: PUT /api/configs  { "key": "booking.max_seats", "value": "10" }
    │
    ▼
1. Tìm config trong DB theo key
    ├── Có rồi → lấy entity ra, sửa value
    └── Chưa có → tạo entity mới (orElseGet)
    │
    ▼
2. systemConfigRepository.save(config)
    → SQL: UPDATE system_config SET config_value = '10' WHERE config_key = 'booking.max_seats'
    → DB đã cập nhật (source of truth)
    │
    ▼
3. cache.put("booking.max_seats", "10")
    → Cache cũng được cập nhật
    → Lần đọc tiếp theo từ cache sẽ trả giá trị mới
```

**Tại sao lưu DB trước, cache sau?**
- DB là **source of truth** (nguồn sự thật duy nhất)
- Nếu lưu cache trước mà DB bị lỗi → cache có giá trị mới nhưng DB vẫn giá trị cũ → **mất đồng bộ**
- Nếu lưu DB trước mà cache bị lỗi → DB đúng, cache cũ → lần sau reload() sẽ đúng lại → **an toàn hơn**

#### Phần 5: Reload toàn bộ cache

```java
public void reload() {
    loadAll();
}
```

- Dùng khi cần **đồng bộ lại** toàn bộ cache từ DB
- Ví dụ: admin sửa config trực tiếp trong DB (không qua API) → cache cũ → gọi reload()
- Hoặc dùng cho endpoint admin: `POST /api/configs/reload`

---

## 8. HashMap vs Redis — Khi nào dùng cái nào?

> **Câu hỏi cốt lõi:** CineX có 2 chỗ cache. SystemConfig dùng `ConcurrentHashMap`. LoginRateLimit dùng Redis. Cùng là "cache" sao chọn 2 công nghệ khác nhau?

Trước khi vào code Redis cụ thể, cần hiểu **tại sao chọn công nghệ này cho use case này** — đó mới là kiến thức quan trọng nhất khi defend đồ án.

### Bản chất khác nhau ở đâu?

```
                  Backend Instance (JVM)
                 ┌──────────────────────────┐
                 │                          │
                 │  ConcurrentHashMap       │  ← SystemConfig cache nằm Ở ĐÂY
                 │  (RAM của Java process)  │     (trong cùng tiến trình với code)
                 │                          │
                 │  AuthService             │
                 │  BookingService          │
                 │  ...                     │
                 └──────────┬───────────────┘
                            │
                            │ Network (TCP, port 6379)
                            ▼
                 ┌──────────────────────────┐
                 │  Redis Server            │  ← LoginRateLimit cache nằm Ở ĐÂY
                 │  (process khác)          │     (server riêng, ngoài JVM)
                 └──────────────────────────┘
```

- **ConcurrentHashMap** = RAM của chính ứng dụng Java. Đọc/ghi = truy cập biến trong code → nano giây.
- **Redis** = một server riêng biệt, giao tiếp qua mạng TCP → milli giây (chậm hơn HashMap ~1000 lần).

### Ví dụ đời thường

| | ConcurrentHashMap | Redis |
|---|---|---|
| Ví dụ | **Sổ tay trong túi áo** — luôn bên mình, lấy ra cực nhanh | **Tủ tài liệu chung của công ty** — phải đi tới mới lấy được |
| Tốc độ | Nano giây | Milli giây |
| Bị mất khi | App crash/restart → mất sạch (chỉ trong RAM) | Redis crash mới mất (có persistence option) |
| 3 người chung dùng | Mỗi người 1 sổ tay → có thể lệch nhau | 1 tủ tài liệu chung → luôn đồng bộ |

### So sánh chi tiết cho 2 use case CineX

| Tiêu chí | SystemConfig (`HashMap`) | LoginRateLimit (`Redis`) |
|---|---|---|
| **Lượng data** | ~6 record, mỗi cái vài chục byte | Hàng nghìn key (mỗi user 1 key) |
| **Read pattern** | RẤT NHIỀU (mọi request đặt vé, login, scheduler...) | Mỗi lần login thử (ít hơn nhiều) |
| **Write pattern** | RẤT ÍT (admin sửa vài lần/tháng) | RẤT NHIỀU (mỗi fail là 1 INCR) |
| **Cần TTL?** | Không (config sống mãi, admin sửa thì cache cập nhật ngay) | **CÓ BẮT BUỘC** (15 phút tự xóa, không cần scheduler dọn) |
| **Cần atomic counter?** | Không (đọc/ghi đơn giản) | **CÓ BẮT BUỘC** (nhiều thread cùng INCR — HashMap phải `synchronized` thủ công → chậm) |
| **Multi-instance share?** | Không critical (xem dưới) | **CRITICAL** (nếu mỗi BE 1 counter → attacker bypass) |

### Phép thử: nếu CineX scale lên 3 BE instance

Hãy tưởng tượng load balancer phân request ra 3 BE:

#### Trường hợp 1: SystemConfig — không nghiêm trọng

```
Admin gọi PUT /api/configs/booking.max_seats → value=10

Load balancer → BE1
  → BE1.cache.put("booking.max_seats", "10")   ✅ BE1 thấy "10"
  → BE2, BE3.cache vẫn giữ "8"                  ❌ Chưa biết

3 user đặt 9 ghế:
  User A → BE1 → max=10 → OK
  User B → BE2 → max=8 → "Tối đa 8 ghế"  ⚠️ Lệch nhau
  User C → BE3 → max=8 → "Tối đa 8 ghế"  ⚠️ Lệch nhau

Hậu quả:
  - User B/C bị "oan" trong vài phút
  - KHÔNG ảnh hưởng bảo mật, chỉ UX
  - Đợi BE2/3 restart hoặc gọi /reload → sync lại
```

→ **Lệch tạm vài phút, chấp nhận được** cho config rất hiếm thay đổi.

#### Trường hợp 2: LoginRateLimit — bypass security

```
Attacker brute force username "vanan":

Lần 1 → LB → BE1.counter("vanan") = 1
Lần 2 → LB → BE2.counter("vanan") = 1   ❌ BE2 không biết BE1 đã đếm
Lần 3 → LB → BE3.counter("vanan") = 1
Lần 4 → LB → BE1.counter("vanan") = 2
Lần 5 → LB → BE2.counter("vanan") = 2
...
Lần 15 → vẫn chưa BE nào counter = 5 → KHÔNG BLOCK
→ Attacker brute force 15 lần × N BE → vẫn không bị chặn

Hậu quả:
  - Security mechanism BỊ BYPASS HOÀN TOÀN
  - Càng scale nhiều BE → càng dễ brute force
```

→ **KHÔNG chấp nhận được**. Phải dùng cache chung (Redis).

### Atomic operation — lý do thường bị bỏ qua

Hãy thử implement rate limit BẰNG HashMap xem:

```java
// ❌ SAI — race condition
public void recordFail(String username) {
    Integer current = hashMap.get(username);
    if (current == null) current = 0;
    hashMap.put(username, current + 1);
}
```

Khi 2 thread cùng `recordFail("vanan")` lúc counter = 3:
- Thread A đọc `current = 3`
- Thread B đọc `current = 3` (cùng lúc)
- Thread A `put(3+1=4)`
- Thread B `put(3+1=4)`
- **Đáng lẽ counter phải = 5, nhưng chỉ = 4** → attacker fail thêm 1 lần "miễn phí"

Phải `synchronized` để fix:
```java
public synchronized void recordFail(String username) { ... }
```
Nhưng `synchronized` block toàn bộ method → 1 lần chỉ 1 thread chạy → bottleneck. Khi 1000 user login/giây, đây là disaster.

Trong khi đó **Redis `INCR` atomic ở tầng Redis server** — không cần `synchronized` Java, performance vẫn cao.

### Tại sao SystemConfig không dùng Redis luôn?

Có thể chứ. Nhưng tradeoff:

| | HashMap (đang dùng) | Nếu chuyển sang Redis |
|---|---|---|
| Mỗi lần `getInt("booking.max_seats")` | ~0.001ms (đọc RAM) | ~1ms (qua network + serialize JSON) |
| Multi-instance đồng bộ | Lệch tạm vài phút | Đồng bộ ngay |
| Phụ thuộc Redis | Không | Redis down → toàn app không đọc được config |
| Complexity | Đơn giản (HashMap thuần) | Phức tạp (serialize, network, error handling) |

CineX hiện 1 BE → HashMap **đủ tốt** và **nhanh hơn**. Nếu lên 3 BE và admin sửa config thường xuyên → cân nhắc chuyển Redis.

### Quy tắc thực dụng — chọn đúng tool cho đúng job

> **Không phải Redis luôn tốt hơn HashMap.** Mỗi tool có sweet spot riêng.

| Use case | Nên dùng |
|---|---|
| Config tĩnh, đọc nhiều, sửa hiếm | `ConcurrentHashMap` |
| Enum metadata, lookup table | `ConcurrentHashMap` |
| Rate limit, distributed lock | `Redis` |
| Session (multi-instance) | `Redis` |
| Counter increment đồng thời | `Redis` (INCR atomic) |
| Cache với TTL ngắn (5-60 phút) | `Redis` |
| Pub/Sub giữa các instance | `Redis` |
| Queue task đơn giản | `Redis` (LPUSH/RPOP) |
| Data lớn, persistent, complex query | **Database** (không phải cache) |

### Bảng quyết định nhanh

Khi gặp 1 yêu cầu mới, tự hỏi 3 câu:

1. **Có cần share giữa nhiều instance không?** → Có = Redis, Không = HashMap OK
2. **Có cần TTL tự động không?** → Có = Redis, Không = HashMap OK
3. **Có cần atomic operation (counter, set-if-absent...) không?** → Có = Redis, Không = HashMap OK

Nếu cả 3 đều **Không** → HashMap đủ và nhanh hơn.
Nếu **Có** ít nhất 1 → Redis.

→ SystemConfig: 3 lần "Không" → HashMap.
→ LoginRateLimit: 3 lần "Có" → Redis.

---

## 9. Code thực tế (Redis): LoginRateLimitService

Đây là **chỗ DUY NHẤT** trong CineX thực sự dùng Redis. Mọi đoạn code Redis ở các phần trên là minh họa pattern; phần này là code đang chạy production.

### Bài toán: chống brute force password

Attacker biết username `vanan` → dùng bot thử 1000 password phổ biến (`123456`, `password`, `vanan2003`...). Không có rate limit → sớm muộn cũng trúng 1 password yếu. Cần:
- Đếm số lần login fail theo username
- Sau 5 lần fail → block username 15 phút
- Reset counter khi login thành công

### Vì sao Redis thay vì HashMap?

> Xem [Section 8](#8-hashmap-vs-redis--khi-nào-dùng-cái-nào) cho phân tích đầy đủ. Tóm tắt cho use case này:
>
> - **Multi-instance share**: nếu mỗi BE giữ counter riêng → attacker xoay 3 BE → mỗi BE đếm 5 lần → tổng 15 lần fail → **bypass security**.
> - **TTL bắt buộc**: HashMap không có TTL, phải tự code scheduler dọn key cũ. Redis có sẵn `EXPIRE`.
> - **Atomic INCR**: HashMap cần `synchronized` toàn method → bottleneck. Redis `INCR` atomic ở tầng server, không cần lock Java.

→ Rate limit là use case **kinh điển** của Redis. Áp 3 câu hỏi ở Section 8: cần share (✓) + cần TTL (✓) + cần atomic (✓) → 3 lần "Có" → Redis. Dùng HashMap ở đây là sai pattern.

### Code thực tế

```
File: backend/src/main/java/com/cinex/module/auth/service/LoginRateLimitService.java
```

```java
@Service
@RequiredArgsConstructor
@Slf4j
public class LoginRateLimitService {

    private final StringRedisTemplate redis;   // Spring Boot auto-config khi có dependency
    private final SystemConfigService systemConfigService;

    private static final String KEY_PREFIX = "login:fail:";

    /**
     * Check trước khi xác thực — throw nếu đang bị block.
     * Gọi đầu method login(), trước cả khi tìm user trong DB.
     */
    public void checkBlocked(String username) {
        String key = KEY_PREFIX + username.toLowerCase();
        String value = redis.opsForValue().get(key);
        int attempts = (value == null) ? 0 : Integer.parseInt(value);
        int maxAttempts = systemConfigService.getInt("auth.login_max_attempts", 5);

        if (attempts >= maxAttempts) {
            int blockMinutes = systemConfigService.getInt("auth.login_block_minutes", 15);
            throw new BusinessException(ErrorCode.TOO_MANY_LOGIN_ATTEMPTS,
                String.format("Tài khoản tạm khóa %d phút sau %d lần đăng nhập sai",
                              blockMinutes, maxAttempts));
        }
    }

    /**
     * Ghi nhận 1 lần fail → INCR counter (atomic ở tầng Redis).
     * Lần fail ĐẦU TIÊN set TTL — các lần sau KHÔNG reset TTL (nếu reset thì
     * attacker spam fail vẫn không trigger expire).
     */
    public void recordFail(String username) {
        String key = KEY_PREFIX + username.toLowerCase();
        Long attempts = redis.opsForValue().increment(key);   // INCR atomic

        if (attempts != null && attempts == 1L) {
            int blockMinutes = systemConfigService.getInt("auth.login_block_minutes", 15);
            redis.expire(key, Duration.ofMinutes(blockMinutes));
        }
    }

    /**
     * Xóa counter khi login thành công.
     */
    public void clearFails(String username) {
        redis.delete(KEY_PREFIX + username.toLowerCase());
    }
}
```

### AuthService gọi vào đâu?

```java
@Transactional
public AuthResponse login(LoginRequest request) {
    String username = request.getUsername();

    // 1. Check trước — nếu đang block thì throw 429 sớm, không tốn query DB
    loginRateLimitService.checkBlocked(username);

    // 2. Tìm user — username không tồn tại CŨNG tính fail (chống enum username)
    User user = userRepository.findActiveByUsername(username)
            .orElseThrow(() -> {
                loginRateLimitService.recordFail(username);
                return new BusinessException(ErrorCode.INVALID_CREDENTIALS);
            });

    // 3. Verify password — sai cũng tính fail
    if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
        loginRateLimitService.recordFail(username);
        throw new BusinessException(ErrorCode.INVALID_CREDENTIALS);
    }

    if (!user.isEnabled()) {
        // Password đúng nhưng tài khoản disabled — KHÔNG tính fail (tránh oan)
        throw new BusinessException(ErrorCode.FORBIDDEN, "Tài khoản đã bị vô hiệu hóa");
    }

    // 4. Login thành công → reset counter
    loginRateLimitService.clearFails(username);

    return buildAuthResponse(user);
}
```

### Quan sát Redis khi chạy thực tế

Sau khi user `vanan` nhập sai password 3 lần:

```bash
docker exec -it cinex-redis-1 redis-cli

127.0.0.1:6379> KEYS login:*
1) "login:fail:vanan"

127.0.0.1:6379> GET login:fail:vanan
"3"

127.0.0.1:6379> TTL login:fail:vanan
(integer) 847          # ← Còn 847 giây = ~14 phút nữa key tự xóa
```

Sau 5 lần fail, lần thứ 6 sẽ nhận response:
```json
HTTP 429 Too Many Requests
{
  "success": false,
  "message": "Tài khoản tạm khóa 15 phút sau 5 lần đăng nhập sai",
  "timestamp": "2026-06-04T..."
}
```

### Config động (system_config)

```sql
SELECT * FROM system_config WHERE config_key LIKE 'auth.login%';
-- auth.login_max_attempts  | 5  | Số lần đăng nhập sai tối đa...
-- auth.login_block_minutes | 15 | Thời gian tạm khóa (phút)...
```

Admin có thể đổi qua API `PUT /api/configs/auth.login_max_attempts` mà không cần redeploy. VD đêm khuya bị spam → tăng `max_attempts` xuống `3` để khắt khe hơn.

### Tại sao theo username chứ không theo IP?

| | Theo username | Theo IP |
|---|---|---|
| Attacker thử nhiều username từ 1 IP | ❌ Không bắt được | ✅ Bắt được |
| Nhiều user chung 1 IP (văn phòng, NAT) | ✅ Không ảnh hưởng nhau | ❌ Block hết cả văn phòng |
| Attacker dùng botnet (1 IP/lần) | ✅ Vẫn bắt vì cùng username | ❌ Mỗi IP fail vài lần là OK |

CineX chọn theo **username** vì khả năng false positive theo IP (NAT/proxy) lớn hơn rủi ro attacker phân tán botnet đánh nhiều username. Production scale có thể combine cả 2.

### Threat coverage

| Tấn công | Bị chặn? |
|---|---|
| Bot brute force password 1 username | ✅ 5 lần fail/15 phút |
| Bot brute force nhiều username cùng IP | ⚠️ Chỉ chặn theo từng username (mỗi username 5 lần) |
| Distributed (botnet) brute force 1 username | ✅ Vì counter theo username, không phụ thuộc IP |
| Brute force qua API refresh token | ❌ Không cover (cần rate limit riêng cho /refresh) |

### Mở rộng tương lai

- Combine theo IP: thêm key `login:fail:ip:{ip}` với limit cao hơn (VD 30 lần/giờ)
- Captcha sau 3 lần fail
- Email user khi phát hiện brute force
- Slack notify admin khi 1 username bị block

---

## 10. Cache Invalidation — Khi nào cache bị xóa?

**"There are only two hard things in Computer Science: cache invalidation and naming things."**
— Phil Karlton

Cache invalidation (xóa/cập nhật cache) là bài toán khó nhất khi dùng cache. Nếu cache không được xóa kịp thời, user sẽ thấy **dữ liệu cũ** (stale data).

### Các tình huống cache thay đổi trong CineX

| Tình huống | Xử lý | Code |
|---|---|---|
| Admin sửa config qua API | Lưu DB + cập nhật cache ngay | `cache.put(key, value)` |
| Admin sửa trực tiếp DB | Cache **vẫn giữ giá trị cũ** cho đến khi reload | `reload()` |
| Server khởi động lại | Load toàn bộ config từ DB | `@PostConstruct loadAll()` |

### Ví dụ stale data (dữ liệu cũ)

```
Tình huống: Admin muốn tăng max_seats từ 8 lên 10

1. Admin vào SQL Server, chạy:
   UPDATE system_config SET config_value = '10' WHERE config_key = 'booking.max_seats'

2. Cache vẫn giữ: { "booking.max_seats": "8" }  ← DỮ LIỆU CŨ!

3. User đặt 9 ghế → bị từ chối vì cache nói max = 8

4. Admin phải gọi API reload: POST /api/configs/reload
   → loadAll() → cache cập nhật: { "booking.max_seats": "10" }

5. User đặt 9 ghế → thành công
```

**Bài học:** Luôn sửa config qua API (`updateConfig()`), không sửa trực tiếp DB. Nếu buộc phải sửa DB → nhớ gọi reload.

---

## 11. TTL — Time To Live (Thời gian sống của cache)

### TTL là gì?

**TTL** = thời gian cache tồn tại trước khi tự động bị xóa. Giống **hạn sử dụng** trên hộp sữa:
- Sữa mới mua (cache mới) → uống ngay OK
- Sữa hết hạn (cache expired) → vứt đi (xóa cache) → mua mới (đọc DB lại)

### Tại sao cần TTL?

Không có TTL → cache sống mãi mãi → nếu quên invalidate → dữ liệu cũ mãi mãi.

Có TTL (ví dụ 5 phút) → dù quên invalidate, cache tự hết hạn sau 5 phút → đọc DB lại → dữ liệu mới.

**TTL là "lưới an toàn" cho cache invalidation.**

### Cách dùng TTL với Redis

```java
// Lưu vào Redis với TTL 5 phút
redisTemplate.opsForValue().set(
    "config:booking.max_seats",   // key
    "8",                          // value
    5,                            // TTL
    TimeUnit.MINUTES              // đơn vị
);

// Sau 5 phút → Redis tự xóa key này
// Lần đọc tiếp → cache MISS → đọc DB → lưu cache lại (với TTL mới)
```

### CineX dùng TTL ở đâu?

| Cache | Storage | TTL | Logic refresh |
|---|---|---|---|
| `SystemConfig` | ConcurrentHashMap | ❌ Không TTL | `updateConfig()` cập nhật cache + DB; `reload()` load lại; server restart load lại |
| `login:fail:{username}` | Redis | ✅ 15 phút (config) | TTL tự xóa khi hết hạn; `clearFails()` xóa khi login OK |

`SystemConfig` không TTL hợp lý vì config hiếm thay đổi + admin sửa qua API tự refresh cache.

`LoginRateLimit` cần TTL **bắt buộc** vì:
- Nếu không TTL → user fail 5 lần rồi quên đó → 1 năm sau mới login → vẫn bị block
- TTL 15 phút → user đợi 15 phút thử lại, hợp lý cho UX và security
- Redis TTL tự động, không cần scheduler dọn dẹp như HashMap

### Chọn TTL bao lâu?

| Loại dữ liệu | TTL gợi ý | Lý do |
|---|---|---|
| System config | 5-10 phút (hoặc không TTL) | Rất ít thay đổi |
| Danh sách thể loại phim | 30-60 phút | Thay đổi rất hiếm |
| Danh sách phim đang chiếu | 5-10 phút | Có thể thêm/sửa trong ngày |
| Trạng thái ghế | 30-60 giây | Thay đổi liên tục khi nhiều người đặt |

**Quy tắc chung:** Dữ liệu càng ít thay đổi → TTL càng dài. Dữ liệu thay đổi liên tục → TTL ngắn hoặc không cache.

---

## 12. Ví dụ thực tế: 100 user đồng thời hold ghế

Hãy theo dõi điều gì xảy ra khi 100 user cùng lúc vào chọn ghế cho suất chiếu "Avengers" lúc 20:00.

### Không có cache

```
User 1: holdSeats() → SELECT config_value FROM system_config WHERE config_key = 'max_seats'  → 10ms
User 2: holdSeats() → SELECT config_value FROM system_config WHERE config_key = 'max_seats'  → 10ms
User 3: holdSeats() → SELECT config_value FROM system_config WHERE config_key = 'max_seats'  → 10ms
...
User 100: holdSeats() → SELECT config_value FROM system_config WHERE config_key = 'max_seats' → 10ms

Tổng: 100 query × 10ms = 1000ms (1 giây) CHỈ ĐỂ ĐỌC 1 GIÁ TRỊ CONFIG
+ 100 query kiểm tra hold_minutes
+ 100 query kiểm tra các config khác
= Database bị quá tải, response chậm
```

### Có cache (SystemConfigService)

```
Server khởi động:
  → @PostConstruct loadAll()
  → 1 query: SELECT * FROM system_config
  → Cache: { "max_seats": "8", "hold_minutes": "10", ... }

User 1: holdSeats()
  → systemConfigService.getInt("max_seats", 8)
  → cache.get("max_seats") → "8"  → 0.001ms (đọc RAM)

User 2: holdSeats()
  → cache.get("max_seats") → "8"  → 0.001ms

...

User 100: holdSeats()
  → cache.get("max_seats") → "8"  → 0.001ms

Tổng: 100 × 0.001ms = 0.1ms CHO TẤT CẢ
Database: 0 query (tải = 0)
```

**Kết quả:** Nhanh hơn **10.000 lần**, database không bị tải gì cả.

---

## 13. Code thực tế (Redis): JwtBlacklistService

Đây là use case **thứ 2** của Redis trong CineX (cùng với `LoginRateLimitService`). Pattern cực kỳ giống `LoginRateLimitService` — đều là "lưu flag/counter ngắn hạn theo key, dùng TTL để tự dọn".

### Bài toán: revoke access token trước khi hết hạn

JWT là stateless — server không lưu phiên. Khi user logout hoặc đổi password, refresh token bị revoke ngay trong DB, nhưng access token cũ **vẫn dùng được** đến khi hết hạn tự nhiên (CineX cấu hình 15 phút). Nếu attacker có access token leak, họ có cửa sổ 15 phút để impersonate user.

> Xem [03-security.md Section 18](../backend/03-security.md) cho phân tích an toàn đầy đủ. Phần này tập trung vào **cách Redis lưu trữ**.

### Vì sao chọn Redis (không phải DB / HashMap)?

Áp **3 câu hỏi** ở Section 8 cho use case này:

| Tiêu chí | Đánh giá |
|---|---|
| Cần share giữa multi-instance? | ✅ Có. Instance A logout user → instance B phải reject token đó luôn |
| Cần TTL tự xóa? | ✅ Có. Sau khi token hết hạn tự nhiên, không cần giữ blacklist nữa — tránh phình memory |
| Cần atomic? | ✅ Có (nhẹ). `SET` + `EXISTS` đều atomic ở Redis |

3/3 → Redis. Dùng HashMap sẽ sai pattern: instance khác không biết token đã blacklist, key không tự xóa khi token expire.

> So sánh với DB: lưu blacklist vào bảng `revoked_tokens` cũng được, nhưng:
> - Mỗi request phải `SELECT * FROM revoked_tokens WHERE hash = ?` → query DB cho mọi request → tốn pool connection.
> - Phải tự code scheduler `DELETE WHERE expiry < NOW()` để dọn.
> - Latency DB 5-20ms vs Redis 0.5-1ms.

### Code thực tế

```
File: backend/src/main/java/com/cinex/security/JwtBlacklistService.java
```

```java
@Service
@RequiredArgsConstructor
@Slf4j
public class JwtBlacklistService {

    private static final String KEY_PREFIX = "jwt:blacklist:";

    private final StringRedisTemplate redis;
    private final JwtUtil jwtUtil;

    /**
     * Đưa token vào blacklist với TTL = phần còn lại trước khi token hết hạn.
     */
    public void blacklist(String token) {
        if (token == null || token.isBlank()) return;
        try {
            Claims claims = jwtUtil.extractAllClaims(token);
            Date exp = claims.getExpiration();
            if (exp == null) return;

            long remainMs = exp.getTime() - System.currentTimeMillis();
            if (remainMs <= 0) {
                // Token đã expire — không cần blacklist (filter sẽ tự reject)
                return;
            }

            String key = KEY_PREFIX + tokenHash(token);
            redis.opsForValue().set(key, "1", Duration.ofMillis(remainMs));
            log.info("JWT blacklisted for user '{}', TTL={}s",
                     claims.getSubject(), remainMs / 1000);
        } catch (Exception e) {
            log.debug("Skip blacklist (invalid token): {}", e.getMessage());
        }
    }

    /**
     * Check mỗi request từ JwtAuthFilter. Fail-open khi Redis lỗi
     * → tránh outage Redis làm block toàn site.
     */
    public boolean isBlacklisted(String token) {
        if (token == null || token.isBlank()) return false;
        try {
            String key = KEY_PREFIX + tokenHash(token);
            return Boolean.TRUE.equals(redis.hasKey(key));
        } catch (Exception e) {
            log.warn("Redis check blacklist failed, fail-open: {}", e.getMessage());
            return false;
        }
    }

    /** SHA-256 → 64 hex chars. Tránh lưu token raw vào Redis. */
    public String tokenHash(String token) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(token.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(hash.length * 2);
            for (byte b : hash) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
```

### Vì sao lưu SHA-256 hash thay vì raw token?

| | Lưu raw token | Lưu SHA-256 |
|---|---|---|
| Memory | ~200 byte / key (JWT dài) | 64 hex chars cố định |
| Bảo mật khi Redis leak | ❌ Attacker có token raw → impersonate | ✅ Hash 1 chiều |
| Verify cost | `EXISTS jwt:blacklist:{raw}` | `EXISTS jwt:blacklist:{hash}` (cost ≈ 0) |

Redis có thể bị leak qua memory dump, RDB backup file, hoặc khi attacker chiếm được Redis container. Hash giúp **giảm thiệt hại** — leak vẫn chỉ thấy hash, không khôi phục được token.

### Tích hợp vào JwtAuthFilter

```java
// JwtAuthFilter.java — sau khi parse claims, trước khi setAuthentication
if (jwtBlacklistService.isBlacklisted(token)) {
    log.debug("JWT blacklisted for {}", username);
    filterChain.doFilter(request, response);   // không set Authentication → 401
    return;
}
```

Thứ tự check trong filter:
1. Có header `Authorization: Bearer ...`? Không → skip filter.
2. Parse claims, lấy `subject` + `exp`.
3. **Check expired** (CPU local, nhanh) — token quá hạn thường chiếm tỷ lệ lớn.
4. **Check blacklist** (Redis round-trip ~1ms) — chỉ chạy nếu chưa expired → tiết kiệm 1 query Redis cho mỗi token đã hết hạn.
5. Load `UserDetails` từ cache (Caffeine TTL 2p) → `setAuthentication`.

### Use cases dùng `blacklist()` trong CineX

| Action | File | Vì sao blacklist |
|---|---|---|
| Logout (`POST /api/auth/logout`) | `AuthService.logout()` | Nhấn "đăng xuất" → access token vẫn dùng 15 phút sau là sai |
| Đổi password (`POST /api/users/me/change-password`) | `UserService.changePassword()` | Đề phòng attacker có sẵn access token cũ — đổi pass để cắt ngay |

> Reset password (forgot-password) **không** blacklist vì user chưa login (không có access token đang dùng) — chỉ cần revoke tất cả refresh token là đủ.

### Quan sát Redis khi chạy thực tế

```bash
# User vanan logout lúc 10:00:00, access token còn 12 phút
docker exec -it cinex-redis-1 redis-cli

127.0.0.1:6379> KEYS jwt:blacklist:*
1) "jwt:blacklist:8c4a7f3d2b9e6a1f5d8c0b7e4a9f6d2c1b8e5a3f7d0c9b6e1a4f8d5c2b7e3a9f"

127.0.0.1:6379> GET jwt:blacklist:8c4a7f3d2b9e6a1f5d8c0b7e4a9f6d2c1b8e5a3f7d0c9b6e1a4f8d5c2b7e3a9f
"1"

127.0.0.1:6379> TTL jwt:blacklist:8c4a7f3d2b9e6a1f5d8c0b7e4a9f6d2c1b8e5a3f7d0c9b6e1a4f8d5c2b7e3a9f
(integer) 718        # ← Còn ~12 phút trước khi token hết hạn tự nhiên
```

Sau ~12 phút Redis tự xóa key (do TTL). Không cần scheduler nào.

### So sánh JwtBlacklist với LoginRateLimit

Hai service đều dùng Redis nhưng pattern khác biệt rõ:

| Aspect | LoginRateLimit | JwtBlacklist |
|---|---|---|
| **Mục đích** | Chống brute force | Invalidate token ngay khi logout / đổi pass |
| **Key prefix** | `login:fail:{username}` | `jwt:blacklist:{sha256-hex}` |
| **Data lưu** | Counter (integer) — `INCR` | Flag exists — `SET key "1"` |
| **Lệnh tạo** | `INCR` + `EXPIRE` (lần đầu) | `SET key value EX <ttl>` |
| **TTL** | 15 phút từ lần fail ĐẦU (không reset mỗi fail) | = `exp - now` của JWT |
| **TTL reset?** | Không (tránh attacker spam fail → block vô tận) | Mỗi token mới có TTL riêng |
| **Check trước action** | `checkBlocked` ở đầu `login()` | `isBlacklisted` trong `JwtAuthFilter` mỗi request |
| **Khi nào xóa thủ công** | `clearFails` khi login thành công | Không xóa — Redis tự xóa khi TTL hết |
| **Fail mode khi Redis chết** | Fail-open (không block) | Fail-open (cho qua) |

Pattern chung: **"counter/flag ngắn hạn theo key + TTL tự dọn"** — đây là pattern Redis **kinh điển** cho rate limit, session, idempotency key, distributed lock.

### Threat coverage

| Tấn công | Bị chặn? |
|---|---|
| Access token leak — user đã logout | ✅ Blacklist đến hết TTL JWT |
| Access token leak — user CHƯA logout | ❌ Không cover (cần token binding / device fingerprint) |
| Attacker bypass bằng cách đoán hash SHA-256 | ✅ Hash 256-bit không thể brute force |
| Redis chết đột ngột | ⚠️ Fail-open — chấp nhận vì TTL ngắn 15 phút |
| Attacker đọc trộm Redis (memory dump, RDB leak) | ✅ Hash 1 chiều → không khôi phục token gốc |

### Mở rộng tương lai

- **Thêm `jti` claim vào JWT** → blacklist theo `jti` (36 byte UUID) thay vì hash 64 byte → tiết kiệm memory.
- **Cluster Redis** khi blacklist size lớn (>1GB).
- **Notify user qua email** khi phát hiện token leak (gồm IP & User-Agent ở thời điểm blacklist).
- **Device-aware**: lưu device fingerprint khi tạo token, blacklist theo device thay vì token.

---

## 14. Tổng hợp kiến thức

### Các lệnh Redis cơ bản (biết để debug)

```bash
# Trong Redis CLI (docker exec -it cinex-redis-1 redis-cli)

SET key value              # Lưu giá trị
GET key                    # Đọc giá trị
DEL key                    # Xóa key
KEYS *                     # Liệt kê tất cả key (CHỈ dùng khi debug, KHÔNG dùng production)
TTL key                    # Xem key còn sống bao lâu (giây), -1 = không có TTL
EXPIRE key 300             # Set TTL 300 giây (5 phút)
FLUSHALL                   # Xóa hết tất cả key (NGUY HIỂM)
```

### Khi nào dùng, khi nào KHÔNG dùng cache?

| Dùng cache | KHÔNG nên cache |
|---|---|
| Dữ liệu đọc thường xuyên (config, menu, danh mục) | Dữ liệu nhạy cảm (mật khẩu, token) |
| Dữ liệu ít thay đổi | Dữ liệu thay đổi mỗi giây |
| Cần response nhanh (< 10ms) | Query đã đủ nhanh (< 5ms) |
| Nhiều user đọc cùng dữ liệu | Mỗi user đọc dữ liệu khác nhau |

---

## 15. Câu hỏi tự kiểm tra

**Câu 1:** Nếu admin sửa `max_seats` từ 8 thành 10 trực tiếp trong SQL Server (không qua API), user đặt 9 ghế sẽ bị từ chối hay thành công? Tại sao?

→ Bị từ chối. Vì cache (`ConcurrentHashMap`) vẫn giữ giá trị cũ `"8"`. Code đọc từ cache, không đọc DB. Phải gọi `reload()` hoặc restart server để cache cập nhật.

---

**Câu 2:** Tại sao `SystemConfigService` dùng `ConcurrentHashMap` thay vì `HashMap` thường? Nếu dùng `HashMap` thì điều gì có thể xảy ra?

→ Vì nhiều thread (nhiều user request) có thể đọc/ghi cache đồng thời. `HashMap` không thread-safe → khi 2 thread cùng ghi vào HashMap, có thể gây ra: infinite loop (vòng lặp vô hạn), data corruption (dữ liệu bị hỏng), hoặc `ConcurrentModificationException`. `ConcurrentHashMap` cho phép đọc/ghi đồng thời an toàn.

---

**Câu 3:** Nếu server CineX chạy trên 3 máy khác nhau (load balancing), cách cache bằng `ConcurrentHashMap` có vấn đề gì? Giải pháp là gì?

→ Mỗi server có `ConcurrentHashMap` riêng → 3 cache riêng biệt. Khi admin sửa config trên server A, cache server B và C vẫn giữ giá trị cũ → dữ liệu không đồng nhất. Giải pháp: chuyển sang dùng Redis làm cache chung. Cả 3 server đều đọc/ghi vào cùng 1 Redis instance → dữ liệu luôn đồng nhất.

---

**Câu 4:** TTL = 5 phút nghĩa là gì? Nếu set TTL = 0 thì sao? Nếu không set TTL thì sao?

→ TTL = 5 phút: cache tự động bị xóa sau 5 phút kể từ lúc lưu. Lần đọc tiếp sẽ cache MISS → đọc DB → lưu cache mới.

TTL = 0: trong Redis, key bị xóa ngay lập tức (không có ý nghĩa cache).

Không set TTL: cache sống mãi mãi cho đến khi bị xóa thủ công (DEL) hoặc server restart. Rủi ro: nếu quên invalidate → dữ liệu cũ mãi.

---

**Câu 5:** Tại sao `LoginRateLimitService` chỉ set TTL ở lần fail ĐẦU TIÊN (khi `attempts == 1`), không reset TTL mỗi lần fail?

→ Vì nếu reset TTL mỗi lần fail, attacker spam fail liên tục → TTL bị "đẩy" mãi mãi → key không bao giờ expire → block vĩnh viễn (UX tệ với user thật nhớ sai password). Set TTL 1 lần ở lần fail đầu = "đếm ngược 15 phút bắt đầu từ fail đầu tiên" → sau 15 phút key tự xóa bất kể có bao nhiêu lần fail.

---

**Câu 6:** Tại sao rate limit theo `username` chứ không theo `IP`?

→ Vì nhiều user thật có thể chung 1 IP (văn phòng dùng NAT, ISP dùng CGNAT). Block theo IP có thể oan cả nhóm user. Theo username chỉ ảnh hưởng đúng tài khoản bị tấn công. Production scale lớn nên combine cả 2: counter theo username (chống brute force 1 user) + counter theo IP (chống enum nhiều user từ 1 IP) với threshold khác nhau.

---

**Câu 7:** Nếu một username đang bị block (counter = 5), user thật của tài khoản đó đăng nhập với password ĐÚNG, hệ thống xử lý thế nào? Đúng hay sai?

→ HỆ THỐNG VẪN THROW 429 dù password đúng (vì `checkBlocked()` chạy TRƯỚC khi verify password). User thật buộc phải đợi 15 phút TTL hết. Đây là tradeoff: security thắng UX. Cách giảm tệ hơn cho UX: gửi email "tài khoản của bạn đang bị brute force" để user biết, hoặc cho user reset block bằng OTP qua email.
