package com.cinex.module.snack.entity;

import com.cinex.module.combo.entity.Combo;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

/**
 * Line trong 1 đơn POS. Mỗi line LÀ MỘT trong 2 dạng (XOR — DB constraint đảm bảo):
 * <ul>
 *   <li><b>Snack line</b>: snack != null, combo == null</li>
 *   <li><b>Combo line</b>: combo != null, snack == null — bán nguyên combo, hưởng giá combo</li>
 * </ul>
 */
@Entity
@Table(name = "snack_order_items")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SnackOrderItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // [ManyToOne LAZY] Không tự load SnackOrder khi chỉ cần SnackOrderItem
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "snack_order_id", nullable = false)
    private SnackOrder snackOrder;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "snack_id")
    private Snack snack;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "combo_id")
    private Combo combo;

    @Column(nullable = false)
    private Integer quantity;

    // Lưu giá tại thời điểm đặt — snack line = snack.price, combo line = combo.price.
    // Business rule: giá có thể thay đổi nhưng giá đã đặt không đổi.
    @Column(nullable = false, precision = 12, scale = 0)
    private BigDecimal price;
}
