# Module Room & Seat -- Giai thich chi tiet

## 1. Tong quan

Module Room & Seat quan ly **phong chieu** va **so do ghe ngoi** trong rap phim CineX.

### Bai toan thuc te
Khi ban di xem phim tai CGV hay Lotte Cinema, ban thay:
- Moi rap co nhieu **phong chieu** (Room 1, Room 2, ...), moi phong co loai khac nhau (2D, 3D, IMAX, 4DX)
- Moi phong co mot **so do ghe** (seat map): hang A den J, cot 1 den 15
- Ghe co nhieu loai: ghe thuong (STANDARD), ghe VIP (o giua, tam nhin tot), ghe doi (COUPLE, o hang cuoi)
- Co ghe bi hong (BROKEN) -- hien mau do, nguoi dung khong chon duoc
- Admin co the tao phong, sinh ghe tu dong, danh dau ghe hong, doi loai ghe

### Module nay gom 2 phan:
1. **Room** (phong chieu): CRUD phong, loc theo ten/loai/trang thai
2. **Seat** (ghe ngoi): sinh ghe tu dong, xem so do ghe, cap nhat loai ghe/trang thai ghe

### Vi sao tach thanh 2 module rieng?
- **Single Responsibility**: Room chi quan ly thong tin phong (ten, loai, trang thai). Seat chi quan ly ghe (vi tri, loai, hong/khong hong)
- **Dependency Inversion**: Seat phu thuoc Room (ghe thuoc phong), nhung Room khong biet gi ve Seat
- Ngoai doi thuc, team "quan ly phong" va team "quan ly ghe" co the lam doc lap

---

## 2. Danh sach files va Design Pattern

### Module Room

| File | Tac dung | Design Pattern |
|---|---|---|
| `module/room/entity/Room.java` | Entity map bang `rooms` | BaseEntity Inheritance |
| `module/room/entity/RoomType.java` | Enum loai phong: TWO_D, THREE_D, IMAX, FOUR_DX | Enum (type-safe) |
| `module/room/entity/RoomStatus.java` | Enum trang thai: ACTIVE, MAINTENANCE, INACTIVE | Enum |
| `module/room/dto/RoomRequest.java` | DTO tao/sua phong (co validation) | DTO |
| `module/room/dto/RoomResponse.java` | DTO tra thong tin phong | DTO + Builder |
| `module/room/dto/RoomFilter.java` | DTO nhan tham so loc tu FE | Filter DTO |
| `module/room/repository/RoomRepository.java` | Truy van bang rooms + ho tro Specification | Repository |
| `module/room/specification/RoomSpecification.java` | Build cau WHERE dong (keyword, type, status) | Specification Pattern |
| `module/room/mapper/RoomMapper.java` | Room -> RoomResponse (MapStruct sinh code luc compile) | Mapper |
| `module/room/service/RoomService.java` | Business logic: CRUD, soft delete, bulk delete/restore | Service Layer |
| `module/room/controller/RoomController.java` | 8 REST endpoints (CRUD + bulk + restore) | Controller |

### Module Seat

| File | Tac dung | Design Pattern |
|---|---|---|
| `module/seat/entity/Seat.java` | Entity map bang `seats`, quan he N:1 voi Room | BaseEntity + ManyToOne |
| `module/seat/entity/SeatType.java` | Enum loai ghe: STANDARD, VIP, COUPLE | Enum |
| `module/seat/entity/SeatStatus.java` | Enum trang thai ghe: AVAILABLE, BROKEN | Enum |
| `module/seat/dto/SeatGenerateRequest.java` | Cau hinh sinh ghe tu dong (so hang, so cot, hang VIP, hang couple) | DTO + Validation |
| `module/seat/dto/SeatResponse.java` | DTO tra thong tin 1 ghe | DTO + Builder |
| `module/seat/dto/SeatMapResponse.java` | DTO tra so do ghe nhom theo hang (Map<String, List>) | DTO + Builder |
| `module/seat/dto/UpdateSeatRequest.java` | DTO cap nhat 1 ghe (loai hoac trang thai) | DTO |
| `module/seat/dto/BulkUpdateSeatRequest.java` | DTO cap nhat nhieu ghe cung luc | DTO + Validation |
| `module/seat/repository/SeatRepository.java` | Truy van ghe + soft delete hang loat bang JPQL | Repository |
| `module/seat/mapper/SeatMapper.java` | Seat -> SeatResponse (MapStruct) | Mapper |
| `module/seat/service/SeatService.java` | Business logic: sinh ghe, cap nhat, bulk update | Service Layer |
| `module/seat/controller/SeatController.java` | 6 REST endpoints duoi `/api/rooms/{roomId}/seats` | Nested Resource Controller |

---

## 3. Design Patterns chi tiet

### 3.1. Specification Pattern -- Xay cau truy van WHERE dong

#### Pattern nay la gi?
Specification thuoc nhom **Behavioral Pattern**. No cho phep **ghep nhieu dieu kien loc** thanh 1 cau truy van, ma khong phai viet nhieu method trong Repository.

#### Vi du doi thuong
Tuong tuong ban di mua ao tren Shopee:
- Loc theo **mau**: do
- Loc theo **gia**: 100k - 500k
- Loc theo **thuong hieu**: Nike

Moi bo loc la 1 "Specification". Ban co the bat/tat tung bo loc -- va chung tu dong ghep lai thanh 1 cau truy van. Khong co bo loc nao? Tra tat ca. Co 3 bo loc? Tra ket qua thoa man ca 3.

#### Ap dung o dau trong code?

File: `module/room/specification/RoomSpecification.java`

