# Spring Boot Cơ bản — Từ zero đến hiểu sâu

> Spring Boot là framework backend Java phổ biến nhất thế giới (50%+ market share). Hiểu Spring Boot ở mức "tại sao" — bạn áp dụng được cho mọi project Java production.

---

## 1. Spring vs Spring Boot — phân biệt

| | Spring Framework (2003) | Spring Boot (2014) |
|---|---|---|
| Cấu hình | XML 500+ dòng, tự config bean | `application.yml` 50 dòng, auto-config |
| Server | Tự deploy WAR vào Tomcat external | Embedded Tomcat — chạy `java -jar` |
| Setup | 1-2 ngày setup project mới | 5 phút (start.spring.io) |
| Dependency | Tự pick version cho 50 lib (xung đột nhiều) | Spring Boot BOM unify version |

**Spring Boot = Spring Framework + Convention + Auto-config + Embedded server.**

### Ví dụ đời thường

- **Spring Framework:** mua đất + tự thiết kế nhà + tự thuê thợ + tự đặt vật liệu
- **Spring Boot:** mua căn hộ chung cư — vào ở ngay, đã có điện nước nội thất

---

## 2. Inversion of Control (IoC) — concept FOUNDATIONAL

### Định nghĩa
Bạn KHÔNG tự tạo object dependency — Spring (IoC container) tạo và inject cho bạn.

### Không có IoC (traditional)

```java
public class OrderService {
    private OrderRepository repo = new OrderRepository();      // tự tạo
    private EmailService email = new EmailService();           // tự tạo
    private PaymentService payment = new PaymentService();     // tự tạo

    public void placeOrder(Order o) {
        repo.save(o);
        email.notify(o);
        payment.charge(o);
    }
}
```

Vấn đề:
- Test khó (làm sao mock `repo` đã `new` cứng?)
- Đổi implementation phải sửa import + sửa class
- Tight coupling — `OrderService` phụ thuộc concrete class

### Có IoC (Spring)

```java
@Service
@RequiredArgsConstructor
public class OrderService {
    private final OrderRepository repo;        // Spring inject
    private final EmailService email;
    private final PaymentService payment;

    public void placeOrder(Order o) {
        repo.save(o);
        email.notify(o);
        payment.charge(o);
    }
}
```

Spring tự `new` các dependency, inject qua constructor. Code:
- Test dễ — mock dependency, tạo `new OrderService(mockRepo, mockEmail, mockPayment)`
- Đổi implementation → đổi `@Component` khác, không sửa `OrderService`

### IoC Container — bộ não Spring

```
@SpringBootApplication
class Application {
  main() {
    ApplicationContext ctx = SpringApplication.run(Application.class, args);
    // ctx là IoC container — chứa mọi bean
  }
}
```

**Bean** = object Spring quản lý. Spring scan code, tìm class có annotation (`@Component`, `@Service`, ...) → tạo instance → đưa vào container → inject khi cần.

---

## 3. Stereotype Annotations — phân loại bean

### Sơ đồ phân cấp

```
@Component (general)
   ├── @Service       (business logic)
   ├── @Repository    (data access — extra: exception translation)
   ├── @Controller    (MVC controller)
   │      └── @RestController = @Controller + @ResponseBody
   └── @Configuration (bean definitions)
```

| Annotation | Mục đích | Đặc tính riêng |
|---|---|---|
| `@Component` | General bean | Không có gì đặc biệt |
| `@Service` | Business logic | Convention — đọc code biết là business |
| `@Repository` | Data access | Spring auto-translate SQL exception → DataAccessException |
| `@Controller` | MVC return view name | Trả view name (.html) |
| `@RestController` | REST API | Trả JSON/XML (auto-wrap @ResponseBody) |
| `@Configuration` | Class chứa `@Bean` method | Spring biết đây là class config |

### Code example mỗi loại

