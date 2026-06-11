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
                                              String totalAmount, byte[] qrCodeBytes) {
        Context ctx = new Context(new Locale("vi", "VN"));
        ctx.setVariable("bookingCode", bookingCode);
        ctx.setVariable("movieTitle", movieTitle);
        ctx.setVariable("roomName", roomName);
        ctx.setVariable("startTime", startTime);
        ctx.setVariable("seats", seats);
        ctx.setVariable("totalAmount", totalAmount);

        String body = templateEngine.process("email/booking-confirmation", ctx);
        String subject = "CineX — Xác nhận đặt vé " + bookingCode;

        sendHtmlEmailWithInlineImage(to, subject, body, "qrcode", qrCodeBytes);
    }

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
