# Module Seat -- Giải thích chi tiết

## 1. Tổng quan

### Ghế là gì trong hệ thống rap phim?

Trong đời thực, mới phòng chiếu phim co một **sơ đồ ghế** co dinh: ghế xep thanh hàng (A, B, C...) và cột (1, 2, 3...). Khi bạn mua về, bạn chon vị trí ghế cũ the -- ví dụ "E5" nghĩa là hàng E, cột 5.

Trong CineX, **Seat** (ghế ngoi) là entity đại diện cho tung vị trí ngoi trong phòng chiếu. Mới ghế co:
- **Vì tri**: hàng nào, cột nào (VD: hàng E, cột 5 = "E5")
- **Loại ghế**: thuong (STANDARD), VIP, hoặc ghế đôi (COUPLE)
- **Trang thai**: bình thường (AVAILABLE) hay hong (BROKEN)

### Tại sao tach Seat rieng khoi Room?

Bạn co the hỏi: "Room đã co `totalSeats`, sao không lưu luon thong tin ghế trong Room?"

**Lý đó quan trọng:**

| Nếu ghép ghế vào Room | Nếu tach Seat rieng |
|---|---|
| Room entity cuc ky lớn (chua 120+ ghế) | Room nhe, Seat quản lý đọc lap |
| Không the danh đầu ghế hỏng rieng le | Mới ghế co trạng thái rieng (AVAILABLE/BROKEN) |
| Không the gắn giá khác nhau theo loại ghế | SeatType quyet dinh giá vé (STANDARD/VIP/COUPLE) |
| Không the render sơ đồ ghế đang grid | Mới Seat co rowLabel + colNumber -> FE render grid |
| Sửa layout = sửa cả Room entity | Sửa layout chi anh huong bảng seats |

**Nguyên tắc Single Responsibility (chu S trong SOLID):** Room chi quản lý thong tin phòng (tên, loại, suc chua). Seat chi quản lý vị trí ngoi. Mới entity làm 1 viec.

**Ví dụ đời thường:** Phòng hoc co bạn ghế, những "phòng hoc" và "ghế" là 2 thu rieng biết. Bạn co the thấy ghế ma không cần sửa phòng. Tuong tu, admin co the sinh lai sơ đồ ghế (đôi tu 10x12 sang 8x15) ma không cần xóa phòng.

---

## 2. Danh sách files đã tạo/sửa

| File | Tac đúng | Design Pattern |
|---|---|---|
| `entity/Seat.java` | Entity ghế, `@ManyToOne` với Room. Chua rowLabel, colNumber, seatType, status | N:1 Relationship |
| `entity/SeatType.java` | Enum 3 giá trị: STANDARD, VIP, COUPLE | Enum (type-safe) |
| `entity/SeatStatus.java` | Enum 2 giá trị: AVAILABLE, BROKEN | Enum (type-safe) |
| `dto/SeatGenerateRequest.java` | DTO config sinh ghế: totalRows, totalCols, vipRows, coupleRow | DTO + Validation |
| `dto/SeatResponse.java` | DTO trả về thong tin 1 ghế | DTO + Builder |
| `dto/SeatMapResponse.java` | Sơ đồ ghế nhom theo hàng (Map<String, List<SeatResponse>>) | DTO + Builder |
| `dto/UpdateSeatRequest.java` | DTO sửa 1 ghế (đôi type hoặc status) | DTO |
| `dto/BulkUpdateSeatRequest.java` | DTO sửa nhieu ghế cùng luc (bulk update) | DTO + Validation |
| `repository/SeatRepository.java` | Query ghế theo roomId, soft delete ghế theo room | Repository |
| `mapper/SeatMapper.java` | Chuyen Seat entity -> SeatResponse (MapStruct tu sinh code) | Mapper (MapStruct) |
| `service/SeatService.java` | Business logic: sinh ghế, lay so đó, cấp nhất, xóa mem | Service |
| `controller/SeatController.java` | 6 endpoint REST, phân quyền ADMIN cho write operations | Controller |
| `009-create-seats-table.xml` | Liquibase changelog tạo bảng `seats` + FK + index | Database Migration |
| **Frontend** | | |
| `hooks/useAdminSeatMap.ts` | React Query hooks: `useSeatMap`, `useBulkUpdateSeats` | Custom Hook |
| `features/admin/SeatMapEditorPage.tsx` | Trang editor sơ đồ ghế (drag-paint, bulk update) | Page Component |
| `features/booking/SeatSelectionPage.tsx` | Trang user chon ghế khi đặt vé | Page Component |
| `features/admin/TicketPOSPage.tsx` | Trang POS (bạn về tai quay) cùng render sơ đồ ghế | Page Component |

---

## 3. SeatType -- 3 loại ghế

```java
public enum SeatType {
    STANDARD,   // Ghe thuong
    VIP,        // Ghe VIP (giua phong, tam nhin tot nhat)
    COUPLE      // Ghe doi (hang cuoi, 1 ghe chiem 2 cot)
}
```

### Giải thích tung loại

#### STANDARD -- Ghế thuong
- **Vì tri:** Cac hàng đầu và hàng sâu (A, B, C, D, H, I)
- **Dac điểm:** Ghế don bình thường, 1 ghế = 1 cột
- **Giá:** Giá co bạn (`basePrice` của showtime)
- **Mau hiển thị:** Xanh là (`bg-green-600`)
- **Doi tuong:** Phần lớn khan giá

#### VIP -- Ghế VIP
- **Vì tri:** Cac hàng giua phòng (E, F, G) -- vung "sweet spot" co goc nhin và am thanh tốt nhất
- **Dac điểm:** Ghế don như STANDARD những giá cao hon
- **Giá:** `vipPrice` của showtime (thuong cao hon basePrice 20-50%)
- **Mau hiển thị:** Vang (`bg-yellow-600` / `bg-[#eab308]`)
- **Doi tuong:** Khan giá muốn trai nghiem tốt hon, san sang tra thêm

#### COUPLE -- Ghế đôi
- **Vì tri:** Hang cuối cùng (VD: hàng J) -- rieng tu, thich hop cho cặp đôi
- **Dac điểm:**
  - 1 ghế "logic" = 2 cột vat ly (colspan 2)
  - Ghế được ghép cấp: cột 1-2 là 1 đôi, cột 3-4 là 1 đôi, ...
  - Click chon 1 ghế -> tu đồng chon cả ghế con lai trong cấp
  - Nếu tong so cột là so le (VD: 13 cột) -> ghế cuối (cột 13) thanh STANDARD (không the ghép đôi)
- **Giá:** `couplePrice` của showtime (thuong = 2x basePrice hoặc cao hon)
- **Mau hiển thị:** Tim (`bg-purple-500` / `bg-purple-600`)
- **Doi tuong:** Cap đôi muốn ngoi canh nhau

### Giá ghế được tính như thế nào?

