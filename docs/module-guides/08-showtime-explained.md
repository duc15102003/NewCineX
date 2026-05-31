# Module Showtime -- Giai thich chi tiet

## 1. Tong quan

### Module nay lam gi?

Module Showtime quan ly **suat chieu phim** -- tuc la "phim nao chieu o phong nao, ngay gio nao, gia ve bao nhieu". Day la module trung tam noi **Movie** (phim) voi **Room** (phong), tao ra lich chieu de nguoi dung dat ve.

### Vi du doi thuong

Hay tuong tuong ban la quan ly rap phim. Moi sang ban phai:
1. Chon phim nao chieu hom nay (VD: "Avengers" dai 150 phut)
2. Chon phong chieu (VD: "Phong IMAX")
3. Chon gio bat dau (VD: 14:00)
4. He thong tu tinh gio ket thuc: 14:00 + 150 phut phim + 15 phut don phong = 16:45
5. He thong kiem tra: phong IMAX co trong tu 14:00 den 16:45 khong?
6. Dat gia ve: thuong 75.000d, VIP 100.000d, doi 150.000d

### Bai toan chinh

| Bai toan | Mo ta | Do kho |
|---|---|---|
| Tinh `endTime` tu dong | `startTime + movie.duration + buffer` (buffer doc tu DB, khong hardcode) | Trung binh |
| Kiem tra trung gio | 2 suat chieu khong duoc chong thoi gian trong cung 1 phong | Kho |
| Validate gia ve | Gia thuong <= VIP <= doi (business rule) | De |
| Khong sua suat da co ve | Neu da co nguoi dat ve thi khong duoc sua suat chieu | Trung binh |
| Filter da dieu kien | Loc theo movieId, roomId, ngay, trang thai (dong thoi hoac rieng le) | Trung binh |

---

## 2. Danh sach files da tao

| File | Tac dung | Design Pattern |
|---|---|---|
| `entity/Showtime.java` | Entity JPA, quan he @ManyToOne voi Movie va Room | Inheritance (BaseEntity) |
| `entity/ShowtimeStatus.java` | Enum trang thai: SCHEDULED, ONGOING, FINISHED, CANCELLED | Enum Pattern |
| `dto/ShowtimeFilter.java` | Nhan params filter tu FE: movieId, roomId, date, status | Filter DTO |
| `dto/ShowtimeRequest.java` | DTO nhan du lieu tao/sua suat chieu, co validation | DTO + Validation |
| `dto/ShowtimeResponse.java` | DTO tra chi tiet (movie info, room info, prices, availableSeats) | DTO + Builder |
| `dto/ShowtimeListResponse.java` | DTO rut gon cho danh sach (khong co availableSeats) | DTO + Builder |
| `repository/ShowtimeRepository.java` | JpaSpecificationExecutor + method kiem tra trung gio | Repository |
| `specification/ShowtimeSpecification.java` | Build query WHERE dong tu filter | Specification Pattern |
| `mapper/ShowtimeMapper.java` | MapStruct chuyen Showtime -> DTO, map nested fields | Mapper (MapStruct) |
| `service/ShowtimeService.java` | CRUD + check trung gio + tinh endTime + validate gia | Service Layer |
| `controller/ShowtimeController.java` | 8 endpoints REST (CRUD + bulk + restore) | Controller Layer |

---

## 3. Design Patterns chi tiet

### 3.1 Specification Pattern (Behavioral)

#### Pattern nay la gi?

Specification Pattern cho phep **xay dung cau truy van WHERE dong** -- tuc la tuy thuoc vao nguoi dung gui gi len, he thong se tu ghep cac dieu kien loc lai voi nhau.

#### Vi du doi thuong

Tuong tuong ban vao trang Shopee tim ao:
- Chi chon "ao thun" -> WHERE category = 'ao_thun'
- Them chon "mau den" -> WHERE category = 'ao_thun' AND color = 'den'
- Them chon "gia duoi 200k" -> WHERE category = 'ao_thun' AND color = 'den' AND price < 200000

Moi lan ban tick them 1 bo loc, he thong **ghep them** 1 dieu kien AND. Do chinh la Specification Pattern.

#### Ap dung o dau trong code?

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

Moi method nhu `hasMovie()`, `hasRoom()`, `onDate()` tra ve 1 "manh" dieu kien. Method `fromFilter()` ghep cac manh lai = `.and()`.

#### Tai sao dung pattern nay?

