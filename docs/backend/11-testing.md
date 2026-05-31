# Testing Backend Spring Boot — A đến Z

> File này dạy bạn viết test cho dự án CineX từ đầu. Test giúp tự tin refactor, tránh regress, làm document sống của code.

## 1. Tổng quan

### Tại sao test?
- **Catch bug sớm**: test fail lúc viết code → fix ngay, rẻ hơn fix ở production.
- **Refactor an tâm**: đổi code mà test vẫn pass = không break gì.
- **Document hành vi**: đọc test biết feature làm gì, không phải đoán.
- **CI gate**: PR phải pass test mới merge.

### 3 loại test
- **Unit test**: test 1 class cô lập, mock dependency. Nhanh (~ms).
- **Integration test**: test nhiều layer phối hợp (controller → service → DB). Vừa (~s).
- **E2E test**: test full stack từ HTTP request đến DB. Chậm (~10s/test).

### Test Pyramid
```
        /\
       /E2E\        ít — ~5%
      /------\
     /  Int   \    vừa — ~25%
    /----------\
   /    Unit    \  nhiều — ~70%
  /--------------\
```

70% unit (nhanh) + 25% integration + 5% E2E. Nếu E2E quá nhiều → suite chạy 30 phút → ai cũng skip.

### Vị trí file
```
backend/
└── src/
    ├── main/java/com/cinex/
    │   └── module/booking/service/BookingService.java
    └── test/java/com/cinex/                        ← test ở đây
        └── module/booking/service/BookingServiceTest.java
```

Quy ước: mirror cấu trúc package main. Tên test = tên class + `Test`.

## 2. JUnit 5 căn bản

### Annotations cơ bản
```java
import org.junit.jupiter.api.*;

class CalculatorTest {

    @BeforeAll
    static void setupSuite() { /* chạy 1 lần trước tất cả test */ }

    @BeforeEach
    void setup() { /* chạy trước MỖI test method */ }

    @Test
    @DisplayName("1 + 1 should equal 2")
    void shouldAddTwoNumbers() {
        assertEquals(2, 1 + 1);
    }

    @AfterEach
    void tearDown() { /* chạy sau MỖI test */ }

    @AfterAll
    static void teardownSuite() { /* chạy 1 lần cuối */ }
}
```

### Assertions
```java
assertEquals(expected, actual);
assertNotEquals(...);
assertTrue(condition);
assertFalse(...);
assertNull(value);
assertNotNull(...);

// Multiple assertions — tất cả chạy, fail riêng từng cái
assertAll("user",
    () -> assertEquals("vanan", user.getUsername()),
    () -> assertEquals("a@b.com", user.getEmail())
);

// Expected exception
BusinessException ex = assertThrows(
    BusinessException.class,
    () -> bookingService.createBooking(invalidRequest)
);
assertEquals(ErrorCode.SEAT_TAKEN, ex.getErrorCode());

// Timeout
assertTimeout(Duration.ofSeconds(2), () -> longRunningOperation());
```

### Parameterized tests
Test cùng logic với nhiều input:
```java
@ParameterizedTest
@ValueSource(strings = {"abc@", "abc", "", "@b.com"})
void shouldRejectInvalidEmail(String email) {
    assertThrows(ValidationException.class, () -> validateEmail(email));
}

@ParameterizedTest
@CsvSource({
    "1, 1, 2",
    "2, 3, 5",
    "-1, 1, 0"
})
void shouldAdd(int a, int b, int expected) {
    assertEquals(expected, a + b);
}
```

### Nested tests
Tổ chức theo group:
```java
class BookingServiceTest {

    @Nested
    @DisplayName("createBooking")
    class CreateBooking {
        @Test void shouldSucceedWhenSeatsAvailable() { ... }
        @Test void shouldFailWhenSeatTaken() { ... }
    }

    @Nested
    @DisplayName("cancelBooking")
    class CancelBooking {
        @Test void shouldRefundWhenPaid() { ... }
    }
}
```

## 3. Mockito — Mock dependency

### Setup
```java
@ExtendWith(MockitoExtension.class)
class BookingServiceTest {

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private ShowtimeRepository showtimeRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks  // tự động inject các @Mock vào constructor
    private BookingService bookingService;

    @Test
    void test() { ... }
}
```

