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

## 2. Tại sao CineX cần Redis?

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

| Tính năng | Cách dùng | Lý do |
|---|---|---|
| **Config cache** | Lưu `system_config` vào cache, không query DB mỗi lần | Config đọc cực thường xuyên, ít thay đổi |
| **Trạng thái ghế** | Cache ghế đang HOLD → FE hiển thị ghế đỏ/xanh nhanh | 100 user cùng xem sơ đồ ghế |
| **Rate limiting** | Đếm số request/giây từ mỗi IP | Chặn spam đặt vé |

---

## 3. Cài đặt Redis bằng Docker

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

## 4. Cấu hình Spring Data Redis

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

## 5. Cache-aside Pattern — Chiến lược cache của CineX

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

## 6. Code thực tế: SystemConfigService

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

## 7. Cache Invalidation — Khi nào cache bị xóa?

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

## 8. TTL — Time To Live (Thời gian sống của cache)

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

### CineX hiện tại dùng TTL không?

Hiện tại `SystemConfigService` dùng `ConcurrentHashMap` (in-memory cache) và **không có TTL**. Cache chỉ được cập nhật khi:
- Admin gọi `updateConfig()` → cập nhật cache
- Admin gọi `reload()` → load lại toàn bộ
- Server restart → `@PostConstruct` load lại

Đây là lựa chọn hợp lý vì config hiếm khi thay đổi. Nếu sau này cần TTL (ví dụ cache danh sách phim hot), sẽ dùng Redis với TTL.

### Chọn TTL bao lâu?

| Loại dữ liệu | TTL gợi ý | Lý do |
|---|---|---|
| System config | 5-10 phút (hoặc không TTL) | Rất ít thay đổi |
| Danh sách thể loại phim | 30-60 phút | Thay đổi rất hiếm |
| Danh sách phim đang chiếu | 5-10 phút | Có thể thêm/sửa trong ngày |
| Trạng thái ghế | 30-60 giây | Thay đổi liên tục khi nhiều người đặt |

**Quy tắc chung:** Dữ liệu càng ít thay đổi → TTL càng dài. Dữ liệu thay đổi liên tục → TTL ngắn hoặc không cache.

---

## 9. Ví dụ thực tế: 100 user đồng thời hold ghế

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

## 10. Tổng hợp kiến thức

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

## 11. Câu hỏi tự kiểm tra

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
