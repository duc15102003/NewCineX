package com.cinex.module.loyalty.dto;

import com.cinex.module.loyalty.entity.LoyaltyTransactionType;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class LoyaltyTransactionResponse {

    private Long id;
    private LoyaltyTransactionType transactionType;
    private Integer points;
    private Integer balanceAfter;
    private String reason;
    private String bookingCode;
    private LocalDateTime createdAt;
}
