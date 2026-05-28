package com.cinex.module.review.repository;

import com.cinex.common.entity.StorageState;
import com.cinex.module.review.entity.Review;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

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
     * WHERE storageState <> 'DELETED': chỉ tính review chưa bị xóa.
     */
    @Query("SELECT COALESCE(AVG(CAST(r.rating AS double)), 0) FROM Review r WHERE r.movie.id = :movieId AND r.storageState <> com.cinex.common.entity.StorageState.ARCHIVED")
    Double getAverageRatingByMovieId(Long movieId);
}
