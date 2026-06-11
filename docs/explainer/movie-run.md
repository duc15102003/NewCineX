# MovieRun — "Đợt chiếu" giải thích chi tiết

> **Mục đích:** giải thích vì sao CineX có entity `MovieRun` riêng (không nhét lifecycle vào `Movie`). Sau khi đọc bạn hiểu được tại sao Vista FilmAtSite / Veezi / CGV / Lotte cùng dùng pattern này.

---

## TL;DR

**MovieRun = "hợp đồng phát hành phim tại 1 rạp"** — phản ánh thực tế distributor và rạp ký với nhau từng đợt riêng. Mỗi đợt có deadline khác nhau, runType khác nhau (FIRST_RUN / REISSUE / FESTIVAL).

Sai lầm phổ biến: nghĩ `MovieRun` chỉ để hiển thị "Đang chiếu / Sắp chiếu". Đó chỉ là 1 trong 6 use case. Use case chính là **quản lý vòng đời thương mại** của phim.

---

## 1. Cấu trúc data

```
Movie (SHARED, không theater_id)              metadata bất biến (title, poster, duration, age_rating, ...)
   ↓ 1:N
MovieRun (PER-THEATER, có theater_id)         lifecycle: startDate, endDate, runType, status
   ↓ 1:N
Showtime (link 1 MovieRun cụ thể)             suất chiếu cụ thể trong room
   ↓ 1:N
Booking (snapshot theater_id immutable)       vé khách
```

**Đọc theo nghĩa:** *"Phim Avatar 3 (Movie shared) được chiếu tại rạp HN trong đợt FIRST_RUN từ 16/12 đến 30/01 (MovieRun HN), và tại rạp SG trong đợt cùng tên kéo dài đến 28/02 (MovieRun SG)."*

---

## 2. endDate NULL nghĩa là gì?

`endDate NULL` = đợt chiếu open-ended, KHÔNG phải "sắp chiếu mãi". Status phụ thuộc `startDate vs today`:

| Setup | Hôm nay 10/06/2026 | Status |
|---|---|---|
| startDate=01/06/26, endDate=NULL | today ≥ startDate | **NOW_SHOWING** vĩnh viễn (cho tới khi admin archive tay) |
| startDate=20/06/26, endDate=NULL | today < startDate | **COMING_SOON** cho tới 20/06 |
| startDate=20/06/26, endDate=05/07/26 | today < startDate | COMING_SOON → NOW_SHOWING → ENDED |
| startDate=01/06/26, endDate=05/06/26 | today > endDate | **ENDED** |

**Use case `endDate NULL`:** phim trẻ em chiếu lâu dài (Tom & Jerry, Doraemon), arthouse (Spirited Away định kỳ), classic film định kỳ.

---

## 3. Sáu use case của MovieRun (KHÔNG chỉ để hiển thị status)

Setup chung: hôm nay = 10/06/2026, phim "Avatar 3" (`movie_id=7`).

### Case 1: Status hiển thị FE (cái user nghĩ tới đầu tiên)

```
movie_runs
┌─────┬──────────┬──────────┬───────────┬──────────┬──────────┐
│ id  │ movie    │ theater  │ runType   │ startDate│ endDate  │
├─────┼──────────┼──────────┼───────────┼──────────┼──────────┤
│ 201 │ Avatar 3 │ CGV-HN   │ FIRST_RUN │ 01/06/26 │ 31/07/26 │ → today 10/06 trong range → NOW_SHOWING
│ 202 │ Avatar 3 │ CGV-SG   │ FIRST_RUN │ 20/06/26 │ 15/08/26 │ → today 10/06 < 20/06 → COMING_SOON
│ 203 │ Avatar 3 │ CGV-DN   │ FIRST_RUN │ 01/05/26 │ 31/05/26 │ → today 10/06 > 31/05 → ENDED
└─────┴──────────┴──────────┴───────────┴──────────┴──────────┘
```

User vào trang chủ 10/06:
- Chọn rạp HN → Avatar 3 hiện "Đang chiếu"
- Chọn rạp SG → Avatar 3 hiện "Sắp chiếu"
- Chọn rạp DN → Avatar 3 không hiện (đã kết thúc)

