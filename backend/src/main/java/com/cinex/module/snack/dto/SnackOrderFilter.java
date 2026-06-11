package com.cinex.module.snack.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Filter DTO cho list SnackOrder (POS) — admin xem lịch sử bán.
 *
 * Lưu ý: SnackOrder không có field user trực tiếp — staff được trace qua
 * audit field {@code createdBy} (username — do {@code @CreatedBy} ghi).
 * Vì vậy filter staff đi qua username thay vì userId.
 */
@Getter
@Setter
public class SnackOrderFilter {

    // Chi nhánh — branch ADMIN sẽ bị service override từ JWT.
    private Long theaterId;

    // Lọc đơn do nhân viên cụ thể tạo (match theo createdBy username, do JPA Auditing ghi).
    private String staffUsername;

    // Khoảng thời gian tạo đơn
    private LocalDateTime createdFrom;
    private LocalDateTime createdTo;

    // Khoảng tổng tiền (đơn từ X đến Y đồng)
    private BigDecimal minTotal;
    private BigDecimal maxTotal;

    // Keyword search trên orderCode HOẶC tên snack trong items
    private String keyword;

    // Mặc định ẩn đơn đã xóa; admin có thể bật true
    private Boolean includeDeleted;
}
