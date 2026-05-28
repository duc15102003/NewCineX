package com.cinex.module.audit.service;

import com.cinex.module.audit.dto.AuditLogRequest;
import com.cinex.module.audit.entity.AuditLog;
import com.cinex.module.audit.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    /**
     * Ghi 1 dong audit log. Dung REQUIRES_NEW de audit log luon duoc ghi
     * ngay ca khi transaction chinh rollback.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void log(AuditLogRequest request) {
        AuditLog auditLog = AuditLog.builder()
                .tableName(request.getTableName())
                .recordId(request.getRecordId())
                .action(request.getAction())
                .fieldName(request.getFieldName())
                .oldValue(truncate(request.getOldValue(), 500))
                .newValue(truncate(request.getNewValue(), 500))
                .changedBy(getCurrentUser())
                .changedAt(LocalDateTime.now())
                .build();
        auditLogRepository.save(auditLog);
        log.debug("Audit: {} {} #{} field={}",
                request.getAction(), request.getTableName(),
                request.getRecordId(), request.getFieldName());
    }

    private String getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return "system";
        }
        return auth.getName();
    }

    private String truncate(String value, int maxLength) {
        if (value == null) return null;
        return value.length() > maxLength ? value.substring(0, maxLength) : value;
    }
}
