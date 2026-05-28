package com.cinex.module.voucher.service;

import com.cinex.common.entity.StorageState;
import com.cinex.module.voucher.entity.Voucher;
import com.cinex.module.voucher.repository.VoucherRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * [Scheduled Task] Tự động archive voucher đã hết hạn.
 *
 * Chạy mỗi 5 phút: tìm voucher ACTIVE có endDate < now → set ARCHIVED.
 * Tránh admin nhầm lẫn voucher hết hạn vẫn hiện ACTIVE.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class VoucherCleanupScheduler {

    private final VoucherRepository voucherRepository;

    @Scheduled(fixedRate = 300000) // 5 phút
    @Transactional
    public void archiveExpiredVouchers() {
        List<Voucher> expired = voucherRepository.findByStorageStateAndEndDateBefore(
                StorageState.ACTIVE, LocalDateTime.now());

        for (Voucher voucher : expired) {
            voucher.setStorageState(StorageState.ARCHIVED);
            voucherRepository.save(voucher);
            log.info("Auto-archived expired voucher: {} (ended {})", voucher.getCode(), voucher.getEndDate());
        }

        if (!expired.isEmpty()) {
            log.info("Archived {} expired vouchers", expired.size());
        }
    }
}
