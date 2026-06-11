package com.cinex.module.loyalty.repository;

import com.cinex.module.loyalty.entity.LoyaltyTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

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
    boolean existsByBookingIdAndTransactionType(Long bookingId,
                                                com.cinex.module.loyalty.entity.LoyaltyTransactionType type);
}