```
                    +-----------+
                    | Showtime  |
                    +-----------+
                    | basePrice |  <-- gia ghe thuong
                    | vipPrice  |  <-- gia ghe VIP
                    | couplePrice| <-- gia ghe doi
                    +-----------+

User chon ghe E5 (VIP) -> gia = showtime.vipPrice
User chon ghe J1-J2 (COUPLE) -> gia = showtime.couplePrice
User chon ghe A3 (STANDARD) -> gia = showtime.basePrice
```

**Luu y:** Giá KHONG lưu trong Seat entity. Giá lưu trong Showtime. Lý đó: cùng 1 ghế VIP những suất chiếu sang co the re hon suất chiếu toi. Giá phu thuoc vào thời gian, không phu thuoc vào ghế.

---

## 4. SeatStatus -- Trang thai ghế

```java
public enum SeatStatus {
    AVAILABLE,  // Ghe binh thuong, co the dat
    BROKEN      // Ghe hong, khong cho dat
}
```

### AVAILABLE -- Ghế hoạt động
- Mac dinh khi sinh ghế mới
- User co the chon ghế này de đặt vé
- Hiển thị mau bình thường (theo SeatType)

### BROKEN -- Ghế hong
- Admin danh đầu khi ghế bi hu (gay, rach, hong...)
- **User KHONG the đặt ghế BROKEN** -- button bi disable, cursor `not-allowed`
- Hiển thị mau đó (`bg-red-600`) bật ke loại ghế là gì
- Khi ghế được sửa xong, admin đôi lai AVAILABLE

**Tại sao cần trạng thái BROKEN?**

Trong đời thực, rap phim co hàng tram ghế. Khi 1 ghế bi hong, nhan vien không the thao ghế ngày (phải đôi bao tri). Trong luc cho, ghế đó van ton tai những không được bạn về. Trang thai BROKEN giup:
1. **User không đặt nhằm ghế hỏng** -> trai nghiem tốt
2. **Admin biết ghế nào cần sửa** -> quản lý tốt
3. **Không mat dữ liệu** -> ghế van o đó, chi đôi trạng thái (thấy vì xóa roi tạo lai)

**Luu y su khác biết:**

| | SeatStatus (BROKEN) | StorageState (ARCHIVED) |
|---|---|---|
| Mục dich | Ghế hong tám thoi | Xoa mem vinh vien |
| User thấy không? | CO -- thấy ghế đó | KHONG -- bi filter ra khoi query |
| Co the phuc hỏi? | Doi về AVAILABLE | Doi về ACTIVE |
| Ai thấy đôi? | Admin qua bulk update | Hệ thống khi generate lai ghế |

---

## 5. Thuật toán sinh ghế tu đồng (Generate Seats)

Day là tính năng quan trọng nhất của module Seat. Thay vì admin phải tạo tung ghế một (120 lan!), hệ thống **tu đồng sinh toan bộ sơ đồ ghế** tu config đơn giản.

### Input của admin

```json
{
  "totalRows": 10,      // 10 hang (A -> J)
  "totalCols": 12,      // 12 cot moi hang
  "vipRows": ["E","F","G"],  // Hang E, F, G la VIP
  "coupleRow": "J"       // Hang J la ghe doi
}
```

### Thuật toán chi tiết (đồng code thực tế)

```
Buoc 1: Validate input
  - vipRows phai nam trong range A -> (A + totalRows - 1)
    VD: 10 hang -> maxRow = J -> vipRows chi duoc A-J
  - coupleRow tuong tu
  - Neu sai -> throw BusinessException

Buoc 2: Soft delete ghe cu
  - UPDATE seats SET storage_state = 'ARCHIVED'
    WHERE room_id = :roomId AND storage_state <> 'ARCHIVED'
  - Tai sao soft delete? De giu audit trail (ai tao, khi nao)

Buoc 3: Vong lap sinh ghe
  for row = 0 -> totalRows-1:          // 0 -> 9
    rowLabel = (char)('A' + row)         // A, B, C, ..., J

    isCoupleRow = (rowLabel == coupleRow) // J?
    isVipRow = vipRows.contains(rowLabel) // E, F, G?

    for col = 1 -> totalCols:            // 1 -> 12
      if isCoupleRow:
        if totalCols le va col == cot cuoi:
          seatType = STANDARD            // Ghe le cuoi hang -> thuong
        else:
          seatType = COUPLE              // Ghep doi
      else if isVipRow:
        seatType = VIP
      else:
        seatType = STANDARD

      tao Seat(room, rowLabel, col, rowLabel+col, seatType, AVAILABLE)

Buoc 4: saveAll(seats) -> batch INSERT

Buoc 5: Cap nhat room.totalSeats = seats.size()
```

### Ví dụ cũ the với 10 hàng x 12 cột

```
Hang A: A1  A2  A3  A4  A5  A6  A7  A8  A9  A10 A11 A12  -> 12 STANDARD
Hang B: B1  B2  B3  B4  B5  B6  B7  B8  B9  B10 B11 B12  -> 12 STANDARD
Hang C: C1  C2  C3  C4  C5  C6  C7  C8  C9  C10 C11 C12  -> 12 STANDARD
Hang D: D1  D2  D3  D4  D5  D6  D7  D8  D9  D10 D11 D12  -> 12 STANDARD
Hang E: E1  E2  E3  E4  E5  E6  E7  E8  E9  E10 E11 E12  -> 12 VIP
Hang F: F1  F2  F3  F4  F5  F6  F7  F8  F9  F10 F11 F12  -> 12 VIP
Hang G: G1  G2  G3  G4  G5  G6  G7  G8  G9  G10 G11 G12  -> 12 VIP
Hang H: H1  H2  H3  H4  H5  H6  H7  H8  H9  H10 H11 H12  -> 12 STANDARD
Hang I: I1  I2  I3  I4  I5  I6  I7  I8  I9  I10 I11 I12  -> 12 STANDARD
Hang J: J1  J2  J3  J4  J5  J6  J7  J8  J9  J10 J11 J12  -> 12 COUPLE

Tong: 10 x 12 = 120 ghe
```

### Xử lý ghế le cuối hàng couple

Khi `totalCols` là so le (VD: 13 cột), hàng couple không the ghép đôi hoan hao:

```
Hang J (13 cot):
  [J1-J2] [J3-J4] [J5-J6] [J7-J8] [J9-J10] [J11-J12] [J13]
  COUPLE  COUPLE  COUPLE  COUPLE  COUPLE   COUPLE    STANDARD
                                                       ^
                                              Ghe le -> doi thanh STANDARD
```

Code xử lý:
```java
// Ghe doi ghep cap 1-2, 3-4, ... -- ghe le cuoi (khi totalCols le) -> STANDARD
boolean isLastOddCol = (request.getTotalCols() % 2 != 0)
                    && (col == request.getTotalCols());
seatType = isLastOddCol ? SeatType.STANDARD : SeatType.COUPLE;
```

