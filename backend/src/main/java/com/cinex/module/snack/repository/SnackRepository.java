package com.cinex.module.snack.repository;

import com.cinex.module.snack.entity.Snack;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface SnackRepository extends JpaRepository<Snack, Long>, JpaSpecificationExecutor<Snack> {
}
