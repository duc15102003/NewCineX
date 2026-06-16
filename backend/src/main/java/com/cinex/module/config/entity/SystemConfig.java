package com.cinex.module.config.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Bảng cấu hình hệ thống — self-describing.
 *
 * <p><b>Tại sao tự mô tả?</b> Admin (không phải dev) xem trang Cấu hình hệ thống
 * cần thấy label tiếng Việt thân thiện ("Thời gian giữ ghế"), không phải config
 * key kỹ thuật ("booking.hold_minutes"). Trước đây FE phải hardcode metadata cho
 * từng key — vỡ pattern enterprise. Giờ metadata lưu cùng record → một nguồn sự
 * thật, FE chỉ render.
 *
 * <p><b>Phân loại:</b>
 * <ul>
 *   <li>{@code visible = true}: admin care hàng ngày — hiện mặc định trên UI</li>
 *   <li>{@code visible = false}: kỹ thuật/anti-abuse (rate-limit, cache, NO_SHOW
 *       buffer...) — ẩn mặc định, SUPER_ADMIN toggle để xem khi cần debug</li>
 * </ul>
 */
@Entity
@Table(name = "system_config")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SystemConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Key kỹ thuật để code đọc — vd "booking.hold_minutes". KHÔNG hiện cho admin. */
    @Column(name = "config_key", nullable = false, unique = true, length = 100)
    private String configKey;

    /** Giá trị config — string, parse theo type ở caller. */
    @Column(name = "config_value", nullable = false, length = 500)
    private String configValue;

    /** Mô tả dev — không hiện UI, chỉ để audit/log/dev đọc. */
    @Column(length = 255)
    private String description;

    /** Tên thân thiện hiển thị admin — vd "Thời gian giữ ghế". BẮT BUỘC. */
    @Column(length = 200, nullable = false)
    private String label;

    /** Tooltip giải thích chi tiết "đổi giá trị → tác động gì". Optional. */
    @Column(length = 1000)
    private String hint;

    /** Đơn vị hiển thị cạnh giá trị — "phút", "lần", "ngày", "điểm", "giây". */
    @Column(length = 20)
    private String unit;

    /**
     * Nhóm chức năng:
     * <ul>
     *   <li>{@code booking} — Đặt vé</li>
     *   <li>{@code showtime} — Suất chiếu</li>
     *   <li>{@code loyalty} — Tích điểm thành viên</li>
     *   <li>{@code security} — Bảo mật & đăng nhập</li>
     *   <li>{@code dashboard} — Báo cáo & dashboard</li>
     * </ul>
     */
    @Column(length = 50, nullable = false)
    private String category;

    /** Thứ tự hiển thị trong nhóm — số nhỏ lên trước. */
    @Column(name = "display_order")
    private Integer displayOrder;

    /**
     * true = admin care, hiện mặc định.
     * false = kỹ thuật (rate-limit, cache, NO_SHOW buffer) — ẩn mặc định.
     */
    @Column(nullable = false)
    @lombok.Builder.Default
    private boolean visible = true;

    /** Giá trị nhỏ nhất hợp lệ (chỉ số) — null = không giới hạn. */
    @Column(name = "min_value")
    private Integer minValue;

    /** Giá trị lớn nhất hợp lệ (chỉ số) — null = không giới hạn. */
    @Column(name = "max_value")
    private Integer maxValue;
}