**Tại sao không bộ ghế le?** Vì layout cần cần đôi. Nếu hàng khác co 13 cột ma hàng couple chi co 12, grid sẽ bi lech. Giữ ghế le là STANDARD dam bao so cột đồng deu mới hàng.

---

## 6. Ghế đôi COUPLE -- Chi tiết ky thuat

Ghế đôi là loại ghế phức tạp nhất vì no anh huong cả backend lan frontend.

### Backend: Luu tru

Trong database, mới ghế COUPLE van là **1 record rieng**. 1 cấp ghế đôi = 2 records:

```
id | room_id | row_label | col_number | seat_number | seat_type | status
---|---------|-----------|------------|-------------|-----------|--------
109|    1    |     J     |     1      |     J1      |  COUPLE   | AVAILABLE
110|    1    |     J     |     2      |     J2      |  COUPLE   | AVAILABLE
111|    1    |     J     |     3      |     J3      |  COUPLE   | AVAILABLE
112|    1    |     J     |     4      |     J4      |  COUPLE   | AVAILABLE
```

**Tại sao không lưu 1 record cho 1 cấp?**
- Don gian hoa: mới record = 1 vị trí = 1 về. Khi đặt vé, mới về map với 1 seat_id
- Thong nhất: query `SELECT * FROM seats WHERE room_id = 1` trả về du 120 record, không cần xử lý đặc biệt
- Linh hoat: admin co the đôi 1 ghế trong cấp về STANDARD (tach cấp)

### Frontend: Ghép cấp và colspan 2

FE đúng quy tắc **cột le ghép với cột chan ke bên**:

```
Quy tac ghep:
  col 1 <-> col 2   (1 la le -> partner la 2)
  col 3 <-> col 4   (3 la le -> partner la 4)
  col 5 <-> col 6
  ...

Code:
  const isOdd = seat.colNumber % 2 === 1
  const partnerCol = isOdd ? seat.colNumber + 1 : seat.colNumber - 1
  const partner = seats.find(s => s.colNumber === partnerCol)
```

### Render: 1 button rộng 2 cột

```
Ghe thuong:         [A1] [A2] [A3] [A4]     -- moi nut 1 cot
Ghe doi:            [  J1-J2  ] [  J3-J4  ]  -- moi nut 2 cot

CSS:
  style={{ width: `calc(2 * 2.25rem + 0.375rem)` }}
  //           2 o     x  width    +  1 gap
```

### Click chon ghe doi: tu dong chon ca cap

```
User click J1 -> he thong tu tim partner (J2) -> chon ca 2
User click J2 -> he thong tu tim partner (J1) -> chon ca 2
User click J1 lan nua -> bo chon ca J1 va J2

Code (SeatSelectionPage.tsx):
  if (seat.seatType === 'COUPLE' && seats) {
    const partner = seats.find(s => s.colNumber === partnerCol && s.seatType === 'COUPLE')
    const ids = partner ? [seat.id, partner.id] : [seat.id]
    // Chon hoac bo chon CA 2 ghe cung luc
  }
```

**Tai sao phai chon ca cap?** Vi ghe doi trong doi thuc la 1 ghe dai cho 2 nguoi. Ban khong the ban nua ghe doi cho 1 nguoi -- nguoi con lai ngoi dau?

---

## 7. Bulk Update -- Sua nhieu ghe cung luc

### Bai toan

Admin can:
1. **Doi loai ghe hang loat:** Chon 12 ghe hang D -> doi thanh VIP
2. **Danh dau ghe hong:** Chon ghe A5, A6 -> danh dau BROKEN
3. **Khoi phuc ghe:** Chon ghe hong -> doi ve STANDARD (tu dong AVAILABLE)

### Cach hoat dong

```
POST /api/rooms/1/seats/bulk-update
Body: { "seatIds": [1, 2, 3], "seatType": "VIP" }
  -> Doi ghe 1, 2, 3 thanh VIP
  -> Neu ghe dang BROKEN -> tu dong khoi phuc AVAILABLE

POST /api/rooms/1/seats/bulk-update
Body: { "seatIds": [5, 6], "status": "BROKEN" }
  -> Danh dau ghe 5, 6 la BROKEN
  -> Giu nguyen seatType (van la VIP/STANDARD/COUPLE)
```

### Logic backend (SeatService.bulkUpdateSeats)

```java
if (request.getStatus() == SeatStatus.BROKEN) {
    // Chi doi status, giu nguyen loai ghe
    seats.forEach(s -> s.setStatus(SeatStatus.BROKEN));
} else if (request.getSeatType() != null) {
    seats.forEach(s -> {
        s.setSeatType(request.getSeatType());
        // Bonus: ghe dang BROKEN -> khoi phuc AVAILABLE
        if (s.getStatus() == SeatStatus.BROKEN) {
            s.setStatus(SeatStatus.AVAILABLE);
        }
    });
}
```

**Tai sao doi loai ghe thi tu dong khoi phuc AVAILABLE?**
Vi khi admin doi loai ghe, y dinh la "ghe nay hoat dong lai, doi sang loai moi". Neu giu BROKEN thi admin phai lam 2 buoc (doi loai + doi status) -- bat tien.

### Frontend: Seat Map Editor (drag-paint)

Admin dung Seat Map Editor giong nhu **phần mem ve** (Paint):

```
1. Chon cong cu (brush):  [Thuong] [VIP] [Doi] [Hong]
2. Click hoac keo chuot len ghe -> "to mau" ghe theo cong cu
3. Thay doi chua luu -> hien vong tron sang (ring-2 ring-white/40)
4. Nhan "Luu" -> gom thay doi theo loai -> goi bulk-update API
5. Nhan "Reset" -> bo het thay doi chua luu
```

FE group thay doi theo loai truoc khi goi API:

```typescript
// VD: doi ghe 1,2,3 thanh VIP va ghe 5,6 thanh BROKEN
// -> 2 API calls:
PUT /seats/bulk-update { seatIds: [1,2,3], seatType: "VIP" }
PUT /seats/bulk-update { seatIds: [5,6], status: "BROKEN" }
```

---

## 8. So do luong xu ly (ASCII)

### Luong 1: Admin sinh ghe cho phong moi

```
Admin nhap: 10 hang, 12 cot, VIP=[E,F,G], Couple=J
                    |
                    v
POST /api/rooms/1/seats/generate
                    |
                    v
  +------------------+------------------+
  | SeatController.generateSeats()       |
  | -> Nhan request, goi service         |
  +------------------+------------------+
                    |
                    v
  +------------------+------------------+
  | SeatService.generateSeats()          |
  |                                      |
  | 1. findRoomById(1) -> Room "Phong 1" |
  |                                      |
  | 2. Validate vipRows/coupleRow        |
  |    in range A-J? -> OK               |
  |                                      |
  | 3. softDeleteByRoomId(1)             |
  |    -> UPDATE seats SET               |
  |       storage_state='ARCHIVED'       |
  |       WHERE room_id=1                |
  |                                      |
  | 4. Vong lap 10 hang x 12 cot        |
  |    -> Tao 120 Seat objects           |
  |    -> Gan seatType theo config       |
  |                                      |
  | 5. seatRepository.saveAll(120 seats) |
  |    -> batch INSERT 120 records       |
  |                                      |
  | 6. room.setTotalSeats(120)           |
  |    -> UPDATE rooms SET total_seats   |
  |                                      |
  | 7. Goi getSeatMap(1)                 |
  |    -> Nhom ghe theo hang             |
  |    -> Tra SeatMapResponse            |
  +--------------------------------------+
                    |
                    v
  ApiResponse<SeatMapResponse> -> FE render grid
```

