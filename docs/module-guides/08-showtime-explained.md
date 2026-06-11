# Module Showtime -- Giải thích chi tiết

## 1. Tổng quan

### Module này làm gì?

Module Showtime quản lý **suất chiếu phim** -- tuc là "phim nào chiếu o phòng nào, ngày giờ nào, giá vé bao nhieu". Day là module trung tám nơi **Movie** (phim) với **Room** (phòng), tạo ra lich chiếu de người đúng đặt vé.

### Ví dụ đời thường

Hay tuong tuong bạn là quản lý rap phim. Mới sang bạn phải:
1. Chon phim nào chiếu hom này (VD: "Avengers" dài 150 phút)
2. Chon phòng chiếu (VD: "Phòng IMAX")
3. Chon giờ bắt đầu (VD: 14:00)
4. Hệ thống tu tinh giờ kết thúc: 14:00 + 150 phút phim + 15 phút don phòng = 16:45
5. Hệ thống kiểm tra: phòng IMAX co trong tu 14:00 đến 16:45 không?
6. Đặt giá vé: thuong 75.000d, VIP 100.000d, đôi 150.000d

### Bài toán chinh

| Bài toán | Mô tả | Do kho |
|---|---|---|
| Tinh `endTime` tu đồng | `startTime + movie.duration + buffer` (buffer đọc tu DB, không hardcode) | Trung binh |
| Kiểm tra trung giờ | 2 suất chiếu không được chong thời gian trong cùng 1 phòng | Kho |
| Validate giá vé | Giá thuong <= VIP <= đôi (business rule) | De |
| Không sửa suất đã co về | Nếu đã co người đặt vé thì không được sửa suất chiếu | Trung binh |
| Filter đã dieu kien | Loc theo movieId, roomId, ngày, trạng thái (đồng thời hoặc rieng le) | Trung binh |

---

## 2. Danh sách files đã tạo

| File | Tac đúng | Design Pattern |
|---|---|---|
| `entity/Showtime.java` | Entity JPA, quan he @ManyToOne với Movie và Room | Inheritance (BaseEntity) |
| `entity/ShowtimeStatus.java` | Enum trạng thái: SCHEDULED, ONGOING, FINISHED, CANCELLED | Enum Pattern |
| `dto/ShowtimeFilter.java` | Nhan params filter tu FE: movieId, roomId, date, status | Filter DTO |
| `dto/ShowtimeRequest.java` | DTO nhan dữ liệu tạo/sửa suất chiếu, co validation | DTO + Validation |
| `dto/ShowtimeResponse.java` | DTO tra chi tiết (movie info, room info, prices, availableSeats) | DTO + Builder |
| `dto/ShowtimeListResponse.java` | DTO rut gon cho danh sach (không co availableSeats) | DTO + Builder |
| `repository/ShowtimeRepository.java` | JpaSpecificationExecutor + method kiểm tra trung giờ | Repository |
| `specification/ShowtimeSpecification.java` | Build query WHERE đồng tu filter | Specification Pattern |
| `mapper/ShowtimeMapper.java` | MapStruct chuyen Showtime -> DTO, map nested fields | Mapper (MapStruct) |
| `service/ShowtimeService.java` | CRUD + check trung giờ + tinh endTime + validate giá | Service Layer |
| `controller/ShowtimeController.java` | 8 endpoints REST (CRUD + bulk + restore) | Controller Layer |

---

## 3. Design Patterns chi tiết

### 3.1 Specification Pattern (Behavioral)

#### Pattern này là gì?

Specification Pattern cho phep **xay đúng cau truy vấn WHERE đồng** -- tuc là tuy thuoc vào người đúng gui gì lên, hệ thống sẽ tu ghép các dieu kien loc lai với nhau.

#### Ví dụ đời thường

Tuong tuong bạn vào trang Shopee tìm ao:
- Chi chon "ao thun" -> WHERE category = 'ao_thun'
- Them chon "mau đến" -> WHERE category = 'ao_thun' AND color = 'đến'
- Them chon "giá dưới 200k" -> WHERE category = 'ao_thun' AND color = 'đến' AND price < 200000

Mới lan bạn tick thêm 1 bộ loc, hệ thống **ghép thêm** 1 dieu kien AND. Do chinh là Specification Pattern.

#### Ap đúng ở đâu trong code?

File: `specification/ShowtimeSpecification.java`

```java
public static Specification<Showtime> fromFilter(ShowtimeFilter filter) {
    // Bat dau voi spec rong (khong co WHERE gi ca)
    Specification<Showtime> spec = Specification.where(null);

    // Ghep tung dieu kien neu FE gui len
    if (!Boolean.TRUE.equals(filter.getIncludeDeleted())) {
        spec = spec.and(notDeleted());        // AND storage_state <> 'ARCHIVED'
    }
    if (filter.getMovieId() != null) {
        spec = spec.and(hasMovie(filter.getMovieId()));  // AND movie_id = ?
    }
    if (filter.getRoomId() != null) {
        spec = spec.and(hasRoom(filter.getRoomId()));    // AND room_id = ?
    }
    if (filter.getDate() != null) {
        spec = spec.and(onDate(filter.getDate()));       // AND start_time BETWEEN ...
    }
    if (filter.getStatus() != null) {
        spec = spec.and(hasStatus(filter.getStatus()));  // AND status = ?
    }
    return spec;
}
```

Mới method như `hasMovie()`, `hasRoom()`, `onDate()` trả về 1 "manh" dieu kien. Method `fromFilter()` ghép các manh lai = `.and()`.

#### Tại sao đúng pattern này?

**KHONG đúng Specification (code xấu):**
```java
// Phai viet N method cho moi to hop filter
List<Showtime> findByMovieId(Long movieId);
List<Showtime> findByMovieIdAndRoomId(Long movieId, Long roomId);
List<Showtime> findByMovieIdAndDate(Long movieId, LocalDate date);
List<Showtime> findByMovieIdAndRoomIdAndDate(Long movieId, Long roomId, LocalDate date);
// ... 2^4 = 16 to hop voi 4 filter -> BUNG NO!
```

**CO đúng Specification (code tốt):**
```java
// Chi can 1 method duy nhat
Page<Showtime> findAll(Specification<Showtime> spec, Pageable pageable);
// FE gui gi len -> tu dong ghep dieu kien -> 1 query duy nhat
```

#### Khi nào KHONG nên dùng?

- Khi chi co 1-2 filter co dinh (VD: `findByUsername`) -> đúng Spring Data method naming đơn giản hon.
- Khi query qua phức tạp (nhieu JOIN, subquery) -> đúng `@Query` JPQL hoặc native SQL.

---

### 3.2 Overlap Detection -- Kiểm tra trung giờ (Thuật toán)

#### Bài toán

Trong 1 phòng chiếu, 2 suất chiếu **không được chong thời gian**. Ví dụ phòng IMAX đang co suất 14:00-16:30, thì không the tạo suất 15:00-17:00 vì chúng "de lên nhau".

#### Cong thuc kinh dien

Cho 2 khoang thời gian:
- Khoang 1: [A, B] (suất cũ: A = startTime, B = endTime)
- Khoang 2: [C, D] (suất mới: C = startTime, D = endTime)

```
HAI KHOANG GIAO NHAU KHI VA CHI KHI:  A < D  AND  C < B
```

Cong thuc này **rat ngắn gon** những nhieu người nhằm. Hay hieu theo huong nguoc lai:

```
HAI KHOANG KHONG GIAO NHAU KHI:  B <= C  HOAC  D <= A
   (khoang 1 ket thuc truoc khi khoang 2 bat dau, hoac nguoc lai)

=> GIAO NHAU = PHU DINH cua KHONG GIAO NHAU
   = NOT (B <= C OR D <= A)
   = B > C AND D > A
   = A < D AND C < B  (doi vi tri)
```

