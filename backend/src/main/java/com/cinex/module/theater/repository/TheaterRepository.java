package com.cinex.module.theater.repository;

import com.cinex.module.theater.entity.Theater;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Optional;

/**
 * Repository cho {@link Theater}.
 *
 * <p>Extends {@link JpaSpecificationExecutor} để hỗ trợ filter động (city, status, keyword).
 */
public interface TheaterRepository extends JpaRepository<Theater, Long>, JpaSpecificationExecutor<Theater> {

    /** Tìm theater theo mã code (vd "CNX-HN-LOTTE"). Dùng cho seed + import. */
    Optional<Theater> findByCode(String code);

    /** Check trùng code trước khi tạo mới. */
    boolean existsByCode(String code);
}
