package com.cinex.module.showtime.dto;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;

/**
 * Một {@link com.cinex.module.pricing.entity.PricingRule} đã match cho showtime — gửi xuống FE
 * để hiển thị badge "Suất sáng -20%" / "Cuối tuần +30%". Chỉ chứa thông tin tối thiểu cần render.
 *
 * <p><b>discountPercent semantic:</b>
 * <ul>
 *   <li>multiplierPercent = 80 → giá còn 80% (giảm 20%) → discountPercent = -20</li>
 *   <li>multiplierPercent = 130 → giá 130% (tăng 30%) → discountPercent = +30</li>
 * </ul>
 * FE đọc dấu để chọn màu badge (xanh giảm / đỏ tăng).
 */
@Getter
@Builder
public class AppliedPricingRule {
    private String code;
    private String name;
    /** Phần trăm so với giá gốc — âm = giảm, dương = tăng. */
    private BigDecimal discountPercent;
}