```java
public static Specification<Room> fromFilter(RoomFilter filter) {
    Specification<Room> spec = Specification.where(null); // Bat dau = khong co dieu kien

    // Neu FE gui includeDeleted=false (hoac khong gui) -> loc bo ban ghi da xoa
    if (!Boolean.TRUE.equals(filter.getIncludeDeleted())) {
        spec = spec.and(notDeleted());
    }
    // Neu FE gui keyword="Room" -> them dieu kien LIKE '%room%'
    if (StringUtils.hasText(filter.getKeyword())) {
        spec = spec.and(hasName(filter.getKeyword()));
    }
    // Neu FE gui type=IMAX -> them dieu kien type = 'IMAX'
    if (filter.getType() != null) {
        spec = spec.and(hasType(filter.getType()));
    }
    // Neu FE gui status=ACTIVE -> them dieu kien status = 'ACTIVE'
    if (filter.getStatus() != null) {
        spec = spec.and(hasStatus(filter.getStatus()));
    }
    return spec;
}
```

Moi method tra ve 1 `Specification<Room>` -- ban chat la 1 lambda tao ra 1 `Predicate` (dieu kien WHERE trong SQL):

```java
public static Specification<Room> hasName(String keyword) {
    return (root, query, cb) ->
            cb.like(cb.lower(root.get("name")), "%" + keyword.toLowerCase() + "%");
}
// root   = bang "rooms" (tu do lay cot)
// query  = cau SELECT dang xay
// cb     = CriteriaBuilder -- cong cu tao dieu kien (like, equal, greaterThan, ...)
```

#### Tai sao dung Specification?

**KHONG dung Specification** -- viet hang chuc method trong Repository:

```java
// Moi to hop filter = 1 method rieng -- SO LUONG TANG THEO CAP SO NHAN!
List<Room> findByNameContaining(String keyword);
List<Room> findByType(RoomType type);
List<Room> findByStatus(RoomStatus status);
List<Room> findByNameContainingAndType(String keyword, RoomType type);
List<Room> findByNameContainingAndStatus(String keyword, RoomStatus status);
List<Room> findByTypeAndStatus(RoomType type, RoomStatus status);
List<Room> findByNameContainingAndTypeAndStatus(String keyword, RoomType type, RoomStatus status);
// Con phan trang? x2 nua!
```

3 truong loc = 2^3 = 8 method. 5 truong loc = 2^5 = 32 method. **Khong kha thi!**

**CO Specification** -- chi 1 method duy nhat:

```java
// Repository chi can them JpaSpecificationExecutor
public interface RoomRepository extends JpaRepository<Room, Long>,
                                        JpaSpecificationExecutor<Room> {
    // KHONG can viet method filter nao ca!
}

// Service goi:
var spec = RoomSpecification.fromFilter(filter);
roomRepository.findAll(spec, pageable);  // 1 dong duy nhat!
```

#### Khi nao KHONG nen dung?
- Entity chi co 1-2 filter co dinh (VD: `findByUsername`) -- dung Spring Data method la du
- Query qua phuc tap voi nhieu JOIN -- dung `@Query` voi JPQL/native SQL ro rang hon

---

### 3.2. Soft Delete Pattern -- Xoa mem

#### Pattern nay la gi?
Thay vi `DELETE FROM rooms WHERE id = 1` (xoa vinh vien, mat du lieu), ta **doi trang thai** cua ban ghi thanh "da xoa" (ARCHIVED). Du lieu van con trong DB, nhung cac cau truy van mac dinh se loc bo no.

#### Vi du doi thuong
Khi ban xoa email trong Gmail, email khong bien mat ngay -- no vao **Thung rac** (Trash). Sau 30 ngay moi xoa that. Trong thoi gian do, ban co the **khoi phuc** (Restore).

Soft Delete hoat dong y heu: ban ghi van nam trong DB (tuong duong thung rac), va admin co the khoi phuc bat ky luc nao.

#### Ap dung o dau trong code?

Moi entity trong CineX deu ke thua `BaseEntity`, trong do co truong `storageState`:

```
StorageState.ACTIVE   = ban ghi binh thuong (hien thi cho user)
StorageState.ARCHIVED = ban ghi da xoa (an khoi user, admin co the khoi phuc)
```

**Room -- xoa mem:**
```java
// RoomService.deleteRoom()
public void deleteRoom(Long id) {
    Room room = roomRepository.findById(id)
            .orElseThrow(() -> new BusinessException(ErrorCode.ROOM_NOT_FOUND));
    room.setStorageState(StorageState.ARCHIVED);  // Chi doi trang thai
    roomRepository.save(room);                     // UPDATE, KHONG DELETE
}
```

**Seat -- xoa mem hang loat bang JPQL:**
```java
// SeatRepository -- soft delete tat ca ghe cua phong
@Modifying
@Query("UPDATE Seat s SET s.storageState = StorageState.ARCHIVED "
     + "WHERE s.room.id = :roomId AND s.storageState <> StorageState.ARCHIVED")
void softDeleteByRoomId(Long roomId);
```

**Loc bo ban ghi da xoa (Specification):**
```java
public static Specification<Room> notDeleted() {
    return (root, query, cb) ->
            cb.or(
                cb.isNull(root.get("storageState")),           // null = chua set = ACTIVE
                cb.notEqual(root.get("storageState"), StorageState.ARCHIVED)  // khong phai ARCHIVED
            );
}
```

#### Tai sao dung Soft Delete?
1. **Audit trail**: biet ai da xoa gi, khi nao -- phuc vu dieu tra, bao cao
2. **Khoi phuc**: admin click "Restore" la xong, khong can backup DB
3. **Toan ven du lieu**: ghe da ban thuoc phong da xoa -- van con du lieu de doi chieu
4. **Phap ly**: mot so nganh (tai chinh, y te) BAT BUOC luu du lieu N nam

