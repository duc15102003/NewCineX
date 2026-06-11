package com.cinex.module.booking.service;

import com.cinex.common.audit.Auditable;
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
import com.cinex.common.service.QrCodeService;
import com.cinex.module.payment.entity.Payment;
import com.cinex.module.payment.entity.PaymentMethod;
import com.cinex.module.payment.entity.PaymentStatus;
import com.cinex.module.payment.repository.PaymentRepository;
import com.cinex.module.payment.service.PaymentService;
import com.cinex.module.pricing.service.PricingEngine;
import com.cinex.module.voucher.dto.ValidateVoucherResponse;
import com.cinex.module.voucher.repository.VoucherUsageRepository;
import com.cinex.module.voucher.service.VoucherService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

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
    private final PaymentService paymentService;
    private final EmailService emailService;
    private final PricingEngine pricingEngine;
    private final com.cinex.common.service.SecurityService securityService;
    private final QrCodeService qrCodeService;

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

        // Refactor: orchestration ngắn gọn, mỗi bước là 1 helper method có tên rõ ý định.
        validateUserBookingCapacity(userId, request.getShowtimeId());
        Showtime showtime = lockAndValidateShowtime(request.getShowtimeId());
        // Phase 2 age-rating enforcement: nếu user đã khai DOB ở profile → auto-block không đủ tuổi.
        // User chưa khai DOB → FE confirm dialog xử lý disclaimer + verify vật lý ở cổng (Phase 3).
        validateAgeIfDOBSet(user, showtime.getMovie().getAgeRating());
        List<Long> uniqueSeatIds = validateSeatSelection(request.getSeatIds());
        List<Seat> seats = validateSeatsAvailableAndOperational(request.getShowtimeId(), uniqueSeatIds);

        Long bookingTheaterId = showtime.getRoom().getTheater().getId();
        BigDecimal totalAmount = computeTotalAmountWithVoucher(
                seats, showtime, request.getVoucherCode(), userId, bookingTheaterId);

        Booking booking = createHoldingBooking(user, showtime, totalAmount);
        registerVoucherUsageIfPresent(request.getVoucherCode(), user, booking, bookingTheaterId);
        List<BookingSeatResponse> seatResponses = persistHeldBookingSeats(booking, seats, showtime, uniqueSeatIds);

        seatWebSocketService.notifySeatChanged(showtime.getId(), request.getSeatIds(), "HELD");
        log.info("User {} held {} seats for showtime {}, booking {}",
                user.getUsername(), seats.size(), showtime.getId(), booking.getBookingCode());

        int holdMinutes = systemConfigService.getInt("booking.hold_minutes", 10);
        return HoldSeatsResponse.builder()
                .bookingId(booking.getId())
                .bookingCode(booking.getBookingCode())
                .holdExpiry(booking.getCreatedAt().plusMinutes(holdMinutes))
                .totalAmount(totalAmount)
                .seats(seatResponses)
                .build();
    }

    // ============================================================
    //  Helpers cho holdSeats() — mỗi method 1 trách nhiệm, < 40 dòng
    // ============================================================

    /**
     * [G3 + G4] Chống user spam booking:
     * - G3: chặn nhiều booking HOLDING cùng 1 showtime (chiếm dụng ghế)
     * - G4: chống bot DoS — giới hạn số booking/ngày
     */
    private void validateUserBookingCapacity(Long userId, Long showtimeId) {
        long activeHolding = bookingRepository.countByUserIdAndShowtimeIdAndStatus(
                userId, showtimeId, BookingStatus.HOLDING);
        if (activeHolding > 0) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Bạn đang có một đơn đặt vé đang chờ thanh toán cho suất chiếu này. Vui lòng hoàn tất hoặc hủy đơn cũ trước.");
        }
        int maxPerDay = systemConfigService.getInt("booking.max_per_user_per_day", 20);
        long todayCount = bookingRepository.countByUserIdAndCreatedAtAfter(
                userId, LocalDateTime.now().toLocalDate().atStartOfDay());
        if (todayCount >= maxPerDay) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Bạn đã đặt quá " + maxPerDay + " vé hôm nay. Vui lòng thử lại ngày mai.");
        }
    }

    /**
     * Phase 2 age-rating enforcement: nếu user đã khai DOB ở profile → check tuổi.
     *
     * <p>User CHƯA khai DOB → no-op (FE đã có confirm dialog disclaimer cho T13+, và barrier
     * thật là verify CCCD ở cổng rạp — Phase 3 POS reject check-in).
     *
     * <p>Min age theo TT 25/2024: T13→13, T16→16, T18→18. P/K không cần check.
     * Mức C (cấm phổ biến) không xuất hiện trong booking system — phim cấm không lên rạp.
     */
    private void validateAgeIfDOBSet(User user, com.cinex.module.movie.entity.AgeRating ageRating) {
        if (user.getDateOfBirth() == null || ageRating == null) return;
        int minAge = switch (ageRating) {
            case P, K -> 0;
            case T13 -> 13;
            case T16 -> 16;
            case T18 -> 18;
        };
        if (minAge == 0) return;
        int userAge = java.time.Period.between(user.getDateOfBirth(), LocalDate.now()).getYears();
        if (userAge < minAge) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    String.format("Phim này phân loại %s — yêu cầu từ %d tuổi trở lên. Bạn hiện %d tuổi.",
                            ageRating.name(), minAge, userAge));
        }
    }

    /**
     * Pessimistic lock showtime row + validate showtime còn được phép đặt.
     * Lock TRƯỚC khi check ghế trống → 2 user concurrent hold sẽ tuần tự, tránh TOCTOU.
     */
    private Showtime lockAndValidateShowtime(Long showtimeId) {
        Showtime showtime = showtimeRepository.findByIdForUpdate(showtimeId)
                .orElseThrow(() -> new BusinessException(ErrorCode.SHOWTIME_NOT_FOUND));
        int bookingCutoff = systemConfigService.getInt("booking.cutoff_after_start_minutes", 15);
        if (showtime.getStartTime().plusMinutes(bookingCutoff).isBefore(LocalDateTime.now())) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Suất chiếu đã bắt đầu quá " + bookingCutoff + " phút");
        }
        return showtime;
    }

    /**
     * Dedup seatIds + validate max ghế/lần đặt. Return uniqueSeatIds đã dedup.
     * Tránh user gửi [1,1,2] → count = 3 nhưng thực ra chỉ 2 ghế khác nhau.
     */
    private List<Long> validateSeatSelection(List<Long> rawSeatIds) {
        List<Long> uniqueSeatIds = rawSeatIds.stream().distinct().toList();
        int maxSeats = systemConfigService.getInt("booking.max_seats", 8);
        if (uniqueSeatIds.size() > maxSeats) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Tối đa " + maxSeats + " ghế mỗi lần đặt");
        }
        return uniqueSeatIds;
    }

    /**
     * Validate ghế: chưa bị HELD/BOOKED, đầy đủ tồn tại, không có ghế BROKEN.
     * Return list Seat entities sẵn sàng dùng tiếp.
     */
    private List<Seat> validateSeatsAvailableAndOperational(Long showtimeId, List<Long> uniqueSeatIds) {
        List<BookingSeat> occupied = bookingSeatRepository.findHeldOrBookedSeats(showtimeId, uniqueSeatIds);
        if (!occupied.isEmpty()) {
            String takenSeats = occupied.stream()
                    .map(bs -> bs.getSeat().getSeatNumber())
                    .reduce((a, b) -> a + ", " + b)
                    .orElse("");
            throw new BusinessException(ErrorCode.SEAT_ALREADY_BOOKED,
                    "Các ghế đã được đặt hoặc đang giữ: " + takenSeats);
        }

        List<Seat> seats = seatRepository.findAllById(uniqueSeatIds);
        if (seats.size() != uniqueSeatIds.size()) {
            throw new BusinessException(ErrorCode.SEAT_NOT_FOUND, "Một hoặc nhiều ghế không tồn tại");
        }

        // Aisle: lối đi, không phải ghế thật → KHÔNG cho book
        List<String> aisleSeats = seats.stream()
                .filter(Seat::isAisle)
                .map(Seat::getSeatNumber)
                .toList();
        if (!aisleSeats.isEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Vị trí là lối đi, không phải ghế: " + String.join(", ", aisleSeats));
        }

        // BLOCKED: chặn vĩnh viễn (cột bê tông, lối thoát hiểm)
        List<String> blockedSeats = seats.stream()
                .filter(s -> s.getStatus() == SeatStatus.BLOCKED)
                .map(Seat::getSeatNumber)
                .toList();
        if (!blockedSeats.isEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Ghế bị chặn vĩnh viễn, không thể đặt: " + String.join(", ", blockedSeats));
        }

        // BROKEN: hỏng tạm thời (có thể sửa)
        List<String> brokenSeats = seats.stream()
                .filter(s -> s.getStatus() == SeatStatus.BROKEN)
                .map(Seat::getSeatNumber)
                .toList();
        if (!brokenSeats.isEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Ghế đang bảo trì, không thể đặt: " + String.join(", ", brokenSeats));
        }
        return seats;
    }

    /**
     * Tính tổng tiền: SUM(price từng ghế) → áp voucher (nếu có) → cap floor 0.
     * Voucher resolution dùng theaterId của booking để match theater-specific vs global.
     */
    private BigDecimal computeTotalAmountWithVoucher(List<Seat> seats, Showtime showtime,
                                                     String voucherCode, Long userId, Long theaterId) {
        BigDecimal totalAmount = BigDecimal.ZERO;
        for (Seat seat : seats) {
            totalAmount = totalAmount.add(getPriceForSeat(seat.getSeatType(), showtime));
        }
        if (voucherCode == null || voucherCode.isBlank()) return totalAmount;

        ValidateVoucherResponse voucherResult = voucherService.validateVoucher(
                voucherCode, totalAmount, userId, theaterId);
        if (!voucherResult.isValid()) return totalAmount;

        BigDecimal discounted = totalAmount.subtract(voucherResult.getDiscountAmount());
        return discounted.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : discounted;
    }

    /** Persist booking ở trạng thái HOLDING + sinh mã unique. */
    private Booking createHoldingBooking(User user, Showtime showtime, BigDecimal totalAmount) {
        String bookingCode = idTrackerService.nextCodeWithDate("BOOKING");
        Booking booking = Booking.builder()
                .user(user)
                .showtime(showtime)
                // Snapshot theater immutable từ showtime.room.theater — chuẩn industry.
                .theater(showtime.getRoom().getTheater())
                .totalAmount(totalAmount)
                .status(BookingStatus.HOLDING)
                .bookingCode(bookingCode)
                .qrToken(generateQrToken())
                .build();
        bookingRepository.save(booking);
        return booking;
    }

    /**
     * Ghi nhận voucher đã sử dụng (FIX 1) — gọi ngay khi hold ghế thay vì đợi confirm.
     * Lý do: nếu user không confirm trong holdMinutes, scheduler cancel booking sẽ
     * decrement usedCount → voucher trả lại.
     */
    private void registerVoucherUsageIfPresent(String voucherCode, User user, Booking booking, Long theaterId) {
        if (voucherCode == null || voucherCode.isBlank()) return;
        voucherService.useVoucherByCode(voucherCode, user, booking, theaterId);
    }

    /**
     * Persist BookingSeat entities với status=HELD.
     * Bọc try/catch DataIntegrityViolationException để xử lý vi phạm partial unique index
     * uk_booking_seats_active — lá chắn cuối cùng cho race condition mà lock showtime miss
     * (Hibernate flush trễ, propagation REQUIRES_NEW,...).
     */
    private List<BookingSeatResponse> persistHeldBookingSeats(Booking booking, List<Seat> seats,
                                                               Showtime showtime, List<Long> uniqueSeatIds) {
        try {
            List<BookingSeatResponse> responses = seats.stream().map(seat -> {
                BigDecimal price = getPriceForSeat(seat.getSeatType(), showtime);
                BookingSeat bs = BookingSeat.builder()
                        .booking(booking)
                        .seat(seat)
                        .showtimeId(showtime.getId())  // denorm để DB partial unique index hoạt động
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
            // Force flush để DB nhận exception ngay trong try (mặc định Hibernate batch đến end-of-tx).
            bookingSeatRepository.flush();
            return responses;
        } catch (DataIntegrityViolationException ex) {
            log.warn("Double-booking attempt detected for showtime {} seats {}: {}",
                    showtime.getId(), uniqueSeatIds, ex.getMostSpecificCause().getMessage());
            throw new BusinessException(ErrorCode.SEAT_ALREADY_BOOKED,
                    "Một số ghế vừa bị người khác đặt, vui lòng chọn lại");
        }
    }

    /**
     * Confirm booking — đổi HOLDING → CONFIRMED.
     */
    @Transactional
    public BookingResponse confirmBooking(Long userId, ConfirmBookingRequest request) {
        Booking booking = bookingRepository.findById(request.getBookingId())
                .orElseThrow(() -> new BusinessException(ErrorCode.BOOKING_NOT_FOUND));

        validateBookingOwnership(booking, userId);
        validateBookingForConfirm(booking);
        requirePaymentCompleted(booking);

        markBookingAsConfirmed(booking);
        log.info("Booking {} confirmed", booking.getBookingCode());
        return toBookingResponse(booking);
    }

    /** Validate user là chủ booking. Branch admin / SUPER_ADMIN bypass nếu có role check riêng. */
    private void validateBookingOwnership(Booking booking, Long userId) {
        if (!booking.getUser().getId().equals(userId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Đây không phải đơn đặt vé của bạn");
        }
    }

    /** Validate booking đủ điều kiện confirm: trạng thái HOLDING + chưa hết hạn hold window. */
    private void validateBookingForConfirm(Booking booking) {
        if (booking.getStatus() != BookingStatus.HOLDING) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Đơn đặt vé không ở trạng thái chờ xác nhận, trạng thái hiện tại: " + booking.getStatus());
        }
        int holdMinutes = systemConfigService.getInt("booking.hold_minutes", 10);
        if (booking.getCreatedAt().plusMinutes(holdMinutes).isBefore(LocalDateTime.now())) {
            throw new BusinessException(ErrorCode.BOOKING_EXPIRED, "Thời gian giữ ghế đã hết hạn");
        }
    }

    /**
     * [B3] Chặn bypass thanh toán — bắt buộc phải có Payment COMPLETED trước khi confirm.
     * Trước đây user có thể gọi /confirm để bypass payment → vé free.
     */
    private void requirePaymentCompleted(Booking booking) {
        Payment payment = paymentRepository.findByBookingId(booking.getId())
                .orElseThrow(() -> new BusinessException(ErrorCode.PAYMENT_NOT_FOUND,
                        "Chưa có thanh toán cho booking này"));
        if (payment.getStatus() != PaymentStatus.COMPLETED) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Booking chưa được thanh toán, không thể xác nhận");
        }
    }

    /** Đổi status booking + bookingSeats sang trạng thái CONFIRMED/BOOKED. */
    private void markBookingAsConfirmed(Booking booking) {
        booking.setStatus(BookingStatus.CONFIRMED);
        booking.setConfirmedAt(LocalDateTime.now());
        booking.getBookingSeats().forEach(bs -> bs.setStatus(BookingSeatStatus.BOOKED));
        bookingRepository.save(booking);
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
    @Auditable(action = "CANCEL_BOOKING", entityType = "Booking")
    public BookingResponse cancelBooking(Long userId, Long bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new BusinessException(ErrorCode.BOOKING_NOT_FOUND));

        validateBookingOwnership(booking, userId);
        validateBookingCancellable(booking);

        markBookingAsCancelled(booking);
        refundPaymentIfExists(bookingId);
        returnUsedVouchers(booking);
        notifySeatsReleased(booking);
        sendCancellationEmail(booking);

        log.info("Booking {} cancelled by user", booking.getBookingCode());
        return toBookingResponse(booking);
    }

    /** Validate booking ở trạng thái có thể hủy + chưa quá deadline trước suất chiếu. */
    private void validateBookingCancellable(Booking booking) {
        if (booking.getStatus() != BookingStatus.HOLDING && booking.getStatus() != BookingStatus.CONFIRMED) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Không thể hủy đơn đặt vé ở trạng thái: " + booking.getStatus());
        }
        int cancelBeforeMinutes = systemConfigService.getInt("booking.cancel_before_minutes", 60);
        LocalDateTime deadline = booking.getShowtime().getStartTime().minusMinutes(cancelBeforeMinutes);
        if (LocalDateTime.now().isAfter(deadline)) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Chỉ được hủy vé trước " + cancelBeforeMinutes + " phút khi suất chiếu bắt đầu");
        }
    }

    private void markBookingAsCancelled(Booking booking) {
        booking.setStatus(BookingStatus.CANCELLED);
        booking.setCancelledAt(LocalDateTime.now());
        booking.getBookingSeats().forEach(bs -> bs.setStatus(BookingSeatStatus.CANCELLED));
        bookingRepository.save(booking);
    }

    /**
     * Refund qua PaymentService — logic refund tập trung tại Payment module,
     * BookingService không gọi cổng thanh toán trực tiếp (SRP).
     */
    private void refundPaymentIfExists(Long bookingId) {
        paymentRepository.findByBookingId(bookingId).ifPresent(payment ->
                paymentService.refundPayment(payment, "User cancelled booking"));
    }

    /** Trả lại voucher đã dùng (decrement usedCount + xóa VoucherUsage). */
    private void returnUsedVouchers(Booking booking) {
        var usages = voucherUsageRepository.findByBookingId(booking.getId());
        for (var usage : usages) {
            var voucher = usage.getVoucher();
            if (voucher.getUsedCount() > 0) {
                voucher.setUsedCount(voucher.getUsedCount() - 1);
            }
            voucherUsageRepository.delete(usage);
            log.info("Voucher {} returned for cancelled booking {}",
                    voucher.getCode(), booking.getBookingCode());
        }
    }

    /** WebSocket broadcast: ghế trả lại trạng thái AVAILABLE cho user khác đang xem sơ đồ. */
    private void notifySeatsReleased(Booking booking) {
        List<Long> seatIds = booking.getBookingSeats().stream()
                .map(bs -> bs.getSeat().getId()).toList();
        seatWebSocketService.notifySeatChanged(
                booking.getShowtime().getId(), seatIds, "AVAILABLE");
    }

    /** Gửi email thông báo hủy (async, không chặn flow chính). */
    private void sendCancellationEmail(Booking booking) {
        String email = booking.getUser().getEmail();
        String movieTitle = booking.getShowtime().getMovie().getTitle();
        java.text.NumberFormat nf = java.text.NumberFormat.getInstance(new java.util.Locale("vi", "VN"));
        emailService.sendCancellationEmail(email, booking.getBookingCode(), movieTitle,
                nf.format(booking.getTotalAmount()) + "đ");
    }

    /**
     * Check-in — staff/admin quét QR (qrToken) hoặc nhập manual bookingCode.
     *
     * Param `code` chấp nhận 2 dạng:
     * - qrToken (32 ký tự hex, random) — quét QR → an toàn, không thể brute force.
     * - bookingCode (CX-YYYYMMDD-NNN) — nhập tay khi QR hỏng. Có rủi ro hacker đoán code
     *   nhưng đỡ vì cần staff trực tiếp, staff có thể verify danh tính (CCCD, SĐT).
     *
     * Thử qrToken trước (đường an toàn), fallback bookingCode (đường manual).
     */
    @Transactional
    public BookingResponse checkIn(String code) {
        Booking booking = bookingRepository.findByQrToken(code)
                .or(() -> {
                    log.info("Check-in fallback to bookingCode (manual mode): {}", code);
                    return bookingRepository.findByBookingCode(code);
                })
                .orElseThrow(() -> new BusinessException(ErrorCode.BOOKING_NOT_FOUND,
                        "Booking not found: " + code));

        if (booking.getStatus() == BookingStatus.CHECKED_IN) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST, "Vé đã được sử dụng");
        }

        if (booking.getStatus() != BookingStatus.CONFIRMED) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Đơn đặt vé chưa được xác nhận, trạng thái: " + booking.getStatus());
        }

        booking.setStatus(BookingStatus.CHECKED_IN);
        bookingRepository.save(booking);

        log.info("Booking {} checked in", booking.getBookingCode());
        return toBookingResponse(booking);
    }

    /**
     * Preview booking info trước khi check-in (chuẩn Vista/Veezi): staff scan/nhập code
     * → BE trả booking info + ageRating → FE hiển thị cảnh báo, staff verify CCCD vật lý
     * → click Admit (gọi checkIn) hoặc Reject (gọi rejectCheckIn).
     *
     * <p>Read-only, KHÔNG mutate trạng thái booking — chỉ lookup info.
     */
    @Transactional(readOnly = true)
    public BookingResponse previewCheckIn(String code) {
        Booking booking = bookingRepository.findByQrToken(code)
                .or(() -> bookingRepository.findByBookingCode(code))
                .orElseThrow(() -> new BusinessException(ErrorCode.BOOKING_NOT_FOUND,
                        "Booking not found: " + code));
        return toBookingResponse(booking);
    }

    /**
     * Từ chối check-in tại cổng — staff verify CCCD thấy không đủ tuổi (T13/T16/T18) hoặc
     * lý do khác → click "Từ chối". Booking flip CONFIRMED → REJECTED.
     *
     * <p>Theo policy CGV/Lotte: <b>không hoàn tiền</b> vì user đã được cảnh báo ở 3 nơi
     * (confirm dialog đặt vé, chip trên QR ticket, profile DOB). @Auditable log reason
     * để khiếu nại sau có chứng cớ.
     */
    @Transactional
    @com.cinex.common.audit.Auditable(action = "REJECT_CHECK_IN", entityType = "Booking")
    public BookingResponse rejectCheckIn(String code, String reason) {
        Booking booking = bookingRepository.findByQrToken(code)
                .or(() -> bookingRepository.findByBookingCode(code))
                .orElseThrow(() -> new BusinessException(ErrorCode.BOOKING_NOT_FOUND,
                        "Booking not found: " + code));

        if (booking.getStatus() == BookingStatus.CHECKED_IN) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Vé đã check-in, không thể từ chối");
        }
        if (booking.getStatus() != BookingStatus.CONFIRMED) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Chỉ vé CONFIRMED mới từ chối được, trạng thái hiện tại: " + booking.getStatus());
        }

        booking.setStatus(BookingStatus.REJECTED);
        bookingRepository.save(booking);

        log.info("Booking {} REJECTED at gate. Reason: {}", booking.getBookingCode(), reason);
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
     * Admin: xem booking. RBAC scope: branch ADMIN bị override filter.theaterId theo chi nhánh
     * mình; SUPER_ADMIN xem hết hoặc filter theo theater được chọn.
     */
    @Transactional(readOnly = true)
    public Page<BookingListResponse> listAllBookings(BookingFilter filter, Pageable pageable) {
        Long scopedTheaterId = securityService.getCurrentUserTheaterId();
        if (scopedTheaterId != null) {
            filter.setTheaterId(scopedTheaterId);
        }
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
     * Sinh ảnh QR (base64) cho booking — encode qrToken random, không encode bookingCode.
     * Trả base64 trực tiếp để qrToken KHÔNG bao giờ lộ ra ngoài service boundary.
     */
    @Transactional(readOnly = true)
    public String getBookingQrBase64(Long userId, Long bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new BusinessException(ErrorCode.BOOKING_NOT_FOUND));
        if (!booking.getUser().getId().equals(userId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Đây không phải đơn đặt vé của bạn");
        }
        return qrCodeService.generateQrCodeBase64(booking.getQrToken(), 300);
    }

    /**
     * Sơ đồ ghế với trạng thái cho 1 suất chiếu.
     */
    @Transactional(readOnly = true)
    public List<BookingSeat> getOccupiedSeats(Long showtimeId) {
        return bookingSeatRepository.findAllOccupiedByShowtimeId(showtimeId);
    }

    // === Private helpers ===

    /**
     * Sinh qr_token random 32 ký tự (UUID v4 bỏ dấu '-').
     *
     * Vì sao tách khỏi bookingCode?
     * - bookingCode (CX-YYYYMMDD-NNN) cho user thấy, in vé, hỗ trợ qua hotline.
     * - qrToken random 16^32 tổ hợp → không brute force được → bảo vệ check-in.
     * Chỉ qrToken nằm trong QR; bookingCode KHÔNG nằm trong QR.
     */
    private String generateQrToken() {
        return UUID.randomUUID().toString().replace("-", "");
    }

    /**
     * Tính giá ghế cuối cùng sau khi áp dụng pricing rules (weekend/peak/holiday...).
     *
     * <p>Flow: {@code rawPrice} (theo seat type) → {@link PricingEngine#applyModifiers} →
     * giá đã modifier theo {@code showtime.startTime}.
     *
     * <p>Snapshot vào {@code BookingSeat.price} — sau này admin sửa rule sẽ KHÔNG ảnh
     * hưởng booking đã tạo (lịch sử doanh thu đúng).
     */
    private BigDecimal getPriceForSeat(SeatType seatType, Showtime showtime) {
        BigDecimal rawPrice = switch (seatType) {
            case VIP -> showtime.getVipPrice();
            case COUPLE -> showtime.getCouplePrice();
            // SWEETBOX cao cấp hơn couple — fallback couple × 2 nếu showtime chưa set
            case SWEETBOX -> showtime.getSweetboxPrice() != null
                    ? showtime.getSweetboxPrice()
                    : showtime.getCouplePrice().multiply(java.math.BigDecimal.valueOf(2));
            // DELUXE (recliner) — fallback vip × 1.5
            case DELUXE -> showtime.getDeluxePrice() != null
                    ? showtime.getDeluxePrice()
                    : showtime.getVipPrice().multiply(java.math.BigDecimal.valueOf(3))
                                            .divide(java.math.BigDecimal.valueOf(2), 0, java.math.RoundingMode.HALF_UP);
            // HANDICAP & STANDARD = basePrice (chính sách inclusive — không phụ thu cho người khuyết tật)
            default -> showtime.getBasePrice();
        };
        Long theaterId = showtime.getRoom().getTheater().getId();
        return pricingEngine.applyModifiers(rawPrice, showtime.getStartTime(), theaterId);
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

        // Theater scope guard (chuẩn industry Vista/Veezi): BRANCH_ADMIN không được bán vé cho rạp khác.
        // Doanh thu attribute vào showtime.room.theater — phải khớp JWT scope.
        // SUPER_ADMIN pass mọi theater; FE đã ép chọn 1 CN trong POS context (POSTheaterRequired).
        Long showtimeTheaterId = showtime.getRoom().getTheater().getId();
        securityService.requireAccessToTheater(showtimeTheaterId);

        validateShowtimeBookable(showtime);
        List<Long> uniqueSeatIds = request.getSeatIds().stream().distinct().toList();
        List<Seat> seats = validateSeatsAvailableAndOperational(request.getShowtimeId(), uniqueSeatIds);
        BigDecimal totalAmount = computeSeatsTotal(seats, showtime);

        Booking booking = createConfirmedBooking(showtime, totalAmount);
        persistBookedSeats(booking, seats, showtime);
        createCompletedCashPayment(booking, totalAmount, request.getPaymentMethod());

        seatWebSocketService.notifySeatChanged(showtime.getId(),
                seats.stream().map(Seat::getId).toList(), "BOOKED");
        log.info("Counter sale: {} - {} seats - {} VND",
                booking.getBookingCode(), seats.size(), totalAmount);
        return toBookingResponse(booking);
    }

    /** Validate showtime chưa quá giờ cho phép đặt vé (cùng logic với holdSeats). */
    private void validateShowtimeBookable(Showtime showtime) {
        int bookingCutoff = systemConfigService.getInt("booking.cutoff_after_start_minutes", 15);
        if (showtime.getStartTime().plusMinutes(bookingCutoff).isBefore(LocalDateTime.now())) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Suất chiếu đã bắt đầu quá " + bookingCutoff + " phút");
        }
    }

    /** SUM(seatPrice) — không có voucher cho POS counter sale. */
    private BigDecimal computeSeatsTotal(List<Seat> seats, Showtime showtime) {
        BigDecimal total = BigDecimal.ZERO;
        for (Seat seat : seats) {
            total = total.add(getPriceForSeat(seat.getSeatType(), showtime));
        }
        return total;
    }

    /** Tạo booking CONFIRMED ngay (POS không qua HOLDING). */
    private Booking createConfirmedBooking(Showtime showtime, BigDecimal totalAmount) {
        String bookingCode = idTrackerService.nextCodeWithDate("BOOKING");
        Booking booking = Booking.builder()
                .showtime(showtime)
                // Snapshot theater immutable từ showtime.room.theater — chuẩn industry.
                .theater(showtime.getRoom().getTheater())
                .totalAmount(totalAmount)
                .status(BookingStatus.CONFIRMED)
                .bookingCode(bookingCode)
                .qrToken(generateQrToken())
                .confirmedAt(LocalDateTime.now())
                .build();
        bookingRepository.save(booking);
        return booking;
    }

    /** Persist BookingSeat ở trạng thái BOOKED (skip HELD → BOOKED transition). */
    private void persistBookedSeats(Booking booking, List<Seat> seats, Showtime showtime) {
        for (Seat seat : seats) {
            BigDecimal price = getPriceForSeat(seat.getSeatType(), showtime);
            bookingSeatRepository.save(BookingSeat.builder()
                    .booking(booking)
                    .seat(seat)
                    .showtimeId(showtime.getId())
                    .price(price)
                    .status(BookingSeatStatus.BOOKED)
                    .build());
        }
    }

    /** Payment cho POS — CASH/MOMO/TRANSFER + status COMPLETED ngay (tiền tại quầy). */
    private void createCompletedCashPayment(Booking booking, BigDecimal amount, String paymentMethod) {
        String txCode = idTrackerService.nextCodeWithDate("PAYMENT");
        Payment payment = Payment.builder()
                .booking(booking)
                .amount(amount)
                .method(resolveCounterPaymentMethod(paymentMethod))
                .transactionCode(txCode)
                .status(PaymentStatus.COMPLETED)
                .paidAt(LocalDateTime.now())
                .build();
        paymentRepository.save(payment);
    }

    /**
     * Validate payment method cho POS — chỉ chấp nhận CASH, MOMO, TRANSFER.
     * Trước đây fallback CASH khi method sai → admin có thể gửi method bậy bạ
     * mà hệ thống vẫn nhận → khó audit. Giờ throw lỗi rõ ràng.
     */
    private PaymentMethod resolveCounterPaymentMethod(String method) {
        if (method == null) return PaymentMethod.CASH;
        PaymentMethod parsed;
        try {
            parsed = PaymentMethod.valueOf(method);
        } catch (IllegalArgumentException e) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Payment method không hợp lệ cho POS");
        }
        if (parsed != PaymentMethod.CASH && parsed != PaymentMethod.MOMO && parsed != PaymentMethod.TRANSFER) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Payment method không hợp lệ cho POS");
        }
        return parsed;
    }

    private BookingListResponse toBookingListResponse(Booking booking) {
        var room = booking.getShowtime().getRoom();
        var theater = room.getTheater();
        return BookingListResponse.builder()
                .id(booking.getId())
                .storageState(booking.getStorageState() != null ? booking.getStorageState().name() : null)
                .bookingCode(booking.getBookingCode())
                .username(booking.getUser() != null ? booking.getUser().getUsername() : "Khách vãng lai")
                .status(booking.getStatus())
                .movieTitle(booking.getShowtime().getMovie().getTitle())
                .moviePosterUrl(booking.getShowtime().getMovie().getPosterUrl())
                .startTime(booking.getShowtime().getStartTime())
                .roomName(room.getName())
                .theaterId(theater != null ? theater.getId() : null)
                .theaterName(theater != null ? theater.getName() : null)
                .totalAmount(booking.getTotalAmount())
                .seatCount(booking.getBookingSeats().size())
                .createdAt(booking.getCreatedAt())
                .updatedAt(booking.getUpdatedAt())
                .build();
    }
}