```java
@Service
public class BookingService {                  // business logic
    public Booking create(BookingRequest r) { ... }
}

@Repository
public interface BookingRepository extends JpaRepository<Booking, Long> {
    Optional<Booking> findByCode(String code); // auto-implement
}

@RestController
@RequestMapping("/api/bookings")
public class BookingController {
    private final BookingService service;

    @PostMapping
    public ApiResponse<Booking> create(@Valid @RequestBody BookingRequest r) {
        return ApiResponse.ok(service.create(r));
    }
}

@Configuration
public class SecurityConfig {
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
```

---

## 4. Dependency Injection — 3 cách

### 4.1. Constructor injection (RECOMMENDED)

```java
@Service
public class BookingService {
    private final BookingRepository repo;       // final = immutable

    public BookingService(BookingRepository repo) {
        this.repo = repo;
    }
}

// Lombok rút gọn:
@Service
@RequiredArgsConstructor
public class BookingService {
    private final BookingRepository repo;
}
```

**Pros:**
- Immutable (final field)
- Required dependency tường minh (compile fail nếu thiếu)
- Test dễ (chỉ cần `new BookingService(mockRepo)`)
- Không gây circular dependency lúc compile

### 4.2. Field injection (AVOID)

```java
@Service
public class BookingService {
    @Autowired private BookingRepository repo;  // ← KHÔNG nên
}
```

**Cons:**
- Khó test (cần `ReflectionTestUtils`)
- Có thể `null` nếu Spring chưa inject xong
- Hide dependency (đọc constructor không biết phụ thuộc gì)

### 4.3. Setter injection (HIẾM dùng)

```java
@Service
public class BookingService {
    private BookingRepository repo;

    @Autowired
    public void setRepo(BookingRepository repo) { this.repo = repo; }
}
```

Chỉ dùng cho optional dependency hoặc circular dependency.

---

## 5. Bean Scope — lifecycle của bean

### 5 scope chính

| Scope | Mô tả | Khi dùng |
|---|---|---|
| `singleton` (default) | 1 instance toàn app | Stateless service |
| `prototype` | Mỗi inject → instance mới | Stateful object |
| `request` | 1 instance / HTTP request | Request-scoped data |
| `session` | 1 instance / HTTP session | Session-scoped data |
| `application` | 1 instance / ServletContext | Global app data |

```java
@Service
@Scope("singleton")  // default, không cần khai
public class BookingService { ... }

@Component
@Scope("prototype")
public class ShoppingCart { ... }  // mỗi user 1 cart riêng

@Component
@Scope(value = "request", proxyMode = ScopedProxyMode.TARGET_CLASS)
public class RequestContext { ... }  // chứa data riêng từng request
```

### Gotcha — Inject prototype vào singleton

```java
@Service  // singleton
public class BookingService {
    @Autowired private ShoppingCart cart;  // prototype
}
```

Vấn đề: Spring inject `cart` 1 LẦN khi tạo `BookingService` → mọi request dùng chung cart (không phải prototype như ý).

**Fix:** dùng `@Scope(proxyMode)` hoặc inject `ObjectProvider<ShoppingCart>`.

---

## 6. Bean Lifecycle — vòng đời bean

```
1. Spring đọc cấu hình + scan @Component
2. Instantiate (new instance)
3. Populate properties (inject dependency)
4. @PostConstruct method called
5. Bean READY for use
   ...
6. Spring shutdown:
7. @PreDestroy method called
8. Bean destroyed
```

```java
@Service
public class CacheService {
    @PostConstruct
    public void init() {
        log.info("CacheService initialized");
        // load data, connect external
    }

    @PreDestroy
    public void cleanup() {
        log.info("CacheService shutting down");
        // close connection
    }
}
```

### Anti-pattern — gọi method ở constructor

```java
@Service
public class CacheService {
    @Autowired private SomeOtherService other;

    public CacheService() {
        other.doSomething();  // ← NPE! other chưa inject
    }
}
```

**Fix:** Move logic sang `@PostConstruct` — chạy SAU khi inject xong.

---

## 7. `@Autowired` — qualifier cho ambiguity