**KHONG dung Specification (code xau):**
```java
// Phai viet N method cho moi to hop filter
List<Showtime> findByMovieId(Long movieId);
List<Showtime> findByMovieIdAndRoomId(Long movieId, Long roomId);
List<Showtime> findByMovieIdAndDate(Long movieId, LocalDate date);
List<Showtime> findByMovieIdAndRoomIdAndDate(Long movieId, Long roomId, LocalDate date);
// ... 2^4 = 16 to hop voi 4 filter -> BUNG NO!
```

**CO dung Specification (code tot):**
```java
// Chi can 1 method duy nhat
Page<Showtime> findAll(Specification<Showtime> spec, Pageable pageable);
// FE gui gi len -> tu dong ghep dieu kien -> 1 query duy nhat
```

#### Khi nao KHONG nen dung?

- Khi chi co 1-2 filter co dinh (VD: `findByUsername`) -> dung Spring Data method naming don gian hon.
- Khi query qua phuc tap (nhieu JOIN, subquery) -> dung `@Query` JPQL hoac native SQL.

---

### 3.2 Overlap Detection -- Kiem tra trung gio (Thuat toan)

#### Bai toan

Trong 1 phong chieu, 2 suat chieu **khong duoc chong thoi gian**. Vi du phong IMAX dang co suat 14:00-16:30, thi khong the tao suat 15:00-17:00 vi chung "de len nhau".

#### Cong thuc kinh dien

Cho 2 khoang thoi gian:
- Khoang 1: [A, B] (suat cu: A = startTime, B = endTime)
- Khoang 2: [C, D] (suat moi: C = startTime, D = endTime)

```
HAI KHOANG GIAO NHAU KHI VA CHI KHI:  A < D  AND  C < B
```

Cong thuc nay **rat ngan gon** nhung nhieu nguoi nham. Hay hieu theo huong nguoc lai:

```
HAI KHOANG KHONG GIAO NHAU KHI:  B <= C  HOAC  D <= A
   (khoang 1 ket thuc truoc khi khoang 2 bat dau, hoac nguoc lai)

=> GIAO NHAU = PHU DINH cua KHONG GIAO NHAU
   = NOT (B <= C OR D <= A)
   = B > C AND D > A
   = A < D AND C < B  (doi vi tri)
```

#### Minh hoa bang hinh

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

#### Ap dung trong code

File: `repository/ShowtimeRepository.java`

```java
@Query("SELECT s FROM Showtime s WHERE s.room.id = :roomId " +
        "AND s.startTime < :endTime AND s.endTime > :startTime " +   // <-- Cong thuc A < D AND C < B
        "AND (s.storageState IS NULL OR s.storageState <> 'DELETED') " +  // Bo qua suat da xoa
        "AND s.status <> 'CANCELLED'")                                     // Bo qua suat da huy
List<Showtime> findConflictingShowtimes(Long roomId, LocalDateTime startTime, LocalDateTime endTime);
```

Giai thich tung dong:
- `s.room.id = :roomId` -- Chi kiem tra trong **cung phong** (phong khac thi khong can check)
- `s.startTime < :endTime` -- Suat cu bat dau truoc khi suat moi ket thuc (dieu kien A < D)
- `s.endTime > :startTime` -- Suat cu ket thuc sau khi suat moi bat dau (dieu kien C < B)
- `storageState <> 'DELETED'` -- Bo qua suat da xoa mem
- `status <> 'CANCELLED'` -- Bo qua suat da huy (phong da free)

**Luu y quan trong khi UPDATE:** Khi sua suat chieu, phai **loai tru chinh no** ra khoi danh sach conflict. Neu khong, suat chieu se tu "trung" voi chinh minh:

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

### 3.3 Buffer ve sinh phong (Cau hinh dong tu SystemConfig)

#### Bai toan

Sau khi phim ket thuc, nhan vien can thoi gian de:
- Don dep rac, nuoc uong con sot
- Kiem tra ghe hu
- Chuan bi cho luot khan gia tiep theo

=> Can **cong them** thoi gian buffer vao endTime.

#### Tai sao KHONG hardcode?

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

#### Cach tinh endTime chi tiet

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

#### SystemConfigService hoat dong the nao?

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

