# Bean Validation — `@Valid` + `@NotBlank` + ConstraintViolation

> Lib `spring-boot-starter-validation` (Jakarta Bean Validation 3.0 + Hibernate Validator) — validate DTO declarative qua annotation.

---

## 1. Vấn đề: Validate tay trong Controller

```java
@PostMapping("/movies")
public ApiResponse<MovieResponse> create(@RequestBody MovieCreateRequest request) {
    if (request.getTitle() == null || request.getTitle().isBlank())
        throw new BusinessException(ErrorCode.INVALID_REQUEST, "title required");
    if (request.getDuration() == null || request.getDuration() < 1)
        throw new BusinessException(ErrorCode.INVALID_REQUEST, "duration must be > 0");
    if (request.getDuration() > 500)
        throw new BusinessException(ErrorCode.INVALID_REQUEST, "duration too long");
    // ... 10 field nữa ...
    return ApiResponse.ok(movieService.create(request));
}
```

20 endpoint × 5-10 field/endpoint = 100-200 if-check rải rác → controller bloat, duplicate logic.

---

## 2. Giải pháp: Annotation declarative

DTO khai validation rules trên field:

```java
public class MovieCreateRequest {
    @NotBlank(message = "Tên phim không được rỗng")
    @Size(min = 1, max = 200, message = "Tên phim 1-200 ký tự")
    private String title;

    @NotNull(message = "Thời lượng bắt buộc")
    @Min(value = 1, message = "Thời lượng tối thiểu 1 phút")
    @Max(value = 500, message = "Thời lượng tối đa 500 phút")
    private Integer duration;

    @NotNull(message = "Phân loại tuổi bắt buộc")
    private AgeRating ageRating;

    @Email(message = "Email không hợp lệ")
    private String contactEmail;  // optional, NULL OK; nếu có value phải đúng format

    @NotEmpty(message = "Phải chọn ít nhất 1 thể loại")
    private List<Long> genreIds;

    @Future(message = "Ngày khởi chiếu phải trong tương lai")
    private LocalDate releaseDate;
}
```

Controller thêm `@Valid`:

```java
@PostMapping("/movies")
public ApiResponse<MovieResponse> create(@Valid @RequestBody MovieCreateRequest request) {
    return ApiResponse.ok(movieService.create(request));
}
```

Validation fail → throw `MethodArgumentNotValidException` → `GlobalExceptionHandler` trả 400 với chi tiết field nào sai.

---

## 3. Các annotation hay dùng

### 3.1. Null/blank check

| Annotation | Áp cho | Ý nghĩa |
|---|---|---|
| `@NotNull` | Mọi type | Không được NULL |
| `@NotEmpty` | String/Collection/Map/Array | Không NULL VÀ không rỗng |
| `@NotBlank` | String | Không NULL VÀ không chỉ whitespace (`"   "` fail) |

**Quy tắc:**
- String input từ user: `@NotBlank` (luôn trim)
- List filter: `@NotEmpty` (NULL hoặc `[]` fail)
- Optional reference: chỉ `@NotNull` khi BẮT BUỘC

### 3.2. Number range

| Annotation | Áp cho | Ý nghĩa |
|---|---|---|
| `@Min(1)` | Integer/Long/BigDecimal | >= 1 |
| `@Max(100)` | — | <= 100 |
| `@Positive` | — | > 0 |
| `@PositiveOrZero` | — | >= 0 |
| `@DecimalMin("0.01")` | BigDecimal | >= 0.01 (chính xác) |

### 3.3. String pattern

| Annotation | Ý nghĩa |
|---|---|
| `@Size(min=1, max=200)` | Độ dài string |
| `@Email` | Format email hợp lệ |
| `@Pattern(regexp="^[A-Z]{3}-\\d{4}$")` | Match regex |

### 3.4. Date/Time