#### Mình hoa bảng hinh

```
Truong hop 1: KHONG trung (suat cu ket thuc truoc suat moi)
Suat cu:  |====10:00====12:30====|
Suat moi:                            |====14:00====16:30====|
                                  ^                         ^
                              12:30 < 14:00 => KHONG giao

Truong hop 2: TRUNG! (suat cu chua ket thuc ma suat moi da bat dau)
Suat cu:  |====13:00===========15:00====|
Suat moi:              |====14:00===========16:30====|
                       ^                ^
                   13:00 < 16:30 (TRUE) AND 14:00 < 15:00 (TRUE) => TRUNG!

Truong hop 3: TRUNG! (suat moi bat dau khi suat cu chua ket thuc)
Suat cu:                    |====16:00==========18:00====|
Suat moi:  |====14:00===========16:30====|
                                ^        ^
                            16:00 < 16:30 (TRUE) AND 14:00 < 18:00 (TRUE) => TRUNG!

Truong hop 4: KHONG trung (suat moi ket thuc truoc suat cu)
Suat cu:                              |====17:00====19:00====|
Suat moi:  |====14:00====16:30====|
                                  ^
                              17:00 > 16:30 => C < B la FALSE => KHONG giao
```

#### Ap đúng trong code

File: `repository/ShowtimeRepository.java`

```java
@Query("SELECT s FROM Showtime s WHERE s.room.id = :roomId " +
        "AND s.startTime < :endTime AND s.endTime > :startTime " +   // <-- Cong thuc A < D AND C < B
        "AND (s.storageState IS NULL OR s.storageState <> 'ARCHIVED') " +  // Bo qua suat da xoa
        "AND s.status <> 'CANCELLED'")                                     // Bo qua suat da huy
List<Showtime> findConflictingShowtimes(Long roomId, LocalDateTime startTime, LocalDateTime endTime);
```

Giải thích tung đồng:
- `s.room.id = :roomId` -- Chi kiểm tra trong **cùng phòng** (phòng khác thì không cần check)
- `s.startTime < :endTime` -- Suất cũ bắt đầu trước khi suất mới kết thúc (dieu kien A < D)
- `s.endTime > :startTime` -- Suất cũ kết thúc sâu khi suất mới bắt đầu (dieu kien C < B)
- `storageState <> 'ARCHIVED'` -- Bỏ qua suất đã xóa mem (StorageState enum chỉ có ACTIVE/ARCHIVED)
- `status <> 'CANCELLED'` -- Bỏ qua suất đã huy (phòng đã free)

**Luu y quan trọng khi UPDATE:** Khi sửa suất chiếu, phải **loại tru chinh no** ra khoi danh sach conflict. Nếu không, suất chiếu sẽ tu "trung" với chinh mình:

```java
// File: service/ShowtimeService.java, method updateShowtime()
List<Showtime> conflicts = showtimeRepository.findConflictingShowtimes(
        room.getId(), request.getStartTime(), endTime);
conflicts.removeIf(s -> s.getId().equals(id));  // <-- Loai tru chinh no!
if (!conflicts.isEmpty()) {
    throw new BusinessException(ErrorCode.SHOWTIME_CONFLICT, ...);
}
```

---

### 3.3 Buffer về sinh phòng (Cau hinh đồng tu SystemConfig)

#### Bài toán

Sau khi phim kết thúc, nhan vien cần thời gian de:
- Don dep rac, nuoc uong con sot
- Kiểm tra ghế hu
- Chuan bi cho luot khan giá tiếp theo

=> Can **cong thêm** thời gian buffer vào endTime.

#### Tại sao KHONG hardcode?

```java
// SAI -- Hardcode:
LocalDateTime endTime = startTime.plusMinutes(movie.getDuration()).plusMinutes(15);
// Van de: Neu muon doi buffer tu 15 -> 20 phut, phai SUA CODE + REBUILD + RESTART server!
```

```java
// DUNG -- Doc tu SystemConfig (cau hinh dong):
int bufferMinutes = systemConfigService.getInt("showtime.buffer_minutes", 15);
LocalDateTime endTime = startTime.plusMinutes(movie.getDuration()).plusMinutes(bufferMinutes);
// Loi: Admin vao trang Config, sua "showtime.buffer_minutes" = 20 -> co hieu luc ngay!
```

#### Cách tinh endTime chi tiết

```
endTime = startTime + movie.duration + bufferMinutes

Vi du cu the:
  Phim:       "Avengers: Endgame" (duration = 150 phut)
  Phong:      "Room IMAX"
  startTime:  2026-05-25 14:00
  buffer:     15 phut (doc tu system_config)

  endTime = 14:00 + 150 phut + 15 phut
          = 14:00 + 165 phut
          = 14:00 + 2 gio 45 phut
          = 16:45

  => Phong IMAX bi "khoa" tu 14:00 den 16:45
  => Suat tiep theo cua phong nay som nhat la 16:45
```

#### SystemConfigService hoạt động thế nào?

```
                +-------------------+
                |   system_config   |  (bang trong DB)
                | config_key|value  |
                |-----------|-------|
                | showtime. |  15   |
                | buffer_   |       |
                | minutes   |       |
                +-------------------+
                       |
            Server khoi dong (@PostConstruct)
                       |
                       v
                +-----------------+
                | ConcurrentHash  |  (cache trong RAM)
                | Map<String,     |
                |   String>       |
                +-----------------+
                       |
           getInt("showtime.buffer_minutes", 15)
                       |
                       v
                  Tra ve: 15
```

- Khi server khoi đồng: đọc TAT CA config tu DB vào `ConcurrentHashMap` (cache trong RAM)
- Khi cần đọc config: đọc tu RAM (cuc nhanh, không cần query DB mỗi lần)
- Khi admin sửa config: ghi vào DB + cấp nhất RAM cùng luc
- Default value: nếu key không ton tai trong DB, trả về giá trị mac dinh (tham so thu 2)

---

### 3.4 Validate giá vé -- Business Rule

#### Quy tắc

```
Gia thuong (base)  <=  Gia VIP  <=  Gia doi (couple)
```

#### Tại sao co quy tắc này?

- **Ghế thuong**: ghế binh dan, vị trí bình thường -> giá re nhất
- **Ghế VIP**: ghế rộng hon, vị trí tốt hon (giua phòng, hàng giua) -> đặt hon ghế thường
- **Ghế đôi**: 2 ghế lien nhau (danh cho cặp đôi), co tay vin chúng -> đặt nhất (vì 2 người ngoi)

Nếu admin nhập giá VIP = 50.000 những giá thuong = 75.000 -> **vô ly** (VIP ma re hon thuong?) -> hệ thống bao loi.

#### Ap đúng trong code

File: `service/ShowtimeService.java`, method `validatePriceHierarchy()`

```java
private void validatePriceHierarchy(ShowtimeRequest request) {
    var base = request.getBasePrice();
    var vip = request.getVipPrice();
    var couple = request.getCouplePrice();

    // Kiem tra 1: VIP >= thuong
    if (vip != null && base != null && vip.compareTo(base) < 0) {
        throw new BusinessException(ErrorCode.INVALID_REQUEST,
                "Gia VIP phai lon hon hoac bang gia thuong");
    }
    // Kiem tra 2: doi >= VIP
    if (couple != null && vip != null && couple.compareTo(vip) < 0) {
        throw new BusinessException(ErrorCode.INVALID_REQUEST,
                "Gia ghe doi phai lon hon hoac bang gia VIP");
    }
    // Kiem tra 3: doi >= thuong (phong truong hop khong co VIP)
    if (couple != null && base != null && couple.compareTo(base) < 0) {
        throw new BusinessException(ErrorCode.INVALID_REQUEST,
                "Gia ghe doi phai lon hon hoac bang gia thuong");
    }
}
```

