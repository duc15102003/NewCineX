# Caching Strategy — Caffeine + Redis 2 tầng

> Giải thích pattern caching đa tầng CineX dùng cho performance + scalability.

---

## 1. Tổng quan 2 tầng

```
┌─────────────────────────────────────────────────────────────┐
│ Application code                                            │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ @Cacheable("stats-top-movies")                          │ │
│ │ public List<TopMovie> getTopMovies(...) { ... }         │ │
│ └─────────────────────────────────────────────────────────┘ │
└──────────────────┬──────────────────────────────────────────┘
                   │ check cache
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ L1: Caffeine (in-memory, in-process)                        │
│ - 60s TTL, max 100 entries                                  │
│ - Cực nhanh (~100 ns per get)                               │
│ - KHÔNG share giữa instance (cluster mode)                  │
└──────────────────┬──────────────────────────────────────────┘
                   │ miss → fallback (KHÔNG có ở CineX hiện tại)
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ L2: Redis (distributed, cross-instance)                     │
│ - Sử dụng cho rate-limit + token blacklist                  │
│ - Lettuce client async                                      │
└──────────────────┬──────────────────────────────────────────┘
                   │ miss → query DB
                   ▼
                ┌─────────┐
                │ SQL DB  │
                └─────────┘
```

CineX hiện tại dùng **Caffeine cho data tần suất cao** (statistics, pricing rules) và **Redis cho data cross-instance** (rate-limit, queue). KHÔNG dùng dual-tier L1→L2→DB cho cùng 1 data — đơn giản hơn, dễ maintain.

---

## 2. Caffeine cache (in-process)

### 2.1. Config

```java
@Configuration
@EnableCaching
public class CacheConfig {
    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager manager = new CaffeineCacheManager(
            "stats-overview",
            "stats-revenue",
            "stats-top-movies",
            "stats-top-movie-runs",
            "stats-top-snacks",
            "stats-occupancy"
        );
        manager.setCaffeine(Caffeine.newBuilder()
            .expireAfterWrite(Duration.ofSeconds(60))
            .maximumSize(100)
            .recordStats());
        return manager;
    }
}
```

**Đặc tính:**
- `expireAfterWrite(60s)` — entry expire 60s sau khi WRITE (không reset khi READ)
- `maximumSize(100)` — LRU eviction khi đầy
- `recordStats()` — bật stats cho monitor (hit rate, miss count)

### 2.2. Use case 1: Statistics endpoint cache

```java
@Service
public class StatisticsService {
    @Cacheable(value = "stats-top-movies",
               key = "#limit + '_' + #from + '_' + #to + '_' + #theaterId")
    public List<TopMovie> getTopMovies(int limit, LocalDate from, LocalDate to, Long theaterId) {
        return statisticsRepository.findTopMovies(limit, from, to, theaterId);
    }
}
```

Cache key = combination các param. Mỗi request unique → entry riêng. Dashboard admin trong 1 minute không gọi DB lại.

### 2.3. Use case 2: PricingEngine L2 cache (NESTED INSIDE COMPUTATION)

`PricingEngine` có 2 tầng cache TRONG cùng 1 service:

**L1 (manual snapshot):**
```java
@Service
public class PricingEngine {
    private volatile List<PricingRule> activeRules = new ArrayList<>();

    @Transactional(readOnly = true)
    public void refresh() {
        activeRules = pricingRuleRepository
            .findByActiveTrueAndStorageStateNotOrderByPriorityDescIdAsc(StorageState.ARCHIVED);
    }

    @jakarta.annotation.PostConstruct
    public void init() { refresh(); }

    @Scheduled(fixedRate = 5 * 60 * 1000) // 5 phút
    public void scheduledRefresh() { refresh(); }
}
```

In-memory list. Refresh khi:
- App startup (`@PostConstruct`)
- Admin sửa rule (manual call qua `PricingRuleService`)
- Schedule mỗi 5 phút (cho case rule kích hoạt theo giờ — Happy hour 22:00)

