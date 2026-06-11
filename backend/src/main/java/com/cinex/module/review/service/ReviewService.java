package com.cinex.module.review.service;

import com.cinex.common.entity.StorageState;
import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.common.util.SecurityUtil;
import com.cinex.module.auth.entity.User;
import com.cinex.module.auth.repository.UserRepository;
import com.cinex.module.booking.entity.BookingStatus;
import com.cinex.module.booking.repository.BookingRepository;
import com.cinex.module.movie.entity.Movie;
import com.cinex.module.movie.repository.MovieRepository;
import com.cinex.module.review.dto.ReviewFilter;
import com.cinex.module.review.dto.ReviewRequest;
import com.cinex.module.review.dto.ReviewResponse;
import com.cinex.module.review.entity.Review;
import com.cinex.module.review.mapper.ReviewMapper;
import com.cinex.module.review.repository.ReviewRepository;
import com.cinex.module.review.specification.ReviewSpecification;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Service
@RequiredArgsConstructor
@Slf4j
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final MovieRepository movieRepository;
    private final UserRepository userRepository;
    private final BookingRepository bookingRepository;
    private final ReviewMapper reviewMapper;

    /**
     * Lấy danh sách review theo filter + phân trang.
     *
     * [Specification Pattern] Filter DTO → Specification → findAll(spec, pageable)
     * Thêm tiêu chí lọc mới: chỉ cần thêm field vào ReviewFilter + thêm if trong ReviewSpecification.
     */
    @Transactional(readOnly = true)
    public Page<ReviewResponse> listReviews(ReviewFilter filter, Pageable pageable) {
        var spec = ReviewSpecification.fromFilter(filter);
        return reviewRepository.findAll(spec, pageable)
                .map(reviewMapper::toResponse);
    }

    /**
     * Tạo review mới cho phim.
     *
     * Business rules:
     * 1. Phim phải tồn tại (không bị xóa)
     * 2. User đã thực sự xem phim (có booking CHECKED_IN)
     * 3. User chưa từng review phim này (1 user 1 phim = 1 review)
     * 4. Sau khi save → cập nhật rating trung bình theo công thức incremental
     */
    @Transactional
    public ReviewResponse createReview(Long userId, Long movieId, ReviewRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        Movie movie = movieRepository.findById(movieId)
                .orElseThrow(() -> new BusinessException(ErrorCode.MOVIE_NOT_FOUND));

        // Business rule: User phải có ít nhất 1 booking CHECKED_IN cho phim này
        // → Đảm bảo chỉ người đã thực sự xem phim mới được đánh giá (chống review giả/spam)
        boolean hasWatched = bookingRepository.existsByUserIdAndShowtime_Movie_IdAndStatus(
                userId, movieId, BookingStatus.CHECKED_IN);
        if (!hasWatched) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST,
                    "Bạn cần xem phim trước khi đánh giá");
        }

        // Business rule: 1 user chỉ được review 1 phim 1 lần (chưa bị ARCHIVED)
        if (reviewRepository.existsByUserIdAndMovieIdAndStorageStateNot(userId, movieId, StorageState.ARCHIVED)) {
            throw new BusinessException(ErrorCode.REVIEW_EXISTED, "Bạn đã đánh giá phim này rồi");
        }

        Review review = Review.builder()
                .user(user)
                .movie(movie)
                .rating(request.getRating())
                .comment(request.getComment())
                .build();

        reviewRepository.save(review);
        log.info("User {} created review for movie {}: rating={}", user.getUsername(), movie.getTitle(), request.getRating());

        // [Incremental] add: newAvg = (oldAvg * count + newRating) / (count + 1)
        applyRatingAdd(movie, BigDecimal.valueOf(request.getRating()));

        return reviewMapper.toResponse(review);
    }

    /**
     * Cập nhật nội dung review (chỉ chủ sở hữu).
     */
    @Transactional
    public ReviewResponse updateReview(Long userId, Long reviewId, ReviewRequest request) {
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new BusinessException(ErrorCode.REVIEW_NOT_FOUND));

        if (!review.getUser().getId().equals(userId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Bạn chỉ có thể chỉnh sửa đánh giá của mình");
        }

        // Lưu lại rating cũ TRƯỚC khi setRating mới — dùng cho công thức incremental.
        BigDecimal oldRating = BigDecimal.valueOf(review.getRating());
        BigDecimal newRating = BigDecimal.valueOf(request.getRating());

        review.setRating(request.getRating());
        review.setComment(request.getComment());
        reviewRepository.save(review);

        log.info("User {} updated review {} for movie {} ({} -> {})",
                userId, reviewId, review.getMovie().getTitle(), oldRating, newRating);

        // [Incremental] update: newAvg = (oldAvg * count - oldRating + newRating) / count
        applyRatingUpdate(review.getMovie(), oldRating, newRating);

        return reviewMapper.toResponse(review);
    }

    /**
     * Xóa mềm review.
     *
     * Ownership + Admin override:
     * - Chủ review: luôn được xóa review của mình
     * - Admin: được xóa bất kỳ review nào (kiểm duyệt nội dung)
     * - Còn lại: FORBIDDEN
     */
    @Transactional
    public void deleteReview(Long userId, Long reviewId) {
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new BusinessException(ErrorCode.REVIEW_NOT_FOUND));

        boolean isOwner = review.getUser().getId().equals(userId);
        boolean isAdmin = SecurityUtil.hasRole("ADMIN");

        if (!isOwner && !isAdmin) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Bạn chỉ có thể xóa đánh giá của mình");
        }

        BigDecimal oldRating = BigDecimal.valueOf(review.getRating());

        // [Soft Delete Pattern] Không DELETE thật — đặt storageState = ARCHIVED
        review.setStorageState(StorageState.ARCHIVED);
        reviewRepository.save(review);

        log.info("Review {} soft-deleted by user {} (isAdmin={})", reviewId, userId, isAdmin);

        // [Incremental] delete: newAvg = (oldAvg * count - oldRating) / (count - 1)
        // → nếu count - 1 = 0 → rating = null
        applyRatingDelete(review.getMovie(), oldRating);
    }

    /**
     * Khôi phục review đã xóa mềm (admin moderation flow).
     *
     * <p>Symmetric với deleteReview: flip ARCHIVED → ACTIVE và cộng lại rating
     * vào movie.rating bằng cùng công thức incremental như khi tạo review mới.
     */
    @Transactional
    public void restoreReview(Long userId, Long reviewId) {
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new BusinessException(ErrorCode.REVIEW_NOT_FOUND));

        boolean isOwner = review.getUser().getId().equals(userId);
        boolean isAdmin = SecurityUtil.hasRole("ADMIN");
        if (!isOwner && !isAdmin) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Bạn chỉ có thể khôi phục đánh giá của mình");
        }

        if (review.getStorageState() != StorageState.ARCHIVED) {
            // Idempotent: gọi restore lên review chưa archive → no-op
            return;
        }

        review.setStorageState(StorageState.ACTIVE);
        reviewRepository.save(review);

        // Add lại rating vào aggregate movie
        applyRatingAdd(review.getMovie(), BigDecimal.valueOf(review.getRating()));

        log.info("Review {} restored by user {} (isAdmin={})", reviewId, userId, isAdmin);
    }

    // ===== Incremental rating helpers =====

    /**
     * Cộng thêm 1 review vào rating phim (gọi khi createReview).
     *
     * <p>Công thức: {@code newAvg = (oldAvg * count + newRating) / (count + 1)}.
     * Trường hợp đặc biệt count = 0 (review đầu tiên) → newAvg = newRating.
     */
    private void applyRatingAdd(Movie movie, BigDecimal newRating) {
        int count = movie.getRatingCount() == null ? 0 : movie.getRatingCount();
        BigDecimal oldAvg = movie.getRating() == null ? BigDecimal.ZERO : movie.getRating();

        BigDecimal numerator = oldAvg.multiply(BigDecimal.valueOf(count)).add(newRating);
        BigDecimal newAvg = numerator.divide(BigDecimal.valueOf(count + 1L), 1, RoundingMode.HALF_UP);

        movie.setRating(newAvg);
        movie.setRatingCount(count + 1);
        movieRepository.save(movie);

        log.info("Movie {} rating add → {} ({} reviews)", movie.getTitle(), movie.getRating(), movie.getRatingCount());
    }

    /**
     * Cập nhật rating khi 1 review đổi điểm (gọi khi updateReview).
     *
     * <p>Công thức: {@code newAvg = (oldAvg * count - oldRating + newRating) / count}.
     * Count không đổi.
     */
    private void applyRatingUpdate(Movie movie, BigDecimal oldRating, BigDecimal newRating) {
        int count = movie.getRatingCount() == null ? 0 : movie.getRatingCount();

        // Bảo vệ: nếu count = 0 mà gọi update (lý ra không xảy ra) → recompute từ AVG để tránh chia 0
        if (count <= 0) {
            recomputeFromScratch(movie);
            return;
        }

        BigDecimal oldAvg = movie.getRating() == null ? BigDecimal.ZERO : movie.getRating();
        BigDecimal numerator = oldAvg.multiply(BigDecimal.valueOf(count)).subtract(oldRating).add(newRating);
        BigDecimal newAvg = numerator.divide(BigDecimal.valueOf(count), 1, RoundingMode.HALF_UP);

        movie.setRating(newAvg);
        movieRepository.save(movie);

        log.info("Movie {} rating update → {} ({} reviews)", movie.getTitle(), movie.getRating(), count);
    }

    /**
     * Trừ 1 review khỏi rating phim (gọi khi deleteReview).
     *
     * <p>Công thức: {@code newAvg = (oldAvg * count - oldRating) / (count - 1)}.
     * Edge case count - 1 = 0 → không còn review nào → rating = null.
     */
    private void applyRatingDelete(Movie movie, BigDecimal oldRating) {
        int count = movie.getRatingCount() == null ? 0 : movie.getRatingCount();

        // Bảo vệ: count = 0 mà gọi delete → state không nhất quán, recompute để self-heal
        if (count <= 0) {
            recomputeFromScratch(movie);
            return;
        }

        if (count == 1) {
            // Review cuối cùng bị xóa → rating về null, count về 0
            movie.setRating(null);
            movie.setRatingCount(0);
        } else {
            BigDecimal oldAvg = movie.getRating() == null ? BigDecimal.ZERO : movie.getRating();
            BigDecimal numerator = oldAvg.multiply(BigDecimal.valueOf(count)).subtract(oldRating);
            BigDecimal newAvg = numerator.divide(BigDecimal.valueOf(count - 1L), 1, RoundingMode.HALF_UP);

            movie.setRating(newAvg);
            movie.setRatingCount(count - 1);
        }
        movieRepository.save(movie);

        log.info("Movie {} rating delete → {} ({} reviews)", movie.getTitle(), movie.getRating(), movie.getRatingCount());
    }

    /**
     * Fallback khi state không nhất quán (rating_count = 0 nhưng vẫn còn review trong DB,
     * hoặc dữ liệu cũ chưa được backfill). Tính lại từ AVG + COUNT thực tế.
     *
     * <p>KHÔNG nên gọi thường xuyên vì là query nặng — chỉ là safety net.
     */
    private void recomputeFromScratch(Movie movie) {
        Double avg = reviewRepository.getAverageRatingByMovieId(movie.getId());
        long cnt = reviewRepository.countByMovieIdAndStorageStateNot(movie.getId(), StorageState.ARCHIVED);

        if (cnt == 0 || avg == null) {
            movie.setRating(null);
            movie.setRatingCount(0);
        } else {
            movie.setRating(BigDecimal.valueOf(avg).setScale(1, RoundingMode.HALF_UP));
            movie.setRatingCount((int) cnt);
        }
        movieRepository.save(movie);
        log.warn("Movie {} rating recomputed from scratch → {} ({} reviews)",
                movie.getTitle(), movie.getRating(), movie.getRatingCount());
    }
}
