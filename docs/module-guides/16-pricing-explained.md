# Module 16 — Pricing (Rule Engine giá vé)

> Module hạt nhân quyết định **giá vé cuối cùng** trên mỗi booking. CineX bỏ cách hard-code "weekend × 1.1" trong code mà chuyển sang **rule engine data-driven** — admin tự cấu hình tất cả qua UI, không cần deploy lại.

---

## 1. Tổng quan

### 1.1. Bài toán định giá vé tại rạp chiếu phim Việt Nam

Hãy thử quan sát giá vé thực tế ở **CGV, Lotte, BHD** trong 1 tuần — bạn sẽ thấy giá **không cố định**. Ví dụ:

| Khung giờ / Ngày | Giá ghế Standard |
|---|---|
| Sáng thứ 2 (07:00) | 75.000đ |
| Tối thứ 4 (20:00) | 95.000đ |
| Sáng thứ 7 (10:00) | 95.000đ |
| Tối thứ 7 (21:00) | 115.000đ |
| Tết Nguyên Đán | 130.000đ |

Cùng 1 ghế, **giá dao động 75k → 130k** (gấp 1.7 lần) tùy thời điểm. Lý do:

- **Demand-based pricing** — giờ đông khách (peak) thì giá cao, giờ vắng (off-peak) giảm giá để lấp đầy phòng
- **Weekend surcharge** — thứ 7 & CN đông gấp 3 ngày thường → tăng giá
- **Holiday surcharge** — Tết, 2/9, Noel → khán giả sẵn sàng trả thêm
- **Morning discount** — suất sáng 06:00-12:00 thường trống → giảm 20% kích cầu

### 1.2. Cách làm CŨ của CineX — Hard-code

Phiên bản đầu tiên của CineX tính giá rất đơn giản:

```java
// CŨ: hard-code trong BookingService
BigDecimal price = switch (seatType) {
    case VIP -> showtime.getVipPrice();
    case COUPLE -> showtime.getCouplePrice();
    default -> showtime.getBasePrice();
};
return price; // KHÔNG có modifier theo thời gian
```

Vấn đề:

1. Mọi suất chiếu — sáng, trưa, tối, weekday, weekend — **cùng 1 giá**
2. Muốn tăng giá weekend → sửa code, deploy lại
3. Muốn thêm "Tết +30%" tạm thời 1 tuần → sửa code, deploy, sau Tết deploy lần nữa rollback
4. Admin (nghiệp vụ) **không thể tự điều chỉnh** — phải nhờ developer

### 1.3. Cách làm MỚI — Rule Engine data-driven

CineX 2.0 chuyển sang mô hình:

```
BookingService -> PricingEngine.applyModifiers(basePrice, showtimeStart)
                       |
                       v
              [Load rules từ DB cache]
                       |
                       v
              Iterate active rules:
                if PricingRuleMatcher.matches(rule, time):
                   total = total * (rule.multiplierPercent / 100)
                       |
                       v
              return total (làm tròn VNĐ)
```

Toàn bộ logic giá nằm trong bảng `pricing_rules` — admin tạo/sửa/xóa qua UI, **không cần deploy code**.

### 1.4. Seed 3 rule mặc định khi setup database

Liquibase changeset `055` tự insert 3 rule chuẩn rạp:

| Code | Loại | Multiplier | Ý nghĩa |
|---|---|---|---|
| `WEEKEND` | DAY_OF_WEEK (T7, CN) | 110% | Phụ thu cuối tuần +10% |
| `PRIME-TIME` | HOUR_RANGE (18-22) | 115% | Giờ vàng tối +15% |
| `MORNING-DISCOUNT` | HOUR_RANGE (6-12) | 80% | Giảm giá sáng −20% |

Ví dụ suất tối thứ 7 (20:00) — cả 2 rule WEEKEND và PRIME-TIME đều khớp:

```
basePrice = 100.000đ
  -> WEEKEND:     100.000 × 1.10 = 110.000đ
  -> PRIME-TIME:  110.000 × 1.15 = 126.500đ
finalPrice = 126.500đ (đã làm tròn HALF_UP về VNĐ)
```

---

## 2. Danh sách files đã tạo

| File | Tác dụng | Pattern áp dụng |
|---|---|---|
| `entity/PricingRule.java` | Entity bảng `pricing_rules` — 1 row = 1 rule | BaseEntity inheritance, Builder |
| `entity/PricingRuleType.java` | Enum 4 loại điều kiện (DAY_OF_WEEK/HOUR_RANGE/DATE_RANGE/COMPOSITE) | Enum type-safety |
| `strategy/PricingRuleMatcher.java` | Logic kiểm tra 1 rule có khớp `LocalDateTime` không | Strategy (function table) + utility class |
| `service/PricingEngine.java` | Cache rule + apply multiplier chuỗi vào basePrice | Composite + Cache-aside |
| `service/PricingRuleService.java` | CRUD admin + gọi `engine.refresh()` mỗi mutation | Service + cache invalidation |
| `controller/PricingRuleController.java` | REST endpoints `/api/pricing-rules` (ADMIN only) | REST + Method Security |
| `repository/PricingRuleRepository.java` | JPA repo + custom `findByActiveTrueAndStorageStateNot...` | Repository |
| `dto/PricingRuleRequest.java`, `PricingRuleResponse.java` | DTO input/output | DTO |
| `mapper/PricingRuleMapper.java` | MapStruct entity ↔ DTO | Mapper |
| `db/changelog/changes/055-create-pricing-rules-table.xml` | DDL + seed 3 rule mặc định | Liquibase migration |
| `backend/.../booking/service/BookingService.java` (line 482-489) | Đã refactor: gọi `pricingEngine.applyModifiers()` cho mỗi ghế | Snapshot pattern |
| `frontend/.../AdminPricingPage.tsx` | UI CRUD pricing rule + day chip picker | React form |
| `frontend/.../hooks/useAdminPricingRules.ts` | Hooks query/mutation cho rule | React Query |

---

## 3. Schema `pricing_rules` — Chi tiết 14 cột

Xem nguyên file Liquibase: `055-create-pricing-rules-table.xml`.

