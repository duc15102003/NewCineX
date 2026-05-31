# Module Room & Seat -- Giải thích chi tiết

## 1. Tổng quan

Module Room & Seat quản lý **phòng chiếu** và **sơ đồ ghế ngoi** trong rap phim CineX.

### Bài toán thực tế
Khi bạn đi xem phim tai CGV hay Lotte Cinema, bạn thấy:
- Mới rap co nhieu **phòng chiếu** (Room 1, Room 2, ...), mới phòng co loại khác nhau (2D, 3D, IMAX, 4DX)
- Mới phòng co một **sơ đồ ghế** (seat map): hàng A đến J, cột 1 đến 15
- Ghế co nhieu loại: ghế thường (STANDARD), ghế VIP (o giua, tám nhin tốt), ghế đôi (COUPLE, o hàng cuối)
- Co ghế bi hong (BROKEN) -- hien mau đó, người đúng không chon được
- Admin co the tạo phòng, sinh ghế tu đồng, danh đầu ghế hỏng, đôi loại ghế

### Module này gồm 2 phần:
1. **Room** (phòng chiếu): CRUD phòng, loc theo tên/loại/trạng thái
2. **Seat** (ghế ngoi): sinh ghế tu đồng, xem sơ đồ ghế, cấp nhất loại ghế/trạng thái ghế

### Vì sao tach thanh 2 module rieng?
- **Single Responsibility**: Room chi quản lý thong tin phòng (tên, loại, trạng thái). Seat chi quản lý ghế (vị trí, loại, hong/không hong)
- **Dependency Inversion**: Seat phu thuoc Room (ghế thuoc phòng), những Room không biết gì về Seat
- Ngoai đời thực, team "quản lý phòng" và team "quản lý ghế" co the làm đọc lap

---

## 2. Danh sách files và Design Pattern

### Module Room

| File | Tac đúng | Design Pattern |
|---|---|---|
| `module/room/entity/Room.java` | Entity map bảng `rooms` | BaseEntity Inheritance |
| `module/room/entity/RoomType.java` | Enum loại phòng: TWO_D, THREE_D, IMAX, FOUR_DX | Enum (type-safe) |
| `module/room/entity/RoomStatus.java` | Enum trạng thái: ACTIVE, MAINTENANCE, INACTIVE | Enum |
| `module/room/dto/RoomRequest.java` | DTO tạo/sửa phòng (co validation) | DTO |
| `module/room/dto/RoomResponse.java` | DTO tra thong tin phòng | DTO + Builder |
| `module/room/dto/RoomFilter.java` | DTO nhan tham so loc tu FE | Filter DTO |
| `module/room/repository/RoomRepository.java` | Truy vấn bảng rooms + ho tro Specification | Repository |
| `module/room/specification/RoomSpecification.java` | Build cau WHERE đồng (keyword, type, status) | Specification Pattern |
| `module/room/mapper/RoomMapper.java` | Room -> RoomResponse (MapStruct sinh code luc compile) | Mapper |
| `module/room/service/RoomService.java` | Business logic: CRUD, soft delete, bulk delete/restore | Service Layer |
| `module/room/controller/RoomController.java` | 8 REST endpoints (CRUD + bulk + restore) | Controller |

### Module Seat

