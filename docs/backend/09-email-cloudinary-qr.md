# Email, Cloudinary, QR Code — Giải thích chi tiết

---

## 1. Spring Mail — Gửi email

### Là gì?
`spring-boot-starter-mail` cho phép gửi email từ ứng dụng Java. Dùng giao thức SMTP (Simple Mail Transfer Protocol).

### Ví dụ đời thường
Giống như bạn nhờ bưu điện (SMTP server) gửi thư. Bạn viết nội dung, dán tem (credentials), ghi địa chỉ người nhận → bưu điện lo phần còn lại.

### Khi nào dùng trong CineX?
| Tình huống | Email gửi gì |
|---|---|
| Đặt vé thành công | Xác nhận + QR code + thông tin suất chiếu |
| Quên mật khẩu | Link reset password (có token, hết hạn sau 15 phút) |
| Suất chiếu bị hủy | Thông báo hoàn tiền |
| Admin tạo tài khoản | Email chào mừng + mật khẩu tạm |

### Cấu hình (application-dev.yml)

```yaml
spring:
  mail:
    host: smtp.gmail.com          # SMTP server (Gmail)
    port: 587                     # Port TLS
    username: ${MAIL_USERNAME}    # Email gửi (VD: cinex.noreply@gmail.com)
    password: ${MAIL_PASSWORD}    # App password (KHÔNG phải password Gmail thường)
    properties:
      mail.smtp.auth: true
      mail.smtp.starttls.enable: true
```

> **Lưu ý:** Gmail yêu cầu "App Password" (vào Google Account → Security → 2FA → App passwords). KHÔNG dùng password Gmail thường.

### Cách dùng

```java
@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    public void sendBookingConfirmation(String to, String bookingCode, String movieTitle) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom("CineX <cinex.noreply@gmail.com>");
        message.setTo(to);
        message.setSubject("Xac nhan dat ve - " + bookingCode);
        message.setText("Chuc mung! Ban da dat ve thanh cong.\n"
            + "Phim: " + movieTitle + "\n"
            + "Ma ve: " + bookingCode + "\n"
            + "Vui long den rap som 15 phut.");
        mailSender.send(message);
    }
}
```

### Email HTML (đẹp hơn)

```java
// Dùng MimeMessage để gửi HTML
public void sendHtmlEmail(String to, String subject, String htmlContent) {
    MimeMessage message = mailSender.createMimeMessage();
    MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
    helper.setTo(to);
    helper.setSubject(subject);
    helper.setText(htmlContent, true); // true = HTML
    mailSender.send(message);
}
```

### Test không cần Gmail thật

Dùng **Mailtrap** (mailtrap.io) — sandbox email, miễn phí, email không gửi thật mà hiện trên dashboard web.

```yaml
# application-dev.yml (dùng Mailtrap cho dev)
spring:
  mail:
    host: sandbox.smtp.mailtrap.io
    port: 2525
    username: ${MAILTRAP_USER}
    password: ${MAILTRAP_PASS}
```

---

## 2. Cloudinary — Upload và quản lý ảnh

### Là gì?
Cloudinary là dịch vụ cloud lưu trữ + xử lý ảnh/video. Free tier: 25GB storage, 25GB bandwidth/tháng — **thừa cho đồ án**.

### Ví dụ đời thường
Giống Google Photos nhưng cho developer. Bạn upload ảnh lên → nhận URL → dùng URL đó ở bất kỳ đâu. Cloudinary tự resize, crop, optimize.

### Khi nào dùng trong CineX?
| Upload gì | Ai upload | Lưu ở đâu |
|---|---|---|
| Poster phim | Admin (tạo/sửa phim) | `Movie.posterUrl` |
| Avatar user | User (cập nhật profile) | `User.avatarUrl` |
| Banner trang chủ | Admin | `SystemConfig` |

### Tại sao không lưu ảnh trên server?
| Lưu local | Cloudinary |
|---|---|
| Mất khi redeploy/reset server | Ảnh tồn tại vĩnh viễn trên cloud |
| Phải tự serve file (tốn bandwidth) | CDN toàn cầu, load nhanh |
| Không resize/crop tự động | URL transform: `w_300,h_450,c_fill` |
| Phức tạp khi scale (nhiều server) | 1 URL dùng ở mọi nơi |

### Đăng ký
1. Vào https://cloudinary.com → Sign up free
2. Dashboard → lấy: `cloud_name`, `api_key`, `api_secret`

### Cấu hình

```yaml
# application-dev.yml
cloudinary:
  cloud-name: ${CLOUDINARY_CLOUD_NAME}
  api-key: ${CLOUDINARY_API_KEY}
  api-secret: ${CLOUDINARY_API_SECRET}
```

