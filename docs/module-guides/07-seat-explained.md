# Module Seat -- Giai thich chi tiet

## 1. Tong quan

### Ghe la gi trong he thong rap phim?

Trong doi thuc, moi phong chieu phim co mot **so do ghe** co dinh: ghe xep thanh hang (A, B, C...) va cot (1, 2, 3...). Khi ban mua ve, ban chon vi tri ghe cu the -- vi du "E5" nghia la hang E, cot 5.

Trong CineX, **Seat** (ghe ngoi) la entity dai dien cho tung vi tri ngoi trong phong chieu. Moi ghe co:
- **Vi tri**: hang nao, cot nao (VD: hang E, cot 5 = "E5")
- **Loai ghe**: thuong (STANDARD), VIP, hoac ghe doi (COUPLE)
- **Trang thai**: binh thuong (AVAILABLE) hay hong (BROKEN)

### Tai sao tach Seat rieng khoi Room?

Ban co the hoi: "Room da co `totalSeats`, sao khong luu luon thong tin ghe trong Room?"

**Ly do quan trong:**

| Neu gop ghe vao Room | Neu tach Seat rieng |
|---|---|
| Room entity cuc ky lon (chua 120+ ghe) | Room nhe, Seat quan ly doc lap |
| Khong the danh dau ghe hong rieng le | Moi ghe co trang thai rieng (AVAILABLE/BROKEN) |
| Khong the gan gia khac nhau theo loai ghe | SeatType quyet dinh gia ve (STANDARD/VIP/COUPLE) |
| Khong the render so do ghe dang grid | Moi Seat co rowLabel + colNumber -> FE render grid |
| Sua layout = sua ca Room entity | Sua layout chi anh huong bang seats |

**Nguyen tac Single Responsibility (chu S trong SOLID):** Room chi quan ly thong tin phong (ten, loai, suc chua). Seat chi quan ly vi tri ngoi. Moi entity lam 1 viec.

**Vi du doi thuong:** Phong hoc co ban ghe, nhung "phong hoc" va "ghe" la 2 thu rieng biet. Ban co the thay ghe ma khong can sua phong. Tuong tu, admin co the sinh lai so do ghe (doi tu 10x12 sang 8x15) ma khong can xoa phong.

---

## 2. Danh sach files da tao/sua

| File | Tac dung | Design Pattern |
|---|---|---|
| `entity/Seat.java` | Entity ghe, `@ManyToOne` voi Room. Chua rowLabel, colNumber, seatType, status | N:1 Relationship |
| `entity/SeatType.java` | Enum 3 gia tri: STANDARD, VIP, COUPLE | Enum (type-safe) |
| `entity/SeatStatus.java` | Enum 2 gia tri: AVAILABLE, BROKEN | Enum (type-safe) |
| `dto/SeatGenerateRequest.java` | DTO config sinh ghe: totalRows, totalCols, vipRows, coupleRow | DTO + Validation |
| `dto/SeatResponse.java` | DTO tra ve thong tin 1 ghe | DTO + Builder |
| `dto/SeatMapResponse.java` | So do ghe nhom theo hang (Map<String, List<SeatResponse>>) | DTO + Builder |
| `dto/UpdateSeatRequest.java` | DTO sua 1 ghe (doi type hoac status) | DTO |
| `dto/BulkUpdateSeatRequest.java` | DTO sua nhieu ghe cung luc (bulk update) | DTO + Validation |
| `repository/SeatRepository.java` | Query ghe theo roomId, soft delete ghe theo room | Repository |
| `mapper/SeatMapper.java` | Chuyen Seat entity -> SeatResponse (MapStruct tu sinh code) | Mapper (MapStruct) |
| `service/SeatService.java` | Business logic: sinh ghe, lay so do, cap nhat, xoa mem | Service |
| `controller/SeatController.java` | 6 endpoint REST, phan quyen ADMIN cho write operations | Controller |
| `009-create-seats-table.xml` | Liquibase changelog tao bang `seats` + FK + index | Database Migration |
| **Frontend** | | |
| `hooks/useAdminSeatMap.ts` | React Query hooks: `useSeatMap`, `useBulkUpdateSeats` | Custom Hook |
| `features/admin/SeatMapEditorPage.tsx` | Trang editor so do ghe (drag-paint, bulk update) | Page Component |
| `features/booking/SeatSelectionPage.tsx` | Trang user chon ghe khi dat ve | Page Component |
| `features/admin/TicketPOSPage.tsx` | Trang POS (ban ve tai quay) cung render so do ghe | Page Component |

