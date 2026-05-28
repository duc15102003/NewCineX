# Lombok — Tự sinh code lặp lại

---

## Lombok là gì?

Thư viện **tự sinh getter/setter/constructor/builder** lúc compile. Giảm hàng trăm dòng boilerplate.

### Ví dụ đời thường
Viết đơn xin nghỉ phép: phần họ tên, ngày tháng, chữ ký đều giống nhau mọi lần. Lombok = mẫu đơn in sẵn, bạn chỉ điền nội dung khác.

---

## Không có Lombok (viết tay 60 dòng)

```java
public class User {
    private Long id;
    private String username;
    private String email;
    private String password;
    private String fullName;
    private Role role;

    // Constructor rỗng
    public User() {}

    // Constructor đầy đủ
    public User(Long id, String username, String email, String password, String fullName, Role role) {
        this.id = id;
        this.username = username;
        this.email = email;
        this.password = password;
        this.fullName = fullName;
        this.role = role;
    }

    // 6 getter
    public Long getId() { return id; }
    public String getUsername() { return username; }
    public String getEmail() { return email; }
    public String getPassword() { return password; }
    public String getFullName() { return fullName; }
    public Role getRole() { return role; }

    // 6 setter
    public void setId(Long id) { this.id = id; }
    public void setUsername(String username) { this.username = username; }
    public void setEmail(String email) { this.email = email; }
    public void setPassword(String password) { this.password = password; }
    public void setFullName(String fullName) { this.fullName = fullName; }
    public void setRole(Role role) { this.role = role; }
}
// 60 dòng cho 6 field. 15 field → 150 dòng. Toàn code vô nghĩa.
```

## Có Lombok (6 dòng)

```java
@Getter           // Tự sinh getter cho TẤT CẢ field
@Setter           // Tự sinh setter cho TẤT CẢ field
@NoArgsConstructor // Tự sinh constructor rỗng: new User()
@AllArgsConstructor // Tự sinh constructor đầy đủ: new User(id, username, ...)
@Builder          // Tự sinh Builder pattern: User.builder().username("x").build()
public class User {
    private Long id;
    private String username;
    private String email;
    private String password;
    private String fullName;
    private Role role;
}
// 6 dòng. Lombok tự sinh 60 dòng code lúc compile.
```

---

## Các annotation Lombok dùng trong CineX

### @Getter / @Setter — Tự sinh getter/setter

```java
@Getter @Setter
public class Movie {
    private String title;     // → getTitle(), setTitle()
    private int duration;     // → getDuration(), setDuration()
    private boolean enabled;  // → isEnabled(), setEnabled()  (boolean dùng "is" thay "get")
}
```

### @NoArgsConstructor — Constructor rỗng

```java
@NoArgsConstructor
public class User {
    private String username;
}
// Tự sinh: public User() {}
// JPA BẮT BUỘC phải có constructor rỗng → mọi entity cần annotation này
```

### @AllArgsConstructor — Constructor đầy đủ

```java
@AllArgsConstructor
public class User {
    private String username;
    private String email;
}
// Tự sinh: public User(String username, String email) { ... }
```

### @Builder — Builder pattern

```java
@Builder
public class User {
    private String username;
    private String email;
    @Builder.Default
    private Role role = Role.USER;  // ← giá trị mặc định khi dùng builder
}

// Sử dụng:
User user = User.builder()
    .username("testuser")
    .email("test@cinex.com")
    // role không set → mặc định Role.USER (nhờ @Builder.Default)
    .build();
```

### @RequiredArgsConstructor — Constructor cho final fields

```java
@RequiredArgsConstructor
public class AuthService {
    private final UserRepository userRepository;      // ← final → có trong constructor
    private final PasswordEncoder passwordEncoder;    // ← final → có trong constructor
    private final JwtUtil jwtUtil;                    // ← final → có trong constructor
}
// Tự sinh:
// public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtUtil jwtUtil) {
//     this.userRepository = userRepository;
//     this.passwordEncoder = passwordEncoder;
//     this.jwtUtil = jwtUtil;
// }
// → Spring tự inject qua constructor này (Constructor Injection)
```

**Đây là cách inject dependency trong CineX.** Mọi Service, Controller đều dùng `@RequiredArgsConstructor` + `private final`.

### @Slf4j — Tự tạo logger

```java
@Slf4j  // Tự sinh: private static final Logger log = LoggerFactory.getLogger(AuthService.class);
@Service
public class AuthService {
    public void login() {
        log.info("User {} logged in", username);
        log.warn("Failed login attempt for {}", username);
        log.error("System error: ", exception);
    }
}
```

### @Data — Gộp nhiều annotation (KHÔNG khuyên dùng cho Entity)

```java
@Data  // = @Getter + @Setter + @ToString + @EqualsAndHashCode + @RequiredArgsConstructor
public class MovieResponse {
    private Long id;
    private String title;
}
// Dùng cho DTO thì OK
// KHÔNG dùng cho Entity vì @EqualsAndHashCode gây lỗi với JPA lazy loading
```

---

## Dùng ở đâu trong CineX

| Annotation | Dùng ở | Ví dụ |
|---|---|---|
| `@Getter @Setter` | Entity, DTO | `User.java`, `Movie.java` |
| `@NoArgsConstructor` | Entity | JPA bắt buộc |
| `@AllArgsConstructor` | Entity, DTO | Kết hợp với @Builder |
| `@Builder` | Entity, Response DTO | `User.builder()`, `ApiResponse.builder()` |
| `@RequiredArgsConstructor` | Service, Controller, Config | Inject dependency |
| `@Slf4j` | Service (khi cần log) | `log.info(...)` |

---

## Cài đặt trong build.gradle

```groovy
compileOnly 'org.projectlombok:lombok'
annotationProcessor 'org.projectlombok:lombok'
annotationProcessor 'org.projectlombok:lombok-mapstruct-binding:0.2.0'
// ↑ binding để Lombok + MapStruct hoạt động cùng nhau
```

**IDE:** IntelliJ cần cài plugin **Lombok** + bật **Enable annotation processing** trong Settings → Build → Compiler → Annotation Processors.