| File | Tac đúng | Design Pattern |
|---|---|---|
| `module/seat/entity/Seat.java` | Entity map bảng `seats`, quan he N:1 với Room | BaseEntity + ManyToOne |
| `module/seat/entity/SeatType.java` | Enum loại ghế: STANDARD, VIP, COUPLE | Enum |
| `module/seat/entity/SeatStatus.java` | Enum trạng thái ghế: AVAILABLE, BROKEN | Enum |
| `module/seat/dto/SeatGenerateRequest.java` | Cau hinh sinh ghế tu đồng (so hàng, so cột, hàng VIP, hàng couple) | DTO + Validation |
| `module/seat/dto/SeatResponse.java` | DTO tra thong tin 1 ghế | DTO + Builder |
| `module/seat/dto/SeatMapResponse.java` | DTO tra sơ đồ ghế nhom theo hàng (Map<String, List>) | DTO + Builder |
| `module/seat/dto/UpdateSeatRequest.java` | DTO cấp nhất 1 ghế (loại hoặc trạng thái) | DTO |
| `module/seat/dto/BulkUpdateSeatRequest.java` | DTO cấp nhất nhieu ghế cùng luc | DTO + Validation |
| `module/seat/repository/SeatRepository.java` | Truy vấn ghế + soft delete hàng loat bảng JPQL | Repository |
| `module/seat/mapper/SeatMapper.java` | Seat -> SeatResponse (MapStruct) | Mapper |
| `module/seat/service/SeatService.java` | Business logic: sinh ghế, cấp nhất, bulk update | Service Layer |
| `module/seat/controller/SeatController.java` | 6 REST endpoints dưới `/api/rooms/{roomId}/seats` | Nested Resource Controller |

---

## 3. Design Patterns chi tiết

### 3.1. Specification Pattern -- Xay cau truy vấn WHERE đồng

#### Pattern này là gì?
Specification thuoc nhom **Behavioral Pattern**. No cho phep **ghép nhieu dieu kien loc** thanh 1 cau truy vấn, ma không phải viet nhieu method trong Repository.

#### Ví dụ đời thường
Tuong tuong bạn đi mua ao trên Shopee:
- Loc theo **mau**: đó
- Loc theo **giá**: 100k - 500k
- Loc theo **thuong hieu**: Nike

Mới bộ loc là 1 "Specification". Bạn co the bật/tắt tung bộ loc -- và chúng tu đồng ghép lai thanh 1 cau truy vấn. Không co bộ loc nào? Tra tất cả. Co 3 bộ loc? Tra ket qua thoa man cả 3.

#### Ap đúng ở đâu trong code?

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

Mới method trả về 1 `Specification<Room>` -- bạn chat là 1 lambda tạo ra 1 `Predicate` (dieu kien WHERE trong SQL):

```java
public static Specification<Room> hasName(String keyword) {
    return (root, query, cb) ->
            cb.like(cb.lower(root.get("name")), "%" + keyword.toLowerCase() + "%");
}
// root   = bang "rooms" (tu do lay cot)
// query  = cau SELECT dang xay
// cb     = CriteriaBuilder -- cong cu tao dieu kien (like, equal, greaterThan, ...)
```

#### Tại sao đúng Specification?

**KHONG đúng Specification** -- viet hàng chuc method trong Repository:

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

3 truong loc = 2^3 = 8 method. 5 truong loc = 2^5 = 32 method. **Không kha thì!**

**CO Specification** -- chi 1 method duy nhất:

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

#### Khi nào KHONG nên dùng?
- Entity chi co 1-2 filter co dinh (VD: `findByUsername`) -- đúng Spring Data method là du
- Query qua phức tạp với nhieu JOIN -- đúng `@Query` với JPQL/native SQL rõ ràng hon

---

### 3.2. Soft Delete Pattern -- Xoa mem

#### Pattern này là gì?
Thay vì `DELETE FROM rooms WHERE id = 1` (xóa vinh vien, mat dữ liệu), ta **đôi trạng thái** của bạn ghi thanh "đã xóa" (ARCHIVED). Dữ liệu van con trong DB, những các cau truy vấn mac dinh sẽ loc bộ no.

#### Ví dụ đời thường
Khi bạn xóa email trong Gmail, email không bien mat ngày -- no vào **Thung rac** (Trash). Sau 30 ngày mới xóa that. Trong thời gian đó, bạn co the **khoi phuc** (Restore).

Soft Delete hoạt động y heu: bạn ghi van năm trong DB (tuong duong thung rac), và admin co the khoi phuc bất kỳ luc nào.

#### Ap đúng ở đâu trong code?

Mới entity trong CineX deu ke thua `BaseEntity`, trong đó co truong `storageState`:

