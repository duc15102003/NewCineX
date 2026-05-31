# Observability — Logging, Metrics, Tracing

> Khi production có bug, làm sao biết "ai làm gì, lúc nào, ở đâu"? Observability = khả năng quan sát hệ thống.

## 1. 3 trụ cột

### Logs
- Sự kiện đã xảy ra (text)
- "User vanan login fail 3 lần trong 1 phút"
- Tốt cho: debug từng request, audit

### Metrics
- Số liệu thống kê theo thời gian
- "Số request/giây", "Latency p95", "Error rate"
- Tốt cho: alert, capacity planning

### Tracing
- Đường đi của 1 request qua nhiều service
- "Request /booking đi qua Controller → Service → Repository → DB, mỗi bước hết bao nhiêu ms"
- Tốt cho: tìm bottleneck distributed

## 2. Logging với SLF4J + Logback

### Cấu hình `logback-spring.xml`
```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
    <springProfile name="dev">
        <appender name="CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
            <encoder>
                <pattern>%d{HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n</pattern>
            </encoder>
        </appender>

        <root level="INFO">
            <appender-ref ref="CONSOLE"/>
        </root>
        <logger name="com.cinex" level="DEBUG"/>
        <logger name="org.hibernate.SQL" level="DEBUG"/>
    </springProfile>

    <springProfile name="prod">
        <appender name="FILE" class="ch.qos.logback.core.rolling.RollingFileAppender">
            <file>/var/log/cinex/app.log</file>
            <rollingPolicy class="ch.qos.logback.core.rolling.SizeAndTimeBasedRollingPolicy">
                <fileNamePattern>/var/log/cinex/app.%d{yyyy-MM-dd}.%i.log.gz</fileNamePattern>
                <maxFileSize>100MB</maxFileSize>
                <maxHistory>30</maxHistory>
                <totalSizeCap>3GB</totalSizeCap>
            </rollingPolicy>
            <encoder>
                <pattern>%d{ISO8601} [%X{correlationId}] [%thread] %-5level %logger{36} - %msg%n</pattern>
            </encoder>
        </appender>

        <appender name="JSON" class="ch.qos.logback.core.rolling.RollingFileAppender">
            <file>/var/log/cinex/app.json</file>
            <encoder class="net.logstash.logback.encoder.LogstashEncoder">
                <customFields>{"app":"cinex","env":"prod"}</customFields>
            </encoder>
            <rollingPolicy class="ch.qos.logback.core.rolling.TimeBasedRollingPolicy">
                <fileNamePattern>/var/log/cinex/app.%d{yyyy-MM-dd}.json.gz</fileNamePattern>
                <maxHistory>14</maxHistory>
            </rollingPolicy>
        </appender>

        <root level="WARN">
            <appender-ref ref="FILE"/>
            <appender-ref ref="JSON"/>
        </root>
        <logger name="com.cinex" level="INFO"/>
    </springProfile>
</configuration>
```

JSON format dễ parse cho ELK/Loki.

### Log levels — Khi nào dùng
- **TRACE**: chi tiết debug từng dòng (hiếm dùng)
- **DEBUG**: trace flow trong dev
- **INFO**: sự kiện business quan trọng (`User created`, `Booking confirmed`)
- **WARN**: bất thường nhưng không lỗi (`Cache miss for hot key`, `Slow query 2.5s`)
- **ERROR**: lỗi (`Database timeout`, `Payment failed`)

### Parameterized logging
```java
// SAI — string concat tốn dù LOG level cao
log.debug("User " + username + " logged in from " + ip);
// → string concat chạy KỂ CẢ khi DEBUG tắt

// ĐÚNG — placeholder, lazy
log.debug("User {} logged in from {}", username, ip);
// → chỉ format khi DEBUG bật
```

### Log exception đầy đủ
```java
// SAI
log.error("Error: " + e.getMessage());
// → mất stack trace

// ĐÚNG
log.error("Booking creation failed for user {}", userId, e);
// → có cả message + stack trace
```

