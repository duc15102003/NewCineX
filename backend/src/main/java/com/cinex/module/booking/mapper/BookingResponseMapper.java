package com.cinex.module.booking.mapper;

import com.cinex.module.booking.dto.BookingResponse;
import com.cinex.module.booking.dto.BookingSeatResponse;
import com.cinex.module.booking.entity.Booking;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Map Booking entity → BookingResponse.
 *
 * <p>Tách khỏi BookingService để các service khác (BookingCheckInService, POS, ...)
 * dùng chung mà không cần phụ thuộc BookingService — tránh vòng tròn dependency.
 *
 * <p>Tại sao Component thay vì MapStruct? Cấu trúc {@code BookingSeat} có nested
 * field từ entity LAZY ({@code seat.getSeatType()}, {@code showtime.getMovie()})
 * cần xử lý cẩn thận — viết tay rõ ràng hơn auto-gen.
 */
@Component
public class BookingResponseMapper {

    public BookingResponse toResponse(Booking booking) {
        List<BookingSeatResponse> seatResponses = booking.getBookingSeats().stream()
                .map(bs -> BookingSeatResponse.builder()
                        .seatId(bs.getSeat().getId())
                        .seatNumber(bs.getSeat().getSeatNumber())
                        .seatType(bs.getSeat().getSeatType().name())
                        .price(bs.getPrice())
                        .status(bs.getStatus().name())
                        .build())
                .toList();

        return BookingResponse.builder()
                .id(booking.getId())
                .storageState(booking.getStorageState() != null ? booking.getStorageState().name() : null)
                .bookingCode(booking.getBookingCode())
                .status(booking.getStatus())
                .movieTitle(booking.getShowtime().getMovie().getTitle())
                .moviePosterUrl(booking.getShowtime().getMovie().getPosterUrl())
                .movieAgeRating(booking.getShowtime().getMovie().getAgeRating())
                .showtimeId(booking.getShowtime().getId())
                .startTime(booking.getShowtime().getStartTime())
                .endTime(booking.getShowtime().getEndTime())
                .roomName(booking.getShowtime().getRoom().getName())
                .roomType(booking.getShowtime().getRoom().getType().name())
                .seats(seatResponses)
                .totalAmount(booking.getTotalAmount())
                .confirmedAt(booking.getConfirmedAt())
                .cancelledAt(booking.getCancelledAt())
                .createdAt(booking.getCreatedAt())
                .updatedAt(booking.getUpdatedAt())
                .build();
    }
}