- Khi server khoi dong: doc TAT CA config tu DB vao `ConcurrentHashMap` (cache trong RAM)
- Khi can doc config: doc tu RAM (cuc nhanh, khong can query DB moi lan)
- Khi admin sua config: ghi vao DB + cap nhat RAM cung luc
- Default value: neu key khong ton tai trong DB, tra ve gia tri mac dinh (tham so thu 2)

---

### 3.4 Validate gia ve -- Business Rule

#### Quy tac

```
Gia thuong (base)  <=  Gia VIP  <=  Gia doi (couple)
```

#### Tai sao co quy tac nay?

- **Ghe thuong**: ghe binh dan, vi tri binh thuong -> gia re nhat
- **Ghe VIP**: ghe rong hon, vi tri tot hon (giua phong, hang giua) -> dat hon ghe thuong
- **Ghe doi**: 2 ghe lien nhau (danh cho cap doi), co tay vin chung -> dat nhat (vi 2 nguoi ngoi)

Neu admin nhap gia VIP = 50.000 nhung gia thuong = 75.000 -> **vo ly** (VIP ma re hon thuong?) -> he thong bao loi.

#### Ap dung trong code

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

**Tai sao dung `compareTo()` thay vi `<` ?**
Vi `basePrice` co kieu `BigDecimal`, khong phai `int`/`long`. Trong Java, `BigDecimal` khong ho tro toan tu `<`, `>` truc tiep. Phai dung `compareTo()`:
- `a.compareTo(b) < 0` => a nho hon b
- `a.compareTo(b) == 0` => a bang b
- `a.compareTo(b) > 0` => a lon hon b

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

Nhung DTO `ShowtimeResponse` lai co cac field **phang** (flat):
```java
private String movieTitle;      // Khong phai Movie object
private String roomName;        // Khong phai Room object
private String roomType;
```

=> Can bao MapStruct: "lay `movie.title` gan vao `movieTitle`".

#### Ap dung trong code

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

#### MapStruct sinh code gi?

Khi build (`./gradlew build`), MapStruct **tu dong sinh** file `ShowtimeMapperImpl.java`:

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

**Luu y ve Lazy Loading:**
- Movie va Room deu dung `fetch = FetchType.LAZY` -> khi goi `showtime.getMovie()`, Hibernate se chay 1 query SELECT rieng de lay Movie.
- Day KHONG phai N+1 problem vi moi request chi xu ly 1 showtime (trong `getShowtime()`). Nhung o `listShowtimes()` thi co the gap N+1 -- moi showtime trong trang se trigger 1 query Movie va 1 query Room.
- Cach fix N+1 (neu can toi uu): dung `@EntityGraph` hoac `JOIN FETCH` trong repository.

---

### 3.6 DTO Pattern -- 2 Response cho 2 muc dich

#### Tai sao can 2 DTO response?

| | `ShowtimeListResponse` | `ShowtimeResponse` |
|---|---|---|
| Dung cho | Danh sach (GET /api/showtimes) | Chi tiet (GET /api/showtimes/{id}) |
| Co `availableSeats`? | Khong | Co |
| Co `movieDuration`? | Khong | Co |
| Ly do | Danh sach khong can tinh ghe trong (ton query) | Chi tiet can hien thi ghe trong |

**Nguyen tac: Interface Segregation** -- Khong ep client nhan du lieu khong can. Danh sach chi can thong tin co ban de hien thi bang (table), chi tiet moi can day du.

---

## 4. So do luong xu ly chi tiet

### 4.1 Tao suat chieu (POST /api/showtimes)

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

### 4.2 Sua suat chieu (PUT /api/showtimes/{id})

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

**Tai sao xoa mem (soft delete)?**
- Neu xoa that (DELETE FROM) -> mat du lieu vinh vien, khong the khoi phuc
- Xoa mem = dat co "da xoa" -> khi query thi bo qua (WHERE storage_state <> 'ARCHIVED')
- Admin co the "khoi phuc" bat cu luc nao (POST /api/showtimes/{id}/restore)
- Du lieu van con trong DB de bao cao, thong ke

### 4.4 Danh sach voi filter (GET /api/showtimes?movieId=1&date=2026-05-25)

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

## 5. MapStruct Mapping Nested Fields -- Chi tiet

### Van de cot loi

Trong DB, bang `showtimes` chi luu `movie_id` (so) va `room_id` (so). Nhung FE can hien thi **ten phim**, **ten phong** -- khong phai ID.

### Cach MapStruct giai quyet

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

## 6. SQL duoc sinh ra cho tung operation

