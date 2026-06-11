package com.cinex.module.seat.service;

import com.cinex.common.entity.StorageState;
import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.module.booking.entity.BookingStatus;
import com.cinex.module.booking.repository.BookingRepository;
import com.cinex.module.room.entity.Room;
import com.cinex.module.room.repository.RoomRepository;
import com.cinex.module.seat.dto.BulkUpdateSeatRequest;
import com.cinex.module.seat.dto.SeatFilter;
import com.cinex.module.seat.dto.SeatGenerateRequest;
import com.cinex.module.seat.dto.SeatMapResponse;
import com.cinex.module.seat.dto.SeatResponse;
import com.cinex.module.seat.dto.UpdateSeatRequest;
import com.cinex.module.seat.entity.Seat;
import com.cinex.module.seat.entity.SeatStatus;
import com.cinex.module.seat.entity.SeatType;
import com.cinex.module.seat.mapper.SeatMapper;
import com.cinex.module.seat.repository.SeatRepository;
import com.cinex.module.seat.specification.SeatSpecification;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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
    private final BookingRepository bookingRepository;
    private final SeatMapper seatMapper;

    /**
     * (ADMIN) List ghế theo filter — phân trang.
     *
     * <p>BẮT BUỘC có roomId trong filter — không cho list ghế cross-room.
     * Dùng cho UI admin có cột Type / Status / Row để lọc nhanh khi phòng có hàng trăm ghế.
     */
    @Transactional(readOnly = true)
    public Page<SeatResponse> listSeats(SeatFilter filter, Pageable pageable) {
        if (filter.getRoomId() == null) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST, "roomId là bắt buộc khi list ghế");
        }
        return seatRepository.findAll(SeatSpecification.fromFilter(filter), pageable)
                .map(seatMapper::toResponse);
    }

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
     * (ADMIN) Tự động sinh ghế chuẩn industry (CGV/Lotte/BHD pattern).
     *
     * <p>Logic ưu tiên SeatType khi 1 position thuộc nhiều zone:
     * <ol>
     *   <li>BLOCKED — block cố định (override mọi loại)</li>
     *   <li>AISLE — lối đi (không phải ghế, không tính totalSeats)</li>
     *   <li>HANDICAP — đầu hàng, BẮT BUỘC NĐ 28/2012</li>
     *   <li>SWEETBOX — cao cấp hơn couple</li>
     *   <li>COUPLE — hàng cuối</li>
     *   <li>DELUXE — phòng Premium recliner</li>
     *   <li>VIP — zone giữa rạp</li>
     *   <li>STANDARD — mặc định</li>
     * </ol>
     *
     * <p>Có thể truyền {@code applyPresetForRoomType=true} để BE tự suggest
     * layout theo {@code room.type} (TWO_D/THREE_D/IMAX/FOUR_DX).
     */
    @Transactional
    public SeatMapResponse generateSeats(Long roomId, SeatGenerateRequest request) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new BusinessException(ErrorCode.ROOM_NOT_FOUND));

        // Override với preset nếu admin chọn
        if (Boolean.TRUE.equals(request.getApplyPresetForRoomType())) {
            var rt = request.getRoomTypeOverride() != null
                    ? request.getRoomTypeOverride() : room.getType();
            request = SeatLayoutPreset.forRoomType(rt);
        }

        // Business rule: KHÔNG regenerate khi có booking active
        boolean hasActiveBooking = bookingRepository.existsByShowtime_Room_IdAndStatusIn(
                roomId, List.of(BookingStatus.HOLDING, BookingStatus.CONFIRMED));
        if (hasActiveBooking) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Không thể tạo lại sơ đồ ghế khi phòng đang có booking. Hãy đợi tất cả booking kết thúc hoặc cancel trước.");
        }

        // CUSTOM LAYOUT path — iterate matrix trực tiếp từ FE visual editor
        if (request.getCustomLayout() != null && !request.getCustomLayout().isEmpty()) {
            return generateFromCustomLayout(room, request.getCustomLayout());
        }

        validateLayoutRequest(request);

        // Soft delete ghế cũ
        seatRepository.softDeleteByRoomId(roomId);

        int totalRows = request.getTotalRows();
        int totalCols = request.getTotalCols();
        Set<Integer> aisleCols = request.getAisleCols() != null ? request.getAisleCols() : Set.of();
        Set<String> blockedKeys = positionsToKeys(request.getBlockedPositions());
        Set<String> handicapKeys = positionsToKeys(request.getHandicapPositions());
        Set<String> coupleRows = request.getCoupleRows() != null ? request.getCoupleRows() : Set.of();
        Set<String> deluxeRows = request.getDeluxeRows() != null ? request.getDeluxeRows() : Set.of();

        List<Seat> seats = new ArrayList<>();
        int realSeatCount = 0;

        for (int rowIdx = 0; rowIdx < totalRows; rowIdx++) {
            String rowLabel = String.valueOf((char) ('A' + rowIdx));

            for (int col = 1; col <= totalCols; col++) {
                String key = rowLabel + ":" + col;
                boolean isAisle = aisleCols.contains(col);
                boolean isBlocked = blockedKeys.contains(key);

                SeatType seatType = resolveSeatType(
                        rowLabel, col, request,
                        handicapKeys, coupleRows, deluxeRows);

                SeatStatus status = isBlocked ? SeatStatus.BLOCKED : SeatStatus.AVAILABLE;

                seats.add(Seat.builder()
                        .room(room)
                        .rowLabel(rowLabel)
                        .colNumber(col)
                        .seatNumber(rowLabel + col)
                        .seatType(seatType)
                        .status(status)
                        .aisle(isAisle)
                        .build());

                if (!isAisle && !isBlocked) realSeatCount++;
            }
        }

        seatRepository.saveAll(seats);
        room.setTotalSeats(realSeatCount);  // chỉ đếm seat thật bán được
        roomRepository.save(room);

        log.info("Generated {} positions for room {} ({} bookable seats)",
                seats.size(), room.getName(), realSeatCount);
        return getSeatMap(roomId);
    }

    /**
     * Generate seats từ custom layout matrix (FE visual editor mode).
     * Khác zone-based: nhận trực tiếp list cell với type + status + aisle.
     *
     * <p>Safety net: post-process sanitize COUPLE/SWEETBOX phải có partner kề bên
     * cùng row (col odd: partner=col+1; col even: partner=col-1). Nếu không có
     * partner cùng type → fallback STANDARD. Chống case FE bypass validation gửi
     * COUPLE/SWEETBOX đơn lẻ (ghế lẻ cuối hàng).
     */
    private SeatMapResponse generateFromCustomLayout(Room room, List<SeatGenerateRequest.CustomLayoutCell> cells) {
        seatRepository.softDeleteByRoomId(room.getId());

        // Build index (row, col) → cell để check partner
        java.util.Map<String, SeatGenerateRequest.CustomLayoutCell> index = new java.util.HashMap<>();
        for (var c : cells) index.put(c.getRow() + ":" + c.getCol(), c);

        List<Seat> seats = new ArrayList<>();
        int realSeatCount = 0;
        int fallbackCount = 0;

        for (var cell : cells) {
            boolean isAisle = Boolean.TRUE.equals(cell.getAisle());
            SeatType type = cell.getSeatType() != null ? cell.getSeatType() : SeatType.STANDARD;
            SeatStatus status = cell.getStatus() != null ? cell.getStatus() : SeatStatus.AVAILABLE;

            // Sanitize ghế đôi không có partner đúng type → STANDARD.
            // Partner tính theo block giữa các aisle (chuẩn industry CGV/Lotte/BHD):
            // ghế đôi vật lý chiếm 2 chỗ liền nhau trong cùng 1 dải ghế, KHÔNG vắt qua lối đi.
            if (!isAisle && (type == SeatType.COUPLE || type == SeatType.SWEETBOX)) {
                Integer partnerCol = findCouplePartnerInBlock(cell.getRow(), cell.getCol(), index);
                if (partnerCol == null) {
                    type = SeatType.STANDARD;
                    fallbackCount++;
                } else {
                    var partner = index.get(cell.getRow() + ":" + partnerCol);
                    if (partner == null || partner.getSeatType() != type) {
                        type = SeatType.STANDARD;
                        fallbackCount++;
                    }
                }
            }

            seats.add(Seat.builder()
                    .room(room)
                    .rowLabel(cell.getRow())
                    .colNumber(cell.getCol())
                    .seatNumber(cell.getRow() + cell.getCol())
                    .seatType(type)
                    .status(status)
                    .aisle(isAisle)
                    .build());

            if (!isAisle && status != SeatStatus.BLOCKED) realSeatCount++;
        }

        seatRepository.saveAll(seats);
        room.setTotalSeats(realSeatCount);
        roomRepository.save(room);

        if (fallbackCount > 0) {
            log.warn("Sanitized {} lone COUPLE/SWEETBOX seats to STANDARD for room {}",
                    fallbackCount, room.getName());
        }
        log.info("Generated {} positions (custom) for room {} ({} bookable)",
                seats.size(), room.getName(), realSeatCount);
        return getSeatMap(room.getId());
    }

    /**
     * Resolve COUPLE vs STANDARD cho 1 col trong couple row, theo block giữa các aisle.
     *
     * <p>Trong block width N: nếu N lẻ, ghế cuối cùng (positionInBlock == N) không có
     * partner → STANDARD. Còn lại tất cả pair OK → COUPLE.
     */
    private SeatType resolveCoupleTypeInBlock(int col, Set<Integer> aisleCols, int totalCols) {
        int leftBound = col;
        while (leftBound > 1 && !aisleCols.contains(leftBound - 1)) leftBound--;
        int rightBound = col;
        while (rightBound < totalCols && !aisleCols.contains(rightBound + 1)) rightBound++;
        int blockWidth = rightBound - leftBound + 1;
        int posInBlock = col - leftBound + 1;
        boolean isLoneLast = (blockWidth % 2 != 0) && (posInBlock == blockWidth);
        return isLoneLast ? SeatType.STANDARD : SeatType.COUPLE;
    }

    /**
     * Tìm cột partner cho ghế đôi/sweetbox theo block — chuẩn industry.
     *
     * <p>Thuật toán: trong cùng row, mở rộng trái-phải từ {@code col} đến khi gặp
     * AISLE hoặc hết grid → xác định block. Trong block, vị trí thứ N (1-indexed):
     * lẻ → partner = col+1, chẵn → partner = col-1. Nếu partner ra ngoài block (block
     * lẻ ghế, col đứng cuối) → return null (caller fallback STANDARD).
     *
     * <p>Khác parity tuyệt đối: với row có aisle cột 3, dải [4..9] sẽ pair
     * (4,5)(6,7)(8,9) — không phải (3,4)(5,6)... vắt qua aisle.
     */
    private Integer findCouplePartnerInBlock(
            String rowLabel,
            int col,
            java.util.Map<String, SeatGenerateRequest.CustomLayoutCell> index) {
        int leftBound = col;
        while (leftBound > 1) {
            var prev = index.get(rowLabel + ":" + (leftBound - 1));
            if (prev == null || Boolean.TRUE.equals(prev.getAisle())) break;
            leftBound--;
        }
        int rightBound = col;
        while (true) {
            var next = index.get(rowLabel + ":" + (rightBound + 1));
            if (next == null || Boolean.TRUE.equals(next.getAisle())) break;
            rightBound++;
        }
        int posInBlock = col - leftBound + 1;
        boolean isOddInBlock = posInBlock % 2 == 1;
        int partnerCol = isOddInBlock ? col + 1 : col - 1;
        if (partnerCol < leftBound || partnerCol > rightBound) return null;
        return partnerCol;
    }

    /** Validate ranges + boundary của tất cả zone trong request. */
    private void validateLayoutRequest(SeatGenerateRequest request) {
        char maxRowChar = (char) ('A' + request.getTotalRows() - 1);
        String maxRow = String.valueOf(maxRowChar);
        int maxCol = request.getTotalCols();

        // Aisle cols ∈ [1..totalCols]
        if (request.getAisleCols() != null) {
            for (Integer c : request.getAisleCols()) {
                if (c < 1 || c > maxCol)
                    throw new BusinessException(ErrorCode.INVALID_REQUEST,
                            "Cột aisle " + c + " nằm ngoài phạm vi 1-" + maxCol);
            }
        }
        // VIP zone
        if (request.getVipZone() != null) {
            var z = request.getVipZone();
            validateRow(z.getRowStart(), maxRowChar, maxRow, "VIP rowStart");
            validateRow(z.getRowEnd(), maxRowChar, maxRow, "VIP rowEnd");
            validateCol(z.getColStart(), maxCol, "VIP colStart");
            validateCol(z.getColEnd(), maxCol, "VIP colEnd");
            if (z.getRowStart().charAt(0) > z.getRowEnd().charAt(0))
                throw new BusinessException(ErrorCode.INVALID_REQUEST,
                        "VIP rowStart phải <= rowEnd");
            if (z.getColStart() > z.getColEnd())
                throw new BusinessException(ErrorCode.INVALID_REQUEST,
                        "VIP colStart phải <= colEnd");
        }
        // Sweetbox row
        if (request.getSweetboxRow() != null) {
            var s = request.getSweetboxRow();
            validateRow(s.getRow(), maxRowChar, maxRow, "Sweetbox row");
            validateCol(s.getColStart(), maxCol, "Sweetbox colStart");
            validateCol(s.getColEnd(), maxCol, "Sweetbox colEnd");
        }
        // Couple/Deluxe rows
        if (request.getCoupleRows() != null) {
            for (String r : request.getCoupleRows())
                validateRow(r, maxRowChar, maxRow, "Couple row");
        }
        if (request.getDeluxeRows() != null) {
            for (String r : request.getDeluxeRows())
                validateRow(r, maxRowChar, maxRow, "Deluxe row");
        }
    }

    private void validateRow(String row, char maxRowChar, String maxRow, String fieldLabel) {
        if (row == null || row.length() != 1 || row.charAt(0) < 'A' || row.charAt(0) > maxRowChar)
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    fieldLabel + " '" + row + "' nằm ngoài phạm vi A-" + maxRow);
    }

    private void validateCol(Integer col, int maxCol, String fieldLabel) {
        if (col == null || col < 1 || col > maxCol)
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    fieldLabel + " " + col + " nằm ngoài phạm vi 1-" + maxCol);
    }

    private Set<String> positionsToKeys(Set<SeatGenerateRequest.SeatPosition> positions) {
        if (positions == null) return Set.of();
        Set<String> keys = new java.util.HashSet<>();
        for (var p : positions) keys.add(p.getRow() + ":" + p.getCol());
        return keys;
    }

    /**
     * Resolve seat type theo ưu tiên (highest first).
     * KHÔNG check BLOCKED/AISLE ở đây — xử lý riêng ở caller.
     */
    private SeatType resolveSeatType(
            String rowLabel, int col,
            SeatGenerateRequest req,
            Set<String> handicapKeys,
            Set<String> coupleRows,
            Set<String> deluxeRows) {
        String key = rowLabel + ":" + col;

        // 1. Handicap (highest priority sau BLOCKED/AISLE)
        if (handicapKeys.contains(key)) return SeatType.HANDICAP;

        // 2. Sweetbox
        if (req.getSweetboxRow() != null) {
            var s = req.getSweetboxRow();
            if (rowLabel.equals(s.getRow()) && col >= s.getColStart() && col <= s.getColEnd()) {
                // Ghế lẻ cuối → STANDARD (sweetbox ghép cặp)
                int width = s.getColEnd() - s.getColStart() + 1;
                boolean isLastOdd = (width % 2 != 0) && (col == s.getColEnd());
                return isLastOdd ? SeatType.STANDARD : SeatType.SWEETBOX;
            }
        }

        // 3. Couple — pair theo block (chuẩn industry: ghế đôi không vắt qua lối đi).
        // Block lẻ ghế → ghế cuối block tự fallback STANDARD để không đứng đơn lẻ.
        if (coupleRows.contains(rowLabel)) {
            Set<Integer> aisleCols = req.getAisleCols() != null ? req.getAisleCols() : Set.of();
            if (aisleCols.contains(col)) return SeatType.COUPLE; // aisle: type không dùng (display ưu tiên aisle flag)
            return resolveCoupleTypeInBlock(col, aisleCols, req.getTotalCols());
        }

        // 4. Deluxe
        if (deluxeRows.contains(rowLabel)) return SeatType.DELUXE;

        // 5. VIP zone
        if (req.getVipZone() != null) {
            var z = req.getVipZone();
            char rChar = rowLabel.charAt(0);
            if (rChar >= z.getRowStart().charAt(0) && rChar <= z.getRowEnd().charAt(0)
                    && col >= z.getColStart() && col <= z.getColEnd()) {
                return SeatType.VIP;
            }
        }

        // 6. Default
        return SeatType.STANDARD;
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
     * (ADMIN) Bulk update — Seat Map Editor support 3 dimension độc lập:
     * <ul>
     *   <li>{@code seatType} (STANDARD/VIP/COUPLE/SWEETBOX/DELUXE/HANDICAP)
     *       — đổi loại; tự reset BROKEN/BLOCKED về AVAILABLE</li>
     *   <li>{@code status} (BROKEN/BLOCKED/AVAILABLE) — đổi trạng thái</li>
     *   <li>{@code isAisle} — đánh dấu lối đi (true) hoặc bỏ (false)</li>
     * </ul>
     * Có thể combine: vd seatType=STANDARD + isAisle=false.
     */
    @Transactional
    public SeatMapResponse bulkUpdateSeats(Long roomId, BulkUpdateSeatRequest request) {
        List<Seat> seats = seatRepository.findAllById(request.getSeatIds());

        if (request.getStatus() != null) {
            seats.forEach(s -> s.setStatus(request.getStatus()));
            log.info("Bulk set status {} for {} seats", request.getStatus(), seats.size());
        }
        if (request.getSeatType() != null) {
            seats.forEach(s -> {
                s.setSeatType(request.getSeatType());
                // Đổi type → reset BROKEN/BLOCKED về AVAILABLE (admin có chủ ý đổi)
                if (s.getStatus() != SeatStatus.AVAILABLE && request.getStatus() == null) {
                    s.setStatus(SeatStatus.AVAILABLE);
                }
            });
            log.info("Bulk updated type {} for {} seats", request.getSeatType(), seats.size());
        }
        if (request.getAisle() != null) {
            seats.forEach(s -> s.setAisle(request.getAisle()));
            log.info("Bulk set aisle={} for {} seats", request.getAisle(), seats.size());
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
