package com.cinex.module.booking.entity;

public enum BookingStatus {
    HOLDING,      // Đang giữ ghế (chờ thanh toán, 10 phút)
    CONFIRMED,    // Đã xác nhận (đã thanh toán)
    CHECKED_IN,   // Đã check-in tại rạp
    CANCELLED,    // Đã hủy (user hủy hoặc admin hủy)
    EXPIRED,      // Hết hạn hold (tự động hủy)
    NO_SHOW,      // CONFIRMED nhưng không CHECKED_IN sau giờ chiếu (đánh dấu tự động sau showtime + buffer)
    REJECTED      // Bị nhân viên từ chối cho vào tại cổng (vd không đủ tuổi, CCCD giả). Không hoàn tiền theo policy.
}
