# Common Infra — Giải thích chi tiết

## 1. Tổng quan

Đây là những thành phần **dùng chung** cho toàn bộ dự án, không thuộc riêng module nào:

| Thành phần | Mục đích | File chính |
|---|---|---|
| **AuditLog** | Ghi lại ai sửa gì, lúc nào | `module/audit/service/AuditLogService.java` |
| **SystemConfig** | Cấu hình động đọc từ DB + cache | `module/config/service/SystemConfigService.java` |
| **FileUploadService** | Upload ảnh lên Cloudinary | `common/service/FileUploadService.java` |

---

## 2. Danh sách files

| File | Tác dụng | Design Pattern |
|---|---|---|
| `common/service/FileUploadService.java` | Upload ảnh lên Cloudinary | Single Responsibility |
| `common/config/CloudinaryConfig.java` | Tạo Cloudinary Bean từ config | Configuration |
| `module/audit/entity/AuditLog.java` | Entity map bảng `audit_log` | — |
| `module/audit/dto/AuditLogRequest.java` | Wrap tham số (thay vì truyền 6 string) | DTO |
| `module/audit/repository/AuditLogRepository.java` | Truy vấn audit log | Repository |
| `module/audit/service/AuditLogService.java` | Ghi log thay đổi | — |
| `module/config/entity/SystemConfig.java` | Entity map bảng `system_config` | — |
| `module/config/repository/SystemConfigRepository.java` | Truy vấn config | Repository |
| `module/config/service/SystemConfigService.java` | Đọc config từ cache/DB | Cache-aside |

---

## 3. Design Patterns

### 3.1 Cache-aside Pattern — Giải thích chi tiết

#### Bài toán đặt ra

Trong hệ thống đặt vé, có những **cấu hình** cần đọc liên tục:

```java
// Mỗi lần user hold ghế → đọc config
int maxSeats = configService.getInt("booking.max_seats", 8);
int holdMinutes = configService.getInt("booking.hold_minutes", 10);

// Mỗi lần tạo suất chiếu → đọc config
int buffer = configService.getInt("showtime.buffer_minutes", 15);
```

**Vấn đề:** Nếu mỗi lần đọc config = 1 query SQL:
```sql
SELECT config_value FROM system_config WHERE config_key = 'booking.max_seats'
```
→ 100 user đồng thời hold ghế = 200 query/giây **chỉ để đọc config** — lãng phí vì config gần như không đổi.

#### Cache-aside là gì?

**Ý tưởng cốt lõi:** Giữ 1 bản copy dữ liệu ở nơi đọc nhanh (RAM), chỉ đọc DB khi thực sự cần.

**Ví dụ đời thường — Tủ lạnh:**

Bạn muốn uống nước:
1. Mở tủ lạnh xem có nước không (**đọc cache**)
2. Có → lấy uống ngay (**cache hit** — nhanh, 0ms)
3. Không có → đi siêu thị mua (**đọc DB** — chậm, 5-10ms)
4. Mua về → bỏ vào tủ lạnh (**lưu cache**) + uống

Lần sau muốn uống → tủ lạnh đã có → không cần ra siêu thị nữa.

#### Có 2 kiểu Cache-aside

```
┌──────────────────────────────────────────────────────────┐
│  KIỂU 1: LAZY LOAD (load khi cần)                       │
│                                                          │
│  getConfig("max_seats")                                  │
│       │                                                  │
│       ▼                                                  │
│  cache.get("max_seats")                                  │
│       │                                                  │
│       ├── Có (hit) → trả về "8" (0ms)                   │
│       │                                                  │
│       └── Không có (miss)                                │
│               │                                          │
│               ▼                                          │
│           SELECT FROM system_config (5ms)                │
│               │                                          │
│               ▼                                          │
│           cache.put("max_seats", "8")                    │
│               │                                          │
│               ▼                                          │
│           trả về "8"                                     │
│                                                          │
│  ✅ Ưu: chỉ load những gì cần                           │
│  ❌ Nhược: lần đầu chậm (cold start)                    │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  KIỂU 2: PRE-LOAD ALL (load hết khi khởi động)          │
│  ← MÌNH DÙNG KIỂU NÀY                                  │
│                                                          │
│  Server khởi động                                        │
│       │                                                  │
│       ▼                                                  │
│  @PostConstruct loadAll()                                │
│       │                                                  │
│       ▼                                                  │
│  SELECT * FROM system_config (1 query duy nhất)          │
│       │                                                  │
│       ▼                                                  │
│  Lưu TẤT CẢ vào ConcurrentHashMap                       │
│       │                                                  │
│       ▼                                                  │
│  Từ giờ trở đi: mọi getInt(), getString()                │
│  đều đọc từ HashMap (0ms) — KHÔNG BAO GIỜ query DB      │
│                                                          │
│  ✅ Ưu: không có cold start, luôn nhanh                  │
│  ❌ Nhược: load cả config không cần                      │
│  → Phù hợp khi config ÍT record (5-20 rows)             │
└──────────────────────────────────────────────────────────┘
```

#### Code thực tế — từng dòng giải thích