| Annotation | Ý nghĩa |
|---|---|
| `@Past` | Ngày quá khứ |
| `@PastOrPresent` | Quá khứ hoặc hôm nay |
| `@Future` | Ngày tương lai |
| `@FutureOrPresent` | Hôm nay hoặc tương lai |

### 3.5. Collection

```java
@Valid  // ← bắt buộc nếu element là DTO cần validate
@NotEmpty
private List<@NotNull Long> seatIds;

@Valid
private List<BookingSeatRequest> seats;  // mỗi element được validate
```

`@Valid` trên collection field → cascade validate vào từng element.

---

## 4. Nested DTO validation

```java
public class BookingCreateRequest {
    @NotNull
    private Long showtimeId;

    @Valid       // ← cascade
    @NotNull
    private CustomerInfo customer;

    @Valid       // ← cascade từng element
    @NotEmpty
    private List<SeatSelection> seats;
}

public class CustomerInfo {
    @NotBlank @Size(max = 100)
    private String fullName;

    @NotBlank @Email
    private String email;

    @Pattern(regexp = "^(0|\\+84)\\d{9}$", message = "SĐT VN không hợp lệ")
    private String phone;
}
```

Không có `@Valid` ở field nested → các annotation trong CustomerInfo bị bỏ qua.

---

## 5. Custom validator

Tạo annotation riêng cho rule phức tạp:

```java
@Target({ ElementType.FIELD })
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = StrongPasswordValidator.class)
public @interface StrongPassword {
    String message() default "Mật khẩu phải >= 8 ký tự, có chữ hoa, chữ thường, số";
    Class<?>[] groups() default { };
    Class<? extends Payload>[] payload() default { };
}

public class StrongPasswordValidator implements ConstraintValidator<StrongPassword, String> {
    private static final Pattern PATTERN = Pattern.compile(
        "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,}$"
    );

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        return value != null && PATTERN.matcher(value).matches();
    }
}
```

Sử dụng:
```java
@StrongPassword
private String password;
```

---

## 6. Validate trong path/query param

Controller thêm `@Validated` ở class:

```java
@RestController
@Validated  // ← bắt buộc cho param-level annotation
@RequestMapping("/api/movies")
public class MovieController {

    @GetMapping("/{id}")
    public ApiResponse<MovieResponse> get(
        @PathVariable @Positive Long id  // id phải > 0
    ) { ... }

    @GetMapping
    public ApiResponse<Page<MovieResponse>> list(
        @RequestParam(defaultValue = "0") @Min(0) int page,
        @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
        @RequestParam(required = false) @Size(max = 100) String search
    ) { ... }
}
```

Không có `@Validated` ở class → annotation trên param bị ignore.

---

## 7. GlobalExceptionHandler — trả 400 đẹp

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Map<String, String>>> handleValidation(
            MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(error ->
            errors.put(error.getField(), error.getDefaultMessage())
        );
        return ResponseEntity.badRequest().body(
            ApiResponse.error(ErrorCode.VALIDATION_FAILED, "Dữ liệu không hợp lệ", errors)
        );
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiResponse<Map<String, String>>> handleConstraint(
            ConstraintViolationException ex) {
        Map<String, String> errors = new HashMap<>();
        ex.getConstraintViolations().forEach(violation ->
            errors.put(violation.getPropertyPath().toString(), violation.getMessage())
        );
        return ResponseEntity.badRequest().body(
            ApiResponse.error(ErrorCode.VALIDATION_FAILED, "Tham số không hợp lệ", errors)
        );
    }
}
```

Response client nhận:
```json
{
  "success": false,
  "errorCode": "VALIDATION_FAILED",
  "message": "Dữ liệu không hợp lệ",
  "data": {
    "title": "Tên phim không được rỗng",
    "duration": "Thời lượng tối thiểu 1 phút"
  }
}
```

→ FE bind error vào từng field input dễ dàng.

---

## 8. Validation Groups — multi-step form

Khi cùng 1 DTO cho create + update nhưng rule khác nhau:

```java
public interface OnCreate {}
public interface OnUpdate {}

