# CineX — Tài liệu dự án

> **Dự án:** Hệ thống đặt vé xem phim online + POS đa chi nhánh (đồ án tốt nghiệp).
> **Mục tiêu của docs:** dạy được **người chưa biết gì** từ con số 0 đến chỗ tự code feature, không chỉ copy-paste.
> **Cập nhật mới nhất:** 2026-06-10 — xem [CHANGELOG-2026-06.md](CHANGELOG-2026-06.md) cho mọi refactor gần đây.

---

## 🆕 ĐỌC TRƯỚC nếu là dev mới (2026-06)

Dự án trải qua nhiều refactor lớn tháng 6/2026. 3 file foundation bắt buộc đọc đầu tiên:

| # | File | Mục đích | Thời gian |
|---|---|---|---|
| 1 | [00-quick-start.md](00-quick-start.md) | **Setup A-Z** clone → docker up → bootRun → npm dev → login test. Có tài khoản test + cheat sheet. | 30 phút |
| 2 | [00-tech-stack.md](00-tech-stack.md) | **Inventory** đầy đủ BE/FE/Infra (Spring Boot 3.3, React 19, Caffeine, Redis, Liquibase 17 files, ...) | 15 phút |
| 3 | [CHANGELOG-2026-06.md](CHANGELOG-2026-06.md) | **Tổng hợp refactor** gần đây: Movie.status drop, MovieRun per-theater, Booking.theater, HttpOnly cookie, POS đa method, statistics widgets, age rating C bỏ, ... | 20 phút |

→ Sau khi đọc 3 file này, chạy được local + biết các module guide cũ phần nào chưa update.

---

## ⚡ Quick Start (5 phút legacy)

Bạn đang lần đầu mở repo này? Làm đúng 3 bước sau, không lan man:

1. **Đọc 1 sơ đồ:** `project/business-flow.md` mục "Luồng đặt vé chính" (≈ 5 phút). Sau khi đọc xong bạn phải trả lời được câu này: *"Một khách hàng từ lúc mở web đến lúc nhận vé QR cần đi qua bao nhiêu trang? Tên các trang đó là gì?"*
2. **Chạy được dự án local:** làm theo [00-quick-start.md](00-quick-start.md) (mới — chuẩn 2026-06). Phải mở được `http://localhost:5173` và đăng nhập được tài khoản `admin / CineX@2026`.
3. **Mở 1 file code thực tế:** `backend/src/main/java/com/cinex/module/movie/controller/MovieController.java`. Đọc qua, không cần hiểu hết. Sau khi đọc xong bạn phải trả lời được: *"File này có bao nhiêu endpoint? Có annotation nào lạ?"*

Sau 3 bước trên bạn đã có **bản đồ tổng thể**. Giờ mới đến phần đọc sâu.

---

## 🗺️ Bản đồ tư duy: Khi nào đọc cái nào?

