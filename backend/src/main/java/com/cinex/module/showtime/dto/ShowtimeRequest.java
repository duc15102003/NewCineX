package com.cinex.module.showtime.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
public class ShowtimeRequest {

    @NotNull(message = "Vui lòng chọn phim")
    private Long movieId;

    @NotNull(message = "Vui lòng chọn phòng chiếu")
    private Long roomId;

    @NotNull(message = "Thời gian bắt đầu là bắt buộc")
    private LocalDateTime startTime;

    @NotNull(message = "Giá vé cơ bản là bắt buộc")
    @Min(value = 1, message = "Giá vé phải ít nhất 1đ")
    private BigDecimal basePrice;

    @Min(value = 0, message = "Giá vé VIP không được âm")
    private BigDecimal vipPrice;

    @Min(value = 0, message = "Giá vé đôi không được âm")
    private BigDecimal couplePrice;
}
