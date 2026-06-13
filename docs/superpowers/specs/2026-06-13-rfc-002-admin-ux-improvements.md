# RFC-002: Admin UX Improvements — Seat Grid Resize + Showtime Calendar + Auto-Schedule

**Author**: VuTuongAn (qua Claude)
**Date**: 2026-06-13
**Status**: Draft — pending review
**Reviewers**: Self
**Decision deadline**: 2026-06-20

> **TL;DR**: User feedback admin UI chưa thân thiện. RFC này propose 3 cải tiến lớn: (1) SeatMapEditor cho tùy chỉnh số row/col, (2) AdminShowtime đổi sang calendar/timeline view chuẩn CGV/Lotte, (3) Auto-schedule feature cho phép tạo hàng loạt suất chiếu 1 click thay vì thủ công từng giờ.

---

## 1. Summary

3 cải tiến UX cho admin:

| ID | Feature | Effort | Priority |
|---|---|---|---|
| **T2.2** | SeatMapEditor: tùy chỉnh row/col + save grid | 4-6h | High |
| **T3** | AdminShowtime: calendar/timeline view | 8-12h | Highest |
| **T4** | Auto-schedule bulk create suất chiếu | 6-10h | Highest |

Tổng effort: 18-28h. Có thể chia 3 PR riêng.

---

## 2. Motivation

### 2.1 Current state (đã verify)

**SeatMapEditor (`/admin/rooms/:id/seats`)**:
- Đã thu nhỏ ghế 22% (commit `7fac42b`).
- KHÔNG có cách tăng/giảm số row/col từ trong editor.
- User phải vào trang Room → edit form → save → quay lại editor (3 click).

**AdminShowtime (`/admin/showtimes`)**:
- Hiện flat list table — 10 dòng/page sort `createdAt DESC`.
- KHÔNG có view theo ngày/tuần (calendar).
- Admin khó scan "phòng A1 ngày 13/06 có suất nào lúc mấy giờ".

**Tạo suất chiếu** (`ShowtimeFormDialog`):
- Tạo từng suất 1 — chọn phim, phòng, ngày, giờ.
- 1 phòng chiếu 5 suất/ngày × 5 phòng × 7 ngày = **175 lần click form**.
- Không thực tế cho real cinema (CGV mỗi rạp ~50-100 suất/ngày).

### 2.2 Industry research — CGV/Lotte/Beta Cinemas

**Admin tools rạp thực tế** (qua nghiên cứu admin panel của Vista Veezi, Cinetixx, RTS):

#### 1. Showtime view
- **Calendar grid**: trục Y = rooms, trục X = thời gian (24h).
- Mỗi suất chiếu = block màu trong grid theo (room, start, duration).
- Drag-and-drop để move suất.
- Conflict (chồng suất) hiện đỏ ngay.

#### 2. Bulk operations
- **"Template" mode**: lưu lịch chiếu mẫu (vd Monday template) → apply cho ngày khác.
- **"Replicate" mode**: tạo lịch ngày X → copy y chang sang ngày Y, Z, ...
- **"Auto-schedule"**: chọn phim + range giờ + buffer → engine tự xếp slot.

#### 3. SeatMap editor
- Vista Veezi cho thêm row/col real-time với preview.
- Drag handles ở mép phòng để extend.
- Auto-numbering khi thêm.

### 2.3 Why now

- Project sẵn sàng demo cho stakeholders.
- Manual schedule tạo bottleneck lớn — không scale.
- Calendar view + auto-schedule = differentiator vs đối thủ.

---

## 3. Goals & Non-Goals

### 3.1 Goals

- **G1**: Admin có thể tăng/giảm số row/col từ SeatMapEditor không phải quay lại Room form.
- **G2**: Showtime view chuẩn industry — calendar timeline theo room × time.
- **G3**: 1 click tạo nhiều suất (vd "phim X từ 8h-23h all rooms 1 ngày").
- **G4**: Conflict detection real-time (visual cảnh báo).
- **G5**: Không break existing flow — calendar view + list view co-exist (toggle).

### 3.2 Non-Goals

- KHÔNG drag-and-drop reschedule (defer phase sau).
- KHÔNG bulk delete showtimes (đã có).
- KHÔNG visualization analytics (utilization heatmap) — tách ra Statistics page.
- KHÔNG mobile-optimized — admin desktop-first.

