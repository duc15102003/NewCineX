package com.cinex.module.seat.entity;

import com.cinex.common.entity.BaseEntity;
import com.cinex.module.room.entity.Room;
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

/**
 * Entity ghế ngồi — map bảng `seats`.
 *
 * Quan hệ N:1 với Room: 1 phòng có nhiều ghế, 1 ghế thuộc 1 phòng.
 *
 * @ManyToOne(fetch = LAZY): khi query seat, KHÔNG tự load Room entity.
 * Chỉ load khi gọi seat.getRoom(). Tránh N+1 khi list ghế.
 */
@Entity
@Table(name = "seats")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Seat extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

    // Hàng: "A", "B", ..., "J"
    @Column(name = "row_label", nullable = false, length = 5)
    private String rowLabel;

    // Cột: 1, 2, ..., 15
    @Column(name = "col_number", nullable = false)
    private Integer colNumber;

    // Label hiển thị: "A1", "B5", "J12"
    @Column(name = "seat_number", nullable = false, length = 10)
    private String seatNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "seat_type", nullable = false, length = 20)
    private SeatType seatType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private SeatStatus status = SeatStatus.AVAILABLE;
}
