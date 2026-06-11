package com.cinex.module.combo.entity;

import com.cinex.common.entity.BaseEntity;
import com.cinex.module.theater.entity.Theater;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * Entity combo (gói snack tổ hợp) — map bảng {@code combos}.
 *
 * <p><b>Pattern theo rạp:</b> "Combo Romance" = 2 bắp + 2 nước với giá ưu đãi.
 * Phase 1 CineX chỉ bundle snack (không gồm vé) — bán qua POS hoặc add-on khi booking.
 *
 * <p>{@link #price} là giá cố định của combo (tổng đã discount sẵn). Giá từng snack riêng
 * không cần tính lại — admin tự set price thấp hơn tổng snack riêng lẻ để tạo ưu đãi.
 */
@Entity
@Table(
        name = "combos",
        uniqueConstraints = @UniqueConstraint(name = "uq_combos_theater_code", columnNames = {"theater_id", "code"})
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Combo extends BaseEntity {

    /**
     * Chi nhánh sở hữu combo — combo chỉ chứa snack của cùng theater.
     * Code unique theo (theater, code) → 2 rạp có thể đặt 'COMBO-FAM' khác nhau.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "theater_id", nullable = false)
    private Theater theater;

    @Column(nullable = false, length = 50)
    private String code;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(length = 500)
    private String description;

    @Column(name = "image_url", length = 500)
    private String imageUrl;

    /** Giá combo (đã được discount sẵn so với tổng snack riêng lẻ). */
    @Column(nullable = false, precision = 12, scale = 0)
    private BigDecimal price;

    @Column(nullable = false)
    @Builder.Default
    private boolean active = true;

    /**
     * Danh sách snacks trong combo. Cascade ALL + orphanRemoval để khi xoá combo
     * thì combo_items tự xoá theo (DB FK ON DELETE CASCADE đã có, JPA cũng sync).
     */
    @OneToMany(mappedBy = "combo", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<ComboItem> items = new ArrayList<>();
}
