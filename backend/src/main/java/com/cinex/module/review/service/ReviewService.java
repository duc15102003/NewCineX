package com.cinex.module.review.service;

import com.cinex.common.entity.StorageState;
import com.cinex.common.exception.BusinessException;
import com.cinex.common.exception.ErrorCode;
import com.cinex.common.util.SecurityUtil;
import com.cinex.module.auth.entity.User;
import com.cinex.module.auth.repository.UserRepository;
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
     * 2. User chưa từng review phim này (1 user 1 phim = 1 review)
     * 3. Sau khi save → cập nhật rating trung bình của phim
     */
    @Transactional
    public ReviewResponse createReview(Long userId, Long movieId, ReviewRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        Movie movie = movieRepository.findById(movieId)
                .orElseThrow(() -> new BusinessException(ErrorCode.MOVIE_NOT_FOUND));

        // Business rule: 1 user chỉ được review 1 phim 1 lần
        // Kiểm tra review chưa bị soft-delete (DELETED không tính là đã review)
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

        // Cập nhật điểm trung bình phim sau mỗi review mới
        updateMovieRating(movieId);

        return reviewMapper.toResponse(review);
    }

    /**
     * Cập nhật nội dung review (chỉ chủ sở hữu).
     *
     * Ownership check: review.getUser().getId() == userId
     * Sau khi update → cập nhật lại rating trung bình phim.
     */
    @Transactional
    public ReviewResponse updateReview(Long userId, Long reviewId, ReviewRequest request) {
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new BusinessException(ErrorCode.REVIEW_NOT_FOUND));

        // Kiểm tra quyền: chỉ chủ review mới được sửa
        if (!review.getUser().getId().equals(userId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Bạn chỉ có thể chỉnh sửa đánh giá của mình");
        }

        review.setRating(request.getRating());
        review.setComment(request.getComment());
        reviewRepository.save(review);

        log.info("User {} updated review {} for movie {}", userId, reviewId, review.getMovie().getTitle());

        // Cập nhật điểm trung bình phim sau khi rating thay đổi
        updateMovieRating(review.getMovie().getId());

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

        // Business rule: chủ review hoặc admin mới được xóa
        boolean isOwner = review.getUser().getId().equals(userId);
        boolean isAdmin = SecurityUtil.hasRole("ADMIN");

        if (!isOwner && !isAdmin) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Bạn chỉ có thể xóa đánh giá của mình");
        }

        // [Soft Delete Pattern] Không DELETE thật — đặt storageState = DELETED
        // → Dữ liệu vẫn còn trong DB, có thể khôi phục hoặc audit
        review.setStorageState(StorageState.ARCHIVED);
        reviewRepository.save(review);

        log.info("Review {} soft-deleted by user {} (isAdmin={})", reviewId, userId, isAdmin);

        // Cập nhật lại điểm trung bình phim sau khi bỏ 1 review
        updateMovieRating(review.getMovie().getId());
    }

    /**
     * Tính lại điểm trung bình phim từ tất cả review còn active, rồi save vào Movie.
     *
     * Gọi sau mỗi: createReview, updateReview, deleteReview
     * → Đảm bảo movie.rating luôn phản ánh đúng trạng thái hiện tại.
     *
     * Tại sao không dùng trigger DB?
     * → Trigger khó test, khó debug, phụ thuộc DB engine.
     * → Service method: rõ ràng, testable, portable.
     */
    private void updateMovieRating(Long movieId) {
        Movie movie = movieRepository.findById(movieId)
                .orElseThrow(() -> new BusinessException(ErrorCode.MOVIE_NOT_FOUND));

        Double avg = reviewRepository.getAverageRatingByMovieId(movieId);

        // Nếu không còn review nào → rating = null
        if (avg == null) {
            movie.setRating(null);
        } else {
            movie.setRating(BigDecimal.valueOf(avg).setScale(1, RoundingMode.HALF_UP));
        }
        movieRepository.save(movie);

        log.info("Updated movie {} rating to {}", movie.getTitle(), movie.getRating());
    }
}