### Case 2: Validation tạo Showtime

Admin CGV-HN muốn tạo suất 22:00 ngày 05/08/2026:
1. BE tìm MovieRun: `movie_id=7 AND theater=CGV-HN AND startDate ≤ 05/08 AND (endDate IS NULL OR endDate ≥ 05/08)`
2. MovieRun #201 endDate=31/07 → KHÔNG match
3. BE throw: "Đợt chiếu không bao trùm ngày này. Vui lòng gia hạn endDate hoặc tạo đợt HOLDOVER."

Admin có 2 lựa chọn:
- Gia hạn: sửa MovieRun #201 endDate=31/08
- Tạo đợt mới HOLDOVER 01/08 → 31/08

→ Không có MovieRun, BE không có cơ sở chặn showtime "ma" sau khi phim không còn chiếu.

### Case 3: Reporting per-đợt-chiếu

Distributor Disney hỏi cuối Q3/26: *"Đợt FIRST_RUN Avatar 3 tại CGV-HN thu được bao nhiêu?"*

```sql
SELECT COUNT(*) AS tickets, SUM(b.total_amount) AS revenue
FROM bookings b
JOIN showtimes s ON b.showtime_id = s.id
WHERE s.movie_run_id = 201 AND b.status = 'CONFIRMED';
```

→ Trả về đúng doanh thu đợt 16/12-30/01. Không có MovieRun → chỉ có movie_id + theater_id, không tách được đợt nào.

### Case 4: Distributor tracking lifecycle

Cuối năm 2027, Disney xem toàn bộ vòng đời Avatar 3:

```sql
SELECT * FROM movie_runs WHERE movie_id = 7 ORDER BY startDate;
```

| id | theater | runType | startDate | endDate | status | mô tả |
|---|---|---|---|---|---|---|
| 203 | DN | FIRST_RUN | 01/05/26 | 31/05/26 | ENDED | Pilot Đà Nẵng |
| 201 | HN | FIRST_RUN | 01/06/26 | 31/07/26 | ENDED | Mở rộng HN — 2 tháng |
| 202 | SG | FIRST_RUN | 20/06/26 | 15/08/26 | ENDED | SG — kéo dài hơn |
| 401 | HN | REISSUE | 01/12/26 | 15/12/26 | ENDED | Giáng Sinh |
| 402 | SG | REISSUE | 01/12/26 | 15/12/26 | ENDED | Cùng đợt SG |

Disney biết ngay: Avatar 3 đã chiếu 5 đợt qua 1 năm, mỗi đợt độc lập. Không có MovieRun → Disney không biết CineX đã chiếu lại lần 2.

### Case 5: Phim chiếu lại (REISSUE)

Tháng 11/26 Disney bảo: "Cho rạp chiếu lại Avatar 3 bản 4DX Giáng Sinh".

```sql
INSERT INTO movie_runs (movie_id, theater_id, runType, startDate, endDate)
VALUES (7, CGV-HN, 'REISSUE', '2026-12-01', '2026-12-15');
```

- INSERT mới — đợt cũ #201 (FIRST_RUN) KHÔNG bị touch
- Status #201 vẫn ENDED (lịch sử preserved)
- Status #401 mới: 01/12 < startDate → COMING_SOON → NOW_SHOWING → ENDED

User 25/11/26 thấy Avatar 3 ở tab "Sắp chiếu" với badge "REISSUE — Bản 4DX, từ 01/12".

→ Không có MovieRun, để chiếu lại phải overwrite startDate cũ (mất history) hoặc duplicate Movie (metadata trùng).

### Case 6: Cross-theater independence

Avatar 3 đang chiếu khác lịch:
- #201 CGV-HN FIRST_RUN  01/06 → 31/07
- #202 CGV-SG FIRST_RUN  20/06 → 15/08

**Ngày 05/08/26:**
- User HN: trang chủ → KHÔNG có Avatar 3 (run HN ENDED 31/07). Click trực tiếp link → "Đã kết thúc chiếu tại CGV Vincom HN".
- User SG: trang chủ → VẪN có Avatar 3 (run SG còn tới 15/08). Click đặt vé → có suất.

