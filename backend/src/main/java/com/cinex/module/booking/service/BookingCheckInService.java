package com.cinex.module.booking.service;

import com.cinex.common.audit.Auditable;
import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.common.util.ClientIpUtil;
import com.cinex.module.booking.dto.BookingResponse;
import com.cinex.module.booking.entity.Booking;
import com.cinex.module.booking.entity.BookingStatus;
import com.cinex.module.booking.mapper.BookingResponseMapper;
import com.cinex.module.booking.repository.BookingRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service chuyên trách flow check-in tại cổng rạp (staff/admin).
 *
 * <p><b>Tách khỏi BookingService:</b> BookingService trước đây 849 dòng vi phạm SRP
 * (workflow booking + check-in + POS + read query trộn vào nhau). Check-in có scope
 * riêng (staff scan QR, không liên quan tới user flow đặt vé) → tách thành service
 * độc lập, dễ test + thêm rate-limit / audit policy mà không ảnh hưởng booking flow.
 *
 * <p>Lookup ưu tiên qrToken (32-char random từ QR) → fallback bookingCode
 * (CX-YYYYMMDD-NNN, manual mode khi QR hỏng).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class BookingCheckInService {

    private final BookingRepository bookingRepository;
    private final BookingResponseMapper bookingResponseMapper;
    private final CheckInRateLimitService rateLimitService;

    /**
     * Check-in vé tại cổng: CONFIRMED → CHECKED_IN.
     * Idempotent: vé đã CHECKED_IN sẽ throw error rõ ràng.
     *
     * <p>Rate limit theo IP để chống brute-force bookingCode khi credential ADMIN leak.
     */
    @Transactional
    public BookingResponse checkIn(String code, HttpServletRequest httpRequest) {
        String ip = ClientIpUtil.resolve(httpRequest);
        rateLimitService.checkBlockedByIp(ip);
        Booking booking = lookupWithRateLimit(code, ip, true);

        if (booking.getStatus() == BookingStatus.CHECKED_IN) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST, "Vé đã được sử dụng");
        }
        if (booking.getStatus() != BookingStatus.CONFIRMED) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Đơn đặt vé chưa được xác nhận, trạng thái: " + booking.getStatus());
        }

        booking.setStatus(BookingStatus.CHECKED_IN);
        bookingRepository.save(booking);

        rateLimitService.clearFails(ip);
        log.info("Booking {} checked in", booking.getBookingCode());
        return bookingResponseMapper.toResponse(booking);
    }

    /**
     * Preview booking info trước khi admit/reject — read-only.
     * Chuẩn Vista/Veezi: staff scan/nhập code → BE trả info → FE hiển thị cảnh báo
     * (T16, T18...) → staff verify CCCD vật lý → click Admit hoặc Reject.
     */
    @Transactional(readOnly = true)
    public BookingResponse previewCheckIn(String code, HttpServletRequest httpRequest) {
        String ip = ClientIpUtil.resolve(httpRequest);
        rateLimitService.checkBlockedByIp(ip);
        return bookingResponseMapper.toResponse(lookupWithRateLimit(code, ip, false));
    }

    /**
     * Từ chối check-in tại cổng — staff verify CCCD thấy không đủ tuổi (T13/T16/T18)
     * hoặc lý do khác → click "Từ chối". Booking flip CONFIRMED → REJECTED.
     *
     * <p>Theo policy CGV/Lotte: <b>không hoàn tiền</b> vì user đã được cảnh báo ở 3 nơi
     * (confirm dialog đặt vé, chip trên QR ticket, profile DOB). @Auditable log reason.
     */
    @Transactional
    @Auditable(action = "REJECT_CHECK_IN", entityType = "Booking")
    public BookingResponse rejectCheckIn(String code, String reason, HttpServletRequest httpRequest) {
        String ip = ClientIpUtil.resolve(httpRequest);
        rateLimitService.checkBlockedByIp(ip);
        Booking booking = lookupWithRateLimit(code, ip, false);

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
        return bookingResponseMapper.toResponse(booking);
    }

    /**
     * Tìm booking theo qrToken (ưu tiên) hoặc bookingCode (fallback manual).
     * Record fail vào rate limit nếu BOOKING_NOT_FOUND (chống brute-force).
     */
    private Booking lookupWithRateLimit(String code, String ip, boolean logFallback) {
        return bookingRepository.findByQrToken(code)
                .or(() -> {
                    if (logFallback) {
                        log.info("Check-in fallback to bookingCode (manual mode): {}", code);
                    }
                    return bookingRepository.findByBookingCode(code);
                })
                .orElseThrow(() -> {
                    rateLimitService.recordFailByIp(ip);
                    return new BusinessException(ErrorCode.BOOKING_NOT_FOUND, "Booking not found: " + code);
                });
    }
}
