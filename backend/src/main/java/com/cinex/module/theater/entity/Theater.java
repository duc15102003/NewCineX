package com.cinex.module.theater.entity;

import com.cinex.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Entity chi nhánh rạp — map bảng {@code theaters}.
 *
 * <p><b>Bối cảnh refactor F1:</b> Trước đây CineX chỉ có {@link com.cinex.module.room.entity.Room}
 * → giả định 1 rạp duy nhất. Pattern này không mô tả được thực tế:
 * <ul>
 *   <li>CGV có ~80 chi nhánh, Lotte ~50, BHD ~12</li>
 *   <li>1 chi nhánh chứa nhiều Room (thường 4-10)</li>
 *   <li>Cùng phim chiếu ở nhiều chi nhánh, user lọc theo gần nhất</li>
 *   <li>Báo cáo doanh thu cần group theo chi nhánh</li>
 * </ul>
 *
 * <p><b>Cấu trúc mới:</b> Theater (1) ↔ Room (N) ↔ Showtime (N). Tất cả booking/showtime
 * gián tiếp thuộc 1 theater qua chain {@code showtime.room.theater}.
 */
@Entity
@Table(name = "theaters")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Theater extends BaseEntity {

    /** Mã chi nhánh dạng dễ nhớ — VD "CNX-HN-LOTTE". Unique. */
    @Column(nullable = false, unique = true, length = 30)
    private String code;

    /** Tên hiển thị — VD "CineX Hà Nội — Lotte Mall Tây Hồ". */
    @Column(nullable = false, length = 200)
    private String name;

    /** Địa chỉ đầy đủ. */
    @Column(nullable = false, length = 500)
    private String address;

    /** Tên thành phố — dùng cho filter "rạp ở Hà Nội / TP.HCM". */
    @Column(nullable = false, length = 100)
    private String city;

    /** Hotline rạp — hiển thị trên trang chi nhánh. */
    @Column(length = 30)
    private String hotline;

    @Column(length = 100)
    private String email;

    /** Vĩ độ — phục vụ "rạp gần nhất" (Haversine formula). Optional. */
    @Column(precision = 9, scale = 6)
    private java.math.BigDecimal latitude;

    @Column(precision = 9, scale = 6)
    private java.math.BigDecimal longitude;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private TheaterStatus status = TheaterStatus.ACTIVE;
}
