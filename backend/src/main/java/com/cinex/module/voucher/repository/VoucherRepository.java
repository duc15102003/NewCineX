package com.cinex.module.voucher.repository;

import com.cinex.common.entity.StorageState;
import com.cinex.module.voucher.entity.Voucher;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface VoucherRepository extends JpaRepository<Voucher, Long>, JpaSpecificationExecutor<Voucher> {

    Optional<Voucher> findByCode(String code);

    boolean existsByCode(String code);

    List<Voucher> findByStorageStateAndEndDateBefore(StorageState state, LocalDateTime before);
}
