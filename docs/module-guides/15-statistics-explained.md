# Module Statistics — Giải thích chi tiết

## 1. Tổng quan

Module thống kê cung cấp dữ liệu cho **Dashboard** của Admin:
- Tổng quan (overview): booking hôm nay, doanh thu, tổng user/movie/room
- Biểu đồ doanh thu theo ngày (revenue chart)
- Top 5 phim bán chạy nhất (top movies)
- Top 5 snack bán chạy nhất (top snacks)
- Tỉ lệ lấp đầy ghế (occupancy rate)

Ngoài ra hỗ trợ **xuất báo cáo** PDF và Excel từ Frontend.

---

## 2. Danh sách files

| File | Tác dụng | Design Pattern |
|---|---|---|
| `statistics/repository/StatisticsRepository.java` | Chứa toàn bộ JPQL query thống kê | Repository (Standalone) |
| `statistics/service/StatisticsService.java` | Điều phối gọi repository, xử lý business logic | Service Layer |
| `statistics/controller/StatisticsController.java` | Nhận request, trả ApiResponse | Controller |
| `statistics/dto/OverviewStatistics.java` | DTO tổng quan dashboard | DTO + Builder |
| `statistics/dto/RevenueStatistics.java` | DTO doanh thu theo ngày | DTO |
| `statistics/dto/TopMovieStatistics.java` | DTO top phim bán chạy | DTO |
| `statistics/dto/TopSnackStatistics.java` | DTO top snack bán chạy | DTO |
| `statistics/dto/OccupancyStatistics.java` | DTO tỉ lệ lấp đầy ghế | DTO |
| `frontend/src/utils/export.ts` | Hàm xuất PDF và Excel, hỗ trợ nhiều bảng (sections) | ExportSection Pattern |
| `frontend/src/utils/roboto-font.ts` | Font Roboto base64 embed cho tiếng Việt trong PDF | Font Embedding |
| `frontend/src/features/admin/DashboardPage.tsx` | Trang Dashboard, gọi xuất PDF/Excel | Page Component |

---

## 3. Design Patterns

### 3.1 Standalone @Repository — Custom Repository cho query phức tạp

#### Bài toán đặt ra

Thống kê cần **JOIN nhiều bảng** cùng lúc:
- Top phim: BookingSeat -> Booking -> Showtime -> Movie (4 bảng)
- Top snack: SnackOrderItem -> Snack + SnackOrder (3 bảng)
- Doanh thu: Payment
- Tỉ lệ ghế: Showtime + Room + BookingSeat + Booking

**Vấn đề:** Các query này KHÔNG thuộc 1 entity cụ thể nào. Không thể đặt vào `MovieRepository` hay `BookingRepository`.

#### 3 loại Repository trong Spring Data JPA

```
1. JpaRepository<Entity, ID>
   - Dùng cho: CRUD 1 entity (Movie, User, Booking...)
   - Spring tự tạo implementation (không cần viết code)
   - Ví dụ: MovieRepository extends JpaRepository<Movie, Long>

2. JpaSpecificationExecutor<Entity>
   - Dùng cho: Dynamic WHERE clause (tìm kiếm, lọc dữ liệu)
   - Kết hợp với JpaRepository
   - Ví dụ: MovieRepository extends JpaRepository<Movie, Long>,
                                    JpaSpecificationExecutor<Movie>

3. Standalone @Repository (dùng cho Statistics)
   - Dùng cho: Query phức tạp, JOIN nhiều bảng, thống kê/báo cáo
   - KHÔNG extends JpaRepository (vì không quản lý 1 entity)
   - Tự inject EntityManager
   - Dùng trong các dự án thực tế cho module analytics/reporting
```

#### Ví dụ đời thường

```
JpaRepository = Nhân viên phòng ban A (chỉ quản lý công việc phòng ban A)
Standalone @Repository = Nhân viên liên phòng (tổng hợp số liệu từ nhiều phòng ban)
```

#### So sánh code TRƯỚC và SAU refactor

**TRƯỚC (sai — EntityManager trong Service):**
```java
@Service
public class StatisticsService {
    private final EntityManager entityManager; // SAI! Service không nên biết về JPA

    public OverviewStatistics getOverview() {
        // Service vừa xử lý logic VỪA viết query -> vi phạm Single Responsibility
        Long count = (Long) entityManager.createQuery(
            "SELECT COUNT(b) FROM Booking b WHERE ...").getSingleResult();
        BigDecimal revenue = (BigDecimal) entityManager.createQuery(
            "SELECT SUM(p.amount) FROM Payment p WHERE ...").getSingleResult();
        // ... 7 query khác nữa, tất cả nằm trong Service
    }
}
```

**Tại sao sai?**
- Service KHÔNG nên biết về EntityManager, JPQL, cách truy vấn DB
- Khi thay đổi query -> phải sửa Service (vi phạm Open/Closed)
- Khi viết unit test -> phải mock EntityManager (rất khó)
- Không tái sử dụng được: nơi khác muốn đếm booking -> phải copy query