---

## 3. SeatType -- 3 loai ghe

```java
public enum SeatType {
    STANDARD,   // Ghe thuong
    VIP,        // Ghe VIP (giua phong, tam nhin tot nhat)
    COUPLE      // Ghe doi (hang cuoi, 1 ghe chiem 2 cot)
}
```

### Giai thich tung loai

#### STANDARD -- Ghe thuong
- **Vi tri:** Cac hang dau va hang sau (A, B, C, D, H, I)
- **Dac diem:** Ghe don binh thuong, 1 ghe = 1 cot
- **Gia:** Gia co ban (`basePrice` cua showtime)
- **Mau hien thi:** Xanh la (`bg-green-600`)
- **Doi tuong:** Phan lon khan gia

#### VIP -- Ghe VIP
- **Vi tri:** Cac hang giua phong (E, F, G) -- vung "sweet spot" co goc nhin va am thanh tot nhat
- **Dac diem:** Ghe don nhu STANDARD nhung gia cao hon
- **Gia:** `vipPrice` cua showtime (thuong cao hon basePrice 20-50%)
- **Mau hien thi:** Vang (`bg-yellow-600` / `bg-[#eab308]`)
- **Doi tuong:** Khan gia muon trai nghiem tot hon, san sang tra them

#### COUPLE -- Ghe doi
- **Vi tri:** Hang cuoi cung (VD: hang J) -- rieng tu, thich hop cho cap doi
- **Dac diem:**
  - 1 ghe "logic" = 2 cot vat ly (colspan 2)
  - Ghe duoc ghep cap: cot 1-2 la 1 doi, cot 3-4 la 1 doi, ...
  - Click chon 1 ghe -> tu dong chon ca ghe con lai trong cap
  - Neu tong so cot la so le (VD: 13 cot) -> ghe cuoi (cot 13) thanh STANDARD (khong the ghep doi)
- **Gia:** `couplePrice` cua showtime (thuong = 2x basePrice hoac cao hon)
- **Mau hien thi:** Tim (`bg-purple-500` / `bg-purple-600`)
- **Doi tuong:** Cap doi muon ngoi canh nhau

### Gia ghe duoc tinh nhu the nao?

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

**Luu y:** Gia KHONG luu trong Seat entity. Gia luu trong Showtime. Ly do: cung 1 ghe VIP nhung suat chieu sang co the re hon suat chieu toi. Gia phu thuoc vao thoi gian, khong phu thuoc vao ghe.

---

## 4. SeatStatus -- Trang thai ghe

```java
public enum SeatStatus {
    AVAILABLE,  // Ghe binh thuong, co the dat
    BROKEN      // Ghe hong, khong cho dat
}
```

### AVAILABLE -- Ghe hoat dong
- Mac dinh khi sinh ghe moi
- User co the chon ghe nay de dat ve
- Hien thi mau binh thuong (theo SeatType)

### BROKEN -- Ghe hong
- Admin danh dau khi ghe bi hu (gay, rach, hong...)
- **User KHONG the dat ghe BROKEN** -- button bi disable, cursor `not-allowed`
- Hien thi mau do (`bg-red-600`) bat ke loai ghe la gi
- Khi ghe duoc sua xong, admin doi lai AVAILABLE

**Tai sao can trang thai BROKEN?**

Trong doi thuc, rap phim co hang tram ghe. Khi 1 ghe bi hong, nhan vien khong the thao ghe ngay (phai doi bao tri). Trong luc cho, ghe do van ton tai nhung khong duoc ban ve. Trang thai BROKEN giup:
1. **User khong dat nham ghe hong** -> trai nghiem tot
2. **Admin biet ghe nao can sua** -> quan ly tot
3. **Khong mat du lieu** -> ghe van o do, chi doi trang thai (thay vi xoa roi tao lai)

**Luu y su khac biet:**

| | SeatStatus (BROKEN) | StorageState (ARCHIVED) |
|---|---|---|
| Muc dich | Ghe hong tam thoi | Xoa mem vinh vien |
| User thay khong? | CO -- thay ghe do | KHONG -- bi filter ra khoi query |
| Co the phuc hoi? | Doi ve AVAILABLE | Doi ve ACTIVE |
| Ai thay doi? | Admin qua bulk update | He thong khi generate lai ghe |

---

## 5. Thuat toan sinh ghe tu dong (Generate Seats)

