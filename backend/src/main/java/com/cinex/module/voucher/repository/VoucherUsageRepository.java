package com.cinex.module.voucher.repository;

import com.cinex.module.voucher.entity.VoucherUsage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface VoucherUsageRepository extends JpaRepository<VoucherUsage, Long> {

    boolean existsByVoucherIdAndUserId(Long voucherId, Long userId);

    List<VoucherUsage> findByBookingId(Long bookingId);
}
