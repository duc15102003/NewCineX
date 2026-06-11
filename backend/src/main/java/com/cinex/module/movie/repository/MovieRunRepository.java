package com.cinex.module.movie.repository;

import com.cinex.common.entity.StorageState;
import com.cinex.module.movie.entity.MovieRun;
import com.cinex.module.movie.entity.MovieRunStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

/**
 * Repository cho {@link MovieRun}.
 *
 * <p>[Specification Pattern] extends {@link JpaSpecificationExecutor} để hỗ trợ query động
 * (filter theo movie / status / runType / khoảng ngày — sẽ dùng ở commit 4 khi viết
 * MovieRunService + admin API).
 */
public interface MovieRunRepository extends JpaRepository<MovieRun, Long>, JpaSpecificationExecutor<MovieRun> {

    /**
     * Lấy tất cả run của 1 movie (loại trừ run ở storageState đã cho — thường là ARCHIVED),
     * sắp xếp theo {@code startDate} giảm dần (run mới nhất ở đầu).
     *
     * <p>Dùng cho trang chi tiết phim: hiển thị lịch sử các đợt chiếu (FIRST_RUN, REISSUE ...).
     */
    List<MovieRun> findByMovieIdAndStorageStateNotOrderByStartDateDesc(Long movieId, StorageState state);

    /**
     * Tìm các run đang ở {@code status} cho trước và đã đến/qua {@code startDate},
     * loại trừ run đã archive.
     * Dùng bởi {@code MovieRunStatusScheduler} (commit 3) để chuyển SCHEDULED → NOW_SHOWING.
     *
     * <p><b>Vì sao thêm storageState filter?</b> Trước đây query không filter, scheduler load
     * cả run ARCHIVED lên đổi status — vô nghĩa nghiệp vụ + tăng version + log noise.
     * Soft-delete consistency: mọi background job phải tôn trọng ARCHIVED.
     */
    List<MovieRun> findByStatusAndStartDateLessThanEqualAndStorageStateNot(
            MovieRunStatus status, LocalDate date, StorageState excludeState);

    /**
     * Tìm các run đang ở {@code status} cho trước và đã qua {@code endDate}, loại trừ ARCHIVED.
     * Dùng bởi {@code MovieRunStatusScheduler} (commit 3) để chuyển NOW_SHOWING → ENDED.
     */
    List<MovieRun> findByStatusAndEndDateLessThanAndStorageStateNot(
            MovieRunStatus status, LocalDate date, StorageState excludeState);

    /**
     * Lấy tất cả run của 1 movie không bị archive, sort theo startDate DESC (mới nhất trước).
     *
     * <p>Dùng ở MovieRunStatusScheduler để recompute {@link com.cinex.module.movie.entity.MovieStatus}
     * tổng kết của Movie cha (Option B): nhìn vào danh sách run hiện tại của movie để chọn 1 status.
     */
    List<MovieRun> findByMovieIdAndStorageStateNot(Long movieId, StorageState state);

    /** List run của 1 movie tại 1 theater cụ thể — dùng cho overlap check + resolveMovieRun. */
    List<MovieRun> findByMovieIdAndTheaterIdAndStorageStateNot(
            Long movieId, Long theaterId, StorageState state);

    /** List run của 1 movie tại 1 theater, sort startDate DESC — dùng cho ShowtimeService. */
    List<MovieRun> findByMovieIdAndTheaterIdAndStorageStateNotOrderByStartDateDesc(
            Long movieId, Long theaterId, StorageState state);

    /**
     * Cascade archive tất cả MovieRun của 1 movie — gọi khi {@code MovieService.deleteMovie}.
     * Trả về số row bị archive (để log).
     *
     * <p>Dùng JPQL UPDATE thay vì load + setStorageState + save: nhanh hơn (1 query duy nhất),
     * không cần load entity vào memory. Đánh đổi: không kích hoạt {@code @PreUpdate} listener,
     * KHÔNG bump version. Chấp nhận được với soft delete cascade.
     *
     * <p><b>QUAN TRỌNG:</b> {@code @Modifying(clearAutomatically = true)} để clear persistence
     * context — tránh entity stale trong cùng transaction (ví dụ sau khi archive, gọi
     * findById vẫn trả storageState cũ vì 1st level cache).
     *
     * <p>Pass {@code StorageState.ARCHIVED} qua parameter để dependency
     * (enum class) stay ở Java import — không hardcode FQCN trong JPQL.
     */
    @Modifying(clearAutomatically = true)
    @Query("UPDATE MovieRun r SET r.storageState = :archived " +
            "WHERE r.movie.id = :movieId " +
            "AND (r.storageState IS NULL OR r.storageState <> :archived)")
    int archiveByMovieId(@Param("movieId") Long movieId, @Param("archived") StorageState archived);
}
