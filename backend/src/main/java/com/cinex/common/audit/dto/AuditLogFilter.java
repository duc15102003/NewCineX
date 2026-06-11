package com.cinex.common.audit.dto;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
public class AuditLogFilter {
    private String action;
    private String entityType;
    private Long entityId;
    private String username;
    private LocalDateTime from;
    private LocalDateTime to;
}