### Luong 2: Admin sua ghe qua Editor

```
Admin chon cong cu VIP -> keo chuot qua ghe D1, D2, D3
                    |
                    v
  Frontend ghi nhan pending changes:
  Map { D1->VIP, D2->VIP, D3->VIP }
                    |
  Admin nhan "Luu"  |
                    v
  useBulkUpdateSeats -> group by type:
  { VIP: [id_D1, id_D2, id_D3] }
                    |
                    v
PUT /api/rooms/1/seats/bulk-update
Body: { "seatIds": [id_D1, id_D2, id_D3], "seatType": "VIP" }
                    |
                    v
  +------------------+------------------+
  | SeatService.bulkUpdateSeats()        |
  |                                      |
  | 1. findAllById([id_D1, id_D2, id_D3])|
  |                                      |
  | 2. request.seatType = VIP            |
  |    -> seats.forEach:                 |
  |       setSeatType(VIP)               |
  |       if BROKEN -> setStatus(AVAIL)  |
  |                                      |
  | 3. saveAll(3 seats)                  |
  |    -> UPDATE seats SET seat_type,    |
  |       status WHERE id IN (...)       |
  |                                      |
  | 4. Tra getSeatMap(roomId)            |
  +--------------------------------------+
                    |
                    v
  FE: invalidateQueries(['seatmap', roomId])
  -> Re-fetch so do ghe moi -> render lai
```

### Luong 3: User chon ghe de dat ve

```
User mo trang SeatSelectionPage
                    |
                    v
  1. GET /api/showtimes/{id}/seat-map
     -> Lay so do ghe + thong tin suat chieu
                    |
  2. GET /api/bookings/showtimes/{id}/occupied-seats
     -> Lay danh sach seatId da ban/dang giu
                    |
  3. WebSocket connect
     -> Nhan update real-time khi nguoi khac giu/huy ghe
                    |
                    v
  FE render so do ghe:
  +---+---+---+---+---+---+---+---+---+---+---+---+
  |A1 |A2 |A3 |A4 |A5 |A6 |A7 |A8 |A9 |A10|A11|A12| Xanh (STANDARD)
  +---+---+---+---+---+---+---+---+---+---+---+---+
  |E1 |E2 |E3 |E4 |E5 |E6 |E7 |E8 |E9 |E10|E11|E12| Vang (VIP)
  +---+---+---+---+---+---+---+---+---+---+---+---+
  | J1-J2 | J3-J4 | J5-J6 | J7-J8 | J9-10 |J11-12 | Tim (COUPLE)
  +-------+-------+-------+-------+-------+-------+
  |XX |   |   |   |   |   |   |   |   |   |   |   | Do = BROKEN
  +---+---+---+---+---+---+---+---+---+---+---+---+
  |   |   |   |   |   |   |   |## |## |   |   |   | Xam = Da ban
  +---+---+---+---+---+---+---+---+---+---+---+---+

                   === MAN HINH ===

  User click E5 (VIP)  -> highlight vang dam, tinh gia VIP
  User click J1 (COUPLE)-> tu dong chon J1+J2, tinh gia COUPLE
  User click ghe BROKEN -> KHONG cho chon (disabled)
  User click ghe xam   -> KHONG cho chon (da ban)
```

---

## 9. SQL duoc sinh ra cho tung operation

### Tao bang seats (Liquibase)

```sql
-- 009-create-seats-table.xml
CREATE TABLE seats (
    id          BIGINT IDENTITY(1,1) PRIMARY KEY,
    version     BIGINT DEFAULT 0,
    storage_state NVARCHAR(20),
    created_by  NVARCHAR(50),
    updated_by  NVARCHAR(50),
    created_at  DATETIME2,
    updated_at  DATETIME2,
    room_id     BIGINT NOT NULL,
    row_label   NVARCHAR(5) NOT NULL,
    col_number  INT NOT NULL,
    seat_number NVARCHAR(10) NOT NULL,
    seat_type   NVARCHAR(20) NOT NULL,
    status      NVARCHAR(20) NOT NULL,
    CONSTRAINT fk_seats_room_id FOREIGN KEY (room_id) REFERENCES rooms(id)
);
CREATE INDEX idx_seats_room_id ON seats(room_id);
```

**Tai sao can index tren room_id?**
- Query pho bien nhat: `WHERE room_id = ?` (lay ghe cua phong)
- Khong co index: database phai scan TOAN BO bang seats (full table scan)
- Co index: database nhay thang den cac record co room_id = 1 (index seek)
- Voi 10 phong x 120 ghe = 1200 records, index giup query nhanh gap nhieu lan

### Lay so do ghe (getSeatMap)

```sql
-- Spring Data JPA tu sinh tu ten method:
-- findByRoomIdAndStorageStateOrderByRowLabelAscColNumberAsc(1, 'ACTIVE')
SELECT s.*
FROM seats s
WHERE s.room_id = 1
  AND s.storage_state = 'ACTIVE'
ORDER BY s.row_label ASC, s.col_number ASC;

-- Ket qua: 120 rows, sap xep A1, A2, ..., A12, B1, B2, ...
```

### Soft delete ghe cu truoc khi generate

```sql
-- @Modifying @Query trong SeatRepository
UPDATE seats
SET storage_state = 'ARCHIVED'
WHERE room_id = 1
  AND storage_state <> 'ARCHIVED';
```

### Sinh ghe moi (batch INSERT)

```sql
-- seatRepository.saveAll(120 seats) -> Hibernate batch insert
INSERT INTO seats (room_id, row_label, col_number, seat_number, seat_type,
                   status, storage_state, version, created_by, created_at, updated_at)
VALUES
  (1, 'A', 1, 'A1', 'STANDARD', 'AVAILABLE', 'ACTIVE', 0, 'admin', GETDATE(), GETDATE()),
  (1, 'A', 2, 'A2', 'STANDARD', 'AVAILABLE', 'ACTIVE', 0, 'admin', GETDATE(), GETDATE()),
  ...
  (1, 'E', 1, 'E1', 'VIP', 'AVAILABLE', 'ACTIVE', 0, 'admin', GETDATE(), GETDATE()),
  ...
  (1, 'J', 1, 'J1', 'COUPLE', 'AVAILABLE', 'ACTIVE', 0, 'admin', GETDATE(), GETDATE()),
  (1, 'J', 2, 'J2', 'COUPLE', 'AVAILABLE', 'ACTIVE', 0, 'admin', GETDATE(), GETDATE()),
  ...;
```