**SAU (đúng — Repository tách riêng):**
```java
@Repository
public class StatisticsRepository {
    @PersistenceContext
    private EntityManager em; // ĐÚNG! Repository là nơi chứa query

    public Long countTodayBookings(LocalDateTime start, LocalDateTime end) {
        return (Long) em.createQuery(
            "SELECT COUNT(b) FROM Booking b WHERE ...").getSingleResult();
    }
}

@Service
public class StatisticsService {
    private final StatisticsRepository statisticsRepository; // ĐÚNG! Inject Repository

    public OverviewStatistics getOverview() {
        // Service chỉ gọi repository, KHÔNG biết cách query như thế nào
        return OverviewStatistics.builder()
            .todayBookings(statisticsRepository.countTodayBookings(start, end))
            .todayRevenue(statisticsRepository.sumTodayRevenue(start, end))
            .build();
    }
}
```

**Tại sao đúng?**
- Repository lo data access, Service lo business logic -> đúng Single Responsibility
- Đổi query -> chỉ sửa Repository, Service không bị ảnh hưởng
- Unit test dễ: mock StatisticsRepository (1 interface) thay vì mock EntityManager
- Tái sử dụng: gọi `statisticsRepository.countTodayBookings()` ở bất kỳ đâu

#### Khi nào dùng loại Repository nào?

| Tình huống | Loại Repository | Ví dụ |
|---|---|---|
| CRUD 1 entity | `JpaRepository<T, ID>` | `MovieRepository extends JpaRepository<Movie, Long>` |
| Tìm kiếm động | `+ JpaSpecificationExecutor<T>` | Filter/search movies, users |
| JOIN 2+ bảng, thống kê | `@Repository class` + EntityManager | StatisticsRepository |
| Query đơn giản tuỳ chỉnh | `@Query` trên JpaRepository | `findActiveByUsername()` |

---

### 3.2 @PersistenceContext vs @Autowired

```java
// ĐÚNG — @PersistenceContext đảm bảo thread-safe
@PersistenceContext
private EntityManager em;

// SAI — @Autowired có thể gây vấn đề với thread
@Autowired
private EntityManager em;
```

**Giải thích:** `@PersistenceContext` tạo 1 **proxy** EntityManager. Mỗi thread gọi method -> proxy chuyển đến EntityManager riêng của thread đó (thread-safe). `@Autowired` inject trực tiếp 1 instance -> nhiều thread dùng chung -> lỗi.

**Ví dụ đời thường:** `@PersistenceContext` giống như **quầy số lấy bàn** — mỗi người đến lấy 1 bàn riêng. `@Autowired` giống như **1 bàn chung** — nhiều người ngồi 1 bàn gây lộn xộn.

---

### 3.3 Number Casting — Xử lý kiểu dữ liệu SQL Server

#### Vấn đề

```java
// SQL Server trả Integer cho SUM(int_column)
// Nhưng Java cần Long -> ClassCastException!
Long count = (Long) row[0]; // BOOM! java.lang.Integer cannot be cast to java.lang.Long
```

**Tại sao xảy ra?**
- Java: `SUM()` trả `Long` (với MySQL, PostgreSQL)
- SQL Server: `SUM(int)` trả `int`, `SUM(bigint)` trả `bigint`, `COUNT` trả `int`
- JDBC driver chuyển: SQL `int` -> Java `Integer`, SQL `bigint` -> Java `Long`
- Kết quả: CÙNG MỘT JPQL mà MySQL trả Long, SQL Server trả Integer

#### Cách fix — Dùng Number (cha chung)

```java
// SAI — Chỉ đúng với MySQL/PostgreSQL
Long count = (Long) row[0];
BigDecimal revenue = (BigDecimal) row[1];

// ĐÚNG — Hoạt động với MỌI database
long count = ((Number) row[0]).longValue();    // Integer.longValue() = ok
BigDecimal revenue = toBigDecimal(row[1]);      // xử lý mọi kiểu số

private BigDecimal toBigDecimal(Object value) {
    if (value == null) return BigDecimal.ZERO;
    if (value instanceof BigDecimal) return (BigDecimal) value;
    return new BigDecimal(((Number) value).toString());
}
```

**Ví dụ đời thường:** `Number` giống như nói "cho tôi 1 số" — bất kể nó là Integer, Long, hay Double, đều là Number. `.longValue()` giống như nói "chuyển số đó thành Long cho tôi" — luôn thành công.

---

### 3.4 ExportSection Pattern — Gộp nhiều bảng trong 1 file PDF/Excel

#### Bài toán đặt ra

Dashboard có **nhiều loại dữ liệu**: top phim, top snack, doanh thu... Khi xuất báo cáo, user muốn **tất cả nằm trong 1 file PDF** thay vì phải tải 3-4 file riêng lẻ.

**Vấn đề:** Hàm `exportPDF` ban đầu chỉ nhận 1 mảng `rows` → chỉ tạo được 1 bảng. Muốn xuất nhiều bảng cần sửa lại cấu trúc dữ liệu.

