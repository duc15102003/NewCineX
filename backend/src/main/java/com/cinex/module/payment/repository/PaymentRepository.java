package com.cinex.module.payment.repository;

import com.cinex.module.payment.entity.Payment;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, Long>, JpaSpecificationExecutor<Payment> {

    Optional<Payment> findByBookingId(Long bookingId);

    /**
     * Load payment với toàn bộ graph cần cho callback flow (user email, movie title,
     * room name, seat numbers). Dùng @EntityGraph để 1 query JOIN FETCH hết, tránh
     * N+1 + force-init thủ công khi publish @Async PaymentCompletedEvent.
     */
    @EntityGraph(attributePaths = {
            "booking.user",
            "booking.showtime.movie",
            "booking.showtime.room",
            "booking.bookingSeats.seat",
    })
    Optional<Payment> findByTransactionCode(String transactionCode);

    /**
     * Danh sách payment cần admin xử lý refund thủ công (race condition: payment
     * COMPLETED nhưng booking CANCELLED). Sort theo paidAt mới nhất.
     */
    List<Payment> findByNeedsRefundTrueOrderByPaidAtDesc();
}