**Tại sao đúng `compareTo()` thấy vì `<` ?**
Vì `basePrice` co kiểu `BigDecimal`, không phải `int`/`long`. Trong Java, `BigDecimal` không ho tro toan tu `<`, `>` trực tiếp. Phai đúng `compareTo()`:
- `a.compareTo(b) < 0` => a nhỏ hon b
- `a.compareTo(b) == 0` => a bảng b
- `a.compareTo(b) > 0` => a lớn hon b

---

### 3.5 MapStruct Mapping Nested Fields

#### Van de

Entity `Showtime` co quan he:
```java
@ManyToOne(fetch = FetchType.LAZY)
private Movie movie;   // movie.title, movie.posterUrl, movie.duration

@ManyToOne(fetch = FetchType.LAZY)
private Room room;     // room.name, room.type
```

Nhưng DTO `ShowtimeResponse` lai co các field **phang** (flat):
```java
private String movieTitle;      // Khong phai Movie object
private String roomName;        // Khong phai Room object
private String roomType;
```

=> Can bao MapStruct: "lay `movie.title` gắn vào `movieTitle`".

#### Ap đúng trong code

File: `mapper/ShowtimeMapper.java`

```java
@Mapper(componentModel = "spring")
public interface ShowtimeMapper {

    @Mapping(source = "movie.id", target = "movieId")
    @Mapping(source = "movie.title", target = "movieTitle")
    @Mapping(source = "movie.posterUrl", target = "moviePosterUrl")
    @Mapping(source = "movie.duration", target = "movieDuration")
    @Mapping(source = "room.id", target = "roomId")
    @Mapping(source = "room.name", target = "roomName")
    @Mapping(source = "room.type", target = "roomType")
    @Mapping(target = "availableSeats", ignore = true)   // Tinh rieng trong Service
    ShowtimeResponse toResponse(Showtime showtime);
}
```

#### MapStruct sinh code gì?

Khi build (`./gradlew build`), MapStruct **tu đồng sinh** file `ShowtimeMapperImpl.java`:

```java
// Code duoc MapStruct TU SINH (ban khong can viet)
@Override
public ShowtimeResponse toResponse(Showtime showtime) {
    return ShowtimeResponse.builder()
        .id(showtime.getId())
        .movieId(showtime.getMovie().getId())           // movie.id -> movieId
        .movieTitle(showtime.getMovie().getTitle())       // movie.title -> movieTitle
        .moviePosterUrl(showtime.getMovie().getPosterUrl())
        .movieDuration(showtime.getMovie().getDuration())
        .roomId(showtime.getRoom().getId())               // room.id -> roomId
        .roomName(showtime.getRoom().getName())           // room.name -> roomName
        .roomType(showtime.getRoom().getType().name())    // room.type -> roomType
        .startTime(showtime.getStartTime())
        .endTime(showtime.getEndTime())
        .basePrice(showtime.getBasePrice())
        .vipPrice(showtime.getVipPrice())
        .couplePrice(showtime.getCouplePrice())
        .status(showtime.getStatus())
        .createdAt(showtime.getCreatedAt())
        .updatedAt(showtime.getUpdatedAt())
        .build();
}
```

**Luu y về Lazy Loading:**
- Movie và Room deu đúng `fetch = FetchType.LAZY` -> khi goi `showtime.getMovie()`, Hibernate sẽ chay 1 query SELECT rieng de lay Movie.
- Day KHONG phải N+1 problem vì mới request chi xử lý 1 showtime (trong `getShowtime()`). Nhưng o `listShowtimes()` thì co the gap N+1 -- mới showtime trong trang sẽ trigger 1 query Movie và 1 query Room.
- Cách fix N+1 (nếu cần toi uu): đúng `@EntityGraph` hoặc `JOIN FETCH` trong repository.

---

### 3.6 DTO Pattern -- 2 Response cho 2 mục dich

#### Tại sao cần 2 DTO response?

| | `ShowtimeListResponse` | `ShowtimeResponse` |
|---|---|---|
| Dùng cho | Danh sách (GET /api/showtimes) | Chi tiết (GET /api/showtimes/{id}) |
| Co `availableSeats`? | Không | Co |
| Co `movieDuration`? | Không | Co |
| Lý đó | Danh sách không cần tinh ghế trong (ton query) | Chi tiết cần hiển thị ghế trong |

**Nguyên tắc: Interface Segregation** -- Không ep client nhan dữ liệu không cần. Danh sách chi cần thong tin co bạn de hiển thị bảng (table), chi tiết mới cần day du.

---

## 4. Sơ đồ luồng xử lý chi tiết

### 4.1 Tao suất chiếu (POST /api/showtimes)

```
Client (Admin)
  |
  |  POST /api/showtimes
  |  Body: { movieId: 1, roomId: 2, startTime: "2026-05-25T14:00",
  |          basePrice: 75000, vipPrice: 100000, couplePrice: 150000 }
  |
  v
ShowtimeController.createShowtime(request)
  |
  |  @PreAuthorize("hasRole('ADMIN')")  -- Chi admin moi duoc tao
  |  @Valid                              -- Tu dong validate @NotNull, @Min
  |
  v
ShowtimeService.createShowtime(request)
  |
  |-- Buoc 1: Tim Movie (id=1)
  |   movieRepository.findById(1)
  |   => Movie { title: "Avengers", duration: 150 }
  |   (Neu khong tim thay -> throw MOVIE_NOT_FOUND 404)
  |
  |-- Buoc 2: Tim Room (id=2)
  |   roomRepository.findById(2)
  |   => Room { name: "Room IMAX", totalSeats: 120 }
  |   (Neu khong tim thay -> throw ROOM_NOT_FOUND 404)
  |
  |-- Buoc 3: Check qua khu
  |   startTime = 2026-05-25 14:00
  |   now       = 2026-05-31 10:00
  |   14:00 ngay 25 < now? -> KHONG (tuong lai) -> OK
  |   (Neu la qua khu -> throw INVALID_REQUEST 400)
  |
  |-- Buoc 4: Tinh endTime
  |   bufferMinutes = systemConfigService.getInt("showtime.buffer_minutes", 15) = 15
  |   endTime = 14:00 + 150 phut (phim) + 15 phut (buffer) = 16:45
  |
  |-- Buoc 5: Validate gia
  |   base=75000 <= vip=100000 <= couple=150000 -> OK
  |   (Neu vip < base -> throw INVALID_REQUEST 400)
  |
  |-- Buoc 6: Check trung gio
  |   findConflictingShowtimes(roomId=2, startTime=14:00, endTime=16:45)
  |   => SQL: SELECT s FROM showtimes s
  |          WHERE room_id = 2
  |            AND start_time < '16:45'       -- A < D
  |            AND end_time > '14:00'         -- C < B
  |            AND storage_state <> 'ARCHIVED'
  |            AND status <> 'CANCELLED'
  |   => Ket qua: [] (rong) -> KHONG trung -> OK
  |   (Neu co conflicts -> throw SHOWTIME_CONFLICT 409)
  |
  |-- Buoc 7: Save
  |   Showtime.builder()
  |     .movie(movie).room(room)
  |     .startTime(14:00).endTime(16:45)
  |     .basePrice(75000).vipPrice(100000).couplePrice(150000)
  |     .status(SCHEDULED)
  |     .build()
  |   showtimeRepository.save(showtime)
  |   => INSERT INTO showtimes (...)
  |
  |-- Buoc 8: Tra response
  |   getShowtime(showtime.getId())
  |   => ShowtimeResponse voi day du thong tin + availableSeats = 120 (chua ai dat)
  |
  v
ApiResponse.ok("Showtime created", response)
  => HTTP 200
```

