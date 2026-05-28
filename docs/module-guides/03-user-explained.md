# Module User — Giải thích chi tiết

## 1. Tổng quan
Module User quản lý **thông tin cá nhân** của user đã đăng nhập và **phân quyền** cho admin.

**Bài toán giải quyết:**
- User muốn xem/sửa profile, đổi mật khẩu, upload avatar
- Admin muốn xem danh sách user và đổi role (USER ↔ ADMIN)
- Bảo mật: user chỉ sửa được profile **của chính mình**, không ai khác

## 2. Danh sách files đã tạo/sửa

| File | Tác dụng | Design Pattern |
|---|---|---|
| `module/user/dto/UserProfileResponse.java` | DTO trả thông tin profile | DTO Pattern |
| `module/user/dto/UpdateProfileRequest.java` | DTO nhận dữ liệu cập nhật profile | DTO Pattern |
| `module/user/dto/ChangePasswordRequest.java` | DTO nhận dữ liệu đổi mật khẩu | DTO Pattern |
| `module/user/dto/UpdateRoleRequest.java` | DTO nhận role mới (ADMIN only) | DTO Pattern |
| `module/user/mapper/UserMapper.java` | Chuyển User entity → DTO tự động | Mapper (MapStruct) |
| `module/user/service/UserService.java` | Business logic: CRUD profile, đổi pass, upload avatar | Service Layer |
| `module/user/controller/UserController.java` | 6 REST endpoints | Controller |
| `common/config/CloudinaryConfig.java` | Cấu hình kết nối Cloudinary | Configuration |
| `common/service/FileUploadService.java` | Upload ảnh lên Cloudinary | Single Responsibility |
| `common/exception/ErrorCode.java` | Thêm INVALID_PASSWORD, INVALID_FILE | Enum |
| `common/config/SecurityConfig.java` | Thêm `@EnableMethodSecurity` | — |
| `application.yml` | Thêm config Cloudinary + multipart | — |

## 3. Design Patterns đã áp dụng

### 3.1 Mapper Pattern (MapStruct)
- **Nhóm:** Structural
- **Ví dụ đời thường:** Như một phiên dịch viên — bạn nói tiếng Việt (Entity), phiên dịch viên tự động dịch sang tiếng Anh (DTO) mà bạn không cần biết quy trình dịch.

**Áp dụng ở đâu:** `module/user/mapper/UserMapper.java`

```java
@Mapper(componentModel = "spring")
public interface UserMapper {
    UserProfileResponse toProfileResponse(User user);
}
```

**Tại sao dùng MapStruct?**
MapStruct sinh code **lúc compile** (không dùng reflection lúc runtime) → nhanh hơn và an toàn hơn.

**So sánh KHÔNG dùng MapStruct vs CÓ dùng:**

```java
// ❌ KHÔNG dùng MapStruct — viết tay, dễ quên field khi thêm mới
public UserProfileResponse toResponse(User user) {
    return UserProfileResponse.builder()
        .id(user.getId())
        .username(user.getUsername())
        .email(user.getEmail())
        .fullName(user.getFullName())
        .phone(user.getPhone())
        .avatarUrl(user.getAvatarUrl())
        .role(user.getRole())
        .createdAt(user.getCreatedAt())
        .build();
}

// ✅ CÓ dùng MapStruct — chỉ khai báo, MapStruct tự sinh code ở trên
@Mapper(componentModel = "spring")
public interface UserMapper {
    UserProfileResponse toProfileResponse(User user);
}
```

**Khi nào KHÔNG nên dùng MapStruct?**
- Khi mapping phức tạp có logic (tính toán, điều kiện) → viết tay rõ ràng hơn
- Khi chỉ có 1-2 field → overhead không đáng

### 3.2 DTO Pattern (Data Transfer Object)
- **Nhóm:** Structural
- **Ví dụ đời thường:** Khi đi khám bệnh, bạn không đưa hết hồ sơ bệnh án cho bác sĩ mà chỉ đưa **phiếu tóm tắt** chứa thông tin cần thiết.

**Tại sao cần DTO?**
Entity `User` có field `password` — nếu trả thẳng entity cho client → **LỘ MẬT KHẨU**!