```sql
CREATE TABLE pricing_rules (
    id                 BIGINT IDENTITY PRIMARY KEY,
    version            BIGINT       DEFAULT 0,        -- Optimistic locking
    storage_state      NVARCHAR(20),                  -- ACTIVE / ARCHIVED (soft delete)
    created_by         NVARCHAR(50),
    updated_by         NVARCHAR(50),
    created_at         DATETIME2,
    updated_at         DATETIME2,

    code               NVARCHAR(50)  NOT NULL UNIQUE, -- "WEEKEND", "TET-2026"
    name               NVARCHAR(200) NOT NULL,
    description        NVARCHAR(500),
    rule_type          NVARCHAR(30)  NOT NULL,        -- DAY_OF_WEEK / HOUR_RANGE / DATE_RANGE / COMPOSITE
    multiplier_percent DECIMAL(6,2)  NOT NULL,        -- 110.00 = +10%; 80.00 = -20%
    day_of_week        NVARCHAR(100),                 -- CSV "SATURDAY,SUNDAY"
    hour_start         INT,                           -- 18 (closed)
    hour_end           INT,                           -- 22 (open)
    date_start         DATE,                          -- 2026-02-10
    date_end           DATE,                          -- 2026-02-15
    active             BIT  DEFAULT 1  NOT NULL,
    priority           INT  DEFAULT 100 NOT NULL
);
CREATE INDEX idx_pricing_rules_active ON pricing_rules(active);
```

### 3.1. Mục đích từng cột

| Cột | Vì sao có |
|---|---|
| `code` | Mã ngắn dễ nhớ — phân biệt rule trong log, audit. UNIQUE để admin không trùng |
| `name` | Tên hiển thị bảng admin — tiếng Việt có dấu |
| `description` | Mô tả hiển thị cho user (vd "Phụ thu cuối tuần") khi FE show breakdown |
| `rule_type` | Quyết định **cột điều kiện nào được active** (xem mục 3.2) |
| `multiplier_percent` | Nhân tử %: 100 = giữ nguyên, 110 = +10%, 80 = -20% |
| `day_of_week` | CSV (vd `"SATURDAY,SUNDAY"`) — DAY_OF_WEEK & COMPOSITE dùng |
| `hour_start`, `hour_end` | Khung giờ [start, end) — HOUR_RANGE & COMPOSITE dùng |
| `date_start`, `date_end` | Khoảng ngày [start, end] — DATE_RANGE & COMPOSITE dùng |
| `active` | Toggle on/off **không xóa rule** (vẫn giữ lịch sử). Khi false → engine không load |
| `priority` | Sort khi load. Hiện tại nhân chuỗi không phụ thuộc order, nhưng vẫn lưu để mở rộng sau |
| `version`, `storage_state`, audit | BaseEntity chuẩn của CineX |

### 3.2. `rule_type` quyết định cột nào active

Mỗi rule chỉ dùng MỘT tập cột tương ứng với loại:

```
DAY_OF_WEEK  -> day_of_week                      (NULL hour, NULL date)
HOUR_RANGE   -> hour_start, hour_end             (NULL day, NULL date)
DATE_RANGE   -> date_start, date_end             (NULL day, NULL hour)
COMPOSITE    -> >= 2 tập cột                     (AND tất cả)
```

`PricingRuleService.validateRuleTypeFields()` fail-fast nếu admin gửi field sai loại — VD `rule_type=DAY_OF_WEEK` mà thiếu `day_of_week` → trả 400.

### 3.3. Vì sao `multiplier_percent DECIMAL(6,2)`?

- **Precision = 6, Scale = 2** → tối đa 6 chữ số, trong đó 2 chữ số sau dấu phẩy
- Phạm vi: `0000.00` → `9999.99` → đủ cho mọi rule (kể cả flash sale `0.00` = miễn phí, hay `999.99` = ×10 — tuy không thực tế)
- KHÔNG dùng `FLOAT`/`DOUBLE` vì **floating-point sai lệch**: `0.1 + 0.2 = 0.30000000000000004` — tiền bạc phải chính xác tuyệt đối
- Java map sang `BigDecimal` — operator `.multiply()`, `.divide(scale, RoundingMode)` luôn deterministic

### 3.4. Seed 3 rule mặc định (changeset `055-seed-default-pricing-rules`)

```sql
INSERT INTO pricing_rules (...) VALUES
('WEEKEND',          N'Phụ thu cuối tuần',
 'DAY_OF_WEEK', 110.00, 'SATURDAY,SUNDAY', NULL,NULL,NULL,NULL, 1, 100, ...),

('PRIME-TIME',       N'Khung giờ vàng',
 'HOUR_RANGE',  115.00, NULL, 18, 22, NULL,NULL, 1, 100, ...),

('MORNING-DISCOUNT', N'Giảm giá sáng sớm',
 'HOUR_RANGE',   80.00, NULL,  6, 12, NULL,NULL, 1,  90, ...);
```

→ Setup mới đã có sẵn 3 rule chạy được ngay, không cần admin config thủ công.

---

## 4. Strategy Pattern — `PricingRuleMatcher`

### 4.1. Strategy là gì? Ví dụ đời thường

Tưởng tượng bạn vào siêu thị, đến quầy thanh toán. Có **nhiều cách trả tiền**:

- Tiền mặt
- Thẻ ATM
- Quẹt thẻ tín dụng
- Quét QR Momo
- Quét QR ZaloPay

Nhân viên thu ngân **không cần biết chi tiết** mỗi cách hoạt động ra sao. Họ chỉ cần:

1. Hỏi: "Anh trả bằng gì?"
2. Gọi đúng máy/quy trình ứng với câu trả lời
3. Nhận kết quả "thành công / thất bại"

→ Đó là **Strategy Pattern**: định nghĩa **một interface chung** ("cách trả tiền"), nhiều implementation (tiền mặt, thẻ, QR), và **runtime chọn cái nào** dựa vào input.

Trong CineX Pricing: thay vì mỗi rule type bằng cách trả tiền, ta có **4 cách kiểm tra điều kiện**:

- `DAY_OF_WEEK` → check thứ
- `HOUR_RANGE` → check giờ
- `DATE_RANGE` → check khoảng ngày
- `COMPOSITE` → check tất cả

### 4.2. Triển khai: class final + static methods (function table)

