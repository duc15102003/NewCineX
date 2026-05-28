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

## 8. Câu hỏi tự kiểm tra

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
