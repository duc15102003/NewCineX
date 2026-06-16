package com.cinex.module.loyalty.repository;

import com.cinex.module.loyalty.entity.LoyaltyTransaction;
import com.cinex.module.loyalty.entity.LoyaltyTransactionType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface LoyaltyTransactionRepository extends JpaRepository<LoyaltyTransaction, Long> {

    /**
     * History của 1 user — UI hiển thị statement, sort newest first.
     *
     * <p>@EntityGraph fetch booking → tránh N+1 khi map response.bookingCode. List 20 items
     * thì có khoảng 5-10 booking lazy load (nhiều transaction là REDEEM/ADJUST không có booking,
     * nhưng EARN có) → tiết kiệm 5-10 query mỗi page.
     */
    @EntityGraph(attributePaths = {"booking"})
    Page<LoyaltyTransaction> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    /** Kiểm tra booking đã được earn chưa — tránh double-earn nếu event re-publish. */
    boolean existsByBookingIdAndTransactionType(Long bookingId, LoyaltyTransactionType type);

    /**
     * EARN batch chưa hết hạn (còn remaining > 0, expires_at > now) của 1 user —
     * sort theo createdAt ASC để REDEEM FIFO trừ batch cũ nhất trước.
     *
     * <p>Industry pattern: First-In-First-Out — điểm cũ tiêu trước, vừa tránh
     * lãng phí (điểm cũ sắp expire) vừa đúng accounting.
     */
    @Query("SELECT t FROM LoyaltyTransaction t " +
           "WHERE t.user.id = :userId " +
           "AND t.transactionType = :type " +
           "AND t.remainingPoints > 0 " +
           "AND t.expiresAt > :now " +
           "ORDER BY t.createdAt ASC")
    List<LoyaltyTransaction> findActiveBatchesByUserIdFifo(@Param("userId") Long userId,
                                                            @Param("type") LoyaltyTransactionType type,
                                                            @Param("now") LocalDateTime now);

    /**
     * EARN batch đã hết hạn nhưng còn remaining — scheduler tìm để expire.
     * Limit query bằng Pageable để batch xử lý từng đợt nhỏ tránh OOM.
     */
    @Query("SELECT t FROM LoyaltyTransaction t " +
           "WHERE t.transactionType = :type " +
           "AND t.remainingPoints > 0 " +
           "AND t.expiresAt <= :cutoff")
    List<LoyaltyTransaction> findExpiredBatchesNotYetProcessed(@Param("type") LoyaltyTransactionType type,
                                                                @Param("cutoff") LocalDateTime cutoff,
                                                                Pageable pageable);

    /**
     * Tổng remaining_points của user sắp hết hạn trong window [now, before].
     * Dùng cho UI "X điểm sắp hết hạn 30 ngày tới" trên ProfilePage.
     * Trả 0 nếu không có batch nào (COALESCE).
     */
    @Query("SELECT COALESCE(SUM(t.remainingPoints), 0) FROM LoyaltyTransaction t " +
           "WHERE t.user.id = :userId " +
           "AND t.transactionType = :type " +
           "AND t.remainingPoints > 0 " +
           "AND t.expiresAt > :now " +
           "AND t.expiresAt <= :before")
    Integer sumPointsExpiringInWindow(@Param("userId") Long userId,
                                       @Param("type") LoyaltyTransactionType type,
                                       @Param("now") LocalDateTime now,
                                       @Param("before") LocalDateTime before);

    /**
     * Ngày expiry sớm nhất trong các batch active của user — null nếu user
     * không còn batch nào.
     */
    @Query("SELECT MIN(t.expiresAt) FROM LoyaltyTransaction t " +
           "WHERE t.user.id = :userId " +
           "AND t.transactionType = :type " +
           "AND t.remainingPoints > 0 " +
           "AND t.expiresAt > :now")
    LocalDateTime findNearestExpiryDate(@Param("userId") Long userId,
                                         @Param("type") LoyaltyTransactionType type,
                                         @Param("now") LocalDateTime now);
}
