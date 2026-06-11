package com.cinex.module.pricing.dto;

import com.cinex.module.pricing.entity.PricingRuleType;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Builder
public class PricingRuleResponse {

    private Long id;
    private String storageState;

    /** Chi nhánh áp dụng. NULL = rule toàn hệ thống (DEFAULT). */
    private Long theaterId;
    private String theaterName;
    private String theaterCity;

    private String code;
    private String name;
    private String description;
    private PricingRuleType ruleType;
    private BigDecimal multiplierPercent;
    private String dayOfWeek;
    private Integer hourStart;
    private Integer hourEnd;
    private LocalDate dateStart;
    private LocalDate dateEnd;
    private boolean active;
    private Integer priority;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
