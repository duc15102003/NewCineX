package com.cinex.module.booking.dto;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
@Builder
public class BookingSeatResponse {

    private Long seatId;
    private String seatNumber;
    private String seatType;
    private BigDecimal price;
    private String status;
}
