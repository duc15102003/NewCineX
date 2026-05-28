package com.cinex.module.statistics.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@AllArgsConstructor
public class RevenueStatistics {

    private LocalDate date;
    private BigDecimal revenue;
    private long bookingCount;
}
