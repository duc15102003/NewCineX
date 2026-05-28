package com.cinex.module.payment.dto;

import com.cinex.module.booking.dto.BookingSeatResponse;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Builder
public class TicketResponse {

    private String bookingCode;
    private String movieTitle;
    private String moviePosterUrl;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private String roomName;
    private String roomType;
    private List<BookingSeatResponse> seats;
    private BigDecimal totalAmount;
    private String paymentMethod;
    private String qrCodeBase64;
}
