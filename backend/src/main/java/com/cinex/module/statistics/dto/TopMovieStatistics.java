package com.cinex.module.statistics.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
@AllArgsConstructor
public class TopMovieStatistics {

    private Long movieId;
    private String title;
    private String posterUrl;
    private long ticketCount;
    private BigDecimal revenue;
}
