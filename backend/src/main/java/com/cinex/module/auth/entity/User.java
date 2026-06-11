package com.cinex.module.auth.entity;

import com.cinex.common.entity.BaseEntity;
import com.cinex.module.loyalty.entity.LoyaltyTier;
import com.cinex.module.theater.entity.Theater;
import jakarta.persistence.Column;

import java.time.LocalDate;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User extends BaseEntity {

    @Column(nullable = false, unique = true, length = 50)
    private String username;

    @Column(nullable = false, unique = true, length = 100)
    private String email;

    @Column(nullable = false)
    private String password;

    @Column(name = "full_name", length = 100)
    private String fullName;

    @Column(length = 20)
    private String phone;

    @Column(name = "avatar_url", length = 500)
    private String avatarUrl;

    /**
     * Ngày sinh — OPTIONAL (user tự khai báo ở profile).
     *
     * <p><b>Mục đích (chuẩn industry rạp chiếu):</b> nếu user đã set DOB và DOB &lt; min age
     * của phim (T13/T16/T18/C) → BE auto-block lúc hold seats. Nếu user CHƯA set DOB →
     * không block (FE đã có confirm dialog disclaimer + verify CCCD vật lý ở cổng).
     *
     * <p>Pháp lý: rạp không bắt user khai DOB (PDPA / Nghị định 13/2023) — đây là
     * "voluntary disclosure" để user nhận trải nghiệm mượt hơn (không phải confirm tay).
     */
    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Role role = Role.USER;

    /**
     * Chi nhánh user thuộc về — sau F1 multi-branch RBAC.
     *
     * <p><b>Semantic theo role:</b>
     * <ul>
     *   <li>{@code USER}: NULL — user không thuộc chi nhánh cố định (booking ở đâu cũng được)</li>
     *   <li>{@code ADMIN}: NOT NULL — quản lý chi nhánh đó, scope locked qua JWT claim</li>
     *   <li>{@code SUPER_ADMIN}: NULL — không thuộc chi nhánh, xem tất cả</li>
     * </ul>
     *
     * <p>LAZY fetch — chỉ load khi explicit gọi user.getTheater(). Token-based authorization
     * chỉ cần id (đã có qua getTheaterId via mapper).
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "theater_id")
    private Theater theater;

    @Column(nullable = false)
    @Builder.Default
    private boolean enabled = true;

    /**
     * Đã xác thực email qua link gửi sau register chưa.
     * Khác với {@code enabled} (cho phép login hay không) — user mới register
     * vẫn login được nhưng {@code emailVerified=false}.
     * FE có thể chặn các action quan trọng (booking, review) khi chưa verify.
     */
    @Column(name = "email_verified", nullable = false)
    @Builder.Default
    private boolean emailVerified = false;

    // ──────────────────────────────────────────────────────────────
    // Loyalty (F3) — điểm thưởng + hạng thành viên
    // ──────────────────────────────────────────────────────────────

    /**
     * Số điểm hiện có — trừ ngay khi REDEEM. Có thể = 0 nếu user đã đổi hết điểm.
     */
    @Column(name = "loyalty_points", nullable = false)
    @Builder.Default
    private Integer loyaltyPoints = 0;

    /**
     * Tổng điểm KIẾM ĐƯỢC trong vòng đời (chỉ tăng, không trừ).
     * Dùng để quyết định tier — đảm bảo user redeem không tự "tụt hạng".
     */
    @Column(name = "lifetime_points", nullable = false)
    @Builder.Default
    private Integer lifetimePoints = 0;

    /**
     * Hạng thành viên. Tự upgrade khi {@code lifetimePoints} vượt threshold
     * (đọc từ system_config). KHÔNG downgrade — "hạng đã lên giữ trọn đời".
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private LoyaltyTier tier = LoyaltyTier.STANDARD;
}
