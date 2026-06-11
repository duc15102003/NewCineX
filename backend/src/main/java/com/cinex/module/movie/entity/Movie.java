package com.cinex.module.movie.entity;

import com.cinex.common.entity.BaseEntity;
// AgeRating + MovieStatus đã cùng package nên không cần import
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.BatchSize;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.Set;

/**
 * Entity phim — map bảng `movies`.
 *
 * Quan hệ N:N với Genre qua bảng join `movie_genres`:
 * - 1 phim có nhiều thể loại (Action + Sci-Fi)
 * - 1 thể loại thuộc nhiều phim
 * - JPA quản lý bảng join tự động — không cần tạo entity cho movie_genres
 */
@Entity
@Table(name = "movies")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Movie extends BaseEntity {

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "NTEXT")
    private String description;

    // Thời lượng phim (phút). VD: 120 = 2 tiếng
    @Column(nullable = false)
    private Integer duration;

    // releaseDate + endDate đã được CHUYỂN sang MovieRun (xem refactor R053).
    // Vòng đời chiếu thuộc về từng đợt (FIRST_RUN/REISSUE/...), không phải metadata Movie.

    @Column(name = "poster_url", length = 500)
    private String posterUrl;

    @Column(name = "trailer_url", length = 500)
    private String trailerUrl;

    @Column(length = 100)
    private String director;

    // Danh sách diễn viên, phân cách bằng dấu phẩy
    @Column(name = "cast", length = 500)
    private String cast;

    @Column(length = 50)
    private String language;

    // Điểm đánh giá 0.0 - 10.0
    @Column(precision = 3, scale = 1)
    private BigDecimal rating;

    /**
     * Số lượng review đã đóng góp vào điểm {@code rating} hiện tại.
     *
     * <p><b>Tại sao cần?</b> Để tính rating mới khi có review thêm/sửa/xóa theo công thức
     * incremental thay vì query AVG(*) mỗi lần (đắt khi phim có hàng nghìn review):
     * <pre>
     *   add:    newAvg = (oldAvg * count + newRating) / (count + 1);  count += 1
     *   update: newAvg = (oldAvg * count - oldRating + newRating) / count
     *   delete: newAvg = (oldAvg * count - oldRating) / (count - 1);  count -= 1
     * </pre>
     * Khi count = 0 → rating = null (chưa có ai đánh giá).
     */
    @Column(name = "rating_count", nullable = false)
    @Builder.Default
    private Integer ratingCount = 0;

    // Movie.status — XOÁ ở refactor "MovieRun là single source of truth":
    // status là kết quả query phụ thuộc context (theater + today), không phải thuộc tính phim.
    // Compute on-the-fly tại MovieMapper bằng MovieStatusComputer dựa trên MovieRun.

    /**
     * Phân loại độ tuổi (TT 25/2024/BVHTTDL). Default {@code P} (phổ biến).
     * Chỉ hiển thị badge ở trang chi tiết phim — không enforce check tuổi khi đặt vé.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "age_rating", nullable = false, length = 10)
    @Builder.Default
    private AgeRating ageRating = AgeRating.P;

    /**
     * [Quan hệ N:N] Movie <-> Genre qua bảng join movie_genres.
     *
     * @ManyToMany: 1 movie có nhiều genre, 1 genre thuộc nhiều movie
     * @JoinTable: chỉ định bảng join + 2 cột FK
     * FetchType.LAZY: KHÔNG load genres ngay khi query movie
     *   → Chỉ query genres khi gọi movie.getGenres() (tránh N+1 khi list movies)
     *
     * Tại sao dùng Set mà không phải List?
     * → Set đảm bảo không trùng genre (1 phim không thể có 2 lần "Action")
     * → Hibernate với @ManyToMany + List có thể gây bug xóa/thêm lại toàn bộ join table
     */
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "movie_genres",
            joinColumns = @JoinColumn(name = "movie_id"),
            inverseJoinColumns = @JoinColumn(name = "genre_id")
    )
    // [Batch Fetching] Khi cần load genres của nhiều movie cùng lúc mà KHÔNG có
    // @EntityGraph (vd: getMovie 1 entity, hoặc fallback path), Hibernate sẽ gom
    // tối đa 50 movie.id vào 1 query "WHERE movie_id IN (...)" thay vì N query lẻ.
    // Đây là tuyến phòng thủ thứ 2 chống N+1 ngoài @EntityGraph trên repository.
    @BatchSize(size = 50)
    @Builder.Default
    private Set<Genre> genres = new HashSet<>();
}
