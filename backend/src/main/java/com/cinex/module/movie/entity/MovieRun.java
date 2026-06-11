package com.cinex.module.movie.entity;

import com.cinex.common.entity.BaseEntity;
import com.cinex.module.theater.entity.Theater;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

/**
 * Entity đợt chiếu của 1 phim — map bảng {@code movie_runs}.
 *
 * <p><b>Bối cảnh refactor:</b> Trước đây Movie có sẵn {@code releaseDate / endDate / status}
 * — pattern "1 phim = 1 vòng đời". Pattern này không mô tả được scenario thực tế ở rạp:
 * <ul>
 *   <li>Phim chiếu lại sau nhiều năm (Avatar 4K Remaster, Titanic 25th anniversary)</li>
 *   <li>Chiếu festival xen kẽ với chiếu thương mại</li>
 *   <li>Sneak preview trước release date chính thức</li>
 * </ul>
 *
 * <p><b>Pattern mới:</b> Movie giữ metadata bất biến (title, duration, director, genres ...),
 * còn {@link MovieRun} mô tả mỗi đợt chiếu cụ thể với khoảng thời gian + loại + status riêng.
 * 1 movie ↔ N runs.
 *
 * <p><b>Lưu ý commit 1:</b> Showtime tạm thời vẫn giữ FK {@code movie_id} (NULLABLE) để
 * backward-compatible. {@code movie_run_id} đã được thêm + backfill. Commit 2 sẽ NOT NULL +
 * drop {@code movie_id} sau khi verify.
 */
@Entity
@Table(
        name = "movie_runs",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_movie_run_movie_theater_start_type",
                columnNames = {"movie_id", "theater_id", "start_date", "run_type"}
        )
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MovieRun extends BaseEntity {

    /**
     * Phim mà đợt chiếu này thuộc về. Nhiều run ↔ 1 movie (cho re-release).
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "movie_id", nullable = false)
    private Movie movie;

    /**
     * Chi nhánh sở hữu đợt chiếu — mỗi rạp tự quyết startDate/endDate cho 1 phim.
     * Pattern Vista FilmAtSite: mỗi (movie, theater) là 1 commitment riêng.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "theater_id", nullable = false)
    private Theater theater;

    /**
     * Ngày bắt đầu đợt chiếu (Release Date). Trước ngày này → status SCHEDULED.
     * NOT NULL — rạp luôn công bố startDate trước khi mở bán (marketing dùng).
     */
    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    /**
     * Ngày kết thúc đợt chiếu (open-ended pattern).
     *
     * <p><b>NULLABLE — design theo chuẩn rạp chiếu hiện nay (CGV/Lotte/BHD):</b>
     * <ul>
     *   <li>{@code null}: đợt chiếu open-ended, chưa quyết định ngày ngưng. Phim chiếu cho đến
     *       khi rạp set endDate (vé tốt → extend; ế → admin set ngày ngưng).</li>
     *   <li>{@code != null}: rạp đã quyết ngày ngưng chiếu. Sau ngày này → status ENDED.</li>
     * </ul>
     *
     * <p>Lý do bỏ NOT NULL: trước đây bắt admin nhập endDate khi tạo run → sai thực tế.
     * Rạp KHÔNG bao giờ biết trước phim chiếu được bao lâu.
     */
    @Column(name = "end_date")
    private LocalDate endDate;

    /**
     * Loại đợt chiếu — phân biệt khi 1 phim có nhiều đợt.
     * FIRST_RUN: chiếu lần đầu (mặc định)
     * REISSUE: chiếu lại (4K remaster, special edition, kỷ niệm)
     * FESTIVAL: chiếu trong festival/sự kiện
     * SPECIAL: chiếu đặc biệt (sneak peek, preview, ...)
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "run_type", nullable = false, length = 20)
    @Builder.Default
    private MovieRunType runType = MovieRunType.FIRST_RUN;

    /**
     * Trạng thái đợt chiếu. Auto-update bởi MovieRunStatusScheduler (sẽ làm ở C3).
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private MovieRunStatus status = MovieRunStatus.SCHEDULED;

    /**
     * Ghi chú nội bộ (vd: "Bản 4K remaster kỷ niệm 17 năm").
     */
    @Column(length = 500)
    private String notes;
}
