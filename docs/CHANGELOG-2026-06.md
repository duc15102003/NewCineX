# CHANGELOG 2026-06 — Tổng hợp refactor gần đây

> Đọc file này để biết các module/concept đã thay đổi gì gần đây mà các module guide CŨ chưa kịp cập nhật. File này là nguồn duy nhất (single source of truth) cho mọi refactor từ tháng 5/2026 trở lại.

---

## 1. Database & Schema

### 1.1. Consolidate Liquibase 72 → 17 file

**Trước:** 72 changeset evolution theo time (`001-create-users-table.xml`, ..., `072-migrate-age-rating-c-to-t18.xml`).

**Sau:** 8 file schema + 9 file seed/fix, gom theo **domain**:
- 001 core (auth + theaters + system)
- 002 catalog (movies + genres + movie_runs)
- 003 cinema (rooms + seats + showtimes + pricing)
- 004 booking + payments
- 005 POS (snacks + combos + snack_orders)
- 006 engagement (reviews + favorites + notifications + loyalty)
- 007 vouchers
- 008 CHECK constraints (gộp validate enum xuống DB level)
- 009-016 seed + 017 fix encoding

→ Xem [docs/database/02-liquibase-guide.md](./database/02-liquibase-guide.md)

### 1.2. CHECK constraint cho enum columns

Trước đây chỉ validate enum ở app layer (Hibernate `@Enumerated`). Bug: ai đó dùng tool ngoài (DBeaver, raw SQL) insert giá trị xấu → DB accept → bug ẩn runtime.

Bây giờ file `008-check-constraints.xml` add CHECK constraint cho 20+ enum:
```sql
ALTER TABLE bookings ADD CONSTRAINT chk_bookings_status
CHECK (status IN ('HOLDING','CONFIRMED','CHECKED_IN','CANCELLED','EXPIRED','NO_SHOW','REJECTED'));
```

### 1.3. Booking.theater direct field

**Trước:** `Booking` lookup theater qua chain `showtime.room.theater` (3 hop JOIN). Vỡ nếu showtime move room cross-theater sau khi booking đã thanh toán.

**Sau:** Booking có column `theater_id BIGINT NOT NULL` (immutable snapshot lúc tạo). Chuẩn Vista FilmAtSite — `theater_id` snapshot ngay khi tạo booking, không bao giờ đổi.

- Statistics query đổi từ `JOIN showtime → room → theater` → JOIN booking direct
- BookingSpecification.hasTheater() đơn giản hóa
- PaymentService.toPaymentResponse dùng `booking.getTheater()` direct

---

## 2. Movie & MovieRun (per-theater pattern)

### 2.1. `Movie.status` bị DROP

**Trước:** `Movie.status` enum NOW_SHOWING / COMING_SOON / ENDED là field thật trong DB. Cache aggregate dual-write bởi scheduler + recomputeMovieStatus.

**Sau:** Bỏ hẳn `Movie.status` field (commit `d92a9f0`):
- Migration 069 (giờ là part của consolidate 002) drop column
- Tạo `MovieStatusComputer` service compute on-the-fly từ MovieRun + theaterId context
- Endpoint vẫn trả `status` trong response, nhưng compute mỗi request, không lưu

**Lý do:** Status là DERIVED — phụ thuộc (theaterId, today, MovieRun list). Không phải attribute bất biến của phim.

### 2.2. MovieRun PER-THEATER

**Trước:** MovieRun shared — 1 đợt chiếu áp cho toàn bộ chi nhánh.

**Sau:** Mỗi (movie, theater, startDate) = 1 MovieRun riêng:
- HN có FIRST_RUN Avatar 16/12 → 30/01
- SG có FIRST_RUN Avatar 16/12 → 28/02 (deadline khác)
- Distributor cấp deal per-rạp

→ Xem [docs/CONCEPT-movie-run.md](./CONCEPT-movie-run.md) (nếu có) hoặc giải thích chi tiết trong chat history.

### 2.3. Age Rating C bị BỎ

**Trước:** Enum AgeRating có 6 giá trị P / K / T13 / T16 / T18 / C. Code coi C = 18+.

**Sau:** Bỏ C (commit `6a357d6`):
- Theo TT 25/2024/BVHTTDL, C = "Cấm phổ biến" — phim BỊ CẤM phát hành công khai, không phải mức tuổi. Không có chỗ trong booking system.
- Migration 072 (consolidate vào 002): `UPDATE movies SET age_rating='T18' WHERE age_rating='C'`
- FE labels/colors/MIN_AGE/needsAgeConfirm đều bỏ key C
- Form admin tạo phim dropdown tự động không còn option C