---

## 4. T2.2 — SeatMapEditor Row/Col Resize

### 4.1 UI design

```
┌──────────────────────────────────────────────────┐
│ Phòng A1 — IMAX                    [Lưu] [Reset]│
├──────────────────────────────────────────────────┤
│ Kích thước:                                       │
│   [10 rows ▼]  [12 cols ▼]  [Áp dụng kích thước] │
│   ⚠️ Áp dụng sẽ XÓA ghế hiện tại và tạo lại     │
├──────────────────────────────────────────────────┤
│                  [MÀN HÌNH]                       │
│   A: ▢▢▢▢▢▢▢▢▢▢▢▢                              │
│   B: ▢▢▢▢▢▢▢▢▢▢▢▢                              │
│   ...                                             │
└──────────────────────────────────────────────────┘
```

### 4.2 Behavior

- Default: hiện row/col hiện tại của room.
- User đổi số → "Áp dụng" disabled cho đến khi click.
- Click "Áp dụng" → confirm dialog: "Sẽ tạo lại sơ đồ ghế. Mất toàn bộ customize hiện tại (loại ghế, ghế hỏng, lối đi). OK?"
- Confirm → POST `/api/rooms/:id/seats/generate` với rows/cols mới → re-render.

### 4.3 BE changes

- ✅ Endpoint đã có: `POST /api/rooms/:id/seats/generate` với `SeatGenerateRequest`.
- Verify request body cho phép set rows + cols.

### 4.4 FE changes

- Thêm component `<SeatGridResizeControls>` trong SeatMapEditorPage header.
- Hook `useGenerateSeats` (đã có).
- Add ConfirmDialog cho destructive action.

### 4.5 Effort: 4-6h

---

## 5. T3 — AdminShowtime Calendar View

### 5.1 UI design — Calendar view

```
┌─────────────────────────────────────────────────────────────────┐
│ Lịch chiếu — Tuần 13/06/2026 → 19/06/2026   [List View]│
├─────────────────────────────────────────────────────────────────┤
│ Phòng / Giờ  │8h│9│10│11│12│13│14│15│16│17│18│19│20│21│22│23h│ │
├──────────────┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤
│ A1 (IMAX)   │[━━ Inception 8h-10h]│[━━ Spider 11h-13h]│...   │
│ A2 (2D)     │   [━━ Avengers 9h-11h]   │[━━ Joker 14h-16h]│  │
│ B1 (4DX)    │[━━ Top Gun 8h-10h]│       │[━━ Dune 15h-17h]│  │
└─────────────────────────────────────────────────────────────────┘

Day picker: [<] Thứ 6, 13/06/2026 [>] | [Tuần này] [Hôm nay]
```

### 5.2 Components

```
AdminShowtimePage
  ├─ ViewToggle (List | Calendar)
  ├─ if View=Calendar:
  │   ├─ DateRangePicker (single day or week)
  │   ├─ <ShowtimeCalendarGrid>
  │   │   ├─ Rows: rooms of selected theater
  │   │   ├─ Cols: time slots (24h)
  │   │   └─ <ShowtimeBlock> for each showtime (positioned absolute)
  │   └─ <CreateShowtimeFromSlot> (click empty slot to create)
  └─ if View=List: (existing implementation)
```

### 5.3 Detailed design

#### **Time axis**
- Time grid 24h chia thành 30-min slots.
- Each cell 30 minutes wide.
- Showtime block width = duration + buffer.

#### **Showtime block**
- Color: theo room type (IMAX=blue, 4DX=red, 2D=gray).
- Content: movie title (truncate) + thời gian (8:00-10:30).
- Click → open detail dialog.
- Hover → show full info tooltip.

#### **Empty slot click**
- Click vào ô trống → mở ShowtimeFormDialog pre-filled với (room, time).
- Tiết kiệm 2 step.

#### **Conflict visualization**
- Suất chiếu overlap → border đỏ.
- Tooltip explain conflict.

### 5.4 BE changes

- Thêm query parameter `from`/`to` cho `/api/showtimes` (đã có `startTimeFrom`/`startTimeTo`).
- Optimize cho returned 50-100 showtimes/day không chậm.