Khi 1 interface có nhiều implementation → Spring không biết inject cái nào.

```java
public interface NotificationSender {
    void send(String to, String body);
}

@Component public class EmailSender implements NotificationSender { ... }
@Component public class SmsSender implements NotificationSender { ... }

@Service
public class NotificationService {
    @Autowired NotificationSender sender;  // ← ERROR: 2 candidates
}
```

### Fix 1: `@Qualifier`

```java
@Autowired
@Qualifier("emailSender")  // tên bean = lowercase first letter của class
NotificationSender sender;
```

### Fix 2: `@Primary`

```java
@Component
@Primary  // ← prefer cái này
public class EmailSender implements NotificationSender { ... }
```

### Fix 3: Inject `List<T>` để lấy tất

```java
@Service @RequiredArgsConstructor
public class NotificationService {
    private final List<NotificationSender> senders;  // Spring inject ALL

    public void sendAll(String to, String body) {
        senders.forEach(s -> s.send(to, body));
    }
}
```

Pattern này CineX dùng cho `PaymentProcessor` — inject `List<PaymentProcessor>` để pick đúng strategy.

---

## 8. `@Configuration` + `@Bean` — manual bean

Khi không thể annotate `@Component` (vd class từ 3rd party lib):

```java
@Configuration
public class AppConfig {

    @Bean
    public RestTemplate restTemplate() {
        return new RestTemplateBuilder()
            .setConnectTimeout(Duration.ofSeconds(5))
            .setReadTimeout(Duration.ofSeconds(10))
            .build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);  // strength 12
    }

    @Bean
    public Cloudinary cloudinary(
            @Value("${cloudinary.cloud-name}") String cloudName,
            @Value("${cloudinary.api-key}") String apiKey,
            @Value("${cloudinary.api-secret}") String apiSecret) {
        return new Cloudinary(ObjectUtils.asMap(
            "cloud_name", cloudName,
            "api_key", apiKey,
            "api_secret", apiSecret
        ));
    }
}
```

Spring tự gọi method `passwordEncoder()` → register return value as bean → inject vào nơi cần.

### `@Configuration` vs `@Component`

`@Configuration` cũng là `@Component` đặc biệt. Khác:
- `@Configuration` enable **CGLIB proxy** → method calls inside class trả về SAME bean instance
- `@Component` method calls trả về NEW instance mỗi lần

```java
@Configuration
public class AppConfig {
    @Bean public A a() { return new A(b()); }
    @Bean public B b() { return new B(); }  // a().b() và b() trả CÙNG instance
}
```

---

## 9. Profile — environment-specific config

### Khai profile

```yaml
# application.yml — chung mọi env
spring:
  application:
    name: cinex

# application-dev.yml — chỉ dev
spring:
  jpa:
    show-sql: true
logging:
  level:
    root: DEBUG

# application-prod.yml — chỉ prod
spring:
  jpa:
    show-sql: false
logging:
  level:
    root: INFO
```

### Active profile

```bash
# Cách 1: command line
java -jar app.jar --spring.profiles.active=prod

# Cách 2: env var
SPRING_PROFILES_ACTIVE=prod java -jar app.jar

# Cách 3: application.yml (default)
spring:
  profiles:
    active: dev
```

### `@Profile` cho bean

```java
@Component
@Profile("dev")
public class MockEmailService implements EmailService {
    public void send(...) { log.info("MOCK: sent to {}", to); }
}

@Component
@Profile("prod")
public class SmtpEmailService implements EmailService {
    public void send(...) { /* real SMTP */ }
}
```

Dev chạy `MockEmailService`, prod chạy `SmtpEmailService`.

### Trong CineX
- `application-dev.yml` — dev defaults (sandbox keys, debug log)
- `application-prod.yml` — production (env vars required)
- `application-local.yml` — per-developer secrets (Mailtrap personal, gitignored)

---

## 10. `@Value` + `@ConfigurationProperties` — đọc config

### `@Value` — đơn lẻ

