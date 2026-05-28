package com.cinex.common.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum ErrorCode {

    UNCATEGORIZED(9999, "Đã xảy ra lỗi không mong muốn", HttpStatus.INTERNAL_SERVER_ERROR),
    INVALID_REQUEST(1000, "Yêu cầu không hợp lệ", HttpStatus.BAD_REQUEST),
    UNAUTHORIZED(1001, "Chưa đăng nhập", HttpStatus.UNAUTHORIZED),
    FORBIDDEN(1002, "Không có quyền truy cập", HttpStatus.FORBIDDEN),
    NOT_FOUND(1003, "Không tìm thấy tài nguyên", HttpStatus.NOT_FOUND),
    USER_EXISTED(1004, "Tài khoản đã tồn tại", HttpStatus.CONFLICT),
    USER_NOT_FOUND(1005, "Không tìm thấy người dùng", HttpStatus.NOT_FOUND),
    INVALID_CREDENTIALS(1006, "Tên đăng nhập hoặc mật khẩu không đúng", HttpStatus.UNAUTHORIZED),
    INVALID_PASSWORD(1007, "Mật khẩu không hợp lệ", HttpStatus.BAD_REQUEST),
    INVALID_FILE(1008, "File không hợp lệ", HttpStatus.BAD_REQUEST),
    GENRE_NOT_FOUND(2001, "Không tìm thấy thể loại", HttpStatus.NOT_FOUND),
    GENRE_EXISTED(2002, "Thể loại đã tồn tại", HttpStatus.CONFLICT),
    MOVIE_NOT_FOUND(2003, "Không tìm thấy phim", HttpStatus.NOT_FOUND),
    ROOM_NOT_FOUND(3001, "Không tìm thấy phòng chiếu", HttpStatus.NOT_FOUND),
    ROOM_EXISTED(3002, "Phòng chiếu đã tồn tại", HttpStatus.CONFLICT),
    SEAT_NOT_FOUND(3003, "Không tìm thấy ghế", HttpStatus.NOT_FOUND),
    SHOWTIME_NOT_FOUND(4001, "Không tìm thấy suất chiếu", HttpStatus.NOT_FOUND),
    SHOWTIME_CONFLICT(4002, "Suất chiếu bị trùng giờ", HttpStatus.CONFLICT),
    BOOKING_NOT_FOUND(5001, "Không tìm thấy đơn đặt vé", HttpStatus.NOT_FOUND),
    BOOKING_EXPIRED(5002, "Thời gian giữ ghế đã hết hạn", HttpStatus.GONE),
    SEAT_ALREADY_BOOKED(5003, "Ghế đã được đặt hoặc đang giữ", HttpStatus.CONFLICT),
    PAYMENT_NOT_FOUND(6001, "Không tìm thấy thanh toán", HttpStatus.NOT_FOUND),
    VOUCHER_NOT_FOUND(7001, "Không tìm thấy voucher", HttpStatus.NOT_FOUND),
    VOUCHER_EXISTED(7002, "Mã voucher đã tồn tại", HttpStatus.CONFLICT),
    REVIEW_NOT_FOUND(8001, "Không tìm thấy đánh giá", HttpStatus.NOT_FOUND),
    REVIEW_EXISTED(8002, "Bạn đã đánh giá phim này", HttpStatus.CONFLICT),
    SNACK_NOT_FOUND(8003, "Không tìm thấy đồ ăn", HttpStatus.NOT_FOUND),
    ;

    private final int code;
    private final String message;
    private final HttpStatus httpStatus;
}
