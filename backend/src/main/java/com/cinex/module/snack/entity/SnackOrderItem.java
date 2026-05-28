package com.cinex.module.snack.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

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
    @JoinColumn(name = "snack_id", nullable = false)
    private Snack snack;

    @Column(nullable = false)
    private Integer quantity;

    // Lưu giá tại thời điểm đặt hàng, không phải giá hiện tại
    // Business rule: giá snack có thể thay đổi nhưng giá đã đặt không đổi
    @Column(nullable = false, precision = 12, scale = 0)
    private BigDecimal price;
}