Có 2 cách triển khai Strategy phổ biến:

**Cách A — Mỗi strategy = 1 class** (kinh điển):

```java
interface RuleMatcher {
    boolean matches(PricingRule rule, LocalDateTime t);
}
class DayOfWeekMatcher implements RuleMatcher { ... }
class HourRangeMatcher implements RuleMatcher { ... }
class DateRangeMatcher implements RuleMatcher { ... }
class CompositeMatcher implements RuleMatcher { ... }
// + 1 Factory hoặc Map<PricingRuleType, RuleMatcher> để chọn
```

**Cách B — Function table trong 1 class** (CineX dùng):

```java
public final class PricingRuleMatcher {
    private PricingRuleMatcher() {}            // không cho new
    public static boolean matches(PricingRule rule, LocalDateTime t) {
        switch (rule.getRuleType()) {
            case DAY_OF_WEEK:  return matchesDayOfWeek(rule, t);
            case HOUR_RANGE:   return matchesHourRange(rule, t);
            case DATE_RANGE:   return matchesDateRange(rule, t);
            case COMPOSITE:    return matchesComposite(rule, t);
            default: return false;
        }
    }
    private static boolean matchesDayOfWeek(...) { ... }
    private static boolean matchesHourRange(...) { ... }
    // ...
}
```

**Vì sao CineX chọn cách B?**

| Tiêu chí | Cách A (class-per-strategy) | Cách B (function table) |
|---|---|---|
| Số strategies | Nhiều (10+) hoặc động | Ít, cố định (≤ 5) |
| State riêng từng strategy | Có | Không |
| Cần Dependency Injection? | Có (Spring autowire) | Không |
| Số file phải đọc | 5-6 file | 1 file |
| Mở rộng (Open/Closed) | Rất tốt — thêm class không sửa code cũ | Vẫn tốt — thêm case vào switch |

Với CineX chỉ có **4 type cố định** và không cần DI → cách B đơn giản hơn nhiều. Nếu sau này có 20+ rule type động → migrate sang cách A.

### 4.3. Code snippet — `matches()` entry point

File `PricingRuleMatcher.java:38-53`:

```java
public static boolean matches(PricingRule rule, LocalDateTime showtimeStart) {
    if (rule.getRuleType() == null) return false;

    switch (rule.getRuleType()) {
        case DAY_OF_WEEK: return matchesDayOfWeek(rule, showtimeStart);
        case HOUR_RANGE:  return matchesHourRange(rule, showtimeStart);
        case DATE_RANGE:  return matchesDateRange(rule, showtimeStart);
        case COMPOSITE:   return matchesComposite(rule, showtimeStart);
        default: return false;
    }
}
```

### 4.4. `DAY_OF_WEEK` — Parse CSV tolerant

File `PricingRuleMatcher.java:55-59` + `99-109`:

```java
private static boolean matchesDayOfWeek(PricingRule rule, LocalDateTime t) {
    if (rule.getDayOfWeek() == null || rule.getDayOfWeek().isBlank()) return false;
    Set<DayOfWeek> days = parseDays(rule.getDayOfWeek());
    return days.contains(t.getDayOfWeek());
}

private static Set<DayOfWeek> parseDays(String csv) {
    return java.util.Arrays.stream(csv.split(","))
            .map(String::trim)                                // tolerant: " SATURDAY " -> "SATURDAY"
            .filter(s -> !s.isEmpty())                        // tolerant: ",," -> bỏ
            .map(s -> {
                try { return DayOfWeek.valueOf(s.toUpperCase()); }
                catch (IllegalArgumentException e) { return null; }  // "SATURDAYS" sai chính tả -> null
            })
            .filter(java.util.Objects::nonNull)
            .collect(Collectors.toSet());
}
```

→ Admin nhập `"saturday , Sunday "` (lung tung khoảng trắng & viết hoa) vẫn parse được. Token sai (`"FUNDAY"`) bị bỏ qua thay vì throw exception — **defensive parsing** để không crash booking.

### 4.5. `HOUR_RANGE` — Khoảng `[hourStart, hourEnd)` closed-open

```java
private static boolean matchesHourRange(PricingRule rule, LocalDateTime t) {
    if (rule.getHourStart() == null || rule.getHourEnd() == null) return false;
    int h = t.getHour();
    return h >= rule.getHourStart() && h < rule.getHourEnd();
}
```

**Vì sao closed-open `[18, 22)`?**

Để khớp với chuẩn lập trình (Python `range`, Java `IntStream.range`) — chiếu vào khung giờ thực tế:

- Rule `18-22` áp dụng cho các suất 18:00, 19:00, 20:00, 21:00 (4 giờ)
- Suất 22:00 đã thuộc khung tiếp theo, KHÔNG match
- Nếu dùng closed-closed `[18, 22]`, suất 22:00 sẽ match cả khung này LẪN khung tiếp → overlap

### 4.6. `DATE_RANGE` — Closed-closed `[dateStart, dateEnd]`

```java
private static boolean matchesDateRange(PricingRule rule, LocalDateTime t) {
    if (rule.getDateStart() == null || rule.getDateEnd() == null) return false;
    var date = t.toLocalDate();
    return !date.isBefore(rule.getDateStart()) && !date.isAfter(rule.getDateEnd());
}
```

**Closed-closed (cả 2 đầu inclusive) vì lễ tết** — nhập "Tết từ 10/02 đến 15/02" thì admin muốn cả ngày 10 và ngày 15 đều áp dụng. Closed-open sẽ làm ngày 15 không match → bug nghiệp vụ.

### 4.7. `COMPOSITE` — AND của các điều kiện đã set

```java
private static boolean matchesComposite(PricingRule rule, LocalDateTime t) {
    boolean hasAny = false;

    if (rule.getDayOfWeek() != null && !rule.getDayOfWeek().isBlank()) {
        hasAny = true;
        if (!matchesDayOfWeek(rule, t)) return false;
    }
    if (rule.getHourStart() != null && rule.getHourEnd() != null) {
        hasAny = true;
        if (!matchesHourRange(rule, t)) return false;
    }
    if (rule.getDateStart() != null && rule.getDateEnd() != null) {
        hasAny = true;
        if (!matchesDateRange(rule, t)) return false;
    }
    return hasAny; // composite rỗng -> không match (tránh áp dụng nhầm)
}
```

