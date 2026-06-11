package com.cinex.module.pricing.repository;

import com.cinex.common.entity.StorageState;
import com.cinex.module.pricing.entity.PricingRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;

public interface PricingRuleRepository extends JpaRepository<PricingRule, Long>, JpaSpecificationExecutor<PricingRule> {

    /**
     * Lấy tất cả rule active (chưa ARCHIVED) — engine cache vào memory.
     * Sort priority DESC để rule cao priority áp dụng trước (khi cần break tie).
     */
    List<PricingRule> findByActiveTrueAndStorageStateNotOrderByPriorityDescIdAsc(StorageState excludeState);

    /** Check uniqueness — code đã tồn tại ở scope global. */
    boolean existsByCodeAndTheaterIsNull(String code);

    /** Check uniqueness — code đã tồn tại ở scope theater. */
    boolean existsByCodeAndTheaterId(String code, Long theaterId);
}
