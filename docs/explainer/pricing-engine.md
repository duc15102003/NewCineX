# Pricing Engine — Strategy + Composite + Cache

> Giải thích PricingEngine của CineX: áp pricing rules động cho giá vé, chuẩn industry "What You See Is What You Pay", và pattern ẩn surge badge.

---

## 1. Bài toán

Rạp chiếu thường có nhiều quy tắc điều chỉnh giá:
- Cuối tuần phụ thu +20%
- Suất sáng giảm 20%
- Thứ 3 giảm 30% (CGV's Tuesday)
- Giờ vàng (19h-22h) phụ thu +15%
- Học sinh giảm 10%
- Lễ Tết phụ thu 30%

Mỗi rule:
- Match theo thời gian (giờ/ngày tuần/ngày tháng/khoảng date)
- Multiply giá gốc theo %
- Có thể global (toàn hệ thống) hoặc per-theater

**Pricing rules là `pricing_rules` table:**

```sql
CREATE TABLE pricing_rules (
    id BIGINT PRIMARY KEY,
    theater_id BIGINT NULL,          -- NULL = global rule
    code NVARCHAR(50),
    name NVARCHAR(200),
    rule_type NVARCHAR(30),          -- DAY_OF_WEEK / HOUR_RANGE / DATE_RANGE / COMPOSITE
    multiplier_percent DECIMAL(6,2), -- 80 = giảm 20%; 120 = tăng 20%
    day_of_week NVARCHAR(100),       -- CSV "TUESDAY" hoặc "SATURDAY,SUNDAY"
    hour_start INT,
    hour_end INT,
    date_start DATE,
    date_end DATE,
    active BIT,
    priority INT                     -- higher = áp sau cùng
);
```

---

## 2. Pattern Strategy + Composite

Mỗi `rule_type` có cách match khác nhau → Strategy. Nhiều rule áp cùng lúc → Composite (chain multiplier).

`PricingRuleMatcher.matches(rule, showtimeStart)`:

```java
public static boolean matches(PricingRule rule, LocalDateTime start) {
    return switch (rule.getRuleType()) {
        case DAY_OF_WEEK -> matchesDayOfWeek(rule, start);
        case HOUR_RANGE -> matchesHourRange(rule, start);
        case DATE_RANGE -> matchesDateRange(rule, start);
        case COMPOSITE -> matchesAll(rule, start);
    };
}
```

`PricingEngine.applyModifiers(basePrice, showtimeStart, theaterId)`:
1. Filter active rules có scope phù hợp + match showtime
2. **Override resolution:** rule per-theater cùng `code` với global → theater-specific WIN
3. Chain multiplier: `total = basePrice × ratio1 × ratio2 × ratio3`
4. Round to 0 decimals (VNĐ tròn)

**Ví dụ:**
- basePrice = 100,000đ
- Rules match:
  - MORNING_DISCOUNT 80% (giảm 20%)
  - STUDENT_HN 90% (học sinh -10%)
- Effective price = 100,000 × 0.80 × 0.90 = 72,000đ

---

## 3. Multi-tenant resolution

Mỗi rule có `theater_id` nullable:
- `theater_id = NULL` → global rule, áp toàn hệ thống
- `theater_id = X` → chỉ áp tại rạp X

**Quy tắc override:** Trong cùng `code`, theater-specific WIN:

```
Rule code = WEEKEND
  Global: WEEKEND +20% (multiplier 120%)
  Theater 5: WEEKEND +30% (multiplier 130%)

Khi tính giá tại theater 5:
  WEEKEND áp 130% (override), KHÔNG stack 120% × 130%

Khi tính giá tại theater 7:
  WEEKEND áp 120% (global only)
```

Khác `code` thì chain bình thường (không override).

---

## 4. Cache 2 tầng

### 4.1. L1: activeRules snapshot

```java
private volatile List<PricingRule> activeRules = new ArrayList<>();

@Transactional(readOnly = true)
public void refresh() {
    activeRules = pricingRuleRepository.findActive();
    effectiveRulesCache.invalidateAll();
}
```

Reload khi:
- `@PostConstruct` (startup)
- Admin sửa rule (PricingRuleService manual call)
- `@Scheduled(fixedRate=5min)` (cho case rule kích hoạt theo giờ)

### 4.2. L2: effectiveRulesCache (Caffeine)

```java
private final Cache<EffectiveRulesCacheKey, List<PricingRule>> effectiveRulesCache =
    Caffeine.newBuilder()
        .maximumSize(5000)
        .expireAfterWrite(Duration.ofSeconds(60))
        .build();

private List<PricingRule> resolveEffectiveRules(LocalDateTime showtimeStart, Long theaterId) {
    EffectiveRulesCacheKey key = new EffectiveRulesCacheKey(
        theaterId, showtimeStart.truncatedTo(ChronoUnit.HOURS));
    return effectiveRulesCache.get(key, k -> computeEffectiveRules(showtimeStart, theaterId));
}
```

Key truncated đến **HOUR** vì rule match logic phụ thuộc giờ-trong-ngày + ngày-trong-tuần, KHÔNG phụ thuộc phút → 4 showtime 14:00/14:15/14:30/14:45 chung cache key.

**Performance:** trang admin showtime list 20 suất → trước cache ~500ms cold, sau cache ~100ms.

---

## 5. "What You See Is What You Pay" (chuẩn industry)

### 5.1. Bug trước fix

- `ShowtimeResponse.basePrice` trả raw từ DB (vd 100k)
- User click "Thanh toán" → BookingService.getPriceForSeat() áp PricingEngine → giá 80k (sau giảm 20%)
- User thấy 100k, trả 80k → confused, vi phạm Luật Bảo vệ NTD + Nghị định 13/2023.

### 5.2. Fix (commit `1e30091`)

`ShowtimeResponse` + `ShowtimeListResponse` expose:
- `basePrice/vipPrice/couplePrice` — giá GỐC (raw từ DB)
- `effectiveBasePrice/effectiveVipPrice/effectiveCouplePrice` — giá SAU PricingEngine
- `appliedRules: List<AppliedPricingRule>` — chip render FE

`ShowtimeService.toListResponseWithPricing()` gọi PricingEngine khi map response:
```java
private ShowtimeListResponse enrichWithPricing(ShowtimeListResponse base, Showtime showtime) {
    Long theaterId = showtime.getRoom().getTheater().getId();
    LocalDateTime start = showtime.getStartTime();
    return ShowtimeListResponse.builder()
        // ... copy other fields ...
        .effectiveBasePrice(pricingEngine.applyModifiers(base.getBasePrice(), start, theaterId))
        .effectiveVipPrice(pricingEngine.applyModifiers(base.getVipPrice(), start, theaterId))
        .appliedRules(applied)
        .build();
}
```

→ Cùng nguồn với `BookingService.getPriceForSeat()` → giá nhất quán end-to-end.

---

## 6. Hide surge badge khỏi UI khách (chuẩn rạp VN)

### 6.1. Background

CGV/Lotte/BHD KHÔNG hiện "+15% giờ vàng" cho khách. Lý do tâm lý:
- Hiện "-20% sáng" → khách cảm thấy "được lời" → tăng conversion ~15-30% (Nielsen)
- Hiện "+15% peak" → khách cảm thấy "bị chặt chém" → bỏ giỏ hàng. Đặc biệt nhạy với Gen Z.

Pattern industry: **reference price anchoring**
- Giá hiển thị mặc định = giá CAO NHẤT (weekend / prime time)
- Weekday tự nhiên thành "giảm so với baseline"
- Internal trong pricing engine: weekend = baseline 100%, weekday = multiplier 0.8

### 6.2. Implementation FE (commit `2e8fbe3`)

```typescript
// PriceWithRules.tsx
const discountRules = (appliedRules ?? []).filter(r => r.discountPercent < 0)

return (
  <>
    {hasDiscount && <span className="text-gray-500 line-through">{fmtVnd(base)}</span>}
    <span className="text-[#ffc107] font-semibold">{fmtVnd(effective)}</span>
    {hasDiscount && discountRules.length > 0 && (
      <div className="flex gap-1">
        {discountRules.map(r => (
          <span className="bg-green-500/10 text-green-400 border-green-500/30">
            <TrendingDown size={10} /> {r.name} {r.discountPercent}%
          </span>
        ))}
      </div>
    )}
  </>
)
```

- Chip có `discountPercent < 0` (giảm) → render xanh
- Chip có `discountPercent > 0` (tăng) → ẨN hoàn toàn
- Gạch ngang giá gốc CHỈ khi `effective < base`

Backend logic giữ nguyên — surge vẫn tính vào tổng tiền, chỉ ẩn UI.

### 6.3. discountPercent semantic

```java
public class AppliedPricingRule {
    private String code;
    private String name;
    private BigDecimal discountPercent;  // âm = giảm, dương = tăng
}
```

Convert từ `multiplierPercent`:
- multiplier 80 → discountPercent = -20 (giảm 20%)
- multiplier 130 → discountPercent = +30 (tăng 30%)

```java
.discountPercent(rule.getMultiplierPercent().subtract(BigDecimal.valueOf(100)))
```

---

## 7. Pricing rules seed mẫu

`014-seed-rooms-seats-pricing.xml` có 5 rule mẫu:

| Code | Name | Type | Multiplier | Day/Hour | Hiển thị FE? |
|---|---|---|---|---|---|
| MORNING_DISCOUNT | Giảm 20% suất sáng | HOUR_RANGE | 80% | 8h-12h | ✓ Chip xanh "-20% Suất sáng" |
| TUESDAY_DISCOUNT | Giảm 30% thứ 3 | DAY_OF_WEEK | 70% | TUESDAY | ✓ Chip xanh "-30% Thứ 3" |
| WEEKEND_SURGE | Phụ thu cuối tuần | DAY_OF_WEEK | 120% | SAT, SUN | ✗ Ẩn (internal) |
| PRIME_TIME | Phụ thu giờ vàng | HOUR_RANGE | 115% | 19h-22h | ✗ Ẩn (internal) |
| STUDENT_HN | Học sinh -10% (HN only) | COMPOSITE | 90% | — | ✓ Chip xanh "-10% Học sinh" |

---

## 8. Workflow admin thêm rule mới

1. Admin vào `/admin/pricing-rules` → "Thêm mới"
2. Nhập:
   - Code (vd `LUNAR_NEW_YEAR_SURGE`)
   - Name (vd "Phụ thu Tết Nguyên Đán")
   - Type: DATE_RANGE
   - multiplierPercent: 150 (tăng 50%)
   - dateStart: 2026-02-10, dateEnd: 2026-02-17
   - active: true
   - priority: 200 (cao hơn weekend)
3. Save → `PricingRuleService` gọi `pricingEngine.refresh()` → invalidate L2 cache
4. FE list suất chiếu trong Tết tự đổi giá → KHÔNG hiện chip "+50%" (surge ẩn)

---

## 9. Tham khảo code

| File | Vai trò |
|---|---|
| `module/pricing/entity/PricingRule.java` | Entity với theater_id nullable |
| `module/pricing/entity/PricingRuleType.java` | Enum DAY_OF_WEEK / HOUR_RANGE / DATE_RANGE / COMPOSITE |
| `module/pricing/strategy/PricingRuleMatcher.java` | Strategy pattern — switch theo ruleType |
| `module/pricing/service/PricingEngine.java` | Engine + 2-tier cache + scheduled refresh |
| `module/pricing/service/PricingRuleService.java` | Admin CRUD + call refresh() sau mỗi save |
| `module/showtime/service/ShowtimeService.java#enrichWithPricing` | Map response với effective price + applied rules |
| `module/showtime/dto/ShowtimeResponse.java` | DTO có effective fields + appliedRules list |
| `frontend/src/components/common/PriceWithRules.tsx` | Component gạch ngang + chip rule (chỉ giảm) |
| `frontend/src/types/movie.ts` | `AppliedPricingRule` interface |

---

## 10. Câu hỏi thường gặp

**Q: Surge tính vào tổng tiền nhưng ẩn UI — user có khiếu nại không?**
A: Không. Vì giá hiển thị mặc định ĐÃ bao gồm surge (đó là `effectivePrice`). User thấy 130k cho suất giờ vàng — không thấy giá raw 100k để so sánh. UI sạch, không ngược ngạo.

**Q: Tại sao truncate cache key đến HOUR mà không phải DAY?**
A: Có rule `HOUR_RANGE` (vd 19h-22h) — 14:00 vs 19:00 cho ra rule khác nhau. Truncate DAY sẽ sai.

**Q: Performance — cache 60s có quá ngắn?**
A: Không. Rule biên giờ (vd Happy hour 22:00) cần cache invalidate sớm để 22:01 user thấy giá mới. 60s là acceptable lag.

**Q: Có cache result `applyModifiers(price, time, theater)` không?**
A: Không cache trực tiếp. Vì `effectiveRulesCache` đã cache resolved rules — `applyModifiers` chỉ multiply chain nhanh.

**Q: Nếu admin sửa rule lúc 14:00 thì cache vẫn dùng rule cũ tới 14:01 (TTL 60s)?**
A: Không — `PricingRuleService.updateRule()` gọi `pricingEngine.refresh()` ngay → invalidate L2 cache ngay. Lag 0.