### Stubbing
```java
// Khi gọi findById(1L), trả về Optional.of(showtime)
when(showtimeRepository.findById(1L)).thenReturn(Optional.of(showtime));

// Khi gọi với bất kỳ argument nào (any)
when(userRepository.findById(any())).thenReturn(Optional.of(user));

// Throw exception
when(bookingRepository.save(any())).thenThrow(new RuntimeException("DB error"));

// Chain — gọi lần 1 trả X, lần 2 trả Y
when(repo.getValue())
    .thenReturn("first")
    .thenReturn("second");
```

### Verify
```java
// Verify method được gọi đúng 1 lần
verify(bookingRepository).save(any(Booking.class));

// Verify gọi N lần
verify(emailService, times(2)).sendEmail(any());

// Verify chưa từng gọi
verify(emailService, never()).sendEmail(any());

// Verify thứ tự
InOrder inOrder = inOrder(bookingRepository, paymentService);
inOrder.verify(bookingRepository).save(any());
inOrder.verify(paymentService).process(any());
```

### ArgumentCaptor — bắt argument
```java
@Test
void shouldSaveBookingWithCorrectStatus() {
    bookingService.createBooking(request);

    ArgumentCaptor<Booking> captor = ArgumentCaptor.forClass(Booking.class);
    verify(bookingRepository).save(captor.capture());

    Booking saved = captor.getValue();
    assertEquals(BookingStatus.HOLDING, saved.getStatus());
    assertEquals(3, saved.getBookingSeats().size());
}
```

### @Spy — wrap real object
`@Mock` = mock toàn bộ. `@Spy` = giữ behavior thật, override 1 vài method.

```java
@Spy
private List<String> spyList = new ArrayList<>();

@Test
void test() {
    spyList.add("real");  // chạy thật
    when(spyList.size()).thenReturn(100);  // chỉ override size()
    assertEquals(100, spyList.size());
    assertTrue(spyList.contains("real"));
}
```

### Test mẫu BookingService
```java
@ExtendWith(MockitoExtension.class)
class BookingServiceTest {

    @Mock BookingRepository bookingRepository;
    @Mock ShowtimeRepository showtimeRepository;
    @Mock SeatRepository seatRepository;
    @Mock UserRepository userRepository;
    @InjectMocks BookingService bookingService;

    @Test
    @DisplayName("Tạo booking thành công khi ghế còn trống")
    void shouldCreateBookingWhenSeatsAvailable() {
        // Given
        User user = User.builder().id(1L).username("vanan").build();
        Showtime showtime = Showtime.builder().id(10L).build();
        Seat seatA1 = Seat.builder().id(100L).seatNumber("A1").build();

        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(showtimeRepository.findById(10L)).thenReturn(Optional.of(showtime));
        when(seatRepository.findAllById(List.of(100L))).thenReturn(List.of(seatA1));
        when(bookingRepository.existsByShowtimeAndSeats(10L, List.of(100L))).thenReturn(false);

        BookingRequest req = new BookingRequest(1L, 10L, List.of(100L));

        // When
        Booking result = bookingService.createBooking(req);

        // Then
        assertEquals(BookingStatus.HOLDING, result.getStatus());
        verify(bookingRepository).save(any(Booking.class));
    }

    @Test
    @DisplayName("Throw exception khi ghế đã có người đặt")
    void shouldThrowWhenSeatTaken() {
        when(userRepository.findById(any())).thenReturn(Optional.of(new User()));
        when(showtimeRepository.findById(any())).thenReturn(Optional.of(new Showtime()));
        when(bookingRepository.existsByShowtimeAndSeats(any(), any())).thenReturn(true);

        BookingRequest req = new BookingRequest(1L, 10L, List.of(100L));

        BusinessException ex = assertThrows(
            BusinessException.class,
            () -> bookingService.createBooking(req)
        );
        assertEquals(ErrorCode.SEAT_TAKEN, ex.getErrorCode());
    }
}
```

## 4. @SpringBootTest — Full context

### Khi nào dùng
- Test tích hợp end-to-end với HTTP
- Cần test cấu hình thật (security, CORS, ...)

### Code mẫu
```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
class BookingControllerIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired BookingRepository bookingRepository;

    @Test
    @WithMockUser(username = "vanan", roles = "USER")
    void shouldCreateBooking() throws Exception {
        mockMvc.perform(post("/api/bookings")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    { "showtimeId": 1, "seatIds": [10, 11] }
                """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.data.status").value("HOLDING"));
    }
}
```