**Logic AND ngắn mạch (short-circuit):**

- Có ít nhất 1 điều kiện được set (`hasAny = true`) thì rule mới có ý nghĩa
- Nếu **bất kỳ** điều kiện nào FAIL → return false ngay (tiết kiệm CPU)
- Composite rỗng (không set gì) → `hasAny = false` → return false thay vì true (defensive — tránh rule lỗi áp dụng cho 100% suất chiếu)

**Ví dụ — "Peak weekend night":**

```
ruleType = COMPOSITE
day_of_week = "SATURDAY,SUNDAY"
hour_start = 18
hour_end = 22
multiplier = 125.00 (+25%)
```

→ Chỉ match khi suất chiếu vào **(T7 hoặc CN) VÀ (18:00 ≤ giờ < 22:00)**.

### 4.8. Trade-off: function table vs class-per-strategy

Khi nào nên migrate sang Cách A?

- Số rule type tăng ≥ 8-10 → switch dài, khó đọc
- Mỗi rule type có **state riêng** (vd cần inject `HolidayService` để lookup ngày lễ động)
- Strategy được **plug-in từ ngoài** (vd third-party library cung cấp matcher)

Với 4 type cố định + zero state → CineX dùng function table là tối ưu (KISS — Keep It Simple).

---

## 5. Composite + Cache-aside — `PricingEngine`

### 5.1. Composite pattern — Nhiều strategies áp dụng theo thứ tự

Composite (GoF Structural) — gốc là "tree của objects" nhưng ở đây dùng nghĩa rộng: **kết hợp nhiều strategy nhỏ thành 1 phép tính lớn**.

Engine giữ `List<PricingRule>`, iterate qua từng rule, mỗi rule khớp thì nhân multiplier vào tổng:

```java
public BigDecimal applyModifiers(BigDecimal basePrice, LocalDateTime showtimeStart) {
    if (basePrice == null) return BigDecimal.ZERO;
    BigDecimal total = basePrice;
    for (PricingRule rule : activeRules) {
        if (PricingRuleMatcher.matches(rule, showtimeStart)) {
            BigDecimal ratio = rule.getMultiplierPercent()
                    .divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP);
            total = total.multiply(ratio);
        }
    }
    return total.setScale(0, RoundingMode.HALF_UP);
}
```

(File `PricingEngine.java:73-86`.)

### 5.2. Vì sao nhân chuỗi (multiplicative) thay vì cộng/trừ (additive)?

So sánh 2 cách tổng hợp khi có **nhiều rule cùng match**:

**Additive (cộng %)**:

```
basePrice = 100k
WEEKEND  +10%  -> total% = +10%
PRIME    +15%  -> total% = +25%
finalPrice = 100k × 1.25 = 125k
```

**Multiplicative (nhân multiplier)** — cách CineX dùng:

```
basePrice = 100k
WEEKEND  ×1.10 -> 110k
PRIME    ×1.15 -> 126.5k
finalPrice = 126.5k
```

→ Multiplicative cao hơn 1.5k (vì 15% sau khi đã +10%, tính trên 110k).

**Ưu điểm multiplicative:**

1. **Order-independent** (commutative): `1.10 × 1.15 = 1.15 × 1.10 = 1.265`. Admin sắp xếp lại priority KHÔNG đổi kết quả → không cần lo bug thứ tự
2. **Không bao giờ âm**: với mọi multiplier > 0 → `total > 0` luôn dương. Cộng dồn có thể `-60% + -60% = -120%` → tiền âm!
3. **Industry standard**: Stripe, AWS, ngành bán lẻ luôn dùng multiplicative cho compound modifiers
4. **Semantic đúng**: "discount 20% trên giá đã tăng 10%" tự nhiên là multiplicative — đời thực giảm giá Black Friday "20% off + thêm 10% off coupon" cũng tính lồng

**Nhược điểm:**

- Khó giải thích cho user "tại sao 100k × 1.10 × 1.15 = 126.5k chứ không phải 125k"
- → FE hiển thị **breakdown từng bước** (xem `findMatchingRules()` mục 5.5)

### 5.3. Làm tròn `HALF_UP` về VNĐ

```java
return total.setScale(0, RoundingMode.HALF_UP);
```

- `scale = 0` → 0 chữ số sau dấu phẩy (số nguyên)
- `HALF_UP` → 0.5 làm tròn lên (chuẩn toán học): `126.499 → 126`, `126.500 → 127`
- Lý do: VNĐ không có đơn vị xu, mọi giá vé là số nguyên đồng

Quan trọng: làm tròn **chỉ ở bước cuối** — trong vòng lặp giữ scale 4 chữ số. Nếu làm tròn từng bước → tích lũy sai số.

### 5.4. Cache-aside pattern — Vì sao cache rules?

Số liệu thực tế CineX:

| Metric | Tần suất |
|---|---|
| Admin sửa rule | ~2-5 lần / tháng |
| `applyModifiers()` được gọi | Mỗi ghế của mỗi booking → ~1000-10000 lần/ngày |

Nếu **query DB mỗi lần** → tải vô ích lên SQL Server. Cache là trade-off rõ ràng:

- **Stale window:** sau khi admin update đến lúc cache refresh — vài ms (nếu service explicit gọi `refresh()`)
- **Memory cost:** vài chục rule × ~200 bytes/rule = **< 10KB** — không đáng kể

Implementation trong `PricingEngine.java`:

```java
@Service
@RequiredArgsConstructor
public class PricingEngine {

    private final PricingRuleRepository pricingRuleRepository;

    /** Cache in-memory — copy-on-refresh. */
    private volatile List<PricingRule> activeRules = new ArrayList<>();

    @Transactional(readOnly = true)
    public void refresh() {
        activeRules = pricingRuleRepository
            .findByActiveTrueAndStorageStateNotOrderByPriorityDescIdAsc(StorageState.ARCHIVED);
        log.info("Pricing engine reloaded: {} active rules", activeRules.size());
    }

    @jakarta.annotation.PostConstruct
    public void init() {
        refresh();
    }
}
```