### 4.2 Sửa suất chiếu (PUT /api/showtimes/{id})

```
Client (Admin)
  |
  |  PUT /api/showtimes/5
  |  Body: { movieId: 1, roomId: 2, startTime: "2026-05-25T15:00",
  |          basePrice: 80000, vipPrice: 110000, couplePrice: 160000 }
  |
  v
ShowtimeService.updateShowtime(id=5, request)
  |
  |-- Buoc 1: Tim showtime (id=5)
  |   showtimeRepository.findById(5)
  |   (Khong co -> throw SHOWTIME_NOT_FOUND 404)
  |
  |-- Buoc 2: KIEM TRA CO VE DAT CHUA? (**Quan trong!**)
  |   bookingRepository.countByShowtimeIdAndStatusIn(5, [HOLDING, CONFIRMED])
  |   => activeBookings = 0 -> OK, cho phep sua
  |   (Neu activeBookings > 0 -> throw INVALID_REQUEST 400:
  |    "Khong the sua suat chieu da co 3 ve dat")
  |
  |   TAI SAO? Vi neu sua gio chieu/gia ve khi nguoi ta da dat ve -> gay nham lan.
  |   Nguoi dung dat ve gio 14:00 gia 75k, admin sua thanh 15:00 gia 100k -> vo ly!
  |
  |-- Buoc 3: Tim Movie + Room (giong tao moi)
  |
  |-- Buoc 4: Tinh endTime (giong tao moi)
  |   endTime = 15:00 + 150 + 15 = 17:45
  |
  |-- Buoc 5: Validate gia (giong tao moi)
  |
  |-- Buoc 6: Check trung gio -- **LOAI TRU CHINH NO**
  |   conflicts = findConflictingShowtimes(roomId=2, 15:00, 17:45)
  |   conflicts.removeIf(s -> s.getId().equals(5))  // <-- Loai suat id=5
  |
  |   TAI SAO? Vi query se tra ve chinh suat id=5 (no trung gio voi chinh no).
  |   Neu khong loai tru -> moi lan update deu bao "trung gio" -> khong bao gio sua duoc!
  |
  |-- Buoc 7: Cap nhat entity + save
  |   showtime.setStartTime(15:00)
  |   showtime.setEndTime(17:45)
  |   showtime.setBasePrice(80000)
  |   ...
  |   showtimeRepository.save(showtime)
  |   => UPDATE showtimes SET ... WHERE id = 5
  |
  v
ApiResponse.ok("Showtime updated", response)
```

### 4.3 Xoa mem (DELETE /api/showtimes/{id})

```
ShowtimeService.deleteShowtime(id)
  |
  |-- Tim showtime
  |-- showtime.setStorageState(StorageState.ARCHIVED)   // Khong DELETE that
  |-- showtimeRepository.save(showtime)
  |
  => UPDATE showtimes SET storage_state = 'ARCHIVED' WHERE id = ?
```

**Tại sao xóa mem (soft delete)?**
- Nếu xóa that (DELETE FROM) -> mat dữ liệu vinh vien, không the khoi phuc
- Xoa mem = đặt co "đã xóa" -> khi query thì bộ qua (WHERE storage_state <> 'ARCHIVED')
- Admin co the "khoi phuc" bất cứ luc nào (POST /api/showtimes/{id}/restore)
- Dữ liệu van con trong DB de bao cao, thong ke

### 4.4 Danh sách với filter (GET /api/showtimes?movieId=1&date=2026-05-25)

```
ShowtimeService.listShowtimes(filter, pageable)
  |
  |-- Specification.fromFilter(filter)
  |   filter.movieId = 1        -> AND movie_id = 1
  |   filter.date = 2026-05-25  -> AND start_time >= '2026-05-25 00:00'
  |                                AND start_time < '2026-05-26 00:00'
  |   filter.includeDeleted = null -> AND storage_state <> 'ARCHIVED'
  |
  |-- showtimeRepository.findAll(spec, pageable)
  |   => SQL voi tat ca dieu kien ghep lai
  |
  |-- .map(showtimeMapper::toListResponse)
  |   => Chuyen moi Showtime entity -> ShowtimeListResponse DTO
  |
  v
Page<ShowtimeListResponse>
```

---

## 5. MapStruct Mapping Nested Fields -- Chi tiết

### Van de cột loi

Trong DB, bảng `showtimes` chi lưu `movie_id` (so) và `room_id` (so). Nhưng FE cần hiển thị **tên phim**, **tên phòng** -- không phải ID.

### Cách MapStruct giai quyet

```
ENTITY (Showtime)                    DTO (ShowtimeResponse)
+--------------------------+         +------------------------+
| movie: Movie             |  ====>  | movieId: Long          |
|   .id = 1                |  map    | movieTitle: String     |
|   .title = "Avengers"    |  ====>  | moviePosterUrl: String |
|   .posterUrl = "http://." |         | movieDuration: Integer |
|   .duration = 150        |         |                        |
| room: Room               |  ====>  | roomId: Long           |
|   .id = 2                |  map    | roomName: String       |
|   .name = "Room IMAX"    |  ====>  | roomType: String       |
|   .type = IMAX           |         |                        |
+--------------------------+         +------------------------+
```

**Annotation `@Mapping`:**

```java
@Mapping(source = "movie.title", target = "movieTitle")
// Doc nhu: "lay gia tri cua showtime.getMovie().getTitle()
//           va gan vao response.setMovieTitle()"
```

**Annotation `@Mapping(target = "availableSeats", ignore = true)`:**
```java
// Noi voi MapStruct: "khong tu map field nay, tao se tinh rieng trong Service"
// Vi availableSeats khong co trong entity Showtime, ma can query BookingSeatRepository
```

### Qua trinh compile

```
Ban viet:           ShowtimeMapper.java      (interface, chi co khai bao)
                          |
                    ./gradlew build
                          |
                          v
MapStruct sinh:     ShowtimeMapperImpl.java   (class, co code cu the)
                          |
                          v
Spring inject:      @Autowired ShowtimeMapper  -> ShowtimeMapperImpl
```

---

## 6. SQL được sinh ra cho từng operation

### 6.1 Danh sách suất chiếu (filter movieId + date)

```sql
-- FE goi: GET /api/showtimes?movieId=1&date=2026-05-25&page=0&size=20
-- Specification ghep dieu kien:

SELECT s.id, s.movie_id, s.room_id, s.start_time, s.end_time,
       s.base_price, s.vip_price, s.couple_price, s.status,
       s.storage_state, s.created_at, s.updated_at, s.version
FROM showtimes s
WHERE s.movie_id = 1                                           -- hasMovie(1)
  AND s.start_time >= '2026-05-25 00:00:00.000'               -- onDate() phan 1
  AND s.start_time < '2026-05-26 00:00:00.000'                -- onDate() phan 2
  AND (s.storage_state IS NULL OR s.storage_state <> 'ARCHIVED')  -- notDeleted()
ORDER BY s.created_at DESC                                     -- @PageableDefault
OFFSET 0 ROWS FETCH NEXT 20 ROWS ONLY;                        -- Phan trang SQL Server

-- Sau do, voi MOI showtime trong ket qua, MapStruct goi getMovie() va getRoom():
SELECT m.* FROM movies m WHERE m.id = 1;      -- Lazy load Movie
SELECT r.* FROM rooms r WHERE r.id = 2;        -- Lazy load Room
```

### 6.2 Chi tiết suất chiếu (GET /api/showtimes/5)

