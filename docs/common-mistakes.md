# 10 lỗi hay gặp khi code CineX + cách fix

## 1. Trả Entity thẳng cho client → LỘ PASSWORD

```java
// ❌ SAI
@GetMapping("/me")
public User getProfile() {
    return userRepository.findById(userId);
    // Response chứa: password hash, version, storageState, ...
}

// ✅ ĐÚNG — dùng DTO
@GetMapping("/me")
public UserProfileResponse getProfile() {
    return userMapper.toProfileResponse(user);
    // Response chỉ có: id, username, email, fullName, role
}
```

**Quy tắc:** KHÔNG BAO GIỜ trả entity cho client. Luôn dùng Response DTO.

---

## 2. @ManyToOne fetch = EAGER → N+1 query

```java
// ❌ SAI — load Room cho MỖI seat khi list
@ManyToOne(fetch = FetchType.EAGER)
private Room room;
// List 120 ghế = 1 query seats + 120 query rooms = 121 queries!

// ✅ ĐÚNG — LAZY, chỉ query Room khi cần
@ManyToOne(fetch = FetchType.LAZY)
private Room room;
// List 120 ghế = 1 query seats
// Gọi seat.getRoom() mới query Room (chỉ khi cần)
```

**Quy tắc:** @ManyToOne, @ManyToMany luôn dùng `LAZY`.

---

## 3. Thiếu @Transactional → data không nhất quán

```java
// ❌ SAI — không có @Transactional
public void holdSeats(request) {
    bookingRepository.save(booking);    // Bước 1: OK
    bookingSeatRepository.save(seat1);  // Bước 2: OK
    bookingSeatRepository.save(seat2);  // Bước 3: LỖI!
    // → Booking tạo rồi nhưng seat2 chưa tạo → data bất nhất quán!
}

// ✅ ĐÚNG — @Transactional: tất cả hoặc không
@Transactional
public void holdSeats(request) {
    bookingRepository.save(booking);
    bookingSeatRepository.save(seat1);
    bookingSeatRepository.save(seat2);  // LỖI → rollback TẤT CẢ → sạch sẽ
}
```

**Quy tắc:** Method nào ghi DB (save, update, delete) → phải có @Transactional.

---

## 4. Filter soft delete bằng Java thay vì SQL

```java
// ❌ SAI — load TẤT CẢ rồi filter bằng Java
public List<Room> listRooms() {
    return roomRepository.findAll().stream()
        .filter(r -> !"DELETED".equals(r.getStorageState()))
        .toList();
    // 10.000 rows → load hết → bỏ 9.900 → lãng phí!
}

// ✅ ĐÚNG — filter ở SQL, DB chỉ trả row cần
public Page<Room> listRooms(RoomFilter filter, Pageable pageable) {
    var spec = RoomSpecification.fromFilter(filter);
    return roomRepository.findAll(spec, pageable);
    // SQL: WHERE storage_state <> 'DELETED' → DB trả 100 rows
}
```

**Quy tắc:** Filter, search, sort luôn làm ở SQL (Specification), không load hết rồi xử lý Java.

---

## 5. Sửa Liquibase changeset đã chạy → checksum error

```
Lỗi: Validation Failed: checksum mismatch for changeset 001

Nguyên nhân: Sửa file 001-create-users-table.xml sau khi đã chạy
Liquibase tính lại MD5SUM → khác với DB → lỗi

Fix: KHÔNG sửa file cũ → tạo changeset MỚI
     Hoặc: UPDATE DATABASECHANGELOG SET MD5SUM = NULL WHERE ID = '001'
```

**Quy tắc:** Changeset đã chạy = bất khả xâm phạm. Muốn thay đổi → tạo changeset mới.

---

## 6. Quên @EnableMethodSecurity → @PreAuthorize vô tác dụng

```java
// ❌ SAI — thiếu @EnableMethodSecurity
@Configuration
@EnableWebSecurity
public class SecurityConfig { ... }

// @PreAuthorize("hasRole('ADMIN')") → BỊ BỎ QUA → user thường gọi API admin → LỖ HỔNG!

// ✅ ĐÚNG
@Configuration
@EnableWebSecurity
@EnableMethodSecurity    // ← PHẢI CÓ
public class SecurityConfig { ... }
```

---

## 7. Check unique khi UPDATE → báo trùng với chính nó

```java
// ❌ SAI — giữ nguyên tên "Room 1" → existsByName("Room 1") = true → báo lỗi sai!
public void updateRoom(Long id, RoomRequest request) {
    if (roomRepository.existsByName(request.getName())) {
        throw new BusinessException(ErrorCode.ROOM_EXISTED);
    }
}

// ✅ ĐÚNG — kiểm tra tên có ĐỔI không trước
public void updateRoom(Long id, RoomRequest request) {
    Room room = roomRepository.findById(id);
    if (!room.getName().equals(request.getName())    // Tên đổi?
        && roomRepository.existsByName(request.getName())) {  // Tên mới bị trùng?
        throw new BusinessException(ErrorCode.ROOM_EXISTED);
    }
}
```

---

## 8. YAML duplicate key → crash khi start

```yaml
# ❌ SAI — 2 lần "spring:" → DuplicateKeyException
spring:
  profiles:
    active: dev

spring:                    # ← TRÙNG KEY!
  servlet:
    multipart:
      max-file-size: 5MB

# ✅ ĐÚNG — gộp vào 1 block
spring:
  profiles:
    active: dev
  servlet:
    multipart:
      max-file-size: 5MB
```

---

## 9. Lombok @Builder bỏ qua giá trị mặc định

```java
// ❌ SAI — @Builder bỏ qua default value
@Builder
public class Room {
    private RoomStatus status = RoomStatus.ACTIVE;
}
Room.builder().name("Room 1").build();  // status = NULL!

// ✅ ĐÚNG — thêm @Builder.Default
@Builder
public class Room {
    @Builder.Default
    private RoomStatus status = RoomStatus.ACTIVE;
}
Room.builder().name("Room 1").build();  // status = ACTIVE ✅
```

---

## 10. GlobalExceptionHandler không log → bug biến mất

```java
// ❌ SAI — exception bị nuốt, không log
@ExceptionHandler(Exception.class)
public ResponseEntity<ApiResponse<Void>> handleGeneral(Exception ex) {
    return ResponseEntity.status(500).body(ApiResponse.error("Unexpected error"));
    // Không biết lỗi gì, ở đâu, stack trace nào → không debug được!
}

// ✅ ĐÚNG — log stack trace
@ExceptionHandler(Exception.class)
public ResponseEntity<ApiResponse<Void>> handleGeneral(Exception ex) {
    log.error("Unexpected error", ex);   // ← Log đầy đủ stack trace
    return ResponseEntity.status(500).body(ApiResponse.error("Unexpected error"));
}
```