## 3. MDC — Correlation ID

### Vấn đề
Production logs có 1000 dòng/phút. Khi user báo bug "vé tôi không tạo được", làm sao tìm log liên quan tới CHỈ request của user đó?

### Giải pháp: Correlation ID
Mỗi request tạo 1 UUID, attach vào MDC (Mapped Diagnostic Context). Mọi log của request đó có UUID này → grep ra dễ dàng.

### Filter setup
```java
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class MdcFilter extends OncePerRequestFilter {

    private static final String CORRELATION_ID = "correlationId";

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String id = req.getHeader("X-Correlation-Id");
        if (id == null || id.isBlank()) {
            id = UUID.randomUUID().toString().substring(0, 8);
        }
        MDC.put(CORRELATION_ID, id);
        res.setHeader("X-Correlation-Id", id);
        try {
            chain.doFilter(req, res);
        } finally {
            MDC.clear();
        }
    }
}
```

### Pattern logback include MDC
```
%d [%X{correlationId}] %-5level %logger - %msg%n
```

Output:
```
2026-05-24 10:00:00 [a3f8b1c2] INFO  BookingService - Creating booking for user 5
2026-05-24 10:00:01 [a3f8b1c2] WARN  PaymentService - Retry MoMo callback (attempt 2)
2026-05-24 10:00:01 [a3f8b1c2] INFO  BookingService - Booking CX-20260524-001 created
```

User báo bug → hỏi correlation ID (FE hiển thị trong error message) → grep:
```bash
grep "a3f8b1c2" /var/log/cinex/app.log
```

### MDC trong async
`@Async` chạy trên thread khác → MDC không tự propagate. Fix:
```java
@Bean
public TaskDecorator mdcTaskDecorator() {
    return runnable -> {
        Map<String, String> ctx = MDC.getCopyOfContextMap();
        return () -> {
            try {
                if (ctx != null) MDC.setContextMap(ctx);
                runnable.run();
            } finally {
                MDC.clear();
            }
        };
    };
}

@Bean
public ThreadPoolTaskExecutor taskExecutor() {
    ThreadPoolTaskExecutor exec = new ThreadPoolTaskExecutor();
    exec.setTaskDecorator(mdcTaskDecorator());
    ...
    return exec;
}
```

## 4. Spring Boot Actuator

### Thêm dependency
```gradle
implementation 'org.springframework.boot:spring-boot-starter-actuator'
```

### Cấu hình
```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,prometheus,loggers
      base-path: /actuator
  endpoint:
    health:
      show-details: when_authorized
      probes:
        enabled: true
  health:
    livenessstate.enabled: true
    readinessstate.enabled: true
  info:
    git.mode: full
    env.enabled: false  # tắt /env vì lộ secret
```

### Endpoints chính
| Endpoint | Mô tả |
|---|---|
| `/actuator/health` | UP/DOWN tổng quát |
| `/actuator/health/liveness` | Container còn sống không (Kubernetes) |
| `/actuator/health/readiness` | App sẵn sàng nhận traffic |
| `/actuator/info` | Version, git commit, build time |
| `/actuator/metrics` | Số liệu JVM, HTTP, DB |
| `/actuator/prometheus` | Format Prometheus scrape |
| `/actuator/loggers` | Change log level runtime |

### Custom Health Indicator
```java
@Component
public class MoMoHealthIndicator implements HealthIndicator {

    private final MoMoClient client;

    @Override
    public Health health() {
        try {
            client.ping();
            return Health.up().withDetail("latency", "120ms").build();
        } catch (Exception e) {
            return Health.down().withException(e).build();
        }
    }
}
```

→ `/actuator/health` báo down nếu MoMo unreachable.

### Bảo vệ Actuator
```yaml
spring:
  security:
    user:
      name: actuator
      password: ${ACTUATOR_PASSWORD}
```

