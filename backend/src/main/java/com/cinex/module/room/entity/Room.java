package com.cinex.module.room.entity;

import com.cinex.common.entity.BaseEntity;
import com.cinex.module.theater.entity.Theater;
import jakarta.persistence.Column;
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
@Table(name = "rooms")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Room extends BaseEntity {

    /**
     * Chi nhánh chứa phòng này.
     *
     * <p>Sau refactor F1 (migration 054), mỗi Room phải thuộc 1 Theater. Trước đây
     * giả định 1 rạp duy nhất; giờ scale multi-branch theo chuẩn CGV/Lotte.
     *
     * <p>LAZY mặc định — tránh load Theater khi list room.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "theater_id", nullable = false)
    private Theater theater;

    /**
     * Tên phòng — unique trong scope chi nhánh (nhiều chi nhánh có thể đặt "Phòng 1").
     * Trước đây unique=true global; sau F1 chỉ cần unique theo (theater_id, name)
     * — DB constraint chuyển thành composite unique nếu cần.
     */
    @Column(nullable = false, length = 50)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RoomType type;

    @Column(name = "total_seats", nullable = false)
    private Integer totalSeats;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private RoomStatus status = RoomStatus.ACTIVE;
}