**Cùng phim, cùng thời điểm, 2 user thấy 2 trạng thái khác nhau — đúng thực tế.**

**Ngày 16/08/26:** Cả 2 đều ENDED → Avatar 3 biến mất khỏi "Đang chiếu" toàn quốc. REISSUE cuối năm → MovieRun #401 INSERT → lại xuất hiện trong "Sắp chiếu".

→ Không có MovieRun per-theater → chỉ 1 status global → SG mất 2 tuần doanh thu hoặc HN bị admin quên dừng.

---

## 4. RunType — phân loại đợt chiếu

```java
public enum MovieRunType {
    FIRST_RUN,  // Lần đầu công chiếu (Avatar 3 FIRST_RUN 16/12/22 → 30/01/23)
    REISSUE,    // Chiếu lại (Titanic 1997 → Titanic 25th Anniversary 2023)
    FESTIVAL,   // Tuần liên hoan phim (Liên Hoan Phim Pháp tại CGV HN)
    SPECIAL     // Đợt chiếu đặc biệt (Premiere, Sneak peek)
}
```

Distributor commission khác nhau theo runType:
- FIRST_RUN: 60/40 (rạp / distributor)
- REISSUE: 50/50
- FESTIVAL: thường free hoặc 80/20

Báo cáo `/api/statistics/top-movie-runs` group theo runType → kế toán dễ chia.

---

## 5. MovieRunStatus — lifecycle scheduler

```java
public enum MovieRunStatus {
    SCHEDULED,    // today < startDate
    NOW_SHOWING,  // startDate ≤ today ≤ endDate (hoặc endDate NULL)
    ENDED         // today > endDate
}
```

`MovieRunStatusScheduler` chạy `@Scheduled(cron = "0 1 0 * * *")` (00:01 mỗi ngày):
1. SCHEDULED → NOW_SHOWING nếu startDate ≤ today
2. NOW_SHOWING → ENDED nếu endDate < today (endDate NULL không apply)

Sử dụng `@SchedulerLock` (ShedLock) để multi-instance không double-update.

---

## 6. Tham khảo code

| File | Vai trò |
|---|---|
| `module/movie/entity/MovieRun.java` | Entity với theater_id NOT NULL |
| `module/movie/entity/MovieRunType.java` | Enum 4 giá trị |
| `module/movie/entity/MovieRunStatus.java` | Enum lifecycle |
| `module/movie/service/MovieRunService.java` | CRUD + scope validation |
| `module/movie/service/MovieStatusComputer.java` | Compute `Movie` derived status từ MovieRun list (sau khi drop Movie.status) |
| `module/movie/service/MovieRunStatusScheduler.java` | Cron tự update status |
| `module/movie/specification/MovieSpecification.java` | hasActiveShowtimes (filter "Đang chiếu") + hasUpcomingRuns ("Sắp chiếu") |

---

## 7. Câu hỏi thường gặp

**Q: Tại sao Movie không có status?**
A: Status là DERIVED — phụ thuộc (theaterId, today, MovieRun list). User HN xem ngày 05/08 vs user SG xem ngày 05/08 status khác. Không thể lưu 1 giá trị duy nhất trong `movies.status`.

**Q: Vậy compute status ở đâu?**
A: `MovieStatusComputer.compute(movieId, theaterId)` gọi runtime trong `MovieMapper`. Cache có thể thêm sau nếu cần performance.

**Q: REISSUE thì poster có thay đổi không?**
A: Có thể. `Movie.posterUrl` là metadata bất biến — nếu Disney cấp poster REISSUE 4K khác → 2 lựa chọn:
- Giữ poster gốc (Movie 1 row), distinguish qua MovieRun.notes
- Tạo `Movie` mới ("Avatar 3 4DX REISSUE") — sai vì không phải phim mới

CineX hiện chọn giữ 1 Movie. FE distinguish qua badge runType.

**Q: Phim mới chưa có MovieRun thì status hiện gì?**
A: `MovieStatusComputer` trả về `ENDED` (default). FE list không hiện ở "Đang chiếu" / "Sắp chiếu". Đợi admin tạo MovieRun đầu tiên → status sẽ thành COMING_SOON hoặc NOW_SHOWING.