```java
@Configuration
public class ActuatorSecurityConfig {
    @Bean
    @Order(0)
    public SecurityFilterChain actuatorSecurity(HttpSecurity http) throws Exception {
        http.securityMatcher("/actuator/**")
            .authorizeHttpRequests(a -> a
                .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                .anyRequest().hasRole("ADMIN_ACTUATOR")
            )
            .httpBasic(Customizer.withDefaults());
        return http.build();
    }
}
```

## 5. Metrics với Micrometer + Prometheus

### Setup
```gradle
implementation 'io.micrometer:micrometer-registry-prometheus'
```

Micrometer là facade — code 1 lần, switch backend (Prometheus, Datadog, NewRelic, ...) qua config.

### Metric mặc định Spring Boot
- HTTP: request count, latency, status code
- JVM: heap, GC, threads
- DB: connection pool size, active, idle
- Tomcat: thread pool, sessions

### Custom Metric
```java
@Service
@RequiredArgsConstructor
public class BookingService {
    private final MeterRegistry meterRegistry;
    private Counter bookingCounter;
    private Timer bookingTimer;

    @PostConstruct
    public void init() {
        bookingCounter = Counter.builder("cinex.bookings.created")
            .description("Số booking đã tạo")
            .tag("type", "online")
            .register(meterRegistry);

        bookingTimer = Timer.builder("cinex.bookings.duration")
            .description("Thời gian tạo booking")
            .register(meterRegistry);
    }

    public Booking createBooking(BookingRequest req) {
        return bookingTimer.record(() -> {
            Booking booking = doCreateBooking(req);
            bookingCounter.increment();
            return booking;
        });
    }
}
```

### Annotation-based
```java
@Timed(value = "cinex.bookings.duration", description = "...")
public Booking createBooking(...) { ... }
```

### Prometheus scrape
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'cinex'
    metrics_path: '/actuator/prometheus'
    basic_auth:
      username: actuator
      password: ${ACTUATOR_PASSWORD}
    static_configs:
      - targets: ['backend:8088']
    scrape_interval: 30s
```

### Grafana dashboard
Import dashboard ID 11378 (Spring Boot 2.1 Statistics) hoặc tự build với queries:
```
# Request rate
rate(http_server_requests_seconds_count{application="cinex"}[5m])

# Error rate
rate(http_server_requests_seconds_count{application="cinex",status=~"5.."}[5m])

# Latency p95
histogram_quantile(0.95, rate(http_server_requests_seconds_bucket[5m]))

# DB connection pool usage
hikaricp_connections_active / hikaricp_connections_max
```

## 6. Distributed Tracing

### Khi nào cần
Có nhiều service (gateway → auth → booking → payment). Request đi qua N service → tìm bottleneck khó.

### Spring Cloud Sleuth → Micrometer Tracing (Spring Boot 3+)
```gradle
implementation 'io.micrometer:micrometer-tracing-bridge-otel'
implementation 'io.opentelemetry:opentelemetry-exporter-zipkin'
```

### Auto-instrumentation
- HTTP request có header `traceparent`
- DB query có span
- Async call propagate context

### Export sang Jaeger/Zipkin
```yaml
management:
  tracing:
    sampling.probability: 1.0  # 100% (dev) hoặc 0.1 (prod 10%)
  zipkin:
    tracing:
      endpoint: http://jaeger:9411/api/v2/spans
