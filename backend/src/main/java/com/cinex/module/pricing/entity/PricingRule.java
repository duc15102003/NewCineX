package com.cinex.module.pricing.entity;

import com.cinex.common.entity.BaseEntity;
import com.cinex.module.theater.entity.Theater;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Entity quy tắc giá (Pricing Rule) — map bảng {@code pricing_rules}.
 *
 * <p><b>Mô hình data-driven theo chuẩn rạp lớn:</b> Admin định nghĩa rule qua UI/DB,
 * KHÔNG hard-code trong source. Khi cần thêm rule mới (vd festival giảm giá 30%), chỉ cần
 * INSERT row mới — không cần deploy code.
 *
 * <p><b>Cách rule áp dụng vào giá ghế:</b>
 * <pre>
 *   finalPrice = basePrice × (multiplierPercent / 100)
 * </pre>
 * Ví dụ:
 * <ul>
 *   <li>weekend rule với {@code multiplier_percent = 120.00} → giá weekend = 120% giá base</li>
 *   <li>morning discount {@code 80.00} → giá sáng = 80% giá base (giảm 20%)</li>
 * </ul>
 *
 * <p>Khi nhiều rule cùng áp dụng (vd weekend tối) → multiplier nhân chained:
 * {@code 1.10 (weekend) × 1.20 (prime time) = 1.32 (tăng 32%)}.
 */
@Entity
@Table(name = "pricing_rules")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PricingRule extends BaseEntity {

    /**
     * Chi nhánh áp dụng. NULL = rule DEFAULT toàn hệ thống.
     * Engine resolution: cùng code → theater-specific WIN (override) toàn bộ global.
     * Code uniqueness được đảm bảo bằng filtered unique index (xem migration 065).
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "theater_id")
    private Theater theater;

    /**
     * Mã rule dạng dễ nhớ. VD "WEEKEND", "PRIME-TIME", "TET-2026".
     * Unique trong từng scope (global hoặc theater-specific).
     */
    @Column(nullable = false, length = 50)
    private String code;

    /** Tên hiển thị admin. */
    @Column(nullable = false, length = 200)
    private String name;

    /** Mô tả ngắn hiển thị cho user (vd "Phụ thu cuối tuần"). */
    @Column(length = 500)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "rule_type", nullable = false, length = 30)
    private PricingRuleType ruleType;

    /**
     * Multiplier theo %. VD:
     * <ul>
     *   <li>{@code 120.00} → giá × 1.20 (tăng 20%)</li>
     *   <li>{@code 100.00} → giá × 1.00 (không đổi — dùng để đánh dấu rule "tracking")</li>
     *   <li>{@code 80.00} → giá × 0.80 (giảm 20%, vd morning discount)</li>
     * </ul>
     */
    @Column(name = "multiplier_percent", nullable = false, precision = 6, scale = 2)
    private BigDecimal multiplierPercent;

    /**
     * CSV danh sách thứ áp dụng. VD "SATURDAY,SUNDAY". Null = không lọc theo thứ.
     * Giá trị: MONDAY/TUESDAY/.../SUNDAY (DayOfWeek enum standard JDK).
     */
    @Column(name = "day_of_week", length = 100)
    private String dayOfWeek;

    /** Giờ bắt đầu (0-23), inclusive. Null = không lọc giờ. */
    @Column(name = "hour_start")
    private Integer hourStart;

    /** Giờ kết thúc (0-23), exclusive. {@code [hourStart, hourEnd)}. */
    @Column(name = "hour_end")
    private Integer hourEnd;

    /** Ngày bắt đầu áp dụng (vd holiday). Null = không lọc theo ngày cụ thể. */
    @Column(name = "date_start")
    private LocalDate dateStart;

    /** Ngày kết thúc áp dụng (inclusive). */
    @Column(name = "date_end")
    private LocalDate dateEnd;

    /** Có đang active không. Inactive sẽ KHÔNG được engine load. */
    @Column(nullable = false)
    @Builder.Default
    private boolean active = true;

    /**
     * Thứ tự áp dụng (priority cao = áp dụng trước). Cùng priority → order theo id.
     *
     * <p>Default = 100 (mid-range): để admin có dải dễ nhớ — rule quan trọng đặt > 100
     * (vd 200 cho TET), rule fallback đặt < 100 (vd 50). Hiện rule mutate giá nhân chuỗi
     * (commutative) nên priority chủ yếu cho hiển thị + override resolution khi cùng code.
     */
    @Column(nullable = false)
    @Builder.Default
    private Integer priority = 100;
}
