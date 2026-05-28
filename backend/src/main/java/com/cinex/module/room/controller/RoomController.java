package com.cinex.module.room.controller;

import com.cinex.common.dto.BulkDeleteRequest;
import com.cinex.common.response.ApiResponse;
import com.cinex.common.response.PageResponse;
import com.cinex.module.room.dto.RoomFilter;
import com.cinex.module.room.dto.RoomRequest;
import com.cinex.module.room.dto.RoomResponse;
import com.cinex.module.room.service.RoomService;
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
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
@Tag(name = "Room", description = "Cinema room management")
public class RoomController {

    private final RoomService roomService;

    /**
     * GET /api/rooms?keyword=Room&type=IMAX&status=ACTIVE&includeDeleted=false&page=0&size=20
     * Spring tự bind query params vào RoomFilter DTO.
     */
    @GetMapping
    @Operation(summary = "List rooms with filter")
    public ApiResponse<PageResponse<RoomResponse>> listRooms(
            RoomFilter filter,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ApiResponse.ok(PageResponse.from(roomService.listRooms(filter, pageable)));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get room detail")
    public ApiResponse<RoomResponse> getRoom(@PathVariable Long id) {
        return ApiResponse.ok(roomService.getRoom(id));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) Create a new room")
    public ApiResponse<RoomResponse> createRoom(@Valid @RequestBody RoomRequest request) {
        return ApiResponse.ok("Room created", roomService.createRoom(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) Update a room")
    public ApiResponse<RoomResponse> updateRoom(
            @PathVariable Long id,
            @Valid @RequestBody RoomRequest request) {
        return ApiResponse.ok("Room updated", roomService.updateRoom(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) Soft delete a room")
    public ApiResponse<Void> deleteRoom(@PathVariable Long id) {
        roomService.deleteRoom(id);
        return ApiResponse.ok("Room deleted", null);
    }

    @PostMapping("/{id}/restore")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) Restore a soft-deleted room")
    public ApiResponse<RoomResponse> restoreRoom(@PathVariable Long id) {
        return ApiResponse.ok("Room restored", roomService.restoreRoom(id));
    }

    @PostMapping("/bulk-delete")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) Bulk soft delete rooms")
    public ApiResponse<Void> bulkDelete(@Valid @RequestBody BulkDeleteRequest request) {
        roomService.bulkDelete(request.getIds());
        return ApiResponse.ok("Deleted " + request.getIds().size() + " rooms", null);
    }

    @PostMapping("/bulk-restore")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) Bulk restore")
    public ApiResponse<Void> bulkRestore(@Valid @RequestBody BulkDeleteRequest request) {
        roomService.bulkRestore(request.getIds());
        return ApiResponse.ok("Restored " + request.getIds().size() + " items", null);
    }
}
