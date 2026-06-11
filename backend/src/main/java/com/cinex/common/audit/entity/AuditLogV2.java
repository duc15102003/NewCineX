package com.cinex.common.audit.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Audit log V2 — action-level, dùng cho tracing hành động admin.
 *
 * <p>KHÔNG extends BaseEntity vì:
 * - Audit log là append-only, không bao giờ update → không cần @Version optimistic lock.
 * - Audit log không bao giờ xóa (kể cả soft delete) → không cần storageState.
 * - Audit log không bao giờ "updatedAt" → chỉ có createdAt.
 *
 * <p>Table khác với entity {@code AuditLog} cũ (table: {@code audit_log}, field-level diff).
 * Bảng mới: {@code audit_logs} (số nhiều).
 */
@Entity
@Table(name = "audit_logs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLogV2 {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** ID của admin thực hiện. Nullable vì có thể là scheduler/system action. */
    @Column(name = "user_id")
    private Long userId;

    /** Username (snapshot tại thời điểm action). */
    @Column(name = "username", nullable = false, length = 100)
    private String username;

    /** Action code: UPDATE_USER_ROLE, REFUND_PAYMENT, ARCHIVE_MOVIE, ... */
    @Column(name = "action", nullable = false, length = 100)
    private String action;

    /** Loại entity: User, Movie, Payment, Booking. */
    @Column(name = "entity_type", nullable = false, length = 50)
    private String entityType;

    /** ID của entity (nullable nếu bulk action). */
    @Column(name = "entity_id")
    private Long entityId;

    /** JSON detail: snapshot input/diff. */
    @Column(name = "detail", length = 2000)
    private String detail;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "user_agent", length = 255)
    private String userAgent;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