```sql
-- Buoc 1: Lay showtime
SELECT s.* FROM showtimes s WHERE s.id = 5;

-- Buoc 2: Lazy load Movie va Room (khi MapStruct goi getMovie/getRoom)
SELECT m.* FROM movies m WHERE m.id = 1;
SELECT r.* FROM rooms r WHERE r.id = 2;

-- Buoc 3: Tinh so ghe da chiem (cho getShowtime() tinh availableSeats)
SELECT bs.* FROM booking_seats bs
JOIN bookings b ON b.id = bs.booking_id
WHERE b.showtime_id = 5
  AND b.status IN ('HOLDING', 'CONFIRMED');
```

### 6.3 Kiểm tra trung giờ (khi tạo/sửa suất chiếu)

```sql
-- Tim suat chieu xung dot trong phong 2, khoang 14:00-16:45
SELECT s.* FROM showtimes s
WHERE s.room_id = 2
  AND s.start_time < '2026-05-25 16:45:00'       -- Suat cu bat dau truoc khi suat moi ket thuc
  AND s.end_time > '2026-05-25 14:00:00'          -- Suat cu ket thuc sau khi suat moi bat dau
  AND (s.storage_state IS NULL OR s.storage_state <> 'ARCHIVED')
  AND s.status <> 'CANCELLED';

-- Neu tra ve 0 dong -> khong trung -> cho phep tao
-- Neu tra ve >= 1 dong -> trung gio -> throw SHOWTIME_CONFLICT
```

### 6.4 Tao suất chiếu (INSERT)

```sql
INSERT INTO showtimes (
    movie_id, room_id,
    start_time, end_time,
    base_price, vip_price, couple_price,
    status, storage_state, version,
    created_at, updated_at, created_by, updated_by
) VALUES (
    1, 2,
    '2026-05-25 14:00:00', '2026-05-25 16:45:00',
    75000, 100000, 150000,
    'SCHEDULED', NULL, 0,
    '2026-05-31 10:00:00', '2026-05-31 10:00:00', 'admin', 'admin'
);
```

### 6.5 Sửa suất chiếu (UPDATE)

```sql
-- Truoc khi update, kiem tra co booking active khong:
SELECT COUNT(*) FROM bookings b
WHERE b.showtime_id = 5
  AND b.status IN ('HOLDING', 'CONFIRMED');
-- Neu count > 0 -> throw loi, khong cho sua

-- Neu count = 0 -> cho phep update:
UPDATE showtimes SET
    movie_id = 1, room_id = 2,
    start_time = '2026-05-25 15:00:00',
    end_time = '2026-05-25 17:45:00',
    base_price = 80000, vip_price = 110000, couple_price = 160000,
    updated_at = '2026-05-31 10:05:00',
    version = version + 1                      -- Optimistic Lock (@Version)
WHERE id = 5 AND version = 0;                  -- Chi update neu version khop
```

### 6.6 Xoa mem (soft delete)

```sql
UPDATE showtimes SET
    storage_state = 'ARCHIVED',
    updated_at = '2026-05-31 10:10:00',
    version = version + 1
WHERE id = 5;
```

---

## 7. Cấu hình động (SystemConfig)

### Cac config lien quan đến module Showtime

| Key | Giá trị mac dinh | Mô tả | Ai thấy đôi? |
|---|---|---|---|
| `showtime.buffer_minutes` | `15` | So phút don dep phòng giua 2 suất chiếu | Admin (trang Config) |
| `booking.cutoff_after_start_minutes` | `15` | Sau khi phim bắt đầu bao nhieu phút thì không cho đặt vé nua | Admin (trang Config) |

### Cách hoạt động

```
1. Bang system_config trong DB:
   +----+-------------------------------+-------+
   | id | config_key                    | value |
   +----+-------------------------------+-------+
   |  1 | showtime.buffer_minutes       | 15    |
   |  2 | booking.cutoff_after_start_.. | 15    |
   +----+-------------------------------+-------+

2. Server khoi dong -> @PostConstruct loadAll():
   Doc tat ca row tu DB -> luu vao ConcurrentHashMap (cache RAM)

3. ShowtimeService goi:
   systemConfigService.getInt("showtime.buffer_minutes", 15)
   -> Doc tu RAM (khong query DB) -> tra ve 15

4. Admin vao trang Config, sua buffer tu 15 -> 20:
   systemConfigService.updateConfig("showtime.buffer_minutes", "20")
   -> UPDATE system_config SET value = '20' WHERE config_key = '...'
   -> cache.put("showtime.buffer_minutes", "20")
   -> Lan tao suat chieu tiep theo se dung buffer = 20

5. KHONG can restart server!
```

### Tại sao đúng ConcurrentHashMap?

- `HashMap` bình thường **không an toàn** khi nhieu thread đọc/ghi đồng thời (multi-thread) -> co the bi loi data
- `ConcurrentHashMap` được thiết kế cho multi-thread -> nhieu request đọc cùng luc van an toàn
- Server web xử lý nhieu request song song (mới request = 1 thread) -> bật buoc đúng ConcurrentHashMap

---

## 8. Request/Response mẫu

### 8.1 Danh sách suất chiếu (PUBLIC -- không cần đăng nhập)

```bash
curl "http://localhost:8088/api/showtimes?movieId=1&date=2026-05-25&page=0&size=20"
```

**Response thanh cong (200):**
```json
{
  "success": true,
  "data": {
    "content": [
      {
        "id": 1,
        "storageState": null,
        "movieId": 1,
        "movieTitle": "Avengers: Endgame",
        "moviePosterUrl": "https://res.cloudinary.com/cinex/posters/avengers.jpg",
        "roomId": 3,
        "roomName": "Room IMAX",
        "roomType": "IMAX",
        "startTime": "2026-05-25T09:00:00",
        "endTime": "2026-05-25T11:45:00",
        "basePrice": 75000,
        "vipPrice": 100000,
        "couplePrice": 150000,
        "status": "SCHEDULED",
        "createdAt": "2026-05-20T10:00:00",
        "updatedAt": "2026-05-20T10:00:00"
      },
      {
        "id": 2,
        "storageState": null,
        "movieId": 1,
        "movieTitle": "Avengers: Endgame",
        "moviePosterUrl": "https://res.cloudinary.com/cinex/posters/avengers.jpg",
        "roomId": 1,
        "roomName": "Room 1",
        "roomType": "TWO_D",
        "startTime": "2026-05-25T14:00:00",
        "endTime": "2026-05-25T16:45:00",
        "basePrice": 60000,
        "vipPrice": 85000,
        "couplePrice": 130000,
        "status": "SCHEDULED",
        "createdAt": "2026-05-20T10:05:00",
        "updatedAt": "2026-05-20T10:05:00"
      }
    ],
    "page": 0,
    "size": 20,
    "totalElements": 2,
    "totalPages": 1
  }
}
```

### 8.2 Chi tiết suất chiếu (PUBLIC)

```bash
curl "http://localhost:8088/api/showtimes/1"
```

**Response thanh cong (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "storageState": null,
    "movieId": 1,
    "movieTitle": "Avengers: Endgame",
    "moviePosterUrl": "https://res.cloudinary.com/cinex/posters/avengers.jpg",
    "movieDuration": 150,
    "roomId": 3,
    "roomName": "Room IMAX",
    "roomType": "IMAX",
    "startTime": "2026-05-25T09:00:00",
    "endTime": "2026-05-25T11:45:00",
    "basePrice": 75000,
    "vipPrice": 100000,
    "couplePrice": 150000,
    "status": "SCHEDULED",
    "availableSeats": 108,
    "createdAt": "2026-05-20T10:00:00",
    "updatedAt": "2026-05-20T10:00:00"
  }
}
```

### 8.3 Tao suất chiếu (ADMIN -- cần JWT)

```bash
curl -X POST "http://localhost:8088/api/showtimes" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9..." \
  -d '{
    "movieId": 1,
    "roomId": 2,
    "startTime": "2026-06-01T14:00:00",
    "basePrice": 75000,
    "vipPrice": 100000,
    "couplePrice": 150000
  }'