### 5.5 FE changes

- New component `ShowtimeCalendarGrid` (~400 lines).
- New component `ShowtimeBlock` (~100 lines).
- Update AdminShowtimePage với view toggle (~50 lines).
- Type-safe time slot calculation.

### 5.6 Effort: 8-12h

---

## 6. T4 — Auto-Schedule Bulk Create

### 6.1 UI design

```
┌──────────────────────────────────────────────────────────┐
│ Tạo lịch chiếu hàng loạt                         [Tắt X]│
├──────────────────────────────────────────────────────────┤
│ Phim:        [Inception ▼]                                │
│ Chi nhánh:   [CineX Hà Nội ▼]                            │
│ Phòng:       [☑ A1] [☑ A2] [☑ B1] [Chọn tất cả]         │
│ Ngày:        [13/06/2026] → [13/06/2026]                  │
│ Khung giờ:   [8h] → [23h]                                  │
│ Buffer:      [15] phút (giữa các suất)                    │
│ Giá:                                                       │
│   Thường:    [80,000đ]                                    │
│   VIP:       [120,000đ]                                   │
│                                                            │
│ Preview: sẽ tạo 21 suất chiếu                             │
│   A1: 8:00, 11:00, 14:00, 17:00, 20:00 (5 suất)         │
│   A2: 8:00, 11:00, 14:00, 17:00, 20:00 (5 suất)         │
│   B1: 8:00, 11:00, 14:00, 17:00, 20:00, 23:00 (6 suất)  │
│   (Phim dài 2h + buffer 15p = slot 2h15p)                │
│                                                            │
│ ⚠️ Sẽ tự skip slot conflict với suất chiếu hiện có      │
│                                                            │
│              [Hủy]  [Tạo 21 suất chiếu]                  │
└──────────────────────────────────────────────────────────┘
```

### 6.2 Algorithm

```python
def auto_schedule(movie, rooms, day, start_hour, end_hour, buffer_min, prices):
    duration_min = movie.duration + buffer_min
    showtimes = []
    
    for room in rooms:
        current_time = day.at_hour(start_hour)
        end_time = day.at_hour(end_hour)
        
        while current_time + duration_min <= end_time:
            # Check conflict with existing showtimes
            if not has_conflict(room, current_time, duration_min):
                showtimes.append(Showtime(
                    movie=movie,
                    room=room,
                    start=current_time,
                    end=current_time + movie.duration,
                    slot_end=current_time + duration_min,
                    prices=prices,
                ))
            current_time += duration_min
    
    return showtimes
```

### 6.3 BE changes

#### New endpoint
```
POST /api/showtimes/auto-schedule
Body:
{
  "movieId": 123,
  "theaterId": 456,
  "roomIds": [1, 2, 3],
  "dateFrom": "2026-06-13",
  "dateTo": "2026-06-13",
  "startHour": 8,
  "endHour": 23,
  "bufferMinutes": 15,
  "basePrice": 80000,
  "vipPrice": 120000,
  "couplePrice": 160000,
  "sweetboxPrice": null,
  "deluxePrice": null
}

Response:
{
  "created": 21,
  "skipped": 3,
  "details": [
    { "roomId": 1, "startTime": "2026-06-13T08:00:00", "status": "CREATED" },
    { "roomId": 1, "startTime": "2026-06-13T11:00:00", "status": "SKIPPED", "reason": "conflict with showtime #42" },
    ...
  ]
}
```