public class UserRequest {
    @Null(groups = OnCreate.class)         // create không gửi id
    @NotNull(groups = OnUpdate.class)      // update bắt buộc id
    private Long id;

    @NotBlank(groups = { OnCreate.class, OnUpdate.class })
    private String fullName;

    @StrongPassword(groups = OnCreate.class)  // create bắt buộc mật khẩu
    private String password;
}

@PostMapping
public ApiResponse<UserResponse> create(@Validated(OnCreate.class) @RequestBody UserRequest req) { ... }

@PutMapping("/{id}")
public ApiResponse<UserResponse> update(@Validated(OnUpdate.class) @RequestBody UserRequest req) { ... }
```

---

## 9. Anti-pattern tránh

### 9.1. ❌ Quên `@Valid` ở Controller

```java
@PostMapping
public ApiResponse<...> create(@RequestBody MovieCreateRequest req) {  // SAI: thiếu @Valid
    return ...;
}
```

→ Annotation trong DTO bị bỏ qua, request rỗng vẫn pass.

### 9.2. ❌ Validate trong Service thay vì DTO

```java
public Movie create(MovieCreateRequest req) {
    if (req.getTitle() == null || ...) throw ...;  // SAI: logic mòn vẹt
}
```

→ Lặp lại logic, không declarative.

### 9.3. ❌ `@NotNull` thay vì `@NotBlank` cho String input

```java
@NotNull
private String title;  // SAI: "   " pass qua
```

→ User gửi `"   "` → save vào DB → bug downstream.

**Fix:** Luôn `@NotBlank` cho user-input String.

### 9.4. ❌ Quên `@Valid` cascade nested

```java
public class BookingRequest {
    private CustomerInfo customer;  // SAI: thiếu @Valid → email/phone không validate
}
```

### 9.5. ❌ Validate business rule bằng annotation

```java
public class BookingRequest {
    @Min(1) @Max(8)  // hard-code 8 ghế max
    private Integer seatCount;
}
```

`8` là business rule có thể đổi (config table). Đừng hard-code vào annotation. Validate ở Service đọc `SystemConfig.maxSeatsPerBooking`.

---

## 10. Tham khảo code CineX

| File | Vai trò |
|---|---|
| `module/movie/dto/MovieCreateRequest.java` | DTO với 10+ validation annotation |
| `module/auth/dto/RegisterRequest.java` | `@StrongPassword` custom validator |
| `module/booking/dto/BookingHoldRequest.java` | Nested `@Valid` cho seats list |
| `common/exception/GlobalExceptionHandler.java` | Handle `MethodArgumentNotValidException` + `ConstraintViolationException` |
| `common/validation/StrongPasswordValidator.java` | Custom validator |

---

## 11. Câu hỏi tự kiểm tra

1. **Khác gì `@NotNull`, `@NotEmpty`, `@NotBlank`?**
   → `@NotNull`: chỉ check NULL. `@NotEmpty`: NULL hoặc rỗng (`""`, `[]`). `@NotBlank`: chỉ String, NULL hoặc whitespace only (`"   "`).

2. **Tại sao cần `@Valid` ở Controller?**
   → Kích hoạt validate. Không có @Valid → annotation trong DTO bị bỏ qua.

3. **`@Validated` khác `@Valid` ở đâu?**
   → `@Validated` là Spring annotation, hỗ trợ Groups + cho phép param-level. `@Valid` là JSR annotation (jakarta).

4. **Khi nào dùng custom validator?**
   → Rule phức tạp không có sẵn (mật khẩu mạnh, password matching, conditional required).

5. **Tại sao không validate business rule trong annotation?**
   → Business rule có thể đổi (config table). Annotation hard-code → cần redeploy mỗi lần thay đổi.