---

## 3. Pricing & Display

### 3.1. "What You See Is What You Pay"

**Trước:** Showtime response trả raw `basePrice` từ DB. Khi user click thanh toán, BookingService.getPriceForSeat() áp PricingEngine → giá khác. Bug: user thấy 100k, trả 80k.

**Sau:** `ShowtimeResponse` + `ShowtimeListResponse` expose:
- `basePrice/vipPrice/couplePrice` (raw, gạch ngang)
- `effectiveBasePrice/effectiveVipPrice/effectiveCouplePrice` (sau PricingEngine — giá thực sự thu)
- `appliedRules: List<AppliedPricingRule>` (FE render badge "Suất sáng -20%")

ShowtimeService gọi PricingEngine khi map response → cùng nguồn với BookingService.getPriceForSeat() → giá nhất quán end-to-end.

### 3.2. Hide surge badge khỏi UI khách (chuẩn rạp VN)

CGV/Lotte/BHD không hiện "+15% giờ vàng" cho khách. Số liệu Nielsen: surge badge giảm conversion 20-40% (khách cảm thấy bị chặt chém).

CineX FE:
- Chip có `discountPercent < 0` (giảm) → render xanh "-20% Suất sáng"
- Chip có `discountPercent > 0` (tăng) → ẨN hoàn toàn
- Gạch ngang giá gốc CHỈ khi `effective < base`

Pricing logic BE giữ nguyên — surge vẫn tính vào tổng tiền, chỉ ẩn UI.

### 3.3. PricingEngine 2 tầng cache + scheduled refresh

- **L1:** activeRules in-memory snapshot, refresh khi admin sửa rule
- **L2:** Caffeine cache theo `(theaterId, hour bucket)`, TTL 60s, max 5000 entries
- **Schedule:** `@Scheduled(fixedRate=5min)` invalidate L2 đều đặn — xử lý case rule kích hoạt theo giờ (Happy hour 22:00-23:00)

→ Xem [docs/module-guides/16-pricing-explained.md](./module-guides/16-pricing-explained.md)

---

## 4. Statistics

### 4.1. 2 widget Dashboard mới

**Top đợt chiếu** (`/api/statistics/top-movie-runs`):
- Phân biệt từng đợt FIRST_RUN/REISSUE/FESTIVAL/HOLDOVER của cùng 1 phim
- Distributor cần báo cáo này để chia commission (FIRST_RUN 60/40, REISSUE 50/50)
- Badge màu khác nhau per runType + endDate null → "không giới hạn"

**Tỷ lệ lấp đầy phòng hôm nay** (`/api/statistics/occupancy`):
- Per-suất chiếu, bar visual % màu (đỏ <30%, vàng 30-70%, xanh >70%)
- Operations team theo dõi morning meeting

### 4.2. Cache name mới

`CacheConfig.cacheManager()` thêm:
- `stats-top-movie-runs`
- `stats-occupancy`

(Trước chỉ có overview, revenue, top-movies, top-snacks.)

### 4.3. Statistics đổi sang Booking.theater direct

Sau khi thêm `Booking.theater` field, query statistics đổi:
- Trước: `JOIN payment.booking.showtime.room.theater.id`
- Sau: `JOIN payment.booking.theater.id` (1 hop ngắn hơn + immutable)

---

## 5. Payment

### 5.1. Methods thêm CARD_POS + TRANSFER

Chuẩn rạp VN tại quầy: tiền mặt + thẻ qua máy POS + chuyển khoản/QR ngân hàng.

```java
public enum PaymentMethod {
    VNPAY,      // Online (mock MockPaymentProcessor)
    MOMO,       // Online (sandbox)
    CASH,       // POS - tiền mặt (manual confirm)
    CARD_POS,   // POS - thẻ qua máy POS hardware tách biệt (manual confirm)
    TRANSFER    // POS - chuyển khoản ngân hàng (manual confirm)
}
```

3 processor manual confirm pattern: BE không tích hợp gateway, staff cà thẻ qua máy ngân hàng cấp hoặc check app ngân hàng rạp rồi confirm.

### 5.2. POS dropdown chọn method

`TicketPOSPage` thêm state `paymentMethod`, dropdown CASH/CARD_POS/TRANSFER trong `POSOrderSummary`. `CounterSaleRequest` nhận thêm `paymentMethod` field, BE route đúng processor.

### 5.3. MoMo `payWithATM` (dev only)

`MoMoPaymentProcessor.requestType = "payWithATM"` thay vì `payWithMethod` → MoMo sandbox UI chỉ hiện thẻ ATM (đủ test, không cần thẻ Visa thật).

