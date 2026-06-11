package com.cinex.module.combo.repository;

import com.cinex.common.entity.StorageState;
import com.cinex.module.combo.entity.Combo;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.Optional;

public interface ComboRepository extends JpaRepository<Combo, Long>, JpaSpecificationExecutor<Combo> {

    /** Check code trùng trong cùng 1 chi nhánh — code có thể trùng giữa 2 rạp. */
    boolean existsByTheaterIdAndCode(Long theaterId, String code);

    /** Find với items + snack fetch — tránh N+1 khi list combo. */
    @EntityGraph(attributePaths = {"items", "items.snack"})
    @Override
    Optional<Combo> findById(Long id);

    /** Admin list — phân trang theo 1 chi nhánh. */
    @EntityGraph(attributePaths = {"items", "items.snack"})
    Page<Combo> findByTheaterId(Long theaterId, Pageable pageable);

    /** Admin list — phân trang ALL (SUPER_ADMIN xem "Tất cả"). */
    @EntityGraph(attributePaths = {"items", "items.snack"})
    @Override
    Page<Combo> findAll(Pageable pageable);

    /** List active cho user-facing (POS hoặc booking add-on) — filter theo theater. */
    @EntityGraph(attributePaths = {"items", "items.snack"})
    List<Combo> findByActiveTrueAndStorageStateNotAndTheaterIdOrderByPriceAsc(
            StorageState excludeState, Long theaterId);

    /** Backward-compat (user-facing không có theater context): list active toàn hệ. */
    @EntityGraph(attributePaths = {"items", "items.snack"})
    List<Combo> findByActiveTrueAndStorageStateNotOrderByPriceAsc(StorageState excludeState);
}
