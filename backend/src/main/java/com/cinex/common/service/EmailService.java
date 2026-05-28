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

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    @Value("${app.mail.from:noreply@cinex.vn}")
    private String fromEmail;

    /**
     * Gửi email reset password — chứa link reset với token.
     * @Async: chạy trên thread riêng, không block response.
     */
    @Async
    public void sendResetPasswordEmail(String to, String resetToken, int expiryMinutes) {
        String resetLink = frontendUrl + "/reset-password?token=" + resetToken;

        String subject = "CineX — Đặt lại mật khẩu";
        String body = """
                <html>
                <body style="font-family: Inter, Arial, sans-serif; padding: 20px; background: #051424; color: #e5e7eb;">
                    <div style="max-width: 500px; margin: 0 auto; background: #0a1929; border-radius: 16px; padding: 32px; border: 1px solid rgba(255,255,255,0.05);">
                        <h2 style="color: #eab308; margin-top: 0;">🔑 Đặt lại mật khẩu</h2>
                        <p style="color: #9ca3af;">Bạn đã yêu cầu đặt lại mật khẩu tài khoản CineX. Nhấn nút bên dưới để tiếp tục:</p>
                        <div style="text-align: center; margin: 28px 0;">
                            <a href="%s" style="background: #eab308; color: #000; padding: 14px 32px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 15px; display: inline-block;">
                                Đặt lại mật khẩu
                            </a>
                        </div>
                        <p style="color: #9ca3af; font-size: 14px;">⏱ Link sẽ hết hạn sau <strong style="color: #eab308;">%d phút</strong>.</p>
                        <p style="color: #6b7280; font-size: 13px;">Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này. Tài khoản của bạn vẫn an toàn.</p>
                        <hr style="border-color: rgba(255,255,255,0.05); margin: 20px 0;">
                        <p style="color: #6b7280; font-size: 12px; text-align: center;">CineX — Hệ thống đặt vé xem phim online</p>
                    </div>
                </body>
                </html>
                """.formatted(resetLink, expiryMinutes);

        sendHtmlEmail(to, subject, body);
    }

    /**
     * Gửi email xác nhận vé sau khi thanh toán thành công — kèm QR code inline.
     */
    @Async
    public void sendBookingConfirmationEmail(String to, String bookingCode, String movieTitle,
                                              String roomName, String startTime, String seats,
                                              String totalAmount, byte[] qrCodeBytes) {
        String subject = "CineX — Xác nhận đặt vé " + bookingCode;
        String body = """
                <html>
                <body style="font-family: Inter, sans-serif; padding: 20px; background: #051424; color: #e5e7eb;">
                    <div style="max-width: 500px; margin: 0 auto; background: #0a1929; border-radius: 16px; padding: 32px; border: 1px solid rgba(255,255,255,0.05);">
                        <h2 style="color: #eab308; margin-top: 0;">🎬 Đặt vé thành công!</h2>
                        <p style="color: #9ca3af;">Cảm ơn bạn đã đặt vé tại CineX. Thông tin vé:</p>
                        <table style="width: 100%%; border-collapse: collapse; margin: 16px 0;">
                            <tr><td style="padding: 8px 0; color: #9ca3af;">Mã vé</td><td style="padding: 8px 0; color: #eab308; font-weight: bold; text-align: right; font-family: monospace;">%s</td></tr>
                            <tr><td style="padding: 8px 0; color: #9ca3af;">Phim</td><td style="padding: 8px 0; color: #fff; text-align: right;">%s</td></tr>
                            <tr><td style="padding: 8px 0; color: #9ca3af;">Phòng</td><td style="padding: 8px 0; color: #fff; text-align: right;">%s</td></tr>
                            <tr><td style="padding: 8px 0; color: #9ca3af;">Suất chiếu</td><td style="padding: 8px 0; color: #fff; text-align: right;">%s</td></tr>
                            <tr><td style="padding: 8px 0; color: #9ca3af;">Ghế</td><td style="padding: 8px 0; color: #fff; text-align: right;">%s</td></tr>
                            <tr style="border-top: 1px solid rgba(255,255,255,0.1);"><td style="padding: 12px 0; color: #fff; font-weight: bold;">Tổng tiền</td><td style="padding: 12px 0; color: #eab308; font-weight: bold; text-align: right; font-size: 18px;">%s</td></tr>
                        </table>
                        <div style="text-align: center; margin: 24px 0;">
                            <p style="color: #9ca3af; font-size: 13px; margin-bottom: 12px;">Xuất trình mã QR tại quầy để vào rạp</p>
                            <div style="background: #fff; display: inline-block; padding: 12px; border-radius: 12px;">
                                <img src="cid:qrcode" alt="QR Code" width="200" height="200" />
                            </div>
                            <p style="color: #eab308; font-family: monospace; font-size: 14px; letter-spacing: 3px; margin-top: 12px;">%s</p>
                        </div>
                        <p style="color: #9ca3af; font-size: 14px; text-align: center;">Chúc bạn xem phim vui vẻ! 🍿</p>
                        <hr style="border-color: rgba(255,255,255,0.05); margin: 20px 0;">
                        <p style="color: #6b7280; font-size: 12px; text-align: center;">CineX — Hệ thống đặt vé xem phim online</p>
                    </div>
                </body>
                </html>
                """.formatted(bookingCode, movieTitle, roomName, startTime, seats, totalAmount, bookingCode);

        sendHtmlEmailWithInlineImage(to, subject, body, "qrcode", qrCodeBytes);
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

    /**
     * Gửi email thông báo hủy vé.
     */
    @Async
    public void sendCancellationEmail(String to, String bookingCode, String movieTitle, String totalAmount) {
        String subject = "CineX — Xác nhận hủy vé " + bookingCode;
        String body = """
                <html>
                <body style="font-family: Inter, sans-serif; padding: 20px; background: #051424; color: #e5e7eb;">
                    <div style="max-width: 500px; margin: 0 auto; background: #0a1929; border-radius: 16px; padding: 32px; border: 1px solid rgba(255,255,255,0.05);">
                        <h2 style="color: #ef4444; margin-top: 0;">❌ Vé đã được hủy</h2>
                        <p style="color: #9ca3af;">Vé của bạn đã được hủy thành công.</p>
                        <table style="width: 100%%; border-collapse: collapse; margin: 16px 0;">
                            <tr><td style="padding: 8px 0; color: #9ca3af;">Mã vé</td><td style="padding: 8px 0; color: #eab308; font-weight: bold; text-align: right; font-family: monospace;">%s</td></tr>
                            <tr><td style="padding: 8px 0; color: #9ca3af;">Phim</td><td style="padding: 8px 0; color: #fff; text-align: right;">%s</td></tr>
                            <tr style="border-top: 1px solid rgba(255,255,255,0.1);"><td style="padding: 12px 0; color: #fff; font-weight: bold;">Số tiền hoàn</td><td style="padding: 12px 0; color: #10b981; font-weight: bold; text-align: right; font-size: 18px;">%s</td></tr>
                        </table>
                        <p style="color: #9ca3af; font-size: 14px;">Số tiền sẽ được hoàn lại trong 1-3 ngày làm việc.</p>
                        <hr style="border-color: rgba(255,255,255,0.05); margin: 20px 0;">
                        <p style="color: #6b7280; font-size: 12px; text-align: center;">CineX — Hệ thống đặt vé xem phim online</p>
                    </div>
                </body>
                </html>
                """.formatted(bookingCode, movieTitle, totalAmount);

        sendHtmlEmail(to, subject, body);
    }

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
}
