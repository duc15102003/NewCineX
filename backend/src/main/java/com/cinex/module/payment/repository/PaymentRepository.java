package com.cinex.module.payment.repository;

import com.cinex.module.payment.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, Long>, JpaSpecificationExecutor<Payment> {

    Optional<Payment> findByBookingId(Long bookingId);

    Optional<Payment> findByTransactionCode(String transactionCode);

    /**
     * Danh sách payment cần admin xử lý refund thủ công (race condition: payment
     * COMPLETED nhưng booking CANCELLED). Sort theo paidAt mới nhất.
     */
    List<Payment> findByNeedsRefundTrueOrderByPaidAtDesc();
}