#### Giải pháp — ExportSection interface

```typescript
// Mỗi "section" đại diện 1 bảng trong file PDF/Excel
export interface ExportSection {
  label: string                  // Tiêu đề bảng (VD: "Thống kê phim")
  rows: Record<string, any>[]   // Dữ liệu của bảng đó
}

// ExportData mở rộng: có thể truyền sections[] thay vì rows[]
interface ExportData {
  title: string                  // Tiêu đề chung (VD: "Báo cáo thống kê — CineX")
  subtitle?: string              // Phụ đề (VD: "Khoảng thời gian: 01/05 đến 27/05")
  columns: ExportColumn[]        // Cột dùng chung cho mọi bảng
  rows: Record<string, any>[]   // Dữ liệu 1 bảng (dùng khi không có sections)
  fileName: string               // Tên file xuất ra
  sections?: ExportSection[]     // Nhiều bảng (dùng khi có sections)
}
```

#### Ví dụ đời thường

```
Không có sections = 1 trang giấy chỉ có 1 bảng điểm
Có sections      = 1 tập báo cáo gồm nhiều bảng:
                   Bảng 1: Thống kê phim
                   Bảng 2: Thống kê đồ ăn
                   Mỗi bảng có tiêu đề riêng nhưng nằm chung 1 file
```

#### Cách DashboardPage gọi xuất báo cáo

```typescript
// Bước 1: Build danh sách sections từ dữ liệu hiện có
function buildExportSections() {
  const movieRows = (topMovies ?? []).map((m, i) => ({
    rank: i + 1,
    title: m.title,
    quantity: m.ticketCount ?? 0,
    revenue: m.revenue ?? 0,
  }))
  const snackRows = (topSnacks ?? []).map((s, i) => ({
    rank: i + 1,
    title: s.snackName,
    quantity: s.totalQuantitySold ?? 0,
    revenue: s.totalRevenue ?? 0,
  }))

  const sections: ExportSection[] = []
  if (movieRows.length > 0) sections.push({ label: 'Thống kê phim', rows: movieRows })
  if (snackRows.length > 0) sections.push({ label: 'Thống kê đồ ăn', rows: snackRows })
  return { sections, movieRows, snackRows }
}

// Bước 2: Gọi exportPDF hoặc exportExcel
function handleExport(type: 'pdf' | 'excel') {
  const { sections, movieRows } = buildExportSections()
  const params = {
    title: 'Báo cáo thống kê — CineX',
    subtitle: `Khoảng thời gian: ${dateLabel}`,
    columns: exportColumns,        // Cột dùng chung: STT, Tên, Số lượng, Doanh thu
    rows: movieRows,               // Fallback nếu không có sections
    fileName: 'cinex-thong-ke',
    sections,                      // Nhiều bảng
  }
  type === 'pdf' ? exportPDF(params) : exportExcel(params)
}
```

#### Luồng render PDF với sections

```
exportPDF() nhận sections[]
    |
    v
Vẽ tiêu đề chung (title + subtitle) ở đầu trang
    |
    v
Duyệt từng section:
    |
    ├── Section 1: "Thống kê phim"
    │   ├── Vẽ tiêu đề section (font bold, size 12)
    │   ├── Kiểm tra: còn đủ chỗ trên trang không?
    │   │   ├── Đủ → vẽ bảng tại vị trí hiện tại
    │   │   └── Không đủ → doc.addPage() → vẽ ở trang mới
    │   ├── Gọi autoTable() để vẽ bảng dữ liệu
    │   └── Cập nhật cursorY = finalY + 12 (khoảng cách giữa 2 bảng)
    |
    ├── Section 2: "Thống kê đồ ăn"
    │   └── (tương tự Section 1)
    |
    v
Vẽ footer mỗi trang: "CineX — Trang 1/2"
    |
    v
doc.save("cinex-thong-ke.pdf")
```

**Điểm hay của thiết kế này:**
- **Tự động phân trang:** Nếu bảng quá dài, tự chuyển sang trang mới
- **Khoảng cách tự động:** `cursorY = finalY + 12` — mỗi bảng cách nhau 12px
- **Linh hoạt:** Truyền 1 section hay 10 sections đều hoạt động
- **Tương thích ngược:** Không có sections → dùng `rows` trực tiếp (1 bảng duy nhất)

---

## 4. Font Roboto Embed — Hỗ trợ tiếng Việt trong PDF

### Bài toán

jsPDF mặc định chỉ hỗ trợ font **Helvetica** — font này KHÔNG có ký tự tiếng Việt (ă, ơ, ư, ê, đ...). Khi xuất PDF với tiếng Việt, các ký tự đặc biệt sẽ hiển thị thành **ô vuông** hoặc **dấu ?**.

### Giải pháp — Embed font Roboto dạng base64