```java
// ❌ NGUY HIỂM: trả entity thẳng → client nhận được password hash
return ApiResponse.ok(user);

// ✅ AN TOÀN: trả DTO → chỉ có các field được phép
return ApiResponse.ok(userMapper.toProfileResponse(user));
```

### 3.3 Method-Level Security (@PreAuthorize)
- **Nhóm:** Cross-cutting (Security)
- **Ví dụ đời thường:** Như bảo vệ tòa nhà — tầng 1 ai cũng vào được (public API), nhưng tầng VIP phải có thẻ đặc biệt (ADMIN role).

**Áp dụng ở đâu:** `UserController.java`

```java
@GetMapping
@PreAuthorize("hasRole('ADMIN')")  // Chỉ ADMIN mới gọi được
public ApiResponse<PageResponse<UserProfileResponse>> listUsers(...) { ... }
```

**Luồng hoạt động:**
1. Spring Security đã xác thực JWT → biết user là ai + role gì
2. `@PreAuthorize("hasRole('ADMIN')")` kiểm tra role TRƯỚC KHI vào method
3. Nếu không phải ADMIN → Spring tự trả 403 Forbidden, method KHÔNG được gọi

**Để @PreAuthorize hoạt động, cần bật:**
```java
@EnableMethodSecurity  // Thêm vào SecurityConfig.java
```

## 4. Sơ đồ luồng xử lý

### Luồng: User xem profile
```
Client (GET /api/users/me)
  │
  ├─► JwtAuthFilter: Extract token → validate → set SecurityContext
  │
  ├─► SecurityConfig: URL /api/users/** cần authenticated ✓
  │
  ├─► UserController.getProfile()
  │       │
  │       └─► UserService.getProfile()
  │               │
  │               ├─► SecurityUtil.getCurrentUsername() → "vanan"
  │               │
  │               ├─► UserRepository.findByUsername("vanan") → User entity
  │               │
  │               └─► UserMapper.toProfileResponse(user) → UserProfileResponse DTO
  │
  └─► ApiResponse.ok(UserProfileResponse) → JSON response
```

### Luồng: Upload avatar
```
Client (POST /api/users/me/avatar, file=avatar.jpg)
  │
  ├─► JwtAuthFilter: xác thực
  │
  ├─► UserController.uploadAvatar(MultipartFile)
  │       │
  │       └─► UserService.uploadAvatar(file)
  │               │
  │               ├─► SecurityUtil.getCurrentUsername() → lấy user
  │               │
  │               ├─► FileUploadService.uploadImage(file, "cinex/avatars")
  │               │       │
  │               │       ├─► validateImage(): check type (jpg/png/webp), size (≤2MB)
  │               │       │
  │               │       └─► cloudinary.uploader().upload() → trả secure_url
  │               │
  │               ├─► user.setAvatarUrl(url) → lưu URL vào DB
  │               │
  │               └─► return UserProfileResponse (có avatarUrl mới)
  │
  └─► ApiResponse.ok("Avatar uploaded", UserProfileResponse)
```

### Luồng: Admin gọi API bị chặn bởi @PreAuthorize
```
User thường (role=USER) gọi GET /api/users
  │
  ├─► JwtAuthFilter: xác thực OK (có token hợp lệ)
  │
  ├─► @PreAuthorize("hasRole('ADMIN')") → KIỂM TRA ROLE
  │       │
  │       └─► User role = USER → KHÔNG phải ADMIN → AccessDeniedException!
  │
  └─► GlobalExceptionHandler bắt → trả 403 Forbidden
      {"success": false, "message": "Access denied"}
```

## 5. Khái niệm mới cần biết

### MapStruct
- **Là gì?** Thư viện tự sinh code chuyển đổi giữa Java objects (entity ↔ DTO)
- **Hoạt động:** Lúc compile, MapStruct đọc interface → sinh class implement tự động
- **File sinh ra:** `build/generated/sources/annotationProcessor/.../UserMapperImpl.java`
- **Tương tự:** ModelMapper, nhưng MapStruct **nhanh hơn** vì không dùng reflection