**L2 (Caffeine):**
```java
private final Cache<EffectiveRulesCacheKey, List<PricingRule>> effectiveRulesCache = Caffeine.newBuilder()
    .maximumSize(5000)
    .expireAfterWrite(Duration.ofSeconds(60))
    .build();

private List<PricingRule> resolveEffectiveRules(LocalDateTime showtimeStart, Long theaterId) {
    EffectiveRulesCacheKey key = new EffectiveRulesCacheKey(
        theaterId, showtimeStart.truncatedTo(ChronoUnit.HOURS));
    return effectiveRulesCache.get(key, k -> computeEffectiveRules(showtimeStart, theaterId));
}
```

**Key truncated đến HOUR** vì rule match phụ thuộc giờ-trong-ngày + ngày-trong-tuần, không phụ thuộc phút → 4 showtime 14:00/14:15/14:30/14:45 chung key.

**Performance đo:** list 20 showtime / trang × 2 call (matchingRules + applyModifiers) — trước cache 40N ops/500ms cold; sau cache 1 resolve thật + 19 hit O(1) = 100ms.

### 2.4. Invalidation

`PricingRuleService.updateRule()` gọi:
```java
pricingRule.setActive(true);
pricingRuleRepository.save(pricingRule);
pricingEngine.refresh();  // invalidate L1 + reload từ DB
```

`refresh()` cũng clear Caffeine L2:
```java
public void refresh() {
    activeRules = pricingRuleRepository.findActive();
    effectiveRulesCache.invalidateAll();  // ← clear L2
}
```

---

## 3. Redis (cross-instance, persistent)

### 3.1. Use case 1: Rate limiting

Pattern Redis counter + TTL:

```java
@Service
public class LoginRateLimitService {
    private final StringRedisTemplate redis;

    public void checkBlocked(String username) {
        String key = "login:fail:" + username;
        int attempts = readCounter(key);
        if (attempts >= MAX_ATTEMPTS) throw new BusinessException(...);
    }

    public void recordFail(String username) {
        String key = "login:fail:" + username;
        Long attempts = redis.opsForValue().increment(key);
        if (attempts != null && attempts == 1L) {
            redis.expire(key, Duration.ofMinutes(WINDOW_MINUTES));
        }
    }
}
```

- Key format: `<feature>:<dimension>:<value>` (vd `login:fail:admin`, `tokenverify:ip:192.168.1.1`)
- Counter increment atomic
- TTL set lần đầu — counter tự expire sau window

### 3.2. Use case 2: Session blacklist (logout)

Khi user logout, access token còn 5-10 phút TTL. BE check blacklist mỗi request:

```java
@PostMapping("/logout")
public ApiResponse<Void> logout(HttpServletRequest request) {
    String token = extractToken(request);
    long remainingTtl = jwtUtil.getExpiration(token) - System.currentTimeMillis();
    redis.opsForValue().set("blacklist:" + token, "1", Duration.ofMillis(remainingTtl));
    return ApiResponse.ok();
}
```

JwtAuthFilter check trước khi authenticate:
```java
if (redis.hasKey("blacklist:" + token)) {
    response.setStatus(401);
    return;
}
```

### 3.3. Config

```yaml
spring:
  data:
    redis:
      host: ${REDIS_HOST:localhost}
      port: ${REDIS_PORT:6379}
      timeout: 3000ms
      lettuce:
        pool:
          enabled: true
          max-active: 16
          max-idle: 8
          min-idle: 2
```

**Lettuce** (default) thay vì Jedis — async + non-blocking, scale tốt hơn cho cluster.

---

## 4. HTTP cache (FE-side)

### 4.1. TanStack Query (FE state cache)