```
Bước 1: Tải font Roboto (.ttf) từ Google Fonts
Bước 2: Chuyển file .ttf thành chuỗi base64 (dùng tool online hoặc Node.js)
Bước 3: Lưu vào file roboto-font.ts:
        export const ROBOTO_REGULAR = "AAEAAAA..." (chuỗi base64 rất dài)
        export const ROBOTO_BOLD = "AAEAAAA..."
Bước 4: Import và đăng ký font trong jsPDF
```

### Cách đăng ký font trong code

```typescript
// File: utils/export.ts
import { ROBOTO_REGULAR, ROBOTO_BOLD } from './roboto-font'

function createPDF(): jsPDF {
  const doc = new jsPDF()

  // Bước 1: Thêm file font vào Virtual File System (VFS) của jsPDF
  doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR)  // base64 → VFS
  doc.addFileToVFS('Roboto-Bold.ttf', ROBOTO_BOLD)

  // Bước 2: Đăng ký font với jsPDF (tên font, kiểu chữ)
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')   // normal = chữ thường
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold')         // bold = chữ đậm

  // Bước 3: Đặt font mặc định
  doc.setFont('Roboto')

  return doc
}
```

### Ví dụ đời thường

```
jsPDF giống máy in chỉ có sẵn 1 bộ khuôn chữ (Helvetica — chỉ chữ Latin cơ bản).
Muốn in tiếng Việt → phải MUA THÊM bộ khuôn chữ (Roboto) rồi LẮP VÀO máy in.

addFileToVFS()  = Mang bộ khuôn chữ đến máy in (chưa lắp)
addFont()       = Lắp bộ khuôn chữ vào máy in (đăng ký sẵn sàng dùng)
setFont()       = Chọn bộ khuôn chữ để in (bắt đầu dùng)
```

### Tại sao dùng Roboto?

| Tiêu chí | Roboto | Helvetica (mặc định) |
|---|---|---|
| Tiếng Việt | Hỗ trợ đầy đủ (ă, ơ, ư, ê, đ...) | Không hỗ trợ |
| Giấy phép | Apache 2.0 (miễn phí) | Cần mua license |
| Kích thước | ~500KB/font (chấp nhận được) | Có sẵn, 0KB |
| Thiết kế | Hiện đại, dễ đọc trên màn hình | Cổ điển, thiết kế cho in ấn |

### Lưu ý

- File `roboto-font.ts` rất lớn (~1.2MB) vì chứa base64 của 2 file `.ttf`
- Đây là cách **tiêu chuẩn** để embed font vào jsPDF — không có cách nào khác
- Font được load 1 lần khi import module, không ảnh hưởng performance runtime
- autoTable cũng dùng được font Roboto nhờ config: `styles: { font: 'Roboto' }`

---

## 5. Sơ đồ luồng xử lý

### 5.1 GET /api/statistics/top-movies

```
Browser                Frontend              Backend
  |                       |                     |
  |  Click Dashboard      |                     |
  |---------------------> |                     |
  |                       |  GET /api/statistics/top-movies?limit=5
  |                       |---------------------------->|
  |                       |                     |
  |                       |           StatisticsController
  |                       |                |
  |                       |                | getTopMovies(5)
  |                       |                v
  |                       |           StatisticsService
  |                       |                |
  |                       |                | findTopMovies(5)
  |                       |                v
  |                       |           StatisticsRepository
  |                       |                |
  |                       |                | EntityManager.createQuery(JPQL)
  |                       |                v
  |                       |              Hibernate
  |                       |                |
  |                       |                | Sinh SQL từ JPQL:
  |                       |                | SELECT m.id, m.title, m.poster_url,
  |                       |                |        COUNT(bs.id), SUM(bs.price)
  |                       |                | FROM booking_seats bs
  |                       |                | JOIN bookings b ON bs.booking_id = b.id
  |                       |                | JOIN showtimes s ON b.showtime_id = s.id
  |                       |                | JOIN movies m ON s.movie_id = m.id
  |                       |                | WHERE b.status IN ('CONFIRMED','CHECKED_IN')
  |                       |                |   AND bs.status = 'BOOKED'
  |                       |                | GROUP BY m.id, m.title, m.poster_url
  |                       |                | ORDER BY COUNT(bs.id) DESC
  |                       |                | OFFSET 0 ROWS FETCH NEXT 5 ROWS ONLY
  |                       |                v
  |                       |              SQL Server
  |                       |                |
  |                       |                | Trả về Object[][]
  |                       |                v
  |                       |           StatisticsRepository
  |                       |                |
  |                       |                | Map Object[] -> TopMovieStatistics DTO
  |                       |                | Xử lý Number casting (SQL Server Integer -> Java Long)
  |                       |                v
  |                       |           StatisticsService
  |                       |                |
  |                       |                | Trả List<TopMovieStatistics>
  |                       |                v
  |                       |           StatisticsController
  |                       |                |
  |                       |                | Wrap vào ApiResponse.ok(data)
  |                       |                v
  |                       |  JSON Response:
  |                       |  { "data": [ { "movieId": 1, "title": "...",
  |                       |    "ticketCount": 42, "revenue": 4200000 }, ... ] }
  |                       |<----------------------------|
  |  Hiển thị Top 5       |                     |
  |<--------------------- |                     |
```