```
┌──────────────────────────────────────────────────────────────────┐
│   GIAI ĐOẠN 1 — TRƯỚC KHI CODE (BẮT BUỘC)                        │
│   Mục tiêu: hiểu dự án + chạy được local                          │
│   Thời gian: ~1.5 giờ                                             │
│   Đọc: Phần A bên dưới                                            │
└──────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│   GIAI ĐOẠN 2 — HỌC NỀN TẢNG (TRƯỚC KHI ĐỌC CODE)                 │
│   Mục tiêu: hiểu các khái niệm (JPA, Security, React, hook...)    │
│   Thời gian: ~30-40 giờ (đọc dần, không đọc 1 hơi)               │
│   Đọc: Phần B bên dưới — chỉ đọc cái BẠN CẦN, không bắt buộc hết. │
└──────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│   GIAI ĐOẠN 3 — LÀM FEATURE (KHI NHẬN TASK)                       │
│   Mục tiêu: đọc module-guide của feature bạn đang code            │
│   Thời gian: 30 phút/module                                       │
│   Đọc: Phần C bên dưới — chỉ đọc module bạn đang đụng vào.        │
└──────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│   KHI GẶP BUG / HỌC SÂU                                            │
│   Đọc: Phần D bên dưới (pitfalls, common-mistakes, glossary)      │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📚 Phần A — TRƯỚC KHI CODE (BẮT BUỘC, ~1.5 giờ)

5 file này phải đọc theo đúng thứ tự. Đọc xong bạn mới hiểu dự án làm gì + chạy được local.

| # | File | Nội dung | Thời gian | Outcome sau khi đọc |
|---|---|---|---|---|
| 1 | [project/business-flow.md](project/business-flow.md) | Dự án làm gì, luồng đặt vé, vai trò USER/ADMIN | 15p | Vẽ được sơ đồ luồng đặt vé từ memory |
| 2 | [project/architecture.md](project/architecture.md) | Kiến trúc 4 lớp Controller → Service → Repo → DB | 10p | Trả lời: Controller có chứa business logic không? Tại sao? |
| 3 | [project/erd.md](project/erd.md) | Sơ đồ database 15 bảng | 20p | Vẽ được sơ đồ: User ↔ Booking ↔ BookingSeat ↔ Seat |
| 4 | [project/setup.md](project/setup.md) | Cài đặt + chạy local | 30p | Mở `localhost:5173`, đăng nhập admin |
| 5 | [project/git-guide.md](project/git-guide.md) | Git workflow, PR convention | 10p | Tạo được nhánh `feature/test`, commit, push |

**⚠️ Đừng skip bước này.** Người mới hay nhảy thẳng vào code → không hiểu tại sao có Controller / Service / Repo → viết business logic nhầm vào Controller → toàn bộ project ngược kiến trúc.

---

## 📖 Phần B — HỌC NỀN TẢNG (đọc khi cần, ~30-40h)

Đây là phần **tham khảo dài hạn**. Bạn KHÔNG cần đọc hết 1 lượt — chỉ đọc cái bạn đang vướng.

### B1. Backend (20 files)

> **Đọc theo thứ tự nếu chưa biết Spring Boot.** Nếu đã quen, nhảy file 02-jpa-hibernate.md trở đi.

| # | File | Nội dung | Cần biết trước | Khi nào đọc? |
|---|---|---|---|---|
| 0a | [backend/00-java-spring-fundamentals.md](backend/00-java-spring-fundamentals.md) | Java cơ bản, JVM, JAR | — | Khi không phân biệt được Java vs JVM |
| 0b | [backend/00-spring-boot-from-scratch.md](backend/00-spring-boot-from-scratch.md) | Tạo project Spring Boot từ 0 | Java cơ bản | Khi setup project lần đầu |
| 1 | [backend/01-spring-boot-basics.md](backend/01-spring-boot-basics.md) | `@Component`, `@Service`, `@Repository`, IoC | Spring cơ bản | Khi không hiểu Bean là gì |
| 2 | [backend/02-jpa-hibernate.md](backend/02-jpa-hibernate.md) | Entity, `@ManyToOne`, Lazy/Eager | Spring Boot | Khi đụng vào Entity |
| 3 | [backend/03-security.md](backend/03-security.md) | JWT, BCrypt, SecurityFilterChain | JPA | Khi code chức năng login |
| 4 | [backend/04-spring-features.md](backend/04-spring-features.md) | `@Transactional`, `@Scheduled`, AOP | Spring Boot | Khi cần transaction hoặc cron job |
| 5 | [backend/05-lombok.md](backend/05-lombok.md) | `@Getter`, `@Builder` — viết ít code | Java | Khi nhìn `@Builder` lạ |
| 6 | [backend/06-swagger.md](backend/06-swagger.md) | Swagger UI test API | Spring Boot | Khi cần test endpoint |
| 7 | [backend/07-gradle.md](backend/07-gradle.md) | Build tool, lệnh build/run | Java | Khi build fail |
| 8 | [backend/08-redis.md](backend/08-redis.md) | Cache, TTL, cache-aside | Spring Boot | Khi đụng vào cache |
| 9 | [backend/09-email-cloudinary-qr.md](backend/09-email-cloudinary-qr.md) | Email, upload ảnh, QR code | Spring Boot | Khi code chức năng gửi email / upload |
| 10 | [backend/10-websocket.md](backend/10-websocket.md) | WebSocket STOMP, SockJS | Spring Boot | Khi code chức năng real-time |
| 11 | [backend/11-testing.md](backend/11-testing.md) | JUnit 5, Mockito | Spring Boot | Khi viết test |
| 12 | [backend/12-mapstruct.md](backend/12-mapstruct.md) | MapStruct mapper Entity ↔ DTO compile-time | JPA + Lombok | Khi viết mapper |
| 13 | [backend/13-deployment.md](backend/13-deployment.md) | Dockerfile prod, Nginx, SSL | Docker + Spring | Khi deploy lần đầu |
| 14 | [backend/14-observability.md](backend/14-observability.md) | Logging, MDC, Actuator | Spring Boot | Khi debug production |
| 15 | [backend/15-common-pitfalls.md](backend/15-common-pitfalls.md) | 20 bug Spring hay gặp | JPA + Spring | **Đọc thuộc — sẽ tránh được 80% bug** |
| 16 | [backend/16-architectural-patterns.md](backend/16-architectural-patterns.md) | Layered, multi-tenant, event-driven | Spring + JPA | Khi học kiến trúc tổng thể |
| 17 | [backend/17-design-patterns-catalog.md](backend/17-design-patterns-catalog.md) | Bảng catalog GoF patterns trong CineX | OOP + Spring | Khi cần tham chiếu pattern |
| 18 | [backend/18-shedlock.md](backend/18-shedlock.md) | ShedLock — distributed lock cho `@Scheduled` đa instance | `@Scheduled` | Khi deploy nhiều instance |
| 19 | [backend/19-thymeleaf-email.md](backend/19-thymeleaf-email.md) | Thymeleaf template engine cho email HTML | Spring Boot + email | Khi viết template email |
| 20 | [backend/20-bean-validation.md](backend/20-bean-validation.md) | `@Valid` + `@NotBlank` + custom validator | Spring Boot | Khi viết DTO mới |

### B2. Database (3 files)

| # | File | Nội dung | Khi nào đọc? |
|---|---|---|---|
| 1 | [database/01-database-techniques.md](database/01-database-techniques.md) | Optimistic/Pessimistic Lock, N+1, Index | Khi gặp race condition / query chậm |
| 2 | [database/02-liquibase-guide.md](database/02-liquibase-guide.md) | Quản lý schema, changelog | Khi thêm bảng mới |
| 3 | [database/03-id-tracker.md](database/03-id-tracker.md) | Sinh mã `CX-20260520-001` | Khi cần code tự sinh |

### B3. Design Patterns (4 files)

Đọc **song song** với module-guides (Phần C). Mỗi khi module guide nói "Strategy Pattern", quay lại đây đọc lại.

| # | File | Nội dung |
|---|---|---|
| 1 | [design-patterns/01-creational-patterns.md](design-patterns/01-creational-patterns.md) | Builder, Factory, Singleton |
| 2 | [design-patterns/02-structural-patterns.md](design-patterns/02-structural-patterns.md) | DTO, Adapter, Facade |
| 3 | [design-patterns/03-behavioral-patterns.md](design-patterns/03-behavioral-patterns.md) | Strategy, Observer, State |
| 4 | [design-patterns/04-solid-principles.md](design-patterns/04-solid-principles.md) | S.O.L.I.D |

### B4. Docker (1 file)

| # | File | Nội dung | Khi nào đọc? |
|---|---|---|---|
| 1 | [docker/01-docker-guide.md](docker/01-docker-guide.md) | Image, Container, Compose, Volume | Trước khi deploy |

### B5. Frontend (24 files)

**Tiền điều kiện** — bắt buộc đọc nếu chưa biết gì FE:

| # | File | Nội dung |
|---|---|---|
| P1 | [frontend/pre-01-html-css-basics.md](frontend/pre-01-html-css-basics.md) | HTML, CSS, flexbox |
| P2 | [frontend/pre-02-javascript-essentials.md](frontend/pre-02-javascript-essentials.md) | JS cơ bản, async/await |
| P3 | [frontend/pre-03-http-api-basics.md](frontend/pre-03-http-api-basics.md) | HTTP, REST, JSON |
| P4 | [frontend/pre-04-typescript-utility-types.md](frontend/pre-04-typescript-utility-types.md) | Partial, Pick, Omit |

**Framework knowledge** — đọc theo thứ tự:

| # | File | Nội dung | Cần biết trước |
|---|---|---|---|
| 0a | [frontend/00-react-vite-from-scratch.md](frontend/00-react-vite-from-scratch.md) | Tạo project React + Vite từ 0 | JavaScript (P2) |
| 0b | [frontend/00-typescript-basics.md](frontend/00-typescript-basics.md) | TypeScript: type, interface, generic | JavaScript |
| 1 | [frontend/01-react-basics.md](frontend/01-react-basics.md) | Component, useState, hook | TypeScript |
| 2 | [frontend/02-react-router.md](frontend/02-react-router.md) | Routes, Link, useNavigate | React |
| 3 | [frontend/03-tanstack-query.md](frontend/03-tanstack-query.md) | useQuery, useMutation, cache | React |
| 4 | [frontend/04-zustand-state.md](frontend/04-zustand-state.md) | State management | React |
| 5 | [frontend/05-tailwind-css.md](frontend/05-tailwind-css.md) | Utility classes | — |
| 6 | [frontend/06-form-validation.md](frontend/06-form-validation.md) | react-hook-form + Zod | React |
| 7 | [frontend/07-axios-api.md](frontend/07-axios-api.md) | HTTP client, JWT interceptor | React + API |
| 8 | [frontend/08-shadcn-ui.md](frontend/08-shadcn-ui.md) | Component library | React + Tailwind |
| 9 | [frontend/09-project-config-files.md](frontend/09-project-config-files.md) | package.json, vite.config | — |
| 10 | [frontend/10-how-frontend-works.md](frontend/10-how-frontend-works.md) | Tổng quan FE: SPA, lifecycle | Tất cả FE |
| 11 | [frontend/11-cinex-project-structure.md](frontend/11-cinex-project-structure.md) | Cấu trúc `src/` | Tất cả FE |
| 12 | [frontend/12-auth-flow-explained.md](frontend/12-auth-flow-explained.md) | Login → token → ProtectedRoute | React + Axios + Zustand |
| 13 | [frontend/13-movie-feature-explained.md](frontend/13-movie-feature-explained.md) | Movie pages, search debounce | TanStack Query |
| 14 | [frontend/14-booking-websocket-explained.md](frontend/14-booking-websocket-explained.md) | Booking + WebSocket real-time | Tất cả FE |
| 15 | [frontend/15-react-pitfalls.md](frontend/15-react-pitfalls.md) | 18 bug React/TS/Tailwind | React |
| 16 | [frontend/16-performance-optimization.md](frontend/16-performance-optimization.md) | memo, code split, Web Vitals | React |
| 17 | [frontend/17-testing-frontend.md](frontend/17-testing-frontend.md) | Vitest + RTL + MSW | React |
| 18 | [frontend/18-cookbook.md](frontend/18-cookbook.md) | Recipes: debounce, upload, toast | React |
| 19 | [frontend/19-admin-tools.md](frontend/19-admin-tools.md) | Recharts + xlsx/jspdf export + html5-qrcode + Sonner | React + admin pages | Khi code admin dashboard / report / check-in |

---

## 📦 Phần C — LÀM FEATURE (đọc khi nhận task)

Khi bạn nhận task code module nào, mở đúng file đó. Mỗi file có cấu trúc 9 phần chuẩn (Tổng quan / Files / Design Patterns / Sơ đồ luồng / Khái niệm mới / Annotation / SQL sinh ra / Request-Response mẫu / Câu hỏi tự kiểm tra).

**Thứ tự học** — module trước là prerequisite cho module sau:

| # | File | Module | Cần biết trước |
|---|---|---|---|
| 01 | [module-guides/01-common-infra-explained.md](module-guides/01-common-infra-explained.md) | AuditLog, SystemConfig, FileUpload | Spring Boot + JPA |
| 02 | [module-guides/02-auth-explained.md](module-guides/02-auth-explained.md) | Login, JWT, BCrypt, Refresh Token | Common Infra + Security |
| 03 | [module-guides/03-user-explained.md](module-guides/03-user-explained.md) | Profile, Avatar, `@PreAuthorize` | Auth |
| 04 | [module-guides/04-filter-specification-explained.md](module-guides/04-filter-specification-explained.md) | Filter + Specification — pattern chung | JPA + Spring Boot |
| 05 | [module-guides/05-movie-explained.md](module-guides/05-movie-explained.md) | CRUD phim, N:N Genre | Filter |
| 06 | [module-guides/06-room-explained.md](module-guides/06-room-explained.md) | CRUD phòng chiếu | Filter |
| 07 | [module-guides/07-seat-explained.md](module-guides/07-seat-explained.md) | Sơ đồ ghế, generate | Room |
| 08 | [module-guides/08-showtime-explained.md](module-guides/08-showtime-explained.md) | Suất chiếu, check trùng giờ | Movie + Room |
| 09 | [module-guides/09-booking-explained.md](module-guides/09-booking-explained.md) | Hold ghế, QR, Scheduler | Showtime + Seat |
| 10 | [module-guides/10-payment-explained.md](module-guides/10-payment-explained.md) | Factory, Strategy, Observer | Booking |
| 11 | [module-guides/11-review-explained.md](module-guides/11-review-explained.md) | Đánh giá, AVG rating | Movie + User |
| 12 | [module-guides/12-snack-explained.md](module-guides/12-snack-explained.md) | Snack, snapshot price | Booking |
| 13 | [module-guides/13-notification-explained.md](module-guides/13-notification-explained.md) | Thông báo, Observer | Payment |
| 14 | [module-guides/14-favorite-explained.md](module-guides/14-favorite-explained.md) | Phim yêu thích | Movie + User |
| 15 | [module-guides/15-statistics-explained.md](module-guides/15-statistics-explained.md) | Báo cáo, aggregate, export | Booking + Payment |
| 15b | [module-guides/15-theater-explained.md](module-guides/15-theater-explained.md) | Theater + multi-tenant scope | Auth + Common Infra |
| 16 | [module-guides/16-pricing-explained.md](module-guides/16-pricing-explained.md) | PricingRule + PricingEngine + cache | Movie + Showtime |
| 17 | [module-guides/17-loyalty-explained.md](module-guides/17-loyalty-explained.md) | Điểm thưởng, expiration, redeem | Booking + Payment |
| 18 | [module-guides/18-combo-explained.md](module-guides/18-combo-explained.md) | Combo bắp/nước, snapshot price | Snack |
| 19 | [module-guides/19-voucher-explained.md](module-guides/19-voucher-explained.md) | Voucher PERCENTAGE/FIXED, multi-tenant, optimistic lock usedCount | Booking |

**Mẹo nhỏ:** Đọc module guide trước khi nhìn code, bạn sẽ tiết kiệm 50% thời gian hiểu code.

---

## 🐛 Phần D — KHI GẶP BUG hoặc HỌC SÂU

| Tình huống | Đọc file |
|---|---|
| Bug Spring (LazyInit, N+1, `@Transactional` không chạy...) | [backend/15-common-pitfalls.md](backend/15-common-pitfalls.md) |
| Bug React (stale closure, StrictMode, dynamic class...) | [frontend/15-react-pitfalls.md](frontend/15-react-pitfalls.md) |
| Bug chung (BE + FE + DB) | [common-mistakes.md](common-mistakes.md) |
| Quên 1 thuật ngữ | [glossary.md](glossary.md) |
| Cần test cases | [test-cases.md](test-cases.md) |
| Xem dự án đã làm được gì | [features-completed.md](features-completed.md) |

---

## 🔎 Phần D-bis — EXPLAINER concept sâu (mới 2026-06)

Các concept lớn mới apply tháng 6/2026 có file explainer riêng — đào sâu hơn module guide, đi vào "vì sao chọn pattern này", "rạp công nghiệp làm như nào".

| File | Concept | Khi nào đọc? |
|---|---|---|
| [explainer/movie-run.md](explainer/movie-run.md) | MovieRun = "hợp đồng phát hành phim tại 1 rạp" — 6 use case (status, validate showtime, reporting, distributor lifecycle, REISSUE, cross-theater) | Khi đụng vào module Movie/Showtime |
| [explainer/security-hardening.md](explainer/security-hardening.md) | 6 lớp bảo mật: secrets, rate-limit, HttpOnly cookie, OWASP headers, JSON strict, multi-tenant guards + checklist production | Trước khi deploy hoặc khi review security |
| [explainer/age-rating.md](explainer/age-rating.md) | TT 25/2024 (P/K/T13/T16/T18 — bỏ C) + 3-tier enforcement (FE dialog → BE auto-block DOB → POS reject vật lý) | Khi code phim/booking/check-in |
| [explainer/caching-strategy.md](explainer/caching-strategy.md) | Caffeine + Redis 2-tier — 4 chiến lược invalidation + 3 anti-pattern tránh + monitor hit-rate | Khi optimize performance |
| [explainer/pricing-engine.md](explainer/pricing-engine.md) | Strategy + Composite + cache 2-tier — "What You See Is What You Pay" + hide surge badge chuẩn rạp VN | Khi đụng vào pricing/booking |
| [explainer/drag-paint-pattern.md](explainer/drag-paint-pattern.md) | Giữ chuột để vẽ cells (Seat Map Editor) — vanilla Mouse Events + state machine + 6 bẫy phổ biến + mini Photoshop pattern | Khi build visual editor / grid paint |

---

## 🎓 Phần E — HỌC SÂU ĐỂ DẠY LẠI (advanced)

Báo cáo audit gần nhất (`00-audit-knowledge-gaps.md`) chỉ ra 7 file P1 + 50 file P2 còn thiếu kiến thức cho người chưa biết gì. Khi các file đó được expand xong, bạn sẽ có:

- Mọi khái niệm đều có **ví dụ đời thường** (analogy)
- Mọi pattern đều có **before-after code** (xấu vs tốt)
- Mọi annotation đều có **⚠️ anti-pattern cảnh báo**
- Mọi file có **quiz cuối bài** để tự kiểm tra

**Theo dõi tiến độ expand:** xem `00-audit-knowledge-gaps.md` mục 9.

---

## ❓ FAQ cho người mới

**Q: Tôi không biết Java, có học được không?**
→ Đọc `backend/00-java-spring-fundamentals.md` trước. Khoảng 1 tuần là đủ để bắt đầu code feature đơn giản (CRUD).

**Q: Tôi không biết React, có học được không?**
→ Đọc pre-01 → pre-04 → frontend/01 → frontend/03. Khoảng 2 tuần là đủ.

**Q: Đọc 75 files docs này hết bao lâu?**
→ KHÔNG đọc hết 1 lượt. Đọc Phần A (1.5h) trước, rồi đọc Phần B/C khi cần. Ai cố đọc hết 1 lần sẽ quên hết.

**Q: Tôi gặp bug X, đọc file nào?**
→ Mở `common-mistakes.md` (Phần D) hoặc `glossary.md` để tra thuật ngữ.

**Q: Code mẫu trong docs có chạy được không?**
→ Có. Mọi snippet đều được copy từ codebase thực tế. Có vài file có ghi `file:line` để bạn truy về source.

**Q: Sao docs nhiều thế?**
→ Vì mục tiêu của dự án này là **đồ án tốt nghiệp + dạy lại sinh viên khác**, không chỉ "làm xong là thôi". Bạn không cần đọc hết — đọc khi cần.

---

## 📞 Liên hệ / Báo lỗi

Nếu bạn thấy file nào:
- Khái niệm khó hiểu / thiếu ví dụ → ghi lại vào issue, hoặc bổ sung trực tiếp
- Code mẫu không khớp với codebase → ghi rõ `file:line` đã lệch
- Thuật ngữ thiếu trong `glossary.md` → bổ sung

**Quy tắc đóng góp:** mỗi PR docs phải tuân thủ:
- Tiếng Việt có dấu
- Có ví dụ đời thường cho khái niệm mới
- Có before-after code khi nói về pattern
- Có quiz cuối bài (tối thiểu 3 câu)