Day la tinh nang quan trong nhat cua module Seat. Thay vi admin phai tao tung ghe mot (120 lan!), he thong **tu dong sinh toan bo so do ghe** tu config don gian.

### Input cua admin

```json
{
  "totalRows": 10,      // 10 hang (A -> J)
  "totalCols": 12,      // 12 cot moi hang
  "vipRows": ["E","F","G"],  // Hang E, F, G la VIP
  "coupleRow": "J"       // Hang J la ghe doi
}
```

### Thuat toan chi tiet (dong code thuc te)

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

### Vi du cu the voi 10 hang x 12 cot

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

### Xu ly ghe le cuoi hang couple

Khi `totalCols` la so le (VD: 13 cot), hang couple khong the ghep doi hoan hao:

```
Hang J (13 cot):
  [J1-J2] [J3-J4] [J5-J6] [J7-J8] [J9-J10] [J11-J12] [J13]
  COUPLE  COUPLE  COUPLE  COUPLE  COUPLE   COUPLE    STANDARD
                                                       ^
                                              Ghe le -> doi thanh STANDARD
```

Code xu ly:
```java
// Ghe doi ghep cap 1-2, 3-4, ... -- ghe le cuoi (khi totalCols le) -> STANDARD
boolean isLastOddCol = (request.getTotalCols() % 2 != 0)
                    && (col == request.getTotalCols());
seatType = isLastOddCol ? SeatType.STANDARD : SeatType.COUPLE;
```

**Tai sao khong bo ghe le?** Vi layout can can doi. Neu hang khac co 13 cot ma hang couple chi co 12, grid se bi lech. Giu ghe le la STANDARD dam bao so cot dong deu moi hang.

---

## 6. Ghe doi COUPLE -- Chi tiet ky thuat

Ghe doi la loai ghe phuc tap nhat vi no anh huong ca backend lan frontend.

### Backend: Luu tru

Trong database, moi ghe COUPLE van la **1 record rieng**. 1 cap ghe doi = 2 records:

```
id | room_id | row_label | col_number | seat_number | seat_type | status
---|---------|-----------|------------|-------------|-----------|--------
109|    1    |     J     |     1      |     J1      |  COUPLE   | AVAILABLE
110|    1    |     J     |     2      |     J2      |  COUPLE   | AVAILABLE
111|    1    |     J     |     3      |     J3      |  COUPLE   | AVAILABLE
112|    1    |     J     |     4      |     J4      |  COUPLE   | AVAILABLE
```

**Tai sao khong luu 1 record cho 1 cap?**
- Don gian hoa: moi record = 1 vi tri = 1 ve. Khi dat ve, moi ve map voi 1 seat_id
- Thong nhat: query `SELECT * FROM seats WHERE room_id = 1` tra ve du 120 record, khong can xu ly dac biet
- Linh hoat: admin co the doi 1 ghe trong cap ve STANDARD (tach cap)

### Frontend: Ghep cap va colspan 2

FE dung quy tac **cot le ghep voi cot chan ke ben**:

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

### Render: 1 button rong 2 cot

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

**Vi du doi thuong:** 1 lop hoc co 40 hoc sinh. Moi hoc sinh biet minh hoc lop nao (`classId`), nhung lop hoc KHONG can biet danh sach hoc sinh (truoc khi bi hoi).

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

## 14. Cau hoi tu kiem tra

### Cau 1: Tai sao generate seats xoa het ghe cu roi tao moi, thay vi chi sua ghe can thiet?

<details>
<summary>Xem dap an</summary>

Vi admin co the doi layout hoan toan (VD: tu 10x12 sang 8x15, doi hang VIP, them/bot hang couple). Viec so sanh "ghe nao giu, ghe nao xoa, ghe nao them" phuc tap hon nhieu so voi "xoa het + tao moi". Ngoai ra, ghe cu khong bi mat vi dung **soft delete** (storage_state = ARCHIVED), van co the truy vet.

**Luu y:** Neu phong da co suat chieu dang ban ve, can check truoc khi cho generate lai (de tranh mat ve da ban). Logic nay nam o module Showtime.
</details>

### Cau 2: Neu bo `@Modifying` o method `softDeleteByRoomId` thi sao?

<details>
<summary>Xem dap an</summary>

Spring Data JPA mac dinh coi moi `@Query` la SELECT. Khi chay UPDATE ma khong co `@Modifying`, Spring se co map ket qua UPDATE (so dong bi anh huong) thanh entity -> loi runtime:

