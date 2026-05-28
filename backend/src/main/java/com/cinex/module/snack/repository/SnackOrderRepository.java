package com.cinex.module.snack.repository;

import com.cinex.module.snack.entity.SnackOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface SnackOrderRepository extends JpaRepository<SnackOrder, Long>, JpaSpecificationExecutor<SnackOrder> {
}