#### Khi nao KHONG nen dung?
- Du lieu tam (session, OTP, token) -- xoa that de giam tai DB
- GDPR yeu cau "quyen bi lang quen" -- phai xoa that du lieu ca nhan

---

### 3.3. Quan he @ManyToOne -- Room va Seat

#### Bai toan
- 1 phong co **nhieu ghe** (1 Room : N Seats)
- 1 ghe chi thuoc **1 phong** (N Seats : 1 Room)

Day la quan he **Many-to-One** (nhieu-mot) -- loai quan he pho bien nhat trong database.

#### Ap dung trong code

```java
// Seat.java
@ManyToOne(fetch = FetchType.LAZY)          // (1)
@JoinColumn(name = "room_id", nullable = false)  // (2)
private Room room;
```

Giai thich tung annotation:

**(1) `@ManyToOne(fetch = FetchType.LAZY)`**
- `@ManyToOne`: nhieu Seat thuoc 1 Room
- `fetch = LAZY`: khi truy van Seat, **KHONG** tu dong load Room entity. Chi load khi goi `seat.getRoom()`
- Tai sao LAZY? Vi khi list 100 ghe, ban khong can load 100 lan Room entity (tat ca deu cung 1 phong). Neu de EAGER (mac dinh cua @ManyToOne), JPA se chay 100 cau SELECT Room => **N+1 problem**

**(2) `@JoinColumn(name = "room_id", nullable = false)`**
- `name = "room_id"`: cot khoa ngoai trong bang `seats` tro ve bang `rooms`
- `nullable = false`: ghe PHAI thuoc 1 phong, khong duoc null

#### N+1 Problem la gi?

```
Gia su ban list 100 ghe voi fetch = EAGER:

Query 1: SELECT * FROM seats                       -- 1 cau
Query 2: SELECT * FROM rooms WHERE id = 1          -- cho ghe A1
Query 3: SELECT * FROM rooms WHERE id = 1          -- cho ghe A2 (LAP LAI!)
Query 4: SELECT * FROM rooms WHERE id = 1          -- cho ghe A3 (LAP LAI!)
...
Query 101: SELECT * FROM rooms WHERE id = 1        -- cho ghe J12

Tong: 1 + 100 = 101 cau query! (Mac du tat ca ghe cung phong id=1)
```

Voi `LAZY`, chi co 1 cau query: `SELECT * FROM seats WHERE room_id = 1`. Room chi duoc load khi can.

#### Tai sao module nay KHONG dung @OneToMany trong Room?

Ban co the tu hoi: "Tai sao Room.java khong co `List<Seat> seats`?"

```java
// Room.java -- KHONG co truong seats
public class Room extends BaseEntity {
    private String name;
    private RoomType type;
    private Integer totalSeats;
    private RoomStatus status;
    // KHONG co: private List<Seat> seats;
}
```

Ly do:
1. **Module tach biet**: Room va Seat la 2 module rieng. Room khong nen biet cau truc cua Seat
2. **Performance**: Load room khong can load 200 ghe. Khi can ghe -> goi `SeatService.getSeatMap(roomId)`
3. **Dependency Inversion**: Seat phu thuoc Room (co `room_id`), nhung Room KHONG phu thuoc Seat

> **Quy tac**: @ManyToOne dat o phia "nhieu" (Seat). @OneToMany dat o phia "mot" (Room) -- chi khi THAT SU can (VD: cascade delete). Trong CineX, ta khong dung cascade ma dung soft delete rieng => khong can @OneToMany.

---

## 4. So do ghe (Seat) -- Chi tiet

### 4.1. SeatType -- Loai ghe

| Gia tri | Mo ta | Vi tri thuong gap | Gia ve |
|---|---|---|---|
| `STANDARD` | Ghe thuong | Hang A-D (gan man hinh), hang H-I | Gia co ban |
| `VIP` | Ghe VIP -- dem lon hon, tam nhin tot | Hang E-G (giua phong) | +30-50% |
| `COUPLE` | Ghe doi -- 2 nguoi ngoi chung 1 ghe rong | Hang J (hang cuoi) | x2 |

### 4.2. SeatStatus -- Trang thai ghe

| Gia tri | Mo ta | Hien thi tren FE |
|---|---|---|
| `AVAILABLE` | Ghe binh thuong, co the dat | Mau trang/xanh |
| `BROKEN` | Ghe hong, KHONG cho dat | Mau do, khong click duoc |

**Luu y**: `SeatStatus` khac voi trang thai khi dat ve:
- `AVAILABLE` / `BROKEN` la **trang thai vat ly** cua ghe (hong hay khong hong) -- do admin quan ly
- Khi dat ve, ghe se co trang thai **HOLDING** (dang giu) / **BOOKED** (da ban) -- do BookingService quan ly, luu trong bang `booking_seats`, KHONG phai trong bang `seats`

### 4.3. Ghe doi (COUPLE) -- Ghep cap tu dong

Khi sinh ghe cho hang COUPLE (VD: hang J, 12 cot):

```
J1-J2   = COUPLE (cap 1)
J3-J4   = COUPLE (cap 2)
J5-J6   = COUPLE (cap 3)
J7-J8   = COUPLE (cap 4)
J9-J10  = COUPLE (cap 5)
J11-J12 = COUPLE (cap 6)
```

**Truong hop dac biet**: Neu so cot LE (VD: 11 cot):

```
J1-J2   = COUPLE
J3-J4   = COUPLE
...
J9-J10  = COUPLE
J11     = STANDARD   <-- Ghe le cuoi cung => KHONG the la COUPLE => doi ve STANDARD
```

Code xu ly:

