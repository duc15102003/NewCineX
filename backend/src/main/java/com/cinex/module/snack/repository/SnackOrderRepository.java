package com.cinex.module.snack.repository;

import com.cinex.module.snack.entity.SnackOrder;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.lang.Nullable;

public interface SnackOrderRepository extends JpaRepository<SnackOrder, Long>, JpaSpecificationExecutor<SnackOrder> {

    /**
     * Override findAll(spec, pageable) với {@link EntityGraph} fetch toàn bộ chuỗi association
     * mà service map ra response: theater + items + items.snack + items.combo + items.snack.theater.
     *
     * <p><b>Vì sao?</b> SnackOrder LAZY toàn bộ. Service {@code toResponse()} touch các field này
     * → trigger N+1: với page size 20 và mỗi order có ~3 items → 20 (theater) + 20 (items) +
     * 60 (snack/combo) = 100+ query lẻ. EntityGraph gom thành 1 query JOIN duy nhất.
     *
     * <p>Spring Data JPA tự áp EntityGraph khi proxy method này được gọi với spec + pageable.
     */
    @Override
    @EntityGraph(attributePaths = {
            "theater",
            "items",
            "items.snack",
            "items.combo",
    })
    Page<SnackOrder> findAll(@Nullable Specification<SnackOrder> spec, Pageable pageable);
}