**Chi tiết kỹ thuật quan trọng:**

#### a) `volatile`

Java memory model — nếu nhiều thread (HTTP request) cùng đọc `activeRules` mà 1 thread khác (`refresh()` từ admin) ghi → cần `volatile` để **happens-before** đảm bảo thread đọc thấy giá trị mới nhất.

Không có `volatile` → thread booking có thể đọc `activeRules` từ **cache CPU local** của nó (stale list) → bug khó debug.

#### b) Copy-on-refresh (immutable swap)

`refresh()` không **mutate** list cũ — nó **gán reference mới** (`activeRules = ...`). List cũ vẫn còn nguyên cho các thread đang iterate. Cách này **không cần lock**:

```
Thread A (booking):    L1 -> L1 -> L1 -> L1 (đang iterate)
Thread B (refresh):              L2 (gán activeRules = L2)
Thread A:              ...L1... (iterate xong list cũ, kết quả vẫn đúng)
Thread C (booking sau): L2 (đọc reference mới)
```

KHÔNG nên: `activeRules.clear(); activeRules.addAll(newList);` — vì Thread A đang iterate sẽ ConcurrentModificationException.

#### c) `@PostConstruct init()`

Spring lifecycle — chạy 1 lần sau khi bean được tạo & inject xong. Nếu không có `@PostConstruct`:

- Request booking đầu tiên sau khi server start → cache rỗng → giá không có modifier (bug!)
- Hoặc lazy load lần đầu → request đó chậm hơn

`@PostConstruct` đảm bảo cache **luôn ready** ngay khi server bắt đầu nhận request.

### 5.5. `findMatchingRules()` — Breakdown cho FE

```java
public List<MatchedRule> findMatchingRules(LocalDateTime showtimeStart) {
    List<MatchedRule> matched = new ArrayList<>();
    for (PricingRule rule : activeRules) {
        if (PricingRuleMatcher.matches(rule, showtimeStart)) {
            matched.add(new MatchedRule(rule.getCode(), rule.getName(),
                    rule.getDescription(), rule.getMultiplierPercent()));
        }
    }
    return matched;
}

public record MatchedRule(String code, String name, String description, BigDecimal multiplierPercent) {}
```

Mục đích: FE hiển thị "tại sao giá lại 126.500đ":

```
Giá ghế Standard: 100.000đ
+ Phụ thu cuối tuần (WEEKEND):  +10%   -> 110.000đ
+ Khung giờ vàng (PRIME-TIME):  +15%   -> 126.500đ
Tổng:                                     126.500đ
```

→ User hiểu rõ, tin tưởng giá hơn là chỉ thấy 1 con số bất ngờ.

---

## 6. Tích hợp với BookingService — Snapshot pattern

### 6.1. Trước & sau refactor

**TRƯỚC** (giá hard-code theo seat type):

```java
private BigDecimal getPriceForSeat(SeatType seatType, Showtime showtime) {
    return switch (seatType) {
        case VIP -> showtime.getVipPrice();
        case COUPLE -> showtime.getCouplePrice();
        default -> showtime.getBasePrice();
    };
}
```

**SAU** (file `BookingService.java:482-489`):

```java
private BigDecimal getPriceForSeat(SeatType seatType, Showtime showtime) {
    BigDecimal rawPrice = switch (seatType) {
        case VIP -> showtime.getVipPrice();
        case COUPLE -> showtime.getCouplePrice();
        default -> showtime.getBasePrice();
    };
    return pricingEngine.applyModifiers(rawPrice, showtime.getStartTime());
}
```

→ Thêm **1 dòng** gọi engine. KHÔNG sửa Booking entity, KHÔNG sửa Showtime entity, KHÔNG sửa controller → **Open/Closed Principle** thuần.

### 6.2. Snapshot pattern — Vì sao lưu giá vào `BookingSeat.price`

Bảng `booking_seats` có cột `price DECIMAL`. Khi tạo booking, ta **snapshot giá tại thời điểm đó** vào row này:

```java
// trong BookingService.holdSeats()
BigDecimal price = getPriceForSeat(seat.getSeatType(), showtime);  // line 167, 210
BookingSeat bs = BookingSeat.builder()
    .booking(booking)
    .seat(seat)
    .price(price)           // <-- snapshot
    .status(BookingSeatStatus.HOLDING)
    .build();
```

**Vì sao quan trọng:**

| Tình huống | Nếu KHÔNG snapshot | Nếu CÓ snapshot (CineX) |
|---|---|---|
| Admin sửa rule WEEKEND từ +10% → +15% sau 1 tuần | Báo cáo doanh thu tuần trước **bị thay đổi** (sai lệch) | Booking cũ vẫn giữ giá cũ — báo cáo đúng |
| User mua vé 100k, admin giảm rule sang -20% | Refund tính lại 80k — khách không đồng ý | Refund đúng 100k đã trả |
| Disable rule | Booking đã trả tiền giờ "không có rule áp dụng" → giá khác | Giá lưu trong BookingSeat không thay đổi |

→ Đây là **Snapshot pattern** — chuẩn cho mọi financial data. Stripe, AWS Billing, ngân hàng đều snapshot tỷ giá / phí / thuế tại thời điểm transaction.

### 6.3. `confirm` cũng dùng cùng `getPriceForSeat`

`BookingService.java` có các call tại line 167 (`hold`), 210 (`createWalkInBooking`), 567 và 584 (`confirm`). Tất cả đều dùng cùng method → giá nhất quán giữa hold price và confirm price. Nếu rule thay đổi giữa lúc hold (HOLDING) và confirm thanh toán xong → giá vẫn lấy từ `BookingSeat.price` đã snapshot.

---

## 7. Admin CRUD + cache refresh

### 7.1. Mỗi mutation gọi `pricingEngine.refresh()`

File `PricingRuleService.java`:

```java
@Transactional
@Auditable(action = "CREATE_PRICING_RULE", entityType = "PricingRule")
public PricingRuleResponse create(PricingRuleRequest request) {
    validateRuleTypeFields(request);
    PricingRule rule = PricingRule.builder()...build();
    pricingRuleRepository.save(rule);
    pricingEngine.refresh();   // <-- BẮT BUỘC
    log.info("Created pricing rule '{}'", rule.getCode());
    return pricingRuleMapper.toResponse(rule);
}
```