```java
@Configuration
public class CloudinaryConfig {

    @Value("${cloudinary.cloud-name}")
    private String cloudName;

    @Value("${cloudinary.api-key}")
    private String apiKey;

    @Value("${cloudinary.api-secret}")
    private String apiSecret;

    @Bean
    public Cloudinary cloudinary() {
        Map<String, String> config = Map.of(
            "cloud_name", cloudName,
            "api_key", apiKey,
            "api_secret", apiSecret
        );
        return new Cloudinary(config);
    }
}
```

### Cách dùng

```java
@Service
@RequiredArgsConstructor
public class FileUploadService {

    private final Cloudinary cloudinary;

    /**
     * Upload ảnh lên Cloudinary
     * @param file MultipartFile từ request
     * @param folder thư mục trên cloud (VD: "movies", "avatars")
     * @return URL ảnh đã upload
     */
    public String uploadImage(MultipartFile file, String folder) {
        try {
            Map<String, Object> options = Map.of(
                "folder", "cinex/" + folder,       // Tổ chức thư mục: cinex/movies/, cinex/avatars/
                "resource_type", "image",
                "overwrite", true
            );
            Map result = cloudinary.uploader().upload(file.getBytes(), options);
            return (String) result.get("secure_url");  // URL https://
        } catch (IOException e) {
            throw new BusinessException(ErrorCode.FILE_UPLOAD_FAILED);
        }
    }

    public void deleteImage(String publicId) {
        cloudinary.uploader().destroy(publicId, Map.of());
    }
}
```

### Controller nhận file

```java
@PostMapping("/api/upload/image")
@PreAuthorize("hasRole('ADMIN')")
public ApiResponse<String> uploadImage(@RequestParam("file") MultipartFile file) {
    // Validate: chỉ cho phép image, max 5MB
    String url = fileUploadService.uploadImage(file, "movies");
    return ApiResponse.success(url);
}
```

### URL transform (không cần code thêm)

```
// Ảnh gốc
https://res.cloudinary.com/cinex/image/upload/v1234/cinex/movies/avengers.jpg

// Resize 300x450, crop fit
https://res.cloudinary.com/cinex/image/upload/w_300,h_450,c_fill/v1234/cinex/movies/avengers.jpg

// Thumbnail 150x150
https://res.cloudinary.com/cinex/image/upload/w_150,h_150,c_thumb/v1234/cinex/movies/avengers.jpg
```

---

## 3. ZXing — Sinh QR Code

### Là gì?
ZXing ("Zebra Crossing") là thư viện Java mã nguồn mở để sinh và đọc mã vạch/QR code. Google phát triển.

### Ví dụ đời thường
Giống máy in nhãn: bạn đưa text vào → nó in ra hình QR. Ai quét hình đó sẽ đọc được text ban đầu.

### Khi nào dùng trong CineX?
| Tình huống | QR chứa gì |
|---|---|
| Vé điện tử | bookingCode (VD: "VC-20260515-001") |
| Email xác nhận | Ảnh QR đính kèm |
| Trang vé trên web | FE render bằng `react-qr-code` (không cần BE) |

### Cách dùng

```java
import com.google.zxing.BarcodeFormat;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.client.j2se.MatrixToImageWriter;

@Service
public class QrCodeService {

    /**
     * Sinh QR code dạng byte array (PNG image)
     * @param content Nội dung encode (VD: bookingCode)
     * @param size Kích thước pixel (VD: 300 = 300x300px)
     * @return byte[] ảnh PNG
     */
    public byte[] generateQrCode(String content, int size) {
        try {
            QRCodeWriter writer = new QRCodeWriter();
            BitMatrix matrix = writer.encode(content, BarcodeFormat.QR_CODE, size, size);

            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            MatrixToImageWriter.writeToStream(matrix, "PNG", outputStream);
            return outputStream.toByteArray();
        } catch (Exception e) {
            throw new BusinessException(ErrorCode.QR_GENERATION_FAILED);
        }
    }

    /**
     * Sinh QR và trả về Base64 string (nhúng vào HTML email)
     */
    public String generateQrCodeBase64(String content, int size) {
        byte[] qrBytes = generateQrCode(content, size);
        return Base64.getEncoder().encodeToString(qrBytes);
    }
}
```

### Dùng trong API vé

```java
@GetMapping("/api/bookings/{id}/qr")
public ResponseEntity<byte[]> getBookingQr(@PathVariable Long id) {
    Booking booking = bookingService.getBookingDetail(id);
    byte[] qrImage = qrCodeService.generateQrCode(booking.getBookingCode(), 300);

    return ResponseEntity.ok()
        .contentType(MediaType.IMAGE_PNG)
        .body(qrImage);
}
```

### Nhúng QR vào email HTML