```java
@Service
@RequiredArgsConstructor
@Slf4j
public class SystemConfigService {

    private final SystemConfigRepository systemConfigRepository;

    // Cache = ConcurrentHashMap lưu trong RAM
    // Key: "booking.max_seats", Value: "8"
    // Tại sao ConcurrentHashMap mà không phải HashMap?
    // → Spring Bean mặc định là SINGLETON (1 instance duy nhất)
    // → 100 request đồng thời = 100 thread cùng đọc/ghi MAP NÀY
    // → HashMap KHÔNG thread-safe → 2 thread ghi đồng thời có thể corrupt data
    // → ConcurrentHashMap lock từng segment → an toàn
    private final ConcurrentHashMap<String, String> cache = new ConcurrentHashMap<>();

    // @PostConstruct = chạy 1 lần DUY NHẤT sau khi Bean được tạo
    // Thứ tự: Constructor → @Autowired inject dependencies → @PostConstruct
    // → Lúc này systemConfigRepository đã sẵn sàng → query DB được
    @PostConstruct
    public void loadAll() {
        List<SystemConfig> configs = systemConfigRepository.findAll();
        // SQL: SELECT * FROM system_config
        // → Trả về VD: [{key: "booking.max_seats", value: "8"},
        //               {key: "booking.hold_minutes", value: "10"},
        //               {key: "showtime.buffer_minutes", value: "15"}]

        cache.clear();  // Xóa cache cũ (phòng trường hợp reload)
        configs.forEach(c -> cache.put(c.getConfigKey(), c.getConfigValue()));
        // Cache giờ = {"booking.max_seats": "8", "booking.hold_minutes": "10", ...}

        log.info("Loaded {} system configs into cache", configs.size());
        // Log: "Loaded 3 system configs into cache"
    }

    // Đọc config — LUÔN đọc từ cache, KHÔNG query DB
    public int getInt(String key, int defaultValue) {
        String value = cache.get(key);  // HashMap lookup = O(1) = gần 0ms
        if (value == null) return defaultValue;  // Key không tồn tại → dùng default
        try {
            return Integer.parseInt(value);  // "8" → 8
        } catch (NumberFormatException e) {
            // Value = "abc" mà gọi getInt() → log warning + trả default
            // KHÔNG throw exception → không làm crash ứng dụng
            log.warn("Config '{}' = '{}' is not a valid integer", key, value);
            return defaultValue;
        }
    }

    // Admin sửa config → CẬP NHẬT CẢ DB LẪN CACHE cùng lúc
    @Transactional
    public void updateConfig(String key, String value) {
        SystemConfig config = systemConfigRepository.findByConfigKey(key)
                .orElseGet(() -> SystemConfig.builder().configKey(key).build());
        config.setConfigValue(value);
        systemConfigRepository.save(config);  // Lưu DB
        cache.put(key, value);                // Cập nhật cache ngay
        // → Từ giờ getInt(key) đọc cache sẽ trả giá trị mới
    }

    // Reload toàn bộ cache từ DB (dùng khi cần sync lại)
    public void reload() {
        loadAll();
    }
}
```

#### Vấn đề "cache bị cũ" (stale cache)

**Câu hỏi:** Nếu ai đó sửa trực tiếp trong DB (bằng SQL query) mà không qua `updateConfig()`, cache có biết không?

```
Admin sửa DB trực tiếp:
    UPDATE system_config SET config_value = '5' WHERE config_key = 'booking.max_seats'

Cache trong RAM vẫn giữ: {"booking.max_seats": "8"}  ← CŨ!
→ getInt("booking.max_seats", 8) vẫn trả 8 chứ không phải 5
→ Cache bị STALE (cũ, không đồng bộ với DB)
```

**Giải pháp:**
1. **Quy tắc:** Luôn sửa config qua `updateConfig()` (cập nhật cả DB + cache)
2. **Phòng trường hợp:** Gọi `reload()` để force refresh cache từ DB
3. **Nâng cấp sau:** Dùng Redis pub/sub hoặc scheduled task reload định kỳ

#### Multi-instance (chạy nhiều server)

```
┌──────────────┐    ┌──────────────┐
│  Server A    │    │  Server B    │
│  cache: 8    │    │  cache: 8    │
└──────────────┘    └──────────────┘

Admin gọi updateConfig() vào Server A:
┌──────────────┐    ┌──────────────┐
│  Server A    │    │  Server B    │
│  cache: 5 ✅ │    │  cache: 8 ❌ │  ← Server B không biết!
│  DB: 5       │    │              │
└──────────────┘    └──────────────┘
```

**Vấn đề:** ConcurrentHashMap là in-memory — chỉ nằm trong 1 JVM. Server B không biết cache Server A đã thay đổi.

**Giải pháp cho production (nâng cấp sau):**
- Dùng **Redis** làm cache chung (thay vì ConcurrentHashMap)
- Hoặc dùng **message queue** (Kafka/Redis pub-sub) để broadcast khi config thay đổi
- Hiện tại project chỉ chạy 1 instance → ConcurrentHashMap là đủ và đơn giản

#### So sánh: Không dùng cache vs Có dùng cache

```
❌ KHÔNG có cache:
    BookingService.holdSeats()
        → getInt("booking.max_seats", 8)
            → SELECT config_value FROM system_config WHERE config_key = 'booking.max_seats'  (5ms)
        → getInt("booking.hold_minutes", 10)
            → SELECT config_value FROM system_config WHERE config_key = 'booking.hold_minutes'  (5ms)
    Tổng: 10ms cho 2 config reads

    100 users đồng thời = 200 query/giây CHỈ ĐỂ ĐỌC CONFIG

✅ CÓ cache:
    BookingService.holdSeats()
        → getInt("booking.max_seats", 8)
            → cache.get("booking.max_seats")  (0.001ms)
        → getInt("booking.hold_minutes", 10)
            → cache.get("booking.hold_minutes")  (0.001ms)
    Tổng: 0.002ms cho 2 config reads

    100 users đồng thời = 0 query/giây → DB không bị tải
```

---

### 3.2 AOP (Aspect-Oriented Programming) — Audit Log

#### AOP là gì?
**Cross-cutting concern** = logic cần chạy ở NHIỀU nơi nhưng KHÔNG THUỘC logic chính.

VD: Ghi log thay đổi entity — cần ghi ở MovieService, BookingService, UserService, ... nhưng không liên quan đến logic đặt vé hay CRUD phim.

#### Ví dụ đời thường
Nghĩ như **camera an ninh** trong siêu thị:
- Nhân viên bán hàng (Service) chỉ cần bán hàng — KHÔNG cần tự quay camera
- Camera (Aspect) tự động ghi hình TẤT CẢ người ra vào — nhân viên KHÔNG CẦN BIẾT
- Nếu bỏ camera, siêu thị vẫn hoạt động bình thường (loose coupling)

#### Cách gọi trong code

Hiện tại dùng **thủ công** — gọi `auditLogService.log(...)` khi cần:

```java
// Trong BookingService (sẽ viết ở task 009)
public void confirmBooking(Long bookingId) {
    Booking booking = findById(bookingId);
    String oldStatus = booking.getStatus().name();
    booking.setStatus(BookingStatus.CONFIRMED);
    save(booking);

    // Ghi audit log — ai sửa gì, lúc nào
    auditLogService.log(AuditLogRequest.builder()
            .tableName("bookings")
            .recordId(bookingId)
            .action("UPDATE")
            .fieldName("status")
            .oldValue(oldStatus)
            .newValue("CONFIRMED")
            .build());
}
```

#### Propagation.REQUIRES_NEW — Tại sao cần?

```java
@Transactional(propagation = Propagation.REQUIRES_NEW)
public void log(AuditLogRequest request) { ... }
```

**Ví dụ:** holdSeats() đang chạy trong transaction chính, gọi auditLogService.log():

