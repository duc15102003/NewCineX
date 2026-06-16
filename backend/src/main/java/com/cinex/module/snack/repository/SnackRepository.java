package com.cinex.module.snack.repository;

import com.cinex.common.entity.StorageState;
import com.cinex.module.snack.entity.Snack;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

public interface SnackRepository extends JpaRepository<Snack, Long>, JpaSpecificationExecutor<Snack> {

    /** Trim + case-insensitive unique check per theater. */
    boolean existsByNameIgnoreCaseAndTheaterIdAndStorageState(
            String name, Long theaterId, StorageState storageState);

    /** Loại trừ id chính nó khi update. */
    boolean existsByNameIgnoreCaseAndTheaterIdAndIdNotAndStorageState(
            String name, Long theaterId, Long excludeId, StorageState storageState);

    /**
     * Đếm số Combo ACTIVE đang reference snack này — chặn xoá nếu có,
     * tránh combo bị thiếu item khi snack archived.
     */
    @Query("SELECT COUNT(DISTINCT ci.combo.id) FROM com.cinex.module.combo.entity.ComboItem ci " +
           "WHERE ci.snack.id = :snackId AND ci.combo.storageState = com.cinex.common.entity.StorageState.ACTIVE")
    long countActiveCombosUsingSnack(Long snackId);
}
