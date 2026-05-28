package com.cinex.module.booking.controller;

import com.cinex.common.response.ApiResponse;
import com.cinex.common.response.PageResponse;
import com.cinex.common.service.QrCodeService;
import com.cinex.common.service.SecurityService;
import com.cinex.module.booking.dto.BookingFilter;
import com.cinex.module.booking.dto.BookingListResponse;
import com.cinex.module.booking.dto.BookingResponse;
import com.cinex.module.booking.dto.ConfirmBookingRequest;
import com.cinex.module.booking.dto.CounterSaleRequest;
import com.cinex.module.booking.dto.HoldSeatsRequest;
import com.cinex.module.booking.dto.HoldSeatsResponse;
import com.cinex.module.booking.service.BookingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
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
    private final SecurityService securityService;
    private final QrCodeService qrCodeService;

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
    @Operation(summary = "(Admin/Staff) Check-in by booking code")
    public ApiResponse<BookingResponse> checkIn(@RequestParam String code) {
        return ApiResponse.ok("Checked in", bookingService.checkIn(code));
    }

    @GetMapping("/showtimes/{showtimeId}/occupied-seats")
    @Operation(summary = "Get occupied seat IDs for a showtime")
    public ApiResponse<java.util.List<Long>> getOccupiedSeats(@PathVariable Long showtimeId) {
        return ApiResponse.ok(bookingService.getOccupiedSeats(showtimeId).stream()
                .map(bs -> bs.getSeat().getId()).toList());
    }

    @GetMapping("/{id}/qr")
    @Operation(summary = "Get QR code for booking (base64)")
    public ApiResponse<String> getQrCode(@PathVariable Long id) {
        Long userId = securityService.getCurrentUserId();
        BookingResponse booking = bookingService.getBookingDetail(userId, id);
        String qrBase64 = qrCodeService.generateQrCodeBase64(booking.getBookingCode(), 300);
        return ApiResponse.ok(qrBase64);
    }

}
