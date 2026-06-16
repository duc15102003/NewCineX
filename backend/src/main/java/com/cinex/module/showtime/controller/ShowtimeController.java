package com.cinex.module.showtime.controller;

import com.cinex.common.dto.BulkDeleteRequest;
import com.cinex.common.response.ApiResponse;
import com.cinex.common.response.PageResponse;
import com.cinex.module.showtime.dto.AutoScheduleRequest;
import com.cinex.module.showtime.dto.AutoScheduleResult;
import com.cinex.module.showtime.dto.ShowtimeFilter;
import com.cinex.module.showtime.dto.ShowtimeListResponse;
import com.cinex.module.showtime.dto.ShowtimeRequest;
import com.cinex.module.showtime.dto.ShowtimeResponse;
import com.cinex.module.showtime.service.ShowtimeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/showtimes")
@RequiredArgsConstructor
@Tag(name = "Showtime", description = "Showtime management")
public class ShowtimeController {

    private final ShowtimeService showtimeService;

    @GetMapping
    @Operation(summary = "List showtimes with filter (movieId, roomId, date, status)")
    public ApiResponse<PageResponse<ShowtimeListResponse>> listShowtimes(
            ShowtimeFilter filter,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ApiResponse.ok(PageResponse.from(showtimeService.listShowtimes(filter, pageable)));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get showtime detail with available seats")
    public ApiResponse<ShowtimeResponse> getShowtime(@PathVariable Long id) {
        return ApiResponse.ok(showtimeService.getShowtime(id));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) Create a new showtime")
    public ApiResponse<ShowtimeResponse> createShowtime(@Valid @RequestBody ShowtimeRequest request) {
        return ApiResponse.ok("Showtime created", showtimeService.createShowtime(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) Update a showtime")
    public ApiResponse<ShowtimeResponse> updateShowtime(
            @PathVariable Long id,
            @Valid @RequestBody ShowtimeRequest request) {
        return ApiResponse.ok("Showtime updated", showtimeService.updateShowtime(id, request));
    }

    @PostMapping("/auto-schedule")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) Auto-schedule bulk showtimes for movie × rooms × days")
    public ApiResponse<AutoScheduleResult> autoSchedule(@Valid @RequestBody AutoScheduleRequest request) {
        AutoScheduleResult result = showtimeService.autoSchedule(request);
        String msg = String.format("Tạo %d suất, skip %d", result.getCreated(), result.getSkipped());
        return ApiResponse.ok(msg, result);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) Soft delete a showtime")
    public ApiResponse<Void> deleteShowtime(@PathVariable Long id) {
        showtimeService.deleteShowtime(id);
        return ApiResponse.ok("Showtime deleted", null);
    }

    @PostMapping("/{id}/restore")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) Restore a soft-deleted showtime")
    public ApiResponse<ShowtimeResponse> restoreShowtime(@PathVariable Long id) {
        return ApiResponse.ok("Showtime restored", showtimeService.restoreShowtime(id));
    }

    /**
     * Huỷ suất chiếu — cascade refund tất cả vé CONFIRMED + thông báo khách.
     * Dùng cho case phim bị cut, sự cố kỹ thuật, force majeure (industry pattern
     * Vista Veezi / Cinetixx).
     */
    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) Cancel showtime + cascade refund bookings + notify customers")
    public ApiResponse<ShowtimeService.CancelShowtimeResult> cancelShowtime(
            @PathVariable Long id,
            @RequestBody(required = false) java.util.Map<String, String> body) {
        String reason = body != null ? body.getOrDefault("reason", "Suất chiếu bị huỷ") : "Suất chiếu bị huỷ";
        ShowtimeService.CancelShowtimeResult result = showtimeService.cancelShowtime(id, reason);
        return ApiResponse.ok("Showtime cancelled. Auto-cancelled " + result.cancelledBookings() + " bookings", result);
    }

    @PostMapping("/{id}/publish")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) Publish suất DRAFT → SCHEDULED (visible cho user)")
    public ApiResponse<ShowtimeResponse> publishShowtime(@PathVariable Long id) {
        return ApiResponse.ok("Showtime published", showtimeService.publishShowtime(id));
    }

    @PostMapping("/bulk-publish")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) Bulk publish DRAFT → SCHEDULED")
    public ApiResponse<Integer> bulkPublish(@Valid @RequestBody BulkDeleteRequest request) {
        int published = showtimeService.bulkPublish(request.getIds());
        return ApiResponse.ok("Published " + published + " showtimes", published);
    }

    @PostMapping("/bulk-delete")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) Bulk soft delete showtimes")
    public ApiResponse<Void> bulkDelete(@Valid @RequestBody BulkDeleteRequest request) {
        showtimeService.bulkDelete(request.getIds());
        return ApiResponse.ok("Deleted " + request.getIds().size() + " showtimes", null);
    }

    @PostMapping("/bulk-restore")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) Bulk restore")
    public ApiResponse<Void> bulkRestore(@Valid @RequestBody BulkDeleteRequest request) {
        showtimeService.bulkRestore(request.getIds());
        return ApiResponse.ok("Restored " + request.getIds().size() + " items", null);
    }
}