```
StorageState.ACTIVE   = ban ghi binh thuong (hien thi cho user)
StorageState.ARCHIVED = ban ghi da xoa (an khoi user, admin co the khoi phuc)
```

**Room -- xóa mem:**
```java
// RoomService.deleteRoom()
public void deleteRoom(Long id) {
    Room room = roomRepository.findById(id)
            .orElseThrow(() -> new BusinessException(ErrorCode.ROOM_NOT_FOUND));
    room.setStorageState(StorageState.ARCHIVED);  // Chi doi trang thai
    roomRepository.save(room);                     // UPDATE, KHONG DELETE
}
```

**Seat -- xóa mem hàng loat bảng JPQL:**
```java
// SeatRepository -- soft delete tat ca ghe cua phong
@Modifying
@Query("UPDATE Seat s SET s.storageState = StorageState.ARCHIVED "
     + "WHERE s.room.id = :roomId AND s.storageState <> StorageState.ARCHIVED")
void softDeleteByRoomId(Long roomId);
```

**Loc bộ bạn ghi đã xóa (Specification):**
```java
public static Specification<Room> notDeleted() {
    return (root, query, cb) ->
            cb.or(
                cb.isNull(root.get("storageState")),           // null = chua set = ACTIVE
                cb.notEqual(root.get("storageState"), StorageState.ARCHIVED)  // khong phai ARCHIVED
            );
}
```

#### Tại sao đúng Soft Delete?
1. **Audit trail**: biết ai đã xóa gì, khi nào -- phuc vu dieu tra, bao cao
2. **Khoi phuc**: admin click "Restore" là xong, không cần backup DB
3. **Toan ven dữ liệu**: ghế đã bạn thuoc phòng đã xóa -- van con dữ liệu de đôi chiếu
4. **Phap ly**: một so nganh (tai chinh, y te) BAT BUOC lưu dữ liệu N năm

#### Khi nào KHONG nên dùng?
- Dữ liệu tám (session, OTP, token) -- xóa that de giam tai DB
- GDPR yeu cau "quyen bi lang quen" -- phải xóa that dữ liệu cả nhan

---

### 3.3. Quan he @ManyToOne -- Room và Seat

#### Bài toán
- 1 phòng co **nhieu ghế** (1 Room : N Seats)
- 1 ghế chi thuoc **1 phòng** (N Seats : 1 Room)

Day là quan he **Many-to-One** (nhieu-một) -- loại quan he pho bien nhất trong database.

#### Ap đúng trong code

```java
// Seat.java
@ManyToOne(fetch = FetchType.LAZY)          // (1)
@JoinColumn(name = "room_id", nullable = false)  // (2)
private Room room;
```

Giải thích tung annotation:

**(1) `@ManyToOne(fetch = FetchType.LAZY)`**
- `@ManyToOne`: nhieu Seat thuoc 1 Room
- `fetch = LAZY`: khi truy vấn Seat, **KHONG** tu đồng load Room entity. Chi load khi goi `seat.getRoom()`
- Tại sao LAZY? Vì khi list 100 ghế, bạn không cần load 100 lan Room entity (tất cả deu cùng 1 phòng). Nếu de EAGER (mac dinh của @ManyToOne), JPA sẽ chay 100 cau SELECT Room => **N+1 problem**

**(2) `@JoinColumn(name = "room_id", nullable = false)`**
- `name = "room_id"`: cột khoa ngoai trong bảng `seats` tro về bảng `rooms`
- `nullable = false`: ghế PHAI thuoc 1 phòng, không được null

#### N+1 Problem là gì?

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

Voi `LAZY`, chi co 1 cau query: `SELECT * FROM seats WHERE room_id = 1`. Room chi được load khi cần.

#### Tại sao module này KHONG đúng @OneToMany trong Room?

Bạn co the tu hỏi: "Tại sao Room.java không co `List<Seat> seats`?"

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