### 6.1 Danh sach suat chieu (filter movieId + date)

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

### 6.2 Chi tiet suat chieu (GET /api/showtimes/5)

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

### 6.3 Kiem tra trung gio (khi tao/sua suat chieu)

```sql
-- Tim suat chieu xung dot trong phong 2, khoang 14:00-16:45
SELECT s.* FROM showtimes s
WHERE s.room_id = 2
  AND s.start_time < '2026-05-25 16:45:00'       -- Suat cu bat dau truoc khi suat moi ket thuc
  AND s.end_time > '2026-05-25 14:00:00'          -- Suat cu ket thuc sau khi suat moi bat dau
  AND (s.storage_state IS NULL OR s.storage_state <> 'DELETED')
  AND s.status <> 'CANCELLED';

-- Neu tra ve 0 dong -> khong trung -> cho phep tao
-- Neu tra ve >= 1 dong -> trung gio -> throw SHOWTIME_CONFLICT
```

### 6.4 Tao suat chieu (INSERT)

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

### 6.5 Sua suat chieu (UPDATE)

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

## 7. Cau hinh dong (SystemConfig)

### Cac config lien quan den module Showtime

| Key | Gia tri mac dinh | Mo ta | Ai thay doi? |
|---|---|---|---|
| `showtime.buffer_minutes` | `15` | So phut don dep phong giua 2 suat chieu | Admin (trang Config) |
| `booking.cutoff_after_start_minutes` | `15` | Sau khi phim bat dau bao nhieu phut thi khong cho dat ve nua | Admin (trang Config) |

### Cach hoat dong

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

### Tai sao dung ConcurrentHashMap?

- `HashMap` binh thuong **khong an toan** khi nhieu thread doc/ghi dong thoi (multi-thread) -> co the bi loi data
- `ConcurrentHashMap` duoc thiet ke cho multi-thread -> nhieu request doc cung luc van an toan
- Server web xu ly nhieu request song song (moi request = 1 thread) -> bat buoc dung ConcurrentHashMap

---

## 8. Request/Response mau

### 8.1 Danh sach suat chieu (PUBLIC -- khong can dang nhap)

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

### 8.2 Chi tiet suat chieu (PUBLIC)

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

### 8.3 Tao suat chieu (ADMIN -- can JWT)

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

