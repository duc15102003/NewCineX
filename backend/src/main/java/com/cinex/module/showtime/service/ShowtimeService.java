package com.cinex.module.showtime.service;

import com.cinex.common.entity.StorageState;
import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.module.config.service.SystemConfigService;
import com.cinex.module.movie.entity.Movie;
import com.cinex.module.movie.repository.MovieRepository;
import com.cinex.module.room.entity.Room;
import com.cinex.module.room.repository.RoomRepository;
import com.cinex.module.booking.entity.BookingStatus;
import com.cinex.module.booking.repository.BookingRepository;
import com.cinex.module.booking.repository.BookingSeatRepository;
import com.cinex.module.seat.repository.SeatRepository;
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

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class ShowtimeService {

    private final ShowtimeRepository showtimeRepository;
    private final MovieRepository movieRepository;
    private final RoomRepository roomRepository;
    private final SeatRepository seatRepository;
    private final BookingRepository bookingRepository;
    private final BookingSeatRepository bookingSeatRepository;
    private final ShowtimeMapper showtimeMapper;
    private final SystemConfigService systemConfigService;

    @Transactional(readOnly = true)
    public Page<ShowtimeListResponse> listShowtimes(ShowtimeFilter filter, Pageable pageable) {
        var spec = ShowtimeSpecification.fromFilter(filter);
        return showtimeRepository.findAll(spec, pageable)
                .map(showtimeMapper::toListResponse);
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

        return ShowtimeResponse.builder()
                .id(response.getId())
                .storageState(response.getStorageState())
                .movieId(response.getMovieId())
                .movieTitle(response.getMovieTitle())
                .moviePosterUrl(response.getMoviePosterUrl())
                .movieDuration(response.getMovieDuration())
                .roomId(response.getRoomId())
                .roomName(response.getRoomName())
                .roomType(response.getRoomType())
                .startTime(response.getStartTime())
                .endTime(response.getEndTime())
                .basePrice(response.getBasePrice())
                .vipPrice(response.getVipPrice())
                .couplePrice(response.getCouplePrice())
                .status(response.getStatus())
                .availableSeats(availableSeats)
                .createdAt(response.getCreatedAt())
                .updatedAt(response.getUpdatedAt())
                .build();
    }

    /**
     * Tạo suất chiếu:
     * 1. Validate: phim + phòng tồn tại
     * 2. Không cho tạo suất trong quá khứ
     * 3. Tính endTime = startTime + movie.duration + buffer (từ SystemConfig)
     * 4. Kiểm tra phòng trống (không trùng giờ với suất khác)
     * 5. Save
     */
    @Transactional
    public ShowtimeResponse createShowtime(ShowtimeRequest request) {
        Movie movie = movieRepository.findById(request.getMovieId())
                .orElseThrow(() -> new BusinessException(ErrorCode.MOVIE_NOT_FOUND));
        Room room = roomRepository.findById(request.getRoomId())
                .orElseThrow(() -> new BusinessException(ErrorCode.ROOM_NOT_FOUND));

        // Không cho tạo suất trong quá khứ
        if (request.getStartTime().isBefore(LocalDateTime.now())) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Không thể tạo suất chiếu trong quá khứ");
        }

        // Tính endTime = startTime + duration + buffer
        int bufferMinutes = systemConfigService.getInt("showtime.buffer_minutes", 15);
        LocalDateTime endTime = request.getStartTime()
                .plusMinutes(movie.getDuration())
                .plusMinutes(bufferMinutes);

        // Validate giá: thường <= VIP <= đôi
        validatePriceHierarchy(request);

        // Kiểm tra phòng trống
        List<Showtime> conflicts = showtimeRepository.findConflictingShowtimes(
                room.getId(), request.getStartTime(), endTime);
        if (!conflicts.isEmpty()) {
            throw new BusinessException(ErrorCode.SHOWTIME_CONFLICT,
                    "Phòng '" + room.getName() + "' đã có suất chiếu trong khung giờ này");
        }

        Showtime showtime = Showtime.builder()
                .movie(movie)
                .room(room)
                .startTime(request.getStartTime())
                .endTime(endTime)
                .basePrice(request.getBasePrice())
                .vipPrice(request.getVipPrice())
                .couplePrice(request.getCouplePrice())
                .status(ShowtimeStatus.SCHEDULED)
                .build();

        showtimeRepository.save(showtime);
        log.info("Created showtime: {} at {} in {}", movie.getTitle(), request.getStartTime(), room.getName());
        return getShowtime(showtime.getId());
    }

    @Transactional
    public ShowtimeResponse updateShowtime(Long id, ShowtimeRequest request) {
        Showtime showtime = showtimeRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.SHOWTIME_NOT_FOUND));

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

        int bufferMinutes = systemConfigService.getInt("showtime.buffer_minutes", 15);
        LocalDateTime endTime = request.getStartTime()
                .plusMinutes(movie.getDuration())
                .plusMinutes(bufferMinutes);

        // Validate giá: thường <= VIP <= đôi
        validatePriceHierarchy(request);

        // Kiểm tra trùng giờ (loại trừ chính nó)
        List<Showtime> conflicts = showtimeRepository.findConflictingShowtimes(
                room.getId(), request.getStartTime(), endTime);
        conflicts.removeIf(s -> s.getId().equals(id));
        if (!conflicts.isEmpty()) {
            throw new BusinessException(ErrorCode.SHOWTIME_CONFLICT,
                    "Phòng '" + room.getName() + "' đã có suất chiếu trong khung giờ này");
        }

        showtime.setMovie(movie);
        showtime.setRoom(room);
        showtime.setStartTime(request.getStartTime());
        showtime.setEndTime(endTime);
        showtime.setBasePrice(request.getBasePrice());
        showtime.setVipPrice(request.getVipPrice());
        showtime.setCouplePrice(request.getCouplePrice());

        showtimeRepository.save(showtime);
        log.info("Updated showtime {}", id);
        return getShowtime(id);
    }

    @Transactional
    public void deleteShowtime(Long id) {
        Showtime showtime = showtimeRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.SHOWTIME_NOT_FOUND));
        showtime.setStorageState(StorageState.ARCHIVED);
        showtimeRepository.save(showtime);
        log.info("Soft deleted showtime {}", id);
    }

    @Transactional
    public ShowtimeResponse restoreShowtime(Long id) {
        Showtime showtime = showtimeRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.SHOWTIME_NOT_FOUND));
        showtime.setStorageState(StorageState.ACTIVE);
        showtimeRepository.save(showtime);
        log.info("Restored showtime {}", id);
        return getShowtime(id);
    }

    @Transactional
    public void bulkDelete(List<Long> ids) {
        List<Showtime> showtimes = showtimeRepository.findAllById(ids);
        showtimes.forEach(s -> s.setStorageState(StorageState.ARCHIVED));
        showtimeRepository.saveAll(showtimes);
        log.info("Bulk soft deleted {} showtimes", showtimes.size());
    }

    @Transactional
    public void bulkRestore(List<Long> ids) {
        List<Showtime> items = showtimeRepository.findAllById(ids);
        items.forEach(i -> i.setStorageState(StorageState.ACTIVE));
        showtimeRepository.saveAll(items);
        log.info("Bulk restored {} items", items.size());
    }

    /**
     * Validate thứ tự giá ghế: thường <= VIP <= đôi.
     * Business rule: ghế đôi luôn đắt nhất (2 người ngồi), VIP đắt hơn thường.
     */
    private void validatePriceHierarchy(ShowtimeRequest request) {
        var base = request.getBasePrice();
        var vip = request.getVipPrice();
        var couple = request.getCouplePrice();

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
    }
}