```java
@Service
public class JwtUtil {
    @Value("${app.jwt.secret}") private String secret;
    @Value("${app.jwt.expiration:3600000}") private long expiration;  // default 1h
}
```

### `@ConfigurationProperties` — group nhiều property

```java
@Configuration
@ConfigurationProperties(prefix = "app.jwt")
@Getter @Setter
public class JwtProperties {
    private String secret;
    private long expiration;
    private long refreshExpiration;
    private String issuer;
}
```

`application.yml`:
```yaml
app:
  jwt:
    secret: ${JWT_SECRET}
    expiration: 900000      # 15 min access token
    refresh-expiration: 604800000  # 7 day refresh
    issuer: cinex
```

**Pros của `@ConfigurationProperties`:**
- Type-safe (compile error nếu sai)
- Bean validation (`@NotBlank`, `@Min`)
- Auto-completion trong IDE
- Test dễ (mock properties bean)

---

## 11. Conditional Beans — context-aware bean

### `@ConditionalOnProperty`

```java
@Configuration
public class CacheConfig {
    @Bean
    @ConditionalOnProperty(name = "app.cache.enabled", havingValue = "true")
    public CacheManager cacheManager() { ... }
}
```

Bean tạo CHỈ khi `app.cache.enabled=true`.

### `@ConditionalOnMissingBean`

```java
@Bean
@ConditionalOnMissingBean
public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder();
}
```

Tạo bean default CHỈ khi user chưa khai bean khác type.

### `@ConditionalOnClass` / `@ConditionalOnMissingClass`

```java
@Bean
@ConditionalOnClass(name = "com.redis.Redisson")
public RedissonClient redisson() { ... }
```

Tạo bean CHỈ khi class Redisson có trong classpath. Spring Boot auto-config dùng pattern này nặng — "nếu có lib X thì tự config".

---

## 12. `@SpringBootApplication` — magic annotation

```java
@SpringBootApplication
public class CinexApplication {
    public static void main(String[] args) {
        SpringApplication.run(CinexApplication.class, args);
    }
}
```

`@SpringBootApplication` = combo của 3:

```java
@SpringBootConfiguration  // = @Configuration
@EnableAutoConfiguration  // auto-config từ classpath
@ComponentScan            // scan package hiện tại + subpackage
public @interface SpringBootApplication { ... }
```

### `@EnableAutoConfiguration` chính là phép màu

Spring Boot scan `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` — mỗi lib (Web/JPA/Security/Redis/Mail) đăng ký 1 class auto-config.

Vd có `spring-boot-starter-web` → tự load:
- `DispatcherServletAutoConfiguration` → set up DispatcherServlet
- `EmbeddedTomcatAutoConfiguration` → start Tomcat
- `JacksonAutoConfiguration` → JSON converter

Bạn KHÔNG cần config gì — Spring đoán dựa vào classpath.

### Disable auto-config

```java
@SpringBootApplication(exclude = {
    DataSourceAutoConfiguration.class  // tắt nếu không cần DB
})
```

---

## 13. Properties resolution order

Spring tìm property theo thứ tự ưu tiên (cao → thấp):

1. Command line args (`--app.jwt.secret=xxx`)
2. Java system props (`-Dapp.jwt.secret=xxx`)
3. Environment vars (`APP_JWT_SECRET=xxx`)
4. `application-{profile}.yml` (profile active)
5. `application.yml`
6. `@PropertySource` annotation
7. Default values in `@Value`

Production: dùng env var để tránh leak secrets vào git.

### Convention env var

Spring tự convert:
- `APP_JWT_SECRET` → `app.jwt.secret`
- `SPRING_DATASOURCE_URL` → `spring.datasource.url`

Underscore → dot, uppercase → lowercase.

---

## 14. CineX — Spring Boot config thực tế