```

**Response thanh cong (200):**
```json
{
  "success": true,
  "message": "Showtime created",
  "data": {
    "id": 10,
    "movieId": 1,
    "movieTitle": "Avengers: Endgame",
    "movieDuration": 150,
    "roomId": 2,
    "roomName": "Room 2",
    "roomType": "TWO_D",
    "startTime": "2026-06-01T14:00:00",
    "endTime": "2026-06-01T16:45:00",
    "basePrice": 75000,
    "vipPrice": 100000,
    "couplePrice": 150000,
    "status": "SCHEDULED",
    "availableSeats": 100,
    "createdAt": "2026-05-31T10:00:00",
    "updatedAt": "2026-05-31T10:00:00"
  }
}
```

### 8.4 Loi: Trung giờ (409 Conflict)

```bash
# Tao suat chieu trung gio voi suat da co
curl -X POST "http://localhost:8088/api/showtimes" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9..." \
  -d '{
    "movieId": 2,
    "roomId": 2,
    "startTime": "2026-06-01T15:00:00",
    "basePrice": 60000,
    "vipPrice": 85000,
    "couplePrice": 130000
  }'
```

**Response loi (409):**
```json
{
  "success": false,
  "message": "Phong 'Room 2' da co suat chieu trong khung gio nay",
  "timestamp": "2026-06-01T15:00:00"
}
```

### 8.5 Loi: Giá VIP nhỏ hon giá thuong (400)

```json
{
  "success": false,
  "message": "Gia VIP phai lon hon hoac bang gia thuong",
  "timestamp": "2026-06-01T15:00:00"
}
```

### 8.6 Loi: Sửa suất chiếu đã co về đặt (400)

```json
{
  "success": false,
  "message": "Khong the sua suat chieu da co 3 ve dat",
  "timestamp": "2026-06-01T15:00:00"
}
```

> Lưu ý: `GlobalExceptionHandler` trả response qua `ApiResponse.error(message)` chỉ có 3 field:
> `success`, `message`, `timestamp` — KHÔNG có field `errorCode`. Mã `ErrorCode` (VD: `SHOWTIME_CONFLICT`,
> `INVALID_REQUEST`) chỉ dùng nội bộ ở backend để xác định HTTP status, không lộ ra response.

### 8.7 Xoa mem (ADMIN)

```bash
curl -X DELETE "http://localhost:8088/api/showtimes/1" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9..."
```

```json
{
  "success": true,
  "message": "Showtime deleted"
}
```

### 8.8 Khoi phuc suất đã xóa (ADMIN)

```bash
curl -X POST "http://localhost:8088/api/showtimes/1/restore" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9..."
```

```json
{
  "success": true,
  "message": "Showtime restored",
  "data": { "id": 1, "status": "SCHEDULED", "..." : "..." }
}
```

### 8.9 Xoa nhieu suất cùng luc (Bulk delete -- ADMIN)

```bash
curl -X POST "http://localhost:8088/api/showtimes/bulk-delete" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9..." \
  -d '{ "ids": [1, 2, 3] }'
```

```json
{
  "success": true,
  "message": "Deleted 3 showtimes"
}
```

---

## 9. Annotation và API mới sử dụng

| Annotation / API | Tac đúng | Ví dụ |
|---|---|---|
| `@ManyToOne(fetch = LAZY)` | Quan he nhieu-một, chi load khi goi getter (tiet kiem query) | Showtime -> Movie |
| `@JoinColumn(name, nullable)` | Chi dinh tên cột khoa ngoai trong DB | `@JoinColumn(name = "movie_id")` |
| `@Enumerated(EnumType.STRING)` | Luu enum dưới đang chuoi (không phải so) trong DB | status = 'SCHEDULED' |
| `@Builder.Default` | Đặt giá trị mac dinh khi đúng Builder pattern | `status = ShowtimeStatus.SCHEDULED` |
| `@PreAuthorize("hasRole('ADMIN')")` | Chi cho phep user co role ADMIN goi endpoint này | Tao/Sửa/Xoa suất chiếu |
| `@PageableDefault(size, sort, direction)` | Giá trị mac dinh cho phần trang | size=20, sort=createdAt DESC |
| `@Valid` | Kich hoat validation trên request DTO (@NotNull, @Min,...) | createShowtime(@Valid request) |
| `@Transactional` | Dam bao tất cả query trong method chay trong 1 transaction | createShowtime() |
| `@Transactional(readOnly = true)` | Toi uu cho method chi đọc (Hibernate không theo đôi thấy đôi) | listShowtimes() |
| `JpaSpecificationExecutor<T>` | Interface cho phep Repository đúng Specification de query | ShowtimeRepository |
| `Specification.where(null)` | Tao spec rộng (không co WHERE), làm điểm bắt đầu de ghép `.and()` | fromFilter() |
| `@Mapping(source, target)` | Bao MapStruct map tu field này sang field kia | movie.title -> movieTitle |
| `@Mapping(target, ignore=true)` | Bao MapStruct bộ qua field này (tu tinh trong code) | availableSeats |
| `@Query("JPQL...")` | Viet cau query JPQL tuy chinh trong Repository | findConflictingShowtimes |
| `BigDecimal.compareTo()` | So sánh 2 giá trị BigDecimal (không đúng được < >) | validatePriceHierarchy |

---

## 10. Câu hỏi tự kiểm tra

### Câu 1: Cong thuc kiểm tra 2 khoang thời gian giao nhau là gì?
**Tra loi:** [A, B] giao [C, D] khi `A < D AND C < B`. Trong code: `s.startTime < :endTime AND s.endTime > :startTime`.

### Câu 2: Tại sao khi UPDATE suất chiếu lai cần `conflicts.removeIf(s -> s.getId().equals(id))`?
**Tra loi:** Vì query `findConflictingShowtimes()` sẽ trả về chinh suất chiếu đang sửa (no "trung" với chinh no). Nếu không loại tru, mỗi lần update deu bao loi trung giờ -- không bao giờ sửa được.

### Câu 3: Tại sao buffer_minutes đọc tu SystemConfig thấy vì hardcode `15`?
**Tra loi:** De admin co the thấy đôi buffer ma không cần sửa code + rebuild + restart server. Ví dụ: het mua he, rap it người hon, admin giam buffer tu 15 -> 10 phút de xep được nhieu suất chiếu hon trong ngày.

### Câu 4: Nếu admin tạo suất chiếu với giá VIP = 50.000 và giá thuong = 75.000 thì điều gì xay ra?
**Tra loi:** Hệ thống throw `BusinessException(INVALID_REQUEST, "Gia VIP phai lon hon hoac bang gia thuong")` -- HTTP 400. Vì ghế VIP phải đặt hon ghế thường, không the re hon.

### Câu 5: Tại sao cần 2 DTO response (`ShowtimeListResponse` và `ShowtimeResponse`) thấy vì đúng 1 cai?
**Tra loi:** `ShowtimeListResponse` đúng cho danh sach (nhieu bạn ghi), không co `availableSeats` vì tinh ghế trong cần query thêm (ton performance). `ShowtimeResponse` đúng cho chi tiết (1 bạn ghi), co `availableSeats` và `movieDuration`. Day là nguyên tắc Interface Segregation -- không ep client nhan dữ liệu không cần.

### Câu 6: Suất chiếu đã co 3 người đặt vé. Admin muốn đôi giờ chiếu tu 14:00 sang 16:00. Co được không?
**Tra loi:** KHONG. Hệ thống kiểm tra `bookingRepository.countByShowtimeIdAndStatusIn(id, [HOLDING, CONFIRMED])` = 3 > 0, sẽ throw loi "Không the sửa suất chiếu đã co 3 về đặt". Admin phải huy tất cả booking trước hoặc tạo suất chiếu mới.

### Câu 7: Method `onDate(LocalDate date)` trong Specification filter thế nào? Tại sao không đúng `date.equals()`?
**Tra loi:** Vì `startTime` co kiểu `LocalDateTime` (ngày + giờ), con `date` chi là `LocalDate` (ngày). Không the so sánh trực tiếp. Phai chuyen sang khoang: `startTime >= ngay_do 00:00:00` AND `startTime < ngay_hom_sau 00:00:00`. Ví dụ ngày 25/05: `>= 2026-05-25 00:00` AND `< 2026-05-26 00:00`.

### Câu 8: MapStruct goi `showtime.getMovie().getTitle()` những Movie là LAZY. Dieu gì xay ra?
**Tra loi:** Khi goi `getMovie()`, Hibernate phát hiện Movie chua được load (vì LAZY), sẽ tu đồng chay 1 cau SELECT de lay Movie tu DB. Day goi là **lazy loading trigger**. O chi tiết (1 showtime) thì ok, những o danh sach (N showtime) thì mới showtime sẽ trigger 1 query Movie rieng -- day là **N+1 problem**. Cách fix: đúng `@EntityGraph` hoặc `JOIN FETCH` trong repository.

---

## 11. Bổ sung — Edge case Midnight (suất chiếu qua nửa đêm)

### Vấn đề
Admin tạo suất chiếu 23:30, phim dài 150 phút → endTime = 02:00 NGÀY HÔM SAU.

Câu hỏi:
- Overlap detection có chính xác không?
- Filter "suất chiếu ngày 24/05" có hiển thị suất 23:30 ngày 24 (kết thúc 02:00 ngày 25)?
- Filter ngày 25 có hiển thị suất này không?

### Kiểm tra overlap với midnight
Công thức gốc `A < D AND C < B` vẫn đúng với LocalDateTime vì so sánh datetime full (cả ngày + giờ).

Ví dụ:
- Suất A: 24/05 23:30 → 25/05 02:00 (3D Avengers)
- Suất B: 25/05 01:00 → 25/05 03:00 (phim khác cùng phòng)

```
A: 2026-05-24 23:30  →  2026-05-25 02:00
B: 2026-05-25 01:00  →  2026-05-25 03:00