### 5.2 Luồng xuất PDF với nhiều bảng (sections)

```
User click "Xuất PDF"
    |
    v
handleExport('pdf')
    |
    v
buildExportSections()
    |   Lấy topMovies + topSnacks từ state
    |   Map thành movieRows[], snackRows[]
    |   Tạo sections[]:
    |     [{ label: "Thống kê phim", rows: movieRows },
    |      { label: "Thống kê đồ ăn", rows: snackRows }]
    v
exportPDF({ title, subtitle, columns, rows, fileName, sections })
    |
    v
createPDF()
    |   Tạo jsPDF instance
    |   Embed font Roboto (Regular + Bold) từ base64
    |   Đặt font mặc định = Roboto
    v
Vẽ tiêu đề: "Báo cáo thống kê — CineX" (font 16, màu đen)
Vẽ phụ đề: "Khoảng thời gian: 01/05 đến 27/05" (font 10, màu xám)
    |
    v
Duyệt sections[]:
    |
    ├── Section 0: label = "Thống kê phim"
    │   ├── doc.text("Thống kê phim") — tiêu đề section (font bold 12)
    │   ├── renderTable(movieRows, cursorY)
    │   │   └── autoTable() vẽ bảng: STT | Tên | Số lượng | Doanh thu
    │   └── cursorY = finalY + 12
    │
    ├── Section 1: label = "Thống kê đồ ăn"
    │   ├── Kiểm tra cursorY > pageHeight - 60?
    │   │   ├── Có → doc.addPage(), cursorY = 20
    │   │   └── Không → tiếp tục
    │   ├── doc.text("Thống kê đồ ăn")
    │   └── renderTable(snackRows, cursorY)
    │
    v
Vẽ footer cho mỗi trang: "CineX — Trang 1/2"
    |
    v
doc.save("cinex-thong-ke.pdf") → trình duyệt tải file về
```

### 5.3 Luồng xuất Excel với nhiều bảng

```
User click "Xuất Excel"
    |
    v
handleExport('excel')
    |
    v
buildExportSections() — (giống PDF)
    |
    v
exportExcel({ title, subtitle, columns, rows, fileName, sections })
    |
    v
Tạo allRows[][] (mảng 2 chiều — mỗi phần tử = 1 dòng trong Excel):
    Row 0: ["Báo cáo thống kê — CineX"]          ← merge toàn bộ cột
    Row 1: ["Khoảng thời gian: 01/05 đến 27/05"]  ← merge toàn bộ cột
    Row 2: []                                       ← dòng trống
    |
    v
Duyệt sections[]:
    |
    ├── addSection("Thống kê phim", movieRows)
    │   ├── Row 3: ["Thống kê phim"]    ← merge, làm tiêu đề section
    │   ├── Row 4: ["STT", "Tên", "Số lượng", "Doanh thu"]  ← header cột
    │   ├── Row 5: [1, "Avengers", 42, 4200000]
    │   ├── Row 6: [2, "Spider-Man", 38, 3800000]
    │   └── Row 7: []                    ← dòng trống
    │
    ├── addSection("Thống kê đồ ăn", snackRows)
    │   ├── Row 8: ["Thống kê đồ ăn"]
    │   ├── Row 9: ["STT", "Tên", "Số lượng", "Doanh thu"]
    │   └── ...
    │
    v
XLSX.utils.aoa_to_sheet(allRows)    ← chuyển mảng 2D → worksheet
ws['!merges'] = merges               ← áp dụng merge cells
ws['!cols'] = colWidths              ← tự tính độ rộng cột
    |
    v
XLSX.utils.book_new()               ← tạo workbook
XLSX.utils.book_append_sheet()      ← thêm worksheet vào workbook
XLSX.write(wb, { bookType: 'xlsx' }) ← chuyển thành binary
    |
    v
saveAs(blob, "cinex-thong-ke.xlsx") ← trình duyệt tải file về
```

### 5.4 Lưu ý: Filter booking đã huỷ

```
TRƯỚC fix:
  BookingSeat -> Booking (bất kể status nào)
  -> Tính cả vé đã HUỶ, HẾT HẠN vào thống kê -> SỐ LIỆU SAI

SAU fix:
  BookingSeat -> Booking (CHỈ CONFIRMED + CHECKED_IN)
  -> Loại bỏ: CANCELLED (đã huỷ), EXPIRED (hết hạn), HOLDING (chưa thanh toán)
  -> SỐ LIỆU CHÍNH XÁC
```

Điều này áp dụng cho TẤT CẢ thống kê:
- Top movies: `b.status IN ('CONFIRMED', 'CHECKED_IN')`
- Occupancy: `bs.booking.status IN ('CONFIRMED', 'CHECKED_IN')`
- Revenue: `p.status = 'COMPLETED'` (chỉ tính thanh toán thành công)
- Top snacks: `o.storageState <> 'ARCHIVED'` (chỉ tính đơn chưa xoá)