### 8.4 Loi: Trung gio (409 Conflict)

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
  "errorCode": "SHOWTIME_CONFLICT"
}
```

### 8.5 Loi: Gia VIP nho hon gia thuong (400)

```json
{
  "success": false,
  "message": "Gia VIP phai lon hon hoac bang gia thuong",
  "errorCode": "INVALID_REQUEST"
}
```

### 8.6 Loi: Sua suat chieu da co ve dat (400)

```json
{
  "success": false,
  "message": "Khong the sua suat chieu da co 3 ve dat",
  "errorCode": "INVALID_REQUEST"
}
```

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

### 8.8 Khoi phuc suat da xoa (ADMIN)

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

### 8.9 Xoa nhieu suat cung luc (Bulk delete -- ADMIN)

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

## 9. Annotation va API moi su dung

| Annotation / API | Tac dung | Vi du |
|---|---|---|
| `@ManyToOne(fetch = LAZY)` | Quan he nhieu-mot, chi load khi goi getter (tiet kiem query) | Showtime -> Movie |
| `@JoinColumn(name, nullable)` | Chi dinh ten cot khoa ngoai trong DB | `@JoinColumn(name = "movie_id")` |
| `@Enumerated(EnumType.STRING)` | Luu enum duoi dang chuoi (khong phai so) trong DB | status = 'SCHEDULED' |
| `@Builder.Default` | Dat gia tri mac dinh khi dung Builder pattern | `status = ShowtimeStatus.SCHEDULED` |
| `@PreAuthorize("hasRole('ADMIN')")` | Chi cho phep user co role ADMIN goi endpoint nay | Tao/Sua/Xoa suat chieu |
| `@PageableDefault(size, sort, direction)` | Gia tri mac dinh cho phan trang | size=20, sort=createdAt DESC |
| `@Valid` | Kich hoat validation tren request DTO (@NotNull, @Min,...) | createShowtime(@Valid request) |
| `@Transactional` | Dam bao tat ca query trong method chay trong 1 transaction | createShowtime() |
| `@Transactional(readOnly = true)` | Toi uu cho method chi doc (Hibernate khong theo doi thay doi) | listShowtimes() |
| `JpaSpecificationExecutor<T>` | Interface cho phep Repository dung Specification de query | ShowtimeRepository |
| `Specification.where(null)` | Tao spec rong (khong co WHERE), lam diem bat dau de ghep `.and()` | fromFilter() |
| `@Mapping(source, target)` | Bao MapStruct map tu field nay sang field kia | movie.title -> movieTitle |
| `@Mapping(target, ignore=true)` | Bao MapStruct bo qua field nay (tu tinh trong code) | availableSeats |
| `@Query("JPQL...")` | Viet cau query JPQL tuy chinh trong Repository | findConflictingShowtimes |
| `BigDecimal.compareTo()` | So sanh 2 gia tri BigDecimal (khong dung duoc < >) | validatePriceHierarchy |

---

## 10. Cau hoi tu kiem tra

### Cau 1: Cong thuc kiem tra 2 khoang thoi gian giao nhau la gi?
**Tra loi:** [A, B] giao [C, D] khi `A < D AND C < B`. Trong code: `s.startTime < :endTime AND s.endTime > :startTime`.

### Cau 2: Tai sao khi UPDATE suat chieu lai can `conflicts.removeIf(s -> s.getId().equals(id))`?
**Tra loi:** Vi query `findConflictingShowtimes()` se tra ve chinh suat chieu dang sua (no "trung" voi chinh no). Neu khong loai tru, moi lan update deu bao loi trung gio -- khong bao gio sua duoc.

### Cau 3: Tai sao buffer_minutes doc tu SystemConfig thay vi hardcode `15`?
**Tra loi:** De admin co the thay doi buffer ma khong can sua code + rebuild + restart server. Vi du: het mua he, rap it nguoi hon, admin giam buffer tu 15 -> 10 phut de xep duoc nhieu suat chieu hon trong ngay.

### Cau 4: Neu admin tao suat chieu voi gia VIP = 50.000 va gia thuong = 75.000 thi dieu gi xay ra?
**Tra loi:** He thong throw `BusinessException(INVALID_REQUEST, "Gia VIP phai lon hon hoac bang gia thuong")` -- HTTP 400. Vi ghe VIP phai dat hon ghe thuong, khong the re hon.

### Cau 5: Tai sao can 2 DTO response (`ShowtimeListResponse` va `ShowtimeResponse`) thay vi dung 1 cai?
**Tra loi:** `ShowtimeListResponse` dung cho danh sach (nhieu ban ghi), khong co `availableSeats` vi tinh ghe trong can query them (ton performance). `ShowtimeResponse` dung cho chi tiet (1 ban ghi), co `availableSeats` va `movieDuration`. Day la nguyen tac Interface Segregation -- khong ep client nhan du lieu khong can.

### Cau 6: Suat chieu da co 3 nguoi dat ve. Admin muon doi gio chieu tu 14:00 sang 16:00. Co duoc khong?
**Tra loi:** KHONG. He thong kiem tra `bookingRepository.countByShowtimeIdAndStatusIn(id, [HOLDING, CONFIRMED])` = 3 > 0, se throw loi "Khong the sua suat chieu da co 3 ve dat". Admin phai huy tat ca booking truoc hoac tao suat chieu moi.

### Cau 7: Method `onDate(LocalDate date)` trong Specification filter the nao? Tai sao khong dung `date.equals()`?
**Tra loi:** Vi `startTime` co kieu `LocalDateTime` (ngay + gio), con `date` chi la `LocalDate` (ngay). Khong the so sanh truc tiep. Phai chuyen sang khoang: `startTime >= ngay_do 00:00:00` AND `startTime < ngay_hom_sau 00:00:00`. Vi du ngay 25/05: `>= 2026-05-25 00:00` AND `< 2026-05-26 00:00`.

### Cau 8: MapStruct goi `showtime.getMovie().getTitle()` nhung Movie la LAZY. Dieu gi xay ra?
**Tra loi:** Khi goi `getMovie()`, Hibernate phat hien Movie chua duoc load (vi LAZY), se tu dong chay 1 cau SELECT de lay Movie tu DB. Day goi la **lazy loading trigger**. O chi tiet (1 showtime) thi ok, nhung o danh sach (N showtime) thi moi showtime se trigger 1 query Movie rieng -- day la **N+1 problem**. Cach fix: dung `@EntityGraph` hoac `JOIN FETCH` trong repository.