```java
// SeatService.generateSeats()
if (isCoupleRow) {
    boolean isLastOddCol = (request.getTotalCols() % 2 != 0)    // Tong cot le?
                        && (col == request.getTotalCols());       // La cot cuoi?
    seatType = isLastOddCol ? SeatType.STANDARD : SeatType.COUPLE;
}
```

### 4.4. Ghe hong (BROKEN) -- Luong xu ly

**Admin danh dau ghe hong:**
```
Admin chon ghe A5 tren Seat Map Editor
   |
   v
PUT /api/rooms/1/seats/5  { "status": "BROKEN" }
   |
   v
SeatService.updateSeat(5, request)
   |-- seat.setStatus(SeatStatus.BROKEN)
   |-- save(seat)
   v
Ghe A5 bay gio co status = BROKEN
```

**User dat ve -- ghe hong hien mau do:**
```
User vao trang chon ghe
   |
   v
GET /api/rooms/1/seats  (lay seat map)
   |
   v
FE nhan duoc seatMap, voi A5 co status = "BROKEN"
   |
   v
FE render ghe A5 mau DO, disable click
   |
   v
User click ghe A5 => KHONG co gi xay ra (disabled)
```

**BE chan khi user co tinh gui request voi ghe hong:**
```
Khi BookingService xu ly dat ve:
   |-- Kiem tra tung seatId trong danh sach
   |-- Neu seat.status == BROKEN => throw BusinessException(SEAT_ALREADY_BOOKED)
   |-- User khong the dat ghe hong du co gui request truc tiep
```

### 4.5. Bulk update loai ghe

Admin co the chon nhieu ghe cung luc va doi loai (VD: chon A1-A5 doi thanh VIP):

```java
// SeatService.bulkUpdateSeats()
if (request.getStatus() == SeatStatus.BROKEN) {
    // Truong hop 1: Danh dau nhieu ghe la HONG
    seats.forEach(s -> s.setStatus(SeatStatus.BROKEN));

} else if (request.getSeatType() != null) {
    // Truong hop 2: Doi loai ghe (VD: STANDARD -> VIP)
    seats.forEach(s -> {
        s.setSeatType(request.getSeatType());
        // Neu ghe dang BROKEN ma admin doi loai -> tu dong khoi phuc AVAILABLE
        if (s.getStatus() == SeatStatus.BROKEN) {
            s.setStatus(SeatStatus.AVAILABLE);
        }
    });
}
```

**Tai sao doi loai ghe thi khoi phuc BROKEN -> AVAILABLE?**
Vi du: ghe A5 bi hong (ghe thuong). Admin muon thay ghe moi loai VIP -> ghe moi khong con hong nua -> tu dong AVAILABLE.

---

## 5. Generate Seats tu dong -- Thuat toan chi tiet

### Input mau

```json
{
  "totalRows": 10,      // 10 hang: A -> J
  "totalCols": 12,      // 12 cot: 1 -> 12
  "vipRows": ["E", "F", "G"],  // Hang E, F, G la VIP
  "coupleRow": "J"       // Hang J la ghe doi
}
```

### Ket qua sinh ra

```
       1    2    3    4    5    6    7    8    9   10   11   12
  A [ STD  STD  STD  STD  STD  STD  STD  STD  STD  STD  STD  STD ]  <- STANDARD
  B [ STD  STD  STD  STD  STD  STD  STD  STD  STD  STD  STD  STD ]  <- STANDARD
  C [ STD  STD  STD  STD  STD  STD  STD  STD  STD  STD  STD  STD ]  <- STANDARD
  D [ STD  STD  STD  STD  STD  STD  STD  STD  STD  STD  STD  STD ]  <- STANDARD
  E [ VIP  VIP  VIP  VIP  VIP  VIP  VIP  VIP  VIP  VIP  VIP  VIP ]  <- VIP
  F [ VIP  VIP  VIP  VIP  VIP  VIP  VIP  VIP  VIP  VIP  VIP  VIP ]  <- VIP
  G [ VIP  VIP  VIP  VIP  VIP  VIP  VIP  VIP  VIP  VIP  VIP  VIP ]  <- VIP
  H [ STD  STD  STD  STD  STD  STD  STD  STD  STD  STD  STD  STD ]  <- STANDARD
  I [ STD  STD  STD  STD  STD  STD  STD  STD  STD  STD  STD  STD ]  <- STANDARD
  J [  CPL       CPL       CPL       CPL       CPL       CPL      ]  <- COUPLE (6 cap)

                         MAN HINH
```

Tong: 10 hang x 12 cot = 120 ghe

### Thuat toan tung buoc

```
Buoc 1: Validate input
   |-- vipRows phai nam trong range A -> (A + totalRows - 1)
   |-- coupleRow phai nam trong range A -> (A + totalRows - 1)
   |-- Neu khong hop le -> throw INVALID_REQUEST
   v
Buoc 2: Soft delete ghe cu (neu co)
   |-- UPDATE seats SET storage_state = 'ARCHIVED' WHERE room_id = ? AND storage_state <> 'ARCHIVED'
   |-- KHONG hard delete -> giu audit trail
   v
Buoc 3: Vong lap tao ghe
   |-- for row = 0 -> totalRows-1:
   |     |-- rowLabel = (char)('A' + row)  => "A", "B", ..., "J"
   |     |-- Xac dinh isCoupleRow, isVipRow
   |     |-- for col = 1 -> totalCols:
   |     |     |-- Xac dinh seatType (logic o muc 4.3)
   |     |     |-- Tao Seat { room, rowLabel, colNumber, seatNumber, seatType, status=AVAILABLE }
   |     v
   v
Buoc 4: saveAll(seats) => INSERT 120 ban ghi
   v
Buoc 5: Cap nhat room.totalSeats = 120
   v
Buoc 6: Tra ve SeatMapResponse (so do ghe nhom theo hang)
```

