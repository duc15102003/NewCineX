# Redis — Cache dữ liệu

---

## Redis là gì?

Database **lưu trong RAM** (in-memory), đọc/ghi cực nhanh. Dùng để **cache** data truy vấn thường xuyên.

### Ví dụ đời thường
- **Không có Redis:** Mỗi lần cần biết giá vé → mở tủ hồ sơ tìm (DB query, chậm)
- **Có Redis:** Dán giá lên bảng trước mặt (cache, nhìn là thấy ngay)

### So sánh tốc độ

| | SQL Server (DB) | Redis (Cache) |
|---|---|---|
| Lưu ở đâu | Ổ cứng (disk) | RAM (bộ nhớ) |
| Tốc độ đọc | ~5-50ms | ~0.1-1ms |
| Nhanh hơn | — | **50-100 lần** |

---

## Dùng Redis cho gì trong CineX?

| Tính năng | Cách dùng |
|---|---|
| **Config cache** | `system_config` đọc từ Redis thay vì query DB mỗi lần |
| **Trạng thái ghế** | Cache ghế đang hold → FE load nhanh |
| **Rate limiting** | Đếm số request/giây → chặn spam |
| **Session** (nếu cần) | Lưu session thay vì DB |

---

## Config trong CineX

```yaml
# application-dev.yml
spring:
  data:
    redis:
      host: ${REDIS_HOST:localhost}
      port: ${REDIS_PORT:6379}
```

```java
// common/config/RedisConfig.java
@Configuration
public class RedisConfig {
    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory factory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(factory);
        template.setKeySerializer(new StringRedisSerializer());         // key = string
        template.setValueSerializer(new GenericJackson2JsonRedisSerializer()); // value = JSON
        return template;
    }
}
```

---

## Cách dùng cơ bản

```java
@Service
@RequiredArgsConstructor
public class CacheService {
    private final RedisTemplate<String, Object> redisTemplate;

    // Lưu vào cache (key-value + hết hạn)
    public void set(String key, Object value, long ttlMinutes) {
        redisTemplate.opsForValue().set(key, value, ttlMinutes, TimeUnit.MINUTES);
    }

    // Đọc từ cache
    public Object get(String key) {
        return redisTemplate.opsForValue().get(key);
    }

    // Xóa cache
    public void delete(String key) {
        redisTemplate.delete(key);
    }
}

// Sử dụng
cacheService.set("config:booking.hold_minutes", 10, 60);  // cache 60 phút
Object value = cacheService.get("config:booking.hold_minutes");  // đọc nhanh
```

---

## Khi nào dùng, khi nào không?

| Dùng Redis | Không cần Redis |
|---|---|
| Data đọc rất thường xuyên | Data ít khi đọc |
| Data ít thay đổi (config, genres) | Data thay đổi liên tục |
| Cần response nhanh (< 10ms) | 50ms OK |