```
Transaction chính: holdSeats()
    ├── INSERT booking ...
    ├── UPDATE seat SET status = 'HELD' ...
    ├── auditLogService.log(...)          ← chạy trong TRANSACTION RIÊNG
    │       └── INSERT audit_log ...      ← COMMIT ngay lập tức
    └── Nếu lỗi ở đây → ROLLBACK transaction chính
                                           nhưng audit_log VẪN ĐƯỢC GHI ✅
```

- Nếu dùng `REQUIRED` (mặc định): audit log cùng transaction → rollback cùng → **mất log**
- Dùng `REQUIRES_NEW`: audit log transaction riêng → ghi xong commit ngay → **không mất**
- Giống camera: ghi hình kể cả khi giao dịch thất bại

---

## 4. Cloudinary & FileUpload — Giải thích chi tiết

### 4.1 Vấn đề: Lưu file ở đâu?

Khi user upload avatar hoặc admin upload poster phim, file đó cần lưu ở đâu?

#### Cách 1: Lưu trên server (KHÔNG dùng)

```
Client gửi ảnh → Server lưu vào /uploads/avatar_123.jpg → Trả URL /uploads/avatar_123.jpg
```

**Vấn đề:**
```
┌───────────────┐    ┌───────────────┐
│  Server A     │    │  Server B     │
│  /uploads/    │    │  /uploads/    │
│  avatar_123 ✅│    │  (trống) ❌   │
└───────────────┘    └───────────────┘

User upload lên Server A → file nằm ở Server A
Request tiếp theo đến Server B (load balancer) → Server B không có file → lỗi 404!
```

Ngoài ra:
- Disk server đầy → phải mua thêm → tốn kém
- Server crash → mất file
- Ảnh load chậm (không có CDN)

#### Cách 2: Lưu trên cloud storage (DÙNG CÁCH NÀY)

```
Client gửi ảnh → Server → Cloudinary (cloud) → Trả URL https://res.cloudinary.com/.../avatar.jpg
                                                     ↑
                                              CDN toàn cầu, load nhanh
```

**Ưu điểm:**
- **Mọi server đều truy cập được** (URL public)
- **CDN sẵn có** — ảnh tự động phân phối qua hàng trăm server CDN toàn cầu
- **Tự động resize** — thêm tham số vào URL: `/w_200,h_200,c_fill/` → ảnh 200x200
- **Không lo disk** — Cloudinary quản lý storage

**Ngoài đời thật:** Hầu hết startup đều dùng cloud storage — AWS S3, Google Cloud Storage, Cloudinary, Firebase Storage. Không ai lưu file trên server cả.

### 4.2 Cloudinary là gì?

Cloudinary là **dịch vụ quản lý ảnh/video trên cloud**. Cung cấp:
- **Upload API** — gửi file lên, nhận URL về
- **CDN** — ảnh load nhanh trên toàn cầu
- **Transformation** — resize, crop, nén ảnh tự động qua URL
- **Free tier** — 25GB storage + 25GB bandwidth/tháng (đủ cho đồ án)

**Ví dụ URL Cloudinary:**
```
https://res.cloudinary.com/cinex/image/upload/v1234567890/cinex/avatars/abc123.jpg
│                          │              │    │           │
│                          cloud_name     │    version     folder/public_id
│                                         │
│                                         resource_type
URL gốc (CDN)
```

Thêm transformation vào URL:
```
.../upload/w_200,h_200,c_fill/cinex/avatars/abc123.jpg
            │     │     │
            width height crop mode (fill = lấp đầy, giữ tỷ lệ)
```

### 4.3 Cách setup Cloudinary