```
org.springframework.dao.InvalidDataAccessApiUsageException:
  Expecting a SELECT query : UPDATE Seat s SET ...
```

`@Modifying` bao Spring: "Day la write query, dung co map ket qua."
</details>

### Cau 3: Tai sao ghe doi (COUPLE) luu 2 record rieng trong DB thay vi 1 record?

<details>
<summary>Xem dap an</summary>

3 ly do chinh:
1. **1 ve = 1 ghe:** Khi dat ve, moi BookingDetail map voi 1 seat_id. Ghe doi = 2 ve = 2 seat_id. Neu luu 1 record thi phai xu ly logic dac biet khi tao ve.
2. **Query thong nhat:** `SELECT COUNT(*) FROM seats WHERE room_id = 1` tra dung tong so vi tri ngoi (ke ca ghe doi dem 2). Khong can xu ly dac biet.
3. **Linh hoat:** Admin co the doi 1 ghe trong cap thanh STANDARD (tach cap) hoac BROKEN (chi 1 ghe hong) ma khong anh huong ghe con lai.
</details>

### Cau 4: `saveAll(120 seats)` nhanh hon `save()` 120 lan vi sao?

<details>
<summary>Xem dap an</summary>

- `save()` 120 lan = 120 round-trip rieng le den database. Moi round-trip co overhead: mo connection, gui SQL, nhan ket qua, dong connection.
- `saveAll()` = Hibernate gom nhieu INSERT thanh **1 batch**. Chi 1 round-trip (hoac vai round-trip neu batch size gioi han). Giam overhead mang va DB.

Vi du: Gui 120 buc thu rieng le qua buu dien vs gom 120 buc vao 1 thung gui 1 lan. Cach 2 re va nhanh hon nhieu.

**Cau hinh batch size** trong `application.yml`:
```yaml
spring.jpa.properties.hibernate.jdbc.batch_size: 50
```
-> Moi lan gui 50 INSERT, 120 ghe = 3 batch.
</details>

### Cau 5: Khi admin danh dau ghe BROKEN, user dang o trang chon ghe co thay ngay khong?

<details>
<summary>Xem dap an</summary>

**Khong thay ngay** neu chi dung REST API (stateless). User phai refresh trang de thay ghe moi bi BROKEN.

**De thay ngay** can **WebSocket** (real-time). Trong CineX, module Booking da co WebSocket (`useSeatWebSocket`) de cap nhat trang thai ghe khi nguoi khac giu/huy ghe. Nhung hien tai WebSocket chi gui event khi dat ve (HOLDING/CONFIRMED/AVAILABLE), chua gui event khi admin doi BROKEN.

**Cai thien:** Khi admin bulk-update BROKEN, backend gui WebSocket event -> FE cap nhat real-time.
</details>

### Cau 6: Tai sao dung `LinkedHashMap` ma khong dung `TreeMap`?

<details>
<summary>Xem dap an</summary>

Ca hai deu giu thu tu, nhung khac nhau:
- **TreeMap:** Sap xep theo key (alphabetical). Luon dung thu tu A, B, C... bat ke insert thu tu nao.
- **LinkedHashMap:** Giu thu tu insert. Neu insert B truoc A -> B truoc A.

Trong code, query da `ORDER BY row_label ASC` -> seats den theo thu tu A, B, C. LinkedHashMap giu dung thu tu nay.

TreeMap cung duoc nhung ton performance hon (O(log n) cho moi put, vs O(1) cua LinkedHashMap). Voi du lieu da sap xep san, LinkedHashMap la lua chon tot hon.
</details>

### Cau 7: Neu 2 admin cung generate ghe cho cung 1 phong cung luc, chuyen gi xay ra?

<details>
<summary>Xem dap an</summary>

Nho co `@Transactional`, ca 2 generate chay trong transaction rieng. Co 2 kich ban:

1. **Kich ban tot (mac dinh):** Admin A chay truoc -> soft delete ghe cu + tao ghe moi. Admin B chay sau -> soft delete ghe cua A + tao ghe moi. Ket qua: ghe cua B la phien ban cuoi cung.

2. **Kich ban xau (race condition):** Ca 2 soft delete cung luc -> ca 2 deu tao ghe moi -> phong co 240 ghe (gap doi!).

**Cach phong tranh:** Dung `@Version` (Optimistic Lock) tren Room entity. Khi ca 2 cung `room.setTotalSeats()` -> 1 trong 2 se gap `OptimisticLockException` -> retry hoac bao loi.
</details>