---

## 6. Khái niệm mới cần biết

### JPQL vs Native SQL

```
JPQL (Java Persistence Query Language):
  "SELECT m FROM Movie m WHERE m.title = :title"
  -> Viết theo TÊN CLASS và TÊN FIELD Java
  -> Hibernate tự chuyển sang SQL của database đang dùng
  -> Thay đổi database (MySQL -> SQL Server) không cần sửa query

Native SQL:
  "SELECT * FROM movies WHERE title = ?"
  -> Viết theo TÊN BẢNG và TÊN CỘT database
  -> Phụ thuộc vào database cụ thể
  -> Thay đổi database -> phải sửa query

Dùng khi nào?
  - Mặc định: dùng JPQL (portable, type-safe)
  - Khi JPQL không đủ: dùng Native SQL (VD: full-text search, window functions)
```

### GROUP BY và Aggregate Functions

```sql
-- GROUP BY: gom nhóm theo 1 hoặc nhiều cột
-- Aggregate: COUNT, SUM, AVG, MIN, MAX (tính trên từng nhóm)

SELECT m.title, COUNT(bs.id), SUM(bs.price)
FROM booking_seats bs
JOIN ...
GROUP BY m.title
-- Kết quả:
-- | Avengers    | 42  | 4200000 |
-- | Spider-Man  | 38  | 3800000 |

-- KHÔNG có GROUP BY -> tính trên TOÀN BỘ dữ liệu:
SELECT COUNT(bs.id), SUM(bs.price) FROM booking_seats bs
-- | 80 | 8000000 | (tổng cộng)
```

### COALESCE — Xử lý NULL an toàn

```sql
-- Vấn đề: Khi không có dữ liệu, SUM() trả NULL (không phải 0)
SELECT SUM(price) FROM payments WHERE 1=0  -- Kết quả: NULL

-- COALESCE: "Nếu NULL thì thay bằng giá trị mặc định"
SELECT COALESCE(SUM(price), 0) FROM payments WHERE 1=0  -- Kết quả: 0

-- Ví dụ đời thường: "Cho tôi số tiền, nếu không có thì ghi là 0"
```

### Subquery — Query lồng nhau

```sql
-- Tìm tỉ lệ lấp đầy ghế cho mỗi suất chiếu:
SELECT s.id, m.title, r.total_seats,
       (SELECT COUNT(bs.id)           -- SUBQUERY: đếm ghế đã đặt
        FROM booking_seats bs
        WHERE bs.showtime_id = s.id
        AND bs.status = 'BOOKED')
FROM showtimes s
JOIN movies m ON s.movie_id = m.id
JOIN rooms r ON s.room_id = r.id

-- Subquery chạy 1 LẦN cho MỖI dòng của query chính
-- Ví dụ: 10 suất chiếu -> subquery chạy 10 lần
-- Hiệu năng: OK với số lượng nhỏ, cần tối ưu nếu lớn
```

### Virtual File System (VFS) trong jsPDF

```
jsPDF không thể đọc file từ ổ cứng (vì chạy trong trình duyệt).
Thay vào đó, nó có 1 "ổ cứng ảo" (VFS) trong bộ nhớ.

addFileToVFS('Roboto.ttf', base64String)
= "Copy file Roboto.ttf vào ổ cứng ảo của jsPDF"

addFont('Roboto.ttf', 'Roboto', 'normal')
= "Đăng ký file trong ổ cứng ảo thành font có thể dùng"

Tại sao dùng base64?
- Trình duyệt không đọc được file hệ thống (bảo mật)
- Base64 = cách mã hoá binary thành text (import được trong JS/TS)
- File .ttf (binary) → base64 (text) → VFS (binary lại) → jsPDF dùng
```

---

## 7. Annotation / API mới sử dụng

| Annotation | Tác dụng | Ví dụ |
|---|---|---|
| `@Repository` | Đánh dấu class là Data Access Layer (Spring quản lý) | `@Repository public class StatisticsRepository` |
| `@PersistenceContext` | Inject EntityManager thread-safe (dùng cho custom repository) | `@PersistenceContext private EntityManager em;` |
| `@Transactional(readOnly = true)` | Mở transaction chỉ đọc — Hibernate tối ưu hiệu năng | Tất cả method thống kê |
| `@SuppressWarnings("unchecked")` | Tắt cảnh báo generic cho `getResultList()` trả `List<Object[]>` | Method dùng JPQL với Object[] |
| `@DateTimeFormat(iso = ISO.DATE)` | Parse query param `2026-05-27` thành `LocalDate` | Controller nhận `from` và `to` |
| `@RequestParam(defaultValue)` | Giá trị mặc định nếu FE không gửi param | `limit` mặc định là 5 |
| `.setMaxResults(limit)` | Giới hạn số dòng trả về (tương đương `LIMIT` trong SQL) | Top 5 movies/snacks |

### Thư viện Frontend cho xuất báo cáo