### Cảnh báo context cache
Mỗi class `@SpringBootTest` với config khác nhau → Spring tạo context riêng → suite chậm. Best practice: dùng cùng config để share context.

## 5. @WebMvcTest — Chỉ test Controller

### Khi nào dùng
Test Controller cô lập, không load JPA/Security/...

### Code mẫu
```java
@WebMvcTest(MovieController.class)
class MovieControllerTest {

    @Autowired MockMvc mockMvc;

    @MockBean MovieService movieService;  // mock service

    @Test
    @WithMockUser
    void shouldReturnMovieList() throws Exception {
        when(movieService.list(any())).thenReturn(
            new PageResponse<>(List.of(
                new MovieResponse(1L, "Avengers", null)
            ), 1, 0, 10)
        );

        mockMvc.perform(get("/api/movies"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content[0].title").value("Avengers"));
    }

    @Test
    void shouldReturn401WhenNotAuthenticated() throws Exception {
        mockMvc.perform(get("/api/movies/my-favorites"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "USER")
    void shouldReturn403WhenNotAdmin() throws Exception {
        mockMvc.perform(post("/api/movies")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Test\"}"))
            .andExpect(status().isForbidden());
    }
}
```

### MockMvc assertions thường dùng
```java
.andExpect(status().isOk())
.andExpect(status().isCreated())
.andExpect(status().isBadRequest())
.andExpect(content().contentType(MediaType.APPLICATION_JSON))
.andExpect(jsonPath("$.success").value(true))
.andExpect(jsonPath("$.data.id").exists())
.andExpect(jsonPath("$.data.title").value("Avengers"))
.andExpect(jsonPath("$.data[*].title", hasItem("Avengers")))
.andExpect(header().string("Location", "/api/movies/1"))
```

## 6. @DataJpaTest — Chỉ test Repository

### Khi nào dùng
Test query/Specification của Repository không cần load full app.

### Code mẫu
```java
@DataJpaTest
@AutoConfigureTestDatabase(replace = Replace.NONE)  // dùng SQL Server thật
class MovieRepositoryTest {

    @Autowired TestEntityManager em;
    @Autowired MovieRepository movieRepository;

    @Test
    void shouldFindByGenreId() {
        Genre action = em.persist(Genre.builder().name("Action").build());
        Movie avengers = em.persist(Movie.builder()
            .title("Avengers")
            .genres(Set.of(action))
            .build());
        em.flush();

        List<Movie> results = movieRepository.findByGenreId(action.getId());

        assertEquals(1, results.size());
        assertEquals("Avengers", results.get(0).getTitle());
    }
}
```

### `replace = NONE` để dùng DB thật
Mặc định `@DataJpaTest` thay DB bằng H2 in-memory. Vì CineX dùng SQL Server (T-SQL khác H2) → cần `@AutoConfigureTestDatabase(replace = Replace.NONE)` để chạy DB thật từ `application-test.yml`.

## 7. Testcontainers — Docker DB tự động

### Là gì
Container Docker (SQL Server, Redis, ...) start tự động khi test bắt đầu, clean up sau. Test với DB thật mà không cần cài DB trên máy.

### Setup
```gradle
testImplementation 'org.testcontainers:mssqlserver:1.20.4'
testImplementation 'org.testcontainers:junit-jupiter:1.20.4'
```

### Base test class
```java
@Testcontainers
@SpringBootTest
abstract class IntegrationTestBase {

    @Container
    static MSSQLServerContainer<?> mssql = new MSSQLServerContainer<>(
            "mcr.microsoft.com/mssql/server:2022-latest")
        .acceptLicense()
        .withPassword("Test@2026");

    @DynamicPropertySource
    static void overrideProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", mssql::getJdbcUrl);
        registry.add("spring.datasource.username", mssql::getUsername);
        registry.add("spring.datasource.password", mssql::getPassword);
    }
}
```

### Integration test mẫu
```java
class BookingFlowIntegrationTest extends IntegrationTestBase {

    @Autowired BookingService bookingService;
    @Autowired BookingRepository bookingRepository;

    @Test
    void shouldCompleteBookingFlow() {
        // Seed data
        User user = userRepository.save(User.builder().username("vanan").build());
        Showtime showtime = showtimeRepository.save(Showtime.builder().build());

        // When
        Booking booking = bookingService.createBooking(
            new BookingRequest(user.getId(), showtime.getId(), List.of(100L))
        );

        // Then
        Booking loaded = bookingRepository.findById(booking.getId()).orElseThrow();
        assertEquals(BookingStatus.HOLDING, loaded.getStatus());
    }
}
```

