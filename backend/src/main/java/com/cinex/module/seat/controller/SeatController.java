package com.cinex.module.seat.controller;

import com.cinex.common.response.ApiResponse;
import com.cinex.module.seat.dto.BulkUpdateSeatRequest;
import com.cinex.module.seat.dto.RoomSeatTypeSummaryResponse;
import com.cinex.module.seat.dto.SeatGenerateRequest;
import com.cinex.module.seat.dto.SeatMapResponse;
import com.cinex.module.seat.dto.SeatResponse;
import com.cinex.module.seat.dto.UpdateSeatRequest;
import com.cinex.module.seat.service.SeatService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * URL nhất quán: tất cả nằm dưới /api/rooms/{roomId}/seats
 * Ghế luôn thuộc 1 phòng → URL phản ánh quan hệ này.
 */
@RestController
@RequestMapping("/api/rooms/{roomId}/seats")
@RequiredArgsConstructor
@Tag(name = "Seat", description = "Seat map management")
public class SeatController {

    private final SeatService seatService;

    @GetMapping
    @Operation(summary = "Get seat map of a room")
    public ApiResponse<SeatMapResponse> getSeatMap(@PathVariable Long roomId) {
        return ApiResponse.ok(seatService.getSeatMap(roomId));
    }

    /**
     * Dùng cho form tạo/sửa Showtime: FE chọn phòng → gọi endpoint này → biết
     * phòng có loại ghế nào → render input giá ĐỘNG. Không cần auth ADMIN riêng
     * vì cùng quyền với getSeatMap (mọi user xem được seat map).
     */
    @GetMapping("/types")
    @Operation(summary = "Get distinct seat types of a room with counts (for dynamic pricing form)")
    public ApiResponse<RoomSeatTypeSummaryResponse> getSeatTypeSummary(@PathVariable Long roomId) {
        return ApiResponse.ok(seatService.getSeatTypeSummary(roomId));
    }

    @PostMapping("/generate")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) Generate seats for a room")
    public ApiResponse<SeatMapResponse> generateSeats(
            @PathVariable Long roomId,
            @Valid @RequestBody SeatGenerateRequest request) {
        return ApiResponse.ok("Seats generated", seatService.generateSeats(roomId, request));
    }

    @PutMapping("/bulk-update")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) Bulk update seat types")
    public ApiResponse<SeatMapResponse> bulkUpdateSeats(
            @PathVariable Long roomId,
            @Valid @RequestBody BulkUpdateSeatRequest request) {
        return ApiResponse.ok("Seats updated", seatService.bulkUpdateSeats(roomId, request));
    }

    @PutMapping("/{seatId}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) Update seat type or status")
    public ApiResponse<SeatResponse> updateSeat(
            @PathVariable Long roomId,
            @PathVariable Long seatId,
            @RequestBody UpdateSeatRequest request) {
        return ApiResponse.ok("Seat updated", seatService.updateSeat(seatId, request));
    }

    @DeleteMapping("/{seatId}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) Soft delete a seat")
    public ApiResponse<Void> deleteSeat(
            @PathVariable Long roomId,
            @PathVariable Long seatId) {
        seatService.deleteSeat(seatId);
        return ApiResponse.ok("Seat deleted", null);
    }

    @PostMapping("/{seatId}/restore")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) Restore a soft-deleted seat")
    public ApiResponse<SeatResponse> restoreSeat(
            @PathVariable Long roomId,
            @PathVariable Long seatId) {
        return ApiResponse.ok("Seat restored", seatService.restoreSeat(seatId));
    }
}