```java
String qrBase64 = qrCodeService.generateQrCodeBase64(bookingCode, 200);
String html = "<h1>Ve cua ban</h1>"
    + "<p>Ma ve: " + bookingCode + "</p>"
    + "<img src='data:image/png;base64," + qrBase64 + "' />";
emailService.sendHtmlEmail(userEmail, "Xac nhan ve - " + bookingCode, html);
```

---

## 4. react-qr-code — Render QR trên Frontend

### Là gì?
Thư viện React nhẹ (~5KB) render QR code dạng SVG ngay trên trình duyệt. Không cần gọi API backend.

### Tại sao cần cả BE (ZXing) lẫn FE (react-qr-code)?
| | BE (ZXing) | FE (react-qr-code) |
|---|---|---|
| Dùng khi | Gửi email, export PDF | Hiển thị trên web |
| Output | Ảnh PNG (byte[]) | SVG trong DOM |
| Ưu điểm | Ảnh tĩnh, nhúng được | Realtime, không cần API call |

### Cách dùng

```tsx
import QRCode from 'react-qr-code'

function TicketQRCode({ bookingCode }: { bookingCode: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <QRCode
        value={bookingCode}           // Nội dung encode
        size={200}                     // Kích thước pixel
        bgColor="#ffffff"              // Nền trắng
        fgColor="#000000"              // QR đen
        level="M"                      // Error correction: L/M/Q/H
      />
      <p className="text-sm text-gray-500 font-mono">{bookingCode}</p>
    </div>
  )
}

// Sử dụng:
<TicketQRCode bookingCode="VC-20260515-001" />
```

### Error correction level
| Level | Khả năng phục hồi | Khi nào dùng |
|---|---|---|
| L (Low) | 7% | QR hiển thị trên màn hình (sạch) |
| M (Medium) | 15% | Mặc định, phù hợp hầu hết |
| Q (Quartile) | 25% | In trên giấy (có thể bị nhòe) |
| H (High) | 30% | QR có logo ở giữa |

---

## 5. Recharts — Biểu đồ thống kê

### Là gì?
Thư viện biểu đồ cho React, xây trên D3.js nhưng dùng cú pháp React component. Hỗ trợ: Bar, Line, Pie, Area, Radar, ...

### Khi nào dùng trong CineX?
Admin Dashboard hiển thị:
- Doanh thu theo ngày/tuần/tháng (Line chart)
- Booking theo phim (Bar chart)
- Tỷ lệ loại ghế bán được (Pie chart)

### Cách dùng

```tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const data = [
  { name: 'T2', bookings: 45 },
  { name: 'T3', bookings: 62 },
  { name: 'T4', bookings: 58 },
  { name: 'T5', bookings: 71 },
  { name: 'T6', bookings: 89 },
  { name: 'T7', bookings: 120 },
  { name: 'CN', bookings: 135 },
]

function BookingChart() {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="bookings" fill="#3b82f6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
```

### Pie chart (tỷ lệ)

```tsx
import { PieChart, Pie, Cell, Legend } from 'recharts'

const seatData = [
  { name: 'Standard', value: 65 },
  { name: 'VIP', value: 25 },
  { name: 'Couple', value: 10 },
]

const COLORS = ['#3b82f6', '#f59e0b', '#ec4899']

function SeatTypePie() {
  return (
    <PieChart width={300} height={300}>
      <Pie data={seatData} dataKey="value" cx="50%" cy="50%" outerRadius={100}>
        {seatData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
      </Pie>
      <Legend />
    </PieChart>
  )
}
```

---

## 6. Tổng kết — Khi nào dùng cái gì

```
User đặt vé thành công
    ├── FE: react-qr-code → hiện QR trên trang "Vé của tôi"
    ├── BE: ZXing → sinh ảnh QR
    ├── BE: Spring Mail → gửi email xác nhận (kèm QR base64)
    └── BE: Cloudinary → ảnh poster trong email

Admin thêm phim
    ├── FE: <input type="file"> → upload poster
    ├── BE: Cloudinary → lưu ảnh, trả URL
    └── DB: Movie.posterUrl = URL từ Cloudinary

Admin xem Dashboard
    └── FE: Recharts → render biểu đồ từ API thống kê
```

---

## 7. Biến môi trường cần thêm

| Biến | Mô tả | Mặc định dev |
|---|---|---|
| `MAIL_USERNAME` | Email gửi (Gmail/Mailtrap) | (cấu hình khi cần) |
| `MAIL_PASSWORD` | App password | (cấu hình khi cần) |
| `CLOUDINARY_CLOUD_NAME` | Tên cloud Cloudinary | (đăng ký free) |
| `CLOUDINARY_API_KEY` | API key | (từ dashboard) |
| `CLOUDINARY_API_SECRET` | API secret | (từ dashboard) |
