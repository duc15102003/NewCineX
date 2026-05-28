package com.cinex.module.booking.dto;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Builder
public class HoldSeatsResponse {

    private Long bookingId;
    private String bookingCode;
    private LocalDateTime holdExpiry;
    private BigDecimal totalAmount;
    private List<BookingSeatResponse> seats;
}
