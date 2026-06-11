# Thymeleaf — Template engine cho Email HTML

> Lib `spring-boot-starter-thymeleaf` — render email HTML với variable injection.

---

## 1. Vấn đề: Hardcode HTML email là ác mộng

```java
String html = "<html><body>" +
    "<h1>Xin chào " + user.getFullName() + "</h1>" +
    "<p>Vé của bạn: " + booking.getCode() + "</p>" +
    "<table><tr><td>Phim:</td><td>" + showtime.getMovie().getTitle() + "</td></tr></table>" +
    "</body></html>";
mailService.send(user.getEmail(), "Vé phim", html);
```

Vấn đề:
- HTML nhúng Java string → khó đọc, dễ sai escape
- Designer không sửa được (không hiểu Java)
- Đổi layout phải compile lại
- Không hỗ trợ loop/condition tốt

---

## 2. Giải pháp: Template Thymeleaf

`resources/templates/email/booking-confirmation.html`:

```html
<!DOCTYPE html>
<html xmlns:th="http://www.thymeleaf.org">
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; }
        .header { background: #ffc107; padding: 20px; text-align: center; }
        .header h1 { color: #1a1a1a; margin: 0; }
        .content { padding: 20px; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 8px; border-bottom: 1px solid #eee; }
    </style>
</head>
<body>
    <div class="header">
        <h1>CineX — Xác nhận đặt vé</h1>
    </div>
    <div class="content">
        <p>Xin chào <strong th:text="${userName}">User</strong>,</p>
        <p>Bạn đã đặt vé thành công cho phim <strong th:text="${movieTitle}">Phim</strong>.</p>

        <table>
            <tr><td>Mã vé:</td>             <td th:text="${bookingCode}">CX-...</td></tr>
            <tr><td>Suất chiếu:</td>        <td th:text="${showtimeText}">19:00 ngày 15/06/2026</td></tr>
            <tr><td>Rạp:</td>               <td th:text="${theaterName}">CineX Vincom HN</td></tr>
            <tr><td>Phòng:</td>             <td th:text="${roomName}">Phòng 2</td></tr>
            <tr><td>Ghế:</td>               <td th:text="${seatsText}">A1, A2</td></tr>
            <tr><td>Tổng tiền:</td>         <td th:text="${totalText}">200.000đ</td></tr>
        </table>

        <p>QR Code vé:</p>
        <img th:src="${qrImageUrl}" alt="QR Code" style="width: 200px; height: 200px;" />

        <p style="color: #666; font-size: 12px;">
            Vui lòng đến rạp trước giờ chiếu 15 phút và xuất trình QR code này.
        </p>
    </div>
</body>
</html>
```

---

## 3. Cú pháp Thymeleaf chính

### 3.1. `th:text` — text content (auto escape)

```html
<p th:text="${userName}">Default text</p>
```

- `${userName}` đọc từ context (model variable)
- "Default text" hiển thị khi xem template raw (designer preview)
- Auto escape `<`, `>`, `&` → an toàn XSS

### 3.2. `th:utext` — text RAW (KHÔNG escape)

```html
<p th:utext="${htmlContent}">...</p>
```

Dùng khi content đã trusted HTML (vd description từ rich-text editor). **CẢNH BÁO XSS** nếu content từ user input.

### 3.3. `th:src` / `th:href` — attribute

```html
<img th:src="${qrImageUrl}" />
<a th:href="${ticketUrl}">Xem vé</a>
```

### 3.4. `th:if` / `th:unless` — condition

```html
<p th:if="${snackTotal > 0}">Bắp nước: <span th:text="${snackTotal}">0đ</span></p>
<p th:unless="${voucherCode}">Không áp dụng voucher</p>
```

### 3.5. `th:each` — loop

```html
<tr th:each="seat : ${seats}">
    <td th:text="${seat.row}">A</td>
    <td th:text="${seat.column}">1</td>
    <td th:text="${seat.type}">STANDARD</td>
</tr>
```

### 3.6. `th:fragment` + `th:replace` — reuse

`resources/templates/email/fragments/header.html`:
```html
<div th:fragment="header" class="header">
    <h1>CineX</h1>
</div>
```

`booking-confirmation.html`:
```html
<div th:replace="~{email/fragments/header :: header}"></div>
```

→ Tránh duplicate code khi nhiều email cùng layout chung.

---

## 4. Render trong Spring

```java
@Service
@RequiredArgsConstructor
public class EmailService {
    private final JavaMailSender mailSender;
    private final SpringTemplateEngine templateEngine;

    public void sendBookingConfirmation(Booking booking) {
        Context context = new Context();
        context.setVariable("userName", booking.getUser().getFullName());
        context.setVariable("movieTitle", booking.getShowtime().getMovie().getTitle());
        context.setVariable("bookingCode", booking.getBookingCode());
        context.setVariable("showtimeText", fmtDateTime(booking.getShowtime().getStartTime()));
        context.setVariable("theaterName", booking.getTheater().getName());
        context.setVariable("roomName", booking.getShowtime().getRoom().getName());
        context.setVariable("seatsText", buildSeatsText(booking));
        context.setVariable("totalText", fmtVnd(booking.getTotalAmount()));
        context.setVariable("qrImageUrl", booking.getQrCodeUrl());

        String html = templateEngine.process("email/booking-confirmation", context);

        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
        helper.setTo(booking.getUser().getEmail());
        helper.setSubject("[CineX] Xác nhận đặt vé " + booking.getBookingCode());
        helper.setText(html, true);  // true = HTML
        mailSender.send(message);
    }
}
```