Lý đó:
1. **Module tach biết**: Room và Seat là 2 module rieng. Room không nên biết cau trực của Seat
2. **Performance**: Load room không cần load 200 ghế. Khi cần ghế -> goi `SeatService.getSeatMap(roomId)`
3. **Dependency Inversion**: Seat phu thuoc Room (co `room_id`), những Room KHONG phu thuoc Seat

> **Quy tắc**: @ManyToOne đặt o phia "nhieu" (Seat). @OneToMany đặt o phia "một" (Room) -- chi khi THAT SU cần (VD: cascade delete). Trong CineX, ta không đúng cascade ma đúng soft delete rieng => không cần @OneToMany.

---

## 4. Sơ đồ ghế (Seat) -- Chi tiết

### 4.1. SeatType -- Loại ghế

| Giá trị | Mô tả | Vì tri thuong gap | Giá về |
|---|---|---|---|
| `STANDARD` | Ghế thuong | Hang A-D (gắn man hinh), hàng H-I | Giá co bạn |
| `VIP` | Ghế VIP -- dem lớn hon, tám nhin tốt | Hang E-G (giua phòng) | +30-50% |
| `COUPLE` | Ghế đôi -- 2 người ngoi chúng 1 ghế rộng | Hang J (hàng cuối) | x2 |

### 4.2. SeatStatus -- Trang thai ghế

| Giá trị | Mô tả | Hiển thị trên FE |
|---|---|---|
| `AVAILABLE` | Ghế bình thường, co the đặt | Mau trang/xanh |
| `BROKEN` | Ghế hong, KHONG cho đặt | Mau đó, không click được |

**Luu y**: `SeatStatus` khác với trạng thái khi đặt vé:
- `AVAILABLE` / `BROKEN` là **trạng thái vat ly** của ghế (hong hay không hong) -- đó admin quản lý
- Khi đặt vé, ghế sẽ co trạng thái **HOLDING** (đang giữ) / **BOOKED** (đã bạn) -- đó BookingService quản lý, lưu trong bảng `booking_seats`, KHONG phải trong bảng `seats`

### 4.3. Ghế đôi (COUPLE) -- Ghép cấp tu đồng

Khi sinh ghế cho hàng COUPLE (VD: hàng J, 12 cột):

```
J1-J2   = COUPLE (cap 1)
J3-J4   = COUPLE (cap 2)
J5-J6   = COUPLE (cap 3)
J7-J8   = COUPLE (cap 4)
J9-J10  = COUPLE (cap 5)
J11-J12 = COUPLE (cap 6)
```

**Truong hop đặc biệt**: Nếu so cột LE (VD: 11 cột):

```
J1-J2   = COUPLE
J3-J4   = COUPLE
...
J9-J10  = COUPLE
J11     = STANDARD   <-- Ghe le cuoi cung => KHONG the la COUPLE => doi ve STANDARD
```

Code xử lý:

```java
// SeatService.generateSeats()
if (isCoupleRow) {
    boolean isLastOddCol = (request.getTotalCols() % 2 != 0)    // Tong cot le?
                        && (col == request.getTotalCols());       // La cot cuoi?
    seatType = isLastOddCol ? SeatType.STANDARD : SeatType.COUPLE;
}
```

### 4.4. Ghế hong (BROKEN) -- Luong xử lý

**Admin danh đầu ghế hỏng:**
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

**User đặt vé -- ghế hỏng hien mau đó:**
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

**BE chan khi user co tinh gui request với ghế hỏng:**
```
Khi BookingService xu ly dat ve:
   |-- Kiem tra tung seatId trong danh sach
   |-- Neu seat.status == BROKEN => throw BusinessException(SEAT_ALREADY_BOOKED)
   |-- User khong the dat ghe hong du co gui request truc tiep
```

### 4.5. Bulk update loại ghế

Admin co the chon nhieu ghế cùng luc và đôi loại (VD: chon A1-A5 đôi thanh VIP):

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

**Tại sao đôi loại ghế thì khoi phuc BROKEN -> AVAILABLE?**
Ví dụ: ghế A5 bi hong (ghế thường). Admin muốn thấy ghế mới loại VIP -> ghế mới không con hong nua -> tu đồng AVAILABLE.

