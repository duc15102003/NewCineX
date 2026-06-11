# Age Rating — TT 25/2024 + 3-tier enforcement

> Giải thích phân loại tuổi phim theo Thông tư 25/2024/BVHTTDL của Cục Điện ảnh VN + cách CineX enforce 3 lớp.

---

## 1. Enum AgeRating (TT 25/2024/BVHTTDL)

```java
public enum AgeRating {
    P,    // Phổ biến — mọi đối tượng
    K,    // Dưới 13 tuổi xem cùng người lớn
    T13,  // Từ 13 tuổi
    T16,  // Từ 16 tuổi
    T18   // Từ 18 tuổi
}
```

**Quan trọng:** KHÔNG có mức `C`. Theo TT 25/2024, "C = Cấm phổ biến" là **phim BỊ CẤM phát hành công khai** (không lên rạp, không streaming), KHÔNG phải mức tuổi. Vista FilmAtSite/Veezi cũng không có mức này. Phim C đáng lẽ không bao giờ xuất hiện trong booking system.

**Migration tháng 6/2026** (commit `6a357d6`): xóa enum C + migration 072 `UPDATE movies SET age_rating='T18' WHERE age_rating='C'`.

---

## 2. AGE_RATING_MIN_AGE map

```typescript
// frontend/src/utils/labels.ts
export const AGE_RATING_MIN_AGE: Record<string, number> = {
  P: 0,
  K: 0,    // dưới 13 nhưng cần người lớn → không min cụ thể
  T13: 13,
  T16: 16,
  T18: 18,
}

export function needsAgeConfirm(rating?: string | null): boolean {
  return rating === 'T13' || rating === 'T16' || rating === 'T18'
}
```

P và K không cần confirm. T13+ thì bắt user confirm tuổi.

---

## 3. 3-tier enforcement chuẩn industry

Theo pattern CGV/Lotte/BHD/Galaxy VN + TT 25/2024:

### Tier 1 — Confirm dialog đặt vé (FE)

`AgeConfirmDialog` component khi user click "Giữ ghế":

```typescript
if (needsAgeConfirm(showtime.movieAgeRating)) {
  setAgeConfirmOpen(true)
  return  // chặn flow, chờ confirm
}
await doHoldSeats()  // P/K → tiếp luôn
```

Dialog hiển thị:
- Rating badge (T13/T16/T18) + minAge
- "Phim này phân loại T18 — chỉ dành cho khán giả từ 18 tuổi trở lên."
- "Vui lòng mang CCCD/CMND khi đến rạp. Nhân viên có quyền từ chối check-in nếu không đủ tuổi và **không hoàn tiền**."
- 2 nút: "Hủy" / "Tôi xác nhận đủ tuổi"

**Pháp lý:** Rạp chỉ cần "nỗ lực hợp lý" (good faith effort). Online không thể verify CCCD → checkbox xác nhận là disclaimer.

### Tier 2 — DB auto-block khi user khai DOB (BE)

`BookingService.holdSeats()`:

```java
validateUserBookingCapacity(userId, request.getShowtimeId());
Showtime showtime = lockAndValidateShowtime(request.getShowtimeId());
validateAgeIfDOBSet(user, showtime.getMovie().getAgeRating());  // ← lớp này
List<Long> uniqueSeatIds = validateSeatSelection(request.getSeatIds());
```

```java
private void validateAgeIfDOBSet(User user, AgeRating ageRating) {
    if (user.getDateOfBirth() == null || ageRating == null) return; // no-op nếu chưa khai
    int minAge = switch (ageRating) {
        case P, K -> 0;
        case T13 -> 13;
        case T16 -> 16;
        case T18 -> 18;
    };
    if (minAge == 0) return;
    int userAge = Period.between(user.getDateOfBirth(), LocalDate.now()).getYears();
    if (userAge < minAge) {
        throw new BusinessException(ErrorCode.INVALID_REQUEST,
            String.format("Phim này phân loại %s — yêu cầu từ %d tuổi trở lên. Bạn hiện %d tuổi.",
                ageRating.name(), minAge, userAge));
    }
}
```

- User **CHƯA khai DOB** → no-op (chỉ tier 1 + tier 3 enforce)
- User **đã khai DOB** + đủ tuổi → pass
- User **đã khai DOB** + chưa đủ tuổi → throw `BusinessException` → BE trả 400 + FE hiển thị error

**UX:** Khuyến khích user khai DOB ở profile → ko cần confirm dialog mỗi lần T13+. Pattern voluntary disclosure chuẩn PDPA (Nghị định 13/2023 không bắt buộc khai DOB).

### Tier 3 — POS reject check-in vật lý (Admin)

Lớp cuối — barrier vật lý tại cổng rạp. Pattern Vista FilmAtSite "Session Admit / Session Reject":

`CheckInPage` 2-stage flow:
1. Scan QR / nhập code → `GET /api/bookings/check-in/preview` (read-only, không mutate)
2. Phim P/K → auto-admit (giữ tốc độ check-in)
3. Phim T13+ → render preview card:
   - Badge tuổi to (T18 đỏ)
   - Yêu cầu staff hỏi CCCD
   - 2 nút:
     - **"Đủ tuổi — Cho vào"** → `POST /api/bookings/check-in` → status `CHECKED_IN`
     - **"Từ chối — không đủ tuổi"** → `POST /api/bookings/check-in/reject?reason=UNDER_AGE` → status `REJECTED` + `@Auditable` log