| Thư viện | Phiên bản | Tác dụng |
|---|---|---|
| `jsPDF` | 4.2.1 | Tạo file PDF từ JavaScript |
| `jspdf-autotable` | 5.0.8 | Plugin tạo bảng (table) trong PDF, hỗ trợ phân trang tự động |
| `xlsx (SheetJS)` | 0.18.5 | Tạo file Excel (.xlsx), hỗ trợ merge cells và auto column width |
| `file-saver` | 2.0.5 | Trigger download file từ browser (tạo thẻ `<a>` ẩn rồi click) |

---

## 8. SQL được sinh ra

### Top 5 phim bán chạy

```sql
-- JPQL:
SELECT m.id, m.title, m.posterUrl, COUNT(bs), SUM(bs.price)
FROM BookingSeat bs
JOIN bs.booking b
JOIN b.showtime s
JOIN s.movie m
WHERE b.status IN ('CONFIRMED', 'CHECKED_IN')
AND bs.status = 'BOOKED'
GROUP BY m.id, m.title, m.posterUrl
ORDER BY COUNT(bs) DESC

-- SQL sinh ra (SQL Server):
SELECT m1_0.id, m1_0.title, m1_0.poster_url,
       COUNT(bs1_0.id), SUM(bs1_0.price)
FROM booking_seats bs1_0
JOIN bookings b1_0 ON bs1_0.booking_id = b1_0.id
JOIN showtimes s1_0 ON b1_0.showtime_id = s1_0.id
JOIN movies m1_0 ON s1_0.movie_id = m1_0.id
WHERE b1_0.status IN ('CONFIRMED', 'CHECKED_IN')
  AND bs1_0.status = 'BOOKED'
GROUP BY m1_0.id, m1_0.title, m1_0.poster_url
ORDER BY COUNT(bs1_0.id) DESC
OFFSET 0 ROWS FETCH NEXT 5 ROWS ONLY
```

### Top 5 snack bán chạy

```sql
-- SQL sinh ra:
SELECT s1_0.id, s1_0.name, s1_0.image_url,
       SUM(oi1_0.quantity),
       SUM(oi1_0.price * oi1_0.quantity)
FROM snack_order_items oi1_0
JOIN snacks s1_0 ON oi1_0.snack_id = s1_0.id
JOIN snack_orders o1_0 ON oi1_0.snack_order_id = o1_0.id
WHERE o1_0.storage_state IS NULL
   OR o1_0.storage_state <> 'ARCHIVED'
GROUP BY s1_0.id, s1_0.name, s1_0.image_url
ORDER BY SUM(oi1_0.quantity) DESC
OFFSET 0 ROWS FETCH NEXT 5 ROWS ONLY
```

---

## 9. Request/Response mẫu

### GET /api/statistics/overview

```bash
curl -X GET http://localhost:8088/api/statistics/overview \
  -H "Authorization: Bearer {admin_jwt_token}"
```

**Response thành công:**
```json
{
  "status": 200,
  "message": "Success",
  "data": {
    "todayBookings": 12,
    "todayRevenue": 2400000,
    "todaySnackRevenue": 560000,
    "totalUsers": 45,
    "totalMovies": 8,
    "totalRooms": 5,
    "totalShowtimesToday": 15
  }
}
```

### GET /api/statistics/top-movies?limit=5

```bash
curl -X GET "http://localhost:8088/api/statistics/top-movies?limit=5" \
  -H "Authorization: Bearer {admin_jwt_token}"
```

**Response:**
```json
{
  "status": 200,
  "message": "Success",
  "data": [
    {
      "movieId": 1,
      "title": "Avengers: Endgame",
      "posterUrl": "https://res.cloudinary.com/.../poster1.jpg",
      "ticketCount": 42,
      "revenue": 4200000
    },
    {
      "movieId": 3,
      "title": "Spider-Man: No Way Home",
      "posterUrl": "https://res.cloudinary.com/.../poster3.jpg",
      "ticketCount": 38,
      "revenue": 3800000
    }
  ]
}
```

### GET /api/statistics/revenue?from=2026-05-01&to=2026-05-27

```json
{
  "data": [
    { "date": "2026-05-01", "revenue": 1500000, "bookingCount": 8 },
    { "date": "2026-05-02", "revenue": 2300000, "bookingCount": 12 },
    { "date": "2026-05-03", "revenue": 0, "bookingCount": 0 }
  ]
}
```

### Response lỗi (chưa đăng nhập):
```json
{
  "status": 401,
  "message": "Unauthorized",
  "data": null
}
```

### Response lỗi (không phải admin):
```json
{
  "status": 403,
  "message": "Access Denied",
  "data": null
}
```

---

## 10. Câu hỏi tự kiểm tra

1. **Tại sao StatisticsRepository không extends JpaRepository như MovieRepository?**
   *Gợi ý: Statistics query nhiều bảng, không quản lý 1 entity cụ thể*

2. **Nếu đổi từ SQL Server sang PostgreSQL, phần nào trong code cần sửa?**
   *Gợi ý: JPQL là portable, nhưng Number casting có thể khác*

