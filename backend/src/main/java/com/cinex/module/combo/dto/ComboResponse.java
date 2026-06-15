package com.cinex.module.combo.dto;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Builder
public class ComboResponse {

    private Long id;
    private String storageState;
    /** Chi nhánh sở hữu combo — breadcrumb + audit (FE đã force theater pick). */
    private Long theaterId;
    private String theaterName;
    private String theaterCity;
    private String code;
    private String name;
    private String description;
    private String imageUrl;
    private BigDecimal price;
    private boolean active;
    private List<ComboItemResponse> items;
    /** Tổng giá nếu mua snack riêng lẻ — FE hiển thị "tiết kiệm X đồng". */
    private BigDecimal regularPrice;
    /** Số tiền tiết kiệm = regularPrice - price. NULL hoặc 0 nếu combo không có lợi. */
    private BigDecimal savingsAmount;
    /** Phần trăm tiết kiệm làm tròn. NULL nếu regularPrice=0 hoặc savings≤0. */
    private Integer savingsPercent;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    /**
     * Tính sẵn từ BE: combo có thật sự bán được không (effective availability).
     *
     * <p>True ⇔ {@code active && storageState != ARCHIVED && ALL items.snack.available
     * && ALL items.snack.storageState != ARCHIVED}.
     *
     * <p>Khi false → POS auto-hide combo này, admin nhìn thấy badge "Tạm hết"
     * cùng danh sách {@link #unavailableItems} để biết lý do.
     */
    private boolean effectiveAvailable;

    /**
     * Danh sách tên snack đang hết hàng / archived khiến combo bị block. Empty
     * khi {@code effectiveAvailable=true}. Dùng cho tooltip "Tạm hết do: A, B".
     */
    private List<String> unavailableItems;
}
