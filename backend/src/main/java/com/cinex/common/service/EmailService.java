package com.cinex.common.service;

import jakarta.activation.DataSource;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.util.ByteArrayDataSource;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.util.Locale;

/**
 * Email service — render template Thymeleaf rồi gửi qua SMTP.
 *
 * [Single Responsibility Principle]
 * Trước đây: nhúng HTML thẳng trong Java string → khó sửa giao diện, không reusable.
 * Sau khi refactor: HTML nằm ở resources/templates/email/*.html, Java chỉ truyền variables.
 *
 * Lợi ích:
 * - Designer/FE có thể sửa template HTML không cần đụng vào Java
 * - Reuse: thay đổi 1 phần (vd: footer) chỉ cần sửa 1 file template
 * - Test: render template tách biệt việc gửi mail
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;
    // [Dependency Inversion] Inject Thymeleaf TemplateEngine — Spring Boot auto-config.
    private final TemplateEngine templateEngine;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    @Value("${app.mail.from:noreply@cinex.vn}")
    private String fromEmail;

    /**
     * Gửi email xác thực địa chỉ email — chứa link verify với token.
     * User click link → FE gọi BE /api/auth/verify-email?token=xxx → flag emailVerified = true.
     */
    @Async
    public void sendVerificationEmail(String to, String verificationToken, int expiryHours) {
        String verifyLink = frontendUrl + "/verify-email?token=" + verificationToken;

        Context ctx = new Context(new Locale("vi", "VN"));
        ctx.setVariable("verifyLink", verifyLink);
        ctx.setVariable("expiryHours", expiryHours);
        ctx.setVariable("frontendUrl", frontendUrl);

        String body = templateEngine.process("email/verify-email", ctx);
        sendHtmlEmail(to, "CineX — Xác thực địa chỉ email", body);
    }

    /**
     * Gửi email reset password — chứa link reset với token.
     * @Async: chạy trên thread riêng, không block response.
     */
    @Async
    public void sendResetPasswordEmail(String to, String resetToken, int expiryMinutes) {
        String resetLink = frontendUrl + "/reset-password?token=" + resetToken;

        Context ctx = new Context(new Locale("vi", "VN"));
        ctx.setVariable("resetLink", resetLink);
        ctx.setVariable("expiryMinutes", expiryMinutes);
        ctx.setVariable("frontendUrl", frontendUrl);

        String body = templateEngine.process("email/reset-password", ctx);
        sendHtmlEmail(to, "CineX — Đặt lại mật khẩu", body);
    }

    /**
     * Gửi email xác nhận vé sau khi thanh toán thành công — kèm QR code inline (cid:qrcode).
     */
    @Async
    public void sendBookingConfirmationEmail(String to, String bookingCode, String movieTitle,
                                              String roomName, String startTime, String seats,
                                              BookingPricing pricing, byte[] qrCodeBytes) {
        Context ctx = new Context(new Locale("vi", "VN"));
        ctx.setVariable("bookingCode", bookingCode);
        ctx.setVariable("movieTitle", movieTitle);
        ctx.setVariable("roomName", roomName);
        ctx.setVariable("startTime", startTime);
        ctx.setVariable("seats", seats);
        // Pricing breakdown — industry chuẩn hóa đơn VN tách subtotal + VAT.
        ctx.setVariable("subtotal", pricing.subtotal);
        ctx.setVariable("vatAmount", pricing.vat);
        ctx.setVariable("vatPercent", pricing.vatPercent);
        ctx.setVariable("tierDiscount", pricing.tierDiscount);
        ctx.setVariable("tierLabel", pricing.tierLabel);
        ctx.setVariable("groupDiscount", pricing.groupDiscount);
        ctx.setVariable("groupSeatCount", pricing.groupSeatCount);
        ctx.setVariable("totalAmount", pricing.total);

        String body = templateEngine.process("email/booking-confirmation", ctx);
        String subject = "CineX — Xác nhận đặt vé " + bookingCode;

        sendHtmlEmailWithInlineImage(to, subject, body, "qrcode", qrCodeBytes);
    }

    /**
     * Pricing breakdown đã format VND cho email template — tách record này để
     * tránh signature {@code sendBookingConfirmationEmail} có 12+ param.
     *
     * <p>Tất cả field là String đã format ("100.000đ") — template Thymeleaf
     * chỉ render thẳng. Field rỗng/null → template ẩn dòng tương ứng.
     */
    public record BookingPricing(
            String subtotal,
            String vat,
            String vatPercent,
            String tierDiscount,
            String tierLabel,
            String groupDiscount,
            String groupSeatCount,
            String total) {}

    /**
     * Gửi email thông báo hủy vé.
     */
    @Async
    public void sendCancellationEmail(String to, String bookingCode, String movieTitle, String totalAmount) {
        Context ctx = new Context(new Locale("vi", "VN"));
        ctx.setVariable("bookingCode", bookingCode);
        ctx.setVariable("movieTitle", movieTitle);
        ctx.setVariable("totalAmount", totalAmount);

        String body = templateEngine.process("email/cancellation", ctx);
        String subject = "CineX — Xác nhận hủy vé " + bookingCode;

        sendHtmlEmail(to, subject, body);
    }

    /**
     * Cảnh báo NO_SHOW strike trước khi block — gửi khi user đạt 2/3 strike
     * (industry chuẩn CGV/Lotte): "Bạn còn 1 lần NO_SHOW nữa sẽ bị tạm khoá".
     */
    @Async
    public void sendNoShowWarningEmail(String to, String username, int currentCount,
                                       int threshold, int blockDays) {
        Context ctx = new Context(new Locale("vi", "VN"));
        ctx.setVariable("username", username);
        ctx.setVariable("currentCount", currentCount);
        ctx.setVariable("threshold", threshold);
        ctx.setVariable("remaining", threshold - currentCount);
        ctx.setVariable("blockDays", blockDays);

        String body = templateEngine.process("email/no-show-warning", ctx);
        String subject = "CineX — Cảnh báo: bạn đã không đến xem phim " + currentCount + " lần";
        sendHtmlEmail(to, subject, body);
    }

    /**
     * Nhắc khách suất chiếu sắp đến — chuẩn industry (CGV/Lotte): 24h trước
     * + 1h trước. Giảm tỷ lệ NO_SHOW từ 10-15% xuống 5-8%.
     */
    @Async
    public void sendShowtimeReminderEmail(String to, String bookingCode, String movieTitle,
                                          String startTime, String roomName, String theaterName,
                                          String hoursBeforeShow) {
        Context ctx = new Context(new Locale("vi", "VN"));
        ctx.setVariable("bookingCode", bookingCode);
        ctx.setVariable("movieTitle", movieTitle);
        ctx.setVariable("startTime", startTime);
        ctx.setVariable("roomName", roomName);
        ctx.setVariable("theaterName", theaterName);
        ctx.setVariable("hoursBeforeShow", hoursBeforeShow);

        String body = templateEngine.process("email/showtime-reminder", ctx);
        String subject = "CineX — Nhắc nhở: " + movieTitle + " còn " + hoursBeforeShow;
        sendHtmlEmail(to, subject, body);
    }

    /**
     * Email mời đánh giá sau khi xem phim — chuẩn industry (CGV/Lotte/BHD):
     * 24h sau showtime kết thúc, gửi mời rate phim + link đến trang phim để
     * khách viết review. Tăng tỷ lệ feedback từ 2-3% lên 8-12% (industry data).
     */
    @Async
    public void sendPostShowtimeFeedbackEmail(String to, String bookingCode, String movieTitle,
                                               String reviewUrl) {
        Context ctx = new Context(new Locale("vi", "VN"));
        ctx.setVariable("bookingCode", bookingCode);
        ctx.setVariable("movieTitle", movieTitle);
        ctx.setVariable("reviewUrl", reviewUrl);

        String body = templateEngine.process("email/post-showtime-feedback", ctx);
        String subject = "CineX — Bạn thấy phim " + movieTitle + " thế nào?";
        sendHtmlEmail(to, subject, body);
    }

    // ===== Private helpers =====

    private void sendHtmlEmail(String to, String subject, String htmlBody) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(htmlBody, true); // true = HTML
            mailSender.send(message);
            log.info("Email sent to {}: {}", to, subject);
        } catch (MessagingException e) {
            log.error("Failed to send email to {}", to, e);
        }
    }

    private void sendHtmlEmailWithInlineImage(String to, String subject, String htmlBody,
                                               String contentId, byte[] imageBytes) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(htmlBody, true);

            DataSource ds = new ByteArrayDataSource(imageBytes, "image/png");
            helper.addInline(contentId, ds);

            mailSender.send(message);
            log.info("Email with QR sent to {}: {}", to, subject);
        } catch (MessagingException e) {
            log.error("Failed to send email to {}", to, e);
        }
    }
}