---

## 5. Generate Seats tu đồng -- Thuật toán chi tiết

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

Tong: 10 hàng x 12 cột = 120 ghế

### Thuật toán tung buoc

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

### Validation -- Chong nhập sai

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

Ví dụ loi: `totalRows=5` (hàng A-E) những `vipRows=["G"]` => G > E => loi!

---

## 6. Sơ đồ luồng xử lý (ASCII Diagram)

### 6.1. Admin tạo phòng và sinh ghế

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

### 6.2. User đặt vé -- ghế hỏng và ghế đã bạn

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

## 7. SQL được sinh ra cho tung operation

### 7.1. List phòng co filter (Specification)

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

**Luu y**: Nếu FE không gui `type` và `status`, 2 đồng AND cuối sẽ **không co** -- Specification tu đồng bộ qua dieu kien null.

### 7.2. Tao phòng

```sql
-- Kiem tra trung ten
SELECT COUNT(*) > 0 FROM rooms WHERE name = 'Room 1'

-- Insert
INSERT INTO rooms (name, type, total_seats, status, storage_state, version,
                   created_by, created_at, updated_by, updated_at)
VALUES ('Room 1', 'IMAX', 0, 'ACTIVE', 'ACTIVE', 0,
        'admin', GETDATE(), 'admin', GETDATE())
```

### 7.3. Xoa mem phòng

```sql
-- Optimistic Locking: chi update neu version khop
UPDATE rooms
SET storage_state = 'ARCHIVED',
    version = version + 1,
    updated_by = 'admin',
    updated_at = GETDATE()
WHERE id = 1 AND version = 0
```

### 7.4. Sinh ghế tu đồng

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

### 7.5. Lay sơ đồ ghế

```sql
-- Chi lay ghe chua xoa, sap xep theo hang roi cot
SELECT s.* FROM seats s
WHERE s.room_id = 1
  AND s.storage_state = 'ACTIVE'
ORDER BY s.row_label ASC, s.col_number ASC
```

### 7.6. Bulk update ghế (đôi loại/danh đầu hong)

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

## 8. Annotation mới cần biết

### @Builder.Default

```java
@Builder.Default
private RoomStatus status = RoomStatus.ACTIVE;
```

**Van de**: Lombok `@Builder` **bộ qua** giá trị mac dinh của field. Khi goi `Room.builder().name("Room 1").build()`, truong `status` sẽ là `null` chu KHONG phải `ACTIVE`.

**Giai phap**: `@Builder.Default` bao Lombok: "Nếu người đúng không goi `.status(...)`, hay đúng giá trị mac dinh."

```java
// KHONG co @Builder.Default:
Room room = Room.builder().name("Room 1").build();
// room.status = null  --> LOI! DB column NOT NULL

// CO @Builder.Default:
Room room = Room.builder().name("Room 1").build();
// room.status = RoomStatus.ACTIVE  --> OK!
```

Trong module này, `@Builder.Default` được dùng o:
- `Room.status` = `RoomStatus.ACTIVE` (phòng mới mac dinh hoạt động)
- `Seat.status` = `SeatStatus.AVAILABLE` (ghế mới mac dinh sử dụng được)

### @ManyToOne(fetch = FetchType.LAZY)

```java
@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "room_id", nullable = false)
private Room room;
```

- `@ManyToOne`: Nhieu Seat thuoc 1 Room
- `fetch = LAZY`: Chi load Room khi goi `seat.getRoom()`, KHONG load san
- `@JoinColumn(name = "room_id")`: Cot khoa ngoai trong bảng `seats`
- `nullable = false`: Mới ghế BAT BUOC phải thuoc 1 phòng

**Luu y**: `@ManyToOne` mac dinh là `EAGER` (load ngày). Trong CineX, ta luon đặt `LAZY` de tranh N+1 problem (xem mục 3.3).

### @Modifying + @Query (JPQL Update)