---

## 6. Security

### 6.1. Refresh token → HttpOnly cookie

**Trước:** Refresh token lưu localStorage. XSS có thể đọc → impersonate user.

**Sau:** Hybrid pattern (Auth0/Cognito/Okta chuẩn):
- Access token (15 phút TTL) → localStorage + Authorization header
- Refresh token (7 ngày) → HttpOnly cookie qua Set-Cookie. JS KHÔNG đọc được.

Backend:
- `RefreshTokenCookieUtil.setRefreshTokenCookie(response, token)` — Secure (prod) + SameSite=Lax + HttpOnly
- `/api/auth/login` + `/register` set cookie, null body field
- `/api/auth/refresh` đọc `@CookieValue("refreshToken")`, body fallback cho client cũ

Frontend:
- `axios` `withCredentials: true`
- `authStore.refreshToken` field bỏ
- `/api/auth/refresh` body rỗng, browser tự gửi cookie

### 6.2. Security headers (OWASP)

`SecurityConfig` thêm:
- `X-Frame-Options: DENY` — chống clickjacking
- `X-Content-Type-Options: nosniff` — chống MIME confusion
- `Referrer-Policy: same-origin` — không leak URL
- `Content-Security-Policy` với img-src, script-src, connect-src controlled
- `Strict-Transport-Security` max-age 1 năm (HSTS)

### 6.3. Rate limit /verify-email + /reset-password

Endpoint nhận token từ URL → có thể bị brute force. Thêm `EmailVerifyRateLimitService` (pattern Redis counter + TTL như ForgotPassword) — max 30 attempts/IP/giờ.

### 6.4. JSON strict — fail-on-unknown-properties

`application.yml`:
```yaml
spring:
  jackson:
    deserialization:
      fail-on-unknown-properties: true
```

Client gửi field rác → 400 Bad Request. Chống mass-assignment khi sau này add field nhạy cảm vào entity.

### 6.5. counterSale theater scope guard

`BookingService.counterSale` thêm:
```java
Long showtimeTheaterId = showtime.getRoom().getTheater().getId();
securityService.requireAccessToTheater(showtimeTheaterId);
```

BRANCH_ADMIN không bán vé cross-theater được nữa.

### 6.6. Booking ageRating auto-block

User profile có `dateOfBirth` (optional). `BookingService.holdSeats` thêm `validateAgeIfDOBSet`:
- DOB set + dưới min age → throw "Phim này yêu cầu từ X tuổi trở lên"
- DOB chưa set → FE confirm dialog xử lý

---

## 7. POS UX

### 7.1. POS bắt buộc chọn theater context

Trước: SUPER_ADMIN ở "Tất cả chi nhánh" có thể vào POS bán vé, showtime hiện toàn bộ rạp → click nhầm rạp khác, doanh thu sai.

Sau: `POSTheaterRequired` empty state — chuẩn Vista FilmAtSite:
- `currentTheater == null` → render "Chọn chi nhánh để vào POS" + arrow tới dropdown header
- BRANCH_ADMIN không thấy (JWT auto-set theater)
- SUPER_ADMIN buộc chọn 1 CN cụ thể

### 7.2. POS bán snack ẩn section trống

`POSPage` snack section render conditional:
- `snacks.length > 0` → render
- Cả `combos` + `snacks` rỗng → empty state "Chi nhánh chưa có món nào"
- Trước đó hiện "Đồ ăn lẻ (0)" trống lẻo

### 7.3. POS check-in 2-stage (preview → admit/reject)

Chuẩn Vista FilmAtSite — phim T13+ cần verify CCCD tại cổng:
1. Scan QR / nhập code → `GET /api/bookings/check-in/preview` (read-only)
2. Phim P/K → auto-admit
3. Phim T13+ → render preview card với badge tuổi + 2 nút "Đủ tuổi cho vào" / "Từ chối không đủ tuổi"
4. Click reject → `POST /api/bookings/check-in/reject` → status REJECTED + audit log

---

## 8. Frontend UI/UX

### 8.1. PriceWithRules component

Hiển thị giá gốc gạch ngang + giá final + chip rule áp dụng (chỉ chip giảm, ẩn chip tăng). Dùng ở 3 nơi:
- `MovieDetailPage` showtime card
- `SeatSelectionPage` `ShowtimeInfoCard`
- `BookingSummary`

### 8.2. AgeConfirmDialog

Phim T13/T16/T18 → dialog confirm "Tôi xác nhận đủ tuổi xem phim này" + thông báo mang CCCD. Pattern CGV/Lotte/BHD — pháp lý "nỗ lực hợp lý" verify tuổi.