```typescript
export function useTopMovies(from: string, to: string, theaterId?: number) {
  return useQuery({
    queryKey: ['admin', 'topMovies', from, to, theaterId ?? 'all'],
    queryFn: async () => {
      const res = await api.get('/api/statistics/top-movies', { params: { from, to, theaterId } })
      return res.data.data
    },
    enabled: !!from && !!to,
  })
}
```

- `queryKey` unique per param combo → React Query dedupe request, cache result
- Default `staleTime=0`, `cacheTime=5min` — refetch khi mount lại tab, GC 5 phút sau
- Invalidate sau mutation: `qc.invalidateQueries({ queryKey: ['admin', 'movies'] })`

### 4.2. Browser HTTP cache (gzip)

`application.yml`:
```yaml
server:
  compression:
    enabled: true
    mime-types: application/json,text/html,text/plain
    min-response-size: 1024
```

Response > 1KB tự gzip → -60-80% bandwidth. Mobile 3G/4G cảm nhận rõ.

---

## 5. Cache invalidation strategy

Common saying: *"There are only two hard things in Computer Science: cache invalidation and naming things."*

CineX 4 chiến lược invalidation:

| Chiến lược | Use case | Ví dụ |
|---|---|---|
| **TTL** | Data đổi theo time, không cần real-time | Statistics 60s, rate-limit window 15-60p |
| **Schedule refresh** | Data đổi theo schedule | PricingEngine 5 phút (Happy hour kích hoạt) |
| **Event-driven** | Data đổi khi user action | `qc.invalidateQueries` sau mutation FE |
| **Manual** | Admin sửa rule/config | `PricingEngine.refresh()` khi `PricingRuleService.updateRule()` |

---

## 6. Anti-pattern tránh

### 6.1. KHÔNG cache đối tượng có @ManyToOne LAZY

```java
@Cacheable("movies")
public Movie getMovie(Long id) {
    return movieRepository.findById(id).orElseThrow();
}
```

Bug: serialize Movie có lazy proxy → fail nếu cache distributed (Redis). Hoặc detach từ Hibernate Session → LazyInitializationException khi access `.getGenres()`.

**Fix:** Cache DTO (eager loaded), không cache entity.

### 6.2. KHÔNG cache list paginate có query động

```java
@Cacheable(value = "movies", key = "#filter + '_' + #pageable")  // SAI
public Page<Movie> list(MovieFilter filter, Pageable pageable) { ... }
```

`MovieFilter` có nhiều field → key combination explosion → cache không hit. Tốt nhất KHÔNG cache list — cache aggregate thì có ý nghĩa hơn.

### 6.3. KHÔNG cache cho mutation method

```java
@Cacheable("bookings")  // SAI nếu vừa cache vừa modify
public Booking createBooking(...) { ... }
```

`@Cacheable` chỉ dùng cho read. Cho write/update → dùng `@CacheEvict` để invalidate.

---

## 7. Monitor cache hit rate

Caffeine `.recordStats()` enable stats. Expose qua Spring Boot Actuator:

```yaml
management:
  endpoints:
    web:
      exposure:
        include: caches,metrics
```

Mở `http://localhost:8088/actuator/caches/stats-top-movies` xem:
```json
{
  "hitCount": 1234,
  "missCount": 56,
  "hitRate": 0.957
}
```

Hit rate < 50% → cache không hiệu quả → review TTL hoặc key strategy.

---

## 8. Tham khảo code

| File | Vai trò |
|---|---|
| `common/config/CacheConfig.java` | CaffeineCacheManager với 6 cache name |
| `module/pricing/service/PricingEngine.java` | 2-tier cache (activeRules + effectiveRulesCache) |
| `module/statistics/service/StatisticsService.java` | `@Cacheable` cho 6 endpoint |
| `module/auth/service/*RateLimitService.java` | Redis counter + TTL pattern |
| `application-dev.yml` | Redis + cache config |
| `frontend/src/hooks/useStatistics.ts` | TanStack Query cache |
