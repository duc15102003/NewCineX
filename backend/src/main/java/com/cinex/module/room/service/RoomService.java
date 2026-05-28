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
    private final RoomMapper roomMapper;

    /**
     * Pattern thống nhất: Filter DTO → Specification.fromFilter() → findAll(spec, pageable)
     */
    @Transactional(readOnly = true)
    public Page<RoomResponse> listRooms(RoomFilter filter, Pageable pageable) {
        var spec = RoomSpecification.fromFilter(filter);
        return roomRepository.findAll(spec, pageable)
                .map(roomMapper::toResponse);
    }

    @Transactional(readOnly = true)
    public RoomResponse getRoom(Long id) {
        Room room = roomRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.ROOM_NOT_FOUND));
        return roomMapper.toResponse(room);
    }

    @Transactional
    public RoomResponse createRoom(RoomRequest request) {
        if (roomRepository.existsByName(request.getName())) {
            throw new BusinessException(ErrorCode.ROOM_EXISTED,
                    "Phòng chiếu '" + request.getName() + "' đã tồn tại");
        }

        Room room = Room.builder()
                .name(request.getName())
                .type(request.getType())
                .totalSeats(request.getTotalSeats())
                .status(request.getStatus() != null ? request.getStatus() : RoomStatus.ACTIVE)
                .build();

        roomRepository.save(room);
        log.info("Created room: {}", room.getName());
        return roomMapper.toResponse(room);
    }

    @Transactional
    public RoomResponse updateRoom(Long id, RoomRequest request) {
        Room room = roomRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.ROOM_NOT_FOUND));

        if (!room.getName().equals(request.getName()) && roomRepository.existsByName(request.getName())) {
            throw new BusinessException(ErrorCode.ROOM_EXISTED,
                    "Phòng chiếu '" + request.getName() + "' đã tồn tại");
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
        room.setStorageState(StorageState.ARCHIVED);
        roomRepository.save(room);
        log.info("Soft deleted room: {}", room.getName());
    }

    @Transactional
    public void bulkDelete(List<Long> ids) {
        List<Room> rooms = roomRepository.findAllById(ids);
        rooms.forEach(r -> r.setStorageState(StorageState.ARCHIVED));
        roomRepository.saveAll(rooms);
        log.info("Bulk soft deleted {} rooms", rooms.size());
    }

    @Transactional
    public void bulkRestore(List<Long> ids) {
        List<Room> items = roomRepository.findAllById(ids);
        items.forEach(i -> i.setStorageState(StorageState.ACTIVE));
        roomRepository.saveAll(items);
        log.info("Bulk restored {} items", items.size());
    }

    @Transactional
    public RoomResponse restoreRoom(Long id) {
        Room room = roomRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.ROOM_NOT_FOUND));
        room.setStorageState(StorageState.ACTIVE);
        roomRepository.save(room);
        log.info("Restored room: {}", room.getName());
        return roomMapper.toResponse(room);
    }
}
