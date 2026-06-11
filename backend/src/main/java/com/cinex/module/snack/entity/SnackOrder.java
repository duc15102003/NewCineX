package com.cinex.module.snack.entity;

import com.cinex.common.entity.BaseEntity;
import com.cinex.module.theater.entity.Theater;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "snack_orders")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SnackOrder extends BaseEntity {

    /**
     * Chi nhánh nơi đơn POS được tạo. Tất cả snack trong order phải cùng theater.
     * Báo cáo doanh thu theo chi nhánh truy vấn trực tiếp, không cần JOIN qua items.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "theater_id", nullable = false)
    private Theater theater;

    @Column(name = "order_code", nullable = false, unique = true, length = 30)
    private String orderCode;

    @Column(name = "total_amount", nullable = false, precision = 12, scale = 0)
    private BigDecimal totalAmount;

    @Column(length = 200, columnDefinition = "NVARCHAR(200)")
    private String note;

    // [Cascade ALL] Khi lưu SnackOrder → tự lưu cả items
    // [orphanRemoval] Khi xóa item khỏi list → item bị xóa khỏi DB
    @OneToMany(mappedBy = "snackOrder", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<SnackOrderItem> items = new ArrayList<>();
}
