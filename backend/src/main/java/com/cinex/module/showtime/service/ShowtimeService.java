package com.cinex.module.showtime.service;

import com.cinex.common.entity.StorageState;
import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.module.config.service.SystemConfigService;
import com.cinex.module.movie.entity.Movie;
import com.cinex.module.movie.entity.MovieRun;
import com.cinex.module.movie.entity.MovieRunStatus;
import com.cinex.module.movie.repository.MovieRepository;
import com.cinex.module.movie.repository.MovieRunRepository;
import com.cinex.module.pricing.service.PricingEngine;
import com.cinex.module.room.entity.Room;
import com.cinex.module.room.entity.RoomType;
import com.cinex.module.room.repository.RoomRepository;
import com.cinex.module.booking.entity.BookingStatus;
import com.cinex.module.booking.repository.BookingRepository;
import com.cinex.module.booking.repository.BookingSeatRepository;
import com.cinex.module.seat.entity.SeatStatus;
import com.cinex.module.seat.entity.SeatType;
import com.cinex.module.seat.repository.SeatRepository;
import com.cinex.module.showtime.dto.AppliedPricingRule;
import com.cinex.module.showtime.dto.ShowtimeFilter;
import com.cinex.module.showtime.dto.ShowtimeListResponse;
import com.cinex.module.showtime.dto.ShowtimeRequest;
import com.cinex.module.showtime.dto.ShowtimeResponse;
import com.cinex.module.showtime.entity.Showtime;
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
import java.util.EnumSet;
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
    private final ShowtimeMapper showtimeMapper;
    private final SystemConfigService systemConfigService;
    private final com.cinex.common.service.SecurityService securityService;
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
        return base.toBuilder()
                .effectiveBasePrice(applyModifiersNullable(base.getBasePrice(), start, theaterId))
                .effectiveVipPrice(applyModifiersNullable(base.getVipPrice(), start, theaterId))
                .effectiveCouplePrice(applyModifiersNullable(base.getCouplePrice(), start, theaterId))
                .effectiveSweetboxPrice(applyModifiersNullable(base.getSweetboxPrice(), start, theaterId))
                .effectiveDeluxePrice(applyModifiersNullable(base.getDeluxePrice(), start, theaterId))
                .appliedRules(applied)
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
        showtime.setStorageState(StorageState.ARCHIVED);
        showtimeRepository.save(showtime);
        log.info("Soft deleted showtime {}", id);
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
     *   <li>Admin nhập giá → giữ nguyên (kể cả khi phòng tạm chưa có loại ghế đó —
     *       admin có thể chuẩn bị giá trước khi sắp xếp seat layout).</li>
     *   <li>Để trống + phòng KHÔNG có loại ghế tương ứng → trả null
     *       (không lưu giá rác, list trang admin không hiển thị tier này).</li>
     *   <li>Để trống + phòng CÓ loại ghế → auto-fill từ system_config (UX cũ).</li>
     * </ul>
     */
    private BigDecimal resolveTierPrice(BigDecimal input, RoomType roomType, String tier,
                                        Set<SeatType> roomSeatTypes, SeatType requiredType) {
        if (input != null) {
            return input;
        }
        if (!roomSeatTypes.contains(requiredType)) {
            return null;
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