Tương tự `update`, `archive`, `bulkArchive`, `bulkRestore` đều gọi `refresh()` ở cuối.

**Nếu QUÊN gọi refresh?**

- DB đã có rule mới — nhưng engine vẫn dùng cache cũ
- Booking sau khi tạo rule **không thấy rule áp dụng** → giá không khớp UI admin
- Bug khó debug (cách reproduce: restart server thì hết, không restart thì còn)

→ Quy tắc cứng: **mọi method @Transactional mutate pricing_rules đều phải gọi `pricingEngine.refresh()` ở cuối**.

### 7.2. `validateRuleTypeFields` — Fail-fast

File `PricingRuleService.java:128-166`:

```java
private void validateRuleTypeFields(PricingRuleRequest request) {
    switch (request.getRuleType()) {
        case DAY_OF_WEEK:
            if (request.getDayOfWeek() == null || request.getDayOfWeek().isBlank()) {
                throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "DAY_OF_WEEK rule phải có trường day_of_week (CSV thứ)");
            }
            break;
        case HOUR_RANGE:
            if (request.getHourStart() == null || request.getHourEnd() == null) { ... }
            if (request.getHourStart() >= request.getHourEnd()) {
                throw new BusinessException(ErrorCode.INVALID_REQUEST, "hour_start phải < hour_end");
            }
            break;
        case DATE_RANGE:
            if (request.getDateStart() == null || request.getDateEnd() == null) { ... }
            if (request.getDateStart().isAfter(request.getDateEnd())) { ... }
            break;
        case COMPOSITE:
            boolean hasAny = ...;
            if (!hasAny) throw new BusinessException(...);
            break;
    }
}
```

→ Validation **sâu hơn @Valid** vì cross-field check. `@Valid` chỉ check field-level (NotNull, Size). Logic "DAY_OF_WEEK type ⇒ phải có day_of_week" cần kiểm tra **mối quan hệ giữa các field** → đặt trong service.

### 7.3. Update không cho đổi `code`

```java
if (!rule.getCode().equals(request.getCode())) {
    throw new BusinessException(ErrorCode.INVALID_REQUEST,
        "Không thể đổi mã rule — vui lòng tạo rule mới");
}
```

Vì `code` được dùng trong audit log, breakdown UI, và có thể là external reference. Đổi code → orphan log. Admin muốn đổi → archive cũ + tạo mới.

### 7.4. FE — `AdminPricingPage.tsx` UX

#### a) Dynamic form fields theo rule_type

Form watch `selectedType`, chỉ render field tương ứng:

```tsx
const selectedType = watch('ruleType')

{(selectedType === 'DAY_OF_WEEK' || selectedType === 'COMPOSITE') && (
  <div className="col-span-12">
    <label>Áp dụng cho các thứ</label>
    {/* Day chip picker */}
  </div>
)}

{(selectedType === 'HOUR_RANGE' || selectedType === 'COMPOSITE') && (
  <>
    <Input type="number" {...register('hourStart')} />
    <Input type="number" {...register('hourEnd')} />
  </>
)}

{(selectedType === 'DATE_RANGE' || selectedType === 'COMPOSITE') && (
  <>
    <Input type="date" {...register('dateStart')} />
    <Input type="date" {...register('dateEnd')} />
  </>
)}
```

→ Admin không bao giờ thấy field thừa, ít nhầm lẫn. COMPOSITE thì hiển thị TẤT CẢ để admin tùy chọn.

#### b) Day chip picker thay vì CSV input

Thay vì bắt admin gõ `"SATURDAY,SUNDAY"` (dễ sai chính tả) — UI là chip click chọn:

```tsx
const DAY_OPTIONS = [
  { value: 'MONDAY', label: 'T2' },
  ...
  { value: 'SATURDAY', label: 'T7' },
  { value: 'SUNDAY', label: 'CN' },
]

function toggleDay(day: string) {
  const days = selectedDays.includes(day)
    ? selectedDays.filter(d => d !== day)
    : [...selectedDays, day]
  setValue('dayOfWeek', days.join(','))
}

{DAY_OPTIONS.map(d => (
  <button onClick={() => toggleDay(d.value)}
    className={selectedDays.includes(d.value)
      ? 'bg-[#ffc107]/10 text-[#ffc107] border-[#ffc107]/30'
      : 'bg-[#2a2317] text-gray-400 border-white/10'}>
    {d.label}
  </button>
))}
<input type="hidden" {...register('dayOfWeek')} />
```

→ FE convert mảng `[SATURDAY, SUNDAY]` ↔ BE CSV `"SATURDAY,SUNDAY"`.

#### c) Live preview multiplier

```tsx
function formatMultiplier(m: number): string {
  const diff = m - 100
  if (diff > 0) return `+${diff.toFixed(0)}%`
  if (diff < 0) return `${diff.toFixed(0)}%`
  return 'Giữ nguyên'
}
```

Bảng list hiện:

- `+10%` (màu cam) — tăng giá
- `-20%` (màu xanh) — giảm giá
- `Giữ nguyên` (xám) — multiplier = 100, dùng cho rule "tracking" không đổi giá

→ Trực quan hơn nhiều so với cột raw `110.00`.

---

## 8. SQL được sinh ra

### 8.1. `findByActiveTrueAndStorageStateNotOrderByPriorityDescIdAsc`

JPA spec sinh tự động:

```sql
SELECT *
FROM pricing_rules
WHERE active = 1
  AND storage_state <> 'ARCHIVED'
ORDER BY priority DESC, id ASC;
```

Engine cache kết quả này vào `activeRules`.

### 8.2. INSERT khi admin tạo rule WEEKEND

```sql
INSERT INTO pricing_rules
    (code, name, description, rule_type, multiplier_percent,
     day_of_week, hour_start, hour_end, date_start, date_end,
     active, priority,
     version, storage_state, created_at, updated_at, created_by, updated_by)
VALUES
    ('WEEKEND', N'Phụ thu cuối tuần', N'Thứ 7 và CN +10%',
     'DAY_OF_WEEK', 110.00,
     'SATURDAY,SUNDAY', NULL, NULL, NULL, NULL,
     1, 100,
     0, 'ACTIVE', GETDATE(), GETDATE(), 'admin', 'admin');
```

