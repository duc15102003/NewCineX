package com.cinex.module.room.service;

import com.cinex.common.entity.StorageState;
import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.common.service.SecurityService;
import com.cinex.module.booking.entity.BookingStatus;
import com.cinex.module.booking.repository.BookingRepository;
import com.cinex.module.room.dto.RoomFilter;
import com.cinex.module.room.dto.RoomRequest;
import com.cinex.module.room.dto.RoomResponse;
import com.cinex.module.room.entity.Room;
import com.cinex.module.room.entity.RoomStatus;
import com.cinex.module.room.mapper.RoomMapper;
import com.cinex.module.room.repository.RoomRepository;
import com.cinex.module.room.specification.RoomSpecification;
import com.cinex.module.showtime.entity.ShowtimeStatus;
import com.cinex.module.showtime.repository.ShowtimeRepository;
import com.cinex.module.theater.entity.Theater;
import com.cinex.module.theater.repository.TheaterRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class RoomService {

    private final RoomRepository roomRepository;
    private final ShowtimeRepository showtimeRepository;
    private final BookingRepository bookingRepository;
    private final TheaterRepository theaterRepository;
    private final RoomMapper roomMapper;
    private final SecurityService securityService;

    // Danh sách trạng thái suất chiếu được coi là "đang hoạt động" — chặn xóa Room/Movie liên quan
    private static final List<ShowtimeStatus> ACTIVE_SHOWTIME_STATUSES =
            List.of(ShowtimeStatus.SCHEDULED, ShowtimeStatus.ONGOING);

    /**
     * Pattern thống nhất: Filter DTO → Specification.fromFilter() → findAll(spec, pageable)
     *
     * <p><b>RBAC scope:</b> Branch ADMIN bị override filter.theaterId thành chi nhánh của
     * mình — KHÔNG cho thấy phòng chi nhánh khác. SUPER_ADMIN giữ nguyên filter.
     */
    @Transactional(readOnly = true)
    public Page<RoomResponse> listRooms(RoomFilter filter, Pageable pageable) {
        applyTheaterScope(filter);
        var spec = RoomSpecification.fromFilter(filter);
        return roomRepository.findAll(spec, pageable)
                .map(roomMapper::toResponse);
    }

    /**
     * Override theaterId trong filter nếu user là branch ADMIN.
     * SUPER_ADMIN giữ nguyên filter (có thể null = tất cả, hoặc có id = filter theo chọn).
     */
    private void applyTheaterScope(RoomFilter filter) {
        Long scopedTheaterId = securityService.getCurrentUserTheaterId();
        if (scopedTheaterId != null) {
            filter.setTheaterId(scopedTheaterId);
        }
    }

    @Transactional(readOnly = true)
    public RoomResponse getRoom(Long id) {
        Room room = roomRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.ROOM_NOT_FOUND));
        // RBAC: branch ADMIN chỉ xem được phòng của chi nhánh mình
        securityService.requireAccessToTheater(room.getTheater().getId());
        return roomMapper.toResponse(room);
    }

    @Transactional
    public RoomResponse createRoom(RoomRequest request) {
        Theater theater = theaterRepository.findById(request.getTheaterId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND,
                        "Không tìm thấy chi nhánh"));

        // RBAC: branch ADMIN chỉ tạo phòng cho chi nhánh mình; SUPER_ADMIN pass
        securityService.requireAccessToTheater(theater.getId());

        // Trim + case-insensitive unique (industry chuẩn): "Phòng 1" và "  Phòng 1  "
        // và "phòng 1" cùng coi là duplicate.
        String normalized = request.getName().trim();
        if (normalized.isEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Tên phòng không được rỗng (chỉ có khoảng trắng)");
        }
        if (roomRepository.existsByNameIgnoreCaseAndTheaterId(normalized, theater.getId())) {
            throw new BusinessException(ErrorCode.ROOM_EXISTED,
                    "Phòng '" + normalized + "' đã tồn tại trong chi nhánh này");
        }

        Room room = Room.builder()
                .theater(theater)
                .name(normalized)
                .type(request.getType())
                .totalSeats(0)  // Total seats compute từ Seats sau khi gen — không cho admin set tay
                .status(request.getStatus() != null ? request.getStatus() : RoomStatus.ACTIVE)
                .build();

        roomRepository.save(room);
        log.info("Created room '{}' in theater '{}'", room.getName(), theater.getName());
        return roomMapper.toResponse(room);
    }

    @Transactional
    public RoomResponse updateRoom(Long id, RoomRequest request) {
        Room room = roomRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.ROOM_NOT_FOUND));

        // RBAC: branch ADMIN chỉ sửa phòng của chi nhánh mình
        securityService.requireAccessToTheater(room.getTheater().getId());

        // Đổi chi nhánh: cấm — phòng cùng dòng đời với chi nhánh, di chuyển sẽ break showtime.
        if (!room.getTheater().getId().equals(request.getTheaterId())) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Không thể đổi chi nhánh của phòng — vui lòng tạo phòng mới");
        }

        // Trim + case-insensitive unique check (loại trừ chính room đang sửa)
        String normalized = request.getName().trim();
        if (normalized.isEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Tên phòng không được rỗng (chỉ có khoảng trắng)");
        }
        if (roomRepository.existsByNameIgnoreCaseAndTheaterIdAndIdNot(
                normalized, room.getTheater().getId(), id)) {
            throw new BusinessException(ErrorCode.ROOM_EXISTED,
                    "Phòng '" + normalized + "' đã tồn tại trong chi nhánh này");
        }

        room.setName(normalized);
        room.setType(request.getType());
        // totalSeats KHÔNG cho admin sửa — auto-compute từ Seats khi gen/resize.
        if (request.getStatus() != null) {
            room.setStatus(request.getStatus());
        }

        roomRepository.save(room);
        log.info("Updated room: {}", room.getName());
        return roomMapper.toResponse(room);
    }

    @Transactional
    public void deleteRoom(Long id) {
        Room room = roomRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.ROOM_NOT_FOUND));

        // RBAC: branch ADMIN chỉ xoá phòng của chi nhánh mình
        securityService.requireAccessToTheater(room.getTheater().getId());

        ensureNoActiveDependencies(id);
        room.setStorageState(StorageState.ARCHIVED);
        roomRepository.save(room);
        log.info("Soft deleted room: {}", room.getName());
    }

    @Transactional
    public void bulkDelete(List<Long> ids) {
        List<Room> rooms = roomRepository.findAllById(ids);
        // RBAC: branch ADMIN chỉ archive phòng của chi nhánh mình
        rooms.forEach(r -> securityService.requireAccessToTheater(r.getTheater().getId()));
        // Fail-fast nếu bất kỳ phòng nào còn dependency active
        for (Long id : ids) {
            ensureNoActiveDependencies(id);
        }
        rooms.forEach(r -> r.setStorageState(StorageState.ARCHIVED));
        roomRepository.saveAll(rooms);
        log.info("Bulk soft deleted {} rooms", rooms.size());
    }

    /**
     * Industry chuẩn (Vista Veezi / Cinetixx): chặn xoá Room nếu còn:
     * 1. Suất chiếu SCHEDULED/ONGOING — tránh orphan showtime
     * 2. Booking HOLDING/CONFIRMED — tránh khách pay rồi phòng biến mất
     */
    private void ensureNoActiveDependencies(Long roomId) {
        ensureNoActiveShowtimes(roomId);
        boolean hasActiveBookings = bookingRepository.existsByShowtime_Room_IdAndStatusIn(
                roomId, List.of(BookingStatus.HOLDING, BookingStatus.CONFIRMED));
        if (hasActiveBookings) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Không thể xoá phòng đang có vé khách giữ hoặc đã thanh toán");
        }
    }

    /**
     * Helper: throw INVALID_REQUEST nếu phòng còn suất chiếu SCHEDULED/ONGOING chưa archived.
     */
    private void ensureNoActiveShowtimes(Long roomId) {
        boolean hasActiveShowtime = showtimeRepository.existsByRoomIdAndStatusInAndStorageStateNot(
                roomId, ACTIVE_SHOWTIME_STATUSES, StorageState.ARCHIVED);
        if (hasActiveShowtime) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Không thể xóa phòng đang có suất chiếu");
        }
    }

    @Transactional
    public void bulkRestore(List<Long> ids) {
        List<Room> items = roomRepository.findAllById(ids);
        items.forEach(i -> securityService.requireAccessToTheater(i.getTheater().getId()));
        items.forEach(i -> i.setStorageState(StorageState.ACTIVE));
        roomRepository.saveAll(items);
        log.info("Bulk restored {} items", items.size());
    }

    @Transactional
    public RoomResponse restoreRoom(Long id) {
        Room room = roomRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.ROOM_NOT_FOUND));
        // RBAC: branch ADMIN chỉ restore phòng của chi nhánh mình
        securityService.requireAccessToTheater(room.getTheater().getId());
        room.setStorageState(StorageState.ACTIVE);
        roomRepository.save(room);
        log.info("Restored room: {}", room.getName());
        return roomMapper.toResponse(room);
    }
}
