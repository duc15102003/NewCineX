package com.cinex.module.notification.entity;

import com.cinex.common.entity.BaseEntity;
import com.cinex.module.auth.entity.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Notification entity — extends BaseEntity để có đủ:
 *   - id, version (Optimistic Lock)
 *   - storageState (Soft delete)
 *   - createdBy / updatedBy / createdAt / updatedAt (JPA Auditing)
 *
 * Trước đây class này tự khai báo @Id + createdAt thủ công → khác pattern toàn dự án.
 * Sau refactor (changeset 044): đồng nhất với mọi entity nghiệp vụ khác.
 */
@Entity
@Table(name = "notifications")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Notification extends BaseEntity {

    // [Lazy Loading] Chỉ load User khi thực sự cần → tránh N+1 query
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "title", nullable = false, length = 200, columnDefinition = "NVARCHAR(200)")
    private String title;

    @Column(name = "content", columnDefinition = "NTEXT")
    private String content;

    // Dùng String thay vì Enum để linh hoạt hơn — xem NotificationType cho constants
    @Column(name = "type", nullable = false, length = 30, columnDefinition = "NVARCHAR(30)")
    private String type;

    // Business rule: Thông báo mới tạo ra luôn ở trạng thái chưa đọc
    @Column(name = "is_read", nullable = false)
    @Builder.Default
    private boolean isRead = false;
}