`hour_start`, `hour_end`, `date_start`, `date_end` đều NULL vì rule type là DAY_OF_WEEK.

### 8.3. UPDATE khi admin sửa multiplier WEEKEND từ 110 → 115

```sql
UPDATE pricing_rules
SET multiplier_percent = 115.00,
    version = version + 1,
    updated_at = GETDATE(),
    updated_by = 'admin'
WHERE id = 1 AND version = 0;
```

`@Version` tự tăng → optimistic lock chống 2 admin sửa đồng thời.

### 8.4. Soft delete (archive)

```sql
UPDATE pricing_rules
SET storage_state = 'ARCHIVED',
    version = version + 1,
    updated_at = GETDATE()
WHERE id = 1;
```

Row vẫn còn trong DB → audit log truy ngược được. Engine sau `refresh()` không load row này nữa.

---

## 9. Request/Response mẫu

### 9.1. Tạo rule WEEKEND

**Request** — `POST /api/pricing-rules`

```bash
curl -X POST http://localhost:8088/api/pricing-rules \
  -H "Authorization: Bearer <admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "WEEKEND",
    "name": "Phụ thu cuối tuần",
    "description": "Thứ 7 và Chủ nhật tăng 10%",
    "ruleType": "DAY_OF_WEEK",
    "multiplierPercent": 110.00,
    "dayOfWeek": "SATURDAY,SUNDAY",
    "active": true,
    "priority": 100
  }'
```

**Response** — 200 OK:

```json
{
  "success": true,
  "message": "Tạo rule thành công",
  "data": {
    "id": 4,
    "code": "WEEKEND",
    "name": "Phụ thu cuối tuần",
    "description": "Thứ 7 và Chủ nhật tăng 10%",
    "ruleType": "DAY_OF_WEEK",
    "multiplierPercent": 110.00,
    "dayOfWeek": "SATURDAY,SUNDAY",
    "hourStart": null,
    "hourEnd": null,
    "dateStart": null,
    "dateEnd": null,
    "active": true,
    "priority": 100,
    "storageState": "ACTIVE",
    "createdAt": "2026-06-09T14:30:00",
    "updatedAt": "2026-06-09T14:30:00"
  }
}
```

### 9.2. Tạo rule COMPOSITE — "Peak Weekend Night"

**Request:**

```bash
curl -X POST http://localhost:8088/api/pricing-rules \
  -H "Authorization: Bearer <admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "PEAK-WEEKEND-NIGHT",
    "name": "Cao điểm cuối tuần tối",
    "description": "Tối T7/CN 18-22h tăng 25%",
    "ruleType": "COMPOSITE",
    "multiplierPercent": 125.00,
    "dayOfWeek": "SATURDAY,SUNDAY",
    "hourStart": 18,
    "hourEnd": 22,
    "active": true,
    "priority": 200
  }'
```

→ Chỉ match khi cả 2 điều kiện đúng: (T7 hoặc CN) AND (18:00 ≤ giờ < 22:00).

### 9.3. Tạo rule DATE_RANGE — Tết 2026

```bash
curl -X POST http://localhost:8088/api/pricing-rules \
  -H "Authorization: Bearer <admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "TET-2026",
    "name": "Phụ thu Tết Nguyên Đán 2026",
    "description": "Mùng 1-6 Tết tăng 30%",
    "ruleType": "DATE_RANGE",
    "multiplierPercent": 130.00,
    "dateStart": "2026-02-17",
    "dateEnd": "2026-02-22",
    "active": true,
    "priority": 500
  }'
```

### 9.4. Validation lỗi — Thiếu field theo type

**Request lỗi:**

```json
POST /api/pricing-rules
{
  "code": "BAD",
  "name": "Test",
  "ruleType": "DAY_OF_WEEK",
  "multiplierPercent": 110.00
  // thiếu dayOfWeek
}
```

**Response — 400:**

```json
{
  "success": false,
  "message": "DAY_OF_WEEK rule phải có trường day_of_week (CSV thứ)",
  "errorCode": "INVALID_REQUEST",
  "data": null
}
```

### 9.5. List tất cả rules

```bash
curl http://localhost:8088/api/pricing-rules?page=0&size=20 \
  -H "Authorization: Bearer <admin-jwt>"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "content": [
      {
        "id": 5, "code": "PEAK-WEEKEND-NIGHT", "ruleType": "COMPOSITE",
        "multiplierPercent": 125.00, "priority": 200, "active": true,
        "dayOfWeek": "SATURDAY,SUNDAY", "hourStart": 18, "hourEnd": 22,
        "dateStart": null, "dateEnd": null
      },
      {
        "id": 4, "code": "TET-2026", "ruleType": "DATE_RANGE",
        "multiplierPercent": 130.00, "priority": 500, "active": true,
        "dayOfWeek": null, "hourStart": null, "hourEnd": null,
        "dateStart": "2026-02-17", "dateEnd": "2026-02-22"
      },
      {
        "id": 1, "code": "WEEKEND", "ruleType": "DAY_OF_WEEK",
        "multiplierPercent": 110.00, "priority": 100, "active": true,
        "dayOfWeek": "SATURDAY,SUNDAY"
      },
      {
        "id": 2, "code": "PRIME-TIME", "ruleType": "HOUR_RANGE",
        "multiplierPercent": 115.00, "priority": 100, "active": true,
        "hourStart": 18, "hourEnd": 22
      },
      {
        "id": 3, "code": "MORNING-DISCOUNT", "ruleType": "HOUR_RANGE",
        "multiplierPercent": 80.00, "priority": 90, "active": true,
        "hourStart": 6, "hourEnd": 12
      }
    ],
    "totalElements": 5,
    "totalPages": 1
  }
}
```

(Sort default `priority` DESC.)

### 9.6. Archive rule

```bash
curl -X DELETE http://localhost:8088/api/pricing-rules/3 \
  -H "Authorization: Bearer <admin-jwt>"
```

→ Set `storage_state = 'ARCHIVED'`, refresh cache, MORNING-DISCOUNT không còn áp dụng cho booking mới.

### 9.7. Booking response có giá đã modifier

