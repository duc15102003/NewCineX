package com.cinex.module.booking.service;

import com.cinex.common.entity.tracker.IdTrackerService;
import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.module.auth.entity.User;
import com.cinex.module.auth.repository.UserRepository;
import com.cinex.module.booking.dto.BookingFilter;
import com.cinex.module.booking.dto.BookingListResponse;
import com.cinex.module.booking.dto.BookingResponse;
import com.cinex.module.booking.dto.BookingSeatResponse;
import com.cinex.module.booking.dto.ConfirmBookingRequest;
import com.cinex.module.booking.dto.CounterSaleRequest;
import com.cinex.module.booking.dto.HoldSeatsRequest;
import com.cinex.module.booking.dto.HoldSeatsResponse;
import com.cinex.module.booking.entity.Booking;
import com.cinex.module.booking.entity.BookingSeat;
import com.cinex.module.booking.entity.BookingSeatStatus;
import com.cinex.module.booking.entity.BookingStatus;
import com.cinex.module.booking.repository.BookingRepository;
import com.cinex.module.booking.repository.BookingSeatRepository;
import com.cinex.module.booking.specification.BookingSpecification;
import com.cinex.module.config.service.SystemConfigService;
import com.cinex.module.seat.entity.Seat;
import com.cinex.module.seat.entity.SeatStatus;
import com.cinex.module.seat.entity.SeatType;
import com.cinex.module.seat.repository.SeatRepository;
import com.cinex.module.showtime.entity.Showtime;
import com.cinex.module.booking.service.SeatWebSocketService;
import com.cinex.module.showtime.repository.ShowtimeRepository;
import com.cinex.common.service.EmailService;
import com.cinex.module.payment.entity.Payment;
import com.cinex.module.payment.entity.PaymentMethod;
import com.cinex.module.payment.entity.PaymentStatus;
import com.cinex.module.payment.repository.PaymentRepository;
import com.cinex.module.voucher.dto.ValidateVoucherResponse;
import com.cinex.module.voucher.repository.VoucherUsageRepository;
import com.cinex.module.voucher.service.VoucherService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class BookingService {

    private final BookingRepository bookingRepository;
    private final BookingSeatRepository bookingSeatRepository;
    private final ShowtimeRepository showtimeRepository;
    private final SeatRepository seatRepository;
    private final UserRepository userRepository;
    private final IdTrackerService idTrackerService;
    private final SystemConfigService systemConfigService;
    private final SeatWebSocketService seatWebSocketService;
    private final VoucherService voucherService;
    private final VoucherUsageRepository voucherUsageRepository;
    private final PaymentRepository paymentRepository;
    private final EmailService emailService;

    /**
     * Hold ghế — tạo booking HOLDING, lock ghế 10 phút.
     *
     * Luồng:
     * 1. Validate: showtime tồn tại, chưa chiếu, max seats
     * 2. Kiểm tra ghế trống (không ai HELD/BOOKED)
     * 3. Tính tổng tiền theo loại ghế (STANDARD/VIP/COUPLE)
     * 4. Tạo Booking + BookingSeats
     * 5. Sinh bookingCode unique (IdTrackerService)
     */
    @Transactional
    public HoldSeatsResponse holdSeats(Long userId, HoldSeatsRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        Showtime showtime = showtimeRepository.findById(request.getShowtimeId())
                .orElseThrow(() -> new BusinessException(ErrorCode.SHOWTIME_NOT_FOUND));

        // Cho đặt vé trong X phút đầu sau khi bắt đầu (thời gian quảng cáo/trailer)
        int bookingCutoff = systemConfigService.getInt("booking.cutoff_after_start_minutes", 15);
        if (showtime.getStartTime().plusMinutes(bookingCutoff).isBefore(LocalDateTime.now())) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Suất chiếu đã bắt đầu quá " + bookingCutoff + " phút");
        }

        // FIX 3: Loại bỏ seatId trùng lặp trước khi validate
        // Tránh user gửi [1,1,2] → count = 3 nhưng thực ra chỉ 2 ghế khác nhau
        List<Long> uniqueSeatIds = request.getSeatIds().stream().distinct().toList();

        // Validate: max seats từ SystemConfig (dùng uniqueSeatIds sau dedup)
        int maxSeats = systemConfigService.getInt("booking.max_seats", 8);
        if (uniqueSeatIds.size() > maxSeats) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Tối đa " + maxSeats + " ghế mỗi lần đặt");
        }

        // Kiểm tra ghế trống — nếu có ai HELD/BOOKED → lỗi
        List<BookingSeat> occupied = bookingSeatRepository.findHeldOrBookedSeats(
                request.getShowtimeId(), uniqueSeatIds);
        if (!occupied.isEmpty()) {
            String takenSeats = occupied.stream()
                    .map(bs -> bs.getSeat().getSeatNumber())
                    .reduce((a, b) -> a + ", " + b)
                    .orElse("");
            throw new BusinessException(ErrorCode.SEAT_ALREADY_BOOKED,
                    "Các ghế đã được đặt hoặc đang giữ: " + takenSeats);
        }

        // Lấy seat entities (dùng uniqueSeatIds)
        List<Seat> seats = seatRepository.findAllById(uniqueSeatIds);
        if (seats.size() != uniqueSeatIds.size()) {
            throw new BusinessException(ErrorCode.SEAT_NOT_FOUND, "Một hoặc nhiều ghế không tồn tại");
        }

        // Chặn đặt ghế hỏng (BROKEN) — phòng trường hợp user bypass FE
        List<String> brokenSeats = seats.stream()
                .filter(s -> s.getStatus() == SeatStatus.BROKEN)
                .map(Seat::getSeatNumber)
                .toList();
        if (!brokenSeats.isEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Ghế đang bảo trì, không thể đặt: " + String.join(", ", brokenSeats));
        }

        // Tính tổng tiền
        BigDecimal totalAmount = BigDecimal.ZERO;
        for (Seat seat : seats) {
            BigDecimal price = getPriceForSeat(seat.getSeatType(), showtime);
            totalAmount = totalAmount.add(price);
        }

        // Áp dụng voucher nếu có
        if (request.getVoucherCode() != null && !request.getVoucherCode().isBlank()) {
            ValidateVoucherResponse voucherResult = voucherService.validateVoucher(
                    request.getVoucherCode(), totalAmount, userId);
            if (voucherResult.isValid()) {
                totalAmount = totalAmount.subtract(voucherResult.getDiscountAmount());
                if (totalAmount.compareTo(BigDecimal.ZERO) < 0) {
                    totalAmount = BigDecimal.ZERO;
                }
            }
        }

        // Tạo booking
        String bookingCode = idTrackerService.nextCodeWithDate("BOOKING");
        int holdMinutes = systemConfigService.getInt("booking.hold_minutes", 10);

        Booking booking = Booking.builder()
                .user(user)
                .showtime(showtime)
                .totalAmount(totalAmount)
                .status(BookingStatus.HOLDING)
                .bookingCode(bookingCode)
                .build();

        bookingRepository.save(booking);

        // FIX 1: Ghi nhận voucher đã sử dụng ngay khi hold ghế
        // (vì đây là thời điểm ta có đầy đủ: voucher code, user, booking)
        if (request.getVoucherCode() != null && !request.getVoucherCode().isBlank()) {
            voucherService.useVoucherByCode(request.getVoucherCode(), user, booking);
        }

        // Tạo booking seats
        List<BookingSeatResponse> seatResponses = seats.stream().map(seat -> {
            BigDecimal price = getPriceForSeat(seat.getSeatType(), showtime);
            BookingSeat bs = BookingSeat.builder()
                    .booking(booking)
                    .seat(seat)
                    .price(price)
                    .status(BookingSeatStatus.HELD)
                    .build();
            bookingSeatRepository.save(bs);

            return BookingSeatResponse.builder()
                    .seatId(seat.getId())
                    .seatNumber(seat.getSeatNumber())
                    .seatType(seat.getSeatType().name())
                    .price(price)
                    .status(BookingSeatStatus.HELD.name())
                    .build();
        }).toList();

        log.info("User {} held {} seats for showtime {}, booking {}",
                user.getUsername(), seats.size(), showtime.getId(), bookingCode);

        // Real-time: notify tất cả user đang xem sơ đồ ghế
        seatWebSocketService.notifySeatChanged(showtime.getId(), request.getSeatIds(), "HELD");

        return HoldSeatsResponse.builder()
                .bookingId(booking.getId())
                .bookingCode(bookingCode)
                .holdExpiry(booking.getCreatedAt().plusMinutes(holdMinutes))
                .totalAmount(totalAmount)
                .seats(seatResponses)
                .build();
    }

    /**
     * Confirm booking — đổi HOLDING → CONFIRMED.
     */
    @Transactional
    public BookingResponse confirmBooking(Long userId, ConfirmBookingRequest request) {
        Booking booking = bookingRepository.findById(request.getBookingId())
                .orElseThrow(() -> new BusinessException(ErrorCode.BOOKING_NOT_FOUND));

        // Validate quyền
        if (!booking.getUser().getId().equals(userId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Đây không phải đơn đặt vé của bạn");
        }

        // Validate trạng thái
        if (booking.getStatus() != BookingStatus.HOLDING) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Đơn đặt vé không ở trạng thái chờ xác nhận, trạng thái hiện tại: " + booking.getStatus());
        }

        // Kiểm tra hết hạn hold
        int holdMinutes = systemConfigService.getInt("booking.hold_minutes", 10);
        if (booking.getCreatedAt().plusMinutes(holdMinutes).isBefore(LocalDateTime.now())) {
            throw new BusinessException(ErrorCode.BOOKING_EXPIRED, "Thời gian giữ ghế đã hết hạn");
        }

        booking.setStatus(BookingStatus.CONFIRMED);
        booking.setConfirmedAt(LocalDateTime.now());
        booking.getBookingSeats().forEach(bs -> bs.setStatus(BookingSeatStatus.BOOKED));
        bookingRepository.save(booking);

        log.info("Booking {} confirmed", booking.getBookingCode());
        return toBookingResponse(booking);
    }

    /**
     * Cancel booking — user hủy vé.
     * Business rules:
     * 1. Chỉ chủ booking mới được hủy
     * 2. Chỉ HOLDING/CONFIRMED mới hủy được
     * 3. Phải hủy trước 1 giờ khi suất chiếu bắt đầu
     * 4. Trả lại voucher (nếu đã dùng)
     * 5. Gửi email thông báo hủy
     */
    @Transactional
    public BookingResponse cancelBooking(Long userId, Long bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new BusinessException(ErrorCode.BOOKING_NOT_FOUND));

        if (!booking.getUser().getId().equals(userId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Đây không phải đơn đặt vé của bạn");
        }

        if (booking.getStatus() != BookingStatus.HOLDING && booking.getStatus() != BookingStatus.CONFIRMED) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Không thể hủy đơn đặt vé ở trạng thái: " + booking.getStatus());
        }

        // Phải hủy trước X phút khi suất chiếu bắt đầu
        int cancelBeforeMinutes = systemConfigService.getInt("booking.cancel_before_minutes", 60);
        LocalDateTime deadline = booking.getShowtime().getStartTime().minusMinutes(cancelBeforeMinutes);
        if (LocalDateTime.now().isAfter(deadline)) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Chỉ được hủy vé trước " + cancelBeforeMinutes + " phút khi suất chiếu bắt đầu");
        }

        booking.setStatus(BookingStatus.CANCELLED);
        booking.setCancelledAt(LocalDateTime.now());
        booking.getBookingSeats().forEach(bs -> bs.setStatus(BookingSeatStatus.CANCELLED));
        bookingRepository.save(booking);

        // Đổi Payment → REFUNDED để doanh thu không tính vé đã hủy
        paymentRepository.findByBookingId(bookingId).ifPresent(payment -> {
            if (payment.getStatus() == PaymentStatus.COMPLETED) {
                payment.setStatus(PaymentStatus.REFUNDED);
                paymentRepository.save(payment);
                log.info("Payment {} refunded for cancelled booking {}", payment.getTransactionCode(), booking.getBookingCode());
            }
        });

        // Trả lại voucher (nếu đã dùng)
        var usages = voucherUsageRepository.findByBookingId(bookingId);
        for (var usage : usages) {
            var voucher = usage.getVoucher();
            if (voucher.getUsedCount() > 0) {
                voucher.setUsedCount(voucher.getUsedCount() - 1);
            }
            voucherUsageRepository.delete(usage);
            log.info("Voucher {} returned for cancelled booking {}", voucher.getCode(), booking.getBookingCode());
        }

        log.info("Booking {} cancelled by user", booking.getBookingCode());

        // Real-time: ghế trả lại → notify AVAILABLE
        List<Long> seatIds = booking.getBookingSeats().stream()
                .map(bs -> bs.getSeat().getId()).toList();
        seatWebSocketService.notifySeatChanged(booking.getShowtime().getId(), seatIds, "AVAILABLE");

        // Gửi email thông báo hủy (async)
        String email = booking.getUser().getEmail();
        String movieTitle = booking.getShowtime().getMovie().getTitle();
        java.text.NumberFormat nf = java.text.NumberFormat.getInstance(new java.util.Locale("vi", "VN"));
        emailService.sendCancellationEmail(email, booking.getBookingCode(), movieTitle,
                nf.format(booking.getTotalAmount()) + "đ");

        return toBookingResponse(booking);
    }

    /**
     * Check-in — staff/admin quét QR (bookingCode) → đổi CHECKED_IN.
     */
    @Transactional
    public BookingResponse checkIn(String bookingCode) {
        Booking booking = bookingRepository.findByBookingCode(bookingCode)
                .orElseThrow(() -> new BusinessException(ErrorCode.BOOKING_NOT_FOUND,
                        "Booking not found: " + bookingCode));

        if (booking.getStatus() == BookingStatus.CHECKED_IN) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST, "Vé đã được sử dụng");
        }

        if (booking.getStatus() != BookingStatus.CONFIRMED) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Đơn đặt vé chưa được xác nhận, trạng thái: " + booking.getStatus());
        }

        booking.setStatus(BookingStatus.CHECKED_IN);
        bookingRepository.save(booking);

        log.info("Booking {} checked in", bookingCode);
        return toBookingResponse(booking);
    }

    /**
     * Danh sách vé của user — Filter DTO + Specification.
     */
    @Transactional(readOnly = true)
    public Page<BookingListResponse> getMyBookings(Long userId, BookingFilter filter, Pageable pageable) {
        var spec = BookingSpecification.fromFilter(filter, userId);
        return bookingRepository.findAll(spec, pageable)
                .map(this::toBookingListResponse);
    }

    /**
     * Admin: xem tất cả booking trong hệ thống.
     */
    @Transactional(readOnly = true)
    public Page<BookingListResponse> listAllBookings(BookingFilter filter, Pageable pageable) {
        var spec = BookingSpecification.fromAdminFilter(filter);
        return bookingRepository.findAll(spec, pageable)
                .map(this::toBookingListResponse);
    }

    /**
     * Chi tiết vé — không filter DELETED.
     */
    @Transactional(readOnly = true)
    public BookingResponse getBookingDetail(Long userId, Long bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new BusinessException(ErrorCode.BOOKING_NOT_FOUND));

        if (!booking.getUser().getId().equals(userId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Đây không phải đơn đặt vé của bạn");
        }

        return toBookingResponse(booking);
    }

    /**
     * Sơ đồ ghế với trạng thái cho 1 suất chiếu.
     */
    @Transactional(readOnly = true)
    public List<BookingSeat> getOccupiedSeats(Long showtimeId) {
        return bookingSeatRepository.findAllOccupiedByShowtimeId(showtimeId);
    }

    // === Private helpers ===

    private BigDecimal getPriceForSeat(SeatType seatType, Showtime showtime) {
        return switch (seatType) {
            case VIP -> showtime.getVipPrice();
            case COUPLE -> showtime.getCouplePrice();
            default -> showtime.getBasePrice();
        };
    }

    private BookingResponse toBookingResponse(Booking booking) {
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

    /**
     * POS bán vé tại quầy — admin chọn suất chiếu + ghế, thu tiền mặt.
     * Tạo booking CONFIRMED luôn (không qua HOLDING → không cần countdown 10 phút).
     * Không cần userId vì khách vãng lai không đăng nhập.
     * Payment CASH tạo luôn COMPLETED.
     */
    @Transactional
    public BookingResponse counterSale(CounterSaleRequest request) {
        Showtime showtime = showtimeRepository.findById(request.getShowtimeId())
                .orElseThrow(() -> new BusinessException(ErrorCode.SHOWTIME_NOT_FOUND));

        int bookingCutoff = systemConfigService.getInt("booking.cutoff_after_start_minutes", 15);
        if (showtime.getStartTime().plusMinutes(bookingCutoff).isBefore(LocalDateTime.now())) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Suất chiếu đã bắt đầu quá " + bookingCutoff + " phút");
        }

        List<Long> uniqueSeatIds = request.getSeatIds().stream().distinct().toList();

        // Kiểm tra ghế trống
        List<BookingSeat> occupied = bookingSeatRepository.findHeldOrBookedSeats(
                request.getShowtimeId(), uniqueSeatIds);
        if (!occupied.isEmpty()) {
            String taken = occupied.stream().map(bs -> bs.getSeat().getSeatNumber())
                    .reduce((a, b) -> a + ", " + b).orElse("");
            throw new BusinessException(ErrorCode.SEAT_ALREADY_BOOKED, "Ghế đã được đặt: " + taken);
        }

        List<Seat> seats = seatRepository.findAllById(uniqueSeatIds);
        if (seats.size() != uniqueSeatIds.size()) {
            throw new BusinessException(ErrorCode.SEAT_NOT_FOUND, "Ghế không tồn tại");
        }

        // Chặn ghế hỏng
        List<String> broken = seats.stream()
                .filter(s -> s.getStatus() == SeatStatus.BROKEN)
                .map(Seat::getSeatNumber).toList();
        if (!broken.isEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST, "Ghế đang bảo trì: " + String.join(", ", broken));
        }

        // Tính tiền
        BigDecimal totalAmount = BigDecimal.ZERO;
        for (Seat seat : seats) {
            totalAmount = totalAmount.add(getPriceForSeat(seat.getSeatType(), showtime));
        }

        // Tạo booking CONFIRMED luôn (không qua HOLDING)
        String bookingCode = idTrackerService.nextCodeWithDate("BOOKING");
        Booking booking = Booking.builder()
                .showtime(showtime)
                .totalAmount(totalAmount)
                .status(BookingStatus.CONFIRMED)
                .bookingCode(bookingCode)
                .confirmedAt(LocalDateTime.now())
                .build();
        bookingRepository.save(booking);

        // Tạo booking seats = BOOKED luôn
        for (Seat seat : seats) {
            BigDecimal price = getPriceForSeat(seat.getSeatType(), showtime);
            bookingSeatRepository.save(BookingSeat.builder()
                    .booking(booking)
                    .seat(seat)
                    .price(price)
                    .status(BookingSeatStatus.BOOKED)
                    .build());
        }

        // Tạo payment CASH + COMPLETED luôn
        String txCode = idTrackerService.nextCodeWithDate("PAYMENT");
        Payment payment = Payment.builder()
                .booking(booking)
                .amount(totalAmount)
                .method(resolveCounterPaymentMethod(request.getPaymentMethod()))
                .transactionCode(txCode)
                .status(PaymentStatus.COMPLETED)
                .paidAt(LocalDateTime.now())
                .build();
        paymentRepository.save(payment);

        // WebSocket cập nhật ghế
        seatWebSocketService.notifySeatChanged(showtime.getId(),
                seats.stream().map(Seat::getId).toList(), "BOOKED");

        log.info("Counter sale: {} - {} seats - {} VND", bookingCode, seats.size(), totalAmount);

        return toBookingResponse(booking);
    }

    private PaymentMethod resolveCounterPaymentMethod(String method) {
        if (method == null) return PaymentMethod.CASH;
        try {
            return PaymentMethod.valueOf(method);
        } catch (IllegalArgumentException e) {
            return PaymentMethod.CASH;
        }
    }

    private BookingListResponse toBookingListResponse(Booking booking) {
        return BookingListResponse.builder()
                .id(booking.getId())
                .storageState(booking.getStorageState() != null ? booking.getStorageState().name() : null)
                .bookingCode(booking.getBookingCode())
                .username(booking.getUser() != null ? booking.getUser().getUsername() : "Khách vãng lai")
                .status(booking.getStatus())
                .movieTitle(booking.getShowtime().getMovie().getTitle())
                .moviePosterUrl(booking.getShowtime().getMovie().getPosterUrl())
                .startTime(booking.getShowtime().getStartTime())
                .roomName(booking.getShowtime().getRoom().getName())
                .totalAmount(booking.getTotalAmount())
                .seatCount(booking.getBookingSeats().size())
                .createdAt(booking.getCreatedAt())
                .updatedAt(booking.getUpdatedAt())
                .build();
    }
}
