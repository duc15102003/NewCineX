package com.cinex.module.room.service;

import com.cinex.common.entity.StorageState;
import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
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
    private final TheaterRepository theaterRepository;
    private final RoomMapper roomMapper;
    private final com.cinex.common.service.SecurityService securityService;

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

        // Tên phòng unique trong scope chi nhánh (nhiều chi nhánh có thể cùng "Phòng 1").
        if (roomRepository.existsByNameAndTheaterId(request.getName(), theater.getId())) {
            throw new BusinessException(ErrorCode.ROOM_EXISTED,
                    "Phòng '" + request.getName() + "' đã tồn tại trong chi nhánh này");
        }

        Room room = Room.builder()
                .theater(theater)
                .name(request.getName())
                .type(request.getType())
                .totalSeats(request.getTotalSeats())
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

        // Check trùng tên trong scope theater, loại trừ chính room đang sửa
        if (roomRepository.existsByNameAndTheaterIdAndIdNot(
                request.getName(), room.getTheater().getId(), id)) {
            throw new BusinessException(ErrorCode.ROOM_EXISTED,
                    "Phòng '" + request.getName() + "' đã tồn tại trong chi nhánh này");
        }

        room.setName(request.getName());
        room.setType(request.getType());
        room.setTotalSeats(request.getTotalSeats());
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

        // Business rule: Không cho xóa Room nếu vẫn còn suất chiếu SCHEDULED/ONGOING
        // → Tránh data inconsistency: showtime trỏ tới room đã bị xóa mềm
        ensureNoActiveShowtimes(id);

        room.setStorageState(StorageState.ARCHIVED);
        roomRepository.save(room);
        log.info("Soft deleted room: {}", room.getName());
    }

    @Transactional
    public void bulkDelete(List<Long> ids) {
        List<Room> rooms = roomRepository.findAllById(ids);
        // RBAC: branch ADMIN chỉ archive phòng của chi nhánh mình
        rooms.forEach(r -> securityService.requireAccessToTheater(r.getTheater().getId()));
        // Kiểm tra từng phòng — fail-fast nếu bất kỳ phòng nào còn suất chiếu active
        for (Long id : ids) {
            ensureNoActiveShowtimes(id);
        }
        rooms.forEach(r -> r.setStorageState(StorageState.ARCHIVED));
        roomRepository.saveAll(rooms);
        log.info("Bulk soft deleted {} rooms", rooms.size());
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