#### Service logic
```java
@Transactional
public AutoScheduleResult autoSchedule(AutoScheduleRequest req) {
    Movie movie = movieRepo.findById(req.movieId()).orElseThrow();
    List<Room> rooms = roomRepo.findAllById(req.roomIds());
    
    // RBAC: branch admin only own theater
    securityService.requireAccessToTheater(req.theaterId());
    
    // Validate movie has active MovieRun for this theater + date range
    validateMovieRun(movie, req.theaterId(), req.dateFrom(), req.dateTo());
    
    List<ShowtimeRequest> created = new ArrayList<>();
    List<ScheduleSkip> skipped = new ArrayList<>();
    
    LocalDate currentDate = req.dateFrom();
    while (!currentDate.isAfter(req.dateTo())) {
        for (Room room : rooms) {
            LocalDateTime slot = currentDate.atTime(req.startHour(), 0);
            LocalDateTime endOfDay = currentDate.atTime(req.endHour(), 0);
            int slotDuration = movie.getDuration() + req.bufferMinutes();
            
            while (slot.plusMinutes(slotDuration).isBefore(endOfDay) || 
                   slot.plusMinutes(slotDuration).equals(endOfDay)) {
                // Check conflict
                List<Showtime> conflicts = showtimeRepo.findConflictingShowtimes(
                    room.getId(), slot, slot.plusMinutes(slotDuration));
                if (conflicts.isEmpty()) {
                    Showtime st = createShowtime(movie, room, slot, req);
                    created.add(st);
                } else {
                    skipped.add(new ScheduleSkip(room.getId(), slot, "conflict"));
                }
                slot = slot.plusMinutes(slotDuration);
            }
        }
        currentDate = currentDate.plusDays(1);
    }
    
    return new AutoScheduleResult(created.size(), skipped.size(), details);
}
```

### 6.4 FE changes

- New page hoặc dialog: `AutoScheduleDialog`.
- Form với date range + hour range + buffer + prices.
- Preview computation real-time (số suất, chi tiết).
- Submit → call endpoint → toast result.
- Auto refresh list after success.

### 6.5 Effort: 6-10h (BE 3-4h + FE 3-4h + testing)

---

## 7. Rollout

### 7.1 Phase 1 — T2.2 (Week 1, 4-6h)

- BE: verify `/seats/generate` accept new dimensions.
- FE: SeatGridResizeControls component.
- Test: smoke test re-generate flow.

### 7.2 Phase 2 — T4 Auto-Schedule (Week 2, 6-10h)

Implement TRƯỚC T3 because:
- T4 nhỏ hơn (single dialog vs full new view).
- T4 immediately useful (admin tiết kiệm time ngay).
- T3 sẽ benefit từ T4 (calendar view có button "Auto-schedule for this week").

### 7.3 Phase 3 — T3 Calendar View (Week 3, 8-12h)

- New components.
- Toggle với list view (giữ list view existing).
- Integration với T4 auto-schedule button.

### 7.4 Feature flag

Mỗi feature wrap trong `featureFlag.isEnabled('admin.calendar-view')` etc.
Rollout: 0% → admin internal → 100%.

---

## 8. Trade-offs

| Trade-off | Mitigation |
|---|---|
| Calendar view tốn FE compute (render 50+ blocks) | Virtualization library nếu cần |
| Auto-schedule có thể tạo quá nhiều showtimes | Hard limit 100 suất/lần |
| BE endpoint new = thêm test | Cover 80% main flows |
| Conflict detection real-time tốn query | Cache + batch |

---

## 9. Open Questions

1. Calendar view: 1 ngày hay 1 tuần default?
2. Auto-schedule: pre-fill prices từ pricing rule hay từ admin?
3. Drag-and-drop reschedule: phase 2 hay phase 4?
4. Color coding showtime blocks: theo phim hay theo room type?

---

## 10. Implementation Plan

```
Week 1: T2.2 (4-6h)
  Day 1: BE verify + UI design
  Day 2: Implement + test

Week 2: T4 Auto-Schedule (6-10h)
  Day 1: BE endpoint + service
  Day 2-3: FE dialog + integration
  Day 4: Test + edge cases

Week 3: T3 Calendar View (8-12h)
  Day 1-2: Components + grid
  Day 3-4: Block rendering + interactions
  Day 5: Integration + polish
```

Total: 3 weeks part-time.

---

## 11. Câu hỏi để user approve

- [ ] OK với approach calendar view (room rows × time cols)?
- [ ] Auto-schedule: skip conflict vs throw error?
- [ ] Phase order Week 1 → T2.2, Week 2 → T4, Week 3 → T3 OK?
- [ ] Feature flag cần hay deploy thẳng?

→ Sau khi approve, sẽ implement theo phases.

---

## Reference

- Vista Veezi admin: https://www.vistaveezi.com/
- Cinetixx: https://www.cinetixx.com/
- CGV Vietnam app inspiration (mobile).
- Lotte Cinema operational panels (qua interview ex-staff).
- RFC-001 ES movie search (RFC chuẩn process tham khảo).