### Validation -- Chong nhap sai

```java
// Tinh hang lon nhat hop le
char maxRowChar = (char) ('A' + request.getTotalRows() - 1);  // totalRows=10 => maxRow='J'

// Kiem tra tung hang VIP
for (String vr : vipRows) {
    if (vr.length() != 1 || vr.charAt(0) < 'A' || vr.charAt(0) > maxRowChar) {
        throw new BusinessException(ErrorCode.INVALID_REQUEST,
                "Hang VIP '" + vr + "' nam ngoai pham vi A-" + maxRow);
    }
}
```

Vi du loi: `totalRows=5` (hang A-E) nhung `vipRows=["G"]` => G > E => loi!

---

## 6. So do luong xu ly (ASCII Diagram)

### 6.1. Admin tao phong va sinh ghe

```
Admin Frontend                    Backend
     |
     |  POST /api/rooms
     |  { "name": "Room 1", "type": "IMAX", "totalSeats": 0 }
     |  --------------------------------------------------------->
     |                                   |
     |                                   v
     |                            RoomController.createRoom()
     |                                   |
     |                                   v
     |                            RoomService.createRoom()
     |                              |-- existsByName("Room 1") => false
     |                              |-- Room.builder()...build()
     |                              |-- save(room)
     |                              |-- return RoomResponse { id: 1 }
     |  <---------------------------------------------------------
     |  Response: { id: 1, name: "Room 1", totalSeats: 0 }
     |
     |  (Admin mo Seat Map Editor)
     |
     |  POST /api/rooms/1/seats/generate
     |  { "totalRows": 10, "totalCols": 12, "vipRows": ["E","F","G"], "coupleRow": "J" }
     |  --------------------------------------------------------->
     |                                   |
     |                                   v
     |                            SeatController.generateSeats()
     |                                   |
     |                                   v
     |                            SeatService.generateSeats()
     |                              |-- findRoom(1) => Room
     |                              |-- validate vipRows, coupleRow
     |                              |-- softDeleteByRoomId(1) -- xoa ghe cu
     |                              |-- Vong lap tao 120 ghe
     |                              |-- saveAll(120 seats)
     |                              |-- room.setTotalSeats(120)
     |                              |-- save(room) -- cap nhat tong ghe
     |                              |-- return SeatMapResponse
     |  <---------------------------------------------------------
     |  Response: { roomId: 1, roomName: "Room 1", totalSeats: 120, seatMap: {...} }
     |
     |  (Admin bam ghe A5, doi sang BROKEN)
     |
     |  PUT /api/rooms/1/seats/5
     |  { "status": "BROKEN" }
     |  --------------------------------------------------------->
     |                                   |
     |                                   v
     |                            SeatService.updateSeat(5, request)
     |                              |-- findById(5) => Seat A5
     |                              |-- seat.setStatus(BROKEN)
     |                              |-- save(seat)
     |  <---------------------------------------------------------
     |  Response: { id: 5, seatNumber: "A5", status: "BROKEN" }
```

### 6.2. User dat ve -- ghe hong va ghe da ban

```
User Frontend                     Backend
     |
     |  GET /api/rooms/1/seats
     |  --------------------------------------------------------->
     |                                   |
     |                                   v
     |                            SeatService.getSeatMap(1)
     |                              |-- findRoom(1)
     |                              |-- findByRoomIdAndStorageState(1, ACTIVE)
     |                              |   ORDER BY rowLabel ASC, colNumber ASC
     |                              |-- Nhom theo hang (LinkedHashMap giu thu tu)
     |                              |-- return SeatMapResponse
     |  <---------------------------------------------------------
     |  Response: seatMap voi moi ghe co { seatType, status }
     |
     |  FE render so do ghe:
     |  +-------+-------+-------+-------+-------+
     |  |  A1   |  A2   |  A3   |  A4   |  A5   |
     |  | trang | trang | trang | trang |  DO   |  <- A5 BROKEN = mau do
     |  +-------+-------+-------+-------+-------+
     |  |  E1   |  E2   |  E3   |  E4   |  E5   |
     |  | vang  | vang  | XAM   | vang  | vang  |  <- E3 da ban = mau xam
     |  +-------+-------+-------+-------+-------+
     |
     |  Ghe trang = AVAILABLE, click duoc
     |  Ghe do    = BROKEN, disabled
     |  Ghe xam   = Da ban/dang giu (tu BookingService), disabled
     |  Ghe vang  = VIP, click duoc (gia cao hon)
```

---

## 7. SQL duoc sinh ra cho tung operation

### 7.1. List phong co filter (Specification)

```sql
-- GET /api/rooms?keyword=Room&type=IMAX&status=ACTIVE&page=0&size=20

-- Query dem tong (cho phan trang):
SELECT COUNT(r.id) FROM rooms r
WHERE (r.storage_state IS NULL OR r.storage_state <> 'ARCHIVED')  -- notDeleted()
  AND LOWER(r.name) LIKE '%room%'                                  -- hasName("Room")
  AND r.type = 'IMAX'                                              -- hasType(IMAX)
  AND r.status = 'ACTIVE'                                          -- hasStatus(ACTIVE)

-- Query lay du lieu:
SELECT r.* FROM rooms r
WHERE (r.storage_state IS NULL OR r.storage_state <> 'ARCHIVED')
  AND LOWER(r.name) LIKE '%room%'
  AND r.type = 'IMAX'
  AND r.status = 'ACTIVE'
ORDER BY r.created_at DESC
OFFSET 0 ROWS FETCH NEXT 20 ROWS ONLY
```

**Luu y**: Neu FE khong gui `type` va `status`, 2 dong AND cuoi se **khong co** -- Specification tu dong bo qua dieu kien null.

