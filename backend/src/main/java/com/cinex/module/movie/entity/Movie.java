package com.cinex.module.movie.entity;

import com.cinex.common.entity.BaseEntity;
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

import java.math.BigDecimal;
import java.time.LocalDate;
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

    @Column(name = "release_date")
    private LocalDate releaseDate;

    @Column(name = "end_date")
    private LocalDate endDate;

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

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MovieStatus status;

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
    @Builder.Default
    private Set<Genre> genres = new HashSet<>();
}