A.start < B.end?  2026-05-24 23:30 < 2026-05-25 03:00 → TRUE
B.start < A.end?  2026-05-25 01:00 < 2026-05-25 02:00 → TRUE
→ Overlap detected → reject
```

Công thức vẫn chính xác xuyên ngày. **Không cần fix code**.

### Hiển thị suất theo ngày
Filter "ngày 24/05" thường lọc theo `startTime`:
```sql
WHERE startTime >= '2026-05-24 00:00:00'
  AND startTime <  '2026-05-25 00:00:00'
```

Suất 23:30 ngày 24 → hiển thị (start 24/05).

Suất 23:30 ngày 24 KHÔNG hiển thị ở filter ngày 25 dù kết thúc 02:00 ngày 25.

**Đây có thể là UX không mong muốn**: user xem lịch ngày 25, không biết có suất "rớt" từ đêm trước. Tùy nghiệp vụ:

**Option 1**: chỉ hiển thị theo startTime (đơn giản, hiện tại).
**Option 2**: hiển thị cả suất đang chiếu khi ngày bắt đầu:
```sql
WHERE startTime BETWEEN :dateStart AND :dateEnd
   OR (startTime < :dateStart AND endTime > :dateStart)
```

CineX khuyến nghị Option 1 vì rõ ràng và phù hợp thông thường (rạp ít chiếu xuyên đêm).

### Cảnh báo buffer time với midnight
Buffer 15 phút giữa 2 suất:
- Suất A: 24/05 23:30 → 25/05 02:00
- Cần khoảng nghỉ → suất B sớm nhất: 25/05 02:15

Code:
```java
LocalDateTime aEndWithBuffer = aEnd.plusMinutes(bufferMinutes);
// 2026-05-25 02:00 + 15 phút = 2026-05-25 02:15
// Kiểm tra bStart >= aEndWithBuffer
```

LocalDateTime tự handle ngày → không có lỗi xuyên ngày.

## 12. Bổ sung — Auto-update status SCHEDULED → ONGOING → FINISHED

Nghiệp vụ: status showtime tự cập nhật theo thời gian thực:
- `SCHEDULED`: chưa bắt đầu
- `ONGOING`: đang chiếu (now ∈ [startTime, endTime])
- `FINISHED`: đã kết thúc (now > endTime)

### Cách 1: Scheduler (đơn giản)
```java
@Component
@RequiredArgsConstructor
@Slf4j
public class ShowtimeStatusScheduler {

    private final ShowtimeRepository repository;

    @Scheduled(fixedRate = 60_000) // mỗi 1 phút
    @Transactional
    public void updateStatuses() {
        LocalDateTime now = LocalDateTime.now();

        // SCHEDULED → ONGOING
        int ongoing = repository.markOngoingByTime(now);
        // FINISHED
        int finished = repository.markFinishedByTime(now);

        if (ongoing > 0 || finished > 0) {
            log.info("Updated showtime status: {} ongoing, {} finished", ongoing, finished);
        }
    }
}
```

Repository:
```java
@Modifying
@Query("UPDATE Showtime s SET s.status = 'ONGOING' " +
       "WHERE s.status = 'SCHEDULED' AND s.startTime <= :now AND s.endTime > :now")
int markOngoingByTime(@Param("now") LocalDateTime now);

@Modifying
@Query("UPDATE Showtime s SET s.status = 'FINISHED' " +
       "WHERE s.status = 'ONGOING' AND s.endTime <= :now")