```java
@Modifying
@Query("UPDATE Seat s SET s.storageState = StorageState.ARCHIVED "
     + "WHERE s.room.id = :roomId AND s.storageState <> StorageState.ARCHIVED")
void softDeleteByRoomId(Long roomId);
```

- `@Query`: Viet cau truy vấn thu cong bảng JPQL (Java Persistence Query Language)
- `@Modifying`: Bat buoc khi `@Query` là UPDATE hoặc DELETE (không phải SELECT). Nếu thieu -> Spring bao loi luc runtime
- `s.room.id`: JPQL cho phep truy cập quan he (Seat -> Room -> id), JPA tu đồng dich thanh `WHERE room_id = ?`
- `:roomId`: Tham so truyen vào, Spring tu đồng bind tu method parameter

**JPQL vs Native SQL**:
- JPQL: Viet theo tên entity + field (`Seat`, `storageState`), không phải tên bảng/cột (`seats`, `storage_state`). JPA dich sang SQL tuong ung với DB đang đúng (MySQL, SQL Server, PostgreSQL, ...)
- Native SQL: Viet SQL thuan, phu thuoc DB cũ the. Chi đúng khi JPQL không làm được

### @PreAuthorize("hasRole('ADMIN')")

```java
@PostMapping("/generate")
@PreAuthorize("hasRole('ADMIN')")
public ApiResponse<SeatMapResponse> generateSeats(...) { ... }
```

- Chi user co role `ADMIN` mới được gọi endpoint này
- Nếu user thuong goi -> tra 403 Forbidden
- Spring Security kiểm tra JWT token -> lay role -> so sánh với `hasRole('ADMIN')`

---

## 9. Request/Response mau

### GET /api/rooms -- Danh sách phòng (co filter + phần trang)

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

### POST /api/rooms -- (Admin) Tao phòng mới

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

**Response loi -- trung tên (409):**
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

### POST /api/rooms/1/seats/generate -- (Admin) Sinh ghế tu đồng

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

### GET /api/rooms/1/seats -- Xem sơ đồ ghế

```bash
curl http://localhost:8088/api/rooms/1/seats \
  -H "Authorization: Bearer <token>"
```

Response cùng format như generate, những không thấy đôi dữ liệu.

### PUT /api/rooms/1/seats/5 -- (Admin) Cap nhất 1 ghế

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

### PUT /api/rooms/1/seats/bulk-update -- (Admin) Bulk update nhieu ghế

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

### DELETE /api/rooms/1 -- (Admin) Xoa mem phòng

```bash
curl -X DELETE http://localhost:8088/api/rooms/1 \
  -H "Authorization: Bearer <admin_token>"
```

### POST /api/rooms/1/restore -- (Admin) Khoi phuc phòng đã xóa

```bash
curl -X POST http://localhost:8088/api/rooms/1/restore \
  -H "Authorization: Bearer <admin_token>"
```

### POST /api/rooms/bulk-delete -- (Admin) Xoa nhieu phòng

```bash
curl -X POST http://localhost:8088/api/rooms/bulk-delete \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{ "ids": [1, 2, 3] }'
```

---

## 10. Câu hỏi tự kiểm tra

### Câu 1: Tại sao cần `@Builder.Default` cho field `status` trong Room và Seat?
> **Goi y**: Thu bộ `@Builder.Default` roi goi `Room.builder().name("Test").build()`. Giá trị `status` sẽ là gì? DB co cho phep null không?
>
> **Dap an**: Lombok `@Builder` bộ qua giá trị mac dinh. Không co `@Builder.Default` -> `status = null` -> vì cột `status` là `NOT NULL` trong DB -> loi `ConstraintViolationException` khi save.

### Câu 2: Nếu FE gui `GET /api/rooms` KHONG co bất kỳ filter nào, Specification sẽ sinh ra SQL như thế nào?
> **Goi y**: Xem method `fromFilter()` -- khi tất cả field của `RoomFilter` deu null thì sao?
>
> **Dap an**: Chi co 1 dieu kien duy nhất: `WHERE storage_state IS NULL OR storage_state <> 'ARCHIVED'` (notDeleted). Cac dieu kien khác bi skip vì null. Ket qua: tra tất cả phòng chua xóa.

