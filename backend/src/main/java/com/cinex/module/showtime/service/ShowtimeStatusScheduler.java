package com.cinex.module.showtime.service;

import com.cinex.module.showtime.entity.Showtime;
import com.cinex.module.showtime.entity.ShowtimeStatus;
import com.cinex.module.showtime.repository.ShowtimeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * [Scheduled Task] Tự động chuyển ShowtimeStatus theo thời gian thực.
 *
 * <p>Vòng đời suất chiếu:
 * <pre>
 *   SCHEDULED --(startTime <= now < endTime)--> ONGOING --(now >= endTime)--> FINISHED
 *                                                                ^
 *                                  Lưu ý: CANCELLED là nhánh manual, không tự động.
 * </pre>
 *
 * <p><b>Tần suất 5 phút:</b> độ phân giải startTime/endTime là phút, không cần
 * chạy mỗi giây. Trễ tối đa ~5 phút giữa thực tế chiếu và status DB là chấp nhận
 * được (UI có thể tự suy ra từ startTime/endTime nếu cần real-time hơn).
 *
 * <p><b>@SchedulerLock</b>: khi deploy multi-instance, chỉ 1 instance chạy update
 * mỗi tick để tránh race UPDATE trên cùng row.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ShowtimeStatusScheduler {

    private final ShowtimeRepository showtimeRepository;

    /**
     * Chạy mỗi 5 phút (300000ms).
     * fixedRate: tính từ thời điểm START của lần chạy trước, không đợi lần trước xong.
     * Nếu lần trước chậm hơn 5p → ShedLock + @Transactional sẽ serialize.
     */
    @Scheduled(fixedRate = 300_000)
    @SchedulerLock(name = "showtimeStatusUpdate", lockAtLeastFor = "PT1M", lockAtMostFor = "PT5M")
    @Transactional
    public void updateShowtimeStatus() {
        LocalDateTime now = LocalDateTime.now();

        // 1. SCHEDULED → ONGOING (đã đến giờ chiếu, chưa kết thúc)
        List<Showtime> toOngoing = showtimeRepository
                .findOngoingCandidates(ShowtimeStatus.SCHEDULED, now);
        toOngoing.forEach(s -> s.setStatus(ShowtimeStatus.ONGOING));
        if (!toOngoing.isEmpty()) {
            log.info("[ShowtimeStatusScheduler] {} suất chuyển SCHEDULED → ONGOING: {}",
                    toOngoing.size(),
                    toOngoing.stream().map(Showtime::getId).toList());
        }

        // 2. ONGOING → FINISHED (đã qua endTime)
        List<Showtime> toFinished = showtimeRepository
                .findFinishedCandidates(ShowtimeStatus.ONGOING, now);
        toFinished.forEach(s -> s.setStatus(ShowtimeStatus.FINISHED));
        if (!toFinished.isEmpty()) {
            log.info("[ShowtimeStatusScheduler] {} suất chuyển ONGOING → FINISHED: {}",
                    toFinished.size(),
                    toFinished.stream().map(Showtime::getId).toList());
        }

        // Edge case: SCHEDULED đã qua endTime (server downtime?) → set thẳng FINISHED
        List<Showtime> missedScheduled = showtimeRepository
                .findFinishedCandidates(ShowtimeStatus.SCHEDULED, now);
        missedScheduled.forEach(s -> s.setStatus(ShowtimeStatus.FINISHED));
        if (!missedScheduled.isEmpty()) {
            log.warn("[ShowtimeStatusScheduler] {} suất SCHEDULED bị trễ → set FINISHED: {}",
                    missedScheduled.size(),
                    missedScheduled.stream().map(Showtime::getId).toList());
        }

        if (toOngoing.isEmpty() && toFinished.isEmpty() && missedScheduled.isEmpty()) {
            log.debug("[ShowtimeStatusScheduler] Không có suất cần đổi status");
        }
    }
}
