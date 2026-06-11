package com.cinex.module.showtime.entity;

import com.cinex.common.entity.BaseEntity;
import com.cinex.module.movie.entity.Movie;
import com.cinex.module.movie.entity.MovieRun;
import com.cinex.module.room.entity.Room;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "showtimes")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Showtime extends BaseEntity {

    /**
     * Phim của suất chiếu — DENORMALIZED.
     *
     * <p><b>Refactor C2:</b> Sau khi tách Movie → Movie + MovieRun, field này về mặt
     * ngữ nghĩa chỉ là cache của {@code movieRun.getMovie()} (transitive: showtime → run → movie).
     *
     * <p><b>Tại sao GIỮ?</b>
     * <ul>
     *   <li>Backward-compat: rất nhiều query/report join showtimes → movies trực tiếp (statistics,
     *       filter theo movie, mapper, specification ...). Drop bây giờ sẽ break diện rộng.</li>
     *   <li>Tối ưu query: tránh JOIN qua movie_runs khi chỉ cần thông tin phim (title/poster ...).</li>
     * </ul>
     *
     * <p><b>Quy tắc bất biến:</b> luôn set {@code showtime.movie == showtime.movieRun.movie}.
     * Không bao giờ set 2 field này khác movie — vì sẽ phá invariant. Service đảm bảo điều này
     * trong {@code createShowtime / updateShowtime}.
     *
     * <p>Có thể drop ở C5 sau khi audit hết các nơi đọc showtime.movie trực tiếp.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "movie_id", nullable = false)
    private Movie movie;

    /**
     * Đợt chiếu mà suất này thuộc về — NGUỒN TRUY VẤN CHÍNH sau refactor C2.
     *
     * <p>Mọi business rule liên quan tới khoảng thời gian phim được chiếu ở rạp đều dựa vào
     * {@code movieRun.startDate / endDate / status} thay vì {@code movie.releaseDate / endDate}
     * (movie level đã deprecated).
     *
     * <p><b>NOT NULL</b> được enforce ở DB qua changeset 052 (sau khi backfill ở 051 đã chạy xong).
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "movie_run_id", nullable = false)
    private MovieRun movieRun;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

    @Column(name = "start_time", nullable = false)
    private LocalDateTime startTime;

    /**
     * Thời điểm phim kết thúc thật (= startTime + movie.duration).
     * Đây là endTime hiển thị cho user (vé, lịch chiếu).
     * KHÔNG bao gồm buffer dọn dẹp — user xem phim 2h sẽ thấy endTime - startTime = 2h.
     */
    @Column(name = "end_time", nullable = false)
    private LocalDateTime endTime;

    /**
     * Thời điểm kết thúc slot bao gồm buffer dọn dẹp (= endTime + showtime.buffer_minutes).
     * Dùng cho conflict check (room phải free đến slotEndTime), KHÔNG hiển thị cho user.
     * Tách khỏi endTime để báo cáo/statistics không bị lệch bởi buffer.
     */
    @Column(name = "slot_end_time", nullable = false)
    private LocalDateTime slotEndTime;

    @Column(name = "base_price", nullable = false, precision = 12, scale = 0)
    private BigDecimal basePrice;

    @Column(name = "vip_price", nullable = false, precision = 12, scale = 0)
    private BigDecimal vipPrice;

    @Column(name = "couple_price", nullable = false, precision = 12, scale = 0)
    private BigDecimal couplePrice;

    /**
     * Giá ghế SWEETBOX — nullable. Nếu phòng KHÔNG có sweetbox để NULL.
     * Khi book seat SWEETBOX mà giá NULL → fallback couplePrice × 2.
     */
    @Column(name = "sweetbox_price", precision = 12, scale = 0)
    private BigDecimal sweetboxPrice;

    /**
     * Giá ghế DELUXE (recliner) — nullable cho phòng Premium / L'amour.
     * Fallback vipPrice × 1.5 nếu NULL.
     */
    @Column(name = "deluxe_price", precision = 12, scale = 0)
    private BigDecimal deluxePrice;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private ShowtimeStatus status = ShowtimeStatus.SCHEDULED;
}