### @EnableMethodSecurity
- **Là gì?** Bật tính năng phân quyền ở mức method (method-level security)
- **Mặc định Spring Security** chỉ phân quyền ở mức URL (trong SecurityConfig)
- **@PreAuthorize** chạy TRƯỚC method, kiểm tra biểu thức SpEL
- **Tương tự:** Như bảo vệ ở cửa từng phòng, không chỉ ở cổng chính

### Cloudinary
- **Là gì?** Dịch vụ cloud lưu trữ ảnh/video, có CDN sẵn
- **Tại sao không lưu file trên server?**
  - Server stateless: scale nhiều instance → file trên server A không thấy ở server B
  - Cloudinary có CDN → ảnh load nhanh toàn cầu
  - Tự động resize, nén ảnh qua URL parameters

### MultipartFile
- **Là gì?** Interface của Spring để nhận file upload từ client
- **Client gửi:** `Content-Type: multipart/form-data` (không phải JSON)
- **Dùng `@RequestParam("file")`** thay vì `@RequestBody`
- **Giới hạn:** config trong application.yml: `spring.servlet.multipart.max-file-size`

### SecurityContext + ThreadLocal
- **Vấn đề:** Khi user gọi API, làm sao Service biết đang là user nào?
- **Giải pháp:** JwtAuthFilter set user info vào SecurityContext (dùng ThreadLocal)
- **Mỗi HTTP request = 1 thread** → mỗi thread có SecurityContext riêng
- **SecurityUtil.getCurrentUsername()** đọc từ context → trả đúng username của request đó

## 6. Annotation/API mới sử dụng

| Annotation | Tác dụng | Ví dụ |
|---|---|---|
| `@EnableMethodSecurity` | Bật @PreAuthorize, @PostAuthorize | Đặt trên SecurityConfig class |
| `@PreAuthorize("hasRole('ADMIN')")` | Chỉ user có ROLE_ADMIN mới vào method | Đặt trên method controller |
| `@Mapper(componentModel="spring")` | Đăng ký MapStruct mapper là Spring Bean | Interface UserMapper |
| `@RequestParam("file")` | Nhận file upload (multipart) | Controller method parameter |
| `@PageableDefault(size=20)` | Giá trị mặc định cho phân trang | `Pageable pageable` parameter |
| `@Pattern(regexp=...)` | Validate field theo regex | Phone number format |
| `@Value("${cloudinary.cloud-name}")` | Đọc giá trị từ application.yml | CloudinaryConfig |

## 7. SQL được sinh ra

```sql
-- getProfile: SecurityUtil → findByUsername
SELECT u.* FROM users u WHERE u.username = 'vanan'

-- updateProfile: save user
UPDATE users SET full_name = 'Vu Tuong An', phone = '0901234567',
       updated_by = 'vanan', updated_at = '2026-05-18T23:30:00', version = 2
WHERE id = 1 AND version = 1

-- uploadAvatar: save user
UPDATE users SET avatar_url = 'https://res.cloudinary.com/.../avatar.jpg',
       updated_by = 'vanan', updated_at = '...', version = 3
WHERE id = 1 AND version = 2

-- listUsers (admin): phân trang
SELECT u.* FROM users u ORDER BY u.id OFFSET 0 ROWS FETCH NEXT 20 ROWS ONLY
SELECT COUNT(*) FROM users  -- đếm tổng để tính totalPages

-- updateRole (admin): tìm user + cập nhật
SELECT u.* FROM users u WHERE u.id = 5
UPDATE users SET role = 'ADMIN', updated_by = 'admin', version = 2
WHERE id = 5 AND version = 1
```

**Chú ý `WHERE version = ?`:** Đây là **Optimistic Locking**. Nếu 2 request cùng sửa 1 user, request sau sẽ thấy version đã thay đổi → throw `OptimisticLockException` → tránh mất dữ liệu.

## 8. Request/Response mẫu

### GET /api/users/me — Xem profile
```bash
curl -X GET http://localhost:8088/api/users/me \
  -H "Authorization: Bearer <access_token>"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": 1,
    "username": "vanan",
    "email": "vanan@gmail.com",
    "fullName": "Vu Tuong An",
    "phone": "0901234567",
    "avatarUrl": null,
    "role": "USER",
    "createdAt": "2026-05-18T15:30:00"
  },
  "timestamp": "2026-05-18T16:30:00Z"
}
```