## 8. Test Security với JWT

### `@WithMockUser` — user giả
```java
@Test
@WithMockUser(username = "vanan", roles = {"USER"})
void shouldAllowUser() { ... }

@Test
@WithMockUser(roles = {"ADMIN"})
void shouldAllowAdmin() { ... }
```

### `@WithUserDetails` — load user thật từ DB
```java
@Test
@WithUserDetails("vanan@example.com")  // load qua UserDetailsService
void shouldUseRealUser() { ... }
```

### Custom annotation
```java
@Retention(RetentionPolicy.RUNTIME)
@WithSecurityContext(factory = WithMockJwtUserFactory.class)
public @interface WithMockJwtUser {
    String username() default "vanan";
    String[] roles() default {"USER"};
    Long userId() default 1L;
}

public class WithMockJwtUserFactory implements WithSecurityContextFactory<WithMockJwtUser> {
    @Override
    public SecurityContext createSecurityContext(WithMockJwtUser annotation) {
        // Tạo Authentication với JWT principal
        ...
    }
}
```

### Test với token thật
```java
@Test
void shouldAcceptValidToken() throws Exception {
    String token = jwtUtil.generate(user);

    mockMvc.perform(get("/api/movies")
            .header("Authorization", "Bearer " + token))
        .andExpect(status().isOk());
}
```

## 9. Test Async + Event

### Test @Async
`@Async` method chạy trên thread khác → test trả về trước khi method xong. Dùng `Awaitility`:

```gradle
testImplementation 'org.awaitility:awaitility:4.2.2'
```

```java
@Test
void shouldSendEmailAsync() {
    paymentService.completePayment(bookingId);

    await().atMost(5, SECONDS)
        .untilAsserted(() -> verify(emailService).sendEmail(any()));
}
```

### Test @EventListener
```java
@Test
void shouldPublishEventOnPaymentComplete() {
    paymentService.completePayment(bookingId);

    await().untilAsserted(() ->
        verify(notificationService).createNotification(any(), any(), any(), any())
    );
}
```

## 10. AssertJ — Fluent assertion

JUnit assertion lặp lại nhiều. AssertJ đọc tự nhiên hơn:

```java
import static org.assertj.core.api.Assertions.*;

// JUnit
assertEquals(3, list.size());
assertTrue(list.contains("Avengers"));

// AssertJ
assertThat(list)
    .hasSize(3)
    .contains("Avengers")
    .doesNotContain("Joker");

assertThat(booking)
    .extracting(Booking::getStatus, Booking::getTotalAmount)
    .containsExactly(BookingStatus.HOLDING, 150000);

assertThatThrownBy(() -> bookingService.cancel(bookingId))
    .isInstanceOf(BusinessException.class)
    .hasMessageContaining("CHECKED_IN")
    .extracting("errorCode").isEqualTo(ErrorCode.CANNOT_CANCEL);
```

## 11. JaCoCo coverage

### Setup `build.gradle`
```gradle
plugins {
    id 'jacoco'
}

jacoco {
    toolVersion = "0.8.12"
}

test {
    finalizedBy jacocoTestReport
}

jacocoTestReport {
    dependsOn test
    reports {
        html.required = true
        xml.required = true
    }
}

jacocoTestCoverageVerification {
    violationRules {
        rule {
            limit {
                minimum = 0.70  // 70% line coverage
            }
        }
    }
}
```

### Chạy
```bash
./gradlew test jacocoTestReport jacocoTestCoverageVerification
```

Report HTML: `build/reports/jacoco/test/html/index.html`.

### Target hợp lý
- Service: 70-80%
- Controller: 50-60%
- Repository: dựa vào integration test, không tính coverage
- DTO/Entity: KHÔNG cần test

Đừng obsess 100%. 80% nghĩa là 20% còn lại là edge case khó test (error handler, getter/setter).

## 12. Test naming convention

### BDD-style: `should_X_when_Y`
```java
void shouldThrowWhenSeatAlreadyTaken()
void shouldRefundWhenCanceledBeforeShowtime()
void shouldNotAllowMoreThan8SeatsPerBooking()
```

