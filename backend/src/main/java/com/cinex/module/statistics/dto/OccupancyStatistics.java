package com.cinex.module.statistics.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
public class OccupancyStatistics {

    private Long showtimeId;
    private String movieTitle;
    private String roomName;
    private LocalDateTime startTime;
    private int totalSeats;
    private int bookedSeats;
    private double occupancyRate;  // 0.0 - 100.0 (%)
}