### 7.2. Tao phong

```sql
-- Kiem tra trung ten
SELECT COUNT(*) > 0 FROM rooms WHERE name = 'Room 1'

-- Insert
INSERT INTO rooms (name, type, total_seats, status, storage_state, version,
                   created_by, created_at, updated_by, updated_at)
VALUES ('Room 1', 'IMAX', 0, 'ACTIVE', 'ACTIVE', 0,
        'admin', GETDATE(), 'admin', GETDATE())
```

### 7.3. Xoa mem phong

```sql
-- Optimistic Locking: chi update neu version khop
UPDATE rooms
SET storage_state = 'ARCHIVED',
    version = version + 1,
    updated_by = 'admin',
    updated_at = GETDATE()
WHERE id = 1 AND version = 0
```

### 7.4. Sinh ghe tu dong

```sql
-- Buoc 1: Soft delete ghe cu
UPDATE seats
SET storage_state = 'ARCHIVED'
WHERE room_id = 1 AND storage_state <> 'ARCHIVED'

-- Buoc 2: Insert 120 ghe (batch insert)
INSERT INTO seats (room_id, row_label, col_number, seat_number, seat_type, status,
                   storage_state, version, created_by, created_at, updated_by, updated_at)
VALUES (1, 'A', 1, 'A1', 'STANDARD', 'AVAILABLE', 'ACTIVE', 0, 'admin', GETDATE(), 'admin', GETDATE()),
       (1, 'A', 2, 'A2', 'STANDARD', 'AVAILABLE', 'ACTIVE', 0, 'admin', GETDATE(), 'admin', GETDATE()),
       ...
       (1, 'J', 12, 'J12', 'COUPLE', 'AVAILABLE', 'ACTIVE', 0, 'admin', GETDATE(), 'admin', GETDATE')

-- Buoc 3: Cap nhat tong ghe cua phong
UPDATE rooms SET total_seats = 120, version = version + 1 WHERE id = 1 AND version = 0
```

### 7.5. Lay so do ghe

```sql
-- Chi lay ghe chua xoa, sap xep theo hang roi cot
SELECT s.* FROM seats s
WHERE s.room_id = 1
  AND s.storage_state = 'ACTIVE'
ORDER BY s.row_label ASC, s.col_number ASC
```

### 7.6. Bulk update ghe (doi loai/danh dau hong)

```sql
-- VD: Doi 5 ghe thanh VIP
UPDATE seats SET seat_type = 'VIP', status = 'AVAILABLE',
       version = version + 1, updated_at = GETDATE()
WHERE id IN (10, 11, 12, 13, 14) AND version = ?

-- VD: Danh dau 2 ghe la BROKEN
UPDATE seats SET status = 'BROKEN',
       version = version + 1, updated_at = GETDATE()
WHERE id IN (5, 20) AND version = ?
```

---

## 8. Annotation moi can biet

### @Builder.Default

```java
@Builder.Default
private RoomStatus status = RoomStatus.ACTIVE;
```

**Van de**: Lombok `@Builder` **bo qua** gia tri mac dinh cua field. Khi goi `Room.builder().name("Room 1").build()`, truong `status` se la `null` chu KHONG phai `ACTIVE`.

**Giai phap**: `@Builder.Default` bao Lombok: "Neu nguoi dung khong goi `.status(...)`, hay dung gia tri mac dinh."

```java
// KHONG co @Builder.Default:
Room room = Room.builder().name("Room 1").build();
// room.status = null  --> LOI! DB column NOT NULL

// CO @Builder.Default:
Room room = Room.builder().name("Room 1").build();
// room.status = RoomStatus.ACTIVE  --> OK!
```

Trong module nay, `@Builder.Default` duoc dung o:
- `Room.status` = `RoomStatus.ACTIVE` (phong moi mac dinh hoat dong)
- `Seat.status` = `SeatStatus.AVAILABLE` (ghe moi mac dinh su dung duoc)

### @ManyToOne(fetch = FetchType.LAZY)

```java
@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "room_id", nullable = false)
private Room room;
```

- `@ManyToOne`: Nhieu Seat thuoc 1 Room
- `fetch = LAZY`: Chi load Room khi goi `seat.getRoom()`, KHONG load san
- `@JoinColumn(name = "room_id")`: Cot khoa ngoai trong bang `seats`
- `nullable = false`: Moi ghe BAT BUOC phai thuoc 1 phong

**Luu y**: `@ManyToOne` mac dinh la `EAGER` (load ngay). Trong CineX, ta luon dat `LAZY` de tranh N+1 problem (xem muc 3.3).

### @Modifying + @Query (JPQL Update)

```java
@Modifying
@Query("UPDATE Seat s SET s.storageState = StorageState.ARCHIVED "
     + "WHERE s.room.id = :roomId AND s.storageState <> StorageState.ARCHIVED")
void softDeleteByRoomId(Long roomId);
```

- `@Query`: Viet cau truy van thu cong bang JPQL (Java Persistence Query Language)
- `@Modifying`: Bat buoc khi `@Query` la UPDATE hoac DELETE (khong phai SELECT). Neu thieu -> Spring bao loi luc runtime
- `s.room.id`: JPQL cho phep truy cap quan he (Seat -> Room -> id), JPA tu dong dich thanh `WHERE room_id = ?`
- `:roomId`: Tham so truyen vao, Spring tu dong bind tu method parameter

**JPQL vs Native SQL**:
- JPQL: Viet theo ten entity + field (`Seat`, `storageState`), khong phai ten bang/cot (`seats`, `storage_state`). JPA dich sang SQL tuong ung voi DB dang dung (MySQL, SQL Server, PostgreSQL, ...)
- Native SQL: Viet SQL thuan, phu thuoc DB cu the. Chi dung khi JPQL khong lam duoc

