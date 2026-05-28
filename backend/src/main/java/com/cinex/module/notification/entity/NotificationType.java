package com.cinex.module.notification.entity;

/**
 * Constants cho notification type.
 *
 * Tại sao dùng class với static String thay vì Enum?
 * → Enum cứng nhắc: thêm loại mới phải recompile
 * → String constants linh hoạt hơn: có thể extend mà không cần sửa code cũ
 * → Phù hợp cho hệ thống có thể mở rộng notification type theo nghiệp vụ
 *
 * Trade-off: Enum an toàn hơn về type-safety, còn String constants linh hoạt hơn.
 * Trong trường hợp này ưu tiên flexibility vì notification types có thể tăng theo feature.
 */
public final class NotificationType {

    private NotificationType() {}

    /** Thông báo liên quan đến booking: đặt vé thành công, hủy vé, sắp chiếu */
    public static final String BOOKING = "BOOKING";

    /** Thông báo khuyến mãi: voucher mới, ưu đãi đặc biệt */
    public static final String PROMOTION = "PROMOTION";

    /** Thông báo hệ thống: bảo trì, cập nhật, thông báo chung */
    public static final String SYSTEM = "SYSTEM";
}