### Cap nhat totalSeats trong room

```sql
UPDATE rooms
SET total_seats = 120, version = version + 1, updated_at = GETDATE()
WHERE id = 1;
```

### Sua 1 ghe (updateSeat)

```sql
UPDATE seats
SET seat_type = 'VIP', version = version + 1, updated_at = GETDATE()
WHERE id = 5;
```

### Bulk update nhieu ghe

```sql
-- Doi loai ghe
UPDATE seats
SET seat_type = 'VIP', status = 'AVAILABLE',
    version = version + 1, updated_at = GETDATE()
WHERE id IN (1, 2, 3);

-- Danh dau hong
UPDATE seats
SET status = 'BROKEN', version = version + 1, updated_at = GETDATE()
WHERE id IN (5, 6);
```

### Xoa mem 1 ghe (deleteSeat)

```sql
UPDATE seats
SET storage_state = 'ARCHIVED', version = version + 1, updated_at = GETDATE()
WHERE id = 7;
```

---

## 10. Annotation moi giai thich

### Backend annotations

| Annotation | File | Tac dung | Giai thich don gian |
|---|---|---|---|
| `@ManyToOne(fetch = LAZY)` | Seat.java | Quan he nhieu-mot voi Room, lazy load | 120 ghe thuoc 1 phong. LAZY = chi load Room khi can, khong tu dong load |
| `@JoinColumn(name = "room_id")` | Seat.java | Chi dinh cot FK trong bang seats | "Cot nao trong bang seats tro ve bang rooms?" -> cot room_id |
| `@Enumerated(EnumType.STRING)` | Seat.java | Luu enum duoi dang text trong DB | Luu "VIP" thay vi so 1. Doc DB se hieu ngay, khong can tra enum |
| `@Builder.Default` | Seat.java | Gia tri mac dinh khi dung Builder pattern | `Seat.builder().build()` -> status = AVAILABLE (thay vi null) |
| `@Modifying` | SeatRepository.java | Danh dau query la UPDATE/DELETE | Mac dinh Spring coi @Query la SELECT. Them @Modifying de Spring biet day la write query |
| `@Min(1)` / `@Max(26)` | SeatGenerateRequest.java | Validation so luong hang/cot | Toi thieu 1 hang, toi da 26 hang (A-Z). Sai -> tra loi 400 Bad Request |
| `@NotNull` | SeatGenerateRequest.java | Bat buoc phai co gia tri | totalRows va totalCols khong duoc null |
| `@NotEmpty` | BulkUpdateSeatRequest.java | Danh sach khong duoc rong | seatIds phai co it nhat 1 phan tu |
| `@PreAuthorize("hasRole('ADMIN')")` | SeatController.java | Chi ADMIN moi duoc goi endpoint nay | User thuong goi -> tra 403 Forbidden |
| `@Tag(name = "Seat")` | SeatController.java | Nhom endpoint trong Swagger UI | Mo Swagger -> thay nhom "Seat" chua tat ca endpoint |
| `@Operation(summary = "...")` | SeatController.java | Mo ta endpoint trong Swagger | Mo Swagger -> thay mo ta cua tung endpoint |
| `@Mapper(componentModel = "spring")` | SeatMapper.java | MapStruct sinh code luc compile | Tu dong tao class SeatMapperImpl chuyen Seat -> SeatResponse |

### Frontend patterns

| Pattern | File | Tac dung |
|---|---|---|
| `useQuery` | useAdminSeatMap.ts | Fetch + cache du lieu so do ghe. Tu dong re-fetch khi can |
| `useMutation` | useAdminSeatMap.ts | Goi API bulk-update. Xu ly loading/error/success |
| `invalidateQueries` | useAdminSeatMap.ts | Sau khi save -> xoa cache cu -> fetch lai du lieu moi |
| `useState` + `Map` | SeatMapEditorPage.tsx | Luu tru pending changes (chua save) dang local state |
| `useCallback` | SeatMapEditorPage.tsx | Memo hoa ham xu ly mouse event -> tranh re-render khong can thiet |

---

## 11. Request/Response mau

### GET /api/rooms/{roomId}/seats -- Lay so do ghe

```bash
curl http://localhost:8088/api/rooms/1/seats \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "roomId": 1,
    "roomName": "Phong 1",
    "totalSeats": 120,
    "seatMap": {
      "A": [
        { "id": 1, "rowLabel": "A", "colNumber": 1, "seatNumber": "A1", "seatType": "STANDARD", "status": "AVAILABLE", "storageState": "ACTIVE" },
        { "id": 2, "rowLabel": "A", "colNumber": 2, "seatNumber": "A2", "seatType": "STANDARD", "status": "AVAILABLE", "storageState": "ACTIVE" }
      ],
      "E": [
        { "id": 49, "rowLabel": "E", "colNumber": 1, "seatNumber": "E1", "seatType": "VIP", "status": "AVAILABLE", "storageState": "ACTIVE" }
      ],
      "J": [
        { "id": 109, "rowLabel": "J", "colNumber": 1, "seatNumber": "J1", "seatType": "COUPLE", "status": "AVAILABLE", "storageState": "ACTIVE" },
        { "id": 110, "rowLabel": "J", "colNumber": 2, "seatNumber": "J2", "seatType": "COUPLE", "status": "AVAILABLE", "storageState": "ACTIVE" }
      ]
    }
  }
}
```

### POST /api/rooms/{roomId}/seats/generate -- (Admin) Sinh ghe

```bash
curl -X POST http://localhost:8088/api/rooms/1/seats/generate \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "totalRows": 10,
    "totalCols": 12,
    "vipRows": ["E", "F", "G"],
    "coupleRow": "J"
  }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Seats generated",
  "data": {
    "roomId": 1,
    "roomName": "Phong 1",
    "totalSeats": 120,
    "seatMap": { "A": [...], "B": [...], ..., "J": [...] }
  }
}
```

**Response (400 Bad Request) -- vipRow ngoai range:**
```json
{
  "success": false,
  "message": "Hang VIP 'Z' nam ngoai pham vi A-J"
}
```

**Response (400 Bad Request) -- validation fail:**
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "totalRows": "Toi thieu 1 hang",
    "totalCols": "Toi da 30 cot"
  }
}
```

### PUT /api/rooms/{roomId}/seats/bulk-update -- (Admin) Sua nhieu ghe

**Doi loai ghe:**
```bash
curl -X PUT http://localhost:8088/api/rooms/1/seats/bulk-update \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "seatIds": [37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48],
    "seatType": "VIP"
  }'
```

**Danh dau ghe hong:**
```bash
curl -X PUT http://localhost:8088/api/rooms/1/seats/bulk-update \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "seatIds": [5, 6],
    "status": "BROKEN"
  }'