### Câu 3: Khi admin sinh lai ghế (generate) cho phòng đã co ghế, chuyen gì xay ra với ghế cũ?
> **Goi y**: Tim method `softDeleteByRoomId()` trong `SeatRepository`.
>
> **Dap an**: Ghế cũ được **soft delete** (storage_state = ARCHIVED), KHONG bi xóa that. Sau đó ghế mới được tạo. Nhu vay, dữ liệu ghế cũ van lưu trong DB de đôi chiếu (audit trail). Cac booking cũ van tham chiếu được đến ghế cũ.

### Câu 4: Tại sao đúng `LinkedHashMap` thấy vì `HashMap` khi nhom ghế theo hàng?
> **Goi y**: Thu đôi thanh `HashMap` roi xem thu tu các hàng trong response.
>
> **Dap an**: `HashMap` không dam bao thu tu. FE cần render ghế theo thu tu A -> B -> C -> ... -> J. `LinkedHashMap` giữ nguyen thu tu insert. Vì query đã ORDER BY rowLabel ASC, nên ghế được insert theo thu tu A, B, C, ... -> `LinkedHashMap` giữ đúng thu tu này.

### Câu 5: Nếu hàng couple co so cột le (VD: 11 cột), ghế cuối cùng (J11) là loại gì? Tại sao?
> **Goi y**: Xem đoạn code `isLastOddCol` trong `SeatService.generateSeats()`.
>
> **Dap an**: J11 là `STANDARD` (ghế thường). Vì ghế đôi luon đi theo cấp (1-2, 3-4, ..., 9-10), ghế thu 11 không co cấp -> không the là COUPLE -> đôi về STANDARD. Nhu vay FE không bi loi khi render ghế đôi.

### Câu 6: Tại sao Seat đúng `@ManyToOne(fetch = LAZY)` thấy vì de mac dinh EAGER?
> **Goi y**: Tuong tuong list 200 ghế với EAGER -- JPA sẽ làm gì?
>
> **Dap an**: Mac dinh của `@ManyToOne` là EAGER -- JPA sẽ load Room entity mỗi khi load Seat. Khi list 200 ghế, JPA chay 200 cau `SELECT * FROM rooms WHERE id = ?` (N+1 problem). Voi LAZY, JPA chi chay 1 cau `SELECT * FROM seats WHERE room_id = ?` và KHONG load Room cho đến khi goi `seat.getRoom()`.

### Câu 7: Khi bulk update đôi loại ghế (VD: STANDARD -> VIP), nếu ghế đang BROKEN thì sao?
> **Goi y**: Doc phần `bulkUpdateSeats()` trong `SeatService` -- co đồng `if (s.getStatus() == SeatStatus.BROKEN)`.
>
> **Dap an**: Ghế sẽ được tu đồng khoi phuc thanh AVAILABLE. Logic: admin đôi loại ghế = thấy ghế mới -> ghế mới không con hong -> AVAILABLE. Nhưng nếu admin chi danh đầu BROKEN (không đôi loại), thì seatType được giữ nguyen.

---

## 11. Tong ket kiến trúc

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

### Nguyên tắc SOLID đã ap đúng:
- **S (Single Responsibility)**: Room module chi quản lý phòng. Seat module chi quản lý ghế. Controller chi nhan/tra request. Service chi chua logic.
- **O (Open/Closed)**: Them filter mới (VD: loc theo số ghế) -> chi thêm field vào `RoomFilter` và thêm method vào `RoomSpecification`. KHONG sửa `RoomService`.
- **L (Liskov)**: Room và Seat deu ke thua BaseEntity, chi thêm field, không override behavior.
- **I (Interface Segregation)**: Repository chi co method thực sự được gọi. `RoomRepository` chi co `existsByName()`. `SeatRepository` chi co `findByRoomId...()` và `softDeleteByRoomId()`.
- **D (Dependency Inversion)**: Controller chi biết Service (không biết Repository). SeatService inject `RoomRepository` de đọc thong tin phòng, những KHONG inject `RoomService` -- vì chi cần đọc dữ liệu, không cần business logic của Room.

