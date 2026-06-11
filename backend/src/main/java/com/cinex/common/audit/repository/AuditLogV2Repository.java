package com.cinex.common.audit.repository;

import com.cinex.common.audit.entity.AuditLogV2;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

@Repository
public interface AuditLogV2Repository
        extends JpaRepository<AuditLogV2, Long>, JpaSpecificationExecutor<AuditLogV2> {
}
