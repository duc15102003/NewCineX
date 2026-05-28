package com.cinex.module.payment.service;

import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.common.service.QrCodeService;
import com.cinex.module.booking.dto.BookingSeatResponse;
import com.cinex.module.booking.entity.Booking;
import com.cinex.module.booking.entity.BookingStatus;
import com.cinex.module.booking.repository.BookingRepository;
import com.cinex.module.payment.dto.TicketResponse;
import com.cinex.module.payment.entity.Payment;
import com.cinex.module.payment.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TicketService {

    private final BookingRepository bookingRepository;
    private final PaymentRepository paymentRepository;
    private final QrCodeService qrCodeService;

    /**
     * Xuất vé điện tử — chỉ cho booking CONFIRMED hoặc CHECKED_IN.
     */
    @Transactional(readOnly = true)
    public TicketResponse generateTicket(Long userId, Long bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new BusinessException(ErrorCode.BOOKING_NOT_FOUND));

        if (!booking.getUser().getId().equals(userId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Đây không phải đơn đặt vé của bạn");
        }

        if (booking.getStatus() != BookingStatus.CONFIRMED
                && booking.getStatus() != BookingStatus.CHECKED_IN) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Vé chỉ khả dụng cho đơn đặt đã xác nhận");
        }

        Payment payment = paymentRepository.findByBookingId(bookingId).orElse(null);

        List<BookingSeatResponse> seats = booking.getBookingSeats().stream()
                .map(bs -> BookingSeatResponse.builder()
                        .seatId(bs.getSeat().getId())
                        .seatNumber(bs.getSeat().getSeatNumber())
                        .seatType(bs.getSeat().getSeatType().name())
                        .price(bs.getPrice())
                        .status(bs.getStatus().name())
                        .build())
                .toList();

        String qrBase64 = qrCodeService.generateQrCodeBase64(booking.getBookingCode(), 300);

        return TicketResponse.builder()
                .bookingCode(booking.getBookingCode())
                .movieTitle(booking.getShowtime().getMovie().getTitle())
                .moviePosterUrl(booking.getShowtime().getMovie().getPosterUrl())
                .startTime(booking.getShowtime().getStartTime())
                .endTime(booking.getShowtime().getEndTime())
                .roomName(booking.getShowtime().getRoom().getName())
                .roomType(booking.getShowtime().getRoom().getType().name())
                .seats(seats)
                .totalAmount(booking.getTotalAmount())
                .paymentMethod(payment != null ? payment.getMethod().name() : null)
                .qrCodeBase64(qrBase64)
                .build();
    }
}