### Given-When-Then trong body
```java
@Test
void shouldCalculateTotalWithDiscount() {
    // Given
    Voucher voucher = Voucher.builder().percentDiscount(10).build();
    BookingRequest req = new BookingRequest(...);

    // When
    long total = pricingService.calculate(req, voucher);

    // Then
    assertEquals(90000, total);
}
```

## 13. Test fixtures + Factory

### Tránh duplicate setup
```java
// SAI — duplicate trong nhiều test
@Test void test1() {
    User u = User.builder().username("a").email("a@b.com").enabled(true).build();
    ...
}
@Test void test2() {
    User u = User.builder().username("a").email("a@b.com").enabled(true).build();
    ...
}
```

### Factory class
```java
public class UserTestFactory {
    public static User createUser() {
        return User.builder()
            .username("vanan")
            .email("vanan@example.com")
            .enabled(true)
            .build();
    }

    public static User createAdmin() {
        User u = createUser();
        u.setRoles(Set.of(Role.ADMIN));
        return u;
    }
}
```

### @Sql để load data
```java
@Test
@Sql("/test-data/booking-fixtures.sql")
void shouldFindBookingByCode() { ... }
```

File `test-data/booking-fixtures.sql`:
```sql
INSERT INTO users (id, username, email) VALUES (1, 'vanan', 'a@b.com');
INSERT INTO bookings (id, user_id, status) VALUES (100, 1, 'HOLDING');
```

## 14. Common pitfalls

### Test phụ thuộc thứ tự (anti-pattern)
```java
// SAI
@Test
void test1_createUser() { ... }
@Test
void test2_loginUser() { ... }  // dựa vào test1
```

Test PHẢI độc lập. Mỗi test setup riêng dữ liệu. JUnit không guarantee thứ tự.

### Test phụ thuộc DB data
Test chạy trên DB có sẵn data → test pass lần đầu, fail lần 2 (data đã đổi). Fix:
- `@Transactional` + auto rollback
- `@Sql("clean-db.sql")` trước mỗi test
- Testcontainers (DB tươi mỗi suite)

### Mock quá nhiều
```java
// SAI — test "đúng" nhưng feature có thể sai
@Test
void shouldDoBusinessLogic() {
    when(repo.find()).thenReturn(...);
    when(service2.process()).thenReturn(...);
    when(service3.calculate()).thenReturn(100);
    // Chỉ test orchestration, không test logic thật
}
```

Mock vừa đủ. Logic phức tạp cần integration test với DB thật.

### Chỉ test happy path
```java
// THIẾU edge case:
@Test void shouldCreateBooking() { ... }

// Phải thêm:
@Test void shouldFailWhenSeatTaken() { ... }
@Test void shouldFailWhenShowtimeFinished() { ... }
@Test void shouldFailWhenMoreThanMaxSeats() { ... }
@Test void shouldFailWhenUserNotFound() { ... }
```

## 15. Test mẫu hoàn chỉnh cho CineX

### BookingService — Unit test
```java
@ExtendWith(MockitoExtension.class)
class BookingServiceTest {

    @Mock BookingRepository bookingRepo;
    @Mock ShowtimeRepository showtimeRepo;
    @Mock SeatRepository seatRepo;
    @Mock UserRepository userRepo;
    @Mock SystemConfigService configService;
    @Mock SimpMessagingTemplate messagingTemplate;
    @InjectMocks BookingService bookingService;

    @Nested
    @DisplayName("createBooking")
    class CreateBooking {

        @Test
        void shouldCreateWhenAllConditionsMet() {
            when(userRepo.findById(1L)).thenReturn(Optional.of(testUser()));
            when(showtimeRepo.findById(10L)).thenReturn(Optional.of(testShowtime()));
            when(seatRepo.findAllById(List.of(100L, 101L))).thenReturn(testSeats());
            when(bookingRepo.existsByShowtimeAndSeats(10L, List.of(100L, 101L))).thenReturn(false);
            when(configService.getInt("max_seats_per_booking", 8)).thenReturn(8);

            Booking result = bookingService.createBooking(
                new BookingRequest(1L, 10L, List.of(100L, 101L))
            );

            assertThat(result.getStatus()).isEqualTo(BookingStatus.HOLDING);
            assertThat(result.getBookingSeats()).hasSize(2);
            verify(bookingRepo).save(any());
            verify(messagingTemplate).convertAndSend(
                eq("/topic/showtime/10/seats"), any(Object.class)
            );
        }

        @Test
        void shouldFailWhenExceedMaxSeats() {
            when(configService.getInt("max_seats_per_booking", 8)).thenReturn(8);

            List<Long> seatIds = LongStream.range(100, 110).boxed().toList();  // 10 seats

            assertThatThrownBy(() -> bookingService.createBooking(
                new BookingRequest(1L, 10L, seatIds)
            ))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.TOO_MANY_SEATS);
        }
    }

    private User testUser() { ... }
    private Showtime testShowtime() { ... }
    private List<Seat> testSeats() { ... }
}
```

