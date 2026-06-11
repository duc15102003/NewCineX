package com.cinex.module.review.repository;

import com.cinex.common.entity.StorageState;
import com.cinex.module.review.entity.Review;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReviewRepository extends JpaRepository<Review, Long>, JpaSpecificationExecutor<Review> {

    /**
     * Kiểm tra user đã review phim chưa (chỉ tính review chưa bị xóa).
     *
     * Business rule: 1 user chỉ được review 1 phim 1 lần.
     * Dùng trong createReview() để throw lỗi sớm trước khi save.
     */
    boolean existsByUserIdAndMovieIdAndStorageStateNot(Long userId, Long movieId, StorageState storageState);

    /**
     * Tính điểm trung bình của 1 phim từ tất cả review còn active.
     *
     * COALESCE: trả về 0 thay vì null khi phim chưa có review nào.
     * CAST(r.rating AS double): ép kiểu để AVG tính số thực (không làm tròn thành int).
     * WHERE storageState <> ARCHIVED: chỉ tính review chưa bị xóa (soft-delete).
     */
    @Query("SELECT COALESCE(AVG(CAST(r.rating AS double)), 0) FROM Review r WHERE r.movie.id = :movieId AND r.storageState <> com.cinex.common.entity.StorageState.ARCHIVED")
    Double getAverageRatingByMovieId(Long movieId);

    /**
     * Đếm số review của 1 phim (loại trừ storageState truyền vào — thường là ARCHIVED).
     *
     * <p>Dùng làm safety-net khi rating_count trong Movie không nhất quán
     * (xem {@code ReviewService.recomputeFromScratch}).
     */
    long countByMovieIdAndStorageStateNot(Long movieId, StorageState storageState);

    /**
     * Batch archive (soft-delete) tất cả review của 1 phim.
     *
     * <p>Dùng khi admin archive Movie → cascade archive review để FE không hiển thị
     * "review của phim đã bị xóa".
     *
     * <p>@Modifying @Query: chạy UPDATE thẳng trên DB (1 query), nhanh hơn nhiều
     * so với loadAll → setStorageState → saveAll (N+1 query).
     */
    @Modifying
    @Query("UPDATE Review r SET r.storageState = com.cinex.common.entity.StorageState.ARCHIVED " +
            "WHERE r.movie.id = :movieId AND r.storageState <> com.cinex.common.entity.StorageState.ARCHIVED")
    int archiveByMovieId(@Param("movieId") Long movieId);

    /**
     * Reverse của {@link #archiveByMovieId(Long)} — khi admin restore Movie.
     * Chỉ unarchive review đang ARCHIVED (tránh ghi đè review user xóa tay).
     */
    @Modifying
    @Query("UPDATE Review r SET r.storageState = com.cinex.common.entity.StorageState.ACTIVE " +
            "WHERE r.movie.id = :movieId AND r.storageState = com.cinex.common.entity.StorageState.ARCHIVED")
    int unarchiveByMovieId(@Param("movieId") Long movieId);
}
