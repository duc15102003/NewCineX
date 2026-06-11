package com.cinex.common.audit.service;

import com.cinex.common.audit.dto.AuditLogFilter;
import com.cinex.common.audit.dto.AuditLogResponse;
import com.cinex.common.audit.entity.AuditLogV2;
import com.cinex.common.audit.repository.AuditLogV2Repository;
import com.cinex.common.audit.specification.AuditLogSpecification;
import com.cinex.common.response.PageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service truy vấn audit log (chỉ admin gọi).
 * Tách khỏi {@code AuditLogV2Service} để giữ SRP: 1 service ghi, 1 service đọc.
 */
@Service
@RequiredArgsConstructor
public class AuditLogQueryService {

    private final AuditLogV2Repository repository;

    @Transactional(readOnly = true)
    public PageResponse<AuditLogResponse> list(AuditLogFilter filter, Pageable pageable) {
        Specification<AuditLogV2> spec = AuditLogSpecification.fromFilter(filter);
        Page<AuditLogV2> page = repository.findAll(spec, pageable);
        return PageResponse.from(page.map(this::toResponse));
    }

    private AuditLogResponse toResponse(AuditLogV2 entry) {
        return AuditLogResponse.builder()
                .id(entry.getId())
                .userId(entry.getUserId())
                .username(entry.getUsername())
                .action(entry.getAction())
                .entityType(entry.getEntityType())
                .entityId(entry.getEntityId())
                .detail(entry.getDetail())
                .ipAddress(entry.getIpAddress())
                .userAgent(entry.getUserAgent())
                .createdAt(entry.getCreatedAt())
                .build();
    }
}
