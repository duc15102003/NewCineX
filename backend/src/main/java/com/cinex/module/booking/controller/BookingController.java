package com.cinex.module.booking.controller;

import com.cinex.common.response.ApiResponse;
import com.cinex.common.response.PageResponse;
import com.cinex.common.service.SecurityService;
import com.cinex.module.booking.dto.BookingFilter;
import com.cinex.module.booking.dto.BookingListResponse;
import com.cinex.module.booking.dto.BookingResponse;
import com.cinex.module.booking.dto.ConfirmBookingRequest;
import com.cinex.module.booking.dto.CounterSaleRequest;
import com.cinex.module.booking.dto.HoldSeatsRequest;
import com.cinex.module.booking.dto.HoldSeatsResponse;
import com.cinex.module.booking.service.BookingCheckInService;
import com.cinex.module.booking.service.BookingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/bookings")
@RequiredArgsConstructor
@Tag(name = "Booking", description = "Booking management — hold, confirm, cancel, check-in")
public class BookingController {

    private final BookingService bookingService;
    private final BookingCheckInService bookingCheckInService;
    private final SecurityService securityService;

    @PostMapping("/hold")
    @Operation(summary = "Hold seats for a showtime (10 min)")
    public ApiResponse<HoldSeatsResponse> holdSeats(@Valid @RequestBody HoldSeatsRequest request) {
        Long userId = securityService.getCurrentUserId();
        return ApiResponse.ok("Seats held", bookingService.holdSeats(userId, request));
    }

    @PostMapping("/counter-sale")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) POS bán vé tại quầy — chọn suất + ghế, CONFIRMED luôn")
    public ApiResponse<BookingResponse> counterSale(@Valid @RequestBody CounterSaleRequest request) {
        return ApiResponse.ok("Bán vé thành công", bookingService.counterSale(request));
    }

    @PostMapping("/confirm")
    @Operation(summary = "Confirm booking (after payment)")
    public ApiResponse<BookingResponse> confirmBooking(@Valid @RequestBody ConfirmBookingRequest request) {
        Long userId = securityService.getCurrentUserId();
        return ApiResponse.ok("Booking confirmed", bookingService.confirmBooking(userId, request));
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) List all bookings")
    public ApiResponse<PageResponse<BookingListResponse>> listAllBookings(
            BookingFilter filter,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ApiResponse.ok(PageResponse.from(bookingService.listAllBookings(filter, pageable)));
    }

    @GetMapping("/me")
    @Operation(summary = "List my bookings")
    public ApiResponse<PageResponse<BookingListResponse>> getMyBookings(
            BookingFilter filter,
            @PageableDefault(size = 10, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        Long userId = securityService.getCurrentUserId();
        return ApiResponse.ok(PageResponse.from(bookingService.getMyBookings(userId, filter, pageable)));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get booking detail")
    public ApiResponse<BookingResponse> getBookingDetail(@PathVariable Long id) {
        Long userId = securityService.getCurrentUserId();
        return ApiResponse.ok(bookingService.getBookingDetail(userId, id));
    }

    @PutMapping("/{id}/cancel")
    @Operation(summary = "Cancel booking (before showtime starts)")
    public ApiResponse<BookingResponse> cancelBooking(@PathVariable Long id) {
        Long userId = securityService.getCurrentUserId();
        return ApiResponse.ok("Booking cancelled", bookingService.cancelBooking(userId, id));
    }

    @PostMapping("/check-in")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin/Staff) Check-in — nhận qrToken (quét QR) hoặc bookingCode (nhập tay)")
    public ApiResponse<BookingResponse> checkIn(@RequestParam String code, HttpServletRequest httpRequest) {
        return ApiResponse.ok("Checked in", bookingCheckInService.checkIn(code, httpRequest));
    }

    @GetMapping("/check-in/preview")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin/Staff) Preview booking info trước khi admit/reject — read-only")
    public ApiResponse<BookingResponse> previewCheckIn(@RequestParam String code, HttpServletRequest httpRequest) {
        return ApiResponse.ok(bookingCheckInService.previewCheckIn(code, httpRequest));
    }

    @PostMapping("/check-in/reject")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin/Staff) Từ chối check-in tại cổng — vd không đủ tuổi sau verify CCCD")
    public ApiResponse<BookingResponse> rejectCheckIn(
            @RequestParam String code,
            @RequestParam(defaultValue = "UNDER_AGE") String reason,
            HttpServletRequest httpRequest) {
        return ApiResponse.ok("Vé đã bị từ chối", bookingCheckInService.rejectCheckIn(code, reason, httpRequest));
    }

    @GetMapping("/showtimes/{showtimeId}/occupied-seats")
    @Operation(summary = "Get occupied seat IDs for a showtime")
    public ApiResponse<java.util.List<Long>> getOccupiedSeats(@PathVariable Long showtimeId) {
        return ApiResponse.ok(bookingService.getOccupiedSeats(showtimeId).stream()
                .map(bs -> bs.getSeat().getId()).toList());
    }

    @GetMapping("/{id}/qr")
    @Operation(summary = "Get QR code for booking (base64) — QR chứa qrToken random, không phải bookingCode")
    public ApiResponse<String> getQrCode(@PathVariable Long id) {
        Long userId = securityService.getCurrentUserId();
        return ApiResponse.ok(bookingService.getBookingQrBase64(userId, id));
    }

}