---

## Bổ sung — Phân định scope giữa 06-room và 07-seat

### Vấn đề từ audit
File 06-room hiện gộp cả nội đúng về Room và Seat. File 07-seat cũng nói lại nhiều phần về Room. **Trùng lặp lớn**, gây khó đọc và maintain.

### Đề xuất scope rõ ràng

| File | Phải có | KHÔNG nên có |
|---|---|---|
| `06-room` | Entity Room, CRUD phòng, RoomType (2D/3D/IMAX), validation tên phòng unique, soft delete, list filter theo type/active, restore | Chi tiết generate ghế, ghế đôi, FE drag-paint, color matrix |
| `07-seat` | Entity Seat, generate seats từ grid layout, SeatType (STANDARD/VIP/COUPLE/BROKEN), bulk operations, FE drag-paint, color synchronization | Tổng quan Room CRUD, RoomType enum |

### Cross-reference giữa 2 file
Trong `06-room`:
> Xem chi tiết về Seat management (sinh ghế, ghế đôi, drag-paint editor) ở [`07-seat-explained.md`](07-seat-explained.md).

Trong `07-seat`:
> Xem chi tiết về Room entity, CRUD phòng và RoomType ở [`06-room-explained.md`](06-room-explained.md).

### Logic chống xóa Room đang có Showtime active

Đây là validation thiếu trong cả 2 file:

```java
@Transactional
public void deleteRoom(Long id) {
    Room room = roomRepository.findById(id)
        .orElseThrow(() -> new BusinessException(ErrorCode.ROOM_NOT_FOUND));

    // Kiểm tra có showtime active (chưa kết thúc) không
    LocalDateTime now = LocalDateTime.now();
    boolean hasActiveShowtimes = showtimeRepository.existsByRoomIdAndEndTimeAfterAndStatusNot(
        id, now, ShowtimeStatus.CANCELLED
    );

    if (hasActiveShowtimes) {
        throw new BusinessException(ErrorCode.ROOM_HAS_ACTIVE_SHOWTIMES);
    }

    // Soft delete room
    room.setStorageState(StorageState.DELETED);

    // Soft delete tất cả seats của room (cascade thủ công)
    seatRepository.softDeleteByRoomId(id);

    log.info("Soft deleted room {} and all its seats", room.getName());
}
```

### Concurrency: 2 admin cùng generate ghế

Trùng phát hiện ở file 06 và 07. Pattern đúng:
```java
@Entity
public class Room extends BaseEntity {
    @Version
    private Long version;  // BaseEntity đã có
}

@Transactional
public void generateSeats(Long roomId, SeatGenerationRequest req) {
    Room room = roomRepository.findById(roomId).orElseThrow();
    seatRepository.softDeleteByRoomId(roomId);
    List<Seat> newSeats = buildSeatsFromRequest(req, room);
    seatRepository.saveAll(newSeats);
    room.setTotalSeats(newSeats.size());
    // Hibernate UPDATE room SET total_seats=?, version=version+1
}
```

Nếu 2 admin cùng `generateSeats(1)`:
- Admin A commit trước → version 5 → 6
- Admin B commit sâu → vẫn dùng version 5 (đọc cũ) → UPDATE WHERE version=5 → 0 row updated → `OptimisticLockException`
- Admin B nhận lỗi → retry hoặc báo "có người khác đang sửa".

### Cảnh báo về mất dấu tiếng Việt

Phần lớn file này (mục gốc) **MẤT DẤU tiếng Việt** ("Tổng quan", "phòng" thấy vì "phòng", "ghế" thấy vì "ghế"). Vì phạm rule `CLAUDE.md`. Khi rảnh, nên audit lại để khôi phục dấu cho consistent.
