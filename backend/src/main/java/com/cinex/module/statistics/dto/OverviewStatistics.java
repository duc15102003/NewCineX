package com.cinex.module.statistics.dto;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
@Builder
public class OverviewStatistics {

    private long todayBookings;
    private BigDecimal todayRevenue;
    /** Doanh thu bán snack tại quầy POS hôm nay */
    private BigDecimal todaySnackRevenue;
    private long totalUsers;
    private long totalMovies;
    private long totalRooms;
    private long totalShowtimesToday;
}