---

## 5. CineX email templates

`backend/src/main/resources/templates/email/`:

| Template | Khi nào gửi? |
|---|---|
| `verify-email.html` | User đăng ký → click link kích hoạt |
| `reset-password.html` | User quên mật khẩu → link đặt lại |
| `booking-confirmation.html` | Thanh toán thành công → kèm QR vé |
| `booking-cancelled.html` | Booking bị hủy / refund |
| `showtime-reminder.html` | 2h trước giờ chiếu (scheduled) |
| `voucher-granted.html` | Nhận voucher mới |

---

## 6. Config Spring Boot

`application.yml`:
```yaml
spring:
  thymeleaf:
    prefix: classpath:/templates/
    suffix: .html
    mode: HTML
    encoding: UTF-8
    cache: true  # prod=true; dev=false để hot-reload
  mail:
    host: ${MAIL_HOST:sandbox.smtp.mailtrap.io}
    port: ${MAIL_PORT:587}
    username: ${MAIL_USERNAME}
    password: ${MAIL_PASSWORD}
    properties:
      mail:
        smtp:
          auth: true
          starttls.enable: true
```

`cache: false` (dev) — designer sửa template không cần restart server.

---

## 7. Async send để không block request

```java
@Service
public class EmailService {

    @Async
    public void sendBookingConfirmation(Booking booking) {
        // ... render + send ...
    }
}
```

`@EnableAsync` ở config. User booking → BE trả về ngay, email gửi background → UX nhanh hơn 2-5s.

Hoặc dùng event listener:

```java
@Component
@RequiredArgsConstructor
public class EmailEventListener {

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    public void onBookingConfirmed(BookingConfirmedEvent event) {
        emailService.sendBookingConfirmation(event.getBooking());
    }
}
```

`AFTER_COMMIT` → chỉ gửi email khi DB commit thành công, tránh gửi mail rồi rollback transaction.

---

## 8. Test local với Mailtrap

[Mailtrap.io](https://mailtrap.io) — sandbox SMTP miễn phí cho dev. Mỗi dev tự setup `application-local.yml`:

```yaml
spring:
  mail:
    username: <your-mailtrap-user>
    password: <your-mailtrap-pass>
```

`application-local.yml` gitignore → secret không leak. Khi test:
1. App gửi mail
2. Mail KHÔNG đến inbox thật
3. Mở Mailtrap web → thấy email + preview HTML + xem text/HTML/raw

→ An toàn, không spam user thật.

---

## 9. Anti-pattern tránh

### 9.1. ❌ `th:utext` cho user input

```html
<p th:utext="${userReviewContent}">...</p>
```

User review chứa `<script>alert(1)</script>` → execute. XSS.

**Fix:** Luôn `th:text` cho user input. Chỉ `th:utext` cho HTML đã trusted (admin tạo).

### 9.2. ❌ Quên `helper.setText(html, true)`

```java
helper.setText(html);  // SAI: gửi text plain, HTML tag hiện như <h1>
```

**Fix:** `setText(html, true)` — flag thứ 2 = isHtml.

### 9.3. ❌ Render template trong transaction dài

```java
@Transactional
public void confirmBooking(...) {
    Booking booking = ...;
    bookingRepository.save(booking);
    emailService.send(booking);  // SAI: render + send trong transaction
}
```

`send()` mất 1-5s → transaction giữ lock DB 5s → block request khác.

**Fix:** `@TransactionalEventListener(AFTER_COMMIT)` + `@Async` (mục 7).

---

## 10. Tham khảo code CineX

| File | Vai trò |
|---|---|
| `common/service/EmailService.java` | Render template + send qua JavaMailSender |
| `resources/templates/email/*.html` | 6 template HTML |
| `module/auth/listener/EmailEventListener.java` | `@TransactionalEventListener` cho registration/booking |
| `application-local.yml.example` | Template config Mailtrap |

---

## 11. Câu hỏi tự kiểm tra

1. **Khác gì `th:text` và `th:utext`?**
   → `th:text` auto escape (an toàn XSS); `th:utext` raw HTML (chỉ dùng cho trusted content).

2. **Tại sao `cache: false` trong dev?**
   → Hot-reload — sửa template không cần restart server, designer làm việc nhanh.

3. **Tại sao dùng `@TransactionalEventListener(AFTER_COMMIT)` cho email?**
   → Đảm bảo DB commit thành công trước khi gửi mail. Nếu transaction rollback → mail không gửi.

4. **`MimeMessageHelper` khác `SimpleMailMessage` ở đâu?**
   → `MimeMessageHelper` hỗ trợ HTML + attachment + charset. `SimpleMailMessage` chỉ text plain.

5. **Mailtrap dùng để làm gì?**
   → Sandbox SMTP cho dev — capture email không gửi thật, preview HTML trên web UI.
