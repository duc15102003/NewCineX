package com.cinex.module.pricing.dto;

import com.cinex.module.pricing.entity.PricingRuleType;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
public class PricingRuleRequest {

    /**
     * Chi nhánh áp dụng rule.
     * <ul>
     *   <li>NULL = rule DEFAULT toàn hệ thống (chỉ SUPER_ADMIN tạo)</li>
     *   <li>NOT NULL = rule override cho 1 chi nhánh cụ thể</li>
     * </ul>
     * Branch ADMIN: service override field này từ JWT.
     */
    private Long theaterId;

    @NotBlank(message = "Mã rule là bắt buộc")
    @Size(max = 50)
    @Pattern(regexp = "^[A-Z0-9-]+$", message = "Mã chỉ gồm chữ hoa, số, dấu gạch ngang")
    private String code;

    @NotBlank(message = "Tên rule là bắt buộc")
    @Size(max = 200)
    private String name;

    @Size(max = 500)
    private String description;

    @NotNull(message = "Loại rule là bắt buộc")
    private PricingRuleType ruleType;

    @NotNull(message = "Multiplier là bắt buộc")
    @DecimalMin(value = "1.00", message = "Multiplier phải > 0 (vd 100.00 = giữ nguyên giá)")
    private BigDecimal multiplierPercent;

    /** CSV "SATURDAY,SUNDAY" — chỉ dùng cho DAY_OF_WEEK + COMPOSITE. */
    @Size(max = 100)
    private String dayOfWeek;

    @Min(0) @Max(23)
    private Integer hourStart;

    @Min(0) @Max(24)
    private Integer hourEnd;

    private LocalDate dateStart;
    private LocalDate dateEnd;

    private boolean active = true;

    @Min(0)
    private Integer priority = 100;
}