### PaymentController — @WebMvcTest
```java
@WebMvcTest(PaymentController.class)
class PaymentControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean PaymentService paymentService;
    @Autowired ObjectMapper mapper;

    @Test
    @WithMockJwtUser
    void shouldCreatePayment() throws Exception {
        CreatePaymentRequest req = new CreatePaymentRequest(1L, "MOMO");
        PaymentResponse resp = new PaymentResponse(100L, "https://momo.../pay");
        when(paymentService.createPayment(any())).thenReturn(resp);

        mockMvc.perform(post("/api/payments")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(req)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.paymentUrl").value("https://momo.../pay"));
    }

    @Test
    void shouldReturn401WhenNoToken() throws Exception {
        mockMvc.perform(post("/api/payments"))
            .andExpect(status().isUnauthorized());
    }
}
```

### BookingRepository — Testcontainers
```java
class BookingRepositoryTest extends IntegrationTestBase {

    @Autowired BookingRepository bookingRepo;
    @Autowired TestEntityManager em;

    @Test
    void shouldFindExpiredBookings() {
        Booking expired = em.persist(Booking.builder()
            .status(BookingStatus.HOLDING)
            .expiresAt(Instant.now().minus(1, MINUTES))
            .build());
        Booking active = em.persist(Booking.builder()
            .status(BookingStatus.HOLDING)
            .expiresAt(Instant.now().plus(5, MINUTES))
            .build());
        em.flush();

        List<Booking> result = bookingRepo.findExpiredHolding(Instant.now());

        assertThat(result).hasSize(1)
            .extracting(Booking::getId)
            .containsExactly(expired.getId());
    }
}
```

## 16. Câu hỏi tự kiểm tra

**Câu 1:** Khi nào dùng `@SpringBootTest` vs `@WebMvcTest` vs `@DataJpaTest`?

→ `@SpringBootTest`: integration test full stack — chậm, dùng ít. `@WebMvcTest`: chỉ test Controller + Security, mock service — nhanh. `@DataJpaTest`: chỉ test Repository với DB thật/H2 — vừa.

**Câu 2:** Tại sao test phải độc lập, không phụ thuộc thứ tự?

→ JUnit không guarantee thứ tự chạy. Test phụ thuộc nhau → khó debug khi 1 test fail, không chạy được 1 test riêng lẻ, không chạy song song được.

**Câu 3:** Khi nào dùng Testcontainers thay vì H2?

→ Khi code dùng feature đặc thù DB (T-SQL của SQL Server, JSON column của PostgreSQL, ...). H2 emulate không hoàn toàn → test pass nhưng production fail.

**Câu 4:** `@Mock` khác `@Spy` thế nào?

→ `@Mock` thay toàn bộ behavior bằng null/default. `@Spy` giữ behavior gốc, chỉ override method bạn stub. Dùng `@Spy` khi cần test 1 method mà các method khác vẫn chạy thật.

**Câu 5:** Mock email service hay test gửi email thật?

→ Mock. Test thật cần SMTP server → chậm + flaky + spam. Verify mock được gọi với param đúng là đủ.

**Câu 6:** Test coverage 100% có nghĩa code không bug?

→ KHÔNG. Coverage chỉ đo dòng code có chạy qua test hay không, không đo test có assertion tốt không. Code không có assertion → coverage 100% nhưng không catch bug.

**Câu 7:** Test cho `BookingCleanupScheduler.run()` (method `@Scheduled`) viết thế nào?

→ KHÔNG test annotation `@Scheduled`, chỉ test logic bên trong. Tách method `cleanupExpired()` không annotation → unit test method này. Để verify scheduler chạy đúng cron → integration test với `@SpyBean` + Awaitility.
