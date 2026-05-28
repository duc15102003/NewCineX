package com.cinex.module.booking.entity;

public enum BookingStatus {
    HOLDING,      // Đang giữ ghế (chờ thanh toán, 10 phút)
    CONFIRMED,    // Đã xác nhận (đã thanh toán)
    CHECKED_IN,   // Đã check-in tại rạp
    CANCELLED,    // Đã hủy (user hủy hoặc admin hủy)
    EXPIRED       // Hết hạn hold (tự động hủy)
}
