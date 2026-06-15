package com.cinex.module.showtime.service;

import com.cinex.common.entity.StorageState;
import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.common.service.SecurityService;
import com.cinex.module.config.service.SystemConfigService;
import com.cinex.module.movie.entity.Movie;
import com.cinex.module.movie.entity.MovieRun;
import com.cinex.module.movie.entity.MovieRunStatus;
import com.cinex.module.movie.repository.MovieRepository;
import com.cinex.module.movie.repository.MovieRunRepository;
import com.cinex.module.pricing.service.PricingEngine;
import com.cinex.module.room.entity.Room;
import com.cinex.module.room.entity.RoomStatus;
import com.cinex.module.room.entity.RoomType;
import com.cinex.module.room.repository.RoomRepository;
import com.cinex.module.booking.entity.BookingStatus;
import com.cinex.module.booking.entity.Booking;
import com.cinex.module.booking.repository.BookingRepository;
import com.cinex.module.booking.repository.BookingSeatRepository;
import com.cinex.module.booking.service.BookingService;
import com.cinex.module.seat.entity.SeatStatus;
import com.cinex.module.seat.entity.SeatType;
import com.cinex.module.seat.repository.SeatRepository;
import com.cinex.module.showtime.dto.AppliedPricingRule;
import com.cinex.module.showtime.dto.AutoScheduleRequest;
import com.cinex.module.showtime.dto.AutoScheduleResult;
import com.cinex.module.showtime.dto.AutoScheduleSlotMode;
import com.cinex.module.showtime.dto.ShowtimeFilter;
import com.cinex.module.showtime.dto.ShowtimeListResponse;
import com.cinex.module.showtime.dto.ShowtimeRequest;
import com.cinex.module.showtime.dto.ShowtimeResponse;
import com.cinex.module.showtime.entity.Showtime;
import com.cinex.module.showtime.entity.ShowtimeFormat;
import com.cinex.module.showtime.entity.ShowtimeLanguage;
import com.cinex.module.showtime.entity.ShowtimeStatus;
import com.cinex.module.showtime.mapper.ShowtimeMapper;
import com.cinex.module.showtime.repository.ShowtimeRepository;
import com.cinex.module.showtime.specification.ShowtimeSpecification;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ShowtimeService {

    private final ShowtimeRepository showtimeRepository;
    private final MovieRepository movieRepository;
    private final MovieRunRepository movieRunRepository;
    private final RoomRepository roomRepository;
    private final SeatRepository seatRepository;
    private final BookingRepository bookingRepository;
    private final BookingSeatRepository bookingSeatRepository;
    private final BookingService bookingCancelHelper;
    private final ShowtimeMapper showtimeMapper;
    private final SystemConfigService systemConfigService;
    private final SecurityService securityService;
    private final PricingEngine pricingEngine;

    /**
     * <b>RBAC scope:</b> Branch ADMIN bị override filter.theaterId thành chi nhánh của mình.
     * USER + SUPER_ADMIN giữ filter nguyên (USER vẫn xem showtime public toàn hệ thống).
     */
    @Transactional(readOnly = true)
    public Page<ShowtimeListResponse> listShowtimes(ShowtimeFilter filter, Pageable pageable) {
        Long scopedTheaterId = securityService.getCurrentUserTheaterId();
        if (scopedTheaterId != null) {
            filter.setTheaterId(scopedTheaterId);
        }
        // Force-loại DRAFT cho non-admin/staff caller. Chuẩn Vista/Veezi publish
        // workflow: anonymous + USER không bao giờ thấy suất nháp, kể cả khi FE
        // tinh nghịch set excludeDraft=false. Admin/staff được phép xem DRAFT để
        // review/publish.
        boolean canSeeDraft = securityService.isSuperAdmin()
                || securityService.isBranchAdmin()
                || securityService.isStaff();
        if (!canSeeDraft) {
            filter.setExcludeDraft(Boolean.TRUE);
        }
        var spec = ShowtimeSpecification.fromFilter(filter);
        return showtimeRepository.findAll(spec, pageable)
                .map(this::toListResponseWithPricing);
    }

    /**
     * Map Showtime entity → ListResponse và POPULATE effective prices + applied rules.
     *
     * <p><b>Chuẩn industry "What You See Is What You Pay":</b> Pricing rules được apply ngay
     * ở response — FE hiển thị giá thực sự thu (sau discount/surge), không phải giá gốc DB.
     * Tránh bug "thấy 100k trên list, trả 80k ở payment".
     */
    private ShowtimeListResponse toListResponseWithPricing(Showtime showtime) {
        ShowtimeListResponse base = showtimeMapper.toListResponse(showtime);
        return enrichWithPricing(base, showtime);
    }

    /**
     * Populate effective prices + appliedRules vào response.
     * Dùng {@code .toBuilder()} để KHỎI quên copy field khi DTO mở rộng — chỉ
     * override effective* và appliedRules, mọi field raw khác giữ nguyên.
     * Tránh repeat bug: trước đây rebuild thủ công đã quên sweetbox/deluxe.
     */
    private ShowtimeListResponse enrichWithPricing(ShowtimeListResponse base, Showtime showtime) {
        Long theaterId = showtime.getRoom().getTheater().getId();
        LocalDateTime start = showtime.getStartTime();
        List<AppliedPricingRule> applied = pricingEngine.findMatchingRules(start, theaterId).stream()
                .map(r -> AppliedPricingRule.builder()
                        .code(r.code())
                        .name(r.name())
                        // multiplierPercent 80 → discountPercent -20 (giảm 20%); 130 → +30 (tăng 30%)
                        .discountPercent(r.multiplierPercent().subtract(BigDecimal.valueOf(100)))
                        .build())
                .toList();
        // Số ghế còn trống — FE hiển thị urgency "Còn N/M ghế" trên card.
        // 1 query/showtime — chấp nhận N+1 vì list movie detail thường <30
        // suất. Nếu sau này list lớn (>100) → batch query single SQL.
        int totalSeats = showtime.getRoom().getTotalSeats();
        int occupied = bookingSeatRepository.findAllOccupiedByShowtimeId(showtime.getId()).size();
        return base.toBuilder()
                .effectiveBasePrice(applyModifiersNullable(base.getBasePrice(), start, theaterId))
                .effectiveVipPrice(applyModifiersNullable(base.getVipPrice(), start, theaterId))
                .effectiveCouplePrice(applyModifiersNullable(base.getCouplePrice(), start, theaterId))
                .effectiveSweetboxPrice(applyModifiersNullable(base.getSweetboxPrice(), start, theaterId))
                .effectiveDeluxePrice(applyModifiersNullable(base.getDeluxePrice(), start, theaterId))
                .appliedRules(applied)
                .availableSeats(Math.max(0, totalSeats - occupied))
                .totalSeats(totalSeats)
                .build();
    }

    /**
     * Apply pricingEngine cho tier nullable — null in → null out (KHÔNG return 0
     * như PricingEngine.applyModifiers mặc định, vì 0 sẽ hiện "VIP: 0đ" trên FE
     * cho phòng không có VIP).
     */
    private BigDecimal applyModifiersNullable(BigDecimal price, LocalDateTime start, Long theaterId) {
        if (price == null) return null;
        return pricingEngine.applyModifiers(price, start, theaterId);
    }

    @Transactional(readOnly = true)
    public ShowtimeResponse getShowtime(Long id) {
        Showtime showtime = showtimeRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.SHOWTIME_NOT_FOUND));

        // Chặn non-admin xem DRAFT detail — nháp = nội bộ, nếu lộ ra public có
        // thể vô tình book vé suất chưa duyệt. Trả 404 thay vì 403 để không
        // tiết lộ sự tồn tại của draft cho user thường.
        if (showtime.getStatus() == ShowtimeStatus.DRAFT) {
            boolean canSeeDraft = securityService.isSuperAdmin()
                    || securityService.isBranchAdmin()
                    || securityService.isStaff();
            if (!canSeeDraft) {
                throw new BusinessException(ErrorCode.SHOWTIME_NOT_FOUND);
            }
        }

        ShowtimeResponse response = showtimeMapper.toResponse(showtime);

        // Tính số ghế trống = tổng ghế phòng - ghế đã đặt/đang giữ
        int totalSeats = showtime.getRoom().getTotalSeats();
        int occupiedSeats = bookingSeatRepository.findAllOccupiedByShowtimeId(id).size();
        int availableSeats = totalSeats - occupiedSeats;

        // Pricing engine — chuẩn "What You See Is What You Pay": cùng nguồn giá với BookingService
        Long theaterId = showtime.getRoom().getTheater().getId();
        LocalDateTime start = showtime.getStartTime();
        List<AppliedPricingRule> applied = pricingEngine.findMatchingRules(start, theaterId).stream()
                .map(r -> AppliedPricingRule.builder()
                        .code(r.code())
                        .name(r.name())
                        .discountPercent(r.multiplierPercent().subtract(BigDecimal.valueOf(100)))
                        .build())
                .toList();

        // toBuilder: giữ nguyên mọi raw field từ mapper, chỉ override effective* +
        // availableSeats + appliedRules. Tránh repeat bug rebuild thủ công quên field.
        return response.toBuilder()
                .effectiveBasePrice(applyModifiersNullable(response.getBasePrice(), start, theaterId))
                .effectiveVipPrice(applyModifiersNullable(response.getVipPrice(), start, theaterId))
                .effectiveCouplePrice(applyModifiersNullable(response.getCouplePrice(), start, theaterId))
                .effectiveSweetboxPrice(applyModifiersNullable(response.getSweetboxPrice(), start, theaterId))
                .effectiveDeluxePrice(applyModifiersNullable(response.getDeluxePrice(), start, theaterId))
                .appliedRules(applied)
                .availableSeats(availableSeats)
                .totalSeats(totalSeats)
                .build();
    }

    /**
     * Tạo suất chiếu:
     * 1. Validate: phim + phòng tồn tại
     * 2. Resolve MovieRun: nếu request có movieRunId → dùng cái đó (admin chỉ định);
     *    nếu null → tự pick active run của movie (NOW_SHOWING > nearest SCHEDULED).
     * 3. Không cho tạo suất trong quá khứ
     * 4. Validate startTime nằm trong [movieRun.startDate, movieRun.endDate]
     * 5. Tính endTime = startTime + movie.duration (hiển thị cho user)
     *    slotEndTime = endTime + buffer (cho conflict check nội bộ)
     * 6. Kiểm tra phòng trống dùng slotEndTime
     * 7. Set CẢ showtime.movieRun và showtime.movie (denormalized) — giữ invariant
     */
    @Transactional
    public ShowtimeResponse createShowtime(ShowtimeRequest request) {
        Movie movie = movieRepository.findById(request.getMovieId())
                .orElseThrow(() -> new BusinessException(ErrorCode.MOVIE_NOT_FOUND));
        Room room = roomRepository.findById(request.getRoomId())
                .orElseThrow(() -> new BusinessException(ErrorCode.ROOM_NOT_FOUND));

        // RBAC: branch ADMIN chỉ tạo showtime cho phòng của chi nhánh mình
        securityService.requireAccessToTheater(room.getTheater().getId());

        // Phòng đang bảo trì/đóng → không cho tạo suất mới (industry chuẩn:
        // Cinetixx/Veezi auto-block. Tránh khách book rồi đến không có phòng).
        if (room.getStatus() != RoomStatus.ACTIVE) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Phòng '" + room.getName() + "' đang " +
                    (room.getStatus() == RoomStatus.MAINTENANCE ? "bảo trì" : "đóng") +
                    " — không thể tạo suất chiếu");
        }

        // Resolve MovieRun (advanced UX vs default UX) — pass theaterId để filter run theo rạp
        MovieRun movieRun = resolveMovieRun(movie, request.getMovieRunId(), room.getTheater().getId());

        // Không cho tạo suất trong quá khứ
        if (request.getStartTime().isBefore(LocalDateTime.now())) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Không thể tạo suất chiếu trong quá khứ");
        }

        // Suất chiếu phải nằm trong vòng đời ĐỢT CHIẾU [movieRun.startDate, movieRun.endDate]
        validateShowtimeWithinMovieRun(movieRun, request.getStartTime());

        // endTime = chỉ phim (cho user thấy đúng "phim dài bao lâu")
        LocalDateTime endTime = request.getStartTime().plusMinutes(movie.getDuration());

        // slotEndTime = endTime + buffer dọn dẹp (cho conflict check nội bộ)
        int bufferMinutes = systemConfigService.getInt("showtime.buffer_minutes", 15);
        LocalDateTime slotEndTime = endTime.plusMinutes(bufferMinutes);

        // Resolve giá per tier — skip auto-fill cho tier mà phòng KHÔNG có loại ghế đó.
        // VD: phòng full STANDARD → vipPrice/couplePrice = null thay vì lưu giá rác.
        Set<SeatType> roomSeatTypes = fetchRoomSeatTypes(room.getId());
        BigDecimal basePrice = resolvePrice(request.getBasePrice(), room.getType(), "base");
        BigDecimal vipPrice = resolveTierPrice(request.getVipPrice(), room.getType(), "vip", roomSeatTypes, SeatType.VIP);
        BigDecimal couplePrice = resolveTierPrice(request.getCouplePrice(), room.getType(), "couple", roomSeatTypes, SeatType.COUPLE);
        BigDecimal sweetboxPrice = resolveTierPrice(request.getSweetboxPrice(), room.getType(), "sweetbox", roomSeatTypes, SeatType.SWEETBOX);
        BigDecimal deluxePrice = resolveTierPrice(request.getDeluxePrice(), room.getType(), "deluxe", roomSeatTypes, SeatType.DELUXE);

        validatePriceHierarchy(basePrice, vipPrice, couplePrice, sweetboxPrice, deluxePrice);

        // Kiểm tra phòng trống — dùng slotEndTime (room phải free đến hết slot dọn dẹp)
        List<Showtime> conflicts = showtimeRepository.findConflictingShowtimes(
                room.getId(), request.getStartTime(), slotEndTime);
        if (!conflicts.isEmpty()) {
            throw new BusinessException(ErrorCode.SHOWTIME_CONFLICT,
                    "Phòng '" + room.getName() + "' đã có suất chiếu trong khung giờ này");
        }

        // [Invariant] Set CẢ movieRun và movie — movie phải === movieRun.movie để
        // tránh dữ liệu lệch giữa 2 field denormalized.
        Showtime showtime = Showtime.builder()
                .movie(movie)
                .movieRun(movieRun)
                .room(room)
                .startTime(request.getStartTime())
                .endTime(endTime)
                .slotEndTime(slotEndTime)
                .basePrice(basePrice)
                .vipPrice(vipPrice)
                .couplePrice(couplePrice)
                .sweetboxPrice(sweetboxPrice)
                .deluxePrice(deluxePrice)
                .status(ShowtimeStatus.SCHEDULED)
                .format(request.getFormat() == null ? ShowtimeFormat.TWO_D : request.getFormat())
                .languageMode(request.getLanguageMode() == null
                        ? ShowtimeLanguage.SUB_VI : request.getLanguageMode())
                .build();

        showtimeRepository.save(showtime);
        log.info("Created showtime: {} (run #{}) at {} in {}",
                movie.getTitle(), movieRun.getId(), request.getStartTime(), room.getName());
        return getShowtime(showtime.getId());
    }

    @Transactional
    public ShowtimeResponse updateShowtime(Long id, ShowtimeRequest request) {
        Showtime showtime = showtimeRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.SHOWTIME_NOT_FOUND));

        // RBAC: branch ADMIN chỉ sửa showtime của chi nhánh mình
        securityService.requireAccessToTheater(showtime.getRoom().getTheater().getId());

        // FIX 2: Không cho sửa suất chiếu đã có booking HOLDING hoặc CONFIRMED
        long activeBookings = bookingRepository.countByShowtimeIdAndStatusIn(id,
                List.of(BookingStatus.HOLDING, BookingStatus.CONFIRMED));
        if (activeBookings > 0) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Không thể sửa suất chiếu đã có " + activeBookings + " vé đặt");
        }

        Movie movie = movieRepository.findById(request.getMovieId())
                .orElseThrow(() -> new BusinessException(ErrorCode.MOVIE_NOT_FOUND));
        Room room = roomRepository.findById(request.getRoomId())
                .orElseThrow(() -> new BusinessException(ErrorCode.ROOM_NOT_FOUND));

        // Resolve MovieRun (xem comment createShowtime) — pass room.theater để filter run theo rạp
        MovieRun movieRun = resolveMovieRun(movie, request.getMovieRunId(), room.getTheater().getId());

        // Suất chiếu phải nằm trong vòng đời đợt chiếu [movieRun.startDate, movieRun.endDate]
        validateShowtimeWithinMovieRun(movieRun, request.getStartTime());

        // endTime = chỉ phim, slotEndTime = endTime + buffer (xem comment createShowtime)
        LocalDateTime endTime = request.getStartTime().plusMinutes(movie.getDuration());
        int bufferMinutes = systemConfigService.getInt("showtime.buffer_minutes", 15);
        LocalDateTime slotEndTime = endTime.plusMinutes(bufferMinutes);

        // Resolve giá per tier — xem comment ở createShowtime.
        Set<SeatType> roomSeatTypes = fetchRoomSeatTypes(room.getId());
        BigDecimal basePrice = resolvePrice(request.getBasePrice(), room.getType(), "base");
        BigDecimal vipPrice = resolveTierPrice(request.getVipPrice(), room.getType(), "vip", roomSeatTypes, SeatType.VIP);
        BigDecimal couplePrice = resolveTierPrice(request.getCouplePrice(), room.getType(), "couple", roomSeatTypes, SeatType.COUPLE);
        BigDecimal sweetboxPrice = resolveTierPrice(request.getSweetboxPrice(), room.getType(), "sweetbox", roomSeatTypes, SeatType.SWEETBOX);
        BigDecimal deluxePrice = resolveTierPrice(request.getDeluxePrice(), room.getType(), "deluxe", roomSeatTypes, SeatType.DELUXE);

        validatePriceHierarchy(basePrice, vipPrice, couplePrice, sweetboxPrice, deluxePrice);

        // Kiểm tra trùng giờ (loại trừ chính nó) — dùng slotEndTime
        List<Showtime> conflicts = showtimeRepository.findConflictingShowtimes(
                room.getId(), request.getStartTime(), slotEndTime);
        conflicts.removeIf(s -> s.getId().equals(id));
        if (!conflicts.isEmpty()) {
            throw new BusinessException(ErrorCode.SHOWTIME_CONFLICT,
                    "Phòng '" + room.getName() + "' đã có suất chiếu trong khung giờ này");
        }

        // Giữ invariant: movie === movieRun.movie
        showtime.setMovie(movie);
        showtime.setMovieRun(movieRun);
        showtime.setRoom(room);
        showtime.setStartTime(request.getStartTime());
        showtime.setEndTime(endTime);
        showtime.setSlotEndTime(slotEndTime);
        showtime.setBasePrice(basePrice);
        showtime.setVipPrice(vipPrice);
        showtime.setCouplePrice(couplePrice);
        showtime.setSweetboxPrice(sweetboxPrice);
        showtime.setDeluxePrice(deluxePrice);
        // Cho phép admin đổi format/language khi edit — vd phát hiện set sai dub→sub.
        // null trong request giữ giá trị cũ (không clear về null).
        if (request.getFormat() != null) showtime.setFormat(request.getFormat());
        if (request.getLanguageMode() != null) showtime.setLanguageMode(request.getLanguageMode());

        showtimeRepository.save(showtime);
        log.info("Updated showtime {} (run #{})", id, movieRun.getId());
        return getShowtime(id);
    }

    @Transactional
    public void deleteShowtime(Long id) {
        Showtime showtime = showtimeRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.SHOWTIME_NOT_FOUND));
        // RBAC: branch ADMIN chỉ xoá showtime của chi nhánh mình
        securityService.requireAccessToTheater(showtime.getRoom().getTheater().getId());

        // Industry chuẩn (Vista Veezi / Cinetixx): chỉ xoá được suất chưa chiếu —
        // SCHEDULED hoặc DRAFT. Suất ONGOING (đang chiếu) / FINISHED (đã chiếu) /
        // CANCELLED → giữ làm lịch sử + audit trail.
        if (showtime.getStatus() != ShowtimeStatus.SCHEDULED
                && showtime.getStatus() != ShowtimeStatus.DRAFT) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Chỉ có thể xoá suất chiếu DRAFT hoặc SCHEDULED. " +
                    "Suất " + showtime.getStatus() + " không thể xoá — giữ làm lịch sử.");
        }
        // Block xoá khi đã có booking giữ/thanh toán — tránh orphan booking
        long activeBookings = bookingRepository.countByShowtimeIdAndStatusIn(
                id, List.of(BookingStatus.HOLDING, BookingStatus.CONFIRMED));
        if (activeBookings > 0) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Không thể xoá suất chiếu đã có " + activeBookings +
                    " vé đặt. Hãy cancel suất chiếu (sẽ hoàn vé tự động) thay vì xoá.");
        }
        showtime.setStorageState(StorageState.ARCHIVED);
        showtimeRepository.save(showtime);
        log.info("Soft deleted showtime {}", id);
    }

    /**
     * Publish suất DRAFT → SCHEDULED — chuẩn Vista/Veezi/Cinetixx publish workflow.
     *
     * <p>Sau khi admin tạo loạt suất nháp + review xong, gọi endpoint này để
     * "đẩy" chúng visible cho user. Idempotent: gọi với SCHEDULED không lỗi
     * (no-op). Chỉ ném exception nếu status ngoài DRAFT/SCHEDULED.
     */
    @Transactional
    public ShowtimeResponse publishShowtime(Long id) {
        Showtime showtime = showtimeRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.SHOWTIME_NOT_FOUND));
        securityService.requireAccessToTheater(showtime.getRoom().getTheater().getId());

        if (showtime.getStatus() == ShowtimeStatus.SCHEDULED) {
            return getShowtime(id); // idempotent
        }
        if (showtime.getStatus() != ShowtimeStatus.DRAFT) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Chỉ publish được suất DRAFT. Suất hiện tại: " + showtime.getStatus());
        }
        showtime.setStatus(ShowtimeStatus.SCHEDULED);
        showtimeRepository.save(showtime);
        log.info("Published showtime {} (DRAFT → SCHEDULED)", id);
        return getShowtime(id);
    }

    /**
     * Bulk publish — admin chọn nhiều DRAFT trong list, đẩy cùng lúc. Bỏ qua
     * (không throw) các ID đã SCHEDULED; throw nếu có ID ngoài DRAFT/SCHEDULED.
     */
    @Transactional
    public int bulkPublish(List<Long> ids) {
        List<Showtime> showtimes = showtimeRepository.findAllById(ids);
        showtimes.forEach(s -> securityService.requireAccessToTheater(s.getRoom().getTheater().getId()));
        for (Showtime s : showtimes) {
            if (s.getStatus() != ShowtimeStatus.DRAFT && s.getStatus() != ShowtimeStatus.SCHEDULED) {
                throw new BusinessException(ErrorCode.INVALID_REQUEST,
                        "Suất chiếu #" + s.getId() + " ở trạng thái " + s.getStatus() +
                        " — không thể publish");
            }
        }
        int published = 0;
        for (Showtime s : showtimes) {
            if (s.getStatus() == ShowtimeStatus.DRAFT) {
                s.setStatus(ShowtimeStatus.SCHEDULED);
                published++;
            }
        }
        showtimeRepository.saveAll(showtimes);
        log.info("Bulk published {} showtimes (DRAFT → SCHEDULED)", published);
        return published;
    }

    @Transactional
    public ShowtimeResponse restoreShowtime(Long id) {
        Showtime showtime = showtimeRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.SHOWTIME_NOT_FOUND));
        // RBAC: branch ADMIN chỉ restore showtime của chi nhánh mình
        securityService.requireAccessToTheater(showtime.getRoom().getTheater().getId());
        showtime.setStorageState(StorageState.ACTIVE);
        showtimeRepository.save(showtime);
        log.info("Restored showtime {}", id);
        return getShowtime(id);
    }

    @Transactional
    public void bulkDelete(List<Long> ids) {
        List<Showtime> showtimes = showtimeRepository.findAllById(ids);
        // RBAC: branch ADMIN chỉ archive showtime của chi nhánh mình
        showtimes.forEach(s -> securityService.requireAccessToTheater(s.getRoom().getTheater().getId()));
        // Fail-fast: check status + booking trước khi mutate gì
        for (Showtime s : showtimes) {
            if (s.getStatus() != ShowtimeStatus.SCHEDULED && s.getStatus() != ShowtimeStatus.DRAFT) {
                throw new BusinessException(ErrorCode.INVALID_REQUEST,
                        "Suất chiếu #" + s.getId() + " ở trạng thái " + s.getStatus() +
                        " — chỉ xoá được DRAFT hoặc SCHEDULED");
            }
            long activeBookings = bookingRepository.countByShowtimeIdAndStatusIn(
                    s.getId(), List.of(BookingStatus.HOLDING, BookingStatus.CONFIRMED));
            if (activeBookings > 0) {
                throw new BusinessException(ErrorCode.INVALID_REQUEST,
                        "Suất chiếu #" + s.getId() + " đã có " + activeBookings + " vé đặt — không thể xoá");
            }
        }
        showtimes.forEach(s -> s.setStorageState(StorageState.ARCHIVED));
        showtimeRepository.saveAll(showtimes);
        log.info("Bulk soft deleted {} showtimes", showtimes.size());
    }

    @Transactional
    public void bulkRestore(List<Long> ids) {
        List<Showtime> items = showtimeRepository.findAllById(ids);
        items.forEach(i -> securityService.requireAccessToTheater(i.getRoom().getTheater().getId()));
        items.forEach(i -> i.setStorageState(StorageState.ACTIVE));
        showtimeRepository.saveAll(items);
        log.info("Bulk restored {} items", items.size());
    }

    /**
     * Cancel showtime + cascade refund tất cả vé CONFIRMED + thông báo khách.
     *
     * <p>Trước đây không có endpoint này → admin muốn huỷ suất (phim bị cut,
     * sự cố kỹ thuật) chỉ có thể xoá khi 0 booking. Có booking → kẹt. Khách
     * vẫn CONFIRMED vé → đến rạp mới biết → tranh cãi.
     *
     * <p>Industry chuẩn (Vista Veezi / Cinetixx): suất bị huỷ → tất cả vé
     * auto-cancel + auto-refund (qua MoMo refund API hoặc cash quầy) + email
     * thông báo + WebSocket notify FE cập nhật real-time.
     *
     * <p>Workflow:
     * <ol>
     *   <li>RBAC + lock showtime</li>
     *   <li>Validate: chỉ cancel SCHEDULED hoặc ONGOING (FINISHED giữ làm lịch sử)</li>
     *   <li>Find all booking CONFIRMED + HOLDING → cancel + refund + return voucher</li>
     *   <li>Set showtime status = CANCELLED</li>
     *   <li>Return summary count (cancelled bookings, refunded amount)</li>
     * </ol>
     */
    @Transactional
    public CancelShowtimeResult cancelShowtime(Long id, String reason) {
        Showtime showtime = showtimeRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.SHOWTIME_NOT_FOUND));
        securityService.requireAccessToTheater(showtime.getRoom().getTheater().getId());

        if (showtime.getStatus() == ShowtimeStatus.FINISHED
                || showtime.getStatus() == ShowtimeStatus.CANCELLED) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Suất chiếu đã ở trạng thái " + showtime.getStatus() + " — không thể huỷ thêm");
        }

        // Cascade cancel + refund mọi booking active của suất này
        List<Booking> activeBookings = bookingRepository.findByShowtimeIdAndStatusIn(
                id, List.of(BookingStatus.HOLDING, BookingStatus.CONFIRMED));

        int cancelledCount = 0;
        for (Booking b : activeBookings) {
            // BookingService.cancelByAdmin sẽ handle: status → CANCELLED,
            // refund payment (nếu CONFIRMED + paid), return voucher, free seats,
            // gửi email notify + WebSocket. Tập trung logic 1 chỗ.
            bookingCancelHelper.cancelDueToShowtimeCancel(b, reason);
            cancelledCount++;
        }

        showtime.setStatus(ShowtimeStatus.CANCELLED);
        showtimeRepository.save(showtime);
        log.warn("Showtime {} CANCELLED (reason: {}). Auto-cancelled {} bookings",
                id, reason, cancelledCount);

        return new CancelShowtimeResult(id, cancelledCount, reason);
    }

    public record CancelShowtimeResult(Long showtimeId, int cancelledBookings, String reason) {}

    /**
     * Auto-schedule — tạo hàng loạt suất chiếu cho 1 phim trên N phòng × M ngày.
     *
     * <p><b>Algorithm:</b>
     * <ol>
     *   <li>Validate request (date range ≤ 30 ngày, startHour < endHour, RBAC theater).</li>
     *   <li>Resolve MovieRun applicable cho movie + theater (open-ended OK).</li>
     *   <li>Với mỗi ngày × mỗi phòng:
     *     <ul>
     *       <li>Tính slotDuration = movie.duration + bufferMinutes (fallback config 15)</li>
     *       <li>Loop slot = startHour → endHour, step slotDuration phút</li>
     *       <li>Check past time → SKIP "Quá khứ"</li>
     *       <li>Check conflict với suất hiện có → SKIP "Conflict với #X"</li>
     *       <li>Check date trong movieRun range → SKIP "Ngoài đợt chiếu"</li>
     *       <li>Tất cả OK → create showtime với giá theo room seat types</li>
     *     </ul>
     *   </li>
     * </ol>
     *
     * <p><b>Tại sao SKIP thay vì throw:</b> Admin chạy auto-schedule cho 7 ngày × 5 phòng → 175 slot.
     * Nếu 1 slot conflict → throw → KHÔNG TẠO GÌ. UX tệ. SKIP + report giúp admin
     * thấy được 170 tạo thành công + 5 skip vì sao.
     *
     * <p><b>Đặt @Transactional:</b> all-or-nothing trong 1 lần auto-schedule.
     * Nếu giữa chừng lỗi nặng (DB down) → rollback toàn bộ.
     */
    @Transactional
    public AutoScheduleResult autoSchedule(AutoScheduleRequest req) {
        // 1. RBAC: branch ADMIN chỉ schedule trong CN của mình
        securityService.requireAccessToTheater(req.getTheaterId());

        // 2. Validate range
        if (req.getDateFrom().isAfter(req.getDateTo())) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST, "dateFrom phải <= dateTo");
        }
        long daysSpan = ChronoUnit.DAYS.between(req.getDateFrom(), req.getDateTo()) + 1;
        if (daysSpan > 30) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Tối đa 30 ngày/lần auto-schedule. Yêu cầu: " + daysSpan + " ngày.");
        }
        if (req.getStartHour() >= req.getEndHour()) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "startHour phải < endHour");
        }

        // Validate weekdays + slot mode — chuẩn Vista/Veezi/Cinetixx.
        // null/empty weekdays → mọi ngày trong tuần (1=Mon..7=Sun ISO).
        Set<Integer> weekdays = req.getWeekdays() == null || req.getWeekdays().isEmpty()
                ? Set.of(1, 2, 3, 4, 5, 6, 7)
                : new HashSet<>(req.getWeekdays());
        for (Integer d : weekdays) {
            if (d < 1 || d > 7) {
                throw new BusinessException(ErrorCode.INVALID_REQUEST,
                        "weekdays phải trong khoảng 1-7 (ISO: 1=Mon..7=Sun)");
            }
        }

        AutoScheduleSlotMode slotMode = req.getSlotMode() == null
                ? AutoScheduleSlotMode.WINDOW
                : req.getSlotMode();
        if (slotMode == AutoScheduleSlotMode.TEMPLATES) {
            if (req.getFixedTimes() == null || req.getFixedTimes().isEmpty()) {
                throw new BusinessException(ErrorCode.INVALID_REQUEST,
                        "slotMode=TEMPLATES yêu cầu fixedTimes không rỗng");
            }
        }

        // 3. Load entities
        Movie movie = movieRepository.findById(req.getMovieId())
                .orElseThrow(() -> new BusinessException(ErrorCode.MOVIE_NOT_FOUND));
        List<Room> rooms = roomRepository.findAllById(req.getRoomIds());
        if (rooms.size() != req.getRoomIds().size()) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Một số phòng không tồn tại");
        }
        // Verify all rooms belong to theaterId
        for (Room room : rooms) {
            if (!room.getTheater().getId().equals(req.getTheaterId())) {
                throw new BusinessException(ErrorCode.INVALID_REQUEST,
                        "Phòng '" + room.getName() + "' không thuộc chi nhánh đã chọn");
            }
        }

        // 4. Resolve MovieRun (1 run cover toàn bộ date range — admin tạo run đủ rộng)
        MovieRun movieRun = resolveMovieRun(movie, null, req.getTheaterId());

        // Buffer LẤY từ system_config — đảm bảo cấu hình toàn cục thống nhất,
        // không cho admin truyền per-batch để bypass policy.
        int bufferMin = systemConfigService.getInt("showtime.buffer_minutes", 15);
        int slotDurationMin = movie.getDuration() + bufferMin;

        // 6. Loop generate
        List<AutoScheduleResult.ScheduleEntry> details = new ArrayList<>();
        int created = 0;
        int skipped = 0;
        LocalDateTime now = LocalDateTime.now();

        LocalDate currentDate = req.getDateFrom();
        while (!currentDate.isAfter(req.getDateTo())) {
            // Skip nếu ngày không thuộc weekdays đã chọn — không thêm entry vào details
            // để tránh nhiễu output (admin chủ động loại weekday, không cần liệt kê từng slot).
            // ISO: getDayOfWeek().getValue() trả 1=Mon..7=Sun, khớp định nghĩa weekdays.
            if (!weekdays.contains(currentDate.getDayOfWeek().getValue())) {
                currentDate = currentDate.plusDays(1);
                continue;
            }

            // Check date trong movieRun range
            boolean dateInRun = !currentDate.isBefore(movieRun.getStartDate())
                    && (movieRun.getEndDate() == null || !currentDate.isAfter(movieRun.getEndDate()));

            for (Room room : rooms) {
                Set<SeatType> seatTypes = fetchRoomSeatTypes(room.getId());
                BigDecimal basePrice = req.getBasePrice();
                BigDecimal vipPrice = resolveTierPrice(req.getVipPrice(), room.getType(), "vip", seatTypes, SeatType.VIP);
                BigDecimal couplePrice = resolveTierPrice(req.getCouplePrice(), room.getType(), "couple", seatTypes, SeatType.COUPLE);
                BigDecimal sweetboxPrice = resolveTierPrice(req.getSweetboxPrice(), room.getType(), "sweetbox", seatTypes, SeatType.SWEETBOX);
                BigDecimal deluxePrice = resolveTierPrice(req.getDeluxePrice(), room.getType(), "deluxe", seatTypes, SeatType.DELUXE);

                // Tổng hợp danh sách slot startTime cần thử cho 1 ngày × 1 phòng.
                // WINDOW: rải liên tiếp [startHour, endHour) step slotDuration phút.
                // TEMPLATES: dùng đúng các giờ admin nhập (vd 10:00, 13:00, 16:00).
                List<LocalDateTime> slotStarts = new ArrayList<>();
                if (slotMode == AutoScheduleSlotMode.TEMPLATES) {
                    LocalDateTime dayEnd = currentDate.plusDays(1).atStartOfDay();
                    for (LocalTime t : req.getFixedTimes()) {
                        LocalDateTime s = currentDate.atTime(t);
                        // Vẫn enforce slot fit trong ngày (slot.end ≤ midnight) để tránh phim
                        // tràn qua ngày sau (rạp thật không chiếu xuyên 0h thông qua admin tool).
                        if (s.plusMinutes(slotDurationMin).compareTo(dayEnd) <= 0) {
                            slotStarts.add(s);
                        }
                    }
                } else {
                    LocalDateTime slot = currentDate.atTime(req.getStartHour(), 0);
                    LocalDateTime dayEnd = req.getEndHour() == 24
                            ? currentDate.plusDays(1).atStartOfDay()
                            : currentDate.atTime(req.getEndHour(), 0);
                    while (slot.plusMinutes(slotDurationMin).compareTo(dayEnd) <= 0) {
                        slotStarts.add(slot);
                        slot = slot.plusMinutes(slotDurationMin);
                    }
                }

                for (LocalDateTime slot : slotStarts) {
                    LocalDateTime slotEnd = slot.plusMinutes(slotDurationMin);
                    LocalDateTime movieEnd = slot.plusMinutes(movie.getDuration());

                    // Skip past
                    if (slot.isBefore(now)) {
                        details.add(AutoScheduleResult.ScheduleEntry.builder()
                                .roomId(room.getId()).roomName(room.getName())
                                .startTime(slot).status("SKIPPED").reason("Quá khứ")
                                .build());
                        skipped++;
                    } else if (!dateInRun) {
                        details.add(AutoScheduleResult.ScheduleEntry.builder()
                                .roomId(room.getId()).roomName(room.getName())
                                .startTime(slot).status("SKIPPED")
                                .reason("Ngoài đợt chiếu (" + movieRun.getStartDate() + " → "
                                        + (movieRun.getEndDate() != null ? movieRun.getEndDate() : "?") + ")")
                                .build());
                        skipped++;
                    } else {
                        // Check conflict
                        List<Showtime> conflicts = showtimeRepository.findConflictingShowtimes(
                                room.getId(), slot, slotEnd);
                        if (!conflicts.isEmpty()) {
                            details.add(AutoScheduleResult.ScheduleEntry.builder()
                                    .roomId(room.getId()).roomName(room.getName())
                                    .startTime(slot).status("SKIPPED")
                                    .reason("Trùng suất chiếu #" + conflicts.get(0).getId())
                                    .build());
                            skipped++;
                        } else {
                            // Default: SUB_VI cho phim ngoại, TWO_D cho format. Admin có thể
                            // override per-batch trong AutoScheduleRequest. asDraft=true →
                            // status DRAFT (chuẩn Vista/Veezi publish workflow).
                            ShowtimeStatus targetStatus = Boolean.TRUE.equals(req.getAsDraft())
                                    ? ShowtimeStatus.DRAFT
                                    : ShowtimeStatus.SCHEDULED;
                            Showtime st = Showtime.builder()
                                    .movie(movie).movieRun(movieRun).room(room)
                                    .startTime(slot).endTime(movieEnd).slotEndTime(slotEnd)
                                    .basePrice(basePrice).vipPrice(vipPrice).couplePrice(couplePrice)
                                    .sweetboxPrice(sweetboxPrice).deluxePrice(deluxePrice)
                                    .status(targetStatus)
                                    .format(req.getFormat() == null ? ShowtimeFormat.TWO_D : req.getFormat())
                                    .languageMode(req.getLanguageMode() == null
                                            ? ShowtimeLanguage.SUB_VI : req.getLanguageMode())
                                    .build();
                            showtimeRepository.save(st);
                            details.add(AutoScheduleResult.ScheduleEntry.builder()
                                    .roomId(room.getId()).roomName(room.getName())
                                    .startTime(slot).status("CREATED").showtimeId(st.getId())
                                    .build());
                            created++;
                        }
                    }
                }
            }
            currentDate = currentDate.plusDays(1);
        }

        log.info("Auto-schedule: movie={} theater={} dates=[{}→{}] mode={} weekdays={} hours=[{}→{}] templates={} created={} skipped={}",
                movie.getTitle(), req.getTheaterId(), req.getDateFrom(), req.getDateTo(),
                slotMode, weekdays, req.getStartHour(), req.getEndHour(),
                req.getFixedTimes(), created, skipped);

        return AutoScheduleResult.builder()
                .created(created).skipped(skipped).details(details)
                .build();
    }

    /**
     * Resolve {@link MovieRun} cho 1 showtime sắp được tạo/sửa.
     *
     * <p><b>Strategy:</b>
     * <ol>
     *   <li>Nếu admin chỉ định {@code movieRunId} (advanced UX) → load run đó, validate:
     *       <ul>
     *         <li>Thuộc đúng movie</li>
     *         <li>Chưa ARCHIVED</li>
     *         <li>Status khác {@code ENDED} (không tạo suất mới cho đợt đã kết thúc)</li>
     *       </ul>
     *   </li>
     *   <li>Nếu {@code movieRunId} null (default UX) → tự pick từ các run ACTIVE của movie:
     *       <ul>
     *         <li>Ưu tiên run đang {@code NOW_SHOWING}</li>
     *         <li>Fallback: run {@code SCHEDULED} có startDate gần nhất (sớm nhất)</li>
     *         <li>Không có run nào → throw {@code INVALID_REQUEST}
     *             ("Phim này chưa có đợt chiếu nào active")</li>
     *       </ul>
     *   </li>
     * </ol>
     *
     * <p><b>Lý do prefer NOW_SHOWING:</b> đại đa số case admin tạo showtime cho phim đang chiếu.
     * Tạo cho phim sắp chiếu (SCHEDULED) là use case thiểu số → fallback.
     */
    private MovieRun resolveMovieRun(Movie movie, Long requestedRunId, Long roomTheaterId) {
        // Case 1: admin chỉ định run cụ thể
        if (requestedRunId != null) {
            MovieRun run = movieRunRepository.findById(requestedRunId)
                    .orElseThrow(() -> new BusinessException(ErrorCode.INVALID_REQUEST,
                            "Đợt chiếu #" + requestedRunId + " không tồn tại"));
            if (!run.getMovie().getId().equals(movie.getId())) {
                throw new BusinessException(ErrorCode.INVALID_REQUEST,
                        "Đợt chiếu #" + requestedRunId + " không thuộc phim đã chọn");
            }
            // Cross-theater guard: run.theater phải === room.theater
            if (run.getTheater() == null
                    || !run.getTheater().getId().equals(roomTheaterId)) {
                throw new BusinessException(ErrorCode.INVALID_REQUEST,
                        "Đợt chiếu #" + requestedRunId + " không thuộc chi nhánh của phòng đã chọn");
            }
            if (run.getStorageState() == StorageState.ARCHIVED) {
                throw new BusinessException(ErrorCode.INVALID_REQUEST,
                        "Đợt chiếu #" + requestedRunId + " đã bị xóa");
            }
            if (run.getStatus() == MovieRunStatus.ENDED) {
                throw new BusinessException(ErrorCode.INVALID_REQUEST,
                        "Đợt chiếu này đã kết thúc, không thể tạo suất mới");
            }
            return run;
        }

        // Case 2: auto-pick — filter theo theater của phòng, sort startDate DESC
        List<MovieRun> runs = movieRunRepository
                .findByMovieIdAndTheaterIdAndStorageStateNotOrderByStartDateDesc(
                        movie.getId(), roomTheaterId, StorageState.ARCHIVED);

        // Ưu tiên NOW_SHOWING
        MovieRun nowShowing = runs.stream()
                .filter(r -> r.getStatus() == MovieRunStatus.NOW_SHOWING)
                .findFirst()
                .orElse(null);
        if (nowShowing != null) {
            return nowShowing;
        }

        // Fallback: SCHEDULED có startDate sớm nhất (gần hiện tại nhất theo nghĩa "sắp diễn ra")
        MovieRun nextScheduled = runs.stream()
                .filter(r -> r.getStatus() == MovieRunStatus.SCHEDULED)
                .min((a, b) -> a.getStartDate().compareTo(b.getStartDate()))
                .orElse(null);
        if (nextScheduled != null) {
            return nextScheduled;
        }

        throw new BusinessException(ErrorCode.INVALID_REQUEST,
                "Phim '" + movie.getTitle() + "' chưa có đợt chiếu nào active tại chi nhánh này. " +
                        "Vui lòng tạo đợt chiếu (MovieRun) tại chi nhánh này trước khi xếp suất.");
    }

    /**
     * Validate suất chiếu nằm trong khoảng [movieRun.startDate, movieRun.endDate-if-set].
     *
     * <p><b>Null-safe endDate (open-ended pattern):</b> nếu {@code movieRun.endDate == null}
     * (admin chưa quyết ngày ngưng) → KHÔNG check upper bound, phim chiếu vô thời hạn cho
     * đến khi admin set endDate.
     *
     * <p>Theo chuẩn rạp hiện nay: marketing công bố startDate trước, nhưng endDate chỉ set
     * sau khi rạp quyết ngưng dựa trên doanh thu thực tế.
     */
    private void validateShowtimeWithinMovieRun(MovieRun movieRun, LocalDateTime startTime) {
        LocalDate showtimeDate = startTime.toLocalDate();

        if (showtimeDate.isBefore(movieRun.getStartDate())) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    String.format("Không tạo suất chiếu trước ngày bắt đầu đợt chiếu (%s) của phim '%s'",
                            movieRun.getStartDate(), movieRun.getMovie().getTitle()));
        }
        // endDate null = open-ended → bỏ qua upper bound check
        if (movieRun.getEndDate() != null && showtimeDate.isAfter(movieRun.getEndDate())) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    String.format("Không tạo suất chiếu sau ngày kết thúc đợt chiếu (%s) của phim '%s'",
                            movieRun.getEndDate(), movieRun.getMovie().getTitle()));
        }
    }

    /**
     * Validate thứ tự giá ghế giữa các tier (chỉ check tier có giá, bỏ qua null).
     * <ul>
     *   <li>base <= vip <= couple <= sweetbox (sweetbox = couple cao cấp 2 ghế)</li>
     *   <li>base <= vip <= deluxe (deluxe = single recliner cao cấp)</li>
     * </ul>
     * Sweetbox vs Deluxe độc lập — không so sánh với nhau.
     */
    private void validatePriceHierarchy(BigDecimal base, BigDecimal vip, BigDecimal couple,
                                        BigDecimal sweetbox, BigDecimal deluxe) {
        if (vip != null && base != null && vip.compareTo(base) < 0) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Giá VIP phải lớn hơn hoặc bằng giá thường");
        }
        if (couple != null && vip != null && couple.compareTo(vip) < 0) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Giá ghế đôi phải lớn hơn hoặc bằng giá VIP");
        }
        if (couple != null && base != null && couple.compareTo(base) < 0) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Giá ghế đôi phải lớn hơn hoặc bằng giá thường");
        }
        if (sweetbox != null && couple != null && sweetbox.compareTo(couple) < 0) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Giá Sweetbox phải lớn hơn hoặc bằng giá ghế đôi");
        }
        if (deluxe != null && vip != null && deluxe.compareTo(vip) < 0) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Giá Deluxe phải lớn hơn hoặc bằng giá VIP");
        }
        if (deluxe != null && base != null && deluxe.compareTo(base) < 0) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Giá Deluxe phải lớn hơn hoặc bằng giá thường");
        }
    }

    /**
     * Nếu admin nhập giá → giữ nguyên.
     * Nếu để null → tự fill từ system_config theo RoomType.
     * Nếu config cũng không có → fallback hard-code (an toàn).
     *
     * Dùng cho basePrice — luôn cần fill vì mọi phòng đều có STANDARD/HANDICAP.
     *
     * @param tier "base" / "vip" / "couple" / "sweetbox" / "deluxe"
     */
    private BigDecimal resolvePrice(BigDecimal input, RoomType roomType, String tier) {
        if (input != null) {
            return input;
        }
        return getDefaultPrice(roomType, tier);
    }

    /**
     * Resolve giá cho 1 tier OPTIONAL (VIP/COUPLE/SWEETBOX/DELUXE).
     * <ul>
     *   <li>Phòng KHÔNG có loại ghế tương ứng → LUÔN trả null (ưu tiên cao nhất).
     *       Strip giá rác kể cả khi caller (auto-schedule/admin paste nhầm) gửi
     *       value — invariant: showtime tier price chỉ tồn tại nếu room có loại
     *       ghế đó. UI list/calendar/POS chỉ render tier khi != null.</li>
     *   <li>Phòng CÓ loại ghế + admin nhập giá → giữ nguyên.</li>
     *   <li>Phòng CÓ loại ghế + để trống → auto-fill từ system_config.</li>
     * </ul>
     */
    private BigDecimal resolveTierPrice(BigDecimal input, RoomType roomType, String tier,
                                        Set<SeatType> roomSeatTypes, SeatType requiredType) {
        if (!roomSeatTypes.contains(requiredType)) {
            return null;
        }
        if (input != null) {
            return input;
        }
        return getDefaultPrice(roomType, tier);
    }

    /**
     * Lấy tập loại ghế ACTIVE có trong phòng (loại trừ aisle/lối đi).
     * Dùng để biết có nên auto-fill giá cho tier nào không.
     */
    private Set<SeatType> fetchRoomSeatTypes(Long roomId) {
        // Chỉ tính ghế AVAILABLE — BROKEN/BLOCKED không bán được nên không
        // cần auto-fill giá cho loại ghế đó.
        List<Object[]> rows = seatRepository.countSeatsByTypeInRoom(roomId, StorageState.ACTIVE, SeatStatus.AVAILABLE);
        if (rows.isEmpty()) {
            return EnumSet.noneOf(SeatType.class);
        }
        return rows.stream()
                .map(row -> (SeatType) row[0])
                .collect(Collectors.toCollection(() -> EnumSet.noneOf(SeatType.class)));
    }

    /**
     * Đọc giá mặc định từ system_config theo nhóm RoomType.
     * - IMAX → key prefix "pricing.imax.*"
     * - Còn lại (TWO_D / THREE_D / FOUR_DX) → "pricing.standard.*"
     */
    private BigDecimal getDefaultPrice(RoomType type, String tier) {
        String prefix = (type == RoomType.IMAX) ? "pricing.imax." : "pricing.standard.";
        String key = prefix + tier;
        int fallback = defaultFallback(type, tier);
        int value = systemConfigService.getInt(key, fallback);
        return BigDecimal.valueOf(value);
    }

    /**
     * Fallback an toàn nếu system_config chưa seed.
     * STANDARD: 80k / 120k / 200k — IMAX: 150k / 200k / 350k.
     */
    private int defaultFallback(RoomType type, String tier) {
        if (type == RoomType.IMAX) {
            return switch (tier) {
                case "base" -> 150000;
                case "vip" -> 200000;
                case "couple" -> 350000;
                default -> 0;
            };
        }
        return switch (tier) {
            case "base" -> 80000;
            case "vip" -> 120000;
            case "couple" -> 200000;
            default -> 0;
        };
    }
}