### 8.3. Skeleton loaders

Thay spinner ở `HomePage`/`MovieDetailPage` bằng `MovieGridSkeleton`/`MovieDetailSkeleton` — pattern FB/YouTube/Shopee giảm perceived wait 30-40%.

### 8.4. Sticky table header admin

`TableHeader` mặc định `sticky top-0 z-10 bg-[#201b11]` — admin table 100+ row vẫn thấy cột khi scroll.

### 8.5. EmptyState refactor

`EmptyState` thêm props:
- `icon` (Lucide React, default Inbox)
- `description` optional
- `cta` optional với link hoặc onClick

Áp dụng FavoritesPage (icon Heart + CTA "Khám phá phim"), NotificationListPage (icon Bell).

### 8.6. Image lazy + Cloudinary WebP

`utils/image.ts` `cdnImage(url, width?)` inject Cloudinary transform `f_auto,q_auto,w_<n>,c_limit` → browser hiện đại auto WebP (-30% size).

Poster áp `loading="lazy"` + `decoding="async"`. Backdrop `fetchPriority="high"` cho LCP candidate.

### 8.7. Showtime form chained dropdown

`ShowtimeFormDialog` `useMovieRuns(movieId, theaterId)` — dropdown đợt chiếu filter theo chi nhánh đã chọn. Đổi chi nhánh → reset cả room và movieRunId.

---

## 9. Performance

### 9.1. @EntityGraph SnackOrder

`SnackOrderRepository.findAll(spec, pageable)` override với `@EntityGraph(attributePaths = ["theater", "items", "items.snack", "items.combo"])` — N+1 từ 100+ query → 1 query.

### 9.2. PricingEngine L2 cache

Caffeine cache resolve effective rules theo (theaterId, hour bucket). List 20 showtime cùng giờ chỉ resolve 1 lần thay vì 20.

### 9.3. HTTP gzip compression

`application.yml` `server.compression.enabled=true` mime-types JSON/text → -60-80% bandwidth.

### 9.4. Mailtrap per-dev credentials

`application-dev.yml` bỏ shared Mailtrap credentials. Mỗi dev tự register account riêng + set trong `application-local.yml` → không lẫn inbox chung.

---

## 10. Misc

### 10.1. Review admin pattern đồng bộ

`AdminReviewPage` trước chỉ có nút Xóa. Bây giờ pattern chuẩn module khác:
- StatusDropdown thay nút Xóa đơn (Archive/Restore)
- ReviewRow toggle nút theo storageState (ACTIVE → Trash2 đỏ, ARCHIVED → RotateCcw xanh)
- BE thêm `PUT /api/reviews/{id}/restore` + `ReviewService.restoreReview` (symmetric với delete)

### 10.2. POS theater bắt buộc trong PaymentService

Force-init lazy associations TRƯỚC khi publish `PaymentCompletedEvent` (commit `84102f9`):
```java
booking.getUser().getEmail();
booking.getShowtime().getMovie().getTitle();
// ...
eventPublisher.publishEvent(new PaymentCompletedEvent(this, payment));
```

Nếu không force init, @Async listener access lazy proxy ở thread khác → SQLException "The statement is closed" vì Hibernate Session đã commit + đóng.

### 10.3. PaymentEventListener structured logging

Refactor listener thành 3 step có try-catch riêng + log `[BOOKING_EMAIL]` tag:
1. Notification (DB write)
2. QR generation (ZXing)
3. Email send (Thymeleaf + SMTP)

Mỗi step fail không block step kia, log rõ ràng để debug.

---

## Tham khảo các file đã thay đổi

Liệt kê chính (xem `git log --since=2026-05-15` để đầy đủ):

- Schema: `001-008-*.xml`, `017-fix-system-config-encoding.xml`
- Pricing: `PricingEngine`, `ShowtimeResponse`, `PriceWithRules.tsx`
- Security: `SecurityConfig`, `RefreshTokenCookieUtil`, `EmailVerifyRateLimitService`
- Statistics: `StatisticsRepository`, `DashboardMovieRunsTable.tsx`, `DashboardOccupancyTable.tsx`
- POS: `TicketPOSPage.tsx`, `POSOrderSummary.tsx`, `CounterSaleRequest`
- Booking: `Booking.theater` field, `BookingService.validateAgeIfDOBSet`
- Review: `ReviewController` + Service + AdminReviewPage refactor

→ Đọc commit history qua: `git log --oneline backend/src/main/java/com/cinex/module/<module>/`