```

### View trace
Jaeger UI: chọn service `cinex`, xem trace của 1 request → thấy waterfall các span (controller, service, DB query) với timing.

## 7. Log aggregation: ELK / Loki

### ELK Stack
- **Elasticsearch**: store + index logs
- **Logstash**: collect + parse
- **Kibana**: search + visualize

### Loki (lightweight alternative)
- Tương tự ELK nhưng nhỏ gọn, index labels thay vì full text
- Tích hợp tốt Grafana

### Setup Promtail → Loki
```yaml
# promtail-config.yml
scrape_configs:
  - job_name: cinex
    static_configs:
      - targets: [localhost]
        labels:
          job: cinex
          __path__: /var/log/cinex/*.json
    pipeline_stages:
      - json:
          expressions:
            level: level
            correlation_id: correlationId
            logger: logger_name
      - labels:
          level:
          correlation_id:
```

Grafana query (LogQL):
```
{job="cinex", level="ERROR"} |~ "Payment"
```

## 8. Alerting

### Prometheus AlertManager
```yaml
groups:
  - name: cinex
    rules:
      - alert: HighErrorRate
        expr: rate(http_server_requests_seconds_count{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "5xx error rate > 10% trong 5 phút"

      - alert: HighLatency
        expr: histogram_quantile(0.95, rate(http_server_requests_seconds_bucket[5m])) > 2
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "p95 latency > 2s"

      - alert: DBPoolExhausted
        expr: hikaricp_connections_active / hikaricp_connections_max > 0.9
        for: 5m
        annotations:
          summary: "DB connection pool > 90%"

      - alert: AppDown
        expr: up{job="cinex"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Backend không response"
```

Notification: Slack, email, PagerDuty.

## 9. Error Tracking với Sentry

```gradle
implementation 'io.sentry:sentry-spring-boot-starter-jakarta:7.14.0'
```

```yaml
sentry:
  dsn: ${SENTRY_DSN}
  environment: prod
  traces-sample-rate: 0.1
  send-default-pii: false  # không gửi user info
```

Sentry tự catch unhandled exception, group by stack trace, alert khi error mới.

## 10. Business metrics — Track KPI

```java
@EventListener
public void onBookingConfirmed(BookingConfirmedEvent event) {
    meterRegistry.counter("cinex.business.bookings.confirmed",
        "method", event.getPaymentMethod()
    ).increment();

    meterRegistry.summary("cinex.business.revenue",
        "method", event.getPaymentMethod()
    ).record(event.getAmount());
}
```

Grafana dashboard cho business:
- Revenue theo giờ
- Bookings theo phim hot
- Conversion rate (HOLDING → CONFIRMED)
- Cancel rate

## 11. Best practices

- **KHÔNG log PII**: password, credit card, full email → mask
- **KHÔNG log payload lớn**: file upload, image data
- **Sampling tracing trong prod**: 100% quá tốn → 10%
- **Log timezone UTC**: server có thể ở múi giờ khác client
- **Log số trang/ID instead of full data**: `user_id=5` thay vì toàn user object
- **Rate limit log error** nếu lặp lại: 1 lỗi 1000 lần/phút làm spam log

## 12. Câu hỏi tự kiểm tra

**Câu 1**: Logs vs Metrics vs Tracing — khi nào dùng cái nào?

→ Logs: debug 1 request cụ thể. Metrics: alert + dashboard tổng quan. Tracing: tìm bottleneck trong distributed system.

**Câu 2**: MDC correlation ID giúp gì?

→ Mỗi request có UUID. Mọi log của request đó có UUID này → grep ra dễ, không lẫn với request khác.

**Câu 3**: Tại sao phải tắt `/actuator/env` ở prod?

→ Endpoint này expose tất cả config + env var, bao gồm DB password, API key. Hacker access được = compromise toàn bộ.

**Câu 4**: Sampling tracing 10% có miss bug không?

→ Có thể miss trace bug hiếm. Trade-off với cost. Production high-traffic: 1-10%. Dev: 100%. Có thể tăng sampling cho endpoint critical.

**Câu 5**: Khi log error, log dạng nào để dễ tìm?

→ Parameterized + exception object:
```java
log.error("Booking failed for user {} showtime {}", userId, showtimeId, e);
```
Có context (userId, showtimeId) + stack trace → debug nhanh.