```

### PUT /api/rooms/{roomId}/seats/{seatId} -- (Admin) Sua 1 ghe

```bash
curl -X PUT http://localhost:8088/api/rooms/1/seats/5 \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{ "seatType": "VIP", "status": "BROKEN" }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Seat updated",
  "data": {
    "id": 5,
    "rowLabel": "A",
    "colNumber": 5,
    "seatNumber": "A5",
    "seatType": "VIP",
    "status": "BROKEN",
    "storageState": "ACTIVE"
  }
}
```

### DELETE /api/rooms/{roomId}/seats/{seatId} -- (Admin) Xoa mem 1 ghe

```bash
curl -X DELETE http://localhost:8088/api/rooms/1/seats/7 \
  -H "Authorization: Bearer <admin_token>"
```

### POST /api/rooms/{roomId}/seats/{seatId}/restore -- (Admin) Khoi phuc ghe da xoa

```bash
curl -X POST http://localhost:8088/api/rooms/1/seats/7/restore \
  -H "Authorization: Bearer <admin_token>"
```

---

## 12. Mau sac ghe dong bo 3 noi

### Bang mau sac thong nhat

| Loai/Trang thai | Mau | Tailwind Class | Dung o dau |
|---|---|---|---|
| **STANDARD** (Thuong) | Xanh la | `bg-green-600` | Ca 3 noi |
| **VIP** | Vang | `bg-yellow-600` (user/POS), `bg-[#eab308]` (admin editor) | Ca 3 noi |
| **COUPLE** (Doi) | Tim | `bg-purple-500` (admin), `bg-purple-600` (user/POS) | Ca 3 noi |
| **BROKEN** (Hong) | Do | `bg-red-600` | Ca 3 noi |
| **Da ban** (occupied) | Xam | `bg-gray-600 opacity-50` | User + POS |
| **Dang chon** (selected) | Vang dam | `bg-[#eab308] text-black scale-110` | User + POS |
| **Da thay doi** (pending) | Vien trang | `ring-2 ring-white/40 scale-105` | Admin editor |

### So sanh 3 man hinh

```
+------------------------------+
|  1. USER (SeatSelectionPage) |
+------------------------------+
| Ghe thuong:  [xanh la]       |  <- bg-green-600
| Ghe VIP:     [vang]          |  <- bg-yellow-600
| Ghe doi:     [tim] (2 cot)   |  <- bg-purple-600
| Ghe hong:    [do] disabled   |  <- bg-red-600
| Da ban:      [xam] disabled  |  <- bg-gray-600 opacity-50
| Dang chon:   [vang dam]      |  <- bg-[#eab308] scale-110
+------------------------------+

+------------------------------+
|  2. ADMIN EDITOR             |
+------------------------------+
| Ghe thuong:  [xanh la]       |  <- bg-green-600/80
| Ghe VIP:     [vang]          |  <- bg-[#eab308]/80
| Ghe doi:     [tim] (2 cot)   |  <- bg-purple-500/80
| Ghe hong:    [do]            |  <- bg-red-600/80
| Da thay doi: [vien sang]     |  <- ring-2 ring-white/40
+------------------------------+

+------------------------------+
|  3. POS (TicketPOSPage)      |
+------------------------------+
| Ghe thuong:  [xanh la]       |  <- bg-green-600
| Ghe VIP:     [vang]          |  <- bg-yellow-600
| Ghe doi:     [tim] (2 cot)   |  <- bg-purple-600
| Ghe hong:    [do] disabled   |  <- bg-red-600
| Da ban:      [xam] disabled  |  <- bg-gray-600 opacity-50
+------------------------------+
```

### Tai sao mau sac phai dong bo?

1. **Nhat quan UX:** User, admin, nhan vien POS deu hieu "xanh = thuong, vang = VIP" ma khong can hoc lai
2. **Giam nham lan:** Neu admin thay VIP mau xanh ma user thay VIP mau do -> hieu nham -> sai gia ve
3. **Chu thich (legend):** Moi trang deu co phan chu thich mau sac o duoi so do ghe

### Code mau sac tap trung o dau?

- **Admin Editor:** Dinh nghia truc tiep trong `SeatMapEditorPage.tsx` (bien `SEAT_BG` va `SEAT_TYPES`)
- **User page:** Ham `getSeatColor()` trong `SeatSelectionPage.tsx`
- **POS page:** Ham `getSeatColor()` trong `TicketPOSPage.tsx` (copy tu User page)

> **Ghi chu cai thien:** Ly tuong thi nen trich xuat mau ghe vao `utils/colors.ts` (giong cac badge color map khac) de dam bao dong bo tuyet doi. Hien tai 3 noi dinh nghia rieng, phai sua manual khi doi mau.

---

## 13. Design Patterns da ap dung

### 13.1 Quan he N:1 (@ManyToOne) -- Seat thuoc Room

**Pattern:** Relationship Mapping (JPA/Hibernate)

```java
@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "room_id", nullable = false)
private Room room;
```

**Ví dụ đời thường:** 1 lop hoc co 40 hoc sinh. Moi hoc sinh biet minh hoc lop nao (`classId`), nhung lop hoc KHONG can biet danh sach hoc sinh (truoc khi bi hoi).

**FetchType.LAZY quan trong:**

```sql
-- Khi query 120 ghe cua phong 1:
SELECT * FROM seats WHERE room_id = 1   -- 1 query (lay 120 ghe)

-- Neu EAGER: moi ghe tu load Room
SELECT * FROM rooms WHERE id = 1        -- lap 120 lan! (N+1 problem)

-- LAZY: chi query Room khi goi seat.getRoom()
-- Trong getSeatMap(), ta da co Room tu truoc -> KHONG can goi getRoom()
-- -> 0 query thua
```

### 13.2 Batch Operation -- Sinh/sua nhieu entity cung luc

**Pattern:** Bulk Processing

```java
List<Seat> seats = new ArrayList<>();
// ... vong lap tao 120 seat objects ...
seatRepository.saveAll(seats);  // 1 lan saveAll
```

**Khong dung pattern -> code xau:**
```java
// SAI: save 120 lan = 120 round-trip den DB
for (int row = 0; row < 10; row++) {
    for (int col = 1; col <= 12; col++) {
        Seat seat = new Seat(...);
        seatRepository.save(seat);  // 120 lan INSERT rieng le
    }
}
```

**Dung pattern -> code tot:**
```java
// DUNG: gom 120 insert thanh 1 batch -> nhanh hon nhieu
List<Seat> seats = new ArrayList<>();
for (...) { seats.add(new Seat(...)); }
seatRepository.saveAll(seats);  // Hibernate batch insert
```

### 13.3 LinkedHashMap -- Giu thu tu khi nhom du lieu

**Pattern:** Ordered Collection

```java
Map<String, List<SeatResponse>> seatMap = new LinkedHashMap<>();
```

| HashMap | LinkedHashMap |
|---|---|
| Khong dam bao thu tu | Giu thu tu insert |
| Hang B co the truoc hang A | A luon truoc B truoc C |
| Nhanh hon 1 chut | Ton them 1 chut memory |

**FE can thu tu dung** de render grid tu hang A (tren) den hang J (duoi). Neu dung HashMap, so do ghe co the bi dao lon.

### 13.4 computeIfAbsent -- Nhom du lieu gon gang

```java
seatMap.computeIfAbsent(seat.getRowLabel(), k -> new ArrayList<>())
       .add(seatMapper.toResponse(seat));
```

Dong code nay lam 3 viec:
1. Check key "A" da co trong map chua?
2. Chua co -> tao ArrayList moi, put vao map
3. Da co -> lay ArrayList co san
4. Add ghe vao ArrayList

**Tuong duong code dai:**
```java
if (!seatMap.containsKey("A")) {
    seatMap.put("A", new ArrayList<>());
}
seatMap.get("A").add(seatMapper.toResponse(seat));
```

---

## 14. Câu hỏi tự kiểm tra

**Câu 1: Tại sao generate seats xóa hết ghế cũ rồi tạo mới, thay vì chỉ sửa ghế cần thiết?**

→ Vì admin có thể đổi layout hoàn toàn (VD: từ 10×12 sang 8×15, đổi hàng VIP, thêm/bớt hàng couple). Việc so sánh "ghế nào giữ, ghế nào xóa, ghế nào thêm" phức tạp hơn nhiều so với "xóa hết + tạo mới". Ngoài ra, ghế cũ không bị mất vì dùng **soft delete** (`storage_state = ARCHIVED`), vẫn có thể truy vết.

**Lưu ý:** Nếu phòng đã có suất chiếu đang bán vé, cần check trước khi cho generate lại (để tránh mất vé đã bán). Logic này nằm ở module Showtime.

---

**Câu 2: Nếu bỏ `@Modifying` ở method `softDeleteByRoomId` thì sao?**

→ Spring Data JPA mặc định coi mọi `@Query` là SELECT. Khi chạy UPDATE mà không có `@Modifying`, Spring sẽ cố map kết quả UPDATE (số dòng bị ảnh hưởng) thành entity → lỗi runtime:

```
org.springframework.dao.InvalidDataAccessApiUsageException:
  Expecting a SELECT query : UPDATE Seat s SET ...
```

`@Modifying` báo Spring: "Đây là write query, đừng cố map kết quả."

---

**Câu 3: Tại sao ghế đôi (COUPLE) lưu 2 record riêng trong DB thay vì 1 record?**

→ 3 lý do chính:
1. **1 vé = 1 ghế:** Khi đặt vé, mỗi BookingDetail map với 1 `seat_id`. Ghế đôi = 2 vé = 2 `seat_id`. Nếu lưu 1 record thì phải xử lý logic đặc biệt khi tạo vé.
2. **Query thống nhất:** `SELECT COUNT(*) FROM seats WHERE room_id = 1` trả đúng tổng số vị trí ngồi (kể cả ghế đôi đếm 2). Không cần xử lý đặc biệt.
3. **Linh hoạt:** Admin có thể đổi 1 ghế trong cặp thành STANDARD (tách cặp) hoặc BROKEN (chỉ 1 ghế hỏng) mà không ảnh hưởng ghế còn lại.

---

**Câu 4: `saveAll(120 seats)` nhanh hơn `save()` 120 lần vì sao?**

→ `save()` 120 lần = 120 round-trip riêng lẻ đến database. Mỗi round-trip có overhead: mở connection, gửi SQL, nhận kết quả, đóng connection. Còn `saveAll()` = Hibernate gom nhiều INSERT thành **1 batch**. Chỉ 1 round-trip (hoặc vài round-trip nếu batch size giới hạn). Giảm overhead mạng và DB.

Ví dụ: Gửi 120 bức thư riêng lẻ qua bưu điện vs gom 120 bức vào 1 thùng gửi 1 lần. Cách 2 rẻ và nhanh hơn nhiều.

**Cấu hình batch size** trong `application.yml`:
```yaml
spring.jpa.properties.hibernate.jdbc.batch_size: 50
```
→ Mỗi lần gửi 50 INSERT, 120 ghế = 3 batch.

---

**Câu 5: Khi admin đánh dấu ghế BROKEN, user đang ở trang chọn ghế có thấy ngay không?**

→ **Không thấy ngay** nếu chỉ dùng REST API (stateless). User phải refresh trang để thấy ghế mới bị BROKEN.

**Để thấy ngay** cần **WebSocket** (real-time). Trong CineX, module Booking đã có WebSocket (`useSeatWebSocket`) để cập nhật trạng thái ghế khi người khác giữ/hủy ghế. Nhưng hiện tại WebSocket chỉ gửi event khi đặt vé (HOLDING/CONFIRMED/AVAILABLE), chưa gửi event khi admin đổi BROKEN.

**Cải thiện:** Khi admin bulk-update BROKEN, backend gửi WebSocket event → FE cập nhật real-time.

---

**Câu 6: Tại sao dùng `LinkedHashMap` mà không dùng `TreeMap`?**

→ Cả hai đều giữ thứ tự, nhưng khác nhau:
- **TreeMap:** Sắp xếp theo key (alphabetical). Luôn đúng thứ tự A, B, C... bất kể insert thứ tự nào.
- **LinkedHashMap:** Giữ thứ tự insert. Nếu insert B trước A → B trước A.

Trong code, query đã `ORDER BY row_label ASC` → seats đến theo thứ tự A, B, C. LinkedHashMap giữ đúng thứ tự này.

TreeMap cũng được nhưng tốn performance hơn (O(log n) cho mỗi put, vs O(1) của LinkedHashMap). Với dữ liệu đã sắp xếp sẵn, LinkedHashMap là lựa chọn tốt hơn.

---

**Câu 7: Nếu 2 admin cùng generate ghế cho cùng 1 phòng cùng lúc, chuyện gì xảy ra?**

→ Nhờ có `@Transactional`, cả 2 generate chạy trong transaction riêng. Có 2 kịch bản:

1. **Kịch bản tốt (mặc định):** Admin A chạy trước → soft delete ghế cũ + tạo ghế mới. Admin B chạy sau → soft delete ghế của A + tạo ghế mới. Kết quả: ghế của B là phiên bản cuối cùng.

2. **Kịch bản xấu (race condition):** Cả 2 soft delete cùng lúc → cả 2 đều tạo ghế mới → phòng có 240 ghế (gấp đôi!).

**Cách phòng tránh:** Dùng `@Version` (Optimistic Lock) trên Room entity. Khi cả 2 cùng `room.setTotalSeats()` → 1 trong 2 sẽ gặp `OptimisticLockException` → retry hoặc báo lỗi.

---

## 11. Revamp 2026-06 — Industry-standard seat system (Option C)

> Cập nhật lớn: nâng seat system lên chuẩn chuỗi rạp lớn (CGV/Lotte/BHD/Beta).
> Trước đây: chỉ 3 SeatType (STANDARD/VIP/COUPLE), vipRows toàn row, không có aisle/blocked/handicap.

### 11.1. SeatType từ 3 → 6 loại

| Loại | Mô tả | Pricing | CineX use case |
|---|---|---|---|
| `STANDARD` | Ghế thường | basePrice | Mặc định toàn rạp |
| `VIP` | Ghế giữa rạp "sweet spot" | vipPrice | Pattern phổ biến |
| `COUPLE` | Ghế đôi thường (2 ô) | couplePrice | Hàng cuối |
| `SWEETBOX` ⭐ MỚI | Ghế đôi cao cấp, nệm dày, bàn nhỏ | sweetboxPrice (fallback couple × 2) | Premium pattern CGV |
| `DELUXE` ⭐ MỚI | Ghế ngả lưng recliner | deluxePrice (fallback vip × 1.5) | Phòng L'amour / IMAX deluxe |
| `HANDICAP` ⭐ MỚI | Ghế cho người khuyết tật | basePrice (inclusive, không phụ thu) | **NĐ 28/2012 BẮT BUỘC** đầu hàng gần lối vào |

### 11.2. SeatStatus thêm BLOCKED

| Status | Khác BROKEN ở đâu |
|---|---|
| `AVAILABLE` | Có thể đặt |
| `BROKEN` | **Tạm thời** — có thể sửa, hết bảo trì → AVAILABLE |
| `BLOCKED` ⭐ MỚI | **Vĩnh viễn** — cột bê tông, lối thoát hiểm, thiết bị máy chiếu. KHÔNG repair. |

### 11.3. `isAisle` field — lối đi

Trước: layout liên tục col 1→N (không thực tế).
Sau: `Seat.isAisle=true` đánh dấu position là LỐI ĐI giữa các block ghế.

```
Trước:                       Sau:
A1 A2 A3 A4 A5 A6 A7 A8     A1 A2 A3 [aisle] A4 A5 A6 [aisle] A7 A8
                            ^col=4, isAisle=true (render khoảng trống)
```

`isAisle` không tính vào `room.totalSeats`. FE render `AisleGap` thay vì button.

### 11.4. SeatGenerateRequest mới — zone-based

**Cũ:**
```json
{ "totalRows": 10, "totalCols": 12, "vipRows": ["E","F","G"], "coupleRow": "J" }
```
→ Toàn row E là VIP (15 ghế đều VIP — không thực tế).

**Mới:**
```json
{
  "totalRows": 10, "totalCols": 12,
  "vipZone": { "rowStart": "C", "rowEnd": "G", "colStart": 4, "colEnd": 9 },
  "coupleRows": ["J"],
  "deluxeRows": ["F"],
  "handicapPositions": [{"row":"B","col":1}, {"row":"B","col":12}],
  "aisleCols": [4, 9],
  "blockedPositions": []
}
```
→ VIP chỉ trong "sweet spot" hình chữ nhật giữa rạp (5 hàng × 6 cột). Handicap ở B1/B12 (đầu hàng B gần lối vào).

### 11.5. RoomType-aware preset (`SeatLayoutPreset.java`)

| RoomType | Preset |
|---|---|
| `TWO_D` | 10×12, VIP zone 5×6 giữa, couple hàng J, 2 handicap B1/B12, 2 aisle cols 4/9 |
| `THREE_D` | 10×12 như TWO_D nhưng VIP zone rộng hơn (kính 3D đắt) |
| `IMAX` | 14×18, VIP zone lớn + 2 hàng Deluxe F/G, 0 couple |
| `FOUR_DX` | 8×10, KHÔNG có couple/sweetbox (ghế đặc biệt rung/gió) |

API:
```json
POST /api/rooms/{id}/seats/generate
{
  "applyPresetForRoomType": true,
  "roomTypeOverride": "IMAX"
}
```

BE override request với preset → admin chỉ click 1 nút.

### 11.6. Ưu tiên SeatType khi generate

Logic resolve khi 1 position thuộc nhiều zone:

```
BLOCKED  >  AISLE  >  HANDICAP  >  SWEETBOX  >  COUPLE  >  DELUXE  >  VIP  >  STANDARD
```

VD: position B1 vừa trong handicapPositions vừa trong vipZone → HANDICAP win.

### 11.7. Booking validation

`BookingService.validateSeatSelection` chặn 3 loại với error message phân biệt:
- AISLE → "Vị trí là lối đi, không phải ghế"
- BLOCKED → "Ghế bị chặn vĩnh viễn, không thể đặt"
- BROKEN → "Ghế đang bảo trì, không thể đặt"

### 11.8. Pricing fallback rule

`BookingService.getPriceForSeat`:
```java
SWEETBOX -> sweetboxPrice (fallback couplePrice × 2)
DELUXE   -> deluxePrice   (fallback vipPrice × 1.5)
HANDICAP -> basePrice     (chính sách inclusive — không phụ thu)
```

`Showtime.sweetboxPrice` và `deluxePrice` nullable — phòng không có loại đó thì để NULL, BE tự fallback.

### 11.9. Schema migration (Liquibase 019)

```sql
ALTER TABLE seats ADD is_aisle BIT NOT NULL DEFAULT 0;
ALTER TABLE seats DROP CONSTRAINT CK_seats_seat_type;
ALTER TABLE seats ADD CONSTRAINT CK_seats_seat_type
  CHECK (seat_type IN ('STANDARD','VIP','COUPLE','SWEETBOX','DELUXE','HANDICAP'));
ALTER TABLE seats DROP CONSTRAINT CK_seats_status;
ALTER TABLE seats ADD CONSTRAINT CK_seats_status
  CHECK (status IN ('AVAILABLE','BROKEN','BLOCKED'));
ALTER TABLE showtimes ADD sweetbox_price DECIMAL(12,0), deluxe_price DECIMAL(12,0);
```

### 11.10. FE SeatMap render mới

- AISLE → `<AisleGap>` (khoảng trống, không button)
- SWEETBOX gộp 2 cột (giống COUPLE) — màu purple thay vì pink
- DELUXE single seat màu blue
- HANDICAP single seat màu green với icon `♿` thay số cột
- BLOCKED màu red-900 đậm + disabled
- BROKEN màu orange + disabled
- Row label render cả 2 bên (user dễ định hướng)

### 11.11. GenerateSeatsDialog 2-mode

- **PRESET tab** (80% case): chọn RoomType card → 1 click generate
- **CUSTOM tab** (advanced): config zones bằng input CSV + dropdown
- Hint footer: "Sau khi tạo, dùng Seat Map Editor để tinh chỉnh từng ghế"

### 11.12. Compliance pháp lý

**Nghị định 28/2012/NĐ-CP về người khuyết tật:**
> Cơ sở vật chất rạp chiếu phim phải có chỗ ngồi và đường tiếp cận cho người khuyết tật.

CineX enforce qua preset: mọi RoomType đều có ≥ 2 handicap positions ở đầu hàng B (gần lối vào). Pricing inclusive (HANDICAP = basePrice, không phụ thu).
