package com.cinex.module.audit.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@AllArgsConstructor
public class AuditLogRequest {

    private final String tableName;
    private final Long recordId;
    private final String action;
    private final String fieldName;
    private final String oldValue;
    private final String newValue;
}