### @PreAuthorize("hasRole('ADMIN')")

```java
@PostMapping("/generate")
@PreAuthorize("hasRole('ADMIN')")
public ApiResponse<SeatMapResponse> generateSeats(...) { ... }
```

- Chi user co role `ADMIN` moi duoc goi endpoint nay
- Neu user thuong goi -> tra 403 Forbidden
- Spring Security kiem tra JWT token -> lay role -> so sanh voi `hasRole('ADMIN')`

---

## 9. Request/Response mau

### GET /api/rooms -- Danh sach phong (co filter + phan trang)

```bash
curl "http://localhost:8088/api/rooms?keyword=Room&type=IMAX&status=ACTIVE&page=0&size=10" \
  -H "Authorization: Bearer <token>"
```

**Response (200):**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "content": [
      {
        "id": 2,
        "storageState": "ACTIVE",
        "name": "Room 2",
        "type": "IMAX",
        "totalSeats": 200,
        "status": "ACTIVE",
        "createdAt": "2026-05-30T10:00:00",
        "updatedAt": "2026-05-30T10:00:00"
      }
    ],
    "page": 0,
    "size": 10,
    "totalElements": 1,
    "totalPages": 1
  }
}
```

### POST /api/rooms -- (Admin) Tao phong moi

```bash
curl -X POST http://localhost:8088/api/rooms \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Room 4",
    "type": "THREE_D",
    "totalSeats": 0
  }'
```

**Response thanh cong (200):**
```json
{
  "success": true,
  "message": "Room created",
  "data": {
    "id": 4,
    "storageState": "ACTIVE",
    "name": "Room 4",
    "type": "THREE_D",
    "totalSeats": 0,
    "status": "ACTIVE",
    "createdAt": "2026-05-31T14:00:00",
    "updatedAt": "2026-05-31T14:00:00"
  }
}
```

**Response loi -- trung ten (409):**
```json
{
  "success": false,
  "message": "Phong chieu 'Room 4' da ton tai",
  "errorCode": "ROOM_EXISTED"
}
```

**Response loi -- validation (400):**
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "name": "Ten phong la bat buoc",
    "type": "Loai phong la bat buoc"
  }
}
```

### POST /api/rooms/1/seats/generate -- (Admin) Sinh ghe tu dong

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

**Response (200):**
```json
{
  "success": true,
  "message": "Seats generated",
  "data": {
    "roomId": 1,
    "roomName": "Room 1",
    "totalSeats": 120,
    "seatMap": {
      "A": [
        { "id": 101, "rowLabel": "A", "colNumber": 1, "seatNumber": "A1", "seatType": "STANDARD", "status": "AVAILABLE" },
        { "id": 102, "rowLabel": "A", "colNumber": 2, "seatNumber": "A2", "seatType": "STANDARD", "status": "AVAILABLE" }
      ],
      "E": [
        { "id": 149, "rowLabel": "E", "colNumber": 1, "seatNumber": "E1", "seatType": "VIP", "status": "AVAILABLE" }
      ],
      "J": [
        { "id": 209, "rowLabel": "J", "colNumber": 1, "seatNumber": "J1", "seatType": "COUPLE", "status": "AVAILABLE" },
        { "id": 210, "rowLabel": "J", "colNumber": 2, "seatNumber": "J2", "seatType": "COUPLE", "status": "AVAILABLE" }
      ]
    }
  }
}
```

### GET /api/rooms/1/seats -- Xem so do ghe

```bash
curl http://localhost:8088/api/rooms/1/seats \
  -H "Authorization: Bearer <token>"
```

Response cung format nhu generate, nhung khong thay doi du lieu.

### PUT /api/rooms/1/seats/5 -- (Admin) Cap nhat 1 ghe

```bash
curl -X PUT http://localhost:8088/api/rooms/1/seats/5 \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{ "status": "BROKEN" }'
```

**Response (200):**
```json
{
  "success": true,
  "message": "Seat updated",
  "data": {
    "id": 5,
    "rowLabel": "A",
    "colNumber": 5,
    "seatNumber": "A5",
    "seatType": "STANDARD",
    "status": "BROKEN"
  }
}
```

### PUT /api/rooms/1/seats/bulk-update -- (Admin) Bulk update nhieu ghe

```bash
# Doi 5 ghe thanh VIP
curl -X PUT http://localhost:8088/api/rooms/1/seats/bulk-update \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "seatIds": [10, 11, 12, 13, 14],
    "seatType": "VIP"
  }'

# Danh dau 2 ghe la BROKEN
curl -X PUT http://localhost:8088/api/rooms/1/seats/bulk-update \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "seatIds": [5, 20],
    "status": "BROKEN"
  }'
```

### DELETE /api/rooms/1 -- (Admin) Xoa mem phong

```bash
curl -X DELETE http://localhost:8088/api/rooms/1 \
  -H "Authorization: Bearer <admin_token>"
```

### POST /api/rooms/1/restore -- (Admin) Khoi phuc phong da xoa

```bash
curl -X POST http://localhost:8088/api/rooms/1/restore \
  -H "Authorization: Bearer <admin_token>"
```

### POST /api/rooms/bulk-delete -- (Admin) Xoa nhieu phong

```bash
curl -X POST http://localhost:8088/api/rooms/bulk-delete \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{ "ids": [1, 2, 3] }'
```

---

## 10. Cau hoi tu kiem tra

### Cau 1: Tai sao can `@Builder.Default` cho field `status` trong Room va Seat?
> **Goi y**: Thu bo `@Builder.Default` roi goi `Room.builder().name("Test").build()`. Gia tri `status` se la gi? DB co cho phep null khong?
>
> **Dap an**: Lombok `@Builder` bo qua gia tri mac dinh. Khong co `@Builder.Default` -> `status = null` -> vi cot `status` la `NOT NULL` trong DB -> loi `ConstraintViolationException` khi save.