### PUT /api/users/me — Cập nhật profile
```bash
curl -X PUT http://localhost:8088/api/users/me \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"fullName": "Vu Tuong An Updated", "phone": "0987654321"}'
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Profile updated",
  "data": {
    "id": 1,
    "username": "vanan",
    "email": "vanan@gmail.com",
    "fullName": "Vu Tuong An Updated",
    "phone": "0987654321",
    "avatarUrl": null,
    "role": "USER",
    "createdAt": "2026-05-18T15:30:00"
  }
}
```

### PUT /api/users/me/password — Đổi mật khẩu
```bash
curl -X PUT http://localhost:8088/api/users/me/password \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"oldPassword": "123456", "newPassword": "newpass789", "confirmPassword": "newpass789"}'
```

**Response thành công (200):**
```json
{"success": true, "message": "Password changed successfully", "data": null}
```

**Response lỗi — sai old password (400):**
```json
{"success": false, "message": "Old password is incorrect"}
```

**Response lỗi — confirm không khớp (400):**
```json
{"success": false, "message": "New password and confirm password do not match"}
```

### POST /api/users/me/avatar — Upload avatar
```bash
curl -X POST http://localhost:8088/api/users/me/avatar \
  -H "Authorization: Bearer <access_token>" \
  -F "file=@avatar.jpg"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Avatar uploaded",
  "data": {
    "id": 1,
    "username": "vanan",
    "avatarUrl": "https://res.cloudinary.com/cinex/image/upload/v123/cinex/avatars/abc123.jpg",
    "..."
  }
}
```

**Response lỗi — file quá lớn (400):**
```json
{"success": false, "message": "File size must not exceed 2MB"}
```

### GET /api/users — (Admin) Danh sách user
```bash
curl -X GET "http://localhost:8088/api/users?page=0&size=10" \
  -H "Authorization: Bearer <admin_token>"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "content": [
      {"id": 1, "username": "vanan", "role": "USER", "..."},
      {"id": 2, "username": "admin", "role": "ADMIN", "..."}
    ],
    "page": 0,
    "size": 10,
    "totalElements": 2,
    "totalPages": 1,
    "last": true
  }
}
```

**Response lỗi — user thường gọi (403):**
```json
{"success": false, "message": "Access denied"}
```

### PUT /api/users/{id}/role — (Admin) Đổi role
```bash
curl -X PUT http://localhost:8088/api/users/5/role \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"role": "ADMIN"}'
```

## 9. Câu hỏi tự kiểm tra

1. **Tại sao lấy userId từ SecurityContext thay vì truyền qua URL (GET /api/users/1)?**
   → Nếu truyền qua URL, user A có thể sửa URL thành `/api/users/2` để xem/sửa profile user B. Dùng SecurityContext thì **luôn đúng user đang login**.

2. **Nếu bỏ `@EnableMethodSecurity`, `@PreAuthorize("hasRole('ADMIN')")` có còn tác dụng không?**
   → KHÔNG. @PreAuthorize bị bỏ qua hoàn toàn → user thường cũng gọi được API admin → **lỗ hổng bảo mật nghiêm trọng**.

3. **MapStruct sinh code ở đâu? Khi nào? Tại sao nhanh hơn ModelMapper?**
   → Sinh ở `build/generated/sources/.../UserMapperImpl.java`, lúc **compile time**. ModelMapper dùng reflection lúc runtime → chậm hơn. MapStruct = gọi getter/setter trực tiếp.

4. **Tại sao admin không được đổi role chính mình?**
   → Nếu admin tự đổi thành USER → **không còn ai là admin** → không ai quản trị được hệ thống. Đây là business rule phòng ngừa.

5. **Upload avatar dùng `@RequestParam("file")` thay vì `@RequestBody`. Tại sao?**
   → File upload dùng `multipart/form-data`, không phải JSON. `@RequestBody` parse JSON body, `@RequestParam` lấy giá trị từ form field. Nếu dùng `@RequestBody` với file → lỗi.