**Bước 1:** Đăng ký tại [cloudinary.com](https://cloudinary.com) → lấy 3 thông tin:
- `cloud_name` — tên cloud (VD: "cinex")
- `api_key` — khóa public (VD: "123456789")
- `api_secret` — khóa bí mật (VD: "abcxyz") ← **KHÔNG được lộ ra ngoài**

**Bước 2:** Set biến môi trường (KHÔNG hardcode trong code):
```bash
export CLOUDINARY_CLOUD_NAME=cinex
export CLOUDINARY_API_KEY=123456789
export CLOUDINARY_API_SECRET=abcxyz
```

**Bước 3:** Config trong `application.yml`:
```yaml
cloudinary:
  cloud-name: ${CLOUDINARY_CLOUD_NAME:your-cloud-name}
  api-key: ${CLOUDINARY_API_KEY:your-api-key}
  api-secret: ${CLOUDINARY_API_SECRET:your-api-secret}
```

`${CLOUDINARY_CLOUD_NAME:your-cloud-name}` nghĩa là:
- Đọc biến môi trường `CLOUDINARY_CLOUD_NAME`
- Nếu không có → dùng giá trị mặc định `your-cloud-name`

### 4.4 CloudinaryConfig — Tạo Bean

```java
@Configuration  // Đánh dấu: class này chứa cấu hình Spring Bean
public class CloudinaryConfig {

    // @Value đọc giá trị từ application.yml
    @Value("${cloudinary.cloud-name}")
    private String cloudName;

    @Value("${cloudinary.api-key}")
    private String apiKey;

    @Value("${cloudinary.api-secret}")
    private String apiSecret;

    @Bean  // Đăng ký Cloudinary object vào Spring Container
    // → các Service khác có thể @Autowired / constructor injection
    public Cloudinary cloudinary() {
        return new Cloudinary(Map.of(
                "cloud_name", cloudName,  // Cloudinary SDK yêu cầu key này
                "api_key", apiKey,
                "api_secret", apiSecret
        ));
    }
}
```

**Tại sao tạo Bean thay vì `new Cloudinary()` trực tiếp trong Service?**
- Tạo Bean 1 lần → dùng chung toàn app (Singleton)
- `new` trực tiếp → mỗi Service tự tạo → tốn RAM, khó test, khó thay đổi config
- Muốn đổi sang S3? → chỉ sửa Config, Service không cần đổi

### 4.5 FileUploadService — Luồng upload từng bước

#### MultipartFile là gì?

Khi client upload file, HTTP request KHÔNG phải JSON mà là `multipart/form-data`:

```
POST /api/users/me/avatar HTTP/1.1
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary

------WebKitFormBoundary
Content-Disposition: form-data; name="file"; filename="avatar.jpg"
Content-Type: image/jpeg

[dữ liệu binary của ảnh ở đây]
------WebKitFormBoundary--
```

Spring Boot nhận file này và wrap thành object `MultipartFile`:
```java
// MultipartFile cung cấp:
file.getOriginalFilename()  // "avatar.jpg"
file.getContentType()       // "image/jpeg"
file.getSize()              // 1048576 (bytes = 1MB)
file.getBytes()             // byte[] — nội dung file
file.isEmpty()              // false
```

#### Cơ chế truyền file: Có mã hóa / nén không?

Đây là câu hỏi quan trọng — nhiều người tưởng file tự động được nén hoặc mã hóa, thực tế:

```
┌─────────────────────────────────────────────────────────────────┐
│  GIAI ĐOẠN 1: Client → Server (của mình)                       │
│                                                                 │
│  Truyền qua: HTTP/HTTPS                                        │
│  Nội dung file: GỬI NGUYÊN binary gốc — KHÔNG NÉN, KHÔNG MÃ HÓA│
│                                                                 │
│  Mã hóa đường truyền?                                          │
│  ├── HTTP  → KHÔNG mã hóa → ai chặn giữa đường đọc được file  │
│  └── HTTPS → CÓ mã hóa TLS → đường truyền an toàn             │
│      (TLS mã hóa toàn bộ HTTP body, kể cả file binary)         │
│                                                                 │
│  ⚠️ TLS chỉ mã hóa ĐƯỜNG TRUYỀN (transit), không mã hóa       │
│     NỘI DUNG file. Server nhận được vẫn là file gốc.           │
│                                                                 │
│  VD: Ảnh 2MB → gửi 2MB qua mạng → Server nhận 2MB             │
│      (HTTPS wrap trong TLS nhưng kích thước gần như không đổi)  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  GIAI ĐOẠN 2: Server → Cloudinary                              │
│                                                                 │
│  Truyền qua: HTTPS (Cloudinary SDK mặc định dùng HTTPS)        │
│  Nội dung: file.getBytes() — gửi NGUYÊN byte[] gốc            │
│                                                                 │
│  KHÔNG nén trước khi gửi — vì:                                 │
│  1. Ảnh JPG/PNG đã là format nén → nén thêm gần như vô ích     │
│  2. Cloudinary sẽ tự tối ưu sau khi nhận (nếu bật "quality")   │
│  3. Nén ở server tốn CPU → chậm thêm mà không lợi bao nhiêu   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  GIAI ĐOẠN 3: Cloudinary nhận file → xử lý                     │
│                                                                 │
│  Cloudinary lưu BẢN GỐC trên cloud storage                     │
│                                                                 │
│  Nếu bật tối ưu (mình đã bật):                                 │
│  ├── "quality": "auto"                                          │
│  │    → Cloudinary phân tích ảnh + chọn mức nén tốt nhất       │
│  │    → Giảm dung lượng 60-80% mà mắt thường không thấy khác   │
│  │    → VD: ảnh 2MB → ~300-500KB                               │
│  │                                                              │
│  └── "fetch_format": "auto"                                     │
│       → Khi client (browser) request ảnh, Cloudinary TỰ ĐỘNG   │
│         chọn format tối ưu theo browser:                        │
│         ├── Chrome/Edge  → WebP (nhẹ hơn JPG 25-35%)           │
│         ├── Safari 16+   → AVIF (nhẹ hơn JPG 50%!)             │
│         └── Browser cũ   → JPG/PNG gốc                         │
│                                                                 │
│  ⚠️ Tối ưu xảy ra khi CLIENT REQUEST ảnh (delivery time),      │
│     KHÔNG phải lúc upload. Cloudinary giữ bản gốc + tạo bản    │
│     tối ưu on-demand.                                           │
└─────────────────────────────────────────────────────────────────┘
```

**Tóm tắt:**

| Giai đoạn | Mã hóa? | Nén? |
|---|---|---|
| Client → Server | HTTPS = có (TLS) | Không |
| Server → Cloudinary | HTTPS = có (TLS) | Không |
| Cloudinary → Client (khi xem ảnh) | HTTPS = có (TLS) | CÓ — quality auto + format auto |

#### Vấn đề trùng tên file

**Câu hỏi:** 2 người upload file cùng tên "avatar.jpg" thì sao?

```java
// Code hiện tại — KHÔNG truyền public_id
cloudinary.uploader().upload(file.getBytes(), ObjectUtils.asMap(
        "folder", "cinex/avatars",
        "resource_type", "image",
        "quality", "auto",
        "fetch_format", "auto"
        // Không có "public_id" → Cloudinary TỰ SINH random ID
));
```

```
User A upload avatar.jpg → cinex/avatars/a1b2c3d4e5f6  (random ID)
User B upload avatar.jpg → cinex/avatars/x7y8z9w0q1r2  (random ID khác)
                                          ↑
                              Cloudinary tự sinh, KHÔNG BAO GIỜ trùng
```

Nếu tự đặt `public_id` theo tên file → 2 user cùng tên sẽ **GHI ĐÈ** nhau:
```java
// ❌ NGUY HIỂM — đừng làm thế này
ObjectUtils.asMap("public_id", file.getOriginalFilename())
// User A: cinex/avatars/avatar.jpg
// User B: cinex/avatars/avatar.jpg  ← GHI ĐÈ User A!
```

#### Luồng upload chi tiết

```
Client (POST /api/users/me/avatar)
│
│  HTTP multipart/form-data + file binary (gửi nguyên gốc qua HTTPS)
│
▼
Spring Boot nhận → wrap thành MultipartFile object (giữ trong RAM)
│
▼
UserController.uploadAvatar(@RequestParam("file") MultipartFile file)
│
│  Tại sao @RequestParam mà không phải @RequestBody?
│  → @RequestBody parse JSON body
│  → @RequestParam lấy giá trị từ form field
│  → File upload dùng form-data, KHÔNG phải JSON
│
▼
UserService.uploadAvatar(file)
│
├── 1. Lấy user hiện tại từ SecurityContext
│
├── 2. Gọi fileUploadService.uploadImage(file, "cinex/avatars")
│       │
│       ├── 3. VALIDATE: kiểm tra file hợp lệ
│       │       ├── file == null || file.isEmpty() → lỗi "File is empty"
│       │       ├── contentType not in (jpeg, png, webp) → lỗi "Only JPG, PNG, WEBP"
│       │       └── size > 2MB → lỗi "File size must not exceed 2MB"
│       │
│       ├── 4. UPLOAD lên Cloudinary qua HTTPS:
│       │       cloudinary.uploader().upload(
│       │           file.getBytes(),              ← byte[] gốc (không nén)
│       │           ObjectUtils.asMap(
│       │               "folder", "cinex/avatars",    ← thư mục trên Cloudinary
│       │               "resource_type", "image",     ← loại resource
│       │               "quality", "auto",            ← Cloudinary tự chọn mức nén
│       │               "fetch_format", "auto"        ← tự chọn format theo browser
│       │           )
│       │       )
│       │
│       │       Cloudinary nhận file → lưu bản gốc + tạo bản tối ưu:
│       │       {
│       │         "public_id": "cinex/avatars/a1b2c3d4",   ← ID unique (tự sinh)
│       │         "secure_url": "https://res.cloudinary.com/.../cinex/avatars/a1b2c3d4.jpg",
│       │         "format": "jpg",
│       │         "width": 500, "height": 500,
│       │         "bytes": 102400                           ← bản gốc 100KB
│       │       }
│       │
│       └── 5. Lấy "secure_url" từ kết quả → return URL
│
├── 6. user.setAvatarUrl(url) → lưu URL vào DB
│       UPDATE users SET avatar_url = 'https://res.cloudinary.com/...' WHERE id = 1
│
└── 7. return UserProfileResponse (có avatarUrl mới)
```

#### Khi client (browser) load ảnh từ URL

```
Browser request: GET https://res.cloudinary.com/.../cinex/avatars/a1b2c3d4.jpg
│
▼
Cloudinary CDN nhận request
│
├── Kiểm tra browser: Chrome → hỗ trợ WebP
│
├── "fetch_format"="auto" → chuyển JPG → WebP (nhẹ hơn 30%)
├── "quality"="auto" → nén mức tối ưu (giữ chất lượng, giảm dung lượng)
│
├── Ảnh gốc: 2MB (JPG)
├── Sau tối ưu: ~300KB (WebP)  ← client nhận bản này
│
└── Trả qua CDN server gần nhất (VD: Singapore cho user VN)
```

#### Tại sao validate ở server mà không chỉ ở client?

```
❌ Chỉ validate ở client (frontend):
   → Hacker dùng curl/Postman gửi file .exe giả dạng ảnh → server nhận → upload lên cloud
   → Hoặc gửi file 100MB → server OOM (Out of Memory)

✅ Validate ở CẢ client + server:
   → Client validate: cho UX tốt (báo lỗi nhanh, không cần chờ upload)
   → Server validate: bảo mật (chặn request bất hợp pháp)
   → Quy tắc: KHÔNG BAO GIỜ tin client — luôn validate ở server
```

#### Config giới hạn file size

```yaml
# application.yml
spring:
  servlet:
    multipart:
      max-file-size: 2MB        # Giới hạn 1 file tối đa 2MB
      max-request-size: 2MB     # Giới hạn toàn bộ request tối đa 2MB
```

Nếu client gửi file > 2MB → Spring trả 413 (Payload Too Large) TRƯỚC KHI code chạy.
`FileUploadService.validateImage()` là lớp bảo vệ thứ 2 (defense in depth).

### 4.6 So sánh Cloudinary vs AWS S3

| | AWS S3 | Cloudinary |
|---|---|---|
| **Bản chất** | Kho chứa file thô (mọi loại) | Kho chứa + xử lý ảnh/video |
| **Ví dụ** | Nhà kho thuê — gửi gì cũng được | Tiệm rửa ảnh — gửi ảnh vào, họ cắt, resize, nén |
| **CDN** | Phải setup thêm CloudFront | Có sẵn |
| **Resize ảnh** | Tự viết code hoặc dùng Lambda | Thêm vào URL: `/w_200,h_200/` |
| **Giá** | Rẻ hơn (trả theo GB) | Đắt hơn, nhưng free tier đủ cho đồ án |
| **Setup** | Phức tạp (IAM, bucket policy, CORS) | Đơn giản (3 key là xong) |
| **Khi nào dùng** | Dự án lớn, nhiều loại file, budget | Dự án cần ảnh/video, muốn nhanh |

Thực tế nhiều công ty dùng **cả hai**: S3 lưu file gốc (backup, PDF, log), Cloudinary/imgix xử lý ảnh hiển thị cho user.

---

## 5. Khái niệm mới cần biết

### @PostConstruct
- Method chạy **1 lần duy nhất** sau khi Bean được tạo + inject dependencies xong
- Thứ tự: `Constructor` → `@Autowired inject` → `@PostConstruct`
- Dùng cho: khởi tạo cache, load config, validate trạng thái ban đầu
- Tương tự: `afterPropertiesSet()` trong `InitializingBean` interface

### ConcurrentHashMap vs HashMap
- **HashMap:** KHÔNG thread-safe — 2 thread ghi đồng thời có thể corrupt data (vòng lặp vô hạn, mất record)
- **ConcurrentHashMap:** Thread-safe — lock từng segment (không lock toàn bộ map) → nhiều thread đọc/ghi đồng thời an toàn
- **Khi nào dùng:** Bất kỳ khi nào Map được share giữa nhiều thread (Spring singleton bean = 1 instance, nhiều request/thread truy cập)

### Propagation.REQUIRES_NEW
- Tạo transaction MỚI, độc lập với transaction đang chạy
- Transaction chính rollback → transaction mới VẪN COMMIT
- Dùng cho: audit log, notification — cần ghi ngay cả khi logic chính fail

### MultipartFile
- Interface của Spring nhận file upload từ client
- Client phải gửi `Content-Type: multipart/form-data` (không phải JSON)
- Controller dùng `@RequestParam("file")` (không phải `@RequestBody`)
- Cung cấp: `getBytes()`, `getContentType()`, `getSize()`, `getOriginalFilename()`

### CDN (Content Delivery Network)
- Mạng lưới server phân tán toàn cầu, cache nội dung tĩnh (ảnh, CSS, JS)
- User ở VN → CDN trả ảnh từ server Singapore (gần) thay vì từ Mỹ (xa)
- Cloudinary có CDN sẵn → không cần setup riêng

### Environment Variables (biến môi trường)
- Lưu giá trị bí mật (API key, DB password) NGOÀI code
- KHÔNG hardcode trong code → vì code push lên Git → lộ secret
- Đọc trong Spring: `${CLOUDINARY_API_KEY:default_value}`
- Set bằng: `export KEY=VALUE` hoặc file `.env`

---

## 6. Annotation mới sử dụng

| Annotation | Tác dụng | Ví dụ |
|---|---|---|
| `@PostConstruct` | Chạy 1 lần sau khi Bean được tạo | `SystemConfigService.loadAll()` |
| `@Transactional(propagation = REQUIRES_NEW)` | Tạo transaction độc lập | `AuditLogService.log()` |
| `@Configuration` | Đánh dấu class chứa cấu hình Bean | `CloudinaryConfig` |
| `@Bean` | Đăng ký object vào Spring Container | `CloudinaryConfig.cloudinary()` |
| `@Value("${key}")` | Đọc giá trị từ application.yml | `CloudinaryConfig` |
| `@RequestParam("file")` | Nhận file upload (multipart) | `UserController.uploadAvatar()` |

---

## 7. SQL được sinh ra

```sql
-- SystemConfigService.loadAll() — load tất cả config
SELECT id, config_key, config_value, description FROM system_config

-- SystemConfigService.updateConfig() — admin sửa config
SELECT * FROM system_config WHERE config_key = 'booking.max_seats'
UPDATE system_config SET config_value = '5' WHERE id = 1

-- AuditLogService.log() — ghi audit
INSERT INTO audit_log (table_name, record_id, action, field_name,
       old_value, new_value, changed_by, changed_at)
VALUES ('bookings', 1, 'UPDATE', 'status', 'HOLDING', 'CONFIRMED', 'admin', ...)
```

---

## 8. JPA Auditing — Tự động ghi ai tạo, ai sửa, lúc nào

### 8.1 Vấn đề đặt ra

Mỗi khi tạo hoặc sửa một record trong DB, ta cần biết:
- **Ai** tạo record này? (admin? user nào?)
- **Khi nào** tạo?
- **Ai** sửa lần cuối?
- **Khi nào** sửa lần cuối?

Nếu làm thủ công, mỗi Service phải tự set:

```java
// ❌ THỦ CÔNG — phải viết ở MỌI service, MỌI method
public Movie createMovie(MovieRequest request) {
    Movie movie = new Movie();
    movie.setTitle(request.getTitle());

    // Phải tự lấy user hiện tại
    String currentUser = SecurityContextHolder.getContext().getAuthentication().getName();
    movie.setCreatedBy(currentUser);
    movie.setCreatedAt(LocalDateTime.now());
    movie.setUpdatedBy(currentUser);
    movie.setUpdatedAt(LocalDateTime.now());

    return movieRepository.save(movie);
}

public Movie updateMovie(Long id, MovieRequest request) {
    Movie movie = findById(id);
    movie.setTitle(request.getTitle());

    // Lại phải set lần nữa...
    String currentUser = SecurityContextHolder.getContext().getAuthentication().getName();
    movie.setUpdatedBy(currentUser);
    movie.setUpdatedAt(LocalDateTime.now());

    return movieRepository.save(movie);
}
```

**Vấn đề:**
- Lặp code ở **mọi** service, **mọi** method create/update
- Dễ quên (tạo mới mà quên set `createdBy` → DB lưu null)
- Vi phạm **DRY** (Don't Repeat Yourself)

### 8.2 Ví dụ đời thường — Camera an ninh

Nghĩ như **camera an ninh** trong tòa nhà văn phòng:
- Nhân viên chỉ cần bước vào/ra → camera **tự động** ghi lại ai, lúc nào
- Nhân viên **KHÔNG cần** tự chụp ảnh mình rồi ghi vào sổ
- Camera hoạt động **âm thầm** — nhân viên không cần biết nó tồn tại
- Nếu tắt camera, văn phòng vẫn hoạt động bình thường (loose coupling)

JPA Auditing cũng vậy:
- Service chỉ cần gọi `save(entity)` → Spring **tự động** ghi `createdBy`, `createdAt`, `updatedBy`, `updatedAt`
- Service **KHÔNG cần** tự set các field này
- Auditing hoạt động **âm thầm** qua listener

### 8.3 Bốn field audit trong BaseEntity

```java
// File: common/entity/BaseEntity.java

@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)  // ← "camera an ninh" lắng nghe mọi save/update
@Getter
@Setter
public abstract class BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Version
    private Long version;

    @Enumerated(EnumType.STRING)
    @Column(name = "storage_state", length = 20)
    private StorageState storageState = StorageState.ACTIVE;

    // ===== 4 FIELD AUDIT =====

    @CreatedBy                 // Spring tự set khi INSERT (lần đầu save)
    @Column(updatable = false) // KHÔNG cho UPDATE → giữ nguyên người tạo ban đầu
    private String createdBy;

    @LastModifiedBy            // Spring tự set khi INSERT + mỗi lần UPDATE
    private String updatedBy;

    @CreatedDate               // Spring tự set thời gian khi INSERT
    @Column(updatable = false) // KHÔNG cho UPDATE → giữ nguyên thời gian tạo
    private LocalDateTime createdAt;

    @LastModifiedDate          // Spring tự set thời gian mỗi lần UPDATE
    private LocalDateTime updatedAt;
}
```

**Giải thích từng annotation:**

| Annotation | Set khi nào | Ghi đè khi UPDATE? | Ý nghĩa |
|---|---|---|---|
| `@CreatedBy` | INSERT (lần đầu save) | **KHÔNG** (`updatable = false`) | Ai tạo record này |
| `@LastModifiedBy` | INSERT + mỗi lần UPDATE | **CÓ** (ghi đè mỗi lần) | Ai sửa lần cuối |
| `@CreatedDate` | INSERT (lần đầu save) | **KHÔNG** (`updatable = false`) | Tạo lúc nào |
| `@LastModifiedDate` | INSERT + mỗi lần UPDATE | **CÓ** (ghi đè mỗi lần) | Sửa lần cuối lúc nào |

**Tại sao `@CreatedBy` có `@Column(updatable = false)`?**
- Khi Hibernate sinh SQL UPDATE, nó sẽ **bỏ qua** cột `created_by` và `created_at`
- Dù code có set `entity.setCreatedBy("hacker")` → Hibernate vẫn **KHÔNG** update cột đó
- Đảm bảo: ai tạo thì mãi mãi là người đó, không ai sửa được

### 8.4 @EntityListeners(AuditingEntityListener.class) — "Camera an ninh"

```
@EntityListeners(AuditingEntityListener.class)
```

Đây là cơ chế **JPA Lifecycle Callback** — Spring đăng ký một "listener" (người lắng nghe) vào entity. Mỗi khi entity được save hoặc update, listener tự động chạy.

```
┌──────────────────────────────────────────────────────────────┐
│  JPA Entity Lifecycle Events                                  │
│                                                               │
│  ┌─────────┐                                                  │
│  │ @PrePersist  │  ← Trước khi INSERT (entity mới)           │
│  │              │    AuditingEntityListener:                   │
│  │              │    → set @CreatedBy, @CreatedDate            │
│  │              │    → set @LastModifiedBy, @LastModifiedDate  │
│  └─────────┘                                                  │
│       │                                                       │
│       ▼                                                       │
│  INSERT INTO movies (title, created_by, created_at, ...)      │
│                                                               │
│  ┌─────────┐                                                  │
│  │ @PreUpdate   │  ← Trước khi UPDATE (entity đã tồn tại)   │
│  │              │    AuditingEntityListener:                   │
│  │              │    → set @LastModifiedBy, @LastModifiedDate  │
│  │              │    (KHÔNG set @CreatedBy, @CreatedDate)      │
│  └─────────┘                                                  │
│       │                                                       │
│       ▼                                                       │
│  UPDATE movies SET title = '...', updated_by = '...', ...     │
└──────────────────────────────────────────────────────────────┘
```

**Lưu ý quan trọng:**
- `@PrePersist` chạy TRƯỚC INSERT → set cả 4 field (created + updated)
- `@PreUpdate` chạy TRƯỚC UPDATE → chỉ set 2 field (updated)
- `@CreatedBy` và `@CreatedDate` chỉ set **1 lần duy nhất** khi INSERT

### 8.5 JpaAuditingConfig — Cấu hình "ai đang login?"

Annotation `@CreatedBy` và `@LastModifiedBy` cần biết **ai** đang thao tác. Spring hỏi thông tin này qua interface `AuditorAware<T>`.

```java
// File: common/config/JpaAuditingConfig.java

@Configuration
@EnableJpaAuditing(auditorAwareRef = "auditorProvider")
// ↑ Bật tính năng JPA Auditing
// ↑ auditorAwareRef = tên Bean cung cấp thông tin "ai đang login"
public class JpaAuditingConfig {

    @Bean
    public AuditorAware<String> auditorProvider() {
        // AuditorAware<String> → trả về String = username
        // (có thể dùng AuditorAware<Long> nếu muốn lưu user ID thay vì username)
        return () -> {
            // Lấy thông tin Authentication từ SecurityContext
            // SecurityContext = nơi Spring Security lưu user đã login (từ JWT)
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();

            // Trường hợp KHÔNG có ai login:
            // 1. auth == null → chưa qua filter (startup, scheduler)
            // 2. !auth.isAuthenticated() → token hết hạn hoặc sai
            // 3. "anonymousUser" → request không có JWT (public endpoint)
            if (auth == null || !auth.isAuthenticated()
                    || "anonymousUser".equals(auth.getPrincipal())) {
                return Optional.of("system");
                // → Ghi "system" làm người thao tác
                // VD: Scheduler tự dọn booking hết hạn → createdBy = "system"
                //     Liquibase seed data → createdBy = "system"
            }

            return Optional.of(auth.getName());
            // auth.getName() = username từ JWT token
            // VD: admin đăng nhập → createdBy = "admin"
            //     user "vanan" đặt vé → createdBy = "vanan"
        };
    }
}
```

**Giải thích `@EnableJpaAuditing`:**
- Không có annotation này → `@CreatedBy`, `@LastModifiedBy`, `@CreatedDate`, `@LastModifiedDate` **KHÔNG hoạt động**
- Spring cần được "bật công tắc" rõ ràng → đây chính là công tắc đó
- `auditorAwareRef = "auditorProvider"` → chỉ cho Spring biết Bean nào cung cấp username

### 8.6 Luồng hoạt động chi tiết

```
Admin gọi: POST /api/movies  (JWT token chứa username = "admin")
│
▼
JwtAuthFilter: parse JWT → set Authentication("admin") vào SecurityContext
│
▼
MovieController.createMovie(request)
│
▼
MovieService.createMovie(request)
│
├── Movie movie = new Movie();
├── movie.setTitle("Avengers");
├── movieRepository.save(movie);    ← GỌI SAVE
│       │
│       ▼
│   Hibernate phát hiện: entity MỚI (id == null) → chuẩn bị INSERT
│       │
│       ▼
│   @PrePersist event fired → AuditingEntityListener bắt sự kiện
│       │
│       ├── Hỏi AuditorAware: "Ai đang login?"
│       │       └── SecurityContext → Authentication → getName() → "admin"
│       │
│       ├── Set @CreatedBy    = "admin"
│       ├── Set @LastModifiedBy = "admin"
│       ├── Set @CreatedDate    = 2026-05-31T10:30:00
│       └── Set @LastModifiedDate = 2026-05-31T10:30:00
│       │
│       ▼
│   INSERT INTO movies (title, created_by, updated_by, created_at, updated_at, ...)
│   VALUES ('Avengers', 'admin', 'admin', '2026-05-31 10:30:00', '2026-05-31 10:30:00', ...)
│
└── return movie;  ← entity đã có đầy đủ 4 field audit
```

```
Admin gọi: PUT /api/movies/1  (sửa tiêu đề phim)
│
▼
MovieService.updateMovie(1, request)
│
├── Movie movie = findById(1);        ← entity CŨ (id = 1, đã tồn tại)
├── movie.setTitle("Avengers: Endgame");
├── movieRepository.save(movie);       ← GỌI SAVE
│       │
│       ▼
│   Hibernate phát hiện: entity CŨ (id != null) → chuẩn bị UPDATE
│       │
│       ▼
│   @PreUpdate event fired → AuditingEntityListener bắt sự kiện
│       │
│       ├── Hỏi AuditorAware: "Ai đang login?" → "admin"
│       │
│       ├── Set @LastModifiedBy = "admin"        ← CẬP NHẬT
│       └── Set @LastModifiedDate = 2026-05-31T14:00:00  ← CẬP NHẬT
│       │
│       │   @CreatedBy = "admin"          ← GIỮ NGUYÊN (updatable = false)
│       │   @CreatedDate = 2026-05-31T10:30:00  ← GIỮ NGUYÊN (updatable = false)
│       │
│       ▼
│   UPDATE movies SET title = 'Avengers: Endgame',
│                     updated_by = 'admin',
│                     updated_at = '2026-05-31 14:00:00'
│                 WHERE id = 1
│   -- Không có created_by, created_at trong SET clause (updatable = false)
```

### 8.7 Tại sao "system" khi không có ai login?

Có những trường hợp code chạy **không có user login**:

| Trường hợp | Ai gọi? | SecurityContext | AuditorAware trả về |
|---|---|---|---|
| Scheduler dọn booking hết hạn | `@Scheduled` (Spring tự chạy) | **null** (không có HTTP request) | `"system"` |
| Liquibase seed data | Spring Boot startup | **null** | `"system"` |
| API public (không cần login) | Anonymous user | `"anonymousUser"` | `"system"` |
| API cần login | User đã login | `Authentication("vanan")` | `"vanan"` |

```java
// Ví dụ: BookingCleanupScheduler chạy mỗi phút
@Scheduled(fixedRate = 60000)
public void cleanExpiredBookings() {
    // Không có HTTP request → SecurityContext = null
    // → AuditorAware trả "system"

    List<Booking> expired = bookingRepository.findExpired();
    expired.forEach(b -> {
        b.setStatus(BookingStatus.EXPIRED);
        bookingRepository.save(b);
        // → updatedBy = "system", updatedAt = now()
    });
}
```

**Tại sao trả `"system"` thay vì `null`?**
- Nếu trả `Optional.empty()` → Hibernate set `created_by = null` → query WHERE created_by IS NOT NULL sẽ thiếu record
- Trả `"system"` → luôn có giá trị → biết đây là thao tác tự động, không phải user thật
- Dễ debug: thấy `created_by = "system"` → biết ngay đây là scheduler hoặc seed data

### 8.8 So sánh: Thủ công vs JPA Auditing

```java
// ❌ KHÔNG dùng JPA Auditing — phải tự set thủ công
public Movie createMovie(MovieRequest request) {
    Movie movie = new Movie();
    movie.setTitle(request.getTitle());

    // 4 dòng boilerplate — lặp lại ở MỌI service
    String user = SecurityContextHolder.getContext().getAuthentication().getName();
    movie.setCreatedBy(user);
    movie.setCreatedAt(LocalDateTime.now());
    movie.setUpdatedBy(user);
    movie.setUpdatedAt(LocalDateTime.now());

    return movieRepository.save(movie);
}

// Vấn đề:
// 1. Quên set → DB lưu null → bug
// 2. 20 service × 3 method = 60 chỗ phải copy-paste
// 3. Đổi logic (VD: thêm timezone) → sửa 60 chỗ
```

```java
// ✅ CÓ JPA Auditing — Spring tự set, service không cần biết
public Movie createMovie(MovieRequest request) {
    Movie movie = new Movie();
    movie.setTitle(request.getTitle());
    return movieRepository.save(movie);
    // → Spring tự set createdBy, createdAt, updatedBy, updatedAt
    // → KHÔNG THỂ quên
    // → Đổi logic → sửa 1 chỗ (JpaAuditingConfig)
}
```

### 8.9 Khi nào KHÔNG nên dùng JPA Auditing?

- **Import dữ liệu cũ:** Muốn giữ `createdAt` gốc từ hệ thống cũ → JPA Auditing sẽ ghi đè thành `now()`. Giải pháp: tạm tắt auditing hoặc dùng native SQL INSERT.
- **Batch processing:** Insert hàng triệu record → AuditingEntityListener chạy cho **mỗi** entity → chậm. Giải pháp: dùng JDBC batch insert với giá trị audit set sẵn.
- **Entity không cần audit:** Bảng tạm, bảng log → không cần kế thừa `BaseEntity`, tự quản lý.

---

## 9. Câu hỏi tự kiểm tra

1. **Cache-aside có 2 kiểu: Lazy Load vs Pre-Load All. Mình dùng kiểu nào và tại sao?**
   → Pre-Load All vì config ít record (5-20 rows), load hết vào RAM cho nhanh. Lazy Load phù hợp khi data lớn (hàng nghìn record), chỉ load cái cần.

2. **Nếu admin sửa config trực tiếp trong DB (bằng SQL) mà không qua `updateConfig()`, chuyện gì xảy ra?**
   → Cache vẫn giữ giá trị cũ → ứng dụng đọc giá trị sai. Phải gọi `reload()` để sync lại. Đây gọi là "stale cache".

3. **Nếu chạy 2 server (scale), admin sửa config trên Server A, Server B có biết không?**
   → KHÔNG. ConcurrentHashMap là in-memory, chỉ nằm trong 1 JVM. Cần dùng Redis hoặc message queue để đồng bộ.

4. **Tại sao lưu ảnh trên Cloudinary thay vì trên server?**
   → Server stateless (scale nhiều instance, file trên A không thấy ở B), CDN nhanh, tự resize, không lo disk đầy.

5. **Tại sao validate file ở server mà không chỉ ở client?**
   → Client có thể bị bypass (hacker dùng curl/Postman). Server là lớp bảo vệ cuối cùng. Quy tắc: KHÔNG BAO GIỜ tin client.

6. **Tại sao AuditLogService dùng `REQUIRES_NEW`?**
   → Để audit log được ghi kể cả khi transaction chính rollback. Giống camera ghi hình kể cả khi giao dịch thất bại.

7. **`@RequestParam("file")` khác `@RequestBody` thế nào?**
   → `@RequestBody` parse JSON body. `@RequestParam` lấy giá trị từ form field. File upload dùng `multipart/form-data` (không phải JSON) → phải dùng `@RequestParam`.

8. **Nếu bỏ `@EnableJpaAuditing` thì 4 field audit (`createdBy`, `createdAt`, `updatedBy`, `updatedAt`) sẽ ra sao?**
   → Tất cả sẽ là `null`. Annotation `@CreatedBy`, `@CreatedDate`,... chỉ là đánh dấu — nếu không bật `@EnableJpaAuditing`, Spring không đăng ký listener nào cả → không ai set giá trị.

9. **Tại sao `@CreatedBy` có `@Column(updatable = false)` mà `@LastModifiedBy` thì không?**
   → `@CreatedBy` chỉ ghi 1 lần khi INSERT — ai tạo thì mãi là người đó. `@LastModifiedBy` cần ghi đè mỗi lần UPDATE để biết ai sửa lần cuối.

10. **Scheduler chạy `@Scheduled` thì `createdBy` ghi gì? Tại sao không ghi `null`?**
    → Ghi `"system"` vì: (1) tránh `null` gây lỗi query, (2) biết đây là thao tác tự động, không phải user thật, (3) dễ debug và truy vết.
