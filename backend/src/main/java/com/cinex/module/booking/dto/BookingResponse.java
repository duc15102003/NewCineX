package com.cinex.module.booking.dto;

import com.cinex.module.booking.entity.BookingStatus;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Builder
public class BookingResponse {

    private Long id;
    private String storageState;
    private String bookingCode;
    private BookingStatus status;

    // Movie info
    private String movieTitle;
    private String moviePosterUrl;

    // Showtime info
    private Long showtimeId;
    private LocalDateTime startTime;
    private LocalDateTime endTime;

    // Room info
    private String roomName;
    private String roomType;

    private List<BookingSeatResponse> seats;
    private BigDecimal totalAmount;

    private LocalDateTime confirmedAt;
    private LocalDateTime cancelledAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