```java
@Auditable(action = "REJECT_CHECK_IN", entityType = "Booking")
public BookingResponse rejectCheckIn(String code, String reason) {
    Booking booking = findByQrTokenOrCode(code);
    if (booking.getStatus() != BookingStatus.CONFIRMED) throw ...;

    booking.setStatus(BookingStatus.REJECTED);
    bookingRepository.save(booking);
    log.info("Booking {} REJECTED at gate. Reason: {}", booking.getBookingCode(), reason);
    return toBookingResponse(booking);
}
```

`BookingStatus.REJECTED` mới (commit `ffc6a98`) — phân biệt với `CANCELLED` (user hủy). Policy CGV/Lotte: **không hoàn tiền** vì user đã được cảnh báo ở 3 nơi (confirm dialog, chip QR vé, profile DOB).

---

## 4. Hiển thị badge age rating trên QR ticket

`TicketDetailPage` chip cảnh báo cho phim T13+:

```tsx
{needsAgeConfirm(booking.movieAgeRating) && (
  <div className="flex gap-3 bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4">
    <IdCard size={20} className="text-orange-400" />
    <div>
      <p className="text-orange-300 font-medium">
        Phim {booking.movieAgeRating} · {AGE_RATING_LABELS[booking.movieAgeRating ?? '']?.split(' — ')[1]}
      </p>
      <p className="text-orange-200/80 text-xs">
        Vui lòng mang theo CCCD/CMND để xuất trình tại cổng. Nhân viên có quyền từ chối
        check-in nếu không đủ tuổi và không hoàn tiền.
      </p>
    </div>
  </div>
)}
```

User mở vé QR thấy ngay cảnh báo → mang CCCD đi rạp.

---

## 5. Quy trình thật tế khi rạp deploy

Distributor cấp phim → admin tạo Movie với `ageRating` đúng:
- Movie P (vd Tom & Jerry) → mọi user book được, không confirm
- Movie K (vd Doraemon) → mọi user book được, FE có thể nhắc "kèm phụ huynh"
- Movie T13 → confirm dialog FE; BE block nếu user khai DOB < 13
- Movie T16 → tương tự T13 với 16
- Movie T18 → tương tự với 18; tier 3 strict (staff bắt buộc verify CCCD)

Phim C (cấm) đáng lẽ KHÔNG được tạo trong system. Nếu cố tạo → form admin không có option C (dropdown lấy từ `AGE_RATING_LABELS` không có key C).

---

## 6. Tham khảo code

| File | Vai trò |
|---|---|
| `module/movie/entity/AgeRating.java` | Enum 5 giá trị (P/K/T13/T16/T18) |
| `module/booking/service/BookingService.java#validateAgeIfDOBSet` | Tier 2 — auto-block |
| `module/booking/service/BookingService.java#rejectCheckIn` | Tier 3 — POS reject |
| `module/booking/entity/BookingStatus.java` | enum có giá trị REJECTED |
| `frontend/src/utils/labels.ts` | `AGE_RATING_LABELS`, `AGE_RATING_MIN_AGE`, `needsAgeConfirm()` |
| `frontend/src/features/booking/components/AgeConfirmDialog.tsx` | Tier 1 — dialog confirm |
| `frontend/src/features/booking/TicketDetailPage.tsx` | Chip cảnh báo CCCD trên QR vé |
| `frontend/src/features/admin/CheckInPage.tsx` | Tier 3 UI — preview + admit/reject 2 nút |

---

## 7. Câu hỏi thường gặp

**Q: Tôi muốn add lại C cho phim arthouse niche thì sao?**
A: KHÔNG nên. Theo TT 25/2024, C là cấm chiếu, không phải mức tuổi. Nếu cần label cho phim "nhạy cảm" arthouse, dùng T18 + note trong description.

**Q: User chưa khai DOB thì pass qua tier 1 OK rồi, vẫn vào rạp được?**
A: Đúng. Tier 1 chỉ là disclaimer pháp lý. Tier 3 (POS) mới là barrier vật lý. Staff thấy user trông quá nhỏ tuổi mà phim T18 → yêu cầu CCCD. Nếu không đủ tuổi → bấm "Từ chối", booking → REJECTED, không hoàn tiền.

**Q: Nếu rạp không tuyển nhân viên check tuổi thì sao?**
A: Vẫn chạy được — chỉ enforce tier 1 + tier 2. Mất khả năng từ chối tại cổng. Pháp lý vẫn cover (disclaimer + checkbox confirm).

**Q: Có thể bypass tier 2 bằng cách user khai DOB giả không?**
A: Có (nhập 1990 thay vì 2010). Nhưng:
- Đó là gian lận của user, rạp đã "nỗ lực hợp lý"
- Tier 3 verify CCCD vẫn catch được nếu rạp enforce

**Q: Sao không có tier verify CCCD online (vd qua VNeID)?**
A: Tương lai có thể. Hiện tại VNeID API chưa stable + cost cao. CGV/Lotte/BHD đều chưa làm online verify, chỉ verify vật lý.