`backend/src/main/resources/application.yml`:
```yaml
spring:
  application:
    name: cinex
  profiles:
    active: ${SPRING_PROFILES_ACTIVE:dev}
  datasource:
    url: ${DB_URL}
    username: ${DB_USER}
    password: ${DB_PASSWORD}
    driver-class-name: com.microsoft.sqlserver.jdbc.SQLServerDriver
  jpa:
    hibernate:
      ddl-auto: validate  # KHÔNG cho Hibernate auto-DDL (Liquibase quản)
    show-sql: false
    properties:
      hibernate:
        format_sql: true
        dialect: org.hibernate.dialect.SQLServerDialect
  liquibase:
    change-log: classpath:db/changelog/db.changelog-master.xml

app:
  jwt:
    secret: ${JWT_SECRET}
    expiration: 900000
    refresh-expiration: 604800000
  cors:
    allowed-origins: ${FRONTEND_ORIGINS:http://localhost:5173}
```

---

## 15. Anti-pattern tránh

### 15.1. `@Autowired` qua field

```java
@Autowired private UserRepository repo;  // ← SAI
```

Dùng constructor injection. Lý do: xem mục 4.1.

### 15.2. Inject `@Service` vào `@Entity`

```java
@Entity
public class User {
    @Autowired private NotificationService notification;  // ← SAI
}
```

Entity là data, không phải bean Spring. Logic về user nên ở `UserService`.

### 15.3. `@SpringBootApplication` ở subpackage

```
com.cinex
├── module/
│   └── booking/
└── App.java  ← phải ở ROOT package
```

`@ComponentScan` mặc định scan package hiện tại + subpackage. Nếu `App.java` đặt sâu trong subpackage → bỏ sót classes ở package khác.

### 15.4. Inject prototype vào singleton (xem mục 5)

### 15.5. Quên `@Transactional`

```java
@Service
public class BookingService {
    public Booking createBooking(...) {  // ← KHÔNG @Transactional
        bookingRepo.save(...);
        seatHoldRepo.saveAll(...);  // ← nếu fail, save trước KHÔNG rollback!
    }
}
```

**Fix:** `@Transactional` cho mọi method ghi DB nhiều bước.

### 15.6. `@Transactional` ở `private` method

```java
@Service
public class BookingService {
    public void publicMethod() { privateMethod(); }

    @Transactional  // ← KHÔNG hiệu lực!
    private void privateMethod() { ... }
}
```

Spring AOP proxy chỉ wrap public method. Self-invocation (`this.privateMethod()`) bypass proxy → annotation bị ignore.

---

## 16. Câu hỏi tự kiểm tra

1. **Spring Boot khác Spring Framework chỗ nào?**
   → Spring Boot tự config + embedded server. Spring Framework để dev tự config.

2. **Constructor injection > field injection — tại sao?**
   → Immutable, required tường minh, test dễ, không bị NPE late.

3. **Bean scope `singleton` default — vì sao?**
   → Service thường stateless → 1 instance dùng chung tiết kiệm memory.

4. **`@Component` vs `@Configuration` khác gì?**
   → `@Configuration` có CGLIB proxy → method call trả same instance. `@Component` thì không.

5. **Tại sao cần Profile?**
   → Tách config dev/prod/test. Dev có debug log, prod tắt log + dùng env vars.

6. **`@Value` vs `@ConfigurationProperties` — chọn cái nào?**
   → 1-2 property: `@Value`. Nhiều property liên quan: `@ConfigurationProperties` (type-safe).

7. **`@ConditionalOnProperty` để làm gì?**
   → Bean chỉ tạo nếu property thỏa điều kiện. Spring Boot auto-config dùng pattern này nặng.

8. **Properties resolution order quan trọng vì sao?**
   → Production: env vars override file → secret không leak vào git. Test: command line override → dễ test variation.

9. **`@SpringBootApplication` magic — tự config có hại không?**
   → Có thể "magic too much" — khó debug nếu auto-config sai. Exclude specific auto-config khi cần.

10. **Inject `List<T>` để làm gì?**
    → Lấy mọi bean implement T → Strategy pattern (vd `List<PaymentProcessor>`).
