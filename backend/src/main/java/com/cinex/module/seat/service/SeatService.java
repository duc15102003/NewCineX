package com.cinex.module.seat.service;

import com.cinex.common.entity.StorageState;
import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.module.room.entity.Room;
import com.cinex.module.room.repository.RoomRepository;
import com.cinex.module.seat.dto.BulkUpdateSeatRequest;
import com.cinex.module.seat.dto.SeatGenerateRequest;
import com.cinex.module.seat.dto.SeatMapResponse;
import com.cinex.module.seat.dto.SeatResponse;
import com.cinex.module.seat.dto.UpdateSeatRequest;
import com.cinex.module.seat.entity.Seat;
import com.cinex.module.seat.entity.SeatStatus;
import com.cinex.module.seat.entity.SeatType;
import com.cinex.module.seat.mapper.SeatMapper;
import com.cinex.module.seat.repository.SeatRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class SeatService {

    private final SeatRepository seatRepository;
    private final RoomRepository roomRepository;
    private final SeatMapper seatMapper;

    @Transactional(readOnly = true)
    public SeatMapResponse getSeatMap(Long roomId) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new BusinessException(ErrorCode.ROOM_NOT_FOUND));

        List<Seat> seats = seatRepository.findByRoomIdAndStorageStateOrderByRowLabelAscColNumberAsc(roomId, StorageState.ACTIVE);

        Map<String, List<SeatResponse>> seatMap = new LinkedHashMap<>();
        for (Seat seat : seats) {
            seatMap.computeIfAbsent(seat.getRowLabel(), k -> new ArrayList<>())
                    .add(seatMapper.toResponse(seat));
        }

        return SeatMapResponse.builder()
                .roomId(room.getId())
                .roomName(room.getName())
                .totalSeats(seats.size())
                .seatMap(seatMap)
                .build();
    }

    /**
     * (ADMIN) Tự động sinh ghế cho phòng theo cấu hình.
     * Soft delete ghế cũ (thay vì hard delete) → giữ audit trail.
     * Validate: vipRows và coupleRow phải nằm trong range A→(A+totalRows-1).
     */
    @Transactional
    public SeatMapResponse generateSeats(Long roomId, SeatGenerateRequest request) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new BusinessException(ErrorCode.ROOM_NOT_FOUND));

        // Validate vipRows và coupleRow nằm trong range hợp lệ
        char maxRowChar = (char) ('A' + request.getTotalRows() - 1);
        String maxRow = String.valueOf(maxRowChar);

        Set<String> vipRows = request.getVipRows() != null ? request.getVipRows() : Set.of();
        String coupleRow = request.getCoupleRow();

        for (String vr : vipRows) {
            if (vr.length() != 1 || vr.charAt(0) < 'A' || vr.charAt(0) > maxRowChar) {
                throw new BusinessException(ErrorCode.INVALID_REQUEST,
                        "Hàng VIP '" + vr + "' nằm ngoài phạm vi A-" + maxRow);
            }
        }
        if (coupleRow != null && !coupleRow.isBlank()) {
            if (coupleRow.length() != 1 || coupleRow.charAt(0) < 'A' || coupleRow.charAt(0) > maxRowChar) {
                throw new BusinessException(ErrorCode.INVALID_REQUEST,
                        "Hàng đôi '" + coupleRow + "' nằm ngoài phạm vi A-" + maxRow);
            }
        }

        // Soft delete ghế cũ thay vì hard delete
        seatRepository.softDeleteByRoomId(roomId);

        List<Seat> seats = new ArrayList<>();
        for (int row = 0; row < request.getTotalRows(); row++) {
            String rowLabel = String.valueOf((char) ('A' + row));

            boolean isCoupleRow = rowLabel.equalsIgnoreCase(coupleRow);
            boolean isVipRow = vipRows.contains(rowLabel);

            for (int col = 1; col <= request.getTotalCols(); col++) {
                SeatType seatType;
                if (isCoupleRow) {
                    // Ghế đôi ghép cặp 1-2, 3-4, ... — ghế lẻ cuối (khi totalCols lẻ) → STANDARD
                    boolean isLastOddCol = (request.getTotalCols() % 2 != 0) && (col == request.getTotalCols());
                    seatType = isLastOddCol ? SeatType.STANDARD : SeatType.COUPLE;
                } else if (isVipRow) {
                    seatType = SeatType.VIP;
                } else {
                    seatType = SeatType.STANDARD;
                }

                seats.add(Seat.builder()
                        .room(room)
                        .rowLabel(rowLabel)
                        .colNumber(col)
                        .seatNumber(rowLabel + col)
                        .seatType(seatType)
                        .status(SeatStatus.AVAILABLE)
                        .build());
            }
        }

        seatRepository.saveAll(seats);

        room.setTotalSeats(seats.size());
        roomRepository.save(room);

        log.info("Generated {} seats for room {}", seats.size(), room.getName());
        return getSeatMap(roomId);
    }

    @Transactional
    public SeatResponse updateSeat(Long seatId, UpdateSeatRequest request) {
        Seat seat = seatRepository.findById(seatId)
                .orElseThrow(() -> new BusinessException(ErrorCode.SEAT_NOT_FOUND));

        if (request.getSeatType() != null) {
            seat.setSeatType(request.getSeatType());
        }
        if (request.getStatus() != null) {
            seat.setStatus(request.getStatus());
        }

        seatRepository.save(seat);
        log.info("Updated seat {}: type={}, status={}", seat.getSeatNumber(), seat.getSeatType(), seat.getStatus());
        return seatMapper.toResponse(seat);
    }

    /**
     * (ADMIN) Bulk update loại ghế hoặc trạng thái (BROKEN) — dùng cho Seat Map Editor.
     * - status=BROKEN: đánh dấu ghế hỏng, giữ nguyên seatType
     * - seatType=VIP/STANDARD/COUPLE: đổi loại ghế, nếu đang BROKEN thì khôi phục AVAILABLE
     */
    @Transactional
    public SeatMapResponse bulkUpdateSeats(Long roomId, BulkUpdateSeatRequest request) {
        List<Seat> seats = seatRepository.findAllById(request.getSeatIds());

        if (request.getStatus() == SeatStatus.BROKEN) {
            seats.forEach(s -> s.setStatus(SeatStatus.BROKEN));
            log.info("Bulk marked {} seats as BROKEN", seats.size());
        } else if (request.getSeatType() != null) {
            seats.forEach(s -> {
                s.setSeatType(request.getSeatType());
                if (s.getStatus() == SeatStatus.BROKEN) {
                    s.setStatus(SeatStatus.AVAILABLE);
                }
            });
            log.info("Bulk updated {} seats to type {}", seats.size(), request.getSeatType());
        }

        seatRepository.saveAll(seats);
        return getSeatMap(roomId);
    }

    @Transactional
    public void deleteSeat(Long seatId) {
        Seat seat = seatRepository.findById(seatId)
                .orElseThrow(() -> new BusinessException(ErrorCode.SEAT_NOT_FOUND));
        seat.setStorageState(StorageState.ARCHIVED);
        seatRepository.save(seat);
        log.info("Soft deleted seat: {}", seat.getSeatNumber());
    }

    @Transactional
    public SeatResponse restoreSeat(Long seatId) {
        Seat seat = seatRepository.findById(seatId)
                .orElseThrow(() -> new BusinessException(ErrorCode.SEAT_NOT_FOUND));
        seat.setStorageState(StorageState.ACTIVE);
        seatRepository.save(seat);
        log.info("Restored seat: {}", seat.getSeatNumber());
        return seatMapper.toResponse(seat);
    }
}
