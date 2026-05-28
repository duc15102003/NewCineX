package com.cinex.module.showtime.dto;

import com.cinex.module.showtime.entity.ShowtimeStatus;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Builder
public class ShowtimeResponse {

    private Long id;
    private String storageState;

    // Movie info (rút gọn, không trả full movie object)
    private Long movieId;
    private String movieTitle;
    private String moviePosterUrl;
    private Integer movieDuration;

    // Room info
    private Long roomId;
    private String roomName;
    private String roomType;

    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private BigDecimal basePrice;
    private BigDecimal vipPrice;
    private BigDecimal couplePrice;
    private ShowtimeStatus status;

    private int availableSeats;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
