package com.cinex.module.movie.service;

import com.cinex.common.entity.StorageState;
import com.cinex.module.movie.entity.MovieRun;
import com.cinex.module.movie.entity.MovieRunStatus;
import com.cinex.module.movie.repository.MovieRunRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/**
 * [Scheduled Task] Tự động chuyển {@link MovieRunStatus} theo ngày.
 *
 * <p><b>Single source of truth (sau refactor "bỏ Movie.status field"):</b> scheduler chỉ
 * cập nhật lifecycle của MovieRun. KHÔNG còn cache Movie.status — effectiveStatus của phim
 * được compute on-the-fly tại {@code MovieStatusComputer} dựa trên list MovieRun + theaterId.
 *
 * <p>Lifecycle 1 run:
 * <pre>
 *   today &lt; startDate                      → SCHEDULED
 *   startDate &lt;= today &lt;= endDate          → NOW_SHOWING
 *   today &gt; endDate                        → ENDED
 * </pre>
 *
 * <p><b>Vì sao 1 ngày 1 lần lúc 00:01?</b>
 * <ul>
 *   <li>startDate / endDate có độ phân giải NGÀY (LocalDate) — không cần chạy mỗi phút</li>
 *   <li>00:01 tránh contention với job khác hay chạy đúng nửa đêm; trễ 1 phút không ảnh hưởng UX</li>
 * </ul>
 *
 * <p><b>Vì sao @Transactional?</b> Update batch trong 1 tx. Nếu 1 run lỗi giữa chừng → rollback
 * toàn bộ batch, không để DB nửa vời.
 *
 * <p><b>Vì sao @SchedulerLock?</b> Khi chạy nhiều instance backend (HA), chỉ 1 instance được chạy
 * job tại 1 thời điểm — tránh double-update + race condition trên cùng row.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class MovieRunStatusScheduler {

    private final MovieRunRepository movieRunRepository;

    @Scheduled(cron = "0 1 0 * * *")
    @SchedulerLock(name = "movieRunStatusUpdate", lockAtLeastFor = "PT1M", lockAtMostFor = "PT10M")
    @Transactional
    public void updateMovieRunStatus() {
        LocalDate today = LocalDate.now();

        // 1. SCHEDULED → NOW_SHOWING khi today >= startDate (chỉ run chưa archive)
        List<MovieRun> toStart = movieRunRepository
                .findByStatusAndStartDateLessThanEqualAndStorageStateNot(
                        MovieRunStatus.SCHEDULED, today, StorageState.ARCHIVED);
        for (MovieRun run : toStart) {
            // Edge case 1: run có startDate=today VÀ endDate<today (data lỗi nhập tay)
            //   → bỏ qua, để bước 2 chuyển thẳng sang ENDED.
            // Edge case 2: endDate null (open-ended) → luôn chuyển sang NOW_SHOWING.
            if (run.getEndDate() == null || !today.isAfter(run.getEndDate())) {
                run.setStatus(MovieRunStatus.NOW_SHOWING);
            }
        }
        if (!toStart.isEmpty()) {
            log.info("[MovieRunStatusScheduler] {} đợt chiếu SCHEDULED → NOW_SHOWING: {}",
                    toStart.size(),
                    toStart.stream()
                            .map(r -> r.getMovie().getTitle() + "#" + r.getId())
                            .toList());
        }

        // 2. NOW_SHOWING → ENDED khi today > endDate (chỉ run chưa archive)
        List<MovieRun> toEnd = movieRunRepository
                .findByStatusAndEndDateLessThanAndStorageStateNot(
                        MovieRunStatus.NOW_SHOWING, today, StorageState.ARCHIVED);
        for (MovieRun run : toEnd) {
            run.setStatus(MovieRunStatus.ENDED);
        }
        if (!toEnd.isEmpty()) {
            log.info("[MovieRunStatusScheduler] {} đợt chiếu NOW_SHOWING → ENDED: {}",
                    toEnd.size(),
                    toEnd.stream()
                            .map(r -> r.getMovie().getTitle() + "#" + r.getId())
                            .toList());
        }

        if (toStart.isEmpty() && toEnd.isEmpty()) {
            log.debug("[MovieRunStatusScheduler] Không có đợt chiếu nào cần đổi status hôm nay");
        }
    }
}
