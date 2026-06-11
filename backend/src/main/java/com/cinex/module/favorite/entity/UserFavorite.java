package com.cinex.module.favorite.entity;

import com.cinex.common.entity.BaseEntity;
import com.cinex.module.auth.entity.User;
import com.cinex.module.movie.entity.Movie;
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
 * UserFavorite — extends BaseEntity để có đủ id/version/storageState/audit.
 *
 * Lưu ý: service hiện vẫn HARD DELETE khi unfavorite (UX toggle nhanh).
 * Cột storageState có sẵn để tương lai có thể chuyển sang soft delete nếu cần.
 */
@Entity
@Table(name = "user_favorites")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserFavorite extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "movie_id", nullable = false)
    private Movie movie;
}
