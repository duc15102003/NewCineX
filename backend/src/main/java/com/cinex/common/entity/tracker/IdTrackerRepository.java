package com.cinex.common.entity.tracker;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import java.util.Optional;

public interface IdTrackerRepository extends JpaRepository<IdTracker, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<IdTracker> findByEntityType(String entityType);
}