### Cau 2: Neu FE gui `GET /api/rooms` KHONG co bat ky filter nao, Specification se sinh ra SQL nhu the nao?
> **Goi y**: Xem method `fromFilter()` -- khi tat ca field cua `RoomFilter` deu null thi sao?
>
> **Dap an**: Chi co 1 dieu kien duy nhat: `WHERE storage_state IS NULL OR storage_state <> 'ARCHIVED'` (notDeleted). Cac dieu kien khac bi skip vi null. Ket qua: tra tat ca phong chua xoa.

### Cau 3: Khi admin sinh lai ghe (generate) cho phong da co ghe, chuyen gi xay ra voi ghe cu?
> **Goi y**: Tim method `softDeleteByRoomId()` trong `SeatRepository`.
>
> **Dap an**: Ghe cu duoc **soft delete** (storage_state = ARCHIVED), KHONG bi xoa that. Sau do ghe moi duoc tao. Nhu vay, du lieu ghe cu van luu trong DB de doi chieu (audit trail). Cac booking cu van tham chieu duoc den ghe cu.

### Cau 4: Tai sao dung `LinkedHashMap` thay vi `HashMap` khi nhom ghe theo hang?
> **Goi y**: Thu doi thanh `HashMap` roi xem thu tu cac hang trong response.
>
> **Dap an**: `HashMap` khong dam bao thu tu. FE can render ghe theo thu tu A -> B -> C -> ... -> J. `LinkedHashMap` giu nguyen thu tu insert. Vi query da ORDER BY rowLabel ASC, nen ghe duoc insert theo thu tu A, B, C, ... -> `LinkedHashMap` giu dung thu tu nay.

### Cau 5: Neu hang couple co so cot le (VD: 11 cot), ghe cuoi cung (J11) la loai gi? Tai sao?
> **Goi y**: Xem doan code `isLastOddCol` trong `SeatService.generateSeats()`.
>
> **Dap an**: J11 la `STANDARD` (ghe thuong). Vi ghe doi luon di theo cap (1-2, 3-4, ..., 9-10), ghe thu 11 khong co cap -> khong the la COUPLE -> doi ve STANDARD. Nhu vay FE khong bi loi khi render ghe doi.

### Cau 6: Tai sao Seat dung `@ManyToOne(fetch = LAZY)` thay vi de mac dinh EAGER?
> **Goi y**: Tuong tuong list 200 ghe voi EAGER -- JPA se lam gi?
>
> **Dap an**: Mac dinh cua `@ManyToOne` la EAGER -- JPA se load Room entity moi khi load Seat. Khi list 200 ghe, JPA chay 200 cau `SELECT * FROM rooms WHERE id = ?` (N+1 problem). Voi LAZY, JPA chi chay 1 cau `SELECT * FROM seats WHERE room_id = ?` va KHONG load Room cho den khi goi `seat.getRoom()`.

### Cau 7: Khi bulk update doi loai ghe (VD: STANDARD -> VIP), neu ghe dang BROKEN thi sao?
> **Goi y**: Doc phan `bulkUpdateSeats()` trong `SeatService` -- co dong `if (s.getStatus() == SeatStatus.BROKEN)`.
>
> **Dap an**: Ghe se duoc tu dong khoi phuc thanh AVAILABLE. Logic: admin doi loai ghe = thay ghe moi -> ghe moi khong con hong -> AVAILABLE. Nhung neu admin chi danh dau BROKEN (khong doi loai), thi seatType duoc giu nguyen.

---

## 11. Tong ket kien truc

```
+-------------------+          +-------------------+
|   RoomController  |          |   SeatController  |
|  /api/rooms       |          |  /api/rooms/{id}  |
|                   |          |      /seats        |
+--------+----------+          +---------+---------+
         |                               |
         v                               v
+--------+----------+          +---------+---------+
|   RoomService     |          |   SeatService     |
|  - CRUD phong     |          |  - generateSeats  |
|  - soft delete    |          |  - bulkUpdate     |
|  - bulk ops       |          |  - updateSeat     |
+--------+----------+          +---------+---------+
         |                               |
         v                               v
+--------+----------+          +---------+---------+
|  RoomRepository   |          |  SeatRepository   |
|  + Specification  |          |  + @Query JPQL    |
+--------+----------+          +---------+---------+
         |                               |
         v                               v
+--------+----------+          +---------+---------+
|   Table: rooms    | <------  |   Table: seats    |
|                   |  room_id |                   |
+-------------------+          +-------------------+

Quan he: rooms 1 ----> N seats (qua cot room_id)
```

### Nguyen tac SOLID da ap dung:
- **S (Single Responsibility)**: Room module chi quan ly phong. Seat module chi quan ly ghe. Controller chi nhan/tra request. Service chi chua logic.
- **O (Open/Closed)**: Them filter moi (VD: loc theo so ghe) -> chi them field vao `RoomFilter` va them method vao `RoomSpecification`. KHONG sua `RoomService`.
- **L (Liskov)**: Room va Seat deu ke thua BaseEntity, chi them field, khong override behavior.
- **I (Interface Segregation)**: Repository chi co method thuc su duoc goi. `RoomRepository` chi co `existsByName()`. `SeatRepository` chi co `findByRoomId...()` va `softDeleteByRoomId()`.
- **D (Dependency Inversion)**: Controller chi biet Service (khong biet Repository). SeatService inject `RoomRepository` de doc thong tin phong, nhung KHONG inject `RoomService` -- vi chi can doc du lieu, khong can business logic cua Room.
