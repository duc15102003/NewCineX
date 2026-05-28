package com.cinex.module.booking.dto;

import com.cinex.module.booking.entity.BookingStatus;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Builder
public class BookingListResponse {

    private Long id;
    private String storageState;
    private String bookingCode;
    private String username;
    private BookingStatus status;
    private String movieTitle;
    private String moviePosterUrl;
    private LocalDateTime startTime;
    private String roomName;
    private BigDecimal totalAmount;
    private int seatCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