Khi `POST /api/bookings/hold` ở tối T7 (20:00), seat Standard giá raw 100k:

```json
{
  "data": {
    "id": 123,
    "code": "BK-202606090001",
    "status": "HOLDING",
    "totalAmount": 126500,
    "bookingSeats": [
      {
        "seatId": 45,
        "seatNumber": "F8",
        "seatType": "STANDARD",
        "price": 126500,
        "status": "HOLDING"
      }
    ]
  }
}
```

→ `price` đã được tính qua engine. WEEKEND ×1.10 × PRIME-TIME ×1.15 = ×1.265 → 100k × 1.265 = 126.500đ (làm tròn HALF_UP).

---

## 10. Câu hỏi tự kiểm tra

> Trả lời được hết = đã hiểu sâu module. Nếu bí, đọc lại mục tương ứng.

### Câu 1 — Đa thừa số
Tại sao engine nhân chuỗi multiplier (`× 1.10 × 1.15`) thay vì cộng % (`+10% + 15% = +25%`)? Liệt kê **2 lý do kỹ thuật** và **1 lý do nghiệp vụ**.

> Gợi ý: mục 5.2. Lý do kỹ thuật: order-independent, không bao giờ âm. Lý do nghiệp vụ: industry standard, semantic compound modifier.

### Câu 2 — Cache invalidation
Nếu lập trình viên QUÊN gọi `pricingEngine.refresh()` trong method `PricingRuleService.update()` thì hậu quả gì? Cách reproduce bug?

> Gợi ý: Cache stale → booking mới dùng rule cũ → giá hiển thị UI admin (đọc DB) khác giá thực tế tính booking. Reproduce: tạo rule → booking → sửa multiplier → booking lại → so sánh.

### Câu 3 — Snapshot
Vì sao `BookingSeat.price` lưu snapshot giá thay vì recompute mỗi lần đọc booking? Nếu không snapshot, tình huống xấu gì xảy ra với báo cáo doanh thu lịch sử?

> Gợi ý: mục 6.2. Admin sửa rule → toàn bộ booking quá khứ "thay đổi giá" trong báo cáo → không khớp số tiền thực thu → kế toán phát hoảng.

### Câu 4 — COMPOSITE matching
Rule COMPOSITE có `day_of_week = "SATURDAY"` và `hour_range = [18, 22)`. Suất chiếu T7 17:00 có khớp không? Suất CN 19:00? Suất T6 20:00?

> Gợi ý: AND của các điều kiện đã set.
> - T7 17:00 → day ✓, hour ✗ (17 < 18) → KHÔNG match
> - CN 19:00 → day ✗ (CN không nằm trong "SATURDAY") → KHÔNG match
> - T6 20:00 → day ✗ → KHÔNG match
> Chỉ T7 trong khung 18-21:59 mới match.

### Câu 5 — volatile vs synchronized
Vì sao `activeRules` cần khai báo `volatile`? Tại sao KHÔNG dùng `Collections.synchronizedList()`?

> Gợi ý: mục 5.4.b. `volatile` đủ vì ta chỉ swap reference (atomic), không mutate list. `synchronizedList` bắt lock mỗi lần đọc — overhead lớn khi `applyModifiers()` được gọi hàng ngàn lần/ngày.

### Câu 6 — Closed-open vs closed-closed
Tại sao `HOUR_RANGE` dùng `[hourStart, hourEnd)` (closed-open) nhưng `DATE_RANGE` dùng `[dateStart, dateEnd]` (closed-closed)? Cùng là khoảng cớ sao khác nhau?

> Gợi ý: mục 4.5, 4.6. Giờ là continuous (overlap nếu closed-closed), ngày là discrete (admin muốn cả ngày cuối). Bonus: rule "Tết 10/02 - 15/02" closed-closed thì ngày 15 vẫn match, closed-open ngày 15 fail.

### Câu 7 — Strategy chọn cách nào
Hiện CineX dùng **function table** (Cách B mục 4.2). Nếu sản phẩm phát triển có 15+ rule type và mỗi type cần lookup external service (vd `HolidayApiService`) → có nên migrate sang **class-per-strategy** (Cách A) không? Vì sao?

> Gợi ý: Có. Cách A cho phép DI từng strategy, dễ unit test, dễ thêm rule type không sửa switch. Switch 15 case + inject 15 service vào 1 class → vi phạm SRP nặng.

### Câu 8 — Liquibase seed
Liquibase seed insert 3 rule mặc định (changeset `055-seed-default-pricing-rules`). Nếu admin xóa rule WEEKEND rồi restart server → rule có được seed lại không? Vì sao?

> Gợi ý: Không. Liquibase track changeset đã chạy trong bảng `DATABASECHANGELOG`. Changeset id `055-seed-default-pricing-rules` đã chạy 1 lần → lần restart sau Liquibase bỏ qua. Muốn re-seed → tạo changeset mới id khác.

---

## 11. Tóm tắt — Cheatsheet

| Khái niệm | Tóm tắt 1 dòng |
|---|---|
| Pricing Rule | Row trong `pricing_rules`, có `rule_type` quyết định cột nào dùng |
| Multiplier | %: 100 = giữ nguyên, 110 = +10%, 80 = -20%, lưu DECIMAL(6,2) |
| Strategy | `PricingRuleMatcher.matches()` — switch theo `rule_type`, 4 case |
| Composite | Áp dụng tất cả rule khớp, multiplier nhân chuỗi (order-independent) |
| Cache-aside | `volatile List<PricingRule>`, swap reference khi `refresh()` |
| Snapshot | `BookingSeat.price` lưu giá tại thời điểm hold → admin sửa rule không thay đổi lịch sử |
| Refresh trigger | Service mutation (`create/update/archive`) gọi `pricingEngine.refresh()` |
| Validation | `validateRuleTypeFields()` fail-fast cross-field |
| FE UX | Day chip picker, dynamic form theo rule_type, multiplier preview `+10%` |
| Authorization | `@PreAuthorize("hasRole('ADMIN')")` cấp class |

---

**Module tiếp theo:** 17 — Audit Log (ghi nhận mọi action quan trọng), 18 — System Config (cấu hình động `hold_minutes`, `max_seats`).
