package com.cinex.module.booking.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ConfirmBookingRequest {

    @NotNull(message = "Mã đặt vé là bắt buộc")
    private Long bookingId;
}
