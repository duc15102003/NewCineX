package com.cinex.common.audit.controller;

import com.cinex.common.audit.dto.AuditLogFilter;
import com.cinex.common.audit.dto.AuditLogResponse;
import com.cinex.common.audit.service.AuditLogQueryService;
import com.cinex.common.response.ApiResponse;
import com.cinex.common.response.PageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/audit-logs")
@RequiredArgsConstructor
@Tag(name = "Audit Log", description = "Audit log của admin actions")
public class AuditLogController {

    private final AuditLogQueryService auditLogQueryService;

    /**
     * GET /api/audit-logs?action=UPDATE_USER_ROLE&entityType=User&entityId=5&username=admin&from=...&to=...
     * Mới nhất ở đầu (sort = createdAt DESC).
     */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "(Admin) List audit logs with filter")
    public ApiResponse<PageResponse<AuditLogResponse>> list(
            AuditLogFilter filter,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ApiResponse.ok(auditLogQueryService.list(filter, pageable));
    }
}
