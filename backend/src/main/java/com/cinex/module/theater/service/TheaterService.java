package com.cinex.module.theater.service;

import com.cinex.common.audit.Auditable;
import com.cinex.common.entity.StorageState;
import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.common.response.PageResponse;
import com.cinex.module.room.repository.RoomRepository;
import com.cinex.module.theater.dto.TheaterFilter;
import com.cinex.module.theater.dto.TheaterRequest;
import com.cinex.module.theater.dto.TheaterResponse;
import com.cinex.module.theater.entity.Theater;
import com.cinex.module.theater.mapper.TheaterMapper;
import com.cinex.module.theater.repository.TheaterRepository;
import com.cinex.module.theater.specification.TheaterSpecification;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Service quản lý chi nhánh rạp ({@link Theater}).
 *
 * <p><b>Trách nhiệm:</b>
 * <ul>
 *   <li>CRUD chi nhánh (admin)</li>
 *   <li>Validate code unique</li>
 *   <li>Chặn archive khi chi nhánh còn room ACTIVE</li>
 *   <li>List public (cho FE user chọn chi nhánh)</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TheaterService {

    private final TheaterRepository theaterRepository;
    private final RoomRepository roomRepository;
    private final TheaterMapper theaterMapper;

    @Transactional(readOnly = true)
    public PageResponse<TheaterResponse> list(TheaterFilter filter, Pageable pageable) {
        var spec = TheaterSpecification.fromFilter(filter);
        Page<TheaterResponse> page = theaterRepository.findAll(spec, pageable)
                .map(theaterMapper::toResponse);
        return PageResponse.from(page);
    }

    @Transactional(readOnly = true)
    public TheaterResponse get(Long id) {
        Theater theater = findOrThrow(id);
        return theaterMapper.toResponse(theater);
    }

    @Transactional
    @Auditable(action = "CREATE_THEATER", entityType = "Theater")
    public TheaterResponse create(TheaterRequest request) {
        if (theaterRepository.existsByCode(request.getCode())) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Mã chi nhánh đã tồn tại: " + request.getCode());
        }
        Theater theater = Theater.builder()
                .code(request.getCode())
                .name(request.getName())
                .address(request.getAddress())
                .city(request.getCity())
                .hotline(request.getHotline())
                .email(request.getEmail())
                .latitude(request.getLatitude())
                .longitude(request.getLongitude())
                .status(request.getStatus())
                .build();
        theaterRepository.save(theater);
        log.info("Created theater '{}' (id={})", theater.getName(), theater.getId());
        return theaterMapper.toResponse(theater);
    }

    @Transactional
    @Auditable(action = "UPDATE_THEATER", entityType = "Theater")
    public TheaterResponse update(Long id, TheaterRequest request) {
        Theater theater = findOrThrow(id);

        // Không cho đổi code (giống primary key nghiệp vụ) — tránh ref break.
        if (!theater.getCode().equals(request.getCode())) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Không thể đổi mã chi nhánh — vui lòng tạo chi nhánh mới");
        }

        theater.setName(request.getName());
        theater.setAddress(request.getAddress());
        theater.setCity(request.getCity());
        theater.setHotline(request.getHotline());
        theater.setEmail(request.getEmail());
        theater.setLatitude(request.getLatitude());
        theater.setLongitude(request.getLongitude());
        theater.setStatus(request.getStatus());
        theaterRepository.save(theater);
        log.info("Updated theater id={}", id);
        return theaterMapper.toResponse(theater);
    }

    @Transactional
    @Auditable(action = "ARCHIVE_THEATER", entityType = "Theater")
    public void archive(Long id) {
        Theater theater = findOrThrow(id);

        // Chặn xoá khi chi nhánh còn room ACTIVE — tránh "mồ côi" room.
        long activeRooms = roomRepository.countByTheaterIdAndStorageStateNot(id, StorageState.ARCHIVED);
        if (activeRooms > 0) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Không thể xoá chi nhánh đang có " + activeRooms + " phòng hoạt động");
        }

        theater.setStorageState(StorageState.ARCHIVED);
        theaterRepository.save(theater);
        log.info("Archived theater id={}", id);
    }

    @Transactional
    public void bulkArchive(List<Long> ids) {
        for (Long id : ids) {
            long activeRooms = roomRepository.countByTheaterIdAndStorageStateNot(id, StorageState.ARCHIVED);
            if (activeRooms > 0) {
                throw new BusinessException(ErrorCode.INVALID_REQUEST,
                        "Không thể xoá chi nhánh #" + id + " — vẫn còn " + activeRooms + " phòng");
            }
        }
        List<Theater> items = theaterRepository.findAllById(ids);
        items.forEach(t -> t.setStorageState(StorageState.ARCHIVED));
        theaterRepository.saveAll(items);
        log.info("Bulk archived {} theaters", items.size());
    }

    @Transactional
    public void bulkRestore(List<Long> ids) {
        List<Theater> items = theaterRepository.findAllById(ids);
        items.forEach(t -> t.setStorageState(StorageState.ACTIVE));
        theaterRepository.saveAll(items);
        log.info("Bulk restored {} theaters", items.size());
    }

    private Theater findOrThrow(Long id) {
        return theaterRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND,
                        "Không tìm thấy chi nhánh"));
    }
}