int markFinishedByTime(@Param("now") LocalDateTime now);
```

### Cách 2: Computed status (không cần scheduler)
KHÔNG lưu status trong DB. Tính runtime qua method:

```java
public ShowtimeStatus getCurrentStatus() {
    LocalDateTime now = LocalDateTime.now();
    if (now.isBefore(startTime)) return ShowtimeStatus.SCHEDULED;
    if (now.isAfter(endTime)) return ShowtimeStatus.FINISHED;
    return ShowtimeStatus.ONGOING;
}
```

**Pros**: không cần scheduler, không cần multi-instance lock.
**Cons**: không index được theo status, filter status phải scan.

CineX chọn **Cách 1** vì cần filter `WHERE status = 'ONGOING'` nhanh + reporting historical.

### Multi-instance cảnh báo
Nếu deploy 3 instance → 3 scheduler chạy song song → duplicate work. Dùng ShedLock (xem `backend/04-spring-features.md` mục 14).

## 13. Bổ sung — Cancel Showtime với side-effect

### Yêu cầu nghiệp vụ
Admin cancel suất chiếu → tất cả booking trong suất phải được hủy + refund.

### Service
```java
@Transactional
public void cancelShowtime(Long id, String reason) {
    Showtime showtime = showtimeRepository.findById(id)
        .orElseThrow(() -> new BusinessException(ErrorCode.SHOWTIME_NOT_FOUND));

    if (showtime.getStatus() == ShowtimeStatus.FINISHED) {
        throw new BusinessException(ErrorCode.SHOWTIME_ALREADY_FINISHED);
    }

    // 1. Đánh dấu cancel
    showtime.setStatus(ShowtimeStatus.CANCELLED);
    showtime.setCancelReason(reason);

    // 2. Lấy tất cả booking đang active
    List<Booking> activeBookings = bookingRepository.findByShowtimeIdAndStatusIn(
        id, List.of(BookingStatus.HOLDING, BookingStatus.CONFIRMED)
    );

    // 3. Refund từng booking
    for (Booking booking : activeBookings) {
        try {
            if (booking.getStatus() == BookingStatus.CONFIRMED) {
                // Đã thanh toán → refund 100% (admin cancel, không phải user)
                paymentService.refundFull(booking.getPayment().getId(),
                    "Admin cancel showtime: " + reason);
            }
            booking.setStatus(BookingStatus.CANCELLED);
            booking.getBookingSeats().forEach(bs -> bs.setStatus(SeatStatus.AVAILABLE));

            // 4. Notify user
            eventPublisher.publishEvent(new ShowtimeCancelledEvent(booking, reason));
        } catch (Exception e) {
            log.error("Refund failed for booking {}", booking.getBookingCode(), e);
        }
    }

    log.info("Cancelled showtime {} with {} bookings refunded", id, activeBookings.size());
}
```

### Endpoint
```java
@DeleteMapping("/admin/showtimes/{id}")
@PreAuthorize("hasRole('ADMIN')")
public ApiResponse<Void> cancel(@PathVariable Long id, @RequestParam String reason) {
    showtimeService.cancelShowtime(id, reason);
    return ApiResponse.success(null);
}
```

### Listener gửi notification
```java
@Async
@TransactionalEventListener(phase = AFTER_COMMIT)
public void onShowtimeCancelled(ShowtimeCancelledEvent event) {
    Booking booking = event.getBooking();
    String message = String.format(
        "Suất chiếu phim %s ngày %s đã bị hủy. Vé của bạn (%s) sẽ được hoàn tiền 100%%. Lý do: %s",
        booking.getShowtime().getMovie().getTitle(),
        booking.getShowtime().getStartTime().format(DT_FMT),
        booking.getBookingCode(),
        event.getReason()
    );
    notificationService.createNotification(booking.getUser().getId(), "Suất chiếu bị hủy", message, NotificationType.BOOKING);
    emailService.sendShowtimeCancelledEmail(booking.getUser().getEmail(), booking, event.getReason());
}
```

## 14. Refactor C2: Showtime → MovieRun (link bắt buộc)

### Bối cảnh

Trước đây, Showtime link trực tiếp tới Movie. Lifecycle "phim có chiếu ở rạp hay không" được suy ra từ `movie.releaseDate / movie.endDate / movie.status`. Pattern này KHÔNG mô tả được các scenario thực tế:

- Re-issue: Avatar 4K Remaster chiếu lại sau 17 năm. Movie chỉ có 1 dòng nhưng có 2 đợt chiếu cách nhau hàng chục năm.
- Festival: phim arthouse chiếu trong tuần lễ festival, xen kẽ với chiếu thương mại.
- Sneak preview: chiếu thử 1 vài suất trước release date chính thức.

→ Tách `Movie` (metadata bất biến: title, duration, director, ...) khỏi `MovieRun` (mỗi đợt chiếu có startDate/endDate/status riêng). Quan hệ: 1 Movie ↔ N MovieRun ↔ N Showtime.

### Thay đổi ở C2

| File | Thay đổi |
|---|---|
| `entity/Showtime.java` | Thêm `@ManyToOne MovieRun movieRun` (nullable=false). GIỮ field `movie` làm denormalized backup |
| `dto/ShowtimeRequest.java` | Thêm optional `movieRunId` — admin có thể chỉ định run cụ thể, hoặc để null cho service auto-pick |
| `service/ShowtimeService.java` | Thêm helper `resolveMovieRun()` + `validateShowtimeWithinMovieRun()` (thay cho `validateShowtimeWithinMovieLifecycle` cũ). Set CẢ `movie` và `movieRun` khi create/update để giữ invariant `showtime.movie == showtime.movieRun.movie` |
| `repository/ShowtimeRepository.java` | Thêm `existsByMovieRunIdAndStatusInAndStorageStateNot()` — dùng ở C4 (MovieRunService) để chặn xóa run khi còn showtime active |
| `db/changelog/changes/052-showtime-movie-run-not-null.xml` | Safety-net backfill + ALTER NOT NULL với precondition `sqlCheck` |

### Business rule mới (auto-pick MovieRun)

Khi admin tạo showtime mà không chỉ định `movieRunId`, ShowtimeService tự pick:

1. Lấy tất cả MovieRun của movie (chưa ARCHIVED).
2. Ưu tiên run đang `NOW_SHOWING`.
3. Fallback: run `SCHEDULED` có startDate sớm nhất.
4. Nếu KHÔNG có run nào active (vd: tất cả ENDED, hoặc movie mới tạo chưa có run) → throw `INVALID_REQUEST`: *"Phim X chưa có đợt chiếu nào active. Vui lòng tạo đợt chiếu (MovieRun) trước khi xếp suất."*

### Tại sao giữ `showtime.movie`?

Đây là **denormalized backup field** — không vi phạm chuẩn hóa nghiêm trọng vì là cache của `movieRun.getMovie()` (transitive).

Lý do giữ:
- **Backward compat**: ~15 file ở module khác (statistics, booking, review, payment, notification ...) đang đọc `showtime.movie.title / id / posterUrl`. Drop bây giờ sẽ break diện rộng.
- **Query optimization**: tránh JOIN qua `movie_runs` khi chỉ cần thông tin phim. SELECT `s JOIN movies` rẻ hơn `s JOIN movie_runs JOIN movies`.

Quy tắc bất biến: `showtime.movie == showtime.movieRun.movie`. Service đảm bảo điều này trong `createShowtime / updateShowtime` — set cùng lúc 2 field, không bao giờ tách rời. Có thể drop ở C5 sau khi audit hết các usage.

### Liquibase 052 strategy

- **Changeset 1 (backfill safety-net)**: idempotent UPDATE — chạy trên các row có `movie_run_id IS NULL` (thường 0 row vì 051 đã backfill). Phòng trường hợp app cũ tạo showtime mới trong khoảng giữa 051 và 052.
- **Changeset 2 (NOT NULL)**: dùng `preConditions onFail="MARK_RAN"` với `sqlCheck` count `movie_run_id IS NULL`. Nếu vẫn còn NULL (data rác) → MARK_RAN + warning thay vì HALT, để không block deploy. Admin fix tay rồi rerun.

### Risk

- **Mismatch invariant**: nếu code khác trong tương lai set `showtime.movie` mà quên set `movieRun` (hoặc ngược lại) → 2 field lệch. Đã được bảo vệ tạm bằng cách buộc qua service. Khi drop `movie` ở C5, risk này biến mất.
- **MovieRun ENDED khi showtime SCHEDULED**: nếu MovieRunStatusScheduler (sẽ làm ở C3) đẩy run sang ENDED khi đến endDate, mà còn showtime SCHEDULED chưa chiếu → cần xử lý ở C3/C4 (vd: cảnh báo admin trước khi auto-end).

## 15. Cảnh báo về mất dấu tiếng Việt trong file gốc

Phần lớn nội đúng mục 1-10 của file này (`08-showtime-explained.md`) đang **MẤT DẤU tiếng Việt** ("Tổng quan" thấy vì "Tổng quan", "Sơ đồ" thấy vì "Sơ đồ"). Đây là vì phạm rule trong `CLAUDE.md`.

Phần bổ sung mục 11-13 (bạn đang đọc) tuân thủ rule có dấu. Khi rảnh, nên audit lại các mục 1-10 để khôi phục dấu cho consistent.