3. **Tại sao dùng `((Number) r[0]).longValue()` thay vì `(Long) r[0]`?**
   *Gợi ý: SQL Server trả Integer cho SUM(int), MySQL trả Long*

4. **Nếu bỏ điều kiện `b.status IN ('CONFIRMED', 'CHECKED_IN')` thì điều gì xảy ra?**
   *Gợi ý: Vé bị huỷ vẫn bị tính vào thống kê -> số liệu sai*

5. **Tại sao dùng `@PersistenceContext` thay vì `@Autowired` cho EntityManager?**
   *Gợi ý: Thread-safety — mỗi request cần EntityManager riêng*

6. **Tại sao cần embed font Roboto vào jsPDF? Không dùng font mặc định được không?**
   *Gợi ý: Font Helvetica mặc định không có ký tự tiếng Việt (ă, ơ, ư, đ...)*

7. **ExportSection giải quyết bài toán gì? Nếu không có sections thì code xử lý thế nào?**
   *Gợi ý: Gộp nhiều bảng trong 1 file PDF. Không có sections → dùng rows trực tiếp (1 bảng)*

8. **Trong hàm exportExcel, tại sao cần `ws['!merges']`?**
   *Gợi ý: Merge cells để tiêu đề và section label trải dài toàn bộ cột, không bị cắt nhỏ*

---

## 11. Bổ sung — Cache với Redis

Statistics query đắt (aggregate nhiều bảng) → cache 5-15 phút giảm tải DB.

```java
@Service
@RequiredArgsConstructor
public class StatisticsService {
    private final RedisTemplate<String, String> redisTemplate;
    private final ObjectMapper mapper;
    private final StatisticsRepository repository;

    private static final Duration TTL = Duration.ofMinutes(10);

    public OverviewResponse getOverview(LocalDate from, LocalDate to) {
        String key = String.format("stats:overview:%s:%s", from, to);
        String cached = redisTemplate.opsForValue().get(key);

        if (cached != null) {
            return readValue(cached, OverviewResponse.class);
        }

        OverviewResponse result = computeOverview(from, to);
        redisTemplate.opsForValue().set(key, writeValue(result), TTL);
        return result;
    }
}
```

Cache miss penalty 1 lần, hit nhanh các lần sau.

## 12. Bổ sung — Index khuyến nghị cho query thống kê

```sql
-- Booking by date range + status (revenue, count)
CREATE INDEX idx_bookings_status_created
ON bookings (status, created_at DESC)
WHERE status IN ('CONFIRMED', 'CHECKED_IN');

-- Payment by status + paid_at (revenue)
CREATE INDEX idx_payments_status_paid
ON payments (status, paid_at DESC)
WHERE status = 'SUCCESS';

-- BookingSeat by status + booking_id (occupancy)
CREATE INDEX idx_booking_seats_booking_status
ON booking_seats (booking_id, status);

-- Movie ratings (top movies)
CREATE INDEX idx_movies_rating
ON movies (average_rating DESC, review_count DESC)
WHERE storage_state = 'ACTIVE';

-- Showtime by date (occupancy theo phòng/ngày)
CREATE INDEX idx_showtimes_room_date
ON showtimes (room_id, start_time);
```

## 13. Bổ sung — Endpoint top-snacks + occupancy SQL

### Top snacks
```sql
SELECT
    s.id, s.name, s.image_url,
    SUM(bs.quantity) AS total_sold,
    SUM(bs.quantity * bs.price) AS revenue
FROM booking_snacks bs
JOIN snacks s ON bs.snack_id = s.id
JOIN bookings b ON bs.booking_id = b.id
WHERE b.status IN ('CONFIRMED', 'CHECKED_IN')
  AND b.created_at BETWEEN :from AND :to
GROUP BY s.id, s.name, s.image_url
ORDER BY total_sold DESC
OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY;
```

### Occupancy rate
```sql
SELECT
    r.id, r.name AS room_name,
    COUNT(DISTINCT st.id) AS total_showtimes,
    SUM(seat_counts.total_seats) AS total_capacity,
    SUM(booked_counts.booked_seats) AS total_booked,
    CAST(SUM(booked_counts.booked_seats) AS FLOAT)
        / NULLIF(SUM(seat_counts.total_seats), 0) AS occupancy_rate
FROM rooms r
JOIN showtimes st ON st.room_id = r.id
CROSS APPLY (
    SELECT COUNT(*) AS total_seats FROM seats WHERE room_id = r.id
) seat_counts
CROSS APPLY (
    SELECT COUNT(*) AS booked_seats
    FROM booking_seats bs
    JOIN bookings b ON bs.booking_id = b.id
    WHERE b.showtime_id = st.id AND bs.status IN ('BOOKED', 'CHECKED_IN')
) booked_counts
WHERE st.start_time BETWEEN :from AND :to
GROUP BY r.id, r.name
ORDER BY occupancy_rate DESC;
```
