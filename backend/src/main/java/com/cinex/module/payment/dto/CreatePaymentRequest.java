package com.cinex.module.payment.dto;

import com.cinex.module.payment.entity.PaymentMethod;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreatePaymentRequest {

    @NotNull(message = "Mã đặt vé là bắt buộc")
    private Long bookingId;

    @NotNull(message = "Phương thức thanh toán là bắt buộc")
    private PaymentMethod paymentMethod;
}
